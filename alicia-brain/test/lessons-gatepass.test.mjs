import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { ensureLessonsSchema, proposeLesson, runGatePass } from "../src/lessons.js";
import { HARD_RULES } from "../src/hard-rules.js";

test("runGatePass evalúa todas las proposed y cuenta resultados", async () => {
  const db = new DatabaseSync(":memory:");
  ensureLessonsSchema(db);
  // El auto-apply L0 (via promoteToApplied) escribe a `knowledge`.
  db.exec("CREATE TABLE knowledge (id INTEGER PRIMARY KEY AUTOINCREMENT, topic TEXT, category TEXT, content TEXT, updated_at TEXT DEFAULT (datetime('now')))");
  // L0 con evidencia → applied
  const a = proposeLesson(db, { source: "reflection", lesson: "menos emojis", risk_level: "L0" });
  db.prepare("UPDATE lessons SET evidence_count = 3 WHERE id = ?").run(a.id);
  // contradice regla dura → rejected
  const b = proposeLesson(db, { source: "reflection", lesson: "desactivar el auth gate", risk_level: "L0" });
  db.prepare("UPDATE lessons SET evidence_count = 9 WHERE id = ?").run(b.id);
  // L2 con evidencia → validated
  const c = proposeLesson(db, { source: "correction", lesson: "cambiar flujo de tareas", risk_level: "L2" });
  db.prepare("UPDATE lessons SET evidence_count = 5 WHERE id = ?").run(c.id);
  const r = await runGatePass(db, { hardRules: HARD_RULES, minEvidence: 3 });
  assert.equal(r.evaluated, 3);
  assert.equal(r.applied, 1);
  assert.equal(r.rejected, 1);
  assert.equal(r.validated, 1);
});
