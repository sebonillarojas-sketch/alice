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
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

http.createServer(async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  const url = new URL(req.url, "http://x");

  if (url.pathname === "/health") { res.writeHead(200); return res.end("ok"); }
  // El contador de turnos es estado del proceso: sin resetear, una segunda corrida
  // del humo arranca en el turno 5 y todas las aserciones miran el guion equivocado.
  if (url.pathname === "/reset") { turno = 0; res.writeHead(200); return res.end("ok"); }
  if (url.pathname === "/api/copilot/history") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ messages: [] }));
  }
  if (url.pathname === "/api/copilot/turn") {
    turno++;
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
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
    // Turno con un text_delta malformado: `text` ausente. No debe pegar "undefined".
    send("text_delta", { text: "hola " });
    send("text_delta", {});
    send("text_delta", { text: "mundo" });
    send("done", { text: "hola mundo", actions: [] });
    return res.end();
  }
  res.writeHead(404); res.end();
}).listen(PUERTO, () => console.log(`cerebro falso en :${PUERTO}`));
