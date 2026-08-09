import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { ensureLessonsSchema, proposeLesson } from "../src/lessons.js";

function db0() { const d = new DatabaseSync(":memory:"); ensureLessonsSchema(d); return d; }

test("propone nueva lección", () => {
  const db = db0();
  const r = proposeLesson(db, { source: "reflection", lesson: "respuestas más cortas", risk_level: "L0" });
  assert.equal(r.created, true);
  assert.equal(r.evidence_count, 1);
});
test("lección equivalente sube evidencia en vez de duplicar", () => {
  const db = db0();
  proposeLesson(db, { source: "correction", lesson: "respuestas más cortas" });
  const r = proposeLesson(db, { source: "correction", lesson: "respuestas más cortas" });
  assert.equal(r.created, false);
  assert.equal(r.evidence_count, 2);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM lessons").get().c, 1);
});
