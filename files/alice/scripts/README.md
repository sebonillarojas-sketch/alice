# Humos del ERP (browser real)

## Por qué existen

`npm run build` **no detecta variables no definidas**. Vite compila y hace tree-shaking,
no resuelve nombres: un `useEffect` sin importar pasa el build sin una sola advertencia y
revienta recién cuando el componente se monta. Sin error boundary eso no rompe un pedazo
de la pantalla — tumba la app entera (el árbol pasa de ~900 nodos a 2). Ya pasó una vez,
en `EsquemaPlanta.jsx`, con el build verde.

`npm test` tampoco alcanza: los tests de `test/` son unitarios sobre módulos puros
(parser SSE, snapshot, notificaciones). Nunca montan un componente.

Estos scripts abren un Chromium de verdad contra el dev server, navegan y fallan si hay
`pageerror` o si el espacio no monta. Es la única red que atrapa esa clase de error.

## Los cinco scripts

| script | npm | qué prueba |
|---|---|---|
| `humo.mjs` | `npm run humo` | Que los spaces `hq`, `alicia`, `app-cabida`, `app-velocity` y `growth` monten sin `pageerror` y con más de 20 nodos. Es el humo base: detecta el "app en blanco". |
| `humo-burbuja.mjs` | `npm run humo:burbuja` | Siembra en `localStorage` un hilo con markdown y traza de tools, y verifica que la burbuja renderice `<strong>`, listas, tabla y `<code>`, que `TrazaTool` muestre el nombre legible de una tool conocida y el crudo de una desconocida, que el cursor `▍` aparezca en un mensaje `streaming`, y que el markdown del **usuario** NO se renderice. El `humo.mjs` base abre el space con el hilo vacío, así que nunca llega a montar nada de esto. |
| `cerebro-falso.mjs` | `npm run cerebro-falso` | No prueba nada por sí solo: es el servidor SSE de mentira que necesitan `humo-stream.mjs` y `humo-manos.mjs`. Sirve `/health`, `/api/copilot/history`, `/reset`, un `/api/copilot/turn` que stremea un guion distinto por turno, y la ruta de resultados (`/api/copilot/turn/:id/result`, `/resultados`) que usa el humo de manos para auditar lo que contestó el browser. Está construido **a propósito** para que el texto de `done` NO coincida con los deltas que emitió: es lo que hace que la prueba discrimine. |
| `humo-stream.mjs` | `npm run humo:stream` | El contrato de seis eventos del turno, end-to-end. Es el **único** artefacto que cubre estos tres invariantes — ningún test commiteado los toca. |
| `humo-manos.mjs` | `npm run humo:manos` | El round-trip completo de un `client_tool` y de un `confirm` contra un ERP real, más la cobertura del dock. Ver su sección más abajo. |

### Los tres invariantes que sólo `humo-stream.mjs` cubre

1. **`done.text` le gana al buffer streameado.** El cerebro guarda otra cosa que la que
   pintó (un rechazo pisa el texto sin mandar reset; la extracción de JSON stremea el
   envoltorio crudo y guarda el valor desenvuelto). El cerebro falso emite deltas que
   dicen `Respuesta **en curso**…` y un `done` que dice
   `Respuesta final **autoritativa**`: si el cliente se quedara con el acumulado, el
   test falla.
2. **`text_reset`.** El cerebro sólo guarda el texto de la última iteración. El guion
   pinta `Voy a revisar el radar`, corre una tool, manda `text_reset` y sigue: si el
   cliente ignorara el reset, quedarían las dos vueltas pegadas y el test falla.
3. **El frame `error` descarta la burbuja parcial.** Llega DESPUÉS de haber pintado
   deltas y sin ningún `done` que los corrija, porque el cerebro no guardó nada. El
   guion pinta `Esto no existe en ninguna base` y después manda `error`: si el cliente
   dejara ese texto en pantalla o en `localStorage`, el test falla.

De yapa cubre: un stream truncado sin `done` ni `error` (no debe persistir el buffer), un
`text_delta` sin campo `text` (no debe pegar el literal `undefined`), y el auto-scroll con
control positivo y negativo (scrolleado arriba no te arrastra; al fondo sí te sigue).

### Lo que sólo `humo-manos.mjs` cubre

Es el único artefacto que prueba el contrato completo de las manos: el servidor pide, el
**browser ejecuta de verdad** contra el ERP real (no un mock), y contesta. Tres cosas que
ningún test unitario puede tocar:

1. **Un `client_tool` de navegación cambia la pantalla de verdad y contesta con lo que
   leyó.** El cerebro falso manda `client_tool` con `tool: "erp_navigate"`, el browser
   corre `erp_navigate` de verdad (que hace `navigate()` + espera a que el módulo monte),
   y el `done` usa el texto que el browser le contestó por `/api/copilot/turn/:id/result`.
   Si el cliente no contestara, el cerebro falso cuelga por su propio timeout y el humo
   falla — que es exactamente lo que hay que detectar.
2. **El chat sobrevive a esa navegación.** `erp_navigate` cambia de space, lo que
   desmonta el space `alicia` (y con él, el composer de `AliciaView`). El estado del
   turno vive en `CopilotoProvider`, por encima del router — así que el hilo no se
   pierde, pero tampoco queda visible hasta reabrir el dock. El humo verifica las dos
   mitades: que el lanzador del dock aparezca al salir de `alicia`, y que reabrirlo
   muestre el mensaje que se mandó ANTES de navegar.
3. **Un `confirm` no ejecuta nada hasta el click, y "No" tampoco ejecuta.** Se prueban
   las dos decisiones por separado, con dos escrituras distintas (`c-decline` y
   `c-write`) para no depender de que un solo diálogo resuelva las dos veces. Con "No":
   el browser SÍ contesta (el modelo necesita saber que lo rechazaron), pero el humo
   audita el **contenido** de esa respuesta —tiene que ser el texto de rechazo, no
   `"humo.escribir recibió…"`— porque si "No" ejecutara igual iba a "contestar" de
   cualquier forma y una aserción que sólo mirara "¿contestó?" no lo notaría. Con
   "Ejecutar": recién ahí el resultado tiene que ser el de la acción real del bus
   (`cabida.humo.escribir`, registrada en `CabidaView.jsx` sólo para que este humo tenga
   una acción de escritura real que auditar sin tocar los números de una cabida).

De yapa (no estaba en el plan original) cubre el **dock**: el lanzador (el botón redondo
"A") está ausente en el space `alicia` —ahí la conversación ya se ve a lo ancho, mostrar
el lanzador ahí duplicaría el chat— y presente en cualquier otro space, y abrir el dock
en otro space monta un **solo** composer. Si el `ocultar` de `CopilotoDock.jsx` se
rompiera (por ejemplo si alguien invirtiera la condición o lo borrara), los otros tres
humos seguirían en verde: ninguno mira el dock, y la conversación se vería duplicada sin
que nada lo notara. Vive en `humo-manos.mjs` y no en un script aparte porque reutiliza el
mismo browser y la misma navegación que ya hace el humo de las manos (entrar a `alicia`,
salir a `cabida`) — separar esto en un `humo-dock.mjs` hubiera significado levantar un
segundo Chromium sólo para repetir la misma navegación.

**Por qué los guiones 5, 6 y 7 del cerebro falso se eligen por el TEXTO del mensaje y no
por el contador `turno`:** si dependieran de la posición como los guiones 1-4,
`humo-stream.mjs` los pisaría por accidente — manda seis mensajes reales (los cuatro del
contrato más los dos del auto-scroll) y el quinto y el sexto caerían en los guiones de
manos por casualidad de posición, no porque el humo de manos esté corriendo. El cerebro
falso mira `body.message` ANTES de tocar el contador: `"abrime cabida"` dispara el guion
de navegación, `"cambiá los pisos a 9"` el de confirmación con "No", y `"dale, cambiá los
pisos a 9"` el de confirmación con "Ejecutar". Cualquier otro mensaje sigue el contador
`turno` de siempre (1 a 4, después eco).

## Qué NO prueban

- **Nada del cerebro real.** `humo-stream.mjs` y `humo-manos.mjs` corren contra
  `cerebro-falso.mjs`: prueban que el *cliente* honra el contrato, no que el servidor lo
  emita bien. El `confirm` de `humo-manos.mjs` lo emite el cerebro falso directo, sin
  pasar por el catálogo (`client-tools.js`) que decide en producción si una acción
  necesita confirmación o no — eso lo cubren los tests de `alicia-brain`. El lado
  servidor de todo lo demás también lo cubren esos tests.
- **Nada de Supabase ni de auth.** `humo-burbuja.mjs` siembra una API key falsa en
  `localStorage` para saltear la pantalla de "Conectar Alicia". `humo-manos.mjs` ni
  siquiera necesita eso: con el cerebro falso arriba, `/health` contesta y el gate se
  abre solo (ver la nota de `VITE_ALICIA_URL` más abajo).
- **Nada visual.** No hay comparación de píxeles ni de layout: un botón invisible o
  descolocado pasa igual.
- **Sólo Chromium, sólo headless, sólo desktop.** No hay Safari, ni mobile, ni un
  viewport chico.
- **No corren en CI.** Necesitan un dev server levantado y los browsers de Playwright
  instalados. El workflow de GitHub corre `npm test` de los dos paquetes, no esto.

## Cómo correrlos

Playwright es dependencia de **`alicia-brain`**, no del ERP: los scripts lo resuelven
relativo a este archivo (`../../../alicia-brain/node_modules/playwright`). Si no está,
`npm install` en `alicia-brain` y `npx playwright install chromium`. Se puede apuntar a
otra instalación con la variable `PLAYWRIGHT_URL` (un `file://` al `index.js`).

### `humo` y `humo:burbuja` — sólo necesitan el dev server

```sh
cd files/alice
npm run dev &            # levanta vite en :5173
npm run humo
npm run humo:burbuja
```

Los dos aceptan una base distinta como argumento: `npm run humo -- http://localhost:4173`.

> **Ojo:** `humo:burbuja` NO puede correr contra el cerebro falso. Siembra el hilo en
> `localStorage`, y el ERP pisa ese cache con lo que devuelve `/api/copilot/history` —
> el falso devuelve `{ messages: [] }`, así que el hilo sembrado desaparece y el script
> falla con todos los contadores en cero. Si venís de correr `humo:stream`, reiniciá
> vite **sin** `VITE_ALICIA_URL` antes de este.

### `humo:stream` y `humo:manos` — necesitan además el cerebro falso

El dev server tiene que apuntar al cerebro falso, no al de producción:

```sh
cd files/alice
npm run cerebro-falso &                                    # :3999
VITE_ALICIA_URL=http://localhost:3999 npm run dev &        # :5173
npm run humo:stream
npm run humo:manos
```

El puerto del falso se cambia con `CEREBRO_FALSO_PORT`, y hay que avisarle al humo con
`CEREBRO_FALSO_URL` (y a vite con `VITE_ALICIA_URL`). Los dos humos pueden correr, en
cualquier orden, contra el MISMO cerebro falso arriba: los guiones de manos se eligen por
el texto del mensaje (ver arriba), así que no importa en qué turno del contador ande el
cerebro cuando arranca `humo-manos.mjs`.

**Acordate de matar los dos procesos al terminar** (`pkill -f vite`,
`pkill -f cerebro-falso`): un vite viejo con la `VITE_ALICIA_URL` del falso hace que el
space del copiloto hable con un servidor de mentira sin que nada lo avise.

**Ojo con un Vite frío:** si `cerebro-falso` y `vite` recién arrancaron, el primer
`page.goto` puede pegarle a un bundle a medio transformar y el humo miente —falla con
`L is not defined` o con menos nodos de los esperados, y no es un bug del código. Esperá
a que el dev server responda un par de veces seguidas (o hacé una navegación de
"calentamiento" con Playwright) antes de sacar conclusiones de una corrida en frío.

Los cuatro humos con browser (`humo`, `humo:burbuja`, `humo:stream`, `humo:manos`) salen
con código 0 y una línea final `HUMO OK` / `BURBUJA OK` / `STREAM OK` / `MANOS OK`
(o `... FALLA`), así que sirven tal cual en un `set -e`.
