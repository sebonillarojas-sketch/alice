// Taller de Bammy — Bammy cuelga sus distribuciones y Sebastián las corrige DIBUJANDO
// encima (calcar) + notas + chat con Bammy. Look Diagramatic: islas flotantes, barra
// compacta y cerrable, zoom. La corrección se guarda y Bammy aprende.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Pencil, Minus, ArrowUpRight, Square, Circle, Eraser, Undo2, Trash2, ZoomIn, ZoomOut, MessageSquare, Send, X, ChevronLeft, StickyNote } from "lucide-react";
import { ALICIA_URL } from "../../lib/brain.js";

const C = {
  bg: "#EEEBE3", paper: "#F4F1EA", surface: "#FAF8F2",
  ink: "#0A0B0F", inkSoft: "#3A3D45", muted: "#8C8F96",
  line: "#D5D1C5", lineSoft: "#E4E0D4",
  navy: "#1E2A4A", cobalt: "#3D52D5", sky: "#B8C8E5",
  lavender: "#A89BD9", ochre: "#C2A45A", brick: "#A85B5B", green: "#5F8A6A",
  bammy: "#A855F7",
};
const TOOLS = [
  { id: "draw", label: "Lápiz", Ico: Pencil },
  { id: "line", label: "Línea", Ico: Minus },
  { id: "arrow", label: "Flecha", Ico: ArrowUpRight },
  { id: "rect", label: "Rectángulo", Ico: Square },
  { id: "ellipse", label: "Elipse", Ico: Circle },
  { id: "erase", label: "Goma", Ico: Eraser },
];
const PENS = [
  { id: "pencil", label: "Lápiz", w: 2.2, opacity: 0.95 },
  { id: "marker", label: "Plumón", w: 5, opacity: 0.6 },
  { id: "fine", label: "Fino", w: 1.1, opacity: 1 },
  { id: "highlighter", label: "Resaltador", w: 16, opacity: 0.28 },
];
const COLORS = [C.brick, C.cobalt, C.ink, C.green, C.ochre, C.lavender, C.navy, C.sky];
const W = 900;
let _tid = 0;
const tid = () => `t${++_tid}`;

function nearStroke(tr, x, y, thr) {
  const ps = tr.pts;
  for (let i = 0; i < ps.length - 1; i++) {
    const a = ps[i], b = ps[i + 1], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
    let t = ((x - a.x) * dx + (y - a.y) * dy) / l2; t = Math.max(0, Math.min(1, t));
    if (Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy)) <= thr) return true;
  }
  if (ps.length === 1) return Math.hypot(x - ps[0].x, y - ps[0].y) <= thr;
  return false;
}
function TrazoEl({ tr }) {
  const s = tr.color, sw = tr.w || 2, op = tr.opacity ?? 1, none = { pointerEvents: "none" };
  if (tr.kind === "line" || tr.kind === "arrow") {
    const a = tr.pts[0], b = tr.pts[1], ang = Math.atan2(b.y - a.y, b.x - a.x), L = 14;
    return (
      <g style={none}>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={s} strokeWidth={sw} strokeLinecap="round" opacity={op} />
        {tr.kind === "arrow" && <polyline points={`${b.x - L * Math.cos(ang - 0.4)},${b.y - L * Math.sin(ang - 0.4)} ${b.x},${b.y} ${b.x - L * Math.cos(ang + 0.4)},${b.y - L * Math.sin(ang + 0.4)}`} fill="none" stroke={s} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" opacity={op} />}
      </g>
    );
  }
  if (tr.kind === "rect") { const a = tr.pts[0], b = tr.pts[1]; return <rect x={Math.min(a.x, b.x)} y={Math.min(a.y, b.y)} width={Math.abs(b.x - a.x)} height={Math.abs(b.y - a.y)} fill="none" stroke={s} strokeWidth={sw} opacity={op} style={none} />; }
  if (tr.kind === "ellipse") { const a = tr.pts[0], b = tr.pts[1]; return <ellipse cx={(a.x + b.x) / 2} cy={(a.y + b.y) / 2} rx={Math.abs(b.x - a.x) / 2} ry={Math.abs(b.y - a.y) / 2} fill="none" stroke={s} strokeWidth={sw} opacity={op} style={none} />; }
  return <polyline points={tr.pts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={s} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" opacity={op} style={none} />;
}
function strokeStr(tr) {
  const s = tr.color, sw = tr.w || 2, op = tr.opacity ?? 1;
  if (tr.kind === "line" || tr.kind === "arrow") {
    const a = tr.pts[0], b = tr.pts[1], ang = Math.atan2(b.y - a.y, b.x - a.x), L = 14;
    let o = `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${s}" stroke-width="${sw}" stroke-linecap="round" opacity="${op}"/>`;
    if (tr.kind === "arrow") o += `<polyline points="${b.x - L * Math.cos(ang - 0.4)},${b.y - L * Math.sin(ang - 0.4)} ${b.x},${b.y} ${b.x - L * Math.cos(ang + 0.4)},${b.y - L * Math.sin(ang + 0.4)}" fill="none" stroke="${s}" stroke-width="${sw}" stroke-linecap="round"/>`;
    return o;
  }
  if (tr.kind === "rect") { const a = tr.pts[0], b = tr.pts[1]; return `<rect x="${Math.min(a.x, b.x)}" y="${Math.min(a.y, b.y)}" width="${Math.abs(b.x - a.x)}" height="${Math.abs(b.y - a.y)}" fill="none" stroke="${s}" stroke-width="${sw}" opacity="${op}"/>`; }
  if (tr.kind === "ellipse") { const a = tr.pts[0], b = tr.pts[1]; return `<ellipse cx="${(a.x + b.x) / 2}" cy="${(a.y + b.y) / 2}" rx="${Math.abs(b.x - a.x) / 2}" ry="${Math.abs(b.y - a.y) / 2}" fill="none" stroke="${s}" stroke-width="${sw}" opacity="${op}"/>`; }
  return `<polyline points="${tr.pts.map((p) => `${p.x},${p.y}`).join(" ")}" fill="none" stroke="${s}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" opacity="${op}"/>`;
}
async function flattenToPNG(underlaySvg, trazos, H) {
  const enc = (str) => btoa(unescape(encodeURIComponent(str)));
  const under = underlaySvg ? `<image x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid meet" href="data:image/svg+xml;base64,${enc(underlaySvg)}"/>` : "";
  const combined = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>${under}${trazos.map(strokeStr).join("")}</svg>`;
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => { const cv = document.createElement("canvas"); cv.width = W; cv.height = H; cv.getContext("2d").drawImage(img, 0, 0, W, H); resolve(cv.toDataURL("image/png")); };
      img.onerror = reject;
      img.src = "data:image/svg+xml;base64," + enc(combined);
    });
  } catch { return "data:image/svg+xml;base64," + enc(combined); }
}

const ISLAND = { backgroundColor: C.bg, border: `1px solid ${C.line}`, borderRadius: 4, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" };
const KEYFRAMES = `@keyframes taller-morph{0%,100%{border-radius:42% 58% 65% 35%/45% 45% 55% 55%}34%{border-radius:60% 40% 42% 58%/60% 45% 55% 40%}67%{border-radius:45% 55% 60% 40%/40% 62% 38% 60%}}@keyframes taller-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}`;

export default function TallerBammy() {
  const [studies, setStudies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [studyIdx, setStudyIdx] = useState(0);
  const [unitIdx, setUnitIdx] = useState(0);
  // dibujo
  const [tool, setTool] = useState("draw");
  const [pen, setPen] = useState("pencil");
  const [color, setColor] = useState(C.brick);
  const [trazos, setTrazos] = useState([]);
  const [cur, setCur] = useState(null);
  const drawing = useRef(false);
  // paneles
  const [toolsOpen, setToolsOpen] = useState(true);
  const [notesOpen, setNotesOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [underOpacity, setUnderOpacity] = useState(0.5);
  const [zoom, setZoom] = useState(1);
  // corrección
  const [notas, setNotas] = useState("");
  const [veredicto, setVeredicto] = useState("a_corregir");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // chat
  const [chat, setChat] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const svgRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try { const r = await fetch(`${ALICIA_URL}/api/agents/studies`); const j = await r.json(); if (alive) setStudies(j.studies || []); }
      catch { if (alive) setErr("No pude cargar los estudios de Bammy."); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat, chatOpen]);

  const study = studies[studyIdx] || null;
  const unit = study && study.units ? study.units[unitIdx] : null;
  const H = useMemo(() => {
    const svg = unit && unit.svg;
    if (svg) { const m = svg.match(/viewBox\s*=\s*["']([\d.\s-]+)["']/); if (m) { const [, , vw, vh] = m[1].trim().split(/\s+/).map(Number); if (vw && vh) return Math.round(W * (vh / vw)); } }
    return Math.round(W * 0.72);
  }, [unit]);
  useEffect(() => { setTrazos([]); setCur(null); setNotas(""); setVeredicto("a_corregir"); setSaved(false); setZoom(1); }, [studyIdx, unitIdx]);

  const toXY = (e) => { const el = svgRef.current; if (!el) return { x: 0, y: 0 }; const r = el.getBoundingClientRect(); return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) }; };
  const onDown = (e) => {
    if (!unit || e.button === 2) return;
    const p = toXY(e);
    if (tool === "erase") { setTrazos((ts) => ts.filter((t) => !nearStroke(t, p.x, p.y, 10))); return; }
    drawing.current = true;
    const v = PENS.find((x) => x.id === pen) || PENS[0];
    const kind = tool === "draw" ? "path" : tool;
    setCur({ id: tid(), kind, pts: kind === "path" ? [p] : [p, p], color, w: tool === "draw" ? v.w : 2.4, opacity: tool === "draw" ? v.opacity : 1 });
  };
  const onMove = (e) => { if (!drawing.current) return; const p = toXY(e); setCur((c) => c ? (c.kind === "path" ? { ...c, pts: [...c.pts, p] } : { ...c, pts: [c.pts[0], p] }) : c); };
  const onUp = () => {
    if (!drawing.current) return; drawing.current = false;
    setCur((c) => { if (c) { const ok = c.kind === "path" ? c.pts.length > 1 : Math.hypot(c.pts[1].x - c.pts[0].x, c.pts[1].y - c.pts[0].y) > 3; if (ok) setTrazos((ts) => [...ts, c]); } return null; });
  };
  const onWheel = (e) => { if (!unit) return; if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoom((z) => Math.min(3, Math.max(0.5, z - e.deltaY * 0.0015))); } };

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

  const sendChat = async () => {
    const text = chatInput.trim(); if (!text || chatBusy) return;
    const next = [...chat, { role: "user", content: text }];
    setChat(next); setChatInput(""); setChatBusy(true);
    try {
      const r = await fetch(`${ALICIA_URL}/api/bammy/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next, planContext: unit ? `Día ${study?.day} · unidad ${unit.unidad} · ${unit.brief || ""}` : "" }) });
      const j = await r.json();
      setChat((c) => [...c, { role: "assistant", content: j.reply || j.error || "…" }]);
    } catch { setChat((c) => [...c, { role: "assistant", content: "No pude responder ahora — revisá la conexión." }]); }
    finally { setChatBusy(false); }
  };

  const iconBtn = (active) => ({ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, background: active ? C.ink : "transparent", color: active ? C.bg : C.inkSoft, borderRadius: 2, border: "none", cursor: "pointer" });

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: C.bg, color: C.ink, fontFamily: '"Helvetica Neue",Arial,sans-serif' }}>
      <style>{KEYFRAMES}</style>
      {/* header */}
      <div className="flex items-center justify-between px-4 lg:px-6 py-3 flex-wrap gap-2" style={{ borderBottom: `1px solid ${C.lineSoft}`, background: C.paper }}>
        <div className="flex items-center gap-3 min-w-0">
          <div style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: C.bammy + "20", border: `1px solid ${C.bammy}40`, borderRadius: 2 }}><Bot size={15} style={{ color: C.bammy }} /></div>
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ fontSize: 13, fontWeight: 600 }}>Taller de Bammy</span>
            <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 10, background: C.lineSoft, color: C.muted, fontWeight: 700, fontFamily: "ui-monospace,monospace" }}>v2</span>
            <span style={{ fontSize: 10, color: C.muted }}>· calcá y corregí encima · Bammy aprende de tus marcas</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={studyIdx} onChange={(e) => setStudyIdx(+e.target.value)} style={{ padding: "5px 8px", border: `1px solid ${C.line}`, borderRadius: 2, fontSize: 11.5, background: C.surface, color: C.ink }}>
            {studies.length === 0 && <option>— sin estudios —</option>}
            {studies.map((s, i) => <option key={s.id} value={i}>{`Día ${s.day ?? "?"} · ${s.topic || "estudio"}`}</option>)}
          </select>
          {(study?.units || []).map((u, i) => (
            <button key={i} onClick={() => setUnitIdx(i)} style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600, background: unitIdx === i ? C.ink : C.surface, color: unitIdx === i ? C.bg : C.inkSoft, border: `1px solid ${C.lineSoft}`, borderRadius: 2, cursor: "pointer" }}>{u.unidad || `u${i + 1}`}</button>
          ))}
          <button onClick={() => setNotesOpen((v) => !v)} title="Corrección" style={{ ...iconBtn(notesOpen), width: 32, height: 30 }}><StickyNote size={15} /></button>
          <button onClick={() => setChatOpen((v) => !v)} title="Chatear con Bammy" style={{ ...iconBtn(chatOpen), width: 32, height: 30 }}><MessageSquare size={15} /></button>
        </div>
      </div>

      {/* canvas */}
      <div style={{ position: "relative", flex: 1, minHeight: 0, overflow: "hidden", background: C.paper, backgroundImage: `radial-gradient(circle, ${C.line} 1px, transparent 1px)`, backgroundSize: "22px 22px" }} onWheel={onWheel}>
        <div style={{ position: "absolute", inset: 0, overflow: "auto", padding: 24, display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
          {loading ? <div style={{ color: C.muted, marginTop: 60, fontSize: 12.5 }}>Cargando el taller…</div>
            : !unit ? (
              <div style={{ color: C.muted, marginTop: 70, textAlign: "center", maxWidth: 420 }}>
                <div style={{ width: 54, height: 54, margin: "0 auto 12px", background: C.bammy + "22", border: `1px solid ${C.bammy}55`, display: "flex", alignItems: "center", justifyContent: "center", animation: "taller-morph 8s ease-in-out infinite" }}><Bot size={22} style={{ color: C.bammy }} /></div>
                <div style={{ fontWeight: 600, color: C.ink, fontSize: 13.5 }}>Todavía no colgué distribuciones.</div>
                <div style={{ fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>Cuando termine mi estudio nocturno, cuelgo acá mis 3 tipologías para que las corrijas.</div>
                {err && <div style={{ color: C.brick, fontSize: 11.5, marginTop: 10 }}>{err}</div>}
              </div>
            ) : (
              <div style={{ position: "relative", width: `${92 * zoom}%`, maxWidth: 980 * zoom, flex: "0 0 auto", background: "#fff", border: `1px solid ${C.line}`, borderRadius: 3, boxShadow: "0 2px 14px rgba(0,0,0,0.07)" }}>
                <div style={{ position: "absolute", inset: 0, opacity: underOpacity, pointerEvents: "none" }} dangerouslySetInnerHTML={{ __html: (unit.svg || "").replace(/<svg /, `<svg preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;display:block" `) }} />
                <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ position: "relative", width: "100%", display: "block", touchAction: "none", cursor: tool === "erase" ? "cell" : "crosshair" }}
                  onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} onContextMenu={(e) => e.preventDefault()}>
                  <rect x={0} y={0} width={W} height={H} fill="transparent" />
                  {trazos.map((t) => <TrazoEl key={t.id} tr={t} />)}
                  {cur && <TrazoEl tr={cur} />}
                </svg>
              </div>
            )}
        </div>

        {/* barra de herramientas — compacta y cerrable */}
        {toolsOpen ? (
          <div style={{ position: "absolute", top: 16, left: 16, zIndex: 20, display: "flex", flexDirection: "column", gap: 4, padding: 6, ...ISLAND }}>
            <button onClick={() => setToolsOpen(false)} title="Ocultar barra" style={{ ...iconBtn(false), width: 34, height: 22, color: C.muted }}><ChevronLeft size={14} /></button>
            <div style={{ height: 1, background: C.lineSoft, margin: "1px 4px" }} />
            {TOOLS.map((t) => (<button key={t.id} title={t.label} onClick={() => setTool(t.id)} style={iconBtn(tool === t.id)}><t.Ico size={16} /></button>))}
            <div style={{ height: 1, background: C.lineSoft, margin: "1px 4px" }} />
            <button title="Deshacer" onClick={() => setTrazos((ts) => ts.slice(0, -1))} disabled={!trazos.length} style={{ ...iconBtn(false), opacity: trazos.length ? 1 : 0.35 }}><Undo2 size={16} /></button>
            <button title="Borrar todo" onClick={() => setTrazos([])} disabled={!trazos.length} style={{ ...iconBtn(false), color: C.brick, opacity: trazos.length ? 1 : 0.35 }}><Trash2 size={16} /></button>
          </div>
        ) : (
          <button onClick={() => setToolsOpen(true)} title="Herramientas" style={{ position: "absolute", top: 16, left: 16, zIndex: 20, ...iconBtn(false), width: 38, height: 38, ...ISLAND }}><Pencil size={16} /></button>
        )}

        {/* variantes de trazo + colores */}
        {toolsOpen && tool === "draw" && (
          <div style={{ position: "absolute", top: 16, left: 62, zIndex: 20, padding: 8, width: 168, ...ISLAND }}>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6, fontWeight: 700 }}>Trazo</div>
            {PENS.map((v) => (<button key={v.id} onClick={() => setPen(v.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "5px 7px", marginBottom: 3, background: pen === v.id ? C.surface : "transparent", border: `1px solid ${pen === v.id ? C.lineSoft : "transparent"}`, borderRadius: 2, cursor: "pointer", fontSize: 11.5, color: C.inkSoft }}>{v.label}<span style={{ width: 26, height: Math.max(2, v.w / 1.5), background: color, opacity: v.opacity, borderRadius: 999 }} /></button>))}
          </div>
        )}
        {toolsOpen && tool !== "erase" && (
          <div style={{ position: "absolute", top: 16, left: tool === "draw" ? 240 : 62, zIndex: 20, display: "flex", flexWrap: "wrap", gap: 6, padding: 8, width: 116, ...ISLAND }}>
            {COLORS.map((c) => (<button key={c} onClick={() => setColor(c)} style={{ width: 22, height: 22, borderRadius: 999, background: c, border: color === c ? `2px solid ${C.ink}` : `1px solid ${C.lineSoft}`, cursor: "pointer", padding: 0 }} />))}
          </div>
        )}

        {/* zoom + opacidad (abajo-der) */}
        <div style={{ position: "absolute", bottom: 16, right: 16, zIndex: 20, display: "flex", alignItems: "center", gap: 2, padding: 4, ...ISLAND }}>
          <button title="Alejar" onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))} style={iconBtn(false)}><ZoomOut size={16} /></button>
          <button onClick={() => setZoom(1)} style={{ fontSize: 11, color: C.inkSoft, width: 42, textAlign: "center", background: "none", border: "none", cursor: "pointer", fontVariantNumeric: "tabular-nums" }}>{Math.round(zoom * 100)}%</button>
          <button title="Acercar" onClick={() => setZoom((z) => Math.min(3, z + 0.15))} style={iconBtn(false)}><ZoomIn size={16} /></button>
          <div style={{ width: 1, height: 18, background: C.lineSoft, margin: "0 4px" }} />
          <span style={{ fontSize: 9.5, color: C.muted, textTransform: "uppercase", fontWeight: 700 }}>Plano</span>
          <input type="range" min={0.12} max={1} step={0.04} value={underOpacity} onChange={(e) => setUnderOpacity(+e.target.value)} style={{ width: 80 }} />
        </div>

        {/* Bammy chiquito animado (abajo-izq) */}
        <button onClick={() => setChatOpen(true)} title="Chatear con Bammy" style={{ position: "absolute", bottom: 16, left: 16, zIndex: 20, display: "flex", alignItems: "center", gap: 8, padding: "6px 10px 6px 6px", cursor: "pointer", ...ISLAND }}>
          <span style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", background: `radial-gradient(circle at 35% 30%, ${C.bammy}55, ${C.bammy}22)`, border: `1px solid ${C.bammy}66`, animation: "taller-morph 7s ease-in-out infinite, taller-float 4.5s ease-in-out infinite" }}><Bot size={15} style={{ color: C.bammy }} /></span>
          <span style={{ textAlign: "left", lineHeight: 1.15 }}>
            <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.ink }}>Bammy</span>
            <span style={{ display: "block", fontSize: 9.5, color: C.muted }}>{chatBusy ? "pensando…" : "hablá conmigo"}</span>
          </span>
        </button>

        {/* panel de corrección (cerrable) */}
        {notesOpen && (
          <div style={{ position: "absolute", top: 16, right: 16, zIndex: 25, width: 258, padding: 12, display: "flex", flexDirection: "column", gap: 9, ...ISLAND }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 9.5, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>Corrección para Bammy</span>
              <button onClick={() => setNotesOpen(false)} style={{ ...iconBtn(false), width: 22, height: 22, color: C.muted }}><X size={14} /></button>
            </div>
            <textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Qué está bien, qué corregir y por qué…" style={{ width: "100%", minHeight: 120, resize: "vertical", padding: 9, border: `1px solid ${C.lineSoft}`, borderRadius: 2, fontSize: 12, fontFamily: "inherit", lineHeight: 1.45, background: C.surface, color: C.ink }} />
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setVeredicto("aprobado")} style={{ flex: 1, padding: "6px 0", fontSize: 11, fontWeight: 600, background: veredicto === "aprobado" ? C.green : C.surface, color: veredicto === "aprobado" ? "#fff" : C.inkSoft, border: `1px solid ${C.lineSoft}`, borderRadius: 2, cursor: "pointer" }}>Aprobado</button>
              <button onClick={() => setVeredicto("a_corregir")} style={{ flex: 1, padding: "6px 0", fontSize: 11, fontWeight: 600, background: veredicto === "a_corregir" ? C.brick : C.surface, color: veredicto === "a_corregir" ? "#fff" : C.inkSoft, border: `1px solid ${C.lineSoft}`, borderRadius: 2, cursor: "pointer" }}>A corregir</button>
            </div>
            <button onClick={guardar} disabled={saving || !unit} style={{ padding: "10px 0", border: "none", borderRadius: 2, background: unit ? C.navy : C.line, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: unit ? "pointer" : "default" }}>{saving ? "Guardando…" : saved ? "✓ Enviado a Bammy" : "Guardar corrección"}</button>
            {saved && <div style={{ fontSize: 10.5, color: C.muted }}>Bammy la leerá en su próxima corrida.</div>}
            {err && unit && <div style={{ color: C.brick, fontSize: 11 }}>{err}</div>}
          </div>
        )}

        {/* chat con Bammy (slide-over der) */}
        {chatOpen && (
          <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, zIndex: 30, width: 320, maxWidth: "88%", background: C.paper, borderLeft: `1px solid ${C.line}`, display: "flex", flexDirection: "column", boxShadow: "-6px 0 20px rgba(0,0,0,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: `1px solid ${C.lineSoft}` }}>
              <span style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", background: C.bammy + "22", border: `1px solid ${C.bammy}55`, animation: "taller-morph 7s ease-in-out infinite" }}><Bot size={13} style={{ color: C.bammy }} /></span>
              <span style={{ fontSize: 12.5, fontWeight: 700, flex: 1 }}>Bammy</span>
              <button onClick={() => setChatOpen(false)} style={{ ...iconBtn(false), width: 24, height: 24, color: C.muted }}><X size={15} /></button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {chat.length === 0 && <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>Hola Sebastián. Preguntame lo que quieras sobre distribución — un parti, por qué elegí algo, o cómo mejorar una planta.</div>}
              {chat.map((m, i) => (
                <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "88%", padding: "7px 10px", borderRadius: 8, fontSize: 12.5, lineHeight: 1.45, whiteSpace: "pre-wrap", background: m.role === "user" ? C.navy : C.surface, color: m.role === "user" ? "#fff" : C.ink, border: m.role === "user" ? "none" : `1px solid ${C.lineSoft}` }}>{m.content}</div>
              ))}
              {chatBusy && <div style={{ alignSelf: "flex-start", fontSize: 12, color: C.muted }}>Bammy está pensando…</div>}
              <div ref={chatEndRef} />
            </div>
            <div style={{ display: "flex", gap: 6, padding: 10, borderTop: `1px solid ${C.lineSoft}` }}>
              <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }} placeholder="Escribile a Bammy…" style={{ flex: 1, padding: "8px 10px", border: `1px solid ${C.lineSoft}`, borderRadius: 2, fontSize: 12.5, background: C.surface, color: C.ink, fontFamily: "inherit" }} />
              <button onClick={sendChat} disabled={chatBusy || !chatInput.trim()} style={{ ...iconBtn(false), width: 36, height: 36, background: C.navy, color: "#fff", opacity: chatBusy || !chatInput.trim() ? 0.5 : 1 }}><Send size={15} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
