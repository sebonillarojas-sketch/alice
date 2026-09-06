# Flujo limpio Cabida → Tweedledum/Tweedledee — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que desde los números de Cabida salga, en ~5 minutos y sin intervención obligatoria, una propuesta de planta típica validada, con Tweedledum y Tweedledee corrigiéndose entre ellos en vez de repetir el mismo error.

**Architecture:** Los agentes emiten decisiones; la geometría la hace código determinista (`distribucion.js`, `reglas.js`, `validacion.js`). Tres mecanismos nuevos y puros hacen que el lazo converja: diversidad de partis verificada por código, hallazgos que atan la siguiente llamada, y hallazgos de `nivel: volumen` que suben a cambiar el reparto en vez de reintentar el interior. Todo lo nuevo son funciones puras testeables sin red.

**Tech Stack:** Node ESM, `node --test` (ambos paquetes ya lo usan), React + Vite en el frontend. Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-09-05-flujo-cabida-tweedle-design.md`

## Global Constraints

- Rama: `main`. Hay otras cuatro sesiones activas en `EditorPlanos.jsx`, `feyd.js` y `server.js`. **Verificar `git status` antes de cada edición y no commitear sin avisar a Sebastián.**
- Moneda única entre etapas: el layout JSON del skill `arquitecto-residencial-lima`.
- Los agentes no emiten vértices. Ninguna función de este plan pide coordenadas a un modelo.
- Tests con `node --test`; archivos `*.test.mjs` en `test/` de cada paquete.
- Topes: 3 vueltas por unidad, 10 llamadas de agente por piso; el tope de piso manda.
- Cada etapa persiste apenas termina.
- Severidades y categorías existentes de `schemas.js` — no inventar nuevas: `critical|major|minor|info`, `circulation|furnishability|daylight|privacy|structure|mep|buildability|commercial|regulatory|other`.

---

### Task 1: Diversidad de partis

Impide el «ocho tipologías iguales» en el origen: dos partis que coinciden en núcleo y reparto se consideran el mismo y uno se descarta.

**Files:**
- Create: `files/alice/src/modules/planos/parti.js`
- Test: `files/alice/test/parti.test.mjs`

**Interfaces:**
- Consumes: nada.
- Produces: `partiSignature(parti) -> string`, `sonDistintos(a, b, tol = 0.30) -> boolean`, `dedupePartis(list, tol = 0.30) -> {kept: Parti[], dropped: Parti[]}`.
  Un `Parti` es `{ id, core: {x, y, w, d}, units: [{id, x, w}] }` — `x`/`w` en metros sobre el frente de la huella.

- [ ] **Step 1: Write the failing test**

```js
// files/alice/test/parti.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { partiSignature, sonDistintos, dedupePartis } from "../src/modules/planos/parti.js";

const A = { id: "a", core: { x: 7.4, y: 0, w: 5.2, d: 5 }, units: [{ id: "u1", x: 0, w: 7.4 }, { id: "u2", x: 12.6, w: 7.4 }] };
const B = { id: "b", core: { x: 7.5, y: 0, w: 5.2, d: 5 }, units: [{ id: "u1", x: 0, w: 7.5 }, { id: "u2", x: 12.7, w: 7.3 }] };
const C = { id: "c", core: { x: 0, y: 0, w: 5.2, d: 5 }, units: [{ id: "u1", x: 5.2, w: 14.8 }] };

test("la firma ignora diferencias por debajo de la tolerancia", () => {
  assert.equal(partiSignature(A), partiSignature(B));
});

test("un núcleo en otra posición es otro parti", () => {
  assert.ok(sonDistintos(A, C));
});

test("dos partis dentro de tolerancia NO son distintos", () => {
  assert.ok(!sonDistintos(A, B));
});

test("dedupe conserva el primero y reporta el descartado", () => {
  const { kept, dropped } = dedupePartis([A, B, C]);
  assert.deepEqual(kept.map((p) => p.id), ["a", "c"]);
  assert.deepEqual(dropped.map((p) => p.id), ["b"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd files/alice && node --test test/parti.test.mjs`
Expected: FAIL — `Cannot find module '../src/modules/planos/parti.js'`

- [ ] **Step 3: Write minimal implementation**

```js
// files/alice/src/modules/planos/parti.js
// Diversidad de partis verificada por codigo, no pedida por prompt: dos partis que
// coinciden en nucleo y reparto son el mismo, y uno se descarta.
const q = (n, tol) => Math.round(Number(n || 0) / tol) * tol;

export function partiSignature(parti = {}, tol = 0.30) {
  const core = parti.core || {};
  const units = [...(parti.units || [])].sort((a, b) => (a.x || 0) - (b.x || 0));
  const c = `c:${q(core.x, tol)},${q(core.y, tol)},${q(core.w, tol)},${q(core.d, tol)}`;
  const u = units.map((it) => `${q(it.x, tol)}:${q(it.w, tol)}`).join("|");
  return `${c}#${u}`;
}

export function sonDistintos(a, b, tol = 0.30) {
  return partiSignature(a, tol) !== partiSignature(b, tol);
}

export function dedupePartis(list = [], tol = 0.30) {
  const vistos = new Set();
  const kept = [];
  const dropped = [];
  for (const p of list) {
    const sig = partiSignature(p, tol);
    if (vistos.has(sig)) { dropped.push(p); continue; }
    vistos.add(sig);
    kept.push(p);
  }
  return { kept, dropped };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd files/alice && node --test test/parti.test.mjs`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add files/alice/src/modules/planos/parti.js files/alice/test/parti.test.mjs
git commit -m "feat(planos): verificar diversidad de partis por codigo"
```

---

### Task 2: Libro de hallazgos de la corrida

Convierte la crítica de Tweedledee en restricción: los hallazgos entran como `must_fix`, se comprueba que desaparecieron, y un hallazgo que sobrevive dos vueltas detiene la cadena.

**Files:**
- Create: `files/alice/src/modules/planos/findingsLedger.js`
- Test: `files/alice/test/findings-ledger.test.mjs`

**Interfaces:**
- Consumes: hallazgos con la forma `{unidad, ambiente, regla, medida, esperado, severidad, nivel, category}`.
  **OJO — esta forma NO es la que emite hoy `normalizeCritiqueOutput`.** Ese normalizador usa lista
  blanca y devuelve `{id, severity, category, title, observation, consequence, recommendation,
  location, regulatoryStatus, evidenceRefs}`: no hay `nivel`, `regla`, `ambiente` ni `unidad`.
  Producirla es responsabilidad de la **Tarea 10**, sin la cual el mecanismo §6.3 no se dispara nunca.
- Produces: `createLedger() -> Ledger` con `record(unidad, findings) -> {nuevos, repetidos, regresiones}`, `mustFix(unidad) -> Finding[]`, `bloqueado(unidad) -> boolean`, `resueltos(unidad, findings) -> Finding[]`.
- `findingKey(f) -> string` exportada para reuso en Task 5.

- [ ] **Step 1: Write the failing test**

```js
// files/alice/test/findings-ledger.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createLedger, findingKey } from "../src/modules/planos/findingsLedger.js";

const f = (over = {}) => ({ unidad: "B", ambiente: "dormitorio 2", regla: "ancho_util",
  medida: 2.30, esperado: 2.40, severidad: "critical", nivel: "interior", ...over });

test("la clave ignora la medida: es el mismo problema aunque cambie el numero", () => {
  assert.equal(findingKey(f()), findingKey(f({ medida: 2.35 })));
});

test("primera vuelta: todos nuevos", () => {
  const l = createLedger();
  const r = l.record("B", [f()]);
  assert.equal(r.nuevos.length, 1);
  assert.equal(r.repetidos.length, 0);
  assert.equal(l.bloqueado("B"), false);
});

test("el mismo hallazgo dos vueltas seguidas bloquea la unidad", () => {
  const l = createLedger();
  l.record("B", [f()]);
  const r = l.record("B", [f()]);
  assert.equal(r.repetidos.length, 1);
  assert.equal(l.bloqueado("B"), true);
});

test("resolver y reintroducir el mismo hallazgo es una regresion", () => {
  const l = createLedger();
  l.record("B", [f()]);
  l.record("B", []);                       // se resolvio
  const r = l.record("B", [f()]);
  assert.equal(r.regresiones.length, 1);
});

test("mustFix devuelve los abiertos de esa unidad", () => {
  const l = createLedger();
  l.record("B", [f(), f({ ambiente: "cocina", regla: "area_min" })]);
  assert.equal(l.mustFix("B").length, 2);
  assert.equal(l.mustFix("A").length, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd files/alice && node --test test/findings-ledger.test.mjs`
Expected: FAIL — módulo inexistente

- [ ] **Step 3: Write minimal implementation**

```js
// files/alice/src/modules/planos/findingsLedger.js
// Memoria de la corrida: un hallazgo que sobrevive dos vueltas detiene la cadena en
// vez de reintentar lo mismo por tercera vez.
export const findingKey = (f = {}) =>
  `${f.unidad || ""}|${f.ambiente || ""}|${f.regla || f.category || ""}`;

export function createLedger() {
  const abiertos = new Map();   // unidad -> Map(key, finding)
  const cerrados = new Map();   // unidad -> Set(key)
  const vueltas = new Map();    // key -> veces consecutivas visto

  const mapFor = (m, u) => { if (!m.has(u)) m.set(u, m === cerrados ? new Set() : new Map()); return m.get(u); };

  return {
    record(unidad, findings = []) {
      const abiertosU = mapFor(abiertos, unidad);
      const cerradosU = mapFor(cerrados, unidad);
      const vistos = new Set();
      const nuevos = [], repetidos = [], regresiones = [];

      for (const f of findings) {
        const key = findingKey({ ...f, unidad });
        vistos.add(key);
        if (abiertosU.has(key)) {
          vueltas.set(key, (vueltas.get(key) || 1) + 1);
          repetidos.push(f);
        } else if (cerradosU.has(key)) {
          cerradosU.delete(key);
          vueltas.set(key, 1);
          regresiones.push(f);
        } else {
          vueltas.set(key, 1);
          nuevos.push(f);
        }
        abiertosU.set(key, { ...f, unidad });
      }
      for (const key of [...abiertosU.keys()]) {
        if (!vistos.has(key)) { abiertosU.delete(key); cerradosU.add(key); vueltas.delete(key); }
      }
      return { nuevos, repetidos, regresiones };
    },
    mustFix(unidad) { return [...mapFor(abiertos, unidad).values()]; },
    bloqueado(unidad) {
      return [...mapFor(abiertos, unidad).keys()].some((k) => (vueltas.get(k) || 0) >= 2);
    },
    resueltos(unidad) { return [...mapFor(cerrados, unidad)]; },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd files/alice && node --test test/findings-ledger.test.mjs`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add files/alice/src/modules/planos/findingsLedger.js files/alice/test/findings-ledger.test.mjs
git commit -m "feat(planos): libro de hallazgos que detiene el lazo repetido"
```

---

### Task 3: Subir el hallazgo al volumen

Cuando el interior no cierra porque el sobre es imposible, el ancho de la unidad cambia sobre la huella y se reequilibra a las vecinas, conservando el área techada del piso.

**Files:**
- Create: `files/alice/src/modules/planos/rebalance.js`
- Test: `files/alice/test/rebalance.test.mjs`

**Interfaces:**
- Consumes: `Parti` de Task 1.
- Produces: `esDeVolumen(finding) -> boolean`, `rebalancear(parti, unidadId, deltaM) -> Parti`.
  `rebalancear` ensancha `unidadId` en `deltaM` metros y descuenta ese ancho **a prorrata** de las demás unidades, dejando el total invariante. Lanza `RangeError` si alguna vecina quedara por debajo de `MIN_ANCHO_UNIDAD` (3.00 m).

- [ ] **Step 1: Write the failing test**

```js
// files/alice/test/rebalance.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { esDeVolumen, rebalancear, MIN_ANCHO_UNIDAD } from "../src/modules/planos/rebalance.js";

const parti = { id: "p", core: { x: 7.4, y: 0, w: 5.2, d: 5 },
  units: [{ id: "A", x: 0, w: 7.4 }, { id: "B", x: 12.6, w: 7.4 }] };

test("un hallazgo de no-cabe es de volumen", () => {
  assert.ok(esDeVolumen({ regla: "no_cabe", severidad: "critical" }));
  assert.ok(esDeVolumen({ nivel: "volumen" }));
  assert.ok(!esDeVolumen({ regla: "ancho_util", nivel: "interior" }));
});

test("ensanchar una unidad descuenta a prorrata y conserva el total", () => {
  const antes = parti.units.reduce((s, u) => s + u.w, 0);
  const out = rebalancear(parti, "A", 0.8);
  const despues = out.units.reduce((s, u) => s + u.w, 0);
  assert.equal(Math.round(despues * 1000) / 1000, Math.round(antes * 1000) / 1000);
  assert.equal(out.units.find((u) => u.id === "A").w, 8.2);
  assert.equal(out.units.find((u) => u.id === "B").w, 6.6);
});

test("no deja a una vecina por debajo del minimo", () => {
  assert.throws(() => rebalancear(parti, "A", 5.0), RangeError);
  assert.equal(MIN_ANCHO_UNIDAD, 3.0);
});

test("no muta el parti original", () => {
  rebalancear(parti, "A", 0.5);
  assert.equal(parti.units.find((u) => u.id === "A").w, 7.4);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd files/alice && node --test test/rebalance.test.mjs`
Expected: FAIL — módulo inexistente

- [ ] **Step 3: Write minimal implementation**

```js
// files/alice/src/modules/planos/rebalance.js
// El interior que no cierra suele ser un problema de reparto, no de muebles:
// el hallazgo sube y cambia el ancho de la unidad sobre la huella.
export const MIN_ANCHO_UNIDAD = 3.0;

const REGLAS_DE_VOLUMEN = new Set(["no_cabe", "sin_fachada", "sobre_insuficiente"]);

export function esDeVolumen(f = {}) {
  if (f.nivel === "volumen") return true;
  return REGLAS_DE_VOLUMEN.has(f.regla);
}

export function rebalancear(parti, unidadId, deltaM) {
  const units = (parti.units || []).map((u) => ({ ...u }));
  const target = units.find((u) => u.id === unidadId);
  if (!target) throw new RangeError(`unidad ${unidadId} no existe en el parti`);
  const otras = units.filter((u) => u.id !== unidadId);
  const anchoOtras = otras.reduce((s, u) => s + u.w, 0);
  if (!otras.length || anchoOtras <= 0) throw new RangeError("no hay vecinas para reequilibrar");

  for (const u of otras) {
    const quita = deltaM * (u.w / anchoOtras);
    if (u.w - quita < MIN_ANCHO_UNIDAD) {
      throw new RangeError(`${u.id} quedaria en ${(u.w - quita).toFixed(2)} m (min ${MIN_ANCHO_UNIDAD})`);
    }
  }
  for (const u of otras) u.w = Math.round((u.w - deltaM * (u.w / anchoOtras)) * 1000) / 1000;
  target.w = Math.round((target.w + deltaM) * 1000) / 1000;

  // reubicar en el frente conservando el orden
  const orden = [...units].sort((a, b) => a.x - b.x);
  let cursor = orden[0].x;
  for (const u of orden) { u.x = Math.round(cursor * 1000) / 1000; cursor += u.w; }

  return { ...parti, units };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd files/alice && node --test test/rebalance.test.mjs`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add files/alice/src/modules/planos/rebalance.js files/alice/test/rebalance.test.mjs
git commit -m "feat(planos): subir hallazgos de volumen y reequilibrar el reparto"
```

---

### Task 4: Orden por dificultad

La unidad difícil primero: es la que fuerza cambios de reparto. Empezar por la fácil obliga a rehacer el piso.

**Files:**
- Create: `files/alice/src/modules/planos/dificultad.js`
- Test: `files/alice/test/dificultad.test.mjs`

**Interfaces:**
- Consumes: unidades `{id, area, fachadas, frente, fondo}`.
- Produces: `puntajeDificultad(u) -> number` (mayor = más difícil), `ordenarPorDificultad(units) -> Unit[]`.

- [ ] **Step 1: Write the failing test**

```js
// files/alice/test/dificultad.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { puntajeDificultad, ordenarPorDificultad } from "../src/modules/planos/dificultad.js";

const facil = { id: "A", area: 72.5, fachadas: 2, frente: 7.4, fondo: 9.8 };
const dificil = { id: "C", area: 40.3, fachadas: 1, frente: 8.4, fondo: 4.8 };
const medio = { id: "B", area: 57.2, fachadas: 2, frente: 7.4, fondo: 9.8 };

test("menos fachadas y menos area es mas dificil", () => {
  assert.ok(puntajeDificultad(dificil) > puntajeDificultad(facil));
});

test("ordena de mas dificil a mas facil", () => {
  assert.deepEqual(ordenarPorDificultad([facil, medio, dificil]).map((u) => u.id), ["C", "B", "A"]);
});

test("es estable con unidades equivalentes", () => {
  const x = { id: "X", area: 50, fachadas: 2, frente: 6, fondo: 8 };
  const y = { id: "Y", area: 50, fachadas: 2, frente: 6, fondo: 8 };
  assert.deepEqual(ordenarPorDificultad([x, y]).map((u) => u.id), ["X", "Y"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd files/alice && node --test test/dificultad.test.mjs`
Expected: FAIL — módulo inexistente

- [ ] **Step 3: Write minimal implementation**

```js
// files/alice/src/modules/planos/dificultad.js
// La unidad dificil primero: es la que fuerza cambios de reparto.
export function puntajeDificultad(u = {}) {
  const area = Number(u.area) || 1;
  const fachadas = Math.max(1, Number(u.fachadas) || 1);
  const frente = Number(u.frente) || 1;
  const fondo = Number(u.fondo) || 1;
  const esbeltez = Math.max(frente, fondo) / Math.max(0.01, Math.min(frente, fondo));
  return (100 / area) + (10 / fachadas) + esbeltez;
}

export function ordenarPorDificultad(units = []) {
  return units
    .map((u, i) => ({ u, i, s: puntajeDificultad(u) }))
    .sort((a, b) => (b.s - a.s) || (a.i - b.i))
    .map(({ u }) => u);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd files/alice && node --test test/dificultad.test.mjs`
Expected: PASS, 3 tests

- [ ] **Step 5: Commit**

```bash
git add files/alice/src/modules/planos/dificultad.js files/alice/test/dificultad.test.mjs
git commit -m "feat(planos): resolver primero la unidad mas restrictiva"
```

---

### Task 4b: Recorte de polígonos contra la huella real

`packFloor` empaqueta sobre el **rectángulo envolvente orientado al frente**, no sobre la
huella. Con un lote rectangular coinciden y no se nota. Con uno irregular las piezas se
desbordan en las concavidades y el validador rechaza la propuesta entera.

Reproducción medida (huella real de Sebastián: 272.64 m² dentro de una envolvente de
31.0 × 14.5 = 449.5 m², o sea el 61 %):

```
── rectangular 31 x 14.5
   ✓ sin hallazgos de geometría
── irregular (trapecio con mordida)
   outside_buildable_footprint: 1D sale de la huella edificable
   incomplete_partition: La planta deja 56.33 m² sin asignar
```

Esta tarea recorta cada pieza contra la huella antes de emitir la propuesta.

**Files:**
- Create: `files/alice/src/modules/planos/clipFootprint.js`
- Test: `files/alice/test/clip-footprint.test.mjs`

**Interfaces:**
- Consumes: nada. Geometría pura.
- Produces:
  - `clipPolygon(subject, clip) -> Point[][]` — recorta `subject` contra `clip`. Devuelve
    **una lista** de anillos porque una pieza puede partirse en dos al cruzar una concavidad.
    `Point` es `{x, y}`. Devuelve `[]` si no queda nada.
  - `clipPieces(pieces, footprint, minArea = 1.0) -> {kept, dropped, split}` — aplica
    `clipPolygon` a cada pieza `{id, pts, ...}`; descarta restos con área menor a `minArea`;
    cuando una pieza queda partida, conserva **solo el fragmento mayor** y la cuenta en
    `split`. `kept` conserva todos los campos originales de la pieza con `pts` recortados.

**Nota de implementación:** la huella puede ser cóncava, así que Sutherland–Hodgman clásico
(que asume recortador convexo) no alcanza. Usá **Greiner–Hormann** o descomponé el recortador
en triángulos y uní los resultados. Si te resulta más simple y robusto: triangulá la huella
(fan desde el centroide no sirve en cóncavos — usá *ear clipping*), recortá el sujeto contra
cada triángulo con Sutherland–Hodgman, y devolvé los fragmentos con área > ε. No importa que
sea O(n·m): las huellas tienen decenas de vértices, no miles.

- [ ] **Step 1: Write the failing test**

```js
// files/alice/test/clip-footprint.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { clipPolygon, clipPieces } from "../src/modules/planos/clipFootprint.js";

const area = (pts) => {
  let s = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a.x * b.y - b.x * a.y; }
  return Math.abs(s) / 2;
};
const cuad = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];

test("una pieza enteramente dentro sale intacta en area", () => {
  const out = clipPolygon(cuad(2, 2, 4, 4), cuad(0, 0, 10, 10));
  assert.equal(out.length, 1);
  assert.equal(Math.round(area(out[0]) * 100) / 100, 4);
});

test("una pieza enteramente fuera desaparece", () => {
  assert.deepEqual(clipPolygon(cuad(20, 20, 24, 24), cuad(0, 0, 10, 10)), []);
});

test("una pieza que se desborda se recorta al area comun", () => {
  const out = clipPolygon(cuad(5, 5, 15, 15), cuad(0, 0, 10, 10));
  assert.equal(out.length, 1);
  assert.equal(Math.round(area(out[0]) * 100) / 100, 25);
});

test("recortador concavo: la pieza se parte en dos fragmentos", () => {
  // huella en U: dos brazos verticales unidos abajo
  const U = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 7, y: 10 },
             { x: 7, y: 3 }, { x: 3, y: 3 }, { x: 3, y: 10 }, { x: 0, y: 10 }];
  const banda = cuad(0, 5, 10, 7);           // cruza la muesca central
  const out = clipPolygon(banda, U);
  const total = out.reduce((s, ring) => s + area(ring), 0);
  assert.equal(out.length, 2, "debe partirse en dos brazos");
  assert.equal(Math.round(total * 100) / 100, 12);   // 2 brazos de 3 x 2
});

test("clipPieces conserva campos, descarta migajas y cuenta las partidas", () => {
  const U = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 7, y: 10 },
             { x: 7, y: 3 }, { x: 3, y: 3 }, { x: 3, y: 10 }, { x: 0, y: 10 }];
  const piezas = [
    { id: "a", role: "unidad", pts: cuad(0, 0, 3, 3) },      // dentro
    { id: "b", role: "unidad", pts: cuad(20, 20, 22, 22) },  // fuera
    { id: "c", role: "unidad", pts: cuad(0, 5, 10, 7) },     // se parte
    { id: "d", role: "unidad", pts: cuad(3.0, 5, 3.2, 5.1) },// migaja dentro de la muesca
  ];
  const { kept, dropped, split } = clipPieces(piezas, U, 1.0);
  assert.deepEqual(kept.map((p) => p.id).sort(), ["a", "c"]);
  assert.deepEqual(dropped.map((p) => p.id).sort(), ["b", "d"]);
  assert.equal(split, 1);
  assert.equal(kept.find((p) => p.id === "a").role, "unidad", "debe conservar los campos");
  assert.equal(Math.round(area(kept.find((p) => p.id === "c").pts) * 100) / 100, 6,
    "de la pieza partida queda solo el fragmento mayor");
});

test("no muta las piezas de entrada", () => {
  const p = [{ id: "x", pts: cuad(5, 5, 15, 15) }];
  const antes = JSON.stringify(p);
  clipPieces(p, cuad(0, 0, 10, 10));
  assert.equal(JSON.stringify(p), antes);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd files/alice && node --test test/clip-footprint.test.mjs`
Expected: FAIL — `Cannot find module '../src/modules/planos/clipFootprint.js'`

- [ ] **Step 3: Escribí la implementación**

Sin código dado: es la única tarea del plan donde el algoritmo es tuyo. Cumplí el contrato de
`Interfaces` y hacé pasar los seis tests. Restricciones: ESM puro, sin dependencias nuevas,
funciones puras y sin mutar la entrada. Los dos brazos del test de la U tienen que salir como
dos anillos separados — si tu algoritmo devuelve un solo anillo con un puente de ancho cero,
está mal.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd files/alice && node --test test/clip-footprint.test.mjs`
Expected: PASS, 6 tests

- [ ] **Step 5: Verificá contra el caso real**

Corré esto y pegá la salida en tu reporte. Es el caso que hoy falla en producción:

```bash
cd /Users/sebas/Desktop/ALICE/files/alice && node --input-type=module -e '
import { packFloor } from "./src/modules/planos/lote.js";
import { clipPieces } from "./src/modules/planos/clipFootprint.js";
const fp=[{x:0,y:0},{x:31,y:0},{x:31,y:5},{x:22,y:9},{x:22,y:14.5},{x:6,y:14.5},{x:6,y:9},{x:0,y:5}];
const r=packFloor(fp,0,{udsPiso:5,areaObjetivo:90});
const piezas=[...(r.core?[{id:"core",role:"core",pts:r.core.pts}]:[]),
  ...(r.corridors||[]).map((c,i)=>({id:`c${i}`,role:"circulacion",pts:c.pts})),
  ...r.units.map((u,i)=>({id:`u${i}`,role:"unidad",pts:u.pts}))];
const {kept,dropped,split}=clipPieces(piezas,fp);
console.log(`piezas ${piezas.length} → conservadas ${kept.length}, descartadas ${dropped.length}, partidas ${split}`);
'
```

Expected: conserva la mayoría de las piezas y descarta o recorta las que se desbordaban.
Si descarta casi todo, tu recorte está mal: reportalo como `DONE_WITH_CONCERNS`.

- [ ] **Step 6: Commit**

```bash
git add files/alice/src/modules/planos/clipFootprint.js files/alice/test/clip-footprint.test.mjs
git commit -m "feat(planos): recortar las piezas del piso contra la huella real"
```

---

### Task 5: Orquestador de la cadena

Encadena todo con inyección de dependencias, para que se pueda testear sin red ni modelo.

**Files:**
- Create: `files/alice/src/modules/planos/convergeFloor.js`
- Test: `files/alice/test/converge-floor.test.mjs`

**Interfaces:**
- Consumes: `dedupePartis` (T1), `createLedger`/`findingKey` (T2), `esDeVolumen`/`rebalancear` (T3), `ordenarPorDificultad` (T4).
- Produces: `convergeFloor(brief, deps, limits) -> Promise<Resultado>`.
  `deps = { planFloor, designUnit, critique, materialize, validate }` — todas async o sync, inyectadas.
  `limits = { vueltasPorUnidad: 3, llamadasPorPiso: 10 }`.
  `Resultado = { parti, unidades: {id, layout, findings}[], pendientes: string[], llamadas: number, motivo: "ok"|"tope_piso"|"bloqueado" }`.

- [ ] **Step 1: Write the failing test**

```js
// files/alice/test/converge-floor.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { convergeFloor } from "../src/modules/planos/convergeFloor.js";

const brief = { units: [{ id: "C", area: 40, fachadas: 1, frente: 8.4, fondo: 4.8 }] };
const parti = { id: "p1", core: { x: 7.4, y: 0, w: 5.2, d: 5 },
  units: [{ id: "C", x: 0, w: 8.4 }, { id: "A", x: 8.4, w: 7.4 }] };

const deps = (over = {}) => ({
  planFloor: async () => [parti, { ...parti, id: "p2", core: { ...parti.core, x: 0 } }],
  designUnit: async () => ({ ambientes: [] }),
  materialize: (d) => ({ rooms: [], ...d }),
  validate: () => ({ ok: true, errors: [] }),
  critique: async () => [],
  ...over,
});

test("converge sin hallazgos en una vuelta", async () => {
  const r = await convergeFloor(brief, deps());
  assert.equal(r.motivo, "ok");
  assert.equal(r.pendientes.length, 0);
});

test("descarta partis duplicados antes de elegir", async () => {
  const dup = deps({ planFloor: async () => [parti, { ...parti, id: "dup" }] });
  const r = await convergeFloor(brief, dup);
  assert.equal(r.partisDescartados, 1);
});

test("un hallazgo repetido dos vueltas bloquea la unidad y no hay tercera", async () => {
  let llamadas = 0;
  const terco = deps({
    critique: async () => { llamadas += 1; return [{ ambiente: "sala", regla: "area_min", severidad: "critical", nivel: "interior" }]; },
  });
  const r = await convergeFloor(brief, terco);
  assert.equal(r.motivo, "bloqueado");
  assert.ok(llamadas <= 2, `critique se llamo ${llamadas} veces, esperaba <= 2`);
  assert.deepEqual(r.pendientes, ["C"]);
});

test("un hallazgo de volumen reequilibra el parti en vez de reintentar el interior", async () => {
  let subidas = 0;
  let vuelta = 0;
  const vol = deps({
    critique: async () => {
      vuelta += 1;
      if (vuelta === 1) { subidas += 1; return [{ ambiente: "sala", regla: "no_cabe", severidad: "critical", nivel: "volumen" }]; }
      return [];
    },
  });
  const r = await convergeFloor(brief, vol);
  assert.equal(subidas, 1);
  assert.equal(r.motivo, "ok");
  assert.ok(r.parti.units.find((u) => u.id === "C").w > 8.4, "la unidad debio ensancharse");
});

test("respeta el tope de llamadas del piso", async () => {
  const infinito = deps({
    critique: async () => [{ ambiente: `x${Math.random()}`, regla: "area_min", severidad: "critical", nivel: "interior" }],
  });
  const r = await convergeFloor(brief, infinito, { vueltasPorUnidad: 99, llamadasPorPiso: 4 });
  assert.equal(r.motivo, "tope_piso");
  assert.ok(r.llamadas <= 4);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd files/alice && node --test test/converge-floor.test.mjs`
Expected: FAIL — módulo inexistente

- [ ] **Step 3: Write minimal implementation**

```js
// files/alice/src/modules/planos/convergeFloor.js
// La cadena: partis diversos -> unidad mas dificil primero -> materializar y validar
// -> critica estructurada -> corregir. Los hallazgos de volumen suben al reparto.
import { dedupePartis } from "./parti.js";
import { createLedger } from "./findingsLedger.js";
import { esDeVolumen, rebalancear } from "./rebalance.js";
import { ordenarPorDificultad } from "./dificultad.js";

const LIMITES = { vueltasPorUnidad: 3, llamadasPorPiso: 10 };

export async function convergeFloor(brief = {}, deps = {}, limits = {}) {
  const lim = { ...LIMITES, ...limits };
  const { planFloor, designUnit, critique, materialize, validate } = deps;
  const ledger = createLedger();
  let llamadas = 0;
  const tope = () => llamadas >= lim.llamadasPorPiso;

  llamadas += 1;
  const propuestos = await planFloor(brief);
  const { kept, dropped } = dedupePartis(propuestos);
  let parti = kept[0];

  const unidades = [];
  const pendientes = [];
  let motivo = "ok";

  for (const u of ordenarPorDificultad(brief.units || [])) {
    let vuelta = 0;
    let cerrada = false;
    let layout = null;

    while (vuelta < lim.vueltasPorUnidad) {
      if (tope()) { motivo = "tope_piso"; break; }
      vuelta += 1;
      llamadas += 1;

      const sobre = parti.units.find((s) => s.id === u.id) || {};
      const decision = await designUnit({ unidad: u, sobre, mustFix: ledger.mustFix(u.id) });
      layout = materialize(decision);
      const val = validate(layout);

      if (tope()) { motivo = "tope_piso"; break; }
      llamadas += 1;
      const findings = [...(val.errors || []).map((e) => ({ ...e, nivel: e.nivel || "interior" })),
                        ...(await critique({ unidad: u, layout }))];

      ledger.record(u.id, findings);
      if (!findings.length) { cerrada = true; break; }

      const deVolumen = findings.filter(esDeVolumen);
      if (deVolumen.length) {
        try { parti = rebalancear(parti, u.id, 0.60); } catch { /* sin margen: sigue como interior */ }
        continue;
      }
      if (ledger.bloqueado(u.id)) { motivo = "bloqueado"; break; }
    }

    unidades.push({ id: u.id, layout, findings: ledger.mustFix(u.id) });
    if (!cerrada) pendientes.push(u.id);
  }

  if (motivo === "ok" && pendientes.length) motivo = "bloqueado";
  return { parti, partisDescartados: dropped.length, unidades, pendientes, llamadas, motivo };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd files/alice && node --test test/converge-floor.test.mjs`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add files/alice/src/modules/planos/convergeFloor.js files/alice/test/converge-floor.test.mjs
git commit -m "feat(planos): orquestador convergente de planta tipica"
```

---

### Task 6: Cabida — botón de Tweedledum y fuera la flecha muerta

**Files:**
- Modify: `files/alice/src/modules/cabida/EsquemaPlanta.jsx` (quitar el botón de la línea ~545 y el handler `enviarBrief` de la ~390; agregar el botón nuevo al pie)
- Test: `files/alice/test/cabida-acciones.test.mjs`

**Interfaces:**
- Consumes: `convergeFloor` (T5), `planFloorWithTweedledum` (ya importado en el archivo).

**Tres cosas que las decisiones de la corrida anterior delegaron explícitamente a esta tarea y que hay que implementar acá, no en el orquestador:**

1. **Adaptador de `validate`.** `convergeFloor` espera `validate(layout) -> {ok, errors}` con `errors`
   como objetos que tengan `regla`. `validacion.js` devuelve `{fueraLote, sinPiso, aislados, total, ok,
   ids, mensajes}` — **no tiene `errors` ni `regla`**. Pasar `validate: validarPlan` crudo hace que
   `val.errors || []` sea `[]` siempre y en silencio, y la mitad determinista del §6.2 no corre. El
   adaptador debe mapear cada categoría (`fueraLote`, `sinPiso`, `aislados`) a un hallazgo con un
   `regla` distinto; si todos comparten `regla`, las claves del ledger colapsan y `bloqueado()` se
   dispara por problemas que no son el mismo.
2. **Cableado de `clipPieces`.** El orquestador deliberadamente no recorta polígonos. El `materialize`
   que se le inyecta debe recortar contra la huella con `clipPieces` de `planos/clipFootprint.js`, y
   propagar `dropped`/`split` a la UI para que un recorte con pérdida sea visible.
3. **Gancho de persistencia (spec §8).** `convergeFloor` hoy no tiene dónde persistir por etapa. Hay
   que agregarle una dependencia opcional `onStage(etapa, payload)` y llamarla al cerrar cada unidad,
   para que una caída no pierda lo hecho.
- Produces: nada nuevo hacia otras tareas.

- [ ] **Step 1: Write the failing test**

```js
// files/alice/test/cabida-acciones.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/modules/cabida/EsquemaPlanta.jsx", import.meta.url), "utf8");

test("ya no existe el boton '-> plano' por tipologia", () => {
  assert.ok(!src.includes("→ plano"), "el boton flecha sigue presente");
  assert.ok(!/const\s+enviarBrief\s*=/.test(src), "el handler enviarBrief sigue presente");
});

test("se conserva el camino real de aceptar el piso", () => {
  assert.ok(src.includes("Aceptar y enviar a Planos") || src.includes("acceptedFloorId"));
});

test("existe el boton de Tweedledum para crear poligonos", () => {
  assert.ok(/Tweedledum[\s\S]{0,40}crear pol/i.test(src), "falta el boton de Tweedledum");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd files/alice && node --test test/cabida-acciones.test.mjs`
Expected: FAIL en el primer y tercer test

- [ ] **Step 3: Aplicar los cambios en `EsquemaPlanta.jsx`**

1. Borrar el bloque `<button onClick={() => enviarBrief(t)} ...>` con su texto `{briefSent === t ? "brief listo ✓" : "→ plano"}` (línea ~545) y el estado `briefSent` que solo él usa.
2. Borrar `const enviarBrief = (tip) => { ... }` (línea ~390).
3. Al pie del panel, agregar:

```jsx
<button
  onClick={() => correrTweedledum()}
  disabled={corriendo}
  title="Tweedledum propone la planta tipica desde los numeros de esta cabida"
  style={{ width: "100%", padding: "10px 12px", marginTop: 12, cursor: "pointer",
           border: "1px solid #0A0B0F", borderRadius: 6, background: "#0A0B0F", color: "#fff",
           fontWeight: 600 }}>
  {corriendo ? "Tweedledum trabajando…" : "Tweedledum · crear polígonos"}
</button>
```

4. Y el handler, junto a los demás `useCallback` del archivo:

```jsx
const [corriendo, setCorriendo] = useState(false);
const correrTweedledum = useCallback(async () => {
  setCorriendo(true);
  try {
    const res = await convergeFloor(briefDeCabida(), {
      planFloor: (b) => planFloorWithTweedledum(b).then((r) => r.partis || []),
      designUnit: (a) => designWithTweedledum(a),
      critique: (a) => critiqueWithTweedledee(a).then((r) => r.findings || []),
      materialize: materializeInteriorLayout,
      validate: validarPlan,
    });
    setFloorRecord(res);
  } finally { setCorriendo(false); }
}, [briefDeCabida]);
```

Importar arriba: `convergeFloor` de `../planos/convergeFloor.js`, `designWithTweedledum` y `critiqueWithTweedledee` de `../planos/architecture.js`, `materializeInteriorLayout` de `../planos/feyd.js`, `validarPlan` de `../planos/validacion.js`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd files/alice && node --test test/cabida-acciones.test.mjs`
Expected: PASS, 3 tests

- [ ] **Step 5: Commit**

```bash
git add files/alice/src/modules/cabida/EsquemaPlanta.jsx files/alice/test/cabida-acciones.test.mjs
git commit -m "feat(cabida): boton de Tweedledum y retiro de la flecha muerta"
```

---

### Task 7: Retirar a Feyd

Se hace **después** de que la cadena nueva funcione, para no quedarse sin camino.

**Files:**
- Modify: `alicia-brain/src/server.js` (quitar `app.post("/api/arquitecto/disenar")` y `/corregir`)
- Modify: `alicia-brain/src/tools.js` (quitar la herramienta de delegación a Feyd)
- Modify: `files/alice/src/modules/planos/feyd.js` (quitar `disenarConFeyd` y `corregirConFeyd`)
- Modify: `files/alice/src/modules/planos/EditorPlanos.jsx` (quitar `generarTipoConFeyd` y su import)
- Test: `alicia-brain/test/feyd-retirado.test.mjs`

**Interfaces:**
- Consumes: la cadena de T5/T6 ya operativa.
- Produces: nada.

**ATENCIÓN:** `planos/feyd.js` **ya no es el cliente de Feyd** — es la capa de materialización del flujo nuevo (`preserveLockedRooms`, `splitAcceptedFloor`, `materializeUnitInteriors`, `materializeWithOneRevision`, `validateGeneratedInterior`, `resolveArchitectureProgram`, `planALayout`, `roomsALayout`, `layoutARooms`, `isRoomEditable`, `reanclarItems`). **Solo salen esas dos funciones.** Todo lo demás se conserva.

- [ ] **Step 1: Write the failing test**

```js
// alicia-brain/test/feyd-retirado.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

test("los endpoints de Feyd ya no existen", () => {
  const server = read("../src/server.js");
  assert.ok(!server.includes("/api/arquitecto/disenar"));
  assert.ok(!server.includes("/api/arquitecto/corregir"));
});

test("el frontend ya no llama a Feyd", () => {
  const feyd = read("../../files/alice/src/modules/planos/feyd.js");
  assert.ok(!feyd.includes("disenarConFeyd"));
  assert.ok(!feyd.includes("corregirConFeyd"));
});

test("la capa de materializacion sigue intacta", () => {
  const feyd = read("../../files/alice/src/modules/planos/feyd.js");
  for (const fn of ["preserveLockedRooms", "splitAcceptedFloor", "materializeUnitInteriors",
                    "materializeWithOneRevision", "validateGeneratedInterior", "reanclarItems"]) {
    assert.ok(feyd.includes(`export function ${fn}`) || feyd.includes(`export const ${fn}`) ||
              feyd.includes(`export async function ${fn}`), `falta ${fn}`);
  }
});

test("el editor ya no tiene el generador huerfano", () => {
  const ed = read("../../files/alice/src/modules/planos/EditorPlanos.jsx");
  assert.ok(!ed.includes("generarTipoConFeyd"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd alicia-brain && node --test test/feyd-retirado.test.mjs`
Expected: FAIL en los cuatro primeros asserts

- [ ] **Step 3: Aplicar los retiros**

Borrar, en este orden: el `generarTipoConFeyd` de `EditorPlanos.jsx` y `disenarConFeyd` de su import; las dos funciones de `feyd.js`; la herramienta de `tools.js` (bloque de `disenar_plano`, incluida su `description` y su handler que importa `./arquitecto.js`); y los dos `app.post` de `server.js`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd alicia-brain && node --test test/feyd-retirado.test.mjs && cd ../files/alice && node --test test/*.test.mjs`
Expected: PASS — y la suite del frontend sigue verde

- [ ] **Step 5: Commit**

```bash
git add alicia-brain/src/server.js alicia-brain/src/tools.js alicia-brain/test/feyd-retirado.test.mjs \
        files/alice/src/modules/planos/feyd.js files/alice/src/modules/planos/EditorPlanos.jsx
git commit -m "refactor: retirar a Feyd y dejar la cadena Tweedle como unico camino"
```

---

### Task 8: Renombres

Cosmético, pero es la mitad de la confusión. Se hace al final, con todo verde.

**Files:**
- Rename: `files/alice/src/modules/planos/feyd.js` → `files/alice/src/modules/planos/materialize.js`
- Modify: todos los importadores.
- Test: reusar la suite completa.

- [ ] **Step 1: Renombrar y actualizar importadores**

```bash
cd files/alice/src/modules/planos
git mv feyd.js materialize.js
cd ~/Desktop/ALICE
grep -rl '"\./feyd\.js"\|/planos/feyd\.js' files/alice/src files/alice/test \
  | xargs sed -i '' 's#\./feyd\.js#./materialize.js#g; s#/planos/feyd\.js#/planos/materialize.js#g'
```

- [ ] **Step 2: Renombrar el alias del motor determinista**

En `EditorPlanos.jsx`, cambiar el import `layout as feydLayout, layoutProfundo as feydLayoutProfundo` por `layout as layoutDeterminista, layoutProfundo as layoutDeterministaProfundo`, y actualizar sus usos.

- [ ] **Step 3: Correr toda la suite**

Run: `cd files/alice && node --test test/*.test.mjs && cd ../../alicia-brain && node --test test/*.test.mjs`
Expected: PASS en ambos paquetes

- [ ] **Step 4: Commit**

```bash
git add -A files/alice alicia-brain
git commit -m "refactor(planos): nombres honestos — materialize.js y layoutDeterminista"
```

---

### Task 9: Instrumentación de costo

El Sombrerero no puede medir costo por corrida. Esto le da el dato.

**Files:**
- Modify: `files/alice/src/modules/planos/convergeFloor.js` (acumular `usage`)
- Test: `files/alice/test/converge-usage.test.mjs`

**Interfaces:**
- Produces: `Resultado.usage = { input, output, cacheRead, cacheWrite, llamadas }`.

- [ ] **Step 1: Write the failing test**

```js
// files/alice/test/converge-usage.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { convergeFloor } from "../src/modules/planos/convergeFloor.js";

const parti = { id: "p", core: { x: 0, y: 0, w: 5, d: 5 }, units: [{ id: "C", x: 5, w: 8 }, { id: "A", x: 13, w: 7 }] };

test("acumula el usage de cada llamada de agente", async () => {
  const r = await convergeFloor({ units: [{ id: "C", area: 40, fachadas: 1, frente: 8, fondo: 5 }] }, {
    planFloor: async () => ({ partis: [parti], usage: { input: 100, output: 20 } }),
    designUnit: async () => ({ ambientes: [], usage: { input: 50, output: 10 } }),
    critique: async () => ({ findings: [], usage: { input: 30, output: 5 } }),
    materialize: (d) => d,
    validate: () => ({ ok: true, errors: [] }),
  });
  assert.equal(r.usage.input, 180);
  assert.equal(r.usage.output, 35);
  assert.equal(r.usage.llamadas, 3);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd files/alice && node --test test/converge-usage.test.mjs`
Expected: FAIL — `r.usage` es `undefined`

- [ ] **Step 3: Implementar**

En `convergeFloor.js`, aceptar que `planFloor`/`designUnit`/`critique` devuelvan `{partis|ambientes|findings, usage}` o el valor pelado, con un helper:

```js
const unwrap = (res, key) => {
  if (res && typeof res === "object" && !Array.isArray(res) && (key in res || "usage" in res)) {
    return { value: res[key] ?? res, usage: res.usage || null };
  }
  return { value: res, usage: null };
};
const acumular = (acc, u) => {
  if (!u) return acc;
  acc.input += u.input || 0; acc.output += u.output || 0;
  acc.cacheRead += u.cacheRead || 0; acc.cacheWrite += u.cacheWrite || 0;
  acc.llamadas += 1;
  return acc;
};
```

Inicializar `const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, llamadas: 0 };`, envolver las tres llamadas con `unwrap` + `acumular`, y devolver `usage` en el resultado.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd files/alice && node --test test/converge-usage.test.mjs && node --test test/converge-floor.test.mjs`
Expected: PASS ambos — los tests de T5 siguen verdes porque `unwrap` acepta el valor pelado

- [ ] **Step 5: Commit**

```bash
git add files/alice/src/modules/planos/convergeFloor.js files/alice/test/converge-usage.test.mjs
git commit -m "feat(planos): reportar el costo de cada corrida de la cadena"
```

---

## Fuera de este plan

- **Quitar los pasos del Editor de Planos** (modales de paso 2 y 3, panel lateral, visor). Son ~600 líneas de `EditorPlanos.jsx` y merecen su propio plan, después de que la cadena entregue de punta a punta.
- **La lámina en lenguaje FDC** (§10 del spec): independiente, no bloquea nada.
- **Encargo 20 × 15** como fixture de regresión, una vez que exista `convergeFloor`.

---

### Task 10: El contrato de hallazgo estructurado (§6.2 del spec)

**Sin esta tarea el mecanismo §6.3 no se dispara nunca.** Es la que faltaba: ninguna de las
tareas 1 a 9 toca el prompt de Tweedledee ni el normalizador, así que el contrato de hallazgo
del spec no tiene dueño.

**El problema, verificado:** `esDeVolumen()` mira `f.nivel === "volumen"` o
`f.regla ∈ {no_cabe, sin_fachada, sobre_insuficiente}`. Pero `normalizeCritiqueOutput`
(`alicia-brain/src/architecture/schemas.js`) construye el objeto con lista blanca y devuelve
`{id, severity, category, title, observation, consequence, recommendation, location,
regulatoryStatus, evidenceRefs}`. No hay `nivel`, `regla`, `ambiente` ni `unidad` — y aunque el
modelo los emitiera, el normalizador los descarta. El prompt tampoco los pide. Con la crítica
real, `esDeVolumen` es siempre `false`.

Efecto secundario: `findingKey` queda como `unidad||category`, así que dos hallazgos distintos
de la misma categoría colapsan en una clave y `bloqueado()` se dispara por problemas que no son
el mismo.

**Files:**
- Modify: `alicia-brain/src/architecture/schemas.js` (`normalizeCritiqueOutput`, `CRITIQUE_OUTPUT_SCHEMA`)
- Modify: `alicia-brain/src/architecture/prompts/tweedledee.v1.js`
- Test: `alicia-brain/test/architecture-contracts.test.mjs`

**Qué agregar al hallazgo:** `unidad` (a qué unidad se refiere), `ambiente` (qué ambiente),
`regla` (el discriminante estable del problema — es lo que hace única la clave del ledger),
`nivel` (`"interior"` o `"volumen"`), y opcionalmente `medida`/`esperado`. Los campos actuales
se conservan: esto suma, no reemplaza.

**Criterio de aceptación:** un hallazgo de «no cabe el programa en este sobre» debe llegar a
`esDeVolumen()` como `true`. Test de extremo a extremo desde la salida cruda del modelo hasta
`esDeVolumen`.
