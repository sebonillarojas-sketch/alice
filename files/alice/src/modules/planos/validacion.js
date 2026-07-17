// Reglas duras de la planta — se validan en vivo (2D y, por construcción, 3D):
//  1. nada fuera del límite del terreno (ambientes ni muebles)
//  2. ningún mueble sin piso (todo mueble cae dentro de un ambiente)
//  3. flujos efectivos (todo ambiente alcanzable desde el ingreso/circulación)
import { pointInPolygon, distToSegment } from "./geometry.js";

const esAbertura = (ref = "") => /puerta|ventana|vano/.test(ref);

// distancia mínima de un punto al borde de un polígono
function distToPoly(p, poly) {
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) d = Math.min(d, distToSegment(p, poly[i], poly[(i + 1) % poly.length]));
  return d;
}
// dentro del polígono con tolerancia de borde: tocar el límite (medianera) NO es estar fuera
const TOL = 0.06;
const inside = (p, poly) => pointInPolygon(p, poly) || distToPoly(p, poly) <= TOL;
// un punto está FUERA solo si está fuera Y a más de TOL del borde
const afuera = (p, poly) => !pointInPolygon(p, poly) && distToPoly(p, poly) > TOL;
const algunoAfuera = (pts, poly) => pts.some((p) => afuera(p, poly));
// dos ambientes son adyacentes si comparten (casi) un borde
function adyacentes(A, B, tol = 0.4) {
  return A.some((p) => distToPoly(p, B) < tol) || B.some((p) => distToPoly(p, A) < tol);
}

export function validarPlan({ rooms = [], items = [], limite = null }) {
  const fueraLote = [];   // { id, tipo, name }
  const sinPiso = [];     // { id }
  const aislados = [];    // { id, name }

  // regla 1 — nada fuera del terreno (tocar el límite en medianera no cuenta)
  if (limite && limite.length >= 3) {
    for (const r of rooms) if (algunoAfuera(r.pts, limite)) fueraLote.push({ id: r.id, tipo: "ambiente", name: r.name });
    for (const t of items) if (afuera({ x: t.x, y: t.y }, limite)) fueraLote.push({ id: t.id, tipo: "mueble", name: t.ref });
  }

  // regla 2 — ningún mueble sin piso (las aberturas viven en el muro, se excluyen)
  for (const t of items) {
    if (esAbertura(t.ref)) continue;
    if (!rooms.some((r) => inside({ x: t.x, y: t.y }, r.pts))) sinPiso.push({ id: t.id, name: t.ref });
  }

  // regla 3 — flujos efectivos: reachability desde ingreso/circulación
  if (rooms.length) {
    const adj = rooms.map(() => []);
    for (let i = 0; i < rooms.length; i++)
      for (let j = i + 1; j < rooms.length; j++)
        if (adyacentes(rooms[i].pts, rooms[j].pts)) { adj[i].push(j); adj[j].push(i); }

    // semillas: circulación (pasillo/core), o ambiente que toca una puerta
    let seeds = rooms.map((r, i) => i).filter((i) => rooms[i].tipo === "pasillo" || rooms[i].tipo === "core");
    if (!seeds.length) {
      seeds = rooms.map((r, i) => i).filter((i) =>
        items.some((t) => /puerta/.test(t.ref || "") && distToPoly({ x: t.x, y: t.y }, rooms[i].pts) < 1.2));
    }
    if (!seeds.length) seeds = [0]; // sin circulación ni puertas: el primero es el ingreso

    const seen = new Set(seeds), q = [...seeds];
    while (q.length) { const i = q.shift(); for (const j of adj[i]) if (!seen.has(j)) { seen.add(j); q.push(j); } }
    rooms.forEach((r, i) => { if (!seen.has(i) && r.tipo !== "core") aislados.push({ id: r.id, name: r.name }); });
  }

  const total = fueraLote.length + sinPiso.length + aislados.length;
  const ids = new Set([...fueraLote, ...sinPiso, ...aislados].map((v) => v.id));
  const mensajes = [];
  if (fueraLote.length) mensajes.push(`${fueraLote.length} fuera del terreno`);
  if (sinPiso.length) mensajes.push(`${sinPiso.length} mueble${sinPiso.length > 1 ? "s" : ""} sin piso`);
  if (aislados.length) mensajes.push(`${aislados.length} ambiente${aislados.length > 1 ? "s" : ""} sin acceso`);

  return { fueraLote, sinPiso, aislados, total, ok: total === 0, ids, mensajes };
}
