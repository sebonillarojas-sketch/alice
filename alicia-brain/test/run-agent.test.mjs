import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { classifyAgentRun, enqueueRequest, claimPending, markRequest } from "../src/agent-requests.js";
import { drainRequests } from "../scripts/bestia-runner.js";

function freshDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE agent_run_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT, agent TEXT NOT NULL, requested_by TEXT,
    status TEXT NOT NULL DEFAULT 'pending', note TEXT,
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));`);
  return db;
}

test("classifyAgentRun: inline vs queue vs desconocido", () => {
  assert.equal(classifyAgentRun("white-rabbit").mode, "inline");
  assert.equal(classifyAgentRun("dark-alice").mode, "inline");
  assert.equal(classifyAgentRun("cheshire").mode, "queue");
  assert.equal(classifyAgentRun("cheshire").script, "cheshire.js");
  assert.equal(classifyAgentRun("knave").mode, "queue");
  assert.equal(classifyAgentRun("nadie"), null);
});

test("enqueue/claim/mark: claim marca running y no re-devuelve; markRequest persiste", () => {
  const db = freshDb();
  enqueueRequest(db, "cheshire", "sb");
  enqueueRequest(db, "knave", "sb");
  const first = claimPending(db);
  assert.equal(first.length, 2);
  assert.deepEqual(first.map(r => r.agent).sort(), ["cheshire", "knave"]);
  // Segundo claim: ya no hay pendientes
  assert.equal(claimPending(db).length, 0);
  markRequest(db, first[0].id, "done");
  const row = db.prepare("SELECT status FROM agent_run_requests WHERE id = ?").get(first[0].id);
  assert.equal(row.status, "done");
});

test("drainRequests: dado 1 pedido de cheshire → spawnea cheshire.js y postea /done", async () => {
  process.env.AGENTS_API_KEY = "test-key";
  const spawned = [];
  const posted = [];
  const fetchImpl = async (url, opts) => {
    if (url.endsWith("/run-requests")) {
      return { ok: true, json: async () => ({ requests: [{ id: 7, agent: "cheshire" }] }) };
    }
    posted.push({ url, body: JSON.parse(opts.body) });
    return { ok: true, json: async () => ({}) };
  };
  const spawn = async (job) => { spawned.push(job); };
  const n = await drainRequests({ fetchImpl, spawn });
  assert.equal(n, 1);
  assert.equal(spawned.length, 1);
  assert.equal(spawned[0].script, "cheshire.js");
  assert.equal(posted.length, 1);
  assert.match(posted[0].url, /\/run-requests\/7\/done$/);
  assert.equal(posted[0].body.status, "done");
  delete process.env.AGENTS_API_KEY;
});

test("drainRequests: sin pedidos → no spawnea", async () => {
  process.env.AGENTS_API_KEY = "test-key";
  let spawnCalls = 0;
  const fetchImpl = async (url) => url.endsWith("/run-requests")
    ? { ok: true, json: async () => ({ requests: [] }) }
    : { ok: true, json: async () => ({}) };
  await drainRequests({ fetchImpl, spawn: async () => { spawnCalls++; } });
  assert.equal(spawnCalls, 0);
  delete process.env.AGENTS_API_KEY;
});

test("drainRequests: sin AGENTS_API_KEY no hace nada (no pega al brain)", async () => {
  delete process.env.AGENTS_API_KEY;
  let fetched = false;
  await drainRequests({ fetchImpl: async () => { fetched = true; return { ok: true, json: async () => ({}) }; }, spawn: async () => {} });
  assert.equal(fetched, false);
});
