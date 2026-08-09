# Alicia consulta y refresca Radar/Nexo · Diseño

_2026-08-09 · repo `alice` / `alicia-brain`_

## Contexto

Sebastián: *"me preocupa que no tengo información en Radar sobre Miraflores/San Isidro"*.
La data de mercado ya vive en el SQLite del brain (`market_snapshots` con `source`
∈ nexo/urbania, tabla `resources`, macro en `macro_data`, tasas en `bank_rates`),
alimentada por el fleet de scrapers (`scrapers/index.js`: `urbania`, `sbs`) y por
`refreshMarketData()` (Nexo + BCRP). El ERP la muestra en `radar.html` vía
`/api/market-data`. Pero **Alicia no tiene forma de consultarla** — solo tiene
`search_resources` (biblioteca de links/notas), no la data de Radar. Por eso, cuando le
preguntaron por San Isidro, dijo que "no hay scout para esa zona" (falso: la data existe,
no la sabía leer).

Este es el sub-proyecto **A** de dos. El **B** (canal bidireccional para hablarle a los
agentes) va después, en su propia spec.

## Objetivo

Darle a Alicia dos manos sobre Radar/Nexo: **consultar** la data de mercado por
distrito/tipología, y **refrescarla** (disparar el scrape) — todo in-process sobre
`market.js`, sin infra nueva.

## Alcance / no-alcance

**Dentro:** tools `radar_query` (lectura) y `radar_refresh` (dispara scrape+macro),
disponibles para **todo el equipo** (COLLAB_TOOLS).

**Fuera:**
- Refresh parametrizado por-zona: `refreshMarketData()`/scrapers no toman distrito hoy;
  el refresh es global (todos los distritos configurados) y luego `radar_query` filtra.
- Escribir/editar proyectos a mano (solo se "alimenta" vía scrape).
- El sub-proyecto B (hablar con agentes).
- Tocar el fleet de scrapers, `radar.html` o `/api/market-data`.

## Componentes (ambos en `alicia-brain/src/tools.js`)

### 1. `radar_query({ district?, dorms?, incluir_macro? })` — lectura
- Lee `getLatestSnapshot()` (proyectos), y si se pide o es relevante: `getMacroData()`
  (tasa hipotecaria PEN/USD, tipo de cambio USD/PEN), `getBankRates()`, `getRentalListings()`.
- Filtra los `projects` por:
  - `district`: match case-insensitive por substring contra el campo `district` del proyecto.
  - `dorms` (opcional): tipología; incluye el proyecto si `dorms` cae en `[dorms_min, dorms_max]`.
- Calcula y devuelve un resumen legible: cantidad de proyectos, rango y promedio de
  `list_price_m2_usd` (min/prom/max), y una lista corta (nombre, dorms, precio/m² USD).
  Si se pidió macro: agrega tasa hipotecaria y tipo de cambio.
- **Sin data para el distrito:** decir claro que no hay, con `scraped_at` del último snapshot,
  y ofrecer `radar_refresh`. **Nunca** inventar cifras ni decir que "no hay scout".
- Lógica pura extraíble: `summarizeMarket(snapshot, { district, dorms, macro })` → objeto/
  string testeable, sin DB.

### 2. `radar_refresh({ source? })` — alimentar
- `source` ∈ `nexo` (default) | `urbania` | `sbs` | `todo`.
- **Guard anti-spam:** si el último snapshot de esa fuente es de hace < 15 min
  (`getLatestSnapshotBySource(source).scraped_at`), NO re-scrapea; reporta la data fresca
  existente ("Radar de Nexo se actualizó hace 4 min, tengo 240 proyectos").
- Si no, dispara: `nexo`/`todo` → `refreshMarketData()`; `urbania`/`sbs`/`todo` →
  `runScraperAgent({ sources })`. Espera el resultado (~10-30s).
- **Reporta lo que REALMENTE pasó**, honesto: N proyectos nuevos, o "Nexo está detrás de
  Cloudflare y cayó a caché — la última data es del <fecha>". (Nexo suele fallar el live y
  caer a caché — se dice sin adornos, alineado con las reglas anti-confabulación de #53.)
- Envuelto en try/catch: un fallo del scrape se reporta, no rompe el turno.

## Gating

Ambos tools en `COLLAB_TOOLS` (todo el equipo). La data es de listings públicos scrapeados;
no es información confidencial de dirección. `radar_refresh` queda protegido del abuso por el
guard de 15 min, no por permisos.

## Datos (ya existen, no se crean)

- `market_snapshots(source, total, data JSON, scraped_at)` — `data` = array de proyectos.
- Proyecto normalizado: `{ name, district, dorms_min, dorms_max, list_price_pen,
  list_price_usd, list_price_m2_usd, close_price_m2_usd, ... }` (ver `market.js` toRow/import).
- `macro_data` (BCRP: tasa_hip_pen, tasa_hip_usd, usd_pen), `bank_rates`, rental listings.

## Manejo de errores

- `radar_query` sin snapshot / sin match → mensaje honesto + `scraped_at` + ofrecer refresh.
- `radar_refresh` con scrape fallido → reporta el fallo real y la última data disponible.
- `isSandbox()`: el refresh no dispara scrapes reales en el clon (heredado; los scrapers ya
  no pegan afuera bajo sandbox por env pelado, pero el guard lo hace explícito).

## Testing (node:test)

- `summarizeMarket`: dado un snapshot fake con proyectos de varios distritos →
  (a) filtra bien por `district`; (b) filtra por `dorms` dentro del rango; (c) precio/m²
  min/prom/max correctos; (d) sin match → señal de "vacío" con `scraped_at`.
- `radar_refresh` guard: con un `getLatestSnapshotBySource` fake reciente → no llama al
  scraper (se inyecta un fake y se verifica que no se invocó); viejo → sí lo llama y reporta.
- No se pega a la red en ningún test (funciones de scrape/refresh inyectadas).

## Criterios de éxito

1. "¿Qué hay en Radar de San Isidro?" → Alicia responde con proyectos, rango de precio/m² y
   tasa hipotecaria reales del último snapshot; si no hay, lo dice honesto con la fecha.
2. "Refrescá Radar" / "traé data nueva" → dispara el scrape (o reporta caché reciente) y
   dice qué pasó, sin inventar.
3. Todo el equipo puede consultar; el refresh no se puede spamear (guard 15 min).
4. Cero regresión: `search_resources`, `/api/market-data`, radar.html y los crons siguen igual.

## Abierto / a definir en el plan

- Ventana exacta del guard de refresh (propuesta 15 min).
- Umbral de cuántos proyectos listar en el resumen antes de resumir (propuesta: top 8 + conteo).
- Si `radar_query` incluye macro por default o solo con `incluir_macro` (propuesta: incluir
  tasa/tipo de cambio siempre que haya proyectos, es barato y útil).
