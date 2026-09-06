import test from "node:test";
import assert from "node:assert/strict";
import { partiSignature, sonDistintos, dedupePartis } from "../src/modules/planos/parti.js";

const A = { id: "a", core: { x: 7.4, y: 0, w: 5.2, d: 5 }, units: [{ id: "u1", x: 0, w: 7.4 }, { id: "u2", x: 12.6, w: 7.4 }] };
const B = { id: "b", core: { x: 7.5, y: 0, w: 5.2, d: 5 }, units: [{ id: "u1", x: 0, w: 7.5 }, { id: "u2", x: 12.7, w: 7.3 }] };
const C = { id: "c", core: { x: 0, y: 0, w: 5.2, d: 5 }, units: [{ id: "u1", x: 5.2, w: 14.8 }] };
// A con núcleo desplazado 0.20 m (dentro de tolerancia 0.30)
const A_DENTRO = { id: "a-dentro", core: { x: 7.6, y: 0, w: 5.2, d: 5 }, units: [{ id: "u1", x: 0, w: 7.4 }, { id: "u2", x: 12.6, w: 7.4 }] };
// A con núcleo desplazado 0.45 m (fuera de tolerancia 0.30)
const A_FUERA = { id: "a-fuera", core: { x: 7.85, y: 0, w: 5.2, d: 5 }, units: [{ id: "u1", x: 0, w: 7.4 }, { id: "u2", x: 12.6, w: 7.4 }] };

test("partiSignature es determinista", () => {
  assert.equal(partiSignature(A), partiSignature(A));
  assert.equal(partiSignature(B), partiSignature(B));
});

test("un núcleo en otra posición es otro parti", () => {
  assert.ok(sonDistintos(A, C));
});

test("dos partis dentro de tolerancia NO son distintos", () => {
  assert.ok(!sonDistintos(A, B));
});

test("diferencia de 0.20 m está dentro de tolerancia", () => {
  assert.ok(!sonDistintos(A, A_DENTRO));
});

test("diferencia de 0.45 m está fuera de tolerancia", () => {
  assert.ok(sonDistintos(A, A_FUERA));
});

test("dedupe conserva el primero y reporta el descartado", () => {
  const { kept, dropped } = dedupePartis([A, B, C]);
  assert.deepEqual(kept.map((p) => p.id), ["a", "c"]);
  assert.deepEqual(dropped.map((p) => p.id), ["b"]);
});
