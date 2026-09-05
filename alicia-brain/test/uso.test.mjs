import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { usoVacio, acumularUso, registrarUso } from "../src/uso.js";

test("usoVacio arranca todo en cero", () => {
  assert.deepEqual(usoVacio(), { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
});

test("acumularUso suma los cuatro contadores de una iteración", () => {
  const r = acumularUso(usoVacio(), {
    input_tokens: 10, output_tokens: 5,
    cache_read_input_tokens: 100, cache_creation_input_tokens: 7,
  });
  assert.deepEqual(r, { input: 10, output: 5, cacheRead: 100, cacheWrite: 7 });
});

test("acumularUso suma varias iteraciones", () => {
  let u = usoVacio();
  u = acumularUso(u, { input_tokens: 10, output_tokens: 5 });
  u = acumularUso(u, { input_tokens: 3, output_tokens: 2 });
  assert.equal(u.input, 13);
  assert.equal(u.output, 7);
});

test("acumularUso no explota si falta usage o vienen campos sueltos", () => {
  assert.deepEqual(acumularUso(usoVacio(), undefined), usoVacio());
  assert.deepEqual(acumularUso(usoVacio(), null), usoVacio());
  assert.equal(acumularUso(usoVacio(), { output_tokens: 4 }).output, 4);
});

test("acumularUso no muta el acumulador que recibe", () => {
  const antes = usoVacio();
  acumularUso(antes, { input_tokens: 99 });
  assert.equal(antes.input, 0);
});

test("registrarUso guarda una fila por turno", () => {
  const d = new DatabaseSync(":memory:");
  d.exec(`CREATE TABLE turn_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, channel TEXT, model TEXT,
    iterations INTEGER, input_tokens INTEGER, output_tokens INTEGER,
    cache_read_tokens INTEGER, cache_write_tokens INTEGER,
    created_at TEXT DEFAULT (datetime('now')));`);
  registrarUso(d, {
    userId: "sb", channel: "copilot", model: "claude-sonnet-4-6", iterations: 3,
    uso: { input: 10, output: 5, cacheRead: 100, cacheWrite: 7 },
  });
  const f = d.prepare("SELECT * FROM turn_usage").get();
  assert.equal(f.user_id, "sb");
  assert.equal(f.channel, "copilot");
  assert.equal(f.iterations, 3);
  assert.equal(f.cache_read_tokens, 100);
});

test("registrarUso nunca tira: la telemetría no puede tumbar un turno", () => {
  const d = new DatabaseSync(":memory:");   // sin la tabla a propósito
  assert.doesNotThrow(() => registrarUso(d, {
    userId: "sb", channel: "app", model: "x", iterations: 1, uso: usoVacio(),
  }));
});
