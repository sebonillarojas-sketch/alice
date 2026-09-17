import { test } from "node:test";
import assert from "node:assert/strict";
import { validarCitas, extraerPersona } from "../src/mica/persona.js";

const HILO = [
  { rol: "prospecto", texto: "hola, buscamos con mi pareja algo para mudarnos el próximo año" },
  { rol: "mica", texto: "¿Qué te gusta más, una sala amplia o más espacio en las habitaciones?" },
  { rol: "prospecto", texto: "más espacio en las habitaciones, somos 2 y viene un bebé" },
];

test("un dato cuya cita NO está en la conversación se descarta entero", () => {
  const sucio = {
    hogar: { valor: "pareja + bebé", cita: "somos 2 y viene un bebé" },
    plazo: { valor: "6 meses", cita: "necesito mudarme en junio" },   // nunca lo dijo
  };
  const limpio = validarCitas(sucio, HILO);
  assert.ok(limpio.hogar, "la cita real sobrevive");
  assert.equal(limpio.plazo, undefined, "la cita inventada se cae");
});

test("solo cuentan las citas del prospecto — lo que dijo Mica no es evidencia", () => {
  const sucio = { prioridad: { valor: "habitaciones", cita: "¿Qué te gusta más, una sala amplia o más espacio en las habitaciones?" } };
  assert.equal(validarCitas(sucio, HILO).prioridad, undefined);
});

test("la cita se compara sin importar tildes, mayúsculas ni puntuación", () => {
  const sucio = { hogar: { valor: "pareja", cita: "Somos 2 y viene un bebe." } };
  assert.ok(validarCitas(sucio, HILO).hogar, "una diferencia de tildes no puede tirar un dato bueno");
});

test("un campo sin cita no entra — sin evidencia no hay dato", () => {
  assert.equal(validarCitas({ motivacion: { valor: "primera vivienda" } }, HILO).motivacion, undefined);
  assert.equal(validarCitas({ motivacion: { valor: "primera vivienda", cita: "" } }, HILO).motivacion, undefined);
});

test("si el modelo devuelve basura en vez de JSON, no se rompe: devuelve vacío", async () => {
  const p = await extraerPersona({ mensajes: HILO, llm: async () => "perdón, no entendí" });
  assert.deepEqual(p, {});
});

test("el extractor pasa por el mismo filtro de citas que todo lo demás", async () => {
  const p = await extraerPersona({
    mensajes: HILO,
    llm: async () => JSON.stringify({
      hogar: { valor: "pareja + bebé en camino", cita: "somos 2 y viene un bebé" },
      metraje: { min: 120, max: 140, cita: "queremos 120 m2 mínimo" },   // inventado
    }),
  });
  assert.ok(p.hogar);
  assert.equal(p.metraje, undefined);
});
