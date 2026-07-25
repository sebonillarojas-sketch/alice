// scrapers/index.js — Agente scraper (rol de datos de White Rabbit 🐰).
//
// Orquesta las fuentes de scraping que necesitan render de JS / bypass anti-bot
// (SBS, Urbania) y persiste cada corrida en agent_runs/agent_findings, para que
// el trabajo del agente SEA VISIBLE en el cockpit en vez de correr en silencio.
//
// Nexo y Wynwood House NO van acá: se scrapean directo (sin proxy) desde market.js
// (refreshMarketData / refreshRentalListings). Este módulo agrega las fuentes duras.

import { query } from "../db.js";
import { saveBankRates, saveSnapshot } from "../market.js";

const SOURCES = {
  async sbs() {
    const { scrapeSBSMortgageRates } = await import("./sbs.js");
    const rows = await scrapeSBSMortgageRates();
    if (rows.length) saveBankRates(rows);
    return { source: "sbs", ok: rows.length > 0, count: rows.length, detail: "tasas hipotecarias por banco" };
  },
  async urbania() {
    const { scrapeUrbaniaLima } = await import("./urbania.js");
    const projects = await scrapeUrbaniaLima();
    if (projects.length) saveSnapshot(projects, "urbania");
    return { source: "urbania", ok: projects.length > 0, count: projects.length, detail: "listings de venta Lima" };
  },
};

// Corre el agente scraper. `sources` = subconjunto de Object.keys(SOURCES).
// Devuelve un resumen y registra la corrida bajo el agente 'white-rabbit'.
export async function runScraperAgent({ sources = Object.keys(SOURCES) } = {}) {
  console.log(`🐰 Scraper agent: iniciando (${sources.join(", ")})`);
  const results = [];
  const findings = [];

  for (const name of sources) {
    const fn = SOURCES[name];
    if (!fn) { console.warn(`🐰 Scraper: fuente desconocida "${name}"`); continue; }
    try {
      const r = await fn();
      results.push(r);
      if (!r.ok) {
        findings.push({ severity: "major", category: "scraper", detail: `${r.source}: 0 registros (¿challenge/proxy?)` });
      }
    } catch (e) {
      console.error(`🐰 Scraper ${name} error:`, e.message);
      results.push({ source: name, ok: false, count: 0, error: e.message });
      findings.push({ severity: "major", category: "scraper", detail: `${name}: ${e.message.slice(0, 160)}` });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  const summary = results.map((r) => `${r.source}:${r.ok ? r.count : "✗"}`).join(" · ");
  const result = findings.length === 0 ? "ok" : okCount > 0 ? "issues" : "error";

  recordRun(result, `scrape ${summary}`, results, findings);
  console.log(`🐰 Scraper agent: ${summary} (${result})`);
  return { ok: okCount > 0, result, results, findings };
}

// Persiste la corrida bajo 'white-rabbit' (su misión de datos, según el handoff).
// agent_runs.result solo acepta ok/issues/error (CHECK). Findings van a agent_findings.
function recordRun(result, summary, results, findings) {
  try {
    const { lastID: runId } = query(
      `INSERT INTO agent_runs (agent, finished_at, result, summary, actions_taken)
       VALUES ('white-rabbit', datetime('now'), ?, ?, ?)`,
      [result, summary, JSON.stringify(results)]
    );
    for (const f of findings) {
      query(
        `INSERT INTO agent_findings (agent, run_id, severity, category, detail, status)
         VALUES ('white-rabbit', ?, ?, ?, ?, 'open')`,
        [runId, f.severity, f.category, f.detail]
      );
    }
  } catch (e) {
    console.error("🐰 Scraper: no se pudo registrar la corrida:", e.message);
  }
}

export const SCRAPER_SOURCES = Object.keys(SOURCES);
