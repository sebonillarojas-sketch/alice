import { useState, useRef, useEffect, useCallback, useMemo, lazy, Suspense, Component, Fragment } from "react";
import {
  MousePointer2, PenLine, Trash2, Undo2, Redo2, Download,
  Magnet, Ruler, Maximize2, Sparkles, Plus, RotateCw, X,
  Upload, Crosshair, RefreshCw, MessageCircle, Box, Sword, StickyNote,
} from "lucide-react";
import {
  GRID, snapPt, ortho, dist, area, centroid, perimeter,
  pointInPolygon, nearestVertex, bbox,
  offsetEdges, orientedFrame, isConvex,
} from "./geometry.js";
import { CATALOGO, porId, CATS } from "./mobiliario.js";
import { Simbolo } from "./simbolos.jsx";
import { generarDistribuciones, amoblarParti, esDeposito } from "./plantas.js";
import { amoblarDorm, amoblarBano, amoblarCocina, amoblarSocial, it as furnIt, layout as feydLayout, layoutProfundo as feydLayoutProfundo } from "./distribucion.js";

// Repositorio de ambientes amueblados — se insertan sueltos en el lienzo (polígono + mobiliario).
// Reusa el motor de amoblado (amoblar*) + el catálogo. Cada uno respeta holguras Neufert.
const AMBIENTES_LIB = [
  { id: "sala",       label: "Sala",       name: "sala",         tipo: "social",   w: 3.8, h: 4.2, furnish: (R) => amoblarSocial(R, "C") },
  { id: "comedor",    label: "Comedor",    name: "comedor",      tipo: "social",   w: 3.2, h: 3.4, furnish: (R) => [furnIt("comedor-6", R.x + R.w / 2, R.y + R.h / 2, 0)] },
  { id: "habitacion", label: "Habitación", name: "dormitorio",   tipo: "intima",   w: 3.3, h: 3.6, furnish: (R) => amoblarDorm(R, true, "hall-abajo", "arriba", "C") },
  { id: "bano",       label: "Baño",       name: "baño",         tipo: "servicio", w: 1.6, h: 2.6, furnish: (R) => amoblarBano(R, true, { wall: "top" }) },
  { id: "cocina",     label: "Cocina",     name: "cocina",       tipo: "servicio", w: 2.4, h: 3.2, furnish: (R) => amoblarCocina(R, "C") },
  { id: "closet",     label: "Clóset",     name: "clóset",       tipo: "servicio", w: 2.0, h: 0.9, furnish: (R) => [furnIt("closet", R.x + R.w / 2, R.y + R.h / 2, 0, { w: R.w - 0.1 })] },
  { id: "lavanderia", label: "Lavandería", name: "lavandería",   tipo: "servicio", w: 1.8, h: 2.0, furnish: (R) => [furnIt("lavanderia", R.x + R.w / 2, R.y + R.h / 2, 0)] },
];

// ── Dibujo (whiteboard) estilo Diagramatic: variantes de lápiz, formas y colores ──
const PEN_VARIANTS = [
  { id: "pencil", label: "Lápiz", w: 1.6, opacity: 0.95 },
  { id: "marker", label: "Plumón", w: 4.5, opacity: 0.6 },
  { id: "fine", label: "Fino", w: 0.8, opacity: 1 },
  { id: "highlighter", label: "Resaltador", w: 12, opacity: 0.28 },
];
const DIBUJO_TOOLS = [
  { id: "draw", label: "Lápiz", ico: "✏️" },
  { id: "line", label: "Línea", ico: "╱" },
  { id: "arrow", label: "Flecha", ico: "↗" },
  { id: "rect", label: "Rectángulo", ico: "▭" },
  { id: "ellipse", label: "Elipse", ico: "◯" },
  { id: "erase", label: "Goma", ico: "◇" },
];
const DIBUJO_COLORS = ["#F7643B", "#3D52D5", "#0A0B0F", "#5F8A6A", "#C2A45A", "#A85B5B", "#9BCBE3", "#A89BD9"];

// Panel de dibujo a la IZQUIERDA (como Diagramatic): herramientas + variantes de trazo + colores.
function DibujoPalette({ tool, setTool, penVariant, setPenVariant, penColor, setPenColor, onClear, onClose, hayTrazos }) {
  const btn = (active) => ({ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 9px", fontSize: 12, textAlign: "left", border: `1px solid ${active ? "#0A0B0F" : "#d9d5cd"}`, borderRadius: 4, background: active ? "#1E2A4A" : "#F4F1EA", color: active ? "#fff" : "#0A0B0F", cursor: "pointer", fontWeight: active ? 600 : 500 });
  return (
    <div style={{ position: "absolute", left: 12, top: 60, width: 150, background: "#fff", border: "1px solid #d9d5cd", borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.14)", zIndex: 41, padding: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6B6863" }}>Dibujo</span>
        <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: "#6B6863", fontSize: 13 }}>✕</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {DIBUJO_TOOLS.map((t) => (
          <button key={t.id} onClick={() => setTool(t.id)} style={btn(tool === t.id)}>
            <span style={{ width: 16, textAlign: "center" }}>{t.ico}</span>{t.label}
          </button>
        ))}
      </div>
      {tool === "draw" && (
        <>
          <div style={{ fontSize: 9.5, color: "#6B6863", margin: "10px 0 5px", letterSpacing: "0.06em", textTransform: "uppercase" }}>Trazo</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {PEN_VARIANTS.map((v) => (
              <button key={v.id} onClick={() => setPenVariant(v.id)} style={{ ...btn(penVariant === v.id), justifyContent: "space-between" }}>
                {v.label}<span style={{ width: 34, height: Math.max(2, v.w), background: penVariant === v.id ? "#fff" : penColor, opacity: v.opacity, borderRadius: 3 }} />
              </button>
            ))}
          </div>
        </>
      )}
      {tool !== "erase" && (
        <>
          <div style={{ fontSize: 9.5, color: "#6B6863", margin: "10px 0 5px", letterSpacing: "0.06em", textTransform: "uppercase" }}>Color</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {DIBUJO_COLORS.map((c) => (
              <button key={c} onClick={() => setPenColor(c)} title="Color" style={{ width: 22, height: 22, borderRadius: 999, background: c, border: penColor === c ? "2px solid #0A0B0F" : "1px solid #d9d5cd", cursor: "pointer", padding: 0 }} />
            ))}
          </div>
        </>
      )}
      {hayTrazos && <button onClick={onClear} style={{ ...btn(false), marginTop: 10, justifyContent: "center", color: "#A85B5B" }}>Borrar todo</button>}
    </div>
  );
}

function RepoAmbientesPanel({ onAdd, onClose }) {
  return (
    <div style={{ position: "absolute", right: 12, top: 60, width: 210, background: "#fff", border: "1px solid #d9d5cd", borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.14)", zIndex: 40, padding: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6B6863" }}>Ambientes</span>
        <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: "#6B6863", fontSize: 13 }}>✕</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {AMBIENTES_LIB.map((a) => (
          <button key={a.id} onClick={() => onAdd(a)}
            style={{ padding: "9px 6px", fontSize: 11.5, border: "1px solid #d9d5cd", borderRadius: 4, background: "#F4F1EA", cursor: "pointer", color: "#0A0B0F", fontWeight: 600, textAlign: "center" }}>
            {a.label}
            <div style={{ fontSize: 9, color: "#6B6863", fontWeight: 400, marginTop: 2 }}>{a.w}×{a.h} m</div>
          </button>
        ))}
      </div>
      <div style={{ fontSize: 9.5, color: "#6B6863", marginTop: 8, lineHeight: 1.45 }}>Inserta el ambiente amueblado al centro del lienzo. Arrastrable y editable.</div>
    </div>
  );
}

// Configurador por tipología: elegís el programa con botones y ensambla la planta desde la librería.
function ConfigTipologiaPanel({ onArmar, onClose }) {
  const DEF = { dorms: 2, banos: 2, visita: false, closet: true, cocinaCerrada: true, lavanderia: true };
  const LABELS = ["A", "B", "C"];
  const [slots, setSlots] = useState([{ ...DEF }, { ...DEF }, { ...DEF }]);
  const [active, setActive] = useState(0);
  const p = slots[active];
  const upd = (k, v) => setSlots((arr) => arr.map((sl, i) => (i === active ? { ...sl, [k]: v } : sl)));
  const row = { display: "flex", justifyContent: "space-between", alignItems: "center", margin: "7px 0", fontSize: 12, color: "#0A0B0F" };
  const step = { width: 24, height: 24, border: "1px solid #d9d5cd", borderRadius: 4, background: "#F4F1EA", cursor: "pointer", fontWeight: 700, color: "#0A0B0F", lineHeight: "20px" };
  const Counter = ({ k, min = 0, max = 6 }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button style={step} onClick={() => upd(k, Math.max(min, p[k] - 1))}>−</button>
      <span style={{ minWidth: 16, textAlign: "center", fontWeight: 700 }}>{p[k]}</span>
      <button style={step} onClick={() => upd(k, Math.min(max, p[k] + 1))}>+</button>
    </div>
  );
  const Tog = ({ k, on = "Sí", off = "No" }) => (
    <button onClick={() => upd(k, !p[k])} style={{ border: "1px solid #d9d5cd", borderRadius: 4, background: p[k] ? "#1E2A4A" : "#F4F1EA", color: p[k] ? "#fff" : "#0A0B0F", fontSize: 11, padding: "4px 12px", cursor: "pointer", fontWeight: 600 }}>{p[k] ? on : off}</button>
  );
  return (
    <div style={{ position: "absolute", right: 12, top: 60, width: 252, background: "#fff", border: "1px solid #d9d5cd", borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.14)", zIndex: 40, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6B6863" }}>Configurar tipologías</span>
        <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: "#6B6863", fontSize: 13 }}>✕</button>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {LABELS.map((L, i) => (
          <button key={L} onClick={() => setActive(i)} style={{ flex: 1, padding: "6px 0", fontSize: 11, fontWeight: 700, border: "1px solid #d9d5cd", borderRadius: 4, background: i === active ? "#1E2A4A" : "#F4F1EA", color: i === active ? "#fff" : "#0A0B0F", cursor: "pointer" }}>Tipo {L}</button>
        ))}
      </div>
      <div style={row}><span>Habitaciones</span><Counter k="dorms" min={1} max={5} /></div>
      <div style={row}><span>Baños</span><Counter k="banos" min={1} max={4} /></div>
      <div style={row}><span>Baño de visita</span><Tog k="visita" /></div>
      <div style={row}><span>Clóset (walk-in)</span><Tog k="closet" /></div>
      <div style={row}><span>Lavandería</span><Tog k="lavanderia" /></div>
      <div style={row}><span>Cocina</span><button onClick={() => upd("cocinaCerrada", !p.cocinaCerrada)} style={{ border: "1px solid #d9d5cd", borderRadius: 4, background: "#F4F1EA", color: "#0A0B0F", fontSize: 11, padding: "4px 12px", cursor: "pointer", fontWeight: 600 }}>{p.cocinaCerrada ? "Cerrada" : "Abierta"}</button></div>
      <button onClick={() => onArmar(p, "Tipo " + LABELS[active])} style={{ width: "100%", marginTop: 10, padding: "9px 0", background: "#F7643B", color: "#fff", border: "none", borderRadius: 4, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Armar Tipo {LABELS[active]}</button>
      <div style={{ fontSize: 9.5, color: "#6B6863", marginTop: 8, lineHeight: 1.4 }}>Configurá A/B/C una por una y armá cada tipología: se agrega al lienzo etiquetada (Tipo A/B/C), debajo de la anterior. Después las movés y ajustás a mano.</div>
    </div>
  );
}

// ── Visor de Tipologías Nexo: Feyd redibuja las tipologías del mercado (TIPOLOGIAS de tipologias.js,
// derivadas del scraping de Nexo) con su motor layout(), identificando ambientes (nombre + tamaño). ──
const _areaPoly = (pts) => { let s = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a.x * b.y - b.x * a.y; } return Math.abs(s) / 2; };
const _ZC = { social: "#3D52D5", intima: "#A89BD9", servicio: "#C2A45A", baño: "#C2A45A" };
function MiniPlano({ L, W, D }) {
  if (!L || !L.rooms?.length) return <div style={{ fontSize: 10, color: "#6B6863", padding: "12px 0", textAlign: "center" }}>sin distribución</div>;
  const S = Math.min(232 / W, 168 / D);
  const w = W * S, h = D * S;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto", background: "#fff", border: "1px solid #d9d5cd", borderRadius: 4 }}>
      {L.rooms.map((r, i) => {
        const pts = r.pts.map((p) => `${p.x * S},${p.y * S}`).join(" ");
        const cx = r.pts.reduce((a, p) => a + p.x, 0) / r.pts.length * S;
        const cy = r.pts.reduce((a, p) => a + p.y, 0) / r.pts.length * S;
        const ar = _areaPoly(r.pts);
        const col = _ZC[r.zona || r.tipo] || "#C2A45A";
        const nm = (r.name || "").replace("dormitorio", "dorm.").replace(" principal", " ppal");
        return (
          <g key={i}>
            <polygon points={pts} fill={col + "22"} stroke={col} strokeWidth="0.7" />
            <text x={cx} y={cy - 1} textAnchor="middle" fontSize="6.4" fontWeight="600" fill="#0A0B0F">{nm}</text>
            <text x={cx} y={cy + 7} textAnchor="middle" fontSize="5.4" fill="#6B6863">{ar.toFixed(1)} m²</text>
          </g>
        );
      })}
      {/* mobiliario + puertas → muestra la distribución real, no solo cajas */}
      {(L.items || []).map((it2, i) => {
        const esPuerta = /puerta|vano/.test(it2.ref || "");
        const w = (it2.w || 0.6) * S, d = (it2.d || 0.6) * S;
        const x = it2.x * S, y = it2.y * S;
        if (esPuerta) return <circle key={"i" + i} cx={x} cy={y} r={1.6} fill="#5F8A6A" />;
        return <rect key={"i" + i} x={-w / 2} y={-d / 2} width={w} height={d} rx={0.8} fill="#0A0B0F" opacity="0.14" transform={`translate(${x} ${y}) rotate(${it2.rot || 0})`} />;
      })}
    </svg>
  );
}
function TipologiasNexoPanel({ onInsert, onClose }) {
  const cards = useMemo(() => TIPOLOGIAS.map((t) => {
    const aIdeal = t.area[1];
    const W = Math.max(t.frenteMin, 6);
    const D = Math.max(4, Math.round((aIdeal / W) * 10) / 10);
    const opts = { visita: t.banos >= 3 };
    let L = null;
    try { L = feydLayout(W, D, t.dorms, t.banos, opts); } catch { L = null; }
    if (!L || !L.rooms?.length) { try { L = feydLayoutProfundo(W, D, t.dorms, t.banos, opts); } catch { L = null; } } // fallback si el motor plano no arma
    return { t, L, W, D };
  }), []);
  return (
    <div style={{ position: "absolute", right: 12, top: 60, bottom: 12, width: 288, background: "#fff", border: "1px solid #d9d5cd", borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.14)", zIndex: 40, padding: 12, overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6B6863" }}>Tipologías</span>
        <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: "#6B6863", fontSize: 13 }}>✕</button>
      </div>
      <div style={{ fontSize: 9.5, color: "#6B6863", marginBottom: 10, lineHeight: 1.4 }}>{cards.length} tipologías de TODOS los tamaños (22–210 m²), redibujadas por Feyd. Click para insertarla en el lienzo.</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {cards.map(({ t, L, W, D }, idx) => (
          <Fragment key={t.id}>
          {(idx === 0 || cards[idx - 1].t.dorms !== t.dorms) && (
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#1E2A4A", marginTop: idx ? 6 : 0, borderBottom: "1px solid #d9d5cd", paddingBottom: 3 }}>
              {t.dorms === 1 ? "Studios / 1 dormitorio" : `${t.dorms} dormitorios`}
            </div>
          )}
          <div style={{ border: "1px solid #d9d5cd", borderRadius: 5, padding: 8, background: "#F4F1EA" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#0A0B0F" }}>{t.nombre}</span>
              <span style={{ fontSize: 9, color: "#6B6863" }}>{t.peso}% mdo</span>
            </div>
            <MiniPlano L={L} W={W} D={D} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
              <span style={{ fontSize: 9.5, color: "#6B6863", fontFamily: "ui-monospace, monospace" }}>{t.dorms}D · {t.banos}B · {t.area[1]} m²</span>
              <button onClick={() => onInsert(L, t)} disabled={!L} style={{ fontSize: 10, fontWeight: 700, padding: "4px 10px", border: "none", borderRadius: 3, background: L ? "#F7643B" : "#ccc", color: "#fff", cursor: L ? "pointer" : "default" }}>Insertar</button>
            </div>
          </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
import { validarPlan } from "./validacion.js";

const Vista3D = lazy(() => import("./Vista3D.jsx"));
class Vista3DBoundary extends Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (this.state.err) return <div style={{ padding: 14, fontFamily: "monospace", fontSize: 10, color: "#B23", whiteSpace: "pre-wrap", overflow: "auto", height: "100%" }}>{"⚠ 3D falló\n" + String(this.state.err?.message || this.state.err)}</div>;
    return this.props.children;
  }
}
import { tipologiasCandidatas, porTipologia, TIPOLOGIAS } from "./tipologias.js";
import { laminaSVG } from "./lamina.js";
import { BamLogo } from "./marca.jsx";
import { aliciaAnalyze } from "../../lib/alicia.js";
import { corregirConFeyd, reanclarItems, disenarConFeyd } from "./feyd.js";
import ProyectoTabs from "../cabida/ProyectoTabs.jsx";
import { useProyectos } from "../cabida/proyectos.js";
import { clasificarBordes } from "../cabida/loteReal.js";

const FICHA_DEF = {
  proyecto: "Nuevo proyecto", tipo: "Edificio Multifamiliar", ubicacion: "", cliente: "",
  observaciones: "", responsable: "", cap: "", desarrollo: "Hygge · BAM",
  plano: "Planta de distribución", escala: "1:75", fecha: "", lamina: "A-01",
};

const C = {
  ink: "#373737",
  peri: "#95ABE8",
  orange: "#F7643B",
  paper: "#EFEDE8",
  card: "#FFFFFF",
  line: "#E4E2DC",
  soft: "#9B998F",
};
const mono = "'JetBrains Mono', 'SF Mono', Menlo, monospace";
const sans = "'Hanken Grotesk', 'Helvetica Neue', sans-serif";
const STORE = "hygge:editorPlanos";
const BRIEF_KEY = "hygge:planBrief";

const fmt = (n, d = 0) =>
  n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

// estilo de plano BAM: ambientes en blanco, solo el core en poché oscuro
const roomFill = (r) => (r.tipo === "core" ? "#4A4A4A" : C.card);

let _id = 1;
const uid = () => `r${_id++}`;

const Btn = ({ active, onClick, title, children, disabled, accent }) => (
  <button onClick={onClick} title={title} disabled={disabled}
    style={{
      display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 10px",
      fontFamily: mono, fontSize: 11, cursor: disabled ? "default" : "pointer",
      color: active ? C.card : disabled ? C.line : accent ? C.card : C.ink,
      background: active ? C.ink : accent ? C.orange : C.card,
      border: `1px solid ${active ? C.ink : accent ? C.orange : C.line}`,
      borderRadius: 2, opacity: disabled ? 0.5 : 1,
    }}>
    {children}
  </button>
);

// menú desplegable para agrupar botones y no saturar la toolbar
function ToolMenu({ label, icon, children, width = 172 }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, [open]);
  return (
    <span ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <Btn active={open} onClick={() => setOpen((o) => !o)}>{icon}{label} ▾</Btn>
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 50, background: C.card, border: `1px solid ${C.line}`, borderRadius: 4, boxShadow: "0 10px 28px rgba(0,0,0,0.16)", padding: 6, display: "flex", flexDirection: "column", gap: 4, minWidth: width }}>
          {children}
        </div>
      )}
    </span>
  );
}

// ── preview miniatura de una variante ─────────────────────────
function VariantPreview({ v, W = 236, H = 170 }) {
  const all = v.rooms.flatMap((r) => r.pts);
  const b = bbox(all);
  const w = Math.max(b.maxX - b.minX, 1), h = Math.max(b.maxY - b.minY, 1);
  const k = Math.min((W - 18) / w, (H - 18) / h);
  const tx = (W - w * k) / 2 - b.minX * k, ty = (H - h * k) / 2 - b.minY * k;
  const T = (p) => ({ x: p.x * k + tx, y: p.y * k + ty });
  return (
    <svg width={W} height={H} style={{ display: "block", background: C.card, borderRadius: 2 }}>
      {v.rooms.map((r, i) => (
        <polygon key={r.id} points={r.pts.map(T).map((p) => `${p.x},${p.y}`).join(" ")}
          fill={roomFill(r, i)} stroke={C.ink} strokeWidth={1.4} strokeLinejoin="round" />
      ))}
      {(v.items || []).map((t) => {
        const s = T({ x: t.x, y: t.y });
        return <Simbolo key={t.id} it={t} px={s.x} py={s.y} k={k} selected={false} />;
      })}
    </svg>
  );
}

// ── librería de mobiliario ────────────────────────────────────
function LibPanel({ onAdd, onClose }) {
  return (
    <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 210, background: C.paper,
      borderLeft: `1px solid ${C.line}`, overflowY: "auto", zIndex: 20, padding: "10px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontFamily: sans, fontSize: 11, fontWeight: 800, textTransform: "lowercase", color: C.ink }}>mobiliario</span>
        <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer" }}>
          <X size={13} color={C.soft} />
        </button>
      </div>
      {CATS.map((cat) => (
        <div key={cat} style={{ marginBottom: 10 }}>
          <div style={{ fontFamily: mono, fontSize: 9, color: C.orange, marginBottom: 4 }}>{cat}</div>
          {CATALOGO.filter((c) => c.cat === cat).map((c) => (
            <button key={c.id} onClick={() => onAdd(c.id)}
              style={{ display: "flex", justifyContent: "space-between", width: "100%", fontFamily: mono,
                fontSize: 10.5, color: C.ink, background: C.card, border: `1px solid ${C.line}`,
                borderRadius: 2, padding: "5px 8px", marginBottom: 3, cursor: "pointer", textAlign: "left" }}>
              <span>{c.nombre}</span>
              <span style={{ color: C.soft }}>{c.w}×{c.d}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

// contenedor común de los modales de pasos
function Modal({ children, onClose, maxWidth = 1180 }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(55,55,55,0.35)", zIndex: 50,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 3, maxWidth,
          maxHeight: "92%", overflow: "auto", padding: "20px 24px", boxShadow: "0 12px 40px rgba(0,0,0,0.25)" }}>
        {children}
      </div>
    </div>
  );
}

const inputStyle = { fontFamily: mono, fontSize: 12, fontWeight: 600, color: C.ink, width: 54, textAlign: "right", border: `1px solid ${C.line}`, borderRadius: 2, background: C.card, outline: "none", padding: "4px 6px" };
const labelStyle = { display: "flex", alignItems: "baseline", gap: 5, fontFamily: mono, fontSize: 11, color: C.soft };

// ── PASO 2 · distribución: elegir el parti de la planta (sin tipologías aún) ──
function DistribModal({ partis, brief, setBrief, onUse, onRegen, onClose, loteInfo }) {
  const setB = (k, v) => setBrief((b) => ({ ...b, [k]: v }));
  return (
    <Modal onClose={onClose}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
        <span style={{ fontFamily: mono, fontSize: 10, color: C.orange }}>2</span>
        <h2 style={{ fontFamily: sans, fontSize: 13, fontWeight: 800, letterSpacing: "0.06em", textTransform: "lowercase", color: C.ink, margin: 0 }}>
          distribución de la planta
        </h2>
        <span style={{ fontFamily: mono, fontSize: 9.5, color: C.soft }}>{loteInfo}</span>
        <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer" }}>
          <X size={15} color={C.soft} />
        </button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 18px", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.line}`, marginBottom: 14 }}>
        <label style={labelStyle}>uds/piso
          <input type="number" value={brief.udsPiso} step={1} min={1} onChange={(e) => setB("udsPiso", parseInt(e.target.value) || 1)} style={inputStyle} /></label>
        <label style={labelStyle}>área objetivo
          <input type="number" value={brief.areaObjetivo} step={5} min={25} onChange={(e) => setB("areaObjetivo", parseInt(e.target.value) || 25)} style={inputStyle} /> m²</label>
        <label style={labelStyle}>1D%
          <input type="number" value={brief.pct1} step={5} min={0} max={100} onChange={(e) => setB("pct1", parseInt(e.target.value) || 0)} style={inputStyle} /></label>
        <label style={labelStyle}>2D%
          <input type="number" value={brief.pct2} step={5} min={0} max={100} onChange={(e) => setB("pct2", parseInt(e.target.value) || 0)} style={inputStyle} /></label>
        <span style={{ fontFamily: mono, fontSize: 10, color: C.soft }}>3D {Math.max(0, 100 - brief.pct1 - brief.pct2)}%</span>
        <Btn onClick={onRegen} accent title="Regenerar distribuciones"><Sparkles size={13} /> regenerar</Btn>
      </div>
      {!partis.length && (
        <div style={{ fontFamily: mono, fontSize: 11, color: C.soft, padding: 20 }}>
          el footprint no admite unidades — revisa retiros/frente o reduce uds/piso
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        {partis.map((v, i) => (
          <div key={v.id} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 3, padding: 10 }}>
            <VariantPreview v={v} W={280} H={190} />
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
              <span style={{ fontFamily: mono, fontSize: 10, color: C.orange }}>{i + 1}</span>
              <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 800, textTransform: "lowercase", color: C.ink }}>{v.nombre}</span>
              <span style={{ fontFamily: mono, fontSize: 10, color: C.soft }}>{v.stats.uds} uds</span>
            </div>
            {v.notas.slice(0, 3).map((n, j) => (
              <div key={j} style={{ fontFamily: mono, fontSize: 9, color: C.soft, lineHeight: 1.5 }}>· {n}</div>
            ))}
            <button onClick={() => onUse(v)}
              style={{ marginTop: 8, width: "100%", fontFamily: mono, fontSize: 11, color: C.card,
                background: C.orange, border: "none", borderRadius: 2, padding: "7px 0", cursor: "pointer" }}>
              elegir esta → 3 · tipologías
            </button>
          </div>
        ))}
      </div>
    </Modal>
  );
}

// ── PASO 3 · tipologías: elegir la tipología POR BLOQUE entre candidatas
//    y hacerle tweaks (baños, NSE, terraza) con preview en vivo ──
function TipoModal({ parti, brief, setBrief, onAplicar, onClose, loteInfo }) {
  const setB = (k, v) => setBrief((b) => ({ ...b, [k]: v }));
  const [alicia, setAlicia] = useState(null);
  const [overrides, setOverrides] = useState({});   // { unitId: { tipologiaId, banos } }
  const unidades = parti.res.units.filter((u) => !esDeposito(u));
  // recortes chicos → solo cabe studio; cambiar dorms/½visita no hace nada aquí
  const soloStudio = unidades.length > 0 && unidades.every((u) => u.areaReal < 42);
  const setOv = (id, k, v) => setOverrides((o) => ({ ...o, [id]: { ...o[id], [k]: v } }));
  // el amoblado se recalcula al cambiar tipología/baños/NSE/terraza
  const amoblado = (() => { try { return amoblarParti(parti, brief, overrides); } catch { return null; } })();
  const consultar = async () => {
    if (!amoblado) return;
    setAlicia("cargando");
    try {
      const text = await aliciaAnalyze({
        system: "Sos Alicia, arquitecta senior de BAM (vivienda multifamiliar en Lima). Evaluás una planta típica amoblada con criterio de diseño, RNE A.010/A.020 y mercado limeño. Respondé en máx. 6 líneas: qué está bien, qué ajustarías y si el NSE/mix calza con la ubicación.",
        prompt: `Lote: ${loteInfo}. Parti: ${parti.nombre}. NSE ${brief.nse}, terraza ${brief.terraza ? "sí" : "no"}.\nResultado: ${amoblado.notas.join(" | ")}`,
        max_tokens: 500,
      });
      setAlicia(text || "sin respuesta");
    } catch (e) { setAlicia(`no se pudo consultar: ${e.message}`); }
  };
  return (
    <Modal onClose={onClose} maxWidth={860}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
        <span style={{ fontFamily: mono, fontSize: 10, color: C.orange }}>3</span>
        <h2 style={{ fontFamily: sans, fontSize: 13, fontWeight: 800, letterSpacing: "0.06em", textTransform: "lowercase", color: C.ink, margin: 0 }}>
          tipologías · {parti.nombre}
        </h2>
        <span style={{ fontFamily: mono, fontSize: 9.5, color: C.soft }}>{loteInfo}</span>
        <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer" }}>
          <X size={15} color={C.soft} />
        </button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 18px", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.line}`, marginBottom: 14 }}>
        <label style={labelStyle}>NSE
          <select value={brief.nse} onChange={(e) => setB("nse", e.target.value)} style={{ ...inputStyle, width: 48, textAlign: "left" }}>
            {["A", "B", "C", "D"].map((n) => <option key={n} value={n}>{n}</option>)}
          </select></label>
        <label style={{ ...labelStyle, cursor: "pointer" }}>
          <input type="checkbox" checked={!!brief.terraza} onChange={(e) => setB("terraza", e.target.checked)} />
          terraza + jardineras a fachada
        </label>
        <Btn onClick={consultar} disabled={alicia === "cargando"} title="Pedir opinión al agente (Alicia)">
          <MessageCircle size={13} /> {alicia === "cargando" ? "consultando…" : "opinión de alicia"}
        </Btn>
      </div>
      {soloStudio && (
        <div style={{ fontFamily: mono, fontSize: 10.5, color: C.orange, background: "#FFF4F0", border: `1px solid ${C.orange}`,
          borderRadius: 3, padding: "8px 10px", marginBottom: 12, lineHeight: 1.5 }}>
          ▲ recortes de ~{Math.round(unidades[0]?.areaReal || 0)} m² → solo cabe studio. Cambiar dorms / ½ visita no hará efecto aquí.
          Volvé al <b>paso 2 · distribución</b> y bajá <b>uds/piso</b> para depas más grandes (2–3 dorm).
        </div>
      )}

      {/* tipología POR BLOQUE: candidatas ordenadas por calce + tweak de baños */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: "6px 18px", marginBottom: 14 }}>
        {unidades.map((u, i) => {
          const W = u.frame.ub - u.frame.ua;
          const cands = tipologiasCandidatas(u.areaReal, W, 4);
          const sel = overrides[u.id]?.tipologiaId || u.tipologia?.id || cands[0].id;
          const tSel = porTipologia[sel] || cands[0];
          return (
            <div key={u.id} style={{ display: "flex", alignItems: "baseline", gap: 8, fontFamily: mono, fontSize: 10.5, color: C.soft }}>
              <span style={{ color: C.orange, fontWeight: 700 }}>{i + 1}</span>
              <span style={{ minWidth: 92 }}>{fmt(W, 1)}×{fmt(u.frame.v1 - u.frame.v0, 1)} · {fmt(u.areaReal, 0)} m²</span>
              <select value={sel} onChange={(e) => setOv(u.id, "tipologiaId", e.target.value)}
                style={{ ...inputStyle, width: "auto", textAlign: "left" }}>
                {cands.map((t) => (
                  <option key={t.id} value={t.id}>{t.dorms}D · {t.nombre} · ~{t.area[1]} m²</option>
                ))}
                {!cands.some((t) => t.id === sel) && <option value={sel}>{sel}</option>}
              </select>
              <label style={{ display: "flex", alignItems: "baseline", gap: 3 }}>baños
                <select value={overrides[u.id]?.banos ?? tSel.banos} onChange={(e) => setOv(u.id, "banos", parseInt(e.target.value))}
                  style={{ ...inputStyle, width: 42, textAlign: "left" }}>
                  {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
                </select></label>
              <label style={{ display: "flex", alignItems: "center", gap: 3, cursor: "pointer" }} title="Agregar medio baño de visita (inodoro + lavamanos, sin ducha)">
                <input type="checkbox" checked={!!overrides[u.id]?.visita} onChange={(e) => setOv(u.id, "visita", e.target.checked)} />
                ½ visita
              </label>
            </div>
          );
        })}
      </div>
      {typeof alicia === "string" && alicia !== "cargando" && (
        <div style={{ fontFamily: mono, fontSize: 11, color: C.ink, background: C.card, border: `1px solid ${C.peri}`,
          borderLeft: `3px solid ${C.peri}`, borderRadius: 3, padding: "10px 12px", marginBottom: 14, whiteSpace: "pre-wrap", lineHeight: 1.55 }}>
          {alicia}
        </div>
      )}
      {amoblado ? (
        <>
          <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 3, padding: 10 }}>
            <VariantPreview v={amoblado} W={780} H={460} />
          </div>
          <div style={{ margin: "8px 2px" }}>
            {amoblado.notas.slice(0, 6).map((n, j) => (
              <div key={j} style={{ fontFamily: mono, fontSize: 9.5, color: C.soft, lineHeight: 1.6 }}>· {n}</div>
            ))}
          </div>
          <button onClick={() => onAplicar(amoblado)}
            style={{ width: "100%", fontFamily: mono, fontSize: 12, color: C.card,
              background: C.orange, border: "none", borderRadius: 2, padding: "9px 0", cursor: "pointer" }}>
            aplicar al plano →
          </button>
        </>
      ) : (
        <div style={{ fontFamily: mono, fontSize: 11, color: C.soft, padding: 20 }}>no se pudo amoblar este parti</div>
      )}
    </Modal>
  );
}

// ── modal del membrete (ficha técnica de la lámina) ───────────
function FichaModal({ ficha, setFicha, onClose }) {
  const F = (label, k, wide) => (
    <label style={{ display: "flex", flexDirection: "column", gap: 3, gridColumn: wide ? "1 / -1" : "auto" }}>
      <span style={{ fontFamily: sans, fontSize: 11, color: C.soft, textTransform: "lowercase" }}>{label}</span>
      <input value={ficha[k] || ""} onChange={(e) => setFicha((f) => ({ ...f, [k]: e.target.value }))}
        style={{ fontFamily: mono, fontSize: 12, color: C.ink, background: C.paper, border: `1px solid ${C.line}`, borderRadius: 2, padding: "6px 8px", outline: "none" }} />
    </label>
  );
  return (
    <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(55,55,55,0.35)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 3, width: 560, maxWidth: "100%", padding: "20px 24px", boxShadow: "0 12px 40px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <BamLogo height={16} />
          <h2 style={{ fontFamily: sans, fontSize: 13, fontWeight: 800, textTransform: "lowercase", color: C.ink, margin: 0 }}>membrete de la lámina</h2>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer" }}><X size={15} color={C.soft} /></button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {F("proyecto", "proyecto", true)}
          {F("tipo", "tipo")}
          {F("lámina", "lamina")}
          {F("ubicación", "ubicacion", true)}
          {F("cliente", "cliente")}
          {F("observaciones", "observaciones")}
          {F("profesional responsable", "responsable")}
          {F("C.A.P.", "cap")}
          {F("desarrollo", "desarrollo")}
          {F("plano", "plano")}
          {F("escala", "escala")}
          {F("fecha", "fecha")}
        </div>
        <button onClick={onClose} style={{ marginTop: 16, fontFamily: mono, fontSize: 11, color: C.card, background: C.ink, border: "none", borderRadius: 2, padding: "8px 16px", cursor: "pointer" }}>listo</button>
      </div>
    </div>
  );
}

// Wrapper: pestañas de proyecto (mismas que Cabida) + el editor keyed por proyecto.
// Al saltar de pestaña se re-lee el plano de ESE proyecto; el dibujo ya no se borra.
export default function EditorPlanos({ navigate }) {
  const { activo, store } = useProyectos();
  const guardar = useCallback((snap) => store.guardarPlano(activo.id, snap), [store, activo.id]);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 520 }}>
      <ProyectoTabs />
      <div style={{ flex: 1, minHeight: 0 }}>
        <EditorPlanosInner key={activo.id} proyecto={activo} onSavePlano={guardar} navigate={navigate} />
      </div>
    </div>
  );
}

// Panel lateral del paso 3: tocás un depto desnudo → variables → Feyd lo redibuja a ESE
// footprint (con puertas) → insertás. Después cada ambiente se puede redimensionar a mano.
function TipoUnitPanel({ W, D, busy, err, onAplicar, onClose }) {
  const [prog, setProg] = useState({ dorms: 2, banos: 2, visita: false, closet: false, lavanderia: true, cocinaCerrada: false });
  const L = useMemo(() => { try { return feydLayout(W, D, prog.dorms, prog.banos, { visita: prog.visita }); } catch { return null; } }, [prog]); // eslint-disable-line
  const upd = (k, v) => setProg((s) => ({ ...s, [k]: v }));
  const Tog = ({ k, on, off }) => (
    <button onClick={() => upd(k, !prog[k])} style={{ border: "1px solid #d9d5cd", borderRadius: 4, background: prog[k] ? "#1E2A4A" : "#F4F1EA", color: prog[k] ? "#fff" : "#0A0B0F", fontSize: 11, padding: "4px 12px", cursor: "pointer", fontWeight: 600, minWidth: 58 }}>{prog[k] ? (on || "Sí") : (off || "No")}</button>
  );
  const step = { width: 24, height: 24, border: "1px solid #d9d5cd", borderRadius: 4, background: "#F4F1EA", cursor: "pointer", fontWeight: 700, color: "#0A0B0F", lineHeight: "20px" };
  const row = { display: "flex", justifyContent: "space-between", alignItems: "center", margin: "7px 0", fontSize: 12, color: "#0A0B0F" };
  const Counter = ({ k, min, max }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button style={step} onClick={() => upd(k, Math.max(min, prog[k] - 1))}>−</button>
      <span style={{ minWidth: 16, textAlign: "center", fontWeight: 700 }}>{prog[k]}</span>
      <button style={step} onClick={() => upd(k, Math.min(max, prog[k] + 1))}>+</button>
    </div>
  );
  const areaU = W * D;
  return (
    <div style={{ position: "absolute", right: 12, top: 60, width: 272, background: "#fff", border: "1px solid #d9d5cd", borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.14)", zIndex: 41, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6B6863" }}>Tipología del depto</span>
        <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: "#6B6863", fontSize: 13 }}>✕</button>
      </div>
      <div style={{ fontSize: 10.5, color: "#6B6863", fontFamily: "ui-monospace, monospace", marginBottom: 8 }}>{W.toFixed(1)} × {D.toFixed(1)} m · {areaU.toFixed(0)} m²</div>
      <div style={row}><span>Dormitorios</span><Counter k="dorms" min={1} max={5} /></div>
      <div style={row}><span>Baños</span><Counter k="banos" min={1} max={4} /></div>
      <div style={row}><span>Baño de visita</span><Tog k="visita" /></div>
      <div style={row}><span>Clóset (walk-in)</span><Tog k="closet" /></div>
      <div style={row}><span>Lavandería</span><Tog k="lavanderia" /></div>
      <div style={row}><span>Cocina</span><Tog k="cocinaCerrada" on="Cerrada" off="Abierta" /></div>
      <div style={{ margin: "10px 0 6px", fontSize: 9.5, color: "#6B6863", letterSpacing: "0.06em", textTransform: "uppercase" }}>Borrador (previa rápida)</div>
      <MiniPlano L={L} W={W} D={D} />
      <button onClick={() => onAplicar(prog)} disabled={busy}
        style={{ width: "100%", marginTop: 10, padding: "9px 0", background: busy ? "#c9a99c" : "#F7643B", color: "#fff", border: "none", borderRadius: 4, fontWeight: 700, fontSize: 12, cursor: busy ? "wait" : "pointer" }}>
        {busy ? "Feyd está adaptando a la forma…" : "Insertar con Feyd (adapta a la forma)"}
      </button>
      {err && <div style={{ fontSize: 10, color: "#A85B5B", marginTop: 7, lineHeight: 1.4 }}>{err}</div>}
      <div style={{ fontSize: 9.5, color: "#6B6863", marginTop: 8, lineHeight: 1.4 }}>Feyd sigue la huella real (aunque sea irregular), ventila cada habitable, pone puertas y crece los ambientes en proporción. Después redimensionás cada uno arrastrando sus vértices.</div>
    </div>
  );
}

// VISOR del paso 3 (todo en una ventana grande):
// 1) ponés variables (dorms/baños/visita) → filtran las tipologías redibujadas que sirven.
// 2) elegís una → Feyd la ADAPTA lo mejor posible a la huella real del depto.
// 3) la terminás de editar (mover, rotar, reshape de cada ambiente) → "Pasar al plano".
function TipoStageModal({ stage, onConfirm, onCancel }) {
  const { unit } = stage;
  const xs = unit.pts.map((p) => p.x), ys = unit.pts.map((p) => p.y);
  const ux0 = Math.min(...xs), uy0 = Math.min(...ys);
  const W = Math.max(...xs) - ux0, D = Math.max(...ys) - uy0;
  const areaDepto = W * D, frenteDepto = Math.min(W, D);
  const foot = unit.pts.map((p) => ({ x: p.x - ux0, y: p.y - uy0 }));

  const [prog, setProg] = useState({ dorms: 2, banos: 2, visita: false });
  const [tipoId, setTipoId] = useState(null);
  const [rms, setRms] = useState([]);
  const [its, setIts] = useState([]);
  const [sel, setSel] = useState(null);
  const [tx, setTx] = useState(0), [ty, setTy] = useState(0), [rot, setRot] = useState(0);
  const [aiBusy, setAiBusy] = useState(false), [aiErr, setAiErr] = useState("");
  const drag = useRef(null), svgRef = useRef(null);

  // adapta una tipología (programa) a la huella del depto con el motor determinístico (rápido, amueblado)
  const adaptar = (t) => {
    const opts = { visita: prog.visita || t.banos >= 3, nse: "C" };
    let L = null; try { L = feydLayout(W, D, t.dorms, t.banos, opts); } catch { L = null; }
    if (!L?.rooms?.length) { try { L = feydLayoutProfundo(W, D, t.dorms, t.banos, opts); } catch { L = null; } }
    return L;
  };
  // candidatos: tipologías redibujadas que pasan el filtro de variables, más cercanas en área al depto
  const cands = useMemo(() => TIPOLOGIAS
    .filter((t) => t.dorms === prog.dorms && (prog.banos === 0 || t.banos === prog.banos))
    .sort((a, b) => Math.abs(a.area[1] - areaDepto) - Math.abs(b.area[1] - areaDepto))
    .slice(0, 8), [prog.dorms, prog.banos, areaDepto]);
  const elegir = (t) => {
    const L = adaptar(t);
    if (!L?.rooms?.length) { setAiErr("esa tipología no entra en este depto"); return; }
    setTipoId(t.id); setRms(L.rooms); setIts(L.items || []); setSel(null); setTx(0); setTy(0); setRot(0); setAiErr("");
  };
  // afinar con IA: adapta a la huella REAL (incluso irregular) siguiendo reglas
  const afinarIA = async () => {
    const t = TIPOLOGIAS.find((x) => x.id === tipoId); if (!t) return;
    setAiBusy(true); setAiErr("");
    try {
      const L = await disenarConFeyd({ pts: unit.pts, dorms: t.dorms, banos: t.banos, visita: prog.visita });
      if (!L?.rooms?.length) throw new Error("sin ambientes");
      setRms(L.rooms); setIts(L.items || []); setSel(null); setTx(0); setTy(0); setRot(0);
    } catch (e) { setAiErr((e.message || "falló") + " — quedó la adaptación rápida"); }
    finally { setAiBusy(false); }
  };

  const cx = W / 2, cy = D / 2;
  const rad = (rot * Math.PI) / 180, cs = Math.cos(rad), sn = Math.sin(rad);
  const tp = (p) => ({ x: cx + (p.x - cx) * cs - (p.y - cy) * sn + tx, y: cy + (p.x - cx) * sn + (p.y - cy) * cs + ty });
  const CW = 640, CH = 500, P = 30;
  const sc = Math.min((CW - 2 * P) / Math.max(W, 0.5), (CH - 2 * P) / Math.max(D, 0.5));
  const S = (p) => ({ x: P + p.x * sc, y: P + p.y * sc });
  const colOf = (r) => { const n = (r.name || r.tipo || "").toLowerCase(); if (/dorm/.test(n)) return "#A89BD9"; if (/baño|bano/.test(n)) return "#9BCBE3"; if (/cocina/.test(n)) return "#C2A45A"; if (/sala|social|comedor|estar|living/.test(n)) return "#5F8A6A"; if (/hall|pasillo|core/.test(n)) return "#D9D5CD"; return "#E5E1D6"; };
  const invRotDelta = (dxs, dys) => ({ x: dxs * cs + dys * sn, y: -dxs * sn + dys * cs });
  const onDownVertex = (e, ri, vi) => { e.stopPropagation(); drag.current = { kind: "vertex", ri, vi, sx: e.clientX, sy: e.clientY, orig: rms[ri].pts[vi] }; svgRef.current.setPointerCapture(e.pointerId); };
  const onDown = (e) => { drag.current = { kind: "group", sx: e.clientX, sy: e.clientY, tx, ty }; e.currentTarget.setPointerCapture(e.pointerId); };
  const onMove = (e) => {
    const d = drag.current; if (!d) return;
    if (d.kind === "group") { setTx(d.tx + (e.clientX - d.sx) / sc); setTy(d.ty + (e.clientY - d.sy) / sc); return; }
    const dl = invRotDelta((e.clientX - d.sx) / sc, (e.clientY - d.sy) / sc);
    setRms((rs) => rs.map((r, i) => i === d.ri ? { ...r, pts: r.pts.map((p, j) => j === d.vi ? { x: d.orig.x + dl.x, y: d.orig.y + dl.y } : p) } : r));
  };
  const onUp = () => { drag.current = null; };
  const renameSel = (name) => setRms((rs) => rs.map((r, i) => i === sel ? { ...r, name } : r));
  const delSel = () => { setRms((rs) => rs.filter((_, i) => i !== sel)); setSel(null); };
  const confirmar = () => {
    const nr = rms.map((r) => ({ ...r, pts: r.pts.map((p) => tp(p)) }));
    const ni = (its || []).map((t) => { const q = tp({ x: t.x, y: t.y }); return { ...t, x: q.x, y: q.y, rot: ((t.rot || 0) + rot) % 360 }; });
    onConfirm(nr, ni);
  };
  const areaLocal = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; } return Math.abs(a) / 2; };
  const selRoom = sel != null ? rms[sel] : null;
  const Btn2 = ({ onClick, children, accent, disabled }) => (
    <button onClick={onClick} disabled={disabled} style={{ border: "1px solid " + (accent ? "#F7643B" : "#d9d5cd"), background: disabled ? "#eee" : accent ? "#F7643B" : "#fff", color: accent ? "#fff" : "#0A0B0F", borderRadius: 5, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.6 : 1 }}>{children}</button>
  );
  const step = { width: 22, height: 22, border: "1px solid #d9d5cd", borderRadius: 4, background: "#F4F1EA", cursor: "pointer", fontWeight: 700, lineHeight: "18px" };
  const Cnt = ({ k, min, max }) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <button style={step} onClick={() => setProg((s) => ({ ...s, [k]: Math.max(min, s[k] - 1) }))}>−</button>
      <b style={{ minWidth: 12, textAlign: "center" }}>{prog[k] || "·"}</b>
      <button style={step} onClick={() => setProg((s) => ({ ...s, [k]: Math.min(max, s[k] + 1) }))}>+</button>
    </span>
  );

  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(10,11,15,0.55)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 14 }}>
      <div style={{ background: "#fff", borderRadius: 8, boxShadow: "0 20px 60px rgba(0,0,0,0.35)", padding: 16, width: "100%", maxWidth: 980, display: "flex", gap: 14 }}>
        {/* IZQUIERDA · variables (filtro) + tipologías redibujadas que sirven */}
        <div style={{ width: 246, flexShrink: 0, display: "flex", flexDirection: "column", maxHeight: CH + 70 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6B6863" }}>Paso 3 · tipología</div>
          <div style={{ fontSize: 11, color: "#6B6863", margin: "3px 0 10px", fontFamily: "ui-monospace, monospace" }}>depto {W.toFixed(1)} × {D.toFixed(1)} m · {areaDepto.toFixed(0)} m²</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "3px 0", fontSize: 12 }}><span>Dormitorios</span><Cnt k="dorms" min={1} max={5} /></div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "3px 0", fontSize: 12 }}><span>Baños</span><Cnt k="banos" min={0} max={4} /></div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "3px 0 8px", fontSize: 12 }}><span>Baño de visita</span>
            <button onClick={() => setProg((s) => ({ ...s, visita: !s.visita }))} style={{ border: "1px solid #d9d5cd", borderRadius: 4, background: prog.visita ? "#1E2A4A" : "#F4F1EA", color: prog.visita ? "#fff" : "#0A0B0F", fontSize: 11, padding: "3px 12px", cursor: "pointer", fontWeight: 600 }}>{prog.visita ? "Sí" : "No"}</button>
          </div>
          <div style={{ fontSize: 9.5, color: "#6B6863", letterSpacing: "0.06em", textTransform: "uppercase", borderTop: "1px solid #eee", paddingTop: 8, marginBottom: 6 }}>{cands.length} tipologías que sirven · elegí una</div>
          <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 8, paddingRight: 2 }}>
            {cands.length === 0 && <div style={{ fontSize: 11, color: "#A85B5B" }}>No hay tipologías con ese programa. Cambiá las variables.</div>}
            {cands.map((t) => {
              const Wt = Math.max(t.frenteMin, 6), Dt = Math.max(4, Math.round((t.area[1] / Wt) * 10) / 10);
              let Lp = null; try { Lp = feydLayout(Wt, Dt, t.dorms, t.banos, { visita: t.banos >= 3 }); } catch { }
              if (!Lp?.rooms?.length) { try { Lp = feydLayoutProfundo(Wt, Dt, t.dorms, t.banos, { visita: t.banos >= 3 }); } catch { } }
              const on = t.id === tipoId;
              return (
                <button key={t.id} onClick={() => elegir(t)} style={{ textAlign: "left", border: `1px solid ${on ? "#F7643B" : "#d9d5cd"}`, borderRadius: 5, padding: 7, background: on ? "#FFF3EE" : "#F4F1EA", cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "#0A0B0F" }}>{t.nombre}</span>
                    <span style={{ fontSize: 8.5, color: "#6B6863" }}>{t.seg}</span>
                  </div>
                  <MiniPlano L={Lp} W={Wt} D={Dt} />
                  <div style={{ fontSize: 9, color: "#6B6863", fontFamily: "ui-monospace, monospace", marginTop: 4 }}>{t.dorms}D · {t.banos}B · {t.area[1]} m²</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* DERECHA · el depto con la tipología adaptada + edición */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: "#0A0B0F" }}>{tipoId ? `${rms.length} ambientes · editá arrastrando` : "Elegí una tipología de la izquierda"}</div>
            <button onClick={onCancel} style={{ border: "none", background: "none", cursor: "pointer", color: "#6B6863", fontSize: 18 }}>✕</button>
          </div>
          <div style={{ position: "relative" }}>
            <svg ref={svgRef} width="100%" viewBox={`0 0 ${CW} ${CH}`} style={{ background: "#F4F1EA", borderRadius: 6, touchAction: "none", cursor: drag.current?.kind === "group" ? "grabbing" : "default" }}
              onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
              <polygon points={foot.map((p) => { const q = S(p); return `${q.x},${q.y}`; }).join(" ")} fill="none" stroke="#1E2A4A" strokeWidth={2.5} strokeDasharray="6 4" />
              {rms.map((r, i) => {
                const pts = r.pts.map((p) => S(tp(p)));
                const cxr = pts.reduce((a, p) => a + p.x, 0) / pts.length, cyr = pts.reduce((a, p) => a + p.y, 0) / pts.length;
                const on = i === sel;
                return (
                  <g key={i}>
                    <polygon points={pts.map((p) => `${p.x},${p.y}`).join(" ")} fill={colOf(r)} fillOpacity={on ? 0.6 : 0.4} stroke={on ? "#F7643B" : "none"} strokeWidth={on ? 2 : 0}
                      style={{ cursor: "pointer" }} onPointerDown={(e) => { e.stopPropagation(); setSel(i); }} />
                    <text x={cxr} y={cyr} fontSize={9} fill="#0A0B0F" textAnchor="middle" style={{ pointerEvents: "none" }}>{r.name}</text>
                    <text x={cxr} y={cyr + 10} fontSize={7.5} fill="#6B6863" textAnchor="middle" style={{ pointerEvents: "none" }}>{areaLocal(r.pts).toFixed(1)} m²</text>
                  </g>
                );
              })}
              {/* mobiliario + aberturas reales (no cuadrados) */}
              {(its || []).map((t, i) => { const q = S(tp({ x: t.x, y: t.y })); return <Simbolo key={i} it={{ ...t, rot: ((t.rot || 0) + rot) }} px={q.x} py={q.y} k={sc} selected={false} />; })}
              {/* muros deduplicados (una arista compartida = un solo muro) */}
              {(() => {
                const q = (n) => Math.round(n / 0.15) * 0.15, seen = new Set(), segs = [];
                rms.forEach((r) => { const pts = r.pts; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; const ka = `${q(a.x)},${q(a.y)}`, kb = `${q(b.x)},${q(b.y)}`; const k = ka < kb ? ka + "|" + kb : kb + "|" + ka; if (seen.has(k)) continue; seen.add(k); segs.push([a, b]); } });
                return segs.map(([a, b], i) => { const A = S(tp(a)), B = S(tp(b)); return <line key={i} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="#0A0B0F" strokeWidth={1.8} strokeLinecap="square" style={{ pointerEvents: "none" }} />; });
              })()}
              {sel != null && rms[sel] && rms[sel].pts.map((p, j) => { const q = S(tp(p)); return <circle key={j} cx={q.x} cy={q.y} r={4.5} fill="#F7643B" stroke="#fff" strokeWidth={1.4} style={{ cursor: "grab" }} onPointerDown={(e) => onDownVertex(e, sel, j)} />; })}
            </svg>
            {selRoom && (
              <div style={{ position: "absolute", right: 10, top: 10, width: 172, background: "#fff", border: "1px solid #d9d5cd", borderRadius: 6, boxShadow: "0 6px 18px rgba(0,0,0,0.14)", padding: 11 }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6B6863", marginBottom: 6 }}>Ambiente</div>
                <input value={selRoom.name || ""} onChange={(e) => renameSel(e.target.value)} style={{ width: "100%", border: "1px solid #d9d5cd", borderRadius: 4, padding: "5px 7px", fontSize: 12, marginBottom: 7, boxSizing: "border-box" }} />
                <div style={{ fontSize: 10.5, color: "#6B6863", marginBottom: 8, fontFamily: "ui-monospace, monospace" }}>{areaLocal(selRoom.pts).toFixed(1)} m²</div>
                <div style={{ fontSize: 9.5, color: "#6B6863", marginBottom: 8, lineHeight: 1.4 }}>Arrastrá los puntos naranjas para cambiar su forma.</div>
                <button onClick={delSel} style={{ width: "100%", border: "1px solid #A85B5B", color: "#A85B5B", background: "#fff", borderRadius: 4, padding: "6px 0", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Eliminar ambiente</button>
                <button onClick={() => setSel(null)} style={{ width: "100%", border: "none", color: "#6B6863", background: "none", padding: "6px 0 0", fontSize: 10.5, cursor: "pointer" }}>deseleccionar</button>
              </div>
            )}
          </div>
          {aiErr && <div style={{ fontSize: 10.5, color: "#A85B5B", marginTop: 6 }}>{aiErr}</div>}
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
            <Btn2 onClick={() => setRot((r) => (r - 90 + 360) % 360)} disabled={!tipoId}>⟲</Btn2>
            <Btn2 onClick={() => setRot((r) => (r + 90) % 360)} disabled={!tipoId}>⟳</Btn2>
            <Btn2 onClick={() => { setTx(0); setTy(0); setRot(0); }} disabled={!tipoId}>reset</Btn2>
            <Btn2 onClick={afinarIA} disabled={!tipoId || aiBusy}>{aiBusy ? "Feyd afinando…" : "afinar con Feyd (forma real)"}</Btn2>
            <div style={{ flex: 1 }} />
            <Btn2 onClick={confirmar} accent disabled={!tipoId || !rms.length}>Pasar al plano →</Btn2>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditorPlanosInner({ proyecto, onSavePlano, navigate }) {
  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const P = proyecto?.plano || {};                  // plano guardado del proyecto activo

  const [rooms, setRooms] = useState(P.rooms || []);   // ambientes: { id, name, pts, tipo? }
  const [items, setItems] = useState(P.items || []);   // mobiliario/aberturas: { id, ref, x, y, rot, w, d }
  const [muro, setMuro] = useState(P.muro ?? 0.15);    // espesor de muro (m)
  const [altura, setAltura] = useState(P.altura ?? 2.4); // altura libre (m)
  // dibujo lineal (whiteboard): trazos a mano alzada sobre el plano
  const [trazos, setTrazos] = useState(P.trazos || []);  // [{ id, pts:[{x,y}], color, w }]
  const [curTrazo, setCurTrazo] = useState(null);        // trazo en curso
  const [penColor, setPenColor] = useState("#F7643B");   // color del lápiz
  const [penVariant, setPenVariant] = useState("pencil"); // variante de trazo (lápiz/plumón/fino/resaltador)
  const [showDibujo, setShowDibujo] = useState(false);    // panel de dibujo (izquierda)
  const [maximized, setMaximized] = useState(false);      // zona de trabajo a pantalla completa
  const rootRef = useRef(null);
  const toggleMax = () => {
    const el = rootRef.current;
    if (document.fullscreenElement) { document.exitFullscreen?.(); return; }
    const p = el?.requestFullscreen?.();
    if (p && p.catch) p.catch(() => setMaximized((m) => !m));  // fallback CSS si el navegador rechaza
    else if (!el?.requestFullscreen) setMaximized((m) => !m);
  };
  useEffect(() => {
    const h = () => setMaximized(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);
  const [tool, setTool] = useState("select");
  const [snapOn, setSnapOn] = useState(true);
  const [orthoOn, setOrthoOn] = useState(true);
  const [dims, setDims] = useState(true);
  const [selId, setSelId] = useState(null);         // ambiente seleccionado
  const [selItem, setSelItem] = useState(null);     // mueble seleccionado
  const [multiSel, setMultiSel] = useState([]);     // multi-selección con shift-click: [{t:'room'|'item', id}]
  const inMulti = (t, id) => multiSel.some((m) => m.t === t && m.id === id);
  const toggleMulti = (t, id) => setMultiSel((s) => s.some((m) => m.t === t && m.id === id) ? s.filter((m) => !(m.t === t && m.id === id)) : [...s, { t, id }]);
  const [showLib, setShowLib] = useState(false);
  const [showRepo, setShowRepo] = useState(false);   // repositorio de ambientes amueblados
  const [showTipoCfg, setShowTipoCfg] = useState(false); // configurador por tipología (ensambla desde librería)
  const [showTipoNexo, setShowTipoNexo] = useState(false); // visor de tipologías de mercado (Nexo) redibujadas por Feyd
  const [show3D, setShow3D] = useState(false);      // visor 3D vivo del plano
  const [showDistrib, setShowDistrib] = useState(false); // paso 2
  const [showTipo, setShowTipo] = useState(false);       // paso 3 = modo "asignar tipología" (click en depto)
  const [tipoUnit, setTipoUnit] = useState(null);        // depto clickeado para asignarle tipología
  const [tipoBusy, setTipoBusy] = useState(false);       // Feyd adaptando la tipología al footprint
  const [tipoErr, setTipoErr] = useState("");
  const [tipoStage, setTipoStage] = useState(null);      // { unit, rooms, items, W, D } → ventana grande de revisión antes de pasar al plano
  const [partis, setPartis] = useState([]);
  const [parti, setParti] = useState(null);              // distribución elegida (en memoria, no persiste)
  const [brief, setBrief] = useState({
    areaObjetivo: 60, pct1: 25, pct2: 40, udsPiso: 4,          // distribución en lote
    nse: "C", terraza: true,                                   // tipologías
    ...(P.brief || {}),
  });
  const [ficha, setFicha] = useState(P.ficha ? { ...FICHA_DEF, ...P.ficha } : FICHA_DEF);
  const [showFicha, setShowFicha] = useState(false);

  const [draft, setDraft] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [view, setView] = useState({ scale: 42, tx: 60, ty: 60 });

  // ── paso 1: lote ──
  const [plano, setPlano] = useState(null);        // { src, ox, oy, mpp, w, h, opacity }
  const [lote, setLote] = useState(P.lote ?? null);          // { pts } polígono del terreno (metros)
  const [tipoLote, setTipoLote] = useState(P.tipoLote ?? "medianera"); // medianera | esquina
  const [retiro, setRetiro] = useState(P.retiro ?? 3);         // retiro frontal (m)
  const [retiroLat, setRetiroLat] = useState(P.retiroLat ?? 3);   // retiro de la calle lateral (solo esquina)
  const [retiroPost, setRetiroPost] = useState(P.retiroPost ?? 3); // retiro posterior (área libre)
  const [frontIdx, setFrontIdx] = useState(P.frontIdx ?? 0);     // borde-frente del lote
  const [calib, setCalib] = useState([]);          // puntos de calibración en curso
  const [loteBar, setLoteBar] = useState(true);    // barra de herramientas de lote visible
  const [cabidaMsg, setCabidaMsg] = useState(null); // aviso al importar desde cabida
  const fileRef = useRef(null);

  const past = useRef([]);
  const future = useRef([]);
  const drag = useRef(null);

  // envolvente construible = lote − retiros NORMATIVOS según tipo:
  //  · frontal  → siempre (hacia la calle)
  //  · posterior→ siempre (área libre reglamentaria)
  //  · laterales→ solo la calle lateral en esquina; en medianera son colindantes (0)
  // Se clasifica cada borde por su normal (clasificarBordes) para que ande también
  // en lotes irregulares, no solo rectángulos.
  const footprint = (() => {
    if (!lote || lote.pts.length < 3) return null;
    const n = lote.pts.length;
    const clases = clasificarBordes(lote.pts, frontIdx);
    const dists = lote.pts.map((_, i) =>
      i === frontIdx ? retiro
        : clases[i] === "posterior" ? retiroPost
          : (tipoLote === "esquina" && i === (frontIdx + 1) % n) ? retiroLat
            : 0);
    return offsetEdges(lote.pts, dists);
  })();

  // El estado inicial ya salió del proyecto activo (P). Acá solo consumimos el
  // puente cabida→plano (one-shot) para pre-cargar el brief en proyectos nuevos.
  useEffect(() => {
    try {
      const b = localStorage.getItem(BRIEF_KEY);
      if (b) {
        const parsed = JSON.parse(b);
        setBrief((prev) => ({ ...prev, ...parsed }));
        localStorage.removeItem(BRIEF_KEY);
        setLoteBar(true);
      }
    } catch { /* brief inválido */ }
  }, []);

  // persiste el plano en el proyecto activo (instantáneo local + sync a la nube).
  // No guardamos la imagen base de calco (puede ser enorme): es solo apoyo de trazado.
  useEffect(() => {
    const snap = { rooms, items, muro, altura, view, lote, tipoLote, retiro, retiroLat, retiroPost, frontIdx, brief, ficha, trazos };
    if (onSavePlano) onSavePlano(snap);
    else { try { localStorage.setItem(STORE, JSON.stringify(snap)); } catch { /* cuota */ } }
  }, [onSavePlano, rooms, items, muro, altura, view, lote, tipoLote, retiro, retiroLat, retiroPost, frontIdx, brief, ficha, trazos]);

  // ── historial ─────────────────────────────────────────────
  const snapshot = useCallback(() => ({ rooms, items }), [rooms, items]);
  const pushPast = useCallback((snap) => {
    past.current.push(snap);
    if (past.current.length > 60) past.current.shift();
    future.current = [];
  }, []);
  const commit = useCallback((nr, ni) => {
    pushPast({ rooms, items });
    if (nr) setRooms(nr);
    if (ni) setItems(ni);
  }, [rooms, items, pushPast]);
  const undo = useCallback(() => {
    if (!past.current.length) return;
    future.current.push({ rooms, items });
    const s = past.current.pop();
    setRooms(s.rooms); setItems(s.items);
  }, [rooms, items]);
  const redo = useCallback(() => {
    if (!future.current.length) return;
    past.current.push({ rooms, items });
    const s = future.current.pop();
    setRooms(s.rooms); setItems(s.items);
  }, [rooms, items]);

  // ── transformaciones ──────────────────────────────────────
  const toScreen = useCallback((p) => ({ x: p.x * view.scale + view.tx, y: p.y * view.scale + view.ty }), [view]);
  const toWorldRaw = useCallback((sx, sy) => ({ x: (sx - view.tx) / view.scale, y: (sy - view.ty) / view.scale }), [view]);
  const pointer = useCallback((e) => {
    const r = svgRef.current.getBoundingClientRect();
    return toWorldRaw(e.clientX - r.left, e.clientY - r.top);
  }, [toWorldRaw]);

  const resolvePoint = useCallback((world, anchor) => {
    const near = nearestVertex(rooms, world, 12 / view.scale);
    if (near) return { ...near.p, snappedTo: near };
    let p = world;
    if (anchor && orthoOn) p = ortho(anchor, p);
    if (snapOn) p = snapPt(p);
    return p;
  }, [rooms, view.scale, orthoOn, snapOn]);

  // ── flujo lote: imagen base ────────────────────────────────
  const imgToWorld = useCallback((ix, iy) => plano ? { x: plano.ox + ix * plano.mpp, y: plano.oy + iy * plano.mpp } : { x: ix, y: iy }, [plano]);
  const worldToImg = useCallback((p) => plano ? { ix: (p.x - plano.ox) / plano.mpp, iy: (p.y - plano.oy) / plano.mpp } : { ix: p.x, iy: p.y }, [plano]);

  const uploadPlano = useCallback((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const box = wrapRef.current?.getBoundingClientRect();
        const targetM = 25; // ancho real inicial estimado (se corrige al calibrar)
        const mpp = targetM / img.naturalWidth;
        setPlano({ src: reader.result, ox: 0, oy: 0, mpp, w: img.naturalWidth, h: img.naturalHeight, opacity: 0.6 });
        setLoteBar(true);
        // encuadrar la imagen
        if (box) {
          const wM = img.naturalWidth * mpp, hM = img.naturalHeight * mpp;
          const scale = Math.min((box.width - 120) / wM, (box.height - 140) / hM);
          setView({ scale, tx: box.width / 2 - (wM / 2) * scale, ty: box.height / 2 - (hM / 2) * scale });
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }, []);

  // calibrar: recalcula mpp para que la distancia entre 2 puntos = metros reales
  const applyCalibration = useCallback((p1, p2) => {
    const meters = parseFloat(window.prompt("Distancia real entre los dos puntos (metros):", "10"));
    if (!meters || meters <= 0 || !plano) { setCalib([]); return; }
    const i1 = worldToImg(p1), i2 = worldToImg(p2);
    const pxDist = Math.hypot(i1.ix - i2.ix, i1.iy - i2.iy) || 1;
    const newMpp = meters / pxDist;
    // anclar p1: mantener su posición en mundo
    setPlano((pl) => ({ ...pl, mpp: newMpp, ox: p1.x - i1.ix * newMpp, oy: p1.y - i1.iy * newMpp }));
    setCalib([]);
    setTool("lote");
  }, [plano, worldToImg]);

  const closeLote = useCallback((pts) => {
    if (pts.length < 3) return;
    setLote({ pts });
    setFrontIdx(0);
    setDraft([]);
    setTool("select");
  }, []);

  const cycleFront = () => lote && setFrontIdx((i) => (i + 1) % lote.pts.length);

  // paso 2: genera las distribuciones (partis) dentro del footprint.
  // uds/piso arranca DERIVADO del footprint ÷ área objetivo (para no dar studios por
  // defecto); si el usuario ya lo tocó (≠4), se respeta su valor.
  const abrirDistribuciones = useCallback(() => {
    if (!footprint) { setLoteBar(true); return; }
    const sugerido = Math.max(1, Math.min(8, Math.round(area(footprint) / Math.max(brief.areaObjetivo * 1.3, 30))));
    const b = brief.udsPiso === 4 && sugerido !== 4 ? { ...brief, udsPiso: sugerido } : brief;
    if (b !== brief) setBrief(b);
    setPartis(generarDistribuciones(footprint, frontIdx, b));
    setShowDistrib(true);
  }, [footprint, frontIdx, brief]);

  // mueble bajo el puntero (el más reciente primero)
  const hitItem = useCallback((world) => {
    for (let i = items.length - 1; i >= 0; i--) {
      const t = items[i];
      const rad = (-t.rot * Math.PI) / 180;
      const dx = world.x - t.x, dy = world.y - t.y;
      const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
      const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
      if (Math.abs(lx) <= t.w / 2 + 0.05 && Math.abs(ly) <= t.d / 2 + 0.05) return t;
    }
    return null;
  }, [items]);

  // ── acciones ──────────────────────────────────────────────
  const closeDraft = useCallback((pts) => {
    if (pts.length < 3) return;
    const n = rooms.filter((r) => /^ambiente/.test(r.name)).length + 1;
    commit([...rooms, { id: uid(), name: `ambiente ${n}`, pts }], null);
    setDraft([]);
    setSelId(null);
  }, [rooms, commit]);

  const deleteSel = useCallback(() => {
    if (selItem) {
      commit(null, items.filter((t) => t.id !== selItem));
      setSelItem(null);
      return;
    }
    if (selId) {
      const r = rooms.find((x) => x.id === selId);
      const ni = r ? items.filter((t) => !pointInPolygon({ x: t.x, y: t.y }, r.pts)) : items;
      commit(rooms.filter((x) => x.id !== selId), ni);
      setSelId(null);
    }
  }, [selId, selItem, rooms, items, commit]);

  const rotateSel = useCallback(() => {
    if (!selItem) return;
    commit(null, items.map((t) => (t.id === selItem ? { ...t, rot: (t.rot + 90) % 360 } : t)));
  }, [selItem, items, commit]);

  const renameSel = (name) =>
    setRooms((rs) => rs.map((r) => (r.id === selId ? { ...r, name } : r)));

  const clearAll = () => {
    if ((rooms.length || items.length) && !window.confirm("¿Borrar todo el plano?")) return;
    commit([], []);
    setDraft([]); setSelId(null); setSelItem(null);
  };

  const fitTo = useCallback((roomsArr) => {
    const all = roomsArr.flatMap((r) => r.pts);
    const box = wrapRef.current?.getBoundingClientRect();
    if (!box) return;
    if (!all.length) { setView({ scale: 42, tx: box.width / 2 - 120, ty: 80 }); return; }
    const b = bbox(all);
    const w = Math.max(b.maxX - b.minX, 1), h = Math.max(b.maxY - b.minY, 1);
    const scale = Math.min((box.width - 130) / w, (box.height - 130) / h);
    setView({ scale, tx: box.width / 2 - (b.minX + w / 2) * scale, ty: box.height / 2 - (b.minY + h / 2) * scale });
  }, []);
  const fitView = useCallback(() => fitTo(rooms), [fitTo, rooms]);

  // importa el contorno real del lote desde la cabida (lo dejó el import CAD allá)
  const importarCabida = useCallback(() => {
    let c;
    try { c = JSON.parse(localStorage.getItem("hygge:loteCabida") || "null"); } catch { c = null; }
    if (!c || !Array.isArray(c.pts) || c.pts.length < 3) {
      setCabidaMsg("no hay lote en la cabida — importa un CAD (.dxf) allá primero");
      setTimeout(() => setCabidaMsg(null), 5000);
      return;
    }
    const xs = c.pts.map((p) => p.x), ys = c.pts.map((p) => p.y);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    const pts = c.pts.map((p) => ({ x: +(p.x - minX + 2).toFixed(3), y: +(p.y - minY + 2).toFixed(3) }));
    setLote({ pts });
    setFrontIdx(c.frenteIdx ?? 0);
    setDraft([]);
    // hereda lo definido en cabida: tipo de lote + retiros (frontal y calle lateral)
    if (c.tipoLote === "esquina" || c.tipoLote === "medianera") setTipoLote(c.tipoLote);
    const rf = c.retiros?.frontal;
    if (rf?.on && typeof rf.v === "number") setRetiro(rf.v);
    else if (typeof c.retiroFrontal === "number") setRetiro(c.retiroFrontal); // formato viejo
    const rl = c.retiros?.derecha?.on ? c.retiros.derecha : c.retiros?.izquierda?.on ? c.retiros.izquierda : null;
    if (rl && typeof rl.v === "number") setRetiroLat(rl.v);
    const rp = c.retiros?.posterior;
    if (rp?.on && typeof rp.v === "number") setRetiroPost(rp.v);
    // hereda el PRODUCTO de cabida: área promedio y mix de dorms → el editor ofrece
    // depas cercanos a eso (uds/piso se re-deriva del footprint al abrir distribución).
    setBrief((br) => ({
      ...br,
      areaObjetivo: Number(c.areaDpto) > 0 ? Math.round(c.areaDpto) : br.areaObjetivo,
      pct1: Number.isFinite(c.mix1) ? c.mix1 : br.pct1,
      pct2: Number.isFinite(c.mix2) ? c.mix2 : br.pct2,
      udsPiso: 4,
    }));
    setLoteBar(true);
    setTool("select");
    setCabidaMsg(`lote importado · ${Math.round(c.area || 0)} m²`);
    setTimeout(() => setCabidaMsg(null), 4000);
    requestAnimationFrame(() => fitTo([{ pts }]));
  }, [fitTo]);

  const addItem = useCallback((ref) => {
    const box = wrapRef.current?.getBoundingClientRect();
    const c = box ? toWorldRaw(box.width / 2, box.height / 2) : { x: 0, y: 0 };
    const cat = porId[ref];
    const t = { id: uid(), ref, x: snapPt(c, 0.05).x, y: snapPt(c, 0.05).y, rot: 0, w: cat.w, d: cat.d };
    commit(null, [...items, t]);
    setSelItem(t.id); setSelId(null); setTool("select");
  }, [items, commit, toWorldRaw]);

  // Insertar un ambiente amueblado del repositorio: polígono + mobiliario al centro del lienzo.
  const insertAmbiente = useCallback((spec) => {
    const box = wrapRef.current?.getBoundingClientRect();
    const c = box ? toWorldRaw(box.width / 2, box.height / 2) : { x: 0, y: 0 };
    const p = snapPt({ x: c.x - spec.w / 2, y: c.y - spec.h / 2 }, 0.05);
    const R = { x: p.x, y: p.y, w: spec.w, h: spec.h };
    const pts = [{ x: R.x, y: R.y }, { x: R.x + R.w, y: R.y }, { x: R.x + R.w, y: R.y + R.h }, { x: R.x, y: R.y + R.h }];
    const roomObj = { id: uid(), name: spec.name, pts, tipo: spec.tipo };
    let newItems = [];
    try { newItems = (spec.furnish(R) || []).map((t) => ({ ...t, id: uid() })); } catch { newItems = []; }
    commit([...rooms, roomObj], [...items, ...newItems]);
    setSelId(roomObj.id); setSelItem(null); setTool("select"); setShowRepo(false);
  }, [rooms, items, commit, toWorldRaw]);

  // Fase 2: ensambla la planta a partir del programa (contadores/toggles), tomando los
  // ambientes de la librería y colocándolos en una grilla sin solape. Reemplaza rooms/items;
  // el usuario los mueve y ajusta a mano (no regenera con Feyd).
  const armarTipologia = useCallback((prog, label = "") => {
    const byId = Object.fromEntries(AMBIENTES_LIB.map((a) => [a.id, a]));
    const list = [];
    // social (cocina abierta → sala-comedor-cocina más ancha con kitchenette; cerrada → cocina aparte)
    if (prog.cocinaCerrada) {
      list.push({ ...byId.sala });       // sala (estar)
      list.push({ ...byId.comedor });    // comedor como ambiente propio
      list.push({ ...byId.cocina });
    } else {
      // cocina abierta = concepto integrado sala-comedor-cocina (un solo ambiente)
      list.push({ id: "sala", name: "sala-comedor-cocina", tipo: "social", w: 5.4, h: 4.6,
        furnish: (R) => [...amoblarSocial({ ...R, w: R.w - 1.9 }, "C"), furnIt("cocina", R.x + R.w - 1.0, R.y + 1.0, 0, { w: 1.7 })] });
    }
    for (let i = 0; i < prog.dorms; i++) list.push({ ...byId.habitacion, name: i === 0 ? "dormitorio principal" : `dormitorio ${i + 1}` });
    for (let i = 0; i < prog.banos; i++) list.push({ ...byId.bano, name: `baño ${i + 1}` });
    if (prog.visita) list.push({ ...byId.bano, name: "baño visita", w: 1.1, h: 1.6, furnish: (R) => amoblarBano(R, false, { wall: "top" }) });
    if (prog.closet) list.push({ ...byId.closet, name: "clóset" });
    if (prog.lavanderia) list.push({ ...byId.lavanderia });

    // Se AGREGA (no reemplaza): el nuevo grupo va debajo de lo que ya hay, con su etiqueta
    // de tipología. Así conviven Tipo A / B / C en el lienzo y los movés a mano.
    const gap = 0.4, maxW = 12;
    const oy = rooms.length ? Math.max(...rooms.flatMap((r) => r.pts.map((p) => p.y))) + 1.2 : 0;
    let x = 0, y = oy, rowH = 0;
    const nr = [], ni = [];
    for (const s of list) {
      if (x > 0 && x + s.w > maxW) { x = 0; y += rowH + gap; rowH = 0; }
      const R = { x, y, w: s.w, h: s.h };
      const pts = [{ x: R.x, y: R.y }, { x: R.x + R.w, y: R.y }, { x: R.x + R.w, y: R.y + R.h }, { x: R.x, y: R.y + R.h }];
      nr.push({ id: uid(), name: s.name, pts, tipo: s.tipo });
      let its = []; try { its = (s.furnish(R) || []).map((t) => ({ ...t, id: uid() })); } catch { its = []; }
      ni.push(...its);
      x += s.w + gap; rowH = Math.max(rowH, s.h);
    }
    const allRooms = [...rooms, ...nr], allItems = [...items, ...ni];
    commit(allRooms, allItems);
    setSelId(null); setSelItem(null); setTool("select");
    requestAnimationFrame(() => fitTo(allRooms));
  }, [rooms, items, commit, fitTo]);

  // Inserta una tipología Nexo ya redibujada por Feyd (layout()) al lienzo, offset debajo, etiquetada.
  const insertTipologia = useCallback((L, t) => {
    if (!L || !L.rooms?.length) return;
    const oy = rooms.length ? Math.max(...rooms.flatMap((r) => r.pts.map((p) => p.y))) + 1.2 : 0;
    const nr = L.rooms.map((r) => ({ id: uid(), name: r.name, tipo: r.zona || r.tipo, pts: r.pts.map((p) => ({ x: p.x, y: p.y + oy })) }));
    const ni = (L.items || []).map((t2) => ({ ...t2, id: uid(), y: t2.y + oy }));
    const allRooms = [...rooms, ...nr];
    commit(allRooms, [...items, ...ni]);
    setShowTipoNexo(false); setSelId(null); setSelItem(null); setTool("select");
    requestAnimationFrame(() => fitTo(allRooms));
  }, [rooms, items, commit, fitTo]);

  const useVariant = useCallback((v) => {
    const nr = v.rooms.map((r) => ({ id: r.id, name: r.name, pts: r.pts, tipo: r.tipo, unidad: r.unidad }));
    commit(nr, (v.items || []).map((t) => ({ ...t })));
    setShowDistrib(false); setShowTipo(false);
    setSelId(null); setSelItem(null); setDraft([]);
    requestAnimationFrame(() => fitTo(nr));
  }, [commit, fitTo]);

  // paso 2 → elegir un parti: bloques al lienzo y habilita el paso 3
  const usarParti = useCallback((p) => {
    setParti(p);
    useVariant(p);
  }, [useVariant]);

  // paso 3 → aplicar la tipología que Feyd redibujó (L) al depto clickeado (unit):
  // se reemplaza el bloque desnudo por los ambientes generados (con puertas), reposicionados
  // al footprint del depto. Después cada ambiente se redimensiona arrastrando sus vértices.
  const aplicarTipoAUnit = useCallback((unit, L) => {
    if (!unit || !L || !L.rooms?.length) return;
    const xs = unit.pts.map((p) => p.x), ys = unit.pts.map((p) => p.y);
    const ux0 = Math.min(...xs), uy0 = Math.min(...ys);
    const nr = L.rooms.map((r) => ({
      id: uid(), name: r.name, tipo: r.zona || r.tipo || "amb",
      pts: (r.pts || []).map((p) => ({ x: p.x + ux0, y: p.y + uy0 })),
    }));
    const ni = (L.items || []).map((t) => ({ ...t, id: uid(), x: t.x + ux0, y: t.y + uy0 }));
    const otras = rooms.filter((r) => r.id !== unit.id);
    const otrosItems = items.filter((t) => !pointInPolygon({ x: t.x, y: t.y }, unit.pts));
    commit([...otras, ...nr], [...otrosItems, ...ni]);
    setTipoUnit(null); setSelId(null); setSelItem(null);
  }, [rooms, items, commit]);

  // paso 3 (con IA): Feyd diseña el depto adaptándolo a la HUELLA real (polígono, incluso
  // irregular) y siguiendo reglas; el resultado NO se inserta directo: va a un staging grande
  // (tipoStage) para revisar/mover/rotar antes de pasarlo al plano. Si falla, cae al borrador.
  const generarTipoConFeyd = useCallback(async (unit, prog) => {
    if (!unit) return;
    setTipoBusy(true); setTipoErr("");
    const xs = unit.pts.map((p) => p.x), ys = unit.pts.map((p) => p.y);
    const uW = Math.max(...xs) - Math.min(...xs), uD = Math.max(...ys) - Math.min(...ys);
    try {
      const L = await disenarConFeyd({ pts: unit.pts, dorms: prog.dorms, banos: prog.banos, visita: prog.visita, closet: prog.closet, lavanderia: prog.lavanderia, cocinaCerrada: prog.cocinaCerrada, nse: brief.nse || "C" });
      if (!L?.rooms?.length) throw new Error("Feyd no devolvió ambientes");
      setTipoStage({ unit, rooms: L.rooms, items: L.items || [], W: uW, D: uD });
    } catch (e) {
      const L = (() => { try { return feydLayout(uW, uD, prog.dorms, prog.banos, { visita: prog.visita }); } catch { return null; } })();
      if (L?.rooms?.length) { setTipoStage({ unit, rooms: L.rooms, items: L.items || [], W: uW, D: uD }); setTipoErr(`${e.message} — borrador local`); }
      else { setTipoErr(e.message || "no se pudo generar"); }
    } finally {
      setTipoBusy(false);
    }
  }, [brief]);

  // ── punteros ──────────────────────────────────────────────
  // arrastre grupal: junta las salas seleccionadas (+ sus muebles contenidos) y los items sueltos
  const buildMultiDrag = (world) => {
    const selRooms = [], selItemIds = new Set(multiSel.filter((m) => m.t === "item").map((m) => m.id));
    multiSel.filter((m) => m.t === "room").forEach((m) => {
      const r = rooms.find((x) => x.id === m.id);
      if (r) { selRooms.push({ id: r.id, orig: r.pts }); items.forEach((it) => { if (pointInPolygon({ x: it.x, y: it.y }, r.pts)) selItemIds.add(it.id); }); }
    });
    const selItems = [...selItemIds].map((id) => { const it = items.find((x) => x.id === id); return it ? { id, x: it.x, y: it.y } : null; }).filter(Boolean);
    return { kind: "multi", start: world, rooms: selRooms, items: selItems, before: snapshot() };
  };

  const onDown = (e) => {
    if (e.button === 1 || e.button === 2 || e.altKey) {
      drag.current = { kind: "pan", sx: e.clientX, sy: e.clientY, view };
      svgRef.current.setPointerCapture(e.pointerId);
      return;
    }
    const world = pointer(e);

    if (tool === "calibrate") {
      const next = [...calib, world];
      if (next.length >= 2) applyCalibration(next[0], next[1]);
      else setCalib(next);
      return;
    }

    if (tool === "wall" || tool === "lote") {
      const anchor = draft[draft.length - 1];
      const p = resolvePoint(world, anchor);
      const closeAt = tool === "lote" ? closeLote : closeDraft;
      if (draft.length >= 3 && dist(p, draft[0]) < 14 / view.scale) closeAt(draft);
      else setDraft([...draft, { x: p.x, y: p.y }]);
      return;
    }

    if (tool === "draw" || tool === "line" || tool === "arrow" || tool === "rect" || tool === "ellipse") {
      const v = PEN_VARIANTS.find((x) => x.id === penVariant) || PEN_VARIANTS[0];
      const kind = tool === "draw" ? "path" : tool;
      setCurTrazo({ id: uid(), kind, pts: kind === "path" ? [world] : [world, world], color: penColor, w: kind === "path" ? v.w : 2, opacity: kind === "path" ? v.opacity : 1 });
      drag.current = { kind: "draw" };
      svgRef.current.setPointerCapture(e.pointerId);
      return;
    }
    if (tool === "erase") {
      setTrazos((ts) => {
        let bi = -1, bd = 18 / view.scale;
        ts.forEach((tr, i) => tr.pts.forEach((p) => { const dd = Math.hypot(p.x - world.x, p.y - world.y); if (dd < bd) { bd = dd; bi = i; } }));
        return bi >= 0 ? ts.filter((_, i) => i !== bi) : ts;
      });
      return;
    }

    // modo tipología (paso 3): click en un depto → abre el VISOR grande (variables + tipologías + editar)
    if (showTipo) {
      const insideT = rooms.findIndex((r) => pointInPolygon(world, r.pts));
      if (insideT >= 0) { const r = rooms[insideT]; setTipoStage({ unit: r }); setSelId(r.id); setSelItem(null); }
      return;
    }

    // select: mueble > vértice > ambiente
    const t = hitItem(world);
    if (t) {
      if (e.shiftKey) { toggleMulti("item", t.id); setSelItem(t.id); setSelId(null); return; }
      if (inMulti("item", t.id) && multiSel.length > 1) { drag.current = buildMultiDrag(world); svgRef.current.setPointerCapture(e.pointerId); return; }
      setMultiSel([]); setSelItem(t.id); setSelId(null);
      drag.current = { kind: "item", id: t.id, grab: { x: world.x - t.x, y: world.y - t.y }, before: snapshot() };
      svgRef.current.setPointerCapture(e.pointerId);
      return;
    }
    const vHit = nearestVertex(rooms, world, 11 / view.scale);
    if (vHit) {
      setSelId(rooms[vHit.roomIdx].id); setSelItem(null);
      drag.current = { kind: "vertex", roomIdx: vHit.roomIdx, ptIdx: vHit.ptIdx, before: snapshot() };
      svgRef.current.setPointerCapture(e.pointerId);
      return;
    }
    const inside = rooms.findIndex((r) => pointInPolygon(world, r.pts));
    if (inside >= 0) {
      const r = rooms[inside];
      if (e.shiftKey) { toggleMulti("room", r.id); setSelId(r.id); setSelItem(null); return; }
      if (inMulti("room", r.id) && multiSel.length > 1) { drag.current = buildMultiDrag(world); svgRef.current.setPointerCapture(e.pointerId); return; }
      setMultiSel([]);
      setSelId(r.id); setSelItem(null);
      const contained = items.map((tt, i) => (pointInPolygon({ x: tt.x, y: tt.y }, r.pts) ? i : -1)).filter((i) => i >= 0);
      drag.current = {
        kind: "room", roomIdx: inside, start: world, orig: r.pts,
        contained, origItems: contained.map((i) => ({ x: items[i].x, y: items[i].y })),
        before: snapshot(),
      };
      svgRef.current.setPointerCapture(e.pointerId);
      return;
    }
    setSelId(null); setSelItem(null); setMultiSel([]);
  };

  const onMove = (e) => {
    const world = pointer(e);
    const d = drag.current;
    if (!d) {
      const anchor = (tool === "wall" || tool === "lote") ? draft[draft.length - 1] : null;
      setCursor(resolvePoint(world, anchor));
      return;
    }
    if (d.kind === "pan") {
      setView({ ...d.view, tx: d.view.tx + (e.clientX - d.sx), ty: d.view.ty + (e.clientY - d.sy) });
      return;
    }
    if (d.kind === "draw") {
      setCurTrazo((c) => { if (!c) return c; return c.kind === "path" ? { ...c, pts: [...c.pts, world] } : { ...c, pts: [c.pts[0], world] }; });
      return;
    }
    if (d.kind === "item") {
      const p = snapPt({ x: world.x - d.grab.x, y: world.y - d.grab.y }, 0.05);
      setItems((ts) => ts.map((t) => (t.id === d.id ? { ...t, x: p.x, y: p.y } : t)));
      return;
    }
    if (d.kind === "vertex") {
      const p = snapOn ? snapPt(world) : world;
      setRooms((rs) => rs.map((r, ri) =>
        ri === d.roomIdx ? { ...r, pts: r.pts.map((v, pi) => (pi === d.ptIdx ? { x: p.x, y: p.y } : v)) } : r));
      return;
    }
    if (d.kind === "multi") {
      let dx = world.x - d.start.x, dy = world.y - d.start.y;
      if (snapOn) { dx = Math.round(dx / GRID) * GRID; dy = Math.round(dy / GRID) * GRID; }
      const rMap = new Map(d.rooms.map((r) => [r.id, r.orig]));
      const iMap = new Map(d.items.map((t) => [t.id, t]));
      setRooms((rs) => rs.map((r) => rMap.has(r.id) ? { ...r, pts: rMap.get(r.id).map((v) => ({ x: v.x + dx, y: v.y + dy })) } : r));
      setItems((ts) => ts.map((t) => iMap.has(t.id) ? { ...t, x: iMap.get(t.id).x + dx, y: iMap.get(t.id).y + dy } : t));
      return;
    }
    if (d.kind === "room") {
      let dx = world.x - d.start.x, dy = world.y - d.start.y;
      if (snapOn) { dx = Math.round(dx / GRID) * GRID; dy = Math.round(dy / GRID) * GRID; }
      setRooms((rs) => rs.map((r, ri) =>
        ri === d.roomIdx ? { ...r, pts: d.orig.map((v) => ({ x: v.x + dx, y: v.y + dy })) } : r));
      setItems((ts) => ts.map((t, i) => {
        const ci = d.contained.indexOf(i);
        return ci >= 0 ? { ...t, x: d.origItems[ci].x + dx, y: d.origItems[ci].y + dy } : t;
      }));
    }
  };

  const onUp = (e) => {
    const d = drag.current;
    drag.current = null;
    try { svgRef.current.releasePointerCapture(e.pointerId); } catch { /* sin captura */ }
    if (d && d.kind === "draw") {
      const c = curTrazo;
      const ok = c && (c.kind === "path" ? c.pts.length > 1 : dist(c.pts[0], c.pts[1]) > 0.15);
      if (ok) setTrazos((ts) => [...ts, c]);
      setCurTrazo(null);
      return;
    }
    if (d && d.before) pushPast(d.before);
  };

  const onWheel = (e) => {
    e.preventDefault();
    const r = svgRef.current.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const w = toWorldRaw(mx, my);
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const scale = Math.max(8, Math.min(300, view.scale * factor));
    setView({ scale, tx: mx - w.x * scale, ty: my - w.y * scale });
  };

  const onDouble = () => {
    if (draft.length >= 3) { if (tool === "lote") closeLote(draft); else if (tool === "wall") closeDraft(draft); }
  };

  // ── teclado ───────────────────────────────────────────────
  useEffect(() => {
    const h = (e) => {
      if (e.target.tagName === "INPUT") return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
      if (e.key === "Escape") { setDraft([]); setSelId(null); setSelItem(null); setMultiSel([]); setShowDistrib(false); setShowTipo(false); setShowLib(false); setCalib([]); }
      if (e.key === "Enter" && tool === "wall") onDouble();
      if (e.key === "r" || e.key === "R") rotateSel();
      if (e.key === "Backspace" || e.key === "Delete") {
        if (tool === "wall" && draft.length) { e.preventDefault(); setDraft(draft.slice(0, -1)); }
        else if (multiSel.length) {
          e.preventDefault();
          const rIds = new Set(multiSel.filter((m) => m.t === "room").map((m) => m.id));
          const iIds = new Set(multiSel.filter((m) => m.t === "item").map((m) => m.id));
          const delRooms = rooms.filter((r) => rIds.has(r.id));
          items.forEach((it) => { if (delRooms.some((r) => pointInPolygon({ x: it.x, y: it.y }, r.pts))) iIds.add(it.id); });
          commit(rooms.filter((r) => !rIds.has(r.id)), items.filter((t) => !iIds.has(t.id)));
          setMultiSel([]); setSelId(null); setSelItem(null);
        }
        else if (selItem || selId) { e.preventDefault(); deleteSel(); }
      }
      if (e.key === "v" || e.key === "V") setTool("select");
      if (e.key === "w" || e.key === "W") setTool("wall");
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [undo, redo, tool, draft, selId, selItem, deleteSel, rotateSel, multiSel, rooms, items, commit]); // eslint-disable-line

  // ── export lámina BAM ─────────────────────────────────────
  const exportSVG = () => {
    if (!rooms.length) return;
    const fchr = { ...ficha, fecha: ficha.fecha || new Date().toLocaleDateString("es-PE", { month: "long", year: "numeric" }) };
    const svg = laminaSVG({ rooms, items, muro }, fchr);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    a.download = `${(ficha.lamina || "lamina").replace(/[^\w-]/g, "")}_${(ficha.proyecto || "plano").replace(/[^\w-]/g, "_").slice(0, 30)}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ── exportar a la Mesa de Trabajo ─────────────────────────
  // la Mesa lee el plano de hygge:editorPlanos (STORE); el editor guarda en el
  // project store, así que acá puenteamos: escribimos el snap actual en STORE,
  // dejamos la Mesa apuntada a la pestaña Planos, y navegamos a la app.
  const exportarAMesa = () => {
    if (!rooms.length) return;
    const fchr = { ...ficha, proyecto: ficha.proyecto || proyecto?.nombre };
    const snap = { rooms, items, muro, altura, view, lote, tipoLote, retiro, retiroLat, retiroPost, frontIdx, brief, ficha: fchr };
    try {
      localStorage.setItem(STORE, JSON.stringify(snap));
      localStorage.setItem("hygge:mesaTabInicial", "planos");
    } catch { /* cuota */ }
    if (navigate) navigate("app-mesa");
  };

  // ── rejilla ───────────────────────────────────────────────
  const box = wrapRef.current?.getBoundingClientRect();
  const gridLines = [];
  if (box) {
    const tl = toWorldRaw(0, 0), br = toWorldRaw(box.width, box.height);
    const step = view.scale < 18 ? 5 : 1;
    for (let x = Math.floor(tl.x / step) * step; x <= Math.ceil(br.x / step) * step; x += step) {
      const major = Math.abs(x % 5) < 1e-6;
      gridLines.push(<line key={`gx${x}`} x1={x * view.scale + view.tx} y1={0} x2={x * view.scale + view.tx} y2={box.height}
        stroke={major ? "#DCD9D2" : C.line} strokeWidth={major ? 1 : 0.6} />);
    }
    for (let y = Math.floor(tl.y / step) * step; y <= Math.ceil(br.y / step) * step; y += step) {
      const major = Math.abs(y % 5) < 1e-6;
      gridLines.push(<line key={`gy${y}`} x1={0} y1={y * view.scale + view.ty} x2={box.width} y2={y * view.scale + view.ty}
        stroke={major ? "#DCD9D2" : C.line} strokeWidth={major ? 1 : 0.6} />);
    }
  }

  const sel = rooms.find((r) => r.id === selId);
  const selItemObj = items.find((t) => t.id === selItem);

  // reglas duras en vivo: nada fuera del lote · nada sin piso · flujos efectivos
  const val = useMemo(
    () => validarPlan({ rooms, items, limite: lote?.pts || footprint || null }),
    [rooms, items, lote, footprint]
  );
  const totalArea = rooms.reduce((a, r) => a + area(r.pts), 0);
  const preview = (tool === "wall" || tool === "lote") && draft.length > 0 && cursor
    ? { a: draft[draft.length - 1], b: cursor } : null;
  const k = view.scale;
  const wallPx = Math.max(muro * k, 1.5);
  const aberturas = items.filter((t) => porId[t.ref]?.cat === "abertura");
  const muebles = items.filter((t) => porId[t.ref]?.cat !== "abertura");

  // Feyd-Rautha 🗡️ · null | "cargando" | { veredicto, problemas, rooms }
  const [feyd, setFeyd] = useState(null);
  const consultarFeyd = async () => {
    if (!rooms.length || feyd === "cargando") return;
    setFeyd("cargando");
    try {
      setFeyd(await corregirConFeyd(rooms, brief));
    } catch (e) {
      setFeyd({ veredicto: `no se pudo consultar: ${e.message}`, problemas: [], rooms: null });
    }
  };
  const aplicarFeyd = () => {
    // los muebles viajan con su ambiente corregido (F1) — antes quedaban en
    // coordenadas viejas y terminaban flotando fuera de los muros de Feyd.
    if (feyd?.rooms?.length) commit(feyd.rooms, reanclarItems(items, rooms, feyd.rooms));
    setFeyd(null);
  };

  return (
    <div ref={rootRef} style={{ display: "flex", flexDirection: "column", height: maximized ? "100vh" : "100%", width: "100%", background: C.paper, minHeight: 520, position: maximized ? "fixed" : "relative", inset: maximized ? 0 : undefined, zIndex: maximized ? 9998 : undefined, overflow: "hidden" }}>
      {/* toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "12px 16px", borderBottom: `1px solid ${C.line}` }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, marginRight: 4 }}>
          <BamLogo height={15} />
          <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", textTransform: "lowercase", color: C.ink }}>editor de planos</span>
        </span>
        {/* flujo: 1 lote (medianera/esquina + retiros) → 2 distribución → 3 tipologías */}
        <Btn active={loteBar} onClick={() => setLoteBar((s) => !s)} title="Paso 1 · lote: medianera/esquina, retiros, calcar terreno">
          <b style={{ color: loteBar ? C.card : lote ? C.peri : C.orange }}>1</b> lote {lote ? "✓" : ""}
        </Btn>
        <Btn onClick={abrirDistribuciones} disabled={!footprint}
          title={footprint ? "Paso 2 · elegir la distribución de la planta (core, corredor, bloques)" : "Primero calca el lote (paso 1)"}>
          <b style={{ color: footprint ? C.orange : C.line }}>2</b> distribución {parti ? "✓" : ""}
        </Btn>
        <Btn accent active={showTipo} onClick={() => { setShowTipo((s) => !s); setTipoUnit(null); }} disabled={!parti}
          title={parti ? "Paso 3 · tocá un depto para asignarle su tipología (Feyd la redibuja a su medida)" : "Primero elige una distribución (paso 2)"}>
          <Sparkles size={13} /> <b>3</b> tipologías
        </Btn>
        <div style={{ width: 1, height: 22, background: C.line }} />
        <Btn active={tool === "select"} onClick={() => setTool("select")} title="Seleccionar / mover (V)"><MousePointer2 size={13} /> mover</Btn>
        <Btn active={tool === "wall"} onClick={() => setTool("wall")} title="Dibujar muros (W)"><PenLine size={13} /> muro</Btn>

        <ToolMenu label="insertar" icon={<Plus size={13} style={{ marginRight: 4 }} />} width={210}>
          <Btn active={showLib} onClick={() => setShowLib((s) => !s)} title="Librería de mobiliario"><Plus size={13} /> mueble</Btn>
          <Btn active={showRepo} onClick={() => setShowRepo((s) => !s)} title="Repositorio de ambientes amueblados"><Plus size={13} /> ambiente</Btn>
          <Btn active={showTipoCfg} onClick={() => setShowTipoCfg((s) => !s)} title="Armar una tipología por programa (habitaciones, baños, cocina…)"><Plus size={13} /> tipología (armar)</Btn>
          <Btn active={showTipoNexo} onClick={() => setShowTipoNexo((s) => !s)} title="Biblioteca de tipologías (todos los tamaños) redibujadas por Feyd"><Plus size={13} /> biblioteca de tipologías</Btn>
        </ToolMenu>

        <ToolMenu label="vista" icon={<Box size={13} style={{ marginRight: 4 }} />} width={210}>
          <Btn active={showDibujo} onClick={() => { const n = !showDibujo; setShowDibujo(n); setTool(n ? "draw" : "select"); }} title="Dibujo lineal (whiteboard)">✏️ dibujo</Btn>
          <Btn active={show3D} onClick={() => setShow3D((s) => !s)} title="Visor 3D vivo del plano"><Box size={13} /> 3D</Btn>
          <Btn active={maximized} onClick={toggleMax} title={maximized ? "Reducir" : "Ampliar la zona de trabajo"}>{maximized ? "⤡ reducir" : "⤢ ampliar"}</Btn>
          <div style={{ height: 1, background: C.line, margin: "2px 0" }} />
          <Btn active={snapOn} onClick={() => setSnapOn((s) => !s)} title="Ajustar a rejilla"><Magnet size={13} /> rejilla</Btn>
          <Btn active={orthoOn} onClick={() => setOrthoOn((s) => !s)} title="Bloqueo ortogonal">⌐ ortogonal</Btn>
          <Btn active={dims} onClick={() => setDims((s) => !s)} title="Mostrar cotas"><Ruler size={13} /> cotas</Btn>
          <div style={{ height: 1, background: C.line, margin: "2px 0" }} />
          <div style={{ display: "flex", gap: 8, padding: "2px 4px" }}>
            <label style={{ display: "flex", alignItems: "baseline", gap: 4, fontFamily: mono, fontSize: 10, color: C.soft }}>
              muro
              <input type="number" value={muro} step={0.025} min={0.08} max={0.35} onChange={(e) => setMuro(parseFloat(e.target.value) || 0.15)}
                style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, color: C.ink, width: 46, textAlign: "right", border: `1px solid ${C.line}`, borderRadius: 2, background: C.card, outline: "none", padding: "3px 5px" }} /> m
            </label>
            <label style={{ display: "flex", alignItems: "baseline", gap: 4, fontFamily: mono, fontSize: 10, color: C.soft }}>
              altura
              <input type="number" value={altura} step={0.05} min={2.2} max={3.5} onChange={(e) => setAltura(parseFloat(e.target.value) || 2.4)}
                style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, color: C.ink, width: 46, textAlign: "right", border: `1px solid ${C.line}`, borderRadius: 2, background: C.card, outline: "none", padding: "3px 5px" }} /> m
            </label>
          </div>
        </ToolMenu>

        <ToolMenu label="editar" icon={<Undo2 size={13} style={{ marginRight: 4 }} />}>
          <Btn onClick={undo} disabled={!past.current.length} title="Deshacer (⌘Z)"><Undo2 size={13} /> deshacer</Btn>
          <Btn onClick={redo} disabled={!future.current.length} title="Rehacer (⌘⇧Z)"><Redo2 size={13} /> rehacer</Btn>
          <Btn onClick={fitView} title="Encuadrar"><Maximize2 size={13} /> encuadrar</Btn>
          <Btn onClick={() => setShowFicha(true)} title="Editar membrete de la lámina"><StickyNote size={13} /> membrete</Btn>
        </ToolMenu>

        <div style={{ width: 1, height: 22, background: C.line }} />
        <Btn onClick={exportSVG} disabled={!rooms.length} title="Exportar lámina BAM (.svg)"><Download size={13} /> lámina</Btn>
        <Btn onClick={exportarAMesa} disabled={!rooms.length || !navigate} title="Enviar a la Mesa de Trabajo (pestaña Planos)"><StickyNote size={13} /> → mesa</Btn>
        <Btn onClick={consultarFeyd} disabled={!rooms.length || feyd === "cargando"}
          title="Feyd-Rautha 🗡️ audita la planta contra RNE + Neufert + checklist BAM y propone la corrección">
          <Sword size={13} /> {feyd === "cargando" ? "auditando…" : "feyd"}
        </Btn>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {selItem && <Btn onClick={rotateSel} title="Rotar 90° (R)"><RotateCw size={13} /></Btn>}
          {selId && !selItem && (
            <input value={sel?.name || ""} onChange={(e) => renameSel(e.target.value)} placeholder="nombre"
              style={{ fontFamily: mono, fontSize: 12, color: C.ink, width: 120, textAlign: "right", background: C.card,
                border: `1px solid ${C.line}`, borderRadius: 2, padding: "5px 8px", outline: "none" }} />
          )}
          {(selId || selItem) && <Btn onClick={deleteSel} title="Eliminar (Supr)"><Trash2 size={13} /></Btn>}
          {(rooms.length > 0 || items.length > 0) && (
            <span title={val.ok ? "cumple las reglas: nada fuera del lote · nada sin piso · flujos efectivos" : val.mensajes.join(" · ")}
              style={{ fontFamily: mono, fontSize: 10.5, fontWeight: 700, padding: "4px 9px", borderRadius: 2, whiteSpace: "nowrap",
                color: val.ok ? "#2E7D32" : C.card, background: val.ok ? "#E7F1E8" : C.orange,
                border: `1px solid ${val.ok ? "#B6D4B8" : C.orange}` }}>
              {val.ok ? "✓ reglas" : `▲ ${val.total} · ${val.mensajes.join(" · ")}`}
            </span>
          )}
          <button onClick={clearAll} style={{ fontFamily: mono, fontSize: 10.5, color: C.soft, background: "none", border: "none", cursor: "pointer" }}>limpiar</button>
        </div>
      </div>

      {/* Feyd auditando · el análisis tarda ~30s, hay que mostrar que está trabajando */}
      {feyd === "cargando" && (
        <div style={{ position: "absolute", right: 16, bottom: 16, zIndex: 55, width: 380, maxWidth: "calc(100% - 32px)",
          background: C.card, border: `1px solid ${C.line}`, borderLeft: "3px solid #A85B5B", borderRadius: 3,
          padding: "14px 16px", boxShadow: "0 8px 28px rgba(0,0,0,0.18)", display: "flex", alignItems: "center", gap: 10 }}>
          <style>{"@keyframes feydspin{to{transform:rotate(360deg)}}"}</style>
          <Sword size={14} color="#A85B5B" style={{ animation: "feydspin 1.4s linear infinite", flexShrink: 0 }} />
          <div>
            <div style={{ fontFamily: sans, fontSize: 12, fontWeight: 700, color: C.ink }}>Feyd está destrozando tu planta…</div>
            <div style={{ fontFamily: mono, fontSize: 10, color: C.soft, marginTop: 2 }}>audita contra RNE + checklist BAM · ~30s</div>
          </div>
        </div>
      )}

      {/* veredicto de Feyd-Rautha 🗡️ */}
      {feyd && feyd !== "cargando" && (
        <div style={{ position: "absolute", right: 16, bottom: 16, zIndex: 55, width: 380, maxWidth: "calc(100% - 32px)",
          background: C.card, border: `1px solid ${C.line}`, borderLeft: "3px solid #A85B5B", borderRadius: 3,
          padding: "12px 14px", boxShadow: "0 8px 28px rgba(0,0,0,0.18)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <Sword size={12} color="#A85B5B" />
            <span style={{ fontFamily: sans, fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "lowercase", color: C.ink }}>feyd-rautha</span>
            <button onClick={() => setFeyd(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer" }}><X size={13} color={C.soft} /></button>
          </div>
          <div style={{ fontFamily: mono, fontSize: 11, color: C.ink, lineHeight: 1.55, marginBottom: feyd.problemas.length ? 8 : 0, whiteSpace: "pre-wrap" }}>
            {feyd.veredicto}
          </div>
          {feyd.problemas.slice(0, 8).map((p, i) => (
            <div key={i} style={{ fontFamily: mono, fontSize: 9.5, color: C.soft, lineHeight: 1.6 }}>· {p}</div>
          ))}
          {feyd.problemas.length > 8 && (
            <div style={{ fontFamily: mono, fontSize: 9.5, color: C.soft }}>… y {feyd.problemas.length - 8} más</div>
          )}
          {feyd.rooms?.length > 0 && (
            <button onClick={aplicarFeyd}
              style={{ width: "100%", marginTop: 10, fontFamily: mono, fontSize: 11.5, color: C.card,
                background: "#A85B5B", border: "none", borderRadius: 2, padding: "8px 0", cursor: "pointer" }}
              title="Reemplaza los ambientes por la corrección de Feyd (⌘Z deshace)">
              aplicar corrección de feyd →
            </button>
          )}
        </div>
      )}

      {/* paso 1 · barra de lote: tipo de lote → retiros normativos → calcar */}
      {loteBar && (() => {
        const li = { display: "flex", alignItems: "baseline", gap: 4, fontFamily: mono, fontSize: 10, color: C.soft };
        const inp = { fontFamily: mono, fontSize: 11, fontWeight: 600, color: C.ink, width: 46, textAlign: "right", border: `1px solid ${C.line}`, borderRadius: 2, background: C.card, outline: "none", padding: "3px 5px" };
        const fr = footprint ? orientedFrame(footprint, frontIdx) : null;
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "8px 16px", borderBottom: `1px solid ${C.line}`, background: "#F4F2EC" }}>
            <span style={{ fontFamily: mono, fontSize: 9.5, color: C.peri, fontWeight: 700 }}>1 · lote ▸</span>
            <label style={li}>tipo
              <select value={tipoLote} onChange={(e) => setTipoLote(e.target.value)}
                style={{ ...inp, width: "auto", textAlign: "left" }}>
                <option value="medianera">entre medianeras</option>
                <option value="esquina">esquina</option>
              </select></label>
            <label style={li}>retiro frontal
              <input type="number" value={retiro} step={0.5} min={0} onChange={(e) => setRetiro(parseFloat(e.target.value) || 0)} style={inp} /> m</label>
            <label style={li}>retiro posterior
              <input type="number" value={retiroPost} step={0.5} min={0} onChange={(e) => setRetiroPost(parseFloat(e.target.value) || 0)} style={inp} /> m</label>
            {tipoLote === "esquina" && (
              <label style={li}>retiro calle lateral
                <input type="number" value={retiroLat} step={0.5} min={0} onChange={(e) => setRetiroLat(parseFloat(e.target.value) || 0)} style={inp} /> m</label>
            )}
            <div style={{ width: 1, height: 20, background: C.line }} />
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPlano(f); e.target.value = ""; }} />
            <Btn onClick={() => fileRef.current?.click()} title="Subir el plano del terreno (imagen)"><Upload size={13} /> subir plano</Btn>
            {plano && (
              <label style={li}>opacidad
                <input type="range" min={0.1} max={1} step={0.05} value={plano.opacity}
                  onChange={(e) => setPlano((pl) => ({ ...pl, opacity: parseFloat(e.target.value) }))} style={{ width: 64 }} />
              </label>
            )}
            <Btn active={tool === "calibrate"} onClick={() => { setCalib([]); setTool("calibrate"); }} disabled={!plano}
              title="Calibrar escala: clic en 2 puntos de distancia conocida"><Crosshair size={13} /> calibrar</Btn>
            <Btn active={tool === "lote"} onClick={() => setTool("lote")} title="Calcar el contorno del terreno"><PenLine size={13} /> calcar lote</Btn>
            <div style={{ width: 1, height: 20, background: C.line }} />
            <Btn onClick={importarCabida} accent title="Traer el contorno real del lote desde la cabida (el que importaste por CAD)"><Download size={13} /> importar desde cabida</Btn>
            {cabidaMsg && <span style={{ fontFamily: mono, fontSize: 10, color: C.peri }}>{cabidaMsg}</span>}
            <div style={{ width: 1, height: 20, background: C.line }} />
            <Btn onClick={cycleFront} disabled={!lote} title="Rotar el borde-frente (hacia la calle); en esquina, la calle lateral es el borde siguiente"><RefreshCw size={12} /> frente</Btn>
            {fr && <span style={{ fontFamily: mono, fontSize: 10, color: C.soft }}>footprint {fmt(area(footprint), 0)} m² · {fmt(fr.frente, 1)}×{fmt(fr.fondo, 1)} m{isConvex(footprint) ? "" : " · no convexo"}</span>}
            {lote && !footprint && <span style={{ fontFamily: mono, fontSize: 10, color: C.orange }}>▲ los retiros dejan el lote sin área construible</span>}
            {footprint && <span style={{ marginLeft: "auto", fontFamily: mono, fontSize: 9.5, color: C.peri, fontWeight: 700 }}>listo → 2 · distribución</span>}
          </div>
        );
      })()}

      {/* lienzo */}
      <div ref={wrapRef} style={{ flex: 1, position: "relative", overflow: "hidden", cursor: (tool === "wall" || tool === "lote" || tool === "calibrate") ? "crosshair" : "default" }}>
        <svg ref={svgRef} width="100%" height="100%" style={{ display: "block", touchAction: "none", background: C.card }}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
          onWheel={onWheel} onDoubleClick={onDouble} onContextMenu={(e) => e.preventDefault()}>
          {/* plano de fondo */}
          {plano && (() => {
            const o = toScreen({ x: plano.ox, y: plano.oy });
            return <image href={plano.src} x={o.x} y={o.y}
              width={plano.w * plano.mpp * view.scale} height={plano.h * plano.mpp * view.scale}
              opacity={plano.opacity} preserveAspectRatio="none" style={{ pointerEvents: "none" }} />;
          })()}

          {gridLines}

          {/* lote (línea de propiedad) + footprint construible */}
          {lote && (
            <>
              <polygon points={lote.pts.map(toScreen).map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none" stroke={C.peri} strokeWidth={2.5} strokeDasharray="10 5" />
              {(() => {
                const a = toScreen(lote.pts[frontIdx]), b = toScreen(lote.pts[(frontIdx + 1) % lote.pts.length]);
                const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
                return (
                  <g>
                    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={C.orange} strokeWidth={3.5} />
                    <text x={m.x} y={m.y - 6} fontFamily={mono} fontSize={9} fill={C.orange} textAnchor="middle">frente</text>
                  </g>
                );
              })()}
              {/* cotas de los linderos (medidas reales en metros) */}
              {dims && (() => {
                const n = lote.pts.length;
                const c0 = lote.pts.reduce((s, p) => ({ x: s.x + p.x / n, y: s.y + p.y / n }), { x: 0, y: 0 });
                return lote.pts.map((p, i) => {
                  const q = lote.pts[(i + 1) % n];
                  const L = dist(p, q);
                  const a = toScreen(p), z = toScreen(q);
                  if (Math.hypot(z.x - a.x, z.y - a.y) < 30) return null;
                  const mw = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
                  const ox = mw.x - c0.x, oy = mw.y - c0.y; const oL = Math.hypot(ox, oy) || 1;
                  const t = toScreen({ x: mw.x + (ox / oL) * (14 / view.scale) * 1.2, y: mw.y + (oy / oL) * (14 / view.scale) * 1.2 });
                  return (
                    <text key={`lc${i}`} x={t.x} y={t.y + 3} fontFamily={mono} fontSize={9.5} fontWeight={600}
                      fill={C.peri} textAnchor="middle" stroke={C.card} strokeWidth={3} paintOrder="stroke">
                      {fmt(L, 2)}
                    </text>
                  );
                });
              })()}
            </>
          )}
          {footprint && (
            <polygon points={footprint.map(toScreen).map((p) => `${p.x},${p.y}`).join(" ")}
              fill={C.peri} fillOpacity={0.1} stroke={C.peri} strokeWidth={1.6} strokeDasharray="4 3" />
          )}
          {/* marcadores de calibración */}
          {tool === "calibrate" && calib.map((p, i) => {
            const s = toScreen(p);
            return <circle key={i} cx={s.x} cy={s.y} r={5} fill={C.orange} stroke={C.card} strokeWidth={1.5} />;
          })}

          {/* ambientes: SOLO relleno (el muro va en una capa aparte para no duplicarlo) */}
          {rooms.map((r, i) => {
            const scr = r.pts.map(toScreen);
            const selected = r.id === selId || inMulti("room", r.id);
            const terraza = r.tipo === "terraza"; // borde fino punteado, no es muro
            return (
              <polygon key={r.id} points={scr.map((p) => `${p.x},${p.y}`).join(" ")}
                fill={roomFill(r, i)} fillOpacity={selected ? 0.95 : 0.8}
                stroke={terraza ? C.ink : "none"} strokeWidth={terraza ? 1.2 : 0}
                strokeDasharray={terraza ? "6 4" : undefined} strokeLinejoin="miter" />
            );
          })}
          {/* muros: aristas deduplicadas (una arista compartida = un solo muro; sin terrazas) */}
          <g pointerEvents="none">
            {(() => {
              const q = (n) => Math.round(n / 0.1) * 0.1, seen = new Set(), segs = [];
              rooms.forEach((r) => {
                if (r.tipo === "terraza" || !r.pts?.length) return;
                const p = r.pts;
                for (let i = 0; i < p.length; i++) {
                  const a = p[i], b = p[(i + 1) % p.length];
                  const ka = `${q(a.x)},${q(a.y)}`, kb = `${q(b.x)},${q(b.y)}`;
                  const key = ka < kb ? ka + "|" + kb : kb + "|" + ka;
                  if (seen.has(key)) continue;
                  seen.add(key); segs.push([a, b]);
                }
              });
              return segs.map(([a, b], idx) => { const A = toScreen(a), B = toScreen(b); return <line key={idx} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={C.ink} strokeWidth={wallPx} strokeLinecap="square" />; });
            })()}
          </g>
          {/* resalte del ambiente seleccionado (encima de los muros) */}
          {rooms.map((r) => ((r.id === selId || inMulti("room", r.id)) && r.tipo !== "terraza") ? (
            <polygon key={`sel-${r.id}`} points={r.pts.map(toScreen).map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none" stroke={C.orange} strokeWidth={wallPx + 1.5} strokeLinejoin="miter" pointerEvents="none" />
          ) : null)}

          {/* aberturas (cortan el muro) */}
          {aberturas.map((t) => {
            const s = toScreen({ x: t.x, y: t.y });
            return <Simbolo key={t.id} it={{ ...t, d: Math.max(t.d, muro) }} px={s.x} py={s.y} k={k} selected={t.id === selItem || inMulti("item", t.id)} />;
          })}

          {/* mobiliario */}
          {muebles.map((t) => {
            const s = toScreen({ x: t.x, y: t.y });
            return <Simbolo key={t.id} it={t} px={s.x} py={s.y} k={k} selected={t.id === selItem || inMulti("item", t.id)} />;
          })}

          {/* dibujo (croquis) — capa encima del plano · path / línea / flecha / rect / elipse */}
          {[...trazos, ...(curTrazo ? [curTrazo] : [])].map((tr) => {
            const sp = tr.pts.map(toScreen);
            const stroke = tr.color, sw = tr.w || 2, op = tr.opacity ?? 1;
            const none = { pointerEvents: "none" };
            if ((tr.kind === "line" || tr.kind === "arrow") && sp.length >= 2) {
              const a = sp[0], b = sp[sp.length - 1];
              const ang = Math.atan2(b.y - a.y, b.x - a.x), L = 11;
              return (
                <g key={tr.id} opacity={op} style={none}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
                  {tr.kind === "arrow" && <polyline points={`${b.x - L * Math.cos(ang - 0.4)},${b.y - L * Math.sin(ang - 0.4)} ${b.x},${b.y} ${b.x - L * Math.cos(ang + 0.4)},${b.y - L * Math.sin(ang + 0.4)}`} fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />}
                </g>
              );
            }
            if (tr.kind === "rect" && sp.length >= 2) {
              const a = sp[0], b = sp[1];
              return <rect key={tr.id} x={Math.min(a.x, b.x)} y={Math.min(a.y, b.y)} width={Math.abs(b.x - a.x)} height={Math.abs(b.y - a.y)} fill="none" stroke={stroke} strokeWidth={sw} opacity={op} style={none} />;
            }
            if (tr.kind === "ellipse" && sp.length >= 2) {
              const a = sp[0], b = sp[1];
              return <ellipse key={tr.id} cx={(a.x + b.x) / 2} cy={(a.y + b.y) / 2} rx={Math.abs(b.x - a.x) / 2} ry={Math.abs(b.y - a.y) / 2} fill="none" stroke={stroke} strokeWidth={sw} opacity={op} style={none} />;
            }
            return <polyline key={tr.id} points={sp.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" opacity={op} style={none} />;
          })}

          {/* reglas — resalta lo que incumple (fuera del lote / sin piso / sin acceso) */}
          {val.ids.size > 0 && (
            <g pointerEvents="none">
              {rooms.filter((r) => val.ids.has(r.id)).map((r) => (
                <polygon key={`v-${r.id}`} points={r.pts.map(toScreen).map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="#F7643B" fillOpacity={0.12} stroke="#F7643B" strokeWidth={2.2} strokeDasharray="7 4" strokeLinejoin="miter" />
              ))}
              {items.filter((t) => val.ids.has(t.id)).map((t) => {
                const s = toScreen({ x: t.x, y: t.y });
                const rr = Math.max((t.w || 0.6) * k, (t.d || 0.6) * k) / 2 + 6;
                return <circle key={`v-${t.id}`} cx={s.x} cy={s.y} r={rr} fill="none" stroke="#F7643B" strokeWidth={2.2} strokeDasharray="6 4" />;
              })}
            </g>
          )}

          {/* cotas + etiquetas */}
          {rooms.map((r) => {
            const c = toScreen(centroid(r.pts));
            const a = area(r.pts);
            const small = a * k * k < 5200;
            return (
              <g key={`lbl-${r.id}`} pointerEvents="none">
                {dims && r.id === selId && r.pts.map((p, pi) => {
                  const q = r.pts[(pi + 1) % r.pts.length];
                  const L = dist(p, q);
                  if (L < 0.15) return null;
                  const m = toScreen({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
                  const ang = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
                  const flip = ang > 90 || ang < -90;
                  return (
                    <text key={pi} x={m.x} y={m.y} fontFamily={mono} fontSize={9.5} fill={C.peri}
                      textAnchor="middle" dominantBaseline="central"
                      transform={`rotate(${flip ? ang + 180 : ang} ${m.x} ${m.y}) translate(0 -7)`}>
                      {fmt(L, 2)}
                    </text>
                  );
                })}
                <text x={c.x} y={c.y} fontFamily={mono} fontSize={small ? 8.5 : 10.5} fontWeight={700}
                  fill={C.peri} textAnchor="middle" style={{ paintOrder: "stroke" }} stroke={C.card} strokeWidth={2.5}>
                  {r.name}
                  {!small && <tspan x={c.x} dy="12" fontSize={8.5} fontWeight={400} fill={C.peri} stroke={C.card} strokeWidth={2.5}>{fmt(a, 1)} m²</tspan>}
                </text>
              </g>
            );
          })}

          {/* vértices del ambiente seleccionado */}
          {tool === "select" && sel && sel.pts.map(toScreen).map((p, pi) => (
            <rect key={pi} x={p.x - 4} y={p.y - 4} width={8} height={8} fill={C.card} stroke={C.orange} strokeWidth={1.5} />
          ))}

          {/* draft */}
          {draft.length > 0 && (
            <>
              <polyline points={draft.map(toScreen).map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none" stroke={C.orange} strokeWidth={2} />
              {draft.map(toScreen).map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={i === 0 ? 5 : 3.5}
                  fill={i === 0 ? C.orange : C.card} stroke={C.orange} strokeWidth={1.5} />
              ))}
            </>
          )}
          {preview && (() => {
            const a = toScreen(preview.a), b = toScreen(preview.b);
            const L = dist(preview.a, preview.b);
            const closing = draft.length >= 3 && dist(preview.b, draft[0]) < 14 / view.scale;
            return (
              <g>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={closing ? C.peri : C.orange} strokeWidth={2} strokeDasharray="4 3" />
                <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 7} fontFamily={mono} fontSize={10}
                  fill={closing ? C.peri : C.orange} textAnchor="middle">
                  {closing ? "cerrar ambiente" : `${fmt(L, 2)} m`}
                </text>
              </g>
            );
          })()}
          {cursor && !drag.current && (tool === "wall" || tool === "lote") && (
            <circle cx={toScreen(cursor).x} cy={toScreen(cursor).y} r={cursor.snappedTo ? 6 : 3}
              fill="none" stroke={cursor.snappedTo ? C.peri : C.soft} strokeWidth={1.5} />
          )}
        </svg>

        {!rooms.length && !draft.length && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ textAlign: "center", fontFamily: mono, fontSize: 12, color: C.soft, lineHeight: 1.9 }}>
              <b style={{ color: C.orange }}>1 lote</b> elige medianera/esquina, retiros y calca el terreno ·{" "}
              <b style={{ color: C.orange }}>2 distribución</b> elige el parti de la planta<br />
              <b style={{ color: C.orange }}>3 tipologías</b> asigna y amuebla según NSE, con terraza y jardineras<br />
              <span style={{ fontSize: 10.5 }}>también puedes dibujar a mano con <b style={{ color: C.ink }}>muro</b> · R = rotar mueble · rueda = zoom · alt+arrastrar = paneo · ⌘Z = deshacer</span>
            </div>
          </div>
        )}

        {showLib && <LibPanel onAdd={addItem} onClose={() => setShowLib(false)} />}
        {showRepo && <RepoAmbientesPanel onAdd={insertAmbiente} onClose={() => setShowRepo(false)} />}
        {showTipoCfg && <ConfigTipologiaPanel onArmar={armarTipologia} onClose={() => setShowTipoCfg(false)} />}
        {showTipoNexo && <TipologiasNexoPanel onInsert={insertTipologia} onClose={() => setShowTipoNexo(false)} />}
        {showDibujo && <DibujoPalette tool={tool} setTool={setTool} penVariant={penVariant} setPenVariant={setPenVariant} penColor={penColor} setPenColor={setPenColor} onClear={() => setTrazos([])} onClose={() => { setShowDibujo(false); setTool("select"); }} hayTrazos={trazos.length > 0} />}

        {/* visor 3D vivo — flota abajo a la derecha, reacciona al plano en vivo */}
        {show3D && (
          <div style={{ position: "absolute", right: 14, bottom: 14, width: 380, height: 300, background: C.card,
            border: `1px solid ${C.line}`, borderRadius: 4, boxShadow: "0 8px 30px rgba(0,0,0,0.18)", overflow: "hidden", zIndex: 30 }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", zIndex: 2, pointerEvents: "none" }}>
              <span style={{ fontFamily: mono, fontSize: 9.5, color: C.soft, background: "rgba(255,255,255,0.7)", padding: "2px 6px", borderRadius: 2 }}>3D · vivo · arrastra para orbitar</span>
              <button onClick={() => setShow3D(false)} style={{ marginLeft: "auto", pointerEvents: "auto", background: "rgba(255,255,255,0.8)", border: "none", borderRadius: 2, cursor: "pointer", padding: 2, lineHeight: 0 }}><X size={13} color={C.soft} /></button>
            </div>
            {rooms.length ? (
              <Vista3DBoundary>
                <Suspense fallback={<div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", fontFamily: mono, fontSize: 10, color: C.soft }}>cargando 3D…</div>}>
                  <Vista3D rooms={rooms} items={items} muro={muro} altura={altura} />
                </Suspense>
              </Vista3DBoundary>
            ) : (
              <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", fontFamily: mono, fontSize: 10, color: C.soft, textAlign: "center", padding: 20 }}>
                dibuja o genera ambientes<br />y aparecen aquí en 3D
              </div>
            )}
          </div>
        )}
      </div>

      {/* barra de estado */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "9px 16px", borderTop: `1px solid ${C.line}`, flexWrap: "wrap" }}>
        <span style={{ fontFamily: mono, fontSize: 11, color: C.ink }}>
          <b>{rooms.length}</b> <span style={{ color: C.soft }}>ambientes</span> · <b>{muebles.length}</b> <span style={{ color: C.soft }}>muebles</span>
        </span>
        <span style={{ fontFamily: mono, fontSize: 11, color: C.ink }}>
          área <b style={{ color: C.orange }}>{fmt(totalArea, 1)}</b> <span style={{ color: C.soft }}>m²</span>
        </span>
        {sel && !selItem && (
          <span style={{ fontFamily: mono, fontSize: 11, color: C.soft }}>
            {sel.name} · {fmt(area(sel.pts), 1)} m² · perím {fmt(perimeter(sel.pts), 1)} m
          </span>
        )}
        {selItemObj && (
          <span style={{ fontFamily: mono, fontSize: 11, color: C.soft }}>
            {porId[selItemObj.ref]?.nombre} · {selItemObj.w}×{selItemObj.d} m · R = rotar
          </span>
        )}
        <span style={{ marginLeft: "auto", fontFamily: mono, fontSize: 10, color: C.soft }}>
          muro {muro} m · h libre {altura} m · escala {fmt(view.scale)} px/m
        </span>
      </div>

      {showDistrib && (() => {
        const fr = footprint ? orientedFrame(footprint, frontIdx) : null;
        const info = fr ? `${tipoLote} · ${fmt(area(footprint), 0)} m² · ${fmt(fr.frente, 1)}×${fmt(fr.fondo, 1)} m` : "";
        return (
          <DistribModal partis={partis} brief={brief} setBrief={setBrief} loteInfo={info}
            onUse={(p) => { usarParti(p); setShowTipo(true); }}
            onRegen={() => setPartis(generarDistribuciones(footprint, frontIdx, brief))}
            onClose={() => setShowDistrib(false)} />
        );
      })()}
      {showTipo && !tipoUnit && !tipoStage && (
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", top: 60, zIndex: 40, background: "#1E2A4A", color: "#fff", padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, boxShadow: "0 4px 14px rgba(0,0,0,0.2)", display: "flex", alignItems: "center", gap: 10 }}>
          Paso 3 · tocá un depto para asignarle su tipología
          <button onClick={() => setShowTipo(false)} style={{ border: "none", background: "rgba(255,255,255,0.18)", color: "#fff", cursor: "pointer", borderRadius: 10, width: 18, height: 18, lineHeight: "16px", fontSize: 11 }}>✕</button>
        </div>
      )}
      {tipoStage && (
        <TipoStageModal stage={tipoStage}
          onConfirm={(nr, ni) => { aplicarTipoAUnit(tipoStage.unit, { rooms: nr, items: ni }); setTipoStage(null); }}
          onCancel={() => { setTipoStage(null); setSelId(null); }} />
      )}
      {showFicha && <FichaModal ficha={ficha} setFicha={setFicha} onClose={() => setShowFicha(false)} />}
    </div>
  );
}
