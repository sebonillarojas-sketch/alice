# Loop de aprendizaje · Fase 3b — Cerrar el loop (#1 + #2) · Diseño

_2026-08-09 · repo `alice` / `alicia-brain` (+ ERP `files/alice`)_

## Contexto

El motor del loop de aprendizaje ya vive en `main` (#44): tabla `lessons`, gate duro
(capas 1-3: no-contradice-reglas-duras, evidencia≥N, niveles L0-L3), mappers de captura
(correcciones Bammy, findings `wont-fix`, síntesis Tea Table), aplicación al `knowledge`,
e **inyección solo en el prompt de Alicia**. Existen endpoints `approve`/`reject`
(`lessons.js`) pero **sin superficie humana** — solo alcanzables por `x-agent-key` (curl).

**El loop no cierra:** una lección L1+ (o L2/L3) cruza el gate hasta `validated` y
**se queda ahí para siempre**, porque no hay dónde un humano la apruebe. Y aunque se
aplique, **solo Alicia la lee** — Bammy y el Tea Table no cambian su comportamiento.

Este sub-proyecto (la primera de 5 piezas de la Fase 3b) cierra ambos huecos:
**#1 superficies de aprobación** + **#2 inyección universal**. Las otras piezas
(#3 señales nuevas, #4 no-LLM, #5 no-regresión) son sub-proyectos posteriores.

## Objetivo

Que una lección `validated` pueda promoverse a `applied` por un humano en la superficie
correcta de cada agente (Alicia → WhatsApp, Wondies → Tea Table), y que lo `applied`
llegue al comportamiento de Bammy y el Tea Table (no solo Alicia).

Estado objetivo de una lección:
`proposed → [gate] → validated (espera humano) → [aprobación humana] → applied → inyectada`.

## Alcance / no-alcance

**Dentro:** superficies de aprobación (Alicia WhatsApp + Tea Table panel), un notificador
diario de pendientes por WhatsApp, e inyección universal en Bammy + Tea Table.

**Fuera (sub-proyectos posteriores de la Fase 3b):**
- #3 señales nuevas de captura (auto-reflexión por-agente, rating/edit de Alicia).
- #4 aplicación a agentes no-LLM (Knave/White-Rabbit).
- #5 capa de no-regresión del gate.
- Proactividad general de Alicia (pings, estado vivo) → **Fase B**. Acá solo el
  notificador puntual de pendientes.
- Panel genérico de "Lecciones" en el ERP (rechazado en el spec original: cada agente
  por su superficie).
- Tocar el gate o los mappers existentes.

## Componentes

### #1a — Alicia por WhatsApp

**Tools CEO-only.** Se definen en `alicia-brain/src/tools.js` (`ALICIA_TOOLS`) y el gating
vive en `server.js`: el CEO (`CEO_ID = "sb"`) recibe **todas** las tools (`isCEO ?
ALICIA_TOOLS : ...`), así que una tool queda CEO-only con **no** agregarla a `COLLAB_TOOLS`
ni `ADMIN_TOOLS` (igual que `read_conversation`/`send_whatsapp` de #45). Tools:
- `review_lessons()` → devuelve las lecciones en estado `validated` de scope
  `agent:alicia`, `user:sb` y `global`, cada una con `#id`, `lesson`, `trigger`,
  `evidence_count`, `risk_level`. Formato de salida legible (incluye el `#id` como en
  `get_tasks`, para que Alicia pueda referirlas).
- `approve_lesson(id)` → llama `approveLesson(db, id, { by: "sb-whatsapp" })` (ya existe;
  escribe al `knowledge` y pasa a `applied`).
- `reject_lesson(id)` → llama `rejectLesson(db, id, { by: "sb-whatsapp" })`.

> **No confundir con `pendingApprovals`/`resolverAprobacion` (server.js).** Ese carril
> aprueba *acciones de tool encoladas por admins* (atajo verbal `aprobar <código>`, códigos
> alfanuméricos de 3-6 chars) y **no** es para lecciones. La aprobación de lecciones pasa por
> las tools nuevas en un turno normal de Alicia ("aplicá la lección #3"). No hay colisión de
> IDs: los códigos de `pendingApprovals` son alfanuméricos 3-6 chars; las lecciones se
> refieren como `#<n>` numérico. No se toca `resolverAprobacion`.

**Surfacing batch (inyección al prompt):** en `buildSystemPrompt` (server.js), cuando
`isCEO`, se agrega un bloque `🧠 Pendientes de aprobar` que lista las `validated` de scope
alicia/user:sb/global (`#id` + resumen), con la instrucción: *"Si hay pendientes, traelas
UNA vez al día, en un solo mensaje (batch), y ofrecé aplicarlas; usá `approve_lesson`/
`reject_lesson` cuando Sebastián decida. No las repitas cada mensaje."* Reusa el patrón de
`lessonsBlock` ya presente en el prompt. Helper nuevo `pendingLessonsForCEO(db)` +
`formatPendingBlock(rows)` en `lessons.js` (puro, testeable).

**Notificador diario (el único outbound):** un cron nuevo en `alicia-brain/src/cron.js`
(ej. `0 14 * * *`, media mañana Lima) que:
1. lee `pendingLessonsForCEO(db)`;
2. si hay ≥1 y no se notificó hoy (flag en `app_settings`, key `lessons_notified_date`,
   para no spamear si el proceso reinicia), manda **un** WhatsApp a `process.env.PHONE_sb`
   con el batch (`formatPendingBlock`) y la línea "respondeme cuáles aplico";
3. registra la fecha en `app_settings`.
   Respeta el guard `isSandbox()` (no manda en el clon). Si no hay pendientes, no manda nada.

### #1b — Wondies por Tea Table (panel ERP)

**Backend** (`alicia-brain/src/server.js`, bajo `/api/agents/` para pasar el `panelGate`
con el **mismo patrón de auth que `/api/agents/tea-table/run`** — decisión del usuario):
- `GET /api/agents/lessons/pending` → `{ lessons: [...] }` con las `validated` de scope
  `agent:*` **excepto** `agent:alicia` (esas son de Alicia por WhatsApp). Cada una:
  `id`, `scope`, `lesson`, `trigger`, `evidence_count`, `risk_level`, `source`,
  `created_at`. Helper `pendingLessonsForWondies(db)` en `lessons.js` (puro, testeable).
- Reusar los ya existentes `POST /api/agents/lessons/:id/approve` y `.../reject`.
  (Nota de seguridad, aceptada: este patrón es abierto como `tea-table/run`; si más
  adelante se quiere candado, se gatea con la sesión del panel.)

**Frontend** (`files/alice/src/HyggeOS.jsx`, dentro de `TeaTableView`): sección nueva
**"Lecciones por aprobar"** que:
- al montar hace `GET ${ALICIA_BRAIN_URL}/api/agents/lessons/pending` (mismo fetch sin
  header que ya usa el panel para `/api/agents/status` y `/api/agents/tea-table/*`);
- lista cada lección con su emoji/acento de agente (mapa `TT_SYS_AGENTS` ya existe),
  el texto, trigger, evidencia y nivel de riesgo;
- botones **Aprobar** / **Rechazar** → `POST .../lessons/:id/approve|reject`, y recarga
  la lista al terminar;
- estado vacío legible ("No hay lecciones esperando aprobación").
  Sigue el estilo visual del panel (paleta `C`, `TT_SEV`).

### #2 — Inyección universal (Bammy + Tea Table)

Mismo patrón que Alicia (`lessonsForScope` + `formatLessonsBlock`, ya existen):
- **Bammy** (`alicia-brain/src/bammy-bridge.js`): antes de armar el brief/prompt que se le
  pasa al subagente de diseño, leer `lessonsForScope(db, "agent:bammy")` y anexar
  `formatLessonsBlock(...)` al texto del brief.
- **Tea Table** (`alicia-brain/src/teatable.js`, el system prompt de síntesis ~línea 103):
  anexar `formatLessonsBlock(lessonsForScope(db, "agent:tea-table"))` al `system`.
  (`lessonsForScope` ya incluye las de scope `global`.)

## Datos y estados

No hay tablas nuevas. Se usa `lessons` tal cual. Estados relevantes:
- `validated` = cruzó el gate, **espera humano** → aparece en las superficies.
- `approve_lesson`/botón Aprobar → `applied` (+ escribe `knowledge` vía `applyLessonToBrain`).
- `reject_lesson`/botón Rechazar → `rejected`.
- `app_settings.lessons_notified_date` (nuevo key) → idempotencia del notificador.

## Manejo de errores

- Tools de Alicia: si `id` no existe o ya está `applied`/`rejected`, devolver mensaje claro
  (las funciones de `lessons.js` ya son idempotentes: `approveLesson` no re-aplica).
- Notificador: envuelto en try/catch; un fallo de WhatsApp no rompe el cron ni marca la
  fecha (para reintentar al día siguiente). No manda en `isSandbox()`.
- Panel: si el `GET pending` falla, mostrar el error inline (como `KnavePanel`); los POST
  muestran error y no recargan.

## Testing (node:test + node:assert/strict; `node --test test/*.test.mjs`)

Puro y sin red donde se pueda:
- `pendingLessonsForCEO` / `pendingLessonsForWondies`: dado un set de lecciones en varios
  scopes/estados, devuelven **solo** las `validated` del scope correcto (Wondies excluye
  `agent:alicia`; CEO incluye alicia/user:sb/global).
- `formatPendingBlock`: lista vacía → `""`; con filas → incluye cada `#id` y el texto.
- Tools `review_lessons`/`approve_lesson`/`reject_lesson`: sobre una DB en memoria, mueven
  el `status` esperado y son idempotentes.
- Inyección: un test que verifica que el brief de Bammy y el system del Tea Table incluyen
  las lecciones `applied` de su scope (helper de armado extraído para ser testeable).
- Notificador: con pendientes y `lessons_notified_date` != hoy → intenta enviar y setea la
  fecha; ya notificado hoy → no reenvía; sin pendientes → no envía. (Se inyecta un
  `sendWA` fake para no pegar afuera.)

El ERP (React) no tiene suite de tests unitarios; se valida con `npm run build` (compila)
y revisión visual del panel.

## Criterios de éxito

1. Una lección L1+ en `validated` de un Wondie aparece en el panel Tea Table y, al tocar
   **Aprobar**, pasa a `applied` y se escribe al `knowledge`.
2. Alicia, al hablarle Sebastián (o vía el notificador diario), lista las pendientes de su
   scope en batch; al decirle "aplicá la #N" pasa a `applied`.
3. El notificador manda **como máximo un** mensaje por día y solo si hay pendientes; nunca
   en el clon (`isSandbox()`).
4. Un estudio de Bammy y un reporte del Tea Table incluyen en su contexto las lecciones
   `applied` de su scope (demostrable en test del armado del prompt).
5. Cero regresión: el gate, los mappers y la inyección de Alicia siguen igual; suite verde.

## Abierto / a definir en el plan

- Hora exacta del cron notificador (propuesta `0 14 * * *` = 9am Lima) y copy del mensaje.
- Orden y estilo visual exacto de la sección del panel (seguir `TeaTableView`).
- Si `review_lessons` incluye `global` además de alicia/user:sb (propuesta: sí).
