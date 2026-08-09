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

export function checkContradictsHardRules(lessonText, hardRules = []) {
  for (const rule of hardRules) {
    try { if (rule.test(lessonText)) return { contradicts: true, reason: rule.reason || rule.id }; } catch {}
  }
  return { contradicts: false, reason: null };
}

export function evaluateGate(lesson, { minEvidence = 3 } = {}) {
  if (lesson.contradicts) return { decision: "reject", reason: "contradice una regla dura" };
  if ((lesson.evidence_count || 0) < minEvidence) return { decision: "needs_human", reason: `evidencia insuficiente (<${minEvidence})` };
  if (lesson.risk_level === "L0") return { decision: "auto_apply", reason: "L0 de bajo riesgo con evidencia" };
  return { decision: "needs_human", reason: `riesgo ${lesson.risk_level} requiere aprobación humana` };
}

export function proposeLesson(db, { scope = "global", source, trigger = null, lesson, risk_level = "L1" }) {
  const existing = db.prepare(
    "SELECT id, evidence_count FROM lessons WHERE scope = ? AND lesson = ? AND status IN ('proposed','validated')"
  ).get(scope, lesson);
  if (existing) {
    const n = existing.evidence_count + 1;
    db.prepare("UPDATE lessons SET evidence_count = ?, updated_at = datetime('now') WHERE id = ?").run(n, existing.id);
    return { id: existing.id, evidence_count: n, created: false };
  }
  const info = db.prepare(
    "INSERT INTO lessons (scope, source, trigger, lesson, risk_level) VALUES (?,?,?,?,?)"
  ).run(scope, source, trigger, lesson, risk_level);
  return { id: Number(info.lastInsertRowid), evidence_count: 1, created: true };
}
