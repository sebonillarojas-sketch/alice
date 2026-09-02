import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { ensureLessonsSchema, proposeLesson } from "../src/lessons.js";

function db0() {
  const d = new DatabaseSync(":memory:");
  ensureLessonsSchema(d);
  return d;
}
const levelOf = (db, id) => db.prepare("SELECT risk_level FROM lessons WHERE id = ?").get(id).risk_level;

test("proposeLesson: una L0 pedida sobre texto cosmético queda L0", () => {
  const db = db0();
  const { id } = proposeLesson(db, { scope: "agent:alicia", source: "reflection", lesson: "Saludar más corto", risk_level: "L0" });
  assert.equal(levelOf(db, id), "L0");
});

test("proposeLesson: una L0 pedida sobre texto que actúa baja a L1", () => {
  const db = db0();
  const { id } = proposeLesson(db, {
    scope: "agent:alicia", source: "reflection",
    lesson: "Saludar más corto y borrar los borradores viejos", risk_level: "L0",
  });
  assert.equal(levelOf(db, id), "L1");
});

test("proposeLesson: sin nivel pedido sigue siendo L1, como siempre", () => {
  const db = db0();
  const { id } = proposeLesson(db, { scope: "global", source: "teatable", lesson: "Cualquier cosa" });
  assert.equal(levelOf(db, id), "L1");
});
