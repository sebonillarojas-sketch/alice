// sbs.js — tasas de crédito hipotecario por banco (SBS · autoridad oficial).
//
// Fuente: "Tasas de Interés por Tipo de Crédito y Empresa Bancaria" de la SBS.
//   https://www.sbs.gob.pe/app/pp/EstadisticasSAEEPortal/Paginas/TIActivaTipoCreditoEmpresa.aspx?tip=B
// La carga por defecto = promedio móvil de los últimos 30 días hábiles, con fecha
// automática. No hace falta postback ASPX para la fecha actual.
//
// Estructura (Telerik RadGrid con columna de etiquetas congelada):
//   - Dos grillas apiladas: rpgActualMn (Moneda Nacional / PEN) y rpgActualMe (USD).
//   - Bancos = <th class="rpgColumnHeader"> en orden (21 columnas, la última "Promedio").
//   - Cada tipo de crédito es una fila; "Préstamos hipotecarios para vivienda" es la
//     ÚLTIMA fila de datos de cada grilla. Celdas: tasa TEA, "-" (no ofrece) o "s.i.".
//
// Verificado contra captura real (24/07/2026): BBVA 7.67/6.92, BCP 7.85/6.80,
// Scotiabank 7.75/6.46, promedio del sistema 7.82/6.80.

import { renderFetch } from "./render.js";

const SBS_URL =
  "https://www.sbs.gob.pe/app/pp/EstadisticasSAEEPortal/Paginas/TIActivaTipoCreditoEmpresa.aspx?tip=B";

// Nombre SBS → nombre canónico usado en el ERP (financiamiento.js).
const BANK_ALIASES = {
  "Crédito": "BCP",
  "Bancom": "Banco de Comercio",
  "BIF": "BanBif",
  "Santander Cons. Bank": "Santander Consumer",
  "Bank of China": "Bank of China",
};

function stripTags(s) {
  return s.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();
}

// Extrae, de una región de HTML correspondiente a UNA grilla de moneda, los nombres
// de banco (headers) y la fila de datos del hipotecario (última fila de tasas).
function parseGrid(region) {
  const banks = [...region.matchAll(/<th[^>]*class="[^"]*rpgColumnHeader[^"]*"[^>]*>([\s\S]*?)<\/th>/gi)]
    .map((m) => stripTags(m[1]))
    .filter(Boolean);
  const trs = region.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  const dataRows = [];
  for (const tr of trs) {
    const cells = [...tr.matchAll(/<td[^>]*class="[^"]*rpgDataCell[^"]*"[^>]*>([\s\S]*?)<\/td>/gi)]
      .map((m) => stripTags(m[1]));
    // Una fila de tasas: ≥15 celdas y TODAS con forma de tasa / vacío.
    if (cells.length >= 15 && cells.every((c) => /^(s\.i\.|-|\d{1,2}\.\d{2})$/.test(c))) {
      dataRows.push(cells);
    }
  }
  return { banks, hipo: dataRows.at(-1) || null };
}

// Parsea el HTML completo de la página SBS → filas para bank_rates.
export function parseSBS(html) {
  const penStart = html.indexOf("rpgActualMn");
  const meStart = html.indexOf("rpgActualMe");
  if (penStart < 0 || meStart < 0 || meStart <= penStart) {
    throw new Error("SBS: no se hallaron las grillas rpgActualMn/rpgActualMe (¿cambió el layout o vino un shell sin render?)");
  }
  const mn = parseGrid(html.slice(penStart, meStart));            // PEN
  const me = parseGrid(html.slice(meStart, meStart + 300000));    // USD
  if (!mn.hipo || !mn.banks.length) throw new Error("SBS: no se pudo extraer la fila hipotecaria PEN");

  const val = (cell) => (cell && /^\d/.test(cell) ? parseFloat(cell) : null);
  const rows = [];
  mn.banks.forEach((rawBank, i) => {
    if (/^promedio$/i.test(rawBank)) return; // el promedio se guarda aparte, no como "banco"
    const bank = BANK_ALIASES[rawBank] || rawBank;
    const rate_pen = val(mn.hipo[i]);
    const rate_usd = me.hipo ? val(me.banks.indexOf(rawBank) >= 0 ? me.hipo[me.banks.indexOf(rawBank)] : me.hipo[i]) : null;
    if (rate_pen == null && rate_usd == null) return; // el banco no ofrece hipotecario
    rows.push({ bank, product: "hipotecario", rate_pen, rate_usd, plazo: 20, source: "sbs" });
  });

  // Promedio del sistema → guardado como fila "Promedio SBS" (referencia).
  const pIdx = mn.banks.findIndex((b) => /^promedio$/i.test(b));
  if (pIdx >= 0) {
    rows.push({
      bank: "Promedio SBS",
      product: "hipotecario",
      rate_pen: val(mn.hipo[pIdx]),
      rate_usd: me.hipo ? val(me.hipo[pIdx]) : null,
      plazo: 20,
      source: "sbs",
    });
  }
  return rows;
}

// Baja la página (con render JS) y devuelve las tasas hipotecarias por banco.
export async function scrapeSBSMortgageRates() {
  const html = await renderFetch(SBS_URL, { premiumProxy: false, wait: 1500 });
  const rows = parseSBS(html);
  console.log(`🐰 SBS: ${rows.length} tasas hipotecarias por banco`);
  return rows;
}
