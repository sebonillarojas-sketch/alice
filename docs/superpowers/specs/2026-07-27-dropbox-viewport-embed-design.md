# Diseño · Viewport de Dropbox embebible y confiable

**Fecha:** 2026-07-27
**Autor:** Sebastián + Claude (brainstorming)
**Proyecto:** ALICE ERP (`files/alice`) · `src/HyggeOS.jsx`
**Estado:** aprobado, listo para plan de implementación

## Problema

En el "Viewport Externo" (feature opt-in per-space, componente `IframeView` en
`HyggeOS.jsx`), un link de Dropbox **se ve a veces sí y a veces no**.

Causa raíz confirmada en el código: `IframeView` tiene ramas especiales para
Google Sheets/Docs/Slides/Drive y Miro, pero **Dropbox cae en la rama genérica**
(`// Generic — try iframe`), que hace literalmente `<iframe src={url}>` con el
link crudo. Un link `https://www.dropbox.com/scl/fi/...?dl=0` abre la página de
preview de Dropbox, que responde con `X-Frame-Options` / CSP `frame-ancestors`,
así que **el navegador bloquea el embed en silencio** → viewport gris/blanco.
Solo renderizan formatos "raw" (`?raw=1` o el host `dl.dropboxusercontent.com`),
y solo para ciertos tipos (imágenes/PDF). Por eso parece aleatorio: depende del
formato exacto del link pegado.

El fallback existente (`DriveIframeWithFallback`) no cubre este caso: la rama
genérica ni lo usa, y su heurística `onLoad` + timeout de 5 s es no-determinista
para iframes cross-origin (el `onLoad` puede dispararse aun en páginas
bloqueadas). No se puede detectar de forma confiable el fallo de un iframe
cross-origin desde JS.

## Principio de diseño

**Decidir la embebibilidad por adelantado a partir del tipo de archivo, nunca
por "a ver si el iframe carga".** Y nunca meter una página `dropbox.com` dentro
de un iframe. Esto elimina la no-determinación de raíz.

## Enfoque elegido (C · híbrido, client-side)

Resolver en el cliente los casos baratos y confiables (imágenes y PDF vía raw
host) y caer a una tarjeta "Abrir en Dropbox" para todo lo demás. Sin cambios de
backend, sin ancho de banda por Railway, degradación elegante (jamás un viewport
en blanco sin salida).

Un proxy de preview en el backend (para archivos del equipo sin link público)
queda documentado como **Fase 2 opcional**, fuera de alcance de este spec.

## Componentes

Todo el cambio vive en `src/HyggeOS.jsx`.

### 1. `resolveDropboxEmbed(url)` — función pura

Entrada: string URL. Salida: `{ kind, src, openUrl }`.

- `kind`: `'image' | 'pdf' | 'unsupported'`
- `src`: URL normalizada a raw para embeber (solo para `image`/`pdf`)
- `openUrl`: URL para abrir en Dropbox en pestaña nueva (siempre presente)

Reglas:

1. Reconocer host `dropbox.com` (incluye `www.`) y `dl.dropboxusercontent.com`.
   Si no es Dropbox, la función no aplica (el caller sigue con su flujo normal).
2. Extraer la extensión del **pathname** (ignorando el query string).
3. Extensiones imagen: `png jpg jpeg gif webp svg avif` → `kind: 'image'`.
   Extensión `pdf` → `kind: 'pdf'`. Cualquier otra (incl. carpetas `/scl/fo/`,
   xlsx/docx/pptx, o sin extensión) → `kind: 'unsupported'`.
4. Para `image`/`pdf`, construir `src` raw: quitar cualquier `dl=0`/`dl=1` y
   agregar `raw=1`. Si ya es `dl.dropboxusercontent.com`, dejar `src = url`.
5. `openUrl`: el link original normalizado a `dl=0` (abre el preview de Dropbox).

La función es determinística y sin efectos → 100% testeable en aislamiento.

### 2. Rama `dropboxMatch` en `IframeView`

Agregar la detección junto a las otras (`sheetsMatch`, `driveFileMatch`, …) y
**antes** de la rama genérica:

```js
const dropboxMatch = /(?:\/\/|\.)dropbox\.com\/|dl\.dropboxusercontent\.com\//.test(url);
```

(cubre `https://dropbox.com/`, `https://www.dropbox.com/` y `dl.dropboxusercontent.com/`)

Si `dropboxMatch`, llamar `resolveDropboxEmbed(url)` y renderizar según `kind`:

- `image` → `<img src={src}>` dentro de `CustomViewShell`, con `onError` →
  cambiar a `DropboxCard` (el `onError` de `<img>` cross-origin **sí** es
  confiable).
- `pdf` → `<iframe src={src}>` (visor nativo del browser) con un botón/afordancia
  **"Abrir en Dropbox ↗" siempre visible** en el header del shell (no depende de
  detección de carga).
- `unsupported` → `<DropboxCard openUrl={openUrl} title={title} />`.

### 3. `DropboxCard` — fallback

Clon del patrón `DriveFolderCard`: ícono, título, mensaje corto explicando que
ese tipo de archivo no se puede embeber inline, y botón "Abrir en Dropbox".
Usa los brand tokens `C` (tema crema editorial). Color de acento Dropbox
(`#0061FF`) para el ícono.

## Flujo de datos

`config.url` (del viewport guardado) → `IframeView` → `dropboxMatch`? →
`resolveDropboxEmbed(url)` → `{kind, src, openUrl}` → render por `kind`. Sin
estado nuevo, sin fetch, sin backend.

## Manejo de errores / edge cases

| Caso | Comportamiento |
|---|---|
| Link privado / no público | raw devuelve HTML de login → `<img onError>` → `DropboxCard`; para PDF, botón "Abrir" siempre visible |
| `?dl=1` (fuerza descarga) | normalizado a `raw=1`, no dispara download |
| Ya-raw (`dl.dropboxusercontent.com`) | se respeta `src = url` |
| Carpeta (`/scl/fo/`) | `unsupported` → `DropboxCard` |
| URL vacía / no Dropbox | función no aplica; caller sigue su flujo (Sheets/Drive/genérico) |
| Office (xlsx/docx/pptx) | `unsupported` → `DropboxCard` (embed inline queda para Fase 2) |

## Testing

- **Unit (TDD):** `resolveDropboxEmbed` con casos reales — `/scl/fi/…png?rlkey=…&dl=0`,
  `/s/…/x.pdf?dl=0`, `.xlsx`, carpeta `/scl/fo/…`, ya-raw, `?dl=1`, no-Dropbox.
  El repo no tiene test runner; usar un script node mínimo con `assert` (no
  agregar vitest salvo pedido explícito).
- **Verify manual:** en `npm run dev`, pegar un link real de imagen, uno de PDF,
  uno de xlsx y uno de carpeta; confirmar render correcto o tarjeta en cada uno.
- **a11y:** correr `lint-with-impeccable` sobre `DropboxCard`.
- **Opcional:** `/codex:adversarial-review` sobre el manejo de CSP/framing y
  links privados.

## Fuera de alcance

- Fase 2: proxy de preview en el backend (`/api/dropbox/preview`) para archivos
  del equipo sin link público y para embeber Office inline.
- Los otros dos síntomas auditados (401 por JWT de Supabase vencido en la vista
  "Archivos"; fragilidad de `DriveIframeWithFallback` para Sheets/Drive) — no
  son este bug; se pueden atacar por separado.

## Criterios de aceptación

1. Pegar un link de Dropbox a una imagen pública → se ve la imagen inline,
   consistentemente (no "a veces").
2. Pegar un link a un PDF público → se ve el PDF inline, con botón "Abrir en
   Dropbox" visible.
3. Pegar un link a xlsx/docx o a una carpeta → tarjeta "Abrir en Dropbox"
   (nunca un viewport en blanco).
4. Pegar un link privado/roto → cae a la tarjeta, no queda en blanco.
5. `resolveDropboxEmbed` pasa todos los tests unitarios.
