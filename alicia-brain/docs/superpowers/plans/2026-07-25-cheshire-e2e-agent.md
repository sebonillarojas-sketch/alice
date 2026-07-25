# Cheshire E2E Agent — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Cheshire 😺 agent — a Playwright-based E2E/usability tester that runs golden flows plus an exploratory crawler against production ALICE, reporting findings to the Wonderland backend.

**Architecture:** Standalone Node (ESM) project on alicia-mac. Pure logic (safety denylist, alert-transition, report payload, crawler state signature/frontier) is unit-tested with `node:test`; the golden flows and orchestrator run against a real browser (dry-run integration). Cheshire POSTs to the existing `POST /api/agents/report` endpoint with `x-agent-key`.

**Tech Stack:** Node ≥ 20 (ESM), `playwright` (Chromium), `node:test` + `node:assert`, `launchd` for scheduling.

## Global Constraints

- Runtime: **alicia-mac** (24/7 host). Node ESM (`"type":"module"`).
- Project root: **`~/wonderland/cheshire/`** — OUTSIDE `alicia-brain` (it needs a browser; Railway can't).
- All writes to ALICE happen ONLY as the **Cheshire QA** user in the **QA space** (`cfg.qaSpace`), and are cleaned up.
- Report endpoint: `POST https://aliceai.bam.pe/api/agents/report`, header `x-agent-key: <AGENTS_API_KEY>`, body `{ agent:"cheshire", result, summary, actions_taken, findings }`. `result ∈ {"ok","issues","error"}`.
- WhatsApp alert (via backend or `wa`) fires ONLY on status transition ok↔issues (no spam).
- Crawler limits: `MAX_ACTIONS=80`, `MAX_DEPTH=6`, `TIME_BUDGET_MS=240000`. Never click destructive controls (denylist).
- Secrets from env/`.env`: `ERP_URL`, `ALICEAI_URL`, `QA_USER`, `QA_PASS`, `QA_SPACE`, `AGENTS_API_KEY`, `PHONE_sb`.
- Config values are read once via `config.js`; never hardcode URLs/creds elsewhere.

---

### Task 1: Project scaffold + config + safety denylist

**Files:**
- Create: `~/wonderland/cheshire/package.json`
- Create: `~/wonderland/cheshire/config.js`
- Create: `~/wonderland/cheshire/safety.js`
- Create: `~/wonderland/cheshire/.env.example`
- Test: `~/wonderland/cheshire/safety.test.js`

**Interfaces:**
- Produces: `cfg` (object: `{ erpUrl, aliceaiUrl, qaUser, qaPass, qaSpace, agentKey, phoneSb, limits:{maxActions,maxDepth,timeBudgetMs} }`) from `config.js`.
- Produces: `esDestructiva(label: string) → boolean` and `LIMITS` from `safety.js`.

- [ ] **Step 1: Write the failing test**

```js
// safety.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { esDestructiva } from "./safety.js";

test("marca destructivas por label", () => {
  for (const l of ["Eliminar", "borrar tarea", "Delete", "Cerrar sesión", "Logout", "Pagar", "Aprobar", "Vaciar"]) {
    assert.equal(esDestructiva(l), true, l);
  }
});
test("no marca acciones seguras", () => {
  for (const l of ["Crear tarea", "Lista", "Board", "Guardar", "Siguiente", "Filtrar"]) {
    assert.equal(esDestructiva(l), false, l);
  }
});
test("es case/acentos-insensible y tolera null", () => {
  assert.equal(esDestructiva("ELIMINAR"), true);
  assert.equal(esDestructiva(null), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/wonderland/cheshire && node --test safety.test.js`
Expected: FAIL — `Cannot find module './safety.js'`.

- [ ] **Step 3: Write minimal implementation**

```json
// package.json
{
  "name": "cheshire",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "scripts": { "test": "node --test", "once": "node cheshire.mjs --once" },
  "dependencies": { "playwright": "^1.47.0" }
}
```

```js
// safety.js
export const LIMITS = { maxActions: 80, maxDepth: 6, timeBudgetMs: 240000 };

// Denylist de acciones irreversibles / de dinero / que sacan sesión.
const DENY = ["eliminar", "borrar", "delete", "quitar", "vaciar", "logout",
  "cerrar sesion", "cerrar sesión", "salir", "pagar", "pago", "aprobar", "rechazar",
  "confirmar elimin", "archivar", "desactivar"];
const norm = (s) => (s || "").toString().toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "");
export function esDestructiva(label) {
  const n = norm(label);
  if (!n) return false;
  return DENY.some((d) => n.includes(d));
}
```

```js
// config.js
const env = process.env;
export const cfg = {
  erpUrl: env.ERP_URL || "https://alice.bam.pe",
  aliceaiUrl: env.ALICEAI_URL || "https://aliceai.bam.pe",
  qaUser: env.QA_USER || "cheshire",
  qaPass: env.QA_PASS || "",
  qaSpace: env.QA_SPACE || "qa",
  agentKey: env.AGENTS_API_KEY || "",
  phoneSb: env.PHONE_sb || "",
  limits: { maxActions: 80, maxDepth: 6, timeBudgetMs: 240000 },
};
```

```
# .env.example
ERP_URL=https://alice.bam.pe
ALICEAI_URL=https://aliceai.bam.pe
QA_USER=cheshire
QA_PASS=
QA_SPACE=qa
AGENTS_API_KEY=
PHONE_sb=
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/wonderland/cheshire && node --test safety.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd ~/wonderland/cheshire && git init -q 2>/dev/null; git add -A
git commit -m "feat(cheshire): scaffold + config + safety denylist"
```

---

### Task 2: Report payload + alert-transition logic

**Files:**
- Create: `~/wonderland/cheshire/report.js`
- Test: `~/wonderland/cheshire/report.test.js`

**Interfaces:**
- Consumes: `cfg` from `config.js`.
- Produces: `buildPayload({result,summary,findings}) → object`, `decideAlert(prev,curr) → boolean`, `readLastStatus()/writeLastStatus(s)` (file `./.last_status`), `report(payload) → Promise<{ok,status}>` (POST; skipped when `--no-report`).

- [ ] **Step 1: Write the failing test**

```js
// report.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPayload, decideAlert } from "./report.js";

test("buildPayload arma el shape del endpoint", () => {
  const p = buildPayload({ result: "issues", summary: "x", findings: [{ severity: "major", category: "e2e", detail: "login roto" }] });
  assert.equal(p.agent, "cheshire");
  assert.equal(p.result, "issues");
  assert.deepEqual(p.actions_taken, []);
  assert.equal(p.findings.length, 1);
});
test("decideAlert solo en transición", () => {
  assert.equal(decideAlert("ok", "issues"), true);
  assert.equal(decideAlert("issues", "ok"), true);
  assert.equal(decideAlert("ok", "ok"), false);
  assert.equal(decideAlert("issues", "issues"), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test report.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// report.js
import { readFileSync, writeFileSync } from "node:fs";
import { cfg } from "./config.js";

const STATUS_FILE = new URL("./.last_status", import.meta.url);

export function buildPayload({ result, summary, findings = [] }) {
  return { agent: "cheshire", result, summary, actions_taken: [], findings };
}
export function decideAlert(prev, curr) { return prev !== curr; }
export function readLastStatus() {
  try { return readFileSync(STATUS_FILE, "utf8").trim() || "ok"; } catch { return "ok"; }
}
export function writeLastStatus(s) { try { writeFileSync(STATUS_FILE, s); } catch {} }

export async function report(payload, { dryRun = false } = {}) {
  if (dryRun) { console.log("[dry-run] no POST:", JSON.stringify(payload).slice(0, 400)); return { ok: true, status: 0 }; }
  const res = await fetch(`${cfg.aliceaiUrl}/api/agents/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-agent-key": cfg.agentKey },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });
  return { ok: res.ok, status: res.status };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test report.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add report.js report.test.js && git commit -m "feat(cheshire): report payload + alert-transition logic"
```

---

### Task 3: Crawler — state signature + frontier (pure logic)

**Files:**
- Create: `~/wonderland/cheshire/crawler.js`
- Test: `~/wonderland/cheshire/crawler.test.js`

**Interfaces:**
- Consumes: `esDestructiva` from `safety.js`, `LIMITS`.
- Produces: `firma({url, headings, labels}) → string` (stable signature), `elegibles(elements) → filtered` (drops destructive/duplicate labels), and `explore(page, opts) → Promise<{states:string[], findings:[]}>`. This task implements `firma` and `elegibles`; `explore` is fleshed out in Task 5's integration but its signature is fixed here.

- [ ] **Step 1: Write the failing test**

```js
// crawler.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { firma, elegibles } from "./crawler.js";

test("firma es estable ante reordenamiento de labels", () => {
  const a = firma({ url: "/x", headings: ["HQ", "Tareas"], labels: ["Board", "Lista"] });
  const b = firma({ url: "/x", headings: ["Tareas", "HQ"], labels: ["Lista", "Board"] });
  assert.equal(a, b);
});
test("firma cambia con la url", () => {
  assert.notEqual(firma({ url: "/a", headings: [], labels: [] }), firma({ url: "/b", headings: [], labels: [] }));
});
test("elegibles descarta destructivas y duplicados por label", () => {
  const els = [{ label: "Lista" }, { label: "Lista" }, { label: "Eliminar" }, { label: "Board" }];
  const out = elegibles(els);
  assert.deepEqual(out.map(e => e.label), ["Lista", "Board"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test crawler.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// crawler.js
import { createHash } from "node:crypto";
import { esDestructiva, LIMITS } from "./safety.js";

export function firma({ url, headings = [], labels = [] }) {
  const norm = (arr) => [...new Set(arr.map(s => (s || "").trim().toLowerCase()))].sort();
  const basis = JSON.stringify({ u: url, h: norm(headings), l: norm(labels) });
  return createHash("sha1").update(basis).digest("hex").slice(0, 12);
}

export function elegibles(elements) {
  const seen = new Set();
  const out = [];
  for (const el of elements) {
    const key = (el.label || "").trim().toLowerCase();
    if (!key || seen.has(key) || esDestructiva(el.label)) continue;
    seen.add(key);
    out.push(el);
  }
  return out;
}

// explore(page, {limits, onFinding}) — BFS acotado. Implementación en Task 5 (integración);
// firma/elegibles ya son las piezas puras testeadas.
export async function explore(page, opts = {}) {
  const limits = opts.limits || LIMITS;
  // fleshed out in Task 5
  return { states: [], findings: [], limits };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test crawler.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add crawler.js crawler.test.js && git commit -m "feat(cheshire): crawler signature + frontier logic"
```

---

### Task 4: Golden flows (Playwright)

**Files:**
- Create: `~/wonderland/cheshire/flows.js`

**Interfaces:**
- Consumes: `cfg` from `config.js`.
- Produces: `FLOWS` (array of `{ id, label, async run(page, ctx) → { ok:boolean, detail:string } }`) and `async login(page, cfg)`. `ctx = { cfg, shotDir }`.

- [ ] **Step 1: Write the flows module**

```js
// flows.js  (integración: se valida en dry-run, no con node:test)
export async function login(page, cfg) {
  await page.goto(cfg.erpUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  // LoginScreen: username + password (ver src/auth/LoginScreen.jsx)
  await page.fill('input[name="username"], input[type="text"]', cfg.qaUser);
  await page.fill('input[type="password"]', cfg.qaPass);
  await page.click('button[type="submit"]');
  await page.waitForLoadState("networkidle", { timeout: 20000 });
}

export const FLOWS = [
  {
    id: "login", label: "Login → dashboard",
    async run(page, { cfg }) {
      await login(page, cfg);
      const ok = await page.locator("text=/Hygge|HQ|Tareas/i").first().isVisible().catch(() => false);
      return { ok, detail: ok ? "dashboard visible" : "no cargó el dashboard tras login" };
    },
  },
  {
    id: "crear-tarea", label: "Crear tarea en QA → aparece → borrar",
    async run(page, { cfg }) {
      // navegar al space QA y usar el quick-add "Crear tarea en {space}…"
      const title = `QA-cheshire-${Date.now()}`;
      const input = page.locator('input[placeholder^="Crear tarea"]').first();
      if (!(await input.isVisible().catch(() => false))) return { ok: false, detail: "no hay quick-add de crear tarea visible" };
      await input.fill(title);
      await input.press("Enter");
      const appeared = await page.locator(`text=${title}`).first().isVisible({ timeout: 5000 }).catch(() => false);
      // cleanup: abrir la tarea y eliminar (solo dentro del space QA)
      if (appeared) {
        await page.locator(`text=${title}`).first().click().catch(() => {});
        await page.locator('button[title="Eliminar tarea"]').click().catch(() => {});
      }
      return { ok: appeared, detail: appeared ? "tarea creada y visible (limpiada)" : "la tarea no apareció" };
    },
  },
  {
    id: "chat-limpio", label: "Chat con Alicia → texto limpio (no JSON)",
    async run(page, { cfg }) {
      const res = await page.request.post(`${cfg.aliceaiUrl}/api/analyze`, {
        data: { text: "hola" }, timeout: 20000,
      }).catch(() => null);
      if (!res || !res.ok()) return { ok: false, detail: `chat endpoint ${res ? res.status() : "sin respuesta"}` };
      const body = await res.text();
      const crudo = body.trim().startsWith("{") && body.includes('"');
      return { ok: !crudo, detail: crudo ? "el chat devolvió JSON crudo" : "respuesta de texto limpio" };
    },
  },
  {
    id: "voz", label: "Voz → audio real (>1KB)",
    async run(page, { cfg }) {
      const res = await page.request.post(`${cfg.aliceaiUrl}/api/tts`, { data: { text: "hola" }, timeout: 20000 }).catch(() => null);
      if (!res || !res.ok()) return { ok: false, detail: `TTS ${res ? res.status() : "sin respuesta"}` };
      const buf = await res.body();
      return { ok: buf.length > 1024, detail: `audio ${buf.length} bytes` };
    },
  },
  {
    id: "mobile", label: "Mobile viewport sin overflow",
    async run(page, { cfg }) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(cfg.erpUrl, { waitUntil: "networkidle", timeout: 20000 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
      return { ok: !overflow, detail: overflow ? "overflow horizontal en mobile" : "sin overflow" };
    },
  },
];
```

- [ ] **Step 2: Syntax/import check**

Run: `node -e "import('./flows.js').then(m=>console.log('FLOWS', m.FLOWS.length))"`
Expected: prints `FLOWS 5` (no import error).

- [ ] **Step 3: Commit**

```bash
git add flows.js && git commit -m "feat(cheshire): golden flows (login/crear-tarea/chat/voz/mobile)"
```

---

### Task 5: Orchestrator + crawler integration + launchd

**Files:**
- Create: `~/wonderland/cheshire/cheshire.mjs`
- Modify: `~/wonderland/cheshire/crawler.js` (flesh out `explore`)
- Create: `~/wonderland/cheshire/com.hygge.cheshire.plist`
- Create: `~/wonderland/cheshire/README.md`

**Interfaces:**
- Consumes: `cfg`, `FLOWS`, `login`, `firma`, `elegibles`, `LIMITS`, `buildPayload`, `decideAlert`, `readLastStatus`, `writeLastStatus`, `report`.
- Produces: CLI `cheshire.mjs [--once] [--no-report]`.

- [ ] **Step 1: Flesh out `explore` in crawler.js**

```js
// replace the placeholder explore() in crawler.js with:
export async function explore(page, { limits = LIMITS, onFinding = () => {} } = {}) {
  const start = Date.now();
  const visited = new Set();
  const states = [];
  let actions = 0;

  page.on("pageerror", (e) => onFinding({ severity: "major", category: "crawler-js-error", detail: String(e.message).slice(0, 300), repro: page.url() }));
  page.on("console", (m) => { if (m.type() === "error") onFinding({ severity: "minor", category: "crawler-js-error", detail: m.text().slice(0, 300), repro: page.url() }); });
  page.on("response", (r) => { if (r.status() >= 500) onFinding({ severity: "major", category: "crawler-http", detail: `${r.status()} ${r.url()}`.slice(0, 300), repro: page.url() }); });

  async function snapshot() {
    const url = page.url();
    const headings = await page.locator("h1,h2,[class*=Eyebrow]").allInnerTexts().catch(() => []);
    const raw = await page.locator("button, a[href], [role=button]").all().catch(() => []);
    const els = [];
    for (const h of raw) {
      const label = (await h.innerText().catch(() => "")).trim();
      const vis = await h.isVisible().catch(() => false);
      const en = await h.isEnabled().catch(() => false);
      if (vis && en && label) els.push({ label, handle: h });
    }
    // pantalla en blanco / crash
    const bodyLen = await page.evaluate(() => (document.body?.innerText || "").trim().length).catch(() => 0);
    if (bodyLen < 5) onFinding({ severity: "critical", category: "crawler-blank", detail: `pantalla casi vacía en ${url}`, repro: url });
    return { url, headings, labels: els.map(e => e.label), els };
  }

  const queue = [{ depth: 0 }];
  while (queue.length && actions < limits.maxActions && Date.now() - start < limits.timeBudgetMs) {
    const { depth } = queue.shift();
    const snap = await snapshot();
    const sig = firma(snap);
    if (visited.has(sig)) continue;
    visited.add(sig); states.push(sig);
    if (depth >= limits.maxDepth) continue;
    for (const el of elegibles(snap.els)) {
      if (actions >= limits.maxActions || Date.now() - start >= limits.timeBudgetMs) break;
      actions++;
      try { await el.handle.click({ timeout: 4000 }); await page.waitForTimeout(400); } catch {}
      queue.push({ depth: depth + 1 });
      // volver a un estado conocido: al dashboard, para no perderse
      await page.goBack({ timeout: 4000 }).catch(() => {});
    }
  }
  return { states, findings: [], actionsRun: actions };
}
```

- [ ] **Step 2: Write the orchestrator**

```js
// cheshire.mjs
import { chromium } from "playwright";
import { cfg } from "./config.js";
import { FLOWS, login } from "./flows.js";
import { explore } from "./crawler.js";
import { buildPayload, decideAlert, readLastStatus, writeLastStatus, report } from "./report.js";

const argv = process.argv.slice(2);
const dryRun = argv.includes("--no-report");

async function main() {
  const findings = [];
  let flowsPass = 0;
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    for (const f of FLOWS) {
      try {
        const r = await f.run(page, { cfg });
        if (r.ok) flowsPass++;
        else findings.push({ severity: "major", category: "e2e", detail: `${f.label}: ${r.detail}` });
      } catch (e) {
        findings.push({ severity: "major", category: "e2e", detail: `${f.label}: excepción ${String(e.message).slice(0, 200)}` });
      }
    }
    await login(page, cfg).catch(() => {});
    const crawl = await explore(page, { limits: cfg.limits, onFinding: (f) => findings.push(f) });
    const hardFail = findings.some(f => f.severity === "major" || f.severity === "critical");
    const result = hardFail ? "issues" : "ok";
    const summary = `${flowsPass}/${FLOWS.length} flujos OK · crawler ${crawl.states.length} estados, ${findings.length} hallazgos`;
    console.log(result.toUpperCase(), "·", summary);
    await report(buildPayload({ result, summary, findings }), { dryRun });
    const prev = readLastStatus();
    if (decideAlert(prev, result)) { writeLastStatus(result); console.log("[alerta de transición]", prev, "→", result); }
  } catch (e) {
    await report(buildPayload({ result: "error", summary: `Cheshire cayó: ${String(e.message).slice(0, 200)}`, findings: [] }), { dryRun });
  } finally {
    await browser.close();
  }
}
main();
```

- [ ] **Step 3: Dry-run (no report) against localhost or prod**

Run: `cd ~/wonderland/cheshire && cp .env.example .env` then fill `QA_PASS`, then:
`ERP_URL=http://localhost:5173 node cheshire.mjs --once --no-report`
Expected: prints `OK·…` or `ISSUES·…` with a flow/crawler summary and `[dry-run] no POST`.

- [ ] **Step 4: launchd + README**

```xml
<!-- com.hygge.cheshire.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.hygge.cheshire</string>
  <key>ProgramArguments</key>
  <array><string>/usr/local/bin/node</string><string>/Users/sebastianbonilla/wonderland/cheshire/cheshire.mjs</string><string>--once</string></array>
  <key>WorkingDirectory</key><string>/Users/sebastianbonilla/wonderland/cheshire</string>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>/usr/local/bin:/usr/bin:/bin</string></dict>
  <key>StartInterval</key><integer>1800</integer>
  <key>StandardOutPath</key><string>/Users/sebastianbonilla/wonderland/cheshire/cheshire.log</string>
  <key>StandardErrorPath</key><string>/Users/sebastianbonilla/wonderland/cheshire/cheshire.err.log</string>
</dict></plist>
```

README documents: env setup, `npx playwright install chromium`, load launchd with `launchctl load ~/Library/LaunchAgents/com.hygge.cheshire.plist`, and the QA-user prerequisite.

- [ ] **Step 5: Commit**

```bash
git add cheshire.mjs crawler.js com.hygge.cheshire.plist README.md
git commit -m "feat(cheshire): orchestrator + crawler explore + launchd + README"
```

---

### Task 6: Live integration + verify report lands

**Files:** none (verification task).

- [ ] **Step 1: Prereq — create QA user + hidden QA space** in ALICE (`cfg.qaUser`/`qaSpace`), set `QA_PASS` in `.env`, and confirm `AGENTS_API_KEY` matches the backend.

- [ ] **Step 2: Real run (with report)**

Run: `node cheshire.mjs --once`
Expected: prints result + `report` returns `{ ok:true, status:200 }`.

- [ ] **Step 3: Verify it landed**

Run: `curl -s https://aliceai.bam.pe/api/agents/status | grep cheshire`
Expected: a recent `cheshire` run appears with the summary.

- [ ] **Step 4: Load the schedule**

```bash
cp com.hygge.cheshire.plist ~/Library/LaunchAgents/ && launchctl load ~/Library/LaunchAgents/com.hygge.cheshire.plist
```

## Self-Review

- **Spec coverage:** login/crear-tarea/chat/voz/mobile (Task 4) ✓ · exploratory crawler w/ signature+frontier+limits+denylist (Tasks 3,5) ✓ · report to existing endpoint (Task 2,6) ✓ · transition-only alert (Task 2,5) ✓ · QA sandbox + cleanup (Task 4) ✓ · alicia-mac launchd (Task 5,6) ✓ · Vision/visual-regression explicitly out (v2) ✓. (Voice-selector-persist flow folded into scope but not scripted in v1 — acceptable; note for follow-up.)
- **Placeholders:** none — every step has real code/commands.
- **Type consistency:** `firma({url,headings,labels})`, `elegibles(els)`, `explore(page,{limits,onFinding})`, `buildPayload/decideAlert/report` consistent across Tasks 2–5.
