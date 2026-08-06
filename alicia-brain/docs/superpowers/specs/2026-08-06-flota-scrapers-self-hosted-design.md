# Flota de scrapers self-hosted — diseño (Fase 2 del Radar)

> Estado: **diseño para revisión**. Autor de sesión: Claude (Opus 4.8) + Sebastián.
> Fecha: 2026-08-06. Rama: `feat/scout-flota-scrapers`.
> Predecesor: Fase 1 (rescate del scraper Urbania+SBS, ya desplegado — commit `2fd33a8`).

## 1. Problema (grounded en evidencia de hoy)

Radar —la app de inteligencia de mercado más importante de Alice— sirve en producción
**una sola fuente (`nexo`)** cuando debería tener varias. Dos hechos verificados el 2026-08-06
que este diseño existe para resolver:

1. **Trabajo construido pero no confiable en la nube.** El scraper de Urbania (listings de
   venta) + SBS (tasas por banco) se rescató y desplegó hoy. Pero al primer ciclo, Urbania
   **no pobló**: el contenedor de Railway se reinició/redesplegó a las 22:30:18 UTC, ~18 s
   *después* de la hora del cron (22:30:00), y `node-cron` no reproduce eventos pasados → el
   job se saltó silenciosamente. `market-data` siguió mostrando solo `nexo`.
2. **Fragilidad estructural.** El scraping corre **en el mismo proceso** que el backend de
   Alicia (WhatsApp, ERP, TTS). Un scraper pesado o que crashea puede tumbar todo el backend.
   Y desde la IP de datacenter de Railway, Cloudflare/Incapsula (Urbania, SBS) challengean,
   forzando a pagar ScrapingBee por IPs residenciales de Perú.

**Tres lecciones que el diseño internaliza:**
- No confiar en que "el cron disparó" — confiar en que **la fuente se refrescó** (medir el efecto, no la intención).
- **Aislar** el scraping del backend crítico.
- Usar la **IP residencial de Lima que ya tenemos** (Mac Pro) en vez de alquilarla.

## 2. Objetivo y no-objetivos

**Objetivo:** una flota de scrapers propia, resiliente y auto-sanante, corriendo en máquinas
propias con IP residencial de Lima, orquestada desde Railway, que mantenga la cobertura de
Radar **confiable y honesta** (nunca mostrar data parcial como completa) para el segmento
medio-alto en 13 distritos de Lima Top.

**No-objetivos (por ahora):** rediseñar Radar (frontend); mover el backend de Alicia fuera
de Railway; scrapear fuera de los 13 distritos / fuera de medio-alto; eliminar ScrapingBee
(se mantiene como paracaídas).

## 3. Arquitectura

**Principio: el cerebro decide en la nube, las manos ejecutan en Lima.**

```
   RAILWAY (alicia-brain)              TAILSCALE                 MACS (Lima · IP residencial)
   ┌─────────────────────┐                                    ┌───────────────────────────┐
   │ SCOUT               │◀─── heartbeat + resultados ────────│ Mac Pro (PRIMARIO · 24/7) │
   │  · decide qué/cuándo │                                    │  worker: Playwright+parsers│
   │  · encola jobs       │──── jobs (PULL) ──────────────────▶│  launchd reinicia si muere │
   │  · dedup + validación│                                    └───────────────────────────┘
   │  · detecta "no refrescó"                                  ┌───────────────────────────┐
   │  · guarda en SQLite  │◀─── failover si Pro no late ───────│ MacBook (BACKUP)          │
   └──────────┬──────────┘                                    │  mismo worker             │
              │ paracaídas último recurso                     └───────────────────────────┘
              ▼
     ScrapingBee / r.jina.ai   (solo si AMBAS Macs caen)
```

### 3.1 Modelo PULL (worker jala, Railway no empuja)
El worker inicia la conexión saliente sobre Tailscale y hace poll a Railway: *"¿hay jobs para
mí?"*. Corre el job con browser real + IP residencial y **devuelve** filas normalizadas.
- **Por qué pull:** no hay que exponer las Macs ni abrir puertos entrantes; sobrevive NAT;
  Railway no necesita alcanzar dentro del tailnet. Es el patrón robusto de worker-cola.

### 3.2 Nodos
- **Mac Pro (primario):** Lima, 24/7, IP residencial. Corre el `scraper-worker`. Supervisado
  por **launchd** (si el proceso muere, reinicia). **Auto-bootstrap:** al arrancar, si falta
  Node o el checkout del repo, se instala/clona solo (no depende de estado previo).
- **MacBook (backup):** mismo worker; toma jobs si el Pro no da heartbeat por X min.
  Requiere Tailscale logueado (hoy el CLI del laptop reporta `Logged out` → pendiente).

### 3.3 Failover en cascada
Preferencia de dispatch: **Mac Pro → MacBook → ScrapingBee/jina**. La nube deja de ser motor
y pasa a paracaídas de última instancia: Radar nunca queda a oscuras, pero el costo de proxy
tiende a $0 en operación normal.

## 4. Componentes

### 4.1 `scraper-worker` (corre en las Macs)
- Node + **Playwright (Chromium real + stealth)** + los parsers propios (`urbania.js`,
  `sbs.js`, y los nuevos). Render local con navegador real → pasa Cloudflare/Incapsula con la
  IP residencial.
- Ciclo: `registrar/heartbeat` → `pull job` → `render+parse` → `POST resultados` → repetir.
- Reporta cada corrida a `agent_runs`/`agent_findings` bajo el agente `white-rabbit` (visible
  en el cockpit, no corre en silencio).

### 4.2 Protocolo (endpoints nuevos en alicia-brain, bajo `panelGate` + `x-agent-key`)
- `POST /api/workers/heartbeat` — el worker anuncia `{ workerId, node, caps, ts }`.
- `GET  /api/workers/jobs` — devuelve jobs pendientes asignados a ese worker (o vacío).
- `POST /api/workers/result` — el worker sube `{ jobId, source, rows[], meta }`; el servidor
  valida, deduplica y persiste vía `saveSnapshot(rows, source)`.
- Auth: `x-agent-key` (patrón `requireAgentKey` ya existente para agentes externos como
  Cheshire). Sin exponer nada público.

### 4.3 SCOUT (proceso/cron en Railway)
Responsabilidades:
1. **Programar** qué fuente scrapear y cuándo; encolar jobs (no ejecuta el scrape él mismo).
2. **Detección de cobertura** (la lección de hoy): en vez de confiar en el cron, compara el
   `scraped_at` esperado vs real por fuente. Si una fuente **no se refrescó** en su ventana,
   es un `finding`, no un silencio.
3. **Dedup + validación:** deduplica entre portales del mismo grupo (Urbania/Adondevivir/
   Properati), y **cruza contra benchmark** (Tier-1): si un portal se aleja del sector en un
   distrito, alarma.
4. **Auto-sanación:** job devuelve 0 filas / challenge → reintenta con render alterno → si
   sigue fallando, escala a Sebastián por WhatsApp con propuesta (fuente nueva, ajuste de
   parser, o servicio pago). Worker muerto → launchd reinicia. Nodo caído → failover + alerta.
5. **Descubrimiento:** propone fuentes nuevas dentro de los 13 distritos / medio-alto para tu
   autorización antes de soltar un scraper.

### 4.4 Backups (3 capas)
- **Datos:** snapshot periódico de la SQLite de Railway (`/data/alicia.db`) → **Synology
  DS225+** (ya con snapshots Btrfs diarios, retención 30 días, Cloud Sync a Dropbox) **+**
  copia en las Macs. Triple redundancia.
- **Código:** el worker vive en el repo; checkout en ambas Macs; auto-update por `git pull`
  (o el scout dispara el update).

## 5. Modelo de datos (confiabilidad como atributo de primera clase)

Cada **fuente** lleva: `tier` (1 autoritativa · 2 oferta primaria · 3 clasificado),
`segmento` (¿medio-alto?), `cobertura_distritos` (de los 13). Cada **dato** lleva `tipo`:
`venta_cerrada` | `oferta_primaria` | `aviso` | `benchmark`. **Radar nunca mezcla sin
etiquetar** — así el análisis no miente aunque haya volumen.

Fuentes objetivo priorizadas:
- **Arreglar Urbania** (ya casi listo; validar en vivo desde el Mac Pro).
- **Adondevivir / Properati** (mismo grupo → dedup fuerte) — Tier 3, marcado "oferta".
- **Benchmark Tier-1** para validación: SUNARP (transferencias), ASEI, CAPECO, INEI/BCRP.
- **Financiamiento:** bancos comerciales vía SBS. **MiVivienda excluido** (bienestar social,
  fuera de segmento).

## 6. Seguridad
- Las Macs nunca exponen puertos (modelo pull, salida por Tailscale).
- Endpoints de worker tras `panelGate` + `x-agent-key`.
- Kill switch: honra `QUARANTINE=true` (patrón Wonderland) → workers dejan de tomar jobs.

## 7. Riesgos y mitigaciones
| Riesgo | Mitigación |
|---|---|
| Mac Pro se cae (luz/internet) | Failover a MacBook → ScrapingBee/jina |
| Sitio cambia HTML (parser stale) | 0 filas = `finding` + escalación; tests contra fixtures como señal temprana |
| Cron se salta por restart (visto hoy) | Detección por `scraped_at` real, no por "disparó el cron" |
| Scraper crashea el backend | **Aislamiento**: el scrape vive en las Macs, no en el proceso de alicia-brain |
| IP residencial se quema por abuso | Cadencia baja + rotación de user-agent; paracaídas cloud |

## 8. Fases de implementación (alto nivel → detalle en el plan)
1. **Protocolo + tablas**: endpoints de worker, tabla `workers`/`scrape_jobs`, sin tocar el
   scraping existente. Verificable con un worker fake.
2. **Worker en Mac Pro**: bootstrap + launchd + Playwright + parsers; validar Urbania **en
   vivo** desde la IP de Lima (el test real que hoy no pudimos hacer).
3. **Scout**: scheduling, detección de "no refrescó", dedup, auto-sanación, escalación.
4. **Backup node (MacBook)** + failover + backups a Synology.
5. **Fuentes nuevas**: Adondevivir/Properati con dedup; benchmark Tier-1.

## 9. Criterios de éxito
- Radar sirve ≥2 fuentes de oferta (nexo + urbania) con datos frescos y etiquetados por tipo.
- Una fuente que deja de refrescarse genera un `finding` visible **antes** de que alguien lo note.
- El scraping no puede tumbar el backend de Alicia (aislamiento probado).
- Costo de ScrapingBee en operación normal ≈ $0 (solo se usa como paracaídas).
- Backup de la DB restaurable desde Synology.
