// retorno.js — motor de retorno (yield de alquiler) y plusvalía para la Cotización.
// Los comparables de alquiler (rental_comps) son SIEMPRE data real cargada a mano
// por el equipo comercial a partir de listings efectivamente observados en
// páginas como Airbnb o Wynwood House — este archivo no inventa montos, solo
// hace la aritmética sobre lo cargado. Si no hay comps para una zona/tipología,
// las funciones devuelven null y la UI debe mostrar el estado vacío explícito.

// Revenue mensual estimado de un comparable de corta estadía (Airbnb/Wynwood House)
// a partir de tarifa diaria y ocupación OBSERVADAS (no supuestas).
export function revenueMensualCortaEstadia({ dailyRate, occupancyPct }) {
  if (dailyRate == null || occupancyPct == null) return null;
  return dailyRate * (occupancyPct / 100) * 30;
}

// Ingreso mensual de un comp, sea alquiler tradicional o corta estadía.
export function ingresoMensualComp(comp) {
  if (comp.source === "alquiler_tradicional") return comp.monthlyRent ?? null;
  return revenueMensualCortaEstadia({ dailyRate: comp.dailyRate, occupancyPct: comp.occupancyPct });
}

// Yield anual bruto = (ingreso mensual * 12) / precio de la unidad
export function yieldAnual({ precioUnidad, ingresoMensual }) {
  if (!precioUnidad || ingresoMensual == null) return null;
  return (ingresoMensual * 12) / precioUnidad;
}

// Agrupa comps por fuente y promedia (solo con lo real cargado) para una
// zona + tipología dada. Devuelve { alquiler_tradicional, airbnb, wynwood_house }
// con { promedioMensual, yieldAnual, muestras } o null si no hay data.
export function resumenRetornoPorFuente({ comps, district, tipologia, precioUnidad }) {
  const SOURCES = ["alquiler_tradicional", "airbnb", "wynwood_house"];
  const relevantes = (comps || []).filter(c =>
    c.district === district && (!tipologia || !c.tipologia || c.tipologia === tipologia)
  );
  const out = {};
  for (const source of SOURCES) {
    const rows = relevantes.filter(c => c.source === source);
    const ingresos = rows.map(ingresoMensualComp).filter(v => v != null);
    if (!ingresos.length) { out[source] = null; continue; }
    const promedioMensual = ingresos.reduce((a, b) => a + b, 0) / ingresos.length;
    out[source] = {
      promedioMensual,
      yieldAnual: yieldAnual({ precioUnidad, ingresoMensual: promedioMensual }),
      muestras: ingresos.length,
    };
  }
  return out;
}

// Listings auto-scrapeados de Wynwood House (alicia-brain, cada 6h — ver
// alicia-brain/src/rentalScraper.js). Solo devuelve tarifa/noche observada:
// NO inventamos ocupación, así que no calculamos yield acá — eso queda para
// cuando comercial carga un comparable manual con ocupación observada.
export function resumenListingsAuto({ listings, district }) {
  const rows = (listings || []).filter(l => l.district === district && l.nightly_rate != null);
  if (!rows.length) return null;
  const promedioNoche = rows.reduce((a, b) => a + b.nightly_rate, 0) / rows.length;
  return {
    promedioNoche,
    currency: rows[0].currency || "USD",
    muestras: rows.length,
    listings: rows.slice(0, 3),
  };
}

// Plusvalía: no proyectamos % de apreciación (no tenemos series históricas
// reales) — mostramos señales defendibles con la data real que sí tenemos en
// sectorData.js (relevamiento manual): dónde cae el precio de compra dentro
// del rango de mercado de la zona, y la tendencia relevada del sector.
export function percentilEnRango({ precioM2, priceRange }) {
  if (!precioM2 || !priceRange) return null;
  const [min, max] = priceRange;
  if (max <= min) return null;
  const pct = ((precioM2 - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, pct));
}
