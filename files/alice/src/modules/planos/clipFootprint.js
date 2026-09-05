// recorta piezas (departamentos, core, corredores) contra la huella real del lote.
//
// La huella puede ser cóncava (ochavos, mordidas, lotes en L), así que un
// Sutherland–Hodgman clásico no alcanza: asume recortador convexo y, cuando el
// resultado real es disjunto (una pieza que cruza una muesca), devuelve un solo
// anillo unido por un puente de ancho cero en vez de dos piezas separadas.
//
// Estrategia: triangulamos la huella (recortador, posiblemente cóncavo) por
// *ear clipping* — válido para cualquier polígono simple, cóncavo o no — y
// recortamos el sujeto contra cada triángulo (siempre convexo) con
// Sutherland–Hodgman. Cada triángulo aporta como mucho un fragmento convexo.
// Como la triangulación no tiene huecos ni superposiciones, la unión de esos
// fragmentos es exactamente sujeto ∩ huella; para reensamblarlos en anillos
// (en vez de dejarlos partidos por triángulo) cancelamos las aristas internas:
// una diagonal compartida por dos triángulos aparece recorrida en sentidos
// opuestos en cada uno (propiedad estándar de toda triangulación con
// orientación consistente), así que las aristas de los fragmentos que
// coinciden en sentido inverso son "costuras" internas y se eliminan; lo que
// queda son las aristas del borde real, que se encadenan en anillos cerrados.
// Esto es lo que separa correctamente los dos brazos de un recortador en U.

const EPS = 1e-9;

const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

function signedArea(pts) {
  let a = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

const polyArea = (pts) => Math.abs(signedArea(pts));

// intersección de la recta que pasa por p+t*d con la recta que pasa por q+s*e
function lineIntersect(p, d, q, e) {
  const denom = d.x * e.y - d.y * e.x;
  if (Math.abs(denom) < 1e-12) return null;
  const t = ((q.x - p.x) * e.y - (q.y - p.y) * e.x) / denom;
  return { x: p.x + d.x * t, y: p.y + d.y * t };
}

// Sutherland–Hodgman: recorta `subject` (cualquier polígono simple) contra
// `clip` (debe ser convexo). Devuelve un único anillo (o [] si no queda nada).
function clipConvexPoly(subject, clip) {
  if (subject.length < 3 || clip.length < 3) return [];
  const dir = signedArea(clip) >= 0 ? 1 : -1;
  let output = subject.map((p) => ({ x: p.x, y: p.y }));
  for (let i = 0; i < clip.length && output.length; i++) {
    const A = clip[i], B = clip[(i + 1) % clip.length];
    const edge = { x: B.x - A.x, y: B.y - A.y };
    const inside = (p) => cross(A, B, p) * dir >= -EPS;
    const input = output;
    output = [];
    for (let j = 0; j < input.length; j++) {
      const cur = input[j], prev = input[(j - 1 + input.length) % input.length];
      const cIn = inside(cur), pIn = inside(prev);
      if (cIn) {
        if (!pIn) {
          const hit = lineIntersect(prev, { x: cur.x - prev.x, y: cur.y - prev.y }, A, edge);
          if (hit) output.push(hit);
        }
        output.push({ x: cur.x, y: cur.y });
      } else if (pIn) {
        const hit = lineIntersect(prev, { x: cur.x - prev.x, y: cur.y - prev.y }, A, edge);
        if (hit) output.push(hit);
      }
    }
  }
  return polyArea(output) < EPS ? [] : output;
}

function pointInTriangle(p, a, b, c) {
  const d1 = cross(a, b, p);
  const d2 = cross(b, c, p);
  const d3 = cross(c, a, p);
  const hasNeg = d1 < -EPS || d2 < -EPS || d3 < -EPS;
  const hasPos = d1 > EPS || d2 > EPS || d3 > EPS;
  return !(hasNeg && hasPos);
}

// Ear clipping: triangula un polígono simple (cóncavo o convexo), sin
// vértices nuevos — cada triángulo usa solo vértices originales del polígono.
function earClipTriangulate(poly) {
  if (poly.length < 3) return [];
  // normalizamos a CCW para que el test de "oreja" (convexidad local) sea consistente
  const ccw = signedArea(poly) >= 0 ? poly.map((p) => ({ x: p.x, y: p.y })) : poly.slice().reverse().map((p) => ({ x: p.x, y: p.y }));
  const idx = ccw.map((_, i) => i);
  const triangles = [];
  let guard = idx.length * idx.length + 8; // corta cualquier ciclo numérico degenerado
  while (idx.length > 3 && guard-- > 0) {
    let earFound = false;
    for (let k = 0; k < idx.length; k++) {
      const iPrev = idx[(k - 1 + idx.length) % idx.length];
      const iCur = idx[k];
      const iNext = idx[(k + 1) % idx.length];
      const a = ccw[iPrev], b = ccw[iCur], c = ccw[iNext];
      if (cross(a, b, c) <= EPS) continue; // reflejo o degenerado: no es oreja
      let contains = false;
      for (let m = 0; m < idx.length; m++) {
        const j = idx[m];
        if (j === iPrev || j === iCur || j === iNext) continue;
        if (pointInTriangle(ccw[j], a, b, c)) { contains = true; break; }
      }
      if (contains) continue;
      triangles.push([a, b, c]);
      idx.splice(k, 1);
      earFound = true;
      break;
    }
    if (!earFound) {
      // polígono degenerado (colinealidades numéricas): recortamos igual
      // tomando la primera oreja disponible por convexidad simple
      const iPrev = idx[idx.length - 1], iCur = idx[0], iNext = idx[1 % idx.length];
      triangles.push([ccw[iPrev], ccw[iCur], ccw[iNext]]);
      idx.splice(0, 1);
    }
  }
  if (idx.length === 3) triangles.push([ccw[idx[0]], ccw[idx[1]], ccw[idx[2]]]);
  return triangles;
}

const keyPt = (p) => `${Math.round(p.x * 1e6)}:${Math.round(p.y * 1e6)}`;

// une fragmentos convexos disjuntos (salvo bordes compartidos) en anillos:
// cancela las aristas internas (una diagonal aparece en sentidos opuestos en
// los dos triángulos que la comparten) y encadena lo que sobra.
function mergeFragments(fragments) {
  // directedEdges: key "a->b" -> cuántas veces aparece
  const seen = new Map(); // key "a|b" (par no ordenado por posición) -> {dir, count}
  const edgeList = [];
  for (const frag of fragments) {
    const n = frag.length;
    for (let i = 0; i < n; i++) {
      edgeList.push([frag[i], frag[(i + 1) % n]]);
    }
  }
  // cancelación: para cada arista dirigida, buscamos su reversa exacta y las
  // eliminamos de a pares (con un contador, no un set, para tolerar aristas
  // repetidas legítimas si el sujeto las produce más de una vez)
  const active = new Map(); // "kA|kB" -> array de aristas [p,q] pendientes en ese sentido
  const addEdge = (p, q) => {
    const kp = keyPt(p), kq = keyPt(q);
    const revKey = `${kq}|${kp}`;
    const bucket = active.get(revKey);
    if (bucket && bucket.length) { bucket.pop(); return; } // cancela con su reversa
    const fwdKey = `${kp}|${kq}`;
    if (!active.has(fwdKey)) active.set(fwdKey, []);
    active.get(fwdKey).push([p, q]);
  };
  for (const [p, q] of edgeList) addEdge(p, q);

  const remaining = [];
  for (const bucket of active.values()) for (const e of bucket) remaining.push(e);
  if (!remaining.length) return [];

  // encadenar las aristas restantes en anillos cerrados
  const byStart = new Map();
  for (const e of remaining) {
    const k = keyPt(e[0]);
    if (!byStart.has(k)) byStart.set(k, []);
    byStart.get(k).push(e);
  }
  const used = new Set();
  const rings = [];
  for (let start = 0; start < remaining.length; start++) {
    if (used.has(remaining[start])) continue;
    const ring = [];
    let e = remaining[start];
    let guard = remaining.length + 4;
    while (e && !used.has(e) && guard-- > 0) {
      used.add(e);
      ring.push({ x: e[0].x, y: e[0].y });
      const nextKey = keyPt(e[1]);
      const candidates = byStart.get(nextKey) || [];
      e = candidates.find((c) => !used.has(c));
    }
    if (ring.length >= 3) rings.push(ring);
  }
  return rings;
}

/**
 * Recorta `subject` contra `clip` (que puede ser cóncavo). Devuelve una lista
 * de anillos: [] si no queda nada, uno si el resultado es una sola pieza,
 * varios si el recortador parte al sujeto (p.ej. una muesca cóncava).
 * @param {{x:number,y:number}[]} subject
 * @param {{x:number,y:number}[]} clip
 * @returns {{x:number,y:number}[][]}
 */
export function clipPolygon(subject, clip) {
  if (!subject || subject.length < 3 || !clip || clip.length < 3) return [];
  const triangles = earClipTriangulate(clip);
  if (!triangles.length) return [];
  const fragments = triangles
    .map((tri) => clipConvexPoly(subject, tri))
    .filter((f) => f.length >= 3 && polyArea(f) >= EPS);
  if (!fragments.length) return [];
  if (fragments.length === 1) return [fragments[0]];
  const rings = mergeFragments(fragments).filter((r) => polyArea(r) >= EPS);
  return rings;
}

/**
 * Recorta cada pieza contra la huella; descarta lo que quede por debajo de
 * `minArea` y, si una pieza se parte, conserva solo el fragmento mayor.
 * @param {Array<{id:string,pts:{x:number,y:number}[]}>} pieces
 * @param {{x:number,y:number}[]} footprint
 * @param {number} [minArea]
 * @returns {{kept:object[], dropped:object[], split:number}}
 */
export function clipPieces(pieces, footprint, minArea = 1.0) {
  const kept = [];
  const dropped = [];
  let split = 0;
  for (const piece of pieces) {
    const rawRings = clipPolygon(piece.pts, footprint);
    if (rawRings.length > 1) split++;
    const survivors = rawRings.filter((r) => polyArea(r) >= minArea);
    if (!survivors.length) {
      dropped.push(piece);
      continue;
    }
    let best = survivors[0], bestArea = polyArea(best);
    for (let i = 1; i < survivors.length; i++) {
      const a = polyArea(survivors[i]);
      if (a > bestArea) { best = survivors[i]; bestArea = a; }
    }
    kept.push({ ...piece, pts: best.map((p) => ({ x: p.x, y: p.y })) });
  }
  return { kept, dropped, split };
}
