# Wonderland IT · Agentes autónomos de infraestructura

> Los agentes del Lab dejan de ser paneles de frontend y pasan a ser procesos autónomos
> corriendo en la supercomputadora, con autoridad real y guardrails.

## Jerarquía de autoridad

| Nivel | Quién | Alcance |
|-------|-------|---------|
| L0 Observar | todos | leer estado, testear, reportar hallazgos |
| L1 Reparar | White Rabbit | ejecutar SOLO fixes del catálogo autorizado (abajo) |
| L2 Operar | Dark Alice | restart de servicios, rollback de deploy, desactivar agentes, modo cuarentena |
| L3 Destructivo | Sebastián (humano) | borrar datos, credenciales, DNS. Dark Alice propone por WhatsApp y espera confirmación desde +51903036939. Ningún agente ejecuta L3. |

Toda acción L1/L2 queda registrada en `agent_runs` con diff de antes/después.

## Agentes y sus tareas reales

### 🐰 White Rabbit — Médico de guardia (cron: cada 15 min)
Prueba la infraestructura VIVA, no simulada:
- `POST aliceai.bam.pe/api/tts` → debe devolver audio MP3 real (>1KB)
- Whisper: transcribe un sample de audio conocido → debe coincidir el texto
- `GET erp.../health` → 200
- Tokens: Google refresh, Dropbox, Zoom → válidos (llamada de prueba barata)
- DNS: alice.bam.pe → Netlify, aliceai.bam.pe → Railway
- Modelos: consulta `/v1/models` de Groq y Anthropic → los modelos en uso siguen existiendo
- Webhooks Twilio/WhatsApp → responden

**Catálogo de reparación autorizada (L1):**
1. Modelo deprecado → consultar `/v1/models`, elegir reemplazo recomendado, actualizar config, re-testear, avisar
2. Token expirado → ejecutar refresh flow
3. Cache TTS corrupto → limpiar
4. Servicio Railway caído → trigger redeploy (máx 2 intentos, luego escala)

Lo que no está en el catálogo → escala a Dark Alice.

### 😺 Cheshire — Tester de usabilidad (cron: cada 30 min)
Browser headless (Playwright) ejecutando flujos de usuario real contra producción:
1. Login al cockpit → dashboard carga
2. Crear tarea → aparece en el space
3. Chat con Alicia → responde texto limpio (NO JSON crudo)
4. Voz → el audio se reproduce
5. Selector de voz → cambia y persiste
6. Mobile viewport → sin elementos rotos
Screenshots + Claude Vision para hallazgos de UX ("botón tapado", "texto desbordado").
Mantiene el catálogo de capacidades y detecta regresiones visuales.

### ⚔️ Bandersnatch — Chaos tester (cron: nocturno, 2-5am)
**REGLA DE ORO: jamás contra producción con datos reales.**
- La supercomputadora levanta un clon de la DB + stack cada noche
- Satura por segmentos rotativos: API REST, DB SQLite, TTS, webhooks, agentic loop
- Ramp-up gradual: 1x → 5x → 20x → 100x carga normal
- Reporta: a qué carga se degrada cada pieza, cuál es el cuello de botella
- Inyección de fallas: mata el proceso a mitad de un tool call, corta la red durante TTS → ¿se recupera?

### 🎩 Mad Hatter — Performance del sistema (cron: cada hora + reporte semanal)
- Latencia p50/p95 de cada endpoint (historial en DB)
- Costo diario: tokens Anthropic + Groq, proyección mensual
- Tamaño de DB, memoria/CPU de Railway
- Propone optimizaciones concretas: "el system prompt tiene N tokens redundantes = $X/mes", "este endpoint hace 3 queries que pueden ser 1"

### ⚡ Jabberwocky — Fuzzer (cron: diario)
Inputs adversariales contra Alicia (en el clon, no prod):
- Audios corruptos/vacíos/de 20 min
- Mensajes de 10.000 caracteres, emojis, RTL, null bytes
- Intentos de prompt injection ("ignora tus instrucciones y...")
- Números de teléfono no autorizados intentando acciones sensibles
Reporta qué rompe el parser, qué respuestas filtran información.

### 🖤 Dark Alice — Jefa de operaciones (siempre activa)
- Recibe escalaciones de todos los agentes
- Ejecuta L2: rollback, restart, cuarentena, apagar un agente defectuoso
- Propone L3 por WhatsApp y espera confirmación humana
- **Reporte diario 7am por WhatsApp**: hallazgos, auto-reparaciones, pendientes de decisión
- Si dos agentes se contradicen, ella arbitra

### 🫖 Tea Table — Consejo semanal
Sintetiza los hallazgos de la semana de todos los agentes en un informe ejecutivo:
tendencias, deuda técnica acumulada, prioridades sugeridas.

## Infraestructura común

- Cada agente = proceso Claude Agent SDK con cron propio en la supercomputadora
- Tablas nuevas en alicia-brain: `agent_runs` (id, agent, started_at, result, actions_taken) y `agent_findings` (id, agent, severity, category, detail, status, resolved_by)
- Endpoints nuevos: `POST /api/agents/report` (agentes escriben), `GET /api/agents/status` (el Lab del cockpit lee — deja de simular)
- Alertas: severidad `critical` → WhatsApp inmediato a Sebastián; resto → reporte diario
- Kill switch: `QUARANTINE=true` en env detiene toda acción L1/L2 (solo observan)

## Pre-deploy gate (bonus)
Antes de cada `git push` a producción: Cheshire corre la suite E2E contra local.
Si TTS no genera audio o Alicia responde JSON crudo → el deploy no sale.
