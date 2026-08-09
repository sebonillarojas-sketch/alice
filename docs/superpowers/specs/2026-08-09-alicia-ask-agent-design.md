# Alicia conversa con los agentes Wonderland (`ask_agent`) · Diseño

_2026-08-09 · repo `alice` / `alicia-brain`_

## Contexto

Sebastián: *"quiero generar una instancia bidireccional donde [Alicia] pueda hablar con
los agentes"*. Hoy Alicia solo **lee** el estado crudo de los agentes (`agents_status` →
JSON de últimas corridas + hallazgos). No puede **conversar** con ellos.

Hallazgo que lo simplifica: **la data de cada agente ya vive en el brain**. Todos los
Wonderland reportan sus corridas y hallazgos a `agent_runs` / `agent_findings` (vía
`POST /api/agents/report`), y algunos guardan un `report` largo (Tea Table, Dark Alice).
Así que "darles voz" NO requiere un canal a la bestia/Studio: se responde en 1ª persona,
como el agente, **grounded en lo que ya reportó**.

Este es el sub-proyecto **B** (el A, Radar/Nexo, va en su propia spec/PR).

## Objetivo

Que Alicia pueda consultar a cualquier agente Wonderland en lenguaje natural y relatar su
respuesta — cada uno con su voz, **anclado en su data real**, honesto cuando no sabe.

## Alcance / no-alcance

**Dentro:** un tool `ask_agent({agent, question})` + módulo `agent-voices.js` (persona +
carga de contexto + llamada LLM). Agentes: los 7 Wonderland que reportan a `agent_runs`
(white-rabbit, cheshire, knave, mad-hatter, dark-alice/tea-table, bandersnatch, jabberwocky).
Gating: **CEO + admins** (`ADMIN_TOOLS`).

**Fuera:**
- **Disparar corridas nuevas** on-demand (trigger a la bestia/async) — Sebastián eligió Q&A,
  no trigger. Los agentes responden desde su última data reportada, no corren de nuevo.
- Bammy/Feyd (ya tiene `disenar_plano`).
- La app Hygge OS.
- Tocar cómo reportan los agentes, el reloj, ni el chat de Dark Alice del ERP.

## Componentes

### 1. `src/agent-voices.js` (nuevo)

**Registro de perfiles** `AGENT_PROFILES` — por agente: `{ emoji, name, role, voice }`.
`voice` = una línea de tono para el prompt. Ej.:
- `white-rabbit`: 🐰, "guardia de infraestructura", voz *ansioso pero preciso, va al grano con el estado de la infra*.
- `cheshire`: 😺, "tester E2E", voz *socarrón, disfruta encontrar bugs, directo*.
- `knave`: 🃏, "seguridad (L0, solo observa)", voz *seco, formal, señala riesgos sin dramatizar*.
- `mad-hatter`: 🎩, "performance y costos", voz *excéntrico pero data-driven*.
- `dark-alice` (alias `tea-table`): 🖤, "jefa de operaciones", voz *calmada, ejecutiva, sintetiza*.
- `bandersnatch`: ⚔️, "chaos/saturación", voz *bruto, habla de límites de carga*.
- `jabberwocky`: ⚡, "fuzzer/inputs adversariales", voz *caótico, habla de qué rompe el parser*.
(Reusar los nombres/emoji de `darkalice.js AGENTS`; se le agrega `role`+`voice`.)

**`loadAgentContext(db, agent)`** (toma `db` explícito → testeable con :memory:):
- Última corrida: `SELECT result, summary, report, created_at FROM agent_runs WHERE agent=? ORDER BY id DESC LIMIT 1`.
- Hallazgos abiertos: `SELECT severity, category, detail, created_at FROM agent_findings WHERE agent=? AND status IN ('open','escalated') ORDER BY created_at DESC LIMIT 15`.
- Devuelve `{ lastRun, findings }` (o `{ lastRun: null, findings: [] }` si nunca corrió).

**`buildAgentPrompt(profile, context, question)`** (puro → testeable):
- `system`: "Sos {emoji} {name}, {role} del equipo Wonderland de Alicia. {voice}. Respondé
  en 1ª persona, criollo, corto (2-4 frases). Usá SOLO tu data real de abajo; si no tenés el
  dato para lo que preguntan, decilo (no inventes)." + el contexto serializado.
- `messages`: `[{ role: "user", content: question }]`.
- Devuelve `{ system, messages, model }` (model = `claude-sonnet-4-6`, como Tea Table).

**`askAgent(db, agent, question, { client } = {})`**:
- Resuelve el perfil (alias `tea-table`→`dark-alice`). Si el agente no existe → error legible.
- `loadAgentContext` → `buildAgentPrompt` → `client.messages.create(...)` → devuelve el texto.
- `client` por default = una instancia propia `new Anthropic({ apiKey: ANTHROPIC_API_KEY })`
  (mismo patrón que teatable.js). Inyectable para test.
- Si nunca corrió: responde en voz del agente "todavía no corrí / no tengo data" — sin inventar.

### 2. Tool `ask_agent` en `src/tools.js`
```
{ name: "ask_agent",
  description: "Consultá en criollo a un agente Wonderland (white-rabbit 🐰 infra, cheshire 😺 tester, knave 🃏 seguridad, mad-hatter 🎩 perf/costos, dark-alice 🖤 ops, bandersnatch ⚔️ carga, jabberwocky ⚡ fuzzing) y te responde en 1ª persona con su data real. Usala cuando pregunten 'qué dice el conejo', 'preguntale a Cheshire', 'cómo ve X la infra/seguridad/performance'.",
  input_schema: { agent: enum[...], question: string } (ambos required) }
```
`case "ask_agent"`: `const { askAgent } = await import("./agent-voices.js"); const { getDB } = await import("./db.js"); return await askAgent(getDB(), input.agent, input.question);`

### 3. Gating (server.js)
`ask_agent` se agrega a `ADMIN_TOOLS` (NO a `COLLAB_TOOLS`) → CEO + admins. No va en
`SENSITIVE_ADMIN` (no requiere aprobación del CEO; es lectura conversacional).

### 4. Prompt de Alicia (world.js)
En el manifiesto de capacidades: "Podés **conversar** con tus agentes con `ask_agent` — cada
uno responde con su data real. Cuando te digan 'preguntale al conejo / a Cheshire', o quieran
la mirada de un agente sobre infra/seguridad/perf, usá `ask_agent` en vez de adivinar."
Diferencia de `agents_status` (estado crudo de todos) vs `ask_agent` (conversar con uno).

## Manejo de errores
- Agente inexistente → mensaje claro con la lista válida (no LLM call).
- Sin data (nunca corrió) → el agente lo dice en su voz; nunca inventa hallazgos.
- Fallo del LLM/red → `ask_agent` devuelve "No pude contactar a {agente} ahora: {error}"
  (Alicia lo relata; no rompe el turno).
- `isSandbox()` no aplica: en el clon el loop LLM de Alicia ya está short-circuiteado, así que
  `executeTool` no corre.

## Testing (node:test)
- `AGENT_PROFILES`: los 7 agentes presentes; alias `tea-table`→`dark-alice` resuelve.
- `loadAgentContext(db)` con una :memory: sembrada → arma `{lastRun, findings}` correcto;
  agente sin corridas → `{lastRun:null, findings:[]}`.
- `buildAgentPrompt`: el `system` incluye el rol/voz del agente y el contexto; `messages`
  lleva la pregunta; agente sin data → el system dice explícitamente que no hay data.
- `askAgent` con un `client` fake (messages.create mockeado) → devuelve el texto del fake y
  arma el prompt esperado; agente inválido → error legible sin llamar al client.
- Ningún test pega a la red.

## Criterios de éxito
1. "Preguntale al conejo cómo está la infra" → Alicia trae la respuesta de White Rabbit en su
   voz, basada en su última corrida/hallazgos reales.
2. "¿Qué bugs vio Cheshire?" → responde con sus findings abiertos; si no corrió, lo dice.
3. Un agente sin data no inventa — responde honesto en su voz.
4. Solo CEO + admins pueden usar `ask_agent`.
5. Cero regresión: `agents_status`, Dark Alice, Tea Table y el reporte de agentes siguen igual.

## Abierto / a definir en el plan
- Largo máximo de la respuesta del agente (propuesta: 2-4 frases, `max_tokens` ~400).
- Si `dark-alice` usa su `report` largo (último) como contexto principal (propuesta: sí).
- Modelo: `claude-sonnet-4-6` (consistente con Tea Table) vs Haiku para abaratar (propuesta:
  Sonnet; es una sola llamada corta).
