import { useState, useMemo, useRef, lazy, Suspense, Component } from "react";
import { computeEsquema } from "./esquema.js";
import { importCAD } from "./cad.js";

const Masa3D = lazy(() => import("./Masa3D.jsx"));

class Masa3DBoundary extends Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (this.state.err) {
      return (
        <div style={{ height: 460, padding: 16, background: "#FFF4F0", border: "1px solid #F7643B",
          borderRadius: 3, fontFamily: "monospace", fontSize: 11, color: "#B23", overflow: "auto", whiteSpace: "pre-wrap" }}>
          {"⚠ masa 3D falló\n\n" + String(this.state.err?.stack || this.state.err?.message || this.state.err)}
        </div>
      );
    }
    return this.props.children;
  }
}

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
const TIP_COLOR = { "1D": "#D8E0F7", "2D": "#95ABE8", "3D": "#F7936F" };

const fmt = (n, d = 0) =>
  n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

function MiniNum({ label, value, onChange, unit, step = 0.5 }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
      <label style={{ fontFamily: sans, fontSize: 12, color: C.ink, textTransform: "lowercase" }}>{label}</label>
      <input
        type="number" value={value} step={step} min={0}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        style={{
          fontFamily: mono, fontSize: 13, fontWeight: 600, color: C.ink,
          width: 66, textAlign: "right", border: `1px solid ${C.line}`, borderRadius: 2,
          background: C.paper, outline: "none", padding: "4px 6px",
        }}
      />
      <span style={{ fontFamily: mono, fontSize: 10, color: C.soft }}>{unit}</span>
    </div>
  );
}

// planta típica esquemática
function Planta({ e, frente, retiroFrontal, retiroLateral, svgRef }) {
  const PAD = 34;
  const s = Math.min(600 / Math.max(frente, 1), 420 / Math.max(e.fondo, 1));
  const W = frente * s + PAD * 2;
  const H = e.fondo * s + PAD * 2;
  const lx = PAD, ly = PAD; // origen del lote (calle arriba)
  const ex = lx + retiroLateral * s, ey = ly + retiroFrontal * s; // origen del edificio

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}
      xmlns="http://www.w3.org/2000/svg" fontFamily={mono}>
      <defs>
        <pattern id="hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="6" stroke={C.line} strokeWidth="1.4" />
        </pattern>
      </defs>

      {/* calle */}
      <line x1={lx - 12} y1={ly - 8} x2={lx + frente * s + 12} y2={ly - 8} stroke={C.ink} strokeWidth="2.5" />
      <text x={lx} y={ly - 14} fontSize="9" fill={C.soft}>calle · frente {fmt(frente, 1)} m</text>

      {/* lote: área libre con hatch */}
      <rect x={lx} y={ly} width={frente * s} height={e.fondo * s} fill="url(#hatch)" stroke={C.ink}
        strokeWidth="1.2" strokeDasharray="5 3" />

      {/* cota fondo */}
      <text x={lx - 8} y={ly + (e.fondo * s) / 2} fontSize="9" fill={C.soft}
        textAnchor="middle" transform={`rotate(-90 ${lx - 8} ${ly + (e.fondo * s) / 2})`}>
        fondo {fmt(e.fondo, 1)} m
      </text>

      {/* edificio */}
      <rect x={ex} y={ey} width={e.anchoEdif * s} height={e.fondoEdif * s} fill={C.card} stroke={C.ink} strokeWidth="1.5" />

      {/* corredor */}
      <rect x={ex} y={ey + e.corredor.y * s} width={e.anchoEdif * s} height={e.corredor.h * s} fill={C.paper} />

      {/* unidades */}
      {e.filas.map((fila, fi) =>
        fila.units.map((u, ui) => {
          const big = u.rects.reduce((a, r) => (r.w > a.w ? r : a), u.rects[0]);
          return (
            <g key={`${fi}-${ui}`}>
              {u.rects.map((r, ri) => (
                <rect key={ri} x={ex + r.x * s} y={ey + fila.y * s} width={r.w * s} height={fila.depth * s}
                  fill={TIP_COLOR[u.tip]} stroke={C.card} strokeWidth="1.5" />
              ))}
              {big.w * s > 26 && (
                <text x={ex + (big.x + big.w / 2) * s} y={ey + (fila.y + fila.depth / 2) * s}
                  fontSize="9.5" fontWeight="700" fill={C.ink} textAnchor="middle">
                  {u.tip}
                  <tspan x={ex + (big.x + big.w / 2) * s} dy="11" fontSize="8" fontWeight="400">
                    {fmt(u.areaReal)} m²
                  </tspan>
                </text>
              )}
            </g>
          );
        })
      )}

      {/* core */}
      <rect x={ex + e.core.x * s} y={ey} width={e.core.w * s} height={e.fondoEdif * s} fill={C.ink} />
      <text x={ex + (e.core.x + e.core.w / 2) * s} y={ey + (e.fondoEdif * s) / 2} fontSize="8.5"
        fill={C.paper} textAnchor="middle" transform={`rotate(-90 ${ex + (e.core.x + e.core.w / 2) * s} ${ey + (e.fondoEdif * s) / 2})`}>
        core · esc + asc
      </text>

      {/* patio posterior */}
      {e.fondoLibre > 0.5 && (
        <text x={lx + (frente * s) / 2} y={ey + e.fondoEdif * s + (e.fondoLibre * s) / 2 + 3}
          fontSize="9" fill={C.soft} textAnchor="middle">
          área libre · {fmt(e.fondoLibre, 1)} m
        </text>
      )}
    </svg>
  );
}

// corte esquemático: sótanos + pisos + azotea
function Corte({ e, pisos, pisosSot, azoteaTechada }) {
  const hPiso = 2.8, hSot = 3.0;
  const totalArriba = pisos * hPiso + hPiso; // + azotea
  const totalAbajo = pisosSot * hSot;
  const PAD = 26;
  const s = Math.min(150 / Math.max(e.fondoEdif, 1), 330 / (totalArriba + totalAbajo));
  const bw = e.fondoEdif * s;
  const W = bw + PAD * 2 + 46;
  const H = (totalArriba + totalAbajo) * s + PAD * 2;
  const gy = PAD + totalArriba * s; // línea de terreno
  const bx = PAD;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} fontFamily={mono}>
      {/* pisos */}
      {Array.from({ length: pisos }, (_, i) => (
        <rect key={i} x={bx} y={gy - (i + 1) * hPiso * s} width={bw} height={hPiso * s}
          fill={i === 0 ? C.paper : C.card} stroke={C.ink} strokeWidth="1" />
      ))}
      {/* azotea: parte techada */}
      <rect x={bx} y={gy - (pisos + 1) * hPiso * s} width={bw * azoteaTechada / 100} height={hPiso * s}
        fill={C.peri} stroke={C.ink} strokeWidth="1" />
      <line x1={bx + bw * azoteaTechada / 100} y1={gy - pisos * hPiso * s}
        x2={bx + bw} y2={gy - pisos * hPiso * s} stroke={C.ink} strokeWidth="1" />
      {/* sótanos */}
      {Array.from({ length: pisosSot }, (_, i) => (
        <rect key={i} x={bx} y={gy + i * hSot * s} width={bw} height={hSot * s}
          fill="#DEDBD4" stroke={C.ink} strokeWidth="1" strokeDasharray="3 2" />
      ))}
      {/* línea de terreno */}
      <line x1={bx - 14} y1={gy} x2={bx + bw + 14} y2={gy} stroke={C.orange} strokeWidth="1.8" />
      {/* labels */}
      <text x={bx + bw + 6} y={gy - pisos * hPiso * s + 4} fontSize="8.5" fill={C.soft}>{pisos} pisos</text>
      <text x={bx + bw + 6} y={gy - (pisos + 1) * hPiso * s + 4} fontSize="8.5" fill={C.peri}>azotea</text>
      {pisosSot > 0 && (
        <text x={bx + bw + 6} y={gy + pisosSot * hSot * s} fontSize="8.5" fill={C.soft}>
          {pisosSot} sót.
        </text>
      )}
      <text x={bx} y={H - 6} fontSize="8.5" fill={C.soft}>± {fmt(pisos * hPiso + hPiso, 1)} m</text>
    </svg>
  );
}

export default function EsquemaPlanta({ terreno, huella, pisos, dptos, mix1, mix2, areaDpto, circulacion, pisosSot, azoteaTechada, onArea }) {
  const [frente, setFrente] = useState(Math.round(Math.sqrt(terreno * 1.4)));
  const [retiroFrontal, setRetiroFrontal] = useState(5);
  const [retiroLateral, setRetiroLateral] = useState(0);
  const [briefSent, setBriefSent] = useState(null);
  const [show3D, setShow3D] = useState(false);
  const [lotePoly, setLotePoly] = useState(null);
  const [cadInfo, setCadInfo] = useState(null);
  const [cadErr, setCadErr] = useState(null);
  const svgRef = useRef(null);
  const fileRef = useRef(null);

  // importa DXF/DWG → contorno real del lote (metros); alimenta área, frente y masa 3D
  const onCAD = async (file) => {
    if (!file) return;
    setCadErr(null);
    try {
      const r = await importCAD(file);
      setLotePoly(r.pts);
      setCadInfo(r);
      if (r.area > 0) onArea?.(r.area);
      if (r.frente > 0) setFrente(Math.round(r.frente));
      setShow3D(true);
      try {
        localStorage.setItem("hygge:loteCabida", JSON.stringify({
          pts: r.pts, area: r.area, frente: r.frente, retiroFrontal, retiroLateral,
          pisos, pisosSot, units: r.units, ts: Date.now(),
        }));
      } catch { /* cuota */ }
    } catch (e) {
      setLotePoly(null); setCadInfo(null);
      setCadErr(e?.message || String(e));
    }
  };
  const quitarCAD = () => { setLotePoly(null); setCadInfo(null); setCadErr(null); };

  const e = useMemo(
    () => computeEsquema({ terreno, frente, retiroFrontal, retiroLateral, huella, pisos, dptos, mix1, mix2, areaDpto, circulacion }),
    [terreno, frente, retiroFrontal, retiroLateral, huella, pisos, dptos, mix1, mix2, areaDpto, circulacion]
  );

  // envía la tipología como brief al generador del Editor de Planos
  const enviarBrief = (tip) => {
    const depth = e.filas[0]?.depth || 4.5;
    const brief = {
      area: +e.areaTip[tip].toFixed(1),
      frente: +(e.areaTip[tip] / depth).toFixed(2),
      dormitorios: parseInt(tip, 10) || 1,
      banos: tip === "1D" ? 1 : 2,
    };
    try { localStorage.setItem("hygge:planBrief", JSON.stringify(brief)); } catch { /* cuota */ }
    setBriefSent(tip);
    setTimeout(() => setBriefSent(null), 3200);
  };

  const descargar = () => {
    if (!svgRef.current) return;
    const src = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([src], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "planta-esquematica.svg";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div>
      {/* controles */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 24px", alignItems: "center", paddingBottom: 14, borderBottom: `1px solid ${C.line}` }}>
        <MiniNum label="frente del lote" value={frente} onChange={setFrente} unit="m" step={1} />
        <MiniNum label="retiro frontal" value={retiroFrontal} onChange={setRetiroFrontal} unit="m" />
        <MiniNum label="retiro lateral" value={retiroLateral} onChange={setRetiroLateral} unit="m" />
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <input ref={fileRef} type="file" accept=".dxf,.dwg" style={{ display: "none" }}
            onChange={(ev) => { onCAD(ev.target.files?.[0]); ev.target.value = ""; }} />
          {cadInfo ? (
            <button onClick={quitarCAD} title={`lote real · ${fmt(cadInfo.area)} m² · ${cadInfo.verts} vértices · ${cadInfo.units}`}
              style={{ fontFamily: mono, fontSize: 10.5, color: C.card, background: C.peri, border: `1px solid ${C.peri}`,
                borderRadius: 2, padding: "6px 12px", cursor: "pointer" }}>
              ✓ lote real {fmt(cadInfo.area)} m² · quitar
            </button>
          ) : (
            <button onClick={() => fileRef.current?.click()} title="Importar el contorno del terreno desde CAD (.dxf · .dwg)"
              style={{ fontFamily: mono, fontSize: 10.5, color: C.ink, background: C.paper, border: `1px solid ${C.line}`,
                borderRadius: 2, padding: "6px 12px", cursor: "pointer" }}>
              ↑ importar CAD
            </button>
          )}
          <button onClick={() => setShow3D((v) => !v)} style={{
            fontFamily: mono, fontSize: 10.5, color: show3D ? C.card : C.ink,
            background: show3D ? C.ink : C.paper, border: `1px solid ${show3D ? C.ink : C.line}`,
            borderRadius: 2, padding: "6px 12px", cursor: "pointer",
          }}>
            {show3D ? "▣ masa 3D" : "◱ masa 3D"}
          </button>
          <button onClick={descargar} style={{
            fontFamily: mono, fontSize: 10.5, color: C.ink, background: C.paper,
            border: `1px solid ${C.line}`, borderRadius: 2, padding: "6px 12px", cursor: "pointer",
          }}>
            ↓ svg
          </button>
        </div>
      </div>

      {/* estado del CAD importado */}
      {cadErr && (
        <div style={{ fontFamily: mono, fontSize: 11, color: C.orange, padding: "10px 0 0", lineHeight: 1.5 }}>▲ {cadErr}</div>
      )}
      {cadInfo && (
        <div style={{ fontFamily: mono, fontSize: 10.5, color: C.peri, padding: "10px 0 0" }}>
          ◇ lote real del CAD · {fmt(cadInfo.area)} m² · {fmt(cadInfo.bbox.w, 1)}×{fmt(cadInfo.bbox.h, 1)} m · {cadInfo.verts} vértices
          {cadInfo.assumedMeters ? " · (asumí metros — verifica escala)" : ` · unidades ${cadInfo.units}`}
          {" · "}la masa 3D usa esta forma
        </div>
      )}

      {/* warnings */}
      {e.warns.map((w) => (
        <div key={w} style={{ fontFamily: mono, fontSize: 11, color: C.orange, padding: "10px 0 0" }}>▲ {w}</div>
      ))}

      {/* planta + corte */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 2.4fr) minmax(140px, 1fr)", gap: 20, paddingTop: 16, alignItems: "start" }}>
        <div>
          <div style={{ fontFamily: mono, fontSize: 9.5, color: C.soft, marginBottom: 8 }}>
            planta típica · {e.uPorPiso} unids/piso · {e.doble ? "doble crujía" : "crujía simple"}
          </div>
          <Planta e={e} frente={frente} retiroFrontal={retiroFrontal} retiroLateral={retiroLateral} svgRef={svgRef} />
        </div>
        <div>
          <div style={{ fontFamily: mono, fontSize: 9.5, color: C.soft, marginBottom: 8 }}>corte esquemático</div>
          <Corte e={e} pisos={pisos} pisosSot={pisosSot} azoteaTechada={azoteaTechada} />
        </div>
      </div>

      {/* masa volumétrica 3D orbitable */}
      {show3D && (
        <div style={{ paddingTop: 16 }}>
          <div style={{ fontFamily: mono, fontSize: 9.5, color: C.soft, marginBottom: 8 }}>
            masa 3D · arrastra para orbitar · rueda para zoom
          </div>
          <Masa3DBoundary>
            <Suspense fallback={
              <div style={{ height: 460, display: "flex", alignItems: "center", justifyContent: "center",
                background: C.paper, border: `1px solid ${C.line}`, borderRadius: 3,
                fontFamily: mono, fontSize: 11, color: C.soft }}>
                cargando volumen…
              </div>
            }>
              <Masa3D e={e} frente={frente} retiroFrontal={retiroFrontal} retiroLateral={retiroLateral}
                pisos={pisos} pisosSot={pisosSot} azoteaTechada={azoteaTechada} lotePoly={lotePoly} />
            </Suspense>
          </Masa3DBoundary>
        </div>
      )}

      {/* leyenda + métricas */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 22px", alignItems: "baseline", paddingTop: 14, borderTop: `1px dotted ${C.line}`, marginTop: 8 }}>
        {["1D", "2D", "3D"].map((t) => (
          <span key={t} style={{ fontFamily: mono, fontSize: 10.5, color: C.ink, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, background: TIP_COLOR[t], display: "inline-block", borderRadius: 1 }} />
            {t} · {fmt(e.areaTip[t])} m² · {t === "1D" ? e.n1 : t === "2D" ? e.n2 : e.n3}/piso
            <button onClick={() => enviarBrief(t)} title="generar distribución de esta tipología en el Editor de Planos"
              style={{ fontFamily: mono, fontSize: 9.5, color: briefSent === t ? C.card : C.orange,
                background: briefSent === t ? C.orange : "transparent", border: `1px solid ${C.orange}`,
                borderRadius: 2, padding: "2px 7px", cursor: "pointer" }}>
              {briefSent === t ? "brief listo ✓" : "→ plano"}
            </button>
          </span>
        ))}
        <span style={{ fontFamily: mono, fontSize: 10.5, color: C.soft, marginLeft: "auto" }}>
          edificio {fmt(e.anchoEdif, 1)} × {fmt(e.fondoEdif, 1)} m · patio {fmt(Math.max(e.fondoLibre, 0), 1)} m
        </span>
      </div>

      <p style={{ fontFamily: mono, fontSize: 9, color: C.soft, marginTop: 14, marginBottom: 0, lineHeight: 1.6 }}>
        distribución esquemática automática — proporciones reales, arquitectura referencial.
        fondo = terreno / frente · core central · tipologías 0.65× / 1× / 1.35× del área promedio.
      </p>
    </div>
  );
}
