// Adaptador legacy del editor. Los flujos nuevos viven en architecture.js bajo
// Tweedledum (diseño/revisión) y Tweedledee (crítica independiente).
// y el layout JSON del skill arquitecto-residencial-lima (alicia-brain).
// El na-Barón audita la planta contra su checklist (RNE + Neufert + mercado)
// y devuelve veredicto + layout corregido, que acá se traduce de vuelta a rooms.
import { snapPt, area, bbox, centroid, clipConvex, isConvex, pointInPolygon } from "./geometry.js";
import { amoblarDesdeLayout } from "./distribucion.js";
import { validarPlan } from "./validacion.js";
import { ALICIA_URL } from "../../lib/brain.js";

const r2 = (n) => Math.round(n * 100) / 100;

export const isRoomEditable = (room) => room?.locked !== true;
export const preserveLockedRooms = (current = [], replacement = []) => [
  ...current.filter((room) => !isRoomEditable(room)).map((room) => structuredClone(room)),
  ...replacement.map((room) => structuredClone(room)),
];

const ZONAS = [
  ["dormitorio", "intima"], ["estudio", "intima"],
  ["baño", "servicio"], ["bano", "servicio"], ["cocina", "servicio"],
  ["lavand", "servicio"], ["core", "servicio"], ["pasillo", "servicio"],
  ["hall", "servicio"], ["depósito", "servicio"], ["deposito", "servicio"],
];
const zonaDe = (name = "") => {
  const n = name.toLowerCase();
  const hit = ZONAS.find(([k]) => n.includes(k));
  return hit ? hit[1] : "social";
};
const SIN_LUZ = ["baño", "bano", "core", "pasillo", "hall", "lavand", "depósito", "deposito", "closet", "clóset"];
const conLuz = (name = "") => !SIN_LUZ.some((s) => name.toLowerCase().includes(s));

// rooms del editor → layout en el formato estricto del skill
export function roomsALayout(rooms, brief = {}) {
  const ambientes = rooms
    .filter((r) => r.pts?.length >= 3)
    .map((r) => ({
      nombre: r.name || r.tipo || "ambiente",
      ref_id: String(r.id),
      poligono: r.pts.map((p) => [r2(p.x), r2(p.y)]),
      zona: zonaDe(r.name),
      luz: conLuz(r.name),
    }));
  const total = rooms.filter((r) => r.pts?.length >= 3).reduce((a, r) => a + area(r.pts), 0);
  return {
    id: "editor-bam",
    nombre: "planta del editor BAM",
    area_techada: r2(total),
    ambientes,
  };
}

export function planALayout(rooms, items = [], brief = {}) {
  return {
    ...roomsALayout(rooms, brief),
    items: items.map((item) => ({
      id: String(item.id),
      ref: String(item.ref),
      x: r2(Number(item.x) || 0),
      y: r2(Number(item.y) || 0),
      rot: r2(Number(item.rot) || 0),
      w: r2(Number(item.w) || 0),
      d: r2(Number(item.d) || 0),
    })),
  };
}

// layout corregido del skill → rooms del editor (snap fino para no romper cotas)
export function layoutARooms(layout) {
  let i = 1;
  const used = new Set();
  const tipoDe = (n = "") => {
    const s = n.toLowerCase();
    if (/luz[ -]?cenital|patio de luz|ducto|shaft|vac[ií]o/.test(s)) return "void";
    if (s.includes("pasillo") || s.includes("corredor")) return "pasillo";
    if (s.includes("core")) return "core";
    if (["baño", "bano", "lavand", "depósito", "deposito"].some((k) => s.includes(k))) return "servicio";
    return undefined;
  };
  return (layout?.ambientes || [])
    .filter((a) => a.poligono?.length >= 3)
    .map((a) => {
      const supplied = String(a.ref_id || "").trim();
      const id = supplied && !used.has(supplied) ? supplied : `fy${Date.now().toString(36)}_${i++}`;
      used.add(id);
      return {
        id,
        name: a.nombre,
        tipo: a.tipo || tipoDe(a.nombre),
        pts: a.poligono.map(([x, y]) => snapPt({ x, y }, 0.05)),
      };
    });
}

const countNamed = (rooms, pattern) => rooms.filter((room) => pattern.test(String(room.name || room.tipo || "").toLowerCase())).length;
const positiveInt = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : fallback;
};

export function resolveArchitectureProgram(brief = {}, rooms = []) {
  const inferredBedrooms = countNamed(rooms, /dorm|habitaci[oó]n/);
  const inferredBathrooms = countNamed(rooms, /ba[ñn]o/);
  return {
    dormitorios: positiveInt(brief.architectureDormitorios ?? brief.dormitorios ?? brief.dorms, inferredBedrooms || 2),
    banos: positiveInt(brief.architectureBanos ?? brief.banos, inferredBathrooms || 2),
    nse: ["A", "B", "C", "D"].includes(brief.nse) ? brief.nse : "C",
    cocina: brief.cocina === "cerrada" || brief.cocinaCerrada ? "cerrada" : "abierta",
    lavanderia: brief.lavanderia !== false,
    banoVisita: brief.banoVisita === true || brief.bano_visita === true || brief.visita === true,
  };
}

function overlapArea(a, b) {
  if (!isConvex(a.pts) || !isConvex(b.pts)) return 0;
  const clipped = clipConvex(a.pts, b.pts);
  return clipped.length >= 3 ? area(clipped) : 0;
}

const ignoresOverlap = (a, b) => {
  if (a.tipo === "void" || b.tipo === "void") return true;
  return (a.tipo === "core" && b.tipo === "pasillo") || (a.tipo === "pasillo" && b.tipo === "core");
};

export function validateGeneratedInterior({ rooms = [], items = [], boundary = null, program = {} } = {}) {
  const base = validarPlan({ rooms: rooms.filter((room) => room.tipo !== "void"), items, limite: boundary });
  const findings = [];
  const bedrooms = countNamed(rooms, /dorm|habitaci[oó]n/);
  const bathrooms = countNamed(rooms, /ba[ñn]o/);
  const requiredBedrooms = positiveInt(program.dormitorios, 0);
  const requiredBathrooms = positiveInt(program.banos, 0);
  if (bedrooms < requiredBedrooms) findings.push({ code: "missing_bedrooms", severity: "major", message: `Faltan ${requiredBedrooms - bedrooms} dormitorio(s)` });
  if (bathrooms < requiredBathrooms) findings.push({ code: "missing_bathrooms", severity: "major", message: `Faltan ${requiredBathrooms - bathrooms} baño(s)` });
  if (!countNamed(rooms, /sala|social|comedor|estar|living/)) findings.push({ code: "missing_social_space", severity: "major", message: "Falta un ambiente social" });
  if (!countNamed(rooms, /cocina|kitchen/)) findings.push({ code: "missing_kitchen", severity: "major", message: "Falta una cocina" });
  for (let i = 0; i < rooms.length; i++) {
    if (area(rooms[i].pts || []) < 0.5) findings.push({ code: "invalid_room_area", severity: "major", targetId: rooms[i].id, message: `${rooms[i].name} no tiene área útil` });
    for (let j = i + 1; j < rooms.length; j++) {
      if (!ignoresOverlap(rooms[i], rooms[j]) && overlapArea(rooms[i], rooms[j]) > 0.05) findings.push({ code: "overlapping_rooms", severity: "major", targetId: rooms[i].id, message: `${rooms[i].name} se superpone con ${rooms[j].name}` });
    }
  }
  findings.push(...base.fueraLote.map((entry) => ({ code: "outside_boundary", severity: "major", targetId: entry.id, message: `${entry.name} está fuera de la huella` })));
  findings.push(...base.sinPiso.map((entry) => ({ code: "item_without_room", severity: "major", targetId: entry.id, message: `${entry.name} no pertenece a un ambiente` })));
  findings.push(...base.aislados.map((entry) => ({ code: "unreachable_room", severity: "major", targetId: entry.id, message: `${entry.name} no tiene acceso` })));
  return { ok: findings.length === 0, findings, messages: findings.map((finding) => finding.message) };
}

export function materializeInteriorLayout(layout, { boundary = null, program = {} } = {}) {
  const rooms = layoutARooms(layout);
  const extent = bbox((boundary?.length ? boundary : rooms.flatMap((room) => room.pts)) || []);
  const width = Math.max(0, extent.maxX - extent.minX);
  const depth = Math.max(0, extent.maxY - extent.minY);
  const localRooms = rooms.filter((room) => room.tipo !== "void").map((room) => ({ ...room, pts: room.pts.map((point) => ({ x: point.x - extent.minX, y: point.y - extent.minY })) }));
  const items = amoblarDesdeLayout(localRooms, width, depth, program.nse || "C")
    .map((item) => ({ ...item, x: r2(item.x + extent.minX), y: r2(item.y + extent.minY) }));
  return { rooms, items, validation: validateGeneratedInterior({ rooms, items, boundary, program }) };
}

const revisionFinding = (finding, index) => ({
  id: finding.id || `deterministic_${index + 1}`,
  code: finding.code,
  severity: finding.severity || "major",
  category: "buildability",
  title: finding.code === "overlapping_rooms" ? "Ambientes superpuestos" : "Distribución interior inválida",
  observation: finding.message,
  consequence: "La geometría no puede aplicarse al plano.",
  recommendation: "Corrige los polígonos sin cambiar el programa ni la huella.",
  location: finding.targetId ? { roomId: finding.targetId } : null,
});

export async function materializeWithOneRevision({ layout, boundary = null, program = {}, revisionFindings = [], revise = null } = {}) {
  const initial = materializeInteriorLayout(layout, { boundary, program });
  const deterministicFindings = initial.validation.findings.map(revisionFinding);
  const acceptedFindings = [...deterministicFindings, ...revisionFindings];
  if (!acceptedFindings.length || typeof revise !== "function") {
    return { generated: initial, revision: null, repaired: false, initialValidation: initial.validation };
  }
  const revision = await revise(acceptedFindings);
  const generated = materializeInteriorLayout(revision.layout, { boundary, program });
  return { generated, revision, repaired: true, initialValidation: initial.validation };
}

const floorPoints = (polygon) => (polygon || []).map(([x, y]) => ({ x: Number(x), y: Number(y) }));

const pointKey = (point) => `${Number(point.x).toFixed(6)},${Number(point.y).toFixed(6)}`;
function mergePieceBoundaries(pieces = []) {
  if (pieces.length === 1) return pieces[0].pts.map((point) => ({ ...point }));
  const edgeGroups = new Map();
  const pointByKey = new Map();
  for (const piece of pieces) {
    piece.pts.forEach((point, index) => {
      const next = piece.pts[(index + 1) % piece.pts.length];
      const a = pointKey(point), b = pointKey(next);
      pointByKey.set(a, point); pointByKey.set(b, next);
      const key = [a, b].sort().join("|");
      edgeGroups.set(key, [...(edgeGroups.get(key) || []), [a, b]]);
    });
  }
  const boundaryEdges = [...edgeGroups.values()].filter((group) => group.length === 1).map((group) => group[0]);
  const adjacency = new Map();
  for (const [a, b] of boundaryEdges) {
    adjacency.set(a, [...(adjacency.get(a) || []), b]);
    adjacency.set(b, [...(adjacency.get(b) || []), a]);
  }
  if (!adjacency.size || [...adjacency.values()].some((neighbors) => neighbors.length !== 2)) return null;
  const start = boundaryEdges[0][0];
  const ordered = [];
  let previous = null, current = start;
  do {
    ordered.push(pointByKey.get(current));
    const next = adjacency.get(current).find((key) => key !== previous);
    previous = current;
    current = next;
  } while (current && current !== start && ordered.length <= boundaryEdges.length);
  if (current !== start || ordered.length !== boundaryEdges.length) return null;
  return ordered.map((point) => ({ ...point }));
}

export function splitAcceptedFloor(floor = {}) {
  const polygons = Array.isArray(floor.polygons) ? floor.polygons : [];
  const lockedRooms = polygons.filter((item) => item.role !== "unidad").map((item) => ({
    id: item.polygonId,
    polygonId: item.polygonId,
    name: item.name,
    tipo: item.role === "circulacion" ? "pasillo" : item.role,
    role: item.role,
    pts: floorPoints(item.polygon),
    locked: true,
  }));
  const grouped = new Map();
  for (const item of polygons.filter((candidate) => candidate.role === "unidad")) {
    const unit = grouped.get(item.unitRef) || { unitRef: item.unitRef, program: { ...item.unitProgram }, pieces: [] };
    unit.pieces.push({ polygonId: item.polygonId, name: item.name, pts: floorPoints(item.polygon) });
    grouped.set(item.unitRef, unit);
  }
  const units = [...grouped.values()].map((unit) => ({
    ...unit,
    polygonId: unit.pieces.map((piece) => piece.polygonId).join("+"),
    boundary: mergePieceBoundaries(unit.pieces),
  }));
  return { lockedRooms, units };
}

const pendingUnitRooms = (unit) => unit.pieces.map((piece) => ({
  id: piece.polygonId,
  polygonId: piece.polygonId,
  unitRef: unit.unitRef,
  unitProgram: { ...unit.program },
  name: piece.name,
  tipo: "unidad",
  role: "unidad",
  pts: piece.pts.map((point) => ({ ...point })),
  pendingInterior: true,
}));

export async function materializeUnitInteriors({ floor, designUnit, reviseUnit = null } = {}) {
  const { lockedRooms, units } = splitAcceptedFloor(floor);
  const rooms = lockedRooms.map((room) => structuredClone(room));
  const items = [];
  const unitResults = [];
  for (const unit of units) {
    if (!unit.boundary || typeof designUnit !== "function") {
      rooms.push(...pendingUnitRooms(unit));
      unitResults.push({ unitRef: unit.unitRef, ok: false, repaired: false, reason: unit.boundary ? "designer_unavailable" : "multi_piece_boundary" });
      continue;
    }
    try {
      const design = await designUnit(unit);
      const resolved = await materializeWithOneRevision({
        layout: design.layout,
        boundary: unit.boundary,
        program: unit.program,
        revise: typeof reviseUnit === "function" ? (findings) => reviseUnit(unit, design, findings) : null,
      });
      if (!resolved.generated.validation.ok) {
        rooms.push(...pendingUnitRooms(unit));
        unitResults.push({ unitRef: unit.unitRef, ok: false, repaired: resolved.repaired, validation: resolved.generated.validation, design, revision: resolved.revision });
        continue;
      }
      rooms.push(...resolved.generated.rooms.map((room) => ({ ...room, id: `${unit.unitRef}:${room.id}`, unitRef: unit.unitRef, sourcePolygonId: unit.polygonId })));
      items.push(...resolved.generated.items.map((item) => ({ ...item, id: `${unit.unitRef}:${item.id}`, unitRef: unit.unitRef, sourcePolygonId: unit.polygonId })));
      unitResults.push({ unitRef: unit.unitRef, ok: true, repaired: resolved.repaired, validation: resolved.generated.validation, design, revision: resolved.revision });
    } catch (error) {
      rooms.push(...pendingUnitRooms(unit));
      unitResults.push({ unitRef: unit.unitRef, ok: false, repaired: false, reason: error?.message || "design_failed" });
    }
  }
  return { rooms, items, unitResults };
}

// F1 · Feyd deja de vaciar/desincronizar el mobiliario.
// Feyd audita SOLO los ambientes (roomsALayout no le manda muebles), y su
// corrección reescribe los polígonos. Antes, al aplicar, los muebles quedaban
// en las coordenadas viejas → flotando fuera de los muros ("vacías"/desincronizado).
// Acá cada mueble viaja con su ambiente: se lo reancla por el desplazamiento del
// centroide del ambiente que lo contenía — el mismo criterio con que el editor
// mueve los muebles cuando arrastrás un ambiente. Ningún mueble se pierde: los
// que no caen en ningún ambiente, o cuyo ambiente no matchea, quedan intactos.
export function reanclarItems(items, roomsPrev, roomsNew) {
  if (!items?.length || !roomsPrev?.length || !roomsNew?.length) return items || [];
  const cNew = roomsNew.map((r) => centroid(r.pts));
  // por cada ambiente previo, su corregido más cercano (Feyd ajusta, no reordena).
  // cap 6 m: si el match más cercano está lejísimo, no reanclar (evita saltos absurdos).
  const delta = roomsPrev.map((r) => {
    const c = centroid(r.pts);
    let best = -1, bestD = Infinity;
    for (let j = 0; j < cNew.length; j++) {
      const d = (cNew[j].x - c.x) ** 2 + (cNew[j].y - c.y) ** 2;
      if (d < bestD) { bestD = d; best = j; }
    }
    if (best < 0 || bestD > 36) return { x: 0, y: 0 };
    return { x: cNew[best].x - c.x, y: cNew[best].y - c.y };
  });
  return items.map((t) => {
    const ri = roomsPrev.findIndex((r) => pointInPolygon({ x: t.x, y: t.y }, r.pts));
    if (ri < 0) return t;
    const d = delta[ri];
    return { ...t, x: r2(t.x + d.x), y: r2(t.y + d.y) };
  });
}

// Paso 3 del editor: Feyd DISEÑA la planta de un depto adaptándola a la HUELLA REAL
// (polígono, que puede ser irregular/inclinado) siguiendo sus reglas — ventila cada
// habitable, pone puertas, crece los ambientes en proporción y no deja espacio muerto.
// Modo rápido (autocritica:false = 1 sola llamada) para no trabar el loop del editor.
export async function disenarConFeyd({ pts, dorms = 2, banos = 2, visita = false, closet = false, lavanderia = true, cocinaCerrada = false, nse = "C" } = {}) {
  if (!pts?.length) throw new Error("falta la huella del depto");
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  const poly = pts.map((p) => [r2(p.x - x0), r2(p.y - y0)]);      // huella en coords locales (0,0)
  const frente = r2(Math.max(...xs) - x0), fondo = r2(Math.max(...ys) - y0);
  const rectangular = poly.length === 4 &&
    poly.every(([x, y]) => (x < 0.05 || x > frente - 0.05) && (y < 0.05 || y > fondo - 0.05));
  const brief = {
    dormitorios: dorms, banos, bano_visita: visita, nse,
    closet_walkin: closet, lavanderia, cocina: cocinaCerrada ? "cerrada" : "abierta",
    frente_m: frente, fondo_m: fondo, area_objetivo: r2(frente * fondo),
    huella_poligono: poly,
    nota: `La huella real del depto es el polígono 'huella_poligono' (metros, origen 0,0)${rectangular ? "" : " y NO es un rectángulo: seguí sus muros inclinados, los ambientes perimetrales deben calzar contra el borde real, sin dejar zonas triangulares muertas"}. Usá TODA la huella (${r2(frente * fondo)} m²): hacé crecer los ambientes en proporción hasta llenarla, sin dejar espacio muerto. Ventilá cada habitable a fachada/pozo y dale puerta a cada ambiente.`,
    autocritica: false,
  };
  const res = await fetch(`${ALICIA_URL}/api/arquitecto/disenar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(brief),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) throw new Error("tu sesión venció — volvé a entrar");
    if (res.status === 503) throw new Error("Feyd no está disponible en este deploy");
    throw new Error(data.error || `arquitecto ${res.status}`);
  }
  const layout = data.layout;
  if (!layout?.ambientes?.length) throw new Error("Feyd no devolvió una planta válida");
  const rooms = layoutARooms(layout);
  const W = layout.frente_m || frente, D = layout.fondo_m || fondo;
  const items = amoblarDesdeLayout(rooms, W, D, nse);
  return { rooms, items, W, D };
}

// consulta al na-Barón vía alicia-brain (el interceptor de lib/supabase.js adjunta el JWT)
export async function corregirConFeyd(rooms, brief = {}) {
  const layout = roomsALayout(rooms, brief);
  if (!layout.ambientes.length) throw new Error("no hay ambientes que auditar");
  const notas = [brief.nse && `NSE ${brief.nse}`, brief.terraza && "con terraza a fachada"].filter(Boolean).join(" · ");
  const res = await fetch(`${ALICIA_URL}/api/arquitecto/corregir`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ layout, notas }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) throw new Error("tu sesión venció — volvé a entrar");
    throw new Error(data.error || `arquitecto ${res.status}`);
  }
  return {
    veredicto: data.veredicto || "sin veredicto",
    problemas: Array.isArray(data.problemas) ? data.problemas : [],
    rooms: data.layout?.ambientes?.length ? layoutARooms(data.layout) : null,
  };
}
