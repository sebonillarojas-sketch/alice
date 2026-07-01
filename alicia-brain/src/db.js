import { DatabaseSync } from "node:sqlite";
import dotenv from "dotenv";
dotenv.config();

const MODE = process.env.DB_MODE || "sqlite";
const path = process.env.SQLITE_PATH || "./alicia.db";

let _db = null;

function getDB() {
  if (_db) return _db;
  _db = new DatabaseSync(path);
  _db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
  return _db;
}

export function query(sql, params = []) {
  if (MODE === "postgres") throw new Error("PostgreSQL no soportado en esta versión — usar sqlite");
  const db = getDB();
  const p = params.map(v => v == null ? null : Array.isArray(v) || (typeof v === "object") ? JSON.stringify(v) : v);
  const upper = sql.trim().toUpperCase();
  const isSelect = upper.startsWith("SELECT") || upper.startsWith("WITH");
  try {
    if (isSelect) {
      return { rows: db.prepare(sql).all(...p) };
    }
    const info = db.prepare(sql).run(...p);
    return { rows: [], lastID: info.lastInsertRowid, changes: info.changes };
  } catch (e) {
    console.error("SQLite error:", e.message, "\nSQL:", sql.slice(0, 100));
    throw e;
  }
}

export function parseArr(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try { return JSON.parse(val); } catch { return []; }
}
