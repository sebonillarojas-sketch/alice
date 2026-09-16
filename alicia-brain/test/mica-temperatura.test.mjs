import { test } from "node:test";
import assert from "node:assert/strict";
import { clasificar } from "../src/mica/temperatura.js";

const dicho = (texto) => ({ rol: "prospecto", texto });

test("un saludo suelto es frío", () => {
  assert.equal(clasificar([dicho("Hola")]).temperatura, "frio");
});

test("pedir planos es señal directa de hot", () => {
  const r = clasificar([dicho("Me podrían enviar los planos y el precio de los departamentos?")]);
  assert.equal(r.temperatura, "hot");
});

test("preguntar por el precio, solo, también es hot", () => {
  assert.equal(clasificar([dicho("cuánto cuesta el de 2 dormitorios?")]).temperatura, "hot");
});

test("interés sin pedido concreto es tibio", () => {
  assert.equal(clasificar([dicho("me interesa, estoy buscando algo de unos 80 m2")]).temperatura, "tibio");
});

test("la temperatura guarda la frase textual que la causó — sin evidencia no hay dato", () => {
  const frase = "Me podrían enviar los planos?";
  assert.equal(clasificar([dicho("Hola"), dicho(frase)]).evidencia, frase);
});

test("lo que dice Mica nunca sube la temperatura — solo cuenta lo que dice el prospecto", () => {
  const r = clasificar([{ rol: "mica", texto: "¿Te comparto los planos y el precio?" }]);
  assert.equal(r.temperatura, "frio");
});
