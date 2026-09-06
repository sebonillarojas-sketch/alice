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

test("normalizarParti con crujias:1 ignora banda: todas las unidades quedan en una sola banda", () => {
  const parti = {
    sourceCabidaVersionId: "cabida_test",
    crujias: 1,
    core: { posicion: 8, ancho: 4 },
    units: [
      { unitRef: "u1", orden: 1, ancho: 6, dormitorios: 3, banos: 2, banda: 2 },
      { unitRef: "u2", orden: 2, ancho: 5, dormitorios: 2, banos: 2, banda: 2 },
    ],
  };
  const exacto = normalizarParti(parti, { frente: 20, fondo: 12 });
  const total = exacto.units.reduce((s, u) => s + u.ancho, 0);
  assert.ok(Math.abs(total - 16) < 1e-6, "las dos unidades deben repartirse juntas el disponible (frente 20 − core 4)");
  assert.equal(exacto.units.length, 2);
});

test("normalizarParti con crujias:2 reparte por banda cuando alguna unidad declara banda 2", () => {
  const parti = {
    sourceCabidaVersionId: "cabida_test",
    crujias: 2,
    corredorProfundidad: 1.5,
    core: { posicion: 9, ancho: 4 },
    units: [
      { unitRef: "u1", orden: 1, ancho: 7, dormitorios: 2, banos: 1, banda: 1 },
      { unitRef: "u2", orden: 2, ancho: 9, dormitorios: 2, banos: 1, banda: 2 },
    ],
  };
  // frente 30, core 4 → disponible 26. La banda 1 (de referencia, fija la posición del
  // core) prorratea su única unidad para llenar esos 26 m disponibles. Sin `longitud`
  // declarada, el core cae al default (5 m), que no supera la banda del frente
  // (fondo 16, corredor 1.5 → bandDepth = (16−1.5)/2 = 7.25): el core no alcanza la
  // banda del fondo, así que esa banda se reparte a todo el frente (30), sin que el core
  // la interrumpa — la unidad única de banda 2 llena el frente completo, no el disponible.
  const exacto = normalizarParti(parti, { frente: 30, fondo: 16 });
  const u1 = exacto.units.find((u) => u.unitRef === "u1");
  const u2 = exacto.units.find((u) => u.unitRef === "u2");
  assert.equal(u1.banda, 1);
  assert.equal(u2.banda, 2);
  assert.ok(Math.abs(u1.ancho - 26) < 1e-6, `u1 (única unidad de su banda) debe llenar el disponible, dio ${u1.ancho}`);
  assert.ok(Math.abs(u2.ancho - 30) < 1e-6, `u2 (única unidad de la banda del fondo, no interrumpida por el core) debe llenar el frente completo, dio ${u2.ancho}`);
});

// --- distanciaAlFrente (núcleo retirado del frente) -----------------------------------
// El núcleo lo determina el agente, no el motor: `distanciaAlFrente` viaja del esquema
// (alicia-brain) hasta acá, se sanea igual que `longitud`, y se recorta `longitud` (no
// la distancia, que es la decisión del agente) si juntas exceden el fondo del marco.
// `avisos` es cómo normalizarParti le confiesa a materializeFloorProposal (floorProposal.js)
// qué campos del núcleo tuvo que rellenar o acotar — nada de defaults silenciosos.

const partiBase = (extra = {}) => ({
  sourceCabidaVersionId: "cabida_test",
  crujias: 1,
  corredorProfundidad: 1.6,
  core: { posicion: 8, ancho: 4, ...extra },
  units: [{ unitRef: "u1", orden: 1, ancho: 10, dormitorios: 2, banos: 1 }],
});

test("normalizarParti propaga distanciaAlFrente sana sin avisos cuando el agente la declara válida", () => {
  const exacto = normalizarParti(partiBase({ distanciaAlFrente: 4, longitud: 5 }), { frente: 20, fondo: 22.35 });
  assert.equal(exacto.core.distanciaAlFrente, 4);
  assert.equal(exacto.core.longitud, 5);
  assert.deepEqual(exacto.core.avisos, [], "una decisión válida del agente no genera avisos");
});

test("normalizarParti con distanciaAlFrente ausente o 0 se comporta EXACTAMENTE como sin la Tarea: default 0, sin aviso", () => {
  const sinDeclarar = normalizarParti(partiBase({ longitud: 5 }), { frente: 20, fondo: 22.35 });
  const conCero = normalizarParti(partiBase({ distanciaAlFrente: 0, longitud: 5 }), { frente: 20, fondo: 22.35 });
  assert.equal(sinDeclarar.core.distanciaAlFrente, 0);
  assert.deepEqual(sinDeclarar.core.avisos, [], "ausente cae a 0 en silencio: 0 es el comportamiento de siempre, no un relleno a confesar");
  assert.deepEqual(conCero, sinDeclarar, "declarar distanciaAlFrente:0 explícito no debe cambiar nada frente a omitirlo");
});

test("normalizarParti reporta un aviso cuando distanciaAlFrente llega inválida (negativa) del agente", () => {
  const exacto = normalizarParti(partiBase({ distanciaAlFrente: -3, longitud: 5 }), { frente: 20, fondo: 22.35 });
  assert.equal(exacto.core.distanciaAlFrente, 0, "una distancia negativa cae al default 0");
  assert.deepEqual(exacto.core.avisos, [{ campo: "distanciaAlFrente", motivo: "invalida", valor: 0 }]);
});

test("normalizarParti reporta un aviso cuando longitud falta (el agente no la declaró)", () => {
  const exacto = normalizarParti(partiBase({ distanciaAlFrente: 4 }), { frente: 20, fondo: 22.35 });
  assert.equal(exacto.core.avisos.length, 1);
  assert.equal(exacto.core.avisos[0].campo, "longitud");
  assert.equal(exacto.core.avisos[0].motivo, "ausente");
  assert.ok(exacto.core.avisos[0].valor > 0);
});

test("normalizarParti recorta longitud (no la distancia) cuando distanciaAlFrente + longitud excede el fondo, y lo reporta", () => {
  // fondo 10, distanciaAlFrente 8 (decisión del agente): longitud declarada (5) no cabe
  // (8+5=13 > 10) → se recorta a 2 (10-8), la distancia NO se toca.
  const exacto = normalizarParti(partiBase({ distanciaAlFrente: 8, longitud: 5 }), { frente: 20, fondo: 10 });
  assert.equal(exacto.core.distanciaAlFrente, 8, "la distancia es la decisión del agente: no se mueve");
  assert.equal(exacto.core.longitud, 2, "la longitud se recorta para no exceder el fondo");
  assert.ok(
    exacto.core.avisos.some((a) => a.campo === "longitud" && a.motivo === "acotada" && Math.abs(a.valor - 2) < 1e-6),
    `debe reportar el recorte, avisos: ${JSON.stringify(exacto.core.avisos)}`,
  );
});

test("normalizarParti con crujias:2 y sin ninguna banda 2 se comporta igual que antes (compatibilidad)", () => {
  const parti = {
    sourceCabidaVersionId: "cabida_test",
    crujias: 2,
    corredorProfundidad: 1.5,
    core: { posicion: 8, ancho: 4 },
    units: [
      { unitRef: "u1", orden: 1, ancho: 6, dormitorios: 3, banos: 2 },
      { unitRef: "u2", orden: 2, ancho: 5, dormitorios: 2, banos: 2 },
    ],
  };
  const conBanda = normalizarParti(parti, { frente: 20, fondo: 16 });
  const sinCrujiasEnUnidad = normalizarParti(
    { ...parti, units: parti.units.map((u) => ({ ...u, banda: 1 })) },
    { frente: 20, fondo: 16 },
  );
  assert.deepEqual(conBanda, sinCrujiasEnUnidad, "declarar banda:1 explícito no debe cambiar nada frente a omitirlo");
  assert.equal(conBanda.units.length, 2, "ambas unidades quedan en la misma banda, ninguna se pierde");
});
