// urbania.js — listings de venta en Lima (Urbania.pe).
//
// Urbania está detrás de Cloudflare managed challenge: exige render de JS + proxy
// premium con IP peruana (ver render.js → premiumProxy:true). Flujo en dos pasos:
//   1. Página de búsqueda /buscar/venta-de-departamentos-en-<distrito> → URLs de detalle
//      (30 tarjetas/página, paginado ?page=N). El JSON-LD de la búsqueda da nombres
//      genéricos ("Desarrollo vertical"), así que la data rica se saca del detalle.
//   2. Cada página de detalle embebe el estado del posting (RPLIS) con título,
//      precio, área, dormitorios, distrito y coordenadas exactas.
//
// Verificado contra captura real: San Miguel, PEN 386,000, 73 m², 2 dorm, lat/lng.
// Los precios en PEN se convierten a USD con el tipo de cambio BCRP (macro_data).

import { renderFetch } from "./render.js";

const BASE = "https://urbania.pe";
// Distritos objetivo (los mismos que sigue el Radar). "lima" trae el agregado amplio.
const DEFAULT_DISTRICTS = [
  "lima", "miraflores", "san-isidro", "barranco", "surco",
  "san-borja", "jesus-maria", "magdalena-del-mar", "san-miguel", "pueblo-libre",
];

function decodeEntities(s) {
  return s?.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"') ?? s;
}
function num(s) {
  if (s == null) return null;
  const v = parseFloat(String(s).replace(/,/g, ""));
  return Number.isFinite(v) ? v : null;
}

// Saca las URLs de detalle de una página de búsqueda (JSON-LD Apartment + anchors).
export function extractDetailUrls(searchHtml) {
  const urls = new Set();
  for (const m of searchHtml.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let parsed;
    try { parsed = JSON.parse(m[1].trim()); } catch { continue; }
    for (const b of Array.isArray(parsed) ? parsed : [parsed]) {
      if (b && b["@type"] === "Apartment" && b.url) urls.add(decodeEntities(b.url).split(/[?#]/)[0]);
    }
  }
  for (const m of searchHtml.matchAll(/href="(\/inmueble\/[^"?#]+)/g)) {
    urls.add(BASE + m[1]);
  }
  return [...urls];
}

// Parsea una página de detalle → registro normalizado (esquema del Radar).
export function parseDetail(html, url, usdPen = 3.4) {
  const gen = decodeEntities((html.match(/"generatedTitle":"([^"]+)"/) || [])[1] || "");
  const title = decodeEntities((html.match(/"title":"([^"]+)"/) || [])[1] || "");
  const area = num((gen.match(/(\d+(?:\.\d+)?)\s*m²/) || [])[1]) ||
    num((html.match(/"CFT100":\{[^}]*"value":"?(\d+(?:\.\d+)?)/) || [])[1]);
  const dorms = num((gen.match(/(\d+)\s*dormitor/i) || [])[1]);
  const priceBlock = html.match(/"prices":\[\{[^]*?"isoCode":"([A-Z]{3})"[^]*?"amount":(\d+)/);
  const currency = priceBlock?.[1] || null;
  const price = num(priceBlock?.[2]);
  const district = decodeEntities((html.match(/"location":\{"locationId":"[^"]*","name":"([^"]+)"/) || [])[1] || "");
  const geo = html.match(/"geolocation":\{"latitude":(-?\d+\.\d+),"longitude":(-?\d+\.\d+)/);
  const developer = decodeEntities((html.match(/"publisher":\{[^}]*"name":"([^"]+)"/) || [])[1] || "");
  const address = decodeEntities((html.match(/"address":\{"name":"([^"]+)"/) || [])[1] || "");

  if (!district && price == null) return null; // detalle sin data útil (challenge no resuelto, etc.)

  const isUSD = currency === "USD";
  const priceUsd = price == null ? null : Math.round(isUSD ? price : price / usdPen);
  const id = (url.match(/-(\d+)(?:$|\?)/) || [])[1];
  return {
    id: id ? `urbania_${id}` : `urbania_${Math.abs(hashCode(url))}`,
    source: "urbania",
    url: url.split(/[?#]/)[0],
    name: title || gen || "Departamento",
    developer,
    district,
    zone: "",
    stage: "",
    address,
    units: null,
    min_area_m2: area,
    max_area_m2: area,
    dorms_min: dorms,
    dorms_max: dorms,
    currency,
    list_price_pen: isUSD ? null : price,
    list_price_usd: priceUsd,
    list_price_m2_usd: priceUsd && area ? Math.round(priceUsd / area) : null,
    lat: geo ? num(geo[1]) : null,
    lng: geo ? num(geo[2]) : null,
    scraped_at: new Date().toISOString(),
  };
}

function hashCode(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
  return h;
}

// Scrapea Lima: recorre distritos, junta URLs de detalle y parsea hasta maxDetails.
export async function scrapeUrbaniaLima({ districts = DEFAULT_DISTRICTS, maxDetails = 40 } = {}) {
  let usdPen = 3.4;
  try { const { getMacroData } = await import("../market.js"); usdPen = getMacroData()?.usd_pen?.value || usdPen; } catch {}

  const detailUrls = new Set();
  for (const d of districts) {
    if (detailUrls.size >= maxDetails) break;
    const slug = d === "lima" ? "venta-de-departamentos-en-lima" : `venta-de-departamentos-en-${d}-lima`;
    try {
      const html = await renderFetch(`${BASE}/buscar/${slug}`, { premiumProxy: true, wait: 2500 });
      for (const u of extractDetailUrls(html)) detailUrls.add(u);
    } catch (e) {
      console.warn(`🐰 Urbania búsqueda ${d}: ${e.message}`);
    }
  }

  const urls = [...detailUrls].slice(0, maxDetails);
  const projects = [];
  for (const url of urls) {
    try {
      const html = await renderFetch(url, { premiumProxy: true, wait: 2000 });
      const rec = parseDetail(html, url, usdPen);
      if (rec && rec.district) projects.push(rec);
    } catch (e) {
      console.warn(`🐰 Urbania detalle: ${e.message}`);
    }
  }
  console.log(`🐰 Urbania: ${projects.length} proyectos de ${urls.length} detalles (${districts.length} distritos)`);
  return projects;
}
