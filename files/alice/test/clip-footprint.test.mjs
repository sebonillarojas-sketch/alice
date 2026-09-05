import test from "node:test";
import assert from "node:assert/strict";
import { clipPolygon, clipPieces } from "../src/modules/planos/clipFootprint.js";

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
