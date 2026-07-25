// Bammy — cerebro de reglas del generador de planos (BAM).
// Playbook destilado de su autoaprendizaje: Neufert (ergonomía/clearances), RNE Perú
// (A.010/A.020/A.130), estudio de mercado Nexo (jul-2026, Lima) y el patrón real de
// distribución de BAM (proyecto Del Castillo). Todo esto son DEFAULTS inteligentes:
// el generador (packFloor/tipologias) los consulta; el usuario siempre puede sobreescribir.

// ── Mercado Nexo (Lima, jul-2026) ────────────────────────────────────────────
// Unidad promedio vendida ~65 m². 2D≈39% y 3D≈39% de las ventas (~78% combinado);
// el resto 1D/studio. El mix y el área objetivo se mueven con el segmento/distrito.
export const BAMMY = {
  // mix (%1D, %2D, %3D) + área objetivo por SEGMENTO de producto
  mixPorSegmento: {
    economico: { pct1: 40, pct2: 45, pct3: 15, areaObjetivo: 55 }, // VIS / Mivivienda
    medio:     { pct1: 20, pct2: 45, pct3: 35, areaObjetivo: 70 }, // Lima Moderna
    premium:   { pct1: 10, pct2: 40, pct3: 50, areaObjetivo: 95 }, // Lima Top
  },
  // área objetivo aprendida por distrito (metraje típico de venta en Nexo)
  areaPorDistrito: {
    "miraflores": 92, "san isidro": 112, "magdalena": 68, "magdalena del mar": 68,
    "jesus maria": 66, "jesús maría": 66, "lince": 64, "pueblo libre": 66,
    "surco": 82, "barranco": 95, "san miguel": 62,
  },
  segmentoPorDistrito: {
    "miraflores": "premium", "san isidro": "premium", "barranco": "premium",
    "surco": "medio", "magdalena": "medio", "magdalena del mar": "medio",
    "jesus maria": "medio", "jesús maría": "medio", "lince": "medio",
    "pueblo libre": "medio", "san miguel": "economico",
  },

  // ── Patrón de distribución BAM (proyecto Del Castillo) ──────────────────────
  // núcleo central (escalera + ascensor) al medio; social a las fachadas; servicio
  // (cocina/lavandería/dorm. servicio/baños) contra los pozos de luz; doble crujía
  // en lotes profundos; terraza techada en los extremos.
  partiPreferido: "core al centro",
  ordenPreferido: "desc",

  // ── Mínimos duros (RNE A.020 / A.010 / Neufert) — el generador nunca los cruza ──
  rne: {
    deptoMinM2: 40,        // A.020 vivienda unifamiliar/multifamiliar
    hLibreMin: 2.30,       // piso a techo (baño 2.10)
    ductoMinM2: 0.24,      // por inodoro/aseo interior
    puertaIngreso: 0.90, puertaDorm: 0.80, puertaBano: 0.70, puertaEdificio: 1.20,
    corredorMin: 1.20, escaleraEvac: 1.20,
    vanoIluminacion: 0.10, // ≥10% del área del ambiente
    vanoVentilacion: 0.05, // ≥5% practicable
    estacionamientoBase: 1 / 3, // 1 c/3 viviendas (los parámetros del distrito mandan)
    cajon: { w: 2.70, l: 5.00 }, aisle: 6.00,
  },
  neufert: {
    dormPrincipalMin: 11.15, dormPrincipalLadoMin: 2.85,
    dormSecundarioMin: 7.43, dormSecundarioLadoMin: 2.44,
    cocinaTrianguloMin: 5.5, cocinaTrianguloMax: 6.0,
    closetProf: 0.60, camaLado: 0.70, // holgura cómoda al costado de la cama
  },
};

const norm = (s) => (s || "").toString().trim().toLowerCase();

/**
 * Sugerencia de brief que hace Bammy a partir del contexto conocido (distrito o
 * segmento). Devuelve { pct1, pct2, areaObjetivo, parti, ordenar } listos para
 * generarDistribuciones. El usuario puede sobreescribir cualquier valor.
 */
export function sugerirBrief({ distrito, segmento, areaObjetivo } = {}) {
  const d = norm(distrito);
  const seg = segmento || BAMMY.segmentoPorDistrito[d] || "medio";
  const base = BAMMY.mixPorSegmento[seg] || BAMMY.mixPorSegmento.medio;
  const area = areaObjetivo || BAMMY.areaPorDistrito[d] || base.areaObjetivo;
  return {
    segmento: seg,
    pct1: base.pct1, pct2: base.pct2,
    areaObjetivo: area,
    parti: BAMMY.partiPreferido,
    ordenar: BAMMY.ordenPreferido,
    nota: `Bammy · ${seg}${d ? " · " + distrito : ""} · objetivo ${area} m²`,
  };
}

/** unidades/piso que Bammy estima para un footprint dado a su área objetivo. */
export function udsPisoSugerido(areaFootprintM2, areaObjetivo = 70) {
  return Math.max(1, Math.round((areaFootprintM2 * 0.85) / Math.max(areaObjetivo, 30)));
}
