// librería de tipologías madre BAM — derivada del análisis de mercado Nexo jul-2026
// (677 proyectos, 6,687 modelos: ver alicia-brain/docs/mercado/). Cada tipología define
// el sobre dimensional en el que funciona y su programa; el generador elige la MÁS CERCANA
// al recorte real que sale del lote y ajusta el área lo más cerca posible al objetivo.

// ── librería POR TAMAÑOS ──────────────────────────────────────────────────────
// En vez de solo las más vendidas (chicas), se genera una escalera que cubre TODO el
// rango de cada tipo (de microstudio a 5D grande), en pasos finos → ~100 tipologías.
// Así el generador y el visor tienen un calce a cualquier recorte, no solo a los compactos.
const _round = (n) => Math.round(n);
// bandas por n° de dormitorios: [áreaMin, áreaMax, paso, medianaMercado (para el peso)]
// piso RNE A.020 Art. 8.1.b: un departamento familiar en multifamiliar ≥ 40 m². Por eso
// el 1D arranca en 40 (nada de studios/monoambientes sub-normativos); los distritos que
// piden más por parámetros urbanísticos suben este piso vía el brief (minimos).
const _BANDAS = [
  { d: 1, min: 40,  max: 60,  step: 2.5, med: 46,  frente0: 3.0, fSlope: 0.035 },
  { d: 2, min: 42,  max: 94,  step: 2.5, med: 58,  frente0: 5.2, fSlope: 0.036 },
  { d: 3, min: 56,  max: 140, step: 3,   med: 74,  frente0: 6.6, fSlope: 0.027 },
  { d: 4, min: 86,  max: 176, step: 5,   med: 120, frente0: 8.0, fSlope: 0.016 },
  { d: 5, min: 150, max: 210, step: 12,  med: 175, frente0: 9.4, fSlope: 0.011 },
];
const _banos = (d, a) => {
  if (d === 1) return a >= 50 ? 2 : 1;
  if (d === 2) return a >= 78 ? 3 : (a >= 48 ? 2 : 1);
  if (d === 3) return a >= 84 ? 3 : 2;
  if (d === 4) return a >= 115 ? 4 : 3;
  return a >= 180 ? 5 : 4;
};
const _seg = (d, a) => {
  const m = _BANDAS.find((b) => b.d === d).med;
  if (a < m * 0.82) return d <= 2 ? "VIS" : "VIS";
  if (a < m * 0.98) return "moderna";
  if (a < m * 1.18) return "medio";
  if (a < m * 1.45) return "top";
  return "luxury";
};
const _nombre = (d, a) => {
  const m = _BANDAS.find((b) => b.d === d).med;
  const base = `${d}D`;   // sin "studio": el 1D mínimo normativo es 40 m²
  const tag = a < m * 0.82 ? "compacto" : a < m * 0.98 ? "" : a < m * 1.18 ? "confort" : a < m * 1.45 ? "amplio" : "premium";
  return `${base}${tag ? " " + tag : ""} · ${a}m²`;
};
function generarTipologias() {
  const out = [];
  for (const b of _BANDAS) {
    for (let a = b.min; a <= b.max + 0.01; a += b.step) {
      const area = _round(a);
      const frente = Math.round((b.frente0 + (area - b.min) * b.fSlope) * 10) / 10;
      // peso: campana alrededor de la mediana de mercado de esa tipología
      const span = (b.max - b.min) * 0.32;
      const peso = Math.max(1, Math.round(18 * Math.exp(-(((area - b.med) / span) ** 2))));
      out.push({
        id: `F${b.d}-${area}`,
        nombre: _nombre(b.d, area),
        dorms: b.d,
        banos: _banos(b.d, area),
        area: [_round(area * 0.93), area, _round(area * 1.1)],
        frenteMin: frente,
        peso,
        seg: _seg(b.d, area),
      });
    }
  }
  return out;
}

export const TIPOLOGIAS = generarTipologias();   // ~100 tipologías cubriendo todos los tamaños

// distancia tipología ↔ recorte disponible (área y frente reales del bloque en el lote)
function costo(t, areaDisp, frenteDisp, dormsPref) {
  const [aMin, aIdeal, aMax] = t.area;
  let c = Math.abs(areaDisp - aIdeal) / aIdeal;               // qué tan lejos del área ideal
  if (areaDisp < aMin) c += (aMin - areaDisp) / aMin * 3;     // no entra: penaliza fuerte
  if (areaDisp > aMax) c += (areaDisp - aMax) / aMax * 0.8;   // sobra área: leve
  if (frenteDisp < t.frenteMin) c += (t.frenteMin - frenteDisp) / t.frenteMin * 4;
  if (dormsPref && t.dorms !== dormsPref) c += Math.abs(t.dorms - dormsPref) * 0.35;
  c -= t.peso / 200;                                          // preferencia por lo más vendido
  return c;
}

// piso de área por n° de dormitorios (RNE 40 para 1D; 2D/3D funcionales). El brief
// puede subirlo por distrito/parámetros urbanísticos. Filtra tipologías bajo mínimo.
export const MINIMOS_DEFAULT = { 1: 40, 2: 50, 3: 65, 4: 86, 5: 150 };
const minOf = (d, minimos) => (minimos?.[d] ?? MINIMOS_DEFAULT[d] ?? 0);
const cumpleMin = (t, minimos) => t.area[1] >= minOf(t.dorms, minimos);

/** área mínima REAL de una vivienda compliant: el menor mínimo por-tipo para el que existe
 *  una tipología en el catálogo. Ej: Miraflores pide 1D≥70 pero el 1D llega solo a 60 → el
 *  1D no es alcanzable ahí, y la vivienda más chica pasa a ser el 2D (mín 80). Sin este
 *  cálculo, un recorte de 73 pasaría el filtro del 1D y se etiquetaría 2D quedando bajo mínimo. */
export function minAreaViable(minimos) {
  const mins = { ...MINIMOS_DEFAULT, ...(minimos || {}) };
  let best = Infinity;
  for (const d of [1, 2, 3, 4, 5]) {
    const m = mins[d];
    if (m == null) continue;
    if (TIPOLOGIAS.some((t) => t.dorms === d && t.area[1] >= m)) best = Math.min(best, m);
  }
  return Number.isFinite(best) ? best : 40;
}
// pool de tipologías admisibles para un recorte de área `areaDisp` bajo `minimos`:
//   1) la tipología cumple su propio mínimo de catálogo (t.area[1] ≥ mín[dorms]), y
//   2) el recorte alcanza ese mínimo (areaDisp ≥ mín[dorms]) → NUNCA se etiqueta una
//      unidad con un tipo cuyo mínimo no cubre. Sin (2), un recorte de 65 podría salir
//      "2D" con 2D mín 70 y quedar bajo mínimo. Cae con gracia si el filtro vacía.
const pool = (minimos, areaDisp = Infinity) => {
  const full = TIPOLOGIAS.filter((t) => cumpleMin(t, minimos));
  const ok = full.filter((t) => areaDisp >= minOf(t.dorms, minimos));
  return ok.length ? ok : (full.length ? full : TIPOLOGIAS);
};

/** la tipología más cercana al recorte { area, frente } (opcional: dorms preferidos, mínimos) */
export function tipologiaCercana(areaDisp, frenteDisp, dormsPref = null, minimos = null) {
  return [...pool(minimos, areaDisp)].sort((a, b) =>
    costo(a, areaDisp, frenteDisp, dormsPref) - costo(b, areaDisp, frenteDisp, dormsPref))[0];
}

/** las N tipologías candidatas para un recorte, de mejor a peor calce */
export function tipologiasCandidatas(areaDisp, frenteDisp, n = 4, minimos = null) {
  return [...pool(minimos, areaDisp)]
    .map((t) => ({ t, c: costo(t, areaDisp, frenteDisp, null) }))
    .sort((a, b) => a.c - b.c)
    .slice(0, n)
    .map((x) => x.t);
}

export const porTipologia = Object.fromEntries(TIPOLOGIAS.map((t) => [t.id, t]));

/** mezcla de tipologías para un piso: reparte n unidades según el mix pedido (VIS→más 2D/3D chico) */
export function mixTipologias(n, { pct1 = 25, pct2 = 40, areaObjetivo = 60, minimos = null } = {}) {
  const pct3 = Math.max(0, 100 - pct1 - pct2);
  const n1 = Math.round((n * pct1) / 100);
  const n3 = Math.round((n * pct3) / 100);
  const n2 = Math.max(0, n - n1 - n3);
  // Tamaño objetivo POR TIPO, escalado según su mediana de mercado (1D<2D<3D) de modo
  // que el promedio ponderado por el mix = areaObjetivo. Antes todos apuntaban al mismo
  // areaObjetivo → salían casi iguales (sin mezcla de tamaños). Ahora hay mix real.
  const med = { 1: 42, 2: 58, 3: 74 };
  const wAvg = (pct1 * med[1] + pct2 * med[2] + pct3 * med[3]) / 100 || med[2];
  const esc = areaObjetivo / wAvg;
  const target = { 1: med[1] * esc, 2: med[2] * esc, 3: med[3] * esc };
  const pick = (dorms) => {
    let cands = TIPOLOGIAS.filter((t) => t.dorms === dorms && cumpleMin(t, minimos));
    if (!cands.length) cands = TIPOLOGIAS.filter((t) => t.dorms === dorms);   // nunca vacío
    return cands.sort((a, b) =>
      Math.abs(a.area[1] - target[dorms]) - Math.abs(b.area[1] - target[dorms]) - (a.peso - b.peso) / 100)[0];
  };
  return [
    ...Array(n3).fill(null).map(() => pick(3)),
    ...Array(n2).fill(null).map(() => pick(2)),
    ...Array(n1).fill(null).map(() => pick(1)),
  ];
}
