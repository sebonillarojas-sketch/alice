// Humo con browser real contra el dev server del ERP.
//
// Existe porque `npm run build` NO detecta variables no definidas: Vite compila
// limpio y el componente revienta recien al montarse. Asi se colo un `useEffect`
// sin importar en EsquemaPlanta.jsx que, sin error boundary, tumbaba la app entera
// (el arbol pasaba de ~900 nodos a 2) al abrir Cabida. El build estaba verde.
//
// Uso:  npm run humo -- [baseUrl]    (default http://localhost:5173)
// Recorre varios spaces y falla si alguno tira pageerrors o no monta.

// playwright es CJS: al importarlo dinamicamente los named exports quedan bajo .default.
// Vive en alicia-brain (es dependencia del cerebro, no del ERP), asi que lo resolvemos
// relativo a este archivo. PLAYWRIGHT_URL permite apuntarlo a otro lado si hiciera falta.
const PW = process.env.PLAYWRIGHT_URL
  || new URL("../../../alicia-brain/node_modules/playwright/index.js", import.meta.url).href;
const _pw = await import(PW);
const chromium = _pw.chromium ?? _pw.default?.chromium;

const base = process.argv[2] || "http://localhost:5173";
// Spaces que toca (o rodea) la Fase 2. "alicia" es el space del copiloto.
const SPACES = ["hq", "alicia", "app-cabida", "app-velocity", "growth"];
const MIN_NODOS = 20;

const browser = await chromium.launch();
const page = await browser.newPage();

// El onboarding de 3 pasos tapa la app. Sembrar sus dos flags ANTES de que corra el
// bundle deja el ERP montado de una, que es donde estan los componentes que importan.
await page.addInitScript(() => {
  try {
    localStorage.setItem("hygge:cal:granted:sb", "1");
    localStorage.setItem("hygge:user:wa:sb", "");
  } catch {}
});

let errores = [];
const capturar = (space) => (e) => errores.push(`[${space}] ${String(e.message || e).split("\n")[0]}`);

let spaceActual = "carga inicial";
page.on("pageerror", (e) => capturar(spaceActual)(e));

await page.goto(base, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(1200);

const resultados = [];
for (const space of SPACES) {
  spaceActual = space;
  const antes = errores.length;
  await page.evaluate((s) => { window.location.hash = `#/space/${s}`; }, space);
  await page.waitForTimeout(1500);
  const nodos = await page.evaluate(() => document.querySelectorAll("*").length);
  const nuevos = errores.length - antes;
  resultados.push({ space, nodos, nuevos });
  console.log(`${space.padEnd(14)} nodos ${String(nodos).padStart(5)}   pageerrors ${nuevos}`);
}

if (errores.length) {
  console.log("\nerrores:");
  errores.forEach((e) => console.log(`  x ${e}`));
}

await browser.close();

const muertos = resultados.filter((r) => r.nodos < MIN_NODOS);
if (muertos.length) console.log(`\nspaces que no montaron: ${muertos.map((m) => m.space).join(", ")}`);
const ok = errores.length === 0 && muertos.length === 0;
console.log(ok ? "\nHUMO OK" : "\nHUMO FALLA");
process.exit(ok ? 0 : 1);
