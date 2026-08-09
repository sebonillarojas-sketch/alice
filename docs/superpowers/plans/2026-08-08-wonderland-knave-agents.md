# Wonderland — Knave + reloj único + stubs · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear el agente de seguridad Knave (L0, solo observa), anclar todo lo que corre en la bestia a un reloj único (un launchd), y dejar Bandersnatch/Jabberwocky como stubs hasta que exista el clon.

**Architecture:** Los agentes de la bestia (scraper, Cheshire, Knave, stubs) corren bajo un solo orquestador `bestia-runner.js` disparado por un único launchd cada ~10 min; el runner hace `git pull`, consulta una tabla de horarios y dispara lo vencido con lock. Knave corre checks de seguridad no-destructivos contra prod y reporta a Railway vía `POST /api/agents/report` con `x-agent-key`. La migración de esquema quita el CHECK-enum de `agent_runs.agent` para que cualquier agente (incl. Knave) pueda reportar.

**Tech Stack:** Node.js (ESM, `type: module`), `node:sqlite` (DatabaseSync), `node:test` + `node:assert/strict`, Playwright (ya presente, solo Cheshire), launchd (macOS), fetch nativo de Node.

## Global Constraints

- Runtime: Node ESM (`"type": "module"`), sin TypeScript. Imports con extensión `.js`.
- DB: `node:sqlite` (`DatabaseSync`). El CHECK-enum vive en `src/db.js`; `agent_findings.agent` YA es texto libre (sin CHECK) — solo `agent_runs.agent` tiene el enum.
- Tests: `node:test` + `node:assert/strict`, archivos `test/*.test.mjs`, se corren con `node --test test/<archivo>.test.mjs`. NO hay script `test` en package.json.
- Reporte a Railway: `POST https://alice-production-462e.up.railway.app/api/agents/report`, header `x-agent-key: <AGENTS_API_KEY>`, body `{ agent, result, summary, actions_taken, findings }`. `result ∈ {ok, issues, error}`. `finding = { severity ∈ {critical,major,minor,info}, category, detail }`.
- Knave es **L0**: nunca ejecuta acciones ni parcha; solo reporta runs/findings.
- Respetar `QUARANTINE=true` (env): si está, los agentes de la bestia solo observan (no reportan cambios, no ejecutan).
- launchd labels con prefijo `com.hygge.*` (convención existente: `com.hygge.white-rabbit`).
- Rutas en la bestia: repo en `/Users/eduardobonilla/Desktop/ALICE`, node en `/Users/eduardobonilla/.volta/bin/node`, user `eduardobonilla`.
- Coordinación: trabajar en worktree `feat/wonderland-cheshire-knave`. **No pushear ni mergear a `main`** hasta que la sesión Bammy cierre.

---

### Task 1: Migración — quitar el CHECK-enum de `agent_runs.agent` + registrar Knave

**Por qué:** `agent_runs.agent` tiene `CHECK (agent IN (...))` sin `'knave'`. SQLite no puede ALTERar un CHECK → hay que reconstruir la tabla. Se opta por **quitar** el enum (dejar `agent TEXT NOT NULL`, igual que `agent_findings.agent`) para no volver a migrar cada vez que se agrega un agente. Idempotente vía `sqlite_master`.

**Files:**
- Modify: `alicia-brain/src/db.js` (bloque `initSchema`: el `CREATE TABLE agent_runs` ~línea 85 y el bloque de migraciones idempotentes ~línea 142)
- Modify: `alicia-brain/src/darkalice.js:12-13` (mapa nombre/emoji)
- Modify: `alicia-brain/src/teatable.js:8-13` (mapa nombre/emoji/rol)
- Test: `alicia-brain/test/db-migration.test.mjs`

**Interfaces:**
- Produces: `migrateDropAgentEnum(db)` — función exportada de `db.js` que reconstruye `agent_runs` sin el CHECK-enum si aún lo tiene; idempotente. Firma: `(db: DatabaseSync) => void`.

- [ ] **Step 1: Escribir el test que falla**

Crear `alicia-brain/test/db-migration.test.mjs`:

```javascript
// Verifica que la migración quita el CHECK-enum de agent_runs.agent
// para que cualquier agente (incl. 'knave') pueda insertar.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { migrateDropAgentEnum } from "../src/db.js";

// DB temporal con el esquema VIEJO (con el enum que NO incluye knave)
function legacyDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE agent_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent TEXT NOT NULL CHECK (agent IN ('white-rabbit','cheshire','bandersnatch','mad-hatter','jabberwocky','dark-alice','tea-table')),
    started_at TEXT DEFAULT (datetime('now')), finished_at TEXT,
    result TEXT DEFAULT 'ok' CHECK (result IN ('ok','issues','error')),
    summary TEXT, actions_taken TEXT DEFAULT '[]', report TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );`);
  db.exec(`INSERT INTO agent_runs (agent, result, summary) VALUES ('white-rabbit','ok','fila previa');`);
  return db;
}

test("antes de migrar: insertar 'knave' falla por el CHECK", () => {
  const db = legacyDb();
  assert.throws(() => db.exec("INSERT INTO agent_runs (agent,result) VALUES ('knave','ok')"));
});

test("después de migrar: insertar 'knave' funciona y se conservan las filas", () => {
  const db = legacyDb();
  migrateDropAgentEnum(db);
  db.exec("INSERT INTO agent_runs (agent,result,summary) VALUES ('knave','ok','hola knave')");
  const rows = db.prepare("SELECT agent FROM agent_runs ORDER BY id").all();
  assert.deepEqual(rows.map(r => r.agent), ["white-rabbit", "knave"]);
});

test("migración idempotente: correrla dos veces no rompe ni duplica", () => {
  const db = legacyDb();
  migrateDropAgentEnum(db);
  migrateDropAgentEnum(db);
  const n = db.prepare("SELECT COUNT(*) c FROM agent_runs").get().c;
  assert.equal(n, 1);
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd alicia-brain && node --test test/db-migration.test.mjs`
Expected: FAIL — `migrateDropAgentEnum` no existe (import error).

- [ ] **Step 3: Implementar `migrateDropAgentEnum` en `db.js`**

En `alicia-brain/src/db.js`, agregar esta función exportada (por ejemplo justo antes de `export function query`):

```javascript
// Reconstruye agent_runs SIN el CHECK-enum de `agent` (deja TEXT libre, como agent_findings).
// Idempotente: si la tabla ya no tiene el enum, no hace nada. Detecta por el SQL guardado.
export function migrateDropAgentEnum(db) {
  const row = db.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='agent_runs'"
  ).get();
  if (!row || !/CHECK\s*\(\s*agent\s+IN/i.test(row.sql)) return; // ya migrada o no existe
  db.exec(`
    CREATE TABLE agent_runs_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent TEXT NOT NULL,
      started_at TEXT DEFAULT (datetime('now')),
      finished_at TEXT,
      result TEXT DEFAULT 'ok' CHECK (result IN ('ok','issues','error')),
      summary TEXT,
      actions_taken TEXT DEFAULT '[]',
      report TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    INSERT INTO agent_runs_new (id, agent, started_at, finished_at, result, summary, actions_taken, report, created_at)
      SELECT id, agent, started_at, finished_at, result, summary, actions_taken, report, created_at FROM agent_runs;
    DROP TABLE agent_runs;
    ALTER TABLE agent_runs_new RENAME TO agent_runs;
    CREATE INDEX IF NOT EXISTS idx_agent_runs ON agent_runs(agent, created_at DESC);
  `);
}
```

- [ ] **Step 4: Llamar la migración en `initSchema` y actualizar el CREATE para DBs nuevas**

En `db.js`, dentro de `initSchema`, en el `CREATE TABLE IF NOT EXISTS agent_runs (...)` cambiar la línea del enum:

```
      agent TEXT NOT NULL CHECK (agent IN ('white-rabbit','cheshire','bandersnatch','mad-hatter','jabberwocky','dark-alice','tea-table')),
```
por:
```
      agent TEXT NOT NULL,
```

Y en el bloque de migraciones idempotentes (junto a los `try { db.exec("ALTER TABLE ...") } catch {}`, ~línea 142) agregar:

```javascript
  try { migrateDropAgentEnum(db); } catch (e) { console.error("migrateDropAgentEnum:", e.message); }
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `cd alicia-brain && node --test test/db-migration.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 6: Registrar Knave en los mapas de nombre/emoji**

En `alicia-brain/src/darkalice.js:12-13`, agregar la entrada de knave al objeto de nombres (junto a las demás):

```javascript
  "jabberwocky": "⚡ Jabberwocky", "knave": "🃏 Knave",
```

En `alicia-brain/src/teatable.js` (junto a las otras entradas ~línea 12), agregar:

```javascript
  "knave": { name: "Knave", emoji: "🃏", role: "Seguridad · vigilancia de gaps (L0 solo observa)" },
```

- [ ] **Step 7: Commit**

```bash
git add alicia-brain/src/db.js alicia-brain/src/darkalice.js alicia-brain/src/teatable.js alicia-brain/test/db-migration.test.mjs
git commit -m "feat(db): quitar CHECK-enum de agent_runs.agent + registrar Knave"
```

---

### Task 2: Knave — lógica de checks de seguridad (funciones puras)

**Por qué:** Aislar la lógica de decisión (¿este header falta? ¿el CORS está abierto?) de la parte de red, para poder testearla sin tocar prod.

**Files:**
- Create: `alicia-brain/src/knave-checks.js`
- Test: `alicia-brain/test/knave-checks.test.mjs`

**Interfaces:**
- Produces:
  - `checkSecurityHeaders(headers) => Finding[]` — recibe un objeto de headers (lowercase keys), devuelve findings por header de seguridad faltante.
  - `checkCorsOpen(acaoHeader) => Finding|null` — recibe el valor de `access-control-allow-origin` de un preflight con Origin hostil; devuelve finding si refleja `*` o el origin hostil.
  - `checkAuthRejected(status) => Finding|null` — recibe el status de una request a ruta protegida sin credenciales; finding si NO es 401/403.
  - Tipo `Finding = { severity, category, detail }`.

- [ ] **Step 1: Escribir el test que falla**

Crear `alicia-brain/test/knave-checks.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSecurityHeaders, checkCorsOpen, checkAuthRejected } from "../src/knave-checks.js";

test("headers: faltan HSTS y CSP → 2 findings major", () => {
  const f = checkSecurityHeaders({ "x-frame-options": "DENY", "x-content-type-options": "nosniff" });
  const cats = f.map(x => x.detail);
  assert.equal(f.length, 2);
  assert.ok(f.every(x => x.severity === "major" && x.category === "security-headers"));
  assert.ok(cats.some(d => /strict-transport-security/i.test(d)));
  assert.ok(cats.some(d => /content-security-policy/i.test(d)));
});

test("headers: todos presentes → sin findings", () => {
  const f = checkSecurityHeaders({
    "strict-transport-security": "max-age=63072000",
    "content-security-policy": "default-src 'self'",
    "x-frame-options": "DENY",
    "x-content-type-options": "nosniff",
  });
  assert.equal(f.length, 0);
});

test("cors: refleja '*' → finding critical", () => {
  const f = checkCorsOpen("*");
  assert.equal(f.severity, "critical");
  assert.equal(f.category, "cors");
});

test("cors: refleja el origin hostil → finding critical", () => {
  const f = checkCorsOpen("https://evil.example");
  assert.ok(f && f.severity === "critical");
});

test("cors: null/ausente → sin finding", () => {
  assert.equal(checkCorsOpen(null), null);
});

test("auth: ruta protegida devuelve 200 sin token → finding critical", () => {
  const f = checkAuthRejected(200);
  assert.ok(f && f.severity === "critical" && f.category === "auth-gate");
});

test("auth: 401 → sin finding", () => {
  assert.equal(checkAuthRejected(401), null);
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd alicia-brain && node --test test/knave-checks.test.mjs`
Expected: FAIL — módulo `knave-checks.js` no existe.

- [ ] **Step 3: Implementar `src/knave-checks.js`**

```javascript
// Knave 🃏 · lógica pura de evaluación de seguridad (sin red — testeable).
// Cada función recibe datos ya obtenidos y devuelve findings. La parte de fetch
// vive en scripts/knave.js. Ver docs/WONDERLAND_IT.md y el spec de este sub-proyecto.

const REQUIRED_HEADERS = [
  "strict-transport-security",
  "content-security-policy",
  "x-frame-options",
  "x-content-type-options",
];

export function checkSecurityHeaders(headers = {}) {
  const present = new Set(Object.keys(headers).map(k => k.toLowerCase()));
  return REQUIRED_HEADERS
    .filter(h => !present.has(h))
    .map(h => ({
      severity: "major",
      category: "security-headers",
      detail: `Falta el header de seguridad '${h}' — el navegador queda sin esa protección`,
    }));
}

// acao = valor de Access-Control-Allow-Origin devuelto ante un preflight con Origin hostil.
// Si refleja '*' o el propio origin hostil, el CORS está abierto de más.
export function checkCorsOpen(acao) {
  if (!acao) return null;
  if (acao === "*" || /evil\.example/i.test(acao)) {
    return {
      severity: "critical",
      category: "cors",
      detail: `CORS abierto: Access-Control-Allow-Origin devolvió '${acao}' ante un Origin hostil`,
    };
  }
  return null;
}

// status = código de una request a ruta protegida SIN credenciales. Debe ser 401 o 403.
export function checkAuthRejected(status) {
  if (status === 401 || status === 403) return null;
  return {
    severity: "critical",
    category: "auth-gate",
    detail: `Ruta protegida respondió HTTP ${status} sin credenciales — debería rechazar (401/403)`,
  };
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd alicia-brain && node --test test/knave-checks.test.mjs`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add alicia-brain/src/knave-checks.js alicia-brain/test/knave-checks.test.mjs
git commit -m "feat(knave): lógica pura de checks de seguridad (headers/cors/auth)"
```

---

### Task 3: Knave — runner que hace red, arma el reporte y lo envía

**Por qué:** Orquesta los checks contra prod y reporta a Railway. Se inyecta `fetch` y el `reporter` para testear el armado del reporte sin red real.

**Files:**
- Create: `alicia-brain/scripts/knave.js`
- Test: `alicia-brain/test/knave-runner.test.mjs`

**Interfaces:**
- Consumes: `checkSecurityHeaders`, `checkCorsOpen`, `checkAuthRejected` de `src/knave-checks.js`.
- Produces: `runKnave({ fetchImpl, reporter, targets }) => { result, findings, summary }` — corre los checks usando `fetchImpl` (default `globalThis.fetch`), acumula findings, arma `{ agent:'knave', result, summary, findings }` y lo pasa a `reporter` (default: POST a Railway). `result` = `'issues'` si hay findings, si no `'ok'`; si un check tira, `'error'` con finding info.

- [ ] **Step 1: Escribir el test que falla**

Crear `alicia-brain/test/knave-runner.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { runKnave } from "../scripts/knave.js";

// fetch falso: headers pobres + CORS abierto + ruta protegida que NO rechaza
function fakeFetch(url, opts = {}) {
  const h = new Map();
  if (String(url).includes("/health")) {
    // sin headers de seguridad
  }
  const isPreflight = (opts.method || "GET") === "OPTIONS";
  const headers = {
    get: (k) => {
      const kk = k.toLowerCase();
      if (isPreflight && kk === "access-control-allow-origin") return "*";
      return null;
    },
    forEach: () => {},
  };
  // ruta protegida simulada devuelve 200 (mal)
  const status = String(url).includes("/api/tasks") ? 200 : 200;
  return Promise.resolve({ ok: true, status, headers });
}

test("runKnave detecta CORS abierto y auth flojo, y arma reporte 'issues'", async () => {
  let sent = null;
  const res = await runKnave({
    fetchImpl: fakeFetch,
    reporter: (payload) => { sent = payload; return Promise.resolve({ ok: true }); },
    targets: { base: "https://x", protectedPath: "/api/tasks" },
  });
  assert.equal(res.result, "issues");
  assert.ok(res.findings.some(f => f.category === "cors" && f.severity === "critical"));
  assert.ok(res.findings.some(f => f.category === "auth-gate"));
  assert.ok(res.findings.some(f => f.category === "security-headers"));
  assert.equal(sent.agent, "knave");
  assert.equal(sent.result, "issues");
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd alicia-brain && node --test test/knave-runner.test.mjs`
Expected: FAIL — `scripts/knave.js` no existe / `runKnave` no exportado.

- [ ] **Step 3: Implementar `scripts/knave.js`**

```javascript
// Knave 🃏 · agente de seguridad · L0 (SOLO observa, NUNCA parcha ni ejecuta).
// Corre en la bestia (disparado por bestia-runner.js). Checks no-destructivos contra
// prod; reporta a Railway con x-agent-key. Ver docs/WONDERLAND_IT.md + spec.
import dotenv from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkSecurityHeaders, checkCorsOpen, checkAuthRejected } from "../src/knave-checks.js";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "..", ".env") });

const REPORT_URL = "https://alice-production-462e.up.railway.app/api/agents/report";
const DEFAULT_TARGETS = {
  base: "https://aliceai.bam.pe",
  protectedPath: "/api/tasks", // ruta que exige JWT
};

function headersToObject(resHeaders) {
  const o = {};
  if (resHeaders && typeof resHeaders.forEach === "function") {
    resHeaders.forEach((v, k) => { o[k.toLowerCase()] = v; });
  }
  return o;
}

async function defaultReporter(payload) {
  return fetch(REPORT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-agent-key": process.env.AGENTS_API_KEY || "" },
    body: JSON.stringify(payload),
  });
}

export async function runKnave({ fetchImpl = globalThis.fetch, reporter = defaultReporter, targets = DEFAULT_TARGETS } = {}) {
  const findings = [];
  const actions = [];
  const note = (ok, label, detail = "") => actions.push({ check: label, ok, detail });

  // 1) Headers de seguridad
  try {
    const r = await fetchImpl(targets.base + "/health", { signal: AbortSignal.timeout(10000) });
    const hf = checkSecurityHeaders(headersToObject(r.headers));
    findings.push(...hf);
    note(hf.length === 0, "Headers de seguridad", hf.length ? `faltan ${hf.length}` : "");
  } catch (e) { note(false, "Headers de seguridad", e.message); }

  // 2) CORS abierto (preflight con Origin hostil)
  try {
    const r = await fetchImpl(targets.base + "/health", {
      method: "OPTIONS",
      headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "GET" },
      signal: AbortSignal.timeout(10000),
    });
    const acao = r.headers?.get ? r.headers.get("access-control-allow-origin") : null;
    const cf = checkCorsOpen(acao);
    if (cf) findings.push(cf);
    note(!cf, "CORS", cf ? "abierto" : "");
  } catch (e) { note(false, "CORS", e.message); }

  // 3) Auth gate: ruta protegida sin credenciales debe rechazar
  try {
    const r = await fetchImpl(targets.base + targets.protectedPath, { signal: AbortSignal.timeout(10000) });
    const af = checkAuthRejected(r.status);
    if (af) findings.push(af);
    note(!af, "Auth gate", af ? `no rechaza (HTTP ${r.status})` : "");
  } catch (e) { note(false, "Auth gate", e.message); }

  const result = findings.length ? "issues" : "ok";
  const summary = findings.length
    ? `${findings.length} hallazgo(s) de seguridad: ${[...new Set(findings.map(f => f.category))].join(", ")}`
    : "Checks de seguridad OK";
  const payload = { agent: "knave", result, summary, actions_taken: actions, findings };

  if (process.env.QUARANTINE === "true") {
    console.log("🃏 QUARANTINE activo — Knave observa pero no reporta");
    return { result, findings, summary, reported: false };
  }
  try { await reporter(payload); } catch (e) { console.error("🃏 Knave no pudo reportar:", e.message); }
  return { result, findings, summary, reported: true };
}

// Entry point cuando se corre directo (bestia-runner lo invoca como subproceso)
if (import.meta.url === `file://${process.argv[1]}`) {
  runKnave().then(r => { console.log(`🃏 Knave · ${r.result} · ${r.summary}`); process.exit(0); })
    .catch(e => { console.error("🃏 Knave crash:", e.message); process.exit(1); });
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd alicia-brain && node --test test/knave-runner.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add alicia-brain/scripts/knave.js alicia-brain/test/knave-runner.test.mjs
git commit -m "feat(knave): runner de seguridad L0 con reporte a Railway"
```

---

### Task 4: Stubs — Bandersnatch y Jabberwocky (reportan `skipped`)

**Por qué:** Requieren un clon nocturno inexistente. Se dejan cableados pero inertes para que el Lab los muestre "en espera" en vez de simulados.

**Files:**
- Create: `alicia-brain/scripts/bandersnatch.js`
- Create: `alicia-brain/scripts/jabberwocky.js`
- Test: `alicia-brain/test/stubs.test.mjs`

**Interfaces:**
- Produces (en cada archivo): `buildSkippedReport() => { agent, result, summary }` con `result: 'issues'` NO — usar `result: 'ok'` y `summary` explicativo (el enum de `result` no admite 'skipped'; se marca con summary). Firma idéntica en ambos, cambiando `agent`.

> Nota: el CHECK de `result` solo admite `ok|issues|error`. El estado "en espera" se expresa con `result:'ok'` + `summary` claro, sin findings.

- [ ] **Step 1: Escribir el test que falla**

Crear `alicia-brain/test/stubs.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSkippedReport as bander } from "../scripts/bandersnatch.js";
import { buildSkippedReport as jabber } from "../scripts/jabberwocky.js";

test("bandersnatch stub: reporte en espera, sin findings", () => {
  const r = bander();
  assert.equal(r.agent, "bandersnatch");
  assert.equal(r.result, "ok");
  assert.match(r.summary, /clon nocturno/i);
  assert.deepEqual(r.findings, []);
});

test("jabberwocky stub: reporte en espera, sin findings", () => {
  const r = jabber();
  assert.equal(r.agent, "jabberwocky");
  assert.equal(r.result, "ok");
  assert.match(r.summary, /clon nocturno/i);
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd alicia-brain && node --test test/stubs.test.mjs`
Expected: FAIL — módulos no existen.

- [ ] **Step 3: Implementar los stubs**

`alicia-brain/scripts/bandersnatch.js`:

```javascript
// Bandersnatch ⚔️ · chaos tester · STUB (esperando clon nocturno).
// REGLA DE ORO: jamás contra prod con datos reales. Hasta que exista el clon,
// solo reporta 'en espera'. Ver docs/WONDERLAND_IT.md + spec.
export function buildSkippedReport() {
  return {
    agent: "bandersnatch",
    result: "ok",
    summary: "En espera — esperando clon nocturno; no corre contra prod",
    actions_taken: [],
    findings: [],
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("⚔️ Bandersnatch (stub) · en espera del clon nocturno");
  process.exit(0);
}
```

`alicia-brain/scripts/jabberwocky.js` (idéntico salvo agent/emoji):

```javascript
// Jabberwocky ⚡ · fuzzer adversarial · STUB (esperando clon nocturno).
// Corre inputs adversariales SOLO en el clon, nunca en prod. Ver spec.
export function buildSkippedReport() {
  return {
    agent: "jabberwocky",
    result: "ok",
    summary: "En espera — esperando clon nocturno; no corre contra prod",
    actions_taken: [],
    findings: [],
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("⚡ Jabberwocky (stub) · en espera del clon nocturno");
  process.exit(0);
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd alicia-brain && node --test test/stubs.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add alicia-brain/scripts/bandersnatch.js alicia-brain/scripts/jabberwocky.js alicia-brain/test/stubs.test.mjs
git commit -m "feat(wonderland): stubs Bandersnatch/Jabberwocky en espera del clon"
```

---

### Task 5: Reloj único — lógica de horarios (funciones puras)

**Por qué:** El corazón del reloj es decidir "¿este job está vencido?". Se aísla como función pura para testear sin launchd ni tiempo real.

**Files:**
- Create: `alicia-brain/scripts/schedule.js`
- Test: `alicia-brain/test/schedule.test.mjs`

**Interfaces:**
- Produces:
  - `SCHEDULE` — array `[{ id, script, everyMs }]` con la tabla de horarios.
  - `dueJobs(schedule, state, nowMs) => Job[]` — devuelve los jobs cuyo `nowMs - state[id] >= everyMs` (o que nunca corrieron).
  - `markRan(state, id, nowMs) => state` — devuelve estado nuevo con `state[id] = nowMs`.

- [ ] **Step 1: Escribir el test que falla**

Crear `alicia-brain/test/schedule.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { SCHEDULE, dueJobs, markRan } from "../scripts/schedule.js";

const MIN = 60_000, HOUR = 60 * MIN;

test("SCHEDULE incluye scraper, cheshire y knave con cadencias correctas", () => {
  const byId = Object.fromEntries(SCHEDULE.map(j => [j.id, j]));
  assert.equal(byId["scraper"].everyMs, 6 * HOUR);
  assert.equal(byId["cheshire"].everyMs, 30 * MIN);
  assert.equal(byId["knave"].everyMs, 1 * HOUR);
});

test("dueJobs: un job que nunca corrió está vencido", () => {
  const due = dueJobs(SCHEDULE, {}, 1_000_000);
  assert.ok(due.find(j => j.id === "cheshire"));
});

test("dueJobs: un job que corrió recién NO está vencido", () => {
  const now = 10 * HOUR;
  const state = { cheshire: now - 5 * MIN }; // corrió hace 5 min, cadencia 30 min
  const due = dueJobs(SCHEDULE.filter(j => j.id === "cheshire"), state, now);
  assert.equal(due.length, 0);
});

test("dueJobs: vencido cuando pasó la cadencia", () => {
  const now = 10 * HOUR;
  const state = { cheshire: now - 31 * MIN };
  const due = dueJobs(SCHEDULE.filter(j => j.id === "cheshire"), state, now);
  assert.equal(due.length, 1);
});

test("markRan actualiza el timestamp", () => {
  const s = markRan({}, "knave", 123);
  assert.equal(s.knave, 123);
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd alicia-brain && node --test test/schedule.test.mjs`
Expected: FAIL — `scripts/schedule.js` no existe.

- [ ] **Step 3: Implementar `scripts/schedule.js`**

```javascript
// Reloj único de la bestia · tabla de horarios + lógica de "vencido" (pura).
// bestia-runner.js tickea cada ~10 min y usa esto para decidir qué disparar.
const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR, WEEK = 7 * DAY;

// script = ruta relativa a scripts/ ; los stubs corren pero no hacen nada útil aún.
export const SCHEDULE = [
  { id: "scraper", script: "scrape.js", args: ["all"], everyMs: 6 * HOUR },
  { id: "cheshire", script: "cheshire.js", args: [], everyMs: 30 * MIN },
  { id: "knave", script: "knave.js", args: [], everyMs: 1 * HOUR },
  { id: "knave-audit", script: "knave.js", args: ["audit"], everyMs: 1 * DAY },
  { id: "knave-review", script: "knave.js", args: ["review"], everyMs: 1 * WEEK },
  { id: "bandersnatch", script: "bandersnatch.js", args: [], everyMs: 1 * DAY },
  { id: "jabberwocky", script: "jabberwocky.js", args: [], everyMs: 1 * DAY },
];

export function dueJobs(schedule, state = {}, nowMs) {
  return schedule.filter(j => {
    const last = state[j.id];
    return last == null || (nowMs - last) >= j.everyMs;
  });
}

export function markRan(state, id, nowMs) {
  return { ...state, [id]: nowMs };
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd alicia-brain && node --test test/schedule.test.mjs`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add alicia-brain/scripts/schedule.js alicia-brain/test/schedule.test.mjs
git commit -m "feat(bestia): tabla de horarios + lógica de vencimiento (reloj único)"
```

---

### Task 6: Reloj único — orquestador `bestia-runner.js`

**Por qué:** Es el proceso que el launchd dispara cada tick: pull → leer estado → disparar vencidos con lock → guardar estado. La parte de spawn/pull es efecto de sistema; se testea la lógica de estado (read/write) y se deja la corrida real para verificación manual.

**Files:**
- Create: `alicia-brain/scripts/bestia-runner.js`
- Test: `alicia-brain/test/bestia-state.test.mjs`

**Interfaces:**
- Consumes: `SCHEDULE`, `dueJobs`, `markRan` de `scripts/schedule.js`.
- Produces:
  - `readState(path) => object` — lee el JSON de estado; `{}` si no existe o está corrupto.
  - `writeState(path, state) => void` — escribe el JSON (crea el dir si falta).
  - `tick({ now, statePath, spawn, pull })` — orquesta un tick; `spawn(job)` y `pull()` inyectables para test.

- [ ] **Step 1: Escribir el test que falla**

Crear `alicia-brain/test/bestia-state.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readState, writeState, tick } from "../scripts/bestia-runner.js";

test("readState de archivo inexistente → {}", () => {
  assert.deepEqual(readState(join(tmpdir(), "no-existe-xyz.json")), {});
});

test("writeState + readState roundtrip", () => {
  const dir = mkdtempSync(join(tmpdir(), "bestia-"));
  const p = join(dir, "state.json");
  writeState(p, { knave: 42 });
  assert.deepEqual(readState(p), { knave: 42 });
  rmSync(dir, { recursive: true, force: true });
});

test("tick dispara jobs vencidos y persiste su timestamp", async () => {
  const dir = mkdtempSync(join(tmpdir(), "bestia-"));
  const p = join(dir, "state.json");
  const spawned = [];
  let pulled = false;
  await tick({
    now: 1_000_000_000,
    statePath: p,
    pull: async () => { pulled = true; },
    spawn: async (job) => { spawned.push(job.id); },
  });
  assert.ok(pulled, "debe hacer pull");
  assert.ok(spawned.includes("cheshire") && spawned.includes("knave"));
  const st = readState(p);
  assert.ok(st.cheshire === 1_000_000_000);
  rmSync(dir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd alicia-brain && node --test test/bestia-state.test.mjs`
Expected: FAIL — `bestia-runner.js` no existe.

- [ ] **Step 3: Implementar `scripts/bestia-runner.js`**

```javascript
// Reloj único de la bestia 🕰️ · lo dispara com.hygge.wonderland.plist cada ~10 min.
// En cada tick: git pull → leer estado → disparar jobs vencidos (con lock) → guardar.
// Ver docs/superpowers/specs/2026-08-08-wonderland-knave-agents-design.md
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { SCHEDULE, dueJobs, markRan } from "./schedule.js";

const execFileP = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");            // alicia-brain/
const NODE = process.execPath;
const STATE_PATH = join(homedir(), "Library/Application Support/wonderland/schedule-state.json");
const running = new Set();                 // lock en memoria por proceso

export function readState(path) {
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return {}; }
}
export function writeState(path, state) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(state, null, 2));
}

async function defaultPull() {
  try { await execFileP("git", ["pull", "--ff-only"], { cwd: join(REPO, "..") }); }
  catch (e) { console.error("🕰️ git pull falló (sigo con el código actual):", e.message); }
}

async function defaultSpawn(job) {
  if (running.has(job.id)) { console.log(`🕰️ ${job.id} sigue corriendo — salto`); return; }
  running.add(job.id);
  try {
    await execFileP(NODE, [join(HERE, job.script), ...(job.args || [])], { cwd: REPO, timeout: 10 * 60_000 });
    console.log(`🕰️ ${job.id} OK`);
  } catch (e) { console.error(`🕰️ ${job.id} falló:`, e.message); }
  finally { running.delete(job.id); }
}

export async function tick({ now = Date.now(), statePath = STATE_PATH, pull = defaultPull, spawn = defaultSpawn } = {}) {
  if (process.env.QUARANTINE === "true") { console.log("🕰️ QUARANTINE — no disparo nada"); return; }
  await pull();
  let state = readState(statePath);
  const due = dueJobs(SCHEDULE, state, now);
  for (const job of due) {
    await spawn(job);
    state = markRan(state, job.id, now);
    writeState(statePath, state); // persistir por job (crash-safe)
  }
  console.log(`🕰️ tick · ${due.length} job(s) disparados`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  tick().then(() => process.exit(0)).catch(e => { console.error("🕰️ tick crash:", e.message); process.exit(1); });
}
```

> Nota sobre el pull: `cwd` del `git pull` es la raíz del repo (`~/Desktop/ALICE`), un nivel arriba de `alicia-brain/`. Ajustar si la estructura del repo en la bestia difiere (verificar en Task 8).

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd alicia-brain && node --test test/bestia-state.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add alicia-brain/scripts/bestia-runner.js alicia-brain/test/bestia-state.test.mjs
git commit -m "feat(bestia): orquestador del reloj único (pull + dispatch con lock)"
```

---

### Task 7: Auto-bootstrap — plist del reloj único + instalación sin SSH

**Por qué:** Sin shell en la bestia, el reloj se instala solo: `scrape.js` (que ya se auto-actualiza) llama al bootstrap, que carga el plist nuevo y retira el viejo **solo tras confirmar** que el nuevo quedó activo. Estos pasos tocan launchd (efecto de sistema) → se verifican manualmente, no con unit tests.

**Files:**
- Create: `alicia-brain/scripts/com.hygge.wonderland.plist`
- Create: `alicia-brain/scripts/bestia-bootstrap.js`
- Modify: `alicia-brain/scripts/scrape.js` (llamar al bootstrap al final)

**Interfaces:**
- Consumes: nada de tasks previas (es infra de OS).
- Produces: `ensureWonderlandClock()` — instala/actualiza `com.hygge.wonderland` y retira `com.hygge.white-rabbit` si el nuevo quedó cargado. Idempotente.

- [ ] **Step 1: Crear el plist del reloj único**

`alicia-brain/scripts/com.hygge.wonderland.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.hygge.wonderland</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Users/eduardobonilla/.volta/bin/node</string>
    <string>/Users/eduardobonilla/Desktop/ALICE/alicia-brain/scripts/bestia-runner.js</string>
  </array>
  <key>StartInterval</key>
  <integer>600</integer>
  <key>WorkingDirectory</key>
  <string>/Users/eduardobonilla/Desktop/ALICE/alicia-brain</string>
  <key>StandardOutPath</key>
  <string>/Users/eduardobonilla/Library/Logs/wonderland.out.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/eduardobonilla/Library/Logs/wonderland.err.log</string>
  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>
```

- [ ] **Step 2: Implementar `scripts/bestia-bootstrap.js`**

```javascript
// Auto-bootstrap del reloj único (sin SSH) · lo llama scrape.js al final de su corrida.
// Copia el plist a ~/Library/LaunchAgents, lo carga, y SOLO si quedó activo retira el
// plist viejo del scraper (com.hygge.white-rabbit) para no duplicar el scraper.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const LA_DIR = join(homedir(), "Library/LaunchAgents");
const NEW_LABEL = "com.hygge.wonderland";
const OLD_LABEL = "com.hygge.white-rabbit";
const uid = process.getuid();

async function isLoaded(label) {
  try { await execFileP("launchctl", ["print", `gui/${uid}/${label}`]); return true; }
  catch { return false; }
}

export async function ensureWonderlandClock() {
  mkdirSync(LA_DIR, { recursive: true });
  const dst = join(LA_DIR, `${NEW_LABEL}.plist`);
  copyFileSync(join(HERE, `${NEW_LABEL}.plist`), dst);
  // (re)cargar el nuevo
  try { await execFileP("launchctl", ["bootout", `gui/${uid}/${NEW_LABEL}`]); } catch {}
  await execFileP("launchctl", ["bootstrap", `gui/${uid}`, dst]);

  if (!(await isLoaded(NEW_LABEL))) {
    console.error("🕰️ bootstrap: el reloj nuevo NO quedó cargado — NO retiro el viejo (heartbeat a salvo)");
    return { installed: false };
  }
  // el nuevo está vivo → retirar el viejo para no duplicar el scraper
  const oldPlist = join(LA_DIR, `${OLD_LABEL}.plist`);
  try { await execFileP("launchctl", ["bootout", `gui/${uid}/${OLD_LABEL}`]); } catch {}
  console.log(`🕰️ bootstrap OK · ${NEW_LABEL} activo · ${OLD_LABEL} retirado`);
  return { installed: true };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  ensureWonderlandClock().then(() => process.exit(0)).catch(e => { console.error("bootstrap:", e.message); process.exit(1); });
}
```

- [ ] **Step 3: Encadenar el bootstrap desde `scrape.js`**

En `alicia-brain/scripts/scrape.js`, al final del flujo principal (después de que el scrape termina, antes de `process.exit`), agregar una llamada best-effort:

```javascript
// Auto-instala el reloj único de Wonderland (idempotente). Best-effort: si falla,
// el scraper sigue corriendo por su plist viejo y se reintenta en la próxima corrida.
try {
  const { ensureWonderlandClock } = await import("./bestia-bootstrap.js");
  await ensureWonderlandClock();
} catch (e) { console.error("🕰️ no pude instalar el reloj (reintento próxima corrida):", e.message); }
```

> Ubicar esta llamada donde `scrape.js` ya haya terminado su trabajo. Si `scrape.js` no es `async` en el top level, envolver en una IIFE async o ponerlo dentro de la función principal antes del return. Verificar la estructura real de `scrape.js` al implementar.

- [ ] **Step 4: Verificación (local, en la Mac que ejecuta) — sin datos de prod**

Como estos pasos tocan launchd del usuario, verificar la lógica sin activar de verdad:

Run: `cd alicia-brain && node -e "import('./scripts/bestia-runner.js').then(m => m.tick({ now: Date.now(), statePath: '/tmp/wl-state.json', pull: async()=>{}, spawn: async(j)=>console.log('would run', j.id) }))"`
Expected: imprime `would run scraper/cheshire/knave/...` y `tick · N job(s)`, y crea `/tmp/wl-state.json`.

> No correr `ensureWonderlandClock()` en la laptop (instalaría el launchd acá). Su verificación real es en la bestia tras el merge (Task 8 / criterios de éxito).

- [ ] **Step 5: Commit**

```bash
git add alicia-brain/scripts/com.hygge.wonderland.plist alicia-brain/scripts/bestia-bootstrap.js alicia-brain/scripts/scrape.js
git commit -m "feat(bestia): auto-bootstrap del reloj único (sin SSH) + retiro seguro del plist viejo"
```

---

### Task 8: Verificación integral + documentación

**Por qué:** Confirmar que toda la suite pasa, documentar el runbook de la bestia, y dejar clara la puerta de activación (merge a main → pull de la bestia).

**Files:**
- Modify: `alicia-brain/docs/WONDERLAND_IT.md` (agregar Knave + nota del reloj único)
- Create: `alicia-brain/docs/BESTIA_RUNBOOK.md`

- [ ] **Step 1: Correr TODA la suite de tests**

Run: `cd alicia-brain && node --test test/db-migration.test.mjs test/knave-checks.test.mjs test/knave-runner.test.mjs test/stubs.test.mjs test/schedule.test.mjs test/bestia-state.test.mjs`
Expected: PASS en todos.

- [ ] **Step 2: Verificar que Knave caza el CORS abierto REAL de hoy (señal viva)**

Run: `cd alicia-brain && AGENTS_API_KEY=dummy QUARANTINE=true node -e "import('./scripts/knave.js').then(async m => { const r = await m.runKnave(); console.log(JSON.stringify(r.findings, null, 2)); })"`
Expected: al menos un finding `category:'cors'` (el `app.use(cors())` abierto actual). Con `QUARANTINE=true` no reporta a prod — solo imprime.

> Si NO aparece el finding de CORS, revisar que el endpoint `/health` responda al preflight OPTIONS; ajustar `targets` o el check antes de dar por bueno.

- [ ] **Step 3: Documentar Knave en `WONDERLAND_IT.md`**

Agregar una sección tras Jabberwocky:

```markdown
### 🃏 Knave — Seguridad (L0 · solo observa)
Corre en la bestia (reloj único). Checks no-destructivos contra prod:
headers de seguridad, CORS abierto, auth gate, rate-limit, secret/token scan,
`npm audit` diario, y `security-review` semanal sobre el diff. NUNCA parcha ni
ejecuta — solo reporta findings; críticos escalan a Dark Alice → WhatsApp.
```

Y una nota al inicio de "Infraestructura común":

```markdown
- Los agentes de la bestia (scraper, Cheshire, Knave, stubs) corren bajo UN reloj
  único (`com.hygge.wonderland`, `bestia-runner.js`, tick ~10 min) con tabla de
  horarios versionada — no un launchd por agente.
```

- [ ] **Step 4: Crear el runbook de la bestia**

`alicia-brain/docs/BESTIA_RUNBOOK.md`:

```markdown
# Runbook · reloj único de la bestia

**Bestia:** `alicias-mac-pro-1`, Tailscale `100.88.12.17`, user `eduardobonilla`,
repo `~/Desktop/ALICE`, node `~/.volta/bin/node`. **Sin SSH** → todo por git.

## Cómo se activa (sin intervención)
1. Merge a `main`.
2. La bestia, en su próxima corrida del plist viejo (`com.hygge.white-rabbit`, c/6h),
   hace `git pull` y `scrape.js` llama a `ensureWonderlandClock()`.
3. Se instala `com.hygge.wonderland` (tick ~10 min); si queda activo, se retira el
   plist viejo. De ahí en más el reloj único corre todo.

## Horarios (scripts/schedule.js)
scraper 6h · Cheshire 30min · Knave 1h · knave-audit diario · knave-review semanal ·
Bandersnatch/Jabberwocky stubs (skipped).

## Diagnóstico
- Logs: `~/Library/Logs/wonderland.out.log` y `.err.log`.
- Estado: `~/Library/Application Support/wonderland/schedule-state.json`.
- Kill switch: `QUARANTINE=true` en el `.env` de la bestia → todo observa, nada corre.
- ¿Cargado? `launchctl print gui/$(id -u)/com.hygge.wonderland`.
```

- [ ] **Step 5: Commit**

```bash
git add alicia-brain/docs/WONDERLAND_IT.md alicia-brain/docs/BESTIA_RUNBOOK.md
git commit -m "docs(wonderland): Knave + runbook del reloj único de la bestia"
```

---

## Self-Review

**Spec coverage:**
- Reloj único (arquitectura) → Tasks 5, 6, 7. ✅
- Knave (migración + checks + L0) → Tasks 1, 2, 3. ✅
- Stubs Bandersnatch/Jabberwocky → Task 4. ✅
- Reporte a Railway con x-agent-key → Task 3 (`defaultReporter`). ✅
- Registro de Knave en Dark Alice / Tea Table → Task 1 Step 6. ✅
- QUARANTINE → Tasks 3 y 6. ✅
- Migración segura del plist viejo (no perder heartbeat) → Task 7 (`ensureWonderlandClock` solo retira tras confirmar). ✅
- Cheshire agendado por el reloj → Task 5 (`SCHEDULE`). ✅
- `npm audit` / `security-review` → representados como jobs `knave-audit` / `knave-review` en `SCHEDULE` (Task 5); la implementación del modo `audit`/`review` dentro de `knave.js` se deja como extensión guiada por `process.argv[2]` (ver nota abajo). ⚠️

**Nota de alcance (audit/review):** `knave.js` v1 implementa los checks pasivos (headers/CORS/auth). Los modos `audit` (`npm audit`) y `review` (`security-review`) están cableados en el `SCHEDULE` y se disparan como `knave.js audit` / `knave.js review`, pero su cuerpo se implementa como extensión: `audit` corre `npm audit --json` y reporta findings de deps; `review` es best-effort (shell-out al CLI `claude` si está disponible, si no loguea y sale 0). Esto evita bloquear v1 y mantiene a Knave degradable. Si se quiere en este build, agregar un Task 3b análogo a Task 3.

**Placeholder scan:** sin TBD/TODO en código; los pasos de launchd (Task 7) son shell real, verificados manualmente por ser efecto de sistema. ✅

**Type consistency:** `Finding = {severity, category, detail}` consistente entre `knave-checks.js` (Task 2) y `knave.js` (Task 3). `SCHEDULE`/`dueJobs`/`markRan` consistentes entre Task 5 y su uso en Task 6. `buildSkippedReport` firma idéntica en ambos stubs (Task 4). ✅

## Global note
No pushear ni mergear a `main` hasta que la sesión Bammy cierre (PR #36). El trabajo vive en el worktree `feat/wonderland-cheshire-knave`; la bestia solo verá esto tras el merge.
