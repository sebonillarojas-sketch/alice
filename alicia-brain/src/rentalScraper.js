// rentalScraper.js — White Rabbit · comparables de alquiler de corta estadía
//
// Fuente: Wynwood House (wynwood-house.com/lima-peru/) — server-rendered,
// sin JS ni protección anti-bot, así que alcanza con HTTP + parseo de HTML
// (nada de Playwright/headless acá). Verificado a mano jul-2026: cada
// listing vive en un bloque `room-item-listing` con título, zona, lat/lng
// y tarifa por noche ya en el HTML servido.
//
// Airbnb NO se scrapea acá: sus páginas de búsqueda están detrás de Akamai
// Bot Manager (protección anti-bot dedicada, no un simple check de user-agent
// como Cloudflare en Nexo). Evadir eso es un terreno distinto — los
// comparables de Airbnb se cargan a mano desde el ERP (ver rental_comps en
// Supabase / CotizacionView "agregar comparable real").

const WYNWOOD_LIMA_URL = "https://wynwood-house.com/lima-peru/";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
  "Accept-Language": "es-PE,es;q=0.9",
};

// Distritos que ya seguimos en sectorData.js/DISTRICTS_DATA (frontend) — se
// usa para normalizar la zona cruda del listing ("San Isidro, Lima" → "San Isidro").
const KNOWN_DISTRICTS = [
  "Miraflores", "San Isidro", "Barranco", "La Molina", "Surco", "Santiago de Surco",
  "Jesús María", "Jesus Maria", "Magdalena", "San Borja", "Pueblo Libre",
  "San Miguel", "Lince", "Chorrillos",
];

function normalizeDistrict(rawZone) {
  if (!rawZone) return null;
  const first = rawZone.split(",")[0].trim();
  const hit = KNOWN_DISTRICTS.find(d => d.toLowerCase() === first.toLowerCase());
  if (hit === "Santiago de Surco") return "Surco";
  if (hit === "Jesus Maria") return "Jesús María";
  return hit || first; // si no matchea la lista conocida, se guarda tal cual
}

function decodeEntities(s) {
  return s?.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"') ?? s;
}

// El sitio sirve el mismo listing en inglés o español según locale detection
// del lado del servidor (visto en la práctica: "48 / night" vs "44 / noche",
// y lat/lng con "." o "," como separador decimal) — el parseo tiene que
// bancarse ambos casos, no asumir un solo idioma.
function toFloatAnyLocale(s) {
  if (s == null) return NaN;
  return parseFloat(String(s).replace(",", "."));
}

// Parsea un bloque individual `room-item-listing` → { code, title, district, lat, lng, currency, nightlyRate, url }
function parseListingBlock(block) {
  const code = (block.match(/href="\/r\/([A-Z0-9]+)\/"/) || [])[1];
  if (!code) return null;
  const title = decodeEntities((block.match(/<div class="room-title">([^<]+)<\/div>/) || [])[1]?.trim());
  const rawZone = (block.match(/<div class="room-zone">([^<]+)<\/div>/) || [])[1]?.trim();
  const lat = toFloatAnyLocale((block.match(/data-lat="(-?[\d.,]+)"/) || [])[1]);
  const lng = toFloatAnyLocale((block.match(/data-lng="(-?[\d.,]+)"/) || [])[1]);
  const priceMatch = block.match(/search-room-price[^]*?<u>\s*([A-Z]{2,3})\s*([\d.,]+)\s*\/\s*(?:night|noche)/i);
  const currency = priceMatch?.[1]?.toUpperCase() || null;
  const nightlyRate = priceMatch ? toFloatAnyLocale(priceMatch[2]) : null;

  return {
    code,
    title: title || null,
    district: normalizeDistrict(rawZone),
    rawZone: rawZone || null,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    currency,
    nightlyRate,
    url: `https://wynwood-house.com/r/${code}/`,
  };
}

export async function scrapeWynwoodHouseLima() {
  const res = await fetch(WYNWOOD_LIMA_URL, { headers: HEADERS, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Wynwood House HTTP ${res.status}`);
  const html = await res.text();

  // split() ya delimita cada listing completo (el próximo delimitador cierra el bloque anterior)
  const blocks = html.split('room-item-listing"').slice(1);
  const byCode = new Map();
  for (const raw of blocks) {
    const parsed = parseListingBlock(raw);
    if (parsed && parsed.nightlyRate != null && !byCode.has(parsed.code)) byCode.set(parsed.code, parsed);
  }
  const listings = [...byCode.values()];
  if (!listings.length) throw new Error("Wynwood House: 0 listings parseados — es probable que hayan cambiado el HTML, revisar selectors");
  return listings;
}
