// Conversión de hojas de cálculo (.xlsx/.xls/.xlsm) a CSV, para que el dashboard
// de Finanzas —que solo parsea CSV/TSV— pueda leer Excel directo desde Dropbox.
import * as XLSX from "xlsx";

export function isSpreadsheet(name) {
  return /\.(xlsx|xls|xlsm)$/i.test(name || "");
}

// Devuelve { csv, sheet, sheets } a partir del Buffer de un Excel.
// - sheetName (opcional): fuerza una hoja específica por nombre.
// - por defecto elige la PRIMERA hoja VISIBLE (ignora las ocultas, que suelen ser
//   borradores/insumos), y si no hay ninguna visible cae a la primera hoja.
export function spreadsheetBufferToCsv(buffer, sheetName) {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const meta = (wb.Workbook && wb.Workbook.Sheets) || [];
  const isHidden = (name) => {
    const m = meta.find((s) => s.name === name);
    return !!(m && (m.Hidden === 1 || m.Hidden === 2));
  };
  const visible = wb.SheetNames.filter((n) => !isHidden(n));
  const target =
    sheetName && wb.SheetNames.includes(sheetName)
      ? sheetName
      : visible[0] || wb.SheetNames[0];
  const ws = wb.Sheets[target];
  const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false, strip: true });
  return { csv, sheet: target, sheets: visible.length ? visible : wb.SheetNames };
}
