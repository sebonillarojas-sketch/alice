import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { ensureLessonsSchema, proposeLesson, runGateOnLesson } from "../src/lessons.js";

const RULES = [{ id: "seg", test: t => /desactivar.*auth|abrir cors/i.test(t), reason: "seguridad" }];
function db0() {
  const d = new DatabaseSync(":memory:");
  // El auto-apply L0 (via promoteToApplied) escribe a `knowledge`.
  d.exec("CREATE TABLE knowledge (id INTEGER PRIMARY KEY AUTOINCREMENT, topic TEXT, category TEXT, content TEXT, updated_at TEXT DEFAULT (datetime('now')))");
  ensureLessonsSchema(d);
  return d;
}

test("L0 con evidencia suficiente → applied", async () => {
  const db = db0();
  const { id } = proposeLesson(db, { source: "reflection", lesson: "usar menos emojis", risk_level: "L0" });
  db.prepare("UPDATE lessons SET evidence_count = 3 WHERE id = ?").run(id);
  const r = await runGateOnLesson(db, id, { hardRules: RULES, minEvidence: 3 });
  assert.equal(r.status, "applied");
});
test("contradice regla dura → rejected aunque haya evidencia", async () => {
  const db = db0();
  const { id } = proposeLesson(db, { source: "reflection", lesson: "abrir CORS para todos", risk_level: "L0" });
  db.prepare("UPDATE lessons SET evidence_count = 9 WHERE id = ?").run(id);
  const r = await runGateOnLesson(db, id, { hardRules: RULES, minEvidence: 3 });
  assert.equal(r.status, "rejected");
});
test("L2 → validated (espera humano)", async () => {
  const db = db0();
  const { id } = proposeLesson(db, { source: "correction", lesson: "reasignar tareas viejas solas", risk_level: "L2" });
  db.prepare("UPDATE lessons SET evidence_count = 5 WHERE id = ?").run(id);
  const r = await runGateOnLesson(db, id, { hardRules: RULES, minEvidence: 3 });
  assert.equal(r.status, "validated");
});
test("evidencia insuficiente → se mantiene proposed (hold)", async () => {
  const db = db0();
  const { id } = proposeLesson(db, { source: "reflection", lesson: "usar tono más formal", risk_level: "L0" });
  // evidence_count queda en 1 (default), por debajo de minEvidence
  const r = await runGateOnLesson(db, id, { hardRules: RULES, minEvidence: 3 });
  assert.equal(r.decision, "hold");
  assert.equal(r.status, "proposed");
  const row = db.prepare("SELECT status FROM lessons WHERE id = ?").get(id);
  assert.equal(row.status, "proposed");
});
