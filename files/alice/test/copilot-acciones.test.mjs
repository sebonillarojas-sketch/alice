import { test } from "node:test";
import assert from "node:assert/strict";
import { crearBus } from "../src/copilot/acciones.js";

test("una acción registrada se ejecuta con sus argumentos", async () => {
  const bus = crearBus();
  let visto = null;
  bus.registrar("cabida.setParams", (args) => { visto = args; return "listo"; });
  assert.equal(await bus.ejecutar("cabida.setParams", { pisos: 8 }), "listo");
  assert.deepEqual(visto, { pisos: 8 });
});

test("desregistrar la saca del bus", async () => {
  const bus = crearBus();
  const fuera = bus.registrar("cabida.recalcular", () => "ok");
  fuera();
  assert.deepEqual(bus.disponibles(), []);
  await assert.rejects(() => bus.ejecutar("cabida.recalcular", {}), /no está disponible/);
});

test("una acción que no existe falla con un mensaje que nombra las que sí", async () => {
  const bus = crearBus();
  bus.registrar("cabida.setParams", () => "ok");
  await assert.rejects(() => bus.ejecutar("cabida.borrarTodo", {}), /cabida\.setParams/);
});

test("el valor de retorno siempre llega como texto", async () => {
  const bus = crearBus();
  bus.registrar("x.numero", () => 42);
  bus.registrar("x.objeto", () => ({ margen: 1240000 }));
  bus.registrar("x.nada", () => undefined);
  assert.equal(await bus.ejecutar("x.numero", {}), "42");
  assert.equal(await bus.ejecutar("x.objeto", {}), '{"margen":1240000}');
  assert.match(await bus.ejecutar("x.nada", {}), /hecho/i);
});

test("una acción async se espera", async () => {
  const bus = crearBus();
  bus.registrar("x.lenta", async () => { await new Promise(r => setTimeout(r, 10)); return "tarde pero seguro"; });
  assert.equal(await bus.ejecutar("x.lenta", {}), "tarde pero seguro");
});

test("si la acción tira, el error sube con el nombre de la acción adentro", async () => {
  const bus = crearBus();
  bus.registrar("x.rota", () => { throw new Error("terreno inválido"); });
  await assert.rejects(() => bus.ejecutar("x.rota", {}), /x\.rota.*terreno inválido/);
});

test("registrar dos veces el mismo nombre: gana el último y el desregistrar viejo no pisa al nuevo", async () => {
  // Pasa de verdad: un módulo se re-monta antes de que corra el cleanup del
  // anterior (StrictMode, o navegar rápido). Si el cleanup viejo borrara la
  // entrada nueva, la acción quedaría muerta sin que nada lo avise.
  const bus = crearBus();
  const fueraViejo = bus.registrar("cabida.setParams", () => "viejo");
  bus.registrar("cabida.setParams", () => "nuevo");
  fueraViejo();
  assert.equal(await bus.ejecutar("cabida.setParams", {}), "nuevo");
});
