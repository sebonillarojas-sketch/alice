// El motor no solo conecta: distingue una vivienda de un grafo conexo. Estos tests fijan
// el criterio arquitectónico — por dónde se entra y por dónde se pasa — y los dos hallazgos
// que reportan un reparto malo en vez de dibujarlo callado.
import test from "node:test";
import assert from "node:assert/strict";
import { construirMuros } from "../src/modules/planos/muros.js";
import { construirVanos } from "../src/modules/planos/vanos.js";

const R = (id, name, tipo, x, y, w, h, unitRef) => ({ id, name, tipo, unitRef,
  pts: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }] });

const correr = (rooms, footprint) => {
  const { muros } = construirMuros(rooms, { footprint, frontIdx: 0, lotType: "medianero" });
  return { muros, ...construirVanos(muros, rooms, { footprint, frontIdx: 0 }) };
};
const HUELLA = [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 8.6 }, { x: 0, y: 8.6 }];

// Sala pegada al corredor: la entrada tiene que caer ahí, no en el dormitorio vecino.
const BUENA = [
  R("corr", "circulación", "pasillo", 0, 7, 8, 1.6, null),
  R("soc", "sala-comedor", "social", 0, 4.2, 4.6, 2.8, "u1"),
  R("d1", "dormitorio 1", "intima", 4.6, 4.2, 3.4, 2.8, "u1"),
  R("d2", "dormitorio 2", "intima", 0, 0, 4.0, 4.2, "u1"),
  R("ban", "baño", "servicio", 4.0, 0, 4.0, 4.2, "u1"),
];

test("se entra por el ambiente de estar, no por un dormitorio", () => {
  const { vanos, hallazgos, muros } = correr(BUENA, HUELLA);
  const byId = new Map(muros.map((m) => [m.id, m]));
  const entrada = vanos.find((v) => byId.get(v.muroId).clase === "a_corredor");
  assert.ok(entrada, "tiene que haber una entrada");
  assert.ok(entrada.entre.includes("soc"), `la entrada cayó en ${entrada.entre} y no en la sala`);
  assert.equal(hallazgos.filter((h) => h.codigo === "entrada_por_dormitorio").length, 0);
});

test("entrar por un dormitorio es un hallazgo, no un silencio", () => {
  // la sala no llega al corredor: solo los dormitorios lo tocan
  const mala = [
    R("corr", "circulación", "pasillo", 0, 7, 8, 1.6, null),
    R("d1", "dormitorio 1", "intima", 0, 4.2, 4.0, 2.8, "u1"),
    R("d2", "dormitorio 2", "intima", 4.0, 4.2, 4.0, 2.8, "u1"),
    R("soc", "sala-comedor", "social", 0, 0, 8, 4.2, "u1"),
  ];
  const { hallazgos } = correr(mala, HUELLA);
  assert.ok(hallazgos.some((h) => h.codigo === "entrada_por_dormitorio"),
    "entrar por un dormitorio tiene que reportarse");
});

test("pasar de un dormitorio a otro es un hallazgo", () => {
  // d2 solo toca a d1: la única forma de llegar es atravesándolo
  const encadenada = [
    R("corr", "circulación", "pasillo", 0, 7, 8, 1.6, null),
    R("soc", "sala-comedor", "social", 0, 4.2, 4.0, 2.8, "u1"),
    R("d1", "dormitorio 1", "intima", 4.0, 4.2, 4.0, 2.8, "u1"),
    R("d2", "dormitorio 2", "intima", 4.0, 0, 4.0, 4.2, "u1"),
  ];
  const { hallazgos } = correr(encadenada, HUELLA);
  assert.ok(hallazgos.some((h) => h.codigo === "paso_entre_dormitorios" && h.roomId === "d2"),
    "el paso dormitorio a dormitorio tiene que reportarse");
});

test("una planta sana no inventa hallazgos de circulación", () => {
  const { hallazgos } = correr(BUENA, HUELLA);
  const circulacion = hallazgos.filter((h) =>
    ["entrada_por_dormitorio", "paso_entre_dormitorios", "ambiente_inaccesible"].includes(h.codigo));
  assert.deepEqual(circulacion, [], `hallazgos de más: ${JSON.stringify(circulacion)}`);
});
