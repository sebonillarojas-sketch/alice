// Dos reglas que pidió Sebastián: un mueble no puede quedar bajo el barrido de una puerta,
// y dos puertas no pueden barrer sobre el mismo suelo. Se corrige moviendo la PUERTA: una
// cama o una ducha están donde el muro o las instalaciones las admiten; la puerta puede
// deslizarse por su muro sin que nada más cambie.
import test from "node:test";
import assert from "node:assert/strict";
import { ajustarVanos } from "../src/modules/planos/vanos.js";

const muro = (id, ax, ay, bx, by, clase = "interior") => ({
  id, a: { x: ax, y: ay }, b: { x: bx, y: by }, clase, lados: [],
  largo: Math.hypot(bx - ax, by - ay),
});
const barrido = (v, muros) => {
  const m = muros.find((x) => x.id === v.muroId);
  const L = m.largo, ux = (m.b.x - m.a.x) / L, uy = (m.b.y - m.a.y) / L, lado = v.lado || 1;
  const nx = -uy * lado, ny = ux * lado, h = v.ancho / 2, R = v.ancho;
  const p1 = { x: m.a.x + ux * (v.t - h), y: m.a.y + uy * (v.t - h) };
  const p2 = { x: m.a.x + ux * (v.t + h), y: m.a.y + uy * (v.t + h) };
  const xs = [p1.x, p2.x, p1.x + nx * R, p2.x + nx * R], ys = [p1.y, p2.y, p1.y + ny * R, p2.y + ny * R];
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
};
const caja = (t) => { const q = ((t.rot || 0) % 180 + 180) % 180, v = q > 45 && q < 135;
  const w = v ? t.d : t.w, h = v ? t.w : t.d;
  return { x0: t.x - w / 2, y0: t.y - h / 2, x1: t.x + w / 2, y1: t.y + h / 2 }; };
const pisan = (a, b) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0.06
                     && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 0.06;

test("la puerta se corre cuando su barrido pisa un mueble", () => {
  const muros = [muro("m1", 0, 0, 5, 0)];
  const vanos = [{ id: "v1", muroId: "m1", t: 2.5, ancho: 0.8, tipo: "puerta", entre: ["a", "b"] }];
  const items = [{ ref: "cama-2plz", x: 2.5, y: 0.9, rot: 0, w: 1.5, d: 2.0 }];
  const r = ajustarVanos(vanos, muros, items);
  assert.ok(r.movidos.length === 1, "tiene que reportar que la movió");
  assert.equal(pisan(barrido(r.vanos[0], muros), caja(items[0])), false, "y no puede seguir pisándola");
});

test("dos puertas no pueden barrer sobre el mismo suelo", () => {
  const muros = [muro("m1", 0, 0, 6, 0)];
  const vanos = [
    { id: "v1", muroId: "m1", t: 3.0, ancho: 0.9, tipo: "puerta", entre: ["a", "b"] },
    { id: "v2", muroId: "m1", t: 3.4, ancho: 0.9, tipo: "puerta", entre: ["a", "c"] },
  ];
  const r = ajustarVanos(vanos, muros, []);
  assert.equal(pisan(barrido(r.vanos[0], muros), barrido(r.vanos[1], muros)), false,
    "los dos barridos tienen que quedar separados");
});

test("la puerta nunca se sale de su muro al correrse", () => {
  const muros = [muro("m1", 0, 0, 3, 0)];
  const vanos = [{ id: "v1", muroId: "m1", t: 1.5, ancho: 0.9, tipo: "puerta", entre: ["a", "b"] }];
  const items = [{ ref: "sofa-3c", x: 1.5, y: 0.7, rot: 0, w: 2.1, d: 0.85 }];
  const r = ajustarVanos(vanos, muros, items);
  const v = r.vanos[0];
  assert.ok(v.t - v.ancho / 2 >= 0.15 - 1e-9 && v.t + v.ancho / 2 <= 3 - 0.15 + 1e-9,
    `quedó en t=${v.t}, fuera del muro`);
});

test("cuando no hay posición libre se deja y se reporta, no se borra la puerta", () => {
  // un muro corto con el ambiente lleno: no hay dónde correrla
  const muros = [muro("m1", 0, 0, 1.3, 0)];
  const vanos = [{ id: "v1", muroId: "m1", t: 0.65, ancho: 0.8, tipo: "puerta", entre: ["a", "b"] }];
  const items = [
    { ref: "cama-2plz", x: 0.65, y: 0.6, rot: 0, w: 1.5, d: 2.0 },
    { ref: "closet", x: 0.65, y: -0.6, rot: 0, w: 1.5, d: 0.6 },
  ];
  const r = ajustarVanos(vanos, muros, items);
  assert.equal(r.vanos.length, 1, "la puerta no se pierde: sin ella el ambiente queda encerrado");
  assert.equal(r.sinLugar.length, 1, "pero se reporta");
  assert.ok(r.vanos[0].lado === 1 || r.vanos[0].lado === -1, "y se elige el lado menos malo");
});

test("las ventanas no se tocan: no tienen barrido", () => {
  const muros = [muro("m1", 0, 0, 5, 0, "fachada")];
  const vanos = [{ id: "w1", muroId: "m1", t: 2.5, ancho: 1.8, tipo: "ventana", entre: ["a", null] }];
  const r = ajustarVanos(vanos, muros, [{ ref: "sofa-3c", x: 2.5, y: 0.5, rot: 0, w: 2.1, d: 0.85 }]);
  assert.equal(r.vanos[0].t, 2.5, "una ventana no se corre por un mueble");
  assert.deepEqual(r.movidos, []);
});
