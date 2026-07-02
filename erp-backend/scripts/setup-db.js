import { DatabaseSync } from "node:sqlite";
import dotenv from "dotenv";
dotenv.config();

const path = process.env.SQLITE_PATH || "./alicia-erp.db";
const db = new DatabaseSync(path);
db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");

console.log("🏗️  Creando schema ALICE ERP...\n");

db.exec(`
  -- ── Espacios de trabajo ──────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS spaces (
    id         TEXT PRIMARY KEY,
    code       TEXT NOT NULL,
    name       TEXT NOT NULL,
    parent_id  TEXT REFERENCES spaces(id),
    color      TEXT,
    position   INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- ── Tareas ───────────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS tasks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    description TEXT,
    space_id    TEXT NOT NULL REFERENCES spaces(id),
    parent_id   INTEGER REFERENCES tasks(id),
    status      TEXT DEFAULT 'todo' CHECK (status IN ('todo','in_progress','review','done','cancelled')),
    priority    TEXT DEFAULT 'media' CHECK (priority IN ('urgente','alta','media','baja')),
    assignee_id TEXT,
    due_date    TEXT,
    tags        TEXT DEFAULT '[]',
    position    INTEGER DEFAULT 0,
    created_by  TEXT,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_tasks_space ON tasks(space_id, status);
  CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);

  -- ── Comentarios de tareas ────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS task_comments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id    INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id    TEXT NOT NULL,
    content    TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- ── Actividad / historial de cambios ─────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS task_activity (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id    INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id    TEXT,
    action     TEXT NOT NULL,
    from_val   TEXT,
    to_val     TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- ── Eventos / Calendario ─────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    description TEXT,
    date        TEXT NOT NULL,
    time        TEXT,
    end_time    TEXT,
    attendees   TEXT DEFAULT '[]',
    space_id    TEXT REFERENCES spaces(id),
    purpose     TEXT,
    brief       TEXT,
    created_by  TEXT,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
`);

console.log("✅ Tablas creadas");

// ── Seed: Spaces ──────────────────────────────────────────────────────────────
const insertSpace = db.prepare(`
  INSERT OR IGNORE INTO spaces (id, code, name, parent_id, color, position)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const spaces = [
  ["hq",        "HQ",   "Hygge HQ",          null,        "#0A0B0F", 0],
  ["proyectos", "PR",   "Proyectos",          null,        "#3D52D5", 1],
  ["dc01",      "DC01", "Del Castillo",       "proyectos", "#3D52D5", 0],
  ["pu01",      "PU01", "Paula Ugarriza",     "proyectos", "#3D52D5", 1],
  ["tg01",      "TG01", "De la Torre",        "proyectos", "#3D52D5", 2],
  ["l36",       "L36",  "Larco 1036",         "proyectos", "#3D52D5", 3],
  ["legendre",  "LEG",  "Legendre",           "proyectos", "#3D52D5", 4],
  ["bam",       "BM",   "BAM · Arquitectura", null,        "#A89BD9", 2],
  ["finanzas",  "FZ",   "Finanzas",           null,        "#1E2A4A", 3],
  ["legal",     "LG",   "Legal",              null,        "#C2A45A", 4],
  ["comercial", "CM",   "Comercial",          null,        "#5F8A6A", 5],
  ["marketing", "MK",   "Marketing",          null,        "#A85B5B", 6],
  ["growth",    "GR",   "Growth",             null,        "#B8C8E5", 7],
];

for (const s of spaces) insertSpace.run(...s);
console.log("✅ Spaces cargados (13 espacios)");

db.close();
console.log(`\n🟢 ALICE ERP DB lista → ${path}\n`);
