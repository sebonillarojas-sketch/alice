# Viewport de Dropbox embebible y confiable — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un link de Dropbox pegado en un "Viewport Externo" se muestre siempre de forma consistente (imagen/PDF inline, o tarjeta "Abrir en Dropbox"), nunca un viewport en blanco al azar.

**Architecture:** Una función pura `resolveDropboxEmbed(url)` decide por tipo de archivo (determinístico, no "a ver si el iframe carga") y reescribe el link a raw. `IframeView` gana una rama Dropbox que renderiza imagen (`<img>` con fallback `onError`), PDF (`<iframe>` raw + botón "Abrir") o una tarjeta de fallback. Nunca se mete una página `dropbox.com` en un iframe (la bloquea `X-Frame-Options`).

**Tech Stack:** React 18 + Vite 5, ESM, lucide-react (íconos), tests con el runner nativo `node --test` (sin dependencias nuevas).

**Spec:** `docs/superpowers/specs/2026-07-27-dropbox-viewport-embed-design.md`

## Global Constraints

- Proyecto: `files/alice` (repo git root = `~/alice`). Todos los paths de este plan son relativos a `files/alice/`.
- ESM en todo (`"type": "module"` en `package.json`). Usar `import`/`export`.
- **No agregar dependencias** (ni vitest ni nada). Tests con `node --test` + `node:assert/strict`.
- Seguir el patrón visual existente: brand tokens del objeto `C` (tema crema), radios 2–4px, botón primario `backgroundColor: C.ink, color: "white"`. Clonar el estilo de `DriveFolderCard` (`HyggeOS.jsx`).
- Íconos: usar solo los ya importados en `HyggeOS.jsx` (`FileText`, `ExternalLink`) — lucide-react no tiene ícono de marca Dropbox.
- Texto legible: mínimo `text-[12px]` en la tarjeta (evitar `text-[10px]/[11px]` para pasar `lint-with-impeccable`).
- Solo commitear los archivos de cada task; NO tocar los cambios sin relacionar ya presentes en el working tree (`src/modules/planos/PlantaFina.jsx`, `public/bammys/`).

---

### Task 1: Función pura `resolveDropboxEmbed` + tests

**Files:**
- Create: `files/alice/src/lib/dropboxEmbed.js`
- Create: `files/alice/src/lib/dropboxEmbed.test.js`
- Modify: `files/alice/package.json` (agregar script `"test"`)

**Interfaces:**
- Produces:
  - `isDropboxUrl(url: string) => boolean`
  - `resolveDropboxEmbed(url: string) => { kind: 'image'|'pdf'|'unsupported', src: string|null, openUrl: string }`
    - `src` es la URL raw a embeber (solo cuando `kind` es `image`/`pdf`; `null` si `unsupported`).
    - `openUrl` siempre presente: link para abrir en Dropbox en pestaña nueva.

- [ ] **Step 1: Escribir el test que falla**

Crear `files/alice/src/lib/dropboxEmbed.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveDropboxEmbed, isDropboxUrl } from "./dropboxEmbed.js";

test("imagen scl/fi con dl=0 → image, raw=1, sin dl, preserva rlkey", () => {
  const r = resolveDropboxEmbed("https://www.dropbox.com/scl/fi/abc/foto.png?rlkey=xyz&dl=0");
  assert.equal(r.kind, "image");
  assert.match(r.src, /raw=1/);
  assert.doesNotMatch(r.src, /dl=/);
  assert.match(r.src, /rlkey=xyz/);
  assert.match(r.openUrl, /dl=0/);
});

test("pdf /s/ → pdf con raw", () => {
  const r = resolveDropboxEmbed("https://www.dropbox.com/s/abc/informe.pdf?dl=0");
  assert.equal(r.kind, "pdf");
  assert.match(r.src, /raw=1/);
});

test("xlsx → unsupported (src null) pero abrible", () => {
  const r = resolveDropboxEmbed("https://www.dropbox.com/scl/fi/abc/flujo.xlsx?rlkey=x&dl=0");
  assert.equal(r.kind, "unsupported");
  assert.equal(r.src, null);
  assert.match(r.openUrl, /flujo\.xlsx/);
});

test("carpeta /scl/fo/ → unsupported", () => {
  const r = resolveDropboxEmbed("https://www.dropbox.com/scl/fo/abc/Proyecto?rlkey=x&dl=0");
  assert.equal(r.kind, "unsupported");
});

test("dl=1 (fuerza descarga) → normalizado a raw=1", () => {
  const r = resolveDropboxEmbed("https://www.dropbox.com/scl/fi/abc/foto.jpg?rlkey=x&dl=1");
  assert.equal(r.kind, "image");
  assert.match(r.src, /raw=1/);
  assert.doesNotMatch(r.src, /dl=1/);
});

test("ya-raw dl.dropboxusercontent.com → src intacto", () => {
  const url = "https://dl.dropboxusercontent.com/scl/fi/abc/foto.png?rlkey=x";
  const r = resolveDropboxEmbed(url);
  assert.equal(r.kind, "image");
  assert.equal(r.src, url);
});

test("extensión en mayúsculas → image", () => {
  const r = resolveDropboxEmbed("https://www.dropbox.com/scl/fi/abc/FOTO.PNG?dl=0");
  assert.equal(r.kind, "image");
});

test("URL malformada → unsupported sin romper", () => {
  const r = resolveDropboxEmbed("no-es-una-url");
  assert.equal(r.kind, "unsupported");
  assert.equal(r.openUrl, "no-es-una-url");
});

test("isDropboxUrl reconoce hosts y rechaza otros", () => {
  assert.ok(isDropboxUrl("https://www.dropbox.com/scl/fi/x/a.png"));
  assert.ok(isDropboxUrl("https://dropbox.com/s/x/a.pdf"));
  assert.ok(isDropboxUrl("https://dl.dropboxusercontent.com/scl/fi/x/a.png"));
  assert.ok(!isDropboxUrl("https://docs.google.com/spreadsheets/d/x"));
  assert.ok(!isDropboxUrl(""));
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd files/alice && node --test src/lib/dropboxEmbed.test.js`
Expected: FAIL — `Cannot find module './dropboxEmbed.js'` (todavía no existe).

- [ ] **Step 3: Implementar la función mínima**

Crear `files/alice/src/lib/dropboxEmbed.js`:

```js
// Resuelve un link de Dropbox a algo embebible de forma DETERMINÍSTICA POR TIPO
// (no "a ver si el iframe carga"). Nunca metemos una página dropbox.com en un
// iframe: responde X-Frame-Options y el navegador la bloquea en silencio.

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"]);

// ¿La URL es de Dropbox (share link o host raw)?
export function isDropboxUrl(url) {
  return /(?:\/\/|\.)dropbox\.com\/|dl\.dropboxusercontent\.com\//.test(String(url || ""));
}

// { kind: 'image'|'pdf'|'unsupported', src: string|null, openUrl: string }
export function resolveDropboxEmbed(url) {
  const input = String(url || "");
  let u;
  try {
    u = new URL(input);
  } catch {
    return { kind: "unsupported", src: null, openUrl: input };
  }

  const ext = (u.pathname.split(".").pop() || "").toLowerCase();
  const kind = IMAGE_EXT.has(ext) ? "image" : ext === "pdf" ? "pdf" : "unsupported";

  // openUrl siempre: original con dl=0 (abre el preview de Dropbox), sin raw
  const open = new URL(input);
  open.searchParams.delete("raw");
  open.searchParams.set("dl", "0");
  const openUrl = open.toString();

  if (kind === "unsupported") return { kind, src: null, openUrl };

  // src raw: si ya es el host raw, dejarlo; si no, sacar dl y poner raw=1
  let src;
  if (/dl\.dropboxusercontent\.com\//.test(input)) {
    src = input;
  } else {
    const rawU = new URL(input);
    rawU.searchParams.delete("dl");
    rawU.searchParams.set("raw", "1");
    src = rawU.toString();
  }
  return { kind, src, openUrl };
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd files/alice && node --test src/lib/dropboxEmbed.test.js`
Expected: PASS — 9 tests, 0 fallos.

- [ ] **Step 5: Agregar el script `test` a package.json**

En `files/alice/package.json`, dentro de `"scripts"`, agregar:

```json
"test": "node --test"
```

(autodiscovery: corre todos los `*.test.js` del proyecto, excluye `node_modules`)

Verificar: `cd files/alice && npm test` → corre y pasa.

- [ ] **Step 6: Commit**

```bash
cd /Users/sebastianbonilla/alice
git add files/alice/src/lib/dropboxEmbed.js files/alice/src/lib/dropboxEmbed.test.js files/alice/package.json
git commit -m "feat(viewport): resolveDropboxEmbed — resuelve links de Dropbox por tipo

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Rama Dropbox en `IframeView` + componentes de render

**Files:**
- Modify: `files/alice/src/HyggeOS.jsx` (import al tope; detección + rama dentro de `IframeView`, antes de la rama "Generic — try iframe" en ~línea 1714; dos componentes nuevos después de `DriveFolderCard` en ~línea 1747)

**Interfaces:**
- Consumes: `resolveDropboxEmbed`, `isDropboxUrl` de `./lib/dropboxEmbed.js` (Task 1).
- Produces: componentes internos `DropboxImage`, `DropboxCard` (usados solo dentro de `HyggeOS.jsx`).

- [ ] **Step 1: Agregar el import**

Al tope de `files/alice/src/HyggeOS.jsx`, junto a los otros imports de `./lib/…` o de módulos, agregar:

```js
import { resolveDropboxEmbed, isDropboxUrl } from "./lib/dropboxEmbed.js";
```

- [ ] **Step 2: Agregar la detección Dropbox en `IframeView`**

En `IframeView`, junto a las otras detecciones (`sheetsMatch`, `driveFileMatch`, `miroMatch`, ~líneas 1630–1636), agregar:

```js
const isDropbox = isDropboxUrl(url);
```

- [ ] **Step 3: Agregar la rama Dropbox antes de la rama genérica**

Justo antes del comentario `// Generic — try iframe` (~línea 1714 en `IframeView`), insertar:

```jsx
// Dropbox — nunca iframe a dropbox.com (X-Frame-Options lo bloquea).
// Resolvemos por tipo: imagen y PDF inline; el resto → tarjeta.
if (isDropbox) {
  const { kind, src, openUrl } = resolveDropboxEmbed(url);
  const subtitle = (
    <a href={openUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:opacity-70">
      Dropbox <ExternalLink size={10} />
    </a>
  );
  if (kind === "image") {
    return (
      <CustomViewShell title={title} subtitle={subtitle} onEdit={onEdit} onDelete={onDelete} fullWidth>
        <div style={{ height: config?.height || 640, backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <DropboxImage src={src} openUrl={openUrl} title={title} />
        </div>
      </CustomViewShell>
    );
  }
  if (kind === "pdf") {
    return (
      <CustomViewShell title={title} subtitle={subtitle} onEdit={onEdit} onDelete={onDelete} fullWidth>
        <div style={{ height: config?.height || 640, backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2, overflow: "hidden" }}>
          <iframe src={src} title={title} style={{ width: "100%", height: "100%", border: 0, display: "block" }} />
        </div>
      </CustomViewShell>
    );
  }
  return (
    <CustomViewShell title={title} subtitle={subtitle} onEdit={onEdit} onDelete={onDelete}>
      <DropboxCard openUrl={openUrl} title={title} />
    </CustomViewShell>
  );
}
```

- [ ] **Step 4: Agregar los componentes `DropboxImage` y `DropboxCard`**

Después de la función `DriveFolderCard` (~línea 1747), agregar:

```jsx
// Imagen de Dropbox via raw host. El onError de <img> cross-origin SÍ es
// confiable (a diferencia del iframe), así que un link privado/roto cae a la tarjeta.
function DropboxImage({ src, openUrl, title }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <DropboxCard openUrl={openUrl} title={title} />;
  return (
    <img
      src={src}
      alt={title}
      onError={() => setFailed(true)}
      style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }}
    />
  );
}

// Fallback — tipo no embebible inline (Office, carpeta) o link privado/roto.
function DropboxCard({ openUrl, title }) {
  return (
    <div className="flex items-center justify-center py-12 px-6" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 4, minHeight: 280 }}>
      <div className="text-center max-w-md">
        <div className="inline-flex w-14 h-14 mb-4 items-center justify-center rounded" style={{ backgroundColor: "#0061FF22" }}>
          <FileText size={26} style={{ color: "#0061FF" }} />
        </div>
        <div className="text-[14px] mb-1.5" style={{ color: C.ink, fontWeight: 600, letterSpacing: "-0.005em" }}>{title}</div>
        <div className="text-[12px] mb-5" style={{ color: C.inkSoft, lineHeight: 1.55 }}>
          Este archivo de Dropbox no se puede mostrar inline (documentos de Office, carpetas o links privados). Abrilo en Dropbox para verlo.
        </div>
        <a href={openUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 text-[12px] hover:opacity-90" style={{ backgroundColor: C.ink, color: "white", borderRadius: 2, fontWeight: 500 }}>
          Abrir en Dropbox <ExternalLink size={10} />
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verificar que compila (parse + build)**

Run: `cd files/alice && npm run build`
Expected: build OK, sin errores de parse ni de import (`resolveDropboxEmbed`, `DropboxImage`, `DropboxCard`, `FileText`, `ExternalLink` resueltos).

- [ ] **Step 6: Verificación manual en el dev server**

Run: `cd files/alice && npm run dev` (login `sebastian` / `hygge2026`).
En un space, activar "Viewport Externo" y probar, uno por uno, pegando un link de Dropbox real de cada tipo:
1. Imagen pública (`.png`/`.jpg`) → se ve la imagen inline.
2. PDF público → se ve el PDF inline, con "Dropbox ↗" en el header.
3. `.xlsx` o carpeta → tarjeta "Abrir en Dropbox" (no blanco).
4. Link privado/roto → cae a la tarjeta (no blanco).
Confirmar que el mismo link da el mismo resultado cada vez (no "a veces sí a veces no").

- [ ] **Step 7: Lint de la tarjeta con impeccable**

Invocar la skill `lint-with-impeccable` sobre `DropboxCard` (tema claro crema). Triage de findings: arreglar defectos reales de contraste/tamaño; ignorar falsos positivos. Sin cambios de comportamiento.

- [ ] **Step 8: Commit**

```bash
cd /Users/sebastianbonilla/alice
git add files/alice/src/HyggeOS.jsx
git commit -m "feat(viewport): render de Dropbox por tipo (imagen/PDF inline, fallback card)

Nunca embebe una página dropbox.com en iframe (X-Frame-Options la bloquea).
Fixes el 'a veces se ve a veces no' del Viewport Externo con links de Dropbox.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Verificación final (opcional, recomendada)

- `/codex:adversarial-review` sobre el manejo de CSP/framing y links privados en la rama Dropbox — segundo par de ojos para casos que no cubran los tests unitarios.

## Notas de implementación

- El `openUrl` de un link ya-raw (`dl.dropboxusercontent.com`) queda apuntando al host raw con `dl=0` (no al preview de dropbox.com). Es un escape hatch best-effort; aceptable — la mayoría de los links guardados son de `dropbox.com`.
- Fase 2 (fuera de alcance): proxy `/api/dropbox/preview` en `alicia-brain` para embeber archivos del equipo sin link público y Office inline.
