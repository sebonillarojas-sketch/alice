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
    minViable = 40,   // área mínima de un departamento (RNE 40); por debajo, el recorte se absorbe en un vecino
    pisos = 5, tipoLote = "medianera", pozos: conPozos = true,   // pozos de luz: dimensión por altura, ubicación por tipo de lote
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
  // profundidad del core: es un BLOQUE (escalera + ascensor + hall), NO una tajada de punta
  // a punta. Default = la banda del frente (llega al corredor, no al fondo del lote); editable
  // (opts.coreDepth, arrastrable). Acotado a [2.5 m, fondo]. En doble crujía la banda del
  // fondo NO la toca el core (se accede por el corredor) → ahí las unidades corren full frente.
  const coreDepth = Math.max(2.5, Math.min(opts.coreDepth ?? bandDepth, fondo));
  const coreRect = [F.toWorld(coreU0, 0), F.toWorld(coreU1, 0), F.toWorld(coreU1, coreDepth), F.toWorld(coreU0, coreDepth)];
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
  const units = [];
  const pozos = [];
  let colocadas = 0;

  // ── pozos de luz (RNE A.020 Art. 11.4.b, Cuadro N° 04) ──────────────────────
  // dimensión POR ALTURA del edificio; sirven ambientes de SERVICIO (columna B).
  const Hedif = Math.max(2.8, (pisos || 1) * 2.8);
  const pctB = Hedif <= 18 ? 0.25 : Hedif <= 36 ? 0.13 : 0.10;   // % de la altura del paramento opuesto
  const pozoPerp = Math.max(2.10, pctB * Hedif);                 // distancia servida (profundidad de luz)
  const pozoW = Math.max(2.10, 0.5 * pozoPerp);                  // ancho del slot (u); mínimo absoluto 2.10 m (multifamiliar)

  // columnas de exclusión de una banda: el core (donde la interrumpe) + pozos de luz.
  // Modelo gap-filling: las unidades llenan los HUECOS entre columnas → nunca se solapan
  // con core/pozo y no hace falta partirlas a mano.
  const columnasBanda = (fila) => {
    const cols = [];
    if (fila.v0 < coreDepth - 0.01) cols.push({ u0: coreU0, u1: coreU1, kind: "core" });
    const bandaProfunda = fila.depth >= 7;   // ambientes interiores lejos de fachada → piden pozo
    if (conPozos && bandaProfunda && frente >= 9) {
      if (tipoLote !== "esquina") {            // medianera: pozo contra cada muro lateral
        cols.push({ u0: 0, u1: pozoW, kind: "pozo" });
        cols.push({ u0: frente - pozoW, u1: frente, kind: "pozo" });
      }
      if (frente >= 15) {                      // interior: pozos a ~1/3 y 2/3 si no pisan el core
        for (const frac of [0.30, 0.70]) {
          const a = frac * frente - pozoW / 2, b = a + pozoW;
          if (b <= coreU0 - 2 || a >= coreU1 + 2) cols.push({ u0: a, u1: b, kind: "pozo" });
        }
      }
    }
    const norm = cols.map((c) => ({ ...c, u0: Math.max(0, c.u0), u1: Math.min(frente, c.u1) }))
      .filter((c) => c.u1 - c.u0 > 0.3).sort((a, b) => a.u0 - b.u0);
    const merged = [];
    for (const c of norm) {                    // fusiona solapes (el core gana el tipo)
      const last = merged[merged.length - 1];
      if (last && c.u0 <= last.u1 + 0.01) { last.u1 = Math.max(last.u1, c.u1); if (c.kind === "core") last.kind = "core"; }
      else merged.push({ ...c });
    }
    return merged;
  };

  filas.forEach((fila) => {
    if (!fila.units.length) return;
    const v1 = fila.v0 + fila.depth;
    const cols = columnasBanda(fila);
    // huecos entre columnas (solo si dan para una unidad, ≥3 m de frente)
    const gaps = []; let cur = 0;
    for (const c of cols) { if (c.u0 - cur >= 3) gaps.push([cur, c.u0]); cur = Math.max(cur, c.u1); }
    if (frente - cur >= 3) gaps.push([cur, frente]);

    let ci = 0;   // índice cíclico dentro del mix de la banda
    for (const [ga, gb] of gaps) {
      const gw = gb - ga;
      const seq = []; let acc = 0, guard = 0;
      while (acc < gw - 0.4 && guard < 20) {
        const unit = fila.units[ci % fila.units.length];
        seq.push(unit); acc += Math.max(unit.area / fila.depth, 0.5); ci++; guard++;
      }
      if (!seq.length) continue;
      const sumW = seq.reduce((a, u) => a + u.area / fila.depth, 0) || 1;
      const k = Math.min(1.18, Math.max(0.82, gw / sumW));   // clamp: nada de inflar
      let u = ga;
      seq.forEach((unit) => {
        const w = (unit.area / fila.depth) * k;
        const ua = u, ub = Math.min(u + w, gb);
        u = ub; colocadas++;
        if (ub - ua < 0.5) return;
        const rect = [F.toWorld(ua, fila.v0), F.toWorld(ub, fila.v0), F.toWorld(ub, v1), F.toWorld(ua, v1)];
        const poly = recortar(rect);   // recorta la unidad a la forma real del lote
        if (!poly || area(poly) < 2) return;
        units.push({
          id: rid(), tipo: "unidad", subtipo: unit.tip, name: unit.tip, pts: poly, areaReal: area(poly),
          tipologia: unit.tipologia || null, partida: null,
          frame: { ua, ub, v0: fila.v0, v1, banda: fila.v0 === 0 ? 0 : 1 },
        });
      });
    }
    // pozos de luz de esta banda (void: se excluye del área vendible)
    for (const c of cols) if (c.kind === "pozo") {
      const rect = [F.toWorld(c.u0, fila.v0), F.toWorld(c.u1, fila.v0), F.toWorld(c.u1, v1), F.toWorld(c.u0, v1)];
      const poly = recortar(rect);
      if (poly && area(poly) >= 1) pozos.push({ id: rid(), tipo: "pozo", pts: poly, areaReal: area(poly) });
    }
  });
  if (unidades && unidades.length && colocadas !== unidades.length) {
    warns.push(`ajusté a ${colocadas} unidades/piso para áreas realistas (pediste ${unidades.length})`);
  }

  // ── absorción de slivers ────────────────────────────────────────────────────
  // Un recorte demasiado chico/angosto NO debe quedar como "depósito" en los pisos
  // superiores si puede sumarse al departamento con el que COMPARTE PARED: repartir
  // ese espacio entre los depas vecinos es más inteligente que dejarlo muerto.
  // Se fusiona en coords de marco (ua,ub, siempre rectangular) y se re-clipa a la
  // forma real del lote. Solo sobrevive como depósito el sliver genuinamente aislado
  // (separado por el core, o en una banda demasiado poco profunda para vivienda).
  {
    const ANCHO_MIN = 2.8, EPS = 0.05;
    const anchoMarco = (u) => u.frame.ub - u.frame.ua;
    // un recorte por debajo del mínimo de vivienda, o una astilla angosta, es candidato a
    // fundirse con el vecino con el que comparte pared (mejor que dejarlo como depósito muerto).
    const esSliver = (u) => anchoMarco(u) < ANCHO_MIN || u.areaReal < minViable;
    for (const v0 of [...new Set(units.map((u) => u.frame.v0))]) {
      let fila = units.filter((u) => u.frame.v0 === v0).sort((a, b) => a.frame.ua - b.frame.ua);
      let cambio = true;
      while (cambio) {
        cambio = false;
        for (let i = 0; i < fila.length; i++) {
          const s = fila[i];
          if (!esSliver(s)) continue;
          // vecinos que comparten pared (tocan en ua/ub); el core deja un hueco de
          // coreW entre bloques, así que el test de contigüidad ya lo excluye solo.
          const izq = fila[i - 1] && Math.abs(fila[i - 1].frame.ub - s.frame.ua) < EPS ? fila[i - 1] : null;
          const der = fila[i + 1] && Math.abs(s.frame.ub - fila[i + 1].frame.ua) < EPS ? fila[i + 1] : null;
          const cand = [izq, der].filter(Boolean);
          if (!cand.length) continue;                 // aislado → legítimamente queda depósito
          const dst = cand.sort((a, b) => b.areaReal - a.areaReal)[0];  // el vecino más grande se lo traga
          const nua = Math.min(dst.frame.ua, s.frame.ua);
          const nub = Math.max(dst.frame.ub, s.frame.ub);
          const rect = [
            F.toWorld(nua, s.frame.v0), F.toWorld(nub, s.frame.v0),
            F.toWorld(nub, s.frame.v1), F.toWorld(nua, s.frame.v1),
          ];
          const poly = recortar(rect);
          if (!poly || area(poly) < 2) continue;
          dst.frame = { ...dst.frame, ua: nua, ub: nub };
          dst.pts = poly; dst.areaReal = area(poly);
          dst.tipologia = null;                       // el recorte cambió → recalcular tipología aguas abajo
          const gi = units.indexOf(s);
          if (gi >= 0) units.splice(gi, 1);
          fila = fila.filter((u) => u !== s);
          cambio = true;
          break;                                      // re-evaluar la fila desde cero
        }
      }
    }
  }

  const corrRect = doble
    ? [F.toWorld(0, bandDepth), F.toWorld(frente, bandDepth), F.toWorld(frente, bandDepth + corrDepth), F.toWorld(0, bandDepth + corrDepth)]
    : null;
  const corridor = corrRect ? { id: rid(), tipo: "corredor", pts: recortar(corrRect) || corrRect.map(round) } : null;

  return { units, core, corridor, pozos, F, frente, fondo, doble, bandDepth, corrDepth, warns };
}
