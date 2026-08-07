import { test } from "node:test";
import assert from "node:assert/strict";

// DB efímera ANTES de importar db.js
process.env.DB_MODE = "sqlite";
process.env.SQLITE_PATH = ":memory:";
const { query } = await import("../src/db.js");
const fleet = await import("../src/fleet.js");

// query() solo devuelve .rows para SELECT/WITH → usar pragma_table_info vía SELECT.
function cols(table) {
  return query(`SELECT name FROM pragma_table_info('${table}')`).rows.map(r => r.name);
}

test("schema: scrape_jobs y workers existen con columnas esperadas", () => {
  const jobCols = cols("scrape_jobs");
  for (const c of ["id","source","status","worker_id","rows_count","error","created_at","claimed_at","finished_at"])
    assert.ok(jobCols.includes(c), `falta columna scrape_jobs.${c}`);
  const wCols = cols("workers");
  for (const c of ["worker_id","node","caps","last_seen"])
    assert.ok(wCols.includes(c), `falta columna workers.${c}`);
});

test("heartbeat registra worker y activeWorkers lo ve", () => {
  fleet.recordHeartbeat({ workerId: "mac-pro", node: "MacPro", caps: ["urbania"] });
  const active = fleet.activeWorkers(120);
  assert.ok(active.some(w => w.worker_id === "mac-pro"));
});

test("enqueue + claim + complete recorre el ciclo", () => {
  const job = fleet.enqueueJob("urbania");
  assert.equal(job.status, "pending");
  assert.ok(Number.isInteger(job.id));
  const claimed = fleet.claimJob("mac-pro");
  assert.equal(claimed.id, job.id);
  assert.equal(claimed.source, "urbania");
  const done = fleet.completeJob({ jobId: job.id, workerId: "mac-pro", rowsCount: 42 });
  assert.equal(done.status, "done");
  assert.equal(fleet.claimJob("mac-pro"), null);   // ya no hay pendientes
});

test("completeJob con error marca failed", () => {
  const job = fleet.enqueueJob("sbs");
  fleet.claimJob("mac-pro");
  const r = fleet.completeJob({ jobId: job.id, workerId: "mac-pro", rowsCount: 0, error: "challenge" });
  assert.equal(r.status, "failed");
});
