import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { ensureLessonsSchema, applyLessonToBrain } from "../src/lessons.js";

test("applyLessonToBrain escribe la lección en knowledge", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE knowledge (id INTEGER PRIMARY KEY AUTOINCREMENT, topic TEXT, category TEXT, content TEXT, updated_at TEXT DEFAULT (datetime('now')));`);
  ensureLessonsSchema(db);
  const info = db.prepare("INSERT INTO lessons (scope,source,lesson,status) VALUES ('global','teatable','responder en español','applied')").run();
  const id = Number(info.lastInsertRowid);
  const r = applyLessonToBrain(db, id);
  assert.equal(r.wrote, "knowledge");
  const k = db.prepare("SELECT topic, category, content FROM knowledge").get();
  assert.equal(k.category, "lecciones");
  assert.equal(k.content, "responder en español");
});
