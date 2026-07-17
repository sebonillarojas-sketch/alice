// forma real del lote: ochavo + retiros por borde → footprint construible.
// compartido por la masa 3D y la planta esquemática (y coherente con el editor).
import { offsetEdges, ochavar, area as polyArea } from "../planos/geometry.js";

// clasifica cada borde respecto al frente (por su normal exterior):
// frontal / posterior / izquierda / derecha (mirando el lote desde la calle)
export function clasificarBordes(pts, frenteIdx) {
  const n = pts.length;
  const cx = pts.reduce((a, p) => a + p.x, 0) / n, cy = pts.reduce((a, p) => a + p.y, 0) / n;
  const normalOut = (i) => {
    const a = pts[i], b = pts[(i + 1) % n];
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
    let nx = dy / L, ny = -dx / L;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    if (nx * (mx - cx) + ny * (my - cy) < 0) { nx = -nx; ny = -ny; }
    return { nx, ny };
  };
  const nf = normalOut(frenteIdx % n);
  return pts.map((_, i) => {
    if (i === frenteIdx % n) return "frontal";
    const ni = normalOut(i);
    const dot = ni.nx * nf.nx + ni.ny * nf.ny;
    if (dot > 0.5) return "frontal";
    if (dot < -0.5) return "posterior";
    return (nf.nx * ni.ny - nf.ny * ni.nx) > 0 ? "derecha" : "izquierda";
  });
}

// aplica ochavo (solo esquina) y retiros por borde → { lote, footprint }
export function footprintReal(lotePoly, frenteIdx = 0, tipoLote = "medianera", retiros = {}) {
  let lote = lotePoly;
  if (tipoLote === "esquina" && retiros?.ochavo?.on && retiros.ochavo.v > 0) {
    lote = ochavar(lotePoly, (frenteIdx + 1) % lotePoly.length, retiros.ochavo.v);
  }
  const clases = clasificarBordes(lote, frenteIdx);
  const dists = clases.map((c) => {
    const r = c === "frontal" ? retiros?.frontal
      : c === "posterior" ? retiros?.posterior
      : c === "izquierda" ? retiros?.izquierda : retiros?.derecha;
    return r?.on ? r.v : 0;
  });
  let footprint = lote;
  const off = offsetEdges(lote, dists);
  if (off && off.length >= 3 && Math.abs(polyArea(off)) > 1) footprint = off;
  return { lote, footprint, clases };
}
