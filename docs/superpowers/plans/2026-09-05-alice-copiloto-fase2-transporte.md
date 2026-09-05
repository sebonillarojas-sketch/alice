# Alice Copiloto · Fase 2 · Transporte: el chat que se siente vivo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que hablarle a Alicia desde el ERP se sienta como Claude app: el texto aparece mientras piensa, se ve qué herramienta está usando, la respuesta se renderiza como markdown, y el space deja de compartir la pantalla con un panel de perfiles que no tiene nada que ver.

**Architecture:** `processAliciaMessage` gana un callback opcional `opts.onEvent` y pasa de `messages.create` a `messages.stream` + `finalMessage()`. Su firma de retorno no cambia, así que WhatsApp y el teléfono siguen igual byte por byte. Una ruta nueva `POST /api/copilot/turn` envuelve ese callback en un stream SSE. Del lado del ERP, un parser puro de frames SSE alimenta a `AliciaView`, que pinta el texto incremental, la traza de herramientas y markdown.

**Tech Stack:** Node 22 ESM · Express 4 · `@anthropic-ai/sdk` **0.30.1** (verificado: `messages.stream()`, `finalMessage()`, `on()` y `abort()` existen) · `node --test` · React 18 + Vite · `react-markdown` + `remark-gfm` (dependencia nueva)

**Spec:** `docs/superpowers/specs/2026-09-01-alice-copiloto-erp-design.md`

## Global Constraints

- **La firma de retorno de `processAliciaMessage` no cambia.** Sigue devolviendo `{ text, actions }`. Sin `onEvent`, el comportamiento debe ser byte-idéntico al actual: WhatsApp (`/webhook/twilio`), el teléfono (`/api/embodied`) y `/api/chat` no se tocan.
- **`onEvent` nunca puede tumbar el turno.** Cada llamada va envuelta en try/catch: si el cliente se desconectó, el turno igual tiene que terminar de guardar el mensaje, las memorias y la persona.
- **El userId NUNCA sale del body.** Sale de `req.aliceUser` vía `resolveActingUser`, igual que `/api/chat` y `/api/copilot/history`.
- **`MAX_ITERATIONS`: 16 sólo para el canal `copilot`; 8 para todos los demás.** WhatsApp se queda en 8.
- **Esta fase NO incluye** `client_tool`, `confirm`, `component` ni `audio_chunk`. Son las Fases 3 y 5. No dejar medias implementaciones de esos eventos.
- **El contexto del ERP sigue entrando después del breakpoint de caché** — no tocar `erp-context.js` ni el orden de `systemBlocks`.
- Comentarios y mensajes de commit en **castellano**.

## Decisión de diseño: `text_reset`

El loop puede producir texto en varias iteraciones ("déjame ver el radar…" y después la respuesta real), pero el cerebro **sólo guarda la última** (`finalText` se pisa en cada vuelta). Si el cliente acumulara todos los deltas, la pantalla terminaría mostrando algo distinto de lo que quedó en la base y de lo que verá al recargar.

Por eso el transporte emite **`text_reset`** cuando una iteración empieza a producir texto y ya había texto de una iteración anterior. El cliente vacía la burbuja al recibirlo. El usuario ve la narración intermedia, la traza explica qué pasó, y lo que queda en pantalla coincide con lo que quedó guardado.

---

## File Structure

**Cerebro (`alicia-brain/`)**

| Archivo | Responsabilidad |
|---|---|
| `src/sse.js` · **nuevo** | `sseFrame(event, data)` y `SSE_HEADERS`. Puro, sin Express. |
| `src/server.js` · modificar | `opts.onEvent` + streaming en el loop; `MAX_ITERATIONS` por canal; ruta `POST /api/copilot/turn`. |
| `test/sse.test.mjs` · **nuevo** | |

**ERP (`files/alice/`)**

| Archivo | Responsabilidad |
|---|---|
| `src/copilot/sseParser.js` · **nuevo** | `crearParserSSE(onEvento)` — acumula chunks y emite eventos completos. Puro, sin DOM. |
| `src/copilot/turn.js` · **nuevo** | `abrirTurno({url, token, body, onEvento, signal})` — fetch + ReadableStream + parser. |
| `src/copilot/Markdown.jsx` · **nuevo** | Envoltorio de `react-markdown` con los tokens visuales del ERP. |
| `src/copilot/TrazaTool.jsx` · **nuevo** | Fila colapsable de una herramienta. |
| `src/copilot/PanelContexto.jsx` · **nuevo** | Panel lateral: qué está viendo Alicia ahora. |
| `src/modules/alicia/AliciaView.jsx` · modificar | Consume el turno SSE; markdown; traza; sale el panel de perfiles, entra el de contexto. |
| `test/copilot-sse-parser.test.mjs` · **nuevo** | |

---

### Task 1: `sse.js` — formatear frames SSE

**Files:**
- Create: `alicia-brain/src/sse.js`
- Test: `alicia-brain/test/sse.test.mjs`

**Interfaces:**
- Consumes: nada.
- Produces: `SSE_HEADERS` (objeto de headers), `sseFrame(event, data) -> string`.

- [ ] **Step 1: Escribir el test que falla**

Crear `alicia-brain/test/sse.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { sseFrame, SSE_HEADERS } from "../src/sse.js";

test("un frame lleva event, data y termina en línea en blanco", () => {
  const f = sseFrame("text_delta", { text: "hola" });
  assert.equal(f, 'event: text_delta\ndata: {"text":"hola"}\n\n');
});

test("los saltos de línea del contenido NO rompen el frame", () => {
  // Un \n crudo dentro de data: cortaría el frame a la mitad. Va escapado por JSON.
  const f = sseFrame("text_delta", { text: "línea uno\nlínea dos" });
  assert.equal(f.split("\n").length, 4);              // data + fin de frame
  assert.ok(f.includes('\\n'));                        // escapado, no crudo
  assert.equal(JSON.parse(f.split("data: ")[1].trim()).text, "línea uno\nlínea dos");
});

test("acepta un payload vacío", () => {
  assert.equal(sseFrame("done", {}), "event: done\ndata: {}\n\n");
});

test("los acentos y emojis sobreviven", () => {
  const f = sseFrame("text_delta", { text: "cabida · 42 dptos 🏗" });
  assert.equal(JSON.parse(f.split("data: ")[1].trim()).text, "cabida · 42 dptos 🏗");
});

test("SSE_HEADERS desactiva el buffering de los proxies", () => {
  assert.equal(SSE_HEADERS["Content-Type"], "text/event-stream");
  assert.equal(SSE_HEADERS["Cache-Control"], "no-cache, no-transform");
  assert.equal(SSE_HEADERS["Connection"], "keep-alive");
  assert.equal(SSE_HEADERS["X-Accel-Buffering"], "no");
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd alicia-brain && node --test test/sse.test.mjs`
Expected: FAIL — `Cannot find module '../src/sse.js'`

- [ ] **Step 3: Escribir la implementación**

Crear `alicia-brain/src/sse.js`:

```js
// Formato de los frames del transporte del copiloto.
//
// Un frame SSE termina en línea en blanco, así que cualquier \n crudo dentro de
// `data:` lo parte a la mitad y el cliente recibe basura. Serializar con JSON.stringify
// escapa los saltos y de paso resuelve acentos y emojis, que en el ERP hay de sobra.

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  // `no-transform` es lo que impide que un proxy comprima y buffere el stream:
  // sin eso el texto llega en un solo golpe al final y se pierde todo el punto.
  "Cache-Control": "no-cache, no-transform",
  "Connection": "keep-alive",
  "X-Accel-Buffering": "no",
};

export function sseFrame(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data ?? {})}\n\n`;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd alicia-brain && node --test test/sse.test.mjs`
Expected: PASS (5 tests)

- [ ] **Step 5: Correr la suite completa y commitear**

Run: `cd alicia-brain && npm test`
Expected: PASS

```bash
git add alicia-brain/src/sse.js alicia-brain/test/sse.test.mjs
git commit -m "feat(copilot): frames SSE para el transporte del turno"
```

---

### Task 2: `onEvent` y streaming en el loop del agente

La tarea más delicada del plan: toca el loop que atiende WhatsApp, el teléfono y el ERP a la vez. La regla que la hace segura es que **sin `onEvent` nada cambia**.

**Files:**
- Modify: `alicia-brain/src/server.js` (firma y cuerpo de `processAliciaMessage`, ~626-806)

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `processAliciaMessage(userId, userText, channel, opts)` donde `opts.onEvent?: (evento) => void` recibe:
  - `{ type: "text_delta", text: string }`
  - `{ type: "text_reset" }`
  - `{ type: "tool_start", id: string, tool: string, input: object }`
  - `{ type: "tool_done", id: string, tool: string, ok: boolean }`
  El retorno sigue siendo `{ text, actions }`.

- [ ] **Step 1: Emisor seguro y tope de iteraciones por canal**

En `alicia-brain/src/server.js`, dentro de `processAliciaMessage`, justo antes de `const MAX_ITERATIONS = 8;` (línea ~696), agregar:

```js
  // El cliente puede irse en cualquier momento (cerró la pestaña, se cayó la red).
  // Si emitir tirara, el turno moriría acá y no se guardarían ni el mensaje ni las
  // memorias. Emitir es best-effort SIEMPRE.
  const emitir = (evento) => {
    try { opts.onEvent?.(evento); } catch (e) { console.error("onEvent falló:", e.message); }
  };
  // Un turno del copiloto encadena más pasos que uno de WhatsApp: navega, lee,
  // calcula. WhatsApp se queda en 8 a propósito.
  let yaHuboTexto = false;
```

y reemplazar la línea `const MAX_ITERATIONS = 8;` por:

```js
  const MAX_ITERATIONS = channel === "copilot" ? 16 : 8;
```

- [ ] **Step 2: Pasar de `create` a `stream` en las dos llamadas**

Reemplazar la llamada principal dentro del `try` (línea ~711):

```js
      resp = await anthropic.messages.create({
```

por:

```js
      // .stream() en vez de .create(): el cuerpo del pedido es idéntico, pero permite
      // ir emitiendo el texto mientras llega. finalMessage() devuelve exactamente el
      // mismo objeto que create() devolvía, así que el resto del loop no se entera.
      const st = anthropic.messages.stream({
```

y **después del objeto de parámetros** (justo después de `messages: loopMessages,\n      });`) agregar:

```js
      if (opts.onEvent) {
        st.on("text", (delta) => {
          if (!yaHuboTexto) { yaHuboTexto = true; }
          emitir({ type: "text_delta", text: delta });
        });
      }
      resp = await st.finalMessage();
```

Hacer lo mismo con la llamada del fallback a Sonnet (línea ~727): `anthropic.messages.create({` → `const stFallback = anthropic.messages.stream({`, y después del objeto:

```js
      // Mismo manejo que el stream principal, yaHuboTexto incluido: si el fallback
      // produce texto y no lo marcamos, la iteración siguiente no emite text_reset
      // y la burbuja queda con dos respuestas pegadas.
      if (opts.onEvent) stFallback.on("text", (delta) => { yaHuboTexto = true; emitir({ type: "text_delta", text: delta }); });
      resp = await stFallback.finalMessage();
```

- [ ] **Step 3: Emitir `text_reset` entre iteraciones**

El loop pisa `finalText` en cada vuelta, así que el cliente tiene que vaciar la burbuja cuando arranca una iteración nueva con texto. Justo **antes** de la llamada al modelo (al principio del `while`, después de `iterations++`), agregar:

```js
    // Segunda vuelta o más: lo que el cliente ya pintó pertenece a la iteración
    // anterior, que el cerebro va a descartar (sólo se guarda el último finalText).
    // Sin este reset la pantalla y la base terminan diciendo cosas distintas.
    if (iterations > 1 && yaHuboTexto) { emitir({ type: "text_reset" }); yaHuboTexto = false; }
```

- [ ] **Step 4: Emitir la traza de herramientas**

Dentro del `for (const block of toolUseBlocks)`, al principio del cuerpo del `try` agregar:

```js
        emitir({ type: "tool_start", id: block.id, tool: block.name, input: block.input });
```

y después del `toolResults.push(...)` agregar:

```js
        emitir({ type: "tool_done", id: block.id, tool: block.name, ok: true });
```

En el `catch (e)` de ese mismo bloque, después de `console.error`, agregar:

```js
        emitir({ type: "tool_done", id: block.id, tool: block.name, ok: false });
```

- [ ] **Step 5: Verificar que los canales viejos no cambiaron**

Run:
```bash
cd alicia-brain && node --check src/server.js && npm test
```
Expected: `node --check` sin salida, y **176/176 PASS** — ninguna suite existente puede ponerse en rojo, porque sin `onEvent` el comportamiento es el mismo.

Después, la verificación de que el pipeline sigue vivo:
```bash
SANDBOX=1 GATE_DEV_OPEN=1 PANEL_PASSWORD=test npm start &
sleep 3
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:3001/api/chat \
  -H 'Content-Type: application/json' -d '{"message":"hola"}'
```
Expected: `200`. Cortar con `kill %1`.

- [ ] **Step 6: Commit**

```bash
git add alicia-brain/src/server.js
git commit -m "feat(copilot): el loop puede emitir eventos y streamea el texto

Sin opts.onEvent el comportamiento es identico al anterior: WhatsApp, el
telefono y /api/chat no se enteran. MAX_ITERATIONS sube a 16 solo para el
canal copilot."
```

---

### Task 3: `POST /api/copilot/turn` — la ruta SSE

**Files:**
- Modify: `alicia-brain/src/server.js` (import + ruta nueva, junto a `/api/copilot/history`)

**Interfaces:**
- Consumes: `sseFrame`, `SSE_HEADERS` (Task 1); `opts.onEvent` (Task 2); `resolveActingUser` de `identity.js`.
- Produces: `POST /api/copilot/turn` con body `{ message, erpContext?, userId? }` → `text/event-stream` con los eventos `text_delta`, `text_reset`, `tool_start`, `tool_done`, `done`, `error`.

- [ ] **Step 1: Importar los helpers**

En `alicia-brain/src/server.js`, junto a los otros imports del copiloto:

```js
import { sseFrame, SSE_HEADERS } from "./sse.js";
```

- [ ] **Step 2: Escribir la ruta**

Agregar justo después del bloque de `GET /api/copilot/history`:

```js
// El turno del copiloto. A diferencia de /api/chat, que espera callado hasta 20
// segundos y devuelve un JSON, acá el cliente ve el texto aparecer y qué herramienta
// se está usando. Mismo cerebro, mismo loop: lo único que cambia es el transporte.
app.post("/api/copilot/turn", async (req, res) => {
  const act = resolveActingUser({ actorId: req.aliceUser?.id, requestedUserId: req.body.userId });
  if (!act.ok) return res.status(act.error === "no_auth" ? 401 : 403).json({ error: act.error });
  const { message, erpContext } = req.body || {};
  if (!message) return res.status(400).json({ error: "Falta message" });

  res.writeHead(200, SSE_HEADERS);
  res.flushHeaders?.();

  // Los proxies cortan conexiones ociosas, y un turno con varias tools puede pasar
  // 30s sin emitir nada. Un comentario SSE (línea que arranca con ":") mantiene viva
  // la conexión sin que el cliente tenga que interpretarlo.
  const latido = setInterval(() => { try { res.write(": ping\n\n"); } catch {} }, 15000);
  let vivo = true;
  req.on("close", () => { vivo = false; clearInterval(latido); });

  const enviar = (evento, data) => {
    if (!vivo) return;
    try { res.write(sseFrame(evento, data)); } catch { vivo = false; }
  };

  try {
    const { text, actions } = await processAliciaMessage(act.userId, message, "copilot", {
      erpContext,
      onEvent: (e) => {
        const { type, ...resto } = e;
        enviar(type, resto);
      },
    });
    enviar("done", { text, actions });
  } catch (e) {
    console.error("Turn error:", e.message);
    enviar("error", { message: e.message });
  } finally {
    clearInterval(latido);
    if (vivo) res.end();
  }
});
```

- [ ] **Step 3: Verificar el stream a mano**

Run:
```bash
cd alicia-brain && SANDBOX=1 GATE_DEV_OPEN=1 PANEL_PASSWORD=test npm start &
sleep 3
curl -sN -X POST http://127.0.0.1:3001/api/copilot/turn \
  -H 'Content-Type: application/json' \
  -d '{"message":"hola","erpContext":{"active":{"module":"cabida","title":"Cabida · PU01","state":{"terreno":640},"derived":{"dptos":42}},"others":[],"dropped":0}}'
echo
# sin auth y con Host ajeno → 401, sin abrir stream
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:3001/api/copilot/turn \
  -H 'Host: aliceai.bam.pe' -H 'Content-Type: application/json' -d '{"message":"hola"}'
```
Expected: la primera imprime al menos un frame `event: done` con `data:` que contiene `[SANDBOX] respuesta simulada` (en sandbox no hay deltas porque no se llama al modelo — eso es correcto y hay que decirlo en el reporte). La segunda imprime `401`. Cortar con `kill %1`.

- [ ] **Step 4: Correr la suite y commitear**

Run: `cd alicia-brain && npm test`
Expected: PASS

```bash
git add alicia-brain/src/server.js
git commit -m "feat(copilot): POST /api/copilot/turn con SSE, latido y corte en desconexion"
```

---

### Task 4: `sseParser.js` — parsear frames del lado del ERP

`EventSource` no puede hacer POST ni mandar headers, así que el ERP lee el stream con `fetch` + `ReadableStream` y parsea los frames a mano. Es donde viven los bugs de este tipo de transporte, y es puro, así que se testea entero.

**Files:**
- Create: `files/alice/src/copilot/sseParser.js`
- Test: `files/alice/test/copilot-sse-parser.test.mjs`

**Interfaces:**
- Consumes: nada.
- Produces: `crearParserSSE(onEvento) -> { alimentar(chunkTexto) }`, donde `onEvento` recibe `{ event: string, data: object }`.

- [ ] **Step 1: Escribir el test que falla**

Crear `files/alice/test/copilot-sse-parser.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { crearParserSSE } from "../src/copilot/sseParser.js";

function recolectar() {
  const vistos = [];
  return { vistos, parser: crearParserSSE((e) => vistos.push(e)) };
}

test("parsea un frame completo", () => {
  const { vistos, parser } = recolectar();
  parser.alimentar('event: text_delta\ndata: {"text":"hola"}\n\n');
  assert.deepEqual(vistos, [{ event: "text_delta", data: { text: "hola" } }]);
});

test("parsea varios frames en un solo chunk", () => {
  const { vistos, parser } = recolectar();
  parser.alimentar('event: a\ndata: {"n":1}\n\nevent: b\ndata: {"n":2}\n\n');
  assert.equal(vistos.length, 2);
  assert.equal(vistos[1].data.n, 2);
});

test("un frame partido entre dos chunks se reensambla", () => {
  const { vistos, parser } = recolectar();
  parser.alimentar('event: text_delta\nda');
  assert.equal(vistos.length, 0, "no debe emitir un frame incompleto");
  parser.alimentar('ta: {"text":"hola"}\n\n');
  assert.deepEqual(vistos, [{ event: "text_delta", data: { text: "hola" } }]);
});

test("un frame partido en el medio del JSON se reensambla", () => {
  const { vistos, parser } = recolectar();
  parser.alimentar('event: done\ndata: {"text":"la cabi');
  parser.alimentar('da da 42 dptos"}\n\n');
  assert.equal(vistos[0].data.text, "la cabida da 42 dptos");
});

test("ignora los comentarios de latido", () => {
  const { vistos, parser } = recolectar();
  parser.alimentar(': ping\n\nevent: done\ndata: {}\n\n');
  assert.equal(vistos.length, 1);
  assert.equal(vistos[0].event, "done");
});

test("un data mal formado no rompe el stream: se saltea y sigue", () => {
  const { vistos, parser } = recolectar();
  parser.alimentar('event: roto\ndata: {no soy json\n\nevent: done\ndata: {}\n\n');
  assert.deepEqual(vistos.map(v => v.event), ["done"]);
});

test("un frame sin event se ignora", () => {
  const { vistos, parser } = recolectar();
  parser.alimentar('data: {"text":"huérfano"}\n\nevent: done\ndata: {}\n\n');
  assert.deepEqual(vistos.map(v => v.event), ["done"]);
});

test("los acentos y emojis sobreviven", () => {
  const { vistos, parser } = recolectar();
  parser.alimentar('event: text_delta\ndata: {"text":"cabida · 42 dptos 🏗"}\n\n');
  assert.equal(vistos[0].data.text, "cabida · 42 dptos 🏗");
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd files/alice && node --test test/copilot-sse-parser.test.mjs`
Expected: FAIL — `Cannot find module '../src/copilot/sseParser.js'`

- [ ] **Step 3: Escribir la implementación**

Crear `files/alice/src/copilot/sseParser.js`:

```js
// Parser de frames SSE. EventSource no sirve acá: no hace POST ni manda headers,
// y el turno necesita las dos cosas. Así que leemos el body con fetch + ReadableStream
// y parseamos a mano.
//
// Lo único que importa de verdad: un chunk de red NO es un frame. Un frame puede
// llegar partido en dos chunks, y dos frames pueden llegar en uno solo. El buffer
// es lo que hace que eso no se note.

export function crearParserSSE(onEvento) {
  let buffer = "";

  function alimentar(texto) {
    buffer += texto;
    let corte;
    while ((corte = buffer.indexOf("\n\n")) !== -1) {
      const bloque = buffer.slice(0, corte);
      buffer = buffer.slice(corte + 2);

      let event = null;
      let dataCruda = "";
      for (const linea of bloque.split("\n")) {
        if (linea.startsWith(":")) continue;              // comentario (el latido)
        if (linea.startsWith("event: ")) event = linea.slice(7).trim();
        else if (linea.startsWith("data: ")) dataCruda += linea.slice(6);
      }
      if (!event) continue;                                // frame sin evento: no es nuestro
      let data;
      try { data = JSON.parse(dataCruda || "{}"); }
      catch { continue; }                                  // un frame roto no puede matar al resto
      onEvento({ event, data });
    }
  }

  return { alimentar };
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd files/alice && node --test test/copilot-sse-parser.test.mjs`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add files/alice/src/copilot/sseParser.js files/alice/test/copilot-sse-parser.test.mjs
git commit -m "feat(copilot): parser de frames SSE, con reensamblado entre chunks"
```

---

### Task 5: `turn.js` — abrir el turno desde el ERP

**Files:**
- Create: `files/alice/src/copilot/turn.js`

**Interfaces:**
- Consumes: `crearParserSSE` (Task 4).
- Produces: `abrirTurno({ url, token, body, onEvento, signal }) -> Promise<void>` — resuelve cuando el stream termina; rechaza si el HTTP falla.

- [ ] **Step 1: Escribir la implementación**

Crear `files/alice/src/copilot/turn.js`:

```js
// Abre un turno del copiloto y va entregando los eventos a medida que llegan.
import { crearParserSSE } from "./sseParser.js";

export async function abrirTurno({ url, token, body, onEvento, signal }) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });
  // Los errores de auth (401/403) llegan como JSON, no como stream: el servidor
  // los responde antes de escribir los headers de SSE.
  if (!res.ok) {
    const detalle = await res.json().catch(() => ({}));
    throw new Error(detalle.error || `turno ${res.status}`);
  }
  if (!res.body) throw new Error("el navegador no expone el body del stream");

  const parser = crearParserSSE(onEvento);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      // stream:true es obligatorio: un carácter multibyte (un acento, un emoji)
      // puede quedar partido entre dos chunks y sin esto se decodifica como basura.
      parser.alimentar(decoder.decode(value, { stream: true }));
    }
  } finally {
    reader.releaseLock?.();
  }
}
```

- [ ] **Step 2: Verificar que compila**

Run: `cd files/alice && npm run build`
Expected: build exitoso (el módulo todavía no lo importa nadie, pero debe parsear).

- [ ] **Step 3: Commit**

```bash
git add files/alice/src/copilot/turn.js
git commit -m "feat(copilot): abrir el turno SSE desde el ERP con fetch + ReadableStream"
```

---

### Task 6: Markdown y traza de herramientas

**Files:**
- Create: `files/alice/src/copilot/Markdown.jsx`
- Create: `files/alice/src/copilot/TrazaTool.jsx`
- Modify: `files/alice/package.json`

**Interfaces:**
- Consumes: nada de tareas previas.
- Produces: `<Markdown texto={string} />` y `<TrazaTool tool={string} ok={boolean|null} input={object} />`.

- [ ] **Step 1: Agregar la dependencia**

Run: `cd files/alice && npm install react-markdown remark-gfm`
Expected: instala sin errores de peer dependency con React 18.

- [ ] **Step 2: El envoltorio de markdown**

Crear `files/alice/src/copilot/Markdown.jsx`:

```jsx
// Alicia responde en markdown (listas, tablas, negritas, code). Hasta ahora el ERP
// lo pintaba crudo, con los asteriscos a la vista.
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const C = { ink: "#0A0B0F", muted: "#6B6863", line: "#D9D5CD", surface: "#E5E1D6" };

export default function Markdown({ texto }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p style={{ margin: "0 0 8px" }}>{children}</p>,
        ul: ({ children }) => <ul style={{ margin: "0 0 8px", paddingLeft: 18 }}>{children}</ul>,
        ol: ({ children }) => <ol style={{ margin: "0 0 8px", paddingLeft: 18 }}>{children}</ol>,
        li: ({ children }) => <li style={{ margin: "2px 0" }}>{children}</li>,
        // OJO: react-markdown v9+ (instala la 10.x) YA NO pasa la prop `inline`.
        // Los bloques cercados llegan como <pre><code class="language-x">, el código
        // inline como <code> sin clase. Por eso se estilan por separado.
        pre: ({ children }) => (
          <pre style={{ background: C.surface, padding: 10, borderRadius: 2, overflowX: "auto", fontSize: 12, margin: "0 0 8px" }}>{children}</pre>
        ),
        code: ({ className, children }) => (
          <code
            className={className}
            style={className ? undefined : { background: C.surface, padding: "1px 4px", borderRadius: 2, fontSize: "0.92em" }}
          >{children}</code>
        ),
        // Las tablas del ERP pueden ser anchas: scrollean en su propio contenedor
        // en vez de estirar la burbuja.
        table: ({ children }) => (
          <div style={{ overflowX: "auto", margin: "0 0 8px" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 12 }}>{children}</table>
          </div>
        ),
        th: ({ children }) => <th style={{ border: `1px solid ${C.line}`, padding: "3px 6px", textAlign: "left", color: C.muted, fontWeight: 700 }}>{children}</th>,
        td: ({ children }) => <td style={{ border: `1px solid ${C.line}`, padding: "3px 6px" }}>{children}</td>,
        a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" style={{ color: C.ink, textDecoration: "underline" }}>{children}</a>,
      }}
    >
      {texto || ""}
    </ReactMarkdown>
  );
}
```

- [ ] **Step 3: La fila de traza**

Crear `files/alice/src/copilot/TrazaTool.jsx`:

```jsx
// Una herramienta en el hilo. Dice en castellano qué está haciendo; el JSON queda
// detrás del colapso. La traza es para confiar, no para depurar.
import { useState } from "react";

const C = { muted: "#6B6863", line: "#D9D5CD", surface: "#E5E1D6", brick: "#A85B5B" };

// Nombre de tool → frase legible. Lo que no esté acá cae al nombre crudo, que es
// mejor que inventar una traducción equivocada.
const FRASES = {
  radar_query: "consultando el radar",
  radar_refresh: "refrescando el radar",
  get_tasks: "revisando tus tareas",
  create_task: "creando una tarea",
  update_task: "actualizando una tarea",
  calendar_list: "mirando tu agenda",
  calendar_create: "agendando",
  check_availability: "viendo disponibilidad del equipo",
  gmail_search: "buscando en tu correo",
  dropbox_search: "buscando en Dropbox",
  dropbox_read: "leyendo un archivo",
  web_search: "buscando en la web",
  search_knowledge: "buscando en el conocimiento",
  search_resources: "buscando en recursos",
  read_conversation: "releyendo la conversación",
};

export default function TrazaTool({ tool, ok, input }) {
  const [abierto, setAbierto] = useState(false);
  const frase = FRASES[tool] || tool;
  const estado = ok === null ? "…" : ok ? "✓" : "✕";
  return (
    <div style={{ margin: "4px 0" }}>
      <button
        onClick={() => setAbierto(v => !v)}
        style={{
          background: "none", border: "none", padding: 0, cursor: "pointer",
          fontSize: 11, color: ok === false ? C.brick : C.muted, display: "flex", gap: 6,
        }}
      >
        <span>{estado}</span><span>{frase}</span>
      </button>
      {abierto && (
        <pre style={{
          margin: "4px 0 0", padding: 8, background: C.surface, border: `1px solid ${C.line}`,
          borderRadius: 2, fontSize: 10, overflowX: "auto", color: C.muted,
        }}>{JSON.stringify(input ?? {}, null, 2)}</pre>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verificar el build**

Run: `cd files/alice && npm run build && node --test test/*.test.mjs`
Expected: build exitoso, 24/24 tests (16 previos + 8 del parser).

- [ ] **Step 5: Commit**

```bash
git add files/alice/package.json files/alice/package-lock.json files/alice/src/copilot/Markdown.jsx files/alice/src/copilot/TrazaTool.jsx
git commit -m "feat(copilot): markdown en las respuestas y traza legible de herramientas"
```

---

### Task 7: `AliciaView` consume el turno en streaming

**Files:**
- Modify: `files/alice/src/modules/alicia/AliciaView.jsx` (la función `send`, ~795-880, y el render de las burbujas)

**Interfaces:**
- Consumes: `abrirTurno` (Task 5), `Markdown` y `TrazaTool` (Task 6), `useCopilotSnapshot` (ya existente).
- Produces: nada para tareas posteriores.

- [ ] **Step 1: Importar lo nuevo**

En `files/alice/src/modules/alicia/AliciaView.jsx`:

```jsx
import { abrirTurno } from "../../copilot/turn.js";
import Markdown from "../../copilot/Markdown.jsx";
import TrazaTool from "../../copilot/TrazaTool.jsx";
```

- [ ] **Step 2: Reemplazar el cuerpo de `send`**

Dentro de `send`, reemplazar el bloque que hace `fetch(\`${BRAIN_URL}/api/chat\`, …)` y todo su manejo de respuesta por:

```jsx
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;

      // Burbuja del assistant que se va llenando en vivo. `pasos` es la traza.
      let acumulado = "";
      let pasos = [];
      // Un setState por token re-renderiza AliciaView entero (1189 líneas) decenas de
      // veces por segundo. Agrupamos los repintados en el frame: se ve igual de fluido
      // y el navegador no se ahoga.
      let pendiente = false;
      const pintarYa = () => setMessages([...newHistory, {
        role: "assistant", content: acumulado, pasos, ts: Date.now(), streaming: true,
      }]);
      const pintar = () => {
        if (pendiente) return;
        pendiente = true;
        requestAnimationFrame(() => { pendiente = false; pintarYa(); });
      };
      pintarYa();

      let final = null;
      await abrirTurno({
        url: `${BRAIN_URL}/api/copilot/turn`,
        token,
        body: { userId: selectedUserId, message: text.trim(), erpContext: takeSnapshot() },
        onEvento: ({ event, data }) => {
          if (event === "text_delta") { acumulado += data.text; pintar(); }
          // El cerebro sólo guarda el texto de la última iteración: lo que el cliente
          // pintó en una vuelta anterior hay que descartarlo o la pantalla miente.
          else if (event === "text_reset") { acumulado = ""; pintar(); }
          else if (event === "tool_start") { pasos = [...pasos, { id: data.id, tool: data.tool, input: data.input, ok: null }]; pintar(); }
          else if (event === "tool_done") { pasos = pasos.map(p => p.id === data.id ? { ...p, ok: data.ok } : p); pintar(); }
          else if (event === "done") { final = data; }
          else if (event === "error") { throw new Error(data.message); }
        },
      });

      const responseText = final?.text ?? acumulado;
      const actions = final?.actions || [];
      const aliciaMsg = { role: "assistant", content: responseText, actions, pasos, ts: Date.now() };
      const finalHistory = [...newHistory, aliciaMsg];
      setMessages(finalHistory);
      saveChat(selectedUserId, finalHistory);
      executeActions(actions, profiles);
      speak(responseText);
```

Mantener el `catch` existente tal cual: ya pinta un mensaje de error en el hilo.

- [ ] **Step 3: Renderizar markdown y la traza**

En el render de cada burbuja, para los mensajes del assistant, reemplazar la impresión directa de `m.content` por:

```jsx
{m.role === "assistant" ? (
  <>
    {m.pasos?.length > 0 && (
      <div style={{ marginBottom: 6 }}>
        {m.pasos.map(p => <TrazaTool key={p.id} tool={p.tool} ok={p.ok} input={p.input} />)}
      </div>
    )}
    <Markdown texto={m.content} />
    {m.streaming && <span style={{ opacity: 0.4 }}>▍</span>}
  </>
) : m.content}
```

Los mensajes del usuario siguen en texto plano: no hay razón para interpretar markdown en lo que escribe la persona.

- [ ] **Step 4: Verificar**

Run: `cd files/alice && npm run build && node --test test/*.test.mjs`
Expected: build limpio, 24/24.

Después, contra el cerebro local:
```bash
cd alicia-brain && SANDBOX=1 GATE_DEV_OPEN=1 PANEL_PASSWORD=test npm start &
cd files/alice && npm run dev
```
Con `VITE_ALICIA_URL=http://localhost:3001` en `.env.development`, abrir el space y mandar un mensaje: debe aparecer la respuesta de sandbox sin errores en consola. **Con SANDBOX no hay deltas** (no se llama al modelo), así que el streaming visual no se puede comprobar acá — decirlo en el reporte en vez de darlo por verificado.

- [ ] **Step 5: Commit**

```bash
git add files/alice/src/modules/alicia/AliciaView.jsx
git commit -m "feat(copilot): el space consume el turno en streaming, con traza y markdown"
```

---

### Task 8: El space queda 100% copiloto

Última tarea, e independiente de las anteriores: si se corta el plan acá, lo de arriba ya está entregado y funcionando.

**Files:**
- Create: `files/alice/src/copilot/PanelContexto.jsx`
- Modify: `files/alice/src/modules/alicia/AliciaView.jsx` (~610, ~933-1000)

**Interfaces:**
- Consumes: `useCopilotSnapshot` (existente).
- Produces: `<PanelContexto />`.

- [ ] **Step 1: El panel de contexto**

Crear `files/alice/src/copilot/PanelContexto.jsx`:

```jsx
// Lo que Alicia está viendo ahora mismo. Existe para que el copiloto sea creíble:
// si no se ve qué contexto tiene, cada respuesta parece adivinación.
import { useCopilotSnapshot } from "./ERPContext.jsx";

const C = { paper: "#F4F1EA", ink: "#0A0B0F", muted: "#6B6863", line: "#D9D5CD", lineSoft: "#E5E1D6" };
const Eyebrow = ({ children }) => (
  <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, fontWeight: 700 }}>{children}</div>
);

export default function PanelContexto() {
  const takeSnapshot = useCopilotSnapshot();
  const { active, others } = takeSnapshot();

  return (
    <div style={{ padding: 16, borderLeft: `1px solid ${C.line}`, backgroundColor: C.paper, height: "100%", overflowY: "auto" }}>
      <Eyebrow>Contexto</Eyebrow>
      {!active ? (
        <div style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>
          Alicia no tiene ningún módulo a la vista. Abrí Cabida, Velocity o Growth y volvé.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 13, color: C.ink, fontWeight: 600, marginTop: 8 }}>{active.title || active.module}</div>
          {active.entity?.id && (
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{active.entity.type} {active.entity.id}</div>
          )}
          {active.derived && Object.keys(active.derived).length > 0 && (
            <div style={{ marginTop: 12 }}>
              <Eyebrow>Ya calculado</Eyebrow>
              <div style={{ marginTop: 6 }}>
                {Object.entries(active.derived).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "2px 0", borderBottom: `1px solid ${C.lineSoft}` }}>
                    <span style={{ color: C.muted }}>{k}</span>
                    <span style={{ color: C.ink }}>{typeof v === "number" ? v.toLocaleString("es-PE") : String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      {others?.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Eyebrow>También abiertos</Eyebrow>
          <div style={{ marginTop: 6 }}>
            {others.map(o => (
              <div key={o.module} style={{ fontSize: 11, color: C.muted, padding: "2px 0" }}>{o.title || o.module}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Sacar el panel de perfiles**

En `AliciaView.jsx`, borrar el bloque del panel lateral izquierdo de perfiles (el `<div>` que usa `profilesOpen`, `sidebarProfiles` y su botón de colapsar, ~941-1000), junto con el estado `profilesOpen` (~610) y la constante `sidebarProfiles` (~933) si no quedan otros usos.

**No borrar** el objeto `profiles` ni `handleSaveProfile`: siguen alimentando el contexto que se le manda a Alicia y el "ver como" del CEO. Verificar con `grep -n "profiles" src/modules/alicia/AliciaView.jsx` antes de borrar cualquier cosa, y dejar en el reporte qué quedó y por qué.

- [ ] **Step 3: Montar el panel de contexto a la derecha**

Importar `PanelContexto` y agregarlo como columna derecha del layout del space, con un ancho fijo de `min(280px, 80vw)`, de modo que la conversación quede al centro.

- [ ] **Step 4: Verificar**

Run: `cd files/alice && npm run build && node --test test/*.test.mjs`
Expected: build limpio sin warnings nuevos, 24/24.

Con `npm run dev`: abrir Cabida, cambiar un parámetro, ir al space, y confirmar que el panel de contexto muestra Cabida y sus cifras calculadas. Este chequeo **sí** se puede hacer sin API key — no depende del modelo. Si no podés manejar un browser, decilo en vez de darlo por hecho.

- [ ] **Step 5: Commit**

```bash
git add files/alice/src/copilot/PanelContexto.jsx files/alice/src/modules/alicia/AliciaView.jsx
git commit -m "feat(copilot): el space queda 100% copiloto — sale perfiles, entra el contexto"
```

---

---

### Task 9: Telemetría de costo por turno

El spec ordena pagar esta deuda acá: *"D19 · Sin telemetría de costo por turno … conviene hacerlo en la fase 2, cuando se toca el loop igual — pagar esta deuda al momento de contraerla sale casi gratis"*. Esta fase sube el gasto por turno (contexto en cada mensaje, el doble de iteraciones) y hoy no hay forma de saber cuánto hasta que llega la factura.

Independiente de las otras tareas: si el plan se corta antes, no falta nada de lo anterior.

**Files:**
- Create: `alicia-brain/src/uso.js`
- Modify: `alicia-brain/src/db.js` (tabla nueva en `initSchema`)
- Modify: `alicia-brain/src/server.js` (acumular en el loop, registrar al cerrar el turno)
- Test: `alicia-brain/test/uso.test.mjs`

**Interfaces:**
- Consumes: `resp.usage` de `finalMessage()` (Task 2).
- Produces: `usoVacio() -> Uso`, `acumularUso(a, bUsage) -> Uso` y `registrarUso(db, {userId, channel, model, iterations, uso})`, donde `Uso` es `{ input, output, cacheRead, cacheWrite }`.

- [ ] **Step 1: Escribir el test que falla**

Crear `alicia-brain/test/uso.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { usoVacio, acumularUso, registrarUso } from "../src/uso.js";

test("usoVacio arranca todo en cero", () => {
  assert.deepEqual(usoVacio(), { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
});

test("acumularUso suma los cuatro contadores de una iteración", () => {
  const r = acumularUso(usoVacio(), {
    input_tokens: 10, output_tokens: 5,
    cache_read_input_tokens: 100, cache_creation_input_tokens: 7,
  });
  assert.deepEqual(r, { input: 10, output: 5, cacheRead: 100, cacheWrite: 7 });
});

test("acumularUso suma varias iteraciones", () => {
  let u = usoVacio();
  u = acumularUso(u, { input_tokens: 10, output_tokens: 5 });
  u = acumularUso(u, { input_tokens: 3, output_tokens: 2 });
  assert.equal(u.input, 13);
  assert.equal(u.output, 7);
});

test("acumularUso no explota si falta usage o vienen campos sueltos", () => {
  assert.deepEqual(acumularUso(usoVacio(), undefined), usoVacio());
  assert.deepEqual(acumularUso(usoVacio(), null), usoVacio());
  assert.equal(acumularUso(usoVacio(), { output_tokens: 4 }).output, 4);
});

test("acumularUso no muta el acumulador que recibe", () => {
  const antes = usoVacio();
  acumularUso(antes, { input_tokens: 99 });
  assert.equal(antes.input, 0);
});

test("registrarUso guarda una fila por turno", () => {
  const d = new DatabaseSync(":memory:");
  d.exec(`CREATE TABLE turn_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, channel TEXT, model TEXT,
    iterations INTEGER, input_tokens INTEGER, output_tokens INTEGER,
    cache_read_tokens INTEGER, cache_write_tokens INTEGER,
    created_at TEXT DEFAULT (datetime('now')));`);
  registrarUso(d, {
    userId: "sb", channel: "copilot", model: "claude-sonnet-4-6", iterations: 3,
    uso: { input: 10, output: 5, cacheRead: 100, cacheWrite: 7 },
  });
  const f = d.prepare("SELECT * FROM turn_usage").get();
  assert.equal(f.user_id, "sb");
  assert.equal(f.channel, "copilot");
  assert.equal(f.iterations, 3);
  assert.equal(f.cache_read_tokens, 100);
});

test("registrarUso nunca tira: la telemetría no puede tumbar un turno", () => {
  const d = new DatabaseSync(":memory:");   // sin la tabla a propósito
  assert.doesNotThrow(() => registrarUso(d, {
    userId: "sb", channel: "app", model: "x", iterations: 1, uso: usoVacio(),
  }));
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd alicia-brain && node --test test/uso.test.mjs`
Expected: FAIL — `Cannot find module '../src/uso.js'`

- [ ] **Step 3: Escribir la implementación**

Crear `alicia-brain/src/uso.js`:

```js
// Cuánto costó cada turno. La Fase 2 sube el gasto (contexto de pantalla en cada
// mensaje, el doble de iteraciones) y sin esto no hay forma de saber cuánto hasta
// que llega la factura. Pagar la deuda ahora, mientras se toca el loop igual, sale
// casi gratis — ver D19 en el spec.

export function usoVacio() {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
}

// Devuelve uno nuevo en vez de mutar: el acumulador viaja por el loop y un mutador
// silencioso es justo el bug que nadie encuentra.
export function acumularUso(acc, usage) {
  const u = usage || {};
  return {
    input:      acc.input      + (u.input_tokens || 0),
    output:     acc.output     + (u.output_tokens || 0),
    cacheRead:  acc.cacheRead  + (u.cache_read_input_tokens || 0),
    cacheWrite: acc.cacheWrite + (u.cache_creation_input_tokens || 0),
  };
}

// Best-effort a propósito: si la tabla no existe todavía o la escritura falla,
// se pierde una medición — jamás el turno de la persona.
export function registrarUso(db, { userId, channel, model, iterations, uso }) {
  try {
    db.prepare(
      `INSERT INTO turn_usage (user_id, channel, model, iterations,
         input_tokens, output_tokens, cache_read_tokens, cache_write_tokens)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(userId, channel, model, iterations, uso.input, uso.output, uso.cacheRead, uso.cacheWrite);
  } catch (e) {
    console.error("no pude registrar el uso del turno:", e.message);
  }
}
```

- [ ] **Step 4: Crear la tabla**

En `alicia-brain/src/db.js`, dentro de `initSchema`, junto a las otras `CREATE TABLE IF NOT EXISTS`:

```sql
    CREATE TABLE IF NOT EXISTS turn_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, channel TEXT NOT NULL,
      model TEXT, iterations INTEGER,
      input_tokens INTEGER DEFAULT 0, output_tokens INTEGER DEFAULT 0,
      cache_read_tokens INTEGER DEFAULT 0, cache_write_tokens INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_turn_usage_fecha ON turn_usage(created_at DESC);
```

- [ ] **Step 5: Acumular y registrar en el loop**

En `alicia-brain/src/server.js`, agregar el import:

```js
import { usoVacio, acumularUso, registrarUso } from "./uso.js";
```

Declarar el acumulador junto a `const toolResults = [];`:

```js
  let uso = usoVacio();
```

Después de cada `resp = await st.finalMessage();` **y** de `resp = await stFallback.finalMessage();`, agregar:

```js
      uso = acumularUso(uso, resp.usage);
```

Y antes del `return { text: finalText, actions: toolResults };` final:

```js
  // Una línea por turno: con esto se puede sumar el gasto por canal y por persona
  // sin esperar a la factura.
  console.log(`💵 [${userId}/${channel}] ${iterations} iter · in ${uso.input} · out ${uso.output} · cache r${uso.cacheRead}/w${uso.cacheWrite}`);
  registrarUso(getDB(), { userId, channel, model, iterations, uso });
```

- [ ] **Step 6: Verificar**

Run: `cd alicia-brain && node --test test/uso.test.mjs && npm test`
Expected: 7 tests nuevos en PASS, y la suite completa en PASS.

Después, comprobar que la fila se escribe de verdad:
```bash
SANDBOX=1 GATE_DEV_OPEN=1 PANEL_PASSWORD=test npm start &
sleep 3
curl -s -o /dev/null -X POST http://127.0.0.1:3001/api/chat -H 'Content-Type: application/json' -d '{"message":"hola"}'
node --input-type=module -e "
import { DatabaseSync } from 'node:sqlite';
const d = new DatabaseSync(process.env.SQLITE_PATH || './alicia.db');
console.log(d.prepare('SELECT user_id, channel, iterations FROM turn_usage ORDER BY id DESC LIMIT 1').get());
"
```
Expected: imprime una fila con el canal `app`. **En sandbox `iterations` es 0 y los tokens 0** — el loop no corre; lo que se está probando es que la escritura ocurre y no rompe nada. Cortar con `kill %1`.

- [ ] **Step 7: Commit**

```bash
git add alicia-brain/src/uso.js alicia-brain/test/uso.test.mjs alicia-brain/src/db.js alicia-brain/src/server.js
git commit -m "feat(copilot): telemetria de costo por turno (paga la deuda D19 del spec)"
```

## Verificación de cierre

- [ ] `cd alicia-brain && npm test` → PASS (188: 176 previos + 5 de `sse.js` + 7 de `uso.js`)
- [ ] `cd files/alice && node --test test/*.test.mjs` → PASS (24: 16 previos + 8 del parser)
- [ ] `cd files/alice && npm run build` → limpio
- [ ] `POST /api/copilot/turn` sin auth → 401, sin abrir el stream
- [ ] El panel de contexto muestra el módulo que acabás de dejar
- [ ] WhatsApp y el teléfono siguen respondiendo: `/api/chat` y `/api/embodied` devuelven 200 con `SANDBOX=1`
- [ ] `turn_usage` tiene una fila por turno, con el canal correcto

**Lo que NO se puede verificar sin deployar** (decirlo, no taparlo): que los deltas de texto lleguen de verdad. `SANDBOX=1` cortocircuita el modelo, así que el streaming visual sólo se comprueba contra la API real. Primera cosa a mirar después del deploy.

**Deploy:** cerebro primero (Railway), ERP después (`npm run build && npx netlify deploy --prod --dir=dist`). Al revés, el ERP pegaría contra `/api/copilot/turn` en un cerebro que todavía no la tiene: 404, y el `catch` de `send` pintaría el error en el hilo.
