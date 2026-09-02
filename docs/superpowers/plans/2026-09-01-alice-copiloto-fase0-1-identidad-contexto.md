# Alice Copiloto · Fases 0 y 1 · Identidad real + Contexto vivo del ERP

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el cerebro sepa **quién** le está hablando (hoy no lo sabe: cualquiera puede impersonar al CEO) y **dónde está parado** ese usuario dentro del ERP, y que el space muestre el hilo real de la conversación en vez de una copia local desincronizada.

**Architecture:** Tres piezas puras y testeables (`identity.js` y `history.js` en el cerebro, `snapshot.js` en el ERP) más el cableado mínimo. La identidad sale del JWT de Supabase vía email → `profiles.email`. El contexto del ERP se captura una sola vez por turno en el browser, viaja en el body de `/api/chat`, y se inyecta en el system prompt **después del breakpoint de caché** para no invalidar el prompt caching. Ningún transporte nuevo todavía: `/api/chat` sigue siendo request/response.

**Tech Stack:** Node 22 ESM · `node:sqlite` (`DatabaseSync`) · Express 4 · `node --test` · React 18 + Vite · Supabase Auth

**Spec:** `docs/superpowers/specs/2026-09-01-alice-copiloto-erp-design.md`

## Global Constraints

- **El userId NUNCA sale de `req.body`.** Sale de `req.aliceUser`, que lo pone el gate. Única excepción: impersonación, y solo si el actor es el CEO.
- **`CEO_ID = "sb"`.** Hoy está en `alicia-brain/src/server.js:285`; pasa a `identity.js` y se importa. No duplicar la constante.
- **El contexto del ERP va DESPUÉS del breakpoint de caché** (`server.js:598-601`, junto a `nowLima` + `liveContext`). Meterlo en el bloque cacheado invalidaría el prefijo en cada navegación. Ver deuda D15 del spec.
- **Presupuesto del snapshot: 2.000 caracteres en el cliente, 2.400 de tope duro en el servidor.** El servidor no confía en el cap del cliente.
- **El módulo activo nunca se trunca.** Si él solo excede el presupuesto, se manda igual; lo que se suelta son los otros módulos.
- **Las funciones con lógica reciben `db` explícito** como parámetro, siguiendo el patrón de `readConversation(db, personaId, limit)` (`alicia-brain/src/tools.js:10`). Es lo que hace los tests posibles con `:memory:`.
- **Fuera de alcance de este plan:** sacar el panel de perfiles del space (va en el plan de Fase 2), SSE, client tools, motores, voz, visión.

---

## File Structure

**Cerebro (`alicia-brain/`)**

| Archivo | Responsabilidad |
|---|---|
| `src/identity.js` · **nuevo** | `CEO_ID`, `emailToUserId(db, email)`, `resolveActingUser({actorId, requestedUserId})`. Puro. |
| `src/history.js` · **nuevo** | `readThread(db, userId, limit)` — el hilo con canal, para el ERP. Puro. |
| `src/erp-context.js` · **nuevo** | `renderErpContext(snapshot, cap)` — snapshot → bloque de texto para el prompt. Puro. |
| `src/db.js:155` · modificar | Migración: sembrar `profiles.email` de las 7 personas. |
| `src/server.js` · modificar | `fetchSupabaseUser`, `req.aliceUser` en `panelGate`, `/api/chat` con identidad real + `erpContext`, `GET /api/copilot/history`. |
| `package.json` · modificar | Agregar script `test`. |
| `test/identity.test.mjs` · **nuevo** | |
| `test/history.test.mjs` · **nuevo** | |
| `test/erp-context.test.mjs` · **nuevo** | |

**ERP (`files/alice/`)**

| Archivo | Responsabilidad |
|---|---|
| `src/copilot/snapshot.js` · **nuevo** | `buildSnapshot(entries, activeModule, budget)`. Puro, sin JSX, importable por `node --test`. |
| `src/copilot/ERPContext.jsx` · **nuevo** | Provider + `useERPContext(id, describe)` + `useCopilotSnapshot()`. `setActive` queda interno: nada fuera del provider lo necesita todavía. |
| `src/App.jsx:564` · modificar | Envolver `<HyggeOS>` con el provider. |
| `src/modules/cabida/CabidaView.jsx` · modificar | Primer módulo que se describe. |
| `src/modules/alicia/AliciaView.jsx` · modificar | Hilo del servidor + badges de canal + mandar el snapshot. |
| `test/copilot-snapshot.test.mjs` · **nuevo** | |

---

# FASE 0 · Identidad real

### Task 1: `identity.js` — resolución de identidad, pura y testeada

**Files:**
- Create: `alicia-brain/src/identity.js`
- Test: `alicia-brain/test/identity.test.mjs`
- Modify: `alicia-brain/package.json`

**Interfaces:**
- Consumes: nada.
- Produces: `CEO_ID: string`, `emailToUserId(db, email) -> string|null`, `resolveActingUser({actorId, requestedUserId}) -> {ok:true, actorId, userId, impersonating}|{ok:false, error}`.

- [ ] **Step 1: Agregar el script `test` que falta**

`alicia-brain/package.json` tiene 36 archivos de test y ningún script para correrlos. En el bloque `"scripts"`, agregar como primera entrada:

```json
    "test": "node --test test/*.test.mjs",
```

- [ ] **Step 2: Escribir el test que falla**

Crear `alicia-brain/test/identity.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { CEO_ID, emailToUserId, resolveActingUser } from "../src/identity.js";

function db0() {
  const d = new DatabaseSync(":memory:");
  d.exec(`CREATE TABLE profiles (user_id TEXT PRIMARY KEY, name TEXT, email TEXT);`);
  d.exec(`INSERT INTO profiles (user_id,name,email) VALUES
    ('sb','Sebastián','sebastian@hygge.pe'),
    ('jt','Jose','jose@hygge.pe'),
    ('aa','Ariel',NULL)`);
  return d;
}

test("emailToUserId mapea el email al userId interno", () => {
  assert.equal(emailToUserId(db0(), "jose@hygge.pe"), "jt");
});

test("emailToUserId ignora mayúsculas y espacios", () => {
  assert.equal(emailToUserId(db0(), "  JOSE@Hygge.PE "), "jt");
});

test("emailToUserId devuelve null para un email desconocido", () => {
  assert.equal(emailToUserId(db0(), "intruso@gmail.com"), null);
});

test("emailToUserId devuelve null si no hay email", () => {
  assert.equal(emailToUserId(db0(), null), null);
  assert.equal(emailToUserId(db0(), ""), null);
});

test("sin userId pedido, actuás como vos mismo", () => {
  const r = resolveActingUser({ actorId: "jt" });
  assert.deepEqual(r, { ok: true, actorId: "jt", userId: "jt", impersonating: false });
});

test("pedir tu propio userId no cuenta como impersonación", () => {
  const r = resolveActingUser({ actorId: "jt", requestedUserId: "jt" });
  assert.equal(r.impersonating, false);
});

test("un colaborador NO puede impersonar al CEO", () => {
  const r = resolveActingUser({ actorId: "jt", requestedUserId: "sb" });
  assert.deepEqual(r, { ok: false, error: "impersonacion_no_permitida" });
});

test("un admin que no es CEO tampoco puede impersonar", () => {
  const r = resolveActingUser({ actorId: "vd", requestedUserId: "jt" });
  assert.equal(r.ok, false);
});

test("el CEO sí puede ver como otro (el 'ver como' del panel)", () => {
  const r = resolveActingUser({ actorId: CEO_ID, requestedUserId: "jt" });
  assert.deepEqual(r, { ok: true, actorId: "sb", userId: "jt", impersonating: true });
});

test("sin actorId no hay acceso", () => {
  assert.deepEqual(resolveActingUser({ actorId: null, requestedUserId: "sb" }),
    { ok: false, error: "no_auth" });
});
```

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `cd alicia-brain && npm test -- --test-name-pattern="emailToUserId|impersona|actuás|CEO|actorId"`
Expected: FAIL — `Cannot find module '../src/identity.js'`

- [ ] **Step 4: Escribir la implementación mínima**

Crear `alicia-brain/src/identity.js`:

```js
// Quién es quién. Antes de esto el gate contestaba "¿hay alguien logueado?" y
// /api/chat le creía el userId al body: cualquiera del equipo podía mandar
// userId:"sb" y quedarse con las tools, el historial y las memorias del CEO.
// Acá la identidad sale del JWT y el body deja de tener voto.

export const CEO_ID = "sb";

// El puente entre las dos identidades: Supabase conoce emails, el cerebro
// conoce ids cortos (sb, vd, jt…). profiles.email es la tabla de traducción.
export function emailToUserId(db, email) {
  const e = String(email || "").trim();
  if (!e) return null;
  const row = db.prepare(
    "SELECT user_id FROM profiles WHERE lower(email) = lower(?)"
  ).get(e);
  return row?.user_id || null;
}

// Solo el CEO puede mirar la conversación de otro (es el "ver como" del panel).
// Para todos los demás, pedir otro userId es un intento de impersonación.
export function resolveActingUser({ actorId, requestedUserId } = {}) {
  if (!actorId) return { ok: false, error: "no_auth" };
  if (!requestedUserId || requestedUserId === actorId) {
    return { ok: true, actorId, userId: actorId, impersonating: false };
  }
  if (actorId !== CEO_ID) return { ok: false, error: "impersonacion_no_permitida" };
  return { ok: true, actorId, userId: requestedUserId, impersonating: true };
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `cd alicia-brain && npm test`
Expected: los 10 tests nuevos en PASS, y **los 36 archivos existentes también en PASS** (es la primera vez que la suite corre entera con un script; si algo ya estaba roto, aparece acá — anotarlo y no arreglarlo en esta tarea).

- [ ] **Step 6: Commit**

```bash
git add alicia-brain/src/identity.js alicia-brain/test/identity.test.mjs alicia-brain/package.json
git commit -m "feat(identity): resolución de identidad pura + script test que faltaba"
```

---

### Task 2: Sembrar los emails del equipo

Sin esto, `emailToUserId` solo resuelve a `sb`: la migración de `db.js:156` únicamente sembró al CEO. Además desbloquea el pendiente de `HANDOFF.md` §4.2 (`check_availability` hoy solo ve a Sebastián).

**Files:**
- Modify: `alicia-brain/src/db.js:155-156`
- Test: `alicia-brain/test/identity.test.mjs` (agregar al final)

**Interfaces:**
- Consumes: `emailToUserId(db, email)` de la Task 1.
- Produces: `seedTeamEmails(db)` exportada desde `src/db.js`.

- [ ] **Step 1: Escribir el test que falla**

Agregar al final de `alicia-brain/test/identity.test.mjs`:

```js
import { seedTeamEmails } from "../src/db.js";

test("seedTeamEmails deja a las 7 personas resolubles por email", () => {
  const d = new DatabaseSync(":memory:");
  d.exec(`CREATE TABLE profiles (user_id TEXT PRIMARY KEY, name TEXT, email TEXT);`);
  for (const id of ["sb","vd","jt","jm","aa","ac","jmg"]) {
    d.exec(`INSERT INTO profiles (user_id,name) VALUES ('${id}','x')`);
  }
  seedTeamEmails(d);
  assert.equal(emailToUserId(d, "sebastian@hygge.pe"), "sb");
  assert.equal(emailToUserId(d, "vane@hygge.pe"), "vd");
  assert.equal(emailToUserId(d, "jose@hygge.pe"), "jt");
  assert.equal(emailToUserId(d, "joel@hygge.pe"), "jm");
  assert.equal(emailToUserId(d, "ariel@bam.pe"), "aa");
  assert.equal(emailToUserId(d, "andre@hygge.pe"), "ac");
  assert.equal(emailToUserId(d, "galup@hygge.pe"), "jmg");
});

test("seedTeamEmails NO pisa un email ya cargado a mano", () => {
  const d = new DatabaseSync(":memory:");
  d.exec(`CREATE TABLE profiles (user_id TEXT PRIMARY KEY, name TEXT, email TEXT);`);
  d.exec(`INSERT INTO profiles (user_id,name,email) VALUES ('jt','Jose','jose.torres@hygge.pe')`);
  seedTeamEmails(d);
  assert.equal(emailToUserId(d, "jose.torres@hygge.pe"), "jt");
  assert.equal(emailToUserId(d, "jose@hygge.pe"), null);
});

test("seedTeamEmails es idempotente", () => {
  const d = new DatabaseSync(":memory:");
  d.exec(`CREATE TABLE profiles (user_id TEXT PRIMARY KEY, name TEXT, email TEXT);`);
  d.exec(`INSERT INTO profiles (user_id,name) VALUES ('jt','Jose')`);
  seedTeamEmails(d);
  seedTeamEmails(d);
  assert.equal(emailToUserId(d, "jose@hygge.pe"), "jt");
});

test("seedTeamEmails no crea perfiles que no existen", () => {
  const d = new DatabaseSync(":memory:");
  d.exec(`CREATE TABLE profiles (user_id TEXT PRIMARY KEY, name TEXT, email TEXT);`);
  seedTeamEmails(d);
  assert.equal(d.prepare("SELECT COUNT(*) c FROM profiles").get().c, 0);
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd alicia-brain && npm test -- --test-name-pattern="seedTeamEmails"`
Expected: FAIL — `seedTeamEmails is not a function`

- [ ] **Step 3: Escribir la implementación**

En `alicia-brain/src/db.js`, **reemplazar** las dos líneas de la migración actual:

```js
  try { db.exec("ALTER TABLE profiles ADD COLUMN email TEXT"); } catch {}
  try { db.exec("UPDATE profiles SET email = 'sebastian@hygge.pe' WHERE user_id = 'sb' AND (email IS NULL OR email = '')"); } catch {}
```

por:

```js
  try { db.exec("ALTER TABLE profiles ADD COLUMN email TEXT"); } catch {}
  try { seedTeamEmails(db); } catch {}
```

y agregar, a nivel de módulo en el mismo archivo:

```js
// El roster espeja files/alice/src/auth/users.js, que es la fuente de verdad de
// la UI. Se duplica a propósito: el cerebro no puede importar del bundle del ERP,
// y sin email en profiles nadie salvo sb resuelve su identidad desde el JWT.
// Si cambia un email allá, cambiarlo acá.
const TEAM_EMAILS = {
  sb:  "sebastian@hygge.pe",
  vd:  "vane@hygge.pe",
  jt:  "jose@hygge.pe",
  jm:  "joel@hygge.pe",
  aa:  "ariel@bam.pe",
  ac:  "andre@hygge.pe",
  jmg: "galup@hygge.pe",
};

// Solo rellena huecos: si alguien cargó un email a mano con
// PATCH /api/profile/:id/email, ese gana. Idempotente.
export function seedTeamEmails(db) {
  const stmt = db.prepare(
    "UPDATE profiles SET email = ? WHERE user_id = ? AND (email IS NULL OR email = '')"
  );
  for (const [userId, email] of Object.entries(TEAM_EMAILS)) stmt.run(email, userId);
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd alicia-brain && npm test -- --test-name-pattern="seedTeamEmails"`
Expected: PASS (4 tests)

- [ ] **Step 5: Correr la suite completa**

Run: `cd alicia-brain && npm test`
Expected: PASS. En particular `test/db-migration.test.mjs` sigue verde.

- [ ] **Step 6: Commit**

```bash
git add alicia-brain/src/db.js alicia-brain/test/identity.test.mjs
git commit -m "feat(identity): sembrar emails del equipo en profiles (desbloquea HANDOFF 4.2)"
```

---

### Task 3: El gate identifica y `/api/chat` deja de creerle al body

**Files:**
- Modify: `alicia-brain/src/server.js:65-80` (`verifySupabaseJWT` → `fetchSupabaseUser`)
- Modify: `alicia-brain/src/server.js:94-120` (`panelGate` pone `req.aliceUser`)
- Modify: `alicia-brain/src/server.js:285` (borrar el `CEO_ID` duplicado)
- Modify: `alicia-brain/src/server.js:1157-1167` (`/api/chat`)

**Interfaces:**
- Consumes: `CEO_ID`, `emailToUserId`, `resolveActingUser` (Task 1); `getDB()` de `./db.js`.
- Produces: `req.aliceUser = { id: string, email?: string, via: "panel"|"erp"|"dev"|"body" }` disponible en toda ruta bajo `/api` que haya pasado el gate.

- [ ] **Step 1: Importar identity y borrar la constante duplicada**

En `alicia-brain/src/server.js`, agregar al bloque de imports:

```js
import { CEO_ID, emailToUserId, resolveActingUser } from "./identity.js";
```

y **borrar** la línea 285:

```js
const CEO_ID = "sb";
```

Run: `cd alicia-brain && node --check src/server.js`
Expected: sin salida (sintaxis ok, sin declaración duplicada)

- [ ] **Step 2: Convertir `verifySupabaseJWT` en `fetchSupabaseUser`**

Reemplazar la función completa de `server.js:65-80` por:

```js
// Antes devolvía un booleano y tiraba la identidad — de ahí venía el agujero:
// el gate sabía que había ALGUIEN logueado, no QUIÉN. Ahora devuelve el usuario.
async function fetchSupabaseUser(token) {
  if (!token || token.length < 100) return null; // los JWT de Supabase son largos; los del panel no llegan acá
  const hit = _jwtCache.get(token);
  if (hit && Date.now() < hit.until) return hit.user;
  let user = null;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (r.ok) {
      const j = await r.json();
      if (j?.email) user = { email: j.email, sub: j.id };
    }
  } catch { user = null; }
  if (_jwtCache.size > 500) _jwtCache.clear();
  // Cachear el fallo poco (1 min) y el éxito más (10 min), igual que antes.
  _jwtCache.set(token, { user, until: Date.now() + (user ? 10 * 60_000 : 60_000) });
  return user;
}
```

- [ ] **Step 3: Que `panelGate` deje la identidad en el request**

En `server.js`, dentro de `panelGate`, reemplazar cada `return next()` de las ramas autenticadas por una versión que setea `req.aliceUser`, y las dos últimas líneas por la resolución de identidad. Queda así de la línea del `GATE_DEV_OPEN` en adelante:

```js
  if (process.env.GATE_DEV_OPEN === "1"
    && ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket?.remoteAddress || "")
    && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(String(req.headers.host || ""))) {
    req.aliceUser = { id: CEO_ID, via: "dev" };
    return next();
  }
  const bodyKey = req.headers["x-body-key"];
  if (BODY_KEY && bodyKey && bodyKey.length === BODY_KEY.length
    && crypto.timingSafeEqual(Buffer.from(bodyKey), Buffer.from(BODY_KEY))) {
    req.aliceUser = { id: process.env.EMBODIED_USER_ID || CEO_ID, via: "body" };
    return next();
  }
  if (req.headers["x-agent-key"] && p.startsWith("/agents/")) return next();
  if (!PANEL_PASSWORD) return res.status(503).json({ error: "panel_locked", detail: "PANEL_PASSWORD no configurado en Railway" });
  const auth = req.headers.authorization || "";
  const tok = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (verifyToken(tok)) {                              // token del panel = sesión de sb
    req.aliceUser = { id: CEO_ID, via: "panel" };
    return next();
  }
  const su = await fetchSupabaseUser(tok);             // sesión del ERP (equipo logueado)
  if (su) {
    const uid = emailToUserId(getDB(), su.email);
    // Logueado en Supabase pero sin perfil en el cerebro: entra al ERP, no a Alicia.
    if (!uid) return res.status(403).json({ error: "usuario_sin_perfil", detail: su.email });
    req.aliceUser = { id: uid, email: su.email, via: "erp" };
    return next();
  }
  return res.status(401).json({ error: "no_auth" });
}
```

Las rutas `PANEL_PUBLIC` y `/agents/*` siguen pasando **sin** `req.aliceUser`: no lo usan.

- [ ] **Step 4: Que `/api/chat` tome el userId del gate**

Reemplazar `server.js:1157-1167` por:

```js
app.post("/api/chat", async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Falta message" });
  // El userId del body ya NO manda: solo puede pedir "ver como" y solo si sos el CEO.
  const act = resolveActingUser({ actorId: req.aliceUser?.id, requestedUserId: req.body.userId });
  if (!act.ok) return res.status(act.error === "no_auth" ? 401 : 403).json({ error: act.error });
  try {
    const result = await processAliciaMessage(act.userId, message, "app");
    res.json(result);
  } catch (e) {
    console.error("Chat error:", e.message);
    res.status(500).json({ error: e.message });
  }
});
```

- [ ] **Step 5: Verificar el arranque y el agujero cerrado, a mano**

Run:
```bash
cd alicia-brain && node --check src/server.js && GATE_DEV_OPEN=1 PANEL_PASSWORD=test npm start &
sleep 3
# Con el bypass de dev (= CEO), pedir "ver como jt" DEBE funcionar:
curl -s -X POST http://127.0.0.1:3001/api/chat -H 'Content-Type: application/json' \
  -d '{"message":"hola","userId":"jt"}' | head -c 200
# Sin auth y desde un Host que no es loopback, DEBE dar 401:
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:3001/api/chat \
  -H 'Host: aliceai.bam.pe' -H 'Content-Type: application/json' -d '{"message":"hola","userId":"sb"}'
```
Expected: la primera devuelve una respuesta (o un error de LLM, pero **no** 401/403); la segunda imprime `401`.

Cortar el server con `kill %1`.

- [ ] **Step 6: Correr la suite completa**

Run: `cd alicia-brain && npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add alicia-brain/src/server.js
git commit -m "fix(seguridad): el gate identifica al usuario; /api/chat deja de confiar en req.body.userId

Antes verifySupabaseJWT devolvía un booleano y /api/chat leía el userId
del body: cualquier miembro del equipo logueado en el ERP podía mandar
userId:'sb' y obtener las tools del CEO, su historial y sus memorias.
Rompía la regla del HANDOFF 8 (cada uno ve solo SU conversación)."
```

---

# FASE 1 · Contexto vivo del ERP

### Task 4: `snapshot.js` — armar el snapshot con presupuesto, en el ERP

**Files:**
- Create: `files/alice/src/copilot/snapshot.js`
- Test: `files/alice/test/copilot-snapshot.test.mjs`

**Interfaces:**
- Consumes: nada.
- Produces: `SNAPSHOT_BUDGET: number` (2000), `buildSnapshot(entries, activeModule, budget?) -> { active, others, dropped }`.
  - `entries`: `Array<{ module, title, entity, state, derived, actions }>`
  - `active`: la entry completa del módulo activo, o `null`
  - `others`: `Array<{ module, title, entity }>` — solo la cabecera
  - `dropped`: `number` — cuántos módulos se soltaron por presupuesto

- [ ] **Step 1: Escribir el test que falla**

Crear `files/alice/test/copilot-snapshot.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSnapshot, SNAPSHOT_BUDGET } from "../src/copilot/snapshot.js";

const cabida = {
  module: "cabida",
  title: "Cabida · PU01 Paula Ugarriza",
  entity: { type: "proyecto", id: "PU01" },
  state: { terreno: 640, pisos: 8, areaDpto: 75, precioM2: 2100 },
  derived: { dptos: 42, vendible: 3180, margen: 1240000 },
  actions: ["cabida.setParams", "cabida.recalcular"],
};
const growth = { module: "growth", title: "Growth", entity: null, state: { n: 29 }, actions: ["growth.abrir"] };
const radar  = { module: "radar",  title: "Radar",  entity: null, state: { proyectos: 688 } };

test("el módulo activo va completo, con state, derived y actions", () => {
  const s = buildSnapshot([cabida, growth], "cabida");
  assert.equal(s.active.module, "cabida");
  assert.deepEqual(s.active.derived, cabida.derived);
  assert.deepEqual(s.active.actions, cabida.actions);
});

test("los otros módulos van solo con cabecera, sin state ni actions", () => {
  const s = buildSnapshot([cabida, growth, radar], "cabida");
  assert.equal(s.others.length, 2);
  assert.deepEqual(Object.keys(s.others[0]).sort(), ["entity", "module", "title"]);
  assert.equal(s.others[0].state, undefined);
});

test("sin módulo activo, active es null y no explota", () => {
  const s = buildSnapshot([growth, radar], "inexistente");
  assert.equal(s.active, null);
  assert.equal(s.others.length, 2);
});

test("con la lista vacía devuelve una estructura vacía usable", () => {
  assert.deepEqual(buildSnapshot([], "cabida"), { active: null, others: [], dropped: 0 });
});

test("respeta el presupuesto soltando otros módulos", () => {
  const muchos = Array.from({ length: 40 }, (_, i) => ({
    module: `m${i}`, title: `Módulo número ${i} con un título largo para ocupar lugar`, entity: null,
  }));
  const s = buildSnapshot([cabida, ...muchos], "cabida", 600);
  assert.ok(JSON.stringify(s).length <= 600, `pasó el presupuesto: ${JSON.stringify(s).length}`);
  assert.ok(s.dropped > 0);
});

test("el módulo activo NUNCA se trunca, aunque él solo exceda el presupuesto", () => {
  const gordo = { ...cabida, state: { blob: "x".repeat(3000) } };
  const s = buildSnapshot([gordo, growth], "cabida", 100);
  assert.equal(s.active.state.blob.length, 3000);
  assert.equal(s.others.length, 0);
  assert.equal(s.dropped, 1);
});

test("el presupuesto por defecto son 2000 caracteres", () => {
  assert.equal(SNAPSHOT_BUDGET, 2000);
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd files/alice && node --test test/copilot-snapshot.test.mjs`
Expected: FAIL — `Cannot find module '../src/copilot/snapshot.js'`

- [ ] **Step 3: Escribir la implementación**

Crear `files/alice/src/copilot/snapshot.js`:

```js
// Lo que Alicia ve de tu pantalla. Se arma UNA vez por turno, al mandar el
// mensaje — ni por render ni por polling: así el costo es acotado y previsible.
// Archivo sin JSX a propósito, para que `node --test` lo pueda importar directo.

export const SNAPSHOT_BUDGET = 2000;

// Cabecera de un módulo que NO es el activo: alcanza para que Alicia sepa que
// existe y pueda pedir su detalle con una tool, sin pagar por todos.
const cabecera = (e) => ({ module: e.module, title: e.title, entity: e.entity ?? null });

export function buildSnapshot(entries, activeModule, budget = SNAPSHOT_BUDGET) {
  const list = Array.isArray(entries) ? entries : [];
  const active = list.find((e) => e.module === activeModule) ?? null;
  const others = list.filter((e) => e.module !== activeModule).map(cabecera);
  const total = others.length;

  // El activo es intocable: es lo que la persona está mirando ahora mismo, y un
  // parámetro truncado le haría dar un número mal. Lo que se suelta son los otros.
  while (others.length > 0 && JSON.stringify({ active, others, dropped: total - others.length }).length > budget) {
    others.pop();
  }
  return { active, others, dropped: total - others.length };
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd files/alice && node --test test/copilot-snapshot.test.mjs`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add files/alice/src/copilot/snapshot.js files/alice/test/copilot-snapshot.test.mjs
git commit -m "feat(copilot): snapshot del contexto del ERP con presupuesto de tokens"
```

---

### Task 5: `ERPContext.jsx` — el registro, y Cabida como primer módulo que se describe

**Files:**
- Create: `files/alice/src/copilot/ERPContext.jsx`
- Modify: `files/alice/src/App.jsx:564`
- Modify: `files/alice/src/modules/cabida/CabidaView.jsx`

**Interfaces:**
- Consumes: `buildSnapshot`, `SNAPSHOT_BUDGET` (Task 4).
- Produces:
  - `<ERPContextProvider>{children}</ERPContextProvider>`
  - `useERPContext(moduleId, describeFn)` — registra el módulo; `describeFn` se guarda en un ref, así que **no** hace falta memoizarla.
  - `useCopilotSnapshot() -> () => ({active, others, dropped})` — la función que llama AliciaView al mandar un turno.

- [ ] **Step 1: Escribir el provider**

Crear `files/alice/src/copilot/ERPContext.jsx`:

```jsx
// El registro por donde el ERP le cuenta a Alicia dónde está parada la persona.
// Vive acá y no en HyggeOS.jsx a propósito: ese archivo tiene 16.553 líneas y
// no queremos que esto crezca adentro. Lo único que entra allá son llamadas
// puntuales a useERPContext.
import { createContext, useCallback, useContext, useEffect, useRef } from "react";
import { buildSnapshot } from "./snapshot.js";

const Ctx = createContext(null);

export function ERPContextProvider({ children }) {
  // Refs y no estado: registrarse o cambiar de módulo NO debe re-renderizar el
  // ERP entero. El snapshot se lee recién cuando se manda un turno.
  const registry = useRef(new Map());   // moduleId → () => descripción
  const activeId = useRef(null);

  const register = useCallback((moduleId, describeFn) => {
    registry.current.set(moduleId, describeFn);
    return () => registry.current.delete(moduleId);
  }, []);

  const setActive = useCallback((moduleId) => { activeId.current = moduleId; }, []);

  const snapshot = useCallback(() => {
    const entries = [];
    for (const [moduleId, describe] of registry.current) {
      // Un describe() roto no puede tumbar el turno: se saltea ese módulo.
      try {
        const d = describe();
        if (d) entries.push({ module: moduleId, ...d });
      } catch (e) {
        console.warn(`[copilot] describe() de "${moduleId}" falló:`, e);
      }
    }
    return buildSnapshot(entries, activeId.current);
  }, []);

  return <Ctx.Provider value={{ register, setActive, snapshot }}>{children}</Ctx.Provider>;
}

// Registra un módulo y lo marca como activo mientras esté montado.
// describeFn se guarda en un ref: cambiarla en cada render no re-registra nada,
// así que el módulo NO necesita envolverla en useCallback.
export function useERPContext(moduleId, describeFn) {
  const ctx = useContext(Ctx);
  const fn = useRef(describeFn);
  fn.current = describeFn;

  useEffect(() => {
    if (!ctx) return;                       // sin provider (tests, storybook) no hace nada
    const unregister = ctx.register(moduleId, () => fn.current());
    ctx.setActive(moduleId);
    return unregister;
  }, [ctx, moduleId]);
}

export function useCopilotSnapshot() {
  const ctx = useContext(Ctx);
  // Sin provider devolvemos un snapshot vacío en vez de romper: así AliciaView
  // sigue andando en cualquier árbol que no lo tenga montado.
  return ctx?.snapshot ?? (() => ({ active: null, others: [], dropped: 0 }));
}
```

- [ ] **Step 2: Envolver HyggeOS con el provider**

En `files/alice/src/App.jsx`, agregar al bloque de imports:

```jsx
import { ERPContextProvider } from "./copilot/ERPContext.jsx";
```

y reemplazar la línea 564:

```jsx
  return <HyggeOS authUser={user} />;
```

por:

```jsx
  return (
    <ERPContextProvider>
      <HyggeOS authUser={user} />
    </ERPContextProvider>
  );
```

- [ ] **Step 3: Que Cabida se describa**

En `files/alice/src/modules/cabida/CabidaView.jsx`, agregar al bloque de imports:

```jsx
import { useERPContext } from "../../copilot/ERPContext.jsx";
```

y justo **después** del `useMemo` que termina en la línea 260 (el que produce `r`), agregar:

```jsx
  // Lo que Alicia ve cuando estás en esta pantalla. `state` son los parámetros
  // que pusiste; `derived` lo que la cabida ya calculó — le sirven para cosas
  // distintas: uno para cambiar, el otro para razonar sin recalcular.
  useERPContext("cabida", () => ({
    title: `Cabida${initialTerreno ? ` · terreno ${terreno} m²` : ""}`,
    entity: null,
    state: {
      terreno, areaLibre, pisos, azoteaTechada, circulacion, areaDpto,
      mix1, mix2, precioM2, costoM2, costoVentas, valorTerreno, impuesto,
    },
    derived: {
      dptos: r.dptos, vendible: Math.round(r.vendible), construidaTotal: Math.round(r.construidaTotal),
      sotanos: Math.round(r.sotanos), ingresos: Math.round(r.ingresos), costo: Math.round(r.costo),
      margen: Math.round(r.margen), utilNeta: Math.round(r.utilNeta),
      eficiencia: Number(r.eficiencia.toFixed(1)), incidencia: Number(r.incidencia.toFixed(1)),
    },
    actions: [],   // se llenan en la Fase 3, cuando Alicia tenga manos
  }));
```

**Verificado:** las 13 variables de `state` salen del array de dependencias del `useMemo` (`CabidaView.jsx:261-262`), y `initialTerreno` es una prop del componente (se le pasa desde `HyggeOS.jsx:5731`). Todas existen en el scope tal cual.

- [ ] **Step 4: Verificar que el ERP compila y Cabida sigue andando**

Run: `cd files/alice && npm run build`
Expected: build exitoso, sin warnings nuevos.

Después, a ojo: `npm run dev`, abrir Cabida, cambiar un parámetro y confirmar que los números siguen actualizándose igual que antes. Este cambio **no debe alterar nada visible**.

- [ ] **Step 5: Commit**

```bash
git add files/alice/src/copilot/ERPContext.jsx files/alice/src/App.jsx files/alice/src/modules/cabida/CabidaView.jsx
git commit -m "feat(copilot): registro de contexto del ERP + Cabida como primer módulo que se describe"
```

---

### Task 6: `erp-context.js` — el snapshot entra al prompt sin romper el caché

**Files:**
- Create: `alicia-brain/src/erp-context.js`
- Test: `alicia-brain/test/erp-context.test.mjs`
- Modify: `alicia-brain/src/server.js:581` (firma de `processAliciaMessage` — ya acepta `opts`)
- Modify: `alicia-brain/src/server.js:598-601` (el bloque no cacheado)
- Modify: `alicia-brain/src/server.js` (`/api/chat` pasa `erpContext`)

**Interfaces:**
- Consumes: el `{active, others, dropped}` que produce `buildSnapshot` (Task 4).
- Produces: `ERP_CONTEXT_CAP: number` (2400), `renderErpContext(snapshot, cap?) -> string` (`""` si no hay nada que decir).

- [ ] **Step 1: Escribir el test que falla**

Crear `alicia-brain/test/erp-context.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderErpContext, ERP_CONTEXT_CAP } from "../src/erp-context.js";

const snap = {
  active: {
    module: "cabida",
    title: "Cabida · PU01",
    entity: { type: "proyecto", id: "PU01" },
    state: { terreno: 640, pisos: 8 },
    derived: { dptos: 42, margen: 1240000 },
    actions: ["cabida.setParams"],
  },
  others: [{ module: "growth", title: "Growth", entity: null }],
  dropped: 0,
};

test("sin snapshot devuelve cadena vacía", () => {
  assert.equal(renderErpContext(null), "");
  assert.equal(renderErpContext(undefined), "");
  assert.equal(renderErpContext({ active: null, others: [], dropped: 0 }), "");
});

test("ignora basura en vez de explotar", () => {
  assert.equal(renderErpContext("no soy un objeto"), "");
  assert.equal(renderErpContext(42), "");
});

test("renderiza el módulo activo con parámetros y calculados", () => {
  const t = renderErpContext(snap);
  assert.match(t, /Cabida · PU01/);
  assert.match(t, /"terreno":640/);
  assert.match(t, /"dptos":42/);
});

test("nombra la entidad para que Alicia sepa de qué proyecto se habla", () => {
  assert.match(renderErpContext(snap), /proyecto PU01/);
});

test("lista las acciones disponibles acá y ahora", () => {
  assert.match(renderErpContext(snap), /cabida\.setParams/);
});

test("lista los otros módulos abiertos, solo por título", () => {
  const t = renderErpContext(snap);
  assert.match(t, /Growth/);
  assert.doesNotMatch(t, /growth\.abrir/);
});

test("el servidor impone su propio tope y no confía en el cliente", () => {
  const gordo = { active: { module: "x", title: "T", state: { blob: "y".repeat(50000) } }, others: [], dropped: 0 };
  const t = renderErpContext(gordo);
  assert.ok(t.length <= ERP_CONTEXT_CAP + 20, `se pasó del tope: ${t.length}`);
  assert.match(t, /recortado/);
});

test("el tope del servidor deja margen sobre el del cliente (2000)", () => {
  assert.equal(ERP_CONTEXT_CAP, 2400);
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd alicia-brain && npm test -- --test-name-pattern="renderErpContext|módulo activo|entidad|acciones|tope"`
Expected: FAIL — `Cannot find module '../src/erp-context.js'`

- [ ] **Step 3: Escribir la implementación**

Crear `alicia-brain/src/erp-context.js`:

```js
// El snapshot del ERP convertido en algo que el modelo pueda leer.
//
// IMPORTANTE: este bloque va DESPUÉS del breakpoint de caché del system prompt.
// Si entrara al bloque cacheado, cada vez que la persona navega a otro módulo se
// invalidaría el prefijo entero (system + tools + 60 mensajes) y se reprocesaría
// todo. Se paga a precio completo a propósito. Ver deuda D15 del spec.

// Tope propio del servidor. El cliente ya capa a 2000, pero el cliente es
// código que corre en el browser de otro: no se le cree.
export const ERP_CONTEXT_CAP = 2400;

export function renderErpContext(snapshot, cap = ERP_CONTEXT_CAP) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return "";
  const { active, others } = snapshot;
  if (!active && !(Array.isArray(others) && others.length)) return "";

  const lines = ["# PANTALLA (lo que la persona está viendo AHORA en el ERP)"];

  if (active) {
    lines.push(`\n## Módulo activo: ${active.title || active.module}`);
    if (active.entity?.id) lines.push(`Entidad abierta: ${active.entity.type || "item"} ${active.entity.id}`);
    if (active.state) lines.push(`Parámetros en pantalla: ${JSON.stringify(active.state)}`);
    if (active.derived) lines.push(`Ya calculado por el módulo (NO recalcules): ${JSON.stringify(active.derived)}`);
    if (active.actions?.length) lines.push(`Acciones disponibles acá: ${active.actions.join(", ")}`);
  }

  if (Array.isArray(others) && others.length) {
    lines.push(`\n## Otros módulos abiertos (pedí su detalle si lo necesitás)`);
    for (const o of others) lines.push(`- ${o.title || o.module}`);
  }

  const text = lines.join("\n");
  return text.length > cap ? `${text.slice(0, cap)}\n[…recortado por presupuesto]` : text;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd alicia-brain && npm test -- --test-name-pattern="renderErpContext|módulo activo|entidad|acciones|tope|otros módulos|basura|snapshot"`
Expected: PASS (8 tests)

- [ ] **Step 5: Inyectar el bloque en el prompt**

En `alicia-brain/src/server.js`, agregar al import de identity:

```js
import { renderErpContext } from "./erp-context.js";
```

Reemplazar la línea 601 (el `systemBlocks.push` del bloque no cacheado):

```js
  systemBlocks.push({ type: "text", text: `Ahora en Lima: ${nowLima}.${liveContext ? `\n\n${liveContext}` : ""}` });
```

por:

```js
  // El contexto del ERP viaja en el mismo bloque NO cacheado que la hora y el
  // contexto vivo: es lo que cambia a cada rato. Ver comentario en erp-context.js.
  const erpBlock = renderErpContext(opts.erpContext);
  systemBlocks.push({ type: "text", text:
    `Ahora en Lima: ${nowLima}.`
    + (liveContext ? `\n\n${liveContext}` : "")
    + (erpBlock ? `\n\n${erpBlock}` : "") });
```

Y en `/api/chat`, pasar el snapshot recibido (reemplazar la llamada a `processAliciaMessage`):

```js
    const result = await processAliciaMessage(act.userId, message, "app", { erpContext: req.body.erpContext });
```

- [ ] **Step 6: Verificar a mano que Alicia ve la pantalla**

Run:
```bash
cd alicia-brain && GATE_DEV_OPEN=1 PANEL_PASSWORD=test npm start &
sleep 3
curl -s -X POST http://127.0.0.1:3001/api/chat -H 'Content-Type: application/json' -d '{
  "message":"¿en qué pantalla estoy y cuántos departamentos me da?",
  "erpContext":{"active":{"module":"cabida","title":"Cabida · PU01","entity":{"type":"proyecto","id":"PU01"},
    "state":{"terreno":640,"pisos":8},"derived":{"dptos":42,"margen":1240000},"actions":[]},
    "others":[{"module":"growth","title":"Growth","entity":null}],"dropped":0}}' | head -c 400
```
Expected: la respuesta menciona Cabida / PU01 y **42 departamentos**, sin haber usado ninguna tool. Cortar con `kill %1`.

- [ ] **Step 7: Correr la suite completa y commitear**

Run: `cd alicia-brain && npm test`
Expected: PASS

```bash
git add alicia-brain/src/erp-context.js alicia-brain/test/erp-context.test.mjs alicia-brain/src/server.js
git commit -m "feat(copilot): el contexto del ERP entra al prompt sin invalidar el caché"
```

---

### Task 7: `history.js` + `GET /api/copilot/history` — el hilo real

**Files:**
- Create: `alicia-brain/src/history.js`
- Test: `alicia-brain/test/history.test.mjs`
- Modify: `alicia-brain/src/server.js` (ruta nueva)

**Interfaces:**
- Consumes: `resolveActingUser` (Task 1), `getDB()` de `./db.js`.
- Produces: `readThread(db, userId, limit?) -> Array<{id, role, content, channel, actions, createdAt}>`, en orden cronológico.
- **No tocar** `readConversation(db, personaId, limit)` de `tools.js:10`: la usa la tool `read_conversation` y tiene sus propios tests.

- [ ] **Step 1: Escribir el test que falla**

Crear `alicia-brain/test/history.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readThread } from "../src/history.js";

function db0() {
  const d = new DatabaseSync(":memory:");
  d.exec(`CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, role TEXT,
    content TEXT, channel TEXT DEFAULT 'app', actions TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')));`);
  d.exec(`INSERT INTO messages (user_id,role,content,channel,actions) VALUES
    ('sb','user','hola desde whatsapp','whatsapp','[]'),
    ('sb','assistant','buenas','whatsapp','[]'),
    ('sb','user','y esto desde el erp','app','[]'),
    ('sb','assistant','anotado','app','[{"type":"create_task"}]'),
    ('jt','user','soy otro','app','[]')`);
  return d;
}

test("readThread trae solo los mensajes de esa persona", () => {
  const r = readThread(db0(), "sb");
  assert.equal(r.length, 4);
  assert.ok(r.every((m) => m.content !== "soy otro"));
});

test("readThread devuelve en orden cronológico", () => {
  const r = readThread(db0(), "sb");
  assert.equal(r[0].content, "hola desde whatsapp");
  assert.equal(r[3].content, "anotado");
});

test("readThread expone el canal de cada mensaje", () => {
  const r = readThread(db0(), "sb");
  assert.equal(r[0].channel, "whatsapp");
  assert.equal(r[2].channel, "app");
});

test("readThread parsea actions y nunca devuelve el string crudo", () => {
  const r = readThread(db0(), "sb");
  assert.deepEqual(r[3].actions, [{ type: "create_task" }]);
  assert.deepEqual(r[0].actions, []);
});

test("readThread no explota con actions corrupto", () => {
  const d = db0();
  d.exec(`INSERT INTO messages (user_id,role,content,actions) VALUES ('sb','assistant','x','{roto')`);
  const r = readThread(d, "sb");
  assert.deepEqual(r[r.length - 1].actions, []);
});

test("readThread respeta el limit quedándose con los MÁS RECIENTES", () => {
  const r = readThread(db0(), "sb", 2);
  assert.equal(r.length, 2);
  assert.equal(r[0].content, "y esto desde el erp");
  assert.equal(r[1].content, "anotado");
});

test("readThread con un usuario sin mensajes devuelve lista vacía", () => {
  assert.deepEqual(readThread(db0(), "nadie"), []);
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd alicia-brain && npm test -- --test-name-pattern="readThread"`
Expected: FAIL — `Cannot find module '../src/history.js'`

- [ ] **Step 3: Escribir la implementación**

Crear `alicia-brain/src/history.js`:

```js
// El hilo tal como lo tiene que ver el ERP.
//
// Distinto de readConversation() de tools.js: aquella alimenta a la tool
// read_conversation y no trae canal. Acá el canal importa, porque el space
// ahora muestra el hilo REAL — y en ese hilo aparecen los mensajes de WhatsApp.
// Sin marcarlos, la persona no entiende de dónde salieron.

const parseActions = (s) => { try { return JSON.parse(s || "[]"); } catch { return []; } };

export function readThread(db, userId, limit = 60) {
  const rows = db.prepare(
    `SELECT id, role, content, channel, actions, created_at
       FROM messages WHERE user_id = ? ORDER BY id DESC LIMIT ?`
  ).all(userId, limit);
  return rows.reverse().map((r) => ({
    id: r.id,
    role: r.role,
    content: r.content,
    channel: r.channel || "app",
    actions: parseActions(r.actions),
    createdAt: r.created_at,
  }));
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd alicia-brain && npm test -- --test-name-pattern="readThread"`
Expected: PASS (7 tests)

- [ ] **Step 5: Exponer la ruta**

En `alicia-brain/src/server.js`, agregar el import:

```js
import { readThread } from "./history.js";
```

y agregar la ruta justo después del bloque de `/api/chat`:

```js
// El hilo real que el space del ERP tiene que mostrar. Hasta ahora AliciaView
// pintaba su propia copia de localStorage, desincronizada de lo que Alicia sí
// recordaba en `messages` — de ahí la sensación de que "no se acuerda".
app.get("/api/copilot/history", (req, res) => {
  const act = resolveActingUser({ actorId: req.aliceUser?.id, requestedUserId: req.query.userId });
  if (!act.ok) return res.status(act.error === "no_auth" ? 401 : 403).json({ error: act.error });
  const limit = Math.min(Math.max(Number(req.query.limit) || 60, 1), 200);
  res.json({ userId: act.userId, messages: readThread(getDB(), act.userId, limit) });
});
```

- [ ] **Step 6: Verificar la ruta y que sigue cerrada a extraños**

Run:
```bash
cd alicia-brain && GATE_DEV_OPEN=1 PANEL_PASSWORD=test npm start &
sleep 3
curl -s 'http://127.0.0.1:3001/api/copilot/history?limit=5' | head -c 300
curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: aliceai.bam.pe' 'http://127.0.0.1:3001/api/copilot/history'
```
Expected: la primera devuelve `{"userId":"sb","messages":[…]}` con `channel` en cada mensaje; la segunda imprime `401`. Cortar con `kill %1`.

- [ ] **Step 7: Correr la suite y commitear**

Run: `cd alicia-brain && npm test`
Expected: PASS

```bash
git add alicia-brain/src/history.js alicia-brain/test/history.test.mjs alicia-brain/src/server.js
git commit -m "feat(copilot): GET /api/copilot/history — el hilo real con canal por mensaje"
```

---

### Task 8: AliciaView pasa a mostrar el hilo real y a mandar el contexto

**Files:**
- Modify: `files/alice/src/modules/alicia/AliciaView.jsx` (imports; el efecto de carga del chat; `send` en 795-836)

**Interfaces:**
- Consumes: `useCopilotSnapshot()` (Task 5), `GET /api/copilot/history` (Task 7), `POST /api/chat` con `erpContext` (Task 6).
- Produces: nada para tareas posteriores.

- [ ] **Step 1: Importar lo nuevo**

En `files/alice/src/modules/alicia/AliciaView.jsx`, agregar:

```jsx
import { useCopilotSnapshot } from "../../copilot/ERPContext.jsx";
import { supabase } from "../../lib/supabase.js";
```

`lib/supabase.js:7` exporta el cliente como `export const supabase`. `AliciaView` hoy no manda ningún token al cerebro: este es el primer punto donde lo necesita, porque a partir de la Task 3 el gate exige identidad.

- [ ] **Step 2: Cargar el hilo del servidor al montar**

Agregar un efecto que corra cuando cambia `selectedUserId`. `localStorage` queda solo como pintura instantánea mientras llega el hilo real:

```jsx
  // El hilo vive en el servidor (tabla `messages`, un hilo por persona, todos los
  // canales). localStorage pasa a ser caché: pinta al instante y lo reemplaza
  // lo que llegue del cerebro. Antes era la fuente de verdad, y por eso el space
  // mostraba una conversación que Alicia no recordaba.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data?.session?.access_token;
        const qs = new URLSearchParams({ limit: "60" });
        if (selectedUserId !== currentUserId) qs.set("userId", selectedUserId);
        const res = await fetch(`${ALICIA_URL}/api/copilot/history?${qs}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return;                       // sin conexión seguimos con el caché
        const { messages: hilo } = await res.json();
        if (!vivo || !Array.isArray(hilo)) return;
        const mapped = hilo.map((m) => ({
          role: m.role, content: m.content, actions: m.actions || [],
          channel: m.channel, ts: Date.parse(`${m.createdAt}Z`) || Date.now(),
        }));
        setMessages(mapped);
        saveChat(selectedUserId, mapped);
      } catch { /* el caché de localStorage ya está en pantalla */ }
    })();
    return () => { vivo = false; };
  }, [selectedUserId, currentUserId]);
```

- [ ] **Step 3: Mandar el snapshot y el token en cada turno**

En el cuerpo del componente, antes de `send`:

```jsx
  const takeSnapshot = useCopilotSnapshot();
```

y dentro de `send`, reemplazar el `fetch` a `/api/chat` (líneas 806-812) por:

```jsx
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const res = await fetch(`${BRAIN_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        // userId solo viaja para el "ver como" del CEO; el servidor lo ignora
        // para cualquier otro y toma la identidad del JWT.
        body: JSON.stringify({
          userId: selectedUserId,
          message: text.trim(),
          erpContext: takeSnapshot(),
        }),
        signal: AbortSignal.timeout(60000),
      });
```

Agregar `takeSnapshot` al array de dependencias del `useCallback` de `send`.

- [ ] **Step 4: Marcar el canal de cada mensaje**

En el render de cada burbuja, para los mensajes que **no** son del ERP, agregar una etiqueta. Ubicarla junto al timestamp de la burbuja:

```jsx
{m.channel && m.channel !== "app" && (
  <span style={{ fontSize: 9, color: C.muted, marginLeft: 6, letterSpacing: "0.06em", textTransform: "uppercase" }}>
    {m.channel === "whatsapp" ? "· whatsapp" : m.channel === "embodied" ? "· voz" : `· ${m.channel}`}
  </span>
)}
```

- [ ] **Step 5: Verificar en el ERP contra el cerebro local**

Run:
```bash
cd alicia-brain && GATE_DEV_OPEN=1 PANEL_PASSWORD=test npm start &
cd files/alice && npm run dev
```
Con `VITE_ALICIA_URL=http://localhost:3001` en `files/alice/.env.development`, abrir el space Alicia y verificar:
1. Aparecen mensajes viejos con la etiqueta `· whatsapp`.
2. Abrir Cabida, volver al space y preguntar *"¿en qué estaba trabajando?"* → nombra Cabida y los números que están en pantalla.
3. Recargar la página: el hilo sigue igual (viene del servidor, no del browser).

- [ ] **Step 6: Build y commit**

Run: `cd files/alice && npm run build && node --test test/*.test.mjs`
Expected: build exitoso, tests en PASS.

```bash
git add files/alice/src/modules/alicia/AliciaView.jsx
git commit -m "feat(copilot): el space muestra el hilo real y manda el contexto de pantalla"
```

---

### Task 9: Registrar el resto de los módulos

Cabida ya se describe (Task 5). Con esta tarea **ningún módulo queda invisible**, que es el punto de la capa genérica del spec.

**Files:**
- Modify: `files/alice/src/modules/mercado/MercadoView.jsx`
- Modify: `files/alice/src/modules/cotizacion/CotizacionView.jsx`
- Modify: `files/alice/src/modules/obra/ObraTracker.jsx`
- Modify: `files/alice/src/modules/mesa/MesaDeTrabajo.jsx`
- Modify: `files/alice/src/HyggeOS.jsx` (`GrowthSpace`, ~5405)

**Interfaces:**
- Consumes: `useERPContext(moduleId, describeFn)` (Task 5).
- Produces: nada.

- [ ] **Step 1: Describir Velocity (MercadoView)**

En `files/alice/src/modules/mercado/MercadoView.jsx`, importar `useERPContext` desde `../../copilot/ERPContext.jsx` y agregar dentro de `MercadoView` (línea 620), justo después de `const setF = useCallback(...)` (línea 646):

```jsx
  useERPContext("velocity", () => ({
    title: selectedDistrict ? `Velocity · ${selectedDistrict}` : "Velocity · simulador de velocidad de ventas",
    entity: selectedDistrict ? { type: "distrito", id: selectedDistrict } : null,
    state: {
      distrito: selectedDistrict,
      unidades: factors.totalUnits,
      deltaPrecioVsMercado: factors.priceDelta,
      precioM2: factors.preciom2 || null,
      tipologia: factors.tipologia,
      acabados: factors.acabados,
      storytelling: factors.storytelling,
    },
    derived: { proyectosEnMercado: liveProjects.length, datosAl: marketTs },
    actions: [],
  }));
```

**Ojo con el doble montaje:** `MercadoView` se renderiza en dos lugares — como app suelta (`HyggeOS.jsx:16121`) y dentro de la pestaña "mercado" de `GrowthSpace` (`HyggeOS.jsx:5427`). Cuando pasa lo segundo, Growth y Velocity quedan registrados a la vez y el activo es el que montó último (Velocity, el más específico). Es el comportamiento correcto; queda anotado para que no sorprenda en review.

- [ ] **Step 2: Describir Cotización**

En `files/alice/src/modules/cotizacion/CotizacionView.jsx`, importar `useERPContext` desde `../../copilot/ERPContext.jsx` y agregar después de la línea 173 (`const [fpMeses, setFpMeses] = useState(12);`):

```jsx
  useERPContext("cotizacion", () => ({
    title: `Cotización · ${tipologia} en ${district}`,
    entity: { type: "distrito", id: district },
    state: { district, tipologia, areaM2, precioM2, moneda, ingresoMensual, inicialPct, plazoAnios },
    derived: { bancosConTasa: bankRates.length, datosAl: marketTs },
    actions: [],
  }));
```

- [ ] **Step 3: Describir Obra**

En `files/alice/src/modules/obra/ObraTracker.jsx`, importar `useERPContext` desde `../../copilot/ERPContext.jsx` y agregar en `ObraTracker` (línea 246), después de la línea 249:

```jsx
  useERPContext("obra", () => ({
    title: projectName ? `Obra · ${projectName}` : "Obra · tracker de avance",
    entity: projectId ? { type: "proyecto", id: projectId } : null,
    state: { proyecto: projectName || null },
    derived: {},
    actions: [],
  }));
```

`state` queda mínimo a propósito: la forma de `state` (el `useState(() => loadState(projectId))` de la línea 247) no está documentada y meterla entera podría reventar el presupuesto. Se enriquece en la fase que le dé tools a Obra.

- [ ] **Step 4: Describir Mesa de Trabajo**

En `files/alice/src/modules/mesa/MesaDeTrabajo.jsx`, importar `useERPContext` desde `../../copilot/ERPContext.jsx` y agregar en `MesaDeTrabajo` (línea 57), después de la línea 87:

```jsx
  useERPContext("mesa", () => ({
    title: nombre ? `Mesa de trabajo · ${nombre}` : "Mesa de trabajo",
    entity: terrenoId ? { type: "terreno", id: terrenoId } : null,
    state: { proyecto: nombre || null, pestaña: tab },
    derived: {},
    actions: [],
  }));
```

- [ ] **Step 5: Describir Growth**

En `files/alice/src/HyggeOS.jsx`, importar `useERPContext` desde `./copilot/ERPContext.jsx` y agregar dentro de `GrowthSpace` (línea 5405), después de `const [tab, setTab] = React.useState("terrenos");`:

```jsx
  useERPContext("growth", () => {
    const sel = terrenos.find((t) => t.id === selectedTerrenoId) || null;
    return {
      title: "Growth · pipeline de terrenos",
      entity: sel ? { type: "terreno", id: sel.id } : null,
      state: { totalTerrenos: terrenos.length, terrenoAbierto: sel?.name || null, pestaña: tab },
      derived: {},
      actions: [],
    };
  });
```

`terreno.name` existe (`HyggeOS.jsx:5142`).

- [ ] **Step 6: Verificar el presupuesto con todos los módulos vivos**

Run: `cd files/alice && npm run build && npm run dev`

En el browser, con el space abierto, ejecutar en la consola:
```js
// desde el space, con el provider montado
console.log(JSON.stringify(window.__copilotSnapshot?.() ?? {}).length)
```
Si `__copilotSnapshot` no está expuesto, verificar el tamaño desde el Network tab: el `erpContext` del POST a `/api/chat` **no debe pasar de 2.000 caracteres**.

Confirmar además que preguntarle *"¿qué módulos tengo abiertos?"* nombra los que están registrados.

- [ ] **Step 7: Commit**

```bash
git add files/alice/src/modules files/alice/src/HyggeOS.jsx
git commit -m "feat(copilot): registrar Velocity, Cotización, Obra, Mesa y Growth en el contexto"
```

---

## Verificación de cierre (Fases 0 y 1)

- [ ] `cd alicia-brain && npm test` → PASS
- [ ] `cd files/alice && node --test test/*.test.mjs` → PASS
- [ ] `cd files/alice && npm run build` → sin errores
- [ ] Un JWT que no es de `sb` **no** puede leer el historial de `sb` (probar con la sesión de otro usuario contra `/api/copilot/history?userId=sb` → 403)
- [ ] El space muestra mensajes de WhatsApp con su etiqueta de canal
- [ ] Estando en Cabida, Alicia responde con los números de la pantalla sin usar tools
- [ ] El `erpContext` que sale en el POST a `/api/chat` mide ≤ 2.000 caracteres

**Deploy:** el cerebro va por push a `main` (Railway automático). El ERP es manual: `cd files/alice && npm run build && npx netlify deploy --prod --dir=dist`.

**Orden obligatorio:** primero el cerebro, después el ERP. Al revés, el ERP mandaría `erpContext` y un `Authorization` a un backend que todavía no los entiende — el contexto se ignoraría en silencio (inofensivo) pero `/api/copilot/history` daría 404 y el space se quedaría con el caché de localStorage.
