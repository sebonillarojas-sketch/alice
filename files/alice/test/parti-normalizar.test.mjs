import test from "node:test";
import assert from "node:assert/strict";
import { prorratearAnchos, normalizarParti, CORREDOR_PROFUNDIDAD_DEFAULT } from "../src/modules/planos/partiNormalizar.js";
import { MIN_ANCHO_UNIDAD } from "../src/modules/planos/rebalance.js";

const sum = (arr) => arr.reduce((a, b) => a + b, 0);

test("prorratearAnchos reparte proporcionalmente y suma exacto el disponible", () => {
  const anchos = prorratearAnchos([10, 10], 26);
  assert.deepEqual(anchos, [13, 13]);
  assert.equal(sum(anchos), 26);
});

test("prorratearAnchos aplica el mínimo por unidad y reprroratea el resto", () => {
  // pesos muy dispares: una unidad casi no pesa nada, se iría muy por debajo del mínimo
  const anchos = prorratearAnchos([1, 1, 1000], 15);
  assert.ok(anchos[0] >= MIN_ANCHO_UNIDAD - 1e-9);
  assert.ok(anchos[1] >= MIN_ANCHO_UNIDAD - 1e-9);
  assert.ok(Math.abs(sum(anchos) - 15) < 1e-6);
});

test("prorratearAnchos hace lo posible cuando no alcanza para el mínimo de todas (no pierde ancho)", () => {
  const anchos = prorratearAnchos([1, 1, 1], 5); // 3 * MIN_ANCHO_UNIDAD (9) > 5: infeasible
  assert.ok(Math.abs(sum(anchos) - 5) < 1e-6, "el reparto siempre suma exacto el disponible, aunque no llegue al mínimo");
});

test("prorratearAnchos reparte igual cuando todos los pesos son cero", () => {
  const anchos = prorratearAnchos([0, 0], 10);
  assert.deepEqual(anchos, [5, 5]);
});

test("normalizarParti prorratea anchos aproximados que no cierran (suman menos que el frente)", () => {
  const parti = {
    sourceCabidaVersionId: "cabida_test",
    crujias: 1,
    corredorProfundidad: 1.6,
    core: { posicion: 8, ancho: 4 },
    units: [
      { unitRef: "u1", orden: 1, ancho: 6, dormitorios: 3, banos: 2 },
      { unitRef: "u2", orden: 2, ancho: 5, dormitorios: 2, banos: 2 },
    ],
  };
  // frente 20, core 4 → disponible 16; los anchos aproximados suman 11 (no cierra).
  const exacto = normalizarParti(parti, { frente: 20, fondo: 12 });
  const totalUnidades = exacto.units.reduce((s, u) => s + u.ancho, 0);
  assert.ok(Math.abs(totalUnidades - 16) < 1e-6, `las unidades deben sumar exactamente el disponible, dio ${totalUnidades}`);
  assert.equal(exacto.core.ancho, 4);
  assert.equal(exacto.units[0].x, 0);
  assert.equal(exacto.units[1].x, exacto.units[0].x + exacto.units[0].ancho);
  // el core empieza exactamente donde termina la última unidad a su izquierda
  assert.equal(exacto.core.posicion, exacto.units[1].x + exacto.units[1].ancho);
});

test("normalizarParti conserva orden, dormitorios y baños", () => {
  const parti = {
    sourceCabidaVersionId: "cabida_test",
    crujias: 1,
    core: { posicion: 5, ancho: 3 },
    units: [
      { unitRef: "u2", orden: 2, ancho: 5, dormitorios: 2, banos: 2 },
      { unitRef: "u1", orden: 1, ancho: 6, dormitorios: 3, banos: 1 },
    ],
  };
  const exacto = normalizarParti(parti, { frente: 20, fondo: 12 });
  assert.deepEqual(exacto.units.map((u) => u.unitRef), ["u1", "u2"], "debe reordenar por orden ascendente");
  assert.equal(exacto.units[0].dormitorios, 3);
  assert.equal(exacto.units[1].banos, 2);
});

test("normalizarParti redondea a milímetros sin perder ni ganar ancho total", () => {
  const parti = {
    sourceCabidaVersionId: "cabida_test",
    crujias: 1,
    core: { posicion: 3.333, ancho: 3.333 },
    units: [
      { unitRef: "u1", orden: 1, ancho: 3.333, dormitorios: 1, banos: 1 },
      { unitRef: "u2", orden: 2, ancho: 3.333, dormitorios: 1, banos: 1 },
      { unitRef: "u3", orden: 3, ancho: 3.334, dormitorios: 2, banos: 1 },
    ],
  };
  const exacto = normalizarParti(parti, { frente: 19.999, fondo: 12 });
  const totalUnidades = exacto.units.reduce((s, u) => s + u.ancho, 0);
  const total = totalUnidades + exacto.core.ancho;
  assert.ok(Math.abs(total - 19.999) < 1e-6, `el total (unidades+core) debe reconstruir el frente, dio ${total}`);
  for (const u of exacto.units) {
    assert.equal(Math.round(u.ancho * 1000), u.ancho * 1000, `${u.unitRef} debe quedar en milímetros exactos`);
  }
});

test("normalizarParti elige crujía según el fondo cuando falta o es inválida", () => {
  const parti = {
    sourceCabidaVersionId: "cabida_test",
    core: { posicion: 5, ancho: 3 },
    units: [{ unitRef: "u1", orden: 1, ancho: 10, dormitorios: 2, banos: 1 }],
  };
  const fondoAngosto = normalizarParti({ ...parti, crujias: 9 }, { frente: 20, fondo: 8 });
  assert.equal(fondoAngosto.crujias, 1, "fondo insuficiente para doble crujía → simple");

  const fondoAncho = normalizarParti({ ...parti }, { frente: 20, fondo: 10 });
  assert.equal(fondoAncho.crujias, 2, "fondo suficiente (>= 2*4 + corredor) y sin crujías declarada → doble");
});

test("normalizarParti usa el corredor por defecto si no viene o es inválido", () => {
  const parti = {
    sourceCabidaVersionId: "cabida_test",
    crujias: 1,
    core: { posicion: 5, ancho: 3 },
    units: [{ unitRef: "u1", orden: 1, ancho: 10, dormitorios: 2, banos: 1 }],
  };
  const exacto = normalizarParti(parti, { frente: 20, fondo: 12 });
  assert.equal(exacto.corredorProfundidad, CORREDOR_PROFUNDIDAD_DEFAULT);
});
