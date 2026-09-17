# Mica · servicio del cockpit

Corre aparte del brain, en su propio servicio de Railway (`mica`, proyecto
`keen-miracle`), y se publica en `micaai.bam.pe`.

- **Arranque:** `node src/mica/server.js` — configurado en el servicio, no en
  `railway.json`. El `railway.json` de `alicia-brain` arranca el brain con
  `setup-db.js` por delante, y eso no debe correr acá.
- **Healthcheck:** `/health`.
- **Puerto:** `PORT` (lo inyecta Railway). `MICA_PORT` es solo para local.
- **Modelo:** con `ANTHROPIC_API_KEY` usa el SDK; sin ella, la sesión local de
  Claude Code (`claude -p`). Ver `llm.js`.
- **Catálogo:** `catalogo.json`. Un proyecto sin tipologías se declara como
  "sin tipologías cargadas" y Mica no las inventa.

## WhatsApp

Entra por `POST /webhook/whatsapp` (Twilio, form-encoded). Se valida **firma**
(`X-Twilio-Signature`): sin eso cualquiera inyecta conversaciones y nos hace gastar
tokens. La URL se arma con `X-Forwarded-Proto`, no con "https" fijo — Twilio firma
sobre la URL exacta que llamó, y fijarlo rompe toda prueba fuera de producción.

Se responde `200` al toque y se contesta aparte: el modelo tarda segundos y Twilio no
debe esperar ni reintentar.

Variables: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` (referencias al servicio `alice`)
y **`MICA_WHATSAPP_FROM`**, que es el número PROPIO de Mica. Sin esa última el envío
falla fuerte a propósito: el número de Alicia es por donde habla el equipo, y mandar
prospectos por ahí le mete compradores en el chat interno a Jose.

Los hilos van a `RAILWAY_VOLUME_MOUNT_PATH/mica.db` si hay volumen; si no, a memoria.

Local: `node src/mica/server.js` → http://localhost:3010
