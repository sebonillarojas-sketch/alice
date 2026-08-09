# Alicia unificada / embodied — Diseño

_2026-08-09 · repo `alice` / `alicia-brain`_

## Contexto

Sebastián siente a Alicia **fragmentada**: habla con Jose/Andrea por WhatsApp pero no puede decirle a Sebastián de qué hablan; no manda un WhatsApp a Jose cuando se lo pide; no tiene consciencia de la bestia/NAS ("su cuerpo") ni de lo que pasa en simultáneo en Wonderland; el panel se siente parcial.

**Realidad del código (importante):** el cerebro YA es uno solo. Los 3 canales (`app` = ERP, `whatsapp` = Twilio, `embodied` = su teléfono/voz) pasan todos por `processAliciaMessage` → `buildSystemPrompt` (server.js). Alicia YA tiene tools de Dropbox (`dropbox_upload/read/move/search`) y de Wonderland (`agents_status`). La fragmentación NO es de datos ni de múltiples cerebros — es falta de: (a) **awareness situacional** (no "ve" lo simultáneo), (b) **2 manos** (mandar WA a otra persona, leer conversación de otra persona), (c) **auto-conocimiento** (no sabe que vive en la bestia/NAS ni que Wonderland es parte de ella).

## Objetivo

Que Alicia se sienta **una** y **presente**: consciente de lo que pasa en simultáneo (conversaciones, Wonderland, sus sistemas, su cuerpo), capaz de actuar entre personas y sistemas, e idéntica en las 3 superficies. Modelo elegido: **digest situacional siempre-on + tools on-demand**.

## Componentes

### 1. Digest situacional (siempre en el contexto de Alicia)
Nueva función `buildWorldDigest(userId)` (server.js o módulo `src/world.js`) que arma un bloque compacto, inyectado por `buildSystemPrompt`. Barato (queries indexadas), cacheado ~2-5 min en `app_settings` o memoria. Contenido:
- **Su cuerpo (embodiment):** "Vivís en la bestia (`alicias-mac-pro-1`, Tailscale 100.88.12.17) + el NAS. Wonderland (White Rabbit, Cheshire, Mad Hatter, Dark Alice, Knave, Bandersnatch, Jabberwocky) son parte de vos — tus sentidos y manos en la infra. Estás presente en WhatsApp, el ERP y la app Hygge OS **al mismo tiempo**; es la misma vos en las tres."
- **Wonderland (vivo):** último run por agente + findings `critical`/`major` abiertos (de `agent_runs`/`agent_findings`).
- **Salud de sistemas:** último tick del reloj de la bestia / scraper, estado del brain, (NAS si hay señal). Degradado si no hay datos.
- **Actividad reciente del equipo — SOLO para CEO (Sebastián):** una línea por persona con actividad hoy: "Jose · habló de <tema> hace 2h". **Nivel tema, no transcripción.** Para otros usuarios este bloque NO aparece.

### 2. Las 2 manos que faltan (tools nuevos, en `tools.js`)
- **`send_whatsapp`** `{ persona, mensaje }` — manda un WhatsApp a otra persona del equipo vía `wa.js sendWA` (resuelve el teléfono desde `profiles`). **Gateado a CEO.** Caso: "decile a Jose que la reunión se movió".
- **`read_conversation`** `{ persona, limit? }` — devuelve los últimos N mensajes de la conversación de otra persona con Alicia (de `messages`). **Gateado a CEO.** Caso: "¿de qué viene hablando Andrea?".

*(Dropbox up/down y `agents_status` ya existen — se promocionan explícitamente en el system prompt y se verifica que estén habilitados en los 3 canales.)*

### 3. Bloque de embodiment en el system prompt
Además del digest, una sección estable de identidad: quién es, dónde vive, que Wonderland es su cuerpo extendido, que es la misma Alicia en las 3 superficies. (Parte fija; el digest es la parte que cambia.)

### 4. Autoridad / privacidad
- `read_conversation` y el bloque de actividad del equipo = **solo CEO** (`userId === CEO_ID`). Otros usuarios nunca ven conversaciones ajenas ni el digest de otros.
- `send_whatsapp` (mandar en nombre de Alicia a un tercero) = **solo CEO**. (Más adelante se puede permitir a otros con confirmación, fuera de alcance.)
- Nada destructivo; todo es leer/mensajear. Consistente con la jerarquía Wonderland (esto es L0/L1).

### 5. Presencia consistente en las 3 superficies
Auditar que `app`, `whatsapp` y `embodied` reciban el MISMO `buildSystemPrompt` (con digest + embodiment) y el MISMO toolset. Hoy comparten `processAliciaMessage`; verificar que ningún canal recorte tools ni contexto. La "app Hygge OS" que usa Sebastián debe pegar al mismo endpoint del brain (si hoy no lo hace del todo, es parte de la paridad).

## No-objetivos (Fase B / después)
- **Pings proactivos** (que Alicia te escriba sola cuando pasa algo) — decisión de ruido; va después.
- **Estado vivo profundo de bestia/NAS** (métricas en tiempo real por SSH) — la bestia no tiene SSH; por ahora el digest usa lo que ya reporta (reloj/scraper/agentes).
- **Rescate/unificación de la app Hygge OS móvil** como producto — nota aparte; acá solo se asegura paridad de contexto si ya pega al brain.
- Reescribir el cerebro: se reusa `buildSystemPrompt`, `messages`, `tools.js`, `wa.js`, integraciones.

## Fases
- **Fase A (núcleo):** `buildWorldDigest` + inyección + bloque embodiment + tools `send_whatsapp` y `read_conversation` + gating CEO + promoción de tools existentes. Testeable (mappers/gating puros; queries indexadas).
- **Fase B:** pings proactivos, estado vivo bestia/NAS, paridad total HyggeOS app, permitir a no-CEO con confirmación.

## Criterios de éxito
1. En cualquier canal, Sebastián le pregunta "¿de qué habla Jose?" y Alicia responde (vía `read_conversation`), y "decile a Andrea que X" y llega el WhatsApp (vía `send_whatsapp`).
2. Sin que se lo pidan, Alicia demuestra awareness: menciona Wonderland / actividad del equipo / su cuerpo cuando es relevante (por el digest).
3. Un usuario NO-CEO nunca ve conversaciones ajenas ni puede mandar en nombre de Alicia.
4. El digest no infla notablemente la latencia/costo por mensaje (cacheado, queries indexadas).
5. Las 3 superficies dan la misma Alicia (mismo contexto + tools).
6. Alicia, preguntada "¿dónde vivís?", sabe que vive en la bestia + NAS y que Wonderland es parte de ella.

## Abierto / a definir en el plan
- Ventana del digest de actividad (¿hoy? ¿últimas 24h?) y cuántas personas.
- TTL del cache del digest.
- Umbral de severidad de Wonderland que entra al digest (¿solo critical? critical+major?).
