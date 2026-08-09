# Clon nocturno + despertar Bandersnatch/Jabberwocky — Diseño

_2026-08-09 · repo `alice` / `alicia-brain`_

## Contexto

Bandersnatch (chaos) y Jabberwocky (fuzzer) están como **stubs** que reportan "esperando clon nocturno". Su regla de oro: **jamás contra prod con datos reales**. Necesitan un entorno desechable para saturar / inyectar inputs adversariales sin dañar producción.

**Hallazgo que simplifica todo:** el brain de Alicia usa **SQLite en archivo** (`SQLITE_PATH`, default `./alicia.db`) para sus tablas propias (messages, lessons, agent_runs, etc.), y **todas las integraciones externas se apagan solas si faltan credenciales**:
- Twilio/WhatsApp (`wa.js`): `if (!accountSid) return null`.
- Supabase (`supabase-tasks.js`): `if (!KEY) throw` (se puede catchear).
- Dropbox (`integrations/dropbox.js`): gatea por `DROPBOX_APP_KEY`; además tiene `DROPBOX_MODE=local`.
- `PORT` es `process.env.PORT || 3001`.

Por eso el clon NO requiere clonar Postgres ni infra pesada: es **copiar un archivo SQLite + lanzar una 2ª instancia del brain con env pelado**, sandboxeada por ausencia de credenciales.

## Objetivo

Un entorno clon **desechable, aislado y automático** en la bestia, levantado cada noche por el reloj único, donde Bandersnatch y Jabberwocky corren contra un brain real sin ningún efecto sobre producción. Y rellenar los stubs para que efectivamente ataquen el clon.

## Componentes

### 1. Guard global de sandbox — `SANDBOX=1`
Refuerzo de seguridad (cinturón + tiradores) además de la ausencia de credenciales. Un helper `isSandbox()` (env `SANDBOX === "1"`) y guards al inicio de cada salida externa:
- `wa.js sendWA`: si `isSandbox()` → log + `return false` (nunca manda WhatsApp).
- `supabase-tasks.js` (escrituras): si `isSandbox()` → no-op / devuelve mock (nunca toca Supabase).
- `integrations/dropbox.js` (writes): si `isSandbox()` → no-op o fuerza `LOCAL_MODE`.
- Llamadas a Anthropic/Groq/Tavily/Zoom/Google: si `isSandbox()` → devuelven respuesta canned (no gastan tokens ni pegan afuera).
Objetivo: **aunque alguien setee un secret por error en el clon, es imposible que toque prod o gaste plata.**

### 2. Lifecycle del clon — `scripts/clon-nocturno.js` (corre en la bestia)
Disparado por el **reloj único** (`bestia-runner.js` / `schedule.js`) — nueva fila `{ id: "clon-nocturno", script: "clon-nocturno.js", everyMs: DAY }` (cadencia nocturna; el runner ya existe de la Fase del reloj).
Flujo por corrida:
1. **Snapshot:** copiar `alicia.db` → `alicia-clone.db` (con `VACUUM INTO` o copia de archivo con WAL checkpoint para consistencia).
2. **Levantar clon:** `spawn` de `node src/server.js` con env: `SQLITE_PATH=./alicia-clone.db`, `PORT=3099`, `SANDBOX=1`, y **sin** secrets (Twilio/Supabase/Dropbox/Anthropic vacíos). Esperar a que `GET http://localhost:3099/health` responda.
3. **Correr los agentes contra el clon:** invocar `runBandersnatch({ target: "http://localhost:3099" })` y `runJabberwocky({ target })` (ver §3). Reportan a **prod** (`/api/agents/report` con `x-agent-key`) — el reporte es dato, no efecto peligroso.
4. **Teardown:** matar el proceso del clon (guardar su PID) + borrar `alicia-clone.db` (+ `-wal`/`-shm`). Idempotente: si quedó un clon colgado de una corrida anterior, matarlo antes de empezar.
5. Timeboxed (ej. máx 60 min); si se pasa, teardown forzado.

### 3. Rellenar los stubs (cuerpos reales)
- **⚔️ Bandersnatch (`scripts/bandersnatch.js`):** contra `target`, rampa de carga (1x → 5x → 20x → 100x) sobre endpoints del brain (API REST, DB, agentic loop); inyección de fallas (matar el proceso a mitad de un tool call, cortar red durante TTS). Reporta a qué carga se degrada cada pieza y el cuello de botella. **Solo corre si `target` apunta a `localhost:3099` (clon)** — nunca contra prod; si `target` no es el clon → aborta con finding.
- **⚡ Jabberwocky (`scripts/jabberwocky.js`):** inputs adversariales contra el clon: audios corruptos/vacíos/largos, mensajes de 10k chars, emojis/RTL/null bytes, prompt injection, teléfonos no autorizados intentando acciones sensibles. Reporta qué rompe el parser y qué respuestas filtran info. Mismo guard: solo contra el clon.

### 4. Reporte
Ambos reportan a prod vía `POST /api/agents/report` (`x-agent-key`), así el cockpit/Tea Table los muestra "activos" con sus hallazgos, en vez de "en espera". `critical` escala a Dark Alice.

## Autoridad / seguridad
- El clon corre en la bestia (fierro sobrante), aislado por puerto + db + env.
- **Doble candado anti-prod:** (a) env pelado (sin credenciales), (b) `SANDBOX=1` global. Bandersnatch/Jabberwocky además chequean que `target` sea el clon.
- Respeta `QUARANTINE=true` del reloj (si está, ni se levanta el clon).

## No-objetivos (después)
- Clonar la **tabla `tasks` de Supabase** al clon: en v1 el clon no tiene Supabase (las rutas de tasks fallan/no-op bajo SANDBOX) — el chaos/fuzz se enfoca en el brain (API/DB/agentic loop/TTS/webhooks), que es lo valioso. Si más adelante se quiere fuzzear tasks, se siembra un Supabase throwaway o un stub local.
- Métricas históricas de degradación en el tiempo (dashboard) — v2.

## Criterios de éxito
1. El reloj levanta el clon en la bestia cada noche, con `/health` OK en `:3099`, y lo tira a la mañana sin dejar procesos ni archivos colgados.
2. Con `SANDBOX=1` + env pelado, **cero** efectos externos: ninguna WhatsApp, ningún write a Supabase/Dropbox reales, cero tokens gastados (verificable).
3. Bandersnatch reporta la curva de degradación; Jabberwocky reporta qué inputs rompen el parser — ambos SOLO contra `:3099`, nunca prod (abortan si el target no es el clon).
4. El cockpit/Tea Table los muestra activos con hallazgos (dejan de estar "en espera").
5. Cero impacto en prod durante la corrida nocturna (medible: sin picos ni writes de prod atribuibles al clon).

## Abierto / a definir en el plan
- Método de copia consistente del SQLite con WAL (`VACUUM INTO` vs checkpoint+copy).
- Puerto fijo (3099) vs dinámico; manejo si el puerto está ocupado.
- Rampa exacta de Bandersnatch y catálogo de inputs de Jabberwocky (v1 acotado).
- Ventana horaria y timebox.
