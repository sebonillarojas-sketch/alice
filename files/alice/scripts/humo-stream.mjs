// Humo del streaming real: manda dos mensajes contra el cerebro falso y verifica
// (1) que el texto final sea el de `done` y no el acumulado, (2) que un frame de
// error borre la burbuja parcial, (3) que lo guardado en localStorage sea lo mismo
// que se ve en pantalla.
// playwright vive en alicia-brain; ver la nota en humo.mjs.
const PW = process.env.PLAYWRIGHT_URL
  || new URL("../../../alicia-brain/node_modules/playwright/index.js", import.meta.url).href;
const _pw = await import(PW);
const chromium = _pw.chromium ?? _pw.default?.chromium;
const base = process.argv[2] || "http://localhost:5173";
// El mismo puerto que levanta cerebro-falso.mjs (CEREBRO_FALSO_PORT).
const falso = process.env.CEREBRO_FALSO_URL || "http://localhost:3999";

await fetch(`${falso}/reset`);   // el guion de turnos arranca de cero
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 420 } });
await page.addInitScript(() => {
  try {
    localStorage.setItem("hygge:cal:granted:sb", "1");
    localStorage.setItem("hygge:user:wa:sb", "");
    localStorage.setItem("alicia_voice_enabled", "false");
    localStorage.setItem("alicia_chat_sb_v1", "[]");
  } catch {}
  // En headless, scrollIntoView no mueve scrollTop: mirar la posicion no prueba
  // nada (verificado — el test pasaba igual con el comportamiento viejo). Espiamos
  // la llamada, que es exactamente lo que la guarda `alFondo` decide.
  window.__scrollCalls = 0;
  const orig = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function (...a) { window.__scrollCalls++; return orig.apply(this, a); };
});
const errores = [];
page.on("pageerror", (e) => errores.push(String(e.message || e).split("\n")[0]));

await page.goto(base, { waitUntil: "networkidle", timeout: 30000 });
await page.evaluate(() => { window.location.hash = "#/space/alicia"; });
await page.waitForTimeout(1500);

const ta = page.locator("textarea").first();
const fallos = [];

// ── Turno 1: feliz ────────────────────────────────────────────────────────────
await ta.fill("hola");
await ta.press("Enter");
await page.waitForTimeout(150);
const mitad = await page.evaluate(() => ({
  texto: document.body.innerText,
  cursor: document.body.innerText.includes("▍"),
}));
if (!mitad.cursor) fallos.push("a mitad del stream no se ve el cursor de streaming");
if (!/Voy a revisar|Respuesta/.test(mitad.texto)) fallos.push("a mitad del stream no se pintan deltas");
console.log("a mitad del stream — cursor visible:", mitad.cursor,
  "| pinta deltas:", /Voy a revisar|Respuesta/.test(mitad.texto));
await page.waitForTimeout(1500);

const t1 = await page.evaluate(() => {
  const guardado = JSON.parse(localStorage.getItem("alicia_chat_sb_v1") || "[]");
  return {
    texto: document.body.innerText,
    cursor: document.body.innerText.includes("▍"),
    guardadoUltimo: guardado[guardado.length - 1],
  };
});
if (!/autoritativa/.test(t1.texto)) fallos.push("el texto de `done` no quedó en pantalla");
if (/en curso/.test(t1.texto)) fallos.push("quedó el buffer acumulado en pantalla en vez del texto de `done`");
if (/Voy a revisar/.test(t1.texto)) fallos.push("no se respetó text_reset: quedó el texto de la iteración anterior");
if (!/consultando el radar/.test(t1.texto)) fallos.push("no se ve la traza de la tool");
if (t1.cursor) fallos.push("quedó el cursor de streaming después del done");
if (t1.guardadoUltimo?.content !== "Respuesta final **autoritativa**")
  fallos.push(`localStorage guardó ${JSON.stringify(t1.guardadoUltimo?.content)} en vez del texto de done`);
if (t1.guardadoUltimo?.streaming) fallos.push("el mensaje guardado quedó marcado streaming");
console.log("turno 1 guardado:", JSON.stringify(t1.guardadoUltimo?.content));

// ── Turno 2: frame de error ───────────────────────────────────────────────────
await ta.fill("reventá");
await ta.press("Enter");
await page.waitForTimeout(2000);
const t2 = await page.evaluate(() => {
  const guardado = JSON.parse(localStorage.getItem("alicia_chat_sb_v1") || "[]");
  return { texto: document.body.innerText, guardadoUltimo: guardado[guardado.length - 1] };
});
if (/Esto no existe en ninguna base/.test(t2.texto))
  fallos.push("el frame de error dejó la burbuja parcial en pantalla");
if (!/Corté el turno a mitad/.test(t2.texto))
  fallos.push("el frame de error no dejó un mensaje honesto");
if (!/el cerebro se cayo/.test(t2.texto)) fallos.push("no se muestra el motivo del error");
if (!t2.guardadoUltimo?.isError) fallos.push("lo guardado tras el error no es el mensaje de error");
// La traza tiene que sobrevivir al error: es el registro de qué llegó a correr.
if (!/buscando en tu correo/.test(t2.texto)) fallos.push("el mensaje de error perdió la traza de tools");
if (!(t2.guardadoUltimo?.pasos?.length === 1)) fallos.push("el mensaje de error guardado no lleva `pasos`");
console.log("turno 2 guardado:", JSON.stringify(t2.guardadoUltimo?.content),
  "| pasos:", t2.guardadoUltimo?.pasos?.length);

// ── Turno 3: stream truncado, sin `done` y sin `error` ────────────────────────
await ta.fill("truncame");
await ta.press("Enter");
await page.waitForTimeout(2000);
const t3 = await page.evaluate(() => {
  const g = JSON.parse(localStorage.getItem("alicia_chat_sb_v1") || "[]");
  return { texto: document.body.innerText, ultimo: g[g.length - 1] };
});
if (/Fantasma sin done/.test(t3.texto))
  fallos.push("un stream sin `done` dejó el buffer acumulado en pantalla");
if (t3.ultimo?.content?.includes("Fantasma"))
  fallos.push("un stream sin `done` persistió el buffer en localStorage");
if (!t3.ultimo?.isError) fallos.push("un stream sin `done` no se trató como fallo");
if (!/sin cerrar el turno/.test(t3.ultimo?.content || ""))
  fallos.push("el stream truncado no usó el camino delCerebro");
console.log("turno 3 guardado:", JSON.stringify(t3.ultimo?.content));

// ── Turno 4: text_delta malformado ────────────────────────────────────────────
await ta.fill("malformado");
await ta.press("Enter");
await page.waitForTimeout(1500);
const t4 = await page.evaluate(() => ({ texto: document.body.innerText }));
if (/undefined/.test(t4.texto)) fallos.push("un text_delta sin `text` pegó el literal undefined");
console.log("turno 4 — 'undefined' en pantalla:", /undefined/.test(t4.texto));

// ── Auto-scroll: la guarda `alFondo` decide si se llama a scrollIntoView ──────
await page.evaluate(() => {
  // El primer div con overflowY:auto del documento NO es el hilo (hay paneles
  // antes). Ubicamos el contenedor real subiendo desde una burbuja conocida hasta
  // el primer ancestro scrolleable.
  // el elemento hoja que contiene el texto (es un <strong> dentro de un <p>)
  const hoja = [...document.querySelectorAll("*")]
    .filter(e => e.children.length === 0 && e.textContent.includes("autoritativa")).pop();
  let cont = hoja?.parentElement;
  while (cont && getComputedStyle(cont).overflowY !== "auto") cont = cont.parentElement;
  if (cont) {
    window.__cont = cont;
    window.__desborda = cont.scrollHeight > cont.clientHeight + 150;
    cont.scrollTop = 0;
  }
});
const cont = await page.evaluate(() => ({ hay: !!window.__cont, desborda: !!window.__desborda, top: window.__cont?.scrollTop }));
if (!cont.hay) fallos.push("no se encontró el contenedor scrolleable del hilo");
// Sin desborde `alFondo` es siempre true y el test no probaría nada.
if (!cont.desborda) fallos.push("el hilo no desborda: la guarda alFondo no se ejercita");
if (cont.top !== 0) fallos.push(`no se pudo scrollear el hilo arriba (top ${cont.top})`);
await page.evaluate(() => { window.__scrollCalls = 0; });
await ta.fill("no me arrastres");
await ta.press("Enter");
await page.waitForTimeout(2200);
const arribaCalls = await page.evaluate(() => window.__scrollCalls);
if (arribaCalls > 0)
  fallos.push(`el usuario scrolleado arriba fue arrastrado al fondo (${arribaCalls} scrollIntoView)`);
console.log("usuario scrolleado arriba — scrollIntoView durante el turno:", arribaCalls);

// Control positivo: si el usuario YA está al fondo, el hilo tiene que seguirlo.
// Sin esto, "nunca scrollea" tambien pasaria el test de arriba.
await page.evaluate(() => {
  if (window.__cont) window.__cont.scrollTop = window.__cont.scrollHeight;
  window.__scrollCalls = 0;
});
await ta.fill("seguime");
await ta.press("Enter");
await page.waitForTimeout(2200);
const fondoCalls = await page.evaluate(() => window.__scrollCalls);
if (fondoCalls < 1) fallos.push("estando al fondo el hilo no siguió el mensaje nuevo");
console.log("usuario al fondo — scrollIntoView durante el turno:", fondoCalls);

await browser.close();
console.log("\npageerrors", errores.length);
errores.forEach(e => console.log("  x", e));
fallos.forEach(f => console.log("  ! " + f));
const ok = errores.length === 0 && fallos.length === 0;
console.log(ok ? "\nSTREAM OK" : "\nSTREAM FALLA");
process.exit(ok ? 0 : 1);
