// Feyd-Rautha 🗡️ en el editor de planos: puente entre los rooms del editor
// y el layout JSON del skill arquitecto-residencial-lima (alicia-brain).
// El na-Barón audita la planta contra su checklist (RNE + Neufert + mercado)
// y devuelve veredicto + layout corregido, que acá se traduce de vuelta a rooms.
import { snapPt, area, centroid, pointInPolygon } from "./geometry.js";
import { ALICIA_URL } from "../../lib/brain.js";

const r2 = (n) => Math.round(n * 100) / 100;

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

// layout corregido del skill → rooms del editor (snap fino para no romper cotas)
export function layoutARooms(layout) {
  let i = 1;
  const tipoDe = (n = "") => {
    const s = n.toLowerCase();
    if (s.includes("pasillo") || s.includes("corredor")) return "pasillo";
    if (s.includes("core")) return "core";
    if (["baño", "bano", "lavand", "depósito", "deposito"].some((k) => s.includes(k))) return "servicio";
    return undefined;
  };
  return (layout?.ambientes || [])
    .filter((a) => a.poligono?.length >= 3)
    .map((a) => ({
      id: `fy${Date.now().toString(36)}_${i++}`,
      name: a.nombre,
      tipo: tipoDe(a.nombre),
      pts: a.poligono.map(([x, y]) => snapPt({ x, y }, 0.05)),
    }));
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
