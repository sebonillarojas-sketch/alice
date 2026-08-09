import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { buildWorldDigest, EMBODIMENT_BLOCK } from "../src/world.js";

function db0() {
  const d = new DatabaseSync(":memory:");
  d.exec(`CREATE TABLE agent_findings (id INTEGER PRIMARY KEY AUTOINCREMENT, agent TEXT, severity TEXT, category TEXT, detail TEXT, status TEXT, created_at TEXT DEFAULT (datetime('now')));`);
  d.exec(`CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, role TEXT, content TEXT, created_at TEXT DEFAULT (datetime('now')));`);
  d.exec(`INSERT INTO agent_findings (agent,severity,category,detail,status) VALUES ('knave','critical','cors','CORS abierto','open')`);
  d.exec(`INSERT INTO messages (user_id,role,content) VALUES ('jt','user','cuándo cobramos la valorización')`);
  return d;
}
test("EMBODIMENT_BLOCK menciona la bestia y Wonderland", () => {
  assert.match(EMBODIMENT_BLOCK, /bestia/i);
  assert.match(EMBODIMENT_BLOCK, /Wonderland/i);
});
test("digest CEO incluye Wonderland crítico + actividad del equipo", () => {
  const d = buildWorldDigest(db0(), { isCEO: true });
  assert.match(d, /CORS abierto/);
  assert.match(d, /jt|Jose/);
});
test("digest no-CEO NO incluye actividad de otros", () => {
  const d = buildWorldDigest(db0(), { isCEO: false });
  assert.doesNotMatch(d, /valorización/);
});
