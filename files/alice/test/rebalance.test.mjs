import test from "node:test";
import assert from "node:assert/strict";
import { esDeVolumen, rebalancear, MIN_ANCHO_UNIDAD } from "../src/modules/planos/rebalance.js";

const parti = { id: "p", core: { x: 7.4, y: 0, w: 5.2, d: 5 },
  units: [{ id: "A", x: 0, w: 7.4 }, { id: "B", x: 12.6, w: 7.4 }] };

test("un hallazgo de no-cabe es de volumen", () => {
  assert.ok(esDeVolumen({ regla: "no_cabe", severidad: "critical" }));
  assert.ok(esDeVolumen({ nivel: "volumen" }));
  assert.ok(!esDeVolumen({ regla: "ancho_util", nivel: "interior" }));
});

test("ensanchar una unidad descuenta a prorrata y conserva el total", () => {
  const antes = parti.units.reduce((s, u) => s + u.w, 0);
  const out = rebalancear(parti, "A", 0.8);
  const despues = out.units.reduce((s, u) => s + u.w, 0);
  assert.equal(Math.round(despues * 1000) / 1000, Math.round(antes * 1000) / 1000);
  assert.equal(out.units.find((u) => u.id === "A").w, 8.2);
  assert.equal(out.units.find((u) => u.id === "B").w, 6.6);
});

test("no deja a una vecina por debajo del minimo", () => {
  assert.throws(() => rebalancear(parti, "A", 5.0), RangeError);
  assert.equal(MIN_ANCHO_UNIDAD, 3.0);
});

test("no muta el parti original", () => {
  rebalancear(parti, "A", 0.5);
  assert.equal(parti.units.find((u) => u.id === "A").w, 7.4);
});
