# Loop de aprendizaje · Fase 3b — #5 Capa de no-regresión del gate · Diseño

_2026-08-30 · repo `alice` / `alicia-brain`_

## Contexto

El gate duro del loop de aprendizaje vive en `alicia-brain/src/lessons.js` desde #44, y
las Fases 3b #1–#3 le sumaron superficies de aprobación (#58) y señales de captura (#59).
De las **4 capas** que el spec original describía, **están construidas 3**:

1. No contradice reglas duras (`checkContradictsHardRules`, contra las `HARD_RULES` de
   `hard-rules.js`).
2. Evidencia ≥ N (`evaluateGate`, default N=3).
3. Aprobación por niveles L0–L3 (L0 auto-aplica, L1+ espera humano).
4. **No-regresión — nunca se construyó.** Es este sub-proyecto.

Del spec original (`2026-08-09-loop-aprendizaje-design.md`, §3.4):

> **No-regresión** donde es factible: Bammy re-corre la lección contra estudios pasados
> (¿mejora sin romper otros?); Cheshire corre su suite E2E. Solo entra si no degrada.

**El hueco:** hoy una lección llega a `applied` —y por lo tanto al prompt de todos los
agentes de su scope— sin que nadie haya comprobado que no rompe algo que ya funcionaba.
Hay **dos caminos** hacia `applied` y ninguno sabe del otro: el auto-apply de las L0 en
`runGateOnLesson`, y la aprobación humana en `approveLesson`.

**Lo que una lección cambia hoy:** solo texto. `applyLessonToBrain` escribe una fila en
`knowledge` que después se inyecta al system prompt. No toca código — eso llega con el
ítem #4 (lecciones que mutan checks y catálogos de los agentes no-LLM). Ese hecho es el
que define qué puede detectar esta capa y por qué el mecanismo es un juez y no una suite.

## Objetivo

Que ninguna lección llegue a `applied` sin haber sido contrastada contra el
comportamiento reciente de su scope, y que el resultado de ese contraste quede guardado,
sea visible, y pueda bloquear la promoción.

Estado objetivo:
`proposed → [gate 1-3] → validated → [aprobación humana] → [no-regresión] → applied`
y también `proposed → [gate 1-3, L0] → [no-regresión] → applied`.

## Alcance / no-alcance

**Dentro:**
- Módulo nuevo `alicia-brain/src/lesson-regression.js` (recolección de casos, prompt del
  juez, llamada al modelo, veredicto tipado).
- Columna `regression_check` en `lessons` con el último veredicto.
- Una única puerta hacia `applied` en `lessons.js`, usada por los dos caminos existentes.
- Una línea en el briefing matutino con lo que el gate-pass bloqueó o no pudo verificar.
- Perilla de apagado por variable de entorno.

**Fuera:**
- **Tocar `files/alice` (el ERP).** El panel del Tea Table (`HyggeOS.jsx:12737`) queda
  como está — ver "Bordes conocidos". Otra sesión está trabajando ese árbol en la Fase 1
  de ALICE Desktop y no se pisa.
- Notificación de escritorio del bloqueo. Depende de la tabla `notifications` de esa
  Fase 1, que todavía no está en `main` — ver "Pasos siguientes".
- Replay A/B real (re-generar la respuesta con la lección inyectada). Ver "Alternativas
  consideradas".
- Golden set curado de casos. Se usa la ventana reciente — ver "Alternativas".
- El ítem #4 (lecciones que mutan código de Knave/White-Rabbit). Cuando llegue, esta capa
  es donde se enchufa la suite determinista, sin cambiar su interfaz.

## Componentes

### `alicia-brain/src/lesson-regression.js` (nuevo)

Cuatro funciones. Las tres primeras son puras o casi, y son donde vive el grueso de los
tests; la red aparece solo en `judgeRegression`, con cliente inyectable.

**`collectCases(db, scope, { limit = 8 })` → `Case[]`**

Junta el comportamiento reciente del scope. El caso es `{ input, output }` en texto.

| Scope | Fuente | Nota |
|---|---|---|
| `agent:alicia`, `user:sb` | últimos `limit` pares user/assistant de `messages` | mismo criterio que `reflection.js:contextText` |
| `agent:<x>` | últimas corridas de `agent_runs` + findings abiertos | reusa `loadAgentContext` de `agent-voices.js` |
| `global` y cualquier otro | `[]` | no hay un comportamiento concreto que contrastar |

Devolver `[]` no es un error: es la señal de `skipped` y **no se llama al modelo**.

**`buildJudgePrompt(lesson, cases)` → `{ system, user }`**

Pura. Arma el prompt: acá está la lección propuesta, acá hay N casos que salieron bien,
¿alguno habría empeorado si el agente hubiera tenido esta lección en el prompt? Pide
salida estructurada y corta.

**`judgeRegression(lesson, cases, { client })` → `{ verdict, offending, reason }`**

Una llamada a `claude-opus-5` con `output_config: { effort: "low" }`, `max_tokens` chico
y salida estructurada. Cliente inyectable con el mismo patrón que `reflection.js` (el
`_client` de módulo como default, `{ client }` en los tests).

**`checkRegression(db, row, { client, limit })` → `Verdict`**

Orquesta las tres anteriores y normaliza el resultado.

### El veredicto (la interfaz que consume el gate)

```js
{
  status: "pass" | "degrades" | "skipped" | "error",
  reason: "…",              // legible por un humano, va al WhatsApp y al briefing
  cases_seen: 8,
  model: "claude-opus-5",
  at: "2026-08-30 14:02:11"
}
```

- `pass` — el juez no vio degradación.
- `degrades` — la vio. Es el único que bloquea.
- `skipped` — no había material que contrastar, o la capa está apagada.
- `error` — el juez fue llamado y falló (API caída, respuesta ilegible).

`skipped` y `error` **dejan pasar la lección** (ver "Manejo de errores").

### Persistencia

Columna nueva `regression_check TEXT` en `lessons`, con el JSON del último veredicto.
Es el espejo exacto de `contradicts_check`, que ya existe y guarda el resultado de la
capa 1. Se agrega en `ensureLessonsSchema` con el patrón de migración del repo
(`try { db.exec("ALTER TABLE …") } catch {}`, como `db.js:153`).

Sin tabla histórica: se guarda el último veredicto y nada más. Si la historia hace falta,
se agrega cuando haya una pregunta concreta que responder con ella.

### La puerta única hacia `applied`

En `lessons.js`, una función nueva que es el **único** lugar del código que escribe
`status = 'applied'`:

```
promoteToApplied(db, id, { by, client })
  ├─ checkRegression()          → guarda regression_check
  ├─ "degrades"                 → NO aplica; devuelve { applied: false, blocked: true, regression }
  └─ "pass" | "skipped" | "error" → aplica + applyLessonToBrain()
```

Los dos caminos existentes pasan a llamarla:

- `approveLesson(db, id, { by })` — tu OK por WhatsApp (`tools.js:767`) y el panel
  (`server.js:1723`). Mantiene su chequeo actual de que la lección esté en `validated`:
  la no-regresión se suma a ese gate, no lo reemplaza.
- `runGateOnLesson(db, id, …)` cuando `evaluateGate` decide `auto_apply` (L0).

### Qué le pasa a una lección bloqueada

- **Venía del auto-apply L0:** queda en `validated`. El bloqueo la **degrada a revisión
  humana**: sale del camino automático y aparece en la superficie de aprobación de su
  agente. Esto también evita que el gate-pass la re-juzgue todas las madrugadas quemando
  tokens en un loop sin salida.
- **Venía de una aprobación humana:** se queda en `validated` con el veredicto guardado
  y el motivo devuelto al llamador. Si insistís, se vuelve a correr contra casos nuevos y
  puede pasar — es una acción humana explícita, no un reintento automático.

En ningún caso una lección bloqueada pasa a `rejected`: el juez es probabilístico y no
tiene autoridad para matar una lección, solo para frenarla y pedir ojos.

### Superficies

- **WhatsApp (Alicia).** `approve_lesson` devuelve `{ applied: false, regression: {...} }`
  y Alicia dice el motivo en la misma respuesta. Como la aprobación es inline y
  bloqueante, el veredicto llega en el mismo turno en que lo pediste. Sin trabajo extra.
- **Briefing matutino (`briefing.js`).** Una línea con los veredictos `degrades`/`error`
  de las últimas 24 horas, **vengan del camino que vengan** — auto-apply L0 o aprobación
  humana. Se decidió no filtrar por `validated_by = 'auto'` (que hubiera limitado esto al
  "camino no atendido" del gate-pass, como se pensó originalmente) porque hoy, sin L0 en
  producción (ver "Bordes conocidos"), ese filtro dejaría el aviso permanentemente vacío.
  Se emite desde una sola función, que es la costura por donde después entra la
  notificación de escritorio.

## Datos y estados

Ningún estado nuevo en la máquina de `lessons`: el `CHECK` de `status` queda intacto y
los cuatro estados existentes siguen significando lo mismo. Lo único que cambia en el
esquema es la columna `regression_check`.

Lo que sí cambia es la **firma** de tres funciones públicas de `lessons.js`, que pasan a
ser `async`: `approveLesson`, `runGateOnLesson` y `runGatePass`. Llamadores a actualizar:
`cron.js:117` (gate-pass 6:30am), `tools.js:767` (`approve_lesson`), `tools.js:793`
(`capture_lesson`) y `server.js:1724` (endpoint del panel). Los cuatro ya están en
contextos `async`, así que es agregar `await`.

Esta es la parte aburrida del cambio y la que concentra el riesgo de regresión. Los 140
tests verdes de la suite son la red.

## Manejo de errores

**Fail-open, con el motivo tipado.** Si el juez no puede dar un veredicto —no hay casos,
la API falla, la respuesta viene ilegible— la lección **se aplica igual** y queda anotada
como `skipped` o `error` según cuál de las dos cosas pasó.

El porqué: lo que una lección aplicada cambia hoy es texto en un prompt, y es reversible
(`rejectLesson`, estado `retired`). El daño de un falso bloqueo —el loop se traba, se
acumulan pendientes, se deja de confiar en el gate— es peor que el de una lección de tono
que entró sin verificar. Y el spec original ya lo enmarca así: la capa aplica "donde es
factible". Fail-closed convertiría cualquier caída de la API de Anthropic en un loop
trabado, y dejaría afuera para siempre a los scopes sin material conversacional
(`global`, `agent:white-rabbit`, `agent:knave`).

La distinción entre `skipped` y `error` importa porque son cosas distintas: "no había
nada que verificar" es normal y silencioso; "no pude verificar" es una anomalía y va al
briefing.

**Perilla de apagado:** `LESSON_REGRESSION=off` en el entorno saltea la capa por completo
(veredicto `skipped`, motivo "capa desactivada"). Es la salida de emergencia si el juez
se vuelve insoportable un martes a las 6:30am, sin necesidad de desplegar.

## Testing (node:test + node:assert/strict; `node --test test/*.test.mjs`)

Archivo nuevo `test/lessons-regression.test.mjs`, más ajustes a los existentes.

**Puros, sin red:**
- `buildJudgePrompt` incluye la lección y los N casos.
- `collectCases` para cada forma de scope: Alicia desde `messages`, un Wondie desde
  `agent_runs`+findings, `global` → `[]`, agente sin actividad → `[]`.
- El mapeo veredicto → acción, tabla por tabla.

**Con cliente falso** (patrón de `reflection.test.mjs:15`):
- `pass` → la lección queda `applied` y `regression_check` guardado.
- `degrades` → NO se aplica; una L0 que venía del auto-apply queda en `validated`.
- `skipped` y `error` → se aplica igual, con el motivo anotado.
- Un scope sin material **no llama al modelo** (se verifica con un espía, como
  `reflection.test.mjs:18`).
- `LESSON_REGRESSION=off` → `skipped` y cero llamadas.

**No-regresión de lo existente:** los cinco archivos de test que llaman al gate
(`lessons-approve`, `lessons-rungate`, `lessons-gatepass`, `lessons-pending`,
`capture-lesson`) pasan a `await` y siguen verdes, junto con el resto de la suite.

Para que ese cambio sea solo `await` y nada más, `collectCases` tiene que ser
**defensiva**: esas suites arman una db en memoria que tiene `lessons` y nada más, así
que consultar `messages` o `agent_runs` ahí tira "no such table". Cada consulta va en su
`try/catch` y devuelve `[]` — que además es la semántica correcta ("no hay material"), no
un parche. Con eso las lecciones `global` de esas suites caen en `skipped` sin tocar la
red.

## Criterios de éxito

1. Existe `lesson-regression.js` y `lessons.regression_check` guarda el último veredicto.
2. Una lección cuyo juez responde `degrades` **no** llega a `applied` por ninguno de los
   dos caminos. Verificado con tests para los dos caminos (auto-apply L0 y aprobación
   humana): una L0 bloqueada queda en `validated` esperando revisión humana. En
   producción hoy esto solo se ejerce por el camino humano — ver "Bordes conocidos" sobre
   por qué el camino L0 no corre con datos reales todavía.
3. Una lección cuyo juez responde `pass` llega a `applied` como siempre.
4. Sin material o con el juez caído, la lección se aplica igual y el veredicto distingue
   `skipped` de `error`.
5. Al aprobar por WhatsApp una lección bloqueada, Alicia dice el motivo en esa respuesta.
6. El briefing matutino nombra lo que el gate-pass bloqueó o no pudo verificar.
7. `LESSON_REGRESSION=off` saltea la capa sin llamar al modelo.
8. Cero regresión: la suite completa verde (140 tests al momento de escribir esto).

## Alternativas consideradas

**Replay A/B real** — re-generar la respuesta de cada caso con la lección inyectada y que
el juez compare la original contra la nueva. Es más fiel: mide el efecto del prompt en
vez de pedir una opinión sobre ese efecto. Se descartó por dos razones. La aprobación es
inline y bloqueante, y N generaciones más el juicio son decenas de segundos con un humano
esperando en el chat. Y para los agentes cuya salida depende de la red (White Rabbit,
Knave) no es ni siquiera reproducible: re-correrlos consulta una infraestructura que ya
cambió. Si el juez de una pasada resulta demasiado permisivo, subir a A/B es cambiar el
cuerpo de `judgeRegression` sin tocar el gate — la interfaz del veredicto es la misma.

**Golden set curado y versionado** — un set fijo de casos por scope, sembrado a mano y
guardado en el repo. Reproducible: una lección que falla hoy falla siempre. Se descartó
por el costo de siembra y mantenimiento frente a una capa cuyo valor todavía no está
demostrado. La contra de la ventana reciente es real y hay que tenerla presente: el
veredicto **no es reproducible**, y la misma lección puede pasar hoy y fallar mañana sin
que nadie haya tocado nada.

**Enganchar en el gate-pass (`proposed → validated`) en vez de en la promoción a
`applied`** — filtraría antes, evitando que las degradadas lleguen a las superficies
humanas. Se descartó para gastar tokens solo en lecciones que alguien efectivamente quiso
aplicar. La consecuencia aceptada es que una lección degradante sí ocupa lugar en tu
lista de pendientes hasta que la aprobás y rebota.

**Suite determinista en vez de juez** — correr `node --test` y los checks del agente antes
de promover. Barato, reproducible y auditable, pero hoy no detecta nada: una lección es
texto en un prompt y no puede romper un test. Es la forma correcta para el ítem #4, y por
eso la interfaz del veredicto no menciona al juez: cuando las lecciones muten código, se
agrega un runner determinista detrás de `checkRegression` sin tocar nada más.

## Bordes conocidos

**Ninguna ruta del repo crea jamás una lección L0, hoy.** Los cinco call sites de
`proposeLesson` hardcodean `risk_level: "L1"`: `reflection.js:44`, `tools.js:791`, y los
tres mappers de `lesson-capture.js`. Nada en el repo produce una lección `L0`, así que el
camino de auto-apply (`evaluateGate` → `decision: "auto_apply"` → `runGateOnLesson` →
`promoteToApplied`) **no se ejecuta en producción hoy** — está probado con tests que lo
fuerzan a mano (`risk_level: 'L0'` seteado directo en la fila), pero ningún flujo real
propone una lección con ese nivel. La consecuencia directa: esta capa, en producción,
corre únicamente sobre aprobaciones humanas (`approveLesson`), y la línea del briefing
matutino no tiene disparador productivo salvo un veredicto `degrades`/`error` que salga
de ese camino humano — el camino "gate-pass bloqueó a las 6:30am sin que nadie mirara"
que motivó originalmente esta sección del spec no ocurre todavía. Asignar `risk_level`
con criterio (un clasificador real en vez del hardcode a L1) es un sub-proyecto aparte,
con su propia decisión de diseño, y queda fuera de este alcance.

**El panel del Tea Table no explica el bloqueo.** El endpoint devolverá
`{ status, applied: false, regression: {...} }`, pero `HyggeOS.jsx:12737` hoy solo
dispara el POST y refresca la lista. Para un Wondie bloqueado eso se ve como "hice click
y la lección sigue ahí", sin motivo. Mostrarlo son ~5 líneas en `HyggeOS.jsx`, pero ese
archivo es donde está trabajando la otra sesión, así que queda deliberadamente afuera.
La respuesta del endpoint es compatible hacia atrás: el panel actual sigue funcionando
igual que hoy.

**El veredicto no es reproducible.** Consecuencia directa de usar la ventana reciente.

## Pasos siguientes (fuera de este sub-proyecto)

1. **Mostrar el motivo en el panel del Tea Table** — ~5 líneas en `HyggeOS.jsx`, en
   cuanto la Fase 1 de ALICE Desktop esté mergeada y ese archivo esté libre.
2. **Notificación de escritorio del bloqueo** — cuando la tabla `notifications` de esa
   Fase 1 esté en `main`: un `kind: 'lesson_blocked'` con `urgency: 'digest'` (nunca
   `now`: no es urgente y diluir el canal es como se rompe), colgado de la misma función
   emisora que hoy escribe la línea del briefing.
3. **Runner determinista** cuando llegue el ítem #4, detrás de la misma interfaz.
