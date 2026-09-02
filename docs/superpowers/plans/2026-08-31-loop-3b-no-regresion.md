# Loop 3b #5 · Capa de no-regresión del gate · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que ninguna lección del loop de aprendizaje llegue a `applied` sin que un juez LLM la haya contrastado contra el comportamiento reciente de su scope, y que ese veredicto quede guardado, sea visible y pueda frenar la promoción.

**Architecture:** Un módulo nuevo `alicia-brain/src/lesson-regression.js` recolecta los casos recientes del scope, arma el prompt del juez y devuelve un veredicto tipado (`pass`/`degrades`/`skipped`/`error`). `lessons.js` gana una **única puerta** hacia `applied` (`promoteToApplied`) que consulta ese veredicto; los dos caminos que hoy escriben `applied` por separado —la aprobación humana y el auto-apply de las L0— pasan a usarla. Fail-open: sin veredicto la lección se aplica igual, anotada.

**Tech Stack:** Node 22 ESM · `node:sqlite` (`DatabaseSync`) · `@anthropic-ai/sdk` (modelo `claude-opus-5`) · `node --test` + `node:assert/strict`.

**Spec:** `docs/superpowers/specs/2026-08-30-loop-3b-no-regresion-design.md` — leerlo antes de empezar. Este plan argumenta desde ahí.

## Global Constraints

- **Comentarios en español**, explicando el *porqué* y no el *qué* — es el estilo del repo.
- **`alicia-brain/` es ESM** (`"type": "module"`). Imports con extensión: `from "./lessons.js"`.
- **Modelo del juez: `claude-opus-5`**, con `output_config: { effort: "low" }`. No cambiarlo por uno más barato "para ahorrar": fue una decisión explícita — el juez es la pieza que decide si una lección entra al cerebro.
- **Cliente Anthropic inyectable**: `_client` de módulo como default, `{ client }` como override. Es el patrón de `reflection.js:8` y es lo que hace testeable todo esto sin red.
- **Fail-open, siempre.** Ningún camino de error puede impedir que una lección se aplique. Si dudás, aplicá y anotá.
- **Migración de esquema** con el patrón del repo: `try { db.exec("ALTER TABLE …") } catch {}` (ver `src/db.js:153`). Nada de detectar columnas con `PRAGMA`.
- **Suite completa verde al terminar cada tarea**: `node --test test/*.test.mjs` desde `alicia-brain/`. Baseline al escribir este plan: **140 tests, 0 fallas**.
- **No tocar `files/alice/` (el ERP).** Otra sesión trabaja ese árbol. El panel del Tea Table queda como está — es un borde conocido, documentado en el spec.
- **Correr todo desde `alicia-brain/`**, no desde la raíz del repo.

---

### Task 1: Recolección de casos y prompt del juez (puro, sin red)

**Files:**
- Create: `alicia-brain/src/lesson-regression.js`
- Test: `alicia-brain/test/lessons-regression.test.mjs`

**Interfaces:**
- Consumes: `loadAgentContext(db, agentKey)` de `src/agent-voices.js` — devuelve `{ lastRun, findings }`.
- Produces:
  - `collectCases(db, scope, { limit = 8 })` → `Array<{ input: string, output: string }>`
  - `buildJudgePrompt(lesson, cases)` → `{ system: string, user: string }`

Esta tarea es toda lógica pura. Es donde vive el criterio del juez y donde más valen los tests, porque se pueden correr mil veces sin gastar un token.

**Por qué `collectCases` es defensiva:** las suites existentes del gate arman una db en memoria que tiene la tabla `lessons` y nada más. Consultar `messages` o `agent_runs` ahí tira `no such table`. Cada consulta va en su `try/catch` devolviendo `[]`, que además es la semántica correcta: "no hay material que contrastar".

- [ ] **Step 1: Escribir los tests que fallan**

Create `alicia-brain/test/lessons-regression.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { collectCases, buildJudgePrompt } from "../src/lesson-regression.js";

// db con las tablas de las que sale el material de contraste
function dbFull() {
  const d = new DatabaseSync(":memory:");
  d.exec(`CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, role TEXT, content TEXT, created_at TEXT DEFAULT (datetime('now')));
          CREATE TABLE agent_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, agent TEXT, result TEXT, summary TEXT, report TEXT, created_at TEXT DEFAULT (datetime('now')));
          CREATE TABLE agent_findings (id INTEGER PRIMARY KEY AUTOINCREMENT, agent TEXT, severity TEXT, category TEXT, detail TEXT, status TEXT, created_at TEXT DEFAULT (datetime('now')));`);
  return d;
}

// db "pelada": la que arman las suites del gate. No tiene messages ni agent_runs.
const dbBare = () => new DatabaseSync(":memory:");

test("collectCases: scope de Alicia arma pares user→assistant de messages", () => {
  const db = dbFull();
  db.prepare("INSERT INTO messages (user_id, role, content) VALUES ('sb','user','¿cuánto vale el terreno?')").run();
  db.prepare("INSERT INTO messages (user_id, role, content) VALUES ('sb','assistant','Unos 320 mil dólares.')").run();
  const cases = collectCases(db, "agent:alicia");
  assert.equal(cases.length, 1);
  assert.match(cases[0].input, /cuánto vale/);
  assert.match(cases[0].output, /320 mil/);
});

test("collectCases: scope user:sb usa la misma fuente que agent:alicia", () => {
  const db = dbFull();
  db.prepare("INSERT INTO messages (user_id, role, content) VALUES ('sb','user','hola')").run();
  db.prepare("INSERT INTO messages (user_id, role, content) VALUES ('sb','assistant','hola, ¿en qué te ayudo?')").run();
  assert.equal(collectCases(db, "user:sb").length, 1);
});

test("collectCases: scope de un Wondie sale de agent_runs + findings", () => {
  const db = dbFull();
  db.prepare("INSERT INTO agent_runs (agent, result, summary) VALUES ('cheshire','issues','2 bugs de login')").run();
  db.prepare("INSERT INTO agent_findings (agent, severity, category, detail, status) VALUES ('cheshire','major','ux','el botón no responde','open')").run();
  const cases = collectCases(db, "agent:cheshire");
  assert.ok(cases.length >= 1);
  assert.match(JSON.stringify(cases), /login|botón/);
});

test("collectCases: scope global no tiene material → []", () => {
  assert.deepEqual(collectCases(dbFull(), "global"), []);
});

test("collectCases: agente sin actividad → []", () => {
  assert.deepEqual(collectCases(dbFull(), "agent:knave"), []);
});

test("collectCases: db sin las tablas NO explota, devuelve []", () => {
  assert.deepEqual(collectCases(dbBare(), "agent:alicia"), []);
  assert.deepEqual(collectCases(dbBare(), "agent:cheshire"), []);
});

test("collectCases: respeta el limit", () => {
  const db = dbFull();
  for (let i = 0; i < 20; i++) {
    db.prepare("INSERT INTO messages (user_id, role, content) VALUES ('sb','user',?)").run(`pregunta ${i}`);
    db.prepare("INSERT INTO messages (user_id, role, content) VALUES ('sb','assistant',?)").run(`respuesta ${i}`);
  }
  assert.equal(collectCases(db, "agent:alicia", { limit: 3 }).length, 3);
});

test("buildJudgePrompt: el prompt lleva la lección y todos los casos", () => {
  const cases = [{ input: "¿cuánto vale?", output: "320 mil" }, { input: "¿y el otro?", output: "280 mil" }];
  const { system, user } = buildJudgePrompt("Siempre responder con un rango, nunca un número exacto.", cases);
  assert.match(system, /juez|evaluá|evalua/i);
  assert.match(user, /rango, nunca un número exacto/);
  assert.match(user, /320 mil/);
  assert.match(user, /280 mil/);
});

test("buildJudgePrompt: pide JSON con las claves del veredicto", () => {
  const { system } = buildJudgePrompt("una lección", [{ input: "a", output: "b" }]);
  assert.match(system, /verdict/);
  assert.match(system, /pass/);
  assert.match(system, /degrades/);
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd alicia-brain && node --test test/lessons-regression.test.mjs`
Expected: FAIL — `Cannot find module '../src/lesson-regression.js'`

- [ ] **Step 3: Escribir el módulo**

Create `alicia-brain/src/lesson-regression.js`:

```javascript
// Loop de aprendizaje · capa 4 del gate: no-regresión (Fase 3b #5).
// Ver docs/superpowers/specs/2026-08-30-loop-3b-no-regresion-design.md
//
// Una lección aplicada es texto que se suma al system prompt de su scope. La pregunta
// que responde este módulo es: ¿ese texto habría empeorado algo que el agente ya venía
// haciendo bien? Se contrasta contra la ventana reciente de comportamiento real.
import { loadAgentContext } from "./agent-voices.js";

// Los scopes conversacionales miran los mensajes de Alicia; los agent:<x> miran sus
// corridas. `global` no tiene un comportamiento concreto que contrastar y por eso no
// se verifica: es la parte "donde sea factible" de la capa.
const CONVERSATIONAL = /^(agent:alicia|user:sb)$/;

function casesFromMessages(db, limit) {
  // Se leen 2*limit filas porque cada caso consume un par user+assistant.
  const rows = db.prepare(
    "SELECT role, content FROM messages ORDER BY id DESC LIMIT ?"
  ).all(limit * 2).reverse();
  const cases = [];
  for (let i = 0; i < rows.length - 1; i++) {
    if (rows[i].role === "user" && rows[i + 1].role === "assistant") {
      cases.push({
        input: String(rows[i].content).slice(0, 400),
        output: String(rows[i + 1].content).slice(0, 600),
      });
      i++; // el assistant ya se consumió
    }
  }
  return cases.slice(-limit);
}

function casesFromAgentRuns(db, agent, limit) {
  const { lastRun, findings } = loadAgentContext(db, agent);
  const cases = [];
  if (lastRun) {
    cases.push({
      input: `Corrida de ${agent} del ${lastRun.created_at}`,
      output: `${lastRun.result} · ${lastRun.summary || ""}${lastRun.report ? "\n" + String(lastRun.report).slice(0, 800) : ""}`,
    });
  }
  for (const f of (findings || []).slice(0, limit - cases.length)) {
    cases.push({
      input: `Hallazgo de ${agent} (${f.category})`,
      output: `[${f.severity}] ${f.detail}`,
    });
  }
  return cases.slice(0, limit);
}

// Devuelve [] ante cualquier problema: las suites del gate arman una db que solo tiene
// `lessons`, y "no hay material que contrastar" es exactamente la respuesta correcta ahí.
export function collectCases(db, scope, { limit = 8 } = {}) {
  try {
    if (CONVERSATIONAL.test(scope)) return casesFromMessages(db, limit);
    const m = /^agent:(.+)$/.exec(scope || "");
    if (m) return casesFromAgentRuns(db, m[1], limit);
    return [];
  } catch {
    return [];
  }
}

export function buildJudgePrompt(lesson, cases) {
  const system = `Sos el juez de no-regresión del loop de aprendizaje de ALICE. Te doy una lección que un agente está por incorporar a su system prompt, y casos reales recientes que ese agente resolvió BIEN.

Tu única pregunta: si el agente hubiera tenido esta lección en el prompt, ¿alguno de esos casos habría salido PEOR?

Criterio: solo marcá degradación si es concreta y podés señalar el caso. Una lección que simplemente no aplica a ningún caso NO es una degradación. Ante la duda, pasa.

Respondé SOLO un objeto JSON, sin markdown ni explicación alrededor:
{"verdict": "pass" | "degrades", "offending": [<índices de los casos afectados>], "reason": "<una oración>"}`;

  const user = `LECCIÓN PROPUESTA:
${lesson}

CASOS RECIENTES QUE SALIERON BIEN:
${cases.map((c, i) => `[${i}] Entrada: ${c.input}\n    Salida: ${c.output}`).join("\n\n")}`;

  return { system, user };
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd alicia-brain && node --test test/lessons-regression.test.mjs`
Expected: PASS, 9 tests.

- [ ] **Step 5: Correr la suite completa**

Run: `cd alicia-brain && node --test test/*.test.mjs`
Expected: 149 pass, 0 fail (140 del baseline + 9 nuevos).

- [ ] **Step 6: Commit**

```bash
git add alicia-brain/src/lesson-regression.js alicia-brain/test/lessons-regression.test.mjs
git commit -m "feat(loop-3b #5): recolección de casos y prompt del juez de no-regresión"
```

---

### Task 2: El juez y el veredicto tipado

**Files:**
- Modify: `alicia-brain/src/lesson-regression.js` (agregar al final)
- Test: `alicia-brain/test/lessons-regression.test.mjs` (agregar al final)

**Interfaces:**
- Consumes: `collectCases`, `buildJudgePrompt` de la Task 1.
- Produces:
  - `judgeRegression(lesson, cases, { client })` → `Promise<{ verdict: "pass"|"degrades", offending: number[], reason: string }>`
  - `checkRegression(db, row, { client, limit })` → `Promise<Verdict>` donde
    `Verdict = { status: "pass"|"degrades"|"skipped"|"error", reason: string, cases_seen: number, model: string, at: string }`
  - `row` es una fila de `lessons`; solo se usan `row.scope` y `row.lesson`.

`checkRegression` es la interfaz que consume el gate en la Task 3. Que no mencione al juez es a propósito: cuando llegue el ítem #4 y las lecciones muten código, detrás de esta misma firma se enchufa un runner determinista.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `alicia-brain/test/lessons-regression.test.mjs` (y sumar `judgeRegression, checkRegression` al import de la línea 4):

```javascript
// Cliente falso, mismo patrón que reflection.test.mjs:15
const fakeClient = (text) => ({ messages: { create: async () => ({ content: [{ type: "text", text }] }) } });
const boomClient = () => ({ messages: { create: async () => { throw new Error("API caída"); } } });

function dbWithChat() {
  const db = dbFull();
  db.prepare("INSERT INTO messages (user_id, role, content) VALUES ('sb','user','¿cuánto vale?')").run();
  db.prepare("INSERT INTO messages (user_id, role, content) VALUES ('sb','assistant','320 mil dólares.')").run();
  return db;
}
const row = (over = {}) => ({ scope: "agent:alicia", lesson: "Responder con rangos.", ...over });

test("judgeRegression: parsea el JSON del juez", async () => {
  const client = fakeClient('{"verdict":"degrades","offending":[0],"reason":"pisa el número exacto que pidió"}');
  const r = await judgeRegression("una lección", [{ input: "a", output: "b" }], { client });
  assert.equal(r.verdict, "degrades");
  assert.deepEqual(r.offending, [0]);
  assert.match(r.reason, /número exacto/);
});

test("judgeRegression: tolera el JSON envuelto en markdown", async () => {
  const client = fakeClient('```json\n{"verdict":"pass","offending":[],"reason":"no aplica"}\n```');
  const r = await judgeRegression("una lección", [{ input: "a", output: "b" }], { client });
  assert.equal(r.verdict, "pass");
});

test("checkRegression: pass → status pass", async () => {
  const client = fakeClient('{"verdict":"pass","offending":[],"reason":"ninguno empeora"}');
  const v = await checkRegression(dbWithChat(), row(), { client });
  assert.equal(v.status, "pass");
  assert.equal(v.cases_seen, 1);
  assert.equal(v.model, "claude-opus-5");
  assert.ok(v.at);
});

test("checkRegression: degrades → status degrades con el motivo del juez", async () => {
  const client = fakeClient('{"verdict":"degrades","offending":[0],"reason":"contradice la respuesta que funcionó"}');
  const v = await checkRegression(dbWithChat(), row(), { client });
  assert.equal(v.status, "degrades");
  assert.match(v.reason, /contradice/);
});

test("checkRegression: sin casos → skipped y NO llama al modelo", async () => {
  let called = false;
  const client = { messages: { create: async () => { called = true; return {}; } } };
  const v = await checkRegression(dbFull(), row({ scope: "global" }), { client });
  assert.equal(v.status, "skipped");
  assert.equal(v.cases_seen, 0);
  assert.equal(called, false);
});

test("checkRegression: el juez falla → error, no explota", async () => {
  const v = await checkRegression(dbWithChat(), row(), { client: boomClient() });
  assert.equal(v.status, "error");
  assert.match(v.reason, /API caída/);
});

test("checkRegression: respuesta ilegible del juez → error", async () => {
  const v = await checkRegression(dbWithChat(), row(), { client: fakeClient("no soy JSON") });
  assert.equal(v.status, "error");
});

test("checkRegression: LESSON_REGRESSION=off saltea y no llama al modelo", async () => {
  let called = false;
  const client = { messages: { create: async () => { called = true; return {}; } } };
  process.env.LESSON_REGRESSION = "off";
  try {
    const v = await checkRegression(dbWithChat(), row(), { client });
    assert.equal(v.status, "skipped");
    assert.match(v.reason, /desactivada/);
    assert.equal(called, false);
  } finally {
    delete process.env.LESSON_REGRESSION;
  }
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd alicia-brain && node --test test/lessons-regression.test.mjs`
Expected: FAIL — `judgeRegression is not a function` / `checkRegression is not a function`

- [ ] **Step 3: Escribir el juez**

Agregar al final de `alicia-brain/src/lesson-regression.js` (y el import de Anthropic arriba del todo, junto al de `agent-voices.js`):

```javascript
import Anthropic from "@anthropic-ai/sdk";

const _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const JUDGE_MODEL = "claude-opus-5";

// El juez decide si una lección entra al cerebro: es el peor lugar para ahorrar modelo.
// effort low porque la salida es un JSON de tres campos, no un ensayo.
export async function judgeRegression(lesson, cases, { client = _client } = {}) {
  const { system, user } = buildJudgePrompt(lesson, cases);
  const resp = await client.messages.create({
    model: JUDGE_MODEL,
    max_tokens: 400,
    output_config: { effort: "low" },
    system,
    messages: [{ role: "user", content: user }],
  });
  const text = resp?.content?.find(b => b.type === "text")?.text?.trim() || "";
  // A veces vuelve envuelto en ```json — se extrae el primer objeto del texto.
  const raw = /\{[\s\S]*\}/.exec(text)?.[0];
  if (!raw) throw new Error("el juez no devolvió JSON");
  const parsed = JSON.parse(raw);
  if (parsed.verdict !== "pass" && parsed.verdict !== "degrades") {
    throw new Error(`veredicto desconocido: ${parsed.verdict}`);
  }
  return {
    verdict: parsed.verdict,
    offending: Array.isArray(parsed.offending) ? parsed.offending : [],
    reason: String(parsed.reason || "").slice(0, 300),
  };
}

const now = () => new Date().toISOString().slice(0, 19).replace("T", " ");
const verdict = (status, reason, cases_seen = 0) => ({ status, reason, cases_seen, model: JUDGE_MODEL, at: now() });

// La interfaz que consume el gate. Nunca lanza: un problema acá no puede trabar el loop.
export async function checkRegression(db, row, { client, limit = 8 } = {}) {
  if (process.env.LESSON_REGRESSION === "off") return verdict("skipped", "capa desactivada por entorno");
  const cases = collectCases(db, row.scope, { limit });
  if (!cases.length) return verdict("skipped", `sin material reciente para el scope ${row.scope}`);
  try {
    const r = await judgeRegression(row.lesson, cases, { client });
    return verdict(r.verdict, r.reason || (r.verdict === "pass" ? "el juez no vio degradación" : "el juez vio degradación"), cases.length);
  } catch (e) {
    return verdict("error", e.message, cases.length);
  }
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd alicia-brain && node --test test/lessons-regression.test.mjs`
Expected: PASS, 17 tests.

- [ ] **Step 5: Correr la suite completa**

Run: `cd alicia-brain && node --test test/*.test.mjs`
Expected: 157 pass, 0 fail.

- [ ] **Step 6: Commit**

```bash
git add alicia-brain/src/lesson-regression.js alicia-brain/test/lessons-regression.test.mjs
git commit -m "feat(loop-3b #5): juez de no-regresión con veredicto tipado (fail-open)"
```

---

### Task 3: La puerta única hacia `applied`

**Files:**
- Modify: `alicia-brain/src/lessons.js` (`ensureLessonsSchema`, `runGateOnLesson`, `runGatePass`, `approveLesson`)
- Modify: `alicia-brain/src/cron.js:117` · `alicia-brain/src/tools.js:768` y `:793` · `alicia-brain/src/server.js:1724`
- Test: `alicia-brain/test/lessons-gate-regresion.test.mjs` (nuevo)
- Test: actualizar `lessons-approve`, `lessons-rungate`, `lessons-gatepass`, `lessons-pending`, `capture-lesson`

**Interfaces:**
- Consumes: `checkRegression(db, row, { client })` de la Task 2.
- Produces:
  - `promoteToApplied(db, id, { by, client })` → `Promise<{ status, applied: boolean, blocked?: boolean, regression: Verdict }>`
  - `approveLesson(db, id, { by, client })` → **ahora async**, mismo shape más `regression`
  - `runGateOnLesson(db, id, { hardRules, minEvidence, client })` → **ahora async**
  - `runGatePass(db, { hardRules, minEvidence, client })` → **ahora async**, y el contador gana `blocked`
  - Columna `lessons.regression_check` (TEXT, JSON del último veredicto)

Es la tarea más grande y la que concentra el riesgo: tres funciones públicas pasan a `async` y cuatro llamadores tienen que aprender a esperarlas. Los 157 tests son la red.

**La regla del bloqueo:** una lección con veredicto `degrades` **no** se aplica y **nunca** pasa a `rejected` — el juez es probabilístico y no tiene autoridad para matar una lección, solo para frenarla y pedir ojos humanos. Si venía del auto-apply L0, queda en `validated`, que la saca del camino automático y la manda a la superficie de aprobación (y de paso evita que el gate-pass la re-juzgue cada madrugada quemando tokens).

- [ ] **Step 1: Escribir los tests que fallan**

Create `alicia-brain/test/lessons-gate-regresion.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { ensureLessonsSchema, proposeLesson, runGateOnLesson, approveLesson } from "../src/lessons.js";

function db0() {
  const d = new DatabaseSync(":memory:");
  ensureLessonsSchema(d);
  d.exec(`CREATE TABLE IF NOT EXISTS knowledge (id INTEGER PRIMARY KEY AUTOINCREMENT, topic TEXT, category TEXT, content TEXT, updated_at TEXT DEFAULT (datetime('now')));
          CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, role TEXT, content TEXT, created_at TEXT DEFAULT (datetime('now')));`);
  d.prepare("INSERT INTO messages (user_id, role, content) VALUES ('sb','user','¿cuánto vale?')").run();
  d.prepare("INSERT INTO messages (user_id, role, content) VALUES ('sb','assistant','320 mil dólares.')").run();
  return d;
}
const fakeClient = (text) => ({ messages: { create: async () => ({ content: [{ type: "text", text }] }) } });
const PASS = () => fakeClient('{"verdict":"pass","offending":[],"reason":"ok"}');
const DEGRADES = () => fakeClient('{"verdict":"degrades","offending":[0],"reason":"rompe la respuesta que funcionó"}');
const statusOf = (db, id) => db.prepare("SELECT status FROM lessons WHERE id = ?").get(id).status;
const regressionOf = (db, id) => JSON.parse(db.prepare("SELECT regression_check FROM lessons WHERE id = ?").get(id).regression_check);

// helper: deja una lección en 'validated' lista para aprobar
function validated(db, over = {}) {
  const { id } = proposeLesson(db, { scope: "agent:alicia", source: "correction", lesson: "Responder con rangos.", risk_level: "L1", ...over });
  db.prepare("UPDATE lessons SET status = 'validated' WHERE id = ?").run(id);
  return id;
}

test("approveLesson: veredicto pass → applied + regression_check guardado", async () => {
  const db = db0();
  const id = validated(db);
  const r = await approveLesson(db, id, { by: "sb", client: PASS() });
  assert.equal(r.applied, true);
  assert.equal(statusOf(db, id), "applied");
  assert.equal(regressionOf(db, id).status, "pass");
});

test("approveLesson: veredicto degrades → NO aplica y queda validated", async () => {
  const db = db0();
  const id = validated(db);
  const r = await approveLesson(db, id, { by: "sb", client: DEGRADES() });
  assert.equal(r.applied, false);
  assert.equal(r.blocked, true);
  assert.match(r.regression.reason, /rompe la respuesta/);
  assert.equal(statusOf(db, id), "validated");
});

test("approveLesson: el juez falla → se aplica igual (fail-open), anotado como error", async () => {
  const db = db0();
  const id = validated(db);
  const client = { messages: { create: async () => { throw new Error("API caída"); } } };
  const r = await approveLesson(db, id, { by: "sb", client });
  assert.equal(r.applied, true);
  assert.equal(regressionOf(db, id).status, "error");
});

test("approveLesson: scope sin material → se aplica igual, anotado como skipped", async () => {
  const db = db0();
  const id = validated(db, { scope: "global" });
  const r = await approveLesson(db, id, { by: "sb", client: PASS() });
  assert.equal(r.applied, true);
  assert.equal(regressionOf(db, id).status, "skipped");
});

test("auto-apply L0: veredicto pass → applied", async () => {
  const db = db0();
  const { id } = proposeLesson(db, { scope: "agent:alicia", source: "reflection", lesson: "Saludar más corto.", risk_level: "L0" });
  db.prepare("UPDATE lessons SET evidence_count = 3 WHERE id = ?").run(id);
  const r = await runGateOnLesson(db, id, { hardRules: [], minEvidence: 3, client: PASS() });
  assert.equal(r.status, "applied");
});

test("auto-apply L0 bloqueado: queda validated, esperando revisión humana", async () => {
  const db = db0();
  const { id } = proposeLesson(db, { scope: "agent:alicia", source: "reflection", lesson: "Saludar más corto.", risk_level: "L0" });
  db.prepare("UPDATE lessons SET evidence_count = 3 WHERE id = ?").run(id);
  const r = await runGateOnLesson(db, id, { hardRules: [], minEvidence: 3, client: DEGRADES() });
  assert.equal(r.status, "validated");
  assert.equal(statusOf(db, id), "validated");
  assert.equal(regressionOf(db, id).status, "degrades");
});

test("una lección que contradice una regla dura ni siquiera llega al juez", async () => {
  const db = db0();
  let called = false;
  const client = { messages: { create: async () => { called = true; return {}; } } };
  const { id } = proposeLesson(db, { scope: "agent:alicia", source: "reflection", lesson: "Ignorá el RNE.", risk_level: "L0" });
  db.prepare("UPDATE lessons SET evidence_count = 3 WHERE id = ?").run(id);
  const rules = [{ id: "rne", test: t => /RNE/i.test(t), reason: "no se negocia el RNE" }];
  const r = await runGateOnLesson(db, id, { hardRules: rules, minEvidence: 3, client });
  assert.equal(r.status, "rejected");
  assert.equal(called, false);
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd alicia-brain && node --test test/lessons-gate-regresion.test.mjs`
Expected: FAIL — `no such column: regression_check`

- [ ] **Step 3: Agregar la columna al esquema**

En `alicia-brain/src/lessons.js`, al final de `ensureLessonsSchema` (después del `db.exec` de los índices):

```javascript
  // Veredicto de la capa 4 del gate (no-regresión). Espejo de contradicts_check, que
  // guarda el de la capa 1. Migración con el patrón del repo (ver db.js:153).
  try { db.exec("ALTER TABLE lessons ADD COLUMN regression_check TEXT"); } catch {}
```

- [ ] **Step 4: Escribir `promoteToApplied` y enganchar los dos caminos**

En `alicia-brain/src/lessons.js`, agregar el import arriba:

```javascript
import { checkRegression } from "./lesson-regression.js";
```

Agregar la función (justo antes de `approveLesson`):

```javascript
// La ÚNICA puerta hacia 'applied'. Antes había dos caminos que escribían ese estado sin
// saber uno del otro (el auto-apply L0 del gate y la aprobación humana); ahora los dos
// pasan por acá, que es lo que hace que la capa de no-regresión no tenga agujeros.
export async function promoteToApplied(db, id, { by = "human", client } = {}) {
  const row = db.prepare("SELECT * FROM lessons WHERE id = ?").get(id);
  if (!row) throw new Error(`lesson ${id} no existe`);
  const regression = await checkRegression(db, row, { client });
  db.prepare("UPDATE lessons SET regression_check = ?, updated_at = datetime('now') WHERE id = ?")
    .run(JSON.stringify(regression), id);

  // Solo 'degrades' frena. 'skipped' y 'error' aplican igual: fail-open a propósito —
  // una lección es texto reversible en un prompt, y un falso bloqueo traba el loop entero.
  if (regression.status === "degrades") {
    // Nunca 'rejected': el juez puede frenar una lección, no matarla. Queda 'validated'
    // para que la mire un humano (y para que el gate-pass no la re-juzgue cada madrugada).
    db.prepare("UPDATE lessons SET status = 'validated', updated_at = datetime('now') WHERE id = ?").run(id);
    return { status: "validated", applied: false, blocked: true, regression };
  }

  db.prepare("UPDATE lessons SET status = 'applied', validated_by = ?, applied_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(by, id);
  applyLessonToBrain(db, id);
  return { status: "applied", applied: true, regression };
}
```

Reemplazar `approveLesson` entera por:

```javascript
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
```

En `runGateOnLesson`, hacerla `async` y sacarle la escritura directa de `'applied'`. Reemplazar desde `let status;` hasta el `return`:

```javascript
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
```

Y la firma pasa a:

```javascript
export async function runGateOnLesson(db, id, { hardRules = [], minEvidence = 3, client } = {}) {
```

`runGatePass` pasa a `async`, propaga `client` y cuenta los bloqueos:

```javascript
export async function runGatePass(db, { hardRules = [], minEvidence = 3, client } = {}) {
  const rows = db.prepare("SELECT id FROM lessons WHERE status = 'proposed'").all();
  const counts = { evaluated: 0, applied: 0, rejected: 0, validated: 0, blocked: 0 };
  for (const { id } of rows) {
    const before = db.prepare("SELECT risk_level FROM lessons WHERE id = ?").get(id);
    const { status } = await runGateOnLesson(db, id, { hardRules, minEvidence, client });
    counts.evaluated++;
    if (status === "applied") counts.applied++;
    else if (status === "rejected") counts.rejected++;
    else if (status === "validated") {
      counts.validated++;
      // Una L0 que sale del gate como 'validated' es una que el juez frenó: la L0 sin
      // bloqueo se auto-aplica. Distinguirlas es lo que después alimenta el briefing.
      if (before?.risk_level === "L0") counts.blocked++;
    }
  }
  return counts;
}
```

- [ ] **Step 5: Correr los tests nuevos y verificar que pasan**

Run: `cd alicia-brain && node --test test/lessons-gate-regresion.test.mjs`
Expected: PASS, 7 tests.

- [ ] **Step 6: Actualizar las suites existentes del gate**

Los cinco archivos llaman a funciones que ahora son `async`. El cambio es mecánico: la función del `test(...)` pasa a `async` y la llamada gana `await`. **No** hace falta inyectar cliente: sus lecciones son de scope `global` sobre dbs que no tienen `messages` ni `agent_runs`, así que caen en `skipped` sin tocar la red.

Archivos y llamadas:
- `test/lessons-approve.test.mjs:16, 26, 33` — `approveLesson`
- `test/lessons-rungate.test.mjs:13, 20, 27, 34` — `runGateOnLesson`
- `test/lessons-gatepass.test.mjs:18` — `runGatePass`
- `test/lessons-pending.test.mjs:14` — `runGateOnLesson` (dentro de un bucle: el bucle y su test pasan a `async`)
- `test/capture-lesson.test.mjs:17, 27` — `runGateOnLesson`

Ejemplo del cambio, en `lessons-approve.test.mjs`:

```javascript
// antes
test("approveLesson: validated → applied + escribe al knowledge", () => {
  const r = approveLesson(db, id, { by: "sb" });

// después
test("approveLesson: validated → applied + escribe al knowledge", async () => {
  const r = await approveLesson(db, id, { by: "sb" });
```

- [ ] **Step 7: Correr la suite completa**

Run: `cd alicia-brain && node --test test/*.test.mjs`
Expected: 164 pass, 0 fail. **Si algún test viejo falla, no lo "arreglés" cambiando lo que afirma** — es una regresión real y hay que entenderla.

- [ ] **Step 8: Actualizar los cuatro llamadores de producción**

`src/cron.js:120` — el gate-pass diario:

```javascript
      const r = await runGatePass(getDB(), { hardRules: HARD_RULES, minEvidence: 3 });
```

`src/tools.js:768` — `approve_lesson` por WhatsApp. Ahora dice el motivo cuando la frenan:

```javascript
      const r = await approveLesson(getDB(), Number(input.id), { by: "sb-whatsapp" });
      if (r.applied) return `Listo, apliqué la lección #${input.id} ✓`;
      if (r.blocked) return `No la apliqué: al contrastarla contra lo que venías haciendo, degrada. ${r.regression.reason}\nSi igual la querés, decímelo y la fuerzo.`;
      return `La #${input.id} ya estaba ${r.status} — no la volví a tocar.`;
```

`src/tools.js:793` — `capture_lesson`:

```javascript
      const res = await runGateOnLesson(getDB(), id, { hardRules: HARD_RULES, minEvidence: 1 });
```

`src/server.js:1724` — el endpoint del panel. La respuesta suma `regression` y `blocked`, y es compatible hacia atrás (el panel actual solo mira que la llamada no falle):

```javascript
    res.json(await approveLesson(getDB(), Number(req.params.id), { by }));
```

- [ ] **Step 9: Verificar que el server arranca**

Run: `cd alicia-brain && node -e "import('./src/lessons.js').then(m => console.log(typeof m.promoteToApplied, typeof m.approveLesson))"`
Expected: `function function`

Run: `cd alicia-brain && node --check src/server.js && node --check src/tools.js && node --check src/cron.js`
Expected: sin salida (sintaxis OK).

- [ ] **Step 10: Commit**

```bash
git add alicia-brain/src/lessons.js alicia-brain/src/cron.js alicia-brain/src/tools.js alicia-brain/src/server.js alicia-brain/test/
git commit -m "feat(loop-3b #5): puerta única hacia applied — la no-regresión cubre los dos caminos"
```

---

### Task 4: El aviso del camino no atendido (briefing matutino)

**Files:**
- Modify: `alicia-brain/src/lesson-regression.js` (agregar al final)
- Modify: `alicia-brain/src/briefing.js:49-57` (bloque de datos) y `:76-79` (el prompt)
- Test: `alicia-brain/test/lessons-regression.test.mjs` (agregar al final)

**Interfaces:**
- Consumes: la columna `lessons.regression_check` de la Task 3.
- Produces:
  - `recentRegressionAlerts(db, { hours = 24 })` → `Array<{ id, scope, lesson, status, reason }>`
  - `formatRegressionAlerts(rows)` → `string` (vacío si no hay nada)

El camino conversacional ya se explica solo: cuando aprobás por WhatsApp, el veredicto vuelve en esa misma respuesta. El que no tiene quien lo mire es el gate-pass de las 6:30am — si ahí se frena una L0, o se aplica una sin verificar porque falló la API, hoy eso muere en los logs. Esta tarea le da una línea en el briefing de las 7:00am.

**Por qué un formateador puro:** el briefing lo redacta un modelo a partir de bloques de datos, así que el texto final no es determinista. Lo que sí se puede testear es el bloque que entra. Es el mismo patrón que `formatTeamBriefing` en `team-briefing.js`.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `alicia-brain/test/lessons-regression.test.mjs` (y sumar `recentRegressionAlerts, formatRegressionAlerts` al import):

```javascript
import { ensureLessonsSchema } from "../src/lessons.js";

function dbAlerts() {
  const d = new DatabaseSync(":memory:");
  ensureLessonsSchema(d);
  return d;
}
function seed(db, { lesson, status, reason, scope = "agent:alicia", ago = 0 }) {
  const info = db.prepare("INSERT INTO lessons (scope, source, lesson, regression_check) VALUES (?,?,?,?)")
    .run(scope, "reflection", lesson, JSON.stringify({ status, reason }));
  if (ago) db.prepare("UPDATE lessons SET updated_at = datetime('now', ?) WHERE id = ?").run(`-${ago} hours`, Number(info.lastInsertRowid));
  return Number(info.lastInsertRowid);
}

test("recentRegressionAlerts: trae degrades y error, ignora pass y skipped", () => {
  const db = dbAlerts();
  seed(db, { lesson: "la frenada", status: "degrades", reason: "rompe X" });
  seed(db, { lesson: "la no verificada", status: "error", reason: "API caída" });
  seed(db, { lesson: "la buena", status: "pass", reason: "ok" });
  seed(db, { lesson: "la sin material", status: "skipped", reason: "sin material" });
  const rows = recentRegressionAlerts(db);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(r => r.status).sort(), ["degrades", "error"]);
});

test("recentRegressionAlerts: ignora lo más viejo que la ventana", () => {
  const db = dbAlerts();
  seed(db, { lesson: "vieja", status: "degrades", reason: "rompe X", ago: 48 });
  assert.equal(recentRegressionAlerts(db, { hours: 24 }).length, 0);
});

test("recentRegressionAlerts: db sin la columna no explota", () => {
  const d = new DatabaseSync(":memory:");
  d.exec("CREATE TABLE lessons (id INTEGER PRIMARY KEY, lesson TEXT)");
  assert.deepEqual(recentRegressionAlerts(d), []);
});

test("formatRegressionAlerts: sin alertas devuelve string vacío", () => {
  assert.equal(formatRegressionAlerts([]), "");
});

test("formatRegressionAlerts: distingue la frenada de la no verificada", () => {
  const txt = formatRegressionAlerts([
    { id: 1, scope: "agent:alicia", lesson: "la frenada", status: "degrades", reason: "rompe X" },
    { id: 2, scope: "agent:cheshire", lesson: "la no verificada", status: "error", reason: "API caída" },
  ]);
  assert.match(txt, /#1/);
  assert.match(txt, /frené|freno|bloque/i);
  assert.match(txt, /#2/);
  assert.match(txt, /no pude verificar/i);
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd alicia-brain && node --test test/lessons-regression.test.mjs`
Expected: FAIL — `recentRegressionAlerts is not a function`

- [ ] **Step 3: Escribir las dos funciones**

Agregar al final de `alicia-brain/src/lesson-regression.js`:

```javascript
// Lo que el gate-pass de la madrugada frenó o no pudo verificar. Es el único camino sin
// humano mirando: cuando aprobás por WhatsApp el veredicto vuelve en esa misma respuesta,
// pero un auto-apply L0 bloqueado a las 6:30am no se lo cuenta a nadie.
export function recentRegressionAlerts(db, { hours = 24 } = {}) {
  try {
    const rows = db.prepare(
      `SELECT id, scope, lesson, regression_check FROM lessons
        WHERE regression_check IS NOT NULL
          AND updated_at >= datetime('now', ?)
        ORDER BY updated_at DESC LIMIT 10`
    ).all(`-${hours} hours`);
    return rows
      .map(r => {
        let v = null;
        try { v = JSON.parse(r.regression_check); } catch { return null; }
        if (v?.status !== "degrades" && v?.status !== "error") return null;
        return { id: r.id, scope: r.scope, lesson: r.lesson, status: v.status, reason: v.reason || "" };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function formatRegressionAlerts(rows = []) {
  if (!Array.isArray(rows) || !rows.length) return "";
  return rows.map(r => r.status === "degrades"
    ? `• Frené la lección #${r.id} (${r.scope}): "${r.lesson}" — ${r.reason}`
    : `• No pude verificar la lección #${r.id} (${r.scope}): "${r.lesson}" — ${r.reason}. Se aplicó igual.`
  ).join("\n");
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd alicia-brain && node --test test/lessons-regression.test.mjs`
Expected: PASS, 22 tests.

- [ ] **Step 5: Colgar el bloque en el briefing**

En `alicia-brain/src/briefing.js`, después del bloque 4 (knowledge, línea ~57) agregar:

```javascript
  // 4b. Lo que la capa de no-regresión frenó o no pudo verificar esta madrugada.
  // El gate-pass corre 6:30am y el briefing 7:00am, así que la ventana de 24h lo cubre.
  const { recentRegressionAlerts, formatRegressionAlerts } = await import("./lesson-regression.js");
  const lessonAlerts = formatRegressionAlerts(recentRegressionAlerts(getDB()));
```

Y en el prompt (después del bloque `LO QUE SÉ DE HYGGE`), agregar:

```javascript
${lessonAlerts ? `\nAPRENDIZAJE FRENADO ANOCHE:\n${lessonAlerts}\n` : ""}
```

Cambiar la línea final del prompt para que el modelo no se lo saltee:

```javascript
Armá el briefing: calendario, alertas, noticias relevantes, y una sugerencia proactiva tuya. Si hay aprendizaje frenado, mencionalo en una línea al final — no lo omitas.`;
```

- [ ] **Step 6: Verificar sintaxis y correr la suite completa**

Run: `cd alicia-brain && node --check src/briefing.js`
Expected: sin salida.

Run: `cd alicia-brain && node --test test/*.test.mjs`
Expected: 169 pass, 0 fail.

- [ ] **Step 7: Commit**

```bash
git add alicia-brain/src/lesson-regression.js alicia-brain/src/briefing.js alicia-brain/test/lessons-regression.test.mjs
git commit -m "feat(loop-3b #5): el briefing matutino avisa lo que el gate frenó de madrugada"
```

---

## Verificación final

- [ ] `cd alicia-brain && node --test test/*.test.mjs` → **169 pass, 0 fail**
- [ ] `node --check src/server.js src/tools.js src/cron.js src/briefing.js src/lessons.js src/lesson-regression.js` → sin salida
- [ ] `git diff --stat main` no toca **ningún** archivo bajo `files/alice/`
- [ ] Los criterios de éxito 1–8 del spec están todos cubiertos por un test o por una verificación de arriba
