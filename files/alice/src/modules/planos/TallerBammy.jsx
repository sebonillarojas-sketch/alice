// Taller de Bammy — Bammy cuelga sus distribuciones y Sebastián las corrige
// DIBUJANDO encima (calcar) + notas. Look Diagramatic (whiteboard del ERP):
// canvas con grilla punteada + islas flotantes. La corrección se guarda y Bammy aprende.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bot } from "lucide-react";
import { ALICIA_URL } from "../../lib/brain.js";

// paleta global del ERP (igual que Diagramatic / HyggeOS)
const C = {
  bg: "#EEEBE3", paper: "#F4F1EA", surface: "#FAF8F2",
  ink: "#0A0B0F", inkSoft: "#3A3D45", muted: "#8C8F96",
  line: "#D5D1C5", lineSoft: "#E4E0D4",
  navy: "#1E2A4A", cobalt: "#3D52D5", sky: "#B8C8E5",
  lavender: "#A89BD9", ochre: "#C2A45A", brick: "#A85B5B", green: "#5F8A6A",
  bammy: "#A855F7",
};
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
const COLORS = [C.ink, C.cobalt, C.brick, C.green, C.ochre, C.lavender, C.navy, C.sky];

const W = 900;
let _tid = 0;
const tid = () => `t${++_tid}`;

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
    const a = tr.pts[0], b = tr.pts[1], ang = Math.atan2(b.y - a.y, b.x - a.x), L = 14;
    return (
      <g key={tr.id} style={none}>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={sw} strokeLinecap="round" opacity={op} />
        {tr.kind === "arrow" && <polyline points={`${b.x - L * Math.cos(ang - 0.4)},${b.y - L * Math.sin(ang - 0.4)} ${b.x},${b.y} ${b.x - L * Math.cos(ang + 0.4)},${b.y - L * Math.sin(ang + 0.4)}`} fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" opacity={op} />}
      </g>
    );
  }
  if (tr.kind === "rect") { const a = tr.pts[0], b = tr.pts[1]; return <rect key={tr.id} x={Math.min(a.x, b.x)} y={Math.min(a.y, b.y)} width={Math.abs(b.x - a.x)} height={Math.abs(b.y - a.y)} fill="none" stroke={stroke} strokeWidth={sw} opacity={op} style={none} />; }
  if (tr.kind === "ellipse") { const a = tr.pts[0], b = tr.pts[1]; return <ellipse key={tr.id} cx={(a.x + b.x) / 2} cy={(a.y + b.y) / 2} rx={Math.abs(b.x - a.x) / 2} ry={Math.abs(b.y - a.y) / 2} fill="none" stroke={stroke} strokeWidth={sw} opacity={op} style={none} />; }
  return <polyline key={tr.id} points={tr.pts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" opacity={op} style={none} />;
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
async function flattenToPNG(underlaySvg, trazos, H) {
  const b64 = (str) => btoa(unescape(encodeURIComponent(str)));
  const overlay = trazos.map(svgStrokeString).join("");
  const under = underlaySvg ? `<image x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid meet" href="data:image/svg+xml;base64,${b64(underlaySvg)}"/>` : "";
  const combined = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#ffffff"/>${under}${overlay}</svg>`;
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => { const cv = document.createElement("canvas"); cv.width = W; cv.height = H; cv.getContext("2d").drawImage(img, 0, 0, W, H); resolve(cv.toDataURL("image/png")); };
      img.onerror = reject;
      img.src = "data:image/svg+xml;base64," + b64(combined);
    });
  } catch { return "data:image/svg+xml;base64," + b64(combined); }
}

const island = { backgroundColor: C.bg, border: `1px solid ${C.line}`, borderRadius: 4, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" };

export default function TallerBammy() {
  const [studies, setStudies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [studyIdx, setStudyIdx] = useState(0);
  const [unitIdx, setUnitIdx] = useState(0);

  const [tool, setTool] = useState("draw");
  const [pen, setPen] = useState("pencil");
  const [color, setColor] = useState(C.brick);
  const [trazos, setTrazos] = useState([]);
  const [cur, setCur] = useState(null);
  const [notas, setNotas] = useState("");
  const [veredicto, setVeredicto] = useState("a_corregir");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [underOpacity, setUnderOpacity] = useState(0.5);
  const svgRef = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try { const r = await fetch(`${ALICIA_URL}/api/agents/studies`); const j = await r.json(); if (alive) setStudies(j.studies || []); }
      catch { if (alive) setErr("No pude cargar los estudios de Bammy."); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const study = studies[studyIdx] || null;
  const unit = study && study.units ? study.units[unitIdx] : null;

  const H = useMemo(() => {
    const svg = unit && unit.svg;
    if (svg) { const m = svg.match(/viewBox\s*=\s*["']([\d.\s-]+)["']/); if (m) { const [, , vw, vh] = m[1].trim().split(/\s+/).map(Number); if (vw && vh) return Math.round(W * (vh / vw)); } }
    return Math.round(W * 0.72);
  }, [unit]);

  useEffect(() => { setTrazos([]); setCur(null); setNotas(""); setVeredicto("a_corregir"); setSaved(false); }, [studyIdx, unitIdx]);

  const toXY = (e) => { const el = svgRef.current; if (!el) return { x: 0, y: 0 }; const r = el.getBoundingClientRect(); return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) }; };
  const onDown = (e) => {
    if (!unit) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const p = toXY(e);
    if (tool === "erase") { setTrazos((ts) => ts.filter((t) => !nearStroke(t, p.x, p.y, 10))); return; }
    const v = PENS.find((x) => x.id === pen) || PENS[0];
    const kind = tool === "draw" ? "path" : tool;
    setCur({ id: tid(), kind, pts: kind === "path" ? [p] : [p, p], color, w: tool === "draw" ? v.w : 2.4, opacity: tool === "draw" ? v.opacity : 1 });
  };
  const onMove = (e) => { if (!cur) return; const p = toXY(e); setCur((c) => c ? (c.kind === "path" ? { ...c, pts: [...c.pts, p] } : { ...c, pts: [c.pts[0], p] }) : c); };
  const onUp = () => { if (!cur) return; const c = cur; setCur(null); const ok = c.kind === "path" ? c.pts.length > 1 : (Math.hypot(c.pts[1].x - c.pts[0].x, c.pts[1].y - c.pts[0].y) > 3); if (ok) setTrazos((ts) => [...ts, c]); };
  const undo = () => setTrazos((ts) => ts.slice(0, -1));
  const clear = () => setTrazos([]);

  const guardar = async () => {
    if (!study || !unit) return;
    setSaving(true);
    try {
      const image = await flattenToPNG(unit.svg || "", trazos, H);
      const r = await fetch(`${ALICIA_URL}/api/agents/correction`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ study_id: study.id, unidad: unit.unidad || `u${unitIdx + 1}`, image, notas, veredicto }) });
      const j = await r.json();
      if (j.ok) { setSaved(true); setTimeout(() => setSaved(false), 2600); } else setErr(j.error || "No se pudo guardar.");
    } catch { setErr("No se pudo guardar la corrección."); }
    finally { setSaving(false); }
  };

  const toolBtn = (active) => `flex items-center justify-center w-9 h-9 hover:opacity-90`;
  const toolStyle = (active) => ({ backgroundColor: active ? C.ink : "transparent", color: active ? C.bg : C.inkSoft, borderRadius: 2, fontSize: 14, cursor: "pointer", border: "none" });

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: C.bg, fontFamily: '"Helvetica Neue",Arial,sans-serif', color: C.ink }}>
      {/* header estilo app del ERP */}
      <div className="flex items-center justify-between px-4 lg:px-8 py-3 flex-wrap gap-2" style={{ borderBottom: `1px solid ${C.lineSoft}`, backgroundColor: C.paper }}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 flex items-center justify-center flex-shrink-0" style={{ backgroundColor: C.bammy + "20", border: `1px solid ${C.bammy}40`, borderRadius: 2 }}>
            <Bot size={14} style={{ color: C.bammy }} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em" }}>Taller de Bammy</span>
            <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 10, backgroundColor: C.lineSoft, color: C.muted, fontWeight: 700, fontFamily: "ui-monospace, monospace" }}>v1.0</span>
            <span style={{ fontSize: 10, color: C.muted, letterSpacing: "0.04em" }}>· calcá y corregí encima · Bammy aprende de tus marcas</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={studyIdx} onChange={(e) => setStudyIdx(+e.target.value)} style={{ padding: "5px 8px", border: `1px solid ${C.line}`, borderRadius: 2, fontSize: 11.5, background: C.surface, color: C.ink }}>
            {studies.length === 0 && <option>— sin estudios —</option>}
            {studies.map((s, i) => <option key={s.id} value={i}>{`Día ${s.day ?? "?"} · ${s.topic || "estudio"}`}</option>)}
          </select>
          <div className="flex items-center gap-1">
            {(study?.units || []).map((u, i) => (
              <button key={i} onClick={() => setUnitIdx(i)} className="px-2.5 py-1.5 text-[11px]" style={{ backgroundColor: unitIdx === i ? C.ink : C.surface, color: unitIdx === i ? C.bg : C.inkSoft, border: `1px solid ${C.lineSoft}`, borderRadius: 2, cursor: "pointer", fontWeight: 600 }}>{u.unidad || `u${i + 1}`}</button>
            ))}
          </div>
        </div>
      </div>

      {/* canvas whiteboard */}
      <div className="relative flex-1 overflow-hidden" style={{ backgroundColor: C.paper, backgroundImage: `radial-gradient(circle, ${C.line} 1px, transparent 1px)`, backgroundSize: "22px 22px" }}>
        {/* plano + dibujo, centrado y scrolleable */}
        <div className="absolute inset-0 overflow-auto" style={{ padding: 24, display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
          {loading ? <div style={{ color: C.muted, marginTop: 60, fontSize: 12.5 }}>Cargando el taller…</div>
            : !unit ? (
              <div style={{ color: C.muted, marginTop: 70, textAlign: "center", maxWidth: 420 }}>
                <div style={{ width: 52, height: 52, margin: "0 auto 12px", borderRadius: "42% 58% 60% 40% / 50% 45% 55% 50%", background: C.bammy + "22", border: `1px solid ${C.bammy}55`, display: "flex", alignItems: "center", justifyContent: "center" }}><Bot size={22} style={{ color: C.bammy }} /></div>
                <div style={{ fontWeight: 600, color: C.ink, fontSize: 13.5 }}>Todavía no colgué distribuciones.</div>
                <div style={{ fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>Cuando termine mi estudio nocturno, voy a colgar acá mis 3 tipologías para que las corrijas dibujando encima.</div>
                {err && <div style={{ color: C.brick, fontSize: 11.5, marginTop: 10 }}>{err}</div>}
              </div>
            ) : (
              <div style={{ position: "relative", width: "100%", maxWidth: 940, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 3, boxShadow: "0 2px 14px rgba(0,0,0,0.07)" }}>
                <div style={{ position: "absolute", inset: 0, opacity: underOpacity, pointerEvents: "none" }}
                  dangerouslySetInnerHTML={{ __html: (unit.svg || "").replace(/<svg /, `<svg preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;display:block" `) }} />
                <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ position: "relative", width: "100%", display: "block", touchAction: "none", cursor: tool === "erase" ? "cell" : "crosshair" }}
                  onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
                  <rect x={0} y={0} width={W} height={H} fill="transparent" />
                  {trazos.map(renderTrazo)}
                  {cur && renderTrazo(cur)}
                </svg>
              </div>
            )}
        </div>

        {/* isla de herramientas (arriba-izq) */}
        <div className="absolute top-4 left-4 z-20 flex flex-col gap-1 p-1.5" style={island}>
          {TOOLS.map((t) => (
            <button key={t.id} title={t.label} onClick={() => setTool(t.id)} className={toolBtn(tool === t.id)} style={toolStyle(tool === t.id)}>{t.ico}</button>
          ))}
          <div style={{ height: 1, backgroundColor: C.lineSoft, margin: "3px 4px" }} />
          <button title="Deshacer" onClick={undo} disabled={!trazos.length} className={toolBtn(false)} style={{ ...toolStyle(false), opacity: trazos.length ? 1 : 0.35 }}>↺</button>
          <button title="Borrar todo" onClick={clear} disabled={!trazos.length} className={toolBtn(false)} style={{ ...toolStyle(false), color: C.brick, opacity: trazos.length ? 1 : 0.35 }}>⌫</button>
        </div>

        {/* variantes de trazo (cuando lápiz) */}
        {tool === "draw" && (
          <div className="absolute top-4 z-20 p-2" style={{ ...island, left: 64, width: 176 }}>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6, fontWeight: 700 }}>Trazo</div>
            <div className="flex flex-col gap-1">
              {PENS.map((v) => (
                <button key={v.id} onClick={() => setPen(v.id)} className="flex items-center justify-between px-2 py-1.5" style={{ backgroundColor: pen === v.id ? C.surface : "transparent", border: `1px solid ${pen === v.id ? C.lineSoft : "transparent"}`, borderRadius: 2, cursor: "pointer", fontSize: 11.5, color: C.inkSoft }}>
                  {v.label}<span style={{ display: "inline-block", width: 28, height: Math.max(2, v.w / 1.4), backgroundColor: color, opacity: v.opacity, borderRadius: 999 }} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* colores (cuando no goma) */}
        {tool !== "erase" && (
          <div className="absolute top-4 z-20 flex flex-wrap gap-1.5 p-2" style={{ ...island, left: tool === "draw" ? 248 : 64, width: 120 }}>
            {COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)} className="w-6 h-6" style={{ backgroundColor: c, borderRadius: 999, border: color === c ? `2px solid ${C.ink}` : `1px solid ${C.lineSoft}`, cursor: "pointer", padding: 0 }} />
            ))}
          </div>
        )}

        {/* opacidad del plano (arriba-der) */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2 px-3 py-2" style={island}>
          <span style={{ fontSize: 10, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 700 }}>Plano</span>
          <input type="range" min={0.12} max={1} step={0.04} value={underOpacity} onChange={(e) => setUnderOpacity(+e.target.value)} style={{ width: 90 }} />
        </div>

        {/* panel de corrección (flotante, der) */}
        <div className="absolute right-4 z-20 flex flex-col gap-2 p-3" style={{ ...island, top: 64, width: 254 }}>
          <div style={{ fontSize: 9.5, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>Corrección para Bammy</div>
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Qué está bien, qué corregir y por qué…"
            style={{ width: "100%", minHeight: 132, resize: "vertical", padding: 9, border: `1px solid ${C.lineSoft}`, borderRadius: 2, fontSize: 12, fontFamily: "inherit", lineHeight: 1.45, background: C.surface, color: C.ink }} />
          <div className="flex gap-1.5">
            <button onClick={() => setVeredicto("aprobado")} className="flex-1 py-1.5 text-[11px]" style={{ backgroundColor: veredicto === "aprobado" ? C.green : C.surface, color: veredicto === "aprobado" ? "#fff" : C.inkSoft, border: `1px solid ${C.lineSoft}`, borderRadius: 2, cursor: "pointer", fontWeight: 600 }}>Aprobado</button>
            <button onClick={() => setVeredicto("a_corregir")} className="flex-1 py-1.5 text-[11px]" style={{ backgroundColor: veredicto === "a_corregir" ? C.brick : C.surface, color: veredicto === "a_corregir" ? "#fff" : C.inkSoft, border: `1px solid ${C.lineSoft}`, borderRadius: 2, cursor: "pointer", fontWeight: 600 }}>A corregir</button>
          </div>
          <button onClick={guardar} disabled={saving || !unit} style={{ padding: "10px 0", border: "none", borderRadius: 2, background: unit ? C.navy : C.line, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: unit ? "pointer" : "default" }}>
            {saving ? "Guardando…" : saved ? "✓ Enviado a Bammy" : "Guardar corrección"}
          </button>
          {saved && <div style={{ fontSize: 10.5, color: C.muted }}>Bammy la leerá en su próxima corrida.</div>}
          {err && unit && <div style={{ color: C.brick, fontSize: 11 }}>{err}</div>}
        </div>

        {/* Bammy chiquito (mascota, abajo-izq) */}
        <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 px-3 py-2" style={island} title="Bammy — tu arquitecto residencial">
          <div style={{ width: 26, height: 26, borderRadius: "42% 58% 60% 40% / 50% 45% 55% 50%", background: C.bammy + "26", border: `1px solid ${C.bammy}66`, display: "flex", alignItems: "center", justifyContent: "center", animation: "hb-morph-slow 8s ease-in-out infinite" }}>
            <Bot size={14} style={{ color: C.bammy }} />
          </div>
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.ink }}>Bammy</div>
            <div style={{ fontSize: 9.5, color: C.muted }}>{unit ? "esperando tu corrección" : "sin planos aún"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
