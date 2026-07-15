// generador de OPCIONES de planta dentro del lote.
// flujo: cabida (brief) → lote (footprint) → 5 opciones de distribución.
// cada opción: packFloor (core/corredor/unidades) → por unidad, tipología más CERCANA
// al recorte real → layout amoblado (reglas RNE/Neufert) transformado al marco del lote
// → sugerencia de terraza + jardineras en fachada.

import { packFloor } from "./lote.js";
import { layout } from "./distribucion.js";
import { tipologiaCercana, mixTipologias, porTipologia } from "./tipologias.js";
import { area } from "./geometry.js";
import { porId, NSE } from "./mobiliario.js";

let _n = 1;
const oid = () => `o${_n++}_${Math.random().toString(36).slice(2, 5)}`;
const round = (n) => +n.toFixed(3);
const rect = (x, y, w, h) => [{ x: round(x), y: round(y) }, { x: round(x + w), y: round(y) }, { x: round(x + w), y: round(y + h) }, { x: round(x), y: round(y + h) }];
const it = (ref, x, y, rot = 0, over = {}) => {
  const c = porId[ref] || { w: 1, d: 1 };
  return { id: oid(), ref, x: round(x), y: round(y), rot, w: over.w ?? c.w, d: over.d ?? c.d, ...over };
};

// layout compacto de STUDIO/1D para recortes poco profundos (bandas de doble crujía).
// convención local: y=0 fachada · y=D corredor/ingreso. baño en esquina del corredor,
// kitchenette contra el muro del corredor, cama a fachada.
function layoutStudio(W, D, nse = "C") {
  if (W < 2.8 || D < 3.2) return null;
  const rooms = [], items = [], warns = [];
  const bw = Math.min(1.7, W * 0.35), bd = Math.min(2.0, D * 0.48);
  // baño (esquina izquierda del corredor)
  rooms.push({ id: oid(), name: "baño", tipo: "baño", pts: rect(0, D - bd, bw, bd) });
  items.push(it("inodoro", 0.34, D - 0.42, 180));
  items.push(it("lavamanos", bw - 0.32, D - bd + 0.32, 90));
  if (bd >= 1.8) items.push(it("ducha", 0.45, D - bd + 0.45, 0, { w: 0.8, d: 0.8 }));
  items.push(it("puerta-70", bw / 2, D - bd, 0));
  // ambiente único en L alrededor del baño
  rooms.push({
    id: oid(), name: "studio", tipo: "social",
    pts: [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: D }, { x: round(bw), y: D },
      { x: round(bw), y: round(D - bd) }, { x: 0, y: round(D - bd) }].map((p) => ({ x: round(p.x), y: round(p.y) })),
  });
  // kitchenette contra el muro del corredor
  const p = (NSE[nse] || NSE.C).cocina;
  const kw = Math.min(p.w, W - bw - 1.2);
  if (kw >= 1.5) items.push(it("cocina", bw + 0.35 + kw / 2, D - 0.31, 180, { w: kw, hornillas: 2, refriW: Math.min(p.refriW, 0.65) }));
  // cama a fachada + velador
  const cama = W >= 4.2 ? "cama-2plz" : "cama-15plz";
  const cw = porId[cama].w;
  items.push(it(cama, W - cw / 2 - 0.35, porId[cama].d / 2 + 0.1, 0));
  // estar chico si el ancho da
  if (W - cw - 2.2 >= 1.7) {
    items.push(it("sofa-2c", 1.15, 0.6, 0, { w: 1.5 }));
    items.push(it("mesa-centro", 1.15, 1.55, 0, { w: 0.8, d: 0.45 }));
  }
  // ingreso desde el corredor + ventana a fachada
  items.push(it("puerta-90", Math.min(bw + 0.75, W - 0.6), D, 0));
  items.push(it(W >= 3.4 ? "ventana-180" : "ventana-120", W / 2, 0, 0));
  return { rooms, items, warns };
}

/** amuebla una unidad rectangular del piso, transformando el layout local al mundo.
 *  override: { tipologiaId, banos } — elección manual del usuario para ESTE bloque. */
function amoblarUnidad(unit, F, nse, override = null) {
  const { ua, ub, v0, v1, banda } = unit.frame;
  const W = ub - ua, D = v1 - v0;
  const forzada = override?.tipologiaId ? porTipologia[override.tipologiaId] : null;
  let t = forzada || unit.tipologia || tipologiaCercana(W * D, W);
  const nb = override?.banos ?? t.banos;
  let L = layout(W, D, t.dorms, nb, { swap: false, nse })
    || (t.dorms <= 2 ? layoutStudio(W, D, nse) : null);   // recorte poco profundo → studio compacto
  if (!L && !forzada) {
    // la tipología pedida no cabe en este recorte → probar la más cercana SIN preferencia de dorms
    const t2 = tipologiaCercana(W * D, W);
    if (t2.id !== t.id) {
      L = layout(W, D, t2.dorms, t2.banos, { swap: false, nse }) || (t2.dorms <= 2 ? layoutStudio(W, D, nse) : null);
      if (L) t = t2;
    }
    if (!L && W >= 2.8 && D >= 3.2) { L = layoutStudio(W, D, nse); if (L) t = tipologiaCercana(W * D, W, 1); }
  }
  if (!L) return null; // el recorte no admite distribución interna — queda como bloque

  // banda 0: fachada al frente (v=v0) → local y=0 ↔ v=v0.
  // banda 1: fachada al fondo (v=v1) → rotar la unidad 180° para mantener quiralidad.
  const toFrame = banda === 0
    ? (x, y) => ({ u: ua + x, v: v0 + y })
    : (x, y) => ({ u: ua + (W - x), v: v0 + (D - y) });
  const rotExtra = banda === 0 ? 0 : 180;

  const ang = (Math.atan2(F.u.y, F.u.x) * 180) / Math.PI;
  const toWorldPt = (x, y) => { const f = toFrame(x, y); const p = F.toWorld(f.u, f.v); return { x: round(p.x), y: round(p.y) }; };

  const rooms = L.rooms.map((r) => ({
    ...r, id: `${unit.id}_${r.id}`,
    pts: r.pts.map((p) => toWorldPt(p.x, p.y)),
  }));
  const items = L.items.map((t2) => {
    const p = toWorldPt(t2.x, t2.y);
    return { ...t2, id: `${unit.id}_${t2.id}`, x: p.x, y: p.y, rot: (t2.rot + rotExtra + ang + 360) % 360 };
  });
  return { rooms, items, tipologia: t, warns: L.warns };
}

/** terraza + jardineras contra la fachada del frente (banda 0) */
function fachada(units, F, { terraza = true } = {}) {
  const rooms = [], items = [];
  const ang = (Math.atan2(F.u.y, F.u.x) * 180) / Math.PI;
  const T = (u, v) => { const p = F.toWorld(u, v); return { x: round(p.x), y: round(p.y) }; };
  const DEPTH = 0.9; // balcón típico volado sobre retiro (Lima: hasta ~1.0 m)
  units.filter((x) => x.frame?.banda === 0).forEach((u) => {
    const { ua, ub } = u.frame;
    const w = ub - ua;
    if (terraza && w >= 2.2) {
      rooms.push({
        id: `${u.id}_terr`, name: "terraza", tipo: "terraza",
        pts: [T(ua + 0.2, -DEPTH), T(ub - 0.2, -DEPTH), T(ub - 0.2, 0), T(ua + 0.2, 0)],
      });
      // jardinera al borde exterior + mobiliario si el ancho da
      const jw = Math.min(1.6, w - 1.4);
      const pj = T(ua + 0.2 + jw / 2 + 0.05, -DEPTH + 0.28);
      items.push({ id: `${u.id}_jar`, ref: "jardinera", x: pj.x, y: pj.y, rot: ang, w: jw, d: 0.45 });
      if (w >= 3.0) {
        const pm = T(ub - 1.0, -DEPTH / 2);
        items.push({ id: `${u.id}_mesa`, ref: "mesa-ext", x: pm.x, y: pm.y, rot: ang, w: 0.7, d: 0.7 });
      }
    } else {
      // sin terraza: macetas/jardineras al pie de las ventanas de fachada
      const pj = T((ua + ub) / 2, -0.35);
      items.push({ id: `${u.id}_jar`, ref: "jardinera", x: pj.x, y: pj.y, rot: ang, w: Math.min(1.5, w - 0.6), d: 0.45 });
    }
  });
  return { rooms, items };
}

/**
 * FASE 1 — DISTRIBUCIÓN: reparte core + corredor + bloques de unidad dentro del
 * footprint. Devuelve partis SIN amoblar (las tipologías vienen después).
 * cfg: { udsPiso, pct1, pct2, areaObjetivo }
 */
export function generarDistribuciones(footprint, frontIdx, cfg = {}) {
  const { udsPiso = 4, pct1 = 25, pct2 = 40, areaObjetivo = 60 } = cfg;
  const unidades = mixTipologias(Math.max(1, udsPiso), { pct1, pct2, areaObjetivo });

  const configs = [
    { nombre: "core al centro", corePos: "centro", ordenar: "desc" },
    { nombre: "core lateral", corePos: "izq", ordenar: "desc" },
    { nombre: "chicos a las esquinas", corePos: "centro", ordenar: "asc" },
    { nombre: "core lateral · chicos al frente", corePos: "izq", ordenar: "asc" },
  ];

  const partis = [];
  for (const c of configs) {
    const res = packFloor(footprint, frontIdx, { unidades, corePos: c.corePos, ordenar: c.ordenar });
    if (!res.units.length) continue;
    const rooms = [];
    if (res.core) rooms.push({ id: res.core.id, name: "core", tipo: "core", pts: res.core.pts });
    if (res.corridor) rooms.push({ id: res.corridor.id, name: "corredor", tipo: "pasillo", pts: res.corridor.pts });
    res.units.forEach((u) => {
      const t = u.areaReal < 16 ? { id: "depósito" } : tipologiaCercana(u.areaReal, u.frame.ub - u.frame.ua, u.tipologia?.dorms);
      u.tipologia = t;
      rooms.push({ id: u.id, name: `${t.id} · ${u.areaReal.toFixed(0)}m²`, tipo: "unidad", subtipo: u.subtipo, pts: u.pts });
    });
    partis.push({
      id: oid(), nombre: c.nombre, rooms, res,
      notas: [
        res.units.map((u) => `${u.tipologia.id} ${u.areaReal.toFixed(0)}m²`).join(" · "),
        res.doble ? "doble crujía" : "crujía simple",
      ],
      stats: { uds: res.units.length },
    });
  }
  return partis.slice(0, 5);
}

/**
 * FASE 2 — TIPOLOGÍAS: amuebla un parti elegido y suma terraza/jardineras.
 * brief: { nse, terraza }
 * overrides: { [unitId]: { tipologiaId, banos } } — elección/tweaks manuales por bloque.
 */
export function amoblarParti(parti, brief = {}, overrides = {}) {
  const { nse = "C", terraza = true } = brief;
  const { res } = parti;
  const rooms = [], items = [], notas = [];
  if (res.core) rooms.push({ id: `${res.core.id}a`, name: "core", tipo: "core", pts: res.core.pts });
  if (res.corridor) rooms.push({ id: `${res.corridor.id}a`, name: "corredor", tipo: "pasillo", pts: res.corridor.pts });

  let amobladas = 0;
  res.units.forEach((u) => {
    if (u.areaReal < 16) {
      rooms.push({ id: `${u.id}a`, name: `depósito · ${u.areaReal.toFixed(0)}m²`, tipo: "servicio", pts: u.pts });
      return;
    }
    const A = amoblarUnidad(u, res.F, nse, overrides[u.id]);
    if (A) {
      u.tipologia = A.tipologia;   // puede haber caído a la tipología que sí cabe
      rooms.push(...A.rooms.map((r) => ({ ...r, unidad: A.tipologia.id })));
      items.push(...A.items);
      amobladas++;
      if (A.warns.length) notas.push(`${A.tipologia.id}: ${A.warns[0]}`);
    } else {
      rooms.push({ id: `${u.id}a`, name: `${u.tipologia.id} · ${u.areaReal.toFixed(0)}m²`, tipo: "unidad", subtipo: u.subtipo, pts: u.pts });
      notas.push(`${u.tipologia.id}: recorte ${u.areaReal.toFixed(0)}m² sin distribución interna`);
    }
  });

  // sugerencia de fachada: terraza + vegetación
  const fx = fachada(res.units, res.F, { terraza });
  rooms.push(...fx.rooms);
  items.push(...fx.items);
  if (fx.rooms.length) notas.push(`sugerencia: ${fx.rooms.length} terrazas con jardinera a fachada`);
  else if (fx.items.length) notas.push("sugerencia: jardineras a fachada");

  // resumen con las tipologías FINALES (incluye overrides del usuario)
  const resumen = res.units.map((u) => `${u.tipologia?.id || "?"} ${u.areaReal.toFixed(0)}m²`).join(" · ");
  return {
    id: oid(), nombre: parti.nombre, rooms, items,
    notas: [resumen, ...parti.notas.slice(1), ...notas],
    stats: {
      uds: res.units.length, amobladas,
      areaPiso: rooms.filter((r) => r.tipo === "unidad" || r.unidad).reduce((a, r) => a + area(r.pts), 0),
    },
  };
}

/** compat: distribución + tipologías en un paso (5 opciones amobladas) */
export function generarOpciones(footprint, frontIdx, brief = {}) {
  const partis = generarDistribuciones(footprint, frontIdx, brief);
  const opciones = partis.map((p) => amoblarParti(p, brief));

  // 5ª opción: espejo de la primera
  if (opciones[0] && opciones.length < 5) {
    const base = opciones[0];
    const xs = base.rooms.flatMap((r) => r.pts.map((p) => p.x));
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    opciones.push({
      id: oid(), nombre: `${base.nombre} · espejo`,
      rooms: base.rooms.map((r) => ({ ...r, id: `m_${r.id}`, pts: [...r.pts.map((p) => ({ x: round(2 * cx - p.x), y: p.y }))].reverse() })),
      items: base.items.map((t) => ({ ...t, id: `m_${t.id}`, x: round(2 * cx - t.x), rot: (180 - t.rot + 360) % 360 })),
      notas: base.notas, stats: base.stats,
    });
  }
  return opciones.slice(0, 5);
}
