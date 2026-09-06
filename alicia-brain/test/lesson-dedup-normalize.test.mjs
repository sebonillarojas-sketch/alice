import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize } from "../src/lesson-dedup.js";

test("normalize: saca el markdown", () => {
  assert.equal(normalize("**Un agente que no corre**"), normalize("Un agente que no corre"));
  assert.equal(normalize("_cursiva_ y `código`"), normalize("cursiva y código"));
  assert.equal(normalize("- viñeta suelta"), normalize("viñeta suelta"));
});

test("normalize: los números se vuelven comodín", () => {
  // El caso del Tea Table: lo único que cambia es el contador.
  assert.equal(
    normalize("Cheshire lleva 20 días sin actividad"),
    normalize("Cheshire lleva 34 días sin actividad"),
  );
});

test("normalize: ignora tildes, mayúsculas y espacios de más", () => {
  assert.equal(normalize("Verificá   el  FETCH"), normalize("verifica el fetch"));
});

test("normalize: ignora la puntuación del final", () => {
  assert.equal(normalize("es un punto ciego."), normalize("es un punto ciego"));
});

test("normalize: NO junta cosas que dicen algo distinto", () => {
  assert.notEqual(
    normalize("Cheshire lleva 20 días sin actividad"),
    normalize("Cheshire lleva 27 días inactivo en UX"),
  );
  assert.notEqual(normalize("poner terraza al frente"), normalize("poner cocina al fondo"));
});

test("normalize: entradas raras no explotan", () => {
  assert.equal(normalize(""), "");
  assert.equal(normalize(null), "");
  assert.equal(normalize(undefined), "");
});
