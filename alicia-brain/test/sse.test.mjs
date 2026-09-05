import { test } from "node:test";
import assert from "node:assert/strict";
import { sseFrame, SSE_HEADERS } from "../src/sse.js";

test("un frame lleva event, data y termina en línea en blanco", () => {
  const f = sseFrame("text_delta", { text: "hola" });
  assert.equal(f, 'event: text_delta\ndata: {"text":"hola"}\n\n');
});

test("los saltos de línea del contenido NO rompen el frame", () => {
  // Un \n crudo dentro de data: cortaría el frame a la mitad. Va escapado por JSON.
  const f = sseFrame("text_delta", { text: "línea uno\nlínea dos" });
  assert.equal(f.split("\n").length, 4);              // data + fin de frame
  assert.ok(f.includes('\\n'));                        // escapado, no crudo
  assert.equal(JSON.parse(f.split("data: ")[1].trim()).text, "línea uno\nlínea dos");
});

test("acepta un payload vacío", () => {
  assert.equal(sseFrame("done", {}), "event: done\ndata: {}\n\n");
});

test("los acentos y emojis sobreviven", () => {
  const f = sseFrame("text_delta", { text: "cabida · 42 dptos 🏗" });
  assert.equal(JSON.parse(f.split("data: ")[1].trim()).text, "cabida · 42 dptos 🏗");
});

test("SSE_HEADERS desactiva el buffering de los proxies", () => {
  assert.equal(SSE_HEADERS["Content-Type"], "text/event-stream");
  assert.equal(SSE_HEADERS["Cache-Control"], "no-cache, no-transform");
  assert.equal(SSE_HEADERS["Connection"], "keep-alive");
  assert.equal(SSE_HEADERS["X-Accel-Buffering"], "no");
});
