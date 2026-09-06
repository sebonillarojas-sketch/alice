import test from "node:test";
import assert from "node:assert/strict";
import { puntajeDificultad, ordenarPorDificultad } from "../src/modules/planos/dificultad.js";

const facil = { id: "A", area: 72.5, fachadas: 2, frente: 7.4, fondo: 9.8 };
const dificil = { id: "C", area: 40.3, fachadas: 1, frente: 8.4, fondo: 4.8 };
const medio = { id: "B", area: 57.2, fachadas: 2, frente: 7.4, fondo: 9.8 };

test("menos fachadas y menos area es mas dificil", () => {
  assert.ok(puntajeDificultad(dificil) > puntajeDificultad(facil));
});

test("ordena de mas dificil a mas facil", () => {
  assert.deepEqual(ordenarPorDificultad([facil, medio, dificil]).map((u) => u.id), ["C", "B", "A"]);
});

test("es estable con unidades equivalentes", () => {
  const x = { id: "X", area: 50, fachadas: 2, frente: 6, fondo: 8 };
  const y = { id: "Y", area: 50, fachadas: 2, frente: 6, fondo: 8 };
  assert.deepEqual(ordenarPorDificultad([x, y]).map((u) => u.id), ["X", "Y"]);
});
