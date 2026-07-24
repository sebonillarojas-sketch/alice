// librería de tipologías madre BAM — derivada del análisis de mercado Nexo jul-2026
// (677 proyectos, 6,687 modelos: ver alicia-brain/docs/mercado/). Cada tipología define
// el sobre dimensional en el que funciona y su programa; el generador elige la MÁS CERCANA
// al recorte real que sale del lote y ajusta el área lo más cerca posible al objetivo.

export const TIPOLOGIAS = [
  // id            dorms baños área[min,ideal,max] frente mín  share de mercado (peso)  segmento
  // ── Studios / 1D (≈22% del mercado) ──
  { id: "F0-26", nombre: "microstudio",     dorms: 1, banos: 1, area: [22, 26, 30],   frenteMin: 3.0, peso: 2,  seg: "inversión" },
  { id: "F1-32", nombre: "studio compacto", dorms: 1, banos: 1, area: [28, 32, 36],   frenteMin: 3.1, peso: 4,  seg: "inversión" },
  { id: "F1-35", nombre: "studio",          dorms: 1, banos: 1, area: [30, 35, 40],   frenteMin: 3.2, peso: 6,  seg: "moderna" },
  { id: "F1-42", nombre: "1D compacto",     dorms: 1, banos: 1, area: [38, 42, 46],   frenteMin: 3.6, peso: 13, seg: "moderna" },
  { id: "F1-47", nombre: "1D estándar",     dorms: 1, banos: 1, area: [44, 47, 52],   frenteMin: 3.9, peso: 7,  seg: "moderna" },
  { id: "F1-55", nombre: "1D confort",      dorms: 1, banos: 2, area: [50, 55, 62],   frenteMin: 4.3, peso: 3,  seg: "top" },
  // ── 2D (≈41% del mercado, el corazón) ──
  { id: "F2-46", nombre: "2D VIS",          dorms: 2, banos: 1, area: [42, 46, 50],   frenteMin: 5.2, peso: 4,  seg: "VIS" },
  { id: "F2-50", nombre: "2D compacto",     dorms: 2, banos: 2, area: [47, 50, 54],   frenteMin: 5.5, peso: 9,  seg: "moderna" },
  { id: "F2-55", nombre: "2D núcleo",       dorms: 2, banos: 2, area: [52, 55, 60],   frenteMin: 5.8, peso: 20, seg: "moderna" },
  { id: "F2-59", nombre: "2D estándar",     dorms: 2, banos: 2, area: [56, 59, 64],   frenteMin: 6.0, peso: 14, seg: "moderna" },
  { id: "F2-63", nombre: "2D confort",      dorms: 2, banos: 2, area: [60, 63, 68],   frenteMin: 6.2, peso: 10, seg: "medio" },
  { id: "F2-70", nombre: "2D amplio",       dorms: 2, banos: 2, area: [66, 70, 76],   frenteMin: 6.6, peso: 6,  seg: "medio" },
  { id: "F2-80", nombre: "2D premium",      dorms: 2, banos: 3, area: [75, 80, 90],   frenteMin: 7.0, peso: 3,  seg: "top" },
  // ── 3D (≈36% del mercado) ──
  { id: "F3-60", nombre: "3D VIS",          dorms: 3, banos: 2, area: [56, 60, 65],   frenteMin: 6.6, peso: 6,  seg: "VIS" },
  { id: "F3-64", nombre: "3D compacto",     dorms: 3, banos: 2, area: [61, 64, 69],   frenteMin: 6.9, peso: 10, seg: "moderna" },
  { id: "F3-74", nombre: "3D medio",        dorms: 3, banos: 2, area: [69, 74, 80],   frenteMin: 7.2, peso: 11, seg: "moderna" },
  { id: "F3-82", nombre: "3D confort",      dorms: 3, banos: 2, area: [78, 82, 88],   frenteMin: 7.5, peso: 8,  seg: "medio" },
  { id: "F3-90", nombre: "3D top",          dorms: 3, banos: 3, area: [85, 90, 98],   frenteMin: 7.8, peso: 7,  seg: "top" },
  { id: "F3-103", nombre: "3D premium",     dorms: 3, banos: 3, area: [96, 103, 115], frenteMin: 8.3, peso: 4,  seg: "top" },
  { id: "F3-125", nombre: "3D luxury",      dorms: 3, banos: 3, area: [115, 125, 140],frenteMin: 8.9, peso: 2,  seg: "luxury" },
  // ── 4D y grandes (≈1%, mayormente premium) ──
  { id: "F4-95",  nombre: "4D compacto",    dorms: 4, banos: 3, area: [88, 95, 105],  frenteMin: 8.0, peso: 1,  seg: "medio" },
  { id: "F4-120", nombre: "4D familiar",    dorms: 4, banos: 4, area: [110, 120, 135],frenteMin: 8.8, peso: 1,  seg: "top" },
  { id: "F4-145", nombre: "4D premium",     dorms: 4, banos: 4, area: [135, 145, 165],frenteMin: 9.4, peso: 1,  seg: "luxury" },
  // ── variantes de programa (mismo n° dorms, distinta distribución/servicios) ──
  { id: "F2-58S", nombre: "2D + estudio",   dorms: 2, banos: 2, area: [62, 66, 72],   frenteMin: 6.4, peso: 3,  seg: "medio" },
  { id: "F3-78S", nombre: "3D + estudio",   dorms: 3, banos: 3, area: [82, 88, 96],   frenteMin: 7.6, peso: 3,  seg: "top" },
  { id: "F1-40L", nombre: "1D + lavandería",dorms: 1, banos: 1, area: [40, 44, 50],   frenteMin: 3.8, peso: 3,  seg: "moderna" },
  { id: "F2-56V", nombre: "2D + visita",    dorms: 2, banos: 3, area: [60, 64, 70],   frenteMin: 6.3, peso: 4,  seg: "medio" },
  { id: "F3-84V", nombre: "3D + visita",    dorms: 3, banos: 4, area: [88, 94, 104],  frenteMin: 7.9, peso: 3,  seg: "top" },
  { id: "F2-52D", nombre: "2D dual (flex)", dorms: 2, banos: 2, area: [54, 58, 64],   frenteMin: 5.9, peso: 4,  seg: "moderna" },
  { id: "F3-70P", nombre: "3D pasante",     dorms: 3, banos: 2, area: [72, 78, 86],   frenteMin: 7.3, peso: 5,  seg: "medio" },
];

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
