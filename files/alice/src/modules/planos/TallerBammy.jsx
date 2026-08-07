// Taller de Bammy — el agente cuelga sus distribuciones y Sebastián las corrige
// DIBUJANDO encima (calcar) + notas. La corrección se guarda y Bammy la lee para aprender.
// Lienzo limpio, herramientas libres (estilo whiteboard). No reusa el editor pesado.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ALICIA_URL } from "../../lib/brain.js";

const C = { ink: "#0A0B0F", paper: "#F4F1EA", card: "#fff", line: "#d9d5cd", soft: "#6B6863", accent: "#1E2A4A" };

const TOOLS = [
  { id: "draw", label: "Lápiz", ico: "✏️" },
  { id: "line", label: "Línea", ico: "╱" },
  { id: "arrow", label: "Flecha", ico: "↗" },
  { id: "rect", label: "Rectángulo", ico: "▭" },
  { id: "ellipse", label: "Elipse", ico: "◯" },
  { id: "erase", label: "Goma", ico: "◇" },
];
const PENS = [
  { id: "pencil", label: "Lápiz", w: 2.2, opacity: 0.95 },
  { id: "marker", label: "Plumón", w: 5, opacity: 0.6 },
  { id: "fine", label: "Fino", w: 1.1, opacity: 1 },
  { id: "highlighter", label: "Resaltador", w: 16, opacity: 0.28 },
];
const COLORS = ["#F7643B", "#3D52D5", "#0A0B0F", "#5F8A6A", "#C2A45A", "#A85B5B", "#9BCBE3", "#A89BD9"];

const W = 900; // ancho lógico del lienzo (viewBox); el alto se deriva del aspecto del plano
let _tid = 0;
const tid = () => `t${++_tid}`;

// distancia punto→polilínea (para la goma)
function nearStroke(tr, x, y, thr) {
  const ps = tr.pts;
  for (let i = 0; i < ps.length - 1; i++) {
    const a = ps[i], b = ps[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const l2 = dx * dx + dy * dy || 1;
    let t = ((x - a.x) * dx + (y - a.y) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    const px = a.x + t * dx, py = a.y + t * dy;
    if (Math.hypot(x - px, y - py) <= thr) return true;
  }
  if (ps.length === 1) return Math.hypot(x - ps[0].x, y - ps[0].y) <= thr;
  return false;
}

function renderTrazo(tr) {
  const stroke = tr.color, sw = tr.w || 2, op = tr.opacity ?? 1;
  const none = { pointerEvents: "none" };
  if (tr.kind === "line" || tr.kind === "arrow") {
    const a = tr.pts[0], b = tr.pts[1];
    const ang = Math.atan2(b.y - a.y, b.x - a.x), L = 14;
    return (
      <g key={tr.id} style={none}>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={sw} strokeLinecap="round" opacity={op} />
        {tr.kind === "arrow" && (
          <polyline points={`${b.x - L * Math.cos(ang - 0.4)},${b.y - L * Math.sin(ang - 0.4)} ${b.x},${b.y} ${b.x - L * Math.cos(ang + 0.4)},${b.y - L * Math.sin(ang + 0.4)}`}
            fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" opacity={op} />
        )}
      </g>
    );
  }
  if (tr.kind === "rect") {
    const a = tr.pts[0], b = tr.pts[1];
    return <rect key={tr.id} x={Math.min(a.x, b.x)} y={Math.min(a.y, b.y)} width={Math.abs(b.x - a.x)} height={Math.abs(b.y - a.y)} fill="none" stroke={stroke} strokeWidth={sw} opacity={op} style={none} />;
  }
  if (tr.kind === "ellipse") {
    const a = tr.pts[0], b = tr.pts[1];
    return <ellipse key={tr.id} cx={(a.x + b.x) / 2} cy={(a.y + b.y) / 2} rx={Math.abs(b.x - a.x) / 2} ry={Math.abs(b.y - a.y) / 2} fill="none" stroke={stroke} strokeWidth={sw} opacity={op} style={none} />;
  }
  return <polyline key={tr.id} points={tr.pts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" opacity={op} style={none} />;
}

// serializa (underlay SVG + trazos) a un SVG combinado y lo rasteriza a PNG
async function flattenToPNG(underlaySvg, trazos, H) {
  const overlay = trazos.map((tr) => svgStrokeString(tr)).join("");
  const under = `<image x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid meet" href="data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(underlaySvg)))}"/>`;
  const combined = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#ffffff"/>${under}${overlay}</svg>`;
  try {
    const png = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const cv = document.createElement("canvas");
        cv.width = W; cv.height = H;
        const ctx = cv.getContext("2d");
        ctx.drawImage(img, 0, 0, W, H);
        resolve(cv.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(combined)));
    });
    return png;
  } catch {
    // fallback: mandamos el SVG combinado como data URI
    return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(combined)));
  }
}
function svgStrokeString(tr) {
  const s = tr.color, sw = tr.w || 2, op = tr.opacity ?? 1;
  if (tr.kind === "line" || tr.kind === "arrow") {
    const a = tr.pts[0], b = tr.pts[1], ang = Math.atan2(b.y - a.y, b.x - a.x), L = 14;
    let out = `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${s}" stroke-width="${sw}" stroke-linecap="round" opacity="${op}"/>`;
    if (tr.kind === "arrow") out += `<polyline points="${b.x - L * Math.cos(ang - 0.4)},${b.y - L * Math.sin(ang - 0.4)} ${b.x},${b.y} ${b.x - L * Math.cos(ang + 0.4)},${b.y - L * Math.sin(ang + 0.4)}" fill="none" stroke="${s}" stroke-width="${sw}" stroke-linecap="round"/>`;
    return out;
  }
  if (tr.kind === "rect") { const a = tr.pts[0], b = tr.pts[1]; return `<rect x="${Math.min(a.x, b.x)}" y="${Math.min(a.y, b.y)}" width="${Math.abs(b.x - a.x)}" height="${Math.abs(b.y - a.y)}" fill="none" stroke="${s}" stroke-width="${sw}" opacity="${op}"/>`; }
  if (tr.kind === "ellipse") { const a = tr.pts[0], b = tr.pts[1]; return `<ellipse cx="${(a.x + b.x) / 2}" cy="${(a.y + b.y) / 2}" rx="${Math.abs(b.x - a.x) / 2}" ry="${Math.abs(b.y - a.y) / 2}" fill="none" stroke="${s}" stroke-width="${sw}" opacity="${op}"/>`; }
  return `<polyline points="${tr.pts.map((p) => `${p.x},${p.y}`).join(" ")}" fill="none" stroke="${s}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" opacity="${op}"/>`;
}

export default function TallerBammy() {
  const [studies, setStudies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [studyIdx, setStudyIdx] = useState(0);
  const [unitIdx, setUnitIdx] = useState(0);

  // dibujo
  const [tool, setTool] = useState("draw");
  const [pen, setPen] = useState("pencil");
  const [color, setColor] = useState("#F7643B");
  const [trazos, setTrazos] = useState([]);
  const [cur, setCur] = useState(null);
  const [notas, setNotas] = useState("");
  const [veredicto, setVeredicto] = useState("a_corregir");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [underOpacity, setUnderOpacity] = useState(0.55);
  const svgRef = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`${ALICIA_URL}/api/agents/studies`);
        const j = await r.json();
        if (!alive) return;
        setStudies(j.studies || []);
      } catch (e) { if (alive) setErr("No pude cargar los estudios de Bammy."); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const study = studies[studyIdx] || null;
  const unit = study && study.units ? study.units[unitIdx] : null;

  // aspecto del plano (para el alto del lienzo)
  const H = useMemo(() => {
    const svg = unit && unit.svg;
    if (svg) {
      const m = svg.match(/viewBox\s*=\s*["']([\d.\s-]+)["']/);
      if (m) { const [, , vw, vh] = m[1].trim().split(/\s+/).map(Number); if (vw && vh) return Math.round(W * (vh / vw)); }
    }
    return Math.round(W * 0.72);
  }, [unit]);

  // reset del dibujo al cambiar de unidad
  useEffect(() => { setTrazos([]); setCur(null); setNotas(""); setVeredicto("a_corregir"); setSaved(false); }, [studyIdx, unitIdx]);

  const toXY = (e) => {
    const el = svgRef.current; if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
  };
  const onDown = (e) => {
    if (!unit) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const p = toXY(e);
    if (tool === "erase") { setTrazos((ts) => ts.filter((t) => !nearStroke(t, p.x, p.y, 10))); return; }
    const v = PENS.find((x) => x.id === pen) || PENS[0];
    const kind = tool === "draw" ? "path" : tool;
    setCur({ id: tid(), kind, pts: kind === "path" ? [p] : [p, p], color, w: tool === "draw" ? v.w : 2.4, opacity: tool === "draw" ? v.opacity : 1 });
  };
  const onMove = (e) => {
    if (!cur) return;
    const p = toXY(e);
    setCur((c) => {
      if (!c) return c;
      if (c.kind === "path") return { ...c, pts: [...c.pts, p] };
      return { ...c, pts: [c.pts[0], p] };
    });
  };
  const onUp = () => {
    if (!cur) return;
    const c = cur; setCur(null);
    const ok = c.kind === "path" ? c.pts.length > 1 : (Math.hypot(c.pts[1].x - c.pts[0].x, c.pts[1].y - c.pts[0].y) > 3);
    if (ok) setTrazos((ts) => [...ts, c]);
  };

  const undo = () => setTrazos((ts) => ts.slice(0, -1));
  const clear = () => setTrazos([]);

  const guardar = async () => {
    if (!study || !unit) return;
    setSaving(true);
    try {
      const image = (trazos.length || underOpacity != null) ? await flattenToPNG(unit.svg || "", trazos, H) : "";
      const r = await fetch(`${ALICIA_URL}/api/agents/correction`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ study_id: study.id, unidad: unit.unidad || `u${unitIdx + 1}`, image, notas, veredicto }),
      });
      const j = await r.json();
      if (j.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
      else setErr(j.error || "No se pudo guardar.");
    } catch (e) { setErr("No se pudo guardar la corrección."); }
    finally { setSaving(false); }
  };

  const wrap = { display: "flex", height: "100%", background: C.paper, color: C.ink, fontFamily: '"Helvetica Neue",Arial,sans-serif' };
  const railBtn = (active) => ({ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", fontSize: 12.5, textAlign: "left", border: `1px solid ${active ? C.ink : C.line}`, borderRadius: 5, background: active ? C.accent : C.card, color: active ? "#fff" : C.ink, cursor: "pointer", fontWeight: active ? 600 : 500 });

  return (
    <div style={wrap}>
      {/* Rail izquierdo: herramientas */}
      <div style={{ width: 172, flex: "none", borderRight: `1px solid ${C.line}`, background: C.card, padding: 12, display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: C.soft }}>Taller de Bammy</div>
        <div style={{ fontSize: 10.5, color: C.soft, lineHeight: 1.4, marginBottom: 2 }}>Calcá y corregí encima del plano. Bammy aprende de tus marcas y notas.</div>
        <div style={{ fontSize: 9.5, color: C.soft, letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 4 }}>Herramientas</div>
        {TOOLS.map((t) => (
          <button key={t.id} onClick={() => setTool(t.id)} style={railBtn(tool === t.id)}>
            <span style={{ width: 16, textAlign: "center" }}>{t.ico}</span>{t.label}
          </button>
        ))}
        {tool === "draw" && (
          <>
            <div style={{ fontSize: 9.5, color: C.soft, letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 4 }}>Trazo</div>
            {PENS.map((v) => (
              <button key={v.id} onClick={() => setPen(v.id)} style={{ ...railBtn(pen === v.id), justifyContent: "space-between" }}>
                {v.label}<span style={{ width: 30, height: Math.max(2, v.w / 1.4), background: pen === v.id ? "#fff" : color, opacity: v.opacity, borderRadius: 3 }} />
              </button>
            ))}
          </>
        )}
        {tool !== "erase" && (
          <>
            <div style={{ fontSize: 9.5, color: C.soft, letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 4 }}>Color</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} style={{ width: 22, height: 22, borderRadius: 999, background: c, border: color === c ? "2px solid " + C.ink : "1px solid " + C.line, cursor: "pointer", padding: 0 }} />
              ))}
            </div>
          </>
        )}
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <button onClick={undo} disabled={!trazos.length} style={{ ...railBtn(false), justifyContent: "center", opacity: trazos.length ? 1 : 0.4 }}>Deshacer</button>
        </div>
        {trazos.length > 0 && <button onClick={clear} style={{ ...railBtn(false), justifyContent: "center", color: "#A85B5B" }}>Borrar todo</button>}
        <div style={{ fontSize: 9.5, color: C.soft, letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 8 }}>Opacidad del plano</div>
        <input type="range" min={0.15} max={1} step={0.05} value={underOpacity} onChange={(e) => setUnderOpacity(+e.target.value)} />
      </div>

      {/* Centro: lienzo */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* selector de día + unidad */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: `1px solid ${C.line}`, background: C.card, flexWrap: "wrap" }}>
          <select value={studyIdx} onChange={(e) => setStudyIdx(+e.target.value)} style={{ padding: "6px 8px", border: `1px solid ${C.line}`, borderRadius: 5, fontSize: 12.5 }}>
            {studies.length === 0 && <option>— sin estudios aún —</option>}
            {studies.map((s, i) => <option key={s.id} value={i}>{`Día ${s.day ?? "?"} · ${s.date || ""} · ${s.topic || "estudio"}`}</option>)}
          </select>
          <div style={{ display: "flex", gap: 6 }}>
            {(study?.units || []).map((u, i) => (
              <button key={i} onClick={() => setUnitIdx(i)} style={railBtn(unitIdx === i)}>{u.unidad || `u${i + 1}`}</button>
            ))}
          </div>
          {unit?.brief && <div style={{ fontSize: 11.5, color: C.soft, flex: 1, minWidth: 160 }}>{unit.brief}</div>}
        </div>

        {/* área de dibujo */}
        <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 18, display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
          {loading ? <div style={{ color: C.soft, marginTop: 40 }}>Cargando el taller…</div>
            : !unit ? (
              <div style={{ color: C.soft, marginTop: 40, textAlign: "center", maxWidth: 420 }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>📐</div>
                <div style={{ fontWeight: 600, color: C.ink }}>Todavía no hay distribuciones colgadas.</div>
                <div style={{ fontSize: 12.5, marginTop: 6 }}>Cuando Bammy termine su estudio nocturno, va a colgar sus 3 tipologías acá para que las corrijas.</div>
                {err && <div style={{ color: "#A85B5B", fontSize: 12, marginTop: 10 }}>{err}</div>}
              </div>
            ) : (
              <div style={{ position: "relative", width: "100%", maxWidth: 980, background: C.card, border: `1px solid ${C.line}`, borderRadius: 8, boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
                {/* plano de Bammy (fondo, para calcar) */}
                <div style={{ position: "absolute", inset: 0, opacity: underOpacity, pointerEvents: "none" }}
                  dangerouslySetInnerHTML={{ __html: (unit.svg || "").replace(/<svg /, `<svg preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;display:block" `) }} />
                {/* capa de dibujo */}
                <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ position: "relative", width: "100%", display: "block", touchAction: "none", cursor: tool === "erase" ? "cell" : "crosshair" }}
                  onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
                  <rect x={0} y={0} width={W} height={H} fill="transparent" />
                  {trazos.map(renderTrazo)}
                  {cur && renderTrazo(cur)}
                </svg>
              </div>
            )}
        </div>
      </div>

      {/* Rail derecho: notas + guardar */}
      <div style={{ width: 260, flex: "none", borderLeft: `1px solid ${C.line}`, background: C.card, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: C.soft }}>Corrección</div>
        <textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Notas para Bammy: qué está bien, qué corregir y por qué…"
          style={{ width: "100%", minHeight: 160, resize: "vertical", padding: 10, border: `1px solid ${C.line}`, borderRadius: 6, fontSize: 12.5, fontFamily: "inherit", lineHeight: 1.45 }} />
        <div style={{ fontSize: 9.5, color: C.soft, letterSpacing: "0.06em", textTransform: "uppercase" }}>Veredicto</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setVeredicto("aprobado")} style={{ ...railBtn(veredicto === "aprobado"), justifyContent: "center" }}>Aprobado</button>
          <button onClick={() => setVeredicto("a_corregir")} style={{ ...railBtn(veredicto === "a_corregir"), justifyContent: "center" }}>A corregir</button>
        </div>
        <button onClick={guardar} disabled={saving || !unit} style={{ marginTop: 6, padding: "11px 0", border: "none", borderRadius: 6, background: unit ? C.accent : C.line, color: "#fff", fontSize: 13, fontWeight: 700, cursor: unit ? "pointer" : "default" }}>
          {saving ? "Guardando…" : saved ? "✓ Enviado a Bammy" : "Guardar corrección"}
        </button>
        {saved && <div style={{ fontSize: 11, color: C.soft }}>Bammy la leerá en su próxima corrida y aprenderá de ella.</div>}
        {err && <div style={{ color: "#A85B5B", fontSize: 11.5 }}>{err}</div>}
      </div>
    </div>
  );
}
