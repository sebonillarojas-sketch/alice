// Loop de aprendizaje · motor de lecciones. Ver docs/superpowers/specs/2026-08-09-loop-aprendizaje-design.md
import { resolveRiskLevel } from "./risk-levels.js";

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
  // Veredicto de la capa 4 del gate (no-regresión). Espejo de contradicts_check, que
  // guarda el de la capa 1. Migración con el patrón del repo (ver db.js:153).
  try { db.exec("ALTER TABLE lessons ADD COLUMN regression_check TEXT"); } catch {}
}

export function checkContradictsHardRules(lessonText, hardRules = []) {
  for (const rule of hardRules) {
    try { if (rule.test(lessonText)) return { contradicts: true, reason: rule.reason || rule.id }; } catch {}
  }
  return { contradicts: false, reason: null };
}

export function evaluateGate(lesson, { minEvidence = 3 } = {}) {
  if (lesson.contradicts) return { decision: "reject", reason: "contradice una regla dura" };
  if ((lesson.evidence_count || 0) < minEvidence) return { decision: "hold", reason: `evidencia insuficiente (<${minEvidence})` };
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
  // El nivel que pide la fuente es una solicitud, no una decisión: acá es el único
  // embudo por el que pasan las cinco señales, así que el guard vive acá y las cubre
  // a todas. Ver risk-levels.js para el porqué.
  const level = resolveRiskLevel(risk_level, lesson);
  const info = db.prepare(
    "INSERT INTO lessons (scope, source, trigger, lesson, risk_level) VALUES (?,?,?,?,?)"
  ).run(scope, source, trigger, lesson, level);
  return { id: Number(info.lastInsertRowid), evidence_count: 1, created: true };
}

export async function runGateOnLesson(db, id, { hardRules = [], minEvidence = 3, client } = {}) {
  const row = db.prepare("SELECT * FROM lessons WHERE id = ?").get(id);
  if (!row) throw new Error(`lesson ${id} no existe`);
  const contradicts = checkContradictsHardRules(row.lesson, hardRules);
  const decision = evaluateGate({ ...row, contradicts: contradicts.contradicts }, { minEvidence }).decision;
  const check = JSON.stringify(contradicts);
  let status;
  if (decision === "reject") status = "rejected";
  else if (decision === "needs_human") status = "validated";
  else if (decision === "auto_apply") status = null; // lo resuelve promoteToApplied
  else status = "proposed"; // hold: evidencia insuficiente, se mantiene propuesta

  // El auto-apply de las L0 es el único camino a 'applied' sin humano: pasa por la
  // misma puerta que la aprobación, así la no-regresión también lo cubre.
  if (status === null) {
    const r = await promoteToApplied(db, id, { by: "auto", client });
    db.prepare("UPDATE lessons SET contradicts_check = ?, updated_at = datetime('now') WHERE id = ?").run(check, id);
    return { status: r.status, decision, reason: r.blocked ? r.regression.reason : contradicts.reason };
  }

  db.prepare(
    `UPDATE lessons SET status = ?, contradicts_check = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(status, check, id);
  return { status, decision, reason: contradicts.reason };
}

export async function runGatePass(db, { hardRules = [], minEvidence = 3, client } = {}) {
  const rows = db.prepare("SELECT id FROM lessons WHERE status = 'proposed'").all();
  const counts = { evaluated: 0, applied: 0, rejected: 0, validated: 0, blocked: 0 };
  for (const { id } of rows) {
    const { status, decision } = await runGateOnLesson(db, id, { hardRules, minEvidence, client });
    counts.evaluated++;
    if (status === "applied") counts.applied++;
    else if (status === "rejected") counts.rejected++;
    else if (status === "validated") {
      counts.validated++;
      // decision 'auto_apply' + status final 'validated' es exactamente "el juez la
      // frenó": la L0 sin bloqueo sale con status 'applied'. Sin segunda query ni
      // asumir que L0 es el único nivel que auto-aplica (evaluateGate podría cambiar).
      if (decision === "auto_apply") counts.blocked++;
    }
  }
  return counts;
}

export function lessonsForScope(db, scope) {
  const rows = db.prepare(
    "SELECT lesson FROM lessons WHERE status = 'applied' AND (scope = ? OR scope = 'global') ORDER BY updated_at DESC"
  ).all(scope);
  return rows.map(r => r.lesson);
}

export function applyLessonToBrain(db, id) {
  const row = db.prepare("SELECT * FROM lessons WHERE id = ?").get(id);
  if (!row) throw new Error(`lesson ${id} no existe`);
  const topic = `leccion #${id}`;
  const existing = db.prepare("SELECT id FROM knowledge WHERE topic = ?").get(topic);
  if (existing) {
    db.prepare("UPDATE knowledge SET content = ?, category = 'lecciones', updated_at = datetime('now') WHERE id = ?").run(row.lesson, existing.id);
  } else {
    db.prepare("INSERT INTO knowledge (topic, category, content) VALUES (?, 'lecciones', ?)").run(topic, row.lesson);
  }
  return { wrote: "knowledge" };
}

// La ÚNICA puerta hacia 'applied'. Antes había dos caminos que escribían ese estado sin
// saber uno del otro (el auto-apply L0 del gate y la aprobación humana); ahora los dos
// pasan por acá, que es lo que hace que la capa de no-regresión no tenga agujeros.
//
// Import dinámico (no estático arriba del archivo): lesson-regression.js construye el
// cliente Anthropic al cargar, y lessons.js lo importan las cinco suites del gate, que
// quedarían cargando el SDK sin necesidad. Mismo estilo que tools.js/cron.js/server.js.
export async function promoteToApplied(db, id, { by = "human", client } = {}) {
  const row = db.prepare("SELECT * FROM lessons WHERE id = ?").get(id);
  if (!row) throw new Error(`lesson ${id} no existe`);
  // Status capturado ANTES del juez: checkRegression es un round-trip a Opus, segundos
  // en los que puede llegar un reject humano, un segundo approve del mismo id, o puede
  // que la lección ya estuviera 'rejected'. Los dos UPDATE de abajo llevan
  // "AND status = ?" contra este valor, así que solo escriben si nadie tocó la fila
  // mientras el juez pensaba — eso tapa los tres casos con un único guard:
  // el veto humano nunca se pisa con un 'applied' tardío, un doble approve no aplica
  // ni escribe dos veces al cerebro, y una lección 'rejected' no puede resucitar.
  const before = row.status;
  const { checkRegression } = await import("./lesson-regression.js");
  const regression = await checkRegression(db, row, { client });

  // Solo 'degrades' frena. 'skipped' y 'error' aplican igual: fail-open a propósito —
  // una lección es texto reversible en un prompt, y un falso bloqueo traba el loop entero.
  if (regression.status === "degrades") {
    // Nunca 'rejected': el juez puede frenar una lección, no matarla. Queda 'validated'
    // para que la mire un humano (y para que el gate-pass no la re-juzgue cada madrugada).
    const w = db.prepare(
      "UPDATE lessons SET status = 'validated', regression_check = ?, updated_at = datetime('now') WHERE id = ? AND status = ?"
    ).run(JSON.stringify(regression), id, before);
    if (!w.changes) {
      // La fila cambió de status mientras el juez pensaba (stale): no pisamos nada,
      // devolvemos el status real para que el llamador sepa que no hizo falta frenarla.
      const cur = db.prepare("SELECT status FROM lessons WHERE id = ?").get(id).status;
      return { status: cur, applied: false, blocked: false, stale: true, regression };
    }
    return { status: "validated", applied: false, blocked: true, regression };
  }

  const w = db.prepare(
    "UPDATE lessons SET status = 'applied', regression_check = ?, validated_by = ?, applied_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND status = ?"
  ).run(JSON.stringify(regression), by, id, before);
  if (!w.changes) {
    const cur = db.prepare("SELECT status FROM lessons WHERE id = ?").get(id).status;
    return { status: cur, applied: false, stale: true, regression };
  }
  applyLessonToBrain(db, id);
  return { status: "applied", applied: true, regression };
}

export async function approveLesson(db, id, { by = "human", client } = {}) {
  const row = db.prepare("SELECT status FROM lessons WHERE id = ?").get(id);
  if (!row) throw new Error(`lesson ${id} no existe`);
  if (row.status === "applied") return { status: "applied", applied: false };
  // Solo se aplica lo que YA cruzó el gate (status 'validated'). Nunca un 'proposed'
  // (evidencia insuficiente) ni rejected/retired — así el endpoint abierto no puede
  // forzar la aplicación saltándose la capa de evidencia del gate.
  if (row.status !== "validated") return { status: row.status, applied: false };
  return promoteToApplied(db, id, { by, client });
}

export function rejectLesson(db, id, { by = "human" } = {}) {
  db.prepare("UPDATE lessons SET status = 'rejected', validated_by = ?, updated_at = datetime('now') WHERE id = ?").run(by, id);
  return { status: "rejected" };
}

export function formatLessonsBlock(lessons = []) {
  if (!Array.isArray(lessons) || !lessons.length) return "";
  return `\n## 🧠 Lecciones aprendidas (aplicá esto — se validaron y aprobaron)\n${lessons.map(l => `- ${l}`).join("\n")}`;
}

// ── Superficies de aprobación (Fase 3b) ──────────────────────────────────────
// Lecciones que cruzaron el gate y esperan OK humano (status 'validated').

// Para Sebastián por WhatsApp: su scope + las de Alicia + globales.
export function pendingLessonsForCEO(db) {
  return db.prepare(
    `SELECT id, scope, lesson, trigger, evidence_count, risk_level, source
       FROM lessons WHERE status = 'validated' AND scope IN ('agent:alicia','user:sb','global')
      ORDER BY updated_at DESC`
  ).all();
}

// Para el panel Tea Table: las de los Wondies (scope agent:*, EXCEPTO agent:alicia).
export function pendingLessonsForWondies(db) {
  return db.prepare(
    `SELECT id, scope, lesson, trigger, evidence_count, risk_level, source, created_at
       FROM lessons WHERE status = 'validated' AND scope LIKE 'agent:%' AND scope != 'agent:alicia'
      ORDER BY updated_at DESC`
  ).all();
}

// Bloque para el system prompt de Alicia (CEO): la lista de pendientes + la instrucción
// de traerlas UNA vez al día en batch. Vacío si no hay pendientes.
export function formatPendingBlock(rows = []) {
  if (!Array.isArray(rows) || !rows.length) return "";
  const items = rows.map(r => `- #${r.id} [${r.risk_level}] ${r.lesson}${r.trigger ? ` (${r.trigger})` : ""}`).join("\n");
  return `\n## 🧠 Pendientes de aprobar (lecciones que esperan tu OK)\n${items}\n(Si hay pendientes, traelas UNA sola vez al día, en un mismo mensaje, y ofrecé aplicarlas — usá approve_lesson/reject_lesson cuando Sebastián decida. NO las repitas en cada respuesta.)`;
}
