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

## Los cuatro scripts

| script | npm | qué prueba |
|---|---|---|
| `humo.mjs` | `npm run humo` | Que los spaces `hq`, `alicia`, `app-cabida`, `app-velocity` y `growth` monten sin `pageerror` y con más de 20 nodos. Es el humo base: detecta el "app en blanco". |
| `humo-burbuja.mjs` | `npm run humo:burbuja` | Siembra en `localStorage` un hilo con markdown y traza de tools, y verifica que la burbuja renderice `<strong>`, listas, tabla y `<code>`, que `TrazaTool` muestre el nombre legible de una tool conocida y el crudo de una desconocida, que el cursor `▍` aparezca en un mensaje `streaming`, y que el markdown del **usuario** NO se renderice. El `humo.mjs` base abre el space con el hilo vacío, así que nunca llega a montar nada de esto. |
| `cerebro-falso.mjs` | `npm run cerebro-falso` | No prueba nada por sí solo: es el servidor SSE de mentira que necesita `humo-stream.mjs`. Sirve `/health`, `/api/copilot/history`, `/reset` y un `/api/copilot/turn` que stremea un guion distinto por turno. Está construido **a propósito** para que el texto de `done` NO coincida con los deltas que emitió: es lo que hace que la prueba discrimine. |
| `humo-stream.mjs` | `npm run humo:stream` | El contrato de seis eventos del turno, end-to-end. Es el **único** artefacto que cubre estos tres invariantes — ningún test commiteado los toca. |

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

## Qué NO prueban

- **Nada del cerebro real.** `humo-stream.mjs` corre contra `cerebro-falso.mjs`: prueba
  que el *cliente* honra el contrato, no que el servidor lo emita bien. El lado servidor
  lo cubren los tests de `alicia-brain`.
- **Nada de Supabase ni de auth.** `humo-burbuja.mjs` siembra una API key falsa en
  `localStorage` para saltear la pantalla de "Conectar Alicia".
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

### `humo:stream` — necesita además el cerebro falso

El dev server tiene que apuntar al cerebro falso, no al de producción:

```sh
cd files/alice
npm run cerebro-falso &                                    # :3999
VITE_ALICIA_URL=http://localhost:3999 npm run dev &        # :5173
npm run humo:stream
```

El puerto del falso se cambia con `CEREBRO_FALSO_PORT`, y hay que avisarle al humo con
`CEREBRO_FALSO_URL` (y a vite con `VITE_ALICIA_URL`).

**Acordate de matar los dos procesos al terminar** (`pkill -f vite`,
`pkill -f cerebro-falso`): un vite viejo con la `VITE_ALICIA_URL` del falso hace que el
space del copiloto hable con un servidor de mentira sin que nada lo avise.

Los tres salen con código 0 y una línea final `HUMO OK` / `BURBUJA OK` / `STREAM OK`
(o `... FALLA`), así que sirven tal cual en un `set -e`.
