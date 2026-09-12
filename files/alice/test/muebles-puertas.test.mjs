// El amoblador coloca sin saber dónde van las puertas: los vanos se derivan después, del
// grafo de muros. Sin pasarle las zonas de paso, quedan camas y sofás tapando el acceso.
import test from "node:test";
import assert from "node:assert/strict";
import { amoblarDesdeLayout, resolverSuperposiciones, zonasDePaso } from "../src/modules/planos/distribucion.js";

const R = (name, tipo, x, y, w, h) => ({ name, tipo,
  pts: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }] });
const caja = (t) => { const q = ((t.rot || 0) % 180 + 180) % 180, v = q > 45 && q < 135;
  const w = v ? t.d : t.w, h = v ? t.w : t.d;
  return { x0: t.x - w / 2, y0: t.y - h / 2, x1: t.x + w / 2, y1: t.y + h / 2 }; };
const pisa = (a, b) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0.05
                    && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 0.05;

test("zonasDePaso engorda el vano perpendicular a su eje y omite ventanas", () => {
  const z = zonasDePaso([
    { tipo: "puerta", geom: { p1: { x: 1, y: 2 }, p2: { x: 1.8, y: 2 } } },
    { tipo: "ventana", geom: { p1: { x: 0, y: 0 }, p2: { x: 1.8, y: 0 } } },
  ]);
  assert.equal(z.length, 1, "una ventana no se cruza: no genera zona de paso");
  assert.ok(z[0].y1 - z[0].y0 > 0.8, "la franja se extiende a los dos lados del muro");
  assert.ok(Math.abs((z[0].x1 - z[0].x0) - 0.8) < 1e-6, "y conserva el ancho del vano");
});

test("un mueble que nace sobre una puerta se corre", () => {
  const amb = [R("sala", "social", 0, 0, 4, 4)];
  const zona = zonasDePaso([{ tipo: "puerta", geom: { p1: { x: 1.6, y: 0 }, p2: { x: 2.4, y: 0 } } }]);
  const items = [{ id: "s", ref: "sofa-3c", x: 2, y: 0.4, rot: 0, w: 2.1, d: 0.85 }];
  const r = resolverSuperposiciones(items, amb, { obstaculos: zona });
  assert.equal(r.items.length, 1, "no se descarta");
  assert.ok(!zona.some((z) => pisa(caja(r.items[0]), z)), "y deja libre el paso");
  assert.ok(r.movidos.some((m) => /puerta/.test(m.motivo)));
});

test("un aparato fijo NO se mueve por una puerta: se reporta", () => {
  // una ducha está donde está por las instalaciones. Moverla rompe el baño.
  const amb = [R("baño", "servicio", 0, 0, 2.2, 1.6)];
  const zona = zonasDePaso([{ tipo: "puerta", geom: { p1: { x: 0.3, y: 0 }, p2: { x: 1.1, y: 0 } } }]);
  const items = [{ id: "d", ref: "ducha", x: 0.7, y: 0.45, rot: 0, w: 1.3, d: 0.9 }];
  const r = resolverSuperposiciones(items, amb, { obstaculos: zona });
  assert.equal(r.items.length, 1, "el aparato se conserva");
  assert.deepEqual(r.movidos, [], "y no se mueve");
  assert.ok(r.estorban.some((e) => e.ref === "ducha" && /aparato fijo/.test(e.motivo)),
    "pero se reporta para que alguien mueva la puerta");
});

test("el amoblador acepta los vanos: mueve lo que puede y reporta lo que no", () => {
  // El contrato NO es "nunca tapa una puerta" — en un dormitorio chico el clóset puede no
  // tener adónde ir. El contrato es que nunca lo haga EN SILENCIO: o se corre, o sale
  // reportado para que alguien decida (mover la puerta, o achicar el mueble).
  const planta = [
    R("sala-comedor", "social", 0, 0, 4.2, 3.8),
    R("dormitorio principal", "intima", 0, 3.8, 4.2, 3.2),
  ];
  const vanos = [{ tipo: "puerta", ancho: 0.9, geom: { p1: { x: 1.6, y: 3.8 }, p2: { x: 2.5, y: 3.8 } } }];
  const items = amoblarDesdeLayout(planta, 4.2, 7.0, "C", { aberturas: false, vanos });
  assert.ok(items.some((t) => /^cama/.test(t.ref)), "el dormitorio conserva su cama");

  const zona = zonasDePaso(vanos);
  const r = resolverSuperposiciones(items, planta, { obstaculos: zona });
  const tapan = r.items.filter((t) => zona.some((z) => pisa(caja(t), z)));
  for (const t of tapan) {
    assert.ok(r.estorban.some((e) => e.ref === t.ref) || r.movidos.some((m) => m.ref === t.ref),
      `"${t.ref}" tapa la puerta y no se reportó ni se intentó mover`);
  }
});
