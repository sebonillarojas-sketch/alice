// Recorta piezas (departamentos, core, corredores) contra la huella real del lote.
//
// `packFloor` reparte sobre el rectángulo envolvente del lote, no sobre la huella.
// Con un lote irregular las piezas se desbordan en las concavidades, el validador
// rechaza la planta entera y el usuario ve "la planta deja N m² sin asignar".
// Este módulo recorta cada pieza contra la huella antes de emitirla.
//
// ── Algoritmo ────────────────────────────────────────────────────────────────
//
// Sutherland–Hodgman exige que el **recortador** sea convexo; el **sujeto** puede
// ser cóncavo sin problema. La huella es cóncava y las piezas son (casi siempre)
// rectángulos, así que invertimos los roles: recortamos la **huella** contra los
// semiplanos de la **pieza**. Eso da exactamente `huella ∩ pieza` en una sola
// pasada, sin ningún paso de fusión de fragmentos (que es lo que producía anillos
// inválidos en la versión anterior).
//
// Beneficio extra: todos los vértices del resultado son o bien vértices de la
// huella, o bien puntos calculados **sobre una arista de la huella**, así que el
// resultado nunca puede caer fuera de la huella por error numérico.
//
// Queda un solo artefacto: con sujeto cóncavo, S–H devuelve un anillo único con un
// **puente de ancho cero** cuando el resultado real son dos componentes (una banda
// que cruza la muesca de una huella en U). Se resuelve como post-proceso, en dos
// pasos y sin unir nada:
//   1. `insertTouchPoints` parte cada arista en los vértices del anillo que caen
//      sobre ella (el puente es un tramo recorrido dos veces en sentidos opuestos;
//      esto hace que sus extremos aparezcan como vértices repetidos).
//   2. `splitAtRepeats` recorre el anillo con una pila y, cada vez que reencuentra
//      un vértice ya visitado, desprende ese lazo como componente propia. Los
//      tramos degenerados (menos de 3 puntos o área nula) se descartan.
//
// Si la pieza no es convexa se descompone antes por *ear clipping*; ver la nota en
// `clipPolygon`.

const EPS_AREA = 1e-9;   // área por debajo de la cual un anillo es basura numérica
const EPS_GEOM = 1e-9;   // tolerancia del test de semiplano (área con signo)
const EPS_PT = 1e-7;     // coincidencia de puntos; igual al EPS del validador

const clone = (p) => ({ x: p.x, y: p.y });
const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function signedArea(pts) {
  let a = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

const polyArea = (pts) => Math.abs(signedArea(pts));

/** Copia el anillo quitando puntos consecutivos coincidentes (incluido el cierre). */
function dedupe(pts) {
  const out = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || dist(last, p) > EPS_PT) out.push(clone(p));
  }
  while (out.length > 1 && dist(out[0], out[out.length - 1]) <= EPS_PT) out.pop();
  return out;
}

/** Quita vértices estrictamente colineales (no elimina picos: exige avanzar). */
function dropCollinear(pts) {
  if (pts.length < 4) return pts;
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[(i - 1 + pts.length) % pts.length];
    const cur = pts[i];
    const next = pts[(i + 1) % pts.length];
    const base = Math.max(dist(prev, cur), dist(cur, next), 1);
    if (Math.abs(cross(prev, cur, next)) / base > EPS_PT) { out.push(cur); continue; }
    const forward = (cur.x - prev.x) * (next.x - cur.x) + (cur.y - prev.y) * (next.y - cur.y);
    if (forward <= 0) out.push(cur); // pico o retroceso: no es redundante
  }
  return out.length >= 3 ? out : pts;
}

function isConvex(pts) {
  let pos = 0, neg = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const c = cross(pts[i], pts[(i + 1) % n], pts[(i + 2) % n]);
    if (c > EPS_GEOM) pos++;
    else if (c < -EPS_GEOM) neg++;
  }
  return !(pos && neg);
}

// ── Sutherland–Hodgman ───────────────────────────────────────────────────────

/**
 * Recorta `subject` (polígono simple, cóncavo o convexo) contra el semiplano
 * interior de la arista dirigida A→B. `dir` es +1 si el recortador está en CCW.
 * Los puntos nuevos se calculan sobre la arista del sujeto, no sobre la del
 * recortador: así el resultado nunca se sale del sujeto.
 */
function clipHalfPlane(subject, A, B, dir) {
  const out = [];
  const side = (p) => cross(A, B, p) * dir;
  const n = subject.length;
  for (let i = 0; i < n; i++) {
    const prev = subject[(i - 1 + n) % n];
    const cur = subject[i];
    const sPrev = side(prev), sCur = side(cur);
    const inPrev = sPrev >= -EPS_GEOM, inCur = sCur >= -EPS_GEOM;
    if (inCur !== inPrev) {
      const denom = sPrev - sCur;
      if (Math.abs(denom) > 0) {
        const t = sPrev / denom;
        out.push({ x: prev.x + (cur.x - prev.x) * t, y: prev.y + (cur.y - prev.y) * t });
      }
    }
    if (inCur) out.push(clone(cur));
  }
  return out;
}

/** `subject` (cóncavo permitido) ∩ `convexClip`. Devuelve un anillo crudo. */
function clipAgainstConvex(subject, convexClip) {
  const dir = signedArea(convexClip) >= 0 ? 1 : -1;
  let out = subject.map(clone);
  for (let i = 0, n = convexClip.length; i < n && out.length; i++) {
    const A = convexClip[i], B = convexClip[(i + 1) % n];
    if (dist(A, B) <= EPS_PT) continue;
    out = clipHalfPlane(out, A, B, dir);
  }
  return out;
}

// ── Post-proceso: separar los puentes de ancho cero ──────────────────────────

/**
 * Inserta en cada arista los vértices del anillo que caen en su interior. Un
 * puente de ancho cero es un tramo recorrido dos veces en sentidos opuestos; tras
 * esta inserción sus extremos quedan como vértices repetidos y `splitAtRepeats`
 * los puede separar.
 */
function insertTouchPoints(pts) {
  const out = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    out.push(clone(a));
    const len = dist(a, b);
    if (len <= EPS_PT) continue;
    const hits = [];
    for (let j = 0; j < n; j++) {
      if (j === i || j === (i + 1) % n) continue;
      const v = pts[j];
      if (Math.abs(cross(a, b, v)) / len > EPS_PT) continue;
      const t = ((v.x - a.x) * (b.x - a.x) + (v.y - a.y) * (b.y - a.y)) / (len * len);
      if (t * len <= EPS_PT || (1 - t) * len <= EPS_PT) continue;
      hits.push({ t, p: clone(v) });
    }
    hits.sort((x, y) => x.t - y.t);
    for (const h of hits) {
      const last = out[out.length - 1];
      if (dist(last, h.p) > EPS_PT) out.push(h.p);
    }
  }
  return dedupe(out);
}

/**
 * Recorre el anillo con una pila; al reencontrar un vértice ya visitado desprende
 * ese lazo como componente independiente. Es lo que convierte el anillo con puente
 * de la huella en U en dos anillos separados.
 */
function splitAtRepeats(pts) {
  const rings = [];
  const stack = [];
  for (const p of pts) {
    let at = -1;
    for (let i = 0; i < stack.length; i++) if (dist(stack[i], p) <= EPS_PT) { at = i; break; }
    if (at >= 0) rings.push(stack.splice(at));
    stack.push(clone(p));
  }
  if (stack.length) rings.push(stack);
  return rings;
}

/** Anillo crudo de S–H → lista de componentes válidas. */
function explodeRing(raw) {
  const base = dedupe(raw);
  if (base.length < 3) return [];
  const marked = insertTouchPoints(base);
  if (marked.length < 3) return [];
  return splitAtRepeats(marked)
    .map((ring) => dropCollinear(dedupe(ring)))
    .filter((ring) => ring.length >= 3 && polyArea(ring) >= EPS_AREA);
}

// ── Descomposición convexa (solo para piezas no convexas) ────────────────────

function pointInTriangle(p, a, b, c) {
  const d1 = cross(a, b, p), d2 = cross(b, c, p), d3 = cross(c, a, p);
  const hasNeg = d1 < -EPS_GEOM || d2 < -EPS_GEOM || d3 < -EPS_GEOM;
  const hasPos = d1 > EPS_GEOM || d2 > EPS_GEOM || d3 > EPS_GEOM;
  return !(hasNeg && hasPos);
}

/** Ear clipping: triangula un polígono simple sin introducir vértices nuevos. */
function earClip(poly) {
  if (poly.length < 3) return [];
  const ccw = signedArea(poly) >= 0 ? poly.map(clone) : poly.slice().reverse().map(clone);
  const idx = ccw.map((_, i) => i);
  const tris = [];
  let guard = idx.length * idx.length + 8;
  while (idx.length > 3 && guard-- > 0) {
    let found = false;
    for (let k = 0; k < idx.length; k++) {
      const a = ccw[idx[(k - 1 + idx.length) % idx.length]];
      const b = ccw[idx[k]];
      const c = ccw[idx[(k + 1) % idx.length]];
      if (cross(a, b, c) <= EPS_GEOM) continue;
      let contains = false;
      for (let m = 0; m < idx.length && !contains; m++) {
        const j = idx[m];
        if (ccw[j] === a || ccw[j] === b || ccw[j] === c) continue;
        contains = pointInTriangle(ccw[j], a, b, c);
      }
      if (contains) continue;
      tris.push([a, b, c]);
      idx.splice(k, 1);
      found = true;
      break;
    }
    if (!found) {
      tris.push([ccw[idx[idx.length - 1]], ccw[idx[0]], ccw[idx[1 % idx.length]]]);
      idx.splice(0, 1);
    }
  }
  if (idx.length === 3) tris.push([ccw[idx[0]], ccw[idx[1]], ccw[idx[2]]]);
  return tris;
}

// ── API ──────────────────────────────────────────────────────────────────────

/**
 * Recorta `subject` (la pieza) contra `clip` (la huella, que puede ser cóncava).
 * Devuelve una lista de anillos: `[]` si no queda nada, uno si el resultado es una
 * sola pieza, varios si la huella parte al sujeto en componentes disjuntas.
 *
 * Nota sobre piezas no convexas: `packFloor` entrega rectángulos o trapecios ya
 * recortados, que en la práctica o son convexos o caen enteros dentro de la huella
 * (caso que se detecta comparando áreas y se devuelve intacto). Si además de no ser
 * convexa la pieza se desborda, se descompone por *ear clipping* y se devuelven los
 * fragmentos por triángulo sin recomponerlos: correcto en área total y en geometría
 * (cada fragmento es un polígono simple), pero más troceado de lo necesario.
 *
 * @param {{x:number,y:number}[]} subject
 * @param {{x:number,y:number}[]} clip
 * @returns {{x:number,y:number}[][]}
 */
export function clipPolygon(subject, clip) {
  if (!Array.isArray(subject) || !Array.isArray(clip)) return [];
  const S = dedupe(subject);
  const C = dedupe(clip);
  if (S.length < 3 || C.length < 3) return [];

  const parts = isConvex(S) ? [S] : earClip(S);
  if (!parts.length) return [];

  const rings = [];
  for (const part of parts) {
    if (part.length < 3 || polyArea(part) < EPS_AREA) continue;
    for (const ring of explodeRing(clipAgainstConvex(C, part))) rings.push(ring);
  }
  if (!rings.length) return [];

  // Contención exacta: si el área recuperada iguala la de la pieza, la pieza estaba
  // entera dentro de la huella y se devuelve tal cual (sin vértices extra ni
  // fragmentar una pieza no convexa que no hacía falta tocar).
  const areaS = polyArea(S);
  const total = rings.reduce((sum, r) => sum + polyArea(r), 0);
  if (total >= areaS - 1e-9 * Math.max(1, areaS)) return [S.map(clone)];

  // Mismo sentido de giro que la pieza de entrada.
  const wantCCW = signedArea(S) >= 0;
  return rings.map((r) => (signedArea(r) >= 0) === wantCCW ? r : r.slice().reverse());
}

/**
 * Recorta cada pieza contra la huella; descarta lo que quede por debajo de
 * `minArea` y, si una pieza se parte, conserva solo el fragmento mayor.
 * No muta las piezas de entrada.
 *
 * @param {Array<{id:string,pts:{x:number,y:number}[]}>} pieces
 * @param {{x:number,y:number}[]} footprint
 * @param {number} [minArea]
 * @returns {{kept:object[], dropped:object[], split:number}}
 */
export function clipPieces(pieces, footprint, minArea = 1.0) {
  const kept = [];
  const dropped = [];
  let split = 0;
  for (const piece of pieces || []) {
    const rings = clipPolygon(piece.pts, footprint);
    if (rings.length > 1) split++;
    const survivors = rings.filter((r) => polyArea(r) >= minArea);
    if (!survivors.length) { dropped.push(piece); continue; }
    let best = survivors[0], bestArea = polyArea(best);
    for (let i = 1; i < survivors.length; i++) {
      const a = polyArea(survivors[i]);
      if (a > bestArea) { best = survivors[i]; bestArea = a; }
    }
    kept.push({ ...piece, pts: best.map(clone) });
  }
  return { kept, dropped, split };
}
