# Scrapers — agente de datos de White Rabbit 🐰

Fuentes que exigen **render de JS / bypass anti-bot** y por eso viven separadas del
scraping directo de `market.js` (Nexo, Wynwood House, que se bajan sin proxy).

| Fuente | Módulo | Qué trae | Anti-bot | Guarda en |
|---|---|---|---|---|
| **SBS** | `sbs.js` | Tasas de crédito **hipotecario por banco** (PEN/USD) | Incapsula | `bank_rates` (`source='sbs'`) |
| **Urbania** | `urbania.js` | Listings de **venta en Lima** (precio, área, dorms, distrito, lat/lng) | Cloudflare (proxy PE) | `market_snapshots` (`source='urbania'`) |

## Cómo corre

- **Cron** (`cron.js`): SBS diario 6:00am Lima; Urbania cada 12h (5:30 / 17:30).
- **Manual**: `POST /api/scrapers/run` (bearer `MARKET_REFRESH_TOKEN`), body opcional
  `{ "sources": ["sbs","urbania"] }`.
- Cada corrida se registra en `agent_runs`/`agent_findings` bajo el agente
  **`white-rabbit`**, así el trabajo es visible en el cockpit (no corre en silencio).

## Render

`render.js` intenta, en orden: **ScrapingBee** (`render_js`, +proxy PE para Urbania)
→ **r.jina.ai** (reader que renderiza JS, gratis) → **fetch directo**. Define
`SCRAPINGBEE_API_KEY` para producción; sin key igual funciona vía jina con menos volumen.

## Verificación

Los parsers están cubiertos por `test/scrapers.test.mjs` contra **capturas reales**
recortadas (`test/fixtures/`, tomadas el 24-25/07/2026). Corré:

```
node --test test/scrapers.test.mjs
```

⚠️ Si SBS o Urbania cambian su HTML, estos tests son la señal temprana. Las capturas
prueban la lógica de parseo; el bypass anti-bot **sólo se puede validar contra el sitio
vivo** (requiere `SCRAPINGBEE_API_KEY`). Al primer deploy con key, disparar
`POST /api/scrapers/run` y verificar que `bank_rates` y el snapshot `urbania` se llenen.
