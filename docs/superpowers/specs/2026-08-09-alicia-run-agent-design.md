# Alicia dispara corridas de agentes on-demand (`run_agent`) · Diseño

_2026-08-09 · repo `alice` / `alicia-brain`_

## Contexto

Complemento del sub-proyecto B (#56, `ask_agent`): ahí Alicia **conversa** con los agentes
desde su última data. Acá les dice **"corré AHORA"**. Sebastián eligió el alcance completo:
disparar los in-process al instante **y** encolar los de la bestia.

Dos clases de agente:
- **In-process (brain, Railway):** White Rabbit (`runWhiteRabbitChecks`), Tea Table
  (`runTeaTableReport`), Dark Alice (`runDarkAlice`) → se corren sincrónicos y devuelven el
  resultado fresco en el acto. (Los scrapers ya los dispara `radar_refresh` de #55.)
- **Bestia (Tailscale):** Cheshire (`cheshire.js`), Knave (`knave.js`) → los dispara el reloj
  único (`bestia-runner.js`) cada ~10 min. No hay canal on-demand: se agrega una **cola**.

Este es el sub-proyecto **C**, apilado sobre B (#56).

## Objetivo

Un tool `run_agent({agent})` que corre al instante los agentes in-process y **encola** los de
la bestia; el reloj drena la cola en su próximo tick y el resultado llega por el camino normal
(`/api/agents/report` → visible en `agents_status`/`ask_agent`).

## Alcance / no-alcance

**Dentro:** tool `run_agent`, tabla `agent_run_requests`, 2 endpoints de cola
(`requireAgentKey`), y drenado de la cola en `bestia-runner.js`. Gating **CEO + admins**.

**Fuera:** scrapers (ya en `radar_refresh`), push proactivo del resultado cuando termina un
job encolado (eso es Fase B — por ahora el resultado se consulta después), ejecución L2/L3 de
Dark Alice (sigue observando/proponiendo), y la app Hygge OS.

## Componentes

### 1. Tabla `agent_run_requests` (`src/db.js` ensureSchema)
`{ id INTEGER PK, agent TEXT, requested_by TEXT, status TEXT CHECK(pending|running|done|error)
DEFAULT 'pending', note TEXT, created_at, updated_at }`. Índice por `(status)`.

### 2. `src/agent-requests.js` (nuevo · helpers puros sobre `db`, testeables)
- `AGENT_RUN` — mapa de cómo se corre cada agente:
  - `white-rabbit`/`tea-table`/`dark-alice` → `{ mode: "inline", run: "<clave>" }`.
  - `cheshire` → `{ mode: "queue", script: "cheshire.js", args: [] }`.
  - `knave` → `{ mode: "queue", script: "knave.js", args: [] }`.
- `classifyAgentRun(agent)` → la entrada de `AGENT_RUN` o `null` (agente desconocido). Puro.
- `enqueueRequest(db, agent, requestedBy)` → inserta `pending`, devuelve `{id}`.
- `claimPending(db)` → SELECT status='pending', los marca `running`, devuelve la lista
  `[{id, agent}]` (claim-on-read: evita que el siguiente tick los re-dispare).
- `markRequest(db, id, status, note?)` → actualiza status (`done`/`error`) + `updated_at`.

### 3. Tool `run_agent` (`src/tools.js`)
```
{ name: "run_agent",
  description: "Disparás una corrida NUEVA de un agente Wonderland. Inmediatos (resultado al toque): white-rabbit 🐰, tea-table 🫖, dark-alice 🖤. En la bestia (resultado en ~10 min, te aviso que lo encolé): cheshire 😺 (test E2E), knave 🃏 (seguridad). Usala cuando pidan 'corré/ejecutá X ahora', 'testeá el ERP', 'revisá seguridad ya'. Distinto de ask_agent (que solo conversa con su data vieja).",
  input_schema: { agent: enum[white-rabbit,tea-table,dark-alice,cheshire,knave], required } }
```
`case "run_agent"`:
- `classifyAgentRun(agent)`; desconocido → mensaje legible con la lista.
- **inline:** `import` y ejecutar la función correspondiente (`runWhiteRabbitChecks()` /
  `runTeaTableReport({notify:false})` / `runDarkAlice({notify:false})`) → devolver
  `result + summary` fresco. try/catch: fallo → mensaje honesto.
- **queue:** `enqueueRequest(getDB(), agent, userId)` → devolver "Le pedí a {agente} que
  corra; en unos minutos aparece el resultado — preguntame de nuevo o miralo con agents_status".

### 4. Endpoints de cola (`src/server.js`, `requireAgentKey`, bajo `/api/agents/`)
- `GET /api/agents/run-requests` → `claimPending(getDB())` → `{ requests: [{id, agent}] }`
  (claim-on-read: pending→running).
- `POST /api/agents/run-requests/:id/done` → body `{ status?: "done"|"error", note? }` →
  `markRequest(...)`. Default status `done`.

### 5. Drenado en la bestia (`scripts/bestia-runner.js`)
- Constantes (como `cheshire.js`): `BRAIN = process.env.BRAIN_URL || "https://alice-production-462e.up.railway.app"`, key = `process.env.AGENTS_API_KEY`.
- `drainRequests({ spawn, fetchImpl })`: `GET {BRAIN}/api/agents/run-requests` (x-agent-key) →
  para cada `{id, agent}`: mapear a su `{script,args}` vía `classifyAgentRun` (solo `queue`) y
  `spawn`; al terminar `POST .../{id}/done` (o `/done` con status error si falló).
- En `tick()`: después de los `due` del schedule, llamar `await drainRequests(...)` (respeta
  el mismo `running` lock y el guard QUARANTINE del arranque de tick).
- Inyectable (`fetchImpl`, `spawn`) para test, igual que `pull`/`spawn` hoy.

## Flujo (Cheshire on-demand)
1. Sebastián: "corré Cheshire". → `run_agent({agent:"cheshire"})` encola `pending`.
2. Alicia: "Lo encolé, en unos minutos te muestro."
3. Reloj tick (≤10 min): `drainRequests` claim → spawn `cheshire.js` → Cheshire reporta a
   `/api/agents/report` (su camino normal) → runner marca la request `done`.
4. Sebastián después: "¿qué dijo Cheshire?" → `ask_agent`/`agents_status` con la data fresca.

## Autoridad / seguridad
- `run_agent` gateado a **CEO + admins** (`ADMIN_TOOLS`, no `SENSITIVE_ADMIN`).
- Correr un agente es no-destructivo (chequeos read-only; Dark Alice sigue L0). No ejecuta
  acciones L2/L3.
- La cola respeta `QUARANTINE` (el tick ya corta al inicio si está activo).
- Claim-on-read evita doble corrida; el lock `running` del runner evita solaparse consigo mismo.

## Manejo de errores
- Agente desconocido → mensaje con la lista válida (sin correr nada).
- Inline con fallo → Alicia lo reporta honesto (regla anti-confabulación de #53).
- `drainRequests`: fallo de red al brain → se loguea y el tick sigue (no rompe el reloj); un
  job que falla se marca `error` con la nota.
- `isSandbox()` no aplica al tool (loop LLM short-circuiteado en el clon).

## Testing (node:test)
- `classifyAgentRun`: inline vs queue vs desconocido.
- `enqueueRequest`/`claimPending`/`markRequest` sobre `:memory:`: encola pending; claim lo pasa
  a running y no lo re-devuelve en un 2º claim; markRequest done/error persiste.
- `drainRequests` con `fetchImpl` + `spawn` fakes: dado 1 request de cheshire → spawnea
  `cheshire.js` y postea `/done`; sin requests → no spawnea.
- Ningún test pega a la red ni corre agentes reales.

## Criterios de éxito
1. "Corré el chequeo de infra" → White Rabbit corre y Alicia trae el resultado fresco en el acto.
2. "Testeá el ERP con Cheshire" → Alicia encola y avisa; en ≤10 min el resultado aparece en
   `agents_status`/`ask_agent`.
3. La cola no dispara dos veces el mismo pedido; QUARANTINE lo frena.
4. Solo CEO + admins pueden usar `run_agent`.
5. Cero regresión: el schedule normal, los reportes y el reloj siguen igual.

## Abierto / a definir en el plan
- ¿`run_agent` in-process notifica (WhatsApp) o solo devuelve el texto? (propuesta: solo
  devuelve; `notify:false`).
- TTL/limpieza de `agent_run_requests` viejos (propuesta: no v1; son pocas filas).
- Nombre del env del brain URL en la bestia (`BRAIN_URL`, con fallback al de Railway).
