// Humo extra: siembra un mensaje del assistant con markdown + traza de tools en el
// cache de localStorage y verifica que la burbuja renderice Markdown y TrazaTool
// sin pageerrors. El humo.mjs base abre el space con el hilo vacio, asi que nunca
// llega a montar los componentes nuevos.
// playwright vive en alicia-brain; ver la nota en humo.mjs.
const PW = process.env.PLAYWRIGHT_URL
  || new URL("../../../alicia-brain/node_modules/playwright/index.js", import.meta.url).href;
const _pw = await import(PW);
const chromium = _pw.chromium ?? _pw.default?.chromium;
const base = process.argv[2] || "http://localhost:5173";

const browser = await chromium.launch();
const page = await browser.newPage();
await page.addInitScript(() => {
  try {
    localStorage.setItem("hygge:cal:granted:sb", "1");
    localStorage.setItem("hygge:user:wa:sb", "");
    // sin el cerebro corriendo, AliciaView muestra la pantalla de "Conectar Alicia"
    // y nunca renderiza el hilo. La key falsa abre el chat.
    localStorage.setItem("alicia_api_key", "sk-humo-falsa");
    localStorage.setItem("alicia_chat_sb_v1", JSON.stringify([
      { role: "user", content: "**esto NO debe verse en negrita**", ts: Date.now() },
      { role: "assistant", ts: Date.now(), actions: [],
        content: "Texto en **negrita** y `code`.\n\n- uno\n- dos\n\n| a | b |\n|---|---|\n| 1 | 2 |",
        pasos: [
          { id: "t1", tool: "radar_query", input: { q: "DC01" }, ok: true },
          { id: "t2", tool: "tool_desconocida", input: { x: 1 }, ok: false },
          { id: "t3", tool: "get_tasks", input: {}, ok: null },
        ] },
      { role: "assistant", content: "escribiendo en vivo", ts: Date.now(), pasos: [], streaming: true },
    ]));
  } catch {}
});
const errores = [];
page.on("pageerror", (e) => errores.push(String(e.message || e).split("\n")[0]));
await page.goto(base, { waitUntil: "networkidle", timeout: 30000 });
await page.evaluate(() => { window.location.hash = "#/space/alicia"; });
await page.waitForTimeout(2000);

const r = await page.evaluate(() => ({
  nodos: document.querySelectorAll("*").length,
  strong: document.querySelectorAll("strong").length,
  li: document.querySelectorAll("li").length,
  table: document.querySelectorAll("table").length,
  code: document.querySelectorAll("code").length,
  traza: document.body.innerText.includes("consultando el radar"),
  trazaCruda: document.body.innerText.includes("tool_desconocida"),
  cursor: document.body.innerText.includes("▍"),
  asteriscosDelUsuario: document.body.innerText.includes("**esto NO debe verse en negrita**"),
}));
console.log(JSON.stringify(r, null, 2));
console.log("pageerrors", errores.length);
errores.forEach(e => console.log("  x", e));
await browser.close();
const ok = errores.length === 0 && r.strong > 0 && r.li >= 2 && r.table === 1 && r.traza && r.trazaCruda && r.cursor && r.asteriscosDelUsuario;
console.log(ok ? "\nBURBUJA OK" : "\nBURBUJA FALLA");
process.exit(ok ? 0 : 1);
