// market.js — White Rabbit · Lima real estate data pipeline
//
// Data sources:
//   BCRP API (public, no auth) — tasas hipotecarias + tipo de cambio
//   Nexo Inmobiliario           — proyectos activos (Cloudflare-protected, seeds from static JSON)
//
// BCRP series used:
//   PN07848NM — Tasa hipotecaria MN (PEN, TEA promedio banca)
//   PN07857NM — Tasa hipotecaria ME (USD, TEA promedio banca)
//   PN01210PM — Tipo de cambio USD/PEN promedio mensual (bancario)

import { query } from "./db.js";

const BCRP_API = "https://estadisticas.bcrp.gob.pe/estadisticas/series/api";
const NEXO_API_URL = process.env.NEXO_API_URL || "";

// Returns { period, value } for the latest non-null observation of a BCRP series
async function fetchBCRP(seriesCode) {
  const url = `${BCRP_API}/${seriesCode}/json/2025-1/2026-12/ing`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`BCRP ${seriesCode} HTTP ${res.status}`);
  // La API del BCRP a veces adjunta basura después del JSON válido — parse
  // tolerante: se corta en la posición del error y se rescata el objeto.
  const body = await res.text();
  let d;
  try { d = JSON.parse(body); }
  catch (e) {
    const pos = Number((e.message.match(/position (\d+)/) || [])[1]);
    try { d = JSON.parse(body.slice(0, pos || body.lastIndexOf("}") + 1)); }
    catch { throw new Error(`BCRP ${seriesCode}: JSON inválido (${e.message.slice(0, 60)})`); }
  }
  const name = d.config?.series?.[0]?.name || seriesCode;
  for (let i = d.periods.length - 1; i >= 0; i--) {
    const v = d.periods[i].values[0];
    if (v && v !== "n.d.") {
      return { series: seriesCode, name, period: d.periods[i].name, value: parseFloat(v) };
    }
  }
  throw new Error(`BCRP ${seriesCode}: no data`);
}

// ── Schema ────────────────────────────────────────────────────────────────────
export function ensureMarketSchema() {
  query(`
    CREATE TABLE IF NOT EXISTS market_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL DEFAULT 'nexo',
      total INTEGER DEFAULT 0,
      data TEXT NOT NULL DEFAULT '[]',
      scraped_at TEXT DEFAULT (datetime('now'))
    )
  `);
  query(`CREATE INDEX IF NOT EXISTS idx_market_time ON market_snapshots(scraped_at DESC)`);
  query(`
    CREATE TABLE IF NOT EXISTS macro_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value REAL,
      period TEXT,
      label TEXT,
      source TEXT DEFAULT 'bcrp',
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  query(`
    CREATE TABLE IF NOT EXISTS bank_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bank TEXT NOT NULL,
      product TEXT NOT NULL DEFAULT 'hipotecario',
      rate_pen REAL,
      rate_usd REAL,
      plazo INTEGER DEFAULT 20,
      source TEXT DEFAULT 'playwright',
      scraped_at TEXT DEFAULT (datetime('now')),
      UNIQUE(bank, product)
    )
  `);
}

// ── Latest snapshot ───────────────────────────────────────────────────────────
export function getLatestSnapshot() {
  const { rows } = query(
    `SELECT id, source, total, scraped_at, data FROM market_snapshots ORDER BY scraped_at DESC LIMIT 1`
  );
  if (!rows[0]) return null;
  const row = rows[0];
  return {
    id:         row.id,
    source:     row.source,
    total:      row.total,
    scraped_at: row.scraped_at,
    projects:   JSON.parse(row.data || "[]"),
  };
}

// ── Fetch fresh data from Nexo ────────────────────────────────────────────────
async function fetchNexoProjects() {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "es-PE,es;q=0.9",
    "Referer": "https://nexoinmobiliario.pe/",
  };

  // Strategy 1: try their JSON API endpoint (common SPA pattern)
  const apiEndpoints = [
    ...(NEXO_API_URL ? [`${NEXO_API_URL}?limit=1000&page=1`] : []),
    `https://nexoinmobiliario.pe/api/proyectos?limit=1000`,
    `https://nexoinmobiliario.pe/api/v1/projects?limit=1000`,
    `https://nexoinmobiliario.pe/api/search?type=proyecto&limit=1000`,
  ];

  for (const url of apiEndpoints) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
      if (res.ok) {
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("json")) {
          const json = await res.json();
          const projects = extractProjects(json);
          if (projects.length > 0) {
            console.log(`✅ Nexo API hit (${url}): ${projects.length} proyectos`);
            return projects;
          }
        }
      }
    } catch (e) {
      // try next
    }
  }

  // Strategy 2: try scraping the HTML search page for embedded JSON
  try {
    const res = await fetch("https://nexoinmobiliario.pe/departamentos/lima", {
      headers,
      signal: AbortSignal.timeout(20000),
    });
    if (res.ok) {
      const html = await res.text();
      // Look for __NEXT_DATA__ or window.__data__ patterns common in Next.js/SSR sites
      const match = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (match) {
        const nextData = JSON.parse(match[1]);
        const projects = extractFromNextData(nextData);
        if (projects.length > 0) {
          console.log(`✅ Nexo SSR scrape: ${projects.length} proyectos`);
          return projects;
        }
      }
    }
  } catch (e) {
    // ignore
  }

  return null; // scraping failed, will keep last known data
}

function extractProjects(json) {
  // Handle various response shapes
  if (Array.isArray(json)) return normalizeProjects(json);
  if (json?.data && Array.isArray(json.data)) return normalizeProjects(json.data);
  if (json?.projects && Array.isArray(json.projects)) return normalizeProjects(json.projects);
  if (json?.results && Array.isArray(json.results)) return normalizeProjects(json.results);
  if (json?.items && Array.isArray(json.items)) return normalizeProjects(json.items);
  return [];
}

function extractFromNextData(nextData) {
  const candidates = [];
  const walk = (obj) => {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) { obj.forEach(walk); return; }
    if (obj.district && obj.name && (obj.list_price_m2_usd || obj.close_price_m2_usd)) {
      candidates.push(obj);
    }
    Object.values(obj).forEach(walk);
  };
  walk(nextData);
  return candidates;
}

function normalizeProjects(arr) {
  return arr.map((p, i) => ({
    id:                p.id || p.nexo_id ? `nexo_${p.nexo_id || i}` : `proj_${i}`,
    nexo_id:           p.nexo_id || p.id || i,
    source:            "nexo",
    url:               p.url || p.link || "",
    name:              p.name || p.nombre || p.title || "",
    developer:         p.developer || p.empresa || p.promotor || "",
    district:          p.district || p.distrito || "",
    zone:              p.zone || p.zona || "",
    segment:           p.segment || p.segmento || "",
    stage:             p.stage || p.etapa || "",
    delivery:          p.delivery || p.entrega || "",
    min_area_m2:       p.min_area_m2 || p.area_min || null,
    max_area_m2:       p.max_area_m2 || p.area_max || null,
    dorms_min:         p.dorms_min || p.dormitorios_min || null,
    dorms_max:         p.dorms_max || p.dormitorios_max || null,
    list_price_pen:    p.list_price_pen || p.precio_pen || null,
    list_price_usd:    p.list_price_usd || p.precio_usd || null,
    list_price_m2_usd: p.list_price_m2_usd || p.precio_m2 || null,
    close_price_m2_usd:p.close_price_m2_usd || null,
    discount_pct:      p.discount_pct || null,
    scraped_at:        new Date().toISOString(),
  }));
}

// ── Save snapshot ─────────────────────────────────────────────────────────────
function saveSnapshot(projects) {
  query(
    `INSERT INTO market_snapshots (source, total, data, scraped_at) VALUES (?, ?, ?, datetime('now'))`,
    ["nexo", projects.length, JSON.stringify(projects)]
  );
  // Keep only last 10 snapshots
  query(`DELETE FROM market_snapshots WHERE id NOT IN (SELECT id FROM market_snapshots ORDER BY scraped_at DESC LIMIT 10)`);
}

// ── Macro data (BCRP) ────────────────────────────────────────────────────────
const BCRP_SERIES = [
  { key: "tasa_hip_pen",  code: "PN07848NM", label: "Tasa hip. PEN (TEA)" },
  { key: "tasa_hip_usd",  code: "PN07857NM", label: "Tasa hip. USD (TEA)" },
  { key: "usd_pen",       code: "PN01210PM", label: "USD/PEN (promedio mensual)" },
];

async function refreshMacro() {
  const results = [];
  for (const s of BCRP_SERIES) {
    try {
      const d = await fetchBCRP(s.code);
      query(
        `INSERT INTO macro_data (key, value, period, label, source, updated_at)
         VALUES (?,?,?,?,?,datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value=excluded.value, period=excluded.period, updated_at=excluded.updated_at`,
        [s.key, d.value, d.period, s.label, "bcrp"]
      );
      results.push({ key: s.key, value: d.value, period: d.period });
      console.log(`🐰 BCRP ${s.key}: ${d.value} (${d.period})`);
    } catch (e) {
      console.warn(`🐰 BCRP ${s.key} error:`, e.message);
    }
  }
  return results;
}

export function getMacroData() {
  const { rows } = query(`SELECT key, value, period, label, source, updated_at FROM macro_data`);
  return Object.fromEntries(rows.map(r => [r.key, r]));
}

// ── Bank rates (from Playwright scraper) ─────────────────────────────────────
export function saveBankRates(rates) {
  for (const r of rates) {
    if (!r.bank || (!r.rate_pen && !r.rate_usd)) continue;
    query(
      `INSERT INTO bank_rates (bank, product, rate_pen, rate_usd, plazo, source, scraped_at)
       VALUES (?,?,?,?,?,?,datetime('now'))
       ON CONFLICT(bank, product) DO UPDATE SET
         rate_pen=excluded.rate_pen, rate_usd=excluded.rate_usd,
         source=excluded.source, scraped_at=excluded.scraped_at`,
      [r.bank, r.product || "hipotecario", r.rate_pen || null, r.rate_usd || null, r.plazo || 20, r.source || "playwright"]
    );
  }
  console.log(`🐰 Bank rates: ${rates.length} entidades guardadas`);
}

export function getBankRates() {
  const { rows } = query(
    `SELECT bank, product, rate_pen, rate_usd, plazo, source, scraped_at
     FROM bank_rates ORDER BY rate_pen ASC`
  );
  return rows;
}

// ── Import from Playwright scraper ────────────────────────────────────────────
export function importProjects(projects) {
  if (!projects?.length) return 0;
  // Normalize raw scraped data to our schema
  const normalized = projects.map((p, i) => ({
    id: `nexo_scraped_${i}`,
    source: "nexo",
    url: p.url || "",
    name: p.name || p.title || "",
    developer: p.developer || "",
    district: p.district || extractDistrict(p.url || p.raw || ""),
    list_price_m2_usd: extractPrice(p.price || p.raw || ""),
    scraped_at: new Date().toISOString(),
  })).filter(p => p.name);

  if (normalized.length > 0) {
    saveSnapshot(normalized);
    console.log(`🐰 Import: ${normalized.length} proyectos guardados`);
  }
  return normalized.length;
}

function extractDistrict(text) {
  const districts = ["Miraflores","San Isidro","Barranco","Surco","La Molina","Jesús María",
    "Jesus Maria","Magdalena","San Borja","Pueblo Libre","San Miguel","Lince","Chorrillos",
    "Surquillo","Breña","Lima","San Luis","La Victoria","Ate","San Martín de Porres"];
  for (const d of districts) {
    if (text.toLowerCase().includes(d.toLowerCase())) return d;
  }
  return "";
}

function extractPrice(text) {
  const match = text.match(/\$\s*([\d,]+(?:\.\d+)?)|USD\s*([\d,]+(?:\.\d+)?)/i);
  if (match) {
    const v = parseFloat((match[1] || match[2]).replace(/,/g, ""));
    if (v > 500 && v < 20000) return v; // plausible $/m2
  }
  return null;
}

// ── Main refresh (called by cron + API) ───────────────────────────────────────
export async function refreshMarketData() {
  console.log("🐰 White Rabbit: iniciando refresh...");
  const result = { projects: null, macro: null };

  // 1. BCRP macro data (always works — public API)
  try {
    result.macro = await refreshMacro();
    console.log(`🐰 BCRP: ${result.macro.length} series actualizadas`);
  } catch (e) {
    console.error("🐰 BCRP error:", e.message);
  }

  // 2. Nexo projects (Cloudflare-protected — tries but will usually fall back to cached)
  try {
    const projects = await fetchNexoProjects();
    if (projects && projects.length > 0) {
      saveSnapshot(projects);
      console.log(`🐰 Nexo: ${projects.length} proyectos guardados`);
      result.projects = { ok: true, total: projects.length, source: "nexo_live" };
    } else {
      const last = getLatestSnapshot();
      result.projects = { ok: false, reason: "scrape_failed", last_update: last?.scraped_at, total: last?.total };
    }
  } catch (e) {
    console.error("🐰 Nexo error:", e.message);
    result.projects = { ok: false, reason: e.message };
  }

  return result;
}

// ── Seed from static file (one-time, called on startup if table empty) ────────
export async function seedFromStaticIfEmpty(staticProjects) {
  const existing = getLatestSnapshot();
  if (existing) return; // already have data
  if (!staticProjects || !staticProjects.length) return;
  saveSnapshot(staticProjects);
  console.log(`🐰 Market: seeded ${staticProjects.length} proyectos desde static file`);
}
