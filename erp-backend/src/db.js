import { DatabaseSync } from "node:sqlite";
import dotenv from "dotenv";
dotenv.config();

const path = process.env.SQLITE_PATH || "./alicia-erp.db";
let _db = null;

export function getDB() {
  if (_db) return _db;
  _db = new DatabaseSync(path);
  _db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
  return _db;
}

export function query(sql, params = []) {
  const db = getDB();
  const p = params.map(v => v == null ? null : Array.isArray(v) || typeof v === "object" ? JSON.stringify(v) : v);
  const upper = sql.trim().toUpperCase();
  const isSelect = upper.startsWith("SELECT") || upper.startsWith("WITH");
  if (isSelect) {
    return { rows: db.prepare(sql).all(...p) };
  }
  const info = db.prepare(sql).run(...p);
  return { rows: [], lastID: info.lastInsertRowid, changes: info.changes };
}

export function parseArr(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try { return JSON.parse(val); } catch { return []; }
}
