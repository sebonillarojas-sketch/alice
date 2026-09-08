// Los partis del motor determinístico tienen que poder llegar al Editor de Planos. Antes
// el único camino era aceptar una propuesta de Tweedledum: los partis A/B/C se podían
// elegir y no se podían usar.
import test from "node:test";
import assert from "node:assert/strict";
import { generarDistribuciones } from "../src/modules/planos/plantas.js";
import { partiDeterministaAPropuesta, proposalToParti } from "../src/modules/cabida/floorProposal.js";

const HUELLA = [
  { x: 0, y: 0 }, { x: 31, y: 0 }, { x: 31, y: 5 }, { x: 22, y: 9 },
  { x: 22, y: 14.5 }, { x: 6, y: 14.5 }, { x: 6, y: 9 }, { x: 0, y: 5 },
];
const BRIEF = { udsPiso: 5, pct1: 25, pct2: 40, areaObjetivo: 90 };
const partis = () => generarDistribuciones(HUELLA, 0, BRIEF);

test("cualquier parti determinístico se convierte en una propuesta usable", () => {
  const todos = partis();
  assert.ok(todos.length > 0, "el motor tiene que producir partis");
  for (const parti of todos) {
    const propuesta = partiDeterministaAPropuesta(parti, { footprint: HUELLA, sourceCabidaVersionId: "cv" });
    assert.ok(propuesta.floor.polygons.length > 0, `${parti.nombre} no produjo polígonos`);
    for (const p of propuesta.floor.polygons) {
      assert.ok(["unidad", "core", "circulacion", "void"].includes(p.role), `role inesperado: ${p.role}`);
      assert.ok(p.polygon.length >= 3, `${p.name} sin geometría`);
      if (p.role === "unidad") {
        assert.ok(p.unitRef, `${p.name} sin unitRef`);
        assert.ok(p.unitProgram?.dormitorios >= 1, `${p.name} sin programa`);
      }
    }
  }
});

test("la propuesta convertida siembra ambientes en el editor", () => {
  const propuesta = partiDeterministaAPropuesta(partis()[0], { footprint: HUELLA, sourceCabidaVersionId: "cv" });
  const { rooms } = proposalToParti({ summary: propuesta.summary, floor: propuesta.floor });
  assert.ok(rooms.length > 0, "tiene que sembrar ambientes");
  assert.ok(rooms.every((r) => r.pts?.length >= 3), "todo ambiente con geometría");
  assert.ok(rooms.some((r) => r.locked !== true), "tiene que haber algo editable");
});

test("una unidad partida en varias piezas se avisa, no se esconde", () => {
  // El editor no puede diseñar el interior de una unidad multi-pieza (boundary null).
  // Es la causa de que una planta se resuelva "a medias", así que tiene que estar dicho.
  const conPartidas = partis()
    .map((p) => partiDeterministaAPropuesta(p, { footprint: HUELLA, sourceCabidaVersionId: "cv" }))
    .filter((prop) => {
      const cuenta = new Map();
      for (const p of prop.floor.polygons) {
        if (p.role === "unidad" && p.unitRef) cuenta.set(p.unitRef, (cuenta.get(p.unitRef) || 0) + 1);
      }
      return [...cuenta.values()].some((n) => n > 1);
    });
  assert.ok(conPartidas.length > 0, "esta huella produce partis con unidades partidas: el caso existe");
  for (const prop of conPartidas) {
    assert.ok(prop.tradeoffs.some((t) => t.includes("partidas en varias piezas")),
      "una unidad partida tiene que aparecer en tradeoffs");
  }
});

test("el respaldo determinístico sigue funcionando tras extraer la conversión", async () => {
  const { fallbackFloorProposal } = await import("../src/modules/cabida/floorProposal.js");
  const propuesta = fallbackFloorProposal({ footprint: HUELLA, frontIdx: 0, brief: BRIEF, sourceCabidaVersionId: "cv" });
  assert.equal(propuesta.summary, "Respaldo determinístico de packFloor");
  assert.ok(propuesta.tradeoffs.includes("Distribución determinística utilizada como respaldo"));
  assert.ok(propuesta.floor.polygons.length > 0);
});
