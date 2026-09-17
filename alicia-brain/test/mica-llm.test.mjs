import { test } from "node:test";
import assert from "node:assert/strict";
import { backendAnthropic } from "../src/mica/llm.js";

// El backend es un canal, no un autor: si le mete instrucciones propias a cada
// llamada, rompe a todo el que lo use para algo que no sea conversar — como el
// extractor de buyer persona, que necesita JSON y recibía a Mica actuando.
test("el backend pasa el system tal cual, sin agregarle nada", async () => {
  let visto = null;
  const fake = { messages: { create: async (args) => { visto = args; return { content: [{ type: "text", text: "ok" }] }; } } };
  const llm = backendAnthropic({ apiKey: "x", client: fake });
  await llm({ system: "SOLO JSON", mensajes: [{ rol: "prospecto", texto: "hola" }] });
  assert.equal(visto.system, "SOLO JSON");
  assert.equal(visto.messages[0].content, "hola", "el mensaje tampoco se toca");
});
