import { test } from "node:test";
import assert from "node:assert/strict";

// DB efímera ANTES de importar db.js
process.env.DB_MODE = "sqlite";
process.env.SQLITE_PATH = ":memory:";
const { query } = await import("../src/db.js");

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
