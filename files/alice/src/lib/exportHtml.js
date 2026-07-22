// exportHtml.js — descarga un documento HTML imprimible (mismo patrón que
// printDashboard() en HyggeOS.jsx): funciona en cualquier sandbox porque no
// depende de window.print()/window.open() directo — genera un archivo HTML
// que el usuario abre en su browser y desde ahí Cmd+P → Guardar como PDF.
export function downloadPrintableDocument({ title, subtitle, bodyHtml }) {
  const fullHTML = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  @page { margin: 16mm; }
  @media print {
    body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
  }
  * { box-sizing: border-box; }
  body { background: #EEEBE3; font-family: 'DM Sans', 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 28px; color: #0A0B0F; }
  .print-instructions { position: fixed; top: 16px; right: 16px; padding: 12px 16px; background: #1E2A4A; color: #fff; border-radius: 4px; font-size: 12px; max-width: 280px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); z-index: 9999; }
  .print-instructions button { background: #C2A45A; color: #0A0B0F; border: none; padding: 6px 12px; border-radius: 2px; font-size: 11px; font-weight: 600; cursor: pointer; margin-top: 8px; }
  .print-header { padding: 16px 0 24px; border-bottom: 1px solid #D9D5CD; margin-bottom: 24px; }
  .print-eyebrow { font-size: 10px; color: #6B6863; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 600; }
  .print-title { font-size: 24px; color: #0A0B0F; font-weight: 700; letter-spacing: -0.02em; margin-top: 4px; }
  .print-meta { font-size: 11px; color: #6B6863; margin-top: 6px; font-style: italic; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { padding: 6px 8px; text-align: left; border-bottom: 1px solid #E5E1D6; }
  th { color: #6B6863; font-weight: 600; font-size: 11px; }
  .card { background: #F4F1EA; border: 1px solid #D9D5CD; border-radius: 4px; padding: 18px 20px; margin-bottom: 16px; }
  .eyebrow { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: #6B6863; font-weight: 600; margin-bottom: 10px; }
</style>
</head>
<body>
<div class="print-instructions no-print">
  <div style="font-weight:600; margin-bottom:4px;">📄 Listo para imprimir</div>
  <div style="opacity:0.85; line-height:1.4; font-size:11px;">Presioná <strong>Cmd+P</strong> (Mac) o <strong>Ctrl+P</strong> (Windows). En "Destino" elegí <strong>"Guardar como PDF"</strong>.</div>
  <button onclick="window.print()">Imprimir ahora</button>
</div>
<div class="print-header">
  <div class="print-eyebrow">Hygge Holding · ${subtitle || "Documento"}</div>
  <div class="print-title">${title}</div>
  <div class="print-meta">Generado ${new Date().toLocaleString("es-PE", { dateStyle: "long", timeStyle: "short" })}</div>
</div>
${bodyHtml}
</body>
</html>`;

  const blob = new Blob([fullHTML], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/[\/\\?%*:|"<>]/g, "-")}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
