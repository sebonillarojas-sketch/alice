# Alice Copiloto · Fase 3 · Manos: el copiloto que navega, lee y pide permiso

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que Alicia pueda abrir un módulo del ERP, leer lo que hay en pantalla y proponer un cambio que se aplica recién cuando vos hacés click — sin que el chat se muera en el camino.

**Architecture:** El loop del agente gana un segundo ejecutor de tools: además de `executeTool` (que corre en el servidor), puede derivar una tool **al browser** y quedarse esperando su respuesta. La espera vive en un registro de turnos en memoria (`turnos.js`) y viaja por el SSE que ya existe: el servidor emite `client_tool` (o `confirm`, si la tool escribe) y el browser contesta por `POST /api/copilot/turn/:turnId/result`. Del lado del ERP, el turno **sube a un provider por encima del router** y el chat pasa a ser un dock persistente: así `erp_navigate` puede cambiar de módulo sin desmontar la conversación.

**Tech Stack:** Node 22 ESM · Express 4 · `@anthropic-ai/sdk` 0.30.1 · `node --test` · React 18 + Vite · Playwright (vía `alicia-brain/node_modules`, solo para los humos)

**Spec:** `docs/superpowers/specs/2026-09-01-alice-copiloto-erp-design.md` — sección **B · El copiloto con manos**

## Global Constraints

- **La firma de retorno de `processAliciaMessage` no cambia.** Sigue devolviendo `{ text, actions }`. Sin `opts.clientTools`, el comportamiento tiene que ser byte-idéntico al actual: WhatsApp (`/webhook/twilio`), el teléfono (`/api/embodied`) y `/api/chat` no se tocan.
- **Las client tools existen SÓLO en el canal `copilot`.** Ninguna otra ruta las pasa. Si `opts.clientTools` viene vacío o ausente, el loop ni siquiera consulta el catálogo.
- **El userId NUNCA sale del body.** Sale de `req.aliceUser` vía `resolveActingUser`. Esto vale también para la ruta nueva de resultados: un turno sólo lo puede contestar el usuario que lo abrió.
- **La clasificación la decide el catálogo, no el modelo.** Cada client tool declara `efecto: "read" | "navigate" | "write"` en su definición. `read` y `navigate` corren directo; `write` **siempre** emite `confirm`. No hay heurística sobre el nombre ni sobre los argumentos.
- **Las client tools entran DESPUÉS del breakpoint de caché de tools.** El `cache_control` se queda en la última tool estable y las client tools se appendean después. Su `input_schema` varía por turno (el enum de `erp_action` sale del contexto), así que meterlas adentro del prefijo cacheado invalidaría el caché de tools en cada navegación.
- **Un `client_tool` que nunca contesta no puede colgar el turno.** Toda espera tiene timeout, y el timeout se resuelve como un `tool_result` de error, no como una excepción que mate el turno.
- **`onEvent` nunca puede tumbar el turno.** Sigue valiendo lo de la Fase 2: cada emisión va envuelta en try/catch.
- **Esta fase NO incluye** `component`, `audio_chunk` ni `captureScreen`. Son las Fases 4, 5 y 6. No dejar medias implementaciones.
- **Sólo se construye la capa 1 del spec** (genérica: `erp_navigate` / `erp_read` / `erp_list_modules` / `erp_action`). La **capa 2** (tools ricas de Cabida/Velocity/Growth con validación tipada y cálculo en el servidor) es la Fase 4, y depende de `motores/`. La **capa 3** (Reactor y Commissioner por el protocolo `hygge:context`) no entra: son iframes y su contrato de postMessage está declarado como futuro en `HyggeOS.jsx:357`. Radar queda fuera de conducción de UI por decisión del spec — es cross-origin y otro repo.
- **No se refactoriza `HyggeOS.jsx`.** Tiene 16.5k líneas. Lo único que entra ahí son el montaje del dock y el registro de acciones en el bus.
- Comentarios y mensajes de commit en **castellano**.

## Decisión de diseño: por qué el chat sale del space

`erp_navigate` es la tool central de esta fase, y choca de frente con el layout actual: el chat de Alicia **es un space a pantalla completa** (`currentSpace === "alicia"`, `HyggeOS.jsx:16369`). Navegar a Cabida desmonta `AliciaView` y se lleva puesto el turno en vuelo.

Esto no es teórico. El ref `ultimoVisto` de `ERPContext.jsx:29` existe exactamente por este motivo: *"para escribirle tenés que salir de Cabida… salir = desmontar"*. La Fase 1 lo parcheó del lado del contexto congelando la última foto. Del lado de las manos ya no alcanza un parche: si Alicia te lleva a Cabida, el componente que está esperando la respuesta del `client_tool` deja de existir y el turno queda colgado del lado del servidor hasta que salte el timeout.

Por eso el estado del turno sube a **`CopilotoProvider`**, montado en `App.jsx` junto a `ERPContextProvider` — por encima del switch de spaces —, y la conversación se renderiza en un **dock** montado en la raíz de `HyggeOS`. El space `alicia` no desaparece: pasa a ser la vista ancha **de la misma conversación**, leyendo del mismo provider. Dos vistas, un solo estado, cero divergencia.

Efecto lateral que conviene tener presente: esto es también lo que van a necesitar la Fase 5 (voz) y la Fase 6 (visión), que no pueden vivir dentro de un componente que se desmonta cada vez que mirás otra cosa.

## Decisión de diseño: `esperarRegistro`

`erp_navigate` no puede resolver apenas llama a `navigate()`. React todavía no re-renderizó, el módulo destino no montó y su `useERPContext` no corrió: un `erp_read` inmediatamente después leería un registro vacío y Alicia te diría que Cabida no tiene nada.

Así que `ERPContextProvider` gana **`esperarRegistro(moduleId, timeoutMs)`**: una promesa que resuelve cuando ese módulo se registra, o a los 3s. `erp_navigate` la espera antes de contestar, y devuelve en el mismo `tool_result` la descripción del módulo recién montado. Alicia navega y lee en un solo paso.

---

## File Structure

**Cerebro (`alicia-brain/`)**

| Archivo | Responsabilidad |
|---|---|
| `src/client-tools.js` · **nuevo** | Catálogo de tools que ejecuta el browser, con su `efecto`. Filtrado por contexto. Puro. |
| `src/turnos.js` · **nuevo** | Registro en memoria de turnos esperando respuesta del cliente. Puro (reloj inyectable). |
| `src/server.js` · modificar | `opts.clientTools` + `opts.ejecutarClientTool` en el loop; `turn_start`/`client_tool`/`confirm` en la ruta; ruta nueva de resultados. |
| `test/client-tools.test.mjs` · **nuevo** | |
| `test/turnos.test.mjs` · **nuevo** | |

**ERP (`files/alice/`)**

| Archivo | Responsabilidad |
|---|---|
| `src/copilot/acciones.js` · **nuevo** | El bus: `registrar(nombre, fn)` / `ejecutar(nombre, args)`. Puro, sin DOM. |
| `src/copilot/manos.js` · **nuevo** | La capa genérica: `erp_list_modules`, `erp_read`, `erp_navigate`, `erp_action`. Puro, dependencias inyectadas. |
| `src/copilot/ERPContext.jsx` · modificar | `esperarRegistro(moduleId, ms)` + exponer `describir(moduleId)` y `modulos()`. |
| `src/copilot/CopilotoProvider.jsx` · **nuevo** | El turno y el hilo, por encima del router. Dueño del bus y de las manos. |
| `src/copilot/CopilotoDock.jsx` · **nuevo** | El panel persistente. Renderiza la conversación del provider. |
| `src/copilot/Conversacion.jsx` · **nuevo** | Las burbujas + el composer, compartidos por el dock y el space. |
| `src/copilot/DialogoConfirmar.jsx` · **nuevo** | La confirmación de una escritura: qué tool, con qué argumentos. |
| `src/modules/alicia/AliciaView.jsx` · modificar | Deja de tener turno propio; consume el provider y renderiza `Conversacion` ancha. |
| `src/HyggeOS.jsx` · modificar | Monta el dock; registra `erp.navigate` en el bus. |
| `src/App.jsx` · modificar | Monta `CopilotoProvider` dentro de `ERPContextProvider`. |
| `test/copilot-acciones.test.mjs` · **nuevo** | |
| `test/copilot-manos.test.mjs` · **nuevo** | |
| `scripts/cerebro-falso.mjs` · modificar | Guiones nuevos: un turno con `client_tool` y otro con `confirm`. |
| `scripts/humo-manos.mjs` · **nuevo** | El round-trip completo en un Chromium de verdad. |

---

### Task 1: `client-tools.js` — el catálogo y su clasificación

**Files:**
- Create: `alicia-brain/src/client-tools.js`
- Test: `alicia-brain/test/client-tools.test.mjs`

**Interfaces:**
- Consumes: nada.
- Produces: `CLIENT_TOOLS` (array con `efecto`), `esClientTool(nombre) → boolean`, `efectoDe(nombre) → "read"|"navigate"|"write"|undefined`, `clientToolsPara(erpContext) → array con forma de tool de la API (sin `efecto`)`.

- [ ] **Step 1: Escribir el test que falla**

```js
// alicia-brain/test/client-tools.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { CLIENT_TOOLS, esClientTool, efectoDe, clientToolsPara } from "../src/client-tools.js";

test("toda client tool declara un efecto conocido", () => {
  for (const t of CLIENT_TOOLS) {
    assert.ok(["read", "navigate", "write"].includes(t.efecto), `${t.name} tiene efecto "${t.efecto}"`);
  }
});

test("erp_action es la única que escribe", () => {
  const escriben = CLIENT_TOOLS.filter(t => t.efecto === "write").map(t => t.name);
  assert.deepEqual(escriben, ["erp_action"]);
});

test("esClientTool distingue las del browser de las del servidor", () => {
  assert.equal(esClientTool("erp_navigate"), true);
  assert.equal(esClientTool("gmail_send"), false);
  assert.equal(efectoDe("erp_navigate"), "navigate");
  assert.equal(efectoDe("gmail_send"), undefined);
});

test("las tools que van a la API no llevan el campo efecto", () => {
  // `efecto` es nuestro, no del contrato de Anthropic: mandarlo es un campo
  // desconocido en la definición de tool.
  for (const t of clientToolsPara(null)) {
    assert.equal("efecto" in t, false, `${t.name} filtró el efecto`);
    assert.ok(t.name && t.description && t.input_schema);
  }
});

test("sin contexto NO se ofrece erp_action: no hay ninguna acción que exista", () => {
  const nombres = clientToolsPara(null).map(t => t.name);
  assert.deepEqual(nombres.sort(), ["erp_list_modules", "erp_navigate", "erp_read"]);
});

test("con un módulo activo que declara acciones, erp_action entra con el enum de ESAS acciones", () => {
  const ctx = {
    active: { module: "cabida", title: "Cabida · PU01", actions: ["cabida.setParams", "cabida.recalcular"] },
    others: [], dropped: 0,
  };
  const action = clientToolsPara(ctx).find(t => t.name === "erp_action");
  assert.ok(action, "erp_action tiene que estar");
  assert.deepEqual(action.input_schema.properties.action.enum, ["cabida.setParams", "cabida.recalcular"]);
});

test("un módulo activo SIN acciones no habilita erp_action", () => {
  const ctx = { active: { module: "obra", title: "Obra · DC01" }, others: [], dropped: 0 };
  assert.equal(clientToolsPara(ctx).some(t => t.name === "erp_action"), false);
});

test("las acciones de los módulos NO activos no entran al enum", () => {
  // `others` viaja recortado a {module,title,entity} — no tiene actions —, pero
  // aunque las trajera: ofrecer una acción de un módulo que no está en pantalla
  // es ofrecer algo que el bus no tiene registrado.
  const ctx = {
    active: { module: "cabida", actions: ["cabida.setParams"] },
    others: [{ module: "velocity", title: "Velocity", actions: ["velocity.simular"] }],
    dropped: 0,
  };
  const action = clientToolsPara(ctx).find(t => t.name === "erp_action");
  assert.deepEqual(action.input_schema.properties.action.enum, ["cabida.setParams"]);
});

test("un erpContext con basura no explota y degrada a las tres de siempre", () => {
  for (const basura of [undefined, {}, { active: "texto" }, { active: { actions: "no-es-array" } }]) {
    const nombres = clientToolsPara(basura).map(t => t.name);
    assert.equal(nombres.includes("erp_action"), false);
    assert.equal(nombres.length, 3);
  }
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd alicia-brain && node --test test/client-tools.test.mjs`
Expected: FAIL — `Cannot find module '../src/client-tools.js'`

- [ ] **Step 3: Escribir la implementación**

```js
// alicia-brain/src/client-tools.js
//
// Las tools que NO corren acá: el servidor las deriva al browser y espera la
// respuesta. Viven en su propio archivo (y no en tools.js) porque no comparten
// nada con las del servidor: no tienen ejecutor local, y la mitad del contrato
// es el `efecto`, que tools.js no conoce.
//
// `efecto` es LA pieza de seguridad de esta fase. Quién pide confirmación no lo
// decide el modelo mirando el nombre de la tool ni sus argumentos: lo decide esta
// tabla. Una tool `write` SIEMPRE emite `confirm`, aunque el modelo jure que es
// inofensiva.

export const CLIENT_TOOLS = [
  {
    name: "erp_list_modules",
    efecto: "read",
    description: "Lista los módulos del ERP que podés abrir con erp_navigate, con su id y su nombre. Usalo cuando no sepas cómo se llama el módulo que necesitás.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "erp_read",
    efecto: "read",
    description: "Lee el estado actual de un módulo que ya está abierto: lo que el usuario cargó (state) y lo que el módulo calculó (derived). Sin `module` lee el que está en pantalla.",
    input_schema: {
      type: "object",
      properties: { module: { type: "string", description: "id del módulo, por ejemplo \"cabida\"" } },
      required: [],
    },
  },
  {
    name: "erp_navigate",
    efecto: "navigate",
    description: "Abre un módulo del ERP en la pantalla del usuario y devuelve su estado ya cargado. Es lo que usás para ir a ver algo que no está abierto.",
    input_schema: {
      type: "object",
      properties: {
        module: { type: "string", description: "id del módulo o del space, por ejemplo \"cabida\" o \"growth\"" },
        entityId: { type: "string", description: "opcional: id del proyecto o terreno a abrir dentro del módulo" },
      },
      required: ["module"],
    },
  },
  {
    name: "erp_action",
    efecto: "write",
    description: "Ejecuta una acción que MODIFICA lo que el usuario tiene en pantalla. Siempre se le pide confirmación antes de correr: proponé la acción con los argumentos exactos y esperá.",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", description: "nombre exacto de la acción" },
        args: { type: "object", description: "argumentos de la acción", additionalProperties: true },
      },
      required: ["action"],
    },
  },
];

const POR_NOMBRE = new Map(CLIENT_TOOLS.map(t => [t.name, t]));

export const esClientTool = (nombre) => POR_NOMBRE.has(nombre);
export const efectoDe = (nombre) => POR_NOMBRE.get(nombre)?.efecto;

// Saca `efecto` antes de que la definición viaje a la API: es un campo nuestro y
// el contrato de tools de Anthropic no lo tiene.
const paraLaApi = ({ efecto, ...resto }) => resto;

// Las tools que se le ofrecen al modelo se filtran por lo que el contexto dice
// que está disponible acá y ahora (spec §"Filtrado de tools por contexto"). Las
// tres de lectura/navegación van siempre: sin ellas Alicia no puede ni averiguar
// qué existe. `erp_action` es la que se recorta, y fuerte: su enum son
// EXACTAMENTE las acciones que el módulo activo declaró. Así el modelo no puede
// ni nombrar una acción que el bus no tiene registrada.
export function clientToolsPara(erpContext) {
  const base = CLIENT_TOOLS.filter(t => t.efecto !== "write").map(paraLaApi);

  const activo = erpContext && typeof erpContext === "object" ? erpContext.active : null;
  const acciones = activo && typeof activo === "object" && Array.isArray(activo.actions)
    ? activo.actions.filter(a => typeof a === "string" && a)
    : [];
  if (!acciones.length) return base;

  const plantilla = POR_NOMBRE.get("erp_action");
  const conEnum = {
    ...paraLaApi(plantilla),
    input_schema: {
      ...plantilla.input_schema,
      properties: {
        ...plantilla.input_schema.properties,
        action: { ...plantilla.input_schema.properties.action, enum: acciones },
      },
    },
  };
  return [...base, conEnum];
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd alicia-brain && node --test test/client-tools.test.mjs`
Expected: PASS — 8 tests

- [ ] **Step 5: Correr la suite completa y commitear**

```bash
cd alicia-brain && node --test test/*.test.mjs
git add alicia-brain/src/client-tools.js alicia-brain/test/client-tools.test.mjs
git commit -m "feat(copilot): catálogo de client tools con su clasificación read/navigate/write"
```

---

### Task 2: `turnos.js` — el turno que sabe esperar al browser

**Files:**
- Create: `alicia-brain/src/turnos.js`
- Test: `alicia-brain/test/turnos.test.mjs`

**Interfaces:**
- Consumes: nada.
- Produces: `crearRegistroTurnos({ nuevoId? }) → { abrir(userId) → turnId, pedir(turnId, {timeoutMs}) → {callId, promesa}, resolver({turnId, callId, userId, result}) → "ok"|"turno_desconocido"|"no_autorizado"|"call_desconocido", cerrar(turnId), pendientes(turnId) }`

- [ ] **Step 1: Escribir el test que falla**

```js
// alicia-brain/test/turnos.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { crearRegistroTurnos } from "../src/turnos.js";

test("el browser contesta y la promesa resuelve con su resultado", async () => {
  const r = crearRegistroTurnos();
  const turnId = r.abrir("sb");
  const { callId, promesa } = r.pedir(turnId, { timeoutMs: 1000 });
  assert.equal(r.resolver({ turnId, callId, userId: "sb", result: "Cabida abierta" }), "ok");
  assert.equal(await promesa, "Cabida abierta");
  assert.equal(r.pendientes(turnId), 0);
});

test("si el browser no contesta, la espera corta sola y NO tira", async () => {
  const r = crearRegistroTurnos();
  const turnId = r.abrir("sb");
  const { promesa } = r.pedir(turnId, { timeoutMs: 20 });
  const res = await promesa;
  // Resuelve con un texto, no rechaza: este string va como tool_result y el loop
  // sigue. Un reject acá mataría el turno entero por un click que no llegó.
  assert.match(res, /no respondió/i);
  assert.equal(r.pendientes(turnId), 0);
});

test("un turno ajeno no se puede contestar", async () => {
  const r = crearRegistroTurnos();
  const turnId = r.abrir("sb");
  const { callId, promesa } = r.pedir(turnId, { timeoutMs: 50 });
  assert.equal(r.resolver({ turnId, callId, userId: "vd", result: "mío" }), "no_autorizado");
  // y la espera sigue viva: el intruso no la consumió
  assert.equal(r.pendientes(turnId), 1);
  await promesa;   // se limpia sola por timeout
});

test("contestar dos veces el mismo call_id: la segunda no encuentra nada", async () => {
  const r = crearRegistroTurnos();
  const turnId = r.abrir("sb");
  const { callId, promesa } = r.pedir(turnId, { timeoutMs: 100 });
  assert.equal(r.resolver({ turnId, callId, userId: "sb", result: "uno" }), "ok");
  assert.equal(r.resolver({ turnId, callId, userId: "sb", result: "dos" }), "call_desconocido");
  assert.equal(await promesa, "uno");
});

test("un turnId que no existe se distingue de un call_id que no existe", () => {
  const r = crearRegistroTurnos();
  const turnId = r.abrir("sb");
  assert.equal(r.resolver({ turnId: "xxx", callId: "c1", userId: "sb", result: "x" }), "turno_desconocido");
  assert.equal(r.resolver({ turnId, callId: "noexiste", userId: "sb", result: "x" }), "call_desconocido");
});

test("cerrar el turno resuelve lo que quedó esperando y lo saca del registro", async () => {
  const r = crearRegistroTurnos();
  const turnId = r.abrir("sb");
  const { promesa } = r.pedir(turnId, { timeoutMs: 10000 });
  r.cerrar(turnId);
  assert.match(await promesa, /se cerró/i);
  // después de cerrar, el turno ya no existe ni para contestarlo
  assert.equal(r.resolver({ turnId, callId: "c1", userId: "sb", result: "x" }), "turno_desconocido");
});

test("pedir sobre un turno cerrado resuelve al toque, sin dejar un timer colgado", async () => {
  const r = crearRegistroTurnos();
  const turnId = r.abrir("sb");
  r.cerrar(turnId);
  const { promesa } = r.pedir(turnId, { timeoutMs: 10000 });
  assert.match(await promesa, /se cerró/i);
});

test("dos turnos en paralelo no se pisan los call_id", async () => {
  const r = crearRegistroTurnos();
  const a = r.abrir("sb");
  const b = r.abrir("vd");
  const pa = r.pedir(a, { timeoutMs: 100 });
  const pb = r.pedir(b, { timeoutMs: 100 });
  r.resolver({ turnId: b, callId: pb.callId, userId: "vd", result: "de b" });
  r.resolver({ turnId: a, callId: pa.callId, userId: "sb", result: "de a" });
  assert.equal(await pa.promesa, "de a");
  assert.equal(await pb.promesa, "de b");
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd alicia-brain && node --test test/turnos.test.mjs`
Expected: FAIL — `Cannot find module '../src/turnos.js'`

- [ ] **Step 3: Escribir la implementación**

```js
// alicia-brain/src/turnos.js
//
// Dónde vive un turno que está esperando al browser.
//
// El loop del agente es síncrono en su forma: pide una tool, recibe un resultado,
// sigue. Cuando la tool la ejecuta el browser, ese "recibe un resultado" es un
// POST que llega por OTRA request HTTP, minutos después si del otro lado hay un
// humano mirando un diálogo de confirmación. Este registro es el puente: guarda
// el `resolve` de la promesa que el loop está esperando, para que el handler de
// esa otra request lo pueda llamar.
//
// LÍMITE ACEPTADO (spec, "Transporte"): esto vive en memoria. Un deploy de Railway
// corta los turnos en vuelo, y asume UNA sola instancia. Si algún día hay más de
// una, hacen falta sticky sessions. No se resuelve por adelantado.

const nuevoIdPorDefecto = () => Math.random().toString(36).slice(2, 10);

export function crearRegistroTurnos({ nuevoId = nuevoIdPorDefecto } = {}) {
  // turnId → { userId, pendientes: Map<callId, {resolver, timer}> }
  const turnos = new Map();

  function abrir(userId) {
    const turnId = nuevoId();
    turnos.set(turnId, { userId, pendientes: new Map() });
    return turnId;
  }

  function pedir(turnId, { timeoutMs = 60000 } = {}) {
    const callId = nuevoId();
    const turno = turnos.get(turnId);
    // El turno ya se cerró (el cliente se fue mientras el modelo pensaba): no
    // registramos nada ni armamos un timer que nadie va a limpiar.
    if (!turno) return { callId, promesa: Promise.resolve(TEXTO_CERRADO) };

    let resolver;
    const promesa = new Promise((res) => { resolver = res; });
    const timer = setTimeout(() => {
      const p = turnos.get(turnId)?.pendientes;
      if (p?.delete(callId)) resolver(TEXTO_TIMEOUT);
    }, timeoutMs);
    // Un turno esperando no es motivo para que el proceso no pueda salir.
    timer.unref?.();

    turno.pendientes.set(callId, { resolver, timer });
    return { callId, promesa };
  }

  function resolver({ turnId, callId, userId, result }) {
    const turno = turnos.get(turnId);
    if (!turno) return "turno_desconocido";
    // La identidad se chequea ANTES de mirar el call_id: si no, un usuario ajeno
    // podría sondear qué call_id existen por la diferencia entre las dos
    // respuestas.
    if (turno.userId !== userId) return "no_autorizado";
    const pendiente = turno.pendientes.get(callId);
    if (!pendiente) return "call_desconocido";
    turno.pendientes.delete(callId);
    clearTimeout(pendiente.timer);
    pendiente.resolver(result);
    return "ok";
  }

  function cerrar(turnId) {
    const turno = turnos.get(turnId);
    if (!turno) return;
    // Soltar lo que quedó esperando ANTES de borrar el turno: si no, el loop se
    // queda con una promesa que nadie va a resolver nunca y la ruta nunca corre
    // su finally.
    for (const [, p] of turno.pendientes) {
      clearTimeout(p.timer);
      p.resolver(TEXTO_CERRADO);
    }
    turnos.delete(turnId);
  }

  const pendientes = (turnId) => turnos.get(turnId)?.pendientes.size ?? 0;

  return { abrir, pedir, resolver, cerrar, pendientes };
}

// Los dos textos viajan al modelo como tool_result, así que están escritos para
// que entienda qué pasó y pueda seguir con otra cosa en vez de reintentar.
export const TEXTO_TIMEOUT =
  "La pantalla del usuario no respondió a tiempo. No sabemos si la acción llegó a ejecutarse: no la repitas, preguntale al usuario qué ve.";
export const TEXTO_CERRADO =
  "El turno se cerró antes de que la pantalla contestara (el usuario cerró ALICE o se cortó la conexión).";
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd alicia-brain && node --test test/turnos.test.mjs`
Expected: PASS — 8 tests

- [ ] **Step 5: Commit**

```bash
cd alicia-brain && node --test test/*.test.mjs
git add alicia-brain/src/turnos.js alicia-brain/test/turnos.test.mjs
git commit -m "feat(copilot): registro de turnos que esperan una respuesta del browser"
```

---

### Task 3: el loop deriva las client tools al browser

**Files:**
- Modify: `alicia-brain/src/server.js` (imports; ensamblado de tools ~línea 668-681; loop de tools ~línea 828-848)
- Test: `alicia-brain/test/client-tools-loop.test.mjs` (nuevo)

**Interfaces:**
- Consumes: `esClientTool`, `clientToolsPara` (Task 1).
- Produces: `processAliciaMessage(userId, texto, canal, opts)` acepta `opts.clientTools` (array con forma de API) y `opts.ejecutarClientTool(nombre, input) → Promise<string>`.

- [ ] **Step 1: Importar el catálogo**

En `alicia-brain/src/server.js`, junto a los otros imports de `./`:

```js
import { esClientTool, clientToolsPara } from "./client-tools.js";
import { crearRegistroTurnos } from "./turnos.js";
import { efectoDe } from "./client-tools.js";
```

(Unificar en un solo import de `./client-tools.js` con los tres nombres: `esClientTool, clientToolsPara, efectoDe`.)

- [ ] **Step 2: Appendear las client tools DESPUÉS del breakpoint de caché**

Localizar en `processAliciaMessage` el bloque que arma `cachedTools` (hoy termina en `: tools;`) y dejarlo así:

```js
  const cachedTools = tools.length
    ? [...tools.slice(0, -1), { ...tools[tools.length - 1], cache_control: { type: "ephemeral" } }]
    : tools;
  // Las client tools van DESPUÉS del breakpoint, nunca adentro. El enum de
  // erp_action sale del contexto del ERP, así que cambia cada vez que la persona
  // se mueve de módulo: meterlas en el prefijo cacheado invalidaría el caché de
  // tools (que es el bloque grande) en cada navegación. Es la misma disciplina
  // que ya aplica el contexto del ERP en systemBlocks.
  const toolsDelTurno = opts.clientTools?.length
    ? [...cachedTools, ...opts.clientTools]
    : cachedTools;
```

Y en el `cuerpo` de la request, cambiar `tools: cachedTools` por `tools: toolsDelTurno`.

- [ ] **Step 3: Derivar al browser en el loop de tools**

En el `for (const block of toolUseBlocks)`, la rama de ejecución pasa a tener tres casos. Reemplazar el `if (admin && SENSITIVE_ADMIN.has(block.name)) { … } else { … }` por:

```js
        if (esClientTool(block.name)) {
          // La ejecuta el browser. `emitir` ya mandó el tool_start de arriba, así
          // que la traza muestra la tool desde que se pide; el frame que le pide
          // al cliente que la ejecute lo manda quien armó ejecutarClientTool.
          if (!opts.ejecutarClientTool) {
            // Un canal sin manos nunca debería haber recibido estas tools. Si
            // pasa, se lo decimos al modelo en vez de romper: puede seguir con
            // las tools del servidor.
            result = `${block.name} no está disponible en este canal.`;
          } else {
            result = await opts.ejecutarClientTool(block.name, block.input);
          }
        } else if (admin && SENSITIVE_ADMIN.has(block.name)) {
          // acción sensible de un admin → no se ejecuta; se manda a aprobación del CEO
          result = await encolarAprobacion(userId, profile?.name?.split(" ")[0] || userId, block.name, block.input);
          console.log(`🔐 [${userId}] ${block.name} → aprobación CEO`);
        } else {
          result = await executeTool(block.name, block.input, userId);
          console.log(`🔧 [${userId}] ${block.name}:`, JSON.stringify(block.input).slice(0, 100));
        }
```

- [ ] **Step 4: Escribir el test de no-regresión y de derivación**

```js
// alicia-brain/test/client-tools-loop.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { clientToolsPara, esClientTool } from "../src/client-tools.js";

// Estos tests no levantan el server: verifican el CONTRATO que el loop usa para
// decidir. El comportamiento end-to-end del loop lo cubre humo-manos.mjs, que
// corre contra un browser de verdad.

test("una tool del servidor nunca se deriva al browser", () => {
  for (const n of ["gmail_send", "create_task", "radar_query", "use_skill"]) {
    assert.equal(esClientTool(n), false, `${n} se estaría derivando al browser`);
  }
});

test("sin contexto del ERP igual hay manos para navegar y descubrir", () => {
  const nombres = clientToolsPara(null).map(t => t.name);
  assert.ok(nombres.includes("erp_navigate"));
  assert.ok(nombres.includes("erp_list_modules"));
});

test("las client tools tienen la forma exacta que espera la API de tools", () => {
  for (const t of clientToolsPara({ active: { module: "cabida", actions: ["cabida.setParams"] }, others: [] })) {
    assert.deepEqual(Object.keys(t).sort(), ["description", "input_schema", "name"]);
    assert.equal(t.input_schema.type, "object");
    assert.equal(typeof t.input_schema.properties, "object");
  }
});
```

- [ ] **Step 5: Verificar que los canales viejos no cambiaron**

```bash
cd alicia-brain
node --test test/*.test.mjs
# Y el control positivo de que sin clientTools el cuerpo de la request es el de antes:
SANDBOX=1 node -e '
import("./src/server.js").then(() => console.log("server carga sin romper"));
'
```

Expected: la suite entera en verde y el server importa sin errores. Si algún test de `/api/chat` o del webhook cambió de resultado, **parar**: la Global Constraint dice que esos canales son byte-idénticos.

- [ ] **Step 6: Commit**

```bash
git add alicia-brain/src/server.js alicia-brain/test/client-tools-loop.test.mjs
git commit -m "feat(copilot): el loop puede derivar una tool al browser y esperar su respuesta"
```

---

### Task 4: la ruta — `client_tool`, `confirm` y el POST de resultados

**Files:**
- Modify: `alicia-brain/src/server.js` (ruta `POST /api/copilot/turn` ~línea 1156; ruta nueva justo después)

**Interfaces:**
- Consumes: `crearRegistroTurnos` (Task 2), `efectoDe` (Task 1), `sseFrame`/`SSE_HEADERS` (Fase 2).
- Produces: eventos SSE `turn_start {turnId}`, `client_tool {call_id, tool, input, efecto}`, `confirm {call_id, tool, input, efecto}`; ruta `POST /api/copilot/turn/:turnId/result` con body `{call_id, result}`.

- [ ] **Step 1: Crear el registro a nivel de módulo**

Arriba de la ruta (nivel de módulo, no adentro del handler — el registro tiene que sobrevivir entre requests):

```js
// Vive a nivel de módulo a propósito: el POST de resultados llega por OTRA
// request y tiene que encontrar el turno que abrió la primera.
const turnosCopiloto = crearRegistroTurnos();
```

- [ ] **Step 2: Cablear las manos en la ruta del turno**

Reemplazar el cuerpo del `try` de `POST /api/copilot/turn` por:

```js
  const turnId = turnosCopiloto.abrir(act.userId);
  // Primero de todo: el cliente necesita el turnId ANTES de que pueda llegarle
  // cualquier client_tool, porque es a dónde tiene que contestar.
  enviar("turn_start", { turnId });

  try {
    const { text, actions } = await processAliciaMessage(act.userId, message, "copilot", {
      erpContext,
      clientTools: clientToolsPara(erpContext),
      ejecutarClientTool: async (nombre, input) => {
        // El cliente ya se fue: no tiene sentido abrir una espera de 60s para
        // alguien que no está. Se lo decimos al modelo y sigue.
        if (!vivo) return "La pantalla del usuario se desconectó.";
        const efecto = efectoDe(nombre);
        // Una escritura la mira un humano: el techo es el de la paciencia de una
        // persona frente a un diálogo, no el de una llamada de red.
        const timeoutMs = efecto === "write" ? 180000 : 60000;
        const { callId, promesa } = turnosCopiloto.pedir(turnId, { timeoutMs });
        // El evento distinto ES la clasificación: el cliente no decide si pedir
        // confirmación mirando el nombre de la tool, la decide el frame que le
        // llega. Ver client-tools.js.
        enviar(efecto === "write" ? "confirm" : "client_tool", {
          call_id: callId, tool: nombre, input, efecto,
        });
        return await promesa;
      },
    });
    enviar("done", { text, actions });
  } catch (e) {
    console.error("Turn error:", e.message);
    enviar("error", { message: e.message });
  } finally {
    clearInterval(latido);
    // Cerrar el turno ANTES de cerrar el socket: si quedó algo esperando, esto es
    // lo que lo suelta. Sin esto, un turno que muere por excepción deja promesas
    // colgadas y su timer vivo hasta 3 minutos.
    turnosCopiloto.cerrar(turnId);
    if (vivo) res.end();
  }
```

Y agregar al handler de `res.on("close")` el cierre del turno, para que desconectarse suelte las esperas al instante en vez de esperar el timeout:

```js
  res.on("close", () => { vivo = false; clearInterval(latido); turnosCopiloto.cerrar(turnId); });
```

> **Ojo con el orden:** `turnId` tiene que estar declarado **antes** del `res.on("close")`. Mover la creación del turno arriba del `res.writeHead` si hace falta.

- [ ] **Step 3: Escribir la ruta de resultados**

Justo después de la ruta del turno:

```js
// Por acá contesta el browser un `client_tool` o un `confirm`. Es una request
// aparte: la del turno está ocupada streameando.
app.post("/api/copilot/turn/:turnId/result", (req, res) => {
  const act = resolveActingUser({ actorId: req.aliceUser?.id, requestedUserId: req.body.userId });
  if (!act.ok) return res.status(act.error === "no_auth" ? 401 : 403).json({ error: act.error });
  const { call_id, result } = req.body || {};
  if (!call_id) return res.status(400).json({ error: "falta_call_id" });

  const codigo = turnosCopiloto.resolver({
    turnId: req.params.turnId,
    callId: call_id,
    userId: act.userId,
    // El resultado viaja al modelo como texto: si el cliente manda un objeto lo
    // serializamos acá y no en el loop, que no tiene por qué saber de transporte.
    result: typeof result === "string" ? result : JSON.stringify(result ?? null),
  });

  if (codigo === "ok") return res.json({ ok: true });
  // 404 y no 403 para un turno desconocido: un turno que ya cerró (deploy,
  // timeout, el usuario recargó) es el caso normal, no un ataque.
  const status = codigo === "no_autorizado" ? 403 : codigo === "turno_desconocido" ? 404 : 409;
  return res.status(status).json({ error: codigo });
});
```

- [ ] **Step 4: Verificar a mano el round-trip**

```bash
cd alicia-brain
SANDBOX=1 GATE_DEV_OPEN=1 node src/server.js &
sleep 2
# 1. sin auth, la ruta de resultados no filtra si un turno existe o no
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:3001/api/copilot/turn/abc/result \
  -H 'Content-Type: application/json' -d '{"call_id":"x","result":"y"}'
# 2. con el gate abierto, un turno que no existe da 404
curl -s -X POST http://127.0.0.1:3001/api/copilot/turn/noexiste/result \
  -H 'Content-Type: application/json' -d '{"call_id":"x","result":"y"}'
# 3. el turno abre y manda turn_start como PRIMER evento
curl -sN -X POST http://127.0.0.1:3001/api/copilot/turn \
  -H 'Content-Type: application/json' -d '{"message":"hola"}' | head -4
pkill -f "node src/server.js"
```

Expected:
1. `401` (el gate cerrado no deja ni preguntar).
2. `{"error":"turno_desconocido"}` con status 404.
3. La primera línea es `event: turn_start` y la segunda un `data:` con un `turnId`.

> **Recordatorio:** con `SANDBOX=1` el loop no llama al modelo, así que nunca vas a ver un `client_tool` por esta vía. El round-trip completo lo prueba `humo-manos.mjs` (Task 10).

- [ ] **Step 5: Commit**

```bash
cd alicia-brain && node --test test/*.test.mjs
git add alicia-brain/src/server.js
git commit -m "feat(copilot): el turno pide tools al browser y espera por POST /result"
```

---

### Task 5: `acciones.js` — el bus de acciones del ERP

**Files:**
- Create: `files/alice/src/copilot/acciones.js`
- Test: `files/alice/test/copilot-acciones.test.mjs`

**Interfaces:**
- Consumes: nada.
- Produces: `crearBus() → { registrar(nombre, fn) → desregistrar, ejecutar(nombre, args) → Promise<string>, disponibles() → string[] }`

- [ ] **Step 1: Escribir el test que falla**

```js
// files/alice/test/copilot-acciones.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { crearBus } from "../src/copilot/acciones.js";

test("una acción registrada se ejecuta con sus argumentos", async () => {
  const bus = crearBus();
  let visto = null;
  bus.registrar("cabida.setParams", (args) => { visto = args; return "listo"; });
  assert.equal(await bus.ejecutar("cabida.setParams", { pisos: 8 }), "listo");
  assert.deepEqual(visto, { pisos: 8 });
});

test("desregistrar la saca del bus", async () => {
  const bus = crearBus();
  const fuera = bus.registrar("cabida.recalcular", () => "ok");
  fuera();
  assert.deepEqual(bus.disponibles(), []);
  await assert.rejects(() => bus.ejecutar("cabida.recalcular", {}), /no está disponible/);
});

test("una acción que no existe falla con un mensaje que nombra las que sí", async () => {
  const bus = crearBus();
  bus.registrar("cabida.setParams", () => "ok");
  await assert.rejects(() => bus.ejecutar("cabida.borrarTodo", {}), /cabida\.setParams/);
});

test("el valor de retorno siempre llega como texto", async () => {
  const bus = crearBus();
  bus.registrar("x.numero", () => 42);
  bus.registrar("x.objeto", () => ({ margen: 1240000 }));
  bus.registrar("x.nada", () => undefined);
  assert.equal(await bus.ejecutar("x.numero", {}), "42");
  assert.equal(await bus.ejecutar("x.objeto", {}), '{"margen":1240000}');
  assert.match(await bus.ejecutar("x.nada", {}), /hecho/i);
});

test("una acción async se espera", async () => {
  const bus = crearBus();
  bus.registrar("x.lenta", async () => { await new Promise(r => setTimeout(r, 10)); return "tarde pero seguro"; });
  assert.equal(await bus.ejecutar("x.lenta", {}), "tarde pero seguro");
});

test("si la acción tira, el error sube con el nombre de la acción adentro", async () => {
  const bus = crearBus();
  bus.registrar("x.rota", () => { throw new Error("terreno inválido"); });
  await assert.rejects(() => bus.ejecutar("x.rota", {}), /x\.rota.*terreno inválido/);
});

test("registrar dos veces el mismo nombre: gana el último y el desregistrar viejo no pisa al nuevo", async () => {
  // Pasa de verdad: un módulo se re-monta antes de que corra el cleanup del
  // anterior (StrictMode, o navegar rápido). Si el cleanup viejo borrara la
  // entrada nueva, la acción quedaría muerta sin que nada lo avise.
  const bus = crearBus();
  const fueraViejo = bus.registrar("cabida.setParams", () => "viejo");
  bus.registrar("cabida.setParams", () => "nuevo");
  fueraViejo();
  assert.equal(await bus.ejecutar("cabida.setParams", {}), "nuevo");
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd files/alice && node --test test/copilot-acciones.test.mjs`
Expected: FAIL — `Cannot find module '../src/copilot/acciones.js'`

- [ ] **Step 3: Escribir la implementación**

```js
// files/alice/src/copilot/acciones.js
//
// El bus de acciones: lo que cada módulo del ERP deja disponible para que Alicia
// lo ejecute. Sin JSX ni React a propósito, para que `node --test` lo importe
// directo y para que no dependa de dónde esté montado.
//
// El bus NO sabe nada de confirmación. Que una acción se confirme lo decide el
// catálogo del cerebro (client-tools.js) y lo transporta el frame `confirm`.
// Acá llega lo que ya fue confirmado.

export function crearBus() {
  const acciones = new Map();

  function registrar(nombre, fn) {
    acciones.set(nombre, fn);
    return () => {
      // Sólo borrar si sigue siendo LA MISMA función. Cuando un módulo se
      // re-monta, el cleanup del montaje viejo corre DESPUÉS del registro del
      // nuevo: un delete a ciegas dejaría la acción muerta.
      if (acciones.get(nombre) === fn) acciones.delete(nombre);
    };
  }

  async function ejecutar(nombre, args) {
    const fn = acciones.get(nombre);
    if (!fn) {
      const hay = [...acciones.keys()];
      throw new Error(
        `La acción "${nombre}" no está disponible en esta pantalla.` +
        (hay.length ? ` Disponibles: ${hay.join(", ")}.` : " No hay ninguna acción disponible acá.")
      );
    }
    let salida;
    try {
      salida = await fn(args ?? {});
    } catch (e) {
      // El nombre adentro del mensaje: el error termina siendo un tool_result y
      // el modelo tiene que poder decir cuál de las acciones falló.
      throw new Error(`"${nombre}" falló: ${e?.message ?? e}`);
    }
    if (typeof salida === "string") return salida;
    if (salida === undefined || salida === null) return "Hecho.";
    try { return JSON.stringify(salida); }
    catch { return String(salida); }
  }

  const disponibles = () => [...acciones.keys()];

  return { registrar, ejecutar, disponibles };
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd files/alice && node --test test/copilot-acciones.test.mjs`
Expected: PASS — 7 tests

- [ ] **Step 5: Commit**

```bash
cd files/alice && node --test test/*.test.mjs
git add files/alice/src/copilot/acciones.js files/alice/test/copilot-acciones.test.mjs
git commit -m "feat(copilot): bus de acciones del ERP"
```

---

### Task 6: `esperarRegistro` + `manos.js` — la capa genérica

**Files:**
- Modify: `files/alice/src/copilot/ERPContext.jsx`
- Create: `files/alice/src/copilot/manos.js`
- Test: `files/alice/test/copilot-manos.test.mjs`

**Interfaces:**
- Consumes: `crearBus` (Task 5), `buildSnapshot` (Fase 1).
- Produces: `crearManos({ bus, registro, navigate }) → { ejecutar(tool, input) → Promise<string> }`, donde `registro` es `{ modulos(), describir(id), esperarRegistro(id, ms) }`. Y `RUTAS`, el mapa moduleId → `{ space, entidad? }`.

- [ ] **Step 1: Agregar `esperarRegistro`, `describir` y `modulos` al provider**

En `files/alice/src/copilot/ERPContext.jsx`, dentro de `ERPContextProvider`, después de `const ultimoVisto = useRef(null);`:

```js
  // Quién está esperando que tal módulo aparezca: moduleId → Set<resolve>.
  // Existe por erp_navigate: cuando Alicia llama a navigate(), React todavía no
  // re-renderizó y el módulo destino no montó. Sin esto, el erp_read que viene
  // atrás leería un registro vacío y Alicia diría que Cabida no tiene nada.
  const esperas = useRef(new Map());
```

Dentro de `register`, después de `registry.current.set(moduleId, describeFn);`:

```js
    // Despertar a quien estaba esperando este módulo.
    const cola = esperas.current.get(moduleId);
    if (cola) {
      esperas.current.delete(moduleId);
      for (const resolver of cola) resolver(true);
    }
```

Y agregar, junto a `setActive`:

```js
  const esperarRegistro = useCallback((moduleId, timeoutMs = 3000) => {
    if (registry.current.has(moduleId)) return Promise.resolve(true);
    return new Promise((resolver) => {
      const cola = esperas.current.get(moduleId) ?? new Set();
      cola.add(resolver);
      esperas.current.set(moduleId, cola);
      // Que no monte NO es un error del que haya que recuperarse: puede ser un
      // módulo que no existe, o uno que tarda. Resolvemos en false y que la mano
      // lo cuente como lo que es.
      setTimeout(() => {
        const c = esperas.current.get(moduleId);
        if (c?.delete(resolver) && c.size === 0) esperas.current.delete(moduleId);
        resolver(false);
      }, timeoutMs);
    });
  }, []);

  // Los módulos montados ahora mismo, con su descripción. Es lo que leen las
  // manos; el snapshot del turno sigue saliendo por `snapshot()`.
  const modulos = useCallback(() => [...registry.current.keys()], []);
  const describir = useCallback((moduleId) => {
    const fn = registry.current.get(moduleId);
    if (!fn) {
      // El único que sobrevive al desmontaje es `ultimoVisto`: si preguntan por
      // él, devolvemos la foto y avisamos que es una foto.
      if (ultimoVisto.current?.module === moduleId) return { ...ultimoVisto.current, congelado: true };
      return null;
    }
    try { const d = fn(); return d ? { module: moduleId, ...d } : null; }
    catch (e) { console.warn(`[copilot] describe() de "${moduleId}" falló:`, e); return null; }
  }, []);
```

Y sumarlos al `value` memoizado y a sus deps:

```js
  const value = useMemo(
    () => ({ register, setActive, snapshot, esperarRegistro, modulos, describir }),
    [register, setActive, snapshot, esperarRegistro, modulos, describir]
  );
```

Al final del archivo, un hook para que el provider del copiloto lo consuma:

```js
export function useRegistroERP() {
  const ctx = useContext(Ctx);
  // Sin provider las manos degradan a "no hay nada montado" en vez de romper.
  return ctx ?? {
    modulos: () => [],
    describir: () => null,
    esperarRegistro: () => Promise.resolve(false),
  };
}
```

- [ ] **Step 2: Escribir el test de las manos**

```js
// files/alice/test/copilot-manos.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { crearBus } from "../src/copilot/acciones.js";
import { crearManos, RUTAS } from "../src/copilot/manos.js";

const registroFalso = (montados = {}) => {
  const vivos = new Map(Object.entries(montados));
  return {
    vivos,
    modulos: () => [...vivos.keys()],
    describir: (id) => vivos.get(id) ?? null,
    esperarRegistro: async (id) => vivos.has(id),
  };
};

test("erp_list_modules lista TODAS las rutas, no sólo las montadas", async () => {
  // Alicia tiene que poder descubrir un módulo para poder navegarlo. Si sólo
  // listara lo montado, en el chat (donde no hay nada montado) la lista sería
  // vacía y no podría ir a ningún lado.
  const manos = crearManos({ bus: crearBus(), registro: registroFalso(), navigate: () => {} });
  const salida = await manos.ejecutar("erp_list_modules", {});
  assert.match(salida, /cabida/);
  assert.match(salida, /velocity/);
  assert.equal(salida.split("\n").length >= Object.keys(RUTAS).length, true);
});

test("erp_list_modules marca cuál está abierto ahora", async () => {
  const registro = registroFalso({ cabida: { module: "cabida", title: "Cabida · PU01" } });
  const manos = crearManos({ bus: crearBus(), registro, navigate: () => {} });
  const salida = await manos.ejecutar("erp_list_modules", {});
  assert.match(salida, /cabida.*abierto/i);
});

test("erp_read devuelve state y derived del módulo montado", async () => {
  const registro = registroFalso({
    cabida: { module: "cabida", title: "Cabida · PU01", state: { pisos: 8 }, derived: { margen: 1240000 } },
  });
  const manos = crearManos({ bus: crearBus(), registro, navigate: () => {} });
  const salida = await manos.ejecutar("erp_read", { module: "cabida" });
  assert.match(salida, /"pisos":\s*8/);
  assert.match(salida, /1240000/);
});

test("erp_read de un módulo que no está abierto lo dice y sugiere navegar", async () => {
  const manos = crearManos({ bus: crearBus(), registro: registroFalso(), navigate: () => {} });
  const salida = await manos.ejecutar("erp_read", { module: "cabida" });
  assert.match(salida, /no está abierto/i);
  assert.match(salida, /erp_navigate/);
});

test("erp_navigate llama a navigate con el space de la ruta y devuelve el módulo ya leído", async () => {
  const registro = registroFalso();
  const llamadas = [];
  const manos = crearManos({
    bus: crearBus(),
    registro,
    navigate: (space, view) => {
      llamadas.push([space, view]);
      // simula el montaje que dispara el render
      registro.vivos.set("cabida", { module: "cabida", title: "Cabida", state: { pisos: 8 }, derived: {} });
    },
  });
  const salida = await manos.ejecutar("erp_navigate", { module: "cabida" });
  assert.deepEqual(llamadas, [["app-cabida", undefined]]);
  assert.match(salida, /"pisos":\s*8/);
});

test("erp_navigate a un módulo que no existe no navega a ningún lado", async () => {
  let navegado = false;
  const manos = crearManos({ bus: crearBus(), registro: registroFalso(), navigate: () => { navegado = true; } });
  const salida = await manos.ejecutar("erp_navigate", { module: "inventado" });
  assert.equal(navegado, false);
  assert.match(salida, /no existe/i);
  assert.match(salida, /cabida/);   // ofrece la lista
});

test("erp_navigate que navega pero el módulo no monta lo dice sin mentir", async () => {
  const manos = crearManos({ bus: crearBus(), registro: registroFalso(), navigate: () => {} });
  const salida = await manos.ejecutar("erp_navigate", { module: "cabida" });
  assert.match(salida, /abrí|abrió/i);
  assert.match(salida, /no pude leer/i);
});

test("erp_navigate pasa el entityId a los módulos que lo aceptan", async () => {
  const llamadas = [];
  const manos = crearManos({ bus: crearBus(), registro: registroFalso(), navigate: (s, v) => llamadas.push([s, v]) });
  await manos.ejecutar("erp_navigate", { module: "proyecto", entityId: "pu01" });
  assert.deepEqual(llamadas, [["pu01", undefined]]);
});

test("erp_action pasa por el bus", async () => {
  const bus = crearBus();
  let visto = null;
  bus.registrar("cabida.setParams", (args) => { visto = args; return "recalculado"; });
  const manos = crearManos({ bus, registro: registroFalso(), navigate: () => {} });
  assert.equal(await manos.ejecutar("erp_action", { action: "cabida.setParams", args: { pisos: 9 } }), "recalculado");
  assert.deepEqual(visto, { pisos: 9 });
});

test("erp_action de algo no registrado devuelve el error como texto, no lo tira", async () => {
  // Va a terminar como tool_result: si tirara, el turno moriría por una acción
  // mal elegida en vez de dejar que el modelo se corrija.
  const manos = crearManos({ bus: crearBus(), registro: registroFalso(), navigate: () => {} });
  const salida = await manos.ejecutar("erp_action", { action: "cabida.volar", args: {} });
  assert.match(salida, /no está disponible/i);
});

test("una tool desconocida no rompe las manos", async () => {
  const manos = crearManos({ bus: crearBus(), registro: registroFalso(), navigate: () => {} });
  assert.match(await manos.ejecutar("erp_teletransportar", {}), /no existe|desconocida/i);
});
```

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `cd files/alice && node --test test/copilot-manos.test.mjs`
Expected: FAIL — `Cannot find module '../src/copilot/manos.js'`

- [ ] **Step 4: Escribir `manos.js`**

```js
// files/alice/src/copilot/manos.js
//
// La capa 1 del spec: genérica, cubre los módulos del ERP con una tabla de rutas
// y el registro de contexto que ya existe. Sin JSX ni React: las dependencias
// (bus, registro, navigate) entran por parámetro, así se testea sin montar nada.

// moduleId → cómo llegar con navigate(space, view).
//
// El id de la izquierda es el que usa Alicia y el que los módulos declaran en
// useERPContext(). El space de la derecha es el de HyggeOS. Coinciden poco y nada
// —"velocity" vive en "app-velocity", "cabida" en "app-cabida"— y por eso existe
// esta tabla en vez de pasar el nombre derecho a navigate().
export const RUTAS = {
  cabida:     { space: "app-cabida",     nombre: "Cabida" },
  velocity:   { space: "app-velocity",   nombre: "Velocity · Mercado" },
  cotizacion: { space: "app-cotizacion", nombre: "Cotización" },
  mesa:       { space: "app-mesa",       nombre: "Mesa de Trabajo" },
  editor:     { space: "app-editor",     nombre: "Editor de Planos" },
  growth:     { space: "growth",         nombre: "Growth · Terrenos" },
  hq:         { space: "hq",             nombre: "Hygge HQ" },
  proyectos:  { space: "proyectos",      nombre: "Proyectos" },
  bam:        { space: "bam",            nombre: "BAM · Arquitectura" },
  finanzas:   { space: "finanzas",       nombre: "Finanzas" },
  legal:      { space: "legal",          nombre: "Legal" },
  comercial:  { space: "comercial",      nombre: "Comercial" },
  marketing:  { space: "marketing",      nombre: "Marketing" },
  inbox:      { space: "inbox",          nombre: "Smart Capture" },
  mistareas:  { space: "mistareas",      nombre: "Mis tareas" },
  calendario: { space: "calendar-tool",  nombre: "Calendario" },
  wikihygge:  { space: "wikihygge",      nombre: "WikiHygge" },
  // El space de un proyecto es su propio id (dc01, pu01, tg01, l36), así que la
  // ruta la da el entityId y no una constante.
  proyecto:   { porEntidad: true,        nombre: "Un proyecto (pasá entityId: dc01, pu01, tg01, l36)" },
};

// LÍMITE CONOCIDO: `obra` no está acá. ObraTracker vive en una pestaña interna de
// ProjectDashboard (`tab === "obra"`), que no es direccionable por navigate(space,
// view) — `view` ya lo usan las vistas de tareas (list/board/gantt). Alicia puede
// leer obra si vos la tenés abierta, pero no puede abrirla. Hacerla direccionable
// es un cambio en ProjectDashboard y no entra en esta fase.

const TIMEOUT_MONTAJE = 3000;

const describirTexto = (d) => {
  if (!d) return null;
  const partes = [`módulo: ${d.module}`];
  if (d.title) partes.push(`título: ${d.title}`);
  if (d.entity) partes.push(`entidad: ${JSON.stringify(d.entity)}`);
  if (d.state) partes.push(`state (lo que cargó el usuario): ${JSON.stringify(d.state)}`);
  if (d.derived) partes.push(`derived (lo que el módulo calculó): ${JSON.stringify(d.derived)}`);
  if (Array.isArray(d.actions) && d.actions.length) partes.push(`acciones: ${d.actions.join(", ")}`);
  if (d.congelado) partes.push("(foto de cuando saliste del módulo, no el estado en vivo)");
  return partes.join("\n");
};

export function crearManos({ bus, registro, navigate }) {
  function listar() {
    const montados = new Set(registro.modulos());
    return Object.entries(RUTAS)
      .map(([id, r]) => `${id} — ${r.nombre}${montados.has(id) ? " (abierto ahora)" : ""}`)
      .join("\n");
  }

  function leer(moduleId) {
    const id = moduleId || registro.modulos()[0];
    if (!id) return "No hay ningún módulo abierto. Usá erp_navigate para abrir uno.";
    const texto = describirTexto(registro.describir(id));
    if (texto) return texto;
    return `El módulo "${id}" no está abierto, así que no puedo leer su estado. Abrilo con erp_navigate primero.`;
  }

  async function navegar({ module, entityId }) {
    const ruta = RUTAS[module];
    if (!ruta) return `El módulo "${module}" no existe. Estos son los que hay:\n${listar()}`;
    if (ruta.porEntidad && !entityId) return `Para abrir "${module}" necesito el entityId. ${ruta.nombre}`;

    navigate(ruta.porEntidad ? entityId : ruta.space, undefined);

    // Esperar a que monte: sin esto el erp_read que viene atrás lee un registro
    // vacío, porque React todavía no re-renderizó. Ver ERPContext.esperarRegistro.
    const monto = await registro.esperarRegistro(module, TIMEOUT_MONTAJE);
    if (!monto) {
      // No mentir: la pantalla SÍ cambió, lo que no pudimos es leerla. Puede ser
      // un space sin describe() (la mayoría todavía no lo tiene) o uno lento.
      return `Abrí "${module}" en la pantalla del usuario, pero no pude leer su estado (ese módulo todavía no se describe a sí mismo). Preguntale qué ve si necesitás los números.`;
    }
    return `Abrí "${module}". Esto es lo que hay ahora:\n${describirTexto(registro.describir(module))}`;
  }

  async function accionar({ action, args }) {
    try { return await bus.ejecutar(action, args); }
    catch (e) {
      // Esto termina como tool_result. Un throw acá mataría el turno por una
      // acción mal elegida, cuando el modelo puede leer el error y corregirse.
      return e?.message ?? String(e);
    }
  }

  async function ejecutar(tool, input = {}) {
    if (tool === "erp_list_modules") return listar();
    if (tool === "erp_read") return leer(input.module);
    if (tool === "erp_navigate") return navegar(input);
    if (tool === "erp_action") return accionar(input);
    return `La herramienta "${tool}" no existe del lado del ERP.`;
  }

  return { ejecutar };
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `cd files/alice && node --test test/copilot-manos.test.mjs`
Expected: PASS — 11 tests

- [ ] **Step 6: Commit**

```bash
cd files/alice && node --test test/*.test.mjs
git add files/alice/src/copilot/manos.js files/alice/src/copilot/ERPContext.jsx files/alice/test/copilot-manos.test.mjs
git commit -m "feat(copilot): capa genérica de manos — navegar, leer y actuar sobre el ERP"
```

---

### Task 7: `CopilotoProvider` — el turno sube por encima del router

**Files:**
- Create: `files/alice/src/copilot/CopilotoProvider.jsx`
- Modify: `files/alice/src/App.jsx:695-698`

**Interfaces:**
- Consumes: `abrirTurno` (Fase 2), `useCopilotSnapshot`/`useRegistroERP` (Task 6), `crearBus` (Task 5), `crearManos` (Task 6).
- Produces: `CopilotoProvider`, `useCopiloto() → { mensajes, enviando, enviar(texto), confirmacion, responderConfirmacion(ok), abierto, setAbierto, registrarAccion(nombre, fn), registrarNavigate(fn), selectedUserId, setSelectedUserId }`

- [ ] **Step 1: Escribir el provider**

Este componente se lleva **tal cual** el `send` de `AliciaView.jsx:707-866`: el rAF, el techo por inactividad, `text_reset`, el `done` autoritativo, los tres textos de error. No se reescribe nada de eso — se muda. Lo que se **agrega** es el manejo de `turn_start`, `client_tool` y `confirm`.

```jsx
// files/alice/src/copilot/CopilotoProvider.jsx
//
// El turno del copiloto, por encima del router de spaces.
//
// Vivía dentro de AliciaView, y ahí no puede seguir: erp_navigate cambia de space,
// eso desmonta AliciaView, y el turno que estaba esperando la respuesta del
// client_tool se muere con él. Acá arriba sobrevive a cualquier navegación — que
// es justamente lo que el copiloto tiene que hacer.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ALICIA_URL } from "../lib/brain.js";
import { supabase } from "../lib/supabase.js";
import { useCopilotSnapshot, useRegistroERP } from "./ERPContext.jsx";
import { crearBus } from "./acciones.js";
import { crearManos } from "./manos.js";
import { abrirTurno } from "./turn.js";

const Ctx = createContext(null);

export function CopilotoProvider({ children }) {
  const [mensajes, setMensajes] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  // { call_id, tool, input, resolver } — lo que el dock le muestra al usuario.
  const [confirmacion, setConfirmacion] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);

  const takeSnapshot = useCopilotSnapshot();
  const registro = useRegistroERP();

  // El bus y navigate viven en refs: registrar una acción NO puede re-renderizar
  // el ERP entero, igual que en ERPContext.
  const bus = useRef(crearBus()).current;
  const navigateRef = useRef(() => {});
  const registrarNavigate = useCallback((fn) => { navigateRef.current = fn; }, []);
  const registrarAccion = useCallback((nombre, fn) => bus.registrar(nombre, fn), [bus]);

  const manos = useMemo(
    () => crearManos({ bus, registro, navigate: (s, v) => navigateRef.current(s, v) }),
    [bus, registro]
  );

  // Contesta un client_tool/confirm por la ruta de resultados. Es una request
  // aparte: la del turno está ocupada streameando.
  const contestar = useCallback(async (turnId, callId, token, result) => {
    try {
      await fetch(`${ALICIA_URL}/api/copilot/turn/${turnId}/result`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ call_id: callId, result, userId: selectedUserId }),
      });
    } catch (e) {
      // Si el POST falla, el servidor va a cortar solo por timeout. Insistir
      // desde acá sólo agregaría ruido a un turno que ya está perdido.
      console.warn("[copilot] no pude contestar el call:", e?.message ?? e);
    }
  }, [selectedUserId]);

  const enviar = useCallback(async (texto) => {
    if (!texto.trim() || enviando) return;
    const userMsg = { role: "user", content: texto.trim(), ts: Date.now() };
    const base = [...mensajes, userMsg];
    setMensajes(base);
    setEnviando(true);

    let rafId = null;
    let terminado = false;
    let pasos = [];
    // Mismo techo por INACTIVIDAD de la Fase 2: el cerebro late cada 15s, así que
    // 90s sin un solo byte son 6 latidos perdidos — conexión muerta, no turno lento.
    const SILENCIO_MAX = 90000;
    const aborto = new AbortController();
    let porInactividad = false;
    let ocioso = null;
    const rearmarOcioso = () => {
      clearTimeout(ocioso);
      if (terminado) return;
      ocioso = setTimeout(() => { porInactividad = true; aborto.abort(); }, SILENCIO_MAX);
    };
    rearmarOcioso();

    let turnId = null;

    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;

      let acumulado = "";
      let pendiente = false;
      const pintarYa = () => setMensajes([...base, {
        role: "assistant", content: acumulado, pasos, ts: Date.now(), streaming: true,
      }]);
      const pintar = () => {
        if (pendiente || terminado) return;
        pendiente = true;
        rafId = requestAnimationFrame(() => {
          pendiente = false; rafId = null;
          if (terminado) return;
          pintarYa();
        });
      };
      pintarYa();

      let final = null;
      await abrirTurno({
        url: `${ALICIA_URL}/api/copilot/turn`,
        token,
        body: { userId: selectedUserId, message: texto.trim(), erpContext: takeSnapshot() },
        signal: aborto.signal,
        onActividad: rearmarOcioso,
        onEvento: ({ event, data }) => {
          if (event === "turn_start") { turnId = data.turnId; }
          else if (event === "text_delta") { acumulado += data.text ?? ""; pintar(); }
          else if (event === "text_reset") { acumulado = ""; pintar(); }
          else if (event === "tool_start") { pasos = [...pasos, { id: data.id, tool: data.tool, input: data.input, ok: null }]; pintar(); }
          else if (event === "tool_done") { pasos = pasos.map(p => p.id === data.id ? { ...p, ok: data.ok } : p); pintar(); }
          // Una tool que corre en el browser. read y navigate van directo: el
          // catálogo del cerebro ya decidió que no necesitan permiso.
          else if (event === "client_tool") {
            manos.ejecutar(data.tool, data.input)
              .then((r) => contestar(turnId, data.call_id, token, r))
              .catch((e) => contestar(turnId, data.call_id, token, `Falló en la pantalla: ${e?.message ?? e}`));
          }
          // Una escritura. NO se ejecuta hasta que el usuario haga click: la
          // promesa queda guardada en el estado y la resuelve el diálogo.
          else if (event === "confirm") {
            setConfirmacion({
              call_id: data.call_id, tool: data.tool, input: data.input,
              resolver: async (ok) => {
                setConfirmacion(null);
                if (!ok) return contestar(turnId, data.call_id, token, "El usuario NO autorizó esta acción. No la reintentes: preguntale qué prefiere.");
                const r = await manos.ejecutar(data.tool, data.input).catch((e) => `Falló al ejecutar: ${e?.message ?? e}`);
                return contestar(turnId, data.call_id, token, r);
              },
            });
          }
          else if (event === "done") { final = data; }
          else if (event === "error") {
            const e = new Error(data?.message || "el cerebro cortó el turno");
            e.delCerebro = true;
            throw e;
          }
        },
      });

      if (!final) {
        const e = new Error("el stream terminó sin cerrar el turno");
        e.delCerebro = true;
        throw e;
      }
      // SIEMPRE el texto de `done`, nunca el acumulado. Ver Fase 2.
      setMensajes([...base, { role: "assistant", content: final.text ?? "", actions: final.actions || [], pasos, ts: Date.now() }]);
    } catch (err) {
      const contenido = err?.delCerebro
        ? `Corté el turno a mitad (${err.message}). Lo que alcancé a escribir no quedó guardado, así que lo descarté. Probá de nuevo.`
        : porInactividad
          ? "Dejé de recibir respuesta del servidor y corté la espera. Puede que Alicia haya terminado igual y la respuesta esté guardada: recargá antes de volver a preguntar, así no pagás el turno dos veces."
          : `Tuve un problema de conexión con el servidor (${err.message}). Reintentá en un momento.`;
      setMensajes([...base, { role: "assistant", content: contenido, actions: [], pasos, ts: Date.now(), isError: true }]);
    } finally {
      terminado = true;
      clearTimeout(ocioso);
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      // Un diálogo de confirmación que sobrevive al turno es un botón que ya no
      // contesta a nadie: el turno cerró y el call_id no existe más.
      setConfirmacion(null);
      setEnviando(false);
    }
  }, [enviando, mensajes, selectedUserId, takeSnapshot, manos, contestar]);

  const value = useMemo(() => ({
    mensajes, setMensajes, enviando, enviar,
    confirmacion, abierto, setAbierto,
    registrarAccion, registrarNavigate,
    selectedUserId, setSelectedUserId,
  }), [mensajes, enviando, enviar, confirmacion, abierto, registrarAccion, registrarNavigate, selectedUserId]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCopiloto() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCopiloto fuera de CopilotoProvider");
  return ctx;
}

// Registra una acción del módulo en el bus mientras esté montado. Igual que
// useERPContext: la fn va a un ref, así el módulo no necesita envolverla en
// useCallback, y el cleanup del registro devuelve el desregistrar del bus.
export function useAccionERP(nombre, fn) {
  const ctx = useContext(Ctx);
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!ctx) return;            // sin provider (tests, storybook) no hace nada
    return ctx.registrarAccion(nombre, (args) => ref.current(args));
  }, [ctx, nombre]);
}
```

`useEffect` va en el import de React de arriba del archivo, junto a `useContext`, `useRef` y los demás.

- [ ] **Step 2: Montarlo en App.jsx**

```jsx
  return (
    <ERPContextProvider>
      <CopilotoProvider>
        <HyggeOS authUser={user} />
      </CopilotoProvider>
    </ERPContextProvider>
  );
```

Con el import arriba: `import { CopilotoProvider } from "./copilot/CopilotoProvider.jsx";`

**El orden importa:** `CopilotoProvider` usa `useCopilotSnapshot` y `useRegistroERP`, así que tiene que estar **adentro** de `ERPContextProvider`.

- [ ] **Step 3: Verificar que compila y que la app monta**

```bash
cd files/alice
npm run build
npm run dev &
npm run humo          # hq, alicia, app-cabida, app-velocity, growth montan sin pageerror
pkill -f vite
```

Expected: build limpio y `HUMO OK`. Si el humo falla con la app en 2 nodos, es el caso clásico del README: un hook sin importar en el provider nuevo.

- [ ] **Step 4: Commit**

```bash
git add files/alice/src/copilot/CopilotoProvider.jsx files/alice/src/App.jsx
git commit -m "feat(copilot): el turno sube por encima del router y sobrevive a la navegación"
```

---

### Task 8: el dock y el diálogo de confirmación

**Files:**
- Create: `files/alice/src/copilot/Conversacion.jsx`
- Create: `files/alice/src/copilot/DialogoConfirmar.jsx`
- Create: `files/alice/src/copilot/CopilotoDock.jsx`

**Interfaces:**
- Consumes: `useCopiloto` (Task 7), `Markdown`/`TrazaTool` (Fase 2).
- Produces: `<Conversacion ancho="dock"|"full" />`, `<DialogoConfirmar />`, `<CopilotoDock />`

- [ ] **Step 1: `Conversacion.jsx` — las burbujas y el composer, una sola vez**

El dock y el space muestran **la misma conversación**. Si cada uno renderizara la suya, cualquier arreglo habría que hacerlo dos veces y se irían separando.

```jsx
// files/alice/src/copilot/Conversacion.jsx
import { useEffect, useRef, useState } from "react";
import { useCopiloto } from "./CopilotoProvider.jsx";
import Markdown from "./Markdown.jsx";
import TrazaTool from "./TrazaTool.jsx";

const C = { bg: "#EEEBE3", paper: "#F4F1EA", ink: "#0A0B0F", muted: "#6B6863", line: "#D9D5CD", bam: "#A855F7" };

export default function Conversacion({ ancho = "dock" }) {
  const { mensajes, enviando, enviar } = useCopiloto();
  const [texto, setTexto] = useState("");
  const finRef = useRef(null);
  const scrollRef = useRef(null);

  // Auto-scroll sólo si ya estabas abajo: si subiste a leer algo, el stream no
  // te arrastra. Es el mismo criterio que cubre humo-stream.mjs.
  useEffect(() => {
    const cont = scrollRef.current;
    if (!cont) return;
    const alFondo = cont.scrollHeight - cont.scrollTop - cont.clientHeight < 120;
    if (alFondo) finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  const mandar = () => { enviar(texto); setTexto(""); };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: C.paper }}>
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: ancho === "full" ? "24px 15%" : 16 }}>
        {mensajes.map((m, i) => (
          <div key={i} style={{ marginBottom: 16 }}>
            {m.role === "user" ? (
              // El markdown del usuario NO se renderiza: lo que escribiste se ve
              // como lo escribiste.
              <div style={{ whiteSpace: "pre-wrap", fontSize: 13, color: C.ink, backgroundColor: C.bg, padding: "8px 12px", borderRadius: 2 }}>{m.content}</div>
            ) : (
              <div>
                {m.pasos?.length > 0 && m.pasos.map(p => <TrazaTool key={p.id} tool={p.tool} ok={p.ok} input={p.input} />)}
                <div style={{ fontSize: 13, color: m.isError ? "#A85B5B" : C.ink }}>
                  <Markdown texto={m.content} />
                  {m.streaming && <span style={{ opacity: 0.5 }}>▍</span>}
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={finRef} />
      </div>
      <div style={{ borderTop: `1px solid ${C.line}`, padding: 12, display: "flex", gap: 8 }}>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); mandar(); } }}
          placeholder={enviando ? "Alicia está trabajando…" : "Preguntale algo a Alicia…"}
          rows={2}
          style={{ flex: 1, resize: "none", fontSize: 13, fontFamily: "inherit", padding: 8, border: `1px solid ${C.line}`, borderRadius: 2, backgroundColor: C.bg, color: C.ink }}
        />
        <button onClick={mandar} disabled={enviando || !texto.trim()}
          style={{ padding: "0 16px", fontSize: 12, fontWeight: 600, border: "none", borderRadius: 2, cursor: enviando ? "default" : "pointer", backgroundColor: C.bam, color: "#fff", opacity: enviando || !texto.trim() ? 0.4 : 1 }}>
          {enviando ? "…" : "Enviar"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `DialogoConfirmar.jsx` — qué va a hacer, exactamente**

```jsx
// files/alice/src/copilot/DialogoConfirmar.jsx
//
// La confirmación de una escritura. Muestra la acción y sus argumentos CRUDOS a
// propósito: el punto de confirmar es ver qué se va a ejecutar, no leer un
// resumen que el modelo escribió.
import { useCopiloto } from "./CopilotoProvider.jsx";

const C = { paper: "#F4F1EA", ink: "#0A0B0F", muted: "#6B6863", line: "#D9D5CD", verde: "#5F8A6A", rojo: "#A85B5B" };

export default function DialogoConfirmar() {
  const { confirmacion } = useCopiloto();
  if (!confirmacion) return null;

  const { tool, input, resolver } = confirmacion;
  const accion = tool === "erp_action" ? input?.action : tool;
  const args = tool === "erp_action" ? input?.args : input;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, backgroundColor: "rgba(10,11,15,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 460, maxWidth: "92vw", backgroundColor: C.paper, border: `1px solid ${C.line}`, borderRadius: 3, padding: 20 }}>
        <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, marginBottom: 10 }}>
          Alicia quiere modificar algo
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 12 }}>{accion}</div>
        <pre style={{ fontSize: 11, backgroundColor: "#EEEBE3", border: `1px solid ${C.line}`, borderRadius: 2, padding: 10, maxHeight: 220, overflow: "auto", whiteSpace: "pre-wrap", color: C.ink }}>
          {JSON.stringify(args ?? {}, null, 2)}
        </pre>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button onClick={() => resolver(false)}
            style={{ padding: "8px 16px", fontSize: 12, fontWeight: 600, border: `1px solid ${C.line}`, background: "transparent", borderRadius: 2, cursor: "pointer", color: C.rojo }}>
            No
          </button>
          <button onClick={() => resolver(true)} autoFocus
            style={{ padding: "8px 16px", fontSize: 12, fontWeight: 600, border: "none", borderRadius: 2, cursor: "pointer", backgroundColor: C.verde, color: "#fff" }}>
            Ejecutar
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `CopilotoDock.jsx` — el panel que viaja con vos**

```jsx
// files/alice/src/copilot/CopilotoDock.jsx
//
// El copiloto encima de cualquier módulo. Montado en la raíz de HyggeOS, fuera
// del switch de spaces: por eso sobrevive a que Alicia navegue.
import { useCopiloto } from "./CopilotoProvider.jsx";
import Conversacion from "./Conversacion.jsx";
import DialogoConfirmar from "./DialogoConfirmar.jsx";

const C = { paper: "#F4F1EA", ink: "#0A0B0F", muted: "#6B6863", line: "#D9D5CD", bam: "#A855F7" };

export default function CopilotoDock({ ocultar = false }) {
  const { abierto, setAbierto, enviando } = useCopiloto();

  // En el space `alicia` la conversación ya se ve a lo ancho: el dock al lado
  // sería la misma cosa dos veces en pantalla.
  if (ocultar) return <DialogoConfirmar />;

  if (!abierto) {
    return (
      <>
        <button onClick={() => setAbierto(true)} title="Alicia"
          style={{ position: "fixed", right: 20, bottom: 20, zIndex: 40, width: 48, height: 48, borderRadius: 24, border: "none", cursor: "pointer", backgroundColor: C.bam, color: "#fff", fontSize: 18, boxShadow: "0 2px 12px rgba(10,11,15,0.2)" }}>
          {enviando ? "…" : "A"}
        </button>
        <DialogoConfirmar />
      </>
    );
  }

  return (
    <>
      <aside style={{ position: "fixed", right: 0, top: 0, bottom: 0, zIndex: 40, width: 380, maxWidth: "94vw", borderLeft: `1px solid ${C.line}`, backgroundColor: C.paper, display: "flex", flexDirection: "column" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${C.line}` }}>
          <span style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted }}>Alicia · copiloto</span>
          <button onClick={() => setAbierto(false)}
            style={{ border: "none", background: "transparent", cursor: "pointer", color: C.muted, fontSize: 16 }}>×</button>
        </header>
        <div style={{ flex: 1, minHeight: 0 }}><Conversacion ancho="dock" /></div>
      </aside>
      <DialogoConfirmar />
    </>
  );
}
```

- [ ] **Step 4: Verificar el build**

```bash
cd files/alice && npm run build
```

Expected: build limpio. (El dock todavía no está montado en ningún lado — eso es Task 9.)

- [ ] **Step 5: Commit**

```bash
git add files/alice/src/copilot/Conversacion.jsx files/alice/src/copilot/DialogoConfirmar.jsx files/alice/src/copilot/CopilotoDock.jsx
git commit -m "feat(copilot): dock persistente, conversación compartida y diálogo de confirmación"
```

---

### Task 9: cablear HyggeOS y vaciar el turno de AliciaView

**Files:**
- Modify: `files/alice/src/HyggeOS.jsx` (montaje del dock ~línea 16501; registro de `navigate`; el space `alicia` ~línea 16369)
- Modify: `files/alice/src/modules/alicia/AliciaView.jsx`

**Interfaces:**
- Consumes: `useCopiloto`, `CopilotoDock`, `Conversacion` (Tasks 7-8).
- Produces: el dock montado y `navigate` registrado.

- [ ] **Step 1: Registrar `navigate` en el copiloto**

En `HyggeOS.jsx`, después de la definición de `navigate` (~línea 16107):

```js
  const { registrarNavigate } = useCopiloto();
  // Las manos del copiloto navegan con la MISMA función que el sidebar. Si algún
  // día navigate cambia de forma, erp_navigate cambia con ella sin que nadie se
  // acuerde de venir hasta acá.
  useEffect(() => { registrarNavigate(navigate); }, [registrarNavigate, navigate]);
```

Con el import: `import { useCopiloto } from "./copilot/CopilotoProvider.jsx";`

- [ ] **Step 2: Montar el dock**

En el `return` de HyggeOS, dentro de `<ConfirmProvider>` y después del `</div>` del layout principal (hermano del contenido, no hijo del switch de spaces):

```jsx
      <CopilotoDock ocultar={currentSpace === "alicia"} />
```

Con el import: `import CopilotoDock from "./copilot/CopilotoDock.jsx";`

- [ ] **Step 3: El space `alicia` renderiza la misma conversación**

Reemplazar el contenido del `if (currentSpace === "alicia")` por el render ancho. `AliciaView` sigue existiendo para lo que no es el turno (el selector de "ver como" del CEO, el gate de API key, la voz), pero la conversación sale del provider:

```jsx
    if (currentSpace === "alicia") {
      return (
        <ModuleErrorBoundary key="alicia" moduleName="Alicia" onExit={() => navigate("hq")}>
          <AliciaView currentUser={currentUser} tasks={tasks} addTask={addTask} updateTask={updateTask}
            allSpaces={allSpaces} knowledgeLinks={knowledgeLinks} createEvent={createEvent} />
        </ModuleErrorBoundary>
      );
    }
```

(Si ya estaba envuelto así, no tocar nada en este paso.)

- [ ] **Step 4: Sacarle el turno a AliciaView**

En `files/alice/src/modules/alicia/AliciaView.jsx`, agregar los imports:

```jsx
import { useCopiloto } from "../../copilot/CopilotoProvider.jsx";
import Conversacion from "../../copilot/Conversacion.jsx";
```

y sacar los que quedan sin uso: `abrirTurno`, `Markdown` y `TrazaTool` se mudaron a `Conversacion`. **`PanelContexto` se queda en `AliciaView`** — es el panel lateral de la Fase 2 y la vista ancha tiene lugar para él; el dock (380px) no, y meterlo ahí sería pelearle el ancho a la conversación. `useCopilotSnapshot` también se queda si el panel lo usa. Después:

1. **Borrar** el `send` completo (líneas ~707-866) y los estados que sólo servían para él: `messages`, `sending`, `input`, `hiloFallo`. **No borrar** `speak`, `voiceEnabled`, `selectedVoice`, `listening` ni `executeActions`.
2. **Reemplazar** el render del hilo y del composer por `<Conversacion ancho="full" />`.
3. **Leer** del provider lo que antes era estado local:

```jsx
  const { mensajes, setMensajes, enviando, selectedUserId, setSelectedUserId } = useCopiloto();
```

4. El efecto que trae el hilo de `/api/copilot/history` **se queda en AliciaView** y escribe en `setMensajes` del provider. Es el único lugar donde tiene sentido: el hilo se carga al abrir el space, no en cada render del dock.

5. `executeActions(actions, profiles)` y `speak(texto)` se disparaban al cerrar el turno, y ahora el turno cierra en el provider. Engancharlos con un efecto sobre el último mensaje:

```jsx
  // El turno ya no cierra acá, así que las consecuencias del último mensaje se
  // enganchan mirando el hilo. `ultimoProcesado` evita que un re-render las
  // vuelva a disparar: hablar dos veces la misma respuesta es lo que pasaba
  // cuando esto dependía sólo de mensajes.length.
  const ultimoProcesado = useRef(0);
  useEffect(() => {
    const ult = mensajes[mensajes.length - 1];
    if (!ult || ult.role !== "assistant" || ult.streaming || ult.isError) return;
    if (ult.ts === ultimoProcesado.current) return;
    ultimoProcesado.current = ult.ts;
    if (ult.actions?.length) executeActions(ult.actions, profiles);
    speak(ult.content);
  }, [mensajes, executeActions, profiles, speak]);
```

- [ ] **Step 5: Verificar en un browser de verdad**

```bash
cd files/alice
npm run build
npm run dev &
npm run humo
npm run humo:burbuja
pkill -f vite
```

Expected: `HUMO OK` y `BURBUJA OK`. `humo:burbuja` siembra el hilo en `localStorage` — si el provider dejó de leer ese cache, este humo falla con los contadores en cero y hay que decidir explícitamente: o el provider hidrata desde `localStorage` al montar (y entonces el humo pasa), o se actualiza el humo porque el cache optimista se eliminó a propósito. **No dejarlo a medias.**

- [ ] **Step 6: Commit**

```bash
git add files/alice/src/HyggeOS.jsx files/alice/src/modules/alicia/AliciaView.jsx
git commit -m "feat(copilot): el dock viaja con vos y el space comparte la conversación"
```

---

### Task 10: el cerebro falso habla manos, y el humo del round-trip

**Files:**
- Modify: `files/alice/scripts/cerebro-falso.mjs`
- Create: `files/alice/scripts/humo-manos.mjs`
- Modify: `files/alice/package.json` (script `humo:manos`)
- Modify: `files/alice/scripts/README.md`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: `npm run humo:manos` → `MANOS OK` / `MANOS FALLA`.

Esto es lo único que prueba el contrato completo: el servidor pide, el browser ejecuta de verdad contra el ERP de verdad, y contesta. Ningún test unitario lo cubre, igual que pasaba con los tres invariantes de la Fase 2.

- [ ] **Step 1: Agregar los guiones al cerebro falso**

En `scripts/cerebro-falso.mjs`, dentro del handler de `/api/copilot/turn`, **antes** de `res.writeHead`, guardar los resultados que van llegando:

```js
// Los resultados que contestó el browser, para que el humo los pueda auditar.
const resultados = [];
```
(a nivel de módulo, junto a `let turno = 0;`, y resetearlo en `/reset`.)

Agregar la ruta de resultados:

```js
  if (/^\/api\/copilot\/turn\/[^/]+\/result$/.test(url.pathname)) {
    let cuerpo = "";
    for await (const c of req) cuerpo += c;
    const { call_id, result } = JSON.parse(cuerpo || "{}");
    resultados.push({ call_id, result });
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true }));
  }
  if (url.pathname === "/resultados") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(resultados));
  }
```

Y dos guiones nuevos (seguir la numeración que haya quedado; acá van como 5 y 6):

```js
    if (turno === 5) {
      // Manos que leen: turn_start, un client_tool de navegación, y el done usa
      // lo que el browser contestó. Si el cliente no contestara, esto cuelga y
      // el humo falla por timeout — que es exactamente lo que queremos detectar.
      send("turn_start", { turnId: "t-manos" });
      for (const t of ["Voy ", "a ", "abrir ", "Cabida"]) { send("text_delta", { text: t }); await sleep(15); }
      send("tool_start", { id: "n1", tool: "erp_navigate", input: { module: "cabida" } });
      send("client_tool", { call_id: "c-nav", tool: "erp_navigate", input: { module: "cabida" }, efecto: "navigate" });
      // Esperar a que el browser conteste de verdad, con techo.
      const t0 = Date.now();
      while (!resultados.some(r => r.call_id === "c-nav") && Date.now() - t0 < 8000) await sleep(50);
      const r = resultados.find(x => x.call_id === "c-nav");
      send("tool_done", { id: "n1", tool: "erp_navigate", ok: !!r });
      send("text_reset", {});
      send("done", { text: r ? `El browser contestó: ${String(r.result).slice(0, 80)}` : "NADIE CONTESTÓ", actions: [] });
      return res.end();
    }
    if (turno === 6) {
      // Manos que escriben: el frame es `confirm`, no `client_tool`. El browser
      // NO tiene que ejecutar nada hasta que alguien haga click.
      send("turn_start", { turnId: "t-confirm" });
      send("tool_start", { id: "w1", tool: "erp_action", input: { action: "humo.escribir", args: { v: 1 } } });
      send("confirm", { call_id: "c-write", tool: "erp_action", input: { action: "humo.escribir", args: { v: 1 } }, efecto: "write" });
      const t0 = Date.now();
      while (!resultados.some(r => r.call_id === "c-write") && Date.now() - t0 < 15000) await sleep(50);
      const r = resultados.find(x => x.call_id === "c-write");
      send("tool_done", { id: "w1", tool: "erp_action", ok: !!r });
      send("done", { text: r ? `Resultado: ${String(r.result).slice(0, 120)}` : "NADIE CONTESTÓ", actions: [] });
      return res.end();
    }
```

- [ ] **Step 2: Escribir `humo-manos.mjs`**

```js
// files/alice/scripts/humo-manos.mjs
//
// El round-trip de las manos, en un Chromium de verdad contra el cerebro falso.
// Tres cosas que ningún test unitario puede cubrir:
//   1. Un client_tool de navegación CAMBIA la pantalla y contesta con lo que leyó.
//   2. El chat SOBREVIVE a esa navegación (es el motivo de todo el dock).
//   3. Un `confirm` NO ejecuta nada hasta el click, y "No" tampoco ejecuta.
import { chromium } from "../../../alicia-brain/node_modules/playwright/index.js";

const BASE = process.argv[2] || "http://localhost:5173";
const FALSO = process.env.CEREBRO_FALSO_URL || "http://localhost:3999";
const fallas = [];
const check = (ok, que) => { console.log(`${ok ? "✔" : "✘"} ${que}`); if (!ok) fallas.push(que); };

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (e) => fallas.push(`pageerror: ${e.message}`));

// El contador de turnos es estado del proceso: sin esto, una segunda corrida
// arranca en el guion equivocado.
await fetch(`${FALSO}/reset`);
// Los guiones de manos son el 5 y el 6: quemar los cuatro primeros.
for (let i = 0; i < 4; i++) await fetch(`${FALSO}/api/copilot/turn`, { method: "POST", body: "{}" }).catch(() => {});

await page.goto(`${BASE}/#alicia`, { waitUntil: "networkidle" });

// ── 1 · navegación ───────────────────────────────────────────────────────────
await page.fill("textarea", "abrime cabida");
await page.keyboard.press("Enter");
await page.waitForTimeout(6000);

const cuerpo = await page.textContent("body");
check(/El browser contestó/.test(cuerpo), "el cerebro recibió la respuesta del client_tool");
check(/cabida/i.test(cuerpo), "el módulo Cabida quedó en pantalla");
// LA aserción de esta fase: el hilo sigue ahí después de que Alicia navegó.
check(/abrime cabida/.test(cuerpo), "el chat sobrevivió a la navegación");

// ── 2 · confirmación ─────────────────────────────────────────────────────────
await page.fill("textarea", "cambiá los pisos a 9");
await page.keyboard.press("Enter");
await page.waitForTimeout(2500);

check(await page.isVisible("text=Alicia quiere modificar algo"), "el diálogo de confirmación apareció");
const antes = await (await fetch(`${FALSO}/resultados`)).json();
check(!antes.some(r => r.call_id === "c-write"), "sin click, NADA se ejecutó ni se contestó");

await page.click("text=Ejecutar");
await page.waitForTimeout(3000);
const despues = await (await fetch(`${FALSO}/resultados`)).json();
check(despues.some(r => r.call_id === "c-write"), "después del click, el browser contestó");

await browser.close();
console.log(fallas.length ? `\nMANOS FALLA\n- ${fallas.join("\n- ")}` : "\nMANOS OK");
process.exit(fallas.length ? 1 : 0);
```

- [ ] **Step 3: Registrar el script y una acción de humo**

En `files/alice/package.json`, junto a los otros humos:

```json
    "humo:manos": "node scripts/humo-manos.mjs",
```

En `files/alice/src/modules/cabida/CabidaView.jsx`, importar el hook:

```jsx
import { useAccionERP } from "../../copilot/CopilotoProvider.jsx";
```

Y registrar las dos acciones **justo debajo** del `useERPContext("cabida", …)` que ya está ahí (línea ~269). Los parámetros de Cabida son `useState` sueltos —`terreno`, `areaLibre`, `pisos`, `areaDpto`, `precioM2`, `costoM2`, cada uno con su setter (líneas 136-207)—, así que la acción mapea nombre → setter. No hace falta una acción `recalcular`: el `useMemo` de la línea 255 recalcula solo cuando cambia cualquiera de esos estados.

```jsx
  // Las manos sobre Cabida. El módulo decide qué acepta: Alicia propone, Cabida
  // valida. Los valores entran por los MISMOS setters que usa el formulario —
  // si entraran por otro lado, la cabida recalcularía distinto de lo que muestra.
  useAccionERP("cabida.setParams", (args) => {
    const setters = {
      terreno: setTerreno, areaLibre: setAreaLibre, pisos: setPisos,
      areaDpto: setAreaDpto, precioM2: setPrecioM2, costoM2: setCostoM2,
    };
    const aplicados = {};
    for (const [k, v] of Object.entries(args ?? {})) {
      const set = setters[k];
      if (!set) continue;
      const n = Number(v);
      // Un NaN acá se propaga a los 19 escalares del cálculo y toda la cabida
      // sale NaN sin un solo error en consola.
      if (!Number.isFinite(n)) continue;
      set(n);
      aplicados[k] = n;
    }
    if (!Object.keys(aplicados).length) {
      return `No reconocí ningún parámetro numérico. Acepto: ${Object.keys(setters).join(", ")}.`;
    }
    return `Apliqué ${JSON.stringify(aplicados)}. La cabida se recalcula sola.`;
  });

  // Acción de humo: existe para que humo-manos.mjs pueda verificar el camino
  // completo de una escritura confirmada contra una acción REAL del bus, sin
  // que el humo tenga que tocar los números de una cabida.
  useAccionERP("humo.escribir", (args) => `humo.escribir recibió ${JSON.stringify(args)}`);
```

Y cambiar el `actions` del `useERPContext` de Cabida (línea ~283), que hoy dice literalmente `actions: []` con el comentario *"se llenan en la Fase 3, cuando Alicia tenga manos"*. Es de ahí que sale el enum del catálogo:

```jsx
    actions: ["cabida.setParams"],
```

> `humo.escribir` **no** va en `actions`: si entrara, el enum de `erp_action` se lo ofrecería al modelo en producción. El humo llega por un `confirm` que emite el cerebro falso, que no filtra por catálogo.

- [ ] **Step 4: Correr el humo**

```bash
cd files/alice
npm run cerebro-falso &
VITE_ALICIA_URL=http://localhost:3999 npm run dev &
npm run humo:manos
pkill -f vite; pkill -f cerebro-falso
```

Expected: `MANOS OK`.

**Acordate de matar los dos procesos.** Un vite viejo con `VITE_ALICIA_URL` apuntando al falso deja el copiloto hablando con un servidor de mentira sin que nada lo avise.

- [ ] **Step 5: Documentar el humo nuevo**

En `scripts/README.md`, agregar la fila a la tabla de scripts y una sección corta con lo que cubre (los tres checks de arriba) y lo que no (no prueba el cerebro real: el `confirm` lo emite el falso, no el catálogo).

- [ ] **Step 6: Commit**

```bash
git add files/alice/scripts/ files/alice/package.json files/alice/src/modules/cabida/CabidaView.jsx
git commit -m "test(copilot): el round-trip de las manos contra un browser de verdad"
```

---

## Verificación de cierre

- [ ] `cd alicia-brain && node --test test/*.test.mjs` → PASS (los 313 de hoy + 9 de `client-tools` + 8 de `turnos` + 3 del loop = **333**)
- [ ] `cd files/alice && node --test test/*.test.mjs` → PASS (los 263 de hoy + 7 de `acciones` + 11 de `manos` = **281**)
- [ ] `cd files/alice && npm run build` → limpio
- [ ] `npm run humo` → `HUMO OK` · `npm run humo:burbuja` → `BURBUJA OK` · `npm run humo:stream` → `STREAM OK` (las tres siguen pasando: la Fase 2 no se rompió)
- [ ] `npm run humo:manos` → `MANOS OK`
- [ ] `POST /api/copilot/turn/:id/result`: turno inexistente → **404** (verificable con curl). El **401** sin auth y el **403** de turno ajeno NO son reproducibles con `GATE_DEV_OPEN=1` (cualquier curl local autentica como CEO) ni sin él (da 503 `panel_locked`): se verifican por lectura —`resolveActingUser` corre antes de cualquier lookup de turno— y por los tests de `turnos.js`, que cubren `no_autorizado`.
- [ ] `turn_start` es el **primer** evento del stream, antes de cualquier `text_delta`
- [ ] Con `SANDBOX=1`, `/api/chat` y `/api/embodied` devuelven 200 y su respuesta no cambió: **WhatsApp y el teléfono nunca ven una client tool**
- [ ] En el ERP: pedirle a Alicia que abra Cabida **cambia la pantalla y el chat sigue abierto con el hilo entero**
- [ ] Pedirle que cambie un parámetro abre el diálogo, y **"No" no ejecuta nada**
- [ ] `turn_usage` sigue registrando una fila por turno, con `channel = "copilot"`
