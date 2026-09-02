import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readThread } from "../src/history.js";

function db0() {
  const d = new DatabaseSync(":memory:");
  d.exec(`CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, role TEXT,
    content TEXT, channel TEXT DEFAULT 'app', actions TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')));`);
  d.exec(`INSERT INTO messages (user_id,role,content,channel,actions) VALUES
    ('sb','user','hola desde whatsapp','whatsapp','[]'),
    ('sb','assistant','buenas','whatsapp','[]'),
    ('sb','user','y esto desde el erp','app','[]'),
    ('sb','assistant','anotado','app','[{"type":"create_task"}]'),
    ('jt','user','soy otro','app','[]')`);
  return d;
}

test("readThread trae solo los mensajes de esa persona", () => {
  const r = readThread(db0(), "sb");
  assert.equal(r.length, 4);
  assert.ok(r.every((m) => m.content !== "soy otro"));
});

test("readThread devuelve en orden cronológico", () => {
  const r = readThread(db0(), "sb");
  assert.equal(r[0].content, "hola desde whatsapp");
  assert.equal(r[3].content, "anotado");
});

test("readThread expone el canal de cada mensaje", () => {
  const r = readThread(db0(), "sb");
  assert.equal(r[0].channel, "whatsapp");
  assert.equal(r[2].channel, "app");
});

test("readThread parsea actions y nunca devuelve el string crudo", () => {
  const r = readThread(db0(), "sb");
  assert.deepEqual(r[3].actions, [{ type: "create_task" }]);
  assert.deepEqual(r[0].actions, []);
});

test("readThread no explota con actions corrupto", () => {
  const d = db0();
  d.exec(`INSERT INTO messages (user_id,role,content,actions) VALUES ('sb','assistant','x','{roto')`);
  const r = readThread(d, "sb");
  assert.deepEqual(r[r.length - 1].actions, []);
});

test("readThread respeta el limit quedándose con los MÁS RECIENTES", () => {
  const r = readThread(db0(), "sb", 2);
  assert.equal(r.length, 2);
  assert.equal(r[0].content, "y esto desde el erp");
  assert.equal(r[1].content, "anotado");
});

test("readThread con un usuario sin mensajes devuelve lista vacía", () => {
  assert.deepEqual(readThread(db0(), "nadie"), []);
});
