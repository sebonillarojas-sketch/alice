import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { collectCases, buildJudgePrompt, judgeRegression, checkRegression, recentRegressionAlerts, formatRegressionAlerts } from "../src/lesson-regression.js";

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

test("collectCases: user:<x> filtra por user_id — no mezcla la conversación de otro colaborador", () => {
  const db = dbFull();
  // Alicia es un bot de equipo: `messages` mezcla filas de todos los colaboradores.
  db.prepare("INSERT INTO messages (user_id, role, content) VALUES ('otro','user','pregunta de otro colaborador')").run();
  db.prepare("INSERT INTO messages (user_id, role, content) VALUES ('otro','assistant','respuesta para otro colaborador')").run();
  db.prepare("INSERT INTO messages (user_id, role, content) VALUES ('sb','user','¿cuánto vale el terreno?')").run();
  db.prepare("INSERT INTO messages (user_id, role, content) VALUES ('sb','assistant','Unos 320 mil dólares.')").run();
  const cases = collectCases(db, "user:sb");
  assert.equal(cases.length, 1);
  assert.match(cases[0].input, /cuánto vale/);
  assert.match(cases[0].output, /320 mil/);
  assert.doesNotMatch(JSON.stringify(cases), /otro colaborador/);
});

test("collectCases: agent:alicia NO filtra por usuario — es evidencia de todo el equipo, a propósito", () => {
  const db = dbFull();
  db.prepare("INSERT INTO messages (user_id, role, content) VALUES ('sb','user','pregunta de sebastian')").run();
  db.prepare("INSERT INTO messages (user_id, role, content) VALUES ('sb','assistant','respuesta a sebastian')").run();
  db.prepare("INSERT INTO messages (user_id, role, content) VALUES ('otro','user','pregunta de otro colaborador')").run();
  db.prepare("INSERT INTO messages (user_id, role, content) VALUES ('otro','assistant','respuesta a otro colaborador')").run();
  const cases = collectCases(db, "agent:alicia");
  assert.equal(cases.length, 2);
  assert.match(JSON.stringify(cases), /sebastian/);
  assert.match(JSON.stringify(cases), /otro colaborador/);
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

import { ensureLessonsSchema } from "../src/lessons.js";

function dbAlerts() {
  const d = new DatabaseSync(":memory:");
  ensureLessonsSchema(d);
  return d;
}
// `at` (el momento del veredicto) es lo que ahora filtra la ventana — no `updated_at`.
// `ago` acá mueve el `at` del veredicto, no la fila.
function seed(db, { lesson, status, reason, scope = "agent:alicia", ago = 0 }) {
  const at = new Date(Date.now() - ago * 3600 * 1000).toISOString().slice(0, 19).replace("T", " ");
  const info = db.prepare("INSERT INTO lessons (scope, source, lesson, regression_check) VALUES (?,?,?,?)")
    .run(scope, "reflection", lesson, JSON.stringify({ status, reason, at }));
  return Number(info.lastInsertRowid);
}

test("recentRegressionAlerts: trae degrades y error, ignora pass y skipped", () => {
  const db = dbAlerts();
  seed(db, { lesson: "la frenada", status: "degrades", reason: "rompe X" });
  seed(db, { lesson: "la no verificada", status: "error", reason: "API caída" });
  seed(db, { lesson: "la buena", status: "pass", reason: "ok" });
  seed(db, { lesson: "la sin material", status: "skipped", reason: "sin material" });
  const rows = recentRegressionAlerts(db);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(r => r.status).sort(), ["degrades", "error"]);
});

test("recentRegressionAlerts: ignora lo más viejo que la ventana", () => {
  const db = dbAlerts();
  seed(db, { lesson: "vieja", status: "degrades", reason: "rompe X", ago: 48 });
  assert.equal(recentRegressionAlerts(db, { hours: 24 }).length, 0);
});

test("recentRegressionAlerts: una re-propuesta que bumpea updated_at no revive un bloqueo viejo", () => {
  // proposeLesson dedupea sobre lecciones 'proposed'/'validated' y en ese UPDATE bumpea
  // updated_at a 'ahora' sin tocar regression_check. Antes del fix, la ventana de 24h
  // filtraba por updated_at, así que este bloqueo de hace 3 días reaparecía en el
  // briefing de hoy con su motivo original.
  const db = dbAlerts();
  const id = seed(db, { lesson: "bloqueada hace 3 días", status: "degrades", reason: "rompe X", ago: 72 });
  // Simula la re-propuesta: mismo texto, mismo scope, status sigue 'validated'/'proposed'
  // → proposeLesson solo hace evidence_count++ y updated_at = datetime('now').
  db.prepare("UPDATE lessons SET updated_at = datetime('now') WHERE id = ?").run(id);
  assert.equal(recentRegressionAlerts(db, { hours: 24 }).length, 0);
});

test("recentRegressionAlerts: db sin la columna no explota", () => {
  const d = new DatabaseSync(":memory:");
  d.exec("CREATE TABLE lessons (id INTEGER PRIMARY KEY, lesson TEXT)");
  assert.deepEqual(recentRegressionAlerts(d), []);
});

test("formatRegressionAlerts: sin alertas devuelve string vacío", () => {
  assert.equal(formatRegressionAlerts([]), "");
});

test("formatRegressionAlerts: distingue la frenada de la no verificada", () => {
  const txt = formatRegressionAlerts([
    { id: 1, scope: "agent:alicia", lesson: "la frenada", status: "degrades", reason: "rompe X" },
    { id: 2, scope: "agent:cheshire", lesson: "la no verificada", status: "error", reason: "API caída" },
  ]);
  assert.match(txt, /#1/);
  assert.match(txt, /frené|freno|bloque/i);
  assert.match(txt, /#2/);
  assert.match(txt, /no pude verificar/i);
});
