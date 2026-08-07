# Coordinación · un solo modelo de scraping (2026-08-06)

> Dos sesiones de Claude Code convergieron en "scraping en la bestia". Sebastián
> decidió: **un solo modelo, y gana el de la sesión que tiene el conector a la
> bestia** (la que corre `scrape.js`). Este doc alinea a ambas.

## Decisión
- **Modelo único = PUSH desde la bestia.** La bestia (Hackintosh, Core Ultra 7, 64GB,
  IP residencial de Movistar Perú, en Tailscale como `alicias-mac-pro`) corre
  `scripts/scrape.js`, scrapea con navegador real + IP residencial, y **empuja** los
  datos a alicia-brain vía la API (auth `MARKET_REFRESH_TOKEN`).
- **Se DESCARTA el modelo pull** que había empezado la otra sesión (cola de jobs +
  worker endpoints `/api/agents/workers/*`). Era más rico (cola, failover,
  auto-sanación) pero duplica el push-model y nadie tiene por qué mantener dos.

## Qué queda de cada lado (sin duplicar)
| Pieza | Dueño | Estado |
|---|---|---|
| `scripts/scrape.js` (Nexo + SBS, push) | sesión-bestia (tiene el conector) | casi listo (`feat/beast-scraper`) |
| Parser de **Urbania** (`src/scrapers/urbania.js`) | ya en `main` (Fase 1) | listo — **falta engancharlo a scrape.js** |
| `saveSnapshot(rows, source)` por-fuente | ya en `main` (Fase 1) | listo |
| **Guardián de cobertura** (`staleSources` + `raiseCoverageFinding`) | Plan 1 | testeado — el vigía que sobrevive |

## Contrato de integración (lo que falta para cerrar)
1. **Agregar Urbania a `scrape.js`** reutilizando el parser `src/scrapers/urbania.js`
   (Fase 1). Así la bestia cubre Nexo + Urbania (oferta) + SBS (bancos).
2. **Push por-fuente:** el endpoint que recibe debe persistir con
   `saveSnapshot(rows, source)` para que Radar muestre `nexo + urbania` combinados.
   Confirmar que `scrape.js` mande `source` y el endpoint lo respete.
3. **`MARKET_REFRESH_TOKEN` no está seteado en prod** (cae al default `white-rabbit`).
   Setearlo en Railway y en la bestia (mismo valor) antes de exponer el push real.
4. **Guardián de cobertura (Plan 1)** se monta como supervisor: no le importa CÓMO
   llegan los datos (push), solo que sigan llegando. Si una fuente no refresca en su
   ventana → `finding` de categoría `coverage`. Independiente del transporte.

## Qué NO hacer
- No construir el worker pull en la bestia (se descarta ese camino).
- No mergear la rama huérfana `worktree-scraper-and-cleanup` entera (tiene la remoción
  de Twilio, que rompe el WhatsApp vivo de Alicia). Solo se rescató `scrapers/` en Fase 1.

## Ramas relevantes
- `feat/beast-scraper` (sesión-bestia) — `scrape.js` beast-ready.
- `feat/scout-flota-scrapers` (esta sesión) — spec + Plan 1 + guardián de cobertura.
- `main` — Fase 1 (scrapers/ con Urbania+SBS parsers, saveSnapshot por-fuente) ya desplegado.
