import test from "node:test";
import assert from "node:assert/strict";
import { clipPolygon, clipPieces } from "../src/modules/planos/clipFootprint.js";
import { packFloor } from "../src/modules/planos/lote.js";
import { validateFloorProposal } from "../../../alicia-brain/src/architecture/floor-validation.js";

const area = (pts) => {
  let s = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a.x * b.y - b.x * a.y; }
  return Math.abs(s) / 2;
};
const cuad = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];

test("una pieza enteramente dentro sale intacta en area", () => {
  const out = clipPolygon(cuad(2, 2, 4, 4), cuad(0, 0, 10, 10));
  assert.equal(out.length, 1);
  assert.equal(Math.round(area(out[0]) * 100) / 100, 4);
});

test("una pieza enteramente fuera desaparece", () => {
  assert.deepEqual(clipPolygon(cuad(20, 20, 24, 24), cuad(0, 0, 10, 10)), []);
});

test("una pieza que se desborda se recorta al area comun", () => {
  const out = clipPolygon(cuad(5, 5, 15, 15), cuad(0, 0, 10, 10));
  assert.equal(out.length, 1);
  assert.equal(Math.round(area(out[0]) * 100) / 100, 25);
});

test("recortador concavo: la pieza se parte en dos fragmentos", () => {
  // huella en U: dos brazos verticales unidos abajo
  const U = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 7, y: 10 },
             { x: 7, y: 3 }, { x: 3, y: 3 }, { x: 3, y: 10 }, { x: 0, y: 10 }];
  const banda = cuad(0, 5, 10, 7);           // cruza la muesca central
  const out = clipPolygon(banda, U);
  const total = out.reduce((s, ring) => s + area(ring), 0);
  assert.equal(out.length, 2, "debe partirse en dos brazos");
  assert.equal(Math.round(total * 100) / 100, 12);   // 2 brazos de 3 x 2
});

test("clipPieces conserva campos, descarta migajas y cuenta las partidas", () => {
  const U = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 7, y: 10 },
             { x: 7, y: 3 }, { x: 3, y: 3 }, { x: 3, y: 10 }, { x: 0, y: 10 }];
  const piezas = [
    { id: "a", role: "unidad", pts: cuad(0, 0, 3, 3) },      // dentro
    { id: "b", role: "unidad", pts: cuad(20, 20, 22, 22) },  // fuera
    { id: "c", role: "unidad", pts: cuad(0, 5, 10, 7) },     // se parte
    { id: "d", role: "unidad", pts: cuad(3.0, 5, 3.2, 5.1) },// migaja dentro de la muesca
  ];
  const { kept, dropped, split } = clipPieces(piezas, U, 1.0);
  assert.deepEqual(kept.map((p) => p.id).sort(), ["a", "c"]);
  assert.deepEqual(dropped.map((p) => p.id).sort(), ["b", "d"]);
  assert.equal(split, 1);
  assert.equal(kept.find((p) => p.id === "a").role, "unidad", "debe conservar los campos");
  assert.equal(Math.round(area(kept.find((p) => p.id === "c").pts) * 100) / 100, 6,
    "de la pieza partida queda solo el fragmento mayor");
});

test("no muta las piezas de entrada", () => {
  const p = [{ id: "x", pts: cuad(5, 5, 15, 15) }];
  const antes = JSON.stringify(p);
  clipPieces(p, cuad(0, 0, 10, 10));
  assert.equal(JSON.stringify(p), antes);
});

// Regresión de integración: el recorte no puede introducir geometría inválida ni
// dejar piezas fuera de la huella. Es el caso irregular que rompía en producción.
test("integracion: el recorte no introduce geometria invalida ni piezas fuera de la huella", () => {
  const footprint = [
    { x: 0, y: 0 }, { x: 31, y: 0 }, { x: 31, y: 5 }, { x: 22, y: 9 },
    { x: 22, y: 14.5 }, { x: 6, y: 14.5 }, { x: 6, y: 9 }, { x: 0, y: 5 },
  ];
  const r = packFloor(footprint, 0, { udsPiso: 5, areaObjetivo: 90 });
  const piezas = [
    ...(r.core ? [{ id: "core", role: "core", name: "core", pts: r.core.pts }] : []),
    ...(r.corridors || []).map((c, i) => ({ id: `c${i}`, role: "circulacion", name: `circulación ${i + 1}`, pts: c.pts })),
    ...r.units.map((u, i) => ({ id: `u${i}`, role: "unidad", name: u.subtipo || `u${i}`, unitRef: `unit-${i}`, pts: u.pts })),
  ];
  assert.ok(piezas.length > 0, "packFloor debe devolver piezas para esta huella");

  const { kept } = clipPieces(piezas, footprint);
  const toPoly = (pts) => pts.map((p) => [Number(p.x), Number(p.y)]);
  const { findings } = validateFloorProposal(
    {
      floor: {
        sourceCabidaVersionId: "V",
        polygons: kept.map((p) => ({
          polygonId: p.id,
          role: p.role,
          name: p.name,
          unitRef: p.unitRef,
          unitProgram: p.role === "unidad" ? { dormitorios: 2, banos: 2 } : null,
          polygon: toPoly(p.pts),
        })),
      },
    },
    { buildableFootprint: toPoly(footprint), sourceCabidaVersionId: "V" },
  );

  const codes = findings.map((f) => f.code);
  assert.deepEqual(codes.filter((c) => c === "self_intersecting_polygon"), [],
    `no debe haber polígonos auto-intersectados: ${JSON.stringify(findings)}`);
  assert.deepEqual(codes.filter((c) => c === "outside_buildable_footprint"), [],
    `ninguna pieza recortada puede salirse de la huella: ${JSON.stringify(findings)}`);
});
