// generador de distribuciones de departamento, fundado en reglas de proyecto.
// parti: franja húmeda apilada en un muro de instalaciones (cocina+baños), social al frente
// con luz, dormitorios al fondo con luz, hall distribuidor. dimensiones mínimas por RNE/Neufert.

import { porId, NSE } from "./mobiliario.js";
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

// ── dormitorio VIVIBLE ────────────────────────────────────────
// la puerta y la ventana están en muros opuestos (puerta al hall, ventana a fachada).
// cabecera contra el muro LATERAL más lejano de la puerta (nunca contra la puerta ni
// tapando la ventana) → entras y tienes paso libre a lo largo de la cama.
// veladores en la cabecera · closet junto a la puerta FUERA de su barrido ·
// escritorio bajo la ventana en el espacio que deja la cama.
function amoblarDorm(R, principal, puertaLado /* 'hall-abajo'|'hall-arriba' */, ventanaLado, nse = "C", doorX = null) {
  const out = [];
  const key = principal ? "dormPrincipal" : "dormitorio";
  let bedRef = camaPara(key, R.w);
  // el NSE puede subir la cama principal (king/queen) si el ancho lo permite
  if (principal) {
    const up = (NSE[nse] || NSE.C).camaPpal;
    if (porId[up] && R.w >= porId[up].d + 1.3) bedRef = up;
  }
  const bed = porId[bedRef];
  const doorAbajo = puertaLado === "hall-abajo";
  const doorWallY = doorAbajo ? R.y + R.h : R.y;         // muro de la puerta
  const winWallY = doorAbajo ? R.y : R.y + R.h;          // muro de la ventana (opuesto)
  const dx = doorX ?? R.x + 0.5;
  // cabecera al muro lateral MÁS LEJANO de la puerta
  const headIzq = dx > R.x + R.w / 2;
  // la cama rotada 90°: largo (bed.d) corre en X desde la cabecera, ancho (bed.w) en Y
  const bedCx = headIzq ? R.x + bed.d / 2 + 0.04 : R.x + R.w - bed.d / 2 - 0.04;
  // centrada en la franja libre que deja el closet (0.65 junto al muro de la puerta)
  const libre0 = doorAbajo ? R.y : R.y + 0.65;
  const libre1 = doorAbajo ? R.y + R.h - 0.65 : R.y + R.h;
  const bedCy = (libre0 + libre1) / 2;
  const cabe = bed.d + 0.1 <= R.w && bed.w + 0.5 <= (libre1 - libre0);
  if (cabe) {
    out.push(it(bedRef, bedCx, bedCy, headIzq ? 270 : 90));
    // veladores en la cabecera, a ambos lados de la cama si caben
    const vel = porId.velador;
    const vx = headIzq ? R.x + vel.d / 2 + 0.05 : R.x + R.w - vel.d / 2 - 0.05;
    if (bedCy - bed.w / 2 - vel.w / 2 - 0.04 > libre0 + 0.05)
      out.push(it("velador", vx, bedCy - bed.w / 2 - vel.w / 2 - 0.04, headIzq ? 270 : 90));
    if (bedCy + bed.w / 2 + vel.w / 2 + 0.04 < libre1 - 0.05)
      out.push(it("velador", vx, bedCy + bed.w / 2 + vel.w / 2 + 0.04, headIzq ? 270 : 90));
  } else if (bed.d + 0.1 <= R.h && bed.w + 0.4 <= R.w) {
    // cuarto más profundo que ancho: cama clásica, cabecera al muro de la ventana
    const cy2 = doorAbajo ? R.y + bed.d / 2 + 0.06 : R.y + R.h - bed.d / 2 - 0.06;
    out.push(it(bedRef, R.x + R.w / 2, cy2, doorAbajo ? 180 : 0));
  }
  // closet en el muro de la puerta, del lado de la cabecera, FUERA del barrido (0.85)
  const cl0 = headIzq ? R.x + 0.08 : dx + 0.85;
  const cl1 = headIzq ? dx - 0.85 : R.x + R.w - 0.08;
  const clw = Math.min(1.8, cl1 - cl0);
  if (clw >= 0.8) {
    const ccy = doorAbajo ? R.y + R.h - 0.31 : R.y + 0.31;
    out.push(it("closet", (cl0 + cl1) / 2, ccy, doorAbajo ? 0 : 180, { w: clw }));
  }
  // escritorio bajo la ventana, en el espacio libre a los pies de la cama
  const freeX = R.w - bed.d - 0.15;
  if (cabe && freeX >= 1.3 && R.h >= 3.0) {
    const ex = headIzq ? R.x + bed.d + 0.1 + freeX / 2 : R.x + freeX / 2 + 0.05;
    const ecy = doorAbajo ? R.y + 0.32 : R.y + R.h - 0.32;
    out.push(it("escritorio", ex, ecy, doorAbajo ? 180 : 0, { w: Math.min(1.2, freeX - 0.1) }));
  }
  // puerta desde el hall
  out.push(it("puerta-80", dx, doorWallY, doorAbajo ? 0 : 180));
  return out;
}

// ── baño VIVIBLE ──────────────────────────────────────────────
// door = { wall: 'left'|'right'|'top'|'bottom' } — el muro que da al hall.
// secuencia real de uso: entras → lavatorio inmediato → inodoro → ducha al fondo
// (franja completa en el muro opuesto a la puerta). nada dentro del barrido (0.75).
function amoblarBano(R, completo, door = { wall: "top" }) {
  const out = [];
  const w = R.w, h = R.h;
  // ejes según el muro de la puerta: "profundidad" = perpendicular a la puerta
  const horizontal = door.wall === "top" || door.wall === "bottom";
  // posición de la puerta: pegada a una esquina (0.45 del muro lateral)
  let dxp, dyp, rot;
  if (door.wall === "top") { dxp = R.x + 0.45; dyp = R.y; rot = 180; }
  else if (door.wall === "bottom") { dxp = R.x + 0.45; dyp = R.y + h; rot = 0; }
  else if (door.wall === "left") { dxp = R.x; dyp = R.y + h - 0.45; rot = 90; }
  else { dxp = R.x + w; dyp = R.y + h - 0.45; rot = 270; }
  out.push(it("puerta-70", dxp, dyp, rot));

  if (horizontal) {
    const far = door.wall === "top" ? R.y + h : R.y;           // muro opuesto (ducha)
    const sgn = door.wall === "top" ? 1 : -1;
    // ducha: franja completa al fondo
    if (completo && h >= 1.9) out.push(it("ducha", R.x + w / 2, far - sgn * 0.45, 0, { w: w - 0.12, d: 0.85 }));
    else if (completo) out.push(it("ducha", R.x + w - 0.45, far - sgn * 0.42, 0, { w: 0.8, d: 0.8 }));
    // lavatorio junto a la puerta, en el muro lateral opuesto a ella
    out.push(it("lavamanos", R.x + w - 0.26, dyp + sgn * 0.42, 90));
    // inodoro al medio contra el muro húmedo (lejos del barrido de la puerta)
    out.push(it("inodoro", R.x + 0.36, R.y + h / 2 + (door.wall === "top" ? 0.1 : -0.1), -90));
  } else {
    const izq = door.wall === "left";
    // ducha: franja completa contra el muro y superior (lejos de la puerta, que va abajo)
    if (completo && w >= 1.9) out.push(it("ducha", R.x + w / 2, R.y + 0.45, 0, { w: w - 0.12, d: 0.85 }));
    else if (completo) out.push(it("ducha", izq ? R.x + w - 0.45 : R.x + 0.45, R.y + 0.45, 0, { w: 0.8, d: 0.8 }));
    // lavatorio apenas entras, contra el muro de abajo
    out.push(it("lavamanos", izq ? R.x + w - 0.28 : R.x + 0.28, R.y + h - 0.26, 0));
    // inodoro entre ducha y lavatorio, contra el muro lateral opuesto a la puerta
    out.push(it("inodoro", izq ? R.x + w - 0.36 : R.x + 0.36, R.y + h / 2 - 0.05, izq ? 90 : -90));
  }
  return out;
}

function amoblarCocina(R, nse = "C") {
  // UNA cocina paramétrica contra el muro húmedo (x=R.x): counter+lavadero+hornillas+refri.
  // el NSE decide largo, hornillas y refri (abierta/cerrada se decide a nivel de ambiente).
  const p = (NSE[nse] || NSE.C).cocina;
  const run = Math.min(R.h - 0.3, Math.max(p.w, 1.6));
  return [it("cocina", R.x + 0.31, R.y + 0.15 + run / 2, 90, { w: run, hornillas: p.hornillas, refriW: p.refriW })];
}

function amoblarSocial(R, nse = "C") {
  const out = [];
  // living hacia la fachada (y pequeña), comedor hacia la cocina (y grande)
  const cx = R.x + R.w / 2;
  out.push(it("rack-tv", cx, R.y + 0.3, 0));
  const sofaRef = R.w >= 3.2 ? "sofa-3c" : "sofa-2c";
  const sofaY = R.y + Math.min(2.7, R.h * 0.42);
  out.push(it(sofaRef, cx, sofaY, 180));
  out.push(it("mesa-centro", cx, sofaY - 1.05, 0));
  // sillón acompañante si el ancho lo permite (NSE A/B suma un segundo)
  if (R.w >= 3.6) out.push(it("sillon", R.x + R.w - 0.55, sofaY - 1.05, -90));
  if (R.w >= 4.4 && (nse === "A" || nse === "B")) out.push(it("sillon", R.x + 0.55, sofaY - 1.05, 90));
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
// dev = { W (frente), D (fondo), swap (bool: social atrás), nse }
export function layout(W, D, nd, nb, opts = {}) {
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

  // ¿el reparto de dormitorios sobre la franja habitable viola los mínimos?
  // unidad angosta-profunda (doble crujía limeña) → modo PROFUNDO: dormitorios al
  // fondo a TODO el ancho, baños junto a un hall de distribución (parti de referencia BAM).
  const anchosTest = nd === 1 ? [wLiv] : nd === 2 ? [wLiv * 0.54, wLiv * 0.46] : [wLiv * 0.38, wLiv * 0.31, wLiv * 0.31];
  const violaMin = anchosTest.some((w2, i) => w2 < (i === 0 ? AMBIENTE.dormPrincipal.wMin : 2.45) - 0.05);
  if (violaMin && nd >= 2) return layoutProfundo(W, D, nd, nb, opts);

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
  items.push(...amoblarSocial(social._box, opts.nse));
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
    items.push(...amoblarDorm(R._box, i === 0, puertaDorm, dormVent, opts.nse));
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
  items.push(...amoblarCocina(cocina._box, opts.nse));
  if (!opts.swap) items.push(it(cocina._box.w >= 1.6 ? "ventana-120" : "ventana-120", wWet / 2, 0, 0));

  // baños + lavandería en el resto de la franja húmeda (interiores, acceso desde hall)
  const banoY = clamp(hallY - 0.5, dK, D - 2.0);
  const bano = room("baño", "baño", 0, banoY, wWet, 2.0);
  rooms.push(bano);
  items.push(...amoblarBano(bano._box, true, { wall: "right" }));  // acceso desde el hall (franja habitable)

  if (nb >= 2) {
    const b2y = clamp(banoY + 2.05, dK, D - 1.9);
    if (b2y + 1.9 <= D + 0.01 && b2y >= dK) {
      const bano2 = room("baño 2", "baño", 0, b2y, wWet, Math.min(1.9, D - b2y));
      rooms.push(bano2);
      items.push(...amoblarBano(bano2._box, true, { wall: "right" }));
    } else warns.push("2º baño no entró en la franja húmeda");
  }
  // baño de visita (medio baño: inodoro + lavamanos, SIN ducha) cerca del social/ingreso,
  // en el hueco de la franja húmeda entre la cocina y el baño íntimo.
  let gapV = dK;
  if (opts.visita) {
    const vh = 1.5;
    if (banoY - dK >= vh - 0.05) {
      const vis = room("baño visita", "baño", 0, dK, wWet, vh);
      rooms.push(vis);
      items.push(...amoblarBano(vis._box, false, { wall: "right" }));  // completo=false → sin ducha
      gapV = dK + vh + 0.02;
    } else warns.push("el baño de visita no entró — recorte poco profundo");
  }

  if (nd >= 2) {
    const gap0 = gapV, gap1 = banoY; // lavandería entre visita/cocina y baño íntimo si hay hueco
    if (gap1 - gap0 >= 1.3) {
      const lav = room("lavandería", "servicio", 0, gap0, wWet, gap1 - gap0);
      rooms.push(lav);
      items.push(it("lavanderia", 0.34, gap0 + (gap1 - gap0) / 2, 90, { w: Math.min(1.2, gap1 - gap0 - 0.2) }));
    }
  }

  // ingreso: puerta al hall desde el core (lado del muro húmedo)
  items.push(it("puerta-90", lx + 0.6, hallY + hall / 2 - hall / 2, 0, { d: 0.14 }));

  const areaTotal = W * D;
  return { rooms, items, warns, W, D, areaTotal };
}

// ── layout SIMPLE (el caballito de batalla: SIEMPRE parte el bloque) ──
// parti de referencia BAM: DORMITORIOS a la fachada/pozo de luz (y=0) a todo el ancho,
// banda de servicio con baños + HALL DE DISTRIBUCIÓN al medio, social+cocina hacia
// el corredor de ingreso (y=D). convención: y=0 fachada · y=D ingreso.
// bandas PROPORCIONALES: se adaptan al bloque en vez de rendirse — si los dormitorios
// pedidos no caben en el ancho, baja la cantidad y lo avisa en las notas.
export function layoutProfundo(W, D, nd, nb, opts = {}) {
  const warns = [];
  const rooms = [], items = [];
  if (W < 4.2 || D < 5.4) return null;              // por debajo de esto: studio
  // ¿cuántos dormitorios caben de verdad en el ancho? (≥2.25 m cada uno)
  const ndMax = Math.max(1, Math.floor(W / 2.25));
  if (nd > ndMax) { warns.push(`${nd}D no cabe en ${W.toFixed(1)}m de frente → ${ndMax}D`); nd = ndMax; }
  const wWet = clamp(W * 0.34, 2.0, 2.6);
  const hs = clamp(D * 0.18, 1.7, 2.2);             // banda de servicio (baños + hall)
  let dP = clamp(D * 0.36, 2.6, 4.2);               // dormitorios (banda de fachada)
  let dS = D - hs - dP;                             // social + cocina (banda de ingreso)
  if (dS < 2.6) { dS = 2.6; dP = D - hs - dS; }
  if (dP < 2.3) return null;                        // bloque demasiado poco profundo → studio

  // banda fachada: dormitorios a TODO el ancho, ventanas al frente (pozo/fachada)
  const anchos = nd === 1 ? [W]
    : nd === 2 ? [W * 0.54, W * 0.46]
      : [W * 0.4, W * 0.3, W * 0.3];
  // baño 2 al extremo derecho de la banda servicio; hall al centro
  const hall0 = wWet, hall1 = nb >= 2 && W - wWet - 1.7 >= HOLGURA.corredorMin + 0.2 ? W - 1.7 : W;
  let dx = 0;
  anchos.forEach((w2, i) => {
    const min = i === 0 ? AMBIENTE.dormPrincipal.wMin : 2.4;
    if (w2 < min - 0.05) warns.push(`dormitorio ${w2.toFixed(2)}m < mín ${min}m`);
    const R = room(i === 0 ? "dormitorio ppal" : `dormitorio ${i + 1}`, "dormitorio", dx, 0, w2, dP);
    rooms.push(R);
    // puerta al hall central, alineada al tramo libre del hall
    const doorX = clamp((Math.max(dx, hall0) + Math.min(dx + w2, hall1)) / 2, dx + 0.45, dx + w2 - 0.45);
    items.push(...amoblarDorm(R._box, i === 0, "hall-abajo", "frente", opts.nse, doorX));
    items.push(ventana(R._box, "frente", 0));
    dx += w2;
  });

  // banda servicio: baño(s) con puerta HACIA el hall de distribución (muros laterales)
  const bano = room("baño", "baño", 0, dP, wWet, hs);
  rooms.push(bano);
  items.push(...amoblarBano(bano._box, true, { wall: "right" }));
  if (hall1 < W) {
    const b2 = room("baño 2", "baño", hall1, dP, W - hall1, hs);
    rooms.push(b2);
    items.push(...amoblarBano(b2._box, true, { wall: "left" }));
  } else if (nb >= 2) warns.push("2º baño no entró — hall mínimo");
  rooms.push(room("hall", "pasillo", hall0, dP, hall1 - hall0, hs));

  // banda ingreso: cocina (+lavandería) en la franja húmeda + social hacia el corredor
  const sy = dP + hs;
  const dK = clamp(dS * 0.55, 2.2, 3.0);
  const cocina = room("cocina", "cocina", 0, sy, wWet, dK);
  rooms.push(cocina);
  items.push(...amoblarCocina(cocina._box, opts.nse));
  if (dS - dK >= 1.2) {
    const lav = room("lavandería", "servicio", 0, sy + dK, wWet, dS - dK);
    rooms.push(lav);
    items.push(it("lavanderia", 0.34, sy + dK + (dS - dK) / 2, 90, { w: Math.min(1.2, dS - dK - 0.2) }));
  }
  const social = room("sala-comedor", "social", wWet, sy, W - wWet, dS);
  rooms.push(social);
  items.push(...amoblarSocial(social._box, opts.nse));
  // ingreso desde el corredor del edificio (y=D) directo al social
  items.push(it("puerta-90", clamp(wWet + 0.75, wWet + 0.55, W - 0.6), D, 0));

  return { rooms, items, warns, W, D, areaTotal: W * D };
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
