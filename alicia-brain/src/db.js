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
  initSchema(_db);
  return _db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      user_id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT, phone TEXT,
      projects TEXT DEFAULT '[]', skills_current TEXT DEFAULT '[]',
      skills_developing TEXT DEFAULT '[]', skills_explore TEXT DEFAULT '[]',
      growth_short TEXT, growth_long TEXT, growth_notes TEXT, work_style TEXT,
      strengths TEXT DEFAULT '[]', opportunities TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user','assistant')),
      content TEXT NOT NULL, channel TEXT DEFAULT 'app', wa_msg_id TEXT,
      actions TEXT DEFAULT '[]', created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL,
      content TEXT NOT NULL, category TEXT DEFAULT 'general', importance INTEGER DEFAULT 3,
      source_msg_id INTEGER, created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id, importance DESC, created_at DESC);
    CREATE TABLE IF NOT EXISTS knowledge (
      id INTEGER PRIMARY KEY AUTOINCREMENT, topic TEXT NOT NULL,
      category TEXT NOT NULL, content TEXT NOT NULL, source TEXT,
      confidence INTEGER DEFAULT 3, created_by TEXT DEFAULT 'alicia',
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_knowledge_topic ON knowledge(topic, category);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_unique ON knowledge(topic, category);
    CREATE TABLE IF NOT EXISTS meeting_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, date TEXT,
      source TEXT DEFAULT 'upload', transcript TEXT, summary TEXT,
      decisions TEXT DEFAULT '[]', tasks_created TEXT DEFAULT '[]',
      attendees TEXT DEFAULT '[]', zoom_id TEXT, duration_min INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS market_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL DEFAULT 'nexo',
      total INTEGER DEFAULT 0,
      data TEXT NOT NULL DEFAULT '[]',
      scraped_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_market_time ON market_snapshots(scraped_at DESC);
    CREATE TABLE IF NOT EXISTS macro_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value REAL,
      period TEXT,
      label TEXT,
      source TEXT DEFAULT 'bcrp',
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS bank_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bank TEXT NOT NULL,
      product TEXT NOT NULL DEFAULT 'hipotecario',
      rate_pen REAL,
      rate_usd REAL,
      plazo INTEGER DEFAULT 20,
      source TEXT DEFAULT 'playwright',
      scraped_at TEXT DEFAULT (datetime('now')),
      UNIQUE(bank, product)
    );
    CREATE TABLE IF NOT EXISTS agent_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent TEXT NOT NULL CHECK (agent IN ('white-rabbit','cheshire','bandersnatch','mad-hatter','jabberwocky','dark-alice','tea-table')),
      started_at TEXT DEFAULT (datetime('now')),
      finished_at TEXT,
      result TEXT DEFAULT 'ok' CHECK (result IN ('ok','issues','error')),
      summary TEXT,
      actions_taken TEXT DEFAULT '[]',
      report TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_agent_runs ON agent_runs(agent, created_at DESC);
    CREATE TABLE IF NOT EXISTS agent_findings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent TEXT NOT NULL,
      run_id INTEGER,
      severity TEXT NOT NULL DEFAULT 'minor' CHECK (severity IN ('critical','major','minor','info')),
      category TEXT NOT NULL,
      detail TEXT NOT NULL,
      status TEXT DEFAULT 'open' CHECK (status IN ('open','auto-fixed','escalated','acknowledged','resolved','wont-fix')),
      resolved_by TEXT,
      resolution TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_agent_findings ON agent_findings(status, severity, created_at DESC);
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS user_personas (
      user_id TEXT PRIMARY KEY,
      style TEXT,
      focus TEXT,
      preferences TEXT,
      avoid TEXT,
      manual_instructions TEXT,
      sarcasm INTEGER DEFAULT 0,
      msg_count_at_update INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS user_insights (
      user_id TEXT PRIMARY KEY,
      report TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      content TEXT NOT NULL,
      created_by TEXT DEFAULT 'sb',
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
  // Migración: DBs creadas antes de que agent_runs tuviera columna report
  try { db.exec("ALTER TABLE agent_runs ADD COLUMN report TEXT"); } catch {}
  try { db.exec("ALTER TABLE profiles ADD COLUMN email TEXT"); } catch {}
  try { db.exec("UPDATE profiles SET email = 'sebastian@hygge.pe' WHERE user_id = 'sb' AND (email IS NULL OR email = '')"); } catch {}
  try { db.exec("ALTER TABLE user_personas ADD COLUMN manual_instructions TEXT"); } catch {}
  try { db.exec("ALTER TABLE user_personas ADD COLUMN sarcasm INTEGER DEFAULT 0"); } catch {}
  for (const col of ["humor INTEGER DEFAULT 5", "formality INTEGER DEFAULT 5", "proactivity INTEGER DEFAULT 7", "length INTEGER DEFAULT 5", "emojis INTEGER DEFAULT 3"]) {
    try { db.exec(`ALTER TABLE user_personas ADD COLUMN ${col}`); } catch {}
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL DEFAULT 'link' CHECK (type IN ('link','connector','code','skill','nota')),
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      notes TEXT,
      created_by TEXT DEFAULT 'sb',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
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
