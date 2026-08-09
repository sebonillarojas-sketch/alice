import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { ensureLessonsSchema, approveLesson, rejectLesson } from "../src/lessons.js";

function db0() {
  const d = new DatabaseSync(":memory:");
  d.exec("CREATE TABLE knowledge (id INTEGER PRIMARY KEY AUTOINCREMENT, topic TEXT, category TEXT, content TEXT, updated_at TEXT DEFAULT (datetime('now')))");
  ensureLessonsSchema(d);
  return d;
}

test("approveLesson: validated → applied + escribe al knowledge", () => {
  const db = db0();
  const id = Number(db.prepare("INSERT INTO lessons (scope,source,lesson,status,risk_level) VALUES ('global','teatable','responder en español','validated','L1')").run().lastInsertRowid);
  const r = approveLesson(db, id, { by: "sb" });
  assert.equal(r.status, "applied");
  assert.equal(r.applied, true);
  assert.equal(db.prepare("SELECT status, validated_by FROM lessons WHERE id=?").get(id).validated_by, "sb");
  assert.equal(db.prepare("SELECT content FROM knowledge").get().content, "responder en español");
});

test("approveLesson idempotente sobre applied", () => {
  const db = db0();
  const id = Number(db.prepare("INSERT INTO lessons (scope,source,lesson,status) VALUES ('global','teatable','x','applied')").run().lastInsertRowid);
  const r = approveLesson(db, id, {});
  assert.equal(r.applied, false);
});

test("rejectLesson → rejected", () => {
  const db = db0();
  const id = Number(db.prepare("INSERT INTO lessons (scope,source,lesson,status) VALUES ('global','teatable','mala idea','validated')").run().lastInsertRowid);
  assert.equal(rejectLesson(db, id, { by: "sb" }).status, "rejected");
});
