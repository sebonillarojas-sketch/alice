# Loop de aprendizaje · Fase 3 (núcleo) — cierre del loop · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development. Steps con checkbox.

**Goal:** Cerrar el loop: aprobar lecciones (`validated → applied`), **inyectarlas al system prompt de Alicia** (que efectivamente cambie su comportamiento), exponer endpoints de aprobación (backbone que las superficies llaman) y espejar las lecciones aplicadas a Dropbox.

**Architecture:** `approveLesson`/`rejectLesson` en `src/lessons.js`; endpoints `/api/agents/lessons*` en `server.js`; inyección en `buildSystemPrompt` (server.js:284) vía `lessonsForScope`; mirror en `brainsync.js`. Reusa Fases 1-2.

**Tech Stack:** Node ESM, `node:sqlite`, `node:test`, Express. Reusa `src/lessons.js`.

## Global Constraints

- Node ESM `.js`; tests `node:test` `test/*.test.mjs`.
- Reusa Fase 1: `applyLessonToBrain`, `lessonsForScope`, `getDB` (exportada en Fase 2).
- Aprobar = `validated → applied` (+ `applyLessonToBrain`); rechazar = `→ rejected`. Nunca aplicar algo que no esté `validated` o `proposed` L0-auto.
- Endpoints de lessons van bajo `/api/agents/` con `requireAgentKey` (mismo gate que el resto).
- Trabajar en worktree `feat/learning-loop` (extiende PR #44). No mergear a main hasta aprobación.

---

### Task 1: `approveLesson` / `rejectLesson` (lessons.js)

**Files:** Modify `alicia-brain/src/lessons.js`. Test `alicia-brain/test/lessons-approve.test.mjs`.

**Interfaces:**
- Consumes: `applyLessonToBrain` (Fase 1).
- Produces:
  - `approveLesson(db, id, { by = "human" }) => { status, applied }` — solo si la lección está `validated` (o `proposed`): set `status='applied'`, `validated_by=by`, `applied_at=now`, y llama `applyLessonToBrain(db, id)`. Si ya está `applied` → idempotente (no re-aplica, devuelve `{status:'applied', applied:false}`). Si está `rejected`/`retired` → no hace nada, devuelve su status con `applied:false`.
  - `rejectLesson(db, id, { by = "human" }) => { status }` — set `status='rejected'`, `validated_by=by`.

- [ ] **Step 1: Test que falla**

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { ensureLessonsSchema, approveLesson, rejectLesson } from "../src/lessons.js";

function db0() {
  const d = new DatabaseSync(":memory:");
  d.exec("CREATE TABLE knowledge (id INTEGER PRIMARY KEY AUTOINCREMENT, topic TEXT, category TEXT, content TEXT, updated_at TEXT DEFAULT (datetime('now')))");
  ensureLessonsSchema(d);
  return d;
}

test("approveLesson: validated → applied + escribe al knowledge", () => {
  const db = db0();
  const id = Number(db.prepare("INSERT INTO lessons (scope,source,lesson,status,risk_level) VALUES ('global','teatable','responder en español','validated','L1')").run().lastInsertRowid);
  const r = approveLesson(db, id, { by: "sb" });
  assert.equal(r.status, "applied");
  assert.equal(r.applied, true);
  assert.equal(db.prepare("SELECT status, validated_by FROM lessons WHERE id=?").get(id).validated_by, "sb");
  assert.equal(db.prepare("SELECT content FROM knowledge").get().content, "responder en español");
});

test("approveLesson idempotente sobre applied", () => {
  const db = db0();
  const id = Number(db.prepare("INSERT INTO lessons (scope,source,lesson,status) VALUES ('global','teatable','x','applied')").run().lastInsertRowid);
  const r = approveLesson(db, id, {});
  assert.equal(r.applied, false);
});

test("rejectLesson → rejected", () => {
  const db = db0();
  const id = Number(db.prepare("INSERT INTO lessons (scope,source,lesson,status) VALUES ('global','teatable','mala idea','validated')").run().lastInsertRowid);
  assert.equal(rejectLesson(db, id, { by: "sb" }).status, "rejected");
});
```

- [ ] **Step 2: Correr → falla** (`cd alicia-brain && node --test test/lessons-approve.test.mjs`).

- [ ] **Step 3: Implementar en `src/lessons.js`**

```javascript
export function approveLesson(db, id, { by = "human" } = {}) {
  const row = db.prepare("SELECT status FROM lessons WHERE id = ?").get(id);
  if (!row) throw new Error(`lesson ${id} no existe`);
  if (row.status === "applied") return { status: "applied", applied: false };
  if (row.status === "rejected" || row.status === "retired") return { status: row.status, applied: false };
  db.prepare("UPDATE lessons SET status = 'applied', validated_by = ?, applied_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(by, id);
  applyLessonToBrain(db, id);
  return { status: "applied", applied: true };
}

export function rejectLesson(db, id, { by = "human" } = {}) {
  db.prepare("UPDATE lessons SET status = 'rejected', validated_by = ?, updated_at = datetime('now') WHERE id = ?").run(by, id);
  return { status: "rejected" };
}
```

- [ ] **Step 4: Correr → pasa.**

- [ ] **Step 5: Commit** — `feat(loop): approveLesson/rejectLesson (aprobación de superficie)`

---

### Task 2: Endpoints de lecciones (backbone de las superficies)

**Files:** Modify `alicia-brain/src/server.js` (agregar 3 rutas junto a las otras `/api/agents/*`, ~línea 1615 tras el endpoint de corrección).

**Interfaces:** Consume `getDB` (db.js), `approveLesson`/`rejectLesson`/`query` (lessons.js/db.js). Todas con `requireAgentKey`.

- [ ] **Step 1: Agregar las rutas** (usar `query` de db.js para el listado, y `getDB()` para approve/reject):

```javascript
// ── Loop de aprendizaje · lecciones (backbone de Tea Table / Taller / WhatsApp) ──
app.get("/api/agents/lessons", requireAgentKey, (req, res) => {
  try {
    const { status = "validated", scope } = req.query;
    const wheres = ["status = ?"]; const params = [status];
    if (scope) { wheres.push("scope = ?"); params.push(scope); }
    const { rows } = query(`SELECT * FROM lessons WHERE ${wheres.join(" AND ")} ORDER BY updated_at DESC LIMIT 200`, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post("/api/agents/lessons/:id/approve", requireAgentKey, async (req, res) => {
  try {
    const { by = "human" } = req.body || {};
    const { getDB } = await import("./db.js");
    const { approveLesson } = await import("./lessons.js");
    res.json(approveLesson(getDB(), Number(req.params.id), { by }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post("/api/agents/lessons/:id/reject", requireAgentKey, async (req, res) => {
  try {
    const { by = "human" } = req.body || {};
    const { getDB } = await import("./db.js");
    const { rejectLesson } = await import("./lessons.js");
    res.json(rejectLesson(getDB(), Number(req.params.id), { by }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```
> Verificar que `query` esté en scope en server.js (ya se importa arriba; el endpoint de corrección lo usa). Insertar tras el bloque del endpoint `/api/agents/corrections` para no partir otro handler.

- [ ] **Step 2: `node --check src/server.js`.**

- [ ] **Step 3: Commit** — `feat(loop): endpoints GET/approve/reject de lecciones`

---

### Task 3: Inyección de lecciones al system prompt de Alicia

**Files:** Modify `alicia-brain/src/server.js` (`buildSystemPrompt`, ~línea 284, y la llamada ~593). Test `alicia-brain/test/lessons-inject.test.mjs` (unit de la función pura de formato).

**Interfaces:** Consume `lessonsForScope` (lessons.js), `getDB` (db.js).

- [ ] **Step 1: Test que falla** (probar un helper puro de formato, sin levantar el server)

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatLessonsBlock } from "../src/lessons.js";

test("formatLessonsBlock arma un bloque con las lecciones", () => {
  const b = formatLessonsBlock(["responder más corto", "usar español"]);
  assert.match(b, /Lecciones aprendidas/i);
  assert.match(b, /responder más corto/);
  assert.match(b, /usar español/);
});
test("formatLessonsBlock vacío → string vacío", () => {
  assert.equal(formatLessonsBlock([]), "");
});
```

- [ ] **Step 2: Correr → falla.**

- [ ] **Step 3: Implementar `formatLessonsBlock` en `src/lessons.js`**

```javascript
export function formatLessonsBlock(lessons = []) {
  if (!Array.isArray(lessons) || !lessons.length) return "";
  return `\n## 🧠 Lecciones aprendidas (aplicá esto — se validaron y aprobaron)\n${lessons.map(l => `- ${l}`).join("\n")}`;
}
```

- [ ] **Step 4: Correr → pasa.**

- [ ] **Step 5: Cablear en `buildSystemPrompt`** — al final de la función, antes del `return`, traer e inyectar las lecciones del usuario + globales + de Alicia:

```javascript
  let lessonsBlock = "";
  try {
    const { lessonsForScope, formatLessonsBlock } = await import("./lessons.js"); // si buildSystemPrompt no es async, usar require estático: import arriba
    const { getDB } = await import("./db.js");
    const db = getDB();
    const ls = [...lessonsForScope(db, `user:${userId}`), ...lessonsForScope(db, "agent:alicia")];
    lessonsBlock = formatLessonsBlock([...new Set(ls)]);
  } catch (e) { console.error("inyección de lecciones falló:", e.message); }
```
y agregar `lessonsBlock` a la concatenación del prompt que la función retorna.
> **Nota de implementación:** `buildSystemPrompt` es síncrona hoy. Preferir imports estáticos arriba del archivo (`import { lessonsForScope, formatLessonsBlock } from "./lessons.js"` y usar el `query`/`getDB` ya disponibles) en vez de `await import`, para no tener que volver async la función. `lessonsForScope(db, 'user:'+userId)` ya incluye las `global` (Fase 1 filtra scope OR 'global'), así que con `user:${userId}` + `agent:alicia` alcanza; dedup con Set.

- [ ] **Step 6: `node --check src/server.js`** + correr el unit del formato.

- [ ] **Step 7: Commit** — `feat(loop): inyectar lecciones aplicadas al system prompt de Alicia`

---

### Task 4: Espejo de lecciones en Dropbox (brainsync)

**Files:** Modify `alicia-brain/src/brainsync.js` (`exportBrainToDropbox`, ~línea 60).

**Interfaces:** Consume `query` (ya importado en brainsync.js).

- [ ] **Step 1: Agregar el archivo de lecciones** — dentro de `exportBrainToDropbox`, junto a los otros `files.push(...)`, agregar:

```javascript
  // Lecciones aplicadas del loop de aprendizaje (legibles, auditables)
  const { rows: lessons } = query("SELECT scope, lesson, source, applied_at FROM lessons WHERE status = 'applied' ORDER BY applied_at DESC");
  files.push([`${BASE}/lecciones.md`, `# Lecciones aprendidas 🧠\n_${fmtDate()}_\n\n` +
    (lessons.length
      ? lessons.map(l => `- **[${l.scope}]** ${l.lesson} _(${l.source}${l.applied_at ? ", " + l.applied_at.slice(0, 10) : ""})_`).join("\n")
      : "_Todavía no hay lecciones aplicadas._")]);
```

- [ ] **Step 2: `node --check src/brainsync.js`.**

- [ ] **Step 3: Commit** — `feat(loop): espejar lecciones aplicadas a Dropbox (brainsync)`

---

### Task 5: Verificación integral Fase 3 (núcleo)

- [ ] **Step 1: Suite** — `cd alicia-brain && node --test test/lessons-approve.test.mjs test/lessons-inject.test.mjs` → verde; luego `node --test test/*.test.mjs` (toda) → verde.
- [ ] **Step 2: `node --check`** de `server.js`, `brainsync.js`, `lessons.js`.
- [ ] **Step 3: Smoke** — en memoria: crear lección `validated`, `approveLesson`, confirmar `applied` + fila en `knowledge`; `lessonsForScope('agent:alicia')` la trae; `formatLessonsBlock` la formatea. Documentar en el commit.
- [ ] **Step 4: Commit** de ajustes.

## Self-Review

- Aprobar/rechazar (spec §5 acción de superficie) → Task 1. ✅
- Endpoints backbone de superficies (spec §5) → Task 2. ✅ (las UIs concretas = Fase 3b)
- Aplicación que cambia comportamiento (spec §4) → Task 3 (inyección al prompt de Alicia — el agente LLM primario). ✅ para Alicia.
- Espejo Dropbox (spec §4) → Task 4. ✅
- Placeholder scan: sin TBD; las notas de implementación (sync vs async, imports estáticos) son guías reales, no placeholders.
- Type consistency: `approveLesson`/`rejectLesson`/`formatLessonsBlock` consistentes con consumos en Tasks 2/3; reusa `applyLessonToBrain`/`lessonsForScope` de Fase 1. ✅

## Fase 3b (follow-on, NO en este plan)
- **Superficies concretas:** Tea Table muestra `validated` de Wondies y aprueba (botón → `POST /approve`); WhatsApp: Alicia le pregunta a Sebastián por lecciones L1+ y aprueba por chat; Taller ya es la superficie de Bammy.
- **Aplicación por agente no-LLM:** que las lecciones `applied` de Knave/White-Rabbit/etc. modifiquen sus catálogos/checks (no solo el knowledge legible).
- **Inyección en Bammy y Tea Table** (los otros agentes LLM), no solo Alicia.
- **Señal de reflexión** por-agente (leer `agent_runs` recientes → `proposeLesson`).
- **Señal Alicia-WhatsApp** estructurada (rating/edit de respuestas).
- **Capa no-regresión** del gate por agente (Bammy re-corre estudios, Cheshire su suite).
