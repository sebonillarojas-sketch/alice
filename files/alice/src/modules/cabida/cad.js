// Lectura de CAD (DXF) → contorno del lote en metros reales.
// DWG (binario propietario) se convierte a DXF antes de entrar aquí (ver importCAD).
import DxfParser from "dxf-parser";

// $INSUNITS del header DXF → metros por unidad de dibujo
const UNIT_M = { 1: 0.0254, 2: 0.3048, 4: 0.001, 5: 0.01, 6: 1, 7: 1000, 8: 0.0000000254, 13: 1e-9 };
const UNIT_LABEL = { 1: "pulg", 2: "pies", 4: "mm", 5: "cm", 6: "m", 7: "km", 0: "s/u" };

const shoelace = (p) => {
  let a = 0;
  for (let i = 0, n = p.length; i < n; i++) {
    const q = p[(i + 1) % n];
    a += p[i].x * q.y - q.x * p[i].y;
  }
  return a / 2;
};

// vértices de una entidad polilínea (LWPOLYLINE / POLYLINE)
function polyVerts(e) {
  const vs = (e.vertices || []).map((v) => ({ x: v.x, y: v.y }));
  if (vs.length >= 2) {
    const a = vs[0], b = vs[vs.length - 1];
    if (Math.hypot(a.x - b.x, a.y - b.y) < 1e-6) vs.pop(); // cierra sin duplicar
  }
  return vs;
}

// arma polígonos cerrados a partir de segmentos LINE sueltos (cadena punta-a-punta)
function polysFromLines(lines) {
  const segs = lines.map((l) => ({
    a: { x: l.vertices[0].x, y: l.vertices[0].y },
    b: { x: l.vertices[1].x, y: l.vertices[1].y },
  }));
  const used = new Array(segs.length).fill(false);
  const key = (p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
  const eq = (p, q) => Math.hypot(p.x - q.x, p.y - q.y) < 1e-3;
  const polys = [];
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    const chain = [segs[i].a, segs[i].b];
    used[i] = true;
    let grew = true;
    while (grew) {
      grew = false;
      const tail = chain[chain.length - 1];
      for (let j = 0; j < segs.length; j++) {
        if (used[j]) continue;
        if (eq(segs[j].a, tail)) { chain.push(segs[j].b); used[j] = true; grew = true; break; }
        if (eq(segs[j].b, tail)) { chain.push(segs[j].a); used[j] = true; grew = true; break; }
      }
    }
    if (chain.length >= 4 && eq(chain[0], chain[chain.length - 1])) {
      chain.pop();
      polys.push(chain);
    }
  }
  return polys;
}

// recentra a origen (centro del bbox) y devuelve métricas
function finalize(polyRaw, mpu, unitCode, layer, source) {
  const poly = polyRaw.map((p) => ({ x: p.x * mpu, y: p.y * mpu }));
  const xs = poly.map((p) => p.x), ys = poly.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  // Y del CAD apunta arriba; en pantalla apunta abajo → invertimos Y al recentrar
  const pts = poly.map((p) => ({ x: +(p.x - cx).toFixed(3), y: +(cy - p.y).toFixed(3) }));
  const area = Math.abs(shoelace(pts));
  // borde más largo = frente probable (hacia la calle)
  let frente = 0;
  for (let i = 0; i < pts.length; i++) {
    const q = pts[(i + 1) % pts.length];
    frente = Math.max(frente, Math.hypot(pts[i].x - q.x, pts[i].y - q.y));
  }
  return {
    pts, area: +area.toFixed(1),
    bbox: { w: +(maxX - minX).toFixed(2), h: +(maxY - minY).toFixed(2) },
    frente: +frente.toFixed(2),
    units: UNIT_LABEL[unitCode] ?? "m", assumedMeters: !(unitCode in UNIT_M),
    layer, source, verts: pts.length,
  };
}

// Extrae el lote (polígono cerrado de mayor área) de texto DXF.
export function parseDXF(text) {
  const dxf = new DxfParser().parseSync(text);
  const unitCode = dxf?.header?.$INSUNITS ?? 0;
  const mpu = UNIT_M[unitCode] ?? 1; // s/u o desconocido → asumimos metros

  const ents = dxf?.entities || [];
  const candidates = [];

  for (const e of ents) {
    if ((e.type === "LWPOLYLINE" || e.type === "POLYLINE")) {
      const closed = e.shape || e.closed || (e.flags & 1);
      const vs = polyVerts(e);
      if (vs.length >= 3 && (closed || vs.length >= 3)) {
        candidates.push({ pts: vs, layer: e.layer || "?" });
      }
    }
  }
  // fallback: cadenas de LINE que cierren
  if (!candidates.length) {
    const lines = ents.filter((e) => e.type === "LINE" && e.vertices?.length === 2);
    for (const p of polysFromLines(lines)) candidates.push({ pts: p, layer: "LINES" });
  }
  if (!candidates.length) throw new Error("no encontré ninguna polilínea cerrada en el DXF (¿el lindero está como polilínea?)");

  // el lote = el de mayor área
  candidates.sort((a, b) => Math.abs(shoelace(b.pts)) - Math.abs(shoelace(a.pts)));
  const best = candidates[0];
  return finalize(best.pts, mpu, unitCode, best.layer, "dxf");
}

// Punto de entrada: recibe un File (.dxf o .dwg). DWG → convierte a DXF vía WASM.
export async function importCAD(file) {
  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".dxf")) {
    return parseDXF(await file.text());
  }
  if (name.endsWith(".dwg")) {
    // DWG es binario propietario. La conversión DWG→DXF en el navegador (LibreDWG WASM)
    // se agregará como paso aparte, verificado. Por ahora se pide el DXF (un clic).
    throw new Error("DWG-directo en camino. Por ahora expórtalo como DXF desde AutoCAD/Civil3D (Guardar como → DXF) y súbelo — sale con las mismas medidas reales.");
  }
  throw new Error("formato no soportado — sube .dxf");
}
