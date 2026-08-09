// Lógica pura de Radar para las tools de Alicia (sin DB ni red — testeable).
// La data la trae market.js; acá solo se filtra/resume/formatea.

// Filtra los proyectos de un snapshot por distrito y/o tipología (dorms) y arma un
// resumen con estadística de precio/m². Devuelve un objeto (no texto) para poder testear.
export function summarizeMarket(snapshot, { district, dorms, macro, bankRates } = {}) {
  if (!snapshot || !Array.isArray(snapshot.projects) || !snapshot.projects.length) {
    return { empty: true, district: district || null, scraped_at: snapshot?.scraped_at || null };
  }
  let projects = snapshot.projects;
  if (district) {
    const d = district.toLowerCase();
    projects = projects.filter(p => String(p.district || "").toLowerCase().includes(d));
  }
  if (dorms != null) {
    projects = projects.filter(p => {
      const lo = p.dorms_min ?? p.dorms_max;
      const hi = p.dorms_max ?? p.dorms_min;
      if (lo == null && hi == null) return false;
      return dorms >= lo && dorms <= hi;
    });
  }
  if (!projects.length) {
    return { empty: true, filtered: true, district: district || null, dorms: dorms ?? null, scraped_at: snapshot.scraped_at };
  }
  const m2 = projects.map(p => p.list_price_m2_usd).filter(v => typeof v === "number" && v > 0);
  const price_m2_usd = m2.length
    ? { min: Math.min(...m2), max: Math.max(...m2), avg: Math.round(m2.reduce((a, b) => a + b, 0) / m2.length) }
    : null;
  return {
    empty: false,
    count: projects.length,
    district: district || null,
    dorms: dorms ?? null,
    source: snapshot.source || null,
    scraped_at: snapshot.scraped_at || null,
    price_m2_usd,
    projects: projects.slice(0, 8).map(p => ({
      name: p.name || p.nombre || "(sin nombre)",
      district: p.district || "",
      dorms: p.dorms_min && p.dorms_max && p.dorms_min !== p.dorms_max ? `${p.dorms_min}-${p.dorms_max}` : (p.dorms_min || p.dorms_max || "?"),
      price_m2_usd: p.list_price_m2_usd ?? null,
    })),
    macro: macro ? pickMacro(macro) : null,
    bank_rates_top: Array.isArray(bankRates) ? bankRates.slice(0, 3).map(r => ({ bank: r.bank, rate_pen: r.rate_pen, rate_usd: r.rate_usd })) : null,
  };
}

function pickMacro(macro) {
  const g = (k) => (macro && macro[k] && macro[k].value != null ? macro[k].value : null);
  return { tasa_hip_pen: g("tasa_hip_pen"), tasa_hip_usd: g("tasa_hip_usd"), usd_pen: g("usd_pen") };
}

// ¿El snapshot de esta fuente es lo bastante reciente para NO re-scrapear?
// scraped_at viene de sqlite datetime('now') → "YYYY-MM-DD HH:MM:SS" en UTC.
export function isFresh(scraped_at, { now = Date.now(), windowMs = 15 * 60 * 1000 } = {}) {
  if (!scraped_at) return false;
  const t = Date.parse(String(scraped_at).replace(" ", "T") + "Z");
  if (Number.isNaN(t)) return false;
  return now - t < windowMs;
}

// Formatea el resumen a texto criollo para WhatsApp. Honesto si no hay data.
export function formatMarketSummary(summary) {
  if (!summary || summary.empty) {
    const zona = summary?.district ? ` de ${summary.district}` : "";
    const cuando = summary?.scraped_at ? ` La última data de Radar es del ${summary.scraped_at}.` : " Radar no tiene data cargada todavía.";
    return `No tengo proyectos${zona} en Radar ahora mismo.${cuando} ¿Querés que lo refresque?`;
  }
  const s = summary.price_m2_usd;
  const precio = s ? `precio/m² USD ${s.min}–${s.max} (prom ${s.avg})` : "sin precios cargados";
  const head = `📊 Radar${summary.district ? ` · ${summary.district}` : ""}: ${summary.count} proyecto(s) · ${precio} · data del ${summary.scraped_at}`;
  const lista = summary.projects.map(p => `• ${p.name} — ${p.dorms} dorm · ${p.price_m2_usd ? `USD ${p.price_m2_usd}/m²` : "s/precio"}`).join("\n");
  let extra = "";
  if (summary.macro) {
    const m = summary.macro;
    extra += `\n💵 Tasa hipot.: PEN ${m.tasa_hip_pen ?? "?"}% · USD ${m.tasa_hip_usd ?? "?"}% · TC ${m.usd_pen ?? "?"}`;
  }
  return `${head}\n${lista}${extra}`;
}
