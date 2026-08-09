# Wonderland — Activar Knave + stubs (Sub-proyecto B)

_Diseño · 2026-08-08 · repo `alice` / `alicia-brain`_

## Contexto

La constelación **Wonderland IT** (`docs/WONDERLAND_IT.md`) son agentes autónomos de infra para el ecosistema Alicia.

**Ya activos (cron en Railway, `cron.js`):** 🐰 White Rabbit (infra pública, c/30min), 🎩 Mad Hatter (perf/costos, c/hora), 🖤 Dark Alice (jefa de ops, 7:15am).

**🫖 Tea Table — no es un agente**, es la **instancia donde se juntan todos los agentes**: sintetiza semanalmente los hallazgos de la constelación en un informe ejecutivo. Solo hay que registrar a Knave en su mapa para que lo incluya en la síntesis.

**Ya construido y reportando al Lab:** 😺 **Cheshire** (`scripts/cheshire.js`, v1) — Playwright/Chromium contra prod: ERP carga + login renderiza, error-path del login, `aliceai.bam.pe` desde browser real (TLS), responsive 375px, errores de consola. Reporta a `/api/agents/report` con `x-agent-key`. **La lógica no se toca**, pero **sí se agenda** por el reloj único (ver abajo): hoy no tiene plist que lo dispare cada 30 min.

**Falta construir → este sub-proyecto:**
- ⏰ **Reloj único** en la bestia (`scripts/bestia-runner.js` + `bestia-bootstrap.js`) — un solo scheduler que corre todo lo de la bestia.
- 🃏 **Knave** (seguridad) — no existe ni en el esquema ni en la doc.
- ⚔️ **Bandersnatch** (chaos) y ⚡ **Jabberwocky** (fuzzer) — requieren un clon nocturno de DB+stack que aún no existe ("jamás contra prod con datos reales") → se crean como stubs hasta que exista el clon.

**Fuera de alcance:** el loop de aprendizaje (Sub-proyecto A, posterior).

## Arquitectura de runner — reloj único

Todo lo que corre en la bestia (scraper, Cheshire, Knave, stubs) queda **anclado a un solo reloj**, en vez de un launchd por agente.

- **La bestia** = Hackintosh `alicias-mac-pro-1`, Tailscale IPv4 `100.88.12.17`, user `eduardobonilla`, repo en `~/Desktop/ALICE`. Node vía Volta (`/Users/eduardobonilla/.volta/bin/node`).
- **Sin SSH:** no alcanzable por shell (puerto 22 cerrado, Tailscale SSH no advertisido). **Único canal de despliegue = git.**
- **Reporte a Railway:** `POST /api/agents/report` con header `x-agent-key` (env `AGENTS_API_KEY`), usando el dominio `*.up.railway.app` (cert siempre válido aun si el dominio custom está roto). El gate de `server.js` ya deja pasar `x-agent-key` para rutas `/agents/`.

### El reloj: `scripts/bestia-runner.js`

Un **único launchd** (`com.hygge.wonderland.plist`) corre `bestia-runner.js` cada ~10 min. En cada tick:

1. **`git pull --ff-only`** (self-update, en un solo lugar).
2. Lee una **tabla de horarios en código** (versionada) y decide qué job está vencido según su "último corrió" (archivo de estado local `~/Library/Application Support/wonderland/schedule-state.json`, no depende de prod):

   | Job | Cadencia |
   |---|---|
   | scraper (Radar) | c/6h |
   | Cheshire | c/30min |
   | Knave · checks pasivos | c/hora |
   | Knave · `npm audit` | diario |
   | Knave · `security-review` | semanal |
   | Bandersnatch / Jabberwocky | inertes (skipped) |

3. Dispara solo los vencidos, con **lock por job** (no arranca uno si el anterior sigue corriendo — relevante para Cheshire/browser y `npm audit`) y respetando `QUARANTINE=true` (solo observan).
4. Actualiza el estado local con el timestamp de cada corrida.

**Ventajas:** un solo punto de self-update; un solo plist para instalar; agregar un agente futuro = **una fila en la tabla**, no un plist nuevo; Cheshire queda agendado de verdad por el mismo reloj.

### Despliegue y migración: auto-bootstrap vía git (sin SSH)

El self-update refresca código pero **no instala/retira launchd**. Sin shell, la transición al reloj único se hace por auto-bootstrap, encadenado desde el punto de entrada que ya se auto-actualiza (`scrape.js`, hoy corrido por el plist viejo `com.hygge.white-rabbit.plist` c/6h con `git pull` al inicio, commit 79939b1):

- Nuevo `scripts/bestia-bootstrap.js` (idempotente): (a) instala/actualiza `com.hygge.wonderland.plist` vía `launchctl` a nivel usuario (`eduardobonilla`, **sin sudo**); (b) retira el plist viejo `com.hygge.white-rabbit.plist` para no correr el scraper por duplicado.
- `scrape.js` llama a `bestia-bootstrap` al final de su corrida. La primera vez que la bestia pullee el código nuevo, se instala el reloj único y se retira el viejo; de ahí en más **el reloj único es el corazón** y corre todo (incluido el scraper c/6h).
- **Seguridad de la transición:** el bootstrap solo retira el plist viejo *después* de confirmar que el nuevo quedó cargado (`launchctl print`). Si algo falla, el viejo sigue vivo → no se pierde el heartbeat.
- **Latencia de activación:** hasta ~6h post-merge (próximo pull del plist viejo), salvo pull forzado por la sesión conectora.

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

1. Un **único launchd** (`com.hygge.wonderland.plist`) corre el reloj; el plist viejo del scraper queda retirado; scraper y Cheshire corren a su cadencia por el mismo reloj.
2. Knave existe en el esquema, corre sus checks + `npm audit`, y caza el CORS abierto actual como finding real, visible en el Lab del cockpit.
3. Knave nunca ejecuta acciones (L0): solo `agent_runs`/`findings`.
4. Bandersnatch/Jabberwocky aparecen "en espera" (skipped), sin tocar prod.
5. El auto-bootstrap instala el reloj único en la bestia sin SSH ni intervención manual, solo con el merge a `main`, y la transición no pierde el heartbeat (el plist viejo solo se retira tras confirmar el nuevo).
6. Cero regresión en los agentes de Railway (White Rabbit, Mad Hatter, Dark Alice, Tea Table), en Cheshire ni en el scraper.
