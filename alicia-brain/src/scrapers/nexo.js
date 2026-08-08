// nexo.js — Nexo Inmobiliario (proyectos en venta).
//
// La web de Nexo NO es Next.js: embebe los proyectos de cada página en
// `var search_data=[...]` (SSR + filtrado client-side, verificado jul 2026).
// Desde una IP RESIDENCIAL de Lima el fetch directo pasa sin Cloudflare — no
// necesita browser ni ScrapingBee. Es el método que en prod sacó ~500 proyectos
// (alineado con market.js). Módulo PURO: fetch + parse, sin DB.

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/json,*/*",
  "Accept-Language": "es-PE,es;q=0.9",
  "Referer": "https://nexoinmobiliario.pe/",
};

// Cada página por distrito embebe ~24 proyectos; se recorren varios y se mergea por project_id.
const NEXO_PAGES = [
  "venta-de-inmuebles", "departamentos/lima", "departamentos/miraflores",
  "departamentos/san-isidro", "departamentos/barranco", "departamentos/santiago-de-surco",
  "departamentos/jesus-maria", "departamentos/magdalena-del-mar", "departamentos/san-miguel",
  "departamentos/lince", "departamentos/pueblo-libre", "departamentos/san-borja",
];

// Extrae el array de `var search_data=[...]` del HTML (parser de corchetes balanceados).
export function extractSearchData(html) {
  const i = html.indexOf("var search_data=");
  if (i < 0) return [];
  const start = html.indexOf("[", i);
  if (start < 0) return [];
  let depth = 0, inStr = false, esc = false;
  for (let j = start; j < html.length; j++) {
    const ch = html[j];
    if (esc) { esc = false; continue; }
    if (ch === "\\") { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === "[") depth++;
    else if (ch === "]" && --depth === 0) {
      try { return JSON.parse(html.slice(start, j + 1)); } catch { return []; }
    }
  }
  return [];
}

// Mapea los campos reales de Nexo al esquema del Radar. Precios a USD con usdPen (fallback 3.4).
export function mapNexoSearchData(arr, usdPen = 3.4) {
  return arr.map((p) => {
    const price = parseFloat(p.min_price) || null;
    const isUSD = /\$/.test(p.coin || "") && !/S\//.test(p.coin || "");
    const priceUsd = price == null ? null : (isUSD ? price : price / usdPen);
    const areaMin = parseFloat(p.area_min) || null;
    return {
      id: `nexo_${p.project_id}`, nexo_id: p.project_id, source: "nexo",
      url: p.url || "", name: p.name || "", developer: p.builder_name || "",
      district: p.distrito || "", zone: p.ubicacion_seo || "", stage: p.project_phase || "",
      address: p.direccion || "", units: parseInt(p.cantidad) || null,
      min_area_m2: areaMin, max_area_m2: parseFloat(p.area_max) || null,
      dorms_min: parseInt(p.room_min) || null, dorms_max: parseInt(p.room_max) || null,
      list_price_pen: isUSD ? null : price,
      list_price_usd: priceUsd != null ? Math.round(priceUsd) : null,
      list_price_m2_usd: priceUsd && areaMin ? Math.round(priceUsd / areaMin) : null,
      lat: parseFloat(p.coord_lat) || null, lng: parseFloat(p.long) || null,
      scraped_at: new Date().toISOString(),
    };
  }).filter((p) => p.name && p.district);
}

// Scrapea Nexo desde una IP de Lima (fetch directo, sin browser). Devuelve projects mapeados.
export async function scrapeNexoLima({ usdPen = 3.4, pages = NEXO_PAGES } = {}) {
  const byId = new Map();
  for (const slug of pages) {
    try {
      const res = await fetch(`https://nexoinmobiliario.pe/${slug}`, { headers: HEADERS, redirect: "follow", signal: AbortSignal.timeout(20000) });
      if (!res.ok) continue;
      for (const p of extractSearchData(await res.text())) {
        if (p.project_id && !byId.has(p.project_id)) byId.set(p.project_id, p);
      }
    } catch { /* siguiente página */ }
  }
  return mapNexoSearchData([...byId.values()], usdPen);
}
