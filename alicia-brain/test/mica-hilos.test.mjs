import { test } from "node:test";
import assert from "node:assert/strict";
import { abrirHilos, guardar, hilo, estado, marcarHandoff } from "../src/mica/hilos.js";

const nueva = () => abrirHilos(":memory:");

test("el hilo vuelve en orden cronológico, no al revés", () => {
  const db = nueva();
  guardar(db, "+51999", "prospecto", "hola");
  guardar(db, "+51999", "mica", "qué bueno que escribas");
  guardar(db, "+51999", "prospecto", "busco un dúplex");
  assert.deepEqual(hilo(db, "+51999").map(m => m.texto), ["hola", "qué bueno que escribas", "busco un dúplex"]);
});

test("dos prospectos distintos no se mezclan nunca", () => {
  const db = nueva();
  guardar(db, "+51111", "prospecto", "soy el primero");
  guardar(db, "+51222", "prospecto", "soy el segundo");
  assert.deepEqual(hilo(db, "+51111").map(m => m.texto), ["soy el primero"]);
  assert.deepEqual(hilo(db, "+51222").map(m => m.texto), ["soy el segundo"]);
});

test("con el límite se recortan los viejos, no los nuevos", () => {
  const db = nueva();
  for (let i = 1; i <= 30; i++) guardar(db, "+51999", "prospecto", `msg ${i}`);
  const ultimos = hilo(db, "+51999", 5).map(m => m.texto);
  assert.deepEqual(ultimos, ["msg 26", "msg 27", "msg 28", "msg 29", "msg 30"]);
});

test("un prospecto nuevo arranca sin etapa y sin combos usados", () => {
  const db = nueva();
  const e = estado(db, "+51999");
  assert.equal(e.etapa, null);
  assert.deepEqual(e.combosUsados, []);
});

test("después del handoff queda la etapa y el combo, para no repetir la misma plantilla", () => {
  const db = nueva();
  marcarHandoff(db, "+51999", "226");
  marcarHandoff(db, "+51999", "97");
  const e = estado(db, "+51999");
  assert.equal(e.etapa, "handoff");
  assert.deepEqual(e.combosUsados, ["226", "97"]);
});

test("el hilo sobrevive a cerrar y reabrir la base — un reinicio no borra la conversación", () => {
  const path = `/tmp/mica-test-${process.pid}.db`;
  const db1 = abrirHilos(path);
  guardar(db1, "+51999", "prospecto", "hola");
  db1.close();
  const db2 = abrirHilos(path);
  assert.deepEqual(hilo(db2, "+51999").map(m => m.texto), ["hola"]);
  db2.close();
});
