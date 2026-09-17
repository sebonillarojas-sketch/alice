import { test } from "node:test";
import assert from "node:assert/strict";
import { detectarProyecto } from "../src/mica/motor.js";

const CAT = [
  { id: "SA01", nombre: "San Antonio 01", alias: ["Legendre", "PU01", "Ugarriza"] },
  { id: "SA02", nombre: "San Antonio 02", alias: ["del Castillo", "DC01"] },
  { id: "OLVR01", nombre: "Olivar 01", alias: ["de la Torre", "TG01"] },
];
const p = (texto) => ({ rol: "prospecto", texto });

test("lo nombra por su nombre comercial", () => {
  assert.equal(detectarProyecto([p("vi San Antonio 01 en instagram")], CAT)?.nombre, "San Antonio 01");
});

test("lo nombra por un alias", () => {
  assert.equal(detectarProyecto([p("me interesa del Castillo")], CAT)?.nombre, "San Antonio 02");
  assert.equal(detectarProyecto([p("el de la torre, el de Olivar")], CAT)?.nombre, "Olivar 01");
});

test("sin tildes ni mayúsculas, como escribe la gente por WhatsApp", () => {
  assert.equal(detectarProyecto([p("vi el de san antonio 02")], CAT)?.nombre, "San Antonio 02");
});

test("si no nombró ninguno, no inventa", () => {
  assert.equal(detectarProyecto([p("hola, me interesa un depa")], CAT), null);
});

test("lo que nombra Mica no cuenta — el interés es del prospecto", () => {
  assert.equal(detectarProyecto([{ rol: "mica", texto: "tenemos San Antonio 01" }], CAT), null);
});

test("si nombró dos, manda el último — es hacia donde derivó la conversación", () => {
  const ms = [p("vi San Antonio 01"), p("en realidad me gusta más Olivar 01")];
  assert.equal(detectarProyecto(ms, CAT)?.nombre, "Olivar 01");
});
