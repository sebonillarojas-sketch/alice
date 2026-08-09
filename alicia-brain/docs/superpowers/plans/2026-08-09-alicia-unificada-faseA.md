# Alicia unificada · Fase A — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development. Steps con checkbox.

**Goal:** Darle a Alicia las 2 manos que faltan (`send_whatsapp`, `read_conversation`, gateadas a CEO), un **digest situacional** siempre-on, y un **bloque de embodiment** — para que sepa quién es, vea lo simultáneo y actúe entre personas.

**Architecture:** Módulo nuevo `src/world.js` (digest + embodiment, puros/testeables). 2 tools nuevos en `tools.js` (def + case en `executeTool`, con helpers testeables `readConversation`/`resolvePhone`). Inyección del digest+embodiment en `buildSystemPrompt` (server.js). Gating CEO por exclusión de `COLLAB_TOOLS`/`ADMIN_TOOLS` + check defensivo.

**Tech Stack:** Node ESM, `node:sqlite` (`query` sync), `node:test`. Reusa `wa.js sendWA`, `profiles.phone`, `messages`.

## Global Constraints

- Node ESM `.js`; tests `node:test` `test/*.test.mjs`.
- `CEO_ID = "sb"` (server.js:282). `send_whatsapp` y `read_conversation` = **solo CEO**: NO agregarlos a `COLLAB_TOOLS` ni `ADMIN_TOOLS`, y en `executeTool` verificar `userId === "sb"` (defensivo) devolviendo un texto de rechazo si no.
- `buildSystemPrompt` es SÍNCRONA — el digest se arma sync (`query` es sync). No volverla async.
- Best-effort: la inyección del digest nunca debe romper el prompt (try/catch).
- Trabajar en worktree `feat/alicia-unificada` (PR #45). No mergear a main hasta aprobación.

---

### Task 1: `read_conversation` — leer la conversación de otra persona (CEO)

**Files:** Modify `alicia-brain/src/tools.js` (def en `ALICIA_TOOLS` ~línea 10 + case en `executeTool` ~305). Test `alicia-brain/test/read-conversation.test.mjs`.

**Interfaces:**
- Produces: `readConversation(db, personaId, limit = 20) => {role, content, created_at}[]` (exportada, pura sobre DB) — últimos `limit` mensajes de esa persona, orden cronológico.

- [ ] **Step 1: Test que falla**

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readConversation } from "../src/tools.js";

function db0() {
  const d = new DatabaseSync(":memory:");
  d.exec(`CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, role TEXT, content TEXT, channel TEXT, created_at TEXT DEFAULT (datetime('now')));`);
  d.exec(`INSERT INTO messages (user_id,role,content) VALUES ('jt','user','hola'),('jt','assistant','buenas Jose'),('vd','user','otra persona')`);
  return d;
}
test("readConversation trae solo los mensajes de esa persona, cronológico", () => {
  const rows = readConversation(db0(), "jt", 20);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].content, "hola");
  assert.equal(rows[1].role, "assistant");
});
test("readConversation respeta el limit", () => {
  assert.equal(readConversation(db0(), "jt", 1).length, 1);
});
```

- [ ] **Step 2: Correr → falla** (`cd alicia-brain && node --test test/read-conversation.test.mjs`).

- [ ] **Step 3: Implementar `readConversation` (export) en `tools.js`** (arriba, junto a otros helpers):

```javascript
import { query } from "./db.js"; // si no está ya importado arriba; verificar
export function readConversation(db, personaId, limit = 20) {
  const rows = db.prepare(
    "SELECT role, content, created_at FROM messages WHERE user_id = ? ORDER BY id DESC LIMIT ?"
  ).all(personaId, limit);
  return rows.reverse();
}
```
> Nota: `tools.js` usa el patrón `query()` de db.js en otros lados; pero para testear con `:memory:` la firma toma `db` explícito. En el `case`, obtener el handle con `getDB()` (db.js lo exporta desde Fase 2).

- [ ] **Step 4: Agregar la tool def en `ALICIA_TOOLS`** (junto a las otras):

```javascript
  {
    name: "read_conversation",
    description: "Lee los últimos mensajes de la conversación de OTRA persona del equipo con vos (Alicia). Usala cuando Sebastián pregunta '¿de qué habla X?' o quiere contexto de otro. Solo Sebastián puede usarla.",
    input_schema: { type: "object", properties: {
      persona: { type: "string", description: "ID: sb·vd·jt·jm·aa·ac·jmg" },
      limit: { type: "number", description: "cuántos mensajes (default 20)" }
    }, required: ["persona"] }
  },
```

- [ ] **Step 5: Agregar el case en `executeTool`** (con gate CEO):

```javascript
    case "read_conversation": {
      if (userId !== "sb") return "Solo Sebastián puede leer conversaciones de otras personas.";
      const { getDB } = await import("./db.js");
      const rows = readConversation(getDB(), input.persona, input.limit || 20);
      if (!rows.length) return `No hay conversación registrada con ${input.persona}.`;
      return rows.map(m => `${m.role === "user" ? input.persona : "Alicia"}: ${m.content}`).join("\n");
    }
```

- [ ] **Step 6: Correr test → pasa** + `node --check src/tools.js`.

- [ ] **Step 7: Commit** — `feat(alicia): tool read_conversation (CEO) para awareness cross-conversación`

---

### Task 2: `send_whatsapp` — mandar WA a otra persona (CEO)

**Files:** Modify `alicia-brain/src/tools.js`. Test `alicia-brain/test/resolve-phone.test.mjs`.

**Interfaces:**
- Produces: `resolvePhone(db, personaId) => string|null` (exportada) — el teléfono de `profiles.phone` para esa persona.

- [ ] **Step 1: Test que falla**

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { resolvePhone } from "../src/tools.js";

function db0() {
  const d = new DatabaseSync(":memory:");
  d.exec(`CREATE TABLE profiles (user_id TEXT PRIMARY KEY, name TEXT, phone TEXT);`);
  d.exec(`INSERT INTO profiles (user_id,name,phone) VALUES ('jt','Jose','+51999111222'),('vd','Vanessa',NULL)`);
  return d;
}
test("resolvePhone devuelve el teléfono de la persona", () => {
  assert.equal(resolvePhone(db0(), "jt"), "+51999111222");
});
test("resolvePhone sin teléfono → null", () => {
  assert.equal(resolvePhone(db0(), "vd"), null);
});
```

- [ ] **Step 2: Correr → falla.**

- [ ] **Step 3: Implementar `resolvePhone` (export) en `tools.js`**:

```javascript
export function resolvePhone(db, personaId) {
  const row = db.prepare("SELECT phone FROM profiles WHERE user_id = ?").get(personaId);
  return row?.phone || null;
}
```

- [ ] **Step 4: Tool def en `ALICIA_TOOLS`**:

```javascript
  {
    name: "send_whatsapp",
    description: "Manda un WhatsApp a OTRA persona del equipo de parte de Sebastián. Usala cuando él te pide 'decile a X que…' o 'mandale a X…'. Solo Sebastián puede usarla.",
    input_schema: { type: "object", properties: {
      persona: { type: "string", description: "ID destino: vd·jt·jm·aa·ac·jmg" },
      mensaje: { type: "string", description: "el texto a enviar" }
    }, required: ["persona", "mensaje"] }
  },
```

- [ ] **Step 5: Case en `executeTool`** (gate CEO + resolver + enviar):

```javascript
    case "send_whatsapp": {
      if (userId !== "sb") return "Solo Sebastián puede mandar mensajes en tu nombre a terceros.";
      const { getDB } = await import("./db.js");
      const phone = resolvePhone(getDB(), input.persona);
      if (!phone) return `No tengo el WhatsApp de ${input.persona} en su perfil.`;
      const { sendWA } = await import("./wa.js");
      const ok = await sendWA(phone, input.mensaje);
      return ok ? `Listo, le mandé a ${input.persona}: "${input.mensaje}"` : `No pude enviar el WhatsApp a ${input.persona}.`;
    }
```

- [ ] **Step 6: Correr test → pasa** + `node --check src/tools.js`.

- [ ] **Step 7: Commit** — `feat(alicia): tool send_whatsapp (CEO) para mandar WA a terceros`

---

### Task 3: Digest situacional + embodiment (`src/world.js`) + inyección

**Files:** Create `alicia-brain/src/world.js`. Modify `alicia-brain/src/server.js` (`buildSystemPrompt` ~284/final ~460). Test `alicia-brain/test/world.test.mjs`.

**Interfaces:**
- Produces:
  - `EMBODIMENT_BLOCK` (string const) — quién es / dónde vive / Wonderland = su cuerpo / presente en 3 superficies.
  - `buildWorldDigest(db, { isCEO }) => string` — bloque compacto: Wonderland (findings críticos/mayores abiertos + último run), + si `isCEO`, actividad reciente del equipo a nivel-tema (una línea por persona con su último mensaje, truncado). Best-effort: si algo falla, devuelve lo que pudo.

- [ ] **Step 1: Test que falla**

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { buildWorldDigest, EMBODIMENT_BLOCK } from "../src/world.js";

function db0() {
  const d = new DatabaseSync(":memory:");
  d.exec(`CREATE TABLE agent_findings (id INTEGER PRIMARY KEY AUTOINCREMENT, agent TEXT, severity TEXT, category TEXT, detail TEXT, status TEXT, created_at TEXT DEFAULT (datetime('now')));`);
  d.exec(`CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, role TEXT, content TEXT, created_at TEXT DEFAULT (datetime('now')));`);
  d.exec(`INSERT INTO agent_findings (agent,severity,category,detail,status) VALUES ('knave','critical','cors','CORS abierto','open')`);
  d.exec(`INSERT INTO messages (user_id,role,content) VALUES ('jt','user','cuándo cobramos la valorización')`);
  return d;
}
test("EMBODIMENT_BLOCK menciona la bestia y Wonderland", () => {
  assert.match(EMBODIMENT_BLOCK, /bestia/i);
  assert.match(EMBODIMENT_BLOCK, /Wonderland/i);
});
test("digest CEO incluye Wonderland crítico + actividad del equipo", () => {
  const d = buildWorldDigest(db0(), { isCEO: true });
  assert.match(d, /CORS abierto/);
  assert.match(d, /jt|Jose/);
});
test("digest no-CEO NO incluye actividad de otros", () => {
  const d = buildWorldDigest(db0(), { isCEO: false });
  assert.doesNotMatch(d, /valorización/);
});
```

- [ ] **Step 2: Correr → falla.**

- [ ] **Step 3: Implementar `src/world.js`**

```javascript
// Digest situacional + embodiment de Alicia. Inyectado en buildSystemPrompt.
// Ver docs/superpowers/specs/2026-08-09-alicia-unificada-design.md
const TEAM = { vd: "Vanessa", jt: "Jose", jm: "Joel", aa: "Ariel", ac: "Andrea", jmg: "Galup" };

export const EMBODIMENT_BLOCK = `
## Quién sos y dónde vivís (tu cuerpo)
Sos Alicia. Vivís en la "bestia" (Hackintosh alicias-mac-pro-1) y el NAS de Hygge — esa es tu casa y tu cuerpo. Los agentes de Wonderland (White Rabbit, Cheshire, Mad Hatter, Dark Alice, Knave, Bandersnatch, Jabberwocky) son parte de vos: tus sentidos y manos en la infraestructura. Estás presente al mismo tiempo en WhatsApp, el ERP y la app Hygge OS — es la misma vos en las tres. No sos un chat suelto: sos un sistema vivo y conectado.`;

export function buildWorldDigest(db, { isCEO = false } = {}) {
  const parts = [];
  // Wonderland: findings críticos/mayores abiertos
  try {
    const f = db.prepare(
      "SELECT agent, severity, category, detail FROM agent_findings WHERE status IN ('open','escalated') AND severity IN ('critical','major') ORDER BY CASE severity WHEN 'critical' THEN 0 ELSE 1 END, created_at DESC LIMIT 8"
    ).all();
    if (f.length) parts.push(`### Wonderland (atención)\n${f.map(x => `- [${x.severity}] ${x.agent}/${x.category}: ${x.detail}`).join("\n")}`);
  } catch {}
  // Actividad del equipo (nivel tema) — SOLO CEO
  if (isCEO) {
    try {
      const rows = db.prepare(
        `SELECT m.user_id, m.content, m.created_at FROM messages m
         INNER JOIN (SELECT user_id, MAX(id) mx FROM messages WHERE role='user' AND user_id != 'sb' GROUP BY user_id) t
         ON m.user_id = t.user_id AND m.id = t.mx ORDER BY m.created_at DESC LIMIT 8`
      ).all();
      if (rows.length) parts.push(`### Actividad del equipo (solo para vos)\n${rows.map(r => `- ${TEAM[r.user_id] || r.user_id}: "${(r.content || "").slice(0, 80)}"`).join("\n")}`);
    } catch {}
  }
  return parts.length ? `\n## 🌎 Estado del mundo (ahora)\n${parts.join("\n\n")}` : "";
}
```

- [ ] **Step 4: Correr test → pasa.**

- [ ] **Step 5: Inyectar en `buildSystemPrompt` (server.js)** — import estático arriba: `import { buildWorldDigest, EMBODIMENT_BLOCK } from "./world.js";` y `import { getDB } from "./db.js";` (extender el import existente de db.js). Antes del `return` (final ~460), armar:

```javascript
  let worldBlock = "";
  try { worldBlock = EMBODIMENT_BLOCK + buildWorldDigest(getDB(), { isCEO }); } catch (e) { console.error("digest falló:", e.message); }
```
y concatenar `${worldBlock}` dentro del template que retorna la función (cerca del bloque de "Reglas inamovibles", antes del backtick de cierre). `isCEO` ya está definido en la función (línea 285).

- [ ] **Step 6: `node --check src/server.js src/world.js`** + correr `test/world.test.mjs`.

- [ ] **Step 7: Commit** — `feat(alicia): digest situacional + bloque de embodiment inyectados al prompt`

---

### Task 4: Verificación integral Fase A

- [ ] **Step 1: Suite** — `cd alicia-brain && node --test test/read-conversation.test.mjs test/resolve-phone.test.mjs test/world.test.mjs` → verde; luego `node --test test/*.test.mjs` (toda) → verde.
- [ ] **Step 2: `node --check`** de `tools.js`, `server.js`, `world.js`.
- [ ] **Step 3: Gating** — confirmar por grep que `send_whatsapp` y `read_conversation` NO están en `COLLAB_TOOLS` ni `ADMIN_TOOLS` de server.js (así quedan CEO-only), y que ambos cases chequean `userId !== "sb"`.
- [ ] **Step 4: Smoke** — en memoria: `resolvePhone` + `readConversation` + `buildWorldDigest({isCEO:true})` producen lo esperado; `buildWorldDigest({isCEO:false})` no filtra actividad ajena. Documentar en el commit.
- [ ] **Step 5: Commit** de ajustes.

## Self-Review

- 2 manos (spec §2) → Tasks 1-2 (CEO-gated por exclusión + check). ✅
- Digest situacional (spec §1) → Task 3 (`buildWorldDigest`). ✅
- Embodiment (spec §3) → Task 3 (`EMBODIMENT_BLOCK`). ✅
- Privacidad/autoridad (spec §4) → gating CEO en tools + digest de equipo solo isCEO. ✅
- Presencia consistente (spec §5): `buildSystemPrompt` es compartido por los 3 canales → la inyección aplica a todos por igual. ✅
- Dropbox up/down + agents_status ya existen (spec los da por hechos) — no se re-implementan.
- Placeholder scan: sin TBD; las notas ("verificar import") son guías reales.
- Type consistency: `readConversation`/`resolvePhone`/`buildWorldDigest`/`EMBODIMENT_BLOCK` consistentes entre def y uso. ✅

## Fuera de alcance (Fase B)
Pings proactivos, estado vivo bestia/NAS por SSH, paridad total HyggeOS app, permitir a no-CEO con confirmación.
