// El fallback determinístico tiene que entregar piezas DENTRO de la huella.
// Sin recorte, packFloor deja vértices desbordados en las aristas oblicuas y el validador
// rechaza la propuesta entera: "core sale de la huella edificable · … · La planta deja
// 272.64 m² sin asignar". Este test es el guard de ese bug en el camino de producción.
import test from "node:test";
import assert from "node:assert/strict";
import { fallbackFloorProposal } from "../src/modules/cabida/floorProposal.js";
import { validateFloorProposal } from "../../../alicia-brain/src/architecture/floor-validation.js";

// huella irregular: la misma proporción del lote real de Sebastián (~61 % de su envolvente)
const HUELLA = [
  { x: 0, y: 0 }, { x: 31, y: 0 }, { x: 31, y: 5 }, { x: 22, y: 9 },
  { x: 22, y: 14.5 }, { x: 6, y: 14.5 }, { x: 6, y: 9 }, { x: 0, y: 5 },
];
const VERSION = "cabida_test_v1";

const validar = (propuesta) => validateFloorProposal(propuesta, {
  buildableFootprint: HUELLA.map((p) => [p.x, p.y]),
  sourceCabidaVersionId: VERSION,
});

test("el fallback no entrega piezas fuera de la huella ni geometría inválida", () => {
  const propuesta = fallbackFloorProposal({
    footprint: HUELLA,
    frontIdx: 0,
    brief: { udsPiso: 5, pct1: 25, pct2: 40, areaObjetivo: 90 },
    sourceCabidaVersionId: VERSION,
  });
  const codigos = validar(propuesta).findings.map((f) => f.code);
  assert.deepEqual(codigos.filter((c) => c === "outside_buildable_footprint"), [],
    "ninguna pieza puede salir de la huella edificable");
  assert.deepEqual(codigos.filter((c) => c === "self_intersecting_polygon"), [],
    "el recorte no puede producir polígonos auto-intersectados");
  assert.deepEqual(codigos.filter((c) => c === "incomplete_partition"), [],
    "no puede quedar área sin asignar por piezas descartadas");
});

test("el fallback sigue funcionando con huella rectangular", () => {
  const rect = [{ x: 0, y: 0 }, { x: 31, y: 0 }, { x: 31, y: 14.5 }, { x: 0, y: 14.5 }];
  const propuesta = fallbackFloorProposal({
    footprint: rect, frontIdx: 0,
    brief: { udsPiso: 5, pct1: 25, pct2: 40, areaObjetivo: 90 },
    sourceCabidaVersionId: VERSION,
  });
  const codigos = validateFloorProposal(propuesta, {
    buildableFootprint: rect.map((p) => [p.x, p.y]), sourceCabidaVersionId: VERSION,
  }).findings.map((f) => f.code);
  assert.deepEqual(codigos.filter((c) => c === "outside_buildable_footprint"), []);
  assert.ok(propuesta.floor.polygons.length > 0, "debe emitir polígonos");
});

test("conserva el programa de cada unidad tras el recorte", () => {
  const propuesta = fallbackFloorProposal({
    footprint: HUELLA, frontIdx: 0,
    brief: { udsPiso: 5, pct1: 25, pct2: 40, areaObjetivo: 90 },
    sourceCabidaVersionId: VERSION,
  });
  const unidades = propuesta.floor.polygons.filter((p) => p.role === "unidad");
  assert.ok(unidades.length > 0, "debe quedar al menos una unidad");
  for (const u of unidades) {
    assert.ok(u.unitRef, `${u.name} perdió su unitRef`);
    assert.ok(u.unitProgram?.dormitorios >= 1, `${u.name} perdió su programa`);
  }
});
