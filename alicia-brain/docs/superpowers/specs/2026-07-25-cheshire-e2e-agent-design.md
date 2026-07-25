# Cheshire 😺 — Agente E2E / usabilidad · Diseño (v1)

_2026-07-25 · Wonderland IT · ver `docs/WONDERLAND_IT.md`_

## Contexto

El equipo Wonderland IT tiene implementados White Rabbit (salud infra), Mad Hatter
(performance/costos), Dark Alice (jefa de operaciones) y Tea Table (síntesis semanal).
**Cheshire falta.** Su rol: ser el tester de **usabilidad y experiencia real** — un
navegador que usa ALICE como la usaría una persona, contra producción, y reporta cuando
algo se rompe o se degrada, antes de que lo sufra el equipo.

Corre en **alicia-mac** (host 24/7, "no duerme"), fuera de `alicia-brain` (Railway no
puede levantar un browser). Reporta al backend por el endpoint que **ya existe**:
`POST https://aliceai.bam.pe/api/agents/report` con `x-agent-key` → escribe en `agent_runs`
y `agent_findings`.

**Requisito central:** además de flujos guionados, Cheshire debe **intentar probar TODO** —
un algoritmo exploratorio que descubre y ejercita cualquier parte de la app y detecta
roturas, no solo una checklist fija.

## Objetivo y criterios de éxito

- Cada corrida (cada 30 min) deja un `agent_run` de Cheshire con `result` ok/issues y, si
  hay problemas, `findings` con detalle + ruta de reproducción + screenshot.
- Detecta: flujos golden rotos, errores JS/consola, requests fallidos (4xx/5xx), pantallas
  en blanco/crash, texto crudo (JSON) del chat, audio que no suena, layout roto en mobile.
- **Cero contaminación de prod:** toda escritura ocurre como usuario **Cheshire QA** en un
  **space QA oculto**, y se limpia (borra) al terminar.
- Alertas WhatsApp **solo en transición** ok→issues / issues→ok (sin spam cada 30 min).

## Arquitectura

Script Node standalone en `~/wonderland/cheshire/` en alicia-mac. Playwright (Chromium
headless). Agendado por `launchd` cada 30 min. Sin estado propio salvo un archivo de
"último status" para la lógica de transición de alertas.

```
~/wonderland/cheshire/
├── cheshire.mjs        # orquestador: login → flujos guionados → crawler → reporta
├── flows.js           # flujos golden (cada uno: {id,label,run(page)→{ok,detail,shot}})
├── crawler.js         # algoritmo exploratorio "probá lo que sea" (ver abajo)
├── report.js          # POST /api/agents/report (x-agent-key) + alerta de transición
├── safety.js          # denylist de acciones destructivas + límites
├── config.js          # URLs, credenciales QA, keys (todo desde env / .env)
├── shots/             # screenshots de la última corrida
└── com.hygge.cheshire.plist  # launchd cada 30 min
```

### Componentes (aislados)

- **`flows.js`** — flujos golden determinísticos. Cada flujo es una unidad
  `{ id, label, async run(page) → { ok:boolean, detail:string, shot:path } }`. Sin estado
  compartido; el orquestador les pasa una `page` ya logueada.
- **`crawler.js`** — expone `async explore(page, opts) → { states, findings }`. No sabe de
  reporting; devuelve hallazgos crudos.
- **`report.js`** — `async report({ result, summary, findings })` (POST) y
  `alertOnTransition(result)` (WhatsApp solo si cambió el status).
- **`safety.js`** — `esDestructiva(el)` (denylist: Eliminar/Borrar/Delete/Logout/Cerrar
  sesión/Pagar/Aprobar…) y constantes de límite.
- **`cheshire.mjs`** — orquesta: setup browser → login QA → correr flows → correr crawler →
  consolidar result/findings → report → alerta → cleanup.

## Flujos golden (v1, determinísticos)

1. **Login** → carga el dashboard (assert de un elemento clave del HQ).
2. **Crear tarea** en el space QA → aparece en la lista → **la borra** (cleanup).
3. **Chat con Alicia** → responde **texto limpio** (assert: la respuesta NO es JSON crudo).
4. **Voz** → el audio se genera/reproduce (assert de elemento de audio / blob > umbral).
5. **Selector de voz** → cambia y **persiste** tras reload.
6. **Mobile viewport** (390×844) → sin overflow horizontal; elementos clave visibles.

Cada flujo → check pass/fail con `detail` y screenshot. Si alguno falla → `result:"issues"`
y un finding `category:"e2e"`.

## Crawler exploratorio — "probá lo que sea"

Algoritmo de exploración autónoma acotada (tipo monkey-tester dirigido) que intenta
ejercitar **toda** la app desde el estado logueado (QA), detectando roturas:

**Estado y frontera.** Un "estado UI" se identifica por una **firma** = `hash(url +
headings visibles + set de labels de botones/tabs)`. Se mantiene un set `visitados` y una
frontera BFS de (estado, acción-pendiente).

**Bucle (BFS acotado):**
1. En el estado actual: instrumentar la página → capturar `console.error`, `pageerror`
   (excepciones JS no atrapadas) y respuestas de red con status ≥ 400.
2. Sanidad del estado: ¿pantalla en blanco? ¿body sin contenido? ¿un error boundary
   visible? → finding.
3. Enumerar elementos **interactivos** (button, a[href], [role=button], tabs, inputs de
   formulario) visibles y habilitados.
4. Filtrar con `safety.esDestructiva` (denylist) → **nunca** clickear acciones
   irreversibles/destructivas ni salir de sesión ni acciones de dinero.
5. Elegir la próxima acción **no visitada** (heurística: preferir tabs/navegación, luego
   botones, luego rellenar+enviar formularios con datos QA). Ejecutarla.
6. Registrar el nuevo estado; si su firma es nueva, agregarlo a la frontera. Volver a 1.

**Límites (safety):** `MAX_ACCIONES` (p.ej. 80), `MAX_PROFUNDIDAD` (p.ej. 6),
`TIME_BUDGET` (p.ej. 4 min), dedupe por firma para no ciclar. Formularios: usar SOLO datos
QA marcados; cualquier creación queda en el sandbox QA y se limpia.

**Detección de roturas → findings:** cada uno con `severity` (minor/major/critical),
`category` ("crawler-js-error" | "crawler-http" | "crawler-blank" | "crawler-ux"),
`detail`, **ruta de reproducción** (secuencia de labels clickeados) y screenshot.

**Determinismo razonable:** el orden de exploración es estable (elementos ordenados por
posición DOM) para que la ruta de repro sea reproducible; la aleatoriedad se evita.

## Reporte

Al final, `cheshire.mjs` consolida: `result = "issues"` si algún flow falló o el crawler
encontró un hallazgo ≥ major; si no, `"ok"`. Arma `summary` (p.ej. "6/6 flujos OK · crawler
72 estados, 0 hallazgos") y hace:

```
POST https://aliceai.bam.pe/api/agents/report
  headers: { x-agent-key: AGENTS_API_KEY }
  body: { agent:"cheshire", result, summary, actions_taken:[], findings:[...] }
```

El backend (ya existente) inserta en `agent_runs` + `agent_findings`, y Dark Alice/Tea Table
los recogen. Cheshire, además, envía WhatsApp a `PHONE_sb` **solo** cuando `result` cambia
respecto a la corrida anterior (archivo local `last_status`), replicando el patrón de White
Rabbit (sin spam).

## Manejo de errores (del propio agente)

- Si el browser/login falla → un `agent_run` con `result:"error"` y summary del stack; no
  se pierde la corrida (queda registrada la caída del propio Cheshire).
- Timeouts por flujo/acción acotados (Playwright `timeout`), para que una página colgada no
  cuelgue toda la corrida.
- `try/catch` por flujo y por acción del crawler → una falla aísla ese ítem, no aborta el
  resto.

## Testing

- **Dry-run local:** correr `cheshire.mjs --once` contra `localhost:5173` (o prod) con la
  cuenta QA; verificar que imprime resultados y (con `--no-report`) no postea.
- **Integración:** una corrida real → `GET /api/agents/status` debe mostrar la última de
  `cheshire`; el finding inyectado a mano debe aparecer y auto-cerrarse al pasar.
- **Safety:** test unitario de `safety.esDestructiva` (labels de la denylist → true).
- **Crawler acotado:** verificar que respeta `MAX_ACCIONES`/`TIME_BUDGET` y no clickea la
  denylist (assert sobre el log de acciones).

## Prerrequisitos

- Usuario **Cheshire QA** + **space QA oculto** en ALICE (creación aparte).
- `AGENTS_API_KEY` (ya en Railway), `PHONE_sb`, credenciales QA — en `.env` de alicia-mac.
- Playwright + Chromium instalados en alicia-mac (Node).

## Fuera de alcance (v2+)

- **Claude Vision** sobre screenshots para hallazgos de UX ("botón tapado", "texto
  desbordado").
- **Regresión visual** por diff de screenshots contra baseline.
- Bandersnatch/Jabberwocky (necesitan el clon-stack) — proyectos aparte.
