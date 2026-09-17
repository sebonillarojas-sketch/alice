# Scrapers — la flota buzzfly 🪰

Acá viven las fuentes que exigen **render de JS / bypass anti-bot**, separadas del
scraping directo de `market.js` (Nexo, Wynwood House, que se bajan sin proxy).

**Cada scraper de la flota tiene identidad propia** en `agent_runs`/`agent_findings`
(ver `fleet.js`). Hasta el 16/09/2026 todos reportaban como `white-rabbit`, que además
es la guardia de infra: esa guardia cierra sus hallazgos cada 30 min cuando el TLS está
sano y de paso borraba los del scraper. Urbania y SBS estuvieron caídos tres días sin
que saliera una sola alerta. El nombre propio es lo que hace que el ciclo de vida de
los hallazgos de cada uno sea suyo.

| Agente | Fuente | Dónde corre | Qué trae | Tolerancia sin datos |
|---|---|---|---|---|
| `buzzfly1` | **SBS** (`sbs.js`) | cerebro, 6:00am | tasas hipotecarias por banco → `bank_rates` | 30h |
| `buzzfly2` | **Urbania** (`urbania.js`) | cerebro, c/12h | venta en Lima → `market_snapshots` | 30h |
| `buzzfly3` | **Nexo** (`market.js`) | cerebro, c/hora | proyectos → `market_snapshots` | 6h |
| `buzzfly4` | **Wynwood House** (`market.js`) | cerebro, c/6h | renta corta → `rental_listings` | 18h |
| `buzzfly5` | **Bestia** (`scripts/scrape.js`) | Mac de Lima, c/6h | Playwright + IP residencial → `POST /api/market-import` | 18h |

`checkFleetFreshness()` corre cada hora y vigila el **silencio** además del fallo: un
scraper que dejó de correr no genera ningún hallazgo por sí solo — así fue como la
bestia estuvo siete días sin pushear y nadie lo notó.

## Anti-bot de las fuentes duras

| Fuente | Módulo | Anti-bot | Guarda en |
|---|---|---|---|
| **SBS** | `sbs.js` | Incapsula | `bank_rates` (`source='sbs'`) |
| **Urbania** | `urbania.js` | Cloudflare (proxy PE) | `market_snapshots` (`source='urbania'`) |

## Cómo corre

- **Cron** (`cron.js`): SBS diario 6:00am Lima; Urbania cada 12h (5:30 / 17:30).
- **Manual**: `POST /api/scrapers/run` (bearer `MARKET_REFRESH_TOKEN`), body opcional
  `{ "sources": ["sbs","urbania"] }`.
- Cada corrida se registra en `agent_runs`/`agent_findings` bajo **su propio buzzfly**
  (`recordScraperRun` en `fleet.js`), así el trabajo es visible en el cockpit y un fallo
  llega a Dark Alice sin que otro agente se lo lleve puesto.

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
