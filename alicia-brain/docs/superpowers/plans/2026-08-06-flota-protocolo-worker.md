# Flota de scrapers · Plan 1 — Protocolo de worker + cola de jobs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el lado-Railway de la flota de scrapers — cola de jobs + registro/heartbeat de workers + recepción de resultados + detección de "fuente que no se refrescó" — todo testeable con un worker fake, sin depender del Mac Pro.

**Architecture:** Un módulo nuevo `src/fleet.js` con la lógica de cola y workers (funciones puras sobre el helper `query` de `db.js`), expuesto por endpoints bajo `/api/agents/workers/*` (pasan el `panelGate` con `x-agent-key`). El scout (dentro de `cron.js`) encola jobs y compara el `scraped_at` real por fuente contra lo esperado; si una fuente no se refrescó, escribe un `finding`. No toca el scraping existente (Nexo/Urbania/SBS siguen igual).

**Tech Stack:** Node ESM, `node:sqlite` (DatabaseSync), Express, `node:test` + `node:assert`. Sin dependencias nuevas.

## Global Constraints

- **Agente en `agent_runs`:** la columna `agent` tiene un CHECK que solo permite `white-rabbit, cheshire, bandersnatch, mad-hatter, jabberwocky, dark-alice, tea-table`. La flota reporta bajo **`white-rabbit`** (rol de datos). NO agregar agentes nuevos al CHECK en este plan.
- **Auth de worker:** endpoints bajo `/api/agents/workers/*` + middleware `requireAgentKey` (valida `x-agent-key` contra `AGENTS_API_KEY`). El `panelGate` global solo abre `x-agent-key` en rutas `/agents/*`.
- **Acceso a datos:** siempre vía `query(sql, params)` de `./db.js`. No abrir la DB directo.
- **Tests:** archivos `test/*.test.mjs`, ejecutables con `node --test`. Para lógica con DB, setear `process.env.SQLITE_PATH = ":memory:"` ANTES de importar `db.js`.
- **No romper lo existente:** no modificar `market.js`, `scrapers/`, ni el orden de canales de WhatsApp.

---

## File Structure

- **Create** `src/fleet.js` — lógica de la flota: `enqueueJob`, `claimJob`, `completeJob`, `recordHeartbeat`, `activeWorkers`, `staleSources`. Una responsabilidad: estado de cola y workers.
- **Modify** `src/db.js` — agregar tablas `scrape_jobs` y `workers` en `initSchema`.
- **Modify** `src/server.js` — 3 endpoints bajo `/api/agents/workers/*`.
- **Modify** `src/cron.js` — el scout: encolar jobs por fuente + chequear fuentes stale.
- **Create** `test/fleet.test.mjs` — tests de la lógica de cola/workers/stale.

---

### Task 1: Tablas `scrape_jobs` y `workers`

**Files:**
- Modify: `src/db.js` (dentro de `initSchema`, después del bloque `agent_findings`)
- Test: `test/fleet.test.mjs`

**Interfaces:**
- Produces: dos tablas SQLite.
  - `scrape_jobs(id, source, status['pending'|'claimed'|'done'|'failed'], worker_id, rows_count, error, created_at, claimed_at, finished_at)`
  - `workers(worker_id PK, node, caps, last_seen)`

- [ ] **Step 1: Escribir el test que falla**

```js
// test/fleet.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
process.env.SQLITE_PATH = ":memory:";           // DB efímera ANTES de importar db
const { query } = await import("../src/db.js");

test("schema: scrape_jobs y workers existen con columnas esperadas", () => {
  const jobCols = query(`PRAGMA table_info(scrape_jobs)`).rows.map(r => r.name);
  for (const c of ["id","source","status","worker_id","rows_count","error","created_at","claimed_at","finished_at"])
    assert.ok(jobCols.includes(c), `falta columna scrape_jobs.${c}`);
  const wCols = query(`PRAGMA table_info(workers)`).rows.map(r => r.name);
  for (const c of ["worker_id","node","caps","last_seen"])
    assert.ok(wCols.includes(c), `falta columna workers.${c}`);
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `node --test test/fleet.test.mjs`
Expected: FAIL — `PRAGMA table_info(scrape_jobs)` devuelve filas vacías (columnas no incluyen las esperadas).

- [ ] **Step 3: Agregar las tablas en `initSchema`**

En `src/db.js`, justo después del `CREATE INDEX ... idx_agent_findings ...`, agregar dentro del mismo `db.exec(\`...\`)`:

```sql
    CREATE TABLE IF NOT EXISTS scrape_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','claimed','done','failed')),
      worker_id TEXT,
      rows_count INTEGER DEFAULT 0,
      error TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      claimed_at TEXT,
      finished_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status ON scrape_jobs(status, created_at);
    CREATE TABLE IF NOT EXISTS workers (
      worker_id TEXT PRIMARY KEY,
      node TEXT,
      caps TEXT DEFAULT '[]',
      last_seen TEXT DEFAULT (datetime('now'))
    );
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `node --test test/fleet.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db.js test/fleet.test.mjs
git commit -m "feat(fleet): tablas scrape_jobs y workers"
```

---

### Task 2: Lógica de cola y heartbeat (`fleet.js`)

**Files:**
- Create: `src/fleet.js`
- Test: `test/fleet.test.mjs` (agregar tests)

**Interfaces:**
- Consumes: `query` de `./db.js`.
- Produces:
  - `recordHeartbeat({ workerId, node, caps })` → upsert en `workers`, devuelve `{ ok: true }`.
  - `activeWorkers(withinSec = 120)` → array de `{ worker_id, node, caps, last_seen }` vistos hace ≤ withinSec.
  - `enqueueJob(source)` → inserta job `pending`, devuelve `{ id, source, status }`.
  - `claimJob(workerId)` → toma el job `pending` más viejo (lo pasa a `claimed`, setea `worker_id`/`claimed_at`), devuelve el job o `null`.
  - `completeJob({ jobId, workerId, rowsCount, error })` → si hay error → `failed`; si no → `done`. Setea `finished_at`. Devuelve `{ ok, status }`.

- [ ] **Step 1: Escribir los tests que fallan**

```js
// añadir a test/fleet.test.mjs
const fleet = await import("../src/fleet.js");

test("heartbeat registra worker y activeWorkers lo ve", () => {
  fleet.recordHeartbeat({ workerId: "mac-pro", node: "MacPro", caps: ["urbania"] });
  const active = fleet.activeWorkers(120);
  assert.ok(active.some(w => w.worker_id === "mac-pro"));
});

test("enqueue + claim + complete recorre el ciclo", () => {
  const job = fleet.enqueueJob("urbania");
  assert.equal(job.status, "pending");
  const claimed = fleet.claimJob("mac-pro");
  assert.equal(claimed.id, job.id);
  assert.equal(claimed.source, "urbania");
  const done = fleet.completeJob({ jobId: job.id, workerId: "mac-pro", rowsCount: 42 });
  assert.equal(done.status, "done");
  // ya no hay pendientes
  assert.equal(fleet.claimJob("mac-pro"), null);
});

test("completeJob con error marca failed", () => {
  const job = fleet.enqueueJob("sbs");
  fleet.claimJob("mac-pro");
  const r = fleet.completeJob({ jobId: job.id, workerId: "mac-pro", rowsCount: 0, error: "challenge" });
  assert.equal(r.status, "failed");
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `node --test test/fleet.test.mjs`
Expected: FAIL — `Cannot find module '../src/fleet.js'`.

- [ ] **Step 3: Implementar `src/fleet.js`**

```js
// src/fleet.js — estado de la flota de scrapers (cola + workers). Ver docs/superpowers/specs/2026-08-06-flota-scrapers-self-hosted-design.md
import { query } from "./db.js";

export function recordHeartbeat({ workerId, node = null, caps = [] }) {
  query(
    `INSERT INTO workers (worker_id, node, caps, last_seen) VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(worker_id) DO UPDATE SET node = excluded.node, caps = excluded.caps, last_seen = datetime('now')`,
    [workerId, node, JSON.stringify(caps)]
  );
  return { ok: true };
}

export function activeWorkers(withinSec = 120) {
  return query(
    `SELECT worker_id, node, caps, last_seen FROM workers
      WHERE last_seen >= datetime('now', ?) ORDER BY last_seen DESC`,
    [`-${withinSec} seconds`]
  ).rows;
}

export function enqueueJob(source) {
  const { rows } = query(
    `INSERT INTO scrape_jobs (source, status) VALUES (?, 'pending') RETURNING id, source, status`,
    [source]
  );
  return rows[0];
}

export function claimJob(workerId) {
  const { rows } = query(
    `SELECT id, source FROM scrape_jobs WHERE status = 'pending' ORDER BY created_at, id LIMIT 1`
  );
  if (!rows[0]) return null;
  const job = rows[0];
  query(
    `UPDATE scrape_jobs SET status = 'claimed', worker_id = ?, claimed_at = datetime('now') WHERE id = ?`,
    [workerId, job.id]
  );
  return { id: job.id, source: job.source, status: "claimed" };
}

export function completeJob({ jobId, workerId, rowsCount = 0, error = null }) {
  const status = error ? "failed" : "done";
  query(
    `UPDATE scrape_jobs SET status = ?, rows_count = ?, error = ?, finished_at = datetime('now')
      WHERE id = ? AND worker_id = ?`,
    [status, rowsCount, error, jobId, workerId]
  );
  return { ok: true, status };
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `node --test test/fleet.test.mjs`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add src/fleet.js test/fleet.test.mjs
git commit -m "feat(fleet): cola de jobs + heartbeat de workers"
```

---

### Task 3: Detección de fuentes stale (`staleSources`)

**Files:**
- Modify: `src/fleet.js`
- Test: `test/fleet.test.mjs`

**Interfaces:**
- Consumes: tabla `market_snapshots` (columna `source`, `scraped_at`), `query`.
- Produces:
  - `staleSources(expected)` — `expected` es `{ [source]: maxAgeSec }`. Devuelve array de `{ source, lastScrapedAt|null, ageSec|null, reason }` para cada fuente cuyo último `scraped_at` es más viejo que `maxAgeSec`, o que nunca se scrapeó. Esta es la lección del 06-ago: medir el refresco real, no confiar en el cron.

- [ ] **Step 1: Escribir el test que falla**

```js
// añadir a test/fleet.test.mjs
test("staleSources detecta fuente vieja y fuente ausente", () => {
  // nexo: snapshot fresco; urbania: nunca; (sbs no se pide)
  query(`INSERT INTO market_snapshots (source, total, data, scraped_at) VALUES ('nexo', 1, '[]', datetime('now'))`);
  const stale = fleet.staleSources({ nexo: 3600, urbania: 3600 });
  const bySource = Object.fromEntries(stale.map(s => [s.source, s]));
  assert.ok(!bySource.nexo, "nexo fresco NO debe salir stale");
  assert.ok(bySource.urbania, "urbania ausente DEBE salir stale");
  assert.equal(bySource.urbania.lastScrapedAt, null);
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `node --test test/fleet.test.mjs`
Expected: FAIL — `fleet.staleSources is not a function`.

- [ ] **Step 3: Implementar `staleSources` en `src/fleet.js`**

```js
// añadir a src/fleet.js
export function staleSources(expected) {
  const out = [];
  for (const [source, maxAgeSec] of Object.entries(expected)) {
    const { rows } = query(
      `SELECT scraped_at, (strftime('%s','now') - strftime('%s', scraped_at)) AS age_sec
         FROM market_snapshots WHERE source = ? ORDER BY scraped_at DESC LIMIT 1`,
      [source]
    );
    if (!rows[0]) { out.push({ source, lastScrapedAt: null, ageSec: null, reason: "nunca scrapeada" }); continue; }
    const ageSec = Number(rows[0].age_sec);
    if (ageSec > maxAgeSec) out.push({ source, lastScrapedAt: rows[0].scraped_at, ageSec, reason: `${ageSec}s > ${maxAgeSec}s` });
  }
  return out;
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `node --test test/fleet.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/fleet.js test/fleet.test.mjs
git commit -m "feat(fleet): staleSources — medir refresco real por fuente"
```

---

### Task 4: Endpoints de worker (`/api/agents/workers/*`)

**Files:**
- Modify: `src/server.js` (junto a los otros `/api/agents/*`, cerca de la línea 1515)
- Test: `test/fleet-endpoints.test.mjs` (nuevo — arranca el app en un puerto efímero)

**Interfaces:**
- Consumes: `fleet.js` (recordHeartbeat, claimJob, completeJob), `requireAgentKey`.
- Produces (todos requieren header `x-agent-key: $AGENTS_API_KEY`):
  - `POST /api/agents/workers/heartbeat` body `{ workerId, node, caps }` → `{ ok: true }`
  - `GET  /api/agents/workers/next?workerId=X` → `{ job: {id, source} | null }`
  - `POST /api/agents/workers/result` body `{ jobId, workerId, source, rows, error }` → guarda vía `saveSnapshot(rows, source)` si hay filas, marca el job, devuelve `{ ok, status }`

- [ ] **Step 1: Escribir el test de integración que falla**

```js
// test/fleet-endpoints.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
process.env.SQLITE_PATH = ":memory:";
process.env.AGENTS_API_KEY = "test-key";
process.env.PANEL_PASSWORD = "x";               // panelGate no debe quedar en 503
let base, server;
before(async () => {
  const mod = await import("../src/server.js");   // debe exportar `app`
  server = mod.app.listen(0);
  await new Promise(r => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server?.close());
const H = { "content-type": "application/json", "x-agent-key": "test-key" };

test("heartbeat → next → result recorre el protocolo", async () => {
  let r = await fetch(`${base}/api/agents/workers/heartbeat`, { method: "POST", headers: H, body: JSON.stringify({ workerId: "mac-pro", node: "MacPro", caps: ["urbania"] }) });
  assert.equal((await r.json()).ok, true);
  // encolar un job directo por fleet para no depender del scout
  const fleet = await import("../src/fleet.js");
  const job = fleet.enqueueJob("urbania");
  r = await fetch(`${base}/api/agents/workers/next?workerId=mac-pro`, { headers: H });
  const { job: got } = await r.json();
  assert.equal(got.id, job.id);
  r = await fetch(`${base}/api/agents/workers/result`, { method: "POST", headers: H, body: JSON.stringify({ jobId: job.id, workerId: "mac-pro", source: "urbania", rows: [{ distrito: "Miraflores", price: 100 }] }) });
  assert.equal((await r.json()).status, "done");
});

test("sin x-agent-key → 401", async () => {
  const r = await fetch(`${base}/api/agents/workers/heartbeat`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal(r.status, 401);
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `node --test test/fleet-endpoints.test.mjs`
Expected: FAIL — `app` no exportado y/o rutas 404.

- [ ] **Step 3a: Exportar `app` en `server.js`**

Verificar el final de `src/server.js`: donde hace `app.listen(...)`, agregar antes o en su lugar un export. Si el arranque es incondicional, envolverlo:

```js
export { app };
// Arrancar solo si este módulo es el entrypoint (no bajo test)
if (process.env.NODE_ENV !== "test" && !process.env.FLEET_TEST) {
  app.listen(PORT, () => { /* ...log existente... */ });
}
```
El test setea el listen por su cuenta; para evitar doble-listen, el test corre con `FLEET_TEST=1` o el guard `NODE_ENV`. (Ajustar el guard al patrón real del archivo — si ya hay uno, reutilizarlo.)

- [ ] **Step 3b: Agregar los 3 endpoints** (cerca de los otros `/api/agents/*`, ~línea 1515)

```js
import * as fleet from "./fleet.js";               // (si el archivo usa imports arriba; si no, mover al tope)

app.post("/api/agents/workers/heartbeat", requireAgentKey, (req, res) => {
  const { workerId, node, caps } = req.body || {};
  if (!workerId) return res.status(400).json({ error: "workerId requerido" });
  res.json(fleet.recordHeartbeat({ workerId, node, caps: Array.isArray(caps) ? caps : [] }));
});

app.get("/api/agents/workers/next", requireAgentKey, (req, res) => {
  const workerId = req.query.workerId;
  if (!workerId) return res.status(400).json({ error: "workerId requerido" });
  res.json({ job: fleet.claimJob(String(workerId)) });
});

app.post("/api/agents/workers/result", requireAgentKey, (req, res) => {
  const { jobId, workerId, source, rows, error } = req.body || {};
  if (!jobId || !workerId) return res.status(400).json({ error: "jobId y workerId requeridos" });
  if (Array.isArray(rows) && rows.length && source) {
    const { saveSnapshot } = require ? require("./market.js") : null; // ver nota
  }
  res.json(fleet.completeJob({ jobId, workerId, rowsCount: Array.isArray(rows) ? rows.length : 0, error: error || null }));
});
```

Nota: `market.js` exporta `saveSnapshot` (ESM). Importarlo arriba con `import { saveSnapshot } from "./market.js";` y usarlo directo (no `require`). Reescribir el bloque de `rows` así:

```js
  if (Array.isArray(rows) && rows.length && source) saveSnapshot(rows, source);
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `FLEET_TEST=1 node --test test/fleet-endpoints.test.mjs`
Expected: PASS (protocolo completo + 401 sin key).

- [ ] **Step 5: Commit**

```bash
git add src/server.js test/fleet-endpoints.test.mjs
git commit -m "feat(fleet): endpoints /api/agents/workers/* (heartbeat/next/result)"
```

---

### Task 5: El scout encola + alarma de cobertura (en `cron.js`)

**Files:**
- Modify: `src/cron.js`
- Modify: `src/fleet.js` (helper `raiseCoverageFinding`)
- Test: `test/fleet.test.mjs`

**Interfaces:**
- Consumes: `enqueueJob`, `activeWorkers`, `staleSources`, `query`.
- Produces:
  - `raiseCoverageFinding(stale)` — por cada fuente stale, inserta un `agent_findings` (agent `white-rabbit`, category `coverage`, severity `major`, status `open`) si no hay ya uno abierto para esa fuente. Devuelve nº de findings creados.
  - En `cron.js`: un cron `scoutTick()` que (a) para cada fuente configurada, si hay worker activo, `enqueueJob(source)`; (b) corre `staleSources` + `raiseCoverageFinding`.

- [ ] **Step 1: Escribir el test que falla**

```js
// añadir a test/fleet.test.mjs
test("raiseCoverageFinding crea 1 finding por fuente stale y no duplica", () => {
  const stale = [{ source: "urbania", lastScrapedAt: null, ageSec: null, reason: "nunca scrapeada" }];
  const n1 = fleet.raiseCoverageFinding(stale);
  assert.equal(n1, 1);
  const n2 = fleet.raiseCoverageFinding(stale);   // ya hay uno abierto → no duplica
  assert.equal(n2, 0);
  const open = query(`SELECT COUNT(*) AS c FROM agent_findings WHERE category='coverage' AND status='open'`).rows[0].c;
  assert.equal(open, 1);
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `node --test test/fleet.test.mjs`
Expected: FAIL — `fleet.raiseCoverageFinding is not a function`.

- [ ] **Step 3: Implementar `raiseCoverageFinding` en `fleet.js`**

```js
// añadir a src/fleet.js
export function raiseCoverageFinding(stale) {
  let created = 0;
  for (const s of stale) {
    const exists = query(
      `SELECT 1 FROM agent_findings WHERE category='coverage' AND status='open' AND detail LIKE ? LIMIT 1`,
      [`%${s.source}%`]
    ).rows[0];
    if (exists) continue;
    query(
      `INSERT INTO agent_findings (agent, severity, category, detail, status)
       VALUES ('white-rabbit', 'major', 'coverage', ?, 'open')`,
      [`Radar: fuente '${s.source}' sin refrescar (${s.reason}). Revisar scraper/worker.`]
    );
    created++;
  }
  return created;
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `node --test test/fleet.test.mjs`
Expected: PASS.

- [ ] **Step 5: Conectar el scout en `cron.js`**

En `src/cron.js`, dentro de `startCron()`, agregar (importar arriba `import { enqueueJob, activeWorkers, staleSources, raiseCoverageFinding } from "./fleet.js";`):

```js
  // Scout de la flota 🐰 · encola jobs a los workers vivos + alarma de cobertura, cada 30 min
  const FLEET_SOURCES = { urbania: 12 * 3600, nexo: 2 * 3600 };  // maxAge por fuente
  cron.schedule("5,35 * * * *", async () => {
    try {
      const workers = activeWorkers(180);
      if (workers.length) for (const src of Object.keys(FLEET_SOURCES)) enqueueJob(src);
      const created = raiseCoverageFinding(staleSources(FLEET_SOURCES));
      if (created) console.log(`🐰 Scout: ${created} finding(s) de cobertura`);
    } catch (e) { console.error("Scout tick error:", e.message); }
  }, { timezone: "America/Lima" });
```

- [ ] **Step 6: Verificar que el server sigue levantando (smoke)**

Run: `node --check src/cron.js && node --check src/fleet.js && node --check src/server.js`
Expected: sin errores de sintaxis.

- [ ] **Step 7: Commit**

```bash
git add src/fleet.js src/cron.js test/fleet.test.mjs
git commit -m "feat(fleet): scout encola jobs + alarma de cobertura (coverage findings)"
```

---

## Self-Review

- **Spec coverage:** cubre del spec §4.2 (protocolo de endpoints), §4.3 punto 1 (encolar) y punto 2 (detección "no refrescó"), §3.1 (pull: el worker pide con `/next`). NO cubre (van a Plan 2+): el worker real en Mac Pro (§4.1), failover (§3.3), dedup/validación contra benchmark (§4.3 p3-4), backups (§4.4). Esos dependen de infra (Tailscale/Mac Pro) o son fases posteriores.
- **Placeholders:** ninguno — todos los steps tienen test e implementación reales. La única nota abierta es el guard de `app.listen` en Task 4 Step 3a: adaptarlo al patrón real del final de `server.js` (reutilizar guard existente si lo hay).
- **Type consistency:** `enqueueJob`→`{id,source,status}`, `claimJob`→`{id,source,status}|null`, `completeJob`→`{ok,status}`, `staleSources`→`[{source,lastScrapedAt,ageSec,reason}]` usados consistentemente en tasks 2-5.

## Bloqueo conocido (para el ejecutor)
Este plan NO necesita el Mac Pro. El **Plan 2** (worker real con Playwright en el Mac Pro) requiere Tailscale logueado en las máquinas — hoy el CLI del laptop reporta `Logged out`. Destrabar eso antes de arrancar el Plan 2.
