// El round-trip de las manos, en un Chromium de verdad contra el cerebro falso.
// Tres cosas que ningún test unitario puede cubrir:
//   1. Un client_tool de navegación CAMBIA la pantalla y contesta con lo que leyó.
//   2. El chat SOBREVIVE a esa navegación (es el motivo de todo el dock).
//   3. Un `confirm` NO ejecuta nada hasta el click, y "No" tampoco ejecuta.
//
// De yapa (no estaba en el spec original) cubre el dock: el lanzador aparece
// en cualquier space menos en "alicia" (ahí la conversación ya se ve a lo
// ancho, y mostrar el lanzador ahí duplicaría el chat) y abrir el dock en otro
// space monta un solo composer. Si el `ocultar` de CopilotoDock se rompiera
// (por ejemplo, si alguien lo invirtiera o lo borrara), los otros tres humos
// seguirían en verde: ninguno mira el dock.
//
// playwright vive en alicia-brain; ver la nota en humo.mjs.
const PW = process.env.PLAYWRIGHT_URL
  || new URL("../../../alicia-brain/node_modules/playwright/index.js", import.meta.url).href;
const _pw = await import(PW);
const chromium = _pw.chromium ?? _pw.default?.chromium;

const base = process.argv[2] || "http://localhost:5173";
const falso = process.env.CEREBRO_FALSO_URL || "http://localhost:3999";
const fallas = [];
const check = (ok, que) => { console.log(`${ok ? "✔" : "✘"} ${que}`); if (!ok) fallas.push(que); };

// `resultados` es estado del proceso: sin limpiarlo, una segunda corrida vería
// las respuestas de la corrida anterior y los checks de "sin click, nada se
// ejecutó" darían falsos negativos.
await fetch(`${falso}/reset`);

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (e) => fallas.push(`pageerror: ${e.message}`));

// El onboarding de 3 pasos tapa la app (mismo truco que humo.mjs / humo-stream.mjs).
await page.addInitScript(() => {
  try {
    localStorage.setItem("hygge:cal:granted:sb", "1");
    localStorage.setItem("hygge:user:wa:sb", "");
  } catch {}
});

await page.goto(base, { waitUntil: "networkidle", timeout: 30000 });
await page.evaluate(() => { window.location.hash = "#/space/alicia"; });
await page.waitForTimeout(1500);

// ── 0 · dock: el lanzador NO aparece en el space alicia ──────────────────────
// Acá la conversación ya se ve a lo ancho (AliciaView la monta directo); el
// dock se auto-oculta (`ocultar={currentSpace === "alicia"}` en HyggeOS.jsx)
// para no mostrar el mismo chat dos veces. Chequeado ANTES de escribir nada,
// para no interferir con el conteo de composers que sigue.
check(await page.locator('button[title="Alicia"]').count() === 0, "en el space alicia NO hay lanzador del dock (ya se ve el chat a lo ancho)");
check(await page.locator("textarea").count() === 1, "en el space alicia hay un solo composer montado (no el del dock + el de AliciaView)");

// ── 1 · navegación ────────────────────────────────────────────────────────────
await page.fill("textarea", "abrime cabida");
await page.keyboard.press("Enter");
await page.waitForTimeout(6000);

const cuerpo1 = await page.textContent("body");
// OJO: `/cabida/i` sobre el body ENTERO pasa aunque no haya navegación de verdad,
// porque el usuario tipeó literalmente "abrime cabida" y ese texto se ecoa en la
// burbuja del mensaje — y además TODAS las ramas de `navegar()` en manos.js
// interpolan el id del módulo en su texto de vuelta, incluida la de "el módulo X
// no existe". Un regex así pasa aunque erp_navigate esté roto. Por eso se
// verifican dos cosas independientes: que el eco del mensaje tipeado (que sólo
// existe mientras seguís en el space alicia) haya desaparecido, y que un texto
// que SÓLO vive adentro de CabidaView (el título de una de sus cards) esté en
// pantalla — ninguna de las dos depende de lo que el usuario escribió.
check(!/abrime cabida/i.test(cuerpo1), "salimos del space alicia: el eco del mensaje tipeado ya no está en pantalla");
check(/terreno y normativa/i.test(cuerpo1), "el módulo Cabida realmente montó (título de card que sólo existe en CabidaView)");

// erp_navigate cambió de space: la conversación de AliciaView (ancho="full")
// se desmontó con él, y con ella el "El browser contestó…" del done — el dock
// arranca cerrado en el space nuevo, así que el hilo (que SÍ sobrevive en
// CopilotoProvider, por encima del router) no se pinta hasta reabrirlo. Por
// eso el texto del done se busca DESPUÉS de reabrir, no acá.
check(await page.locator('button[title="Alicia"]').count() === 1, "al salir de alicia aparece el lanzador del dock");
await page.click('button[title="Alicia"]');
await page.waitForTimeout(400);
const cuerpo1b = await page.textContent("body");
check(/El browser contestó/.test(cuerpo1b), "el cerebro recibió la respuesta del client_tool");
check(/abrime cabida/.test(cuerpo1b), "el chat sobrevivió a la navegación: el dock reabierto muestra el hilo completo");
check(await page.locator("textarea").count() === 1, "reabrir el dock monta un solo composer");

// ── 2 · confirmación, decisión "No" ───────────────────────────────────────────
await page.fill("textarea", "cambiá los pisos a 9");
await page.keyboard.press("Enter");
await page.waitForTimeout(2500);

check(await page.isVisible("text=Alicia quiere modificar algo"), "el diálogo de confirmación apareció");
const antesNo = await (await fetch(`${falso}/resultados`)).json();
check(!antesNo.some(r => r.call_id === "c-decline"), "sin click, NADA se ejecutó ni se contestó");

await page.getByRole("button", { name: "No", exact: true }).click();
await page.waitForTimeout(2500);
const despuesNo = await (await fetch(`${falso}/resultados`)).json();
const rNo = despuesNo.find(r => r.call_id === "c-decline");
check(!!rNo, "después de \"No\", el browser sí contestó (el modelo tiene que enterarse)");
check(!/humo\.escribir recibió/.test(String(rNo?.result ?? "")), "\"No\" NO ejecutó la acción real (el resultado no es el de humo.escribir)");

// ── 3 · confirmación, decisión "Ejecutar" ─────────────────────────────────────
await page.fill("textarea", "dale, cambiá los pisos a 9");
await page.keyboard.press("Enter");
await page.waitForTimeout(2500);

check(await page.isVisible("text=Alicia quiere modificar algo"), "el segundo diálogo de confirmación apareció");
const antesSi = await (await fetch(`${falso}/resultados`)).json();
check(!antesSi.some(r => r.call_id === "c-write"), "sin click, la segunda escritura tampoco se ejecutó");

await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
await page.waitForTimeout(3000);
const despuesSi = await (await fetch(`${falso}/resultados`)).json();
const rSi = despuesSi.find(r => r.call_id === "c-write");
check(/humo\.escribir recibió/.test(String(rSi?.result ?? "")), "después de \"Ejecutar\", corrió la acción REAL del bus (cabida.humo.escribir)");

await browser.close();
console.log(fallas.length ? `\nMANOS FALLA\n- ${fallas.join("\n- ")}` : "\nMANOS OK");
process.exit(fallas.length ? 1 : 0);
