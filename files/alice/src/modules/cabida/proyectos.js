// Proyectos de cabida — pestañas con nombre, compartidas ida y vuelta entre
// Cabida y el Editor de Planos. Local-first: lee/escribe localStorage al toque
// (instantáneo, offline) y sincroniza a Supabase en segundo plano, así el mismo
// proyecto está a la mano desde cualquier dispositivo (laptop, web).
//
// Un proyecto = { id, nombre, updatedAt, cabida:{...}, plano:{...} }
//   cabida → todo el estado de CabidaView (lote, retiros, mix, números)
//   plano  → todo el estado del Editor (rooms, items, muros, ficha…)
// Ambas vistas leen y escriben el MISMO proyecto activo → nada se borra al saltar.
import { useSyncExternalStore } from "react";
import { db } from "../../lib/supabase.js";

const K_PROY = "hygge:cabidaProyectos";       // array de proyectos (sincronizado)
const K_ACT = "hygge:cabidaProyectoActivo";   // id activo (local por dispositivo)
const LEGACY_CABIDA = "hygge:cabidaState";
const LEGACY_PLANO = "hygge:editorPlanos";

let _stamp = 0;
// reloj monótono para updatedAt aunque dos writes caigan en el mismo ms (last-write-wins estable)
const now = () => { const t = Date.now(); _stamp = t > _stamp ? t : _stamp + 1; return _stamp; };
const uid = () => `p_${now().toString(36)}_${Math.floor(Math.random() * 1e4).toString(36)}`;

const readLS = (k, fb) => { try { const r = localStorage.getItem(k); return r == null ? fb : JSON.parse(r); } catch { return fb; } };
const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* cuota */ } };

function migrar() {
  // arranque en máquina/usuario sin proyectos: sembrar uno con la data legacy si existe
  const legacyCab = readLS(LEGACY_CABIDA, null);
  const legacyPlano = readLS(LEGACY_PLANO, null);
  const plano = legacyPlano && (legacyPlano.rooms?.length || legacyPlano.items?.length)
    ? { rooms: legacyPlano.rooms || [], items: legacyPlano.items || [],
        muro: legacyPlano.muro, altura: legacyPlano.altura, lote: legacyPlano.lote,
        retiro: legacyPlano.retiro, frontIdx: legacyPlano.frontIdx, brief: legacyPlano.brief, ficha: legacyPlano.ficha }
    : {};
  return [{ id: uid(), nombre: "Proyecto 1", updatedAt: now(), cabida: legacyCab || {}, plano }];
}

// ── store en memoria (fuente de verdad de la sesión) ──────────────────────────
let _proyectos = readLS(K_PROY, null);
if (!Array.isArray(_proyectos) || !_proyectos.length) { _proyectos = migrar(); writeLS(K_PROY, _proyectos); }
let _activo = readLS(K_ACT, null);
if (!_proyectos.some((p) => p.id === _activo)) { _activo = _proyectos[0].id; writeLS(K_ACT, _activo); }

const listeners = new Set();
let _snap = { proyectos: _proyectos, activoId: _activo };
const emit = () => { _snap = { proyectos: _proyectos, activoId: _activo }; listeners.forEach((fn) => fn()); };

// ── sync a la nube (debounce, last-write-wins por proyecto vía updatedAt) ──────
let _pushT = null;
function pushCloud() {
  clearTimeout(_pushT);
  _pushT = setTimeout(() => { db.setState(K_PROY, _proyectos).catch(() => {}); }, 800);
}

function mergeRemote(remote) {
  if (!Array.isArray(remote)) return false;
  const byId = new Map(_proyectos.map((p) => [p.id, p]));
  let changed = false;
  for (const r of remote) {
    const l = byId.get(r.id);
    if (!l || (r.updatedAt || 0) > (l.updatedAt || 0)) { byId.set(r.id, r); changed = true; }
  }
  if (changed) {
    _proyectos = Array.from(byId.values()).sort((a, b) => (a.createdOrder || 0) - (b.createdOrder || 0));
    if (!_proyectos.some((p) => p.id === _activo)) _activo = _proyectos[0]?.id;
    writeLS(K_PROY, _proyectos);
  }
  return changed;
}

// hidratar desde Supabase al cargar (no bloquea: la UI ya mostró el caché local)
db.getState(K_PROY).then((remote) => {
  if (remote && mergeRemote(remote)) emit();
}).catch(() => { /* sin red/sesión → seguimos con el caché local */ });

// otra pestaña del mismo browser tocó el store → reflejarlo
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === K_PROY) { _proyectos = readLS(K_PROY, _proyectos); emit(); }
    if (e.key === K_ACT) { _activo = readLS(K_ACT, _activo); emit(); }
  });
}

function commit(next) {
  _proyectos = next;
  writeLS(K_PROY, _proyectos);
  pushCloud();
  emit();
}

// ── API pública ───────────────────────────────────────────────────────────────
export const proyectosStore = {
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  snapshot() { return _snap; },

  setActivo(id) {
    if (!_proyectos.some((p) => p.id === id)) return;
    _activo = id; writeLS(K_ACT, _activo); emit();
  },

  crear(nombre) {
    const id = uid();
    const nom = (nombre || "").trim() || `Proyecto ${_proyectos.length + 1}`;
    commit([..._proyectos, { id, nombre: nom, updatedAt: now(), createdOrder: now(), cabida: {}, plano: {} }]);
    _activo = id; writeLS(K_ACT, _activo); emit();
    return id;
  },

  duplicar(id) {
    const src = _proyectos.find((p) => p.id === id);
    if (!src) return null;
    const nid = uid();
    const copia = { ...structuredClone(src), id: nid, nombre: `${src.nombre} (copia)`, updatedAt: now(), createdOrder: now() };
    commit([..._proyectos, copia]);
    _activo = nid; writeLS(K_ACT, _activo); emit();
    return nid;
  },

  renombrar(id, nombre) {
    const nom = (nombre || "").trim();
    if (!nom) return;
    commit(_proyectos.map((p) => (p.id === id ? { ...p, nombre: nom, updatedAt: now() } : p)));
  },

  eliminar(id) {
    if (_proyectos.length <= 1) { // nunca dejar cero: se vacía en vez de borrar
      commit(_proyectos.map((p) => (p.id === id ? { ...p, cabida: {}, plano: {}, updatedAt: now() } : p)));
      return;
    }
    const next = _proyectos.filter((p) => p.id !== id);
    if (_activo === id) { _activo = next[0].id; writeLS(K_ACT, _activo); }
    commit(next);
  },

  // Growth es el parent: un terreno del pipeline abre SU proyecto (cabida+plano+mesa).
  // Si aún no existe, se crea con el nombre del terreno y el área sembrada en cabida.
  abrirParaTerreno(terreno) {
    if (!terreno?.id) return null;
    let p = _proyectos.find((x) => x.terrenoId === terreno.id);
    if (!p) {
      const id = uid();
      p = {
        id, terrenoId: terreno.id,
        nombre: (terreno.name || "").trim() || `Proyecto ${_proyectos.length + 1}`,
        updatedAt: now(), createdOrder: now(),
        cabida: terreno.areaM2 ? { terreno: terreno.areaM2 } : {},
        plano: {},
      };
      commit([..._proyectos, p]);
      // CabidaView y la Mesa todavía leen el estado legacy global: sembrar el
      // área del terreno ahí solo al crear (reabrir no pisa tus ajustes).
      if (terreno.areaM2) {
        const legacy = readLS(LEGACY_CABIDA, {}) || {};
        writeLS(LEGACY_CABIDA, { ...legacy, terreno: terreno.areaM2, frente: Math.round(Math.sqrt(terreno.areaM2 * 1.4)) });
      }
    }
    _activo = p.id; writeLS(K_ACT, _activo); emit();
    return p.id;
  },

  vincularTerreno(id, terrenoId) {
    commit(_proyectos.map((p) => (p.id === id ? { ...p, terrenoId, updatedAt: now() } : p)));
  },

  // guardar parcial del estado de cabida / del plano en un proyecto
  guardarCabida(id, cabida) {
    commit(_proyectos.map((p) => (p.id === id ? { ...p, cabida, updatedAt: now() } : p)));
  },
  guardarPlano(id, plano) {
    commit(_proyectos.map((p) => (p.id === id ? { ...p, plano, updatedAt: now() } : p)));
  },
};

// hook React: [{proyectos, activoId}, proyectoActivo]
export function useProyectos() {
  const snap = useSyncExternalStore(proyectosStore.subscribe, proyectosStore.snapshot, proyectosStore.snapshot);
  const activo = snap.proyectos.find((p) => p.id === snap.activoId) || snap.proyectos[0];
  return { proyectos: snap.proyectos, activoId: snap.activoId, activo, store: proyectosStore };
}
