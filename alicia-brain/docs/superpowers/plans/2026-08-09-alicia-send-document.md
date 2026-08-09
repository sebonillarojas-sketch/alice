# Alicia · enviar documentos por WhatsApp (`send_document`) — Plan

> REQUIRED SUB-SKILL: subagent-driven-development. Steps con checkbox.

**Goal:** Que Alicia pueda ENVIAR/servir archivos (PDF, etc.) por WhatsApp — el "no tengo esa capacidad" que le dijo a Andrea. La plomería existe (`sendWAMedia`, Dropbox download); falta el tool + un relay temporal + awareness.

**Architecture:** `src/file-relay.js` (stage buffer → id efímero, TTL 5 min) + ruta `GET /file/:id` en server.js (sirve el buffer) + tool `send_document` en tools.js (saca el archivo de Dropbox o del buzón → lo stagea → arma URL → `sendWAMedia` al teléfono del que pide) + una línea de awareness en el prompt. Espeja el patrón `ttsCache` + `/tts/:id.wav` que ya existe.

**Tech Stack:** Node ESM, Express, `node:test`. Reusa `sendWAMedia` (wa.js), `dropbox.getFileBuffer` (integrations/dropbox.js), `getLastFile` (inbox-files.js), `resolvePhone` (tools.js, de #45).

## Global Constraints

- Node ESM `.js`. Tests `node:test`.
- Prod usa **Twilio**: `sendWAMedia(to, url)` manda `MediaUrl` (Twilio auto-detecta el tipo). El relay debe servir el archivo en una URL pública (`BASE_URL`, default `https://aliceai.bam.pe`) con Content-Type correcto.
- TTL del relay 5 min (igual que ttsCache). No es storage.
- `send_document` disponible para todos (COLLAB): la gente pide "mandame el PDF X". Envía SIEMPRE al teléfono del que pide (`resolvePhone(userId)`), nunca a terceros (eso ya es `send_whatsapp`, CEO).
- Trabajar en worktree `feat/alicia-send-document`. No mergear hasta aprobación.

---

### Task 1: `src/file-relay.js` — stage efímero de archivos

**Files:** Create `alicia-brain/src/file-relay.js`. Test `alicia-brain/test/file-relay.test.mjs`.

**Interfaces:**
- Produces: `stageFile({ buffer, mime, filename }) => id` (guarda en Map con TTL 5 min, devuelve id corto); `getStagedFile(id) => { buffer, mime, filename } | null`.

- [ ] **Step 1: Test que falla**

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { stageFile, getStagedFile } from "../src/file-relay.js";

test("stage + get roundtrip", () => {
  const id = stageFile({ buffer: Buffer.from("hola"), mime: "application/pdf", filename: "x.pdf" });
  const f = getStagedFile(id);
  assert.equal(f.buffer.toString(), "hola");
  assert.equal(f.mime, "application/pdf");
  assert.equal(f.filename, "x.pdf");
});
test("id inexistente → null", () => {
  assert.equal(getStagedFile("nope"), null);
});
```

- [ ] **Step 2: Correr → falla.**

- [ ] **Step 3: Implementar `src/file-relay.js`**

```javascript
// Relay efímero de archivos para enviarlos por WhatsApp (sendWAMedia necesita una URL).
// Espeja el patrón de ttsCache: buffer en memoria, id corto, TTL 5 min. NO es storage.
const cache = new Map(); // id → { buffer, mime, filename }
const TTL_MS = 5 * 60 * 1000;
let seq = 0;

export function stageFile({ buffer, mime = "application/octet-stream", filename = "archivo" }) {
  const id = `${Date.now().toString(36)}${(seq++).toString(36)}`;
  cache.set(id, { buffer, mime, filename });
  setTimeout(() => cache.delete(id), TTL_MS).unref?.();
  return id;
}

export function getStagedFile(id) {
  return cache.get(id) || null;
}
```
> Nota: `Date.now()` acá es en runtime del server (no en un workflow), así que está OK.

- [ ] **Step 4: Correr → pasa.**

- [ ] **Step 5: Commit** — `feat(alicia): file-relay efímero para enviar archivos por WhatsApp`

---

### Task 2: Ruta `GET /file/:id` que sirve el archivo staged

**Files:** Modify `alicia-brain/src/server.js` (junto a la ruta `/tts/:id.wav` ~1119).

**Interfaces:** Consume `getStagedFile` (file-relay.js).

- [ ] **Step 1: Import + ruta** — import estático arriba `import { getStagedFile } from "./file-relay.js";` (o dinámico dentro de la ruta). Agregar junto a `/tts/:id.wav`:

```javascript
app.get("/file/:id", (req, res) => {
  const f = getStagedFile(req.params.id);
  if (!f) return res.status(404).send("expirado");
  res.setHeader("Content-Type", f.mime);
  res.setHeader("Content-Disposition", `inline; filename="${f.filename.replace(/[^\w.\-]/g, "_")}"`);
  res.send(f.buffer);
});
```

- [ ] **Step 2: `node --check src/server.js`.**

- [ ] **Step 3: Commit** — `feat(alicia): ruta GET /file/:id sirve archivos staged`

---

### Task 3: Tool `send_document`

**Files:** Modify `alicia-brain/src/tools.js` (def en `ALICIA_TOOLS` + case en `executeTool`). Modify `alicia-brain/src/server.js` (agregar `send_document` a `COLLAB_TOOLS` para que todos lo tengan).

**Interfaces:** Consume `dropbox`/`dropboxAvailable` (integrations/dropbox.js), `getLastFile` (inbox-files.js), `stageFile` (file-relay.js), `resolvePhone` (tools.js), `sendWAMedia` (wa.js).

- [ ] **Step 1: Tool def en `ALICIA_TOOLS`**

```javascript
  {
    name: "send_document",
    description: "Envía un archivo (PDF, imagen, Excel, etc.) por WhatsApp a la persona que te está hablando. Usala cuando te piden 'mandame/enviame/pasame el archivo X' o 'abrime el PDF'. Podés mandar un archivo de Dropbox (dando su ruta) o reenviar el último que te mandaron. SÍ podés enviar archivos por WhatsApp.",
    input_schema: { type: "object", properties: {
      dropbox_path: { type: "string", description: "Ruta del archivo en Dropbox bajo /Hygge (si es de Dropbox). Buscala antes con dropbox_search si no la sabés." },
      filename: { type: "string", description: "nombre a mostrar (opcional)" }
    } }
  },
```

- [ ] **Step 2: Case en `executeTool`**

```javascript
    case "send_document": {
      const { getDB } = await import("./db.js");
      const phone = resolvePhone(getDB(), userId);
      if (!phone) return "No tengo tu WhatsApp en el perfil, no puedo enviártelo por ahí.";
      let buffer, mime, filename;
      if (input.dropbox_path) {
        const { dropbox, dropboxAvailable } = await import("./integrations/dropbox.js");
        if (!dropboxAvailable()) return "Dropbox no está configurado.";
        try { buffer = await dropbox.getFileBuffer(input.dropbox_path); }
        catch (e) { return `No encontré ese archivo en Dropbox (${e.message}).`; }
        filename = input.filename || input.dropbox_path.split("/").pop();
        mime = mimeFromName(filename);
      } else {
        const { getLastFile } = await import("./inbox-files.js");
        const f = getLastFile(userId);
        if (!f) return "No tengo ningún archivo tuyo reciente ni una ruta de Dropbox. Decime la ruta o mandame el archivo.";
        buffer = f.buffer; mime = f.mediaType; filename = input.filename || f.filename;
      }
      const { stageFile } = await import("./file-relay.js");
      const id = stageFile({ buffer, mime, filename });
      const url = `${process.env.BASE_URL || "https://aliceai.bam.pe"}/file/${id}`;
      const { sendWAMedia } = await import("./wa.js");
      try { await sendWAMedia(phone, url); return `📎 Te mandé "${filename}" por WhatsApp.`; }
      catch (e) { return `No pude enviarte el archivo: ${e.message}`; }
    }
```
   Y agregar un helper `mimeFromName` en tools.js (reusar el mapa de `extForMime` invertido, o simple):

```javascript
function mimeFromName(name = "") {
  const ext = name.toLowerCase().split(".").pop();
  return ({ pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    csv: "text/csv", txt: "text/plain" }[ext]) || "application/octet-stream";
}
```

- [ ] **Step 3: Habilitar para todos** — en `src/server.js`, agregar `"send_document"` al Set `COLLAB_TOOLS` (así CEO/admin/colab lo tienen).

- [ ] **Step 4: `node --check src/tools.js src/server.js`.**

- [ ] **Step 5: Commit** — `feat(alicia): tool send_document (envía archivos por WhatsApp desde Dropbox o buzón)`

---

### Task 4: Awareness en el prompt (que sepa lo que puede con archivos)

**Files:** Modify `alicia-brain/src/server.js` (`buildSystemPrompt`) o `src/world.js` (`EMBODIMENT_BLOCK`).

- [ ] **Step 1: Agregar al `EMBODIMENT_BLOCK` (world.js) una línea de poderes de archivos:**

```
Con archivos SÍ podés: recibir lo que te mandan por WhatsApp y subirlo a Dropbox (dropbox_upload), buscar y leer en Dropbox (dropbox_search/dropbox_read), y **enviar/servir archivos por WhatsApp** (send_document). No mandes a la gente a buscar sola si podés traerle o mandarle el archivo vos.
```
(agregar al final del template de `EMBODIMENT_BLOCK`).

- [ ] **Step 2: `node --check src/world.js`.**

- [ ] **Step 3: Commit** — `feat(alicia): awareness de poderes de archivos en el embodiment`

---

### Task 5: Verificación

- [ ] **Step 1:** `cd alicia-brain && node --test test/file-relay.test.mjs` + `node --test test/*.test.mjs` (toda) → verde.
- [ ] **Step 2:** `node --check` de file-relay.js, server.js, tools.js, world.js.
- [ ] **Step 3:** Grep: `send_document` está en `COLLAB_TOOLS`; la ruta `/file/:id` existe; el tool no manda a terceros (usa `resolvePhone(userId)`, el que pide).
- [ ] **Step 4:** Smoke: `stageFile` + `getStagedFile` roundtrip; `mimeFromName("x.pdf")==="application/pdf"`. Documentar.
- [ ] **Step 5:** Commit de ajustes.

## Self-Review
- Enviar archivos por WhatsApp (el gap de Andrea) → Tasks 1-3. ✅
- Awareness (no subvalorarse) → Task 4. ✅
- Reusa plomería existente (sendWAMedia, dropbox.getFileBuffer, buzón, resolvePhone). ✅
- `send_document` envía SOLO al que pide (no a terceros) — sin fuga. ✅
- Placeholder scan: sin TBD. Type consistency: `stageFile`/`getStagedFile`/`mimeFromName`/`resolvePhone` consistentes.

## Fuera de alcance
- Enviar a terceros (usar `send_whatsapp` + adjunto) — futuro.
- Cloud API media type (sendWAMedia hardcodea audio en la rama Cloud) — prod usa Twilio; si algún día se usa Cloud para docs, ajustar sendWAMedia para `type: "document"`.
