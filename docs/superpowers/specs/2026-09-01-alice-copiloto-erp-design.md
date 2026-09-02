# Alice Copiloto · el space del ERP como agente operativo · Diseño

_2026-09-01 · repo `alice` · `files/alice` (ERP, Netlify) + `alicia-brain` (cerebro, Railway) + `desktop` (shell Electron)_

## Contexto

El space **Alicia** del ERP (`files/alice/src/modules/alicia/AliciaView.jsx`, 1.113 líneas) hoy no
tiene función útil. Para conversar con la agente, WhatsApp es estrictamente mejor: está en el
bolsillo, es asíncrono y ya tiene todas las herramientas. El space quedó como un chat peor.

Pero eso deja una brecha real: **Alicia tiene acceso a las apps del ERP por WhatsApp, y ninguna
presencia dentro del ERP mismo**. Cuando estás trabajando en una cabida, ella no sabe que estás
ahí, no ve los números que tenés en pantalla y no puede tocar nada.

### Qué existe hoy (y este diseño reutiliza)

- **El loop de agente completo** en `alicia-brain/src/server.js:581` (`processAliciaMessage`):
  perfil, historial, memorias, conocimiento, personas por usuario, routing de modelo
  (Sonnet por defecto, Fable 5 con "maximum effort"), prompt caching bien pensado, y un
  loop de tool-use de hasta 8 iteraciones.
- **33 tools** en `alicia-brain/src/tools.js`: tareas, calendar, gmail, dropbox, `radar_query`,
  `radar_refresh`, agentes de Wonderland, whatsapp, skills, conocimiento.
- **Un turno de voz con visión ya construido y probado**: `POST /api/embodied`
  (`server.js:1181`) hace audio → Whisper → loop de Alicia → TTS y acepta `{image}` base64.
  Se construyó para el teléfono Android. El ERP no lo usa.
- **Capa de voz madura**: STT OpenAI con fallback a Groq (`server.js:865`), TTS OpenAI `tts-1`
  primario con ElevenLabs turbo como voz buena (`server.js:915`), y un filtro de alucinaciones
  de Whisper (`server.js:1810`) curtido contra wakewords que se auto-disparaban.
- **`buildLiveContext(userId)`** (`server.js:561`): inyecta agenda + tareas frescas *después* del
  bloque cacheado del system prompt. Es el patrón exacto que necesita el contexto del ERP.
- **Una sola conversación por usuario**: la tabla `messages` no filtra por canal y
  `getRecentMessages(userId, 60)` la trae entera. Lo que le dijiste por WhatsApp **ya** está en
  contexto cuando le escribís desde el ERP.
- **Un protocolo previsto para apps embebidas** (`HyggeOS.jsx:355`):
  `{ type: 'hygge:context', user, spvId }` / `{ type: 'hygge:notify', message }`.
- **`navigate(space, view)`** (`HyggeOS.jsx:15893`) + routing por hash (`HyggeOS.jsx:15166`).
- **El shell Electron** (`desktop/main.js`, `desktop/preload.js`): envuelve `alice.bam.pe` y
  expone `window.alice` con una superficie mínima y explícita.
- **Disciplina de tests**: 36 archivos `.test.mjs` en `alicia-brain/test`, `node --test` en ambos
  lados.

### Los tres problemas concretos

1. **El space muestra un hilo falso.** `AliciaView` guarda su propia copia de la conversación en
   `localStorage` (`chatKey(uid)`), desincronizada del hilo real que Alicia sí recuerda en
   `messages`. Ella tiene continuidad; la UI no la refleja. Eso explica buena parte de la
   sensación de brecha.
2. **El gate autentica pero no identifica.** `panelGate` (`server.js:94`) acepta cualquier JWT de
   Supabase válido, pero `verifySupabaseJWT` (`server.js:65`) devuelve **un booleano** — tira la
   identidad. Y `/api/chat` confía en `req.body.userId` (`server.js:1158`), con
   `isCEO = userId === CEO_ID` (`server.js:590`). **Cualquier miembro del equipo logueado en el
   ERP puede mandar `userId: "sb"`** y obtener el set completo de tools del CEO, todo su historial,
   sus memorias y las personas del equipo. Rompe la regla de producto del HANDOFF §8 ("cada
   usuario solo ve SU conversación con Alicia").
3. **`/api/chat` es request/response.** No puede pausarse para pedirle algo al browser, ni emitir
   mientras piensa. Las dos cosas son requisito de un copiloto.

## Objetivo

Que abrir el space Alice se sienta como abrir Claude o ChatGPT desktop — pero con algo que ninguno
de los dos puede dar: **Alice sabe en qué estás trabajando dentro del ERP, puede operarlo con vos,
y te habla**. Radar, Velocity, Cabida, Growth dejan de ser islas: la integración global del
software se siente ahí.

## Decisiones de producto

### La regla nueva (reemplaza a HANDOFF §1)

`HANDOFF.md` §1 dice hoy: *"features de Alicia-como-agente van en aliceai.bam.pe, NUNCA en el
ERP"*, y §6 dice que los tabs de comando del AliciaView *"se revirtieron a propósito — no
restaurarlos"*. **Esto se revierte deliberadamente**, con una regla que refleja lo aprendido:
**tres puertas, un solo cerebro, una sola memoria.**

| Puerta | Qué es Alice ahí |
|---|---|
| **WhatsApp** | Alice conversacional. Fuera de la herramienta, en el bolsillo. |
| **Space del ERP** | Alice **copiloto**. Dentro de la herramienta, con contexto y manos. |
| **aliceai.bam.pe** | El **panel de control**: personalidad, diales, equipo, skills, recursos. Configuración, no conversación. |

El cerebro sigue siendo el único lugar donde Alice piensa y recuerda. **El ERP no gana un cerebro
— gana ojos y manos.** Esa frase resuelve cada duda de "¿dónde va esto?".

### Decisiones tomadas en el brainstorm

| Decisión | Elegido |
|---|---|
| Autonomía | **Copiloto**: navega y lee sola; todo lo que escribe pasa por confirmación de un click |
| Visión | Estado estructurado siempre + captura a pedido, **incluida toda la pantalla del Mac** vía el shell Electron |
| Voz | **Por turnos, manos libres con wakeword**. Un solo cerebro; nada de modelo realtime que parta a Alice en dos |
| Rollout | **Todo el equipo, capacidades escalonadas** según los roles que ya existen (`CEO_TOOLS`/`ADMIN_TOOLS`/`COLLAB_TOOLS`). Visión de pantalla arranca solo para el CEO |
| Tools del ERP | **Híbrido**: contrato genérico para los ~12 módulos + tools ricas a mano para Cabida, Velocity y Growth (las de Radar ya existen: `radar_query`/`radar_refresh`) |
| Layout del space | **100% copiloto**. El panel de perfiles/equipo sale; vive en aliceai.bam.pe |
| Salida | **Componentes reales del ERP embebidos en el hilo**, por allowlist |

## Arquitectura

Cuatro componentes nuevos:

1. **`ERPContext`** (browser, `files/alice/src/copilot/`) — registro donde cada módulo declara cómo
   describirse y qué acciones ofrece.
2. **`/api/copilot/*`** (cerebro) — transporte con streaming y tool-calls de ida y vuelta al cliente.
3. **`motores/`** (raíz del repo) — los cálculos puros de Cabida/Cotización/Velocity, compartidos
   por el ERP y el cerebro.
4. **Identidad real en el gate** — prerequisito bloqueante.

### Transporte: `POST /api/copilot/turn` (SSE)

`/api/chat` no alcanza: el loop necesita **pausarse para pedirle algo al browser** (leer el estado
de Cabida, navegar, capturar pantalla, esperar confirmación) y **emitir mientras piensa**.

El browser abre la conexión mandando el mensaje (texto o audio) y el snapshot de contexto. El
servidor emite:

```
text_delta    → streaming de la respuesta
tool_start    → "consultando el radar…"  (traza legible)
tool_done     → resultado, colapsable
client_tool   → "browser, ejecutá esto" + call_id
confirm       → "esto escribe, pedí confirmación" + call_id
component     → "renderizá <CabidaCard> con estos props"
audio_chunk   → TTS por oración
done
```

El browser contesta a `client_tool` y `confirm` con
`POST /api/copilot/turn/:turnId/result { call_id, result }`. El servidor mantiene el turno esperando
en una promesa con timeout y sigue el loop.

**Límite aceptado:** el estado del turno vive en memoria. Un deploy de Railway corta turnos en
vuelo, y esto asume una sola instancia. Si algún día hay más de una, hacen falta sticky sessions.
No se resuelve por adelantado (YAGNI).

WebSocket sería más natural para bidireccional, pero SSE+POST entra sin dependencias nuevas y pasa
por el `panelGate` existente. La frontera del transporte queda limpia para poder cambiarlo después.

### Identidad y seguridad (bloqueante de la fase 0)

1. **El gate identifica.** `verifySupabaseJWT` pasa a devolver el usuario en vez de un booleano,
   mapea `auth.users` → userId interno (`sb`, `vd`, …) y lo deja en `req.aliceUser`. `/api/chat` y
   `/api/copilot/*` toman el userId **de ahí, nunca del body**. Se conserva el "ver como" del
   admin (`selectedUserId` en `AliciaView`), pero solo si el JWT dice que es el CEO.
2. **Las escrituras se confirman por clasificación, no por criterio del modelo.** Cada tool se
   declara `read` | `navigate` | `write` en su definición. `read` y `navigate` corren directo;
   `write` siempre emite `confirm`. El modelo no decide qué es peligroso — el catálogo sí.
3. **La visión es opt-in y visible.** Persistida por usuario, apagada por defecto, con indicador en
   pantalla mientras está activa.
4. **Las imágenes no se persisten.** El código ya tiene esta propiedad (`saveMessage` guarda solo
   texto — `server.js:637`: *"se ve en el momento y se olvida, que es como funciona mirar algo"*).
   Se mantiene.

## A · Contexto vivo del ERP

### El contrato

Cada módulo se registra con un hook y declara cómo describirse:

```js
useERPContext("cabida", () => ({
  module: "cabida",
  title:  "Cabida · PU01 Paula Ugarriza",
  entity: { type: "proyecto", id: "PU01" },
  state:   { terreno: 640, pisos: 8, areaDpto: 75, precioM2: 2100, … },
  derived: { dptos: 42, vendible: 3180, margen: 1240000, utilNeta: 610000 },
  actions: ["cabida.setParams", "cabida.recalcular", "cabida.guardar"],
}))
```

La división importa: **`state` es lo que puso el usuario, `derived` es lo que el módulo ya
calculó.** Alice necesita los dos — uno para cambiar, el otro para razonar sin recalcular.

### Captura y presupuesto

- Se captura **una sola vez, al mandar el turno**. Ni polling, ni por render.
- Tope de **~2.000 caracteres**, la misma disciplina que `buildLiveContext` (que capa a 1.500 por
  bloque).
- Recorte: **el módulo activo va completo; los demás solo `{module, title, entity}`**. Alice sabe
  que existen sin que se pague por todos.
- Entra en el prompt **después del breakpoint de caché**, junto a `nowLima` + `liveContext`
  (`server.js:598-601`). El prefijo cacheado (system + tools + 60 mensajes) queda intacto:
  **navegar por el ERP no invalida el prompt cache**.

### Filtrado de tools por contexto

El snapshot declara `actions`. Las client tools que se le ofrecen al modelo **se filtran por lo que
el contexto dice que está disponible acá y ahora**. Menos tokens, y elimina de raíz que proponga
acciones imposibles en la pantalla actual.

## B · El copiloto con manos

### Tres capas de tools

**Capa 1 — genérica, cubre los ~12 módulos.** `erp_navigate(module, entityId?)`, `erp_read(module?)`,
`erp_list_modules()`. Se apoya en `navigate(space, view)` (`HyggeOS.jsx:15893`). Costo por módulo:
una función `describe()` y una entrada en el mapa de rutas. **Ningún módulo queda invisible desde el
día 1.**

**Capa 2 — rica, donde se hace el trabajo.** Cabida, Velocity, Growth. Parámetros tipados,
validación, y corren en el servidor (ver `motores/`).

**Capa 3 — apps embebidas.** Reactor (`/reactor.html`) y Commissioner por el protocolo
`hygge:context` ya previsto. **Radar queda fuera de alcance para conducción de UI**: es un iframe
cross-origin (`https://hygge-radar.netlify.app/`), otro repo y otro deploy. Sus *datos* ya están
cubiertos por `radar_query`/`radar_refresh` sobre `market_snapshots`.

### `motores/` — por qué el cálculo va al servidor

El cálculo de cabida es una **función pura de 19 escalares** atrapada dentro de un `useMemo`
(`CabidaView.jsx:217-260`). Mientras siga ahí, Alice solo puede simular si el usuario tiene esa
pantalla abierta, y no puede hacerlo nunca por WhatsApp.

```js
// motores/cabida.js
export function calcularCabida({ terreno, areaLibre, pisos, … }) { … }
```

`CabidaView` pasa a `useMemo(() => calcularCabida(params), [...])`: mismo resultado, cero cambio
visible, y el motor queda disponible para el cerebro, para WhatsApp y para los agentes de Wonderland.

| Motor | Estado actual | Trabajo |
|---|---|---|
| **Cotización** | Ya puro y exportado (`financiamiento.js`, `retorno.js`) | Se mueve tal cual |
| **Cabida** | Puro pero atrapado en el `useMemo`; `esquema.js/computeEsquema` ya es puro | Extracción mecánica |
| **Velocity** | `MercadoView.jsx` son 1.156 líneas, mezcla incierta | **Auditar antes de prometer** |

Ubicación: `motores/` en la raíz, ESM sin dependencias, sin build step. Railway lo importa relativo;
Vite con un alias (Netlify hace checkout del repo entero, así que la ruta existe en build). Tests
con `node --test`.

### Ciclo de confirmación

Una tool `write` emite `confirm` con un resumen legible → aparece una tarjeta en el hilo con
Confirmar / Descartar → recién entonces ejecuta. Mientras espera, el turno está pausado y la traza
lo muestra, para que nunca haya duda de si Alice ya hizo algo o todavía está preguntando.

### Componentes embebidos sin agujero de seguridad

El evento `component` lleva `{name, props}` — **nunca código**. El ERP mantiene un registro
allowlist (`CabidaCard`, `VelocityCard`, `TerrenoCard`, `TaskCard`, …); si el nombre no está en el
registro, degrada a markdown. Reusa los componentes reales del ERP sin darle al servidor la
capacidad de ejecutar nada en el browser.

## C · El chat que se siente vivo

1. **El hilo real.** `localStorage` deja de ser fuente de verdad. `GET /api/copilot/history` lee la
   tabla `messages`. `localStorage` queda solo como caché optimista para que el space abra
   instantáneo.
   **Consecuencia deliberada:** los mensajes de WhatsApp aparecen en el hilo del ERP. Eso *es* la
   continuidad, pero sin marcar sería confuso: la columna `messages.channel` ya existe, así que se
   renderiza un marcador por canal (WhatsApp · voz · ERP).
2. **Streaming y traza.** `text_delta` para el texto; `tool_start`/`tool_done` como filas
   colapsables. La traza **dice qué hace en castellano** ("consultando el radar…"); el JSON queda
   detrás del colapso. La traza es para confiar, no para depurar.
3. **Markdown.** El ERP no tiene ningún renderer hoy → se agrega `react-markdown` + `remark-gfm`.
   Es la única dependencia nueva del lado del ERP. **Recharts ya está instalado**, así que los
   gráficos embebidos no cuestan dep nueva.
4. **Techo de iteraciones.** `MAX_ITERATIONS = 8` (`server.js:643`) sube a **16 solo para el canal
   copiloto** (WhatsApp se queda en 8), y el corte real pasa a ser por presupuesto de tokens, no
   solo por conteo de vueltas.

## D · Voz

La voz del ERP **no** reusa `/api/embodied` — ese sigue siendo el endpoint del teléfono, que es
cuerpo desechable. En el ERP la voz entra por **el mismo transporte del copiloto**, porque un turno
hablado necesita las mismas tools, el mismo contexto de pantalla y las mismas confirmaciones. El
turno acepta audio de entrada y emite `audio_chunk`.

- **TTS por oración, no al final.** Hoy el audio se genera con la respuesta completa. Cortándolo por
  oración y emitiendo apenas está la primera, el tiempo hasta que Alice **empieza** a hablar cae de
  ~4s a ~1,5s. Es el cambio individual que más hace por la sensación de agente real.
- **Manos libres, dos caminos.** En el browser: wakeword local con Porcupine (WASM; no sale audio a
  ningún lado hasta que se dispara). En el desktop app: `globalShortcut` de Electron (Option+Espacio
  desde cualquier parte del Mac). El hotkey global es la primitiva confiable; el wakeword es el
  lujo. Segunda línea de defensa contra falsos positivos: `isWhisperHallucination`, ya escrita.
- **Barge-in.** Mientras suena el audio el micrófono sigue abierto; si detecta voz sostenida, corta
  la reproducción y abre turno nuevo. No es duplex real, pero es el 80% de la sensación por el 10%
  del trabajo — y es la razón por la que no hace falta un modelo realtime todavía.

## E · Visión

`desktopCapturer` en el shell Electron, expuesto por el preload. **`desktop/preload.js` es de la
otra sesión de trabajo**: el contrato se acuerda antes de que ninguno toque el archivo. Superficie
mínima propuesta, en la línea de lo que ya expone:

```js
window.alice.captureScreen({ scope: "window" | "display" }) → dataURL
```

- **Fallback en browser puro:** `getDisplayMedia`. Menos fluido (pide permiso y hay que elegir la
  ventana), pero el ERP web no se queda sin la función.
- **Default `scope: "window"`, no la pantalla entera.** Una captura completa del Mac puede llevarse
  por delante el WhatsApp de otro, un mail, un estado de cuenta. Pantalla completa solo cuando se
  pide explícito. Es la diferencia entre una función que el equipo adopta y una que nadie prende.
- **Costo:** downscale a ~1.400px, JPEG q0.7 → ~1.200-1.600 tokens por imagen. A pedido eso es ruido
  de fondo. Por eso se descartó el frame continuo: la señal/ruido es mala y el costo sería la cuenta
  principal.

## Fases

Cada fase se deploya sola y vale por sí misma. **Si el plan se detiene en cualquier fase, lo
entregado sigue siendo útil.**

| Fase | Qué entra | Cuándo se siente |
|---|---|---|
| **0 · Identidad** | El gate devuelve usuario; `req.aliceUser`; el userId sale del JWT; impersonación solo si el JWT dice CEO | No se ve — pero sin esto no se puede seguir |
| **1 · Contexto vivo** | `ERPContextProvider` + `describe()` por módulo; snapshot en el turno; hilo server-side con marcador de canal | **Alice sabe dónde estás** |
| **2 · Transporte** | SSE, `text_delta`, traza de tools, `react-markdown`, iteraciones a 16 | **Se siente como Claude app** |
| **3 · Manos** | `client_tool` + `confirm`, bus de acciones, capa genérica, clasificación read/navigate/write | **Es un copiloto** |
| **4 · Motores** | Caracterización → `motores/cabida.js` + `cotizacion`; auditar Velocity; tools ricas; componentes embebidos | **Es potente** |
| **5 · Voz** | Audio en el turno, TTS por oración, hotkey global + push-to-talk, barge-in, wakeword al final | **Es un agente real** |
| **6 · Visión** | Contrato del preload, `captureScreen`, opt-in, indicador, fallback `getDisplayMedia` | **Trabaja con vos** |

## Riesgos

Lo que se **acepta** y no se resuelve está en «Deuda técnica asumida», con su plan de
pago. Acá van los que hay que **gestionar durante la ejecución**.

1. **El motor de cabida son números con los que se compran terrenos.** El riesgo más caro del plan.
   Mitigación: **tests de caracterización antes de mover una línea** — se captura la salida actual
   para inputs reales y el refactor tiene que reproducirla exacta. Si no coincide, no se mueve.
2. **`HyggeOS.jsx` tiene 16.553 líneas.** Mitigación: el provider, el registro y el bus viven en
   archivos nuevos bajo `src/copilot/`; en `HyggeOS.jsx` entran solo el wrapper del provider y
   llamadas puntuales a `useERPContext`. **No se refactoriza el monstruo** — es otro proyecto y
   mezclarlo hundiría este.
3. **El estado del turno vive en memoria** (→ D1). Un deploy corta turnos en vuelo; asume una sola
   instancia. Aceptado y documentado.
4. **`desktop/preload.js` es de la otra sesión.** Única dependencia externa dura: el contrato de
   `captureScreen` se acuerda antes de tocar el archivo.
5. **Costo.** Contexto en cada turno + imágenes + el doble de iteraciones. Mitigación: snapshot
   capado a 2k, tools filtradas por contexto, y el prompt caching intacto porque el contexto entra
   después del breakpoint.
6. **La migración localStorage→Supabase sigue pendiente** (→ D6; HANDOFF §4.10, ~34 usos). No se aborda.
   Pero el hilo del copiloto nace server-side, así que este plan **no agrega deuda** a esa pila.
7. **Radar es cross-origin** (→ D7). Conducción de UI declarada fuera de alcance; sus datos ya están
   cubiertos.

## Testing

- **`motores/`** — caracterización primero, después unitarios. Es la única lógica numérica de
  negocio del plan; es donde el TDD paga de verdad.
- **Gate de identidad** — un JWT de `vd` no puede leer el historial de `sb` ni obtener tools de CEO.
  Test explícito del agujero encontrado.
- **Clasificación de tools** — test estructural: *toda* tool tiene clasificación, y ninguna `write`
  puede ejecutarse sin un `confirm` resuelto.
- **Snapshot de contexto** — respeta el tope de 2k y el módulo activo nunca se trunca.
- **Transporte** — un `client_tool` que nunca contesta corta por timeout y no deja el turno colgado.

Arreglo de paso: `alicia-brain/package.json` **no tiene script `test`** pese a los 36 archivos de
test. Se agrega `"test": "node --test test/*.test.mjs"`.

## Deuda técnica asumida (registro para pagar después)

Cada sacrificio de este diseño, por qué se acepta hoy, qué cuesta mientras siga ahí, y qué haría
falta para saldarlo. **Este registro se mantiene vivo**: si una fase agrega deuda no listada acá,
se agrega acá.

### D1 · El estado del turno vive en memoria
**Por qué:** el turno tiene que pausarse esperando al browser; persistirlo requiere una máquina de
estados durable.
**Cuesta:** un deploy de Railway corta los turnos en vuelo (el usuario ve el hilo colgado y tiene
que repetir). Imposible correr más de una instancia.
**Atenuante:** el cerebro **ya** está pinneado a una sola instancia por otra razón — la DB es
SQLite sobre el volumen `/data` (`db.js:1`, `DatabaseSync`). Esto no agrega una restricción nueva,
hereda la que ya hay.
**Pagarlo:** persistir el turno (tabla `copilot_turns` con el estado del loop) o migrar a Postgres
(`pg` ya está en las deps) + sticky sessions. Recién vale la pena cuando haya que escalar
horizontalmente.

### D2 · SSE + POST en vez de WebSocket
**Por qué:** entra sin dependencias nuevas y pasa por el `panelGate` existente.
**Cuesta:** dos conexiones por turno en vez de una; el canal de vuelta es un POST aparte, con su
propia latencia y su propio manejo de errores. La voz con barge-in va a sentir esa costura.
**Pagarlo:** mover a WS. La frontera del transporte se diseña limpia justamente para que sea un
reemplazo de una capa, no una reescritura.

### D3 · Un solo hilo infinito por usuario, sin conversaciones separadas
**Por qué:** la tabla `messages` no tiene concepto de hilo y `getRecentMessages(userId, 60)` corta
por cantidad. Cambiarlo toca WhatsApp, el teléfono y el panel a la vez.
**Cuesta:** no hay "conversación nueva". Todo se mezcla en un continuo, y el corte a 60 mensajes
hace que el contexto viejo desaparezca sin aviso en vez de archivarse. Un tema largo de la semana
pasada ya no está.
**Pagarlo:** `messages.thread_id` + selector de conversaciones en el space + resumen automático al
cerrar hilo. Es la mejora que más cambiaría la sensación de "Claude app" después de la fase 2.

### D4 · Sin memoria semántica sobre el ERP
**Por qué:** el RAG ya estaba pendiente antes de este plan (HANDOFF §4.9) y meterlo acá duplicaría
el alcance.
**Cuesta:** Alice razona sobre lo que está en los 60 mensajes recientes, las 12 memorias relevantes
y el contexto de pantalla. Lo que pasó hace un mes en otro proyecto no lo trae sola.
**Pagarlo:** embeddings sobre `messages` + `knowledge` + los datos del ERP. Es un proyecto propio.

### D5 · `HyggeOS.jsx` sigue con 16.553 líneas
**Por qué:** refactorizarlo es otro proyecto y mezclarlo hundiría este.
**Cuesta:** cada `useERPContext` que se agregue entra en un archivo que nadie puede leer entero, y
el riesgo de conflicto con cualquier otra sesión que lo toque es alto. La contención (todo lo nuevo
en `src/copilot/`) limita el daño pero no lo elimina.
**Pagarlo:** extraer los módulos de `HyggeOS.jsx` a archivos propios. El registro de contexto que
construimos acá **facilita** ese trabajo, porque documenta las fronteras reales de cada módulo.

### D6 · El resto del ERP sigue en localStorage
**Por qué:** ~34 usos, ya estaba en el backlog (HANDOFF §4.10).
**Cuesta:** lo que Alice lee del contexto de un módulo puede ser data que solo existe en ese
browser. Si el equipo mira "lo mismo", no es lo mismo.
**Atenuante:** el hilo del copiloto nace server-side, así que este plan no agrega deuda a esa pila.
**Pagarlo:** la migración que ya está en el backlog. **Prioridad alta una vez que Alice opere para
el equipo**, porque un copiloto sobre data no compartida da respuestas distintas a cada persona.

### D7 · Radar: datos sí, UI no
**Por qué:** iframe cross-origin, otro repo, otro deploy.
**Cuesta:** Alice puede responder sobre el mercado pero no puede abrirte el proyecto en el mapa ni
aplicar un filtro. Es la app donde el "co-uso" se va a notar ausente.
**Pagarlo:** extender el protocolo `hygge:context` (`HyggeOS.jsx:355`) del lado de Radar con un
canal de comandos por `postMessage`. Trabajo chico, pero en otro repo.

### D8 · Voz por turnos, no duplex
**Por qué:** un modelo realtime partiría a Alice en dos cerebros o agregaría un salto de delegación.
**Cuesta:** ~1,5s hasta la primera palabra (con TTS por oración) contra <1s de un duplex real, y el
barge-in es una aproximación: corta la reproducción, no reformula sobre la marcha.
**Pagarlo:** modelo realtime como oído+voz delegando al cerebro Claude por tool. Reevaluar cuando
el barge-in aproximado se sienta insuficiente en uso real — no antes.

### D9 · Wakeword y hotkey, no escucha permanente del sistema
**Por qué:** escucha permanente a nivel SO es otro producto y otro problema de privacidad.
**Cuesta:** Alice no te oye si no la invocás. No hay "che Alicia" desde la otra punta de la oficina
sin el ERP abierto o el desktop app corriendo.
**Pagarlo:** un agente de menubar siempre activo. Fuera de alcance por diseño, no por falta de tiempo.

### D10 · Visión a pedido, no continua
**Por qué:** el costo por frame y la señal/ruido; la mayoría de los frames no dicen nada nuevo.
**Cuesta:** Alice no nota que algo cambió en tu pantalla; hay que pedírselo. No va a interrumpirte
con "ojo que ese número está mal".
**Pagarlo:** frames disparados por evento (cambio de módulo, guardado) en vez de por reloj — mucho
más barato que streaming y cubre el 80% de la proactividad. **Es el primer candidato a pagar** de
esta lista.

### D11 · Las imágenes no se persisten
**Por qué:** propiedad de privacidad deliberada, ya presente en el código (`server.js:637`).
**Cuesta:** Alice no puede referirse a lo que vio dos turnos atrás. Cada mirada es nueva.
**Pagarlo:** guardar una descripción textual de lo que vio (no la imagen) en el hilo. Conserva la
privacidad y recupera la continuidad. Barato.

### D12 · Confirmación sin deshacer
**Por qué:** un undo real exige que cada módulo del ERP sepa revertir, y hoy ninguno sabe.
**Cuesta:** si confirmás algo por error, lo arreglás a mano. La confirmación es la única red.
**Pagarlo:** un log de acciones del copiloto con reversa por tool. Empezar por las tools de escritura
más usadas, no por todas.

### D13 · Componentes por allowlist, sin artifacts
**Por qué:** ejecutar código generado dentro del ERP necesita sandbox; es un subsistema entero.
**Cuesta:** Alice solo puede mostrar lo que ya existe como componente. Una visualización que nadie
programó, no la puede armar.
**Pagarlo:** iframe sandboxed con una API acotada. Recién cuando el allowlist se sienta corto.

### D14 · El snapshot capado a 2k deja los módulos inactivos casi invisibles
**Por qué:** presupuesto de tokens por turno.
**Cuesta:** Alice sabe que Growth existe y qué terreno tenés abierto, pero no sus números, salvo que
los pida con una tool. Un turno extra de latencia para preguntas que cruzan módulos.
**Pagarlo:** subir el tope selectivamente cuando la pregunta lo justifique (el modelo pide
`erp_read` y ya funciona) o precargar los dos o tres módulos más consultados. Medir antes de tocar.

### D15 · El contexto queda fuera del prompt cache
**Por qué:** si entrara al bloque cacheado, cada navegación invalidaría el prefijo entero.
**Cuesta:** esos ~2k caracteres se pagan a precio completo en cada turno. Es el intercambio correcto
—reprocesar el prefijo costaría mucho más— pero es un costo recurrente real.
**Pagarlo:** no hay nada que pagar; es la decisión correcta. Queda anotado para que nadie lo
"optimice" moviéndolo al bloque cacheado sin entender por qué está donde está.

### D16 · Velocity puede quedar sin motor extraído
**Por qué:** `MercadoView.jsx` son 1.156 líneas y no sabemos cuánto es lógica pura hasta auditarlo.
**Cuesta:** si no se extrae, Alice simula velocidad de ventas solo con la pantalla abierta, y nunca
por WhatsApp — la misma limitación que hoy tiene Cabida.
**Pagarlo:** la auditoría es parte de la fase 4. Si sale enredado, se agenda aparte en vez de
forzarlo dentro de esta entrega.

### D17 · Los tests de caracterización cubren los inputs capturados, no el espacio completo
**Por qué:** es la técnica correcta para un refactor de preservación, no una prueba de corrección.
**Cuesta:** si el motor de cabida tiene un bug en un rango de inputs que no capturamos, el refactor
lo preserva intacto y en silencio.
**Pagarlo:** property-based testing sobre invariantes del motor (ej. área vendible nunca mayor que
la bruta) además de los casos capturados. Vale la pena si alguna vez se duda de un número.

### D18 · El panel de perfiles/equipo sale del ERP y no se migra
**Por qué:** el space se dedica al copiloto; el contenido ya vive en aliceai.bam.pe.
**Cuesta:** para ver skills, growth o insights de un colaborador hay que salir del ERP a otra app.
Fricción real para vos y para Vanessa.
**Pagarlo:** un módulo "Equipo" propio en el ERP que consuma `/api/insights/:id` y `/api/profiles`.
Era la tercera opción del brainstorm; queda como candidata explícita, no como olvido.

### D19 · Sin telemetría de costo por turno
**Por qué:** no se pidió y agrega alcance.
**Cuesta:** este plan sube el gasto por turno (contexto + imágenes + el doble de iteraciones) y no
vamos a saber cuánto hasta que llegue la factura.
**Pagarlo:** loguear tokens de entrada/salida por turno y por canal en `messages` o una tabla
aparte. Es chico y **conviene hacerlo en la fase 2**, cuando se toca el loop igual — pagar esta
deuda al momento de contraerla sale casi gratis.

## Fuera de alcance

- Refactor de `HyggeOS.jsx`.
- Migración `localStorage` → Supabase del resto del ERP.
- Conducir la UI del Radar (otro repo).
- Modelo de voz realtime/duplex. La frontera del transporte queda limpia para adoptarlo después sin
  rehacer nada.
- Artifacts generados al vuelo (ejecutar código generado dentro del ERP). Los componentes van por
  allowlist.
