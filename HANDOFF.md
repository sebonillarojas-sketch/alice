# ALICE · HANDOFF — Estado completo del proyecto
_Generado: 12 julio 2026 · para continuar en la cuenta corporativa (sebastian@hygge.pe, plan Max)_
_Primer mensaje sugerido en la nueva sesión: "Lee HANDOFF.md y continúa donde quedamos"_

---

## 1. QUÉ ES ESTO

Dos productos, una regla:
- **alice.bam.pe** — ERP/cockpit de Hygge Holding (React+Vite, carpeta `files/alice`). Deploy: **Netlify** (`npm run build && npx netlify deploy --prod --dir=dist`). NO conectado a git — deploy manual.
- **aliceai.bam.pe** — Alicia, la IA standalone (Node/Express, carpeta `alicia-brain`). Deploy: **Railway**, push a `main` = deploy automático. Sirve `public/index.html` = panel de control de Alicia.
- **REGLA**: features de Alicia-como-agente van en aliceai.bam.pe, NUNCA en el ERP.

Repos git (dueño: sebonillarojas-sketch):
- `alicia-brain` → repo `sebonillarojas-sketch/alice`, root directory `/alicia-brain` en Railway

## 2. ROLES DE ALICIA (decisión de producto, inamovible)

- **Con Sebastián (userId `sb`)**: SUB-CEO / second in command. Modelo **claude-sonnet-4-6** por defecto; si el mensaje incluye "maximum effort" (o "máximo esfuerzo"), ese turno corre con **claude-fable-5** (16000 tokens, effort high, fallback sonnet). TODAS las herramientas, acceso total a info. Propone, desafía, ejecuta con autorización.
- **Con el resto (vd·jt·jm·aa·ac·jmg)**: asistente de productividad. Sonnet, allowlist de tools (tareas, calendar, SU gmail, dropbox, web_search, zoom, skills, disponibilidad). Estrategia/finanzas/datos de otros → redirige a Sebastián.
- Implementado en `alicia-brain/src/server.js` (COLLAB_TOOLS + modeBlock).

## 3. LO CONSTRUIDO HOY (12 jul) — todo deployado y verificado

| Feature | Dónde | Estado |
|---|---|---|
| Voz Groq TTS (orpheus, wav, 6 voces) | /api/tts | ✅ probado |
| WhatsApp unificado vía Twilio (briefing 7am, alertas, Tea Table lunes 7:30) | src/wa.js | ✅ probado |
| Google OAuth multi-usuario `/auth/google?user=<id>` (token por usuario en DB) | server.js + integrations/google.js | ✅ sb conectado |
| Personas por usuario (auto-aprendidas cada ~20 msgs) + instrucciones manuales | user_personas | ✅ |
| Diales: sarcasmo 0-100 + humor/formalidad/proactividad/longitud/emojis 0-10 | panel Personalidad (REALES, en prompt) | ✅ |
| Skills enseñables (playbooks + tool use_skill) | /api/skills + panel | ✅ probado |
| Insights de coaching por colaborador (fortalezas/fallas/flags) | /api/insights/:id + panel Equipo | ✅ |
| Panel aliceai: Hablar (blob+voz), Personalidad, Equipo, Recursos, etc. | public/index.html | ✅ |
| Recursos (links/conectores/código) + tool search_resources | /api/resources | ✅ probado |
| check_availability (free/busy del equipo) + regla proactiva de agenda | tools.js | ✅ |
| /api/calendar/team (calendario integral para el ERP) | server.js | ✅ funciona con token sb |
| Cerebro→Dropbox (brainsync.js): /Hygge/Sistema/Alicia/ + Memoria/<persona>.md, cron 3:30am | src/brainsync.js | ⏳ BLOQUEADO por Dropbox (ver pendientes) |
| **Volumen persistente Railway** (/data, SQLITE_PATH=/data/alicia.db) | Railway | ✅ CRÍTICO — antes la DB se borraba en cada deploy |
| Lab del ERP solo visible para admins | files/alice HyggeOS.jsx | ✅ |

## 4. PENDIENTES — EN ORDEN

1. **Dropbox OAuth (bloqueado, siguiente paso)**: el token viejo venció (Dropbox mató los tokens eternos). Ya existe `/auth/dropbox` + refresh flow en el código. Falta:
   a. Crear app en [dropbox.com/developers/apps](https://www.dropbox.com/developers/apps) **con la cuenta Dropbox corporativa/Hygge** (la personal se.bonillarojas no puede: email sin verificar): Scoped access → Full Dropbox → nombre `alicia-brain`
   b. Permissions: `files.metadata.read`, `files.content.read`, `files.content.write` → Submit
   c. Settings: Redirect URI `https://aliceai.bam.pe/auth/dropbox/callback`
   d. App key + App secret → variables `DROPBOX_APP_KEY` y `DROPBOX_APP_SECRET` en Railway (proyecto keen-miracle → servicio alice → Variables)
   e. Autorizar en `https://aliceai.bam.pe/auth/dropbox` → correr `POST /api/brain/export` → verificar carpeta `/Hygge/Sistema/Alicia/`
   - NOTA: el usuario reportó que al abrir la app console corporativa "aparece alice hygge os" — puede que YA exista una app; usar esa (mismos pasos b-e).
2. **Emails del equipo**: solo sb tiene email registrado. Cargar los de vd/jt/jm/aa/ac/jmg vía `PATCH /api/profile/:id/email {"email":"..."}` — preguntar a Sebastián si siguen el patrón nombre@hygge.pe. Sin esto check_availability solo ve a Sebastián.
3. **Autorización Google del equipo**: cada uno entra una vez a `https://aliceai.bam.pe/auth/google?user=<su_id>`.
4. **Gate de acceso para aliceai.bam.pe** — ⚠️ HOY ES PÚBLICO con data sensible (conversaciones, insights del equipo). Prioridad alta.
5. **Vista de calendario integral en el ERP** (frontend): consumir `GET /api/calendar/team?days=7` (devuelve busy blocks por persona).
6. **Twilio upgrade** (tarjeta) — sandbox tiene límite diario de WhatsApp.
7. **Groq upgrade** (tarjeta, console.groq.com/settings/billing) — free tier = 3.600 tokens de VOZ/día (~10 respuestas). La voz "se muere" cada día al agotarse; ya capamos a 600 chars por respuesta como mitigación.
8. **Borrar skill de prueba**: `DELETE /api/skills/<id>` del `__marcador-persistencia` (era test del volumen).
9. **Supercomputadora (llega ~14 jul)**: Wonderland IT (agentes IT autónomos — spec en `alicia-brain/docs/WONDERLAND_IT.md`, backend ya listo: agent_runs, /api/agents/*, AGENTS_API_KEY), memoria semántica RAG, White Rabbit con checks REALES (no presencia de env vars — lección: Dropbox estuvo roto en silencio), migración cerebro al NAS Synology.
10. **Fase A del ERP**: Cmd+K search v2; migración localStorage→Supabase (~34 usos en HyggeOS.jsx).

## 5. IDENTIDADES Y CUENTAS (fuente de bugs — respetar)

- **Regla nueva**: TODO corporativo → sebastian@hygge.pe / cuentas Hygge. El Gmail personal (se.bonillarojas@gmail.com) solo para la cuenta Claude actual (a migrar).
- Google OAuth app: proyecto GCP "My First Project" (famous-store-404612), en modo Testing, test users: sebastian@hygge.pe + se.bonillarojas@gmail.com. Scopes: calendar + gmail.modify.
- Groq (TTS/Whisper): cuenta con login Google se.bonillarojas@gmail.com — términos de orpheus aceptados.
- Railway: proyecto **keen-miracle** → servicios `alice` (alicia-brain) y `zonal-perfection` (ERP backend).
- Twilio sandbox: +14155238886.

## 6. GOTCHAS TÉCNICOS (aprendidos a golpes hoy)

- Groq TTS: modelo `canopylabs/orpheus-v1-english`, SOLO `response_format: "wav"`, voces autumn/diana/hannah/austin/daniel/troy. playai-tts está muerto.
- Dropbox: access tokens vencen a las 4h; SIEMPRE refresh flow.
- Railway sin volumen = DB borrada por deploy. YA RESUELTO (volumen /data) — no tocar SQLITE_PATH.
- El health check de integraciones miente si solo chequea presencia de env vars — hacer llamadas reales.
- Netlify (no Vercel) es el deploy real del ERP. Build antes de deploy.
- ERP AliciaView: los tabs de comando se revirtieron a propósito (viven en aliceai) — no "restaurarlos".
- launch.json del ERP requiere cwd relativo.

## 7. MEMORIA DE CLAUDE (este Mac)

La memoria persistente de Claude Code para este proyecto está en:
`~/.claude/projects/-Users-eduardobonilla-Desktop-ALICE/memory/`
Si la nueva cuenta corre desde la misma carpeta `~/Desktop/ALICE`, considerar copiar esa carpeta de memoria al path equivalente del nuevo proyecto (mismo formato). Contiene: perfil de usuario, estado del proyecto, decisión de separación de Alicia, arquitectura de memoria (NAS), roles de Alicia, hallazgos de auditoría, Wonderland IT.

## 8. LO VALIOSO DE LA SESIÓN MADRE ("ALICE project migration and setup", 6.871 mensajes)

Decisiones de producto del ERP que NO están en el código-comentario y hay que respetar:

**Apps del ERP** (todas construidas): Radar (mercado inmobiliario, fuentes SBS/bancos), **Velocity** (ex-Tycoon, simulador de ventas — vive en Apps), Growth (análisis de terrenos: reporte inicial al seleccionar terreno + mapa combinando Radar+Velocity + métricas de absorción por metraje + competidores + pestaña **Cabida** + pestaña **Propuesta BAM** con logo), Reactor (gastos por foto de factura), Diagramatic (diagramas), Juegos (siempre al final de la lista).

**Reglas de producto ERP:**
- El producto se llama **ALICE**, nunca "Hygge OS"
- CERO data falsa/hardcodeada — tareas, cifras, "online", todo real o en cero
- Cifras de HQ salen de finanzas/comercial (CSV contable exportado a Dropbox), marcadores personalizables por el CEO
- **Permisos**: cada usuario solo ve SUS spaces y SOLO su conversación con Alicia; Vanessa ve todos los spaces pero solo su conversación; Sebastián ve todo
- Contraseña inicial del equipo: hygge2026, con cambio obligatorio + anclar su calendar
- WikiHygge = núcleo global anclado al Dropbox de la empresa (tiempo real); cada space tiene sus archivos; NUNCA Google Drive, solo Dropbox
- Dropbox↔ERP sync: carpeta nueva en Dropbox → popup a admins para crear space (y viceversa); borrar space → pide aprobación de Sebastián por WhatsApp
- Blob de Alicia (animación emocional con estados: idle/excited/error/crash) en TODOS los popups/modales del ERP
- SPVs editables; PU01 y Legendre son EL MISMO proyecto
- White Rabbit (el conejo) = agente responsable de refrescar data real de Radar/Velocity cada hora + botón refresh (fuentes: SBS, tasas de bancos, Metabase del CRM)
- CRM comercial: dashboard público de Metabase (logicwareperu.com) — el link está integrado en el código de comercial
- Fase 2 del ERP = cargar la info real (la operatividad ya está auditada)
- Migración a Supabase iniciada para tareas multi-usuario reales (antes cada browser veía sus localStorage)

**Visión reiterada**: "está llegando una supercomputadora que debería tener todo automatizado — los agentes no hacen nada, están dormidos" → Wonderland IT es la respuesta; los agentes deben trabajar solos.

## 9. ARCHIVES

- `ALICE-handoff-alicia-brain.tar.gz` — backend completo (sin node_modules/.git)
- `ALICE-handoff-erp.tar.gz` — cockpit ERP completo (sin node_modules/.git/dist)
- ⚠️ Los `.env` van INCLUIDOS (contienen las llaves reales) — no subir estos archives a ningún lado público.
- De todas formas el código canónico está en git (`sebonillarojas-sketch/alice`) y en las carpetas locales — los archives son solo backup.
