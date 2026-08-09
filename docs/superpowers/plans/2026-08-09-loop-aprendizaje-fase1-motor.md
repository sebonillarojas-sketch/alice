# Loop de aprendizaje · Fase 1 — Motor de lecciones + gate · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) o superpowers:executing-plans. Steps con checkbox (`- [ ]`).

**Goal:** Construir el motor agnóstico de agente del loop: la tabla `lessons`, la lógica pura del gate duro (contradice-reglas / evidencia / niveles), y las funciones proponer/promover/aplicar/leer. Sin cablear señales ni superficies todavía.

**Architecture:** Un módulo nuevo `alicia-brain/src/lessons.js` con lógica pura testeable (gate) + acceso a la tabla `lessons` (vía `query()` de `db.js`). Las lecciones fluyen `proposed → validated → applied|rejected`. Aplicar = escribir al cerebro existente (`knowledge`/`user_personas`/`skills`). Leer = traer las `applied` por scope para inyectar al arrancar un agente.

**Tech Stack:** Node ESM, `node:sqlite` (`DatabaseSync`), `node:test` + `node:assert/strict`. Mismos patrones que `src/db.js` / `scripts/knave-checks.js`.

## Global Constraints

- Node ESM, sin TypeScript, imports con `.js`.
- DB: `node:sqlite`. Migraciones idempotentes en `initSchema` (patrón `try { db.exec("ALTER...") } catch {}`), o `CREATE TABLE IF NOT EXISTS`.
- Tests: `node:test` + `node:assert/strict`, `test/*.test.mjs`, corridos con `node --test test/<archivo>.test.mjs`.
- `status ∈ {proposed, validated, applied, rejected, retired}`; `risk_level ∈ {L0,L1,L2,L3}`; `source ∈ {correction, outcome, reflection, teatable}`.
- Invariante: una lección que **contradice una regla dura** termina `rejected` SIEMPRE, aunque tenga evidencia.
- Trabajar en worktree `feat/learning-loop`. No mergear a main hasta aprobación.

---

### Task 1: Tabla `lessons` + índices

**Files:** Modify `alicia-brain/src/db.js` (dentro de `initSchema`, junto a las otras `CREATE TABLE`). Test `alicia-brain/test/lessons-schema.test.mjs`.

**Interfaces:**
- Produces: tabla `lessons` con las columnas del spec; función `ensureLessonsSchema(db)` idempotente exportada.

- [ ] **Step 1: Test que falla**

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { ensureLessonsSchema } from "../src/lessons.js";

test("ensureLessonsSchema crea lessons e inserta una fila proposed", () => {
  const db = new DatabaseSync(":memory:");
  ensureLessonsSchema(db);
  db.exec(`INSERT INTO lessons (scope, source, trigger, lesson, risk_level)
           VALUES ('agent:knave','reflection','CORS abierto','revisar CSP también','L0')`);
  const row = db.prepare("SELECT status, evidence_count FROM lessons").get();
  assert.equal(row.status, "proposed");
  assert.equal(row.evidence_count, 1);
});

test("ensureLessonsSchema es idempotente", () => {
  const db = new DatabaseSync(":memory:");
  ensureLessonsSchema(db);
  ensureLessonsSchema(db);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM lessons").get().c, 0);
});
```

- [ ] **Step 2: Correr → falla** (`cd alicia-brain && node --test test/lessons-schema.test.mjs`) — `lessons.js` no existe.

- [ ] **Step 3: Crear `src/lessons.js` con `ensureLessonsSchema`**

```javascript
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
```

- [ ] **Step 4: Correr → pasa.**

- [ ] **Step 5: Llamar `ensureLessonsSchema(db)` desde `initSchema` de `db.js`** (importarla arriba y llamarla en el bloque de migraciones idempotentes).

- [ ] **Step 6: Commit** — `git add alicia-brain/src/lessons.js alicia-brain/src/db.js alicia-brain/test/lessons-schema.test.mjs && git commit -m "feat(loop): tabla lessons + ensureLessonsSchema"`

---

### Task 2: Gate — lógica pura (contradice-reglas + evidencia + niveles)

**Files:** Modify `alicia-brain/src/lessons.js`. Test `alicia-brain/test/lessons-gate.test.mjs`.

**Interfaces:**
- Produces:
  - `checkContradictsHardRules(lesson, hardRules) => { contradicts: boolean, reason: string|null }` — puro. `hardRules` = array de `{ id, test: (lessonText) => boolean, reason }`. Si algún `test` da true → contradice.
  - `evaluateGate(lesson, { minEvidence = 3 }) => { decision: 'reject'|'needs_human'|'auto_apply', reason }` — puro. Reglas: si `lesson.contradicts` → `reject`; si `evidence_count < minEvidence` → `needs_human` (con razón "poca evidencia", no aplica aún); si `risk_level === 'L0'` → `auto_apply`; si `L1|L2` → `needs_human`; si `L3` → `needs_human` (nunca auto).

- [ ] **Step 1: Test que falla**

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkContradictsHardRules, evaluateGate } from "../src/lessons.js";

const RULES = [{ id: "no-autoridad", test: t => /borrar.*sin confirmar|force.?push/i.test(t), reason: "viola límites de autoridad" }];

test("contradice regla dura → contradicts true", () => {
  const r = checkContradictsHardRules("hacer force-push a main", RULES);
  assert.equal(r.contradicts, true);
  assert.match(r.reason, /autoridad/);
});
test("no contradice → false", () => {
  assert.equal(checkContradictsHardRules("saludar más corto", RULES).contradicts, false);
});
test("gate: contradice → reject", () => {
  assert.equal(evaluateGate({ contradicts: true, evidence_count: 9, risk_level: "L0" }, {}).decision, "reject");
});
test("gate: L0 con evidencia → auto_apply", () => {
  assert.equal(evaluateGate({ contradicts: false, evidence_count: 3, risk_level: "L0" }, { minEvidence: 3 }).decision, "auto_apply");
});
test("gate: poca evidencia → needs_human", () => {
  assert.equal(evaluateGate({ contradicts: false, evidence_count: 1, risk_level: "L0" }, { minEvidence: 3 }).decision, "needs_human");
});
test("gate: L2 con evidencia → needs_human", () => {
  assert.equal(evaluateGate({ contradicts: false, evidence_count: 5, risk_level: "L2" }, { minEvidence: 3 }).decision, "needs_human");
});
```

- [ ] **Step 2: Correr → falla.**

- [ ] **Step 3: Implementar en `src/lessons.js`**

```javascript
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
```

- [ ] **Step 4: Correr → pasa.**

- [ ] **Step 5: Commit** — `feat(loop): gate puro (contradice-reglas + evidencia + niveles)`

---

### Task 3: `proposeLesson` + dedup por evidencia

**Files:** Modify `alicia-brain/src/lessons.js`. Test `alicia-brain/test/lessons-propose.test.mjs`.

**Interfaces:**
- Consumes: `ensureLessonsSchema`.
- Produces: `proposeLesson(db, { scope='global', source, trigger, lesson, risk_level='L1' }) => { id, evidence_count, created }` — si ya existe una lección con el mismo `scope`+`lesson` en estado `proposed|validated`, incrementa `evidence_count` y devuelve `created:false`; si no, inserta `proposed` y devuelve `created:true`.

- [ ] **Step 1: Test que falla**

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { ensureLessonsSchema, proposeLesson } from "../src/lessons.js";

function db0() { const d = new DatabaseSync(":memory:"); ensureLessonsSchema(d); return d; }

test("propone nueva lección", () => {
  const db = db0();
  const r = proposeLesson(db, { source: "reflection", lesson: "respuestas más cortas", risk_level: "L0" });
  assert.equal(r.created, true);
  assert.equal(r.evidence_count, 1);
});
test("lección equivalente sube evidencia en vez de duplicar", () => {
  const db = db0();
  proposeLesson(db, { source: "correction", lesson: "respuestas más cortas" });
  const r = proposeLesson(db, { source: "correction", lesson: "respuestas más cortas" });
  assert.equal(r.created, false);
  assert.equal(r.evidence_count, 2);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM lessons").get().c, 1);
});
```

- [ ] **Step 2: Correr → falla.**

- [ ] **Step 3: Implementar**

```javascript
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
```

- [ ] **Step 4: Correr → pasa.**

- [ ] **Step 5: Commit** — `feat(loop): proposeLesson con dedup por evidencia`

---

### Task 4: `runGateOnLesson` — corre el gate y actualiza estado

**Files:** Modify `alicia-brain/src/lessons.js`. Test `alicia-brain/test/lessons-rungate.test.mjs`.

**Interfaces:**
- Consumes: `checkContradictsHardRules`, `evaluateGate`, `proposeLesson`.
- Produces: `runGateOnLesson(db, id, { hardRules = [], minEvidence = 3 }) => { status, decision, reason }` — carga la lección, corre `checkContradictsHardRules` sobre su texto, computa `evaluateGate`, y persiste: `reject` → `status='rejected'` (guardando `contradicts_check`); `auto_apply` → `status='applied'`, `applied_at=now`, `validated_by='auto'`; `needs_human` → `status='validated'` (queda esperando aprobación en su superficie). Devuelve el resultado.

- [ ] **Step 1: Test que falla**

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { ensureLessonsSchema, proposeLesson, runGateOnLesson } from "../src/lessons.js";

const RULES = [{ id: "seg", test: t => /desactivar.*auth|abrir cors/i.test(t), reason: "seguridad" }];
function db0() { const d = new DatabaseSync(":memory:"); ensureLessonsSchema(d); return d; }

test("L0 con evidencia suficiente → applied", () => {
  const db = db0();
  const { id } = proposeLesson(db, { source: "reflection", lesson: "usar menos emojis", risk_level: "L0" });
  db.prepare("UPDATE lessons SET evidence_count = 3 WHERE id = ?").run(id);
  const r = runGateOnLesson(db, id, { hardRules: RULES, minEvidence: 3 });
  assert.equal(r.status, "applied");
});
test("contradice regla dura → rejected aunque haya evidencia", () => {
  const db = db0();
  const { id } = proposeLesson(db, { source: "reflection", lesson: "abrir CORS para todos", risk_level: "L0" });
  db.prepare("UPDATE lessons SET evidence_count = 9 WHERE id = ?").run(id);
  const r = runGateOnLesson(db, id, { hardRules: RULES, minEvidence: 3 });
  assert.equal(r.status, "rejected");
});
test("L2 → validated (espera humano)", () => {
  const db = db0();
  const { id } = proposeLesson(db, { source: "correction", lesson: "reasignar tareas viejas solas", risk_level: "L2" });
  db.prepare("UPDATE lessons SET evidence_count = 5 WHERE id = ?").run(id);
  const r = runGateOnLesson(db, id, { hardRules: RULES, minEvidence: 3 });
  assert.equal(r.status, "validated");
});
```

- [ ] **Step 2: Correr → falla.**

- [ ] **Step 3: Implementar**

```javascript
export function runGateOnLesson(db, id, { hardRules = [], minEvidence = 3 } = {}) {
  const row = db.prepare("SELECT * FROM lessons WHERE id = ?").get(id);
  if (!row) throw new Error(`lesson ${id} no existe`);
  const contradicts = checkContradictsHardRules(row.lesson, hardRules);
  const decision = evaluateGate({ ...row, contradicts: contradicts.contradicts }, { minEvidence }).decision;
  const check = JSON.stringify(contradicts);
  let status;
  if (decision === "reject") status = "rejected";
  else if (decision === "auto_apply") status = "applied";
  else status = "validated";
  db.prepare(
    `UPDATE lessons SET status = ?, contradicts_check = ?,
       applied_at = CASE WHEN ? = 'applied' THEN datetime('now') ELSE applied_at END,
       validated_by = CASE WHEN ? = 'applied' THEN 'auto' ELSE validated_by END,
       updated_at = datetime('now') WHERE id = ?`
  ).run(status, check, status, status, id);
  return { status, decision, reason: contradicts.reason };
}
```

- [ ] **Step 4: Correr → pasa.**

- [ ] **Step 5: Commit** — `feat(loop): runGateOnLesson (persiste reject/applied/validated)`

---

### Task 5: `lessonsForScope` — leer lecciones aplicadas para inyectar al arrancar

**Files:** Modify `alicia-brain/src/lessons.js`. Test `alicia-brain/test/lessons-read.test.mjs`.

**Interfaces:**
- Produces: `lessonsForScope(db, scope) => string[]` — devuelve los textos de las lecciones `applied` cuyo `scope` sea exactamente `scope` **o** `'global'`, ordenadas por `updated_at DESC`. Para que un agente inyecte "esto ya lo aprendí" a su contexto.

- [ ] **Step 1: Test que falla**

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { ensureLessonsSchema, lessonsForScope } from "../src/lessons.js";

test("lessonsForScope trae applied del scope + global, no las proposed", () => {
  const db = new DatabaseSync(":memory:"); ensureLessonsSchema(db);
  db.exec(`INSERT INTO lessons (scope,source,lesson,status) VALUES
    ('agent:knave','reflection','chequear CSP','applied'),
    ('global','teatable','reportar en español','applied'),
    ('agent:knave','reflection','todavía no','proposed'),
    ('agent:cheshire','reflection','otra cosa','applied')`);
  const out = lessonsForScope(db, "agent:knave");
  assert.ok(out.includes("chequear CSP"));
  assert.ok(out.includes("reportar en español"));
  assert.ok(!out.includes("todavía no"));
  assert.ok(!out.includes("otra cosa"));
});
```

- [ ] **Step 2: Correr → falla.**

- [ ] **Step 3: Implementar**

```javascript
export function lessonsForScope(db, scope) {
  const rows = db.prepare(
    "SELECT lesson FROM lessons WHERE status = 'applied' AND (scope = ? OR scope = 'global') ORDER BY updated_at DESC"
  ).all(scope);
  return rows.map(r => r.lesson);
}
```

- [ ] **Step 4: Correr → pasa.**

- [ ] **Step 5: Commit** — `feat(loop): lessonsForScope para inyección al arrancar`

---

### Task 6: `applyLessonToBrain` — escribir la lección aplicada al cerebro existente

**Files:** Modify `alicia-brain/src/lessons.js`. Test `alicia-brain/test/lessons-apply.test.mjs`.

**Interfaces:**
- Consumes: la tabla `knowledge` de `db.js` (columnas `topic, category, content, updated_at`).
- Produces: `applyLessonToBrain(db, id) => { wrote: 'knowledge' }` — cuando una lección pasó a `applied`, refleja su texto en el cerebro legible: inserta/actualiza una fila en `knowledge` con `category='lecciones'`, `topic = 'leccion #<id>'`, `content = <lesson>`. (Punto único de escritura al cerebro en Fase 1; la aplicación específica por agente —persona/skills/catálogos— es Fase 3.)

- [ ] **Step 1: Test que falla**

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { ensureLessonsSchema, applyLessonToBrain } from "../src/lessons.js";

test("applyLessonToBrain escribe la lección en knowledge", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE knowledge (id INTEGER PRIMARY KEY AUTOINCREMENT, topic TEXT, category TEXT, content TEXT, updated_at TEXT DEFAULT (datetime('now')));`);
  ensureLessonsSchema(db);
  const info = db.prepare("INSERT INTO lessons (scope,source,lesson,status) VALUES ('global','teatable','responder en español','applied')").run();
  const id = Number(info.lastInsertRowid);
  const r = applyLessonToBrain(db, id);
  assert.equal(r.wrote, "knowledge");
  const k = db.prepare("SELECT topic, category, content FROM knowledge").get();
  assert.equal(k.category, "lecciones");
  assert.equal(k.content, "responder en español");
});
```

- [ ] **Step 2: Correr → falla.**

- [ ] **Step 3: Implementar**

```javascript
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
```

- [ ] **Step 4: Correr → pasa.**

- [ ] **Step 5: Commit** — `feat(loop): applyLessonToBrain escribe al knowledge legible`

---

### Task 7: Verificación integral de la Fase 1

- [ ] **Step 1: Suite completa** — `cd alicia-brain && node --test test/lessons-schema.test.mjs test/lessons-gate.test.mjs test/lessons-propose.test.mjs test/lessons-rungate.test.mjs test/lessons-read.test.mjs test/lessons-apply.test.mjs` → todos pasan.
- [ ] **Step 2: Flujo end-to-end en memoria (script de humo)** — proponer la misma lección L0 3×, correr el gate → `applied`, `applyLessonToBrain`, y `lessonsForScope` la trae. Documentar salida en el commit.
- [ ] **Step 3: Sin regresión** — correr `node --test test/*.test.mjs` (toda la suite de alicia-brain) → verde.
- [ ] **Step 4: Commit** de cualquier ajuste.

## Self-Review

- Tabla `lessons` (spec §1) → Task 1. ✅
- Gate 4 capas: contradice-reglas + evidencia + niveles → Tasks 2/4. ⚠️ La 4ª capa (**no-regresión**) NO está en Fase 1 (es específica por agente: Bammy re-corre estudios, Cheshire su suite) → va en Fase 3 con la aplicación por agente. Documentado como límite de fase.
- Captura de 4 señales (spec §2) → **Fase 2** (cablear correcciones/outcome/reflection/teatable a `proposeLesson`). Fuera de Fase 1.
- Aplicación al cerebro (spec §4) → Task 6 (versión mínima: `knowledge`). La aplicación específica (persona/skills/catálogos) → Fase 3.
- Lectura al arrancar (spec §4) → Task 5.
- Superficies humanas (spec §5) → **Fase 3** (Taller/Tea Table/WhatsApp).
- Placeholder scan: sin TBD; el único "a definir" (N por nivel) tiene default explícito (3).
- Type consistency: `checkContradictsHardRules`/`evaluateGate`/`proposeLesson`/`runGateOnLesson`/`lessonsForScope`/`applyLessonToBrain` consistentes entre tasks. ✅

## Fases siguientes (planes follow-on, no en este plan)
- **Fase 2 — Captura:** cablear las 4 señales a `proposeLesson` (correcciones del Taller/WhatsApp/findings; outcome; reflexión por agente; síntesis Tea Table) + corrida periódica que llama `runGateOnLesson` sobre las `proposed`.
- **Fase 3 — Superficies + aplicación por agente:** aprobación en Taller (Bammy) / Tea Table (Wondies) / WhatsApp (Alicia); aplicación específica (persona/skills/catálogos) + capa no-regresión; inyección real de `lessonsForScope` al system prompt de cada agente; espejo en `brainsync.js`.
