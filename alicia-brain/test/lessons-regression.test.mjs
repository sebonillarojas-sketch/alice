import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { collectCases, buildJudgePrompt } from "../src/lesson-regression.js";

// db con las tablas de las que sale el material de contraste
function dbFull() {
  const d = new DatabaseSync(":memory:");
  d.exec(`CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, role TEXT, content TEXT, created_at TEXT DEFAULT (datetime('now')));
          CREATE TABLE agent_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, agent TEXT, result TEXT, summary TEXT, report TEXT, created_at TEXT DEFAULT (datetime('now')));
          CREATE TABLE agent_findings (id INTEGER PRIMARY KEY AUTOINCREMENT, agent TEXT, severity TEXT, category TEXT, detail TEXT, status TEXT, created_at TEXT DEFAULT (datetime('now')));`);
  return d;
}

// db "pelada": la que arman las suites del gate. No tiene messages ni agent_runs.
const dbBare = () => new DatabaseSync(":memory:");

test("collectCases: scope de Alicia arma pares user→assistant de messages", () => {
  const db = dbFull();
  db.prepare("INSERT INTO messages (user_id, role, content) VALUES ('sb','user','¿cuánto vale el terreno?')").run();
  db.prepare("INSERT INTO messages (user_id, role, content) VALUES ('sb','assistant','Unos 320 mil dólares.')").run();
  const cases = collectCases(db, "agent:alicia");
  assert.equal(cases.length, 1);
  assert.match(cases[0].input, /cuánto vale/);
  assert.match(cases[0].output, /320 mil/);
});

test("collectCases: scope user:sb usa la misma fuente que agent:alicia", () => {
  const db = dbFull();
  db.prepare("INSERT INTO messages (user_id, role, content) VALUES ('sb','user','hola')").run();
  db.prepare("INSERT INTO messages (user_id, role, content) VALUES ('sb','assistant','hola, ¿en qué te ayudo?')").run();
  assert.equal(collectCases(db, "user:sb").length, 1);
});

test("collectCases: scope de un Wondie sale de agent_runs + findings", () => {
  const db = dbFull();
  db.prepare("INSERT INTO agent_runs (agent, result, summary) VALUES ('cheshire','issues','2 bugs de login')").run();
  db.prepare("INSERT INTO agent_findings (agent, severity, category, detail, status) VALUES ('cheshire','major','ux','el botón no responde','open')").run();
  const cases = collectCases(db, "agent:cheshire");
  assert.ok(cases.length >= 1);
  assert.match(JSON.stringify(cases), /login|botón/);
});

test("collectCases: scope global no tiene material → []", () => {
  assert.deepEqual(collectCases(dbFull(), "global"), []);
});

test("collectCases: agente sin actividad → []", () => {
  assert.deepEqual(collectCases(dbFull(), "agent:knave"), []);
});

test("collectCases: db sin las tablas NO explota, devuelve []", () => {
  assert.deepEqual(collectCases(dbBare(), "agent:alicia"), []);
  assert.deepEqual(collectCases(dbBare(), "agent:cheshire"), []);
});

test("collectCases: respeta el limit", () => {
  const db = dbFull();
  for (let i = 0; i < 20; i++) {
    db.prepare("INSERT INTO messages (user_id, role, content) VALUES ('sb','user',?)").run(`pregunta ${i}`);
    db.prepare("INSERT INTO messages (user_id, role, content) VALUES ('sb','assistant',?)").run(`respuesta ${i}`);
  }
  assert.equal(collectCases(db, "agent:alicia", { limit: 3 }).length, 3);
});

test("buildJudgePrompt: el prompt lleva la lección y todos los casos", () => {
  const cases = [{ input: "¿cuánto vale?", output: "320 mil" }, { input: "¿y el otro?", output: "280 mil" }];
  const { system, user } = buildJudgePrompt("Siempre responder con un rango, nunca un número exacto.", cases);
  assert.match(system, /juez|evaluá|evalua/i);
  assert.match(user, /rango, nunca un número exacto/);
  assert.match(user, /320 mil/);
  assert.match(user, /280 mil/);
});

test("buildJudgePrompt: pide JSON con las claves del veredicto", () => {
  const { system } = buildJudgePrompt("una lección", [{ input: "a", output: "b" }]);
  assert.match(system, /verdict/);
  assert.match(system, /pass/);
  assert.match(system, /degrades/);
});
