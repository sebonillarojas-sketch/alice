// Loop de aprendizaje · motor de lecciones. Ver docs/superpowers/specs/2026-08-09-loop-aprendizaje-design.md
export function ensureLessonsSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scope TEXT NOT NULL DEFAULT 'global',
      source TEXT NOT NULL CHECK (source IN ('correction','outcome','reflection','teatable')),
      trigger TEXT,
      lesson TEXT NOT NULL,
      evidence_count INTEGER NOT NULL DEFAULT 1,
      risk_level TEXT NOT NULL DEFAULT 'L1' CHECK (risk_level IN ('L0','L1','L2','L3')),
      status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','validated','applied','rejected','retired')),
      contradicts_check TEXT,
      validated_by TEXT,
      applied_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_lessons_scope ON lessons(scope, status);
    CREATE INDEX IF NOT EXISTS idx_lessons_status ON lessons(status, risk_level);
  `);
}
