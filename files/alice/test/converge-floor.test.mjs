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
  const vol = deps({
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
