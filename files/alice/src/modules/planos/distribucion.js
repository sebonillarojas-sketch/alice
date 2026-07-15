// generador de distribuciones de departamento, fundado en reglas de proyecto.
// parti: franja húmeda apilada en un muro de instalaciones (cocina+baños), social al frente
// con luz, dormitorios al fondo con luz, hall distribuidor. dimensiones mínimas por RNE/Neufert.

import { porId } from "./mobiliario.js";
import { HOLGURA, AMBIENTE, programa, camaPara } from "./reglas.js";

let _n = 1;
const rid = () => `g${_n++}_${Math.random().toString(36).slice(2, 6)}`;
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const round = (n) => +n.toFixed(3);
const rect = (x, y, w, h) => [{ x: round(x), y: round(y) }, { x: round(x + w), y: round(y) }, { x: round(x + w), y: round(y + h) }, { x: round(x), y: round(y + h) }];
const room = (name, tipo, x, y, w, h) => ({ id: rid(), name, tipo, pts: rect(x, y, w, h), _box: { x, y, w, h } });
const it = (ref, x, y, rot = 0, over = {}) => {
  const c = porId[ref] || { w: 1, d: 1 };
  return { id: rid(), ref, x: round(x), y: round(y), rot, w: over.w ?? c.w, d: over.d ?? c.d };
};

// ── amueblado por ambiente (holguras reales) ───────────────
// convención: y=0 fachada frente (calle) · y=D fachada fondo (patio) · muro húmedo en x=0

function amoblarDorm(R, principal, puertaLado /* 'hall-abajo'|'hall-arriba' */, ventanaLado /* 'frente'|'fondo' */) {
  const out = [];
  const key = principal ? "dormPrincipal" : "dormitorio";
  const bedRef = camaPara(key, R.w);
  const bed = porId[bedRef];
  // cabecera contra el muro sin ventana ni puerta
  const headAbajo = ventanaLado === "frente"; // ventana al frente → cabecera al fondo
  const bedCy = headAbajo ? R.y + R.h - bed.d / 2 - 0.08 : R.y + bed.d / 2 + 0.08;
  const bedCx = R.x + R.w / 2;
  if (R.h >= bed.d + HOLGURA.paseCama + 0.3) {
    out.push(it(bedRef, bedCx, bedCy, headAbajo ? 0 : 180));
    const vel = porId.velador;
    const vy = headAbajo ? R.y + R.h - vel.d / 2 - 0.08 : R.y + vel.d / 2 + 0.08;
    if (bedCx - bed.w / 2 - vel.w > R.x + 0.05) out.push(it("velador", bedCx - bed.w / 2 - vel.w / 2 - 0.04, vy, 0));
    if (bedCx + bed.w / 2 + vel.w < R.x + R.w - 0.05) out.push(it("velador", bedCx + bed.w / 2 + vel.w / 2 + 0.04, vy, 0));
  }
  // clóset en el muro opuesto a la ventana, corriendo el ancho
  const clw = Math.min(1.8, R.w - 0.4);
  if (clw >= 0.9) {
    const cy = headAbajo ? R.y + 0.31 : R.y + R.h - 0.31;
    out.push(it("closet", R.x + R.w / 2, cy, headAbajo ? 180 : 0, { w: clw }));
  }
  // puerta desde el hall
  const doorY = puertaLado === "hall-abajo" ? R.y + R.h : R.y;
  out.push(it("puerta-80", R.x + 0.5, doorY, puertaLado === "hall-abajo" ? 0 : 180));
  return out;
}

function amoblarBano(R, completo, puertaLado) {
  const out = [];
  // aparatos contra el muro húmedo x = R.x (izq)
  out.push(it("inodoro", R.x + 0.34, R.y + R.h - 0.4, -90));
  out.push(it("lavamanos", R.x + 0.28, R.y + 0.4, -90));
  if (completo && R.w >= 1.4 && R.h >= 1.8) out.push(it("ducha", R.x + R.w - 0.47, R.y + R.h - 0.47, 0));
  else if (completo) out.push(it("ducha", R.x + R.w - 0.47, R.y + 0.47, 0));
  const doorY = puertaLado === "hall-abajo" ? R.y + R.h : R.y;
  out.push(it("puerta-70", R.x + R.w - 0.5, doorY, puertaLado === "hall-abajo" ? 0 : 180));
  return out;
}

function amoblarCocina(R) {
  const out = [];
  // counter en L: muro húmedo (x=R.x) + muro fachada (y=R.y)
  const runV = Math.min(R.h - 0.3, 2.6);
  out.push(it("counter", R.x + 0.31, R.y + 0.12 + runV / 2, 90, { w: runV }));
  const runH = Math.min(R.w - 0.7, 1.6);
  if (runH >= 1.0) out.push(it("counter", R.x + 0.66 + runH / 2, R.y + 0.31, 0, { w: runH }));
  out.push(it("refri", R.x + R.w - 0.42, R.y + R.h - 0.42, 180));
  return out;
}

function amoblarSocial(R, kitchenAtY) {
  const out = [];
  // living hacia la fachada (y pequeña), comedor hacia la cocina (y grande)
  const cx = R.x + R.w / 2;
  out.push(it("rack-tv", cx, R.y + 0.3, 0));
  const sofaRef = R.w >= 3.2 ? "sofa-3c" : "sofa-2c";
  const sofaY = R.y + Math.min(2.7, R.h * 0.42);
  out.push(it(sofaRef, cx, sofaY, 180));
  out.push(it("mesa-centro", cx, sofaY - 1.05, 0));
  // comedor cerca del fondo del social (junto a cocina)
  const dinRef = R.w >= 3.4 ? "comedor-6" : "comedor-4";
  const dinY = R.y + R.h - 1.2;
  if (R.h - sofaY > 2.4) out.push(it(dinRef, cx, dinY, 0));
  return out;
}

// ventana centrada en un borde de fachada
function ventana(R, lado /* 'frente'|'fondo' */, W) {
  const ref = R.w >= 2.7 ? "ventana-180" : "ventana-120";
  return lado === "frente" ? it(ref, R.x + R.w / 2, 0, 0) : it(ref, R.x + R.w / 2, W, 180);
}

// ── layout de una unidad ───────────────────────────────────
// dev = { W (frente), D (fondo), swap (bool: social atrás) }
function layout(W, D, nd, nb, opts = {}) {
  const warns = [];
  const rooms = [], items = [];
  const prog = programa(nd, nb);

  const wWet = clamp(W * 0.32, 2.2, 2.6);      // franja húmeda (cocina+baños)
  const wLiv = W - wWet;                         // franja habitable
  if (wLiv < 3.0) return null;

  const hall = HOLGURA.corredorMin + 0.1;       // ~1.0
  let dP = clamp(D * 0.32, 2.9, 3.9);           // profundidad dormitorios
  let dS = D - hall - dP;                        // social
  if (dS < 3.4) { dS = 3.4; dP = D - hall - dS; }
  if (dP < 2.8 || dS < 3.4) return null;

  // franja habitable (x: wWet..W)
  const lx = wWet;
  // social al frente (y 0..dS) — a menos que swap
  const socY = opts.swap ? D - dS : 0;
  const dormY = opts.swap ? 0 : D - dP;
  const hallY = opts.swap ? dP : dS;
  const socVent = opts.swap ? "fondo" : "frente";
  const dormVent = opts.swap ? "frente" : "fondo";

  const social = room("sala-comedor", "social", lx, socY, wLiv, dS);
  rooms.push(social);
  items.push(...amoblarSocial(social._box));
  items.push(ventana(social._box, socVent, socVent === "frente" ? 0 : D));

  // hall distribuidor
  rooms.push(room("hall", "pasillo", lx, hallY, wLiv, hall));

  // dormitorios al fondo, repartidos en el ancho habitable
  const anchos = nd === 1 ? [wLiv]
    : nd === 2 ? [wLiv * 0.54, wLiv * 0.46]
      : [wLiv * 0.38, wLiv * 0.31, wLiv * 0.31];
  let dx = lx;
  const puertaDorm = opts.swap ? "hall-abajo" : "hall-arriba";
  anchos.forEach((w, i) => {
    const key = i === 0 ? "dormPrincipal" : (nd >= 3 && i === 2 ? "dormitorio" : "dormitorio");
    const min = AMBIENTE[key].wMin;
    if (w < min - 0.05) warns.push(`${AMBIENTE[key].nombre} ${w.toFixed(2)}m < mín ${min}m`);
    const R = room(i === 0 ? "dormitorio ppal" : `dormitorio ${i + 1}`, "dormitorio", dx, dormY, w, dP);
    rooms.push(R);
    items.push(...amoblarDorm(R._box, i === 0, puertaDorm, dormVent));
    items.push(ventana(R._box, dormVent, dormVent === "frente" ? 0 : D));
    dx += w;
  });

  // franja húmeda (x 0..wWet): cocina al frente del social + baños/lavandería apilados
  const kitAtSocFront = !opts.swap; // cocina junto al social
  const kdY = kitAtSocFront ? socY : socY + dS - clamp(dS * 0.5, 2.4, 3.0);
  const dK = clamp(dS * 0.52, 2.4, 3.0);
  const cocY = kitAtSocFront ? socY : socY;
  const cocina = room("cocina", "cocina", 0, cocY, wWet, dK);
  rooms.push(cocina);
  items.push(...amoblarCocina(cocina._box));
  if (!opts.swap) items.push(it(cocina._box.w >= 1.6 ? "ventana-120" : "ventana-120", wWet / 2, 0, 0));

  // baños + lavandería en el resto de la franja húmeda (interiores, acceso desde hall)
  const banoY = clamp(hallY - 0.5, dK, D - 2.0);
  const bano = room("baño", "baño", 0, banoY, wWet, 2.0);
  rooms.push(bano);
  items.push(...amoblarBano(bano._box, true, opts.swap ? "hall-arriba" : "hall-abajo"));

  if (nb >= 2) {
    const b2y = clamp(banoY + 2.05, dK, D - 1.9);
    if (b2y + 1.9 <= D + 0.01 && b2y >= dK) {
      const bano2 = room("baño 2", "baño", 0, b2y, wWet, Math.min(1.9, D - b2y));
      rooms.push(bano2);
      items.push(...amoblarBano(bano2._box, true, "hall-arriba"));
    } else warns.push("2º baño no entró en la franja húmeda");
  }
  if (nd >= 2) {
    const ly = dK - 0; // lavandería entre cocina y baño si hay hueco
    const gap0 = dK, gap1 = banoY;
    if (gap1 - gap0 >= 1.3) {
      rooms.push(room("lavandería", "servicio", 0, gap0, wWet, gap1 - gap0));
    }
  }

  // ingreso: puerta al hall desde el core (lado del muro húmedo)
  items.push(it("puerta-90", lx + 0.6, hallY + hall / 2 - hall / 2, 0, { d: 0.14 }));

  const areaTotal = W * D;
  return { rooms, items, warns, W, D, areaTotal };
}

function variante(nombre, notaBase, W, D, nd, nb, opts) {
  const L = layout(W, D, nd, nb, opts);
  if (!L) return null;
  return {
    id: rid(), nombre,
    nota: [notaBase, ...L.warns].filter(Boolean),
    rooms: L.rooms.map(({ _box, ...r }) => r),
    items: L.items,
  };
}

export function generarDistribuciones(brief) {
  const nd = clamp(Math.round(brief.dormitorios || 2), 1, 3);
  const nb = clamp(Math.round(brief.banos || 1), 1, 3);
  const frente = Math.max(brief.frente || 6, 3);
  const area = Math.max(brief.area || 60, 24);
  const D = +(area / frente).toFixed(2);

  const vs = [
    variante("social al frente", "social a fachada · dormitorios al fondo con luz · núcleo húmedo en un muro", frente, D, nd, nb, { swap: false }),
    variante("social al fondo", "social hacia el patio · dormitorios a la calle", frente, D, nd, nb, { swap: true }),
  ].filter(Boolean);

  // espejo de la primera
  if (vs[0]) {
    const v = vs[0];
    vs.push({
      id: rid(), nombre: `${v.nombre} · espejo`, nota: v.nota,
      rooms: v.rooms.map((r) => ({ ...r, id: rid(), pts: r.pts.map((p) => ({ x: round(frente - p.x), y: p.y })) })),
      items: v.items.map((t) => ({ ...t, id: rid(), x: round(frente - t.x), rot: (360 - t.rot) % 360 })),
    });
  }

  if (!vs.length) {
    vs.push({
      id: rid(), nombre: "fuera de rango",
      nota: [`frente ${frente}m × fondo ${D}m no admite una distribución con ${nd} dorm. — ajusta proporción`],
      rooms: [room("depto", "social", 0, 0, frente, D)].map(({ _box, ...r }) => r),
      items: [],
    });
  }
  return vs.slice(0, 4);
}
