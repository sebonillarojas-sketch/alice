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

Local: `node src/mica/server.js` → http://localhost:3010
