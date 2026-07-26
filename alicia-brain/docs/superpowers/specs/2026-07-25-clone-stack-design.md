# Clon-stack 🪞 — Diseño (v1)

_2026-07-25 · Wonderland IT · habilitador para Bandersnatch + Jabberwocky_

## Contexto

Bandersnatch (chaos) y Jabberwocky (fuzzer) tienen **regla de oro: jamás contra
producción con datos reales** (ver `docs/WONDERLAND_IT.md`). Necesitan un **clon
aislado** del stack para atacar. Este spec cubre **solo el clon-stack** (el habilitador);
los dos agentes son proyectos aparte que lo usan.

`alicia-brain` es Node/Express + **SQLite** (`/data/alicia.db` en el volumen de Railway).
alicia-mac es host 24/7 ("no duerme").

## Objetivo y criterios de éxito

- Cada noche, alicia-mac tiene una copia **fresca y sanitizada** de la DB de prod y una
  instancia **aislada** de `alicia-brain` corriendo contra ella en `localhost:4001`.
- **Ninguna credencial/PII real sale de prod:** el snapshot se sanitiza **en el origen**.
- El clon **no puede** enviar WhatsApp/emails ni tocar servicios externos reales (env
  falso + bind localhost). Un fuzzer que "rompa" el clon no afecta nada real.
- Reconstrucción idempotente y re-disparable on-demand.

## Arquitectura

### 1. Endpoint de snapshot (en `alicia-brain`)

`GET /api/admin/db-snapshot` protegido por `x-agent-key` (mismo `requireAgentKey` que
`/api/agents/report`). Flujo:

1. `VACUUM INTO '<tmp>.db'` → copia consistente del `alicia.db` vivo (no bloquea prod).
2. Abrir la copia y correr el **sanitizador** (`sanitizeDb(db)`): sobre la COPIA, nunca la
   prod:
   - `app_settings`: NULL en filas cuya `key` matchee secretos (`*_token`, `*_key`,
     `*_secret`, `dropbox*`, `google*`, `twilio*`, `anthropic*`, `groq*`).
   - `oauth_tokens` (o equivalente): `DELETE FROM oauth_tokens` (el clon no necesita
     tokens reales).
   - `profiles`: `phone`/`email` → placeholders (`+000…`, `qa@example.com`).
   - `conversations`/mensajes: `content` → `'[redactado]'` (se conserva estructura/volumen
     para el chaos test, no el contenido).
3. Streamear el `.db` sanitizado como `application/octet-stream`; borrar el tmp.

El sanitizado es **data-driven**: una lista de reglas (`SANITIZE_RULES`) que el sanitizador
aplica. Fácil de extender y de testear.

### 2. Constructor del clon (en alicia-mac, `~/wonderland/clone/`)

- `rebuild.sh`: baja el snapshot (`curl -H x-agent-key … -o data-clone/alicia.db`), valida
  que es un SQLite válido (`sqlite3 … "pragma integrity_check"`), y **relanza** la instancia
  clon (mata la anterior por su pidfile, arranca la nueva).
- `.env.clone`: `PORT=4001`, `SQLITE_PATH=./data-clone/alicia.db`, `HOST=127.0.0.1`, y
  **keys dummy** (`TWILIO_*`, `GOOGLE_*`, `ANTHROPIC_API_KEY`, `GROQ_*` con valores
  inválidos) + `WA_ENABLED=false` / flags de envío en OFF. Con keys inválidas, toda llamada
  externa falla inofensiva.
- `launch.sh`: `SQLITE_PATH=… PORT=4001 node <alicia-brain>/src/server.js` con el `.env.clone`.
- `com.hygge.clone.plist`: launchd nocturno (~1am) que corre `rebuild.sh`.

### 3. Ciclo de vida

`rebuild.sh` (1am) → clon fresco en `:4001` → Bandersnatch (2-5am) y Jabberwocky (diario)
atacan `http://127.0.0.1:4001` → cada uno POSTea findings al backend **real**
(`https://aliceai.bam.pe/api/agents/report`). El clon se descarta y se reconstruye la
noche siguiente.

## Componentes (aislados)

- **`src/sanitize.js`** (alicia-brain) — `SANITIZE_RULES` (data) + `sanitizeDb(db) → {redacted}`
  (aplica las reglas sobre una conexión sqlite). Sin red, sin server. **Testeable.**
- **`src/snapshot.js`** (alicia-brain) — `makeSnapshot() → tmpPath` (`VACUUM INTO` + abrir +
  `sanitizeDb` + cerrar). Depende de `db.js` y `sanitize.js`.
- **endpoint** en `server.js` — usa `requireAgentKey`, llama `makeSnapshot()`, streamea, limpia.
- **`~/wonderland/clone/`** (alicia-mac) — `rebuild.sh`, `launch.sh`, `.env.clone.example`,
  `com.hygge.clone.plist`.

## Datos / flujo

prod DB → `VACUUM INTO` (copia) → `sanitizeDb` (copia) → stream → alicia-mac
`data-clone/alicia.db` → clon `alicia-brain :4001` (env falso) → agentes atacan → findings
al backend real.

## Manejo de errores

- `makeSnapshot` en `try/finally` que borra el tmp aunque falle; el endpoint devuelve 500
  con detalle si algo revienta (nunca streamea una copia a medio-sanitizar).
- `rebuild.sh`: si el snapshot baja corrupto (`integrity_check` != ok) → **no** relanza el
  clon (deja el anterior) y loguea; sale ≠ 0 para que launchd lo registre.
- El clon con keys inválidas: los errores de servicios externos son esperados y se ignoran
  (no son findings del clon).

## Testing

- **`sanitize.test.js`**: crear una DB temp con filas sensibles (un `app_settings` con
  `google_token`, un `profiles` con phone real, un mensaje) → `sanitizeDb` → assert que los
  secretos quedaron NULL/redactados y que las filas NO sensibles siguen intactas.
- **Snapshot smoke** (en alicia-brain): `makeSnapshot()` produce un archivo, `pragma
  integrity_check` = ok, y una query a `app_settings` no devuelve el token real.
- **Integración** (en alicia-mac): `rebuild.sh` baja, valida, y el clon responde
  `GET :4001/health` = 200.

## Prerrequisitos

- `AGENTS_API_KEY` compartida (ya en Railway) para el endpoint de snapshot.
- alicia-mac con Node + `sqlite3` CLI + acceso al backend (Tailscale/HTTPS).
- Copia local del código de `alicia-brain` en alicia-mac para levantar el clon.

## Fuera de alcance (specs propios)

- **Bandersnatch** (chaos: ramp-up de carga, inyección de fallas) y **Jabberwocky**
  (fuzzer: inputs adversariales, prompt-injection) — usan este clon.
- Egress firewall a nivel SO (con keys inválidas + bind localhost alcanza para v1).
- Clonar servicios externos (Groq/Twilio) — el clon los deja fallar.
