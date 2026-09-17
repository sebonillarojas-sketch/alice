import { test } from "node:test";
import assert from "node:assert/strict";
import { responder } from "../src/mica/chat.js";
import { construirSystem } from "../src/mica/motor.js";

const CAT = [
  { id: "SA01", nombre: "San Antonio 01", alias: [], estado: "en_venta" },
  { id: "SA02", nombre: "San Antonio 02", alias: ["del Castillo", "DC01"], estado: "en_venta" },
  { id: "OLVR01", nombre: "Olivar 01", alias: ["de la Torre", "TG01"], estado: "en_venta" },
];
const pidePlanos = [{ rol: "prospecto", texto: "me pasas los planos y precios?" }];
const nunca = async () => { throw new Error("el handoff no toca el modelo"); };

test("con varios proyectos y sin saber cuál, NO adivina uno", async () => {
  const r = await responder({ mensajes: pidePlanos, estado: {}, catalogo: CAT, llm: nunca });
  assert.equal(r.tipo, "handoff");
  assert.doesNotMatch(r.texto, /San Antonio|Olivar/, "nombrarle el proyecto equivocado es peor que no nombrarlo");
  assert.match(r.texto, /el proyecto|del proyecto/);
});

test("si sabe cuál es, lo nombra por su nombre real, no por su código", async () => {
  const r = await responder({ mensajes: pidePlanos, estado: { proyecto: "San Antonio 02" }, catalogo: CAT, llm: nunca });
  assert.match(r.texto, /San Antonio 02/);
});

test("con un solo proyecto en venta sí puede asumirlo", async () => {
  const r = await responder({ mensajes: pidePlanos, estado: {}, catalogo: [CAT[0]], llm: nunca });
  assert.match(r.texto, /San Antonio 01/);
});

test("Mica reconoce los alias: 'del Castillo' y 'de la Torre' son proyectos suyos", () => {
  const s = construirSystem({ catalogo: CAT });
  assert.match(s, /del Castillo/);
  assert.match(s, /de la Torre/);
  assert.match(s, /San Antonio 02/);
});
