// librería de tipologías madre BAM — derivada del análisis de mercado Nexo jul-2026
// (677 proyectos, 6,687 modelos: ver alicia-brain/docs/mercado/). Cada tipología define
// el sobre dimensional en el que funciona y su programa; el generador elige la MÁS CERCANA
// al recorte real que sale del lote y ajusta el área lo más cerca posible al objetivo.

export const TIPOLOGIAS = [
  // id            dorms baños área[min,ideal,max] frente mín  share de mercado (peso)
  { id: "F1-35", nombre: "studio",       dorms: 1, banos: 1, area: [28, 35, 40],  frenteMin: 3.2, peso: 6 },
  { id: "F1-42", nombre: "1D compacto",  dorms: 1, banos: 1, area: [38, 42, 48],  frenteMin: 3.6, peso: 13 },
  { id: "F2-48", nombre: "2D VIS",       dorms: 2, banos: 1, area: [44, 48, 52],  frenteMin: 5.4, peso: 4 },
  { id: "F2-55", nombre: "2D núcleo",    dorms: 2, banos: 2, area: [50, 55, 60],  frenteMin: 5.8, peso: 20 },
  { id: "F2-63", nombre: "2D confort",   dorms: 2, banos: 2, area: [60, 63, 68],  frenteMin: 6.2, peso: 10 },
  { id: "F3-63", nombre: "3D VIS",       dorms: 3, banos: 2, area: [58, 63, 68],  frenteMin: 6.8, peso: 12 },
  { id: "F3-74", nombre: "3D medio",     dorms: 3, banos: 2, area: [69, 74, 80],  frenteMin: 7.2, peso: 9 },
  { id: "F3-88", nombre: "3D top",       dorms: 3, banos: 3, area: [82, 88, 98],  frenteMin: 7.8, peso: 8 },
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
