// motor de geometría del editor de planos
// unidad de mundo = metros. las coordenadas de pantalla se derivan con la vista (scale, tx, ty).

export const GRID = 0.25; // paso de rejilla en metros

export const snap = (v, step = GRID) => Math.round(v / step) * step;

export const snapPt = (p, step = GRID) => ({ x: snap(p.x, step), y: snap(p.y, step) });

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// restringe q a horizontal/vertical respecto de p (lock ortogonal)
export function ortho(p, q) {
  const dx = Math.abs(q.x - p.x);
  const dy = Math.abs(q.y - p.y);
  return dx >= dy ? { x: q.x, y: p.y } : { x: p.x, y: q.y };
}

// área con signo (shoelace); el valor absoluto es el área del polígono en m²
export function signedArea(pts) {
  let a = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

export const area = (pts) => Math.abs(signedArea(pts));

export function centroid(pts) {
  const a = signedArea(pts);
  if (Math.abs(a) < 1e-9) {
    // degenerado: promedio simple
    const s = pts.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: s.x / pts.length, y: s.y / pts.length };
  }
  let cx = 0, cy = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    const cross = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * cross;
    cy += (p.y + q.y) * cross;
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

// perímetro en metros
export function perimeter(pts) {
  let per = 0;
  for (let i = 0, n = pts.length; i < n; i++) per += dist(pts[i], pts[(i + 1) % n]);
  return per;
}

// ¿el punto cae dentro del polígono? (ray casting)
export function pointInPolygon(p, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    const hit = a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
    if (hit) inside = !inside;
  }
  return inside;
}

// distancia de un punto al segmento ab (en metros)
export function distToSegment(p, a, b) {
  const l2 = dist(a, b) ** 2;
  if (l2 === 0) return dist(p, a);
  let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return dist(p, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
}

// ángulo del segmento a→b en grados (0 = este, sentido pantalla con y hacia abajo)
export const angleDeg = (a, b) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;

// vértice más cercano de una lista de polígonos, dentro de maxDist (metros).
// devuelve { p, roomIdx, ptIdx } o null.
export function nearestVertex(rooms, p, maxDist) {
  let best = null, bd = maxDist;
  rooms.forEach((room, ri) => {
    room.pts.forEach((v, pi) => {
      const d = dist(v, p);
      if (d < bd) { bd = d; best = { p: v, roomIdx: ri, ptIdx: pi }; }
    });
  });
  return best;
}

// bounding box de un conjunto de puntos
export function bbox(pts) {
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

// asegura orden antihorario (signedArea < 0 en coords pantalla y↓ = horario) → normaliza a CCW en y↑ mental
const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

// intersección de dos rectas dadas por punto+dirección; null si paralelas
function lineIntersect(p1, d1, p2, d2) {
  const den = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((p2.x - p1.x) * d2.y - (p2.y - p1.y) * d2.x) / den;
  return { x: p1.x + t * d1.x, y: p1.y + t * d1.y };
}

// offset hacia adentro de un polígono simple por `d` metros (retiros).
// devuelve el polígono reducido o null si colapsa.
// offset con distancia POR BORDE (retiros normativos: solo frente en medianera,
// frente + calle lateral en esquina). dists[i] aplica al borde pts[i]→pts[i+1].
export function offsetEdges(pts, dists) {
  const n = pts.length;
  if (n < 3) return null;
  if (!dists.some((d) => d > 0)) return pts.map((p) => ({ ...p }));
  const s = signedArea(pts) > 0 ? 1 : -1;
  const lines = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const ex = b.x - a.x, ey = b.y - a.y;
    const len = Math.hypot(ex, ey) || 1;
    const nx = (-ey / len) * s, ny = (ex / len) * s;
    const d = dists[i] || 0;
    lines.push({ p: { x: a.x + nx * d, y: a.y + ny * d }, dir: { x: ex, y: ey } });
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const prev = lines[(i - 1 + n) % n], cur = lines[i];
    // bordes consecutivos colineales (p.ej. un lindero dibujado en dos segmentos):
    // las rectas offset son paralelas → sin intersección; el arranque de la recta
    // actual ES el vértice correcto cuando ambos llevan el mismo offset.
    const hit = lineIntersect(prev.p, prev.dir, cur.p, cur.dir) || { x: cur.p.x, y: cur.p.y };
    out.push(hit);
  }
  if (Math.sign(signedArea(out)) !== Math.sign(signedArea(pts)) || area(out) < 0.5) return null;
  return out;
}

// ochavo: chaflán normativo en la esquina `cornerIdx` — recorta el vértice con un
// corte de longitud L (la arista nueva mide ~L). Devuelve el polígono con un vértice más.
export function ochavar(pts, cornerIdx, L) {
  const n = pts.length;
  if (n < 3 || L <= 0) return pts;
  const V = pts[cornerIdx % n], A = pts[(cornerIdx - 1 + n) % n], B = pts[(cornerIdx + 1) % n];
  const c = L / Math.SQRT2; // distancia de corte sobre cada lado (esquina ~90°)
  const lA = Math.hypot(V.x - A.x, V.y - A.y) || 1, lB = Math.hypot(B.x - V.x, B.y - V.y) || 1;
  const cA = Math.min(c, lA * 0.45), cB = Math.min(c, lB * 0.45); // no comerse el lado
  const P1 = { x: V.x - ((V.x - A.x) / lA) * cA, y: V.y - ((V.y - A.y) / lA) * cA };
  const P2 = { x: V.x + ((B.x - V.x) / lB) * cB, y: V.y + ((B.y - V.y) / lB) * cB };
  const i = cornerIdx % n;
  return [...pts.slice(0, i), P1, P2, ...pts.slice(i + 1)];
}

export function offsetPolygon(pts, d) {
  const n = pts.length;
  if (n < 3 || d <= 0) return pts.map((p) => ({ ...p }));
  // signo de la normal interior según orientación
  const s = signedArea(pts) > 0 ? 1 : -1;
  // rectas de cada borde desplazadas hacia adentro
  const lines = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const ex = b.x - a.x, ey = b.y - a.y;
    const len = Math.hypot(ex, ey) || 1;
    // normal interior (rotar dirección 90° según winding) · en pantalla y↓
    const nx = (-ey / len) * s, ny = (ex / len) * s;
    lines.push({ p: { x: a.x + nx * d, y: a.y + ny * d }, dir: { x: ex, y: ey } });
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const prev = lines[(i - 1 + n) % n], cur = lines[i];
    // bordes consecutivos colineales (p.ej. un lindero dibujado en dos segmentos):
    // las rectas offset son paralelas → sin intersección; el arranque de la recta
    // actual ES el vértice correcto cuando ambos llevan el mismo offset.
    const hit = lineIntersect(prev.p, prev.dir, cur.p, cur.dir) || { x: cur.p.x, y: cur.p.y };
    out.push(hit);
  }
  // validación: si el área se invirtió o colapsó, no sirve
  if (Math.sign(signedArea(out)) !== Math.sign(signedArea(pts)) || area(out) < 0.5) return null;
  return out;
}

// marco orientado a un borde "frente": origen en el inicio del borde,
// u = dirección del frente, v = normal interior. devuelve ejes + spans (frente, fondo).
export function orientedFrame(pts, frontIdx = 0) {
  const n = pts.length;
  const a = pts[frontIdx], b = pts[(frontIdx + 1) % n];
  const ex = b.x - a.x, ey = b.y - a.y;
  const len = Math.hypot(ex, ey) || 1;
  const u = { x: ex / len, y: ey / len };
  const s = signedArea(pts) > 0 ? 1 : -1;
  const v = { x: -u.y * s, y: u.x * s }; // normal interior
  let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
  pts.forEach((p) => {
    const du = (p.x - a.x) * u.x + (p.y - a.y) * u.y;
    const dv = (p.x - a.x) * v.x + (p.y - a.y) * v.y;
    uMin = Math.min(uMin, du); uMax = Math.max(uMax, du);
    vMin = Math.min(vMin, dv); vMax = Math.max(vMax, dv);
  });
  const origin = { x: a.x + u.x * uMin + v.x * vMin, y: a.y + u.y * uMin + v.y * vMin };
  const toWorld = (uu, vv) => ({ x: origin.x + u.x * uu + v.x * vv, y: origin.y + u.y * uu + v.y * vv });
  return { u, v, origin, frente: uMax - uMin, fondo: vMax - vMin, toWorld };
}

// recorta el polígono `subject` contra el `clip` convexo (Sutherland–Hodgman).
export function clipConvex(subject, clip) {
  if (!subject.length || !clip.length) return [];
  const dir = signedArea(clip) > 0 ? 1 : -1;
  let output = subject.map((p) => ({ ...p }));
  for (let i = 0; i < clip.length; i++) {
    const A = clip[i], B = clip[(i + 1) % clip.length];
    const input = output;
    output = [];
    // "dentro" = a la izquierda del borde según winding
    const inside = (p) => cross(A, B, p) * dir >= -1e-9;
    for (let j = 0; j < input.length; j++) {
      const cur = input[j], prev = input[(j - 1 + input.length) % input.length];
      const cIn = inside(cur), pIn = inside(prev);
      if (cIn) {
        if (!pIn) {
          const hit = lineIntersect(prev, { x: cur.x - prev.x, y: cur.y - prev.y }, A, { x: B.x - A.x, y: B.y - A.y });
          if (hit) output.push(hit);
        }
        output.push(cur);
      } else if (pIn) {
        const hit = lineIntersect(prev, { x: cur.x - prev.x, y: cur.y - prev.y }, A, { x: B.x - A.x, y: B.y - A.y });
        if (hit) output.push(hit);
      }
    }
    if (!output.length) return [];
  }
  return output;
}

// ¿el polígono es convexo? (para decidir si clipConvex aplica)
export function isConvex(pts) {
  const n = pts.length;
  if (n < 4) return true;
  let sign = 0;
  for (let i = 0; i < n; i++) {
    const z = cross(pts[i], pts[(i + 1) % n], pts[(i + 2) % n]);
    if (Math.abs(z) < 1e-9) continue;
    const s = z > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}
