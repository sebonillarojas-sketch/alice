# Loop de aprendizaje · Fase 2 — Captura de señales + gate-pass · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development o executing-plans. Steps con checkbox.

**Goal:** Cablear las señales a `proposeLesson` (Fase 1) y correr el gate periódicamente: reglas duras versionadas, mappers de captura puros (corrección / outcome / Tea Table), un `runGatePass`, y el wiring a los endpoints + un cron.

**Architecture:** Módulos nuevos `src/hard-rules.js` (invariantes que chequea el gate) y `src/lesson-capture.js` (mappers puros source→args de `proposeLesson`). `runGatePass` se agrega a `src/lessons.js`. Wiring: endpoint de corrección, `runTeaTableReport`, y un cron diario que corre reflexión + gate-pass.

**Tech Stack:** Node ESM, `node:sqlite`, `node:test`. Reusa Fase 1 (`src/lessons.js`).

## Global Constraints

- Node ESM, `.js` imports. Tests `node:test`, `test/*.test.mjs`.
- Reusa Fase 1: `proposeLesson`, `runGateOnLesson` de `src/lessons.js` (ya en la rama).
- Invariante: `assignee`-style no aplica acá; sí: toda lección capturada pasa por `proposeLesson` (dedup por evidencia) y solo cambia estado vía `runGateOnLesson`/`runGatePass`.
- Los mappers de captura son **puros** (source data → objeto args), sin tocar DB — así son testeables sin red.
- Trabajar en worktree `feat/learning-loop` (extiende PR #44). No mergear a main hasta aprobación.

---

### Task 1: Reglas duras versionadas

**Files:** Create `alicia-brain/src/hard-rules.js`. Test `alicia-brain/test/hard-rules.test.mjs`.

**Interfaces:**
- Produces: `HARD_RULES` — array de `{ id, test: (lessonText:string) => boolean, reason }`, la lista de invariantes no negociables que `checkContradictsHardRules` (Fase 1) usa. Cubre: autoridad (no borrar/force-push sin confirmar), seguridad (no desactivar auth / abrir CORS), y RNE mínimos (no bajar de áreas mínimas para Bammy).

- [ ] **Step 1: Test que falla**

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { HARD_RULES } from "../src/hard-rules.js";
import { checkContradictsHardRules } from "../src/lessons.js";

test("HARD_RULES caza autoridad, seguridad y RNE", () => {
  assert.equal(checkContradictsHardRules("hacer force-push a main sin avisar", HARD_RULES).contradicts, true);
  assert.equal(checkContradictsHardRules("desactivar el auth gate para ir más rápido", HARD_RULES).contradicts, true);
  assert.equal(checkContradictsHardRules("bajar el dormitorio a 5 m2 para que entre", HARD_RULES).contradicts, true);
});
test("una lección benigna no contradice", () => {
  assert.equal(checkContradictsHardRules("responder más corto y en español", HARD_RULES).contradicts, false);
});
test("cada regla tiene id, test y reason", () => {
  for (const r of HARD_RULES) { assert.ok(r.id && typeof r.test === "function" && r.reason); }
});
```

- [ ] **Step 2: Correr → falla** (`cd alicia-brain && node --test test/hard-rules.test.mjs`).

- [ ] **Step 3: Implementar `src/hard-rules.js`**

```javascript
// Invariantes NO negociables del sistema. El gate (checkContradictsHardRules) rechaza
// cualquier lección cuyo texto matchee alguna. Versionar acá; agregar reglas con cuidado.
export const HARD_RULES = [
  { id: "autoridad-destructiva",
    test: t => /(force.?push|borrar|eliminar|drop\s+table|reset).*(sin (confirmar|aprobar|avisar)|autom[aá]tic)/i.test(t) || /force.?push.*main/i.test(t),
    reason: "viola límites de autoridad (acción destructiva sin confirmación humana)" },
  { id: "seguridad",
    test: t => /(desactivar|apagar|saltear|bypass).*(auth|autenticaci[oó]n|gate|seguridad)/i.test(t) || /abrir cors|cors.*(\*|para todos)/i.test(t),
    reason: "viola políticas de seguridad" },
  { id: "rne-minimos",
    test: t => /(bajar|reducir|menos de|por debajo).*(m2|m²|área mínima|area minima|dormitorio.*[0-4]\s?m)/i.test(t),
    reason: "viola mínimos de área RNE" },
];
```

- [ ] **Step 4: Correr → pasa.**

- [ ] **Step 5: Commit** — `feat(loop): reglas duras versionadas (autoridad/seguridad/RNE)`

---

### Task 2: Mappers de captura puros

**Files:** Create `alicia-brain/src/lesson-capture.js`. Test `alicia-brain/test/lesson-capture.test.mjs`.

**Interfaces:**
- Produces (todas puras, devuelven args para `proposeLesson` o `null` si no hay lección):
  - `lessonFromCorrection(corr) => args|null` — `corr` = fila de `bammy_corrections` (`{unidad, notas, veredicto, study_id}`). Si hay `notas`, devuelve `{ scope:'agent:bammy', source:'correction', trigger:`corrección unidad ${unidad}`, lesson: notas.trim(), risk_level:'L1' }`; si no hay notas → null.
  - `lessonFromFinding(finding) => args|null` — cuando un finding se marca `wont-fix` (falso positivo), aprender a no reportarlo: `{ scope:`agent:${finding.agent}`, source:'correction', trigger:`finding descartado: ${finding.category}`, lesson:`No reportar como problema: ${finding.detail}`, risk_level:'L1' }`. Solo si `status==='wont-fix'`; si no → null.
  - `lessonsFromTeaTable(reportText) => args[]` — extrae los bullets bajo una sección `## Lecciones` del markdown del reporte; cada bullet → `{ scope:'global', source:'teatable', trigger:'síntesis semanal', lesson: bullet, risk_level:'L1' }`. Si no hay sección → `[]`.

- [ ] **Step 1: Test que falla**

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { lessonFromCorrection, lessonFromFinding, lessonsFromTeaTable } from "../src/lesson-capture.js";

test("corrección con notas → lección L1 de bammy", () => {
  const a = lessonFromCorrection({ unidad: "2D", notas: "la cocina va al muro húmedo", veredicto: "a_corregir" });
  assert.equal(a.scope, "agent:bammy");
  assert.equal(a.source, "correction");
  assert.match(a.lesson, /muro húmedo/);
  assert.equal(a.risk_level, "L1");
});
test("corrección sin notas → null", () => {
  assert.equal(lessonFromCorrection({ unidad: "2D", notas: "" }), null);
});
test("finding wont-fix → lección de no-reportar", () => {
  const a = lessonFromFinding({ agent: "knave", category: "cors", detail: "CORS en /health", status: "wont-fix" });
  assert.equal(a.scope, "agent:knave");
  assert.match(a.lesson, /No reportar/);
});
test("finding resuelto normal → null", () => {
  assert.equal(lessonFromFinding({ agent: "knave", status: "resolved" }), null);
});
test("Tea Table extrae bullets de ## Lecciones", () => {
  const md = "# Estado\ntexto\n## Lecciones\n- reportar en español\n- consolidar checks\n## Otra\n- no";
  const out = lessonsFromTeaTable(md);
  assert.equal(out.length, 2);
  assert.equal(out[0].scope, "global");
  assert.match(out[0].lesson, /español/);
});
test("Tea Table sin sección → []", () => {
  assert.deepEqual(lessonsFromTeaTable("# Estado\nsin lecciones"), []);
});
```

- [ ] **Step 2: Correr → falla.**

- [ ] **Step 3: Implementar `src/lesson-capture.js`**

```javascript
// Mappers PUROS: convierten datos de una señal en args para proposeLesson (o null/[]).
// Sin DB ni red — testeables. Ver spec §2 (Captura).

export function lessonFromCorrection(corr = {}) {
  const notas = (corr.notas || "").trim();
  if (!notas) return null;
  return { scope: "agent:bammy", source: "correction", trigger: `corrección unidad ${corr.unidad || "?"}`, lesson: notas, risk_level: "L1" };
}

export function lessonFromFinding(finding = {}) {
  if (finding.status !== "wont-fix") return null;
  return {
    scope: `agent:${finding.agent || "unknown"}`,
    source: "correction",
    trigger: `finding descartado: ${finding.category || ""}`.trim(),
    lesson: `No reportar como problema: ${finding.detail || finding.category || "(sin detalle)"}`,
    risk_level: "L1",
  };
}

export function lessonsFromTeaTable(reportText = "") {
  const lines = String(reportText).split("\n");
  const out = [];
  let inSection = false;
  for (const l of lines) {
    if (/^##\s+Lecciones/i.test(l)) { inSection = true; continue; }
    if (/^##\s+/.test(l)) { inSection = false; continue; }
    if (inSection) {
      const m = l.match(/^\s*[-*•]\s+(.*\S)/);
      if (m) out.push({ scope: "global", source: "teatable", trigger: "síntesis semanal", lesson: m[1].trim(), risk_level: "L1" });
    }
  }
  return out;
}
```

- [ ] **Step 4: Correr → pasa.**

- [ ] **Step 5: Commit** — `feat(loop): mappers de captura puros (corrección/finding/tea-table)`

---

### Task 3: `runGatePass` — corre el gate sobre todas las proposed

**Files:** Modify `alicia-brain/src/lessons.js`. Test `alicia-brain/test/lessons-gatepass.test.mjs`.

**Interfaces:**
- Consumes: `runGateOnLesson` (Fase 1).
- Produces: `runGatePass(db, { hardRules = [], minEvidence = 3 }) => { evaluated, applied, rejected, validated }` — corre `runGateOnLesson` sobre cada lección en estado `proposed`, y devuelve el conteo por resultado.

- [ ] **Step 1: Test que falla**

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { ensureLessonsSchema, proposeLesson, runGatePass } from "../src/lessons.js";
import { HARD_RULES } from "../src/hard-rules.js";

test("runGatePass evalúa todas las proposed y cuenta resultados", () => {
  const db = new DatabaseSync(":memory:"); ensureLessonsSchema(db);
  // L0 con evidencia → applied
  const a = proposeLesson(db, { source: "reflection", lesson: "menos emojis", risk_level: "L0" });
  db.prepare("UPDATE lessons SET evidence_count = 3 WHERE id = ?").run(a.id);
  // contradice regla dura → rejected
  const b = proposeLesson(db, { source: "reflection", lesson: "desactivar el auth gate", risk_level: "L0" });
  db.prepare("UPDATE lessons SET evidence_count = 9 WHERE id = ?").run(b.id);
  // L2 con evidencia → validated
  const c = proposeLesson(db, { source: "correction", lesson: "cambiar flujo de tareas", risk_level: "L2" });
  db.prepare("UPDATE lessons SET evidence_count = 5 WHERE id = ?").run(c.id);
  const r = runGatePass(db, { hardRules: HARD_RULES, minEvidence: 3 });
  assert.equal(r.evaluated, 3);
  assert.equal(r.applied, 1);
  assert.equal(r.rejected, 1);
  assert.equal(r.validated, 1);
});
```

- [ ] **Step 2: Correr → falla.**

- [ ] **Step 3: Implementar en `src/lessons.js`**

```javascript
export function runGatePass(db, { hardRules = [], minEvidence = 3 } = {}) {
  const rows = db.prepare("SELECT id FROM lessons WHERE status = 'proposed'").all();
  const counts = { evaluated: 0, applied: 0, rejected: 0, validated: 0 };
  for (const { id } of rows) {
    const { status } = runGateOnLesson(db, id, { hardRules, minEvidence });
    counts.evaluated++;
    if (status === "applied") counts.applied++;
    else if (status === "rejected") counts.rejected++;
    else if (status === "validated") counts.validated++;
  }
  return counts;
}
```

- [ ] **Step 4: Correr → pasa.**

- [ ] **Step 5: Commit** — `feat(loop): runGatePass sobre todas las proposed`

---

### Task 4: Wiring — capturar en el endpoint de corrección + Tea Table

**Files:** Modify `alicia-brain/src/server.js` (endpoint `/api/agents/correction` ~1598), `alicia-brain/src/teatable.js` (`runTeaTableReport` ~89 + su prompt).

**Interfaces:** Consume `proposeLesson` (lessons.js), `lessonFromCorrection`, `lessonsFromTeaTable` (lesson-capture.js), `getDB` (db.js).

> **Prerrequisito confirmado:** `db.js` NO exporta `getDB` (es interno; la app usa `query()`). Mis funciones de Fase 1 toman el handle `db`. Por eso el **Step 0** expone `getDB`.

- [ ] **Step 0: Exportar `getDB` desde `db.js`** — cambiar la línea `function getDB() {` (≈línea 11) por `export function getDB() {`. Sin otros cambios. Verificar: `node --check src/db.js`.

- [ ] **Step 1: Corrección → lección** — en `POST /api/agents/correction`, después del INSERT exitoso y antes del `res.json`, agregar (best-effort, no romper el endpoint si falla):
```javascript
    try {
      const { proposeLesson } = await import("./lessons.js");
      const { lessonFromCorrection } = await import("./lesson-capture.js");
      const args = lessonFromCorrection({ unidad, notas, veredicto, study_id });
      if (args) { const { getDB } = await import("./db.js"); proposeLesson(getDB(), args); }
    } catch (e) { console.error("captura de lección (corrección) falló:", e.message); }
```
> Verificar el nombre real del export del handle de DB en `db.js` (¿`getDB`? ¿se usa `query`?). Si `db.js` no exporta el `db`, usar el mismo mecanismo que ya usa el endpoint (el `query()` importado arriba) — en ese caso, agregar a `lessons.js` un wrapper `proposeLessonQ(args)` que use `query()`. Ajustar en implementación según lo que exporte `db.js`.

- [ ] **Step 2: Tea Table → lecciones** — en `runTeaTableReport`, (a) agregar al prompt (esqueleto del reporte) una sección `## Lecciones` pidiendo 0-5 bullets de lecciones accionables para la constelación; (b) tras generar `report`, extraer y proponer:
```javascript
    try {
      const { proposeLesson } = await import("./lessons.js");
      const { lessonsFromTeaTable } = await import("./lesson-capture.js");
      for (const args of lessonsFromTeaTable(report)) proposeLesson(getDB(), args);
    } catch (e) { console.error("captura de lecciones (tea-table) falló:", e.message); }
```
(usar el mismo acceso a DB que el resto de teatable.js).

- [ ] **Step 3: Verificar sintaxis** — `cd alicia-brain && node --check src/server.js && node --check src/teatable.js`.

- [ ] **Step 4: Commit** — `feat(loop): capturar lecciones en corrección del Taller + Tea Table`

---

### Task 5: Wiring — cron diario de reflexión + gate-pass

**Files:** Modify `alicia-brain/src/cron.js`.

**Interfaces:** Consume `runGatePass` (lessons.js), `HARD_RULES` (hard-rules.js).

- [ ] **Step 1: Cron diario** — agregar un `cron.schedule` (ej. `"30 6 * * *"`, 6:30am, antes del briefing) que corre el gate-pass sobre las lecciones acumuladas del día:
```javascript
  // Loop de aprendizaje · gate-pass diario sobre lecciones proposed
  cron.schedule("30 6 * * *", async () => {
    try {
      const { runGatePass } = await import("./lessons.js");
      const { HARD_RULES } = await import("./hard-rules.js");
      const { getDB } = await import("./db.js");
      const r = runGatePass(getDB(), { hardRules: HARD_RULES, minEvidence: 3 });
      console.log(`🧠 gate-pass diario · ${JSON.stringify(r)}`);
    } catch (e) { console.error("gate-pass diario error:", e.message); }
  });
```
> Ajustar el acceso a DB (`getDB` vs `query`) a lo que exporte `db.js` (mismo criterio que Task 4).

- [ ] **Step 2: Actualizar el `console.log` final de cron.js** (el que lista los jobs activos) para mencionar "gate-pass 6:30am".

- [ ] **Step 3: Verificar sintaxis** — `node --check src/cron.js`.

- [ ] **Step 4: Commit** — `feat(loop): cron diario de gate-pass del loop de aprendizaje`

---

### Task 6: Verificación integral Fase 2

- [ ] **Step 1: Suite de Fase 2** — `cd alicia-brain && node --test test/hard-rules.test.mjs test/lesson-capture.test.mjs test/lessons-gatepass.test.mjs` → verde.
- [ ] **Step 2: Regresión** — `node --test test/*.test.mjs` (toda la suite) → verde.
- [ ] **Step 3: `node --check`** de `server.js`, `teatable.js`, `cron.js`.
- [ ] **Step 4: Smoke** — proponer una corrección vía `lessonFromCorrection` + `proposeLesson`, correr `runGatePass` con `HARD_RULES`, confirmar que una lección que contradice queda `rejected`. Documentar en el commit.
- [ ] **Step 5: Commit** de ajustes.

## Self-Review

- Reglas duras (spec §3 piso) → Task 1. ✅
- Captura corrección/finding/tea-table (spec §2) → Tasks 2 + 4. ✅
- Gate periódico (spec §2 "corrida periódica") → Tasks 3 + 5. ✅
- Señal **reflexión** y **outcome** (recurrencia de findings): Fase 2 deja los mappers/gate-pass listos; la corrida de reflexión por-agente que LEE agent_runs y propone queda como refinamiento menor (el gate-pass y la captura ya funcionan con las otras 3 señales). Señal **Alicia-WhatsApp** = Fase 3 (superficie conversacional). Documentado como límite.
- Placeholder scan: sin TBD; los "verificar export de db.js" son instrucciones de implementación reales (el implementador confirma el nombre en `db.js`), no placeholders de lógica.
- Type consistency: `HARD_RULES`, `lessonFromCorrection/Finding`, `lessonsFromTeaTable`, `runGatePass` consistentes con los consumos en Tasks 4/5. ✅

## Nota
Extiende PR #44 (misma rama `feat/learning-loop`). La tabla `lessons` se crea sola en el boot del brain (Fase 1). No requiere pasos manuales.
