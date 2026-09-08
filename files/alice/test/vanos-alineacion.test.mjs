// La garantía que pidió Sebastián: una puerta no puede quedar desalineada del muro.
// Se cumple por construcción — el vano no guarda coordenadas propias, solo muroId + t —
// pero eso hay que fijarlo con pruebas, porque la tentación de que el renderer calcule
// la posición por su cuenta es exactamente lo que reintroduciría el defecto.
import test from "node:test";
import assert from "node:assert/strict";
import { construirMuros } from "../src/modules/planos/muros.js";
import { construirVanos, resolverVano } from "../src/modules/planos/vanos.js";

const R = (id, name, tipo, x, y, w, h, unitRef) => ({ id, name, tipo, unitRef,
  pts: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }] });

// distancia de un punto al SEGMENTO (no a la recta): atrapa tanto el desvío lateral
// como el vano que se sale por un extremo.
const distAlSegmento = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy;
  const u = L2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2)) : 0;
  return Math.hypot(p.x - (a.x + u * dx), p.y - (a.y + u * dy));
};

// Una planta con muros en las dos direcciones y un quiebre, para que la alineación
// tenga que resolverse en más de un ángulo.
const PLANTA = [
  R("corr", "circulación", "pasillo", 0, 7, 8, 1.6, null),
  R("soc", "sala-comedor", "social", 0, 4.2, 4.6, 2.8, "u1"),
  R("d1", "dormitorio 1", "intima", 4.6, 4.2, 3.4, 2.8, "u1"),
  R("d2", "dormitorio 2", "intima", 0, 0, 4.0, 4.2, "u1"),
  R("coc", "cocina", "servicio", 4.0, 0, 4.0, 4.2, "u1"),
];
const HUELLA = [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 8.6 }, { x: 0, y: 8.6 }];

const correr = () => {
  const { muros } = construirMuros(PLANTA, { footprint: HUELLA, frontIdx: 0, lotType: "medianero" });
  const { vanos } = construirVanos(muros, PLANTA, { footprint: HUELLA, frontIdx: 0 });
  return { muros, vanos, byId: new Map(muros.map((m) => [m.id, m])) };
};

test("cada vano se apoya exactamente sobre su muro", () => {
  const { vanos, byId } = correr();
  assert.ok(vanos.length > 0, "la planta tiene que producir vanos");
  for (const v of vanos) {
    const muro = byId.get(v.muroId);
    assert.ok(muro, `el vano ${v.id} apunta a un muro que no existe`);
    const g = resolverVano(v, muro);
    for (const [etiqueta, punto] of [["centro", g.centro], ["p1", g.p1], ["p2", g.p2]]) {
      const d = distAlSegmento(punto, muro.a, muro.b);
      assert.ok(d < 1e-9, `${v.id}: ${etiqueta} está a ${d.toFixed(6)} m del muro ${muro.id}`);
    }
  }
});

test("el ángulo del vano es el del muro", () => {
  const { vanos, byId } = correr();
  for (const v of vanos) {
    const muro = byId.get(v.muroId);
    const esperado = Math.atan2(muro.b.y - muro.a.y, muro.b.x - muro.a.x) * 180 / Math.PI;
    assert.ok(Math.abs(resolverVano(v, muro).angulo - esperado) < 1e-9,
      `${v.id} no comparte el ángulo de su muro`);
  }
});

test("el ancho dibujado es el ancho declarado", () => {
  const { vanos, byId } = correr();
  for (const v of vanos) {
    const g = resolverVano(v, byId.get(v.muroId));
    assert.ok(Math.abs(Math.hypot(g.p2.x - g.p1.x, g.p2.y - g.p1.y) - v.ancho) < 1e-9,
      `${v.id}: el largo entre p1 y p2 no es su ancho`);
  }
});

test("ningún vano se sale del muro por un extremo", () => {
  const { vanos, byId } = correr();
  for (const v of vanos) {
    const muro = byId.get(v.muroId);
    const g = resolverVano(v, muro);
    assert.equal(g.recortado, false, `${v.id} tuvo que recortarse: la colocación lo puso fuera del muro`);
    for (const p of [g.p1, g.p2]) {
      const u = ((p.x - muro.a.x) * (muro.b.x - muro.a.x) + (p.y - muro.a.y) * (muro.b.y - muro.a.y))
        / (muro.largo * muro.largo);
      assert.ok(u >= -1e-9 && u <= 1 + 1e-9, `${v.id} se sale del muro (u=${u.toFixed(4)})`);
    }
  }
});

test("resolver acota un vano mal colocado en vez de dibujarlo fuera", () => {
  const muro = { id: "m", a: { x: 0, y: 0 }, b: { x: 2, y: 0 }, largo: 2, clase: "interior", lados: [] };
  const g = resolverVano({ id: "v", muroId: "m", t: 1.95, ancho: 0.9 }, muro);
  assert.equal(g.recortado, true, "tiene que avisar que lo acotó");
  assert.ok(g.p2.x <= 2 + 1e-9 && g.p1.x >= -1e-9, "acotado, no fuera del muro");
});

test("un muro degenerado no produce geometría", () => {
  assert.equal(resolverVano({ t: 0, ancho: 0.8 }, { a: { x: 1, y: 1 }, b: { x: 1, y: 1 }, largo: 0 }), null);
  assert.equal(resolverVano(null, null), null);
});
