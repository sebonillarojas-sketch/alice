// Desde que muros.js funde el grafo y vanos.js abre los vanos, el amoblador dejó de ser la
// autoridad sobre dónde va una puerta. Si vuelve a emitirlas en el camino de producción,
// el plano guarda una puerta y el dibujo deriva otra: dos verdades para el mismo paso.
import test from "node:test";
import assert from "node:assert/strict";
import { amoblarDesdeLayout } from "../src/modules/planos/distribucion.js";
import { materializeInteriorLayout } from "../src/modules/planos/materialize.js";
import { porId } from "../src/modules/planos/mobiliario.js";

const R = (name, tipo, x, y, w, h) => ({ name, tipo,
  pts: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }] });

const PLANTA = [
  R("sala-comedor", "social", 0, 0, 4.4, 4.0),
  R("cocina", "servicio", 4.4, 0, 2.4, 2.6),
  R("baño", "servicio", 4.4, 2.6, 1.8, 1.4),
  R("dormitorio principal", "intima", 0, 4.0, 3.6, 3.2),
  R("dormitorio 2", "intima", 3.6, 4.0, 3.2, 3.2),
];
const W = 6.8, D = 7.2;
const esAbertura = (t) => porId[t.ref]?.cat === "abertura";

test("por defecto el amoblador sigue emitiendo aberturas", () => {
  const items = amoblarDesdeLayout(PLANTA, W, D, "C");
  assert.ok(items.some(esAbertura), "el comportamiento por defecto no cambia");
});

test("con aberturas:false no emite ninguna", () => {
  const items = amoblarDesdeLayout(PLANTA, W, D, "C", { aberturas: false });
  assert.deepEqual(items.filter(esAbertura), [], "no puede quedar ninguna abertura");
});

test("y el mobiliario queda intacto: solo se van las aberturas", () => {
  const con = amoblarDesdeLayout(PLANTA, W, D, "C");
  const sin = amoblarDesdeLayout(PLANTA, W, D, "C", { aberturas: false });
  assert.equal(sin.length, con.filter((t) => !esAbertura(t)).length,
    "no se puede perder un solo mueble");
  assert.ok(sin.length > 0, "tiene que seguir amoblando");
  assert.ok(sin.some((t) => /^cama/.test(t.ref)), "los dormitorios siguen con cama");
});

test("el camino de producción no guarda aberturas en el plano", () => {
  const layout = { ambientes: PLANTA.map((r, i) => ({
    nombre: r.name, ref_id: `r${i}`, poligono: r.pts.map((p) => [p.x, p.y]) })) };
  const { items } = materializeInteriorLayout(layout, {
    boundary: [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: D }, { x: 0, y: D }],
    program: { dormitorios: 2, banos: 1, nse: "C" },
  });
  assert.deepEqual(items.filter(esAbertura), [],
    "materializeInteriorLayout no puede volver a meter puertas ni ventanas como items");
  assert.ok(items.length > 0, "pero sí tiene que amoblar");
});
