import { useState, useRef, useEffect, useCallback } from "react";
import {
  MousePointer2, PenLine, Trash2, Undo2, Redo2, Download,
  Magnet, Ruler, Maximize2, Sparkles, Plus, RotateCw, X,
  Upload, Crosshair, Layers, RefreshCw, BookOpen,
} from "lucide-react";
import { LAYOUTS, ROOMS as LAYOUT_ROOMS, TOTAL as LAYOUT_TOTAL } from "./assets/layouts/index.js";
import {
  GRID, snapPt, ortho, dist, area, centroid, perimeter,
  pointInPolygon, nearestVertex, bbox,
  offsetPolygon, orientedFrame, isConvex,
} from "./geometry.js";
import { CATALOGO, porId, CATS } from "./mobiliario.js";
import { Simbolo } from "./simbolos.jsx";
import { generarDistribuciones } from "./distribucion.js";
import { packFloor } from "./lote.js";
import { laminaSVG } from "./lamina.js";
import { BamLogo } from "./marca.jsx";

const FICHA_DEF = {
  proyecto: "Nuevo proyecto", tipo: "Edificio Multifamiliar", ubicacion: "", cliente: "",
  responsable: "", desarrollo: "Hygge · BAM", plano: "Planta de distribución", escala: "1:75",
  fecha: "", lamina: "A-01",
};

const TIPO_UNIDAD = { "1D": "#D8E0F7", "2D": "#95ABE8", "3D": "#F7936F" };

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

const ROOM_FILL = ["#D8E0F7", "#F7D9CE", "#DCEBDD", "#F3E7C9", "#E7DDF2", "#D6ECEF"];
const TIPO_FILL = {
  dormitorio: "#D8E0F7", social: "#F7D9CE", cocina: "#F3E7C9",
  "baño": "#D6ECEF", pasillo: "#EFEDE8", servicio: "#E7DDF2",
};
const roomFill = (r, i) =>
  r.tipo === "core" ? "#4A4A4A"
    : r.tipo === "unidad" ? (TIPO_UNIDAD[r.subtipo] || "#D8E0F7")
      : TIPO_FILL[r.tipo] || ROOM_FILL[i % ROOM_FILL.length];

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
      {v.items.map((t) => {
        const s = T({ x: t.x, y: t.y });
        return <Simbolo key={t.id} it={t} px={s.x} py={s.y} k={k} selected={false} />;
      })}
    </svg>
  );
}

// ── modal generador ───────────────────────────────────────────
function GenModal({ brief, setBrief, onUse, onClose }) {
  const [vars, setVars] = useState(() => generarDistribuciones(brief));
  const regen = () => setVars(generarDistribuciones(brief));
  const In = ({ label, k, step = 0.5, min = 1 }) => (
    <label style={{ display: "flex", alignItems: "baseline", gap: 6, fontFamily: sans, fontSize: 12, color: C.ink }}>
      {label}
      <input type="number" value={brief[k]} step={step} min={min}
        onChange={(e) => setBrief({ ...brief, [k]: parseFloat(e.target.value) || 0 })}
        style={{ fontFamily: mono, fontSize: 13, fontWeight: 600, color: C.ink, width: 62, textAlign: "right",
          border: `1px solid ${C.line}`, borderRadius: 2, background: C.paper, outline: "none", padding: "4px 6px" }} />
    </label>
  );
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(55,55,55,0.35)", zIndex: 50,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 3, maxWidth: 1080,
          maxHeight: "92%", overflow: "auto", padding: "20px 24px", boxShadow: "0 12px 40px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
          <span style={{ fontFamily: mono, fontSize: 10, color: C.orange }}>✦</span>
          <h2 style={{ fontFamily: sans, fontSize: 13, fontWeight: 800, letterSpacing: "0.06em", textTransform: "lowercase", color: C.ink, margin: 0 }}>
            generar distribución
          </h2>
          <span style={{ fontFamily: mono, fontSize: 9.5, color: C.soft }}>
            mobiliario a escala real · medidas dimensions.com · muros al eje
          </span>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer" }}>
            <X size={15} color={C.soft} />
          </button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 22px", alignItems: "center",
          padding: "12px 0", borderBottom: `1px solid ${C.line}`, marginBottom: 16 }}>
          <In label="área depto" k="area" step={1} min={20} />
          <span style={{ fontFamily: mono, fontSize: 10, color: C.soft, marginLeft: -14 }}>m²</span>
          <In label="frente" k="frente" step={0.25} min={3} />
          <span style={{ fontFamily: mono, fontSize: 10, color: C.soft, marginLeft: -14 }}>m</span>
          <In label="dormitorios" k="dormitorios" step={1} min={1} />
          <In label="baños" k="banos" step={1} min={1} />
          <span style={{ fontFamily: mono, fontSize: 10, color: C.soft }}>
            fondo {fmt(brief.area / Math.max(brief.frente, 0.1), 1)} m
          </span>
          <Btn onClick={regen} accent title="Regenerar variantes"><Sparkles size={13} /> regenerar</Btn>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16 }}>
          {vars.map((v) => {
            const total = v.rooms.reduce((a, r) => a + area(r.pts), 0);
            return (
              <div key={v.id} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 3, padding: 10 }}>
                <VariantPreview v={v} />
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
                  <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 800, textTransform: "lowercase", color: C.ink }}>{v.nombre}</span>
                  <span style={{ fontFamily: mono, fontSize: 10, color: C.soft }}>{fmt(total, 1)} m²</span>
                </div>
                {v.nota.map((n) => (
                  <div key={n} style={{ fontFamily: mono, fontSize: 9, color: C.soft, lineHeight: 1.5 }}>· {n}</div>
                ))}
                <button onClick={() => onUse(v)}
                  style={{ marginTop: 8, width: "100%", fontFamily: mono, fontSize: 11, color: C.card,
                    background: C.orange, border: "none", borderRadius: 2, padding: "7px 0", cursor: "pointer" }}>
                  usar esta →
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
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

// ── librería de layouts dimensionados (dimensions.com) ────────
function LayoutsPanel({ onPick, onClose }) {
  const [room, setRoom] = useState(LAYOUT_ROOMS[0]?.key || "bathrooms");
  const list = LAYOUTS[room] || [];
  return (
    <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 300, background: C.paper, borderLeft: `1px solid ${C.line}`, display: "flex", flexDirection: "column", zIndex: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: `1px solid ${C.line}` }}>
        <BamLogo height={13} />
        <span style={{ fontFamily: sans, fontSize: 11, fontWeight: 800, textTransform: "lowercase", color: C.ink }}>layouts · referencia</span>
        <span style={{ fontFamily: mono, fontSize: 9, color: C.soft }}>{LAYOUT_TOTAL}</span>
        <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer" }}><X size={13} color={C.soft} /></button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "8px 12px", borderBottom: `1px solid ${C.line}` }}>
        {LAYOUT_ROOMS.map((r) => (
          <button key={r.key} onClick={() => setRoom(r.key)}
            style={{ fontFamily: mono, fontSize: 10, padding: "3px 8px", borderRadius: 2, cursor: "pointer",
              color: room === r.key ? C.card : C.ink, background: room === r.key ? C.ink : C.card, border: `1px solid ${room === r.key ? C.ink : C.line}` }}>
            {r.label} <span style={{ opacity: 0.6 }}>{r.n}</span>
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, alignContent: "start" }}>
        {list.map((it) => (
          <button key={it.url} onClick={() => onPick(it)} title={`insertar como fondo · ${it.name}`}
            style={{ display: "flex", flexDirection: "column", gap: 4, padding: 6, background: C.card, border: `1px solid ${C.line}`, borderRadius: 3, cursor: "pointer" }}>
            <div style={{ height: 78, background: "#fff", borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", padding: 2 }}>
              <img src={it.thumb} alt={it.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
            <span style={{ fontFamily: mono, fontSize: 8.5, color: C.soft, lineHeight: 1.2, textAlign: "left" }}>{it.name}</span>
          </button>
        ))}
      </div>
      <div style={{ padding: "8px 12px", borderTop: `1px solid ${C.line}`, fontFamily: mono, fontSize: 8.5, color: C.soft, lineHeight: 1.5 }}>
        inserta como fondo → calibra la escala → traza/diseña encima
      </div>
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
          {F("profesional responsable", "responsable")}
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

export default function EditorPlanos() {
  const svgRef = useRef(null);
  const wrapRef = useRef(null);

  const [rooms, setRooms] = useState([]);           // ambientes: { id, name, pts, tipo? }
  const [items, setItems] = useState([]);           // mobiliario/aberturas: { id, ref, x, y, rot, w, d }
  const [muro, setMuro] = useState(0.15);           // espesor de muro (m)
  const [altura, setAltura] = useState(2.4);        // altura libre (m)
  const [tool, setTool] = useState("select");
  const [snapOn, setSnapOn] = useState(true);
  const [orthoOn, setOrthoOn] = useState(true);
  const [dims, setDims] = useState(true);
  const [selId, setSelId] = useState(null);         // ambiente seleccionado
  const [selItem, setSelItem] = useState(null);     // mueble seleccionado
  const [showGen, setShowGen] = useState(false);
  const [showLib, setShowLib] = useState(false);
  const [showLayouts, setShowLayouts] = useState(false);
  const [brief, setBrief] = useState({ area: 65, frente: 6.5, dormitorios: 2, banos: 2 });
  const [ficha, setFicha] = useState(FICHA_DEF);
  const [showFicha, setShowFicha] = useState(false);

  const [draft, setDraft] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [view, setView] = useState({ scale: 42, tx: 60, ty: 60 });

  // ── flujo lote ──
  const [plano, setPlano] = useState(null);        // { src, ox, oy, mpp, w, h, opacity }
  const [lote, setLote] = useState(null);          // { pts } polígono del terreno (metros)
  const [retiro, setRetiro] = useState(3);         // retiro perimetral (m)
  const [frontIdx, setFrontIdx] = useState(0);     // borde-frente del lote
  const [loteParams, setLoteParams] = useState({ udsPiso: 4, mix1: 40, mix2: 40, areaObjetivo: 70 });
  const [calib, setCalib] = useState([]);          // puntos de calibración en curso
  const [loteBar, setLoteBar] = useState(false);   // barra de herramientas de lote visible
  const fileRef = useRef(null);

  const past = useRef([]);
  const future = useRef([]);
  const drag = useRef(null);

  // envolvente construible = lote − retiro
  const footprint = lote && lote.pts.length >= 3 ? offsetPolygon(lote.pts, retiro) : null;

  // ── persistencia + brief desde cabida ─────────────────────
  useEffect(() => {
    try {
      // el plano arranca SIEMPRE vacío; solo se restauran preferencias (no el dibujo)
      const raw = localStorage.getItem(STORE);
      if (raw) {
        const saved = JSON.parse(raw);
        if (typeof saved?.muro === "number") setMuro(saved.muro);
        if (typeof saved?.altura === "number") setAltura(saved.altura);
        if (saved?.loteParams) setLoteParams(saved.loteParams);
        if (saved?.ficha) setFicha({ ...FICHA_DEF, ...saved.ficha });
      }
    } catch { /* storage corrupto */ }
    try {
      const b = localStorage.getItem(BRIEF_KEY);
      if (b) {
        const parsed = JSON.parse(b);
        setBrief((prev) => ({ ...prev, ...parsed }));
        localStorage.removeItem(BRIEF_KEY);
        setShowGen(true);
      }
    } catch { /* brief inválido */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORE, JSON.stringify({ rooms, items, muro, altura, view, plano, lote, retiro, frontIdx, loteParams, ficha })); }
    catch { /* cuota — la imagen base puede exceder; se guarda el resto igual */
      try { localStorage.setItem(STORE, JSON.stringify({ rooms, items, muro, altura, view, lote, retiro, frontIdx, loteParams, ficha })); } catch { /* nada */ }
    }
  }, [rooms, items, muro, altura, view, plano, lote, retiro, frontIdx, loteParams, ficha]);

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

  // genera la planta típica sobre el footprint (sigue la forma del lote)
  const generarEnLote = useCallback(() => {
    if (!footprint) return;
    const res = packFloor(footprint, frontIdx, {
      udsPiso: loteParams.udsPiso, mix1: loteParams.mix1, mix2: loteParams.mix2, areaObjetivo: loteParams.areaObjetivo,
    });
    const nr = [];
    if (res.core) nr.push({ id: res.core.id, name: "core", tipo: "core", pts: res.core.pts });
    if (res.corridor) nr.push({ id: res.corridor.id, name: "corredor", tipo: "pasillo", pts: res.corridor.pts });
    res.units.forEach((u) => nr.push({ id: u.id, name: `${u.subtipo} · ${fmt(u.areaReal, 0)}m²`, tipo: "unidad", subtipo: u.subtipo, pts: u.pts }));
    commit(nr, []);
    setSelId(null); setSelItem(null); setDraft([]);
    if (res.warns?.length) console.info("[generar-en-lote]", res.warns.join(" · "));
  }, [footprint, frontIdx, loteParams, commit]);

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

  const addItem = useCallback((ref) => {
    const box = wrapRef.current?.getBoundingClientRect();
    const c = box ? toWorldRaw(box.width / 2, box.height / 2) : { x: 0, y: 0 };
    const cat = porId[ref];
    const t = { id: uid(), ref, x: snapPt(c, 0.05).x, y: snapPt(c, 0.05).y, rot: 0, w: cat.w, d: cat.d };
    commit(null, [...items, t]);
    setSelItem(t.id); setSelId(null); setTool("select");
  }, [items, commit, toWorldRaw]);

  // inserta un layout de referencia como fondo a escala (viewBox 1000×650 · ~4 m ancho por defecto)
  const insertLayout = useCallback((it) => {
    const box = wrapRef.current?.getBoundingClientRect();
    const w = 1000, h = 650, mpp = 4 / w;   // escala inicial; el usuario calibra a la real
    setPlano({ src: it.url, ox: 0, oy: 0, mpp, w, h, opacity: 0.85 });
    setLoteBar(true);
    setShowLayouts(false);
    if (box) {
      const wM = w * mpp, hM = h * mpp;
      const scale = Math.min((box.width - 120) / wM, (box.height - 140) / hM);
      setView({ scale, tx: box.width / 2 - (wM / 2) * scale, ty: box.height / 2 - (hM / 2) * scale });
    }
  }, []);

  const useVariant = useCallback((v) => {
    const nr = v.rooms.map((r) => ({ id: r.id, name: r.name, pts: r.pts, tipo: r.tipo }));
    commit(nr, v.items.map((t) => ({ ...t })));
    setShowGen(false); setSelId(null); setSelItem(null); setDraft([]);
    requestAnimationFrame(() => fitTo(nr));
  }, [commit, fitTo]);

  // ── punteros ──────────────────────────────────────────────
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

    // select: mueble > vértice > ambiente
    const t = hitItem(world);
    if (t) {
      setSelItem(t.id); setSelId(null);
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
    setSelId(null); setSelItem(null);
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
      if (e.key === "Escape") { setDraft([]); setSelId(null); setSelItem(null); setShowGen(false); setShowLib(false); setCalib([]); }
      if (e.key === "Enter" && tool === "wall") onDouble();
      if (e.key === "r" || e.key === "R") rotateSel();
      if (e.key === "Backspace" || e.key === "Delete") {
        if (tool === "wall" && draft.length) { e.preventDefault(); setDraft(draft.slice(0, -1)); }
        else if (selItem || selId) { e.preventDefault(); deleteSel(); }
      }
      if (e.key === "v" || e.key === "V") setTool("select");
      if (e.key === "w" || e.key === "W") setTool("wall");
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [undo, redo, tool, draft, selId, selItem, deleteSel, rotateSel]); // eslint-disable-line

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
  const totalArea = rooms.reduce((a, r) => a + area(r.pts), 0);
  const preview = (tool === "wall" || tool === "lote") && draft.length > 0 && cursor
    ? { a: draft[draft.length - 1], b: cursor } : null;
  const k = view.scale;
  const wallPx = Math.max(muro * k, 1.5);
  const aberturas = items.filter((t) => porId[t.ref]?.cat === "abertura");
  const muebles = items.filter((t) => porId[t.ref]?.cat !== "abertura");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.paper, minHeight: 520, position: "relative" }}>
      {/* toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "12px 16px", borderBottom: `1px solid ${C.line}` }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, marginRight: 4 }}>
          <BamLogo height={15} />
          <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", textTransform: "lowercase", color: C.ink }}>editor de planos</span>
        </span>
        <Btn accent onClick={() => setShowGen(true)} title="Generar distribución desde parámetros de cabida">
          <Sparkles size={13} /> generar
        </Btn>
        <Btn active={showLib} onClick={() => setShowLib((s) => !s)} title="Librería de mobiliario"><Plus size={13} /> mueble</Btn>
        <Btn active={loteBar} onClick={() => setLoteBar((s) => !s)} title="Flujo de lote: subir plano, calibrar, calcar terreno, generar tipologías"><Layers size={13} /> lote</Btn>
        <Btn active={showLayouts} onClick={() => setShowLayouts((s) => !s)} title={`Librería de layouts dimensionados (dimensions.com · ${LAYOUT_TOTAL})`}><BookOpen size={13} /> layouts</Btn>
        <div style={{ width: 1, height: 22, background: C.line }} />
        <Btn active={tool === "select"} onClick={() => setTool("select")} title="Seleccionar / mover (V)"><MousePointer2 size={13} /> mover</Btn>
        <Btn active={tool === "wall"} onClick={() => setTool("wall")} title="Dibujar muros (W)"><PenLine size={13} /> muro</Btn>
        <div style={{ width: 1, height: 22, background: C.line }} />
        <Btn active={snapOn} onClick={() => setSnapOn((s) => !s)} title="Ajustar a rejilla"><Magnet size={13} /></Btn>
        <Btn active={orthoOn} onClick={() => setOrthoOn((s) => !s)} title="Bloqueo ortogonal">⌐</Btn>
        <Btn active={dims} onClick={() => setDims((s) => !s)} title="Mostrar cotas"><Ruler size={13} /></Btn>
        <div style={{ width: 1, height: 22, background: C.line }} />
        {/* muro / altura */}
        <label style={{ display: "flex", alignItems: "baseline", gap: 4, fontFamily: mono, fontSize: 10, color: C.soft }}>
          muro
          <input type="number" value={muro} step={0.025} min={0.08} max={0.35}
            onChange={(e) => setMuro(parseFloat(e.target.value) || 0.15)}
            style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, color: C.ink, width: 50, textAlign: "right",
              border: `1px solid ${C.line}`, borderRadius: 2, background: C.card, outline: "none", padding: "3px 5px" }} />
          m
        </label>
        <label style={{ display: "flex", alignItems: "baseline", gap: 4, fontFamily: mono, fontSize: 10, color: C.soft }}>
          altura
          <input type="number" value={altura} step={0.05} min={2.2} max={3.5}
            onChange={(e) => setAltura(parseFloat(e.target.value) || 2.4)}
            style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, color: C.ink, width: 50, textAlign: "right",
              border: `1px solid ${C.line}`, borderRadius: 2, background: C.card, outline: "none", padding: "3px 5px" }} />
          m
        </label>
        <div style={{ width: 1, height: 22, background: C.line }} />
        <Btn onClick={undo} disabled={!past.current.length} title="Deshacer (⌘Z)"><Undo2 size={13} /></Btn>
        <Btn onClick={redo} disabled={!future.current.length} title="Rehacer (⌘⇧Z)"><Redo2 size={13} /></Btn>
        <Btn onClick={fitView} title="Encuadrar"><Maximize2 size={13} /></Btn>
        <Btn onClick={() => setShowFicha(true)} title="Editar membrete de la lámina">membrete</Btn>
        <Btn onClick={exportSVG} disabled={!rooms.length} title="Exportar lámina BAM (.svg)"><Download size={13} /> lámina</Btn>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {selItem && <Btn onClick={rotateSel} title="Rotar 90° (R)"><RotateCw size={13} /></Btn>}
          {selId && !selItem && (
            <input value={sel?.name || ""} onChange={(e) => renameSel(e.target.value)} placeholder="nombre"
              style={{ fontFamily: mono, fontSize: 12, color: C.ink, width: 120, textAlign: "right", background: C.card,
                border: `1px solid ${C.line}`, borderRadius: 2, padding: "5px 8px", outline: "none" }} />
          )}
          {(selId || selItem) && <Btn onClick={deleteSel} title="Eliminar (Supr)"><Trash2 size={13} /></Btn>}
          <button onClick={clearAll} style={{ fontFamily: mono, fontSize: 10.5, color: C.soft, background: "none", border: "none", cursor: "pointer" }}>limpiar</button>
        </div>
      </div>

      {/* barra de lote */}
      {loteBar && (() => {
        const li = { display: "flex", alignItems: "baseline", gap: 4, fontFamily: mono, fontSize: 10, color: C.soft };
        const inp = { fontFamily: mono, fontSize: 11, fontWeight: 600, color: C.ink, width: 46, textAlign: "right", border: `1px solid ${C.line}`, borderRadius: 2, background: C.card, outline: "none", padding: "3px 5px" };
        const setLP = (k, v) => setLoteParams((p) => ({ ...p, [k]: v }));
        const fr = footprint ? orientedFrame(footprint, frontIdx) : null;
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "8px 16px", borderBottom: `1px solid ${C.line}`, background: "#F4F2EC" }}>
            <span style={{ fontFamily: mono, fontSize: 9.5, color: C.peri, fontWeight: 700 }}>lote ▸</span>
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
            <label style={li}>retiro
              <input type="number" value={retiro} step={0.5} min={0} onChange={(e) => setRetiro(parseFloat(e.target.value) || 0)} style={inp} /> m</label>
            <Btn onClick={cycleFront} disabled={!lote} title="Rotar el borde-frente (hacia la calle)"><RefreshCw size={12} /> frente</Btn>
            <div style={{ width: 1, height: 20, background: C.line }} />
            <label style={li}>uds/piso
              <input type="number" value={loteParams.udsPiso} step={1} min={1} onChange={(e) => setLP("udsPiso", parseInt(e.target.value) || 1)} style={inp} /></label>
            <label style={li}>1D%
              <input type="number" value={loteParams.mix1} step={5} min={0} max={100} onChange={(e) => setLP("mix1", parseInt(e.target.value) || 0)} style={inp} /></label>
            <label style={li}>2D%
              <input type="number" value={loteParams.mix2} step={5} min={0} max={100} onChange={(e) => setLP("mix2", parseInt(e.target.value) || 0)} style={inp} /></label>
            <label style={li}>área
              <input type="number" value={loteParams.areaObjetivo} step={5} min={20} onChange={(e) => setLP("areaObjetivo", parseInt(e.target.value) || 20)} style={inp} /> m²</label>
            <Btn accent onClick={generarEnLote} disabled={!footprint} title="Generar la planta típica dentro del footprint">
              <Sparkles size={13} /> generar en lote</Btn>
            {fr && <span style={{ fontFamily: mono, fontSize: 10, color: C.soft }}>footprint {fmt(area(footprint), 0)} m² · {fmt(fr.frente, 1)}×{fmt(fr.fondo, 1)} m{isConvex(footprint) ? "" : " · no convexo"}</span>}
            {lote && !footprint && <span style={{ fontFamily: mono, fontSize: 10, color: C.orange }}>▲ el retiro deja el lote sin área construible — redúcelo</span>}
          </div>
        );
      })()}

      {/* lienzo */}
      <div ref={wrapRef} style={{ flex: 1, position: "relative", overflow: "hidden", cursor: (tool === "wall" || tool === "lote" || tool === "calibrate") ? "crosshair" : "default" }}>
        <svg ref={svgRef} width="100%" height="100%" style={{ display: "block", touchAction: "none" }}
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
                fill="none" stroke={C.ink} strokeWidth={2} strokeDasharray="8 4" />
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

          {/* ambientes (muros al espesor configurado) */}
          {rooms.map((r, i) => {
            const scr = r.pts.map(toScreen);
            const selected = r.id === selId;
            return (
              <polygon key={r.id} points={scr.map((p) => `${p.x},${p.y}`).join(" ")}
                fill={roomFill(r, i)} fillOpacity={selected ? 0.95 : 0.8}
                stroke={selected ? C.orange : C.ink} strokeWidth={selected ? wallPx + 1 : wallPx}
                strokeLinejoin="miter" />
            );
          })}

          {/* aberturas (cortan el muro) */}
          {aberturas.map((t) => {
            const s = toScreen({ x: t.x, y: t.y });
            return <Simbolo key={t.id} it={{ ...t, d: Math.max(t.d, muro) }} px={s.x} py={s.y} k={k} selected={t.id === selItem} />;
          })}

          {/* mobiliario */}
          {muebles.map((t) => {
            const s = toScreen({ x: t.x, y: t.y });
            return <Simbolo key={t.id} it={t} px={s.x} py={s.y} k={k} selected={t.id === selItem} />;
          })}

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
                    <text key={pi} x={m.x} y={m.y} fontFamily={mono} fontSize={9.5} fill={C.orange}
                      textAnchor="middle" dominantBaseline="central"
                      transform={`rotate(${flip ? ang + 180 : ang} ${m.x} ${m.y}) translate(0 -7)`}>
                      {fmt(L, 2)}
                    </text>
                  );
                })}
                <text x={c.x} y={c.y} fontFamily={mono} fontSize={small ? 8.5 : 10.5} fontWeight={700}
                  fill={C.ink} textAnchor="middle" style={{ paintOrder: "stroke" }} stroke={C.card} strokeWidth={2.5}>
                  {r.name}
                  {!small && <tspan x={c.x} dy="12" fontSize={8.5} fontWeight={400} fill={C.soft} stroke={C.card} strokeWidth={2.5}>{fmt(a, 1)} m²</tspan>}
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
              <b style={{ color: C.orange }}>✦ generar</b> crea la distribución desde los parámetros de cabida<br />
              o dibuja a mano con <b style={{ color: C.ink }}>muro</b> · <b style={{ color: C.ink }}>+ mueble</b> abre la librería<br />
              <span style={{ fontSize: 10.5 }}>R = rotar mueble · rueda = zoom · alt+arrastrar = paneo · ⌘Z = deshacer</span>
            </div>
          </div>
        )}

        {showLib && <LibPanel onAdd={addItem} onClose={() => setShowLib(false)} />}
        {showLayouts && <LayoutsPanel onPick={insertLayout} onClose={() => setShowLayouts(false)} />}
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

      {showGen && (
        <GenModal brief={brief} setBrief={setBrief} onUse={useVariant} onClose={() => setShowGen(false)} />
      )}
      {showFicha && <FichaModal ficha={ficha} setFicha={setFicha} onClose={() => setShowFicha(false)} />}
    </div>
  );
}
