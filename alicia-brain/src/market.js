// market.js — White Rabbit scraper · Lima real estate data
// Fetches from nexoinmobiliario.pe, stores in local SQLite, serves to ALICE

import { query } from "./db.js";

const NEXO_SEARCH_URL = "https://nexoinmobiliario.pe/search/projects";
const NEXO_API_URL    = "https://nexoinmobiliario.pe/api/v2/projects";

// ── Schema (called once in db.js initSchema but added here for safety) ────────
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
    `${NEXO_API_URL}?limit=1000&page=1`,
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

// ── Main refresh (called by cron + API) ───────────────────────────────────────
export async function refreshMarketData() {
  console.log("🐰 White Rabbit: iniciando refresh de market data...");
  try {
    const projects = await fetchNexoProjects();
    if (projects && projects.length > 0) {
      saveSnapshot(projects);
      console.log(`🐰 White Rabbit: ${projects.length} proyectos guardados`);
      return { ok: true, total: projects.length, source: "nexo_live" };
    }

    // Scraping failed — check if we have any data at all
    const last = getLatestSnapshot();
    if (last) {
      console.log(`🐰 White Rabbit: scrape falló, manteniendo datos de ${last.scraped_at}`);
      return { ok: false, reason: "scrape_failed", last_update: last.scraped_at, total: last.total };
    }

    return { ok: false, reason: "no_data" };
  } catch (e) {
    console.error("🐰 White Rabbit market error:", e.message);
    return { ok: false, reason: e.message };
  }
}

// ── Seed from static file (one-time, called on startup if table empty) ────────
export async function seedFromStaticIfEmpty(staticProjects) {
  const existing = getLatestSnapshot();
  if (existing) return; // already have data
  if (!staticProjects || !staticProjects.length) return;
  saveSnapshot(staticProjects);
  console.log(`🐰 Market: seeded ${staticProjects.length} proyectos desde static file`);
}
