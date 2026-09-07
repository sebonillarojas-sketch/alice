// Grafo de muros derivado de los ambientes (§5-6 de
// docs/superpowers/specs/2026-09-07-muros-vanos-design.md).
//
// Un muro NO se edita a mano: se recalcula siempre a partir de los ambientes. El
// motor deja de dibujar el contorno de cada ambiente (que duplica el trazo donde dos
// ambientes se tocan) y arma en su lugar la colección de tramos que efectivamente
// existen, fundiendo lo que hace falta y clasificando lo que queda.
//
// Módulo puro: sin React, sin estado, sin I/O. Reusa geometry.js del mismo
// directorio y clasificarBordes de cabida/loteReal.js (ya escrito y usado por
// EditorPlanos.jsx para lo mismo: no hay razón para reinventarlo acá).
import { clasificarBordes } from "../cabida/loteReal.js";

// Tolerancias del spec §5: 1 cm de desvío lateral para colinealidad, 0.30 m de
// solape mínimo para que un tramo de dos ambientes cuente como muro compartido.
const LATERAL_TOL = 0.01; // 1 cm
const TOQUE_ESQUINA_MIN = 0.30; // m

// Epsilons puramente numéricos (ruido de punto flotante), no tolerancias de diseño.
const EPS = 1e-4;

const round3 = (n) => Math.round(n * 1000) / 1000;

const normTxt = (s) =>
  (s || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

const CIRC_TIPOS = new Set(["pasillo", "corredor", "core", "nucleo", "circulacion"]);
const esCirculacionONucleo = (room) => CIRC_TIPOS.has(normTxt(room?.tipo)) || CIRC_TIPOS.has(normTxt(room?.role));
// Cualquier ambiente "void" cuenta para fachada_patio, no solo el nombrado
// literalmente "patio": materialize.js usa "void" también para ductos/shafts/luz
// cenital (tipoDe(), ~línea 81), y todos existen por la misma razón — dar luz a
// los ambientes que los rodean. Restringir a name.includes("patio") como dice el
// pliego al pie de la letra dejaría un ducto real sin clasificar. Ver reporte.
const esVoid = (room) => normTxt(room?.tipo) === "void";
const esUnidad = (room) => room?.unitRef != null;

// recta infinita que pasa por a→b, canonicalizada: la dirección se normaliza para
// que dos aristas A→B y B→A (o cualquier arista colineal) caigan en el mismo grupo.
function edgeLine(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1e-9;
  let ux = dx / len, uy = dy / len;
  if (ux < -1e-9 || (Math.abs(ux) <= 1e-9 && uy < 0)) { ux = -ux; uy = -uy; }
  const nx = -uy, ny = ux; // normal unitaria
  const d = a.x * nx + a.y * ny; // distancia con signo de la recta al origen
  return { ux, uy, nx, ny, d };
}

const pointAt = (line, t) => ({ x: t * line.ux + line.d * line.nx, y: t * line.uy + line.d * line.ny });

// clave de grupo: dirección + distancia al origen, cuantizadas a 1 cm (§5.2). Es un
// hash por cubetas: sensible a la tolerancia tal como advierte el spec §12.
const lineKey = (line) => `${Math.round(line.ux * 1e4)}:${Math.round(line.uy * 1e4)}:${Math.round(line.d * 100)}`;

const sameLine = (l1, l2) =>
  Math.abs(l1.ux - l2.ux) < 1e-6 && Math.abs(l1.uy - l2.uy) < 1e-6 && Math.abs(l1.d - l2.d) <= LATERAL_TOL;

// ordena y funde valores casi iguales (ruido flotante, no un umbral de diseño).
function dedupeSorted(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const out = [];
  for (const v of sorted) {
    if (out.length === 0 || v - out[out.length - 1] > EPS) out.push(v);
  }
  return out;
}

function segKey(seg) { return `${[...seg.lados].sort().join(",")}|${seg.clase}`; }

// clasificación de un tramo de DOS ambientes (§6). Devuelve { clase, aviso? }.
function clasificarDosAmbientes(ra, rb) {
  const aUnidad = esUnidad(ra), bUnidad = esUnidad(rb);
  if (aUnidad && bUnidad) {
    return ra.unitRef === rb.unitRef ? { clase: "interior" } : { clase: "entre_unidades" };
  }
  const aCirc = esCirculacionONucleo(ra), bCirc = esCirculacionONucleo(rb);
  if ((aUnidad && bCirc) || (bUnidad && aCirc)) return { clase: "a_corredor" };
  return {
    clase: "interior",
    aviso: `sin regla clara de clasificación entre "${ra.id}" y "${rb.id}" (ninguno es unidad+circulación/núcleo reconocible); se asume interior`,
  };
}

// clasificación de un tramo de UN ambiente (§6): huella (frente/fondo/lateral,
// según clasificarBordes + tipo de lote) o patio, o si no, interior_ciego.
function clasificarUnAmbiente(roomId, tStart, tEnd, line, footprintEdges, footprintClases, lotType, frontIdx, nFootprint, voidRooms, avisos) {
  const largo = tEnd - tStart;

  const match = footprintEdges.find((fe) => {
    if (!sameLine(line, fe.line)) return false;
    const t0 = fe.p0.x * line.ux + fe.p0.y * line.uy;
    const t1 = fe.p1.x * line.ux + fe.p1.y * line.uy;
    const lo = Math.min(t0, t1), hi = Math.max(t0, t1);
    return tStart >= lo - LATERAL_TOL && tEnd <= hi + LATERAL_TOL;
  });

  if (match) {
    // §6 dice "fachada si es frontIdx o paralela a ella dando a la calle, si no
    // medianera" — pero eso deja afuera el retiro posterior (obligatorio, área
    // libre reglamentaria: NUNCA linda con el vecino, por eso puede tener vanos) y
    // la calle lateral de un lote esquina (retiroLat). Ambas reglas ya existen en
    // clasificarBordes/EditorPlanos.jsx — las reuso en vez de reinventar una
    // versión más pobre acá. Ver nota de corrección en el reporte.
    const borde = footprintClases[match.idx];
    const esCalleLateralEsquina = lotType === "esquina" && match.idx === (frontIdx + 1) % nFootprint;
    const clase = borde === "frontal" || borde === "posterior" || esCalleLateralEsquina ? "fachada" : "medianera";
    return { tStart, tEnd, lados: [roomId], clase };
  }

  const patio = voidRooms.find((vr) => {
    const n = vr.pts.length;
    for (let i = 0; i < n; i++) {
      const p0 = vr.pts[i], p1 = vr.pts[(i + 1) % n];
      if (Math.hypot(p1.x - p0.x, p1.y - p0.y) < 1e-6) continue;
      const vline = edgeLine(p0, p1);
      if (!sameLine(line, vline)) continue;
      const vt0 = p0.x * line.ux + p0.y * line.uy, vt1 = p1.x * line.ux + p1.y * line.uy;
      const lo = Math.min(vt0, vt1), hi = Math.max(vt0, vt1);
      const overlap = Math.min(tEnd, hi) - Math.max(tStart, lo);
      if (overlap > LATERAL_TOL) return true;
    }
    return false;
  });
  if (patio) return { tStart, tEnd, lados: [roomId], clase: "fachada_patio" };

  avisos.push(`"${roomId}": muro de borde sin clasificar (ni huella ni patio), largo ${largo.toFixed(2)} m — interior_ciego`);
  return { tStart, tEnd, lados: [roomId], clase: "interior_ciego" };
}

// vuelve a unir tramos elementales consecutivos con exactamente los mismos lados y
// la misma clase (§5.5): si no, un muro largo queda picado en pedacitos.
function unirTramos(intervalosClasificados) {
  const abiertos = new Map(); // key -> { tStart, tEnd, lados, clase }
  const salida = [];
  for (const segs of intervalosClasificados) {
    const tocados = new Set();
    for (const seg of segs) {
      const key = segKey(seg);
      tocados.add(key);
      const abierto = abiertos.get(key);
      if (abierto && Math.abs(abierto.tEnd - seg.tStart) <= EPS) {
        abierto.tEnd = seg.tEnd;
      } else {
        if (abierto) salida.push(abierto);
        abiertos.set(key, { tStart: seg.tStart, tEnd: seg.tEnd, lados: seg.lados, clase: seg.clase });
      }
    }
    for (const [key, abierto] of [...abiertos.entries()]) {
      if (!tocados.has(key)) { salida.push(abierto); abiertos.delete(key); }
    }
  }
  for (const abierto of abiertos.values()) salida.push(abierto);
  return salida;
}

/**
 * Convierte una lista de ambientes en la colección de muros fundidos y clasificados.
 * @param {Array} rooms - [{ id, name, tipo, role, unitRef, pts: [{x,y}...] }]
 * @param {Object} contexto - { footprint: [{x,y}...], frontIdx: number, lotType: string }
 * @returns {{ muros: Array, avisos: string[] }}
 */
export function construirMuros(rooms = [], contexto = {}) {
  const avisos = [];
  const footprintPts = Array.isArray(contexto.footprint) ? contexto.footprint : [];
  const frontIdx = Number.isInteger(contexto.frontIdx) ? contexto.frontIdx : 0;
  const lotType = contexto.lotType || "medianera";

  const validas = (rooms || []).filter((r) => Array.isArray(r?.pts) && r.pts.length >= 3);
  for (const r of rooms || []) {
    if (!Array.isArray(r?.pts) || r.pts.length < 3) avisos.push(`ambiente "${r?.id ?? "?"}" descartado: sin polígono válido`);
  }
  const realRooms = validas.filter((r) => !esVoid(r));
  const voidRooms = validas.filter((r) => esVoid(r));
  const roomsById = new Map(validas.map((r) => [r.id, r]));

  // footprint: aristas + su clase (frontal/posterior/izquierda/derecha) reusando la
  // misma lógica que ya usa el editor para calcular retiros.
  const footprintClases = footprintPts.length >= 3 ? clasificarBordes(footprintPts, frontIdx) : [];
  const footprintEdges = [];
  for (let i = 0; i < footprintPts.length; i++) {
    const p0 = footprintPts[i], p1 = footprintPts[(i + 1) % footprintPts.length];
    if (Math.hypot(p1.x - p0.x, p1.y - p0.y) < 1e-6) continue;
    footprintEdges.push({ idx: i, p0, p1, line: edgeLine(p0, p1) });
  }

  // 1. recoger toda arista de todo ambiente (real, no void), agrupada por recta infinita.
  const groups = new Map();
  for (const room of realRooms) {
    const n = room.pts.length;
    for (let i = 0; i < n; i++) {
      const a = room.pts[i], b = room.pts[(i + 1) % n];
      if (Math.hypot(b.x - a.x, b.y - a.y) < 1e-6) continue;
      const line = edgeLine(a, b);
      const key = lineKey(line);
      if (!groups.has(key)) groups.set(key, { line, edges: [] });
      const g = groups.get(key);
      const ta = a.x * g.line.ux + a.y * g.line.uy;
      const tb = b.x * g.line.ux + b.y * g.line.uy;
      g.edges.push({ tmin: Math.min(ta, tb), tmax: Math.max(ta, tb), roomId: room.id });
    }
  }

  const muros = [];
  let autoId = 1;

  for (const g of groups.values()) {
    // 2-3. proyectar y partir por todos los extremos del grupo.
    const breakpoints = dedupeSorted(g.edges.flatMap((e) => [e.tmin, e.tmax]));
    if (breakpoints.length < 2) continue;

    const intervalos = [];
    for (let i = 0; i < breakpoints.length - 1; i++) {
      const tStart = breakpoints[i], tEnd = breakpoints[i + 1];
      if (tEnd - tStart < EPS) continue;
      const tm = (tStart + tEnd) / 2;
      const seen = new Set();
      const roomIds = [];
      for (const e of g.edges) {
        if (tm >= e.tmin - EPS && tm <= e.tmax + EPS && !seen.has(e.roomId)) {
          seen.add(e.roomId);
          roomIds.push(e.roomId);
        }
      }
      if (roomIds.length === 0) continue; // hueco: ningún ambiente cubre este tramo
      intervalos.push({ tStart, tEnd, roomIds });
    }

    // 4. clasificar cada tramo elemental.
    const clasificados = intervalos.map((iv) => {
      let roomIds = iv.roomIds;
      const largo = iv.tEnd - iv.tStart;

      if (roomIds.length >= 3) {
        const ordenados = [...roomIds].sort();
        avisos.push(`tramo con ${roomIds.length} ambientes superpuestos (${ordenados.join(", ")}): geometría inválida, se retienen los dos primeros`);
        roomIds = ordenados.slice(0, 2);
      }

      if (roomIds.length === 2) {
        if (largo < TOQUE_ESQUINA_MIN) {
          avisos.push(`toque de esquina de ${largo.toFixed(2)} m entre "${roomIds[0]}" y "${roomIds[1]}": no se funde como muro compartido`);
          return roomIds.map((rid) =>
            clasificarUnAmbiente(rid, iv.tStart, iv.tEnd, g.line, footprintEdges, footprintClases, lotType, frontIdx, footprintPts.length, voidRooms, avisos));
        }
        const [ra, rb] = roomIds.map((id) => roomsById.get(id));
        const { clase, aviso } = clasificarDosAmbientes(ra, rb);
        if (aviso) avisos.push(aviso);
        return [{ tStart: iv.tStart, tEnd: iv.tEnd, lados: [...roomIds].sort(), clase }];
      }

      // un solo ambiente
      return [clasificarUnAmbiente(roomIds[0], iv.tStart, iv.tEnd, g.line, footprintEdges, footprintClases, lotType, frontIdx, footprintPts.length, voidRooms, avisos)];
    });

    // 5. volver a unir tramos consecutivos con mismos lados y clase.
    const fundidos = unirTramos(clasificados);

    for (const run of fundidos) {
      const largo = run.tEnd - run.tStart;
      if (largo < EPS) continue;
      muros.push({
        id: `muro_${autoId++}`,
        a: pointAt(g.line, run.tStart),
        b: pointAt(g.line, run.tEnd),
        clase: run.clase,
        lados: run.lados,
        largo: round3(largo),
      });
    }
  }

  return { muros, avisos };
}
