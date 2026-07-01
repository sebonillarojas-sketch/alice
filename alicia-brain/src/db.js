// ── Capa de datos · node:sqlite (local) o PostgreSQL (Hackintosh) ─────────────
import dotenv from "dotenv";
dotenv.config();

const MODE = process.env.DB_MODE || "sqlite";

// ── SQLite via node:sqlite (built-in en Node 22+) ─────────────────────────────
let _sqlite = null;

async function getSQLite() {
  if (_sqlite) return _sqlite;
  const { DatabaseSync } = await import("node:sqlite");
  const path = process.env.SQLITE_PATH || "./alicia.db";
  _sqlite = new DatabaseSync(path);
  return _sqlite;
}

async function querySQL(sql, params = []) {
  const db = await getSQLite();
  // Convertir arrays a JSON string
  const p = params.map(v => Array.isArray(v) ? JSON.stringify(v) : v == null ? null : v);
  const upper = sql.trim().toUpperCase();
  const isSelect = upper.startsWith("SELECT") || upper.startsWith("WITH");
  try {
    if (isSelect) {
      const stmt = db.prepare(sql);
      const rows = stmt.all(...p);
      return { rows };
    }
    const stmt = db.prepare(sql);
    const info = stmt.run(...p);
    return { rows: [], lastID: info.lastInsertRowid, changes: info.changes };
  } catch (e) {
    console.error("SQLite error:", e.message, "\nSQL:", sql, "\nParams:", p);
    throw e;
  }
}

// ── PostgreSQL ────────────────────────────────────────────────────────────────
let pgPool = null;
async function getPG() {
  if (pgPool) return pgPool;
  const { default: pg } = await import("pg");
  pgPool = new pg.Pool({
    host: process.env.PG_HOST || "localhost",
    port: process.env.PG_PORT || 5432,
    database: process.env.PG_DATABASE || "alicia",
    user: process.env.PG_USER || "alicia",
    password: process.env.PG_PASSWORD,
  });
  return pgPool;
}

async function queryPG(sql, params = []) {
  const pool = await getPG();
  return pool.query(sql, params);
}

// ── Interfaz unificada ────────────────────────────────────────────────────────
export async function query(rawSQL, params = []) {
  if (MODE === "postgres") return queryPG(rawSQL, params);
  // PG usa $1 $2 → SQLite usa ?
  const sql = rawSQL.replace(/\$(\d+)/g, "?");
  return querySQL(sql, params);
}

export const isPostgres = MODE === "postgres";

export function parseArr(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try { return JSON.parse(val); } catch { return []; }
}
