import { useState, useMemo, useRef, lazy, Suspense, Component } from "react";
import { computeEsquema } from "./esquema.js";
import { footprintReal } from "./loteReal.js";
import { generarDistribuciones } from "../planos/plantas.js";
import { bbox as polyBbox, centroid, dist, area as polyArea } from "../planos/geometry.js";

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

// planta típica sobre la FORMA REAL del lote (mismo motor que el editor de planos).
// interactiva: clic en un lindero = frente · arrastra un bloque para moverlo.
function PlantaReal({ lote, footprint, parti, frenteIdx, partiIdx, movs, onFrenteClick, onMove, svgRef }) {
  const b = polyBbox(lote);
  const w = Math.max(b.maxX - b.minX, 1), h = Math.max(b.maxY - b.minY, 1);
  const PAD = 44;
  const s = Math.min(600 / w, 420 / h);
  const W = w * s + PAD * 2, H = h * s + PAD * 2;
  const T = (p) => ({ x: PAD + (p.x - b.minX) * s, y: PAD + (p.y - b.minY) * s });
  const P = (pts) => pts.map(T).map((p) => `${p.x},${p.y}`).join(" ");
  const n = lote.length;
  const cx = PAD + w * s / 2, cy = PAD + h * s / 2;
  const fillFor = (r) => r.tipo === "core" ? C.ink : r.tipo === "pasillo" ? C.paper
    : TIP_COLOR[r.name?.split(" ")[0]] || "#E4E2DC";
  const key = (i) => `${partiIdx}:${i}`;
  const shift = (pts, i) => { const m = movs[key(i)]; return m ? pts.map((p) => ({ x: p.x + m.dx, y: p.y + m.dy })) : pts; };

  // clientXY → mundo (metros), vía la matriz del SVG
  const toWorld = (ev) => {
    const svg = svgRef.current; const pt = svg.createSVGPoint();
    pt.x = ev.clientX; pt.y = ev.clientY;
    const v = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: b.minX + (v.x - PAD) / s, y: b.minY + (v.y - PAD) / s };
  };
  const drag = useRef(null);
  const down = (i) => (ev) => {
    ev.stopPropagation();
    const wpt = toWorld(ev);
    drag.current = { i, sx: wpt.x, sy: wpt.y, base: movs[key(i)] || { dx: 0, dy: 0 } };
    try { svgRef.current.setPointerCapture(ev.pointerId); } catch { /* ok */ }
  };
  const move = (ev) => {
    if (!drag.current) return;
    const wpt = toWorld(ev);
    onMove?.(key(drag.current.i), {
      dx: +(drag.current.base.dx + wpt.x - drag.current.sx).toFixed(2),
      dy: +(drag.current.base.dy + wpt.y - drag.current.sy).toFixed(2),
    });
  };
  const up = (ev) => { drag.current = null; try { svgRef.current.releasePointerCapture(ev.pointerId); } catch { /* ok */ } };

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", touchAction: "none" }}
      xmlns="http://www.w3.org/2000/svg" fontFamily={mono} onPointerMove={move} onPointerUp={up} onPointerLeave={up}>
      <defs>
        <pattern id="hatchR" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="6" stroke={C.line} strokeWidth="1.4" />
        </pattern>
      </defs>

      {/* lote real (línea de propiedad) */}
      <polygon points={P(lote)} fill="url(#hatchR)" stroke={C.ink} strokeWidth="1.2" strokeDasharray="5 3" />

      {/* footprint construible */}
      <polygon points={P(footprint)} fill={C.card} stroke={C.peri} strokeWidth="1.2" strokeDasharray="4 3" />

      {/* distribución (core / corredor / unidades) — arrastrables */}
      {parti?.rooms?.map((r, i) => {
        const pts = shift(r.pts, i);
        const c = T(centroid(pts));
        const a = polyArea(pts);
        const label = r.tipo === "unidad" && a * s * s > 900;
        return (
          <g key={i} onPointerDown={down(i)} style={{ cursor: "grab" }}>
            <polygon points={P(pts)} fill={fillFor(r)} stroke={C.card} strokeWidth="1.5"
              fillOpacity={r.tipo === "core" ? 1 : 0.92} />
            {label && (
              <text x={c.x} y={c.y} fontSize="9.5" fontWeight="700" fill={C.ink} textAnchor="middle" pointerEvents="none">
                {r.name.split(" · ")[0]}
                <tspan x={c.x} dy="11" fontSize="8" fontWeight="400">{r.name.split(" · ")[1] || ""}</tspan>
              </text>
            )}
            {r.tipo === "core" && a * s * s > 400 && (
              <text x={c.x} y={c.y + 3} fontSize="8" fill={C.paper} textAnchor="middle" pointerEvents="none">core</text>
            )}
          </g>
        );
      })}

      {/* linderos CLICABLES para elegir el frente + cota de cada uno */}
      {lote.map((p, i) => {
        const q = lote[(i + 1) % n];
        const a = T(p), z = T(q);
        const m = { x: (a.x + z.x) / 2, y: (a.y + z.y) / 2 };
        const out = { x: m.x - cx, y: m.y - cy }; const L0 = Math.hypot(out.x, out.y) || 1;
        const esFrente = i === frenteIdx % n;
        return (
          <g key={`e${i}`}>
            {esFrente && <line x1={a.x} y1={a.y} x2={z.x} y2={z.y} stroke={C.orange} strokeWidth="3" pointerEvents="none" />}
            {/* zona de clic ancha e invisible sobre el borde */}
            <line x1={a.x} y1={a.y} x2={z.x} y2={z.y} stroke="transparent" strokeWidth="14"
              style={{ cursor: "pointer" }} onClick={() => onFrenteClick?.(i)}>
              <title>marcar este lindero como frente (calle)</title>
            </line>
            {dist(p, q) * s >= 24 && (
              <text x={m.x + (out.x / L0) * 15} y={m.y + (out.y / L0) * 15 + 3} fontSize="8.5"
                fill={esFrente ? C.orange : C.soft} textAnchor="middle" pointerEvents="none"
                stroke={C.paper} strokeWidth="2.5" paintOrder="stroke">
                {fmt(dist(p, q), 2)}{esFrente ? " · frente" : ""}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// planta típica esquemática (rectangular — el 3D y el editor usan la forma real)
function Planta({ e, frente, rf, ri, svgRef }) {
  const PAD = 34;
  const s = Math.min(600 / Math.max(frente, 1), 420 / Math.max(e.fondo, 1));
  const W = frente * s + PAD * 2;
  const H = e.fondo * s + PAD * 2;
  const lx = PAD, ly = PAD; // origen del lote (calle arriba)
  const ex = lx + ri * s, ey = ly + rf * s; // origen del edificio

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
              {u.rects.map((r, ri2) => (
                <rect key={ri2} x={ex + r.x * s} y={ey + fila.y * s} width={r.w * s} height={fila.depth * s}
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

export default function EsquemaPlanta({
  terreno, huella, pisos, dptos, mix1, mix2, areaDpto, circulacion, pisosSot, azoteaTechada,
  frente, tipoLote, retiros, lotePoly, cadInfo,
  frenteIdxOverride = null, onFrente, partiIdx = 0, onParti, movs = {}, onMovs, onFrenteReal,
  soloPlanta = false,
}) {
  const [briefSent, setBriefSent] = useState(null);
  const [show3D, setShow3D] = useState(false);
  const svgRef = useRef(null);

  // retiros efectivos (solo los activos cuentan); vienen definidos en el card 01
  const rf = retiros?.frontal?.on ? retiros.frontal.v : 0;
  const ri = retiros?.izquierda?.on ? retiros.izquierda.v : 0;
  const rd = retiros?.derecha?.on ? retiros.derecha.v : 0;
  const rp = retiros?.posterior?.on ? retiros.posterior.v : 0;

  const e = useMemo(
    () => computeEsquema({ terreno, frente, rf, ri, rd, rp, huella, pisos, dptos, mix1, mix2, areaDpto, circulacion }),
    [terreno, frente, rf, ri, rd, rp, huella, pisos, dptos, mix1, mix2, areaDpto, circulacion]
  );

  // con lote real: footprint (ochavo + retiros por borde) + distribución del motor del editor.
  // frenteIdx efectivo = override manual (clic en lindero) > el que dedujo el CAD.
  const frenteIdx = frenteIdxOverride ?? cadInfo?.frenteIdx ?? 0;
  const real = useMemo(() => {
    if (!lotePoly || lotePoly.length < 3) return null;
    const { lote, footprint } = footprintReal(lotePoly, frenteIdx, tipoLote, retiros);
    let partis = [];
    try {
      partis = generarDistribuciones(footprint, frenteIdx, {
        udsPiso: e.uPorPiso, pct1: mix1, pct2: mix2, areaObjetivo: areaDpto,
      }) || [];
    } catch { partis = []; }
    return { lote, footprint, partis };
  }, [lotePoly, frenteIdx, tipoLote, retiros, e.uPorPiso, mix1, mix2, areaDpto]);
  const parti = real?.partis?.[Math.min(partiIdx, Math.max((real?.partis?.length || 1) - 1, 0))] || null;

  // cambia el frente al clic en un lindero (y actualiza el frente numérico = largo del borde)
  const elegirFrente = (i) => {
    onFrente?.(i);
    if (real?.lote) { const q = real.lote[(i + 1) % real.lote.length], p = real.lote[i]; onFrenteReal?.(Math.round(dist(p, q))); }
  };

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
      {/* resumen del lote (se define en 01 · terreno y normativa) */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 18px", alignItems: "center", paddingBottom: 14, borderBottom: `1px solid ${C.line}` }}>
        <span style={{ fontFamily: mono, fontSize: 10.5, color: C.soft }}>
          {lotePoly
            ? <>lote real del CAD · {fmt(cadInfo?.area || terreno)} m² · {cadInfo?.verts} vértices</>
            : <>lote por proporciones · {fmt(terreno)} m² · frente {fmt(frente, 1)} m</>}
          {" · "}{tipoLote === "esquina" ? "esquina" : "entre medianeras"}
          {" · retiros: "}
          {[["frontal", rf], ["izq", ri], ["der", rd], ["post", rp]].filter(([, v]) => v > 0).map(([k, v]) => `${k} ${v}m`).join(" · ") || "ninguno"}
          {retiros?.ochavo?.on && tipoLote === "esquina" ? ` · ochavo ${retiros.ochavo.v}m` : ""}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {!soloPlanta && (
          <button onClick={() => setShow3D((v) => !v)} style={{
            fontFamily: mono, fontSize: 10.5, color: show3D ? C.card : C.ink,
            background: show3D ? C.ink : C.paper, border: `1px solid ${show3D ? C.ink : C.line}`,
            borderRadius: 2, padding: "6px 12px", cursor: "pointer",
          }}>
            {show3D ? "▣ masa 3D" : "◱ masa 3D"}
          </button>
          )}
          <button onClick={descargar} style={{
            fontFamily: mono, fontSize: 10.5, color: C.ink, background: C.paper,
            border: `1px solid ${C.line}`, borderRadius: 2, padding: "6px 12px", cursor: "pointer",
          }}>
            ↓ svg
          </button>
        </div>
      </div>

      {/* warnings */}
      {e.warns.map((w) => (
        <div key={w} style={{ fontFamily: mono, fontSize: 11, color: C.orange, padding: "10px 0 0" }}>▲ {w}</div>
      ))}

      {/* planta + corte */}
      <div style={{ display: "grid", gridTemplateColumns: soloPlanta ? "1fr" : "minmax(260px, 2.4fr) minmax(140px, 1fr)", gap: 20, paddingTop: 16, alignItems: "start" }}>
        <div>
          {real && parti ? (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span style={{ fontFamily: mono, fontSize: 9.5, color: C.soft }}>
                  planta sobre forma real · {parti.stats?.uds ?? "?"} unids/piso · footprint {fmt(polyArea(real.footprint))} m²
                </span>
                <span style={{ marginLeft: "auto", display: "flex", gap: 4, alignItems: "center" }}>
                  {Object.keys(movs).some((k) => k.startsWith(`${partiIdx}:`)) && (
                    <button onClick={() => onMovs?.(Object.fromEntries(Object.entries(movs).filter(([k]) => !k.startsWith(`${partiIdx}:`))))}
                      title="volver los bloques a su posición generada"
                      style={{ fontFamily: mono, fontSize: 9, padding: "2px 8px", borderRadius: 2, cursor: "pointer", color: C.orange, background: "transparent", border: `1px solid ${C.orange}` }}>
                      ↺ reset
                    </button>
                  )}
                  {real.partis.map((p, i) => (
                    <button key={i} onClick={() => onParti?.(i)} title={p.notas?.join(" · ")}
                      style={{ fontFamily: mono, fontSize: 9, padding: "2px 8px", borderRadius: 2, cursor: "pointer",
                        color: i === partiIdx ? C.card : C.ink, background: i === partiIdx ? C.ink : C.paper,
                        border: `1px solid ${i === partiIdx ? C.ink : C.line}` }}>
                      {p.nombre}
                    </button>
                  ))}
                </span>
              </div>
              <PlantaReal lote={real.lote} footprint={real.footprint} parti={parti} frenteIdx={frenteIdx}
                partiIdx={partiIdx} movs={movs} onFrenteClick={elegirFrente}
                onMove={(k, d) => onMovs?.({ ...movs, [k]: d })} svgRef={svgRef} />
              <div style={{ fontFamily: mono, fontSize: 9, color: C.soft, marginTop: 6 }}>
                clic en un lindero = marcarlo como frente · arrastra un bloque para moverlo
              </div>
            </>
          ) : (
            <>
              <div style={{ fontFamily: mono, fontSize: 9.5, color: C.soft, marginBottom: 8 }}>
                planta típica · {e.uPorPiso} unids/piso · {e.doble ? "doble crujía" : "crujía simple"}
                {lotePoly ? " · ▲ el footprint no admite la distribución — revisa retiros o unids/piso" : ""}
              </div>
              <Planta e={e} frente={frente} rf={rf} ri={ri} svgRef={svgRef} />
            </>
          )}
        </div>
        {!soloPlanta && (
        <div>
          <div style={{ fontFamily: mono, fontSize: 9.5, color: C.soft, marginBottom: 8 }}>corte esquemático</div>
          <Corte e={e} pisos={pisos} pisosSot={pisosSot} azoteaTechada={azoteaTechada} />
        </div>
        )}
      </div>

      {/* masa volumétrica 3D orbitable */}
      {show3D && (
        <div style={{ paddingTop: 16 }}>
          <div style={{ fontFamily: mono, fontSize: 9.5, color: C.soft, marginBottom: 8 }}>
            masa 3D · arrastra para orbitar · rueda para zoom{lotePoly ? " · forma real del lote" : ""}
          </div>
          <Masa3DBoundary>
            <Suspense fallback={
              <div style={{ height: 460, display: "flex", alignItems: "center", justifyContent: "center",
                background: C.paper, border: `1px solid ${C.line}`, borderRadius: 3,
                fontFamily: mono, fontSize: 11, color: C.soft }}>
                cargando volumen…
              </div>
            }>
              <Masa3D e={e} frente={frente} pisos={pisos} pisosSot={pisosSot} azoteaTechada={azoteaTechada}
                lotePoly={lotePoly} frenteIdx={frenteIdx}
                tipoLote={tipoLote} retiros={retiros} />
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
        el lote (área, frente, tipo y retiros) se define en 01 · terreno y normativa.
      </p>
    </div>
  );
}
