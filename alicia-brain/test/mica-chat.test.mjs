import { test } from "node:test";
import assert from "node:assert/strict";
import { responder } from "../src/mica/chat.js";

const CAT = [{ id: "OLVR-01", tipologias: [{ nombre: "flat", dormitorios: 2 }] }];
const llmQueNuncaDebeCorrer = async () => { throw new Error("el handoff NO puede pasar por el modelo"); };

test("el handoff se arma con plantillas — no toca el modelo", async () => {
  const r = await responder({
    mensajes: [{ rol: "prospecto", texto: "me pasas los planos y el precio?" }],
    estado: { proyecto: "OLVR-01" },
    catalogo: CAT,
    llm: llmQueNuncaDebeCorrer,
  });
  assert.equal(r.tipo, "handoff");
  assert.match(r.texto, /OLVR-01/);
});

test("conversar sí pasa por el modelo, con la voz como system", async () => {
  let systemVisto = null;
  const r = await responder({
    mensajes: [{ rol: "prospecto", texto: "hola, vi el proyecto en instagram" }],
    catalogo: CAT,
    llm: async ({ system }) => { systemVisto = system; return "Hola, qué bueno que escribas."; },
  });
  assert.equal(r.tipo, "conversar");
  assert.equal(r.texto, "Hola, qué bueno que escribas.");
  assert.match(systemVisto, /nunca env[íi]a planos ni dice un precio/i);
});

test("el handoff sin proyecto conocido no inventa uno", async () => {
  const r = await responder({
    mensajes: [{ rol: "prospecto", texto: "cuánto cuesta?" }],
    estado: {},
    catalogo: [],
    llm: llmQueNuncaDebeCorrer,
  });
  assert.equal(r.tipo, "handoff");
  assert.doesNotMatch(r.texto, /OLVR|undefined|null|\{P\}/);
  assert.match(r.texto, /José/);
});

test("la respuesta viaja con la temperatura para que el CRM no tenga que adivinarla", async () => {
  const r = await responder({
    mensajes: [{ rol: "prospecto", texto: "busco un dúplex de 90 m2" }],
    catalogo: CAT,
    llm: async () => "ok",
  });
  assert.equal(r.temperatura, "tibio");
  assert.equal(r.evidencia, "busco un dúplex de 90 m2");
});

test("si el modelo se cae, Mica no deja al prospecto sin respuesta", async () => {
  const r = await responder({
    mensajes: [{ rol: "prospecto", texto: "hola" }],
    catalogo: CAT,
    llm: async () => { throw new Error("modelo caído"); },
  });
  assert.equal(r.tipo, "error");
  assert.ok(r.texto.length > 0);
  assert.doesNotMatch(r.texto, /error|Error|fall/);
});
