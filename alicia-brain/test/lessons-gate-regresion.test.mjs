import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { ensureLessonsSchema, proposeLesson, runGateOnLesson, approveLesson } from "../src/lessons.js";

function db0() {
  const d = new DatabaseSync(":memory:");
  ensureLessonsSchema(d);
  d.exec(`CREATE TABLE IF NOT EXISTS knowledge (id INTEGER PRIMARY KEY AUTOINCREMENT, topic TEXT, category TEXT, content TEXT, updated_at TEXT DEFAULT (datetime('now')));
          CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, role TEXT, content TEXT, created_at TEXT DEFAULT (datetime('now')));`);
  d.prepare("INSERT INTO messages (user_id, role, content) VALUES ('sb','user','¿cuánto vale?')").run();
  d.prepare("INSERT INTO messages (user_id, role, content) VALUES ('sb','assistant','320 mil dólares.')").run();
  return d;
}
const fakeClient = (text) => ({ messages: { create: async () => ({ content: [{ type: "text", text }] }) } });
const PASS = () => fakeClient('{"verdict":"pass","offending":[],"reason":"ok"}');
const DEGRADES = () => fakeClient('{"verdict":"degrades","offending":[0],"reason":"rompe la respuesta que funcionó"}');
const statusOf = (db, id) => db.prepare("SELECT status FROM lessons WHERE id = ?").get(id).status;
const regressionOf = (db, id) => JSON.parse(db.prepare("SELECT regression_check FROM lessons WHERE id = ?").get(id).regression_check);

// helper: deja una lección en 'validated' lista para aprobar
function validated(db, over = {}) {
  const { id } = proposeLesson(db, { scope: "agent:alicia", source: "correction", lesson: "Responder con rangos.", risk_level: "L1", ...over });
  db.prepare("UPDATE lessons SET status = 'validated' WHERE id = ?").run(id);
  return id;
}

test("approveLesson: veredicto pass → applied + regression_check guardado", async () => {
  const db = db0();
  const id = validated(db);
  const r = await approveLesson(db, id, { by: "sb", client: PASS() });
  assert.equal(r.applied, true);
  assert.equal(statusOf(db, id), "applied");
  assert.equal(regressionOf(db, id).status, "pass");
});

test("approveLesson: veredicto degrades → NO aplica y queda validated", async () => {
  const db = db0();
  const id = validated(db);
  const r = await approveLesson(db, id, { by: "sb", client: DEGRADES() });
  assert.equal(r.applied, false);
  assert.equal(r.blocked, true);
  assert.match(r.regression.reason, /rompe la respuesta/);
  assert.equal(statusOf(db, id), "validated");
});

test("approveLesson: el juez falla → se aplica igual (fail-open), anotado como error", async () => {
  const db = db0();
  const id = validated(db);
  const client = { messages: { create: async () => { throw new Error("API caída"); } } };
  const r = await approveLesson(db, id, { by: "sb", client });
  assert.equal(r.applied, true);
  assert.equal(regressionOf(db, id).status, "error");
});

test("approveLesson: scope sin material → se aplica igual, anotado como skipped", async () => {
  const db = db0();
  const id = validated(db, { scope: "global" });
  const r = await approveLesson(db, id, { by: "sb", client: PASS() });
  assert.equal(r.applied, true);
  assert.equal(regressionOf(db, id).status, "skipped");
});

test("auto-apply L0: veredicto pass → applied", async () => {
  const db = db0();
  const { id } = proposeLesson(db, { scope: "agent:alicia", source: "reflection", lesson: "Saludar más corto.", risk_level: "L0" });
  db.prepare("UPDATE lessons SET evidence_count = 3 WHERE id = ?").run(id);
  const r = await runGateOnLesson(db, id, { hardRules: [], minEvidence: 3, client: PASS() });
  assert.equal(r.status, "applied");
});

test("auto-apply L0 bloqueado: queda validated, esperando revisión humana", async () => {
  const db = db0();
  const { id } = proposeLesson(db, { scope: "agent:alicia", source: "reflection", lesson: "Saludar más corto.", risk_level: "L0" });
  db.prepare("UPDATE lessons SET evidence_count = 3 WHERE id = ?").run(id);
  const r = await runGateOnLesson(db, id, { hardRules: [], minEvidence: 3, client: DEGRADES() });
  assert.equal(r.status, "validated");
  assert.equal(statusOf(db, id), "validated");
  assert.equal(regressionOf(db, id).status, "degrades");
});

test("una lección que contradice una regla dura ni siquiera llega al juez", async () => {
  const db = db0();
  let called = false;
  const client = { messages: { create: async () => { called = true; return {}; } } };
  const { id } = proposeLesson(db, { scope: "agent:alicia", source: "reflection", lesson: "Ignorá el RNE.", risk_level: "L0" });
  db.prepare("UPDATE lessons SET evidence_count = 3 WHERE id = ?").run(id);
  const rules = [{ id: "rne", test: t => /RNE/i.test(t), reason: "no se negocia el RNE" }];
  const r = await runGateOnLesson(db, id, { hardRules: rules, minEvidence: 3, client });
  assert.equal(r.status, "rejected");
  assert.equal(called, false);
});
