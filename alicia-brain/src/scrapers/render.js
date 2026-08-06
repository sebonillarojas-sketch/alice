// render.js — fetch de páginas que exigen ejecución de JS / bypass de anti-bot.
//
// SBS (Incapsula/Imperva) y Urbania (Cloudflare managed challenge) devuelven 403
// o un shell vacío a un fetch/curl plano: hay que renderizar JS. Orden de canales:
//   1. ScrapingBee con render_js=true (+ premium_proxy PE para Urbania) — producción.
//   2. r.jina.ai — reader proxy que renderiza JS (gratis/bajo costo), buen fallback.
//   3. fetch directo — solo sirve para sitios sin protección; último recurso.
//
// Sin SCRAPINGBEE_API_KEY el scraper igual funciona vía jina, con menos garantías
// de volumen. Nunca lanza por "sin key": intenta el siguiente canal.

const SCRAPINGBEE = "https://app.scrapingbee.com/api/v1/";
export const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

// Devuelve el HTML renderizado de `target`. `premiumProxy` activa proxy residencial
// con geolocalización peruana (necesario para el challenge de Cloudflare de Urbania).
export async function renderFetch(target, { premiumProxy = false, wait = 0, timeout = 90000 } = {}) {
  const key = process.env.SCRAPINGBEE_API_KEY;
  let lastErr = null;

  // 1) ScrapingBee (render JS real)
  if (key) {
    try {
      const qs = new URLSearchParams({ api_key: key, url: target, render_js: "true" });
      if (premiumProxy) { qs.set("premium_proxy", "true"); qs.set("country_code", "pe"); }
      if (wait) qs.set("wait", String(wait));
      const r = await fetch(`${SCRAPINGBEE}?${qs.toString()}`, { signal: AbortSignal.timeout(timeout) });
      if (r.ok) return await r.text();
      lastErr = `ScrapingBee HTTP ${r.status}`;
      console.warn(`renderFetch: ${lastErr} para ${target}`);
    } catch (e) { lastErr = `ScrapingBee ${e.message}`; console.warn("renderFetch:", lastErr); }
  }

  // 2) jina.ai reader (renderiza JS, devuelve HTML con x-respond-with)
  try {
    const r = await fetch(`https://r.jina.ai/${target}`, {
      headers: { "x-respond-with": "html", "User-Agent": UA },
      signal: AbortSignal.timeout(timeout),
    });
    if (r.ok) return await r.text();
    lastErr = `jina HTTP ${r.status}`;
    console.warn(`renderFetch: ${lastErr} para ${target}`);
  } catch (e) { lastErr = `jina ${e.message}`; console.warn("renderFetch:", lastErr); }

  // 3) fetch directo (sin bypass — solo sitios sin protección)
  try {
    const r = await fetch(target, {
      headers: { "User-Agent": UA, "Accept-Language": "es-PE,es;q=0.9" },
      redirect: "follow",
      signal: AbortSignal.timeout(timeout),
    });
    if (r.ok) return await r.text();
    lastErr = `directo HTTP ${r.status}`;
  } catch (e) { lastErr = `directo ${e.message}`; }

  throw new Error(`renderFetch: todos los canales fallaron para ${target} (${lastErr})`);
}
