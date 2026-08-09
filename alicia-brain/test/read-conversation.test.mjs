import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readConversation } from "../src/tools.js";

function db0() {
  const d = new DatabaseSync(":memory:");
  d.exec(`CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, role TEXT, content TEXT, channel TEXT, created_at TEXT DEFAULT (datetime('now')));`);
  d.exec(`INSERT INTO messages (user_id,role,content) VALUES ('jt','user','hola'),('jt','assistant','buenas Jose'),('vd','user','otra persona')`);
  return d;
}
test("readConversation trae solo los mensajes de esa persona, cronológico", () => {
  const rows = readConversation(db0(), "jt", 20);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].content, "hola");
  assert.equal(rows[1].role, "assistant");
});
test("readConversation respeta el limit", () => {
  assert.equal(readConversation(db0(), "jt", 1).length, 1);
});
