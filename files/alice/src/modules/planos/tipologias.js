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
const _BANDAS = [
  { d: 1, min: 22,  max: 60,  step: 2.5, med: 42,  frente0: 3.0, fSlope: 0.035 },
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
  const base = d === 1 ? (a < 31 ? "studio" : "1D") : `${d}D`;
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

/** la tipología más cercana al recorte { area, frente } (opcional: dorms preferidos) */
export function tipologiaCercana(areaDisp, frenteDisp, dormsPref = null) {
  return [...TIPOLOGIAS].sort((a, b) =>
    costo(a, areaDisp, frenteDisp, dormsPref) - costo(b, areaDisp, frenteDisp, dormsPref))[0];
}

/** las N tipologías candidatas para un recorte, de mejor a peor calce */
export function tipologiasCandidatas(areaDisp, frenteDisp, n = 4) {
  return [...TIPOLOGIAS]
    .map((t) => ({ t, c: costo(t, areaDisp, frenteDisp, null) }))
    .sort((a, b) => a.c - b.c)
    .slice(0, n)
    .map((x) => x.t);
}

export const porTipologia = Object.fromEntries(TIPOLOGIAS.map((t) => [t.id, t]));

/** mezcla de tipologías para un piso: reparte n unidades según el mix pedido (VIS→más 2D/3D chico) */
export function mixTipologias(n, { pct1 = 25, pct2 = 40, areaObjetivo = 60 } = {}) {
  const pct3 = Math.max(0, 100 - pct1 - pct2);
  const n1 = Math.round((n * pct1) / 100);
  const n3 = Math.round((n * pct3) / 100);
  const n2 = Math.max(0, n - n1 - n3);
  const pick = (dorms) => {
    const cands = TIPOLOGIAS.filter((t) => t.dorms === dorms);
    return cands.sort((a, b) =>
      Math.abs(a.area[1] - areaObjetivo) - Math.abs(b.area[1] - areaObjetivo) - (a.peso - b.peso) / 100)[0];
  };
  return [
    ...Array(n3).fill(null).map(() => pick(3)),
    ...Array(n2).fill(null).map(() => pick(2)),
    ...Array(n1).fill(null).map(() => pick(1)),
  ];
}
