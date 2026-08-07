import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";

process.env.DB_MODE = "sqlite";
process.env.SQLITE_PATH = ":memory:";
process.env.AGENTS_API_KEY = "test-key";

const { fleetRouter } = await import("../src/fleet-routes.js");
const fleet = await import("../src/fleet.js");

let server, base;
before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/agents/workers", fleetRouter());
  server = app.listen(0);
  await new Promise(r => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}/api/agents/workers`;
});
after(() => server?.close());

const H = { "content-type": "application/json", "x-agent-key": "test-key" };

test("heartbeat → next → result recorre el protocolo", async () => {
  let r = await fetch(`${base}/heartbeat`, { method: "POST", headers: H, body: JSON.stringify({ workerId: "mac-pro", node: "MacPro", caps: ["urbania"] }) });
  assert.equal((await r.json()).ok, true);

  const job = fleet.enqueueJob("urbania");
  r = await fetch(`${base}/next?workerId=mac-pro`, { headers: H });
  const { job: got } = await r.json();
  assert.equal(got.id, job.id);

  r = await fetch(`${base}/result`, { method: "POST", headers: H, body: JSON.stringify({ jobId: job.id, workerId: "mac-pro", source: "urbania", rows: [{ distrito: "Miraflores", price: 100 }] }) });
  assert.equal((await r.json()).status, "done");
});

test("sin x-agent-key → 401", async () => {
  const r = await fetch(`${base}/heartbeat`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal(r.status, 401);
});
