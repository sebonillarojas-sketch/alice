// Extremo a extremo del nuevo contrato: Tweedledum ya no devuelve polígonos, devuelve
// un parti aproximado (la decisión de zonificación) que ALICE normaliza y tesela. Este
// test es el que define el éxito del cambio: un parti que NO cierra (sus anchos de unidad
// no suman el frente disponible) tiene que producir polígonos que pasen
// validateFloorProposal con CERO hallazgos geométricos, sobre la misma huella irregular
// (cóncava) que fallback-clipped.test.mjs usa para el camino determinístico.
import test from "node:test";
import assert from "node:assert/strict";
import { materializeFloorProposal } from "../src/modules/cabida/floorProposal.js";
import { validateFloorProposal } from "../../../alicia-brain/src/architecture/floor-validation.js";

// misma huella irregular que files/alice/test/fallback-clipped.test.mjs (~61% de la
// envolvente de un lote real, con una concavidad en la fachada).
const HUELLA = [
  { x: 0, y: 0 }, { x: 31, y: 0 }, { x: 31, y: 5 }, { x: 22, y: 9 },
  { x: 22, y: 14.5 }, { x: 6, y: 14.5 }, { x: 6, y: 9 }, { x: 0, y: 5 },
];
const VERSION = "cabida_test_v1";

const GEOMETRIC_CODES = new Set([
  "self_intersecting_polygon", "degenerate_polygon", "outside_buildable_footprint",
  "incomplete_partition", "polygon_overlap",
]);

const validar = (propuesta) => validateFloorProposal(propuesta, {
  buildableFootprint: HUELLA.map((p) => [p.x, p.y]),
  sourceCabidaVersionId: VERSION,
});

test("un parti aproximado que no cierra tesela sin hallazgos geométricos sobre la huella irregular", () => {
  // frente real de esta huella (borde 0): 31 m. El parti de Tweedledum es deliberadamente
  // aproximado: cree un core de ~5 m y tres unidades cuyos anchos suman 19.4 m — muy lejos
  // de los ~26 m disponibles (31 − 5). Nunca tiene que cerrar: ALICE prorratea.
  const parti = {
    sourceCabidaVersionId: VERSION,
    crujias: 1,
    corredorProfundidad: 1.6,
    core: { posicion: 9, ancho: 5 },
    units: [
      { unitRef: "u1", orden: 1, ancho: 7, dormitorios: 3, banos: 2 },
      { unitRef: "u2", orden: 2, ancho: 6, dormitorios: 2, banos: 2 },
      { unitRef: "u3", orden: 3, ancho: 6.4, dormitorios: 1, banos: 1 },
    ],
  };
  // control: efectivamente no cierra contra el frente real de esta huella (31 m)
  const sumaAnchos = parti.core.ancho + parti.units.reduce((s, u) => s + u.ancho, 0);
  assert.equal(sumaAnchos, 24.4);
  assert.notEqual(sumaAnchos, 31);

  const propuesta = materializeFloorProposal({
    parti, footprint: HUELLA, frontIdx: 0, sourceCabidaVersionId: VERSION, summary: "Parti de prueba",
  });

  assert.ok(propuesta.floor.polygons.length > 0, "debe emitir polígonos");
  const unidades = propuesta.floor.polygons.filter((p) => p.role === "unidad");
  assert.equal(unidades.length, 3, "las 3 unidades del parti deben sobrevivir al recorte");
  for (const u of unidades) {
    assert.ok(u.unitRef, `${u.name} perdió su unitRef`);
    assert.ok(u.unitProgram?.dormitorios >= 1, `${u.name} perdió su programa`);
  }

  const resultado = validar(propuesta);
  const geometricos = resultado.findings.filter((f) => GEOMETRIC_CODES.has(f.code));
  assert.deepEqual(geometricos, [], `no debe haber hallazgos geométricos: ${JSON.stringify(geometricos)}`);
});

test("crujía doble también tesela sin hallazgos geométricos (banda 2 queda como vacío)", () => {
  const parti = {
    sourceCabidaVersionId: VERSION,
    crujias: 2,
    corredorProfundidad: 1.5,
    core: { posicion: 9, ancho: 5 },
    units: [
      { unitRef: "u1", orden: 1, ancho: 7, dormitorios: 2, banos: 1 },
      { unitRef: "u2", orden: 2, ancho: 6, dormitorios: 1, banos: 1 },
    ],
  };
  const propuesta = materializeFloorProposal({ parti, footprint: HUELLA, frontIdx: 0, sourceCabidaVersionId: VERSION });
  const resultado = validar(propuesta);
  const geometricos = resultado.findings.filter((f) => GEOMETRIC_CODES.has(f.code));
  assert.deepEqual(geometricos, [], `no debe haber hallazgos geométricos: ${JSON.stringify(geometricos)}`);
});

test("materializeFloorProposal sigue funcionando sobre la huella rectangular", () => {
  const rect = [{ x: 0, y: 0 }, { x: 31, y: 0 }, { x: 31, y: 14.5 }, { x: 0, y: 14.5 }];
  const parti = {
    sourceCabidaVersionId: VERSION,
    crujias: 1,
    core: { posicion: 10, ancho: 4 },
    units: [
      { unitRef: "u1", orden: 1, ancho: 9, dormitorios: 2, banos: 2 },
      { unitRef: "u2", orden: 2, ancho: 8, dormitorios: 1, banos: 1 },
    ],
  };
  const propuesta = materializeFloorProposal({ parti, footprint: rect, frontIdx: 0, sourceCabidaVersionId: VERSION });
  const resultado = validateFloorProposal(propuesta, { buildableFootprint: rect.map((p) => [p.x, p.y]), sourceCabidaVersionId: VERSION });
  const geometricos = resultado.findings.filter((f) => GEOMETRIC_CODES.has(f.code));
  assert.deepEqual(geometricos, []);
});
