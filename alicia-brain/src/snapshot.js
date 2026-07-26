// Clon-stack 🪞 — snapshot consistente + sanitizado del alicia.db de prod.
import Database from "better-sqlite3";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sanitizeDb } from "./sanitize.js";

const DB_PATH = process.env.SQLITE_PATH || "/data/alicia.db";

export async function makeSnapshot() {
  const out = join(tmpdir(), `alice-snapshot-${process.pid}-${Math.random().toString(36).slice(2)}.db`);
  const src = new Database(DB_PATH, { readonly: true });
  try { src.exec(`VACUUM INTO '${out.replace(/'/g, "''")}'`); } finally { src.close(); }
  const copy = new Database(out);
  try { sanitizeDb(copy); copy.exec("VACUUM"); } finally { copy.close(); }
  return out;
}
