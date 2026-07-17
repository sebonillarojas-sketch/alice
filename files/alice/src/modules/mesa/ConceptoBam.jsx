import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Undo2, Trash2, Grid3X3, ZoomIn, ZoomOut, Maximize2, X, Upload } from "lucide-react";

// ─── Mesa de trabajo · tablero colaborativo BAM (diseño MesaDeTrabajo.dc.html) ───
// Concepto → Inspo (caos) → Dibujo → Orden (planos) → Votación.
// Todo persiste en localStorage; las imágenes se re-escalan antes de guardar.

const BG = "#E3E1DE";
const INK = "#000000";
const BLUE = "#95ABE8";
const ORANGE = "#F7643B";
const DARK = "#373737";
const PAPER = "#F9F9F9";

const mono = "'CS Genio Mono','JetBrains Mono','SF Mono',Menlo,monospace";
const sans = "'Neue Montreal','Hanken Grotesk','Helvetica Neue',sans-serif";

const BOARD_W = 2480;
const BOARD_H = 3720;
const STORE = "hygge:mesaTrabajo";

const NOTE_COLORS = [BLUE, ORANGE, PAPER];
const uid = () => Math.random().toString(36).slice(2, 9);

const DEF = {
  titulo: "Concepto BAM — San Antonio 02",
  sesion: "Sesión 01",
  fecha: "23.10.2026",
  showGrid: true,
  statement: "Diseño con edge, construido para durar.",
  notas: [
    { id: "n1", color: BLUE, text: "Brutalismo contextual: hormigón que conversa con la vereda." },
    { id: "n2", color: ORANGE, text: "Luz natural como material estructural." },
    { id: "n3", color: PAPER, text: "Escribe una idea por nota. Sin adornos." },
    { id: "n4", color: BLUE, text: "¿Terraza que se abre al parque?" },
    { id: "n5", color: PAPER, text: "Doble altura en el foyer." },
    { id: "n6", color: ORANGE, text: "Celosías de madera al oeste." },
  ],
  tags: ["Brutalismo", "Contextual", "Minimalismo"],
  wip: "WIP 25%",
  decisiones: ["Plantas abiertas", "Materiales honestos", "Atmósferas", "Habitabilidad", "Integración de espacios"],
  inspoNotas: [
    { id: "i1", color: DARK, text: "Idea loca: el estacionamiento como galería." },
    { id: "i2", color: ORANGE, text: "¿Y si no? Táchalo y sigue." },
  ],
  imgs: {},           // slotId → dataURL
  strokes: [],        // [{ color, pts: [[x,y],…] }] en coords lógicas del lienzo Dibujo
  votos: [],          // [{ id, color, x, y }] en coords lógicas del tablero
  specs: ["Escala: 1/7\nPiso 5", "Área: 64m²\n88m² · 89m²", "Revisiones:\n—"],
};

const PLANOS = [
  { id: "plano-a", label: "A001 · Planta", ph: "Suelta el plano A — planta" },
  { id: "plano-b", label: "A002 · Elevación", ph: "Suelta el plano B — elevación" },
  { id: "plano-c", label: "A003 · Corte", ph: "Suelta el plano C — corte" },
  { id: "plano-d", label: "A004 · Fachada", ph: "Suelta el plano D — fachada" },
  { id: "plano-e", label: "A005 · Detalle", ph: "Suelta el plano E — detalle" },
  { id: "plano-f", label: "A006 · Estructura", ph: "Suelta el plano F — estructura" },
];

const INSPO_SLOTS = [
  { id: "inspo-1", ph: "Inspo 1 — referencia", style: { left: 0, top: 0 } },
  { id: "inspo-2", ph: "Inspo 2 — materialidad", style: { left: 520, top: 120 } },
  { id: "inspo-3", ph: "Inspo 3 — luz / textura", style: { left: 100, top: 420 } },
];

const load = () => {
  try {
    const raw = localStorage.getItem(STORE);
    return raw ? { ...DEF, ...JSON.parse(raw) } : DEF;
  } catch { return DEF; }
};

// Re-escala una imagen a ≤1400px y la devuelve como dataURL (JPEG) para no reventar localStorage
const fileToDataURL = (file, cb) => {
  const rd = new FileReader();
  rd.onload = () => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1400;
      const k = Math.min(1, MAX / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * k);
      cv.height = Math.round(img.height * k);
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      cb(cv.toDataURL("image/jpeg", 0.82));
    };
    img.src = rd.result;
  };
  rd.readAsDataURL(file);
};

// Esquinas de registro (puntitos negros) de las tarjetas del diseño
const Marcas = ({ mid = false }) => {
  const dot = (pos) => (
    <span key={JSON.stringify(pos)} style={{ position: "absolute", width: 6, height: 6, background: INK, ...pos }} />
  );
  const pts = [
    { left: -3, top: -3 }, { right: -3, top: -3 },
    { left: -3, bottom: -3 }, { right: -3, bottom: -3 },
    ...(mid ? [{ left: "calc(50% - 3px)", top: -3 }, { left: "calc(50% - 3px)", bottom: -3 }] : []),
  ];
  return <>{pts.map(dot)}</>;
};

const Chip = ({ children, color = INK }) => (
  <span style={{ fontFamily: mono, fontSize: 14, textTransform: "uppercase", border: `1px solid ${color}`, color, padding: "8px 14px", whiteSpace: "nowrap" }}>
    {children}
  </span>
);

// Texto editable en línea (guarda al perder foco)
const Editable = ({ value, onChange, style, tag: Tag = "div" }) => (
  <Tag
    contentEditable
    suppressContentEditableWarning
    onBlur={(e) => onChange(e.currentTarget.textContent)}
    style={{ outline: "none", cursor: "text", ...style }}
  >
    {value}
  </Tag>
);

// Slot de imagen: click para subir, o arrastra un archivo encima
function ImageSlot({ img, placeholder, fit = "cover", onImage, onClear }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);
  const take = (files) => { if (files?.[0]?.type?.startsWith("image/")) fileToDataURL(files[0], onImage); };
  return (
    <div
      onClick={() => !img && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files); }}
      style={{ position: "relative", width: "100%", height: "100%", cursor: img ? "default" : "pointer", background: over ? "rgba(149,171,232,.25)" : "transparent", transition: "background .15s" }}
    >
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { take(e.target.files); e.target.value = ""; }} />
      {img ? (
        <>
          <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: fit, display: "block" }} />
          <button onClick={(e) => { e.stopPropagation(); onClear(); }} title="Quitar imagen"
            style={{ position: "absolute", right: 6, top: 6, width: 28, height: 28, border: `1px solid ${INK}`, background: PAPER, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} />
          </button>
        </>
      ) : (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", gap: 10, alignItems: "center", justifyContent: "center", color: "rgba(0,0,0,.45)" }}>
          <Upload size={22} strokeWidth={1.5} />
          <span style={{ fontFamily: mono, fontSize: 14, textTransform: "uppercase", textAlign: "center", padding: "0 12px" }}>{placeholder}</span>
        </div>
      )}
    </div>
  );
}

// Sticky note editable con borrar al hover
function Nota({ nota, size = 210, style, onChange, onDelete }) {
  const dark = nota.color === DARK;
  return (
    <div style={{ position: "relative", width: size, height: size, background: nota.color, color: dark ? BG : INK, ...style }} className="mesa-nota">
      <textarea
        value={nota.text}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        style={{ width: "100%", height: "100%", padding: 18, boxSizing: "border-box", background: "transparent", border: "none", outline: "none", resize: "none", font: `19px/1.35 ${sans}`, color: "inherit" }}
      />
      <button onClick={onDelete} title="Borrar nota" className="mesa-nota-x"
        style={{ position: "absolute", right: 4, top: 4, width: 24, height: 24, border: "none", background: "transparent", color: "inherit", cursor: "pointer", opacity: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <X size={14} />
      </button>
    </div>
  );
}

export default function ConceptoBam({ height = "calc(100vh - 152px)" } = {}) {
  const [st, setSt] = useState(load);
  const [scale, setScale] = useState(0.4);
  const [fit, setFit] = useState(true);
  const [tool, setTool] = useState(INK); // color activo del lápiz en Dibujo
  const wrapRef = useRef(null);
  const boardRef = useRef(null);
  const drawRef = useRef(null);
  const stroke = useRef(null);
  const [, force] = useState(0);

  const up = useCallback((patch) => setSt((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) })), []);

  // Persistencia (best-effort: las imágenes pueden exceder la cuota)
  useEffect(() => {
    try { localStorage.setItem(STORE, JSON.stringify(st)); } catch { /* cuota llena: seguimos en memoria */ }
  }, [st]);

  // Zoom fit-al-ancho
  useEffect(() => {
    if (!fit) return;
    const el = wrapRef.current;
    if (!el) return;
    const doFit = () => setScale(Math.max(0.1, (el.clientWidth - 32) / BOARD_W));
    doFit();
    const ro = new ResizeObserver(doFit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);

  // ── Dibujo a mano alzada (coords lógicas del lienzo 2360×820) ──
  const drawPt = (e) => {
    const r = drawRef.current.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 2360, ((e.clientY - r.top) / r.height) * 820];
  };
  const drawStart = (e) => {
    e.preventDefault();
    drawRef.current.setPointerCapture(e.pointerId);
    stroke.current = { color: tool, pts: [drawPt(e)] };
    force((n) => n + 1);
  };
  const drawMove = (e) => {
    if (!stroke.current) return;
    stroke.current.pts.push(drawPt(e));
    force((n) => n + 1);
  };
  const drawEnd = () => {
    if (stroke.current && stroke.current.pts.length > 1) {
      const s = stroke.current;
      up((p) => ({ strokes: [...p.strokes, s] }));
    }
    stroke.current = null;
    force((n) => n + 1);
  };

  // ── Votación: arrastrar cuadrados al tablero ──
  const boardPt = (e) => {
    const r = boardRef.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * BOARD_W, y: ((e.clientY - r.top) / r.height) * BOARD_H };
  };
  const dragVote = (id, color) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    let vid = id;
    if (!vid) { // desde la paleta del footer: crea uno nuevo
      vid = uid();
      const p = boardPt(e);
      up((s) => ({ votos: [...s.votos, { id: vid, color, x: p.x - 11, y: p.y - 11 }] }));
    }
    const move = (ev) => {
      const p = boardPt(ev);
      up((s) => ({ votos: s.votos.map((v) => (v.id === vid ? { ...v, x: p.x - 11, y: p.y - 11 } : v)) }));
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  };

  const addNota = () =>
    up((s) => ({ notas: [...s.notas, { id: uid(), color: NOTE_COLORS[s.notas.length % 3], text: "" }] }));

  const sec = { fontFamily: mono, fontSize: 20, fontWeight: 400, textTransform: "uppercase", margin: "0 0 6px" };
  const sub = { fontSize: 17, margin: "0 0 22px" };
  const toolBtn = (active) => ({
    display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", cursor: "pointer",
    border: `1px solid ${INK}`, background: active ? INK : "transparent", color: active ? BG : INK,
    fontFamily: mono, fontSize: 12, textTransform: "uppercase",
  });

  return (
    <div ref={wrapRef} style={{ width: "100%", height, overflow: "auto", background: "#D6D4D0" }}>
      <style>{`.mesa-nota:hover .mesa-nota-x{opacity:.6}.mesa-nota .mesa-nota-x:hover{opacity:1}`}</style>

      {/* barra de la app: grid + zoom */}
      <div className="mesa-noprint" style={{ position: "sticky", top: 0, left: 0, zIndex: 20, display: "flex", gap: 8, alignItems: "center", padding: "8px 16px", background: BG, borderBottom: `1px solid ${INK}` }}>
        <button onClick={() => up({ showGrid: !st.showGrid })} style={toolBtn(st.showGrid)} title="Cuadrícula"><Grid3X3 size={13} /> Grid</button>
        <div style={{ width: 1, height: 20, background: "rgba(0,0,0,.25)" }} />
        <button onClick={() => { setFit(false); setScale((z) => Math.max(0.1, z - 0.1)); }} style={toolBtn(false)} title="Alejar"><ZoomOut size={13} /></button>
        <button onClick={() => setFit(true)} style={toolBtn(fit)} title="Ajustar al ancho"><Maximize2 size={13} /> Fit</button>
        <button onClick={() => { setFit(false); setScale((z) => Math.min(2, z + 0.1)); }} style={toolBtn(false)} title="Acercar"><ZoomIn size={13} /></button>
        <span style={{ fontFamily: mono, fontSize: 12, color: "rgba(0,0,0,.55)" }}>{Math.round(scale * 100)}%</span>
        <span style={{ marginLeft: "auto", fontFamily: mono, fontSize: 12, textTransform: "uppercase", color: "rgba(0,0,0,.5)" }}>
          Notas, títulos y decisiones son editables · arrastra imágenes a los marcos
        </span>
      </div>

      <div style={{ width: BOARD_W * scale, height: BOARD_H * scale, margin: "16px auto" }}>
        <div ref={boardRef} data-screen-label="Concepto BAM"
          style={{ width: BOARD_W, minHeight: BOARD_H, transform: `scale(${scale})`, transformOrigin: "0 0", background: BG, position: "relative", fontFamily: sans, color: INK, overflow: "hidden", boxShadow: "0 2px 24px rgba(0,0,0,.18)" }}>

          {st.showGrid && (
            <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(0,0,0,.3) 1.4px,transparent 1.4px)", backgroundSize: "80px 80px", backgroundPosition: "40px 40px", pointerEvents: "none" }} />
          )}

          {/* ── Header ── */}
          <header style={{ position: "relative", display: "flex", alignItems: "baseline", gap: 32, padding: "36px 60px 28px", borderBottom: `1px solid ${INK}` }}>
            <img src="/brand/bam-negro.svg" alt="BAM" style={{ width: 120, display: "block", alignSelf: "center" }} />
            <Editable tag="h1" value={st.titulo} onChange={(v) => up({ titulo: v })}
              style={{ fontSize: 52, fontWeight: 400, letterSpacing: "-0.01em", margin: 0 }} />
            <div style={{ marginLeft: "auto", display: "flex", gap: 12 }}>
              <Chip>{st.sesion}</Chip><Chip>{st.fecha}</Chip><Chip>N ↑ Norte</Chip>
            </div>
          </header>

          {/* ── ( 1 ) Concepto ── */}
          <section style={{ position: "absolute", left: 60, top: 170, width: 1130 }} data-screen-label="Concepto">
            <h2 style={sec}>( 1 ) Concepto</h2>
            <p style={sub}>¿Qué hace que este edificio se mire dos veces?</p>
            <div style={{ position: "relative", border: "1px solid rgba(0,0,0,.55)", padding: "30px 34px", background: BG }}>
              <Marcas mid />
              <Editable tag="p" value={st.statement} onChange={(v) => up({ statement: v })}
                style={{ fontSize: 40, letterSpacing: "-0.01em", lineHeight: 1.1, margin: 0 }} />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginTop: 30 }}>
              {st.notas.map((n) => (
                <Nota key={n.id} nota={n}
                  onChange={(text) => up((s) => ({ notas: s.notas.map((x) => (x.id === n.id ? { ...x, text } : x)) }))}
                  onDelete={() => up((s) => ({ notas: s.notas.filter((x) => x.id !== n.id) }))} />
              ))}
              <button onClick={addNota} title="Nueva nota"
                style={{ width: 210, height: 210, border: "1px dashed rgba(0,0,0,.4)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(0,0,0,.45)" }}>
                <Plus size={34} strokeWidth={1.5} />
              </button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 30 }}>
              {st.tags.map((t) => <Chip key={t}>{t}</Chip>)}
              <Chip color={ORANGE}>{st.wip}</Chip>
            </div>
            <div style={{ marginTop: 30, background: DARK, color: BG, padding: "24px 26px" }}>
              <h3 style={{ fontFamily: mono, fontSize: 15, fontWeight: 400, textTransform: "uppercase", margin: "0 0 12px", color: "rgba(227,225,222,.6)" }}>Decisiones cerradas</h3>
              <ul style={{ margin: 0, padding: "0 0 0 20px", fontSize: 18, lineHeight: 1.7 }}>
                {st.decisiones.map((d, i) => (
                  <li key={i}>
                    <Editable value={d} onChange={(v) =>
                      up((s) => ({ decisiones: v.trim() === "" ? s.decisiones.filter((_, j) => j !== i) : s.decisiones.map((x, j) => (j === i ? v : x)) }))}
                      style={{ display: "inline-block", minWidth: 60 }} />
                  </li>
                ))}
              </ul>
              <button onClick={() => up((s) => ({ decisiones: [...s.decisiones, "Nueva decisión"] }))}
                style={{ marginTop: 10, border: "1px solid rgba(227,225,222,.4)", background: "transparent", color: "rgba(227,225,222,.7)", fontFamily: mono, fontSize: 12, textTransform: "uppercase", padding: "5px 10px", cursor: "pointer" }}>
                + Decisión
              </button>
            </div>
          </section>

          {/* ── ( 2 ) Caos — Inspo ── */}
          <section style={{ position: "absolute", left: 1250, top: 170, width: 1170 }} data-screen-label="Inspo">
            <h2 style={sec}>( 2 ) Caos — Inspo</h2>
            <p style={sub}>Aquí no hay reglas. Pega, raya, tacha, vuelve a pegar.</p>
            <div style={{ position: "relative", height: 900 }}>
              {INSPO_SLOTS.map((s) => (
                <div key={s.id} style={{ position: "absolute", ...s.style, width: 460, height: 340, background: PAPER, padding: 8, boxSizing: "border-box", border: "1px solid rgba(0,0,0,.25)" }}>
                  <ImageSlot img={st.imgs[s.id]} placeholder={s.ph}
                    onImage={(d) => up((p) => ({ imgs: { ...p.imgs, [s.id]: d } }))}
                    onClear={() => up((p) => { const imgs = { ...p.imgs }; delete imgs[s.id]; return { imgs }; })} />
                </div>
              ))}
              <Nota nota={st.inspoNotas[0]} size={240} style={{ position: "absolute", left: 660, top: 540 }}
                onChange={(text) => up((s) => ({ inspoNotas: [{ ...s.inspoNotas[0], text }, s.inspoNotas[1]] }))}
                onDelete={() => up((s) => ({ inspoNotas: [{ ...s.inspoNotas[0], text: "" }, s.inspoNotas[1]] }))} />
              <div style={{ position: "absolute", left: 940, top: 640, width: 220, height: 160 }}>
                <Nota nota={st.inspoNotas[1]} size="100%" style={{ width: "100%", height: "100%" }}
                  onChange={(text) => up((s) => ({ inspoNotas: [s.inspoNotas[0], { ...s.inspoNotas[1], text }] }))}
                  onDelete={() => up((s) => ({ inspoNotas: [s.inspoNotas[0], { ...s.inspoNotas[1], text: "" }] }))} />
              </div>
            </div>
          </section>

          {/* ── ( 3 ) Dibujo ── */}
          <section style={{ position: "absolute", left: 60, top: 1250, width: 2360 }} data-screen-label="Dibujo">
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <div>
                <h2 style={sec}>( 3 ) Dibujo</h2>
                <p style={sub}>Croquis a mano, diagramas, garabatos. Todo vale.</p>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                {[INK, ORANGE, BLUE].map((c) => (
                  <button key={c} onClick={() => setTool(c)} title="Color de lápiz"
                    style={{ width: 26, height: 26, background: c, border: tool === c ? `3px solid ${BG}` : "none", outline: tool === c ? `2px solid ${INK}` : `1px solid rgba(0,0,0,.3)`, cursor: "pointer" }} />
                ))}
                <button onClick={() => up((s) => ({ strokes: s.strokes.slice(0, -1) }))} style={toolBtn(false)} title="Deshacer trazo"><Undo2 size={13} /></button>
                <button onClick={() => up({ strokes: [] })} style={toolBtn(false)} title="Borrar todo"><Trash2 size={13} /></button>
              </div>
            </div>
            <div style={{ position: "relative", height: 820, border: "1px dashed rgba(0,0,0,.5)", background: PAPER }}>
              {st.strokes.length === 0 && !stroke.current && (
                <span style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", fontFamily: mono, fontSize: 16, textTransform: "uppercase", color: "rgba(0,0,0,.45)", pointerEvents: "none" }}>
                  Dibuja aquí — croquis a mano
                </span>
              )}
              <svg ref={drawRef} viewBox="0 0 2360 820" onPointerDown={drawStart} onPointerMove={drawMove} onPointerUp={drawEnd} onPointerLeave={drawEnd}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", cursor: "crosshair", touchAction: "none" }}>
                {[...st.strokes, ...(stroke.current ? [stroke.current] : [])].map((s, i) => (
                  <polyline key={i} points={s.pts.map((p) => p.join(",")).join(" ")}
                    fill="none" stroke={s.color} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
                ))}
              </svg>
            </div>
          </section>

          {/* ── ( 4 ) Orden — Planos ── */}
          <section style={{ position: "absolute", left: 60, top: 2210, width: 2360 }} data-screen-label="Orden">
            <h2 style={sec}>( 4 ) Orden — Planos</h2>
            <p style={{ ...sub, marginBottom: 26 }}>Cuelga aquí las láminas y raya encima. Las cotas prevalecen sobre el dibujo.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24, rowGap: 64 }}>
              {PLANOS.map((p) => (
                <div key={p.id} style={{ position: "relative", height: 560, border: "1px solid rgba(0,0,0,.55)", background: PAPER }}>
                  <Marcas />
                  <ImageSlot img={st.imgs[p.id]} placeholder={p.ph} fit="contain"
                    onImage={(d) => up((s) => ({ imgs: { ...s.imgs, [p.id]: d } }))}
                    onClear={() => up((s) => { const imgs = { ...s.imgs }; delete imgs[p.id]; return { imgs }; })} />
                  <span style={{ position: "absolute", left: 0, bottom: -34, fontFamily: mono, fontSize: 13, textTransform: "uppercase" }}>{p.label}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 64, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", border: `1px solid ${INK}`, background: PAPER }}>
              {st.specs.map((sp, i) => (
                <div key={i} style={{ padding: "14px 16px", borderLeft: i ? `1px solid ${INK}` : "none" }}>
                  <Editable value={sp} onChange={(v) => up((s) => ({ specs: s.specs.map((x, j) => (j === i ? v : x)) }))}
                    style={{ fontFamily: mono, fontSize: 13, textTransform: "uppercase", lineHeight: 1.6, whiteSpace: "pre-wrap" }} />
                </div>
              ))}
            </div>
          </section>

          {/* ── Votos colocados en el tablero ── */}
          {st.votos.map((v) => (
            <span key={v.id} onPointerDown={dragVote(v.id)} onDoubleClick={() => up((s) => ({ votos: s.votos.filter((x) => x.id !== v.id) }))}
              title="Arrastra para mover · doble click para quitar"
              style={{ position: "absolute", left: v.x, top: v.y, width: 22, height: 22, background: v.color, cursor: "grab", zIndex: 10, boxShadow: "0 1px 4px rgba(0,0,0,.35)" }} />
          ))}

          {/* ── Footer · Votación ── */}
          <footer style={{ position: "absolute", left: 60, right: 60, bottom: 40, display: "flex", alignItems: "center", gap: 28, borderTop: `1px solid ${INK}`, paddingTop: 22 }}>
            <span style={{ fontFamily: mono, fontSize: 14, textTransform: "uppercase" }}>Votación:</span>
            <div style={{ display: "flex", gap: 10 }}>
              {[ORANGE, BLUE, DARK].map((c) => (
                <span key={c} onPointerDown={dragVote(null, c)} title="Arrastra al tablero para votar"
                  style={{ width: 22, height: 22, background: c, display: "inline-block", cursor: "grab" }} />
              ))}
            </div>
            <span style={{ fontFamily: mono, fontSize: 14, textTransform: "uppercase", color: "rgba(0,0,0,.5)" }}>Arrastra un cuadrado a la idea que ganó</span>
            <span style={{ marginLeft: "auto", fontFamily: mono, fontSize: 14, textTransform: "uppercase" }}>BAM · Bonilla Arquitectura Metropolitana · hygge.pe/bam</span>
          </footer>
        </div>
      </div>
    </div>
  );
}
