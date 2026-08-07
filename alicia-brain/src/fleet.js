// src/fleet.js — estado de la flota de scrapers (cola de jobs + workers).
// Ver docs/superpowers/specs/2026-08-06-flota-scrapers-self-hosted-design.md
// El scout (cron.js) encola jobs; los workers (Mac Pro/MacBook) los jalan vía
// /api/agents/workers/*. query() solo devuelve .rows en SELECT/WITH → los INSERT
// usan lastID, no RETURNING.
import { query } from "./db.js";

export function recordHeartbeat({ workerId, node = null, caps = [] }) {
  query(
    `INSERT INTO workers (worker_id, node, caps, last_seen) VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(worker_id) DO UPDATE SET node = excluded.node, caps = excluded.caps, last_seen = datetime('now')`,
    [workerId, node, JSON.stringify(caps)]
  );
  return { ok: true };
}

export function activeWorkers(withinSec = 120) {
  return query(
    `SELECT worker_id, node, caps, last_seen FROM workers
      WHERE last_seen >= datetime('now', ?) ORDER BY last_seen DESC`,
    [`-${Number(withinSec)} seconds`]
  ).rows;
}

export function enqueueJob(source) {
  const { lastID } = query(
    `INSERT INTO scrape_jobs (source, status) VALUES (?, 'pending')`,
    [source]
  );
  return { id: Number(lastID), source, status: "pending" };
}

export function claimJob(workerId) {
  const { rows } = query(
    `SELECT id, source FROM scrape_jobs WHERE status = 'pending' ORDER BY created_at, id LIMIT 1`
  );
  if (!rows[0]) return null;
  const job = rows[0];
  query(
    `UPDATE scrape_jobs SET status = 'claimed', worker_id = ?, claimed_at = datetime('now') WHERE id = ?`,
    [workerId, job.id]
  );
  return { id: Number(job.id), source: job.source, status: "claimed" };
}

export function completeJob({ jobId, workerId, rowsCount = 0, error = null }) {
  const status = error ? "failed" : "done";
  query(
    `UPDATE scrape_jobs SET status = ?, rows_count = ?, error = ?, finished_at = datetime('now')
      WHERE id = ? AND worker_id = ?`,
    [status, rowsCount, error, jobId, workerId]
  );
  return { ok: true, status };
}
