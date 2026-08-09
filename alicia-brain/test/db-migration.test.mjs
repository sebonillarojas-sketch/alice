// Verifica que la migración quita el CHECK-enum de agent_runs.agent
// para que cualquier agente (incl. 'knave') pueda insertar.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { migrateDropAgentEnum } from "../src/db.js";

// DB temporal con el esquema VIEJO (con el enum que NO incluye knave)
function legacyDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE agent_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent TEXT NOT NULL CHECK (agent IN ('white-rabbit','cheshire','bandersnatch','mad-hatter','jabberwocky','dark-alice','tea-table')),
    started_at TEXT DEFAULT (datetime('now')), finished_at TEXT,
    result TEXT DEFAULT 'ok' CHECK (result IN ('ok','issues','error')),
    summary TEXT, actions_taken TEXT DEFAULT '[]', report TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );`);
  db.exec(`INSERT INTO agent_runs (agent, result, summary) VALUES ('white-rabbit','ok','fila previa');`);
  return db;
}

test("antes de migrar: insertar 'knave' falla por el CHECK", () => {
  const db = legacyDb();
  assert.throws(() => db.exec("INSERT INTO agent_runs (agent,result) VALUES ('knave','ok')"));
});

test("después de migrar: insertar 'knave' funciona y se conservan las filas", () => {
  const db = legacyDb();
  migrateDropAgentEnum(db);
  db.exec("INSERT INTO agent_runs (agent,result,summary) VALUES ('knave','ok','hola knave')");
  const rows = db.prepare("SELECT agent FROM agent_runs ORDER BY id").all();
  assert.deepEqual(rows.map(r => r.agent), ["white-rabbit", "knave"]);
});

test("migración idempotente: correrla dos veces no rompe ni duplica", () => {
  const db = legacyDb();
  migrateDropAgentEnum(db);
  migrateDropAgentEnum(db);
  const n = db.prepare("SELECT COUNT(*) c FROM agent_runs").get().c;
  assert.equal(n, 1);
});
