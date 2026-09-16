// scrapers/index.js — orquesta las fuentes que necesitan render de JS / bypass
// anti-bot (SBS → buzzfly1, Urbania → buzzfly2).
//
// Cada fuente registra SU PROPIA corrida en agent_runs/agent_findings con su
// identidad buzzfly (ver fleet.js). Antes las dos escribían juntas bajo
// 'white-rabbit' y la guardia de infra les borraba los hallazgos cada 30 min.
//
// Nexo (buzzfly3) y Wynwood House (buzzfly4) NO van acá: se scrapean directo
// (sin proxy) desde market.js. La bestia es buzzfly5 y reporta al pushear.

import { FLEET, recordScraperRun } from "./fleet.js";
import { saveBankRates, saveSnapshot } from "../market.js";

const SOURCES = {
  sbs: {
    agent: "buzzfly1",
    async run() {
      const { scrapeSBSMortgageRates } = await import("./sbs.js");
      const rows = await scrapeSBSMortgageRates();
      if (rows.length) saveBankRates(rows);
      return { ok: rows.length > 0, count: rows.length, detail: "tasas hipotecarias por banco" };
    },
  },
  urbania: {
    agent: "buzzfly2",
    async run() {
      const { scrapeUrbaniaLima } = await import("./urbania.js");
      const projects = await scrapeUrbaniaLima();
      if (projects.length) saveSnapshot(projects, "urbania");
      return { ok: projects.length > 0, count: projects.length, detail: "listings de venta Lima" };
    },
  },
};

// Corre las fuentes pedidas. `sources` = subconjunto de Object.keys(SOURCES).
// Devuelve un resumen; cada fuente queda registrada bajo su propio buzzfly.
export async function runScraperAgent({ sources = Object.keys(SOURCES) } = {}) {
  console.log(`🪰 Scrapers: iniciando (${sources.join(", ")})`);
  const results = [];

  for (const name of sources) {
    const def = SOURCES[name];
    if (!def) { console.warn(`🪰 Scrapers: fuente desconocida "${name}"`); continue; }
    const { agent } = def;
    const label = FLEET[agent]?.label || name;

    let r;
    try {
      const out = await def.run();
      r = { source: name, agent, ...out };
    } catch (e) {
      console.error(`🪰 ${agent} (${name}) error:`, e.message);
      r = { source: name, agent, ok: false, count: 0, error: e.message };
    }
    results.push(r);

    // 0 registros sin excepción es un fallo igual de real que una excepción:
    // así se veía Urbania mientras ScrapingBee devolvía 401 en cada request.
    const findings = r.ok ? [] : [{
      severity: "major",
      category: "scraper",
      detail: r.error
        ? `${label}: ${String(r.error).slice(0, 160)}`
        : `${label}: 0 registros (¿challenge/proxy?)`,
    }];
    recordScraperRun(agent, {
      result: r.ok ? "ok" : "error",
      summary: r.ok ? `${label}: ${r.count} registros` : `${label}: sin datos`,
      actions: [r],
      findings,
    });
    console.log(`🪰 ${agent} · ${name}:${r.ok ? r.count : "✗"}`);
  }

  const okCount = results.filter((r) => r.ok).length;
  return {
    ok: okCount > 0,
    result: okCount === results.length ? "ok" : okCount > 0 ? "issues" : "error",
    results,
    findings: results.filter((r) => !r.ok).map((r) => ({ severity: "major", category: "scraper", detail: r.error || `${r.source}: 0 registros` })),
  };
}

export const SCRAPER_SOURCES = Object.keys(SOURCES);
