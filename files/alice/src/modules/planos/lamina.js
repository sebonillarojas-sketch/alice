// exporta el plano como una LÁMINA BAM (membrete + logo al estilo de las láminas reales del estudio).
import { area, centroid, bbox } from "./geometry.js";
import { bamLogoMarkup, BAM_PERI } from "./marca.jsx";

const INK = "#373737", SOFT = "#9B998F", LINE = "#C9C6BF", PAPER = "#FFFFFF";
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const fillOf = (r, i) =>
  r.tipo === "core" ? "#4A4A4A"
    : r.tipo === "unidad" ? ({ "1D": "#D8E0F7", "2D": "#95ABE8", "3D": "#F7936F" }[r.subtipo] || "#D8E0F7")
      : ({ dormitorio: "#D8E0F7", social: "#F7D9CE", cocina: "#F3E7C9", "baño": "#D6ECEF", pasillo: "#EFEDE8", servicio: "#E7DDF2" }[r.tipo]
        || ["#D8E0F7", "#F7D9CE", "#DCEBDD", "#F3E7C9", "#E7DDF2", "#D6ECEF"][i % 6]);

// texto multilínea sencillo (parte por \n)
function tspans(x, value, dy = 15) {
  return String(value ?? "").split("\n").map((ln, i) =>
    `<tspan x="${x}" dy="${i === 0 ? 0 : dy}">${esc(ln)}</tspan>`).join("");
}

/**
 * @param plan  { rooms, items, muro }
 * @param ficha { proyecto, tipo, ubicacion, cliente, responsable, desarrollo, plano, escala, fecha, lamina }
 */
export function laminaSVG(plan, ficha = {}) {
  const { rooms = [], items = [], muro = 0.15 } = plan;
  const W = 1600, H = 1100, MG = 22, BLK = 300; // hoja + membrete
  const f = {
    proyecto: "Proyecto", tipo: "Edificio Multifamiliar", ubicacion: "—", cliente: "—",
    responsable: "", desarrollo: "", plano: "Planta de distribución", escala: "1:75",
    fecha: new Date().toLocaleDateString("es-PE", { month: "long", year: "numeric" }), lamina: "A-01",
    ...ficha,
  };

  // área de dibujo
  const dx0 = MG, dy0 = MG + 78, dx1 = W - BLK - MG, dy1 = H - MG;
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
    const roomsSvg = rooms.map((r, i) => {
      const c = centroid(r.pts), cx = (c.x * S + ox).toFixed(1), cy = (c.y * S + oy).toFixed(1);
      const dark = r.tipo === "core";
      const a = area(r.pts), small = a * S * S < 3600;
      const label = dark ? "" :
        `<text x="${cx}" y="${cy}" font-family="monospace" font-size="${small ? 9 : 11}" font-weight="700" fill="${INK}" text-anchor="middle" paint-order="stroke" stroke="#fff" stroke-width="2.6">${esc(r.name)}${small ? "" : `<tspan x="${cx}" dy="12" font-size="9" font-weight="400" fill="${SOFT}" stroke="#fff" stroke-width="2.6">${a.toFixed(1)} m²</tspan>`}</text>`;
      return `<polygon points="${r.pts.map(T).join(" ")}" fill="${fillOf(r, i)}" fill-opacity="0.9" stroke="${INK}" stroke-width="${Math.max(muro * S, 1.4).toFixed(1)}" stroke-linejoin="miter"/>${label}`;
    }).join("");
    const itemsSvg = items.map((t) => {
      const px = (t.x * S + ox).toFixed(1), py = (t.y * S + oy).toFixed(1);
      return `<g transform="translate(${px} ${py}) rotate(${t.rot})"><rect x="${(-t.w / 2 * S).toFixed(1)}" y="${(-t.d / 2 * S).toFixed(1)}" width="${(t.w * S).toFixed(1)}" height="${(t.d * S).toFixed(1)}" fill="#fff" fill-opacity="0.9" stroke="#4A4A4A" stroke-width="0.9"/></g>`;
    }).join("");
    drawing = roomsSvg + itemsSvg;
  } else {
    drawing = `<text x="${dx0 + dw / 2}" y="${dy0 + dh / 2}" font-family="monospace" font-size="13" fill="${SOFT}" text-anchor="middle">sin plano — genera o dibuja antes de exportar</text>`;
  }

  // logo BAM (arriba-izquierda) · viewBox 2000×674.79 → aspecto 2.964
  const logoW = 150, logoH = logoW / (2000 / 674.79);
  const logo = `<g transform="translate(${MG + 4} ${MG + 6}) scale(${(logoW / 2000).toFixed(5)})">${bamLogoMarkup(BAM_PERI)}</g>`;
  const subtitle = `<text x="${MG + 6}" y="${MG + logoH + 22}" font-family="monospace" font-size="10" fill="${SOFT}">${esc(f.proyecto)} · ${esc(f.plano)}</text>`;

  // membrete lateral
  const bx = W - BLK - MG + 8, bw = BLK - 8, by = MG, bh = H - 2 * MG;
  const rows = [
    { label: "Proyecto", value: `${f.tipo}\n${f.proyecto}`, big: true },
    { label: "Ubicación", value: f.ubicacion },
    { label: "Cliente", value: f.cliente },
    { label: "Profesional Responsable", value: f.responsable },
    { label: "Desarrollo", value: f.desarrollo },
    { label: "Plano", value: f.plano },
  ];
  let ry = by + 4;
  const rowH = 74;
  const membreteRows = rows.map((r) => {
    const block = `<g>
      <text x="${bx + 10}" y="${ry + 16}" font-family="Helvetica, Arial, sans-serif" font-size="9" fill="${SOFT}">${esc(r.label)}:</text>
      <text x="${bx + 10}" y="${ry + 34}" font-family="Helvetica, Arial, sans-serif" font-size="${r.big ? 17 : 12}" font-weight="${r.big ? 700 : 400}" fill="${INK}">${tspans(bx + 10, r.value, r.big ? 20 : 15)}</text>
      <line x1="${bx}" y1="${ry + rowH}" x2="${bx + bw}" y2="${ry + rowH}" stroke="${LINE}" stroke-width="1"/>
    </g>`;
    ry += rowH;
    return block;
  }).join("");

  // fila inferior: escala | fecha | norte | lámina
  const footY = ry;
  const colW = bw / 2;
  const footer = `
    <line x1="${bx + colW}" y1="${footY}" x2="${bx + colW}" y2="${by + bh}" stroke="${LINE}" stroke-width="1"/>
    <text x="${bx + 10}" y="${footY + 16}" font-family="Helvetica, Arial, sans-serif" font-size="9" fill="${SOFT}">Escala:</text>
    <text x="${bx + 10}" y="${footY + 36}" font-family="monospace" font-size="15" font-weight="700" fill="${INK}">${esc(f.escala)}</text>
    <text x="${bx + colW + 10}" y="${footY + 16}" font-family="Helvetica, Arial, sans-serif" font-size="9" fill="${SOFT}">Fecha:</text>
    <text x="${bx + colW + 10}" y="${footY + 36}" font-family="monospace" font-size="13" fill="${INK}">${esc(f.fecha)}</text>
    <line x1="${bx}" y1="${footY + 52}" x2="${bx + bw}" y2="${footY + 52}" stroke="${LINE}" stroke-width="1"/>
    <text x="${bx + 10}" y="${footY + 70}" font-family="Helvetica, Arial, sans-serif" font-size="9" fill="${SOFT}">Norte:</text>
    <g transform="translate(${bx + 44} ${footY + 108})">
      <circle r="26" fill="none" stroke="${INK}" stroke-width="1.2"/>
      <path d="M0 -26 L7 6 L0 -2 L-7 6 Z" fill="${INK}"/>
      <text x="0" y="-30" font-family="monospace" font-size="10" fill="${INK}" text-anchor="middle">N</text>
    </g>
    <text x="${bx + colW + 10}" y="${footY + 70}" font-family="Helvetica, Arial, sans-serif" font-size="9" fill="${SOFT}">Lámina:</text>
    <text x="${bx + colW + (bw / 2) / 2 + 6}" y="${footY + 120}" font-family="Helvetica, Arial, sans-serif" font-size="30" font-weight="700" fill="${INK}" text-anchor="middle">${esc(f.lamina)}</text>
  `;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="Helvetica, Arial, sans-serif">
  <rect width="${W}" height="${H}" fill="${PAPER}"/>
  <rect x="${MG - 6}" y="${MG - 6}" width="${W - 2 * (MG - 6)}" height="${H - 2 * (MG - 6)}" fill="none" stroke="${INK}" stroke-width="1.4"/>
  ${logo}${subtitle}
  <rect x="${dx0}" y="${dy0}" width="${dw}" height="${dh}" fill="#FBFAF8" stroke="${LINE}" stroke-width="1"/>
  ${drawing}
  <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="#FFFFFF" stroke="${INK}" stroke-width="1.2"/>
  <g transform="translate(${bx + bw - 96} ${by + 10}) scale(0.037)">${bamLogoMarkup(BAM_PERI)}</g>
  ${membreteRows}${footer}
</svg>`;
}
