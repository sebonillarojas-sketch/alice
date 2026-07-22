import { useState, useMemo, useCallback, useEffect } from "react";
import { RefreshCw, Plus, Info, CheckCircle2, XCircle, ExternalLink, Download } from "lucide-react";
import { ALICIA_URL } from "../../lib/brain.js";
import { db } from "../../lib/supabase.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { DISTRICTS_DATA, TREND_LABEL } from "../mercado/sectorData.js";
import { calcularCuotasPorBanco, RATIO_ENDEUDAMIENTO_DEFAULT } from "./financiamiento.js";
import { resumenRetornoPorFuente, resumenListingsAuto, percentilEnRango } from "./retorno.js";
import { downloadPrintableDocument } from "../../lib/exportHtml.js";

// ─── BRAND (mismos tokens + primitivas editoriales que el resto de ALICE,
// ver HyggeOS.jsx § PRIMITIVES: NavyRule/Eyebrow/Panel/KpiBar) ──────────────
const C = {
  bg: "#EEEBE3", paper: "#F4F1EA", ink: "#0A0B0F", inkSoft: "#2E2E33",
  muted: "#6B6863", line: "#D9D5CD", lineSoft: "#E5E1D6", surface: "#E5E1D6",
  navy: "#1E2A4A", cobalt: "#3D52D5", lavender: "#A89BD9", ochre: "#C2A45A",
  brick: "#A85B5B", green: "#5F8A6A", sky: "#9BCBE3",
};

const TIPOLOGIAS = ["Flat", "Dúplex", "Penthouse", "Loft"];
const PLAZOS = [10, 15, 20, 25, 30];
const SOURCE_LABEL = { alquiler_tradicional: "Alquiler tradicional", airbnb: "Airbnb", wynwood_house: "Wynwood House" };
const SOURCE_COLOR = { alquiler_tradicional: C.cobalt, airbnb: C.brick, wynwood_house: C.ochre };

const fmtMoney = (n, cur = "PEN") => {
  if (n == null || Number.isNaN(n)) return "—";
  const symbol = cur === "USD" ? "$" : "S/";
  return `${symbol} ${Math.round(n).toLocaleString("es-PE")}`;
};
const fmtPct = (n, d = 1) => (n == null || Number.isNaN(n) ? "—" : `${(n * 100).toFixed(d)}%`);

const NavyRule = ({ width = 24 }) => <div style={{ width, height: 2, backgroundColor: C.navy }} />;

function Eyebrow({ children, color = C.muted }) {
  return <div style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color, fontWeight: 500 }}>{children}</div>;
}

function SectionHead({ title, right }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <NavyRule />
      <div style={{ marginTop: 10, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 19, color: C.ink, fontWeight: 600, letterSpacing: "-0.012em", margin: 0 }}>{title}</h2>
        {right}
      </div>
    </div>
  );
}

function Panel({ children, style }) {
  return <div style={{ background: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2, padding: "22px 24px", ...style }}>{children}</div>;
}

function Field({ label, children }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, fontWeight: 500, marginBottom: 6 }}>{label}</div>
      {children}
    </label>
  );
}

const inputStyle = {
  width: "100%", padding: "8px 10px", borderRadius: 2, border: `1px solid ${C.lineSoft}`,
  background: "#fff", fontSize: 13, color: C.ink, outline: "none", boxSizing: "border-box",
};

const ghostBtn = {
  display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 2,
  border: `1px solid ${C.lineSoft}`, background: "#fff", fontSize: 10, letterSpacing: "0.1em",
  textTransform: "uppercase", color: C.muted, cursor: "pointer", fontWeight: 500,
};
const inkBtn = {
  display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 2,
  border: "none", background: C.ink, color: C.bg, fontSize: 10, letterSpacing: "0.12em",
  textTransform: "uppercase", fontWeight: 600, cursor: "pointer",
};

// tile de una sola cifra grande, estilo KpiBar de HQDashboard
function StatTile({ label, value, valueColor, sub, borderRight }) {
  return (
    <div style={{ padding: "18px 22px", borderRight: borderRight ? `1px solid ${C.lineSoft}` : "none", flex: 1, minWidth: 140 }}>
      <Eyebrow>{label}</Eyebrow>
      <div style={{ fontSize: 30, marginTop: 8, marginBottom: 6, color: valueColor || C.ink, fontWeight: 300, letterSpacing: "-0.03em", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.muted }}>{sub}</div>}
    </div>
  );
}

export default function CotizacionView() {
  const { currentUser } = useAuth();

  // ── unidad ──
  const [district, setDistrict] = useState("Miraflores");
  const [tipologia, setTipologia] = useState("Flat");
  const [areaM2, setAreaM2] = useState(70);
  const [precioM2, setPrecioM2] = useState(null); // null = usa punto medio del rango de la zona

  // ── perfil cliente ──
  const [moneda, setMoneda] = useState("PEN");
  const [ingresoMensual, setIngresoMensual] = useState(8000);
  const [inicialPct, setInicialPct] = useState(20);
  const [plazoAnios, setPlazoAnios] = useState(20);

  // ── data real (alicia-brain: BCRP + scraper de bancos) ──
  const [macro, setMacro] = useState(null);
  const [bankRates, setBankRates] = useState([]);
  const [rentalListings, setRentalListings] = useState([]);
  const [marketTs, setMarketTs] = useState(null);
  const [loadingMarket, setLoadingMarket] = useState(true);

  const fetchMarket = useCallback(async () => {
    setLoadingMarket(true);
    try {
      const res = await fetch(`${ALICIA_URL}/api/market-data`);
      if (res.ok) {
        const json = await res.json();
        if (json.macro) setMacro(json.macro);
        if (json.bank_rates) setBankRates(json.bank_rates);
        if (json.rental_listings) setRentalListings(json.rental_listings);
        if (json.scraped_at) setMarketTs(json.scraped_at);
      }
    } catch { /* sin conexión al brain — se avisa en la UI, no se inventa data */ }
    setLoadingMarket(false);
  }, []);
  useEffect(() => { fetchMarket(); }, [fetchMarket]);

  // ── data real (Supabase: comps de alquiler cargados a mano) ──
  const [comps, setComps] = useState([]);
  const [loadingComps, setLoadingComps] = useState(true);
  const loadComps = useCallback(async () => {
    setLoadingComps(true);
    try { setComps(await db.getRentalComps()); } catch { /* tabla puede no existir aún — ver supabase/rental_comps.sql */ }
    setLoadingComps(false);
  }, []);
  useEffect(() => { loadComps(); }, [loadComps]);

  const zona = DISTRICTS_DATA[district];
  const precioM2Efectivo = precioM2 ?? (zona ? (zona.priceRange[0] + zona.priceRange[1]) / 2 : 0);
  const precioUnidad = Math.round(areaM2 * precioM2Efectivo);
  const inicialMonto = Math.round(precioUnidad * (inicialPct / 100));

  const cuotas = useMemo(() => calcularCuotasPorBanco({
    precioUnidad, inicialMonto, plazoAnios, bankRates, moneda, ingresoMensual,
  }), [precioUnidad, inicialMonto, plazoAnios, bankRates, moneda, ingresoMensual]);

  const macroTea = moneda === "USD" ? macro?.tasa_hip_usd?.value : macro?.tasa_hip_pen?.value;

  const percentil = percentilEnRango({ precioM2: precioM2Efectivo, priceRange: zona?.priceRange });
  const retorno = useMemo(() => resumenRetornoPorFuente({ comps, district, tipologia, precioUnidad }), [comps, district, tipologia, precioUnidad]);
  const wynwoodAuto = useMemo(() => resumenListingsAuto({ listings: rentalListings, district }), [rentalListings, district]);

  // ocupación es la única variable que Wynwood House no publica — se la
  // pedimos a comercial como supuesto EXPLÍCITO, nunca la asumimos nosotros.
  const [ocupacionAsumida, setOcupacionAsumida] = useState("");
  const wynwoodEstimado = useMemo(() => {
    const occ = parseFloat(ocupacionAsumida);
    if (!wynwoodAuto || !occ || !precioUnidad) return null;
    // Wynwood House cotiza en USD; si la cotización está en soles, convertimos
    // con el tipo de cambio BCRP real (macro.usd_pen) para no mezclar monedas.
    const nocheEnMoneda = moneda === "USD" || !macro?.usd_pen?.value
      ? wynwoodAuto.promedioNoche
      : wynwoodAuto.promedioNoche * macro.usd_pen.value;
    const ingresoMensual = nocheEnMoneda * (occ / 100) * 30;
    return { ingresoMensual, yieldAnual: (ingresoMensual * 12) / precioUnidad };
  }, [wynwoodAuto, ocupacionAsumida, precioUnidad, moneda, macro]);

  // ── resumen "pagos vs entradas" · cuota mensual por banco contra ingreso
  // mensual por fuente de alquiler, para ver de un vistazo si el alquiler
  // cubre la cuota ──
  const filasPagos = useMemo(() => {
    if (cuotas.length) return cuotas.map(r => ({ label: r.bank, monto: r.cuotaMensual, nota: `${r.tea.toFixed(2)}% TEA` }));
    if (macroTea != null) {
      const preview = cuotaFrancesaPreview(precioUnidad - inicialMonto, macroTea, plazoAnios);
      return preview != null ? [{ label: "Promedio de mercado (BCRP)", monto: preview, nota: `${macroTea.toFixed(2)}% TEA · sin tasas por banco aún` }] : [];
    }
    return [];
  }, [cuotas, macroTea, precioUnidad, inicialMonto, plazoAnios]);

  const filasEntradas = useMemo(() => {
    const rows = [];
    if (retorno.alquiler_tradicional) rows.push({ label: "Alquiler tradicional", monto: retorno.alquiler_tradicional.promedioMensual, nota: `${retorno.alquiler_tradicional.muestras} comparable(s)` });
    if (retorno.airbnb) rows.push({ label: "Airbnb", monto: retorno.airbnb.promedioMensual, nota: `${retorno.airbnb.muestras} comparable(s)` });
    if (retorno.wynwood_house) rows.push({ label: "Wynwood House (manual)", monto: retorno.wynwood_house.promedioMensual, nota: `${retorno.wynwood_house.muestras} comparable(s)` });
    if (wynwoodEstimado) rows.push({ label: "Wynwood House (auto, estimado)", monto: wynwoodEstimado.ingresoMensual, nota: `${ocupacionAsumida}% ocupación asumida` });
    return rows;
  }, [retorno, wynwoodEstimado, ocupacionAsumida]);

  const mejorPago = filasPagos.length ? Math.min(...filasPagos.map(f => f.monto)) : null;
  const mejorEntrada = filasEntradas.length ? Math.max(...filasEntradas.map(f => f.monto)) : null;
  const cobertura = mejorPago && mejorEntrada != null ? mejorEntrada / mejorPago : null;

  // ── quick-add de comparable real ──
  const [addingSource, setAddingSource] = useState(null);
  const [compForm, setCompForm] = useState({ monthlyRent: "", dailyRate: "", occupancyPct: "", url: "" });
  const saveComp = useCallback(async (source) => {
    const row = {
      id: `rc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      district, tipologia, source, currency: moneda,
      monthlyRent: source === "alquiler_tradicional" ? parseFloat(compForm.monthlyRent) || null : null,
      dailyRate: source !== "alquiler_tradicional" ? parseFloat(compForm.dailyRate) || null : null,
      occupancyPct: source !== "alquiler_tradicional" ? parseFloat(compForm.occupancyPct) || null : null,
      url: compForm.url || null,
      enteredBy: currentUser?.id || null,
    };
    try {
      await db.upsertRentalComp(row);
      await loadComps();
      setAddingSource(null);
      setCompForm({ monthlyRent: "", dailyRate: "", occupancyPct: "", url: "" });
    } catch (e) {
      alert(`No se pudo guardar el comparable — ¿corriste supabase/rental_comps.sql? (${e.message})`);
    }
  }, [district, tipologia, moneda, compForm, currentUser, loadComps]);

  const handleExport = useCallback(() => {
    const cuotasRows = cuotas.length
      ? cuotas.map(r => `<tr>
          <td>${r.bank}</td><td>${r.tea.toFixed(2)}%</td>
          <td style="text-align:right; font-weight:700;">${fmtMoney(r.cuotaMensual, moneda)}</td>
          <td style="text-align:right;">${fmtMoney(r.totalIntereses, moneda)}</td>
          <td style="text-align:right; color:${r.apta === false ? "#A85B5B" : "#0A0B0F"};">${fmtPct(r.ratio)}</td>
        </tr>`).join("")
      : `<tr><td colspan="5" style="color:#6B6863;">Sin tasas por banco disponibles al momento de exportar${macroTea != null ? ` — referencia con tasa promedio BCRP (${macroTea.toFixed(2)}% TEA): ${fmtMoney(cuotaFrancesaPreview(precioUnidad - inicialMonto, macroTea, plazoAnios), moneda)}/mes` : ""}.</td></tr>`;

    const retornoCards = ["alquiler_tradicional", "airbnb", "wynwood_house"].map(source => {
      if (source === "wynwood_house" && wynwoodAuto) {
        const listingsHtml = wynwoodAuto.listings.map(l => `<div style="font-size:11px;"><a href="${l.url}">${l.title}</a></div>`).join("");
        const estimadoHtml = wynwoodEstimado
          ? `<div style="font-size:12px; margin-top:6px;">≈ ${fmtMoney(wynwoodEstimado.ingresoMensual, moneda)}/mes · yield ${fmtPct(wynwoodEstimado.yieldAnual)}<br><span style="font-size:10px; color:#6B6863;">estimado con ${ocupacionAsumida}% de ocupación asumida, no observada</span></div>`
          : "";
        return `<div class="card" style="margin-bottom:10px;">
          <div style="font-size:10px; font-weight:700; text-transform:uppercase; color:#C2A45A;">Wynwood House · auto</div>
          <div style="font-size:16px; font-weight:700; margin-top:4px;">${fmtMoney(wynwoodAuto.promedioNoche, wynwoodAuto.currency)}/noche</div>
          <div style="font-size:10px; color:#6B6863;">${wynwoodAuto.muestras} anuncio(s) en ${district} · scraper propio</div>
          <div style="margin-top:6px;">${listingsHtml}</div>
          ${estimadoHtml}
        </div>`;
      }
      const r = retorno[source];
      return `<div class="card" style="margin-bottom:10px;">
        <div style="font-size:10px; font-weight:700; text-transform:uppercase; color:${SOURCE_COLOR[source]};">${SOURCE_LABEL[source]}</div>
        ${r
          ? `<div style="font-size:16px; font-weight:700; margin-top:4px;">${fmtMoney(r.promedioMensual, moneda)}/mes</div>
             <div style="font-size:12px; color:#6B6863;">yield anual ${fmtPct(r.yieldAnual)} · ${r.muestras} comparable(s) cargado(s)</div>`
          : `<div style="font-size:12px; color:#6B6863; margin-top:4px;">Sin comparables cargados para ${district} · ${tipologia}</div>`}
      </div>`;
    }).join("");

    const bodyHtml = `
      <div class="card">
        <div class="eyebrow">Unidad</div>
        <table>
          <tr><td>Zona</td><td>${district}</td></tr>
          <tr><td>Tipología</td><td>${tipologia}</td></tr>
          <tr><td>Área</td><td>${areaM2} m²</td></tr>
          <tr><td>Precio / m²</td><td>${fmtMoney(precioM2Efectivo, moneda)}</td></tr>
          <tr><td style="font-weight:700;">Precio total</td><td style="font-weight:700;">${fmtMoney(precioUnidad, moneda)}</td></tr>
        </table>
      </div>
      <div class="card">
        <div class="eyebrow">Perfil del cliente</div>
        <table>
          <tr><td>Moneda</td><td>${moneda}</td></tr>
          <tr><td>Ingreso mensual promedio</td><td>${fmtMoney(ingresoMensual, moneda)}</td></tr>
          <tr><td>Inicial</td><td>${inicialPct}% · ${fmtMoney(inicialMonto, moneda)}</td></tr>
          <tr><td>Plazo</td><td>${plazoAnios} años</td></tr>
        </table>
      </div>
      <div class="card">
        <div class="eyebrow">Pagos vs entradas · resumen mensual${cobertura != null ? ` · cobertura ${fmtPct(cobertura, 0)}` : ""}</div>
        <table>
          <thead><tr><th></th><th>Concepto</th><th style="text-align:right;">Monto/mes</th><th>Detalle</th></tr></thead>
          <tbody>
            <tr><td colspan="4" style="font-size:10px; font-weight:700; text-transform:uppercase; color:#A85B5B;">Pagos (cuota)</td></tr>
            ${filasPagos.length ? filasPagos.map(f => `<tr><td>−</td><td>${f.label}</td><td style="text-align:right; font-weight:700;">${fmtMoney(f.monto, moneda)}</td><td style="font-size:11px; color:#6B6863;">${f.nota}</td></tr>`).join("") : `<tr><td colspan="4" style="color:#6B6863;">Sin datos</td></tr>`}
            <tr><td colspan="4" style="font-size:10px; font-weight:700; text-transform:uppercase; color:#5F8A6A; padding-top:8px;">Entradas (alquiler)</td></tr>
            ${filasEntradas.length ? filasEntradas.map(f => `<tr><td>+</td><td>${f.label}</td><td style="text-align:right; font-weight:700;">${fmtMoney(f.monto, moneda)}</td><td style="font-size:11px; color:#6B6863;">${f.nota}</td></tr>`).join("") : `<tr><td colspan="4" style="color:#6B6863;">Sin comparables cargados para ${district} · ${tipologia}</td></tr>`}
          </tbody>
        </table>
      </div>
      <div class="card">
        <div class="eyebrow">Cuotas por banco · tasas reales (BCRP + scraper)</div>
        <table>
          <thead><tr><th>Banco</th><th>TEA</th><th style="text-align:right;">Cuota/mes</th><th style="text-align:right;">Total intereses</th><th style="text-align:right;">% ingreso</th></tr></thead>
          <tbody>${cuotasRows}</tbody>
        </table>
        <div style="font-size:10px; color:#6B6863; margin-top:8px;">Regla de capacidad de endeudamiento: cuota ≤ ${Math.round(RATIO_ENDEUDAMIENTO_DEFAULT * 100)}% del ingreso mensual declarado.</div>
      </div>
      <div class="card">
        <div class="eyebrow">Plusvalía</div>
        ${zona ? `<table>
          <tr><td>Tendencia de la zona (relevamiento manual)</td><td>${TREND_LABEL[zona.trend]}</td></tr>
          <tr><td>Posición del precio en el rango de mercado</td><td>${percentil == null ? "—" : `percentil ${Math.round(percentil)}`}</td></tr>
          <tr><td>NSE / demanda relevada</td><td>${zona.nse} · demanda ${zona.demanda}/100</td></tr>
        </table>` : ""}
        <div style="font-size:10px; color:#6B6863; margin-top:8px;">No se proyecta % de apreciación anual — es una lectura de posicionamiento relativo, no una promesa de retorno.</div>
      </div>
      <div class="eyebrow" style="margin-top:8px;">Retorno de alquiler · zona y tipología</div>
      ${retornoCards}
    `;

    downloadPrintableDocument({
      title: `Cotización ${district} · ${tipologia} · ${areaM2}m²`,
      subtitle: "Cotización comercial",
      bodyHtml,
    });
  }, [cuotas, moneda, macroTea, precioUnidad, inicialMonto, plazoAnios, retorno, wynwoodAuto, wynwoodEstimado, ocupacionAsumida, district, tipologia, areaM2, precioM2Efectivo, ingresoMensual, inicialPct, zona, percentil, filasPagos, filasEntradas, cobertura]);

  return (
    <div style={{ background: C.bg, minHeight: "100%", padding: "40px 44px", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}>
      {/* ── HERO ── */}
      <div style={{ marginBottom: 40, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
        <div>
          <NavyRule width={28} />
          <div style={{ marginTop: 12 }}><Eyebrow>Comercial · Cotización</Eyebrow></div>
          <h1 style={{ fontSize: 40, lineHeight: 1, marginTop: 14, color: C.ink, fontWeight: 300, letterSpacing: "-0.03em" }}>
            Cuotas, plusvalía<br />y retorno
          </h1>
          <p style={{ fontSize: 14, marginTop: 14, maxWidth: 520, color: C.inkSoft, lineHeight: 1.6 }}>
            Cotización para <strong style={{ fontWeight: 600 }}>{district}</strong> · {tipologia} de {areaM2}m² — cuota comparada entre bancos con tasas reales, más el retorno de alquiler de la zona.
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          {marketTs && <div style={{ fontSize: 10, color: C.muted, marginBottom: 8 }}>tasas actualizadas · {new Date(marketTs).toLocaleDateString("es-PE")}</div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={fetchMarket} disabled={loadingMarket} style={ghostBtn}>
              <RefreshCw size={10} className={loadingMarket ? "animate-spin" : ""} /> {loadingMarket ? "actualizando…" : "refrescar tasas"}
            </button>
            <button onClick={handleExport} style={inkBtn}>
              <Download size={10} /> exportar cotización
            </button>
          </div>
        </div>
      </div>

      {/* ── PAGOS VS ENTRADAS · KPI strip + detalle ── */}
      <section style={{ marginBottom: 36 }}>
        <SectionHead title="Pagos vs entradas" right={cobertura != null && (
          <span style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600, color: cobertura >= 1 ? C.green : C.brick }}>
            {cobertura >= 1 ? "↗" : "↘"} cobertura {fmtPct(cobertura, 0)}
          </span>
        )} />
        <Panel style={{ padding: 0 }}>
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            <StatTile label="Mejor cuota" value={mejorPago != null ? fmtMoney(mejorPago, moneda) : "—"} sub={filasPagos[0] && "/mes"} borderRight />
            <StatTile label="Mejor entrada" value={mejorEntrada != null ? fmtMoney(mejorEntrada, moneda) : "—"} sub={filasEntradas[0] && "/mes"} borderRight />
            <StatTile label="Cobertura" value={cobertura != null ? fmtPct(cobertura, 0) : "—"} valueColor={cobertura != null ? (cobertura >= 1 ? C.green : C.brick) : C.ink} sub="entrada ÷ cuota" />
          </div>
          <div style={{ borderTop: `1px solid ${C.lineSoft}`, padding: "18px 24px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <tbody>
                <tr><td colSpan={4} style={{ padding: "0 0 8px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.14em", color: C.brick }}>Pagos (cuota)</td></tr>
                {filasPagos.length ? filasPagos.map(f => (
                  <tr key={f.label} style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
                    <td style={{ padding: "7px 8px 7px 0", width: 18 }}><XCircle size={12} color={C.brick} /></td>
                    <td style={{ padding: "7px 8px", fontWeight: 500, color: C.ink }}>{f.label}</td>
                    <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 600, color: C.ink }}>{fmtMoney(f.monto, moneda)}</td>
                    <td style={{ padding: "7px 8px", color: C.muted, fontSize: 11 }}>{f.nota}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} style={{ padding: "7px 0", color: C.muted, fontSize: 11 }}>Sin datos todavía — completá precio de la unidad e ingreso del cliente.</td></tr>
                )}
                <tr><td colSpan={4} style={{ padding: "12px 0 8px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.14em", color: C.green }}>Entradas (alquiler)</td></tr>
                {filasEntradas.length ? filasEntradas.map(f => (
                  <tr key={f.label} style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
                    <td style={{ padding: "7px 8px 7px 0" }}><CheckCircle2 size={12} color={C.green} /></td>
                    <td style={{ padding: "7px 8px", fontWeight: 500, color: C.ink }}>{f.label}</td>
                    <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 600, color: C.ink }}>{fmtMoney(f.monto, moneda)}</td>
                    <td style={{ padding: "7px 8px", color: C.muted, fontSize: 11 }}>{f.nota}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} style={{ padding: "7px 0", color: C.muted, fontSize: 11 }}>Sin comparables de alquiler cargados todavía para {district} · {tipologia} (ver Retorno más abajo).</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "0 24px 18px", fontSize: 10, color: C.muted, display: "flex", gap: 6 }}>
            <Info size={12} style={{ flexShrink: 0, marginTop: 1 }} />
            Cobertura = mejor entrada mensual disponible ÷ mejor cuota disponible. No es un neto contable (no descuenta mantenimiento, IGV, vacancia).
          </div>
        </Panel>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 32, alignItems: "start" }}>
        {/* ── COLUMNA IZQUIERDA: inputs ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div>
            <SectionHead title="Unidad" />
            <Panel>
              <Field label="Zona">
                <select value={district} onChange={e => setDistrict(e.target.value)} style={inputStyle}>
                  {Object.keys(DISTRICTS_DATA).map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
              <Field label="Tipología">
                <select value={tipologia} onChange={e => setTipologia(e.target.value)} style={inputStyle}>
                  {TIPOLOGIAS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Área (m²)">
                <input type="number" value={areaM2} onChange={e => setAreaM2(parseFloat(e.target.value) || 0)} style={inputStyle} />
              </Field>
              <Field label={`Precio / m² · rango zona S/ ${zona?.priceRange[0]}–${zona?.priceRange[1]}`}>
                <input type="number" placeholder={String(Math.round(precioM2Efectivo))} value={precioM2 ?? ""} onChange={e => setPrecioM2(e.target.value ? parseFloat(e.target.value) : null)} style={inputStyle} />
              </Field>
              <div style={{ marginTop: 12, paddingTop: 14, borderTop: `1px solid ${C.lineSoft}` }}>
                <Eyebrow>Precio total</Eyebrow>
                <div style={{ fontSize: 26, marginTop: 6, color: C.ink, fontWeight: 300, letterSpacing: "-0.02em" }}>{fmtMoney(precioUnidad, moneda)}</div>
              </div>
            </Panel>
          </div>

          <div>
            <SectionHead title="Perfil del cliente" />
            <Panel>
              <Field label="Moneda">
                <select value={moneda} onChange={e => setMoneda(e.target.value)} style={inputStyle}>
                  <option value="PEN">Soles (PEN)</option>
                  <option value="USD">Dólares (USD)</option>
                </select>
              </Field>
              <Field label="Ingreso mensual promedio">
                <input type="number" value={ingresoMensual} onChange={e => setIngresoMensual(parseFloat(e.target.value) || 0)} style={inputStyle} />
              </Field>
              <Field label={`Inicial · ${inicialPct}% = ${fmtMoney(inicialMonto, moneda)}`}>
                <input type="range" min={5} max={50} step={1} value={inicialPct} onChange={e => setInicialPct(parseFloat(e.target.value))} style={{ width: "100%", accentColor: C.navy }} />
              </Field>
              <Field label="Plazo (años)">
                <select value={plazoAnios} onChange={e => setPlazoAnios(parseFloat(e.target.value))} style={inputStyle}>
                  {PLAZOS.map(p => <option key={p} value={p}>{p} años</option>)}
                </select>
              </Field>
            </Panel>
          </div>
        </div>

        {/* ── COLUMNA DERECHA: resultados ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {/* CUOTAS POR BANCO */}
          <div>
            <SectionHead title="Cuotas por banco · tasas reales" right={macroTea != null && (
              <span style={{ fontSize: 11, color: C.muted }}>
                promedio banca {macro?.[moneda === "USD" ? "tasa_hip_usd" : "tasa_hip_pen"]?.period}: <strong style={{ color: C.ink, fontWeight: 600 }}>{macroTea.toFixed(2)}%</strong> TEA
              </span>
            )} />
            <Panel>
              {loadingMarket ? (
                <div style={{ fontSize: 12, color: C.muted }}>Cargando tasas…</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  {cuotas.length === 0 && (
                    <div style={{ fontSize: 11, color: C.muted, display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 14 }}>
                      <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                      Todavía no hay tasas cargadas por banco individual (falta correr el scraper de bank_rates) — mientras tanto se muestra la fila de referencia con la tasa promedio de mercado (BCRP).
                    </div>
                  )}
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${C.lineSoft}`, color: C.muted, textAlign: "left" }}>
                        <th style={{ padding: "0 8px 10px 0", fontWeight: 500, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" }}>Banco</th>
                        <th style={{ padding: "0 8px 10px", fontWeight: 500, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" }}>TEA</th>
                        <th style={{ padding: "0 8px 10px", fontWeight: 500, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", textAlign: "right" }}>Cuota/mes</th>
                        <th style={{ padding: "0 8px 10px", fontWeight: 500, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", textAlign: "right" }}>Total intereses</th>
                        <th style={{ padding: "0 8px 10px", fontWeight: 500, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", textAlign: "right" }}>% ingreso</th>
                        <th style={{ padding: "0 0 10px 8px", fontWeight: 500 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {cuotas.length > 0 ? cuotas.map(r => (
                        <tr key={r.bank} style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
                          <td style={{ padding: "9px 8px 9px 0", fontWeight: 600, color: C.ink }}>{r.bank}</td>
                          <td style={{ padding: "9px 8px", color: C.muted }}>{r.tea.toFixed(2)}%</td>
                          <td style={{ padding: "9px 8px", textAlign: "right", fontWeight: 700, color: C.ink }}>{fmtMoney(r.cuotaMensual, moneda)}</td>
                          <td style={{ padding: "9px 8px", textAlign: "right", color: C.muted }}>{fmtMoney(r.totalIntereses, moneda)}</td>
                          <td style={{ padding: "9px 8px", textAlign: "right", color: r.apta === false ? C.brick : C.ink }}>{fmtPct(r.ratio)}</td>
                          <td style={{ padding: "9px 0 9px 8px" }}>
                            {r.apta === true && <CheckCircle2 size={13} color={C.green} />}
                            {r.apta === false && <XCircle size={13} color={C.brick} />}
                          </td>
                        </tr>
                      )) : macroTea != null && (() => {
                        const preview = cuotaFrancesaPreview(precioUnidad - inicialMonto, macroTea, plazoAnios);
                        const capacidad = ingresoMensual && preview ? preview / ingresoMensual : null;
                        return (
                          <tr style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
                            <td style={{ padding: "9px 8px 9px 0", fontWeight: 600, color: C.ink }}>Promedio de mercado (BCRP)</td>
                            <td style={{ padding: "9px 8px", color: C.muted }}>{macroTea.toFixed(2)}%</td>
                            <td style={{ padding: "9px 8px", textAlign: "right", fontWeight: 700, color: C.ink }}>{fmtMoney(preview, moneda)}</td>
                            <td style={{ padding: "9px 8px", textAlign: "right", color: C.muted }}>—</td>
                            <td style={{ padding: "9px 8px", textAlign: "right", color: capacidad != null && capacidad > RATIO_ENDEUDAMIENTO_DEFAULT ? C.brick : C.ink }}>{capacidad != null ? fmtPct(capacidad) : "—"}</td>
                            <td style={{ padding: "9px 0 9px 8px" }}></td>
                          </tr>
                        );
                      })()}
                    </tbody>
                  </table>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 12 }}>
                    Regla de capacidad de endeudamiento: cuota ≤ {Math.round(RATIO_ENDEUDAMIENTO_DEFAULT * 100)}% del ingreso mensual declarado.
                  </div>
                </div>
              )}
            </Panel>
          </div>

          {/* PLUSVALÍA */}
          <div>
            <SectionHead title="Plusvalía" />
            <Panel>
              {zona ? (
                <div style={{ display: "flex", gap: 0, flexWrap: "wrap" }}>
                  <div style={{ paddingRight: 28, borderRight: `1px solid ${C.lineSoft}`, marginRight: 28 }}>
                    <Eyebrow>Tendencia de la zona</Eyebrow>
                    <div style={{ fontSize: 22, marginTop: 6, color: C.ink, fontWeight: 300, letterSpacing: "-0.02em" }}>{TREND_LABEL[zona.trend]}</div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>relevamiento manual</div>
                  </div>
                  <div style={{ paddingRight: 28, borderRight: `1px solid ${C.lineSoft}`, marginRight: 28 }}>
                    <Eyebrow>Posición en el rango de mercado</Eyebrow>
                    <div style={{ fontSize: 22, marginTop: 6, color: C.ink, fontWeight: 300, letterSpacing: "-0.02em" }}>{percentil == null ? "—" : `p${Math.round(percentil)}`}</div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{percentil != null && (percentil < 33 ? "por debajo del promedio" : percentil > 66 ? "por encima del promedio" : "en línea con el promedio")}</div>
                  </div>
                  <div>
                    <Eyebrow>NSE / demanda relevada</Eyebrow>
                    <div style={{ fontSize: 22, marginTop: 6, color: C.ink, fontWeight: 300, letterSpacing: "-0.02em" }}>{zona.nse}</div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>demanda {zona.demanda}/100</div>
                  </div>
                </div>
              ) : <div style={{ fontSize: 12, color: C.muted }}>Elegí una zona.</div>}
              <div style={{ fontSize: 10, color: C.muted, marginTop: 18, display: "flex", gap: 6 }}>
                <Info size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                No proyectamos % de apreciación anual — no hay series históricas de precio confiables por zona todavía. Esto es una lectura de posicionamiento relativo, no una promesa de retorno.
              </div>
            </Panel>
          </div>

          {/* RETORNO */}
          <div>
            <SectionHead title="Retorno de alquiler · zona y tipología" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {["alquiler_tradicional", "airbnb", "wynwood_house"].map(source => {
                const r = retorno[source];
                return (
                  <div key={source} style={{ background: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2, padding: "18px 18px 16px" }}>
                    <div style={{ width: 16, height: 2, backgroundColor: SOURCE_COLOR[source], marginBottom: 12 }} />
                    <Eyebrow color={SOURCE_COLOR[source]}>
                      {SOURCE_LABEL[source]}
                      {source === "wynwood_house" && wynwoodAuto && <span style={{ color: C.muted, fontWeight: 400 }}> · auto</span>}
                    </Eyebrow>

                    {source === "wynwood_house" && wynwoodAuto ? (
                      <>
                        <div style={{ fontSize: 24, fontWeight: 300, color: C.ink, marginTop: 8, letterSpacing: "-0.02em" }}>
                          {fmtMoney(wynwoodAuto.promedioNoche, wynwoodAuto.currency)}<span style={{ fontSize: 11, fontWeight: 500, color: C.muted }}>/noche</span>
                        </div>
                        <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{wynwoodAuto.muestras} anuncio{wynwoodAuto.muestras > 1 ? "s" : ""} en {district} · scrapeado c/6h</div>
                        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                          {wynwoodAuto.listings.map(l => (
                            <a key={l.external_code} href={l.url} target="_blank" rel="noreferrer"
                              style={{ fontSize: 10, color: C.cobalt, textDecoration: "none", display: "flex", alignItems: "center", gap: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              <ExternalLink size={9} style={{ flexShrink: 0 }} /> {l.title}
                            </a>
                          ))}
                        </div>
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.lineSoft}` }}>
                          <div style={{ fontSize: 10, color: C.muted, marginBottom: 6 }}>ocupación asumida % (no la publican)</div>
                          <input type="number" placeholder="ej. 70" value={ocupacionAsumida} onChange={e => setOcupacionAsumida(e.target.value)}
                            style={{ ...inputStyle, fontSize: 11, padding: "5px 8px", width: 74 }} />
                          {wynwoodEstimado && (
                            <div style={{ marginTop: 6, fontSize: 11, color: C.ink }}>
                              ≈ {fmtMoney(wynwoodEstimado.ingresoMensual, moneda)}/mes · yield {fmtPct(wynwoodEstimado.yieldAnual)}
                              <span style={{ fontSize: 9, color: C.muted, display: "block", marginTop: 2 }}>estimado, no observado</span>
                            </div>
                          )}
                        </div>
                      </>
                    ) : r ? (
                      <>
                        <div style={{ fontSize: 24, fontWeight: 300, color: C.ink, marginTop: 8, letterSpacing: "-0.02em" }}>{fmtMoney(r.promedioMensual, moneda)}<span style={{ fontSize: 11, fontWeight: 500, color: C.muted }}>/mes</span></div>
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>yield anual {fmtPct(r.yieldAnual)}</div>
                        <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{r.muestras} comparable{r.muestras > 1 ? "s" : ""} cargado{r.muestras > 1 ? "s" : ""}</div>
                      </>
                    ) : (
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 10 }}>Sin comparables cargados para {district} · {tipologia}</div>
                    )}
                    {addingSource === source ? (
                      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                        {source === "alquiler_tradicional" ? (
                          <input placeholder="alquiler mensual" type="number" value={compForm.monthlyRent} onChange={e => setCompForm(f => ({ ...f, monthlyRent: e.target.value }))} style={{ ...inputStyle, fontSize: 11, padding: "6px 8px" }} />
                        ) : (
                          <>
                            <input placeholder="tarifa por noche" type="number" value={compForm.dailyRate} onChange={e => setCompForm(f => ({ ...f, dailyRate: e.target.value }))} style={{ ...inputStyle, fontSize: 11, padding: "6px 8px" }} />
                            <input placeholder="ocupación % observada" type="number" value={compForm.occupancyPct} onChange={e => setCompForm(f => ({ ...f, occupancyPct: e.target.value }))} style={{ ...inputStyle, fontSize: 11, padding: "6px 8px" }} />
                          </>
                        )}
                        <input placeholder="link del listing (opcional)" value={compForm.url} onChange={e => setCompForm(f => ({ ...f, url: e.target.value }))} style={{ ...inputStyle, fontSize: 11, padding: "6px 8px" }} />
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => saveComp(source)} style={{ ...inkBtn, flex: 1, justifyContent: "center", padding: "6px 0" }}>Guardar</button>
                          <button onClick={() => setAddingSource(null)} style={{ ...ghostBtn, padding: "6px 10px" }}>×</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setAddingSource(source)}
                        style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 4, fontSize: 10, letterSpacing: "0.06em", color: C.cobalt, background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 500 }}>
                        <Plus size={11} /> agregar comparable real
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 14, display: "flex", gap: 6 }}>
              <Info size={12} style={{ flexShrink: 0, marginTop: 1 }} />
              Wynwood House se trae solo (scraper propio cada 6h, sin ocupación porque no la publican). Alquiler tradicional y Airbnb se cargan a mano por comercial a partir de listings reales vistos — Airbnb no se scrapea automáticamente (Akamai Bot Manager bloquea el acceso automatizado a sus búsquedas). {loadingComps && "Cargando comparables guardados…"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// preview rápido con la tasa promedio BCRP cuando no hay bank_rates todavía —
// misma fórmula que financiamiento.js, inline para no crear un ciclo de import.
function cuotaFrancesaPreview(montoFinanciar, teaPercent, plazoAnios) {
  if (!montoFinanciar || !teaPercent || !plazoAnios) return null;
  const i = Math.pow(1 + teaPercent / 100, 1 / 12) - 1;
  const n = Math.round(plazoAnios * 12);
  const factor = Math.pow(1 + i, n);
  return montoFinanciar * (i * factor) / (factor - 1);
}
