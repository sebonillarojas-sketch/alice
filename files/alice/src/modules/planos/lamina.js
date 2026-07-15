// exporta el plano como una LÁMINA BAM — membrete calcado de las láminas reales del
// estudio (ref: FDC_2026-07-13_AA_PLANTAS): columna derecha con filas apiladas
// Proyecto / Ubicación / Cliente / Observaciones / Prof. Responsable (+C.A.P.) /
// Desarrollo / Plano / Escala / Fecha / Norte / Lámina, con puntos de registro
// en las esquinas de cada fila. Plano en una tinta; vegetación y anotaciones en morado BAM.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { area, centroid, bbox } from "./geometry.js";
import { Simbolo } from "./simbolos.jsx";
import { bamLogoMarkup, BAM_PERI } from "./marca.jsx";

const INK = "#373737", SOFT = "#9B998F", LINE = "#C9C6BF", PAPER = "#FFFFFF";
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// estilo de plano BAM: ambientes en blanco, solo el core en poché oscuro
const fillOf = (r) => (r.tipo === "core" ? "#4A4A4A" : PAPER);

// texto multilínea sencillo (parte por \n)
function tspans(x, value, dy = 13) {
  return String(value ?? "").split("\n").map((ln, i) =>
    `<tspan x="${x}" dy="${i === 0 ? 0 : dy}">${esc(ln)}</tspan>`).join("");
}

// puntos de registro en las 4 esquinas de una caja (como en las láminas reales)
function dots(x, y, w, h) {
  const r = 1.6;
  return [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]
    .map(([cx, cy]) => `<rect x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" fill="${INK}"/>`).join("");
}

/**
 * @param plan  { rooms, items, muro }
 * @param ficha { proyecto, tipo, ubicacion, cliente, observaciones, responsable, cap,
 *                desarrollo, plano, escala, fecha, lamina }
 */
export function laminaSVG(plan, ficha = {}) {
  const { rooms = [], items = [], muro = 0.15 } = plan;
  const W = 1600, H = 1100, MG = 22, BLK = 250; // hoja + membrete
  const f = {
    proyecto: "Proyecto", tipo: "Edificio Multifamiliar", ubicacion: "—", cliente: "—",
    observaciones: "", responsable: "", cap: "", desarrollo: "", plano: "Planta de distribución",
    escala: "1:75", fecha: new Date().toLocaleDateString("es-PE", { month: "long", year: "numeric" }),
    lamina: "A-01",
    ...ficha,
  };

  // área de dibujo
  const dx0 = MG, dy0 = MG + 78, dx1 = W - BLK - MG - 10, dy1 = H - MG;
  const dw = dx1 - dx0, dh = dy1 - dy0;

  const all = rooms.flatMap((r) => r.pts);
  let drawing = "";
  if (all.length) {
    const b = bbox(all);
    const wM = Math.max(b.maxX - b.minX, 1), hM = Math.max(b.maxY - b.minY, 1);
    const S = Math.min((dw - 60) / wM, (dh - 60) / hM);
    const ox = dx0 + (dw - wM * S) / 2 - b.minX * S;
    const oy = dy0 + (dh - hM * S) / 2 - b.minY * S;
    const T = (p) => `${(p.x * S + ox).toFixed(1)},${(p.y * S + oy).toFixed(1)}`;
    const roomsSvg = rooms.map((r) => {
      const c = centroid(r.pts), cx = (c.x * S + ox).toFixed(1), cy = (c.y * S + oy).toFixed(1);
      const dark = r.tipo === "core";
      const terraza = r.tipo === "terraza";
      const a = area(r.pts), small = a * S * S < 3600;
      const label = dark ? "" :
        `<text x="${cx}" y="${cy}" font-family="monospace" font-size="${small ? 9 : 11}" font-weight="700" fill="${BAM_PERI}" text-anchor="middle" paint-order="stroke" stroke="#fff" stroke-width="2.6">${esc(r.name)}${small ? "" : `<tspan x="${cx}" dy="12" font-size="9" font-weight="400" fill="${BAM_PERI}" stroke="#fff" stroke-width="2.6">${a.toFixed(1)} m²</tspan>`}</text>`;
      const stroke = terraza
        ? `stroke="${INK}" stroke-width="1" stroke-dasharray="5 4"`
        : `stroke="${INK}" stroke-width="${Math.max(muro * S, 1.4).toFixed(1)}"`;
      return `<polygon points="${r.pts.map(T).join(" ")}" fill="${fillOf(r)}" ${stroke} stroke-linejoin="miter"/>${label}`;
    }).join("");
    // símbolos reales del editor (mobiliario en tinta, vegetación en morado)
    const itemsSvg = items.map((t) => {
      const px = t.x * S + ox, py = t.y * S + oy;
      try {
        return renderToStaticMarkup(createElement(Simbolo, { it: t, px, py, k: S, selected: false }));
      } catch {
        return `<g transform="translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(${t.rot})"><rect x="${(-t.w / 2 * S).toFixed(1)}" y="${(-t.d / 2 * S).toFixed(1)}" width="${(t.w * S).toFixed(1)}" height="${(t.d * S).toFixed(1)}" fill="${PAPER}" stroke="${INK}" stroke-width="0.9"/></g>`;
      }
    }).join("");
    drawing = roomsSvg + itemsSvg;
  } else {
    drawing = `<text x="${dx0 + dw / 2}" y="${dy0 + dh / 2}" font-family="monospace" font-size="13" fill="${SOFT}" text-anchor="middle">sin plano — genera o dibuja antes de exportar</text>`;
  }

  // logo BAM (arriba-izquierda de la hoja) · viewBox 2000×674.79 → aspecto 2.964
  const logoW = 150, logoH = logoW / (2000 / 674.79);
  const logo = `<g transform="translate(${MG + 4} ${MG + 6}) scale(${(logoW / 2000).toFixed(5)})">${bamLogoMarkup(BAM_PERI)}</g>`;
  const subtitle = `<text x="${MG + 6}" y="${MG + logoH + 22}" font-family="monospace" font-size="10" fill="${SOFT}">${esc(f.proyecto)} · ${esc(f.plano)}</text>`;

  // ── membrete lateral (columna única, calcada de la lámina de referencia) ──
  const bx = W - BLK - MG, bw = BLK, by = MG, bh = H - 2 * MG;
  const label = (x, y, txt) => `<text x="${x + 8}" y="${y + 14}" font-family="Helvetica, Arial, sans-serif" font-size="8.5" fill="${SOFT}">${esc(txt)}:</text>`;
  let ry = by;
  let out = "";
  const row = (h, inner) => {
    out += `<line x1="${bx}" y1="${ry + h}" x2="${bx + bw}" y2="${ry + h}" stroke="${INK}" stroke-width="0.8"/>`;
    out += inner(bx, ry, bw, h);
    out += dots(bx, ry, bw, h);
    ry += h;
  };

  // logo pequeño arriba del membrete (como la referencia: marca sobre la columna)
  const logoTopH = 44;
  row(logoTopH, (x, y, w2) =>
    `<g transform="translate(${x + w2 - 86} ${y + 12}) scale(0.037)">${bamLogoMarkup(INK)}</g>`);

  // Proyecto — tipo chico + nombre grande
  row(118, (x, y) =>
    label(x, y, "Proyecto") +
    `<text x="${x + 8}" y="${y + 44}" font-family="Helvetica, Arial, sans-serif" font-size="9.5" fill="${INK}">${esc(f.tipo)}</text>` +
    `<text x="${x + 8}" y="${y + 68}" font-family="Helvetica, Arial, sans-serif" font-size="17" font-weight="700" fill="${INK}">${tspans(x + 8, f.proyecto, 21)}</text>`);
  // Ubicación
  row(64, (x, y) =>
    label(x, y, "Ubicación") +
    `<text x="${x + 8}" y="${y + 34}" font-family="Helvetica, Arial, sans-serif" font-size="9.5" fill="${INK}">${tspans(x + 8, f.ubicacion)}</text>`);
  // Cliente
  row(46, (x, y) =>
    label(x, y, "Cliente") +
    `<text x="${x + 8}" y="${y + 32}" font-family="Helvetica, Arial, sans-serif" font-size="9.5" fill="${INK}">${esc(f.cliente)}</text>`);
  // Observaciones (caja alta, suele ir vacía)
  row(120, (x, y) =>
    label(x, y, "Observaciones") +
    `<text x="${x + 8}" y="${y + 32}" font-family="Helvetica, Arial, sans-serif" font-size="9" fill="${INK}">${tspans(x + 8, f.observaciones, 12)}</text>`);
  // Profesional Responsable (+ C.A.P. al pie, como la referencia)
  row(104, (x, y, w2, h2) =>
    label(x, y, "Profesional Responsable") +
    `<text x="${x + 8}" y="${y + 44}" font-family="Helvetica, Arial, sans-serif" font-size="10" fill="${INK}">${tspans(x + 8, f.responsable)}</text>` +
    (f.cap ? `<text x="${x + 8}" y="${y + h2 - 10}" font-family="Helvetica, Arial, sans-serif" font-size="8.5" fill="${INK}">C.A.P. ${esc(f.cap)}</text>` : ""));
  // Desarrollo
  row(58, (x, y) =>
    label(x, y, "Desarrollo") +
    `<text x="${x + 8}" y="${y + 32}" font-family="Helvetica, Arial, sans-serif" font-size="9.5" fill="${INK}">${tspans(x + 8, f.desarrollo)}</text>`);
  // Plano
  row(58, (x, y) =>
    label(x, y, "Plano") +
    `<text x="${x + 8}" y="${y + 32}" font-family="Helvetica, Arial, sans-serif" font-size="9.5" fill="${INK}">${tspans(x + 8, f.plano)}</text>`);
  // Escala · Fecha (filas angostas apiladas, como la referencia)
  row(40, (x, y) =>
    label(x, y, "Escala") +
    `<text x="${x + 8}" y="${y + 32}" font-family="monospace" font-size="13" font-weight="700" fill="${INK}">${esc(f.escala)}</text>`);
  row(40, (x, y) =>
    label(x, y, "Fecha") +
    `<text x="${x + 8}" y="${y + 32}" font-family="Helvetica, Arial, sans-serif" font-size="10" fill="${INK}">${esc(f.fecha)}</text>`);
  // Norte (brújula circular con aguja, N afuera)
  row(78, (x, y, w2, h2) =>
    label(x, y, "Norte") +
    `<g transform="translate(${x + w2 / 2} ${y + h2 / 2 + 8})">
      <circle r="22" fill="none" stroke="${INK}" stroke-width="1"/>
      <line x1="-14" y1="14" x2="16" y2="-16" stroke="${INK}" stroke-width="1"/>
      <path d="M16 -16 L8 -13 L13 -8 Z" fill="${INK}"/>
      <text x="26" y="-20" font-family="Helvetica, Arial, sans-serif" font-size="10" fill="${INK}">N</text>
    </g>`);
  // Lámina (número grande, ocupa lo que queda)
  const lamH = by + bh - ry;
  row(lamH, (x, y, w2, h2) =>
    label(x, y, "Lámina") +
    `<text x="${x + w2 / 2}" y="${y + h2 / 2 + 14}" font-family="Helvetica, Arial, sans-serif" font-size="34" font-weight="700" fill="${INK}" text-anchor="middle">${esc(f.lamina)}</text>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="Helvetica, Arial, sans-serif">
  <rect width="${W}" height="${H}" fill="${PAPER}"/>
  <rect x="${MG - 6}" y="${MG - 6}" width="${W - 2 * (MG - 6)}" height="${H - 2 * (MG - 6)}" fill="none" stroke="${INK}" stroke-width="1.4"/>
  ${logo}${subtitle}
  ${drawing}
  <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="${PAPER}" stroke="${INK}" stroke-width="1.1"/>
  ${out}
</svg>`;
}
