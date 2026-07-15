// empaquetador de planta típica sobre la forma real del lote.
// toma el footprint (envolvente construible = lote − retiros) y reparte tipologías
// de departamento + core de circulación, orientadas al frente y recortadas a la forma.

import { orientedFrame, area, clipConvex, isConvex, signedArea } from "./geometry.js";

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
 * @param opts       { udsPiso, mix1, mix2, areaObjetivo, corrDepth, coreW }
 * @returns { units:[{id,tipo,name,pts,areaReal}], core, corridor, frente, fondo, doble, warns }
 */
export function packFloor(footprint, frontIdx = 0, opts = {}) {
  const {
    udsPiso = 4, mix1 = 40, mix2 = 40, areaObjetivo = 70,
    corrDepth = 1.6, coreW = 3,
  } = opts;
  const warns = [];
  const F = orientedFrame(footprint, frontIdx);
  const frente = F.frente, fondo = F.fondo;
  if (frente < 4 || fondo < 4) return { units: [], core: null, corridor: null, frente, fondo, warns: ["footprint muy chico"] };

  // ¿doble crujía? si el fondo da para dos bandas + corredor
  const doble = fondo >= 2 * 4.0 + corrDepth;
  const bandDepth = doble ? (fondo - corrDepth) / 2 : Math.min(fondo, 9);
  const uds = Math.max(1, Math.round(udsPiso));
  const mix3 = Math.max(0, 100 - mix1 - mix2);

  // áreas por tipología escaladas para que el promedio ponderado = areaObjetivo
  const ratios = { "1D": 0.65, "2D": 1.0, "3D": 1.35 };
  const wAvg = (mix1 * ratios["1D"] + mix2 * ratios["2D"] + mix3 * ratios["3D"]) / 100 || 1;
  const esc = areaObjetivo / wAvg;

  const { n1, n2, n3 } = mezcla(uds, mix1, mix2);
  const lista = [
    ...Array(n3).fill("3D"), ...Array(n2).fill("2D"), ...Array(n1).fill("1D"),
  ].map((tip) => ({ tip, area: ratios[tip] * esc }));

  // core centrado en el frente, profundidad = fondo
  const coreU0 = (frente - coreW) / 2, coreU1 = coreU0 + coreW;
  const core = {
    id: rid(), tipo: "core",
    pts: [F.toWorld(coreU0, 0), F.toWorld(coreU1, 0), F.toWorld(coreU1, fondo), F.toWorld(coreU0, fondo)].map(round),
  };

  // filas (bandas) según crujía
  const filas = doble
    ? [{ v0: 0, depth: bandDepth, units: [] }, { v0: bandDepth + corrDepth, depth: bandDepth, units: [] }]
    : [{ v0: 0, depth: bandDepth, units: [] }];
  if (doble) {
    const suma = [0, 0];
    [...lista].sort((a, b) => b.area - a.area).forEach((u) => {
      const f = suma[0] <= suma[1] ? 0 : 1;
      filas[f].units.push(u); suma[f] += u.area;
    });
  } else filas[0].units.push(...lista);

  // empaquetar a lo largo del frente, saltando el hueco del core
  const disponible = Math.max(frente - coreW, 1);
  const units = [];
  const clip = isConvex(footprint) ? footprint : null;
  if (!clip) warns.push("lote no convexo — bloques sin recortar a la forma exacta");

  filas.forEach((fila) => {
    const sumW = fila.units.reduce((a, u) => a + u.area / fila.depth, 0) || 1;
    const k = disponible / sumW;
    let u = 0;
    fila.units.forEach((unit) => {
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
      segs.forEach(([ua, ub]) => {
        let poly = [
          F.toWorld(ua, fila.v0), F.toWorld(ub, fila.v0),
          F.toWorld(ub, fila.v0 + fila.depth), F.toWorld(ua, fila.v0 + fila.depth),
        ];
        if (clip) { const c = clipConvex(poly, clip); if (c.length >= 3) poly = c; else return; }
        poly = poly.map(round);
        units.push({ id: rid(), tipo: "unidad", subtipo: unit.tip, name: unit.tip, pts: poly, areaReal: area(poly) });
      });
      u = b;
    });
  });

  const corridor = doble ? {
    id: rid(), tipo: "corredor",
    pts: [F.toWorld(0, bandDepth), F.toWorld(frente, bandDepth), F.toWorld(frente, bandDepth + corrDepth), F.toWorld(0, bandDepth + corrDepth)].map(round),
  } : null;

  return { units, core, corridor, frente, fondo, doble, warns };
}
