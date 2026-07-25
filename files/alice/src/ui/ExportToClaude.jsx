// ExportToClaude.jsx — barra para exportar un reporte markdown a Claude
// (copiar al clipboard · bajar .md · abrir claude.ai). Usada por los paneles de
// agentes y reportes del cockpit. Self-contained (sólo tokens + iconos).

import { useState } from "react";
import { Sparkles, Check, Copy, Download, ExternalLink } from "lucide-react";
import { C } from "./theme";

export function ExportToClaude({ markdown, filename }) {
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const copyMd = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      // Fallback for browsers that block clipboard
      const ta = document.createElement("textarea");
      ta.value = markdown;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); setCopied(true); setTimeout(() => setCopied(false), 2500); }
      catch (err) { alert("No pude copiar al clipboard · usá descargar .md"); }
      document.body.removeChild(ta);
    }
  };

  const downloadMd = () => {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2500);
  };

  const openClaude = () => window.open("https://claude.ai/new", "_blank", "noopener,noreferrer");

  return (
    <div className="py-3 px-4 flex items-center flex-wrap gap-2" style={{ backgroundColor: `${C.cobalt}08`, border: `1px solid ${C.cobalt}30`, borderRadius: 2 }}>
      <Sparkles size={13} style={{ color: C.cobalt, flexShrink: 0 }} />
      <div className="flex-1 min-w-[160px]">
        <div className="text-[11px]" style={{ color: C.ink, fontWeight: 600 }}>Exportar reporte a Claude</div>
        <div className="text-[10px]" style={{ color: C.muted }}>Markdown estructurado · pegalo en una conversación nueva</div>
      </div>
      <button onClick={copyMd} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] hover:opacity-90 flex-shrink-0" style={{ backgroundColor: C.ink, color: "white", borderRadius: 2, fontWeight: 500 }}>
        {copied ? <><Check size={10} /> Copiado</> : <><Copy size={10} /> Copiar</>}
      </button>
      <button onClick={downloadMd} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] hover:opacity-70 flex-shrink-0" style={{ color: C.muted, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
        {downloaded ? <><Check size={10} /> Bajado</> : <><Download size={10} /> .md</>}
      </button>
      <button onClick={openClaude} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] hover:opacity-70 flex-shrink-0" style={{ color: C.muted, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
        <ExternalLink size={10} /> Abrir Claude
      </button>
    </div>
  );
}
