// empaquetador de planta típica sobre la forma real del lote.
// toma el footprint (envolvente construible = lote − retiros) y reparte tipologías
// de departamento + core de circulación, orientadas al frente y recortadas a la forma.

import { orientedFrame, area, clipConvex, signedArea } from "./geometry.js";

let _n = 1;
const rid = () => `f${_n++}_${Math.random().toString(36).slice(2, 6)}`;
const round = (p) => ({ x: +p.x.toFixed(3), y: +p.y.toFixed(3) });

// reparte `total` unidades por tipología según mix (%), en orden 3D→2D→1D
function mezcla(total, mix1, mix2) {
  let n1 = Math.min(total, Math.round((total * mix1) / 100));
  let n2 = Math.min(total - n1, Math.round((total * mix2) / 100));
  const n3 = Math.max(0, total - n1 - n2);
  return { n1, n2, n3 };
}

/**
 * @param footprint  polígono de la envolvente construible (metros)
 * @param frontIdx   índice del borde-frente (hacia la calle)
 * @param opts       { udsPiso, mix1, mix2, areaObjetivo, corrDepth, coreW,
 *                     unidades: [{dorms,banos,area:[min,ideal,max],id}],  // tipologías explícitas
 *                     corePos: 'centro'|'izq',
 *                     ordenar: 'desc'|'asc' }
 * @returns { units:[{id,tipo,name,pts,areaReal,frame:{ua,ub,v0,v1,banda}}], core, corridor, F, frente, fondo, doble, warns }
 */
export function packFloor(footprint, frontIdx = 0, opts = {}) {
  const {
    udsPiso = 4, mix1 = 40, mix2 = 40, areaObjetivo = 70,
    corrDepth = 1.6, coreW = 3, unidades = null, corePos = "centro", ordenar = "desc",
  } = opts;
  const warns = [];
  const F = orientedFrame(footprint, frontIdx);
  const frente = F.frente, fondo = F.fondo;
  if (frente < 4 || fondo < 4) return { units: [], core: null, corridor: null, F, frente, fondo, warns: ["footprint muy chico"] };

  // ¿doble crujía? si el fondo da para dos bandas + corredor
  const doble = fondo >= 2 * 4.0 + corrDepth;
  const bandDepth = doble ? (fondo - corrDepth) / 2 : Math.min(fondo, 9);

  let lista;
  if (unidades && unidades.length) {
    // tipologías explícitas: el área ideal manda; el empaquetado las escala al footprint
    lista = unidades.map((t) => ({ tip: `${t.dorms}D`, area: t.area[1], tipologia: t }));
  } else {
    const uds = Math.max(1, Math.round(udsPiso));
    const mix3 = Math.max(0, 100 - mix1 - mix2);
    // áreas por tipología escaladas para que el promedio ponderado = areaObjetivo
    const ratios = { "1D": 0.65, "2D": 1.0, "3D": 1.35 };
    const wAvg = (mix1 * ratios["1D"] + mix2 * ratios["2D"] + mix3 * ratios["3D"]) / 100 || 1;
    const esc = areaObjetivo / wAvg;
    const { n1, n2, n3 } = mezcla(uds, mix1, mix2);
    lista = [
      ...Array(n3).fill("3D"), ...Array(n2).fill("2D"), ...Array(n1).fill("1D"),
    ].map((tip) => ({ tip, area: ratios[tip] * esc }));
  }

  // recorta cualquier rectángulo (siempre convexo) a la forma REAL del lote:
  // clipConvex(footprint, rect) = footprint ∩ rect (clip a "viewport" clásico),
  // válido para lotes convexos Y cóncavos (ochavo, trapecio, L). Garantiza que
  // ni las tipologías ni el core ni el corredor sobresalgan jamás del lote.
  const recortar = (rectPts) => { const c = clipConvex(footprint, rectPts); return c.length >= 3 ? c.map(round) : null; };

  // core en el frente: posición explícita (arrastrable, opts.coreU0) o centro/lateral.
  const coreU0 = opts.coreU0 != null
    ? Math.max(0, Math.min(frente - coreW, opts.coreU0))
    : (corePos === "izq" ? 0 : (frente - coreW) / 2);
  const coreU1 = coreU0 + coreW;
  const coreRect = [F.toWorld(coreU0, 0), F.toWorld(coreU1, 0), F.toWorld(coreU1, fondo), F.toWorld(coreU0, fondo)];
  const core = { id: rid(), tipo: "core", pts: recortar(coreRect) || coreRect.map(round) };

  // filas (bandas) según crujía
  const filas = doble
    ? [{ v0: 0, depth: bandDepth, units: [] }, { v0: bandDepth + corrDepth, depth: bandDepth, units: [] }]
    : [{ v0: 0, depth: bandDepth, units: [] }];
  const orden = (a, b) => (ordenar === "asc" ? a.area - b.area : b.area - a.area);
  if (doble) {
    const suma = [0, 0];
    [...lista].sort(orden).forEach((u) => {
      const f = suma[0] <= suma[1] ? 0 : 1;
      filas[f].units.push(u); suma[f] += u.area;
    });
  } else filas[0].units.push(...[...lista].sort(orden));

  // empaquetar a lo largo del frente rellenando a ÁREA OBJETIVO (no estirar un
  // conteo fijo). Antes: k = disponible/sumW estiraba `udsPiso` unidades hasta llenar
  // el frente → en pisos grandes cada unidad se inflaba a piso/uds (el "5D 345 m²").
  // Ahora: se repite el patrón del mix hasta cubrir el frente y se snapea con un k
  // acotado (0.82–1.18) → las áreas quedan realistas y tipologiaCercana no salta a 5D.
  const disponible = Math.max(frente - coreW, 1);
  const units = [];
  let colocadas = 0;

  filas.forEach((fila) => {
    if (!fila.units.length) return;
    // secuencia: ciclar el mix (ya ordenado) hasta cubrir el frente disponible
    const seq = [];
    let acc = 0, i = 0;
    while (acc < disponible - 0.4 && seq.length < 40) {
      const unit = fila.units[i % fila.units.length];
      seq.push(unit);
      acc += Math.max(unit.area / fila.depth, 0.5);
      i++;
    }
    const sumW = seq.reduce((a, u) => a + u.area / fila.depth, 0) || 1;
    const k = Math.min(1.18, Math.max(0.82, disponible / sumW));  // clamp: nada de inflar
    let u = 0;
    seq.forEach((unit) => {
      const w = (unit.area / fila.depth) * k;
      const a = u, b = u + w;
      // rectángulos en (u,v); si cruza el core, se parte
      const segs = [];
      if (b <= coreU0 || a >= coreU0) {
        const off = a >= coreU0 ? coreW : 0;
        segs.push([a + off, b + off]);
      } else {
        segs.push([a, coreU0]);
        segs.push([coreU1, b + coreW]);
      }
      segs.forEach(([ua, ub], si) => {
        const rect = [
          F.toWorld(ua, fila.v0), F.toWorld(ub, fila.v0),
          F.toWorld(ub, fila.v0 + fila.depth), F.toWorld(ua, fila.v0 + fila.depth),
        ];
        const poly = recortar(rect);   // recorta la unidad a la forma real del lote
        if (!poly) return;             // cae entera fuera del lote → no existe
        if (area(poly) < 2) return;    // esquirla junto al core: ni depósito merece
        units.push({
          id: rid(), tipo: "unidad", subtipo: unit.tip, name: unit.tip, pts: poly, areaReal: area(poly),
          tipologia: unit.tipologia || null, partida: segs.length > 1 ? si : null,
          frame: { ua, ub, v0: fila.v0, v1: fila.v0 + fila.depth, banda: fila.v0 === 0 ? 0 : 1 },
        });
      });
      u = b;
      colocadas++;
    });
  });
  if (unidades && unidades.length && colocadas !== unidades.length) {
    warns.push(`ajusté a ${colocadas} unidades/piso para áreas realistas (pediste ${unidades.length})`);
  }

  const corrRect = doble
    ? [F.toWorld(0, bandDepth), F.toWorld(frente, bandDepth), F.toWorld(frente, bandDepth + corrDepth), F.toWorld(0, bandDepth + corrDepth)]
    : null;
  const corridor = corrRect ? { id: rid(), tipo: "corredor", pts: recortar(corrRect) || corrRect.map(round) } : null;

  return { units, core, corridor, F, frente, fondo, doble, bandDepth, corrDepth, warns };
}
