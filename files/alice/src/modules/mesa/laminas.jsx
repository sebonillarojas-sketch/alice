// láminas A4 apaisadas (297×210 → 1122×793 px) de la Mesa de Trabajo BAM.
// Cada lámina es un "viewport" imprimible: header con proyecto, footer con folio.
import { useRef, useState, lazy, Suspense, Component } from "react";
import { Upload, X, Camera } from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, LabelList,
  ScatterChart, Scatter, ZAxis, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  AreaChart, Area, ReferenceLine, CartesianGrid,
} from "recharts";
import EsquemaPlanta from "../cabida/EsquemaPlanta.jsx";
import { computeEsquema } from "../cabida/esquema.js";
import { laminaSVG } from "../planos/lamina.js";
import { fmt, fileToDataURL, calcMercado, mapaMinimalHTML } from "./proyecto.js";

const Masa3D = lazy(() => import("../cabida/Masa3D.jsx"));
class Masa3DBoundary extends Component {
  constructor(p) { super(p); this.state = { err: false }; }
  static getDerivedStateFromError() { return { err: true }; }
  render() {
    return this.state.err
      ? <div style={{ padding: 40, fontFamily: MONO, fontSize: 12, color: "rgba(0,0,0,.5)" }}>No se pudo cargar el 3D en este navegador.</div>
      : this.props.children;
  }
}

export const A4W = 1122, A4H = 793;
const BG = "#E3E1DE", INK = "#000000", BLUE = "#95ABE8", ORANGE = "#F7643B", DARK = "#373737", PAPER = "#F9F9F9";
const MONO = "'CS Genio Mono','JetBrains Mono','SF Mono',Menlo,monospace";
const SANS = "'Neue Montreal','Hanken Grotesk','Helvetica Neue',sans-serif";

// logos reales del brand book (public/brand/)
const LogoBam = ({ w = 64, offwhite = false }) => (
  <img src={offwhite ? "/brand/bam-offwhite.svg" : "/brand/bam-negro.svg"} alt="BAM" style={{ width: w, display: "block" }} />
);
const LogoHygge = ({ w = 96 }) => (
  <img src="/brand/hygge.svg" alt="hygge" style={{ width: w, display: "block" }} />
);

// hoja A4 con membrete BAM arriba y folio abajo
export function A4({ seccion, titulo, proyecto, folio, children, bg = BG }) {
  return (
    <div className="mesa-a4" style={{ width: A4W, height: A4H, background: bg, color: INK, fontFamily: SANS, position: "relative", overflow: "hidden", boxShadow: "0 2px 18px rgba(0,0,0,.16)", display: "flex", flexDirection: "column" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 36px 12px", borderBottom: `1px solid ${INK}`, flexShrink: 0 }}>
        <LogoBam w={54} />
        <div style={{ fontFamily: MONO, fontSize: 11, textTransform: "uppercase", color: "rgba(0,0,0,.55)" }}>{seccion}</div>
        <h2 style={{ fontSize: 22, fontWeight: 400, margin: 0, letterSpacing: "-0.01em" }}>{titulo}</h2>
        <div style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 11, textTransform: "uppercase" }}>{proyecto}</div>
      </header>
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>{children}</div>
      <footer style={{ display: "flex", gap: 20, padding: "10px 36px 14px", borderTop: `1px solid ${INK}`, fontFamily: MONO, fontSize: 10, textTransform: "uppercase", flexShrink: 0 }}>
        <span>BAM · Bonilla Arquitectura Metropolitana</span>
        <span style={{ color: "rgba(0,0,0,.5)" }}>hygge.pe/bam</span>
        <span style={{ marginLeft: "auto" }}>{folio}</span>
      </footer>
    </div>
  );
}

const Dato = ({ k, v, accent, big }) => (
  <div style={{ borderLeft: `3px solid ${accent || INK}`, paddingLeft: 12 }}>
    <div style={{ fontFamily: MONO, fontSize: 10, textTransform: "uppercase", color: "rgba(0,0,0,.55)", marginBottom: 2 }}>{k}</div>
    <div style={{ fontFamily: MONO, fontSize: big ? 26 : 17, fontWeight: 600 }}>{v}</div>
  </div>
);

const Fila = ({ k, v, strong, accent }) => (
  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: strong ? "7px 0" : "5px 0", borderBottom: strong ? `1px solid ${INK}` : "1px dotted rgba(0,0,0,.25)" }}>
    <span style={{ fontSize: 12.5, fontWeight: strong ? 700 : 400 }}>{k}</span>
    <span style={{ fontFamily: MONO, fontSize: strong ? 13.5 : 12.5, fontWeight: strong ? 700 : 500, color: accent || INK, whiteSpace: "nowrap" }}>{v}</span>
  </div>
);

// ── 0 · Portada — foto de obra del brand book (reemplazable subiendo otra imagen) ──
export function LamPortada({ nombre, terreno, img, onImg, fecha }) {
  const inputRef = useRef(null);
  return (
    <div className="mesa-a4" style={{ width: A4W, height: A4H, position: "relative", overflow: "hidden", background: BG, color: INK, fontFamily: SANS, boxShadow: "0 2px 18px rgba(0,0,0,.16)" }}>
      <img src={img || "/brand/portada-obra.jpg"} alt="portada" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      {/* ficha del proyecto sobre la foto */}
      <div style={{ position: "absolute", right: 28, top: 28, display: "flex", flexDirection: "column", gap: 0, background: "#F9F9F7", border: `1px solid ${INK}`, minWidth: 300, maxWidth: 420 }}>
        <div style={{ padding: "14px 18px 10px", borderBottom: "1px solid rgba(0,0,0,.25)" }}>
          <div style={{ fontFamily: MONO, fontSize: 10, textTransform: "uppercase", color: ORANGE, marginBottom: 6 }}>Presentación de cabida</div>
          <div style={{ fontSize: 26, lineHeight: 1.1, letterSpacing: "-0.01em" }}>{nombre || "Nuevo proyecto"}</div>
          {terreno && <div style={{ fontFamily: MONO, fontSize: 10.5, textTransform: "uppercase", marginTop: 6, color: "rgba(0,0,0,.55)" }}>{terreno.district} · {terreno.address}</div>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 18px" }}>
          <LogoHygge w={64} />
          <LogoBam w={54} />
          <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 10.5, textTransform: "uppercase" }}>{fecha}</span>
        </div>
      </div>
      {img && (
        <button className="mesa-noprint" onClick={() => onImg(null)} title="Volver a la foto de obra"
          style={{ position: "absolute", left: 10, top: 10, width: 30, height: 30, border: `1px solid ${INK}`, background: PAPER, cursor: "pointer" }}>
          <X size={14} />
        </button>
      )}
      <button className="mesa-noprint" onClick={() => inputRef.current?.click()}
        style={{ position: "absolute", right: 28, bottom: 24, display: "flex", gap: 8, alignItems: "center", fontFamily: MONO, fontSize: 10.5, textTransform: "uppercase", border: `1px dashed rgba(0,0,0,.55)`, background: "rgba(249,249,247,.85)", padding: "8px 12px", cursor: "pointer" }}>
        <Upload size={13} /> Cambiar portada
      </button>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) fileToDataURL(f, onImg); e.target.value = ""; }} />
    </div>
  );
}

// ── Cabida C-01 · parámetros (todo lo que se definió en la app cabida) ──
export function LamCabidaParams({ nombre, cab }) {
  const { s } = cab;
  const ret = (r) => (r?.on ? `${r.v} m` : "no");
  const Col = ({ n, titulo, rows }) => (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 11, textTransform: "uppercase", marginBottom: 10 }}>
        <span style={{ color: ORANGE }}>{n}</span> {titulo}
      </div>
      {rows.map(([k, v, strong]) => <Fila key={k} k={k} v={v} strong={strong} />)}
    </div>
  );
  return (
    <A4 seccion="( 2 ) Cabida" titulo="Parámetros del cálculo" proyecto={nombre} folio="C-01">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 32, padding: "24px 36px", height: "100%", boxSizing: "border-box" }}>
        <Col n="01" titulo="Terreno y normativa" rows={[
          ["área de terreno", `${fmt(s.terreno)} m²`, true],
          ["fuente del lote", s.modoLote === "cad" ? "plano CAD" : "proporciones"],
          ["frente del lote", `${fmt(s.frente)} m`],
          ["número de pisos", `${s.pisos}`, true],
          ["área libre (1er piso)", `${s.areaLibre}%`],
          ["azotea techada (% huella)", `${s.azoteaTechada}%`],
          ["circulación + áreas comunes", `${s.circulacion}%`],
          ["tipo de lote", s.tipoLote === "esquina" ? "esquina" : "entre medianeras"],
          ["retiro frontal", ret(s.retiros?.frontal)],
          ["retiro izquierda", ret(s.retiros?.izquierda)],
          ["retiro derecha", ret(s.retiros?.derecha)],
          ["retiro posterior", ret(s.retiros?.posterior)],
          ["ochavo", s.tipoLote === "esquina" ? ret(s.retiros?.ochavo) : "—"],
        ]} />
        <Col n="02" titulo="Producto y estacionamientos" rows={[
          ["área promedio por departamento", `${s.areaDpto} m²`, true],
          ["mix 1 dorm", `${s.mix1}%`],
          ["mix 2 dorm", `${s.mix2}%`],
          ["mix 3 dorm (resto)", `${Math.max(0, 100 - s.mix1 - s.mix2)}%`],
          ["est. por dpto 1 dorm", `${s.est1} est`],
          ["est. por dpto 2–3 dorm", `${s.est23} est`],
          ["m² por plaza (incl. rampas)", `${s.m2Plaza} m²`],
          ["adicional visitas", `${s.visitas}%`],
        ]} />
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Col n="03" titulo="Valores" rows={[
            ["precio m² vendible", `$${fmt(s.precioM2)}`, true],
            ["precio por estacionamiento", `$${fmt(s.precioEst)}`],
            ["costo m² construido", `$${fmt(s.costoM2)}`, true],
            ["valor azotea no techada", `${s.factorAzotea}% del precio`],
          ]} />
          <div style={{ background: DARK, color: BG, padding: "18px 20px", marginTop: "auto" }}>
            <div style={{ fontFamily: MONO, fontSize: 10, textTransform: "uppercase", color: "rgba(227,225,222,.6)", marginBottom: 10 }}>Resultado inmediato</div>
            {[
              ["área vendible", `${fmt(cab.r.vendible)} m²`],
              ["área construida total", `${fmt(cab.r.construidaTotal)} m²`],
              ["departamentos", `${fmt(cab.r.dptos)} unids`],
              ["estacionamientos", `${fmt(cab.r.estVend)} unids`],
              ["margen bruto", `$${fmt(cab.r.margen)} · ${cab.r.ingresos > 0 ? fmt(cab.r.margen / cab.r.ingresos * 100, 1) : 0}%`],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px dotted rgba(227,225,222,.25)", fontSize: 12.5 }}>
                <span style={{ textTransform: "lowercase" }}>{k}</span>
                <span style={{ fontFamily: MONO, fontWeight: 600, color: k === "margen bruto" ? ORANGE : BG }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </A4>
  );
}

// ── 1 · Growth: datos del proyecto/terreno ──
export function LamProyecto({ nombre, terreno, cab }) {
  const t = terreno || {};
  const precioM2Terr = t.askedPrice && t.areaM2 ? t.askedPrice / t.areaM2 : null;
  const incTerr = t.askedPrice && cab.r.vendible ? t.askedPrice / cab.r.vendible : null;
  return (
    <A4 seccion="( 1 ) Growth" titulo="Datos del proyecto" proyecto={nombre} folio="G-01">
      <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 40, padding: "26px 36px", height: "100%", boxSizing: "border-box" }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 11, textTransform: "uppercase", color: ORANGE, marginBottom: 10 }}>Terreno en evaluación</div>
          <h3 style={{ fontSize: 34, fontWeight: 400, margin: "0 0 6px", letterSpacing: "-0.01em" }}>{t.name || nombre}</h3>
          <div style={{ fontFamily: MONO, fontSize: 12, textTransform: "uppercase", color: "rgba(0,0,0,.6)", marginBottom: 24 }}>
            {(t.district || "—")} · {(t.address || "dirección por definir")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22, marginBottom: 26 }}>
            <Dato k="Área de terreno" v={`${fmt(t.areaM2 || cab.s.terreno)} m²`} big />
            <Dato k="Precio pedido" v={t.askedPrice ? `$${fmt(t.askedPrice)}` : "—"} accent={ORANGE} big />
            <Dato k="Precio / m² terreno" v={precioM2Terr ? `$${fmt(precioM2Terr)}` : "—"} />
            <Dato k="Incidencia terreno / m² vendible" v={incTerr ? `$${fmt(incTerr)}` : "—"} />
            <Dato k="Estado pipeline" v={(t.status || "scouting").toUpperCase()} accent={BLUE} />
            <Dato k="Score" v={t.score ?? "—"} accent={BLUE} />
          </div>
          {t.notes && (
            <div style={{ background: PAPER, border: "1px solid rgba(0,0,0,.3)", padding: "14px 16px", fontSize: 13, lineHeight: 1.5 }}>
              <div style={{ fontFamily: MONO, fontSize: 10, textTransform: "uppercase", color: "rgba(0,0,0,.5)", marginBottom: 6 }}>Notas</div>
              {t.notes}
            </div>
          )}
        </div>
        <div style={{ background: DARK, color: BG, padding: "24px 26px", alignSelf: "stretch" }}>
          <div style={{ fontFamily: MONO, fontSize: 11, textTransform: "uppercase", color: "rgba(227,225,222,.6)", marginBottom: 14 }}>Ficha rápida · normativa asumida</div>
          {[
            ["pisos", `${cab.s.pisos}`],
            ["frente del lote", `${fmt(cab.s.frente)} m`],
            ["tipo de lote", cab.s.tipoLote],
            ["área libre 1er piso", `${cab.s.areaLibre}%`],
            ["retiro frontal", cab.s.retiros?.frontal?.on ? `${cab.s.retiros.frontal.v} m` : "no"],
            ["circulación + común", `${cab.s.circulacion}%`],
            ["área prom. por dpto", `${cab.s.areaDpto} m²`],
            ["propietario", t.owner || "—"],
            ["contacto", t.ownerContact || "—"],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px dotted rgba(227,225,222,.25)", fontSize: 13 }}>
              <span style={{ textTransform: "lowercase" }}>{k}</span>
              <span style={{ fontFamily: MONO, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </A4>
  );
}

// ── 2 · Growth: ubicación ──
export function LamUbicacion({ nombre, terreno }) {
  const t = terreno || {};
  const lat = t.lat ?? -12.115, lng = t.lng ?? -77.03;
  const srcDoc = mapaMinimalHTML({ lat, lng, nombre: t.name || nombre, mode: "lote" });
  return (
    <A4 seccion="( 1 ) Growth" titulo="Ubicación" proyecto={nombre} folio="G-02">
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 0, height: "100%" }}>
        <div style={{ borderRight: `1px solid ${INK}`, position: "relative", background: PAPER }}>
          <iframe title="mapa" srcDoc={srcDoc} style={{ width: "100%", height: "100%", border: "none" }} />
          <div style={{ position: "absolute", left: 10, bottom: 10, fontFamily: MONO, fontSize: 9, textTransform: "uppercase", background: BG, border: `1px solid ${INK}`, padding: "4px 8px" }}>
            © OpenStreetMap · Carto
          </div>
        </div>
        <div style={{ padding: "26px 30px", display: "flex", flexDirection: "column", gap: 20 }}>
          <Dato k="Distrito" v={t.district || "—"} big />
          <Dato k="Dirección" v={t.address || "—"} />
          <Dato k="Coordenadas" v={`${(+lat).toFixed(5)}, ${(+lng).toFixed(5)}`} />
          <div style={{ marginTop: "auto", background: BG, border: "1px solid rgba(0,0,0,.4)", padding: "14px 16px" }}>
            <div style={{ fontFamily: MONO, fontSize: 10, textTransform: "uppercase", color: "rgba(0,0,0,.5)", marginBottom: 8 }}>Lectura BAM del entorno</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.55 }}>
              Contexto urbano consolidado. El proyecto conversa con la vereda: primer piso permeable, balcones plantados hacia la calle, hormigón visto que envejece bien.
            </div>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10, textTransform: "uppercase", color: "rgba(0,0,0,.45)" }}>N ↑ Norte · mapa referencial</div>
        </div>
      </div>
    </A4>
  );
}

// ── 3 · Growth: análisis de cabida (áreas + unidades + gráficos) ──
export function LamAnalisis({ nombre, cab }) {
  const { s, r } = cab;
  const mixData = [
    { name: `1D · ${s.mix1}%`, value: r.d1, fill: "#D8E0F7" },
    { name: `2D · ${s.mix2}%`, value: r.d2, fill: BLUE },
    { name: `3D · ${r.mix3}%`, value: r.d3, fill: "#F7936F" },
  ].filter((x) => x.value > 0);
  const areasData = [
    { name: "vendible", v: Math.round(r.vendible), fill: ORANGE },
    { name: "no comp.", v: Math.round(r.noComp), fill: "#C9C6BF" },
    { name: "azotea", v: Math.round(r.azTech + r.azLibre), fill: BLUE },
    { name: "sótanos", v: Math.round(r.sotanos), fill: DARK },
  ];
  return (
    <A4 seccion="( 2 ) Cabida" titulo="Áreas y unidades" proyecto={nombre} folio="C-02">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 28, padding: "22px 36px", height: "100%", boxSizing: "border-box" }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 11, textTransform: "uppercase", marginBottom: 10 }}>Áreas</div>
          <Fila k="huella techada 1er piso" v={`${fmt(r.huella)} m²`} strong />
          <Fila k="área libre 1er piso" v={`${fmt(r.libre)} m²`} />
          <Fila k={`torre (huella × ${s.pisos})`} v={`${fmt(r.torre)} m²`} />
          <Fila k="azotea techada" v={`${fmt(r.azTech)} m²`} />
          <Fila k="terraza no techada" v={`${fmt(r.azLibre)} m²`} />
          <Fila k="construida sobre rasante" v={`${fmt(r.brutaSR)} m²`} strong />
          <Fila k="no computable" v={`${fmt(r.noComp)} m²`} accent={ORANGE} />
          <Fila k="área vendible" v={`${fmt(r.vendible)} m²`} strong accent={ORANGE} />
          <Fila k="eficiencia" v={`${fmt(r.eficiencia, 1)}%`} />
          <div style={{ marginTop: 18 }}>
            <BarChart width={300} height={170} data={areasData} margin={{ top: 16, right: 8, left: 8, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontFamily: MONO, fontSize: 9 }} axisLine={{ stroke: INK }} tickLine={false} />
              <YAxis hide />
              <Bar dataKey="v" isAnimationActive={false} radius={0}>
                <LabelList dataKey="v" position="top" style={{ fontFamily: MONO, fontSize: 9 }} formatter={(v) => fmt(v)} />
                {areasData.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Bar>
            </BarChart>
          </div>
        </div>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 11, textTransform: "uppercase", marginBottom: 10 }}>Unidades</div>
          <Fila k="departamentos" v={fmt(r.dptos)} strong />
          <Fila k={`1 dorm · ${s.mix1}%`} v={fmt(r.d1)} />
          <Fila k={`2 dorm · ${s.mix2}%`} v={fmt(r.d2)} />
          <Fila k={`3 dorm · ${r.mix3}%`} v={fmt(r.d3)} />
          <Fila k="estac. vendibles" v={fmt(r.estVend)} strong />
          <Fila k={`total con visitas +${s.visitas}%`} v={fmt(r.estTotal)} />
          <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
            <PieChart width={280} height={210}>
              <Pie data={mixData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={82}
                isAnimationActive={false} stroke={BG} strokeWidth={2}
                label={({ name }) => name} labelLine={false} style={{ fontFamily: MONO, fontSize: 10 }}>
                {mixData.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Pie>
            </PieChart>
          </div>
          <div style={{ textAlign: "center", fontFamily: MONO, fontSize: 11, textTransform: "uppercase", marginTop: -30 }}>{fmt(r.dptos)} dptos · mix</div>
        </div>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 11, textTransform: "uppercase", marginBottom: 10 }}>Sótanos y total</div>
          <Fila k="área requerida estac." v={`${fmt(r.areaEst)} m²`} />
          <Fila k="pisos de sótano" v={fmt(r.pisosSot)} strong />
          <Fila k="construida sótanos" v={`${fmt(r.sotanos)} m²`} />
          <Fila k="área construida total" v={`${fmt(r.construidaTotal)} m²`} strong />
          <div style={{ marginTop: 22, background: BG, border: "1px solid rgba(0,0,0,.45)", padding: "16px 18px", position: "relative" }}>
            {[[-3, -3], [null, -3], [-3, null], [null, null]].map(([l, t], i) => (
              <span key={i} style={{ position: "absolute", width: 6, height: 6, background: INK, left: l ?? undefined, right: l == null ? -3 : undefined, top: t ?? undefined, bottom: t == null ? -3 : undefined }} />
            ))}
            <div style={{ fontFamily: MONO, fontSize: 10, textTransform: "uppercase", color: "rgba(0,0,0,.5)", marginBottom: 10 }}>Parámetros del producto</div>
            <Fila k="área prom. por dpto" v={`${s.areaDpto} m²`} />
            <Fila k="est. 1 dorm / 2–3 dorm" v={`${s.est1} · ${s.est23}`} />
            <Fila k="m² por plaza" v={`${s.m2Plaza} m²`} />
            <Fila k="circulación + común" v={`${s.circulacion}%`} />
          </div>
        </div>
      </div>
    </A4>
  );
}

// ── 4 · Growth: resumen económico ──
export function LamEconomico({ nombre, cab, terreno }) {
  const { s, r } = cab;
  const t = terreno || {};
  const margenPct = r.ingresos > 0 ? r.margen / r.ingresos * 100 : 0;
  const ecoData = [
    { name: "ingresos", v: Math.round(r.ingresos), fill: BLUE },
    { name: "costo obra", v: Math.round(r.costo), fill: "#C9C6BF" },
    ...(t.askedPrice ? [{ name: "terreno", v: Math.round(t.askedPrice), fill: DARK }] : []),
    { name: "margen bruto", v: Math.round(r.margen), fill: ORANGE },
  ];
  return (
    <A4 seccion="( 2 ) Cabida" titulo="Resumen económico" proyecto={nombre} folio="C-03">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 36, padding: "26px 36px", height: "100%", boxSizing: "border-box" }}>
        <div style={{ background: DARK, color: BG, padding: "26px 28px" }}>
          <div style={{ fontFamily: MONO, fontSize: 11, textTransform: "uppercase", color: "rgba(227,225,222,.6)", marginBottom: 16 }}>Estado preliminar</div>
          {[
            ["ingresos vivienda", `$${fmt(r.ingViv)}`],
            [`azotea × ${s.factorAzotea}%`, `$${fmt(r.ingAz)}`],
            ["estacionamientos", `$${fmt(r.ingEst)}`],
            ["ingresos totales", `$${fmt(r.ingresos)}`, true],
            ["costo de construcción", `−$${fmt(r.costo)}`],
            ...(t.askedPrice ? [["terreno (precio pedido)", `−$${fmt(t.askedPrice)}`]] : []),
          ].map(([k, v, strong]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: strong ? "9px 0" : "7px 0", borderBottom: strong ? "1px solid rgba(227,225,222,.5)" : "1px dotted rgba(227,225,222,.25)", fontSize: 13, fontWeight: strong ? 700 : 400 }}>
              <span style={{ textTransform: "lowercase" }}>{k}</span>
              <span style={{ fontFamily: MONO, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
          <div style={{ marginTop: 22, borderLeft: `3px solid ${ORANGE}`, paddingLeft: 14 }}>
            <div style={{ fontFamily: MONO, fontSize: 10, color: ORANGE, textTransform: "uppercase" }}>Margen bruto (sin terreno)</div>
            <div style={{ fontFamily: MONO, fontSize: 30, fontWeight: 700 }}>${fmt(r.margen)}</div>
            <div style={{ fontFamily: MONO, fontSize: 12, color: BLUE }}>{fmt(margenPct, 1)}% sobre ingresos · incidencia obra {fmt(r.incidencia, 1)}%</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontFamily: MONO, fontSize: 11, textTransform: "uppercase", marginBottom: 8 }}>Ingresos vs costos (USD)</div>
          <BarChart width={560} height={280} data={ecoData} margin={{ top: 20, right: 12, left: 12, bottom: 4 }}>
            <XAxis dataKey="name" tick={{ fontFamily: MONO, fontSize: 10 }} axisLine={{ stroke: INK }} tickLine={false} />
            <YAxis hide />
            <Tooltip formatter={(v) => `$${fmt(v)}`} contentStyle={{ fontFamily: MONO, fontSize: 11 }} />
            <Bar dataKey="v" isAnimationActive={false}>
              <LabelList dataKey="v" position="top" style={{ fontFamily: MONO, fontSize: 10 }} formatter={(v) => `$${fmt(v / 1000)}k`} />
              {ecoData.map((e, i) => <Cell key={i} fill={e.fill} />)}
            </Bar>
          </BarChart>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 22 }}>
            <Dato k="margen por dpto" v={`$${fmt(r.dptos ? r.margen / r.dptos : 0)}`} accent={ORANGE} />
            <Dato k="m² vendible equivalente" v={`${fmt(r.vendEquiv)} m²`} />
            <Dato k="ingreso / m² construido" v={`$${fmt(r.construidaTotal ? r.ingresos / r.construidaTotal : 0)}`} />
            <Dato k="costo / m² vendible" v={`$${fmt(r.vendible ? r.costo / r.vendible : 0)}`} />
          </div>
          <p style={{ fontFamily: MONO, fontSize: 9, color: "rgba(0,0,0,.45)", marginTop: "auto", lineHeight: 1.6 }}>
            estimación preliminar de cabida · precio m² ${fmt(s.precioM2)} · costo m² ${fmt(s.costoM2)} · no incluye gastos indirectos ni financieros.
          </p>
        </div>
      </div>
    </A4>
  );
}

// ── 5 · Distribución esquemática (interactiva, hereda de cabida) ──
export function LamDistribucion({ nombre, cab }) {
  const { s, r } = cab;
  return (
    <A4 seccion="( 3 ) Volumetría" titulo="Distribución esquemática" proyecto={nombre} folio="V-01" bg={PAPER}>
      <div style={{ padding: "12px 24px", height: "100%", boxSizing: "border-box", overflow: "auto" }}>
        <EsquemaPlanta
          terreno={s.terreno} huella={r.huella} pisos={s.pisos} dptos={r.dptos}
          mix1={s.mix1} mix2={s.mix2} areaDpto={s.areaDpto} circulacion={s.circulacion}
          pisosSot={r.pisosSot} azoteaTechada={s.azoteaTechada}
          frente={s.frente} tipoLote={s.tipoLote} retiros={s.retiros}
          lotePoly={s.modoLote === "cad" ? s.lotePoly : null} cadInfo={s.modoLote === "cad" ? s.cadInfo : null}
          frenteIdxOverride={s.frenteIdx} onFrente={() => {}}
          partiIdx={s.partiIdx || 0} onParti={() => {}}
          movs={s.movs || {}} onMovs={() => {}} onFrenteReal={() => {}}
        />
      </div>
    </A4>
  );
}

// ── 6 · Masa 3D orbitable + captura para la presentación ──
export function LamMasa3D({ nombre, cab, snap, onSnap }) {
  const { s, r } = cab;
  const rf = s.retiros?.frontal?.on ? s.retiros.frontal.v : 0;
  const ri = s.retiros?.izquierda?.on ? s.retiros.izquierda.v : 0;
  const rd = s.retiros?.derecha?.on ? s.retiros.derecha.v : 0;
  const rp = s.retiros?.posterior?.on ? s.retiros.posterior.v : 0;
  const e = computeEsquema({ terreno: s.terreno, frente: s.frente, rf, ri, rd, rp, huella: r.huella, pisos: s.pisos, dptos: r.dptos, mix1: s.mix1, mix2: s.mix2, areaDpto: s.areaDpto, circulacion: s.circulacion });
  const boxRef = useRef(null);
  const capturar = () => {
    const cv = boxRef.current?.querySelector("canvas");
    if (cv) { try { onSnap(cv.toDataURL("image/png")); } catch { /* tainted */ } }
  };
  return (
    <A4 seccion="( 3 ) Volumetría" titulo="Masa 3D" proyecto={nombre} folio="V-02" bg={PAPER}>
      <div ref={boxRef} style={{ position: "absolute", inset: 0, padding: "14px 24px 14px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <span style={{ fontFamily: MONO, fontSize: 11, textTransform: "uppercase", color: "rgba(0,0,0,.5)" }}>
            {s.pisos} pisos · {r.pisosSot} sótanos · huella {fmt(r.huella)} m² — orbita con el mouse
          </span>
          <button className="mesa-noprint" onClick={capturar}
            style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center", fontFamily: MONO, fontSize: 10.5, textTransform: "uppercase", border: `1px solid ${INK}`, background: snap ? INK : "transparent", color: snap ? BG : INK, padding: "6px 12px", cursor: "pointer" }}>
            <Camera size={12} /> {snap ? "vista capturada ✓ (recapturar)" : "usar esta vista en la presentación"}
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0 }} className="mesa-3d-live">
          <Masa3DBoundary>
            <Suspense fallback={<div style={{ fontFamily: MONO, fontSize: 11, padding: 30 }}>cargando 3D…</div>}>
              <Masa3D
                e={e} frente={s.frente} pisos={s.pisos} pisosSot={r.pisosSot} azoteaTechada={s.azoteaTechada}
                retiros={s.retiros} tipoLote={s.tipoLote}
                lotePoly={s.modoLote === "cad" ? s.lotePoly : null}
                frenteIdx={s.frenteIdx ?? s.cadInfo?.frenteIdx ?? 0}
              />
            </Suspense>
          </Masa3DBoundary>
        </div>
      </div>
    </A4>
  );
}

// versión imprimible de la masa 3D (usa la captura; el WebGL no imprime confiable)
export function LamMasa3DPrint({ nombre, snap }) {
  return (
    <A4 seccion="( 3 ) Volumetría" titulo="Masa 3D" proyecto={nombre} folio="V-02" bg={PAPER}>
      {snap ? (
        <img src={snap} alt="masa 3d" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontFamily: MONO, fontSize: 12, color: "rgba(0,0,0,.45)", textTransform: "uppercase" }}>
          Sin captura 3D — en la pestaña 3D presiona “usar esta vista en la presentación”
        </div>
      )}
    </A4>
  );
}

// ── 7 · Planos: lámina del editor ──
export function LamPlanos({ nombre, editor }) {
  const tiene = editor?.rooms?.length > 0;
  let svg = null;
  if (tiene) {
    try {
      svg = laminaSVG(
        { rooms: editor.rooms, items: editor.items || [], muro: editor.muro ?? 0.15 },
        { ...(editor.ficha || {}), proyecto: editor.ficha?.proyecto || nombre }
      );
    } catch { svg = null; }
  }
  return (
    <A4 seccion="( 4 ) Planos" titulo="Planta de distribución" proyecto={nombre} folio="A-01" bg={PAPER}>
      {svg ? (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 10 }}
          dangerouslySetInnerHTML={{ __html: svg.replace("<svg ", '<svg style="max-width:100%;max-height:100%" ') }} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center", justifyContent: "center", height: "100%", fontFamily: MONO, fontSize: 12, color: "rgba(0,0,0,.45)", textTransform: "uppercase" }}>
          <span>Todavía no hay planta dibujada</span>
          <span style={{ fontSize: 10 }}>Abre el Editor de Planos, dibuja o genera la distribución, y vuelve — la lámina aparece sola</span>
        </div>
      )}
    </A4>
  );
}

// ── Estudio de mercado A · sector (KPIs + mapa minimalista + competidores) ──
export function LamMercadoSector({ nombre, terreno, cab }) {
  const m = calcMercado(terreno, cab);
  const t = terreno || {};
  const lat = t.lat ?? m.d.lat, lng = t.lng ?? m.d.lng;
  const srcDoc = mapaMinimalHTML({ lat, lng, nombre: t.name || nombre, district: m.district, mode: "sector" });
  const kpis = [
    ["Absorción sector", `${m.d.base} u/mes`, "promedio distrito"],
    ["Precio/m² rango", `$${(m.d.priceRange[0] / 1000).toFixed(1)}k–${(m.d.priceRange[1] / 1000).toFixed(1)}k`, "USD/m²"],
    ["Proyectos activos", `${m.d.oferta}`, "competidores"],
    ["Índice demanda", `${m.d.demanda}/100`, m.d.demanda >= 80 ? "alta" : "media-alta"],
    ["NSE objetivo", m.d.nse, ""],
    ["Stock disponible", `${m.d.stock} u`, "en el mercado"],
    ["m² promedio", `${m.d.m2Prom} m²`, "unidades sector"],
    ["Precio terreno", t.askedPrice ? `$${fmt(t.askedPrice / 1000)}k` : "—", "pedido propietario"],
  ];
  return (
    <A4 seccion="( 1 ) Growth · Radar" titulo={`Estudio de mercado · ${m.district}`} proyecto={nombre} folio="G-03">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.05fr", gap: 0, height: "100%" }}>
        <div style={{ padding: "18px 26px", display: "flex", flexDirection: "column", gap: 12, borderRight: `1px solid ${INK}`, minWidth: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 18px" }}>
            {kpis.map(([k, v, sub]) => (
              <div key={k} style={{ borderLeft: `3px solid ${INK}`, paddingLeft: 10 }}>
                <div style={{ fontFamily: MONO, fontSize: 9, textTransform: "uppercase", color: "rgba(0,0,0,.5)" }}>{k}</div>
                <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 600 }}>{v}</div>
                {sub && <div style={{ fontFamily: MONO, fontSize: 8.5, color: "rgba(0,0,0,.45)", textTransform: "uppercase" }}>{sub}</div>}
              </div>
            ))}
          </div>
          <div style={{ border: `1px solid ${INK}`, borderLeft: `3px solid ${ORANGE}`, padding: "10px 14px", background: PAPER }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <span style={{ fontFamily: MONO, fontSize: 9, textTransform: "uppercase", color: "rgba(0,0,0,.5)" }}>Score oportunidad · terreno + mercado</span>
              <span style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700, color: ORANGE }}>{m.blendedScore}</span>
            </div>
            <div style={{ height: 6, background: BG, border: "1px solid rgba(0,0,0,.25)" }}>
              <div style={{ height: "100%", width: `${m.blendedScore}%`, background: ORANGE }} />
            </div>
            <div style={{ fontFamily: MONO, fontSize: 9.5, marginTop: 6, color: "rgba(0,0,0,.6)" }}>{m.d.desc}</div>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
            <div style={{ fontFamily: MONO, fontSize: 10, textTransform: "uppercase", margin: "2px 0 6px" }}>Competidores · {m.competidores.length} proyectos</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: MONO, fontSize: 10 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${INK}`, textAlign: "left", textTransform: "uppercase", color: "rgba(0,0,0,.5)" }}>
                  <th style={{ padding: "4px 4px", fontWeight: 400 }}>Proyecto</th>
                  <th style={{ padding: "4px 4px", fontWeight: 400 }}>Developer</th>
                  <th style={{ padding: "4px 4px", fontWeight: 400, textAlign: "right" }}>USD/m²</th>
                  <th style={{ padding: "4px 4px", fontWeight: 400, textAlign: "right" }}>Unids</th>
                  <th style={{ padding: "4px 4px", fontWeight: 400, textAlign: "right" }}>u/mes</th>
                  <th style={{ padding: "4px 4px", fontWeight: 400 }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: "1px solid rgba(0,0,0,.2)", background: DARK, color: BG }}>
                  <td style={{ padding: "5px 4px", fontWeight: 700 }}>◆ Hygge · {nombre.length > 16 ? nombre.slice(0, 15) + "…" : nombre}</td>
                  <td style={{ padding: "5px 4px" }}>Hygge Holding</td>
                  <td style={{ padding: "5px 4px", textAlign: "right", color: BLUE }}>{fmt(m.precioM2)}</td>
                  <td style={{ padding: "5px 4px", textAlign: "right" }}>{m.units}</td>
                  <td style={{ padding: "5px 4px", textAlign: "right", color: ORANGE }}>{m.absorption.toFixed(1)}</td>
                  <td style={{ padding: "5px 4px" }}>Propuesta</td>
                </tr>
                {m.competidores.map((c) => (
                  <tr key={c.name} style={{ borderBottom: "1px solid rgba(0,0,0,.15)" }}>
                    <td style={{ padding: "5px 4px", fontWeight: 600 }}>{c.name}</td>
                    <td style={{ padding: "5px 4px", color: "rgba(0,0,0,.55)" }}>{c.dev}</td>
                    <td style={{ padding: "5px 4px", textAlign: "right" }}>{fmt(c.priceM2)}</td>
                    <td style={{ padding: "5px 4px", textAlign: "right" }}>{c.units}</td>
                    <td style={{ padding: "5px 4px", textAlign: "right" }}>{c.absorption}</td>
                    <td style={{ padding: "5px 4px", color: "rgba(0,0,0,.55)" }}>{c.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div style={{ position: "relative", background: PAPER }}>
          <iframe title="mapa sector" srcDoc={srcDoc} style={{ width: "100%", height: "100%", border: "none" }} />
          <div style={{ position: "absolute", left: 10, bottom: 10, display: "flex", gap: 10, fontFamily: MONO, fontSize: 9, textTransform: "uppercase", background: BG, border: `1px solid ${INK}`, padding: "5px 9px", alignItems: "center" }}>
            <span style={{ width: 9, height: 9, background: ORANGE, borderRadius: "50%", display: "inline-block" }} /> en alza
            <span style={{ width: 9, height: 9, background: BLUE, borderRadius: "50%", display: "inline-block" }} /> estable
            <span style={{ width: 9, height: 9, background: DARK, borderRadius: "50%", display: "inline-block" }} /> emergente
            <span style={{ color: "rgba(0,0,0,.5)" }}>· burbuja = absorción</span>
          </div>
        </div>
      </div>
    </A4>
  );
}

// ── Estudio de mercado B · posicionamiento (scatter + radar + barras + curva) ──
export function LamMercadoPosicion({ nombre, terreno, cab }) {
  const m = calcMercado(terreno, cab);
  const CH_W = 505, CH_H = 240;
  const Titulo = ({ children }) => (
    <div style={{ fontFamily: MONO, fontSize: 10, textTransform: "uppercase", marginBottom: 2 }}>{children}</div>
  );
  const tick = { fontFamily: MONO, fontSize: 9, fill: INK };
  return (
    <A4 seccion="( 1 ) Growth · Radar" titulo="Posicionamiento vs competencia" proyecto={nombre} folio="G-04">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 28px", padding: "14px 32px", height: "100%", boxSizing: "border-box" }}>
        <div>
          <Titulo>Posicionamiento · precio vs absorción</Titulo>
          <ScatterChart width={CH_W} height={CH_H} margin={{ top: 10, right: 18, bottom: 14, left: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="rgba(0,0,0,.2)" />
            <XAxis type="number" dataKey="x" domain={["dataMin - 300", "dataMax + 300"]} tick={tick} tickLine={false}
              axisLine={{ stroke: INK }} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
              label={{ value: "USD/m²", position: "insideBottom", offset: -8, style: { fontFamily: MONO, fontSize: 9 } }} />
            <YAxis type="number" dataKey="y" tick={tick} tickLine={false} axisLine={{ stroke: INK }} width={30}
              tickFormatter={(v) => `${v}u`} />
            <ZAxis type="number" dataKey="z" range={[120, 420]} />
            <ReferenceLine x={m.mid} stroke={INK} strokeDasharray="4 4"
              label={{ value: "precio medio", position: "top", style: { fontFamily: MONO, fontSize: 8.5 } }} />
            <Scatter data={m.scatter.comps} fill={BLUE} fillOpacity={0.75} isAnimationActive={false} />
            <Scatter data={m.scatter.mine} fill={ORANGE} isAnimationActive={false} />
          </ScatterChart>
        </div>
        <div>
          <Titulo>Diferenciadores · Hygge vs mercado</Titulo>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <RadarChart width={CH_W - 100} height={CH_H} data={m.radar} margin={{ top: 12, bottom: 4 }}>
              <PolarGrid stroke="rgba(0,0,0,.25)" />
              <PolarAngleAxis dataKey="axis" tick={{ fontFamily: MONO, fontSize: 8.5, fill: INK }} />
              <Radar name="Mercado" dataKey="comp" stroke={DARK} fill={DARK} fillOpacity={0.18} isAnimationActive={false} />
              <Radar name="Hygge" dataKey="hygge" stroke={ORANGE} fill={ORANGE} fillOpacity={0.30} isAnimationActive={false} />
            </RadarChart>
          </div>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", fontFamily: MONO, fontSize: 9, textTransform: "uppercase", marginTop: -6 }}>
            <span><span style={{ display: "inline-block", width: 9, height: 9, background: DARK, opacity: 0.4, marginRight: 5 }} />mercado</span>
            <span><span style={{ display: "inline-block", width: 9, height: 9, background: ORANGE, marginRight: 5 }} />hygge</span>
          </div>
        </div>
        <div>
          <Titulo>Comparativa precio/m² vs competidores</Titulo>
          <BarChart width={CH_W} height={CH_H} data={m.priceBars} layout="vertical" margin={{ top: 4, right: 40, left: 14, bottom: 0 }}>
            <XAxis type="number" tick={tick} tickLine={false} axisLine={{ stroke: INK }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <YAxis type="category" dataKey="name" width={104} tick={{ fontFamily: MONO, fontSize: 8.5, fill: INK }} tickLine={false} axisLine={{ stroke: INK }} />
            <Bar dataKey="precio" isAnimationActive={false} barSize={16}>
              <LabelList dataKey="precio" position="right" style={{ fontFamily: MONO, fontSize: 8.5 }} formatter={(v) => fmt(v)} />
              {m.priceBars.map((e, i) => <Cell key={i} fill={e.mine ? ORANGE : BLUE} />)}
            </Bar>
          </BarChart>
        </div>
        <div>
          <Titulo>Curva de absorción proyectada · {m.units} u · {m.monthsToSell} meses</Titulo>
          <AreaChart width={CH_W} height={CH_H} data={m.curve} margin={{ top: 10, right: 18, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="rgba(0,0,0,.2)" />
            <XAxis dataKey="mes" tick={tick} tickLine={false} axisLine={{ stroke: INK }} interval={3} />
            <YAxis tick={tick} tickLine={false} axisLine={{ stroke: INK }} width={30} />
            <Area type="monotone" dataKey="vendidas" stroke={ORANGE} strokeWidth={2} fill={ORANGE} fillOpacity={0.22} isAnimationActive={false} />
            <Area type="monotone" dataKey="disponibles" stroke={DARK} strokeWidth={1} strokeDasharray="4 4" fill="transparent" isAnimationActive={false} />
          </AreaChart>
          <div style={{ display: "flex", gap: 16, fontFamily: MONO, fontSize: 9, textTransform: "uppercase", marginTop: -2, paddingLeft: 34 }}>
            <span style={{ color: ORANGE }}>— vendidas acum.</span>
            <span style={{ color: "rgba(0,0,0,.55)" }}>--- disponibles</span>
            <span style={{ marginLeft: "auto" }}>absorción est. {m.absorption.toFixed(1)} u/mes · {m.pricePosition.toLowerCase()}</span>
          </div>
        </div>
      </div>
    </A4>
  );
}
