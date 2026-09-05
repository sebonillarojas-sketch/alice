import test from "node:test";
import assert from "node:assert/strict";
import { createLedger, findingKey } from "../src/modules/planos/findingsLedger.js";

const f = (over = {}) => ({ unidad: "B", ambiente: "dormitorio 2", regla: "ancho_util",
  medida: 2.30, esperado: 2.40, severidad: "critical", nivel: "interior", ...over });

test("la clave ignora la medida: es el mismo problema aunque cambie el numero", () => {
  assert.equal(findingKey(f()), findingKey(f({ medida: 2.35 })));
});

test("primera vuelta: todos nuevos", () => {
  const l = createLedger();
  const r = l.record("B", [f()]);
  assert.equal(r.nuevos.length, 1);
  assert.equal(r.repetidos.length, 0);
  assert.equal(l.bloqueado("B"), false);
});

test("el mismo hallazgo dos vueltas seguidas bloquea la unidad", () => {
  const l = createLedger();
  l.record("B", [f()]);
  const r = l.record("B", [f()]);
  assert.equal(r.repetidos.length, 1);
  assert.equal(l.bloqueado("B"), true);
});

test("resolver y reintroducir el mismo hallazgo es una regresion", () => {
  const l = createLedger();
  l.record("B", [f()]);
  l.record("B", []);                       // se resolvio
  assert.equal(l.mustFix("B").length, 0);  // verificar que mustFix está vacío
  const r = l.record("B", [f()]);
  assert.equal(r.regresiones.length, 1);
});

test("mustFix devuelve los abiertos de esa unidad", () => {
  const l = createLedger();
  l.record("B", [f(), f({ ambiente: "cocina", regla: "area_min" })]);
  assert.equal(l.mustFix("B").length, 2);
  assert.equal(l.mustFix("A").length, 0);
});

test("duplicados en la misma ronda no bloquean", () => {
  const l = createLedger();
  const r = l.record("B", [f(), f()]);
  assert.equal(r.nuevos.length, 1);
  assert.equal(r.repetidos.length, 0);
  assert.equal(l.bloqueado("B"), false);
});

test("resueltos devuelve hallazgos cerrados como objetos", () => {
  const l = createLedger();
  l.record("B", [f()]);
  l.record("B", []);                       // se resolvio
  const closed = l.resueltos("B");
  assert.equal(closed.length, 1);
  assert.equal(closed[0].ambiente, "dormitorio 2");
  assert.equal(closed[0].regla, "ancho_util");
});
