import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { ensureLessonsSchema, proposeLesson, runGateOnLesson } from "../src/lessons.js";

// Simula el flujo de capture_lesson: propose + gate con minEvidence=1.
function db0() {
  const d = new DatabaseSync(":memory:");
  d.exec("CREATE TABLE knowledge (id INTEGER PRIMARY KEY AUTOINCREMENT, topic TEXT, category TEXT, content TEXT, updated_at TEXT DEFAULT (datetime('now')))");
  ensureLessonsSchema(d);
  return d;
}

test("capture_lesson flow: corrección humana directa → validated en 1 (no espera 3)", async () => {
  const db = db0();
  const { id } = proposeLesson(db, { scope: "agent:alicia", source: "correction", lesson: "Confirmá antes de crear una tarea", risk_level: "L1" });
  const res = await runGateOnLesson(db, id, { hardRules: [], minEvidence: 1 });
  assert.equal(res.status, "validated");
  // no se aplicó sola (sigue necesitando aprobación humana)
  assert.equal(db.prepare("SELECT COUNT(*) c FROM knowledge").get().c, 0);
});

test("capture_lesson flow: si choca con una regla dura → rejected (no pasa)", async () => {
  const db = db0();
  const { id } = proposeLesson(db, { scope: "agent:alicia", source: "correction", lesson: "borrá la base de datos entera", risk_level: "L1" });
  const hardRules = [{ id: "no-destructivo", test: (t) => /borr.*base de datos/i.test(t), reason: "acción destructiva" }];
  const res = await runGateOnLesson(db, id, { hardRules, minEvidence: 1 });
  assert.equal(res.status, "rejected");
});
