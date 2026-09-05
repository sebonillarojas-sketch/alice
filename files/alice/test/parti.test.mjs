import test from "node:test";
import assert from "node:assert/strict";
import { partiSignature, sonDistintos, dedupePartis } from "../src/modules/planos/parti.js";

const A = { id: "a", core: { x: 7.4, y: 0, w: 5.2, d: 5 }, units: [{ id: "u1", x: 0, w: 7.4 }, { id: "u2", x: 12.6, w: 7.4 }] };
const B = { id: "b", core: { x: 7.5, y: 0, w: 5.2, d: 5 }, units: [{ id: "u1", x: 0, w: 7.5 }, { id: "u2", x: 12.7, w: 7.3 }] };
const C = { id: "c", core: { x: 0, y: 0, w: 5.2, d: 5 }, units: [{ id: "u1", x: 5.2, w: 14.8 }] };

test("la firma ignora diferencias por debajo de la tolerancia", () => {
  assert.equal(partiSignature(A), partiSignature(B));
});

test("un núcleo en otra posición es otro parti", () => {
  assert.ok(sonDistintos(A, C));
});

test("dos partis dentro de tolerancia NO son distintos", () => {
  assert.ok(!sonDistintos(A, B));
});

test("dedupe conserva el primero y reporta el descartado", () => {
  const { kept, dropped } = dedupePartis([A, B, C]);
  assert.deepEqual(kept.map((p) => p.id), ["a", "c"]);
  assert.deepEqual(dropped.map((p) => p.id), ["b"]);
});
