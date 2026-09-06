import { useState, useRef, useEffect, useCallback, useMemo, lazy, Suspense, Component } from "react";
import {
  MousePointer2, PenLine, Trash2, Undo2, Redo2, Download,
  Magnet, Ruler, Maximize2, Plus, RotateCw, X,
  Upload, Crosshair, RefreshCw, Box, GitBranch, StickyNote,
} from "lucide-react";
import {
  GRID, snapPt, ortho, dist, area, centroid, perimeter,
  pointInPolygon, nearestVertex, bbox,
  offsetEdges, orientedFrame, isConvex,
} from "./geometry.js";
import { CATALOGO, porId, CATS } from "./mobiliario.js";
import { Simbolo } from "./simbolos.jsx";
import { amoblarDorm, amoblarBano, amoblarCocina, amoblarSocial, it as furnIt } from "./distribucion.js";

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
import { laminaSVG } from "./lamina.js";
import { BamLogo } from "./marca.jsx";
import { isRoomEditable, materializeInteriorLayout, materializeUnitInteriors, materializeWithOneRevision, planALayout, preserveLockedRooms, resolveArchitectureProgram, roomsALayout, splitAcceptedFloor } from "./materialize.js";
import {
  applyPlanVersion, architectureDesignReadiness, buildArchitectureContext, createActivatedPlanVersion, createPlanVersion, critiqueWithTweedledee,
  designWithTweedledum, mapFindingLocation, reviseWithTweedledum, serializeValidation,
} from "./architecture.js";
import ArchitectureReviewPanel from "./ArchitectureReviewPanel.jsx";
import ProyectoTabs from "../cabida/ProyectoTabs.jsx";
import { useProyectos } from "../cabida/proyectos.js";
import { clasificarBordes } from "../cabida/loteReal.js";
import { proposalToParti } from "../cabida/floorProposal.js";

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
        <EditorPlanosInner key={`${activo.id}:${activo.plano?.floorProposal?.id || "none"}`} proyecto={activo} onSavePlano={guardar} navigate={navigate} />
      </div>
    </div>
  );
}

function EditorPlanosInner({ proyecto, onSavePlano, navigate }) {
  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const P = proyecto?.plano || {};                  // plano guardado del proyecto activo
  const acceptedFloorProposal = P.floorProposal || null;
  const seedAcceptedFloor = acceptedFloorProposal && P.floorProposalMaterializedId !== acceptedFloorProposal.id;
  const acceptedFloorRooms = seedAcceptedFloor
    ? proposalToParti({ summary: acceptedFloorProposal.summary, floor: acceptedFloorProposal.floor }).rooms
    : null;

  const [rooms, setRooms] = useState(acceptedFloorRooms || P.rooms || []);   // ambientes: { id, name, pts, tipo? }
  const [items, setItems] = useState(seedAcceptedFloor ? [] : (P.items || []));   // mobiliario/aberturas: { id, ref, x, y, rot, w, d }
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
  const [show3D, setShow3D] = useState(false);      // visor 3D vivo del plano
  const [brief, setBrief] = useState({
    areaObjetivo: 60, pct1: 25, pct2: 40, udsPiso: 4,          // distribución en lote
    nse: "C", terraza: true,                                   // tipologías
    ...(P.brief || {}),
  });
  const [ficha, setFicha] = useState(P.ficha ? { ...FICHA_DEF, ...P.ficha } : FICHA_DEF);
  const [showFicha, setShowFicha] = useState(false);
  const [showArchitecture, setShowArchitecture] = useState(false);
  const [architectureVersions, setArchitectureVersions] = useState(P.architectureVersions || []);
  const [architectureRuns, setArchitectureRuns] = useState(P.architectureRuns || []);
  const [activeArchitectureVersionId, setActiveArchitectureVersionId] = useState(P.activeArchitectureVersionId || null);
  const [architectureBusy, setArchitectureBusy] = useState(null);
  const [architectureError, setArchitectureError] = useState("");
  const [architectureResult, setArchitectureResult] = useState(null);

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

  // persiste el plano en el proyecto activo (instantáneo local + sync a la nube).
  // No guardamos la imagen base de calco (puede ser enorme): es solo apoyo de trazado.
  useEffect(() => {
    const snap = { rooms, items, muro, altura, view, lote, tipoLote, retiro, retiroLat, retiroPost, frontIdx, brief, ficha, trazos,
      floorProposal: acceptedFloorProposal, floorProposalMaterializedId: acceptedFloorProposal?.id || P.floorProposalMaterializedId || null,
      architectureVersions, architectureRuns, activeArchitectureVersionId };
    if (onSavePlano) onSavePlano(snap);
    else { try { localStorage.setItem(STORE, JSON.stringify(snap)); } catch { /* cuota */ } }
  }, [onSavePlano, rooms, items, muro, altura, view, lote, tipoLote, retiro, retiroLat, retiroPost, frontIdx, brief, ficha, trazos,
    architectureVersions, architectureRuns, activeArchitectureVersionId]);

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
      if (!isRoomEditable(r)) { setSelId(null); return; }
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
    setRooms((rs) => rs.map((r) => (r.id === selId && isRoomEditable(r) ? { ...r, name } : r)));

  const clearAll = () => {
    const editableRooms = rooms.filter(isRoomEditable);
    if ((editableRooms.length || items.length) && !window.confirm("¿Borrar los ambientes editables y el mobiliario?")) return;
    const canonicalLocked = acceptedFloorProposal?.floor
      ? splitAcceptedFloor(acceptedFloorProposal.floor).lockedRooms
      : rooms.filter((room) => !isRoomEditable(room));
    commit(preserveLockedRooms(canonicalLocked, []), []);
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

  // ── punteros ──────────────────────────────────────────────
  // arrastre grupal: junta las salas seleccionadas (+ sus muebles contenidos) y los items sueltos
  const buildMultiDrag = (world) => {
    const selRooms = [], selItemIds = new Set(multiSel.filter((m) => m.t === "item").map((m) => m.id));
    multiSel.filter((m) => m.t === "room").forEach((m) => {
      const r = rooms.find((x) => x.id === m.id);
      if (isRoomEditable(r)) { selRooms.push({ id: r.id, orig: r.pts }); items.forEach((it) => { if (pointInPolygon({ x: it.x, y: it.y }, r.pts)) selItemIds.add(it.id); }); }
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
    const editableRoomIndexes = rooms.map((room, index) => (isRoomEditable(room) ? index : -1)).filter((index) => index >= 0);
    const vHit = nearestVertex(editableRoomIndexes.map((index) => rooms[index]), world, 11 / view.scale);
    if (vHit) {
      const roomIdx = editableRoomIndexes[vHit.roomIdx];
      setSelId(rooms[roomIdx].id); setSelItem(null);
      drag.current = { kind: "vertex", roomIdx, ptIdx: vHit.ptIdx, before: snapshot() };
      svgRef.current.setPointerCapture(e.pointerId);
      return;
    }
    const inside = rooms.findIndex((r) => isRoomEditable(r) && pointInPolygon(world, r.pts));
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
  const designBoundary = footprint || lote?.pts || null;
  const architectureProgram = resolveArchitectureProgram(brief, rooms);
  const architectureBrief = { ...brief, program: architectureProgram };

  const snapshotLive = () => ({ rooms: structuredClone(rooms), items: structuredClone(items) });
  const ensureSourceVersion = () => {
    const active = architectureVersions.find((version) => version.id === activeArchitectureVersionId);
    const live = snapshotLive();
    if (active && JSON.stringify(active.snapshot) === JSON.stringify(live)) return { source: active, history: architectureVersions };
    const next = createPlanVersion(architectureVersions, {
      projectId: proyecto.id,
      parentVersionId: active?.id || null,
      createdBy: "human",
      snapshot: live,
    });
    setArchitectureVersions(next.history);
    setActiveArchitectureVersionId(next.version.id);
    return { source: next.version, history: next.history };
  };
  const contextFor = (sourcePlanVersionId) => buildArchitectureContext({
    project: { id: proyecto.id, name: proyecto.nombre || "Proyecto BAM" },
    brief,
    program: architectureProgram,
    lotBoundary: lote?.pts || null,
    designBoundary,
    site: { lotType: tipoLote, boundary: designBoundary, frontEdgeIndex: frontIdx },
    constraints: { setbacks: { front: retiro, side: retiroLat, rear: retiroPost }, wallThickness: muro, clearHeight: altura },
    lockedElements: rooms.filter((room) => room.tipo === "core").map((room) => ({ type: "room", id: room.id })),
    sourcePlanVersionId,
  });
  const contextForUnit = (sourcePlanVersionId, unit) => buildArchitectureContext({
    project: { id: proyecto.id, name: proyecto.nombre || "Proyecto BAM" },
    brief,
    program: { ...unit.program, nse: architectureProgram.nse },
    lotBoundary: lote?.pts || null,
    designBoundary: unit.boundary,
    site: { lotType: tipoLote, boundary: unit.boundary, frontEdgeIndex: frontIdx, sourceCabidaVersionId: acceptedFloorProposal?.sourceCabidaVersionId || null },
    constraints: { setbacks: { front: retiro, side: retiroLat, rear: retiroPost }, wallThickness: muro, clearHeight: altura },
    lockedElements: rooms.filter((room) => room.locked).map((room) => ({ type: "room", id: room.id })),
    sourcePlanVersionId,
  });
  const recordArchitectureRun = (run) => setArchitectureRuns((prev) => [...prev.slice(-49), { id: `ar_${Date.now().toString(36)}`, createdAt: new Date().toISOString(), ...run }]);
  const mappedCritique = (critique, targetRooms, targetItems) => ({
    ...critique,
    findings: (critique.findings || []).map((finding) => ({ ...finding, mappedLocation: mapFindingLocation(finding, targetRooms, targetItems) })),
  });
  const snapshotFromGenerated = (generated) => {
    if (!generated.validation.ok) {
      throw new Error(`La distribución interior no pasó las reglas: ${generated.validation.messages.slice(0, 3).join(" · ")}`);
    }
    return { rooms: generated.rooms, items: generated.items };
  };
  const designAcceptedFloor = (source) => materializeUnitInteriors({
    floor: acceptedFloorProposal.floor,
    designUnit: (unit) => {
      const unitProgram = { ...unit.program, nse: architectureProgram.nse };
      return designWithTweedledum({
        context: contextForUnit(source.id, unit),
        brief: { ...brief, program: unitProgram },
        planVersion: { id: source.id, layout: roomsALayout([{ id: unit.polygonId, name: unit.unitRef, tipo: "unidad", pts: unit.boundary }], { program: unitProgram }) },
        designObjective: `complete residential interior for ${unit.unitRef}`,
      });
    },
    reviseUnit: (unit, design, acceptedFindings) => {
      const unitProgram = { ...unit.program, nse: architectureProgram.nse };
      return reviseWithTweedledum({
        context: contextForUnit(source.id, unit),
        brief: { ...brief, program: unitProgram },
        planVersion: { id: source.id, layout: design.layout },
        acceptedFindings,
        designObjective: `repair deterministic interior geometry for ${unit.unitRef}`,
      });
    },
  });
  const runDesign = async () => {
    if (architectureBusy) return;
    const readiness = architectureDesignReadiness({ rooms, boundary: designBoundary, areaTarget: brief.areaObjetivo });
    if (!readiness.ok) { setArchitectureError(readiness.reason); return; }
    setArchitectureBusy("Tweedledum"); setArchitectureError("");
    try {
      const { source, history } = ensureSourceVersion();
      if (acceptedFloorProposal?.floor) {
        const resolvedFloor = await designAcceptedFloor(source);
        const proposal = createActivatedPlanVersion(history, {
          projectId: proyecto.id,
          parentVersionId: source.id,
          createdBy: "tweedledum",
          snapshot: { rooms: resolvedFloor.rooms, items: resolvedFloor.items },
        });
        setArchitectureVersions(proposal.history);
        commit(proposal.snapshot.rooms, proposal.snapshot.items);
        setActiveArchitectureVersionId(proposal.activeVersionId);
        const successful = resolvedFloor.unitResults.filter((unit) => unit.ok).length;
        recordArchitectureRun({
          mode: "design_units",
          sourceVersionId: source.id,
          sourceCabidaVersionId: acceptedFloorProposal.sourceCabidaVersionId,
          resultVersionId: proposal.version.id,
          units: resolvedFloor.unitResults.map((unit) => ({ unitRef: unit.unitRef, ok: unit.ok, repaired: unit.repaired })),
          agents: resolvedFloor.unitResults.flatMap((unit) => [unit.design, unit.revision].filter(Boolean).map((entry) => ({ key: entry.agent?.key || "tweedledum", promptVersion: entry.promptVersion || null }))),
        });
        setArchitectureResult({ mode: "design", design: { summary: `${successful}/${resolvedFloor.unitResults.length} unidades diseñadas` }, repaired: resolvedFloor.unitResults.some((unit) => unit.repaired), appliedVersionId: proposal.version.id });
        return;
      }
      const output = await designWithTweedledum({ context: contextFor(source.id), brief: architectureBrief, planVersion: { id: source.id, layout: roomsALayout(source.snapshot.rooms, architectureBrief) }, designObjective: "complete furnished residential interior" });
      const resolved = await materializeWithOneRevision({
        layout: output.layout,
        boundary: designBoundary,
        program: architectureProgram,
        revise: (acceptedFindings) => reviseWithTweedledum({
          context: contextFor(source.id), brief: architectureBrief,
          planVersion: { id: source.id, layout: output.layout }, acceptedFindings,
          designObjective: "repair deterministic interior geometry findings",
        }),
      });
      const finalDesign = resolved.revision || output;
      const proposal = createActivatedPlanVersion(history, { projectId: proyecto.id, parentVersionId: source.id, createdBy: "tweedledum", snapshot: snapshotFromGenerated(resolved.generated) });
      setArchitectureVersions(proposal.history);
      commit(proposal.snapshot.rooms, proposal.snapshot.items);
      setActiveArchitectureVersionId(proposal.activeVersionId);
      recordArchitectureRun({ mode: "design", sourceVersionId: source.id, resultVersionId: proposal.version.id, repaired: resolved.repaired, agents: [{ key: output.agent.key, promptVersion: output.promptVersion }, ...(resolved.revision ? [{ key: resolved.revision.agent.key, promptVersion: resolved.revision.promptVersion }] : [])] });
      setArchitectureResult({ mode: "design", design: finalDesign, repaired: resolved.repaired, appliedVersionId: proposal.version.id });
    } catch (e) { setArchitectureError(e.message || "No se pudo diseñar"); }
    finally { setArchitectureBusy(null); }
  };
  const runCritique = async () => {
    if (!rooms.length || architectureBusy) return;
    setArchitectureBusy("Tweedledee"); setArchitectureError("");
    try {
      const { source } = ensureSourceVersion();
      const outputRaw = await critiqueWithTweedledee({ context: contextFor(source.id), planVersion: { id: source.id, layout: planALayout(source.snapshot.rooms, source.snapshot.items, architectureBrief) }, deterministicValidation: serializeValidation(val), designObjective: "complete furnished residential interior" });
      const output = mappedCritique(outputRaw, source.snapshot.rooms, source.snapshot.items);
      recordArchitectureRun({ mode: "critique", sourceVersionId: source.id, agents: [{ key: output.agent.key, promptVersion: output.promptVersion }], findings: output.findings });
      setArchitectureResult({ mode: "critique", output, critique: output });
    } catch (e) { setArchitectureError(e.message || "No se pudo criticar"); }
    finally { setArchitectureBusy(null); }
  };
  const runReviewCycle = async () => {
    if (architectureBusy) return;
    const readiness = architectureDesignReadiness({ rooms, boundary: designBoundary, areaTarget: brief.areaObjetivo });
    if (!readiness.ok) { setArchitectureError(readiness.reason); return; }
    setArchitectureBusy("review cycle"); setArchitectureError("");
    try {
      const { source, history } = ensureSourceVersion();
      if (acceptedFloorProposal?.floor) {
        const resolvedFloor = await designAcceptedFloor(source);
        const proposalSnapshot = { rooms: resolvedFloor.rooms, items: resolvedFloor.items };
        const proposal = createPlanVersion(history, { projectId: proyecto.id, parentVersionId: source.id, createdBy: "tweedledum", snapshot: proposalSnapshot });
        setArchitectureVersions(proposal.history);
        const deterministicValidation = serializeValidation(validarPlan({ rooms: proposalSnapshot.rooms, items: proposalSnapshot.items, limite: lote?.pts || footprint || null }));
        const critiqueRaw = await critiqueWithTweedledee({
          context: contextFor(proposal.version.id),
          planVersion: { id: proposal.version.id, layout: planALayout(proposalSnapshot.rooms, proposalSnapshot.items, architectureBrief) },
          deterministicValidation,
          designObjective: "review accepted Cabida floor and completed residential interiors without changing locked infrastructure",
        });
        const critique = mappedCritique(critiqueRaw, proposalSnapshot.rooms, proposalSnapshot.items);
        commit(proposalSnapshot.rooms, proposalSnapshot.items);
        setActiveArchitectureVersionId(proposal.version.id);
        recordArchitectureRun({
          mode: "cycle_units",
          sourceVersionId: source.id,
          sourceCabidaVersionId: acceptedFloorProposal.sourceCabidaVersionId,
          proposalVersionId: proposal.version.id,
          resultVersionId: proposal.version.id,
          units: resolvedFloor.unitResults.map((unit) => ({ unitRef: unit.unitRef, ok: unit.ok, repaired: unit.repaired })),
          agents: [
            ...resolvedFloor.unitResults.flatMap((unit) => [unit.design, unit.revision].filter(Boolean).map((entry) => ({ key: entry.agent?.key || "tweedledum", promptVersion: entry.promptVersion || null }))),
            { key: critique.agent.key, promptVersion: critique.promptVersion },
          ],
          findings: critique.findings,
        });
        setArchitectureResult({ mode: "cycle", design: { summary: `${resolvedFloor.unitResults.filter((unit) => unit.ok).length}/${resolvedFloor.unitResults.length} unidades diseñadas` }, critique, revision: null, appliedVersionId: proposal.version.id });
        return;
      }
      const design = await designWithTweedledum({ context: contextFor(source.id), brief: architectureBrief, planVersion: { id: source.id, layout: roomsALayout(source.snapshot.rooms, architectureBrief) }, designObjective: "complete furnished residential interior" });
      const initialGenerated = materializeInteriorLayout(design.layout, { boundary: designBoundary, program: architectureProgram });
      const proposalSnapshot = { rooms: initialGenerated.rooms, items: initialGenerated.items };
      const proposal = createPlanVersion(history, { projectId: proyecto.id, parentVersionId: source.id, createdBy: "tweedledum", snapshot: proposalSnapshot });
      setArchitectureVersions(proposal.history); // si la crítica falla, el diseño igual queda recuperable
      const critiqueRaw = await critiqueWithTweedledee({ context: contextFor(proposal.version.id), planVersion: { id: proposal.version.id, layout: planALayout(proposalSnapshot.rooms, proposalSnapshot.items, architectureBrief) }, deterministicValidation: initialGenerated.validation, designObjective: "complete furnished residential interior" });
      const critique = mappedCritique(critiqueRaw, proposalSnapshot.rooms, proposalSnapshot.items);
      const acceptedFindings = critique.findings.filter((finding) => ["critical", "major"].includes(finding.severity));
      const resolved = await materializeWithOneRevision({
        layout: design.layout,
        boundary: designBoundary,
        program: architectureProgram,
        revisionFindings: acceptedFindings,
        revise: (findings) => reviseWithTweedledum({ context: contextFor(proposal.version.id), brief: architectureBrief, planVersion: { id: proposal.version.id, layout: design.layout }, acceptedFindings: findings, designObjective: "resolve deterministic validation and accepted critique findings" }),
      });
      const finalSnapshot = snapshotFromGenerated(resolved.generated);
      const revision = resolved.revision;
      let revisionVersion = null, finalHistory = proposal.history;
      if (revision) {
        const revisedSnapshot = finalSnapshot;
        const next = createPlanVersion(finalHistory, { projectId: proyecto.id, parentVersionId: proposal.version.id, createdBy: "tweedledum", snapshot: revisedSnapshot });
        revisionVersion = next.version; finalHistory = next.history;
      }
      setArchitectureVersions(finalHistory);
      const resultVersionId = revisionVersion?.id || proposal.version.id;
      const applied = applyPlanVersion(finalHistory, resultVersionId);
      commit(applied.snapshot.rooms, applied.snapshot.items);
      setActiveArchitectureVersionId(resultVersionId);
      recordArchitectureRun({ mode: "cycle", sourceVersionId: source.id, proposalVersionId: proposal.version.id, resultVersionId: revisionVersion?.id || proposal.version.id,
        agents: [{ key: design.agent.key, promptVersion: design.promptVersion }, { key: critique.agent.key, promptVersion: critique.promptVersion }, ...(revision ? [{ key: revision.agent.key, promptVersion: revision.promptVersion }] : [])], findings: critique.findings });
      setArchitectureResult({ mode: "cycle", design, critique, revision, appliedVersionId: resultVersionId });
    } catch (e) { setArchitectureError(e.message || "No se pudo completar el ciclo"); }
    finally { setArchitectureBusy(null); }
  };
  const applyArchitectureVersion = (versionId) => {
    const applied = applyPlanVersion(architectureVersions, versionId);
    const locked = acceptedFloorProposal?.floor
      ? splitAcceptedFloor(acceptedFloorProposal.floor).lockedRooms
      : rooms.filter((room) => !isRoomEditable(room));
    const replacement = applied.snapshot.rooms.filter((room) => isRoomEditable(room)
      && (!acceptedFloorProposal?.floor || !["core", "pasillo", "circulacion", "void"].includes(room.tipo || room.role)));
    commit(preserveLockedRooms(locked, replacement), applied.snapshot.items);
    setActiveArchitectureVersionId(versionId);
  };

  return (
    <div ref={rootRef} style={{ display: "flex", flexDirection: "column", height: maximized ? "100vh" : "100%", width: "100%", background: C.paper, minHeight: 520, position: maximized ? "fixed" : "relative", inset: maximized ? 0 : undefined, zIndex: maximized ? 9998 : undefined, overflow: "hidden" }}>
      {/* toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "12px 16px", borderBottom: `1px solid ${C.line}` }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, marginRight: 4 }}>
          <BamLogo height={15} />
          <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", textTransform: "lowercase", color: C.ink }}>editor de planos</span>
        </span>
        {/* flujo: la planta llega resuelta desde Cabida (paso 1 · lote sigue acá para trazarlo a mano) */}
        <Btn active={loteBar} onClick={() => setLoteBar((s) => !s)} title="Lote: medianera/esquina, retiros, calcar terreno">
          <b style={{ color: loteBar ? C.card : lote ? C.peri : C.orange }}>1</b> lote {lote ? "✓" : ""}
        </Btn>
        <div style={{ width: 1, height: 22, background: C.line }} />
        <Btn active={tool === "select"} onClick={() => setTool("select")} title="Seleccionar / mover (V)"><MousePointer2 size={13} /> mover</Btn>
        <Btn active={tool === "wall"} onClick={() => setTool("wall")} title="Dibujar muros (W)"><PenLine size={13} /> muro</Btn>

        <ToolMenu label="insertar" icon={<Plus size={13} style={{ marginRight: 4 }} />} width={210}>
          <Btn active={showLib} onClick={() => setShowLib((s) => !s)} title="Librería de mobiliario"><Plus size={13} /> mueble</Btn>
          <Btn active={showRepo} onClick={() => setShowRepo((s) => !s)} title="Repositorio de ambientes amueblados"><Plus size={13} /> ambiente</Btn>
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
        <Btn active={showArchitecture} onClick={() => setShowArchitecture((value) => !value)} disabled={!rooms.length}
          title="Tweedledum diseña · Tweedledee critica · las reglas determinísticas validan">
          <GitBranch size={13} /> architecture
        </Btn>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {selItem && <Btn onClick={rotateSel} title="Rotar 90° (R)"><RotateCw size={13} /></Btn>}
          {selId && !selItem && isRoomEditable(sel) && (
            <input value={sel?.name || ""} onChange={(e) => renameSel(e.target.value)} placeholder="nombre"
              style={{ fontFamily: mono, fontSize: 12, color: C.ink, width: 120, textAlign: "right", background: C.card,
                border: `1px solid ${C.line}`, borderRadius: 2, padding: "5px 8px", outline: "none" }} />
          )}
          {(selItem || (selId && isRoomEditable(sel))) && <Btn onClick={deleteSel} title="Eliminar (Supr)"><Trash2 size={13} /></Btn>}
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

      {showArchitecture && <ArchitectureReviewPanel
        busy={architectureBusy}
        error={architectureError}
        result={architectureResult}
        versions={architectureVersions}
        currentVersion={architectureVersions.find((version) => version.id === activeArchitectureVersionId)}
        program={architectureProgram}
        onProgramChange={(next) => setBrief((current) => ({
          ...current,
          architectureDormitorios: next.dormitorios,
          architectureBanos: next.banos,
        }))}
        onDesign={runDesign}
        onCritique={runCritique}
        onCycle={runReviewCycle}
        onApplyVersion={applyArchitectureVersion}
        onClose={() => setShowArchitecture(false)}
      />}

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
            {footprint && <span style={{ marginLeft: "auto", fontFamily: mono, fontSize: 9.5, color: C.peri, fontWeight: 700 }}>footprint listo</span>}
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
          {tool === "select" && isRoomEditable(sel) && sel.pts.map(toScreen).map((p, pi) => (
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
              <b style={{ color: C.orange }}>1 lote</b> elige medianera/esquina, retiros y calca el terreno<br />
              {!acceptedFloorProposal && <span style={{ fontSize: 10.5 }}>la planta se resuelve en Cabida y se acepta desde ahí — acá se edita.<br /></span>}
              <span style={{ fontSize: 10.5 }}>también puedes dibujar a mano con <b style={{ color: C.ink }}>muro</b> · R = rotar mueble · rueda = zoom · alt+arrastrar = paneo · ⌘Z = deshacer</span>
            </div>
          </div>
        )}

        {showLib && <LibPanel onAdd={addItem} onClose={() => setShowLib(false)} />}
        {showRepo && <RepoAmbientesPanel onAdd={insertAmbiente} onClose={() => setShowRepo(false)} />}
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

      {showFicha && <FichaModal ficha={ficha} setFicha={setFicha} onClose={() => setShowFicha(false)} />}
    </div>
  );
}
