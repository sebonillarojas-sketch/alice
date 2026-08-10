# Loop de aprendizaje · Fase 3b · Nuevas señales de captura (#3) · Diseño

_2026-08-09 · repo `alice` / `alicia-brain`_

## Contexto

El loop ya captura de 3 fuentes (correcciones del Taller → `lessonFromCorrection`; findings
`wont-fix` → `lessonFromFinding`; síntesis semanal → `lessonsFromTeaTable`), tiene un
**gate-pass diario 6:30am** (`runGatePass`) que promueve `proposed → validated/applied/
rejected`, y desde #58 tiene superficies de aprobación (Alicia WhatsApp + panel Tea Table).

Faltan las **2 señales que el spec original nombró y no se construyeron**: **auto-reflexión
por-agente** y **rating/corrección de Alicia**. Este sub-proyecto (#3 de la Fase 3b) las agrega.
Todo se enchufa a lo existente: nueva señal → `proposeLesson` (status `proposed`) → gate-pass
→ superficies de aprobación. Nada se auto-aplica.

## Objetivo

Que los agentes aprendan de su propia actividad (auto-reflexión) y que Alicia capture las
correcciones que le hace el CEO/admins, ambas como lecciones `proposed` que fluyen por el
gate y las superficies ya construidas.

## Alcance / no-alcance

**Dentro:** módulo `reflection.js` + cron semanal de reflexión (Wonderland + Alicia), y un tool
`capture_lesson` (CEO + admins). Reuso de `agent-voices.js` (#56) y `lessons.js`/`lesson-capture.js`.

**Fuera:** #4 (aplicación a no-LLM) y #5 (no-regresión). No se toca el gate, las superficies de
#58, ni las 3 señales existentes.

## Componentes

### #3a — Auto-reflexión por-agente (`src/reflection.js`, nuevo)

`reflectAgent(db, agent, { client })`:
- **Contexto del agente:**
  - Wonderland (white-rabbit, cheshire, knave, mad-hatter, tea-table, dark-alice, bandersnatch,
    jabberwocky): `loadAgentContext(db, agent)` de `agent-voices.js` (última corrida + hallazgos).
  - `alicia`: últimos ~40 mensajes de la tabla `messages` (`SELECT role, content ... ORDER BY id
    DESC LIMIT 40`, revertidos), como material de reflexión sobre su propio comportamiento.
- **Una llamada LLM** con la voz/rol del agente (reusa `AGENT_PROFILES`; para alicia, un perfil
  propio): *"Mirá tu actividad reciente y proponé A LO SUMO UNA lección concreta y accionable
  para la próxima. Si no hay nada claro, respondé exactamente NONE. Máx 1 oración."*
- Parseo: si la respuesta es `NONE`/vacía → no propone. Si trae texto → `proposeLesson(db,
  { scope: agent==="alicia" ? "agent:alicia" : \`agent:${agent}\`, source: "reflection",
  trigger: "auto-reflexión", lesson, risk_level: "L1" })`.
- Devuelve `{ agent, proposed: bool, lesson|null }`. `client` inyectable (default instancia propia
  `new Anthropic`, como teatable/agent-voices) → testeable sin red.

`runReflectionPass(db, { client, agents })`:
- Recorre los agentes (default: los Wonderland con actividad reciente + `alicia`), llama
  `reflectAgent` en cada uno, junta counts `{ evaluated, proposed }`. Un fallo por-agente no
  corta el resto (try/catch por agente).

**Cron** (`src/cron.js`): semanal, **lunes 7:00 Lima** (antes del Tea Table 7:30). Guard
`isSandbox()`. Llama `runReflectionPass(getDB())`. El gate-pass diario (6:30) recoge las
`proposed` al día siguiente. Cadencia baja a propósito: evidencia≥3 significa que una lección
suelta queda `proposed` hasta que el patrón se repita en reflexiones sucesivas (dedup sube
`evidence_count`) — así no se aprende de un solo caso.

### #3b — Rating/corrección de Alicia (tool `capture_lesson`)

Tool en `alicia-brain/src/tools.js`:
```
{ name: "capture_lesson",
  description: "Guardá como lección algo que Sebastián (o un admin) te enseñó o te corrigió
    ('la próxima hacé X', 'no era así, acordate de Y'). Queda como PROPUESTA (no se aplica
    sola: pasa por revisión). Usala cuando te corrijan o te pidan que recuerdes una regla de
    comportamiento — NO para datos puntuales (eso es save_knowledge).",
  input_schema: { lesson: string (required), scope: string (opcional, default 'agent:alicia';
    'user:sb' si es específico de Sebastián) } }
```
`case "capture_lesson"`: gateado a CEO+admins (en el case: `if (userId !== "sb" && !isAdmin)`
… en realidad el gating por-tool ya lo hace `ADMIN_TOOLS`; ver abajo). Llama `proposeLesson(
getDB(), { scope: input.scope || "agent:alicia", source: "correction", trigger: "corrección de
"+userId, lesson: input.lesson, risk_level: "L1" })`. Devuelve confirmación ("Anotado, lo dejé
como propuesta para revisar/aplicar").

**Gating:** `capture_lesson` se agrega a `ADMIN_TOOLS` (CEO + admins). No a `COLLAB_TOOLS`.

**Prompt (`world.js`):** una línea en el bloque de aprendizaje: *"Cuando Sebastián o un admin te
corrija o te enseñe una regla de comportamiento ('la próxima…', 'acordate de…'), usá
`capture_lesson` para dejarla propuesta. No la apliques sola."*

## Datos y estados

Sin tablas nuevas. Se usa `lessons` (`source` ya acepta `reflection` y `correction`). Estados:
`proposed` (recién capturada) → gate-pass → `validated` (a las superficies de #58) → aprobación.

## Manejo de errores

- `reflectAgent`: sin contexto (agente sin corridas / sin mensajes) → no propone, devuelve
  `{proposed:false}`. Fallo LLM/red → log + `{proposed:false}` (no rompe el pass).
- `capture_lesson`: `lesson` vacío → mensaje pidiendo la regla; nunca propone vacío.
- `isSandbox()`: el cron no corre en el clon (guard); el tool no corre en el clon (loop LLM
  short-circuiteado).

## Testing (node:test)

- `reflectAgent` con `client` fake que devuelve una lección → llama `proposeLesson` con el scope/
  source correcto; con `client` que devuelve `NONE` → no propone. Sin red.
- `runReflectionPass`: con 2 agentes fake (uno propone, otro NONE) → counts `{evaluated:2,
  proposed:1}`; un agente que tira error no corta el otro.
- `capture_lesson` (helper del case, o el mapper): scope default `agent:alicia`; scope explícito
  respetado; `lesson` vacío → no propone.
- El gate/superficies ya tienen cobertura; no se re-testean.

## Criterios de éxito

1. El cron semanal corre `runReflectionPass`; un agente con actividad genera (a lo sumo) una
   lección `proposed` con `source:"reflection"`; los sin actividad no proponen.
2. Cuando Sebastián corrige a Alicia por WhatsApp y ella usa `capture_lesson`, aparece una
   lección `proposed` scope `agent:alicia`.
3. Ambas fluyen por el gate-pass y, si llegan a `validated`, aparecen en las superficies de #58.
4. Nada se auto-aplica; evidencia<3 mantiene la lección en `proposed`.
5. Cero regresión: las 3 señales previas, el gate y las superficies siguen igual.

## Abierto / a definir en el plan

- Ventana de mensajes para la reflexión de Alicia (propuesta 40) y si filtra por CEO o todos
  (propuesta: todos, ordenados por recientes).
- Perfil/voz de Alicia para su reflexión (propuesta: uno breve propio en `reflection.js`).
- Hora exacta del cron (propuesta lunes 7:00 Lima).
