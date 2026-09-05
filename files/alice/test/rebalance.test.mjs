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

test("posiciones sin solapes: core se traslada correctamente", () => {
  const out = rebalancear(parti, "A", 0.8);
  const A = out.units.find((u) => u.id === "A");
  const B = out.units.find((u) => u.id === "B");
  const core = out.core;

  // Verificar que A está en [0, 8.2]
  assert.equal(A.x, 0);
  assert.equal(A.w, 8.2);

  // Verificar que core está inmediatamente después de A (con tolerancia)
  assert.equal(Math.round(core.x * 1000) / 1000, 8.2);
  assert.equal(core.w, 5.2); // core.w no cambia

  // Verificar que B está inmediatamente después del core (con tolerancia)
  assert.equal(Math.round(B.x * 1000) / 1000, 13.4);
  assert.equal(B.w, 6.6);

  // Verificar que el frente está cubierto de forma contigua sin solapes (con tolerancia)
  assert.equal(Math.round((A.x + A.w) * 1000) / 1000, Math.round(core.x * 1000) / 1000);
  assert.equal(Math.round((core.x + core.w) * 1000) / 1000, Math.round(B.x * 1000) / 1000);
});

test("conserva total con 3+ vecinas y deltaM pequeño", () => {
  const parti3 = {
    id: "p3",
    core: { x: 10, y: 0, w: 5, d: 5 },
    units: [
      { id: "X", x: 0, w: 10 },
      { id: "V1", x: 15, w: 4.0 },
      { id: "V2", x: 19, w: 4.0 },
      { id: "V3", x: 23, w: 4.0 }
    ]
  };
  const antes = parti3.units.reduce((s, u) => s + u.w, 0);
  const out = rebalancear(parti3, "X", 0.001);
  const despues = out.units.reduce((s, u) => s + u.w, 0);
  // Verificar que la suma es exactamente igual después de redondear a milésimas
  assert.equal(Math.round(despues * 1000) / 1000, Math.round(antes * 1000) / 1000);
});
