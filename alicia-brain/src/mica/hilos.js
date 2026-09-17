// Los hilos de WhatsApp de Mica. Uno por teléfono, en SQLite.
// node:sqlite es síncrono: todo lo de acá es atómico dentro del event loop y no
// necesita locks — el mismo patrón que usa el brain (ver src/db.js).
import { DatabaseSync } from "node:sqlite";

export function abrirHilos(path = ":memory:") {
  const db = new DatabaseSync(path);
  if (path !== ":memory:") db.exec("PRAGMA journal_mode=WAL;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS wa_mensajes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telefono TEXT NOT NULL,
      rol TEXT NOT NULL CHECK (rol IN ('prospecto','mica')),
      texto TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_wa_tel ON wa_mensajes(telefono, id);
    CREATE TABLE IF NOT EXISTS wa_estado (
      telefono TEXT PRIMARY KEY,
      etapa TEXT,
      nombre TEXT,
      combos TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
  return db;
}

export function guardar(db, telefono, rol, texto) {
  db.prepare("INSERT INTO wa_mensajes (telefono, rol, texto) VALUES (?, ?, ?)").run(telefono, rol, texto);
}

// Los últimos `limite`, devueltos en orden cronológico: se recorta lo viejo, no lo nuevo.
export function hilo(db, telefono, limite = 20) {
  return db.prepare(
    "SELECT rol, texto FROM wa_mensajes WHERE telefono = ? ORDER BY id DESC LIMIT ?"
  ).all(telefono, limite).reverse();
}

export function estado(db, telefono) {
  const r = db.prepare("SELECT etapa, nombre, combos FROM wa_estado WHERE telefono = ?").get(telefono);
  if (!r) return { etapa: null, nombre: null, combosUsados: [] };
  let combos = [];
  try { combos = JSON.parse(r.combos); } catch {}
  return { etapa: r.etapa, nombre: r.nombre, combosUsados: combos };
}

export function marcarHandoff(db, telefono, combo) {
  const prev = estado(db, telefono);
  const combos = JSON.stringify([...prev.combosUsados, combo]);
  db.prepare(`
    INSERT INTO wa_estado (telefono, etapa, combos) VALUES (?, 'handoff', ?)
    ON CONFLICT(telefono) DO UPDATE SET etapa = 'handoff', combos = excluded.combos, updated_at = datetime('now')
  `).run(telefono, combos);
}
