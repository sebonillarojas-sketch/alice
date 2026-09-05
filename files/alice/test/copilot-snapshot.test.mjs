import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSnapshot, SNAPSHOT_BUDGET } from "../src/copilot/snapshot.js";

const cabida = {
  module: "cabida",
  title: "Cabida · PU01 Paula Ugarriza",
  entity: { type: "proyecto", id: "PU01" },
  state: { terreno: 640, pisos: 8, areaDpto: 75, precioM2: 2100 },
  derived: { dptos: 42, vendible: 3180, margen: 1240000 },
  actions: ["cabida.setParams", "cabida.recalcular"],
};
const growth = { module: "growth", title: "Growth", entity: null, state: { n: 29 }, actions: ["growth.abrir"] };
const radar  = { module: "radar",  title: "Radar",  entity: null, state: { proyectos: 688 } };

test("el módulo activo va completo, con state, derived y actions", () => {
  const s = buildSnapshot([cabida, growth], "cabida");
  assert.equal(s.active.module, "cabida");
  assert.deepEqual(s.active.derived, cabida.derived);
  assert.deepEqual(s.active.actions, cabida.actions);
});

test("los otros módulos van solo con cabecera, sin state ni actions", () => {
  const s = buildSnapshot([cabida, growth, radar], "cabida");
  assert.equal(s.others.length, 2);
  assert.deepEqual(Object.keys(s.others[0]).sort(), ["entity", "module", "title"]);
  assert.equal(s.others[0].state, undefined);
});

test("sin módulo activo, active es null y no explota", () => {
  const s = buildSnapshot([growth, radar], "inexistente");
  assert.equal(s.active, null);
  assert.equal(s.others.length, 2);
});

test("con la lista vacía devuelve una estructura vacía usable", () => {
  assert.deepEqual(buildSnapshot([], "cabida"), { active: null, others: [], dropped: 0 });
});

test("respeta el presupuesto soltando otros módulos", () => {
  const muchos = Array.from({ length: 40 }, (_, i) => ({
    module: `m${i}`, title: `Módulo número ${i} con un título largo para ocupar lugar`, entity: null,
  }));
  const s = buildSnapshot([cabida, ...muchos], "cabida", 600);
  assert.ok(JSON.stringify(s).length <= 600, `pasó el presupuesto: ${JSON.stringify(s).length}`);
  assert.ok(s.dropped > 0);
});

test("el módulo activo NUNCA se trunca, aunque él solo exceda el presupuesto", () => {
  const gordo = { ...cabida, state: { blob: "x".repeat(3000) } };
  const s = buildSnapshot([gordo, growth], "cabida", 100);
  assert.equal(s.active.state.blob.length, 3000);
  assert.equal(s.others.length, 0);
  assert.equal(s.dropped, 1);
});

test("el presupuesto por defecto son 2000 caracteres", () => {
  assert.equal(SNAPSHOT_BUDGET, 2000);
});
