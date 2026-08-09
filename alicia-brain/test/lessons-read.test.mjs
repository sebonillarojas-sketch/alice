import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { ensureLessonsSchema, lessonsForScope } from "../src/lessons.js";

test("lessonsForScope trae applied del scope + global, no las proposed", () => {
  const db = new DatabaseSync(":memory:"); ensureLessonsSchema(db);
  db.exec(`INSERT INTO lessons (scope,source,lesson,status) VALUES
    ('agent:knave','reflection','chequear CSP','applied'),
    ('global','teatable','reportar en español','applied'),
    ('agent:knave','reflection','todavía no','proposed'),
    ('agent:cheshire','reflection','otra cosa','applied')`);
  const out = lessonsForScope(db, "agent:knave");
  assert.ok(out.includes("chequear CSP"));
  assert.ok(out.includes("reportar en español"));
  assert.ok(!out.includes("todavía no"));
  assert.ok(!out.includes("otra cosa"));
});
