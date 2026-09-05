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
  // 4 propuestos en la primera llamada: "dup" colisiona con `parti` y se descarta;
  // p2 y p3 son distintos entre sí y de `parti`, así que ya hay 3 distintos y no
  // hace falta reintentar.
  const dup = deps({ planFloor: async () => [
    parti,
    { ...parti, id: "dup" },
    { ...parti, id: "p2", core: { ...parti.core, x: 0 } },
    { ...parti, id: "p3", core: { ...parti.core, x: 20 } },
  ] });
  const r = await convergeFloor(brief, dup);
  assert.equal(r.partisDescartados, 1);
});

test("colapso de modo: dedupe deja menos de 3 y se reintenta con exclusion explicita", async () => {
  let llamadasPlanFloor = 0;
  const excluirVistos = [];
  const dep = deps({
    planFloor: async (_brief, opts) => {
      llamadasPlanFloor += 1;
      excluirVistos.push(opts && opts.excluir);
      if (llamadasPlanFloor === 1) {
        // Colapso de modo: Tweedledum devuelve 3 partis "distintos" que en
        // realidad son el mismo (misma firma) -> dedupe los deja en 1.
        return [parti, { ...parti, id: "p1b" }, { ...parti, id: "p1c" }];
      }
      // Reintento: dos nuevos, distintos entre si y del ya visto.
      return [
        { ...parti, id: "p2", core: { ...parti.core, x: 0 } },
        { ...parti, id: "p3", core: { ...parti.core, x: 20 } },
      ];
    },
  });
  const r = await convergeFloor(brief, dep);
  assert.equal(llamadasPlanFloor, 2, "planFloor debio llamarse de nuevo tras el colapso");
  assert.ok(excluirVistos[1] && excluirVistos[1].length === 3, "el reintento debe excluir los 3 ya vistos");
  assert.equal(r.partisDescartados, 2, "los 2 duplicados de la primera tanda se descartan");
  assert.equal(r.motivo, "ok");
});

test("colapso de modo persistente: se reintenta 2 veces y no mas, y la cadena sigue con lo que hay", async () => {
  let llamadasPlanFloor = 0;
  const dep = deps({
    planFloor: async () => {
      llamadasPlanFloor += 1;
      // Siempre el mismo parti "distinto" tres veces: nunca junta 3 distintos.
      return [parti, { ...parti, id: "otro-id-mismo" }];
    },
  });
  const r = await convergeFloor(brief, dep);
  assert.equal(llamadasPlanFloor, 3, "llamada inicial + maximo 2 reintentos, no mas");
  assert.equal(r.motivo, "ok", "la cadena sigue igual con el unico parti distinto que hay");
  assert.ok(r.parti, "debe seguir con el parti que consiguio pese a no llegar a 3");
});

test("el reintento de planFloor respeta el tope de llamadas del piso", async () => {
  let llamadasPlanFloor = 0;
  const dep = deps({
    planFloor: async () => {
      llamadasPlanFloor += 1;
      return [parti, { ...parti, id: "otro-id-mismo" }];
    },
  });
  const r = await convergeFloor(brief, dep, { llamadasPorPiso: 2 });
  assert.ok(llamadasPlanFloor <= 2, `planFloor se llamo ${llamadasPlanFloor} veces, el tope es 2`);
  assert.ok(r.llamadas <= 2);
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

test("una regresion detectada por el validador no gasta una llamada a critique", async () => {
  // planFloor entrega 3 distintos de una: aísla esta prueba del reintento del
  // hueco 1, para que r.llamadas refleje solo lo que pasa por unidad.
  const tresDistintos = [
    parti,
    { ...parti, id: "p2", core: { ...parti.core, x: 0 } },
    { ...parti, id: "p3", core: { ...parti.core, x: 20 } },
  ];
  let ronda = 0;
  let critiqueLlamadas = 0;
  const dep = deps({
    planFloor: async () => tresDistintos,
    validate: () => {
      ronda += 1;
      if (ronda === 3) {
        // Vuelta 3: el validador reintroduce el hallazgo "sala/area_min", ya
        // cerrado tras la vuelta 2 -> regresión.
        return { ok: false, errors: [{ ambiente: "sala", regla: "area_min", severidad: "critical", nivel: "interior" }] };
      }
      return { ok: true, errors: [] };
    },
    critique: async () => {
      critiqueLlamadas += 1;
      if (critiqueLlamadas === 1) {
        // Vuelta 1: dos hallazgos abiertos.
        return [
          { ambiente: "sala", regla: "area_min", severidad: "critical", nivel: "interior" },
          { ambiente: "cocina", regla: "ventilacion", severidad: "critical", nivel: "interior" },
        ];
      }
      if (critiqueLlamadas === 2) {
        // Vuelta 2: ninguno de los dos anteriores reaparece -> ambos cierran,
        // pero aparece uno nuevo para que la unidad no cierre todavía.
        return [{ ambiente: "banio", regla: "ancho_util", severidad: "critical", nivel: "interior" }];
      }
      return [];
    },
  });

  const r = await convergeFloor(brief, dep);

  assert.equal(critiqueLlamadas, 2, "critique no debe llamarse en la vuelta con regresion");
  assert.equal(r.llamadas, 6, "1 planFloor + 3 designUnit + 2 critique (la 3ra se ahorra)");
});

test("la unidad que converge primero se propaga como ejemplar a las siguientes", async () => {
  const briefDos = { units: [
    { id: "C", area: 40, fachadas: 1, frente: 8.4, fondo: 4.8 },
    { id: "A", area: 30, fachadas: 2, frente: 7.4, fondo: 5.0 },
  ] };
  const llamadasDesignUnit = [];
  const dep = deps({
    designUnit: async ({ unidad, ejemplar }) => {
      llamadasDesignUnit.push({ unidad: unidad.id, ejemplar });
      return { ambientes: [] };
    },
  });

  const r = await convergeFloor(briefDos, dep);

  assert.equal(r.motivo, "ok");
  assert.equal(llamadasDesignUnit.length, 2);
  // C es la mas dificil (menos fachadas): se procesa primero y no tiene ejemplar previo.
  assert.equal(llamadasDesignUnit[0].unidad, "C");
  assert.equal(llamadasDesignUnit[0].ejemplar, null, "la primera unidad no tiene ejemplar previo");
  assert.ok(llamadasDesignUnit[1].ejemplar, "la segunda unidad debe recibir un ejemplar");
  assert.equal(llamadasDesignUnit[1].ejemplar.unidad, "C", "el ejemplar es la primera unidad que convergio");
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
