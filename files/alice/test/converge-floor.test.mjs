import test from "node:test";
import assert from "node:assert/strict";
import { convergeFloor } from "../src/modules/planos/convergeFloor.js";

const brief = { units: [{ id: "C", area: 40, fachadas: 1, frente: 8.4, fondo: 4.8 }] };
const parti = { id: "p1", core: { x: 7.4, y: 0, w: 5.2, d: 5 },
  units: [{ id: "C", x: 0, w: 8.4 }, { id: "A", x: 8.4, w: 7.4 }] };

const deps = (over = {}) => ({
  planFloor: async () => [parti, { ...parti, id: "p2", core: { ...parti.core, x: 0 } }],
  designUnit: async () => ({ ambientes: [] }),
  materialize: (d) => ({ rooms: [], ...d }),
  validate: () => ({ ok: true, errors: [] }),
  critique: async () => [],
  ...over,
});

test("converge sin hallazgos en una vuelta", async () => {
  const r = await convergeFloor(brief, deps());
  assert.equal(r.motivo, "ok");
  assert.equal(r.pendientes.length, 0);
});

test("descarta partis duplicados antes de elegir", async () => {
  const dup = deps({ planFloor: async () => [parti, { ...parti, id: "dup" }] });
  const r = await convergeFloor(brief, dup);
  assert.equal(r.partisDescartados, 1);
});

test("un hallazgo repetido dos vueltas bloquea la unidad y no hay tercera", async () => {
  let llamadas = 0;
  const terco = deps({
    critique: async () => { llamadas += 1; return [{ ambiente: "sala", regla: "area_min", severidad: "critical", nivel: "interior" }]; },
  });
  const r = await convergeFloor(brief, terco);
  assert.equal(r.motivo, "bloqueado");
  assert.ok(llamadas <= 2, `critique se llamo ${llamadas} veces, esperaba <= 2`);
  assert.deepEqual(r.pendientes, ["C"]);
});

test("un hallazgo de volumen reequilibra el parti en vez de reintentar el interior", async () => {
  let subidas = 0;
  let vuelta = 0;
  // Parti sin solape con el core (a diferencia del `parti` compartido del módulo,
  // cuyo core se traslapa con C): necesario porque rebalancear ahora exige que toda
  // unidad clasifique a izquierda o derecha del core (arreglo 5).
  const partiValido = { id: "pv", core: { x: 8.4, y: 0, w: 5.2, d: 5 },
    units: [{ id: "C", x: 0, w: 8.4 }, { id: "A", x: 13.6, w: 7.4 }] };
  const vol = deps({
    planFloor: async () => [partiValido],
    critique: async () => {
      vuelta += 1;
      if (vuelta === 1) { subidas += 1; return [{ ambiente: "sala", regla: "no_cabe", severidad: "critical", nivel: "volumen" }]; }
      return [];
    },
  });
  const r = await convergeFloor(brief, vol);
  assert.equal(subidas, 1);
  assert.equal(r.motivo, "ok");
  assert.ok(r.parti.units.find((u) => u.id === "C").w > 8.4, "la unidad debio ensancharse");
});

test("respeta el tope de llamadas del piso", async () => {
  const infinito = deps({
    critique: async () => [{ ambiente: `x${Math.random()}`, regla: "area_min", severidad: "critical", nivel: "interior" }],
  });
  const r = await convergeFloor(brief, infinito, { vueltasPorUnidad: 99, llamadasPorPiso: 4 });
  assert.equal(r.motivo, "tope_piso");
  assert.ok(r.llamadas <= 4);
});

test("con brief multi-unidad, tope_piso a mitad de la primera no oculta a la que falta", async () => {
  const briefDos = { units: [
    { id: "C", area: 40, fachadas: 1, frente: 8.4, fondo: 4.8 },
    { id: "A", area: 30, fachadas: 2, frente: 7.4, fondo: 5.0 },
  ] };
  const dosUnidades = deps({
    critique: async () => [{ ambiente: "sala", regla: "area_min", severidad: "critical", nivel: "interior" }],
  });
  const r = await convergeFloor(briefDos, dosUnidades, { llamadasPorPiso: 2 });
  assert.equal(r.motivo, "tope_piso");
  assert.equal(r.unidades.length, 2, "las dos unidades deben quedar listadas, tocadas o no");
  assert.deepEqual([...r.pendientes].sort(), ["A", "C"], "ninguna unidad debe desaparecer de pendientes");
  const noTocada = r.unidades.find((x) => x.layout === null);
  assert.ok(noTocada, "la unidad que nunca se procesó debe listarse con layout null");
  assert.ok(r.pendientes.includes(noTocada.id));
});

test("un RangeError de rebalancear no rompe la cadena: sigue como interior y termina bloqueada", async () => {
  const partiEstrecho = { id: "p3", core: { x: 7.4, y: 0, w: 5.2, d: 5 },
    units: [{ id: "C", x: 0, w: 8.4 }, { id: "A", x: 8.4, w: 3.1 }] };
  const estrecho = deps({
    planFloor: async () => [partiEstrecho],
    critique: async () => [{ ambiente: "sala", regla: "no_cabe", severidad: "critical", nivel: "volumen" }],
  });
  const r = await convergeFloor(brief, estrecho);
  assert.equal(r.motivo, "bloqueado");
  assert.deepEqual(r.pendientes, ["C"]);
  assert.equal(r.parti.units.find((u) => u.id === "A").w, 3.1, "el rebalanceo fallido no debe haber mutado el parti");
});

test("un rebalanceo posterior no invalida en silencio un interior ya cerrado: queda pendiente con layout null", async () => {
  const briefDos = { units: [
    { id: "C", area: 40, fachadas: 1, frente: 8.4, fondo: 4.8 }, // más difícil: se procesa primero
    { id: "A", area: 80, fachadas: 2, frente: 7, fondo: 6 },     // menos difícil: se procesa después
  ] };
  // Sin solape con el core, para que rebalancear pueda clasificar y ejecutar (arreglo 5).
  const partiValido = { id: "pv", core: { x: 8.4, y: 0, w: 5.2, d: 5 },
    units: [{ id: "C", x: 0, w: 8.4 }, { id: "A", x: 13.6, w: 7.4 }] };
  let volDone = false;
  const dep = deps({
    planFloor: async () => [partiValido],
    critique: async ({ unidad }) => {
      if (unidad.id === "A" && !volDone) {
        volDone = true;
        return [{ ambiente: "sala", regla: "no_cabe", severidad: "critical", nivel: "volumen" }];
      }
      return [];
    },
  });

  const r = await convergeFloor(briefDos, dep);

  // C cerró primero contra w=8.4; el rebalanceo que pide A luego deja a C en w=7.8.
  assert.equal(r.parti.units.find((u) => u.id === "C").w, 7.8);
  assert.notEqual(r.motivo, "ok");
  assert.ok(r.pendientes.includes("C"), "C debe reportarse como pendiente, no quedar oculto como resuelto");
  const entradaC = r.unidades.find((x) => x.id === "C");
  assert.equal(entradaC.layout, null, "el layout de C ya no es válido contra el sobre final: se reporta, no se reintenta");
});

test("si planFloor no devuelve ningún parti, no revienta: motivo sin_parti y todas las unidades pendientes", async () => {
  const briefDos = { units: [
    { id: "C", area: 40, fachadas: 1, frente: 8.4, fondo: 4.8 },
    { id: "A", area: 30, fachadas: 2, frente: 7.4, fondo: 5.0 },
  ] };
  const vacio = deps({ planFloor: async () => [] });
  const r = await convergeFloor(briefDos, vacio);
  assert.equal(r.motivo, "sin_parti");
  assert.equal(r.parti, null);
  assert.deepEqual(r.unidades, []);
  assert.deepEqual([...r.pendientes].sort(), ["A", "C"]);
});
