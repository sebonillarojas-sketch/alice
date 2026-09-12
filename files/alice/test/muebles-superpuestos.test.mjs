// Las reglas de colocación asumen ambientes de tamaño típico. Los que salen del atlas
// vienen deformados para entrar en el sobre real, y ahí las distancias fijas chocan.
import test from "node:test";
import assert from "node:assert/strict";
import { amoblarDesdeLayout, resolverSuperposiciones } from "../src/modules/planos/distribucion.js";

const R = (name, tipo, x, y, w, h) => ({ name, tipo,
  pts: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }] });
const caja = (t) => { const q = ((t.rot || 0) % 180 + 180) % 180, v = q > 45 && q < 135;
  const w = v ? t.d : t.w, h = v ? t.w : t.d;
  return { x0: t.x - w / 2, y0: t.y - h / 2, x1: t.x + w / 2, y1: t.y + h / 2 }; };
const pares = (L) => { let n = 0;
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    const a = caja(L[i]), b = caja(L[j]);
    if (Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0.05
     && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 0.05) n++; }
  return n; };

// un baño apretado: es el caso real que rompía — amoblarBano estira la ducha a todo el
// ancho como zona húmeda y después mete el inodoro dentro de esa franja
const PLANTA = [
  R("sala-comedor", "social", 0, 0, 4.2, 3.8),
  R("cocina", "servicio", 4.2, 0, 2.2, 2.4),
  R("baño 1", "servicio", 4.2, 2.4, 2.18, 1.56),
  R("dormitorio principal", "intima", 0, 3.8, 3.4, 3.0),
  R("dormitorio 2", "intima", 3.4, 3.96, 3.0, 2.84),
];
const W = 6.4, D = 6.8;

test("el amoblador no deja muebles superpuestos", () => {
  const items = amoblarDesdeLayout(PLANTA, W, D, "C", { aberturas: false });
  assert.equal(pares(items), 0, "ningún par puede quedar encimado");
  assert.ok(items.length > 0, "pero tiene que seguir amoblando");
});

test("el baño conserva su ducha: no se descarta lo que sí entra", () => {
  const items = amoblarDesdeLayout(PLANTA, W, D, "C", { aberturas: false });
  assert.ok(items.some((t) => t.ref === "ducha"),
    "un baño de 2.18 x 1.56 admite ducha, inodoro y lavamanos: sacarla sería un falso descarte");
  assert.ok(items.some((t) => t.ref === "inodoro"));
});

test("resolver mueve el mueble esencial cuando el otro no tiene adónde ir", () => {
  // ducha estirada a zona húmeda (no se puede correr) con el inodoro encima
  const amb = [R("baño", "servicio", 0, 0, 2.18, 1.56)];
  const items = [
    { id: "d", ref: "ducha", x: 1.09, y: 0.45, rot: 0, w: 2.06, d: 0.85 },
    { id: "i", ref: "inodoro", x: 1.82, y: 0.73, rot: 90, w: 0.4, d: 0.68 },
  ];
  const r = resolverSuperposiciones(items, amb);
  assert.equal(pares(r.items), 0, "tienen que quedar separados");
  assert.equal(r.items.length, 2, "ninguno se descarta: el baño admite los dos");
  assert.ok(r.movidos.some((m) => m.ref === "inodoro"), "se mueve el inodoro, que es el que puede");
});

test("se descarta solo cuando el ambiente de verdad no admite el mueble", () => {
  const amb = [R("baño", "servicio", 0, 0, 1.0, 1.0)];
  const items = [
    { id: "i", ref: "inodoro", x: 0.5, y: 0.5, rot: 0, w: 0.4, d: 0.68 },
    { id: "d", ref: "ducha", x: 0.5, y: 0.5, rot: 0, w: 0.9, d: 0.9 },
  ];
  const r = resolverSuperposiciones(items, amb);
  assert.equal(pares(r.items), 0);
  assert.equal(r.descartados.length, 1, "en 1 x 1 m no entran los dos");
  assert.ok(r.items.some((t) => t.ref === "inodoro"), "se conserva el más esencial");
});

test("no muta la lista que recibe", () => {
  const amb = [R("baño", "servicio", 0, 0, 2.18, 1.56)];
  const items = [{ id: "d", ref: "ducha", x: 1.09, y: 0.45, rot: 0, w: 2.06, d: 0.85 },
                 { id: "i", ref: "inodoro", x: 1.82, y: 0.73, rot: 90, w: 0.4, d: 0.68 }];
  const antes = JSON.stringify(items);
  resolverSuperposiciones(items, amb);
  assert.equal(JSON.stringify(items), antes, "la entrada queda intacta");
});
