// Feyd-Rautha 🗡️ en el editor de planos: puente entre los rooms del editor
// y el layout JSON del skill arquitecto-residencial-lima (alicia-brain).
// El na-Barón audita la planta contra su checklist (RNE + Neufert + mercado)
// y devuelve veredicto + layout corregido, que acá se traduce de vuelta a rooms.
import { snapPt, area } from "./geometry.js";

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

// consulta al na-Barón vía alicia-brain (el interceptor de lib/supabase.js adjunta el JWT)
export async function corregirConFeyd(rooms, brief = {}) {
  const layout = roomsALayout(rooms, brief);
  if (!layout.ambientes.length) throw new Error("no hay ambientes que auditar");
  const notas = [brief.nse && `NSE ${brief.nse}`, brief.terraza && "con terraza a fachada"].filter(Boolean).join(" · ");
  const res = await fetch("https://aliceai.bam.pe/api/arquitecto/corregir", {
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
