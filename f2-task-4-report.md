# Fase 2 · Task 4 — Wiring captura (corrección + Tea Table)

## Step 0 — `alicia-brain/src/db.js`

Cambio de una línea (~línea 11):

```js
// antes
function getDB() {
// después
export function getDB() {
```

`node --check src/db.js` → OK (sin salida, exit 0).

## Step 1 — `alicia-brain/src/server.js`, endpoint `POST /api/agents/correction` (~línea 1598)

El handler NO era `async` en el original (`(req, res) => {`), pero el bloque de captura usa
`await import(...)`. Lo cambié a `async (req, res) => {` para que el `await` sea válido
(si no, es `SyntaxError: await is only valid in async functions`).

Inserción — después del INSERT exitoso, antes de `res.json`:

```js
app.post("/api/agents/correction", async (req, res) => {
  try {
    const { study_id = null, unidad = "", image = "", notas = "", veredicto = "a_corregir" } = req.body || {};
    if (!image && !notas) return res.status(400).json({ error: "image o notas requerido" });
    const { lastID } = query(
      `INSERT INTO bammy_corrections (study_id, unidad, image, notas, veredicto) VALUES (?,?,?,?,?)`,
      [study_id, unidad, image, notas, veredicto]
    );
    try {
      const { proposeLesson } = await import("./lessons.js");
      const { lessonFromCorrection } = await import("./lesson-capture.js");
      const args = lessonFromCorrection({ unidad, notas, veredicto, study_id });
      if (args) { const { getDB } = await import("./db.js"); proposeLesson(getDB(), args); }
    } catch (e) { console.error("captura de lección (corrección) falló:", e.message); }
    res.json({ ok: true, id: lastID });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```

Best-effort: el `try/catch` interno solo loguea y no afecta el flujo del endpoint ni el `res.json`.

## Step 2 — `alicia-brain/src/teatable.js`, `runTeaTableReport` (~línea 89)

(a) Sección `## Lecciones` agregada al esqueleto del prompt del sistema, justo después de
`## Recomendación de la mesa` y antes del cierre del template string / línea de tono:

```js
## Recomendación de la mesa
[1-3 acciones concretas para Sebastián, en orden de prioridad.]

## Lecciones
[0-5 bullets con lecciones accionables para la constelación de agentes, en base a lo observado esta semana (patrones, errores repetidos, correcciones). Si no hay ninguna, decilo o dejá la sección vacía — no inventes.]

Tono: directo, cálido, cero relleno. Máximo ~350 palabras.`;
```

(b) Bloque de captura agregado justo después de que `report` queda generado (tras el
try/catch que llama a la API de Claude o cae al fallback), y antes de calcular
`result`/`summary` e insertar en `agent_runs`:

```js
    report = `# Estado del sistema\n\n(Claude no disponible: ${e.message})\n\nChecks fallando: ${failedChecks.map(c => c.label).join(", ") || "ninguno"}\nFindings abiertos: ${openFindings.length}`;
  }

  try {
    const { proposeLesson } = await import("./lessons.js");
    const { lessonsFromTeaTable } = await import("./lesson-capture.js");
    const { getDB } = await import("./db.js");
    for (const args of lessonsFromTeaTable(report)) proposeLesson(getDB(), args);
  } catch (e) { console.error("captura de lecciones (tea-table) falló:", e.message); }

  const result = failedChecks.length > 0
```

`runTeaTableReport` ya era `async` y el resto del archivo usa `await import(...)` en otros
lugares (ej. `sendWA`), así que no hizo falta ningún otro cambio de firma. Usé `getDB()`
(recién exportado en Step 0) en vez del `query`/`parseArr` que el archivo ya importa, tal
como pide la interfaz `proposeLesson(db, args)`.

## Step 3 — `node --check`

```
$ node --check src/server.js && echo "server.js OK"
server.js OK
$ node --check src/teatable.js && echo "teatable.js OK"
teatable.js OK
$ node --check src/db.js && echo "db.js OK"
db.js OK
```

## Verificación adicional (no pedida explícitamente pero de bajo riesgo)

Smoke de los mappers + `proposeLesson` contra un `DatabaseSync(':memory:')` (sin tocar la
DB real, sin correr el server ni `runTeaTableReport`):

```
correction lesson id: 1
teatable lesson id: 2
teatable lesson id: 3
SMOKE OK
```

Confirma que `lessonFromCorrection`/`lessonsFromTeaTable` (ya implementados en Tasks 1-2 de
esta misma rama) calzan con la firma `proposeLesson(db, { scope, source, trigger, lesson,
risk_level })` de `src/lessons.js`.

## Concerns

- El único cambio fuera de lo literal del plan fue marcar el handler de
  `/api/agents/correction` como `async` — necesario porque el bloque del plan usa
  `await import(...)` dentro de un handler que no era async. Sin este cambio,
  `node --check` habría fallado con `SyntaxError`.
- No se corrió el server ni `runTeaTableReport` real (llama a la API de Claude), tal como
  se indicó. La verificación de Tea Table quedó a nivel de mappers puros + `proposeLesson`
  en memoria.
