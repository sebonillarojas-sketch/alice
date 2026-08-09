import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { ensureLessonsSchema, proposeLesson, runGateOnLesson, pendingLessonsForCEO, pendingLessonsForWondies, formatPendingBlock } from "../src/lessons.js";

// Siembra lecciones en varios scopes, todas con evidencia suficiente y riesgo L1
// (→ el gate las deja 'validated', esperando humano).
function seededDb() {
  const db = new DatabaseSync(":memory:");
  ensureLessonsSchema(db);
  const mk = (scope, lesson) => {
    let id;
    for (let i = 0; i < 3; i++) id = proposeLesson(db, { scope, source: "correction", lesson, risk_level: "L1" }).id;
    runGateOnLesson(db, id, { hardRules: [], minEvidence: 3 }); // → validated (L1 con evidencia)
    return id;
  };
  mk("agent:alicia", "Saludá por el nombre");
  mk("user:sb", "A Sebastián dale el número directo");
  mk("global", "No prometas fechas sin confirmar");
  mk("agent:cheshire", "Revisá el login sin feedback");
  mk("agent:knave", "Chequeá headers CSP");
  return db;
}

test("pendingLessonsForCEO: incluye alicia/user:sb/global, NO los agentes wondie", () => {
  const rows = pendingLessonsForCEO(seededDb());
  const scopes = rows.map(r => r.scope).sort();
  assert.deepEqual(scopes, ["agent:alicia", "global", "user:sb"]);
});

test("pendingLessonsForWondies: incluye agent:* MENOS alicia", () => {
  const rows = pendingLessonsForWondies(seededDb());
  const scopes = rows.map(r => r.scope).sort();
  assert.deepEqual(scopes, ["agent:cheshire", "agent:knave"]);
  assert.ok(!scopes.includes("agent:alicia"));
});

test("pendingLessonsForCEO: solo 'validated' (una applied no aparece)", () => {
  const db = seededDb();
  const before = pendingLessonsForCEO(db).length;
  const id = pendingLessonsForCEO(db)[0].id;
  db.prepare("UPDATE lessons SET status='applied' WHERE id=?").run(id);
  assert.equal(pendingLessonsForCEO(db).length, before - 1);
});

test("formatPendingBlock: vacío → ''; con filas → #id + instrucción batch", () => {
  assert.equal(formatPendingBlock([]), "");
  const block = formatPendingBlock([{ id: 7, risk_level: "L1", lesson: "Saludá cálido", trigger: "corrección" }]);
  assert.match(block, /#7/);
  assert.match(block, /Saludá cálido/);
  assert.match(block, /UNA sola vez al día/i);
});
