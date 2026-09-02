import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { collectCases, buildJudgePrompt, judgeRegression, checkRegression } from "../src/lesson-regression.js";

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

// Cliente falso, mismo patrón que reflection.test.mjs:15
const fakeClient = (text) => ({ messages: { create: async () => ({ content: [{ type: "text", text }] }) } });
const boomClient = () => ({ messages: { create: async () => { throw new Error("API caída"); } } });

function dbWithChat() {
  const db = dbFull();
  db.prepare("INSERT INTO messages (user_id, role, content) VALUES ('sb','user','¿cuánto vale?')").run();
  db.prepare("INSERT INTO messages (user_id, role, content) VALUES ('sb','assistant','320 mil dólares.')").run();
  return db;
}
const row = (over = {}) => ({ scope: "agent:alicia", lesson: "Responder con rangos.", ...over });

test("judgeRegression: parsea el JSON del juez", async () => {
  const client = fakeClient('{"verdict":"degrades","offending":[0],"reason":"pisa el número exacto que pidió"}');
  const r = await judgeRegression("una lección", [{ input: "a", output: "b" }], { client });
  assert.equal(r.verdict, "degrades");
  assert.deepEqual(r.offending, [0]);
  assert.match(r.reason, /número exacto/);
});

test("judgeRegression: tolera el JSON envuelto en markdown", async () => {
  const client = fakeClient('```json\n{"verdict":"pass","offending":[],"reason":"no aplica"}\n```');
  const r = await judgeRegression("una lección", [{ input: "a", output: "b" }], { client });
  assert.equal(r.verdict, "pass");
});

test("checkRegression: pass → status pass", async () => {
  const client = fakeClient('{"verdict":"pass","offending":[],"reason":"ninguno empeora"}');
  const v = await checkRegression(dbWithChat(), row(), { client });
  assert.equal(v.status, "pass");
  assert.equal(v.cases_seen, 1);
  assert.equal(v.model, "claude-opus-5");
  assert.ok(v.at);
});

test("checkRegression: degrades → status degrades con el motivo del juez", async () => {
  const client = fakeClient('{"verdict":"degrades","offending":[0],"reason":"contradice la respuesta que funcionó"}');
  const v = await checkRegression(dbWithChat(), row(), { client });
  assert.equal(v.status, "degrades");
  assert.match(v.reason, /contradice/);
});

test("checkRegression: sin casos → skipped y NO llama al modelo", async () => {
  let called = false;
  const client = { messages: { create: async () => { called = true; return {}; } } };
  const v = await checkRegression(dbFull(), row({ scope: "global" }), { client });
  assert.equal(v.status, "skipped");
  assert.equal(v.cases_seen, 0);
  assert.equal(called, false);
});

test("checkRegression: el juez falla → error, no explota", async () => {
  const v = await checkRegression(dbWithChat(), row(), { client: boomClient() });
  assert.equal(v.status, "error");
  assert.match(v.reason, /API caída/);
});

test("checkRegression: respuesta ilegible del juez → error", async () => {
  const v = await checkRegression(dbWithChat(), row(), { client: fakeClient("no soy JSON") });
  assert.equal(v.status, "error");
});

test("checkRegression: LESSON_REGRESSION=off saltea y no llama al modelo", async () => {
  let called = false;
  const client = { messages: { create: async () => { called = true; return {}; } } };
  process.env.LESSON_REGRESSION = "off";
  try {
    const v = await checkRegression(dbWithChat(), row(), { client });
    assert.equal(v.status, "skipped");
    assert.match(v.reason, /desactivada/);
    assert.equal(called, false);
  } finally {
    delete process.env.LESSON_REGRESSION;
  }
});
