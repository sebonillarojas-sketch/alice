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

// las plantillas de AutoCAD suelen declarar unidades que no son las del dibujo
// (p.ej. acad.dwt imperial marca pulgadas aunque dibujes en metros). Si el área
// resultante es absurda para un lote, se prueba la interpretación plausible.
function elegirEscala(rawArea, mpu, unitCode) {
  const plausible = (a) => a >= 25 && a <= 500000; // de lotecito a manzana
  if ((unitCode in UNIT_M) && plausible(rawArea * mpu * mpu)) return { mpu, fixed: false };
  if (!(unitCode in UNIT_M) && plausible(rawArea)) return { mpu: 1, fixed: false }; // sin unidades → metros
  for (const [m, label] of [[1, "metros"], [0.001, "mm"], [0.01, "cm"], [0.3048, "pies"], [0.0254, "pulgadas"]]) {
    if (plausible(rawArea * m * m)) return { mpu: m, fixed: true, fixedTo: label };
  }
  return { mpu: (unitCode in UNIT_M) ? mpu : 1, fixed: false };
}

// recentra a origen (centro del bbox) y devuelve métricas
function finalize(polyRaw, mpuDecl, unitCode, layer, source) {
  const rawArea = Math.abs(shoelace(polyRaw));
  const esc = elegirEscala(rawArea, mpuDecl, unitCode);
  const mpu = esc.mpu;
  const poly = polyRaw.map((p) => ({ x: p.x * mpu, y: p.y * mpu }));
  const xs = poly.map((p) => p.x), ys = poly.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  // Y del CAD apunta arriba; en pantalla apunta abajo → invertimos Y al recentrar
  const pts = poly.map((p) => ({ x: +(p.x - cx).toFixed(3), y: +(cy - p.y).toFixed(3) }));
  const area = Math.abs(shoelace(pts));
  // borde más largo = frente probable (hacia la calle)
  let frente = 0, frenteIdx = 0;
  for (let i = 0; i < pts.length; i++) {
    const q = pts[(i + 1) % pts.length];
    const len = Math.hypot(pts[i].x - q.x, pts[i].y - q.y);
    if (len > frente) { frente = len; frenteIdx = i; }
  }
  return {
    pts, frenteIdx, area: +area.toFixed(1),
    bbox: { w: +(maxX - minX).toFixed(2), h: +(maxY - minY).toFixed(2) },
    frente: +frente.toFixed(2),
    units: esc.fixed ? (esc.fixedTo || "m") : (UNIT_LABEL[unitCode] ?? "m"),
    assumedMeters: !(unitCode in UNIT_M) && !esc.fixed,
    unitNote: esc.fixed
      ? `el archivo declaraba ${UNIT_LABEL[unitCode] ?? "s/u"} pero el tamaño no cuadraba — interpreté ${esc.fixedTo}; verifica el área`
      : null,
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
    // DWG binario → DXF vía LibreDWG (WASM), luego el mismo parser. Fallback: pedir DXF.
    const dxfText = await dwgToDXF(await file.arrayBuffer());
    return { ...parseDXF(dxfText), source: "dwg" };
  }
  throw new Error("formato no soportado — sube .dxf o .dwg");
}

// convierte DWG→DXF en el navegador (LibreDWG WASM); se carga bajo demanda (no pesa el bundle inicial)
let _dwgLib = null;
async function dwgToDXF(buf) {
  try {
    const mod = await import("@mlightcad/libredwg-web");
    const LibreDwg = mod.LibreDwg || mod.default?.LibreDwg;
    if (!_dwgLib) _dwgLib = await LibreDwg.create();
    const bytes = _dwgLib.dwg_write_dxf(buf);
    if (!bytes || !bytes.length) throw new Error("conversión vacía");
    return new TextDecoder().decode(bytes);
  } catch (e) {
    throw new Error(`no pude leer el DWG (${e?.message || e}). Expórtalo como DXF desde AutoCAD/Civil3D (Guardar como → DXF) y súbelo — sale igual con medidas reales.`);
  }
}
