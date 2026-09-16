// Cerebro falso: sirve /health, /api/copilot/history y un /api/copilot/turn que
// stremea SSE de verdad. Existe para poder verificar el streaming del space sin el
// modelo: con SANDBOX el cerebro real no manda deltas.
import http from "node:http";

const PUERTO = Number(process.env.CEREBRO_FALSO_PORT || 3999);

const cors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "*");
};
let turno = 0;
// Los resultados que contestó el browser, para que el humo los pueda auditar.
const resultados = [];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

http.createServer(async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  const url = new URL(req.url, "http://x");

  if (url.pathname === "/health") { res.writeHead(200); return res.end("ok"); }
  // El contador de turnos es estado del proceso: sin resetear, una segunda corrida
  // del humo arranca en el turno 5 y todas las aserciones miran el guion equivocado.
  if (url.pathname === "/reset") { turno = 0; resultados.length = 0; res.writeHead(200); return res.end("ok"); }
  if (url.pathname === "/api/copilot/history") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ messages: [] }));
  }
  // El browser contesta acá lo que ejecutó un client_tool o un confirm. Es una
  // ruta aparte porque la del turno está ocupada streameando SSE.
  if (/^\/api\/copilot\/turn\/[^/]+\/result$/.test(url.pathname)) {
    let cuerpo = "";
    for await (const c of req) cuerpo += c;
    const { call_id, result } = JSON.parse(cuerpo || "{}");
    resultados.push({ call_id, result });
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true }));
  }
  if (url.pathname === "/resultados") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(resultados));
  }
  if (url.pathname === "/api/copilot/turn") {
    // El cuerpo trae `message`: los guiones de manos se eligen por el TEXTO que
    // mandó el usuario, no por la posición en la secuencia. Si dependieran del
    // contador `turno` (como los guiones 1-4), humo-stream.mjs los pisaría: manda
    // seis mensajes reales (los cuatro del contrato + dos del auto-scroll) y el
    // quinto y el sexto caerían en los guiones de manos por casualidad de
    // posición, no porque el humo de manos esté corriendo. Ya pasó una vez acá
    // mismo: "seguime" (turno 6 de humo-stream) disparaba el guion de
    // confirmación y el humo se colgaba esperando un click que nadie iba a dar.
    let cuerpo = "";
    for await (const c of req) cuerpo += c;
    let mensaje = "";
    try { mensaje = JSON.parse(cuerpo || "{}").message || ""; } catch {}

    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    if (mensaje === "abrime cabida") {
      // Manos que leen: turn_start, un client_tool de navegación, y el done usa
      // lo que el browser contestó. Si el cliente no contestara, esto cuelga y
      // el humo falla por timeout — que es exactamente lo que queremos detectar.
      send("turn_start", { turnId: "t-manos" });
      for (const t of ["Voy ", "a ", "abrir ", "Cabida"]) { send("text_delta", { text: t }); await sleep(15); }
      send("tool_start", { id: "n1", tool: "erp_navigate", input: { module: "cabida" } });
      send("client_tool", { call_id: "c-nav", id: "n1", tool: "erp_navigate", input: { module: "cabida" }, efecto: "navigate" });
      // Esperar a que el browser conteste de verdad, con techo.
      const t0 = Date.now();
      while (!resultados.some(r => r.call_id === "c-nav") && Date.now() - t0 < 8000) await sleep(50);
      const r = resultados.find(x => x.call_id === "c-nav");
      send("tool_done", { id: "n1", tool: "erp_navigate", ok: !!r });
      send("text_reset", {});
      send("done", { text: r ? `El browser contestó: ${String(r.result).slice(0, 80)}` : "NADIE CONTESTÓ", actions: [] });
      return res.end();
    }
    if (mensaje === "cambiá los pisos a 9") {
      // Manos que escriben, decisión "No": el frame es `confirm`, no `client_tool`.
      // El browser NO tiene que ejecutar nada hasta que alguien haga click, y un
      // "No" contesta (el modelo necesita saber que lo rechazaron) pero SIN
      // haber corrido la acción real — se audita mirando el TEXTO de la
      // respuesta, no sólo si contestó: si "No" ejecutara igual, el resultado
      // diría "humo.escribir recibió…" en vez del rechazo.
      send("turn_start", { turnId: "t-confirm-no" });
      send("tool_start", { id: "w1", tool: "erp_action", input: { action: "humo.escribir", args: { v: 1 } } });
      send("confirm", { call_id: "c-decline", id: "w1", tool: "erp_action", input: { action: "humo.escribir", args: { v: 1 } }, efecto: "write" });
      const t0 = Date.now();
      while (!resultados.some(r => r.call_id === "c-decline") && Date.now() - t0 < 15000) await sleep(50);
      const r = resultados.find(x => x.call_id === "c-decline");
      send("tool_done", { id: "w1", tool: "erp_action", ok: false });
      send("done", { text: r ? `Resultado: ${String(r.result).slice(0, 120)}` : "NADIE CONTESTÓ", actions: [] });
      return res.end();
    }
    if (mensaje === "dale, cambiá los pisos a 9") {
      // Manos que escriben, decisión "Ejecutar": mismo frame `confirm`, pero acá
      // sí se hace click, y ahí sí tiene que correr la acción real del bus.
      send("turn_start", { turnId: "t-confirm-si" });
      send("tool_start", { id: "w2", tool: "erp_action", input: { action: "humo.escribir", args: { v: 2 } } });
      send("confirm", { call_id: "c-write", id: "w2", tool: "erp_action", input: { action: "humo.escribir", args: { v: 2 } }, efecto: "write" });
      const t0 = Date.now();
      while (!resultados.some(r => r.call_id === "c-write") && Date.now() - t0 < 15000) await sleep(50);
      const r = resultados.find(x => x.call_id === "c-write");
      send("tool_done", { id: "w2", tool: "erp_action", ok: !!r });
      send("done", { text: r ? `Resultado: ${String(r.result).slice(0, 120)}` : "NADIE CONTESTÓ", actions: [] });
      return res.end();
    }

    turno++;
    if (turno === 1) {
      // Turno feliz: dos iteraciones, con text_reset en el medio y una tool.
      for (const t of ["Voy ", "a ", "revisar ", "el ", "radar"]) { send("text_delta", { text: t }); await sleep(20); }
      send("tool_start", { id: "t1", tool: "radar_query", input: { q: "DC01" } }); await sleep(40);
      send("tool_done", { id: "t1", tool: "radar_query", ok: true }); await sleep(20);
      send("text_reset", {}); await sleep(20);
      for (const t of ["Respuesta ", "**en ", "curso**", "…"]) { send("text_delta", { text: t }); await sleep(20); }
      send("done", { text: "Respuesta final **autoritativa**", actions: [] });
      return res.end();
    }
    if (turno === 2) {
      // Turno que revienta a mitad: deltas pintados, una tool, y despues un frame
      // de error, sin ningun done que los corrija.
      send("tool_start", { id: "e1", tool: "gmail_search", input: { q: "x" } }); await sleep(30);
      send("tool_done", { id: "e1", tool: "gmail_search", ok: true }); await sleep(20);
      for (const t of ["Esto ", "no ", "existe ", "en ", "ninguna ", "base"]) { send("text_delta", { text: t }); await sleep(20); }
      send("error", { message: "el cerebro se cayo" });
      return res.end();
    }
    if (turno === 3) {
      // Turno truncado: el stream cierra limpio, sin `done` y sin `error`. Antes
      // esto persistia el buffer acumulado como si fuera la respuesta.
      send("tool_start", { id: "x1", tool: "dropbox_search", input: { q: "y" } }); await sleep(30);
      send("tool_done", { id: "x1", tool: "dropbox_search", ok: false }); await sleep(20);
      for (const t of ["Fantasma ", "sin ", "done"]) { send("text_delta", { text: t }); await sleep(20); }
      return res.end();
    }
    if (turno === 4) {
      // Turno con un text_delta malformado: `text` ausente. No debe pegar "undefined".
      send("text_delta", { text: "hola " });
      send("text_delta", {});
      send("text_delta", { text: "mundo" });
      send("done", { text: "hola mundo", actions: [] });
      return res.end();
    }
    // Cualquier turno más allá del 4: eco simple, para no colgar humos que pidan más.
    // Si llegamos hasta acá es porque el mensaje no matcheó ningún guion de manos
    // NI cayó en 1-4: un desfasaje de texto entre este archivo y quien lo llama
    // (humo-manos.mjs u otro) no produce un verde falso —las aserciones de manos
    // fallan igual, buscando frames que nunca van a llegar—, pero sin este aviso
    // el diagnóstico es "¿por qué falló?" en vez de "ah, el texto no matcheó".
    if (turno > 4) console.warn(`[cerebro-falso] mensaje sin guion conocido en turno ${turno}: ${JSON.stringify(mensaje)}`);
    send("done", { text: "eco", actions: [] });
    return res.end();
  }
  res.writeHead(404); res.end();
}).listen(PUERTO, () => console.log(`cerebro falso en :${PUERTO}`));
