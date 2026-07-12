import { useState, useRef, useCallback } from "react";

// ─── brand ───────────────────────────────────────────────────
const C = {
  ink: "#0A0B0F", inkSoft: "#2E2E33", muted: "#6B6863",
  bg: "#EEEBE3", paper: "#F4F1EA", line: "#D9D5CD", lineSoft: "#E5E1D6",
  cobalt: "#3D52D5", ochre: "#C2A45A", green: "#5F8A6A", brick: "#A85B5B",
  orange: "#F7643B",
};
const sans = "DM Sans, Helvetica Neue, sans-serif";
const mono = "JetBrains Mono, SF Mono, Menlo, monospace";

// ─── BAM logo SVG ─────────────────────────────────────────────
function BamLogo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="2" fill={C.ink} />
      <text x="5" y="28" fontFamily={sans} fontWeight="800" fontSize="16" fill="#EEEBE3" letterSpacing="-0.5">BAM</text>
    </svg>
  );
}

// ─── district data (subset for PDF export) ───────────────────
const DIST = {
  "Miraflores":  { base: 3.5, priceRange: [3200, 6500], nse: "A",    trend: "estable" },
  "San Isidro":  { base: 2.5, priceRange: [4500, 8000], nse: "A",    trend: "estable" },
  "Barranco":    { base: 2.5, priceRange: [2800, 5000], nse: "A/B+", trend: "trending" },
  "La Molina":   { base: 4.5, priceRange: [2800, 4500], nse: "A/B",  trend: "estable" },
  "Surco":       { base: 6.0, priceRange: [2200, 3800], nse: "B+",   trend: "creciente" },
  "Jesús María": { base: 7.5, priceRange: [1800, 3000], nse: "B",    trend: "creciente" },
  "Magdalena":   { base: 5.5, priceRange: [2000, 3200], nse: "B",    trend: "creciente" },
  "San Borja":   { base: 4.0, priceRange: [2800, 4200], nse: "A/B",  trend: "estable" },
  "Pueblo Libre":{ base: 5.0, priceRange: [1800, 2800], nse: "B",    trend: "creciente" },
  "San Miguel":  { base: 6.5, priceRange: [1600, 2600], nse: "B",    trend: "creciente" },
  "Lince":       { base: 8.0, priceRange: [1500, 2400], nse: "C+",   trend: "dinámico" },
  "Chorrillos":  { base: 5.0, priceRange: [1800, 3200], nse: "B/C+", trend: "creciente" },
};

// ─── cabida quick-compute for PDF ─────────────────────────────
function computeCabida(areaM2) {
  const t = areaM2 || 500;
  const huella = t * 0.65;
  const torre = huella * 8;
  const azTech = huella * 0.30;
  const brutaSR = torre + azTech;
  const vendible = brutaSR * 0.88;
  const dptos = Math.floor(vendible / 90);
  const estVend = Math.ceil(dptos * 0.2 * 1 + dptos * 0.8 * 2);
  const estTotal = Math.ceil(estVend * 1.10);
  const sotanos = Math.ceil(estTotal * 30 / t) * t;
  const construidaTotal = brutaSR + sotanos;
  return { vendible: Math.round(vendible), dptos, estVend, construidaTotal: Math.round(construidaTotal), sotanos: Math.round(sotanos) };
}

// ─── AI call ─────────────────────────────────────────────────
async function callAlicia(prompt) {
  try {
    const res = await fetch("http://localhost:3001/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
    }).catch(() => null);
    if (res?.ok) {
      const d = await res.json();
      return d.content || d.message || d.choices?.[0]?.message?.content || "";
    }
  } catch (_) {}
  const k = localStorage.getItem("alicia_api_key");
  if (!k) return null;
  const r2 = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": k, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: "claude-opus-4-8", max_tokens: 1200, messages: [{ role: "user", content: prompt }] }),
  });
  const d2 = await r2.json();
  return d2.content?.[0]?.text || "";
}

// ─── PDF generator ───────────────────────────────────────────
function generatePDF(terreno, proposal) {
  const d = DIST[terreno.district] || DIST["Miraflores"];
  const cab = computeCabida(terreno.areaM2);
  const fmt = (n) => Math.round(n).toLocaleString("en-US");

  const rendersHtml = (proposal.renders || []).map(r =>
    `<img src="${r}" style="width:100%;height:220px;object-fit:cover;border-radius:2px;display:block;" />`
  ).join("");

  const rendersSection = proposal.renders?.length
    ? `<div style="display:grid;grid-template-columns:${proposal.renders.length === 1 ? "1fr" : "1fr 1fr"};gap:12px;margin-bottom:24px;">${rendersHtml}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Propuesta ${terreno.name} · Hygge BAM</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', Helvetica Neue, sans-serif; color: #0A0B0F; background: #fff; }
  @media print {
    .no-print { display: none !important; }
    .page-break { page-break-before: always; }
  }

  /* PORTADA */
  .cover { background: #0A0B0F; color: #EEEBE3; min-height: 100vh; display: flex; flex-direction: column; justify-content: flex-end; padding: 64px; position: relative; }
  .cover-eyebrow { font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: #6B6863; margin-bottom: 16px; }
  .cover-title { font-size: 52px; font-weight: 800; letter-spacing: -0.03em; line-height: 1.05; margin-bottom: 8px; }
  .cover-sub { font-size: 18px; color: #6B6863; margin-bottom: 48px; }
  .cover-meta { display: flex; gap: 48px; border-top: 1px solid #2E2E33; padding-top: 32px; }
  .cover-meta-item label { font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; color: #6B6863; display: block; margin-bottom: 4px; }
  .cover-meta-item span { font-size: 15px; font-weight: 600; }
  .bam-badge { position: absolute; top: 64px; right: 64px; background: #F7643B; color: #fff; font-size: 11px; font-weight: 800; letter-spacing: 0.06em; padding: 6px 12px; border-radius: 2px; }

  /* SECCIONES */
  .section { padding: 64px; border-bottom: 1px solid #E5E1D6; }
  .section-eyebrow { font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: #6B6863; margin-bottom: 6px; }
  .section-title { font-size: 24px; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 32px; color: #0A0B0F; }

  /* GRID MÉTRICAS */
  .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: #E5E1D6; border: 1px solid #E5E1D6; margin-bottom: 32px; }
  .metric { background: #fff; padding: 20px 24px; }
  .metric-label { font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; color: #6B6863; margin-bottom: 6px; }
  .metric-value { font-size: 22px; font-weight: 700; color: #0A0B0F; }
  .metric-unit { font-size: 11px; font-weight: 400; color: #6B6863; }

  /* TABLE */
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  tr { border-bottom: 1px solid #E5E1D6; }
  td { padding: 10px 0; }
  td:last-child { text-align: right; font-weight: 600; }
  .strong td { font-weight: 700; border-bottom: 1px solid #0A0B0F; }

  /* PROPOSAL */
  .proposal-body { font-size: 14px; line-height: 1.8; color: #2E2E33; white-space: pre-wrap; }
  .proposal-body h2 { font-size: 16px; font-weight: 700; margin: 24px 0 8px; color: #0A0B0F; }
  .proposal-body p { margin-bottom: 12px; }

  /* FOOTER */
  .footer { padding: 32px 64px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #6B6863; }

  /* PRINT BTN */
  .print-btn { position: fixed; bottom: 32px; right: 32px; background: #0A0B0F; color: #EEEBE3; border: none; padding: 12px 24px; font-family: inherit; font-size: 13px; font-weight: 600; border-radius: 2px; cursor: pointer; z-index: 999; }
  .print-btn:hover { background: #3D52D5; }
</style>
</head>
<body>

<!-- PORTADA -->
<div class="cover">
  <div class="bam-badge">BAM · HYGGE</div>
  <div class="cover-eyebrow">Propuesta de desarrollo inmobiliario</div>
  <h1 class="cover-title">${terreno.name}</h1>
  <div class="cover-sub">${terreno.address || ""} · ${terreno.district || ""}, Lima</div>
  <div class="cover-meta">
    <div class="cover-meta-item"><label>Área terreno</label><span>${terreno.areaM2 ? terreno.areaM2 + " m²" : "—"}</span></div>
    <div class="cover-meta-item"><label>Distrito</label><span>${terreno.district || "—"}</span></div>
    <div class="cover-meta-item"><label>NSE objetivo</label><span>${d.nse}</span></div>
    <div class="cover-meta-item"><label>Score Hygge</label><span>${terreno.score || "—"} / 100</span></div>
    <div class="cover-meta-item"><label>Tipología</label><span>${proposal.tipologia || "Departamentos"}</span></div>
  </div>
</div>

<!-- 01 DETALLES DEL TERRENO -->
<div class="section">
  <div class="section-eyebrow">01</div>
  <h2 class="section-title">Detalles del terreno</h2>
  <table>
    <tr><td>Dirección</td><td>${terreno.address || "—"}</td></tr>
    <tr><td>Distrito</td><td>${terreno.district || "—"}</td></tr>
    <tr><td>Área total</td><td>${terreno.areaM2 ? terreno.areaM2 + " m²" : "—"}</td></tr>
    <tr><td>Estado pipeline</td><td>${terreno.status || "—"}</td></tr>
    <tr><td>Score Hygge</td><td>${terreno.score || "—"} / 100</td></tr>
    ${terreno.valuationM ? `<tr><td>Valuación estimada</td><td>USD ${terreno.valuationM}M</td></tr>` : ""}
    ${terreno.notas ? `<tr><td>Notas</td><td>${terreno.notas}</td></tr>` : ""}
  </table>
</div>

<!-- 02 ANÁLISIS DE MERCADO -->
<div class="section page-break">
  <div class="section-eyebrow">02</div>
  <h2 class="section-title">Análisis de mercado · ${terreno.district}</h2>
  <div class="metrics">
    <div class="metric"><div class="metric-label">Absorción sector</div><div class="metric-value">${d.base} <span class="metric-unit">u/mes</span></div></div>
    <div class="metric"><div class="metric-label">Precio/m² rango</div><div class="metric-value">$${(d.priceRange[0]/1000).toFixed(1)}k–${(d.priceRange[1]/1000).toFixed(1)}k</div></div>
    <div class="metric"><div class="metric-label">NSE objetivo</div><div class="metric-value">${d.nse}</div></div>
    <div class="metric"><div class="metric-label">Tendencia</div><div class="metric-value" style="text-transform:capitalize">${d.trend}</div></div>
    <div class="metric"><div class="metric-label">Score terreno</div><div class="metric-value">${terreno.score || "—"}<span class="metric-unit"> / 100</span></div></div>
    <div class="metric"><div class="metric-label">Precio mid mercado</div><div class="metric-value">$${fmt((d.priceRange[0]+d.priceRange[1])/2)}<span class="metric-unit"> /m²</span></div></div>
  </div>
</div>

<!-- 03 CABIDA PRELIMINAR -->
<div class="section">
  <div class="section-eyebrow">03</div>
  <h2 class="section-title">Cabida preliminar</h2>
  <p style="font-size:11px;color:#6B6863;margin-bottom:24px;">Cálculo con parámetros estándar BAM: 8 pisos · 35% área libre · 12% circulación · 90m² promedio/dpto</p>
  <table>
    <tr><td>Área vendible estimada</td><td>${fmt(cab.vendible)} m²</td></tr>
    <tr><td>Área construida total (incl. sótanos)</td><td>${fmt(cab.construidaTotal)} m²</td></tr>
    <tr class="strong"><td>Departamentos</td><td>${cab.dptos} unids</td></tr>
    <tr><td>Estacionamientos vendibles</td><td>${cab.estVend} unids</td></tr>
    <tr><td>Construida sótanos</td><td>${fmt(cab.sotanos)} m²</td></tr>
  </table>
  <p style="font-size:10px;color:#9B998F;margin-top:16px;">* Estimación preliminar sujeta a verificación normativa municipal y levantamiento topográfico.</p>
</div>

<!-- 04 PROPUESTA BAM -->
${proposal.enabled ? `
<div class="section page-break">
  <div class="section-eyebrow">04</div>
  <h2 class="section-title">Propuesta BAM · ${proposal.tipologia || "Departamentos"}</h2>
  ${rendersSection}
  ${proposal.descripcion ? `<p style="font-size:14px;line-height:1.8;color:#2E2E33;margin-bottom:24px;">${proposal.descripcion}</p>` : ""}
  ${proposal.narrative ? `<div class="proposal-body">${proposal.narrative.replace(/\n/g, "<br>")}</div>` : ""}
</div>
` : ""}

<!-- FOOTER -->
<div class="footer">
  <span>Hygge Holding · BAM Arquitectura · Confidencial</span>
  <span>Reporte generado por ALICE · ${new Date().toLocaleDateString("es-PE", { year: "numeric", month: "long", day: "numeric" })}</span>
</div>

<button class="print-btn no-print" onclick="window.print()">Imprimir / Guardar PDF</button>
</body>
</html>`;
}

// ─── main component ───────────────────────────────────────────
export default function PropuestaBamTab({ terreno, onUpdate }) {
  const proposal = terreno.bamProposal || {};
  const save = (patch) => onUpdate(terreno.id, { bamProposal: { ...proposal, ...patch } });

  const [loading, setLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const imgRef = useRef(null);

  // toggle enabled
  const enabled = !!proposal.enabled;

  // image upload → base64
  const handleImages = useCallback((e) => {
    const files = [...(e.target.files || [])];
    const existing = proposal.renders || [];
    const remaining = 4 - existing.length;
    files.slice(0, remaining).forEach(f => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        save({ renders: [...(proposal.renders || []), ev.target.result] });
      };
      reader.readAsDataURL(f);
    });
    e.target.value = "";
  }, [proposal]);

  const removeRender = (idx) => {
    const r = [...(proposal.renders || [])];
    r.splice(idx, 1);
    save({ renders: r });
  };

  // AI narrative
  const generateNarrative = async () => {
    setLoading(true);
    setAiError(null);
    const d = DIST[terreno.district] || DIST["Miraflores"];
    const cab = computeCabida(terreno.areaM2);
    const prompt = `Sos Alicia, asistente de Hygge Holding (desarrollador inmobiliario peruano). Generá una propuesta ejecutiva concisa para este proyecto, en español, tono profesional y editorial. Máximo 350 palabras. Usa saltos de línea para separar secciones. Incluí: concepto del proyecto, propuesta de valor diferencial, NSE y perfil del comprador, breve estrategia comercial.

Datos del proyecto:
- Terreno: ${terreno.name} · ${terreno.address || ""} · ${terreno.district}, Lima
- Área: ${terreno.areaM2 || "?"} m²
- Tipología propuesta: ${proposal.tipologia || "Departamentos"}
- Descripción del equipo: ${proposal.descripcion || "(sin descripción)"}
- Cabida preliminar: ${cab.dptos} dptos · ${Math.round(cab.vendible)} m² vendibles
- Mercado: absorción ${d.base} u/mes · precio rango $${d.priceRange[0].toLocaleString()}–$${d.priceRange[1].toLocaleString()}/m² · tendencia ${d.trend} · NSE ${d.nse}
- Score Hygge: ${terreno.score || "?"}/100

Generá SOLO el texto de la propuesta, sin encabezados markdown, sin asteriscos.`;

    const text = await callAlicia(prompt);
    setLoading(false);
    if (!text) { setAiError("No se pudo conectar con Alicia. Configurá la API key en Ajustes."); return; }
    save({ narrative: text });
  };

  // PDF export
  const exportPDF = () => {
    const html = generatePDF(terreno, { ...proposal, enabled: true });
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `propuesta-${(terreno.name || "terreno").toLowerCase().replace(/\s+/g, "-")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── UI ──────────────────────────────────────────────────────
  const Label = ({ children }) => (
    <div style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, marginBottom: 6 }}>
      {children}
    </div>
  );

  const inputStyle = {
    width: "100%", padding: "8px 10px", fontSize: 13, fontFamily: sans,
    border: `1px solid ${C.line}`, borderRadius: 2, background: C.paper,
    color: C.ink, outline: "none",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── toggle header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: C.paper, border: `1px solid ${C.line}`, borderRadius: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <BamLogo size={30} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>Propuesta BAM</div>
            <div style={{ fontSize: 11, color: C.muted }}>Desarrollado por BAM · Hygge Holding</div>
          </div>
        </div>
        <button
          onClick={() => save({ enabled: !enabled })}
          style={{
            padding: "6px 14px", fontSize: 11, fontWeight: 600, fontFamily: sans,
            background: enabled ? C.ink : "transparent",
            color: enabled ? "#EEEBE3" : C.muted,
            border: `1px solid ${enabled ? C.ink : C.line}`,
            borderRadius: 2, cursor: "pointer", transition: "all 0.15s",
          }}
        >
          {enabled ? "Activada" : "Activar propuesta"}
        </button>
      </div>

      {!enabled ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: C.muted, fontSize: 13 }}>
          Activá la propuesta BAM para agregar renders, tipología y descripción del proyecto.
        </div>
      ) : (
        <>
          {/* ── renders ── */}
          <div>
            <Label>Renders · hasta 4 imágenes</Label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 8 }}>
              {(proposal.renders || []).map((src, i) => (
                <div key={i} style={{ position: "relative", borderRadius: 2, overflow: "hidden" }}>
                  <img src={src} alt={`Render ${i + 1}`} style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }} />
                  <button
                    onClick={() => removeRender(i)}
                    style={{ position: "absolute", top: 6, right: 6, background: "rgba(10,11,15,0.7)", color: "#fff", border: "none", borderRadius: 2, width: 22, height: 22, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}
                  >×</button>
                </div>
              ))}
              {(proposal.renders || []).length < 4 && (
                <button
                  onClick={() => imgRef.current?.click()}
                  style={{ height: 160, border: `1px dashed ${C.line}`, borderRadius: 2, background: C.paper, color: C.muted, fontSize: 12, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  <span style={{ fontSize: 22 }}>+</span>
                  <span>Agregar render</span>
                </button>
              )}
            </div>
            <input ref={imgRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleImages} />
          </div>

          {/* ── tipología ── */}
          <div>
            <Label>Tipología del proyecto</Label>
            <select
              value={proposal.tipologia || "Departamentos"}
              onChange={e => save({ tipologia: e.target.value })}
              style={inputStyle}
            >
              {["Departamentos", "Flat premium", "Mix tipologías", "Penthouse + dptos", "Oficinas boutique", "Uso mixto residencial-comercial"].map(t => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* ── descripción ── */}
          <div>
            <Label>Descripción del proyecto · concepto e ideas clave</Label>
            <textarea
              value={proposal.descripcion || ""}
              onChange={e => save({ descripcion: e.target.value })}
              placeholder="Ej: Proyecto boutique de 8 pisos orientado a familias jóvenes NSE A. Lobby doble altura, amenities en azotea, cocina integrada, paleta neutra con detalles en madera natural..."
              rows={4}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
            />
          </div>

          {/* ── AI generate ── */}
          <div>
            <button
              onClick={generateNarrative}
              disabled={loading}
              style={{
                width: "100%", padding: "10px 16px", fontSize: 12, fontWeight: 600, fontFamily: sans,
                background: loading ? C.lineSoft : C.cobalt, color: loading ? C.muted : "#fff",
                border: "none", borderRadius: 2, cursor: loading ? "not-allowed" : "pointer", transition: "all 0.15s",
              }}
            >
              {loading ? "Alicia está redactando…" : "Ordenar propuesta con Alicia"}
            </button>
            {aiError && <div style={{ fontSize: 11, color: C.brick, marginTop: 6 }}>{aiError}</div>}
          </div>

          {/* ── narrative ── */}
          {proposal.narrative && (
            <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 2, padding: "16px 18px" }}>
              <div style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, marginBottom: 12 }}>
                Propuesta generada por Alicia
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.8, color: C.inkSoft, whiteSpace: "pre-wrap" }}>
                {proposal.narrative}
              </div>
              <button
                onClick={() => save({ narrative: "" })}
                style={{ marginTop: 10, fontSize: 11, color: C.muted, background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                Regenerar
              </button>
            </div>
          )}

          {/* ── export PDF ── */}
          <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 16 }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>
              El PDF incluye: Detalles · Análisis de mercado · Cabida preliminar · Propuesta BAM
            </div>
            <button
              onClick={exportPDF}
              style={{
                width: "100%", padding: "11px 16px", fontSize: 13, fontWeight: 700, fontFamily: sans,
                background: C.ink, color: "#EEEBE3",
                border: "none", borderRadius: 2, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              <span>↓</span> Exportar reporte completo PDF
            </button>
          </div>
        </>
      )}
    </div>
  );
}
