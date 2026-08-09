import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { ensureLessonsSchema } from "../src/lessons.js";

test("ensureLessonsSchema crea lessons e inserta una fila proposed", () => {
  const db = new DatabaseSync(":memory:");
  ensureLessonsSchema(db);
  db.exec(`INSERT INTO lessons (scope, source, trigger, lesson, risk_level)
           VALUES ('agent:knave','reflection','CORS abierto','revisar CSP también','L0')`);
  const row = db.prepare("SELECT status, evidence_count FROM lessons").get();
  assert.equal(row.status, "proposed");
  assert.equal(row.evidence_count, 1);
});

test("ensureLessonsSchema es idempotente", () => {
  const db = new DatabaseSync(":memory:");
  ensureLessonsSchema(db);
  ensureLessonsSchema(db);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM lessons").get().c, 0);
});
