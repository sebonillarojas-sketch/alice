// Dibujo de una entrada del atlas. Puro: entra una entrada, sale SVG. Sin React, para que
// sirva igual en la Mesa, en una lámina exportada o en una hoja suelta de revisión.
//
// El dibujo no es decorativo: es la forma de auditar la lectura. Una tipología mal leída
// se ve mal de inmediato —ambientes solapados, un sobre que no cierra, un dormitorio sin
// fachada— y eso es más rápido que revisar el JSON.
import { PIDE_LUZ } from "./esquema.js";

const C = {
  ink: "#373737", soft: "#9B998F", line: "#E4E2DC", paper: "#EFEDE8", card: "#FFFFFF",
  azul: "#3D52D5", red: "#A85B5B",
};
// Relleno por tipo: la zonificación se lee de un vistazo, como en una lámina de verdad.
const FILL = {
  social: "#E8E4D8", intima: "#DCE3EC", servicio: "#E4E2DC",
  circulacion: "#F4F1EA", exterior: "#EDF1EA",
};

const r1 = (n) => Math.round(n * 10) / 10;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/**
 * @param entrada  una entrada del atlas ya validada
 * @param opts     { ancho: px del dibujo, margen: px }
 * @returns string  un <svg> completo
 */
export function dibujarEntrada(entrada = {}, { ancho = 300, margen = 26 } = {}) {
  const W = Number(entrada.sobre?.ancho) || 0;
  const D = Number(entrada.sobre?.fondo) || 0;
  if (!(W > 0) || !(D > 0)) {
    return `<svg width="${ancho}" height="90" xmlns="http://www.w3.org/2000/svg"><text x="10" y="30" font-size="11" fill="${C.red}" font-family="monospace">sobre inválido</text></svg>`;
  }
  const k = (ancho - margen * 2) / W;               // escala px por metro
  const alto = D * k + margen * 2;
  // y del SVG crece hacia abajo; el sobre tiene el origen abajo-izquierda
  const X = (x) => margen + x * k;
  const Y = (y) => margen + (D - y) * k;

  const p = [];
  p.push(`<svg width="${ancho}" height="${Math.round(alto)}" viewBox="0 0 ${ancho} ${Math.round(alto)}" xmlns="http://www.w3.org/2000/svg" font-family="'JetBrains Mono','SF Mono',Menlo,monospace">`);
  p.push(`<rect width="100%" height="100%" fill="${C.card}"/>`);

  // ambientes
  for (const a of entrada.ambientes || []) {
    const x = X(a.x), y = Y(a.y + a.h), w = a.w * k, h = a.h * k;
    const area = a.w * a.h;
    p.push(`<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" fill="${FILL[a.tipo] || C.paper}" stroke="${C.ink}" stroke-width="0.8"/>`);
    // rótulo solo si entra: un dibujo con texto encimado no se puede auditar
    if (w > 42 && h > 20) {
      p.push(`<text x="${r1(x + w / 2)}" y="${r1(y + h / 2 - 1)}" font-size="7" fill="${C.ink}" text-anchor="middle">${esc(a.nombre)}</text>`);
      p.push(`<text x="${r1(x + w / 2)}" y="${r1(y + h / 2 + 8)}" font-size="6.5" fill="${C.soft}" text-anchor="middle">${r1(area)} m²</text>`);
    }
  }

  // el sobre, por encima de los ambientes
  p.push(`<rect x="${r1(X(0))}" y="${r1(Y(D))}" width="${r1(W * k)}" height="${r1(D * k)}" fill="none" stroke="${C.ink}" stroke-width="2"/>`);

  // fachadas: trazo azul por fuera de la arista
  const aristaPts = {
    abajo: [[0, 0], [W, 0]], derecha: [[W, 0], [W, D]],
    arriba: [[0, D], [W, D]], izquierda: [[0, 0], [0, D]],
  };
  const off = { abajo: [0, 5], derecha: [5, 0], arriba: [0, -5], izquierda: [-5, 0] };
  for (const f of entrada.fachadas || []) {
    const seg = aristaPts[f]; if (!seg) continue;
    const [dx, dy] = off[f];
    p.push(`<line x1="${r1(X(seg[0][0]) + dx)}" y1="${r1(Y(seg[0][1]) + dy)}" x2="${r1(X(seg[1][0]) + dx)}" y2="${r1(Y(seg[1][1]) + dy)}" stroke="${C.azul}" stroke-width="2.5" stroke-linecap="round"/>`);
  }

  // entrada: triángulo apuntando adentro
  const e = entrada.entrada;
  if (e && aristaPts[e.arista]) {
    const seg = aristaPts[e.arista];
    const t = Math.max(0, Math.min(1, (Number(e.t) || 0) / (e.arista === "abajo" || e.arista === "arriba" ? W : D)));
    const px = X(seg[0][0] + (seg[1][0] - seg[0][0]) * t);
    const py = Y(seg[0][1] + (seg[1][1] - seg[0][1]) * t);
    const [dx, dy] = off[e.arista];
    const rot = { abajo: 270, arriba: 90, izquierda: 0, derecha: 180 }[e.arista];
    p.push(`<path d="M -5 -4 L 3 0 L -5 4 Z" fill="${C.red}" transform="translate(${r1(px + dx * 1.6)},${r1(py + dy * 1.6)}) rotate(${rot})"/>`);
  }

  p.push(`</svg>`);
  return p.join("");
}

/** Ambientes que piden luz y no tocan ninguna fachada — el defecto que más se ve dibujado. */
export function ambientesSinLuz(entrada = {}) {
  const W = Number(entrada.sobre?.ancho) || 0, D = Number(entrada.sobre?.fondo) || 0;
  const f = entrada.fachadas || [];
  return (entrada.ambientes || []).filter((a) => PIDE_LUZ.has(a.tipo) && !f.some((lado) =>
    (lado === "abajo" && a.y <= 0.1) || (lado === "arriba" && a.y + a.h >= D - 0.1)
    || (lado === "izquierda" && a.x <= 0.1) || (lado === "derecha" && a.x + a.w >= W - 0.1)
  )).map((a) => a.nombre);
}
