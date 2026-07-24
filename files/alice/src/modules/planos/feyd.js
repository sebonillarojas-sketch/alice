// Feyd-Rautha 🗡️ en el editor de planos: puente entre los rooms del editor
// y el layout JSON del skill arquitecto-residencial-lima (alicia-brain).
// El na-Barón audita la planta contra su checklist (RNE + Neufert + mercado)
// y devuelve veredicto + layout corregido, que acá se traduce de vuelta a rooms.
import { snapPt, area, centroid, pointInPolygon } from "./geometry.js";
import { amoblarDesdeLayout } from "./distribucion.js";
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
