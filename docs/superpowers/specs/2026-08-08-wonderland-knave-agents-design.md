# Wonderland — Activar Knave + stubs (Sub-proyecto B)

_Diseño · 2026-08-08 · repo `alice` / `alicia-brain`_

## Contexto

La constelación **Wonderland IT** (`docs/WONDERLAND_IT.md`) son agentes autónomos de infra para el ecosistema Alicia.

**Ya activos (cron en Railway, `cron.js`):** 🐰 White Rabbit (infra pública, c/30min), 🎩 Mad Hatter (perf/costos, c/hora), 🖤 Dark Alice (jefa de ops, 7:15am), 🫖 Tea Table (consejo semanal).

**Ya construido y reportando al Lab:** 😺 **Cheshire** (`scripts/cheshire.js`, v1) — Playwright/Chromium contra prod: ERP carga + login renderiza, error-path del login, `aliceai.bam.pe` desde browser real (TLS), responsive 375px, errores de consola. Reporta a `/api/agents/report` con `x-agent-key`. **Fuera de alcance de este build — no se toca.**

**Falta construir → este sub-proyecto:**
- 🃏 **Knave** (seguridad) — no existe ni en el esquema ni en la doc.
- ⚔️ **Bandersnatch** (chaos) y ⚡ **Jabberwocky** (fuzzer) — requieren un clon nocturno de DB+stack que aún no existe ("jamás contra prod con datos reales") → se crean como stubs hasta que exista el clon.

**Fuera de alcance:** el loop de aprendizaje (Sub-proyecto A, posterior).

## Nota sobre agendado de Cheshire (informativo, no se acciona acá)

El único launchd presente (`scripts/com.hygge.white-rabbit.plist`) corre **`scrape.js all`**, no Cheshire. Cheshire funciona al invocarse pero no tiene plist propio que lo agende en la bestia. Se documenta como observación; **no se modifica en este sub-proyecto** salvo indicación explícita. Si más adelante se quiere agendar, entra por el mismo auto-bootstrap descrito abajo.

## Arquitectura de runner

Knave (tooling de seguridad pesado) corre en la **mac bestia**, no en Railway:

- **La bestia** = Hackintosh `alicias-mac-pro-1`, Tailscale IPv4 `100.88.12.17`, user `eduardobonilla`, repo en `~/Desktop/ALICE`. Node vía Volta (`/Users/eduardobonilla/.volta/bin/node`).
- **Sin SSH:** no alcanzable por shell (puerto 22 cerrado, Tailscale SSH no advertisido). **Único canal de despliegue = git.**
- **Self-update existente:** el runner de la bestia hace `git pull --ff-only` al arrancar (commit 79939b1). Lo que se mergea a `main`, la bestia lo pullea sola en su próxima corrida.
- **Reporte a Railway:** `POST /api/agents/report` con header `x-agent-key` (env `AGENTS_API_KEY`), usando el dominio `*.up.railway.app` (cert siempre válido, aun si el dominio custom está roto). El gate de `server.js` ya deja pasar `x-agent-key` para rutas `/agents/`.

### Despliegue: auto-bootstrap vía git (sin SSH)

El self-update refresca código pero **no instala launchd nuevos**. Sin shell, la activación de Knave se hace por auto-bootstrap:

- Nuevo `scripts/bestia-bootstrap.js`: registra/actualiza el plist `com.hygge.knave.plist` con `launchctl` a nivel usuario (`eduardobonilla`, **sin sudo**). Idempotente.
- El runner existente llama a `bestia-bootstrap` al final de cada corrida. La primera vez que la bestia pullee el código nuevo, se auto-instala el scheduler de Knave.
- **Latencia de activación:** hasta ~6h post-merge (próximo pull de la bestia), salvo pull forzado por la sesión conectora.

## Componentes

### 🃏 Knave — `scripts/knave.js` (agente `knave`, NUEVO)

**Migración de esquema primero** (`db.js`, idempotente): agregar `'knave'` al CHECK de `agent_runs` y `agent_findings` (hoy: `white-rabbit, cheshire, bandersnatch, mad-hatter, jabberwocky, dark-alice, tea-table`). Actualizar mapas de nombre/emoji en `darkalice.js` y `teatable.js`.

**Checks (no-destructivos contra prod):**
1. **Headers de seguridad** — HSTS, CSP, X-Frame-Options, X-Content-Type-Options en aliceai/alice.bam.pe (gap #5 de la auditoría de seguridad).
2. **CORS** — detecta el `app.use(cors())` abierto (gap #3): preflight con Origin hostil, verifica que NO se refleje `Access-Control-Allow-Origin: *` en rutas sensibles.
3. **Auth gate** — rutas protegidas rechazan sin JWT / con token basura (401); `/agents/` sin `x-agent-key` no pasa.
4. **Rate-limit** — ráfaga controlada a endpoint público, verifica que exista límite (gap #1).
5. **Secret/token scan** — no hay secrets en respuestas/HTML; valida validez y expiración de tokens (Google/Dropbox/Zoom) sin quemarlos.
6. **`npm audit`** — deps con CVEs conocidos (corre en la bestia sobre el repo).
7. **Revisión profunda (semanal):** invoca el skill `security-review` sobre el diff reciente y cuelga hallazgos.

**Autoridad: L0 observar.** Knave **solo reporta, nunca repara ni ejecuta** — seguridad no se auto-parcha. `critical` escala a Dark Alice → WhatsApp.

**Cadencia:** checks pasivos c/hora; `npm audit` diario; `security-review` semanal.

### ⚔️⚡ Bandersnatch + Jabberwocky — stubs (`scripts/bandersnatch.js`, `scripts/jabberwocky.js`)

- Estructura completa (export `run*`, reporte a `agent_runs`), cuerpo **no-opea**: cada corrida escribe `agent_run` con `result:'skipped'`, `summary:"esperando clon nocturno — no corre contra prod"`.
- Sin cron activo (no se registran en el bootstrap). El cockpit los muestra "en espera" en vez de simulados. Cuando exista el clon: rellenar cuerpo + activar, sin re-cablear.

## Contrato común (patrón `whiterabbit.js` / `cheshire.js`)

Cada agente exporta `run<Nombre>()`; inserta en `agent_runs` (`agent`, `finished_at`, `result`, `summary`, `actions_taken` JSON) y `agent_findings` (`agent`, `run_id`, `severity`, `category`, `detail`, `status`); auto-cierra findings resueltos; reporta a Railway vía `POST /api/agents/report` con `x-agent-key`.

## Errores y notificaciones

- **Notificación (patrón White Rabbit):** WhatsApp solo en transición (ok→fail / fail→ok), sin spam. `critical` inmediato a Sebastián; el resto al reporte diario de Dark Alice.
- **Errores del agente:** corrida envuelta en try/catch; fallo se registra como `agent_run result:'error'`, no tumba el scheduler ni otros agentes.
- **Kill switch:** respetar `QUARANTINE=true` (solo observan).

## Testing

- **Knave:** probar contra el estado actual conocido — debe cazar el **CORS abierto** de hoy (señal viva); un header presente NO debe dar falso positivo; `npm audit` corre sin romper si no hay CVEs.
- **Stubs:** Bandersnatch/Jabberwocky reportan `skipped` correctamente, no tocan nada.
- **Bootstrap:** idempotencia (correrlo 2× no duplica el plist de Knave).

## Coordinación / restricciones

- La sesión Bammy trabaja en el repo `alice` (rama `bammy/aprendizaje-vivienda`, PR #36 draft). **Regla: no pushear ni mergear a `main` hasta que Bammy cierre.**
- Este trabajo vive en worktree aislado, rama **`feat/wonderland-cheshire-knave`**. La bestia solo pullea `main` → no ve nada hasta el merge (activación diferida a propósito).
- Sesiones coordinan por git, no directo.

## Criterios de éxito

1. Knave existe en el esquema, corre sus checks + `npm audit`, y caza el CORS abierto actual como finding real, visible en el Lab del cockpit.
2. Knave nunca ejecuta acciones (L0): solo `agent_runs`/`findings`.
3. Bandersnatch/Jabberwocky aparecen "en espera" (skipped), sin tocar prod.
4. El auto-bootstrap instala el launchd de Knave en la bestia sin SSH ni intervención manual, solo con el merge a `main`.
5. Cero regresión en los agentes ya activos (White Rabbit, Mad Hatter, Dark Alice, Tea Table) ni en Cheshire.
