import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { ensureLessonsSchema, proposeLesson, runGateOnLesson } from "../src/lessons.js";

const RULES = [{ id: "seg", test: t => /desactivar.*auth|abrir cors/i.test(t), reason: "seguridad" }];
function db0() { const d = new DatabaseSync(":memory:"); ensureLessonsSchema(d); return d; }

test("L0 con evidencia suficiente → applied", () => {
  const db = db0();
  const { id } = proposeLesson(db, { source: "reflection", lesson: "usar menos emojis", risk_level: "L0" });
  db.prepare("UPDATE lessons SET evidence_count = 3 WHERE id = ?").run(id);
  const r = runGateOnLesson(db, id, { hardRules: RULES, minEvidence: 3 });
  assert.equal(r.status, "applied");
});
test("contradice regla dura → rejected aunque haya evidencia", () => {
  const db = db0();
  const { id } = proposeLesson(db, { source: "reflection", lesson: "abrir CORS para todos", risk_level: "L0" });
  db.prepare("UPDATE lessons SET evidence_count = 9 WHERE id = ?").run(id);
  const r = runGateOnLesson(db, id, { hardRules: RULES, minEvidence: 3 });
  assert.equal(r.status, "rejected");
});
test("L2 → validated (espera humano)", () => {
  const db = db0();
  const { id } = proposeLesson(db, { source: "correction", lesson: "reasignar tareas viejas solas", risk_level: "L2" });
  db.prepare("UPDATE lessons SET evidence_count = 5 WHERE id = ?").run(id);
  const r = runGateOnLesson(db, id, { hardRules: RULES, minEvidence: 3 });
  assert.equal(r.status, "validated");
});
