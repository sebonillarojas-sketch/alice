import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import EsquemaPlanta from "./EsquemaPlanta.jsx";
import { importCAD } from "./cad.js";
import ProyectoTabs from "./ProyectoTabs.jsx";
import { useProyectos } from "./proyectos.js";

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

const fmt = (n, d = 0) =>
  n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

function Card({ n, title, children, style }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 2, padding: "20px 22px", ...style }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 16 }}>
        <span style={{ fontFamily: mono, fontSize: 10, color: C.orange }}>{n}</span>
        <h2 style={{ fontFamily: sans, fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", textTransform: "lowercase", color: C.ink, margin: 0 }}>
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

function Num({ label, value, onChange, unit, step = 1, accent, disabled, hint }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "9px 0", opacity: disabled ? 0.55 : 1 }}>
      <label style={{ fontFamily: sans, fontSize: 12.5, color: C.ink, textTransform: "lowercase", flex: 1, lineHeight: 1.3 }}>
        {label}{disabled && hint ? <span style={{ fontFamily: mono, fontSize: 9, color: C.peri }}> · {hint}</span> : null}
      </label>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexShrink: 0 }}>
        <input
          type="number" value={value} step={step} min={0} disabled={disabled}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          style={{
            fontFamily: mono, fontSize: 14, fontWeight: 600, color: disabled ? C.peri : (accent || C.ink),
            width: 86, textAlign: "right", border: `1px solid ${C.line}`, borderRadius: 2,
            background: C.paper, outline: "none", padding: "5px 8px",
          }}
        />
        <span style={{ fontFamily: mono, fontSize: 10, color: C.soft, width: 30 }}>{unit}</span>
      </div>
    </div>
  );
}

// fila de retiro: switch + valor (el valor solo cuenta si está activo)
function RetiroRow({ label, ret, onChange, disabled, hint }) {
  const off = disabled || !ret.on;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", opacity: disabled ? 0.45 : 1 }}>
      <button onClick={() => !disabled && onChange({ ...ret, on: !ret.on })} title={hint}
        style={{ width: 30, height: 16, borderRadius: 9, border: `1px solid ${ret.on && !disabled ? C.ink : C.line}`,
          background: ret.on && !disabled ? C.ink : C.paper, position: "relative", cursor: disabled ? "not-allowed" : "pointer", flexShrink: 0, padding: 0 }}>
        <span style={{ position: "absolute", top: 1.5, left: ret.on && !disabled ? 15 : 2, width: 11, height: 11, borderRadius: "50%", background: ret.on && !disabled ? C.card : C.soft, transition: "left .12s" }} />
      </button>
      <label style={{ fontFamily: sans, fontSize: 12, color: off ? C.soft : C.ink, textTransform: "lowercase", flex: 1 }} title={hint}>
        {label}
      </label>
      <input type="number" value={ret.v} step={0.5} min={0} disabled={off}
        onChange={(e) => onChange({ ...ret, v: parseFloat(e.target.value) || 0 })}
        style={{ fontFamily: mono, fontSize: 13, fontWeight: 600, color: off ? C.soft : C.ink, width: 62, textAlign: "right",
          border: `1px solid ${C.line}`, borderRadius: 2, background: C.paper, outline: "none", padding: "4px 6px" }} />
      <span style={{ fontFamily: mono, fontSize: 10, color: C.soft, width: 14 }}>m</span>
    </div>
  );
}

function Pct({ label, value, onChange, max = 100, accent }) {
  return (
    <div style={{ padding: "9px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
        <label style={{ fontFamily: sans, fontSize: 12.5, color: C.ink, textTransform: "lowercase", lineHeight: 1.3 }}>{label}</label>
        <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 600, color: accent || C.ink }}>{value}%</span>
      </div>
      <input
        type="range" min={0} max={max} step={1} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: accent || C.ink, height: 3, cursor: "pointer" }}
      />
    </div>
  );
}

function Row({ k, v, unit, strong, accent, indent, dark }) {
  const label = dark ? "#b8b6b0" : C.soft;
  const val = dark ? "#EFEDE8" : C.ink;
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12,
      padding: strong ? "10px 0" : "7px 0",
      borderBottom: strong ? `1px solid ${dark ? "#55534e" : C.ink}` : `1px dotted ${dark ? "#55534e" : C.line}`,
      paddingLeft: indent ? 16 : 0,
    }}>
      <span style={{ fontFamily: sans, fontSize: strong ? 12.5 : 12, fontWeight: strong ? 700 : 400, color: strong ? (dark ? "#EFEDE8" : C.ink) : label, textTransform: "lowercase" }}>
        {k}
      </span>
      <span style={{ fontFamily: mono, fontSize: strong ? 15 : 13, fontWeight: strong ? 700 : 500, color: accent || val, whiteSpace: "nowrap" }}>
        {v} <span style={{ fontSize: 10, color: dark ? "#8a8880" : C.soft, fontWeight: 400 }}>{unit}</span>
      </span>
    </div>
  );
}

function Kpi({ label, value, unit, accent }) {
  return (
    <div style={{ flex: 1, minWidth: 150, padding: "14px 20px", borderLeft: `3px solid ${accent || C.ink}` }}>
      <div style={{ fontFamily: mono, fontSize: 9.5, color: C.soft, textTransform: "lowercase", letterSpacing: "0.05em", marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontFamily: mono, fontSize: 21, fontWeight: 700, color: C.ink, whiteSpace: "nowrap" }}>
        {value} <span style={{ fontSize: 11, fontWeight: 400, color: C.soft }}>{unit}</span>
      </div>
    </div>
  );
}

const CABIDA_STORE = "hygge:cabidaState";
const loadCabida = () => { try { return JSON.parse(localStorage.getItem(CABIDA_STORE) || "null") || {}; } catch { return {}; } };

// Wrapper: en modo standalone muestra las pestañas de proyecto y monta el cuerpo
// keyed por proyecto (al saltar de pestaña se re-lee el estado de ese proyecto).
// En modo compact (dentro de un terreno de Growth) mantiene el comportamiento previo.
export default function CabidaView({ initialTerreno, compact }) {
  if (compact) return <CabidaInner initialTerreno={initialTerreno} compact />;
  return <CabidaConProyectos initialTerreno={initialTerreno} />;
}

function CabidaConProyectos({ initialTerreno }) {
  const { activo, store } = useProyectos();
  const guardar = useCallback((snap) => store.guardarCabida(activo.id, snap), [store, activo.id]);
  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <ProyectoTabs />
      <CabidaInner key={activo.id} initialTerreno={initialTerreno} proyecto={activo} onSaveCabida={guardar} />
    </div>
  );
}

function CabidaInner({ initialTerreno, compact, proyecto, onSaveCabida }) {
  const S = useRef(proyecto?.cabida && Object.keys(proyecto.cabida).length ? proyecto.cabida : loadCabida()).current; // snapshot del proyecto (ida y vuelta al editor)
  const [terreno, setTerreno] = useState(S.terreno ?? (initialTerreno || 693));
  const [areaLibre, setAreaLibre] = useState(S.areaLibre ?? 35);
  const [pisos, setPisos] = useState(S.pisos ?? 8);
  const [azoteaTechada, setAzoteaTechada] = useState(S.azoteaTechada ?? 30);
  const [circulacion, setCirculacion] = useState(S.circulacion ?? 12);

  // ── lote: proporciones (números) o plano CAD (forma real manda) ──
  const [modoLote, setModoLote] = useState(S.modoLote ?? "prop");   // "prop" | "cad"
  const [lotePoly, setLotePoly] = useState(S.lotePoly ?? null);     // contorno real (m)
  const [cadInfo, setCadInfo] = useState(S.cadInfo ?? null);
  const [cadErr, setCadErr] = useState(null);
  const [frente, setFrente] = useState(S.frente ?? Math.round(Math.sqrt((initialTerreno || 693) * 1.4)));
  const [tipoLote, setTipoLote] = useState(S.tipoLote ?? "medianera");   // medianera | esquina
  const [retiros, setRetiros] = useState(S.retiros ?? {
    frontal:   { on: true,  v: 5 },
    izquierda: { on: false, v: 3 },
    derecha:   { on: false, v: 3 },
    posterior: { on: false, v: 3 },
    ochavo:    { on: false, v: 4 },
  });
  const [frenteIdx, setFrenteIdx] = useState(S.frenteIdx ?? null);  // override manual del frente (clic en lindero)
  const [partiIdx, setPartiIdx] = useState(S.partiIdx ?? 0);       // parti elegido en la planta
  const [movs, setMovs] = useState(S.movs ?? {});                 // desplazamientos manuales de bloques {roomId:{dx,dy}}
  const cadRef = useRef(null);
  const cadLock = modoLote === "cad" && !!lotePoly;          // con CAD, los números salen del plano

  const onCAD = async (file) => {
    if (!file) return;
    setCadErr(null);
    try {
      const r = await importCAD(file);
      setLotePoly(r.pts);
      setCadInfo(r);
      setTerreno(Math.round(r.area));
      setFrente(Math.round(r.frente));
      setFrenteIdx(null); setMovs({}); setPartiIdx(0);   // lote nuevo → empieza limpio
    } catch (e) {
      setLotePoly(null); setCadInfo(null);
      setCadErr(e?.message || String(e));
    }
  };
  const quitarCAD = () => { setLotePoly(null); setCadInfo(null); setCadErr(null); };
  const setRet = (k) => (ret) => setRetiros((rs) => ({ ...rs, [k]: ret }));

  const efFrenteIdx = frenteIdx ?? cadInfo?.frenteIdx ?? 0;   // frente efectivo (override manual > CAD)

  const [areaDpto, setAreaDpto] = useState(90);
  const [mix1, setMix1] = useState(20);
  const [mix2, setMix2] = useState(60);

  // deja el lote + el PRODUCTO (área promedio y mix de dorms) para el editor de planos.
  // así el editor ofrece depas cercanos a lo que ya definiste en cabida, no defaults.
  useEffect(() => {
    if (!lotePoly) return;
    try {
      localStorage.setItem("hygge:loteCabida", JSON.stringify({
        pts: lotePoly, area: cadInfo?.area, frente: cadInfo?.frente, frenteIdx: efFrenteIdx,
        tipoLote, retiros, pisos, units: cadInfo?.units,
        areaDpto, mix1, mix2, ts: Date.now(),
      }));
    } catch { /* cuota */ }
  }, [lotePoly, cadInfo, tipoLote, retiros, pisos, efFrenteIdx, areaDpto, mix1, mix2]);

  const [est1, setEst1] = useState(1);
  const [est23, setEst23] = useState(2);
  const [visitas, setVisitas] = useState(10);
  const [m2Plaza, setM2Plaza] = useState(30);

  const [precioM2, setPrecioM2] = useState(2600);
  const [factorAzotea, setFactorAzotea] = useState(50);
  const [precioEst, setPrecioEst] = useState(15000);
  const [costoM2, setCostoM2] = useState(950);

  const r = useMemo(() => {
    const libre = terreno * areaLibre / 100;
    const huella = terreno - libre;
    const torre = huella * pisos;
    const azTech = huella * azoteaTechada / 100;
    const azLibre = huella - azTech;
    const brutaSR = torre + azTech;
    const noComp = brutaSR * circulacion / 100;
    const vendible = brutaSR - noComp;

    const dptos = Math.floor(vendible / Math.max(areaDpto, 1));
    const mix3 = Math.max(0, 100 - mix1 - mix2);
    const d1 = Math.round(dptos * mix1 / 100);
    const d2 = Math.round(dptos * mix2 / 100);
    const d3 = Math.max(0, dptos - d1 - d2);

    const estVend = Math.ceil(d1 * est1 + (d2 + d3) * est23);
    const estTotal = Math.ceil(estVend * (1 + visitas / 100));
    const areaEst = estTotal * m2Plaza;
    const pisosSot = Math.ceil(areaEst / Math.max(terreno, 1));
    const sotanos = pisosSot * terreno;
    const construidaTotal = brutaSR + sotanos;

    const ingViv = vendible * precioM2;
    const ingAz = azLibre * precioM2 * factorAzotea / 100;
    const ingEst = estVend * precioEst;
    const ingresos = ingViv + ingAz + ingEst;
    const costo = construidaTotal * costoM2;
    const margen = ingresos - costo;

    return {
      libre, huella, torre, azTech, azLibre, brutaSR, noComp, vendible,
      dptos, d1, d2, d3, mix3, estVend, estTotal, areaEst, pisosSot, sotanos,
      construidaTotal, ingViv, ingAz, ingEst, ingresos, costo, margen,
      eficiencia: brutaSR ? vendible / brutaSR * 100 : 0,
      incidencia: ingresos ? costo / ingresos * 100 : 0,
      vendEquiv: vendible + azLibre * factorAzotea / 100,
    };
  }, [terreno, areaLibre, pisos, azoteaTechada, circulacion, areaDpto, mix1, mix2,
      est1, est23, visitas, m2Plaza, precioM2, factorAzotea, precioEst, costoM2]);

  const mixWarn = mix1 + mix2 > 100;

  // persiste TODO el estado de la cabida (sobrevive ir/volver del editor de planos).
  // en modo proyectos escribe al proyecto activo (instantáneo local + sync nube);
  // en modo terreno (compact) escribe al store legacy.
  useEffect(() => {
    const snap = {
      terreno, areaLibre, pisos, azoteaTechada, circulacion, modoLote, lotePoly, cadInfo,
      frente, tipoLote, retiros, frenteIdx, partiIdx, movs,
      areaDpto, mix1, mix2, est1, est23, visitas, m2Plaza, precioM2, factorAzotea, precioEst, costoM2,
    };
    if (onSaveCabida) onSaveCabida(snap);
    else { try { localStorage.setItem(CABIDA_STORE, JSON.stringify(snap)); } catch { /* cuota */ } }
  }, [onSaveCabida, terreno, areaLibre, pisos, azoteaTechada, circulacion, modoLote, lotePoly, cadInfo,
      frente, tipoLote, retiros, frenteIdx, partiIdx, movs,
      areaDpto, mix1, mix2, est1, est23, visitas, m2Plaza, precioM2, factorAzotea, precioEst, costoM2]);

  return (
    <div style={{ minHeight: "100%", background: C.paper, color: C.ink, paddingBottom: 48 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        input[type=number]::-webkit-inner-spin-button { opacity: 0.25; }
      `}</style>

      {/* header — solo en modo standalone */}
      {!compact && (
        <header style={{ background: C.card, borderBottom: `1px solid ${C.line}`, padding: "18px 28px", display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
          <h1 style={{ fontFamily: sans, fontWeight: 800, fontSize: 24, margin: 0, letterSpacing: "-0.02em" }}>
            cabida<span style={{ color: C.orange }}>.</span>
          </h1>
          <span style={{ fontFamily: mono, fontSize: 10, color: C.soft }}>
            cálculo preliminar — hygge / bam
          </span>
        </header>
      )}

      {/* KPI bar */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.line}`, display: "flex", flexWrap: "wrap" }}>
        <Kpi label="área vendible" value={fmt(r.vendible)} unit="m²" accent={C.orange} />
        <Kpi label="área construida total" value={fmt(r.construidaTotal)} unit="m²" />
        <Kpi label="departamentos" value={fmt(r.dptos)} unit="unids" accent={C.peri} />
        <Kpi label="estacionamientos" value={fmt(r.estVend)} unit="unids" accent={C.peri} />
        <Kpi label="margen bruto" value={`$${fmt(r.margen)}`} unit={`${r.ingresos > 0 ? fmt(r.margen / r.ingresos * 100, 1) : 0}%`} accent={C.orange} />
      </div>

      {/* body */}
      <div style={{ padding: "24px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 20, alignItems: "start" }}>

        {/* inputs */}
        <div style={{ display: "grid", gap: 20 }}>
          <Card n="01" title="terreno y normativa">
            {/* fuente del lote: números a mano o plano CAD (el plano manda) */}
            <div style={{ display: "flex", gap: 6, paddingBottom: 8 }}>
              {[["prop", "proporciones"], ["cad", "plano CAD"]].map(([k, lbl]) => (
                <button key={k} onClick={() => setModoLote(k)}
                  style={{ fontFamily: mono, fontSize: 10.5, padding: "5px 12px", borderRadius: 2, cursor: "pointer",
                    color: modoLote === k ? C.card : C.ink, background: modoLote === k ? C.ink : C.paper,
                    border: `1px solid ${modoLote === k ? C.ink : C.line}` }}>
                  {lbl}
                </button>
              ))}
              {modoLote === "cad" && (
                <>
                  <input ref={cadRef} type="file" accept=".dxf,.dwg" style={{ display: "none" }}
                    onChange={(ev) => { onCAD(ev.target.files?.[0]); ev.target.value = ""; }} />
                  {cadInfo ? (
                    <button onClick={quitarCAD} title={`${cadInfo.verts} vértices · ${cadInfo.units} · clic para quitar`}
                      style={{ fontFamily: mono, fontSize: 10.5, padding: "5px 12px", borderRadius: 2, cursor: "pointer",
                        color: C.card, background: C.peri, border: `1px solid ${C.peri}`, marginLeft: "auto" }}>
                      ✓ {fmt(cadInfo.area)} m² · quitar
                    </button>
                  ) : (
                    <button onClick={() => cadRef.current?.click()}
                      style={{ fontFamily: mono, fontSize: 10.5, padding: "5px 12px", borderRadius: 2, cursor: "pointer",
                        color: C.orange, background: "transparent", border: `1px solid ${C.orange}`, marginLeft: "auto" }}>
                      ↑ importar .dxf / .dwg
                    </button>
                  )}
                </>
              )}
            </div>
            {cadErr && <div style={{ fontFamily: mono, fontSize: 10.5, color: C.orange, paddingBottom: 6, lineHeight: 1.5 }}>▲ {cadErr}</div>}
            {cadInfo?.unitNote && <div style={{ fontFamily: mono, fontSize: 10, color: C.peri, paddingBottom: 6, lineHeight: 1.5 }}>◇ {cadInfo.unitNote}</div>}

            <Num label="área de terreno" value={terreno} onChange={setTerreno} unit="m²" step={10} disabled={cadLock} hint="del plano" />
            <Num label="frente del lote" value={frente} onChange={setFrente} unit="m" step={1} disabled={cadLock} hint="del plano" />
            <Num label="número de pisos" value={pisos} onChange={setPisos} unit="pisos" />
            <Pct label="área libre (no techada 1er piso)" value={areaLibre} onChange={setAreaLibre} max={70} accent={C.peri} />
            <Pct label="azotea techada (% de huella)" value={azoteaTechada} onChange={setAzoteaTechada} accent={C.peri} />
            <Pct label="circulación + áreas comunes" value={circulacion} onChange={setCirculacion} max={30} accent={C.orange} />

            {/* lote: tipo + retiros normativos (heredan a la masa 3D y al editor) */}
            <div style={{ borderTop: `1px solid ${C.line}`, marginTop: 6, paddingTop: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 4 }}>
                <span style={{ fontFamily: sans, fontSize: 12.5, color: C.ink, textTransform: "lowercase", flex: 1 }}>tipo de lote</span>
                <select value={tipoLote} onChange={(e) => setTipoLote(e.target.value)}
                  style={{ fontFamily: mono, fontSize: 12, color: C.ink, background: C.paper, border: `1px solid ${C.line}`, borderRadius: 2, padding: "4px 8px", outline: "none" }}>
                  <option value="medianera">entre medianeras</option>
                  <option value="esquina">esquina</option>
                </select>
              </div>
              <RetiroRow label="retiro frontal" ret={retiros.frontal} onChange={setRet("frontal")} />
              <RetiroRow label="retiro izquierda" ret={retiros.izquierda} onChange={setRet("izquierda")}
                hint={tipoLote === "medianera" ? "colindante — solo si la normativa lo pide" : "mirando el lote desde la calle"} />
              <RetiroRow label="retiro derecha" ret={retiros.derecha} onChange={setRet("derecha")}
                hint={tipoLote === "medianera" ? "colindante — solo si la normativa lo pide" : "mirando el lote desde la calle"} />
              <RetiroRow label="retiro posterior" ret={retiros.posterior} onChange={setRet("posterior")} />
              <RetiroRow label="ochavo" ret={retiros.ochavo} onChange={setRet("ochavo")}
                disabled={tipoLote !== "esquina"} hint={tipoLote !== "esquina" ? "solo lotes en esquina" : "chaflán en la esquina de calles"} />
            </div>
          </Card>

          <Card n="02" title="producto y estacionamientos">
            <Num label="área promedio por departamento" value={areaDpto} onChange={setAreaDpto} unit="m²" step={5} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 24 }}>
              <Pct label="mix 1 dorm" value={mix1} onChange={setMix1} />
              <Pct label="mix 2 dorm" value={mix2} onChange={setMix2} />
            </div>
            <div style={{ fontFamily: mono, fontSize: 11, color: mixWarn ? C.orange : C.soft, padding: "2px 0 10px" }}>
              {mixWarn ? "▲ el mix supera 100%" : `3 dorm = ${r.mix3}% (resto)`}
            </div>
            <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 4 }}>
              <Num label="est. por dpto 1 dorm" value={est1} onChange={setEst1} unit="est" step={0.5} />
              <Num label="est. por dpto 2–3 dorm" value={est23} onChange={setEst23} unit="est" step={0.5} />
              <Num label="m² por plaza (incl. rampas)" value={m2Plaza} onChange={setM2Plaza} unit="m²" />
              <Pct label="adicional visitas" value={visitas} onChange={setVisitas} max={20} />
            </div>
          </Card>

          <Card n="03" title="valores">
            <Num label="precio m² vendible" value={precioM2} onChange={setPrecioM2} unit="usd" step={50} accent={C.orange} />
            <Num label="precio por estacionamiento" value={precioEst} onChange={setPrecioEst} unit="usd" step={500} accent={C.orange} />
            <Num label="costo m² construido" value={costoM2} onChange={setCostoM2} unit="usd" step={25} accent={C.orange} />
            <Pct label="valor azotea no techada (% del precio)" value={factorAzotea} onChange={setFactorAzotea} accent={C.orange} />
          </Card>
        </div>

        {/* resultados */}
        <div style={{ display: "grid", gap: 20 }}>
          <Card n="04" title="áreas">
            <Row k="huella techada 1er piso" v={fmt(r.huella, 0)} unit="m²" strong />
            <Row k="área libre 1er piso" v={fmt(r.libre, 0)} unit="m²" />
            <Row k="torre (huella × pisos)" v={fmt(r.torre, 0)} unit="m²" />
            <Row k="azotea techada" v={fmt(r.azTech, 0)} unit="m²" />
            <Row k="azotea no techada (terraza)" v={fmt(r.azLibre, 0)} unit="m²" accent={C.peri} />
            <Row k="construida sobre rasante" v={fmt(r.brutaSR, 0)} unit="m²" strong />
            <Row k="no computable (circ. + común)" v={fmt(r.noComp, 0)} unit="m²" accent={C.orange} />
            <Row k="área vendible vivienda" v={fmt(r.vendible, 0)} unit="m²" strong accent={C.orange} />
            <Row k="eficiencia vendible / construida" v={fmt(r.eficiencia, 1)} unit="%" />
          </Card>

          <Card n="05" title="unidades y sótanos">
            <Row k="departamentos" v={fmt(r.dptos)} unit="unids" strong />
            <Row k={`1 dorm · ${mix1}%`} v={fmt(r.d1)} unit="" indent />
            <Row k={`2 dorm · ${mix2}%`} v={fmt(r.d2)} unit="" indent />
            <Row k={`3 dorm · ${r.mix3}%`} v={fmt(r.d3)} unit="" indent />
            <Row k="estacionamientos vendibles" v={fmt(r.estVend)} unit="unids" strong />
            <Row k={`total con visitas +${visitas}%`} v={fmt(r.estTotal)} unit="unids" indent />
            <Row k="área requerida (est × m²/plaza)" v={fmt(r.areaEst, 0)} unit="m²" />
            <Row k="pisos de sótano" v={fmt(r.pisosSot)} unit="pisos" />
            <Row k="construida sótanos" v={fmt(r.sotanos, 0)} unit="m²" />
            <Row k="área construida total" v={fmt(r.construidaTotal, 0)} unit="m²" strong />
          </Card>

          {/* económico — card oscura */}
          <div style={{ background: C.ink, borderRadius: 2, padding: "20px 22px", color: C.paper }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 16 }}>
              <span style={{ fontFamily: mono, fontSize: 10, color: C.orange }}>06</span>
              <h2 style={{ fontFamily: sans, fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", textTransform: "lowercase", margin: 0 }}>
                resumen económico
              </h2>
            </div>

            <Row dark k="ingresos vivienda" v={`$${fmt(r.ingViv)}`} unit="" />
            <Row dark k={`azotea no techada × ${factorAzotea}%`} v={`$${fmt(r.ingAz)}`} unit="" />
            <Row dark k="estacionamientos" v={`$${fmt(r.ingEst)}`} unit="" />
            <Row dark k="ingresos totales" v={`$${fmt(r.ingresos)}`} unit="" strong />
            <Row dark k="costo de construcción" v={`−$${fmt(r.costo)}`} unit="" accent={C.orange} />

            <div style={{ marginTop: 18, borderLeft: `3px solid ${C.orange}`, paddingLeft: 14 }}>
              <div style={{ fontFamily: mono, fontSize: 9.5, color: C.orange, letterSpacing: "0.05em", marginBottom: 2 }}>
                margen bruto preliminar
              </div>
              <div style={{ fontFamily: mono, fontSize: 26, fontWeight: 700 }}>
                ${fmt(r.margen)}
              </div>
              <div style={{ fontFamily: mono, fontSize: 12, color: C.peri }}>
                {r.ingresos > 0 ? fmt(r.margen / r.ingresos * 100, 1) : "0"}% sobre ingresos · incidencia {fmt(r.incidencia, 1)}%
              </div>
            </div>

            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 20px" }}>
              {[
                ["m² vendible equiv.", `${fmt(r.vendEquiv)} m²`],
                ["margen por dpto", `$${fmt(r.dptos ? r.margen / r.dptos : 0)}`],
                ["ingreso / m² const.", `$${fmt(r.construidaTotal ? r.ingresos / r.construidaTotal : 0)}`],
                ["costo / m² vendible", `$${fmt(r.vendible ? r.costo / r.vendible : 0)}`],
              ].map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontFamily: sans, fontSize: 10.5, color: "#b8b6b0", textTransform: "lowercase" }}>{k}</div>
                  <div style={{ fontFamily: mono, fontSize: 13, color: C.peri }}>{v}</div>
                </div>
              ))}
            </div>

            <p style={{ fontFamily: mono, fontSize: 9, color: "#8a8880", marginTop: 18, marginBottom: 0, lineHeight: 1.6 }}>
              estimación preliminar. ratios: 1 est × 1 dorm · 2 est × 2–3 dorm · +10% visitas ·
              30 m²/plaza · sótano a huella completa del terreno.
            </p>
          </div>
        </div>

        {/* distribución esquemática — ancho completo */}
        <Card n="07" title="distribución esquemática" style={{ gridColumn: "1 / -1" }}>
          <EsquemaPlanta
            terreno={terreno} huella={r.huella} pisos={pisos} dptos={r.dptos}
            mix1={mix1} mix2={mix2} areaDpto={areaDpto} circulacion={circulacion}
            pisosSot={r.pisosSot} azoteaTechada={azoteaTechada}
            frente={frente} tipoLote={tipoLote} retiros={retiros}
            lotePoly={modoLote === "cad" ? lotePoly : null} cadInfo={modoLote === "cad" ? cadInfo : null}
            frenteIdxOverride={frenteIdx} onFrente={setFrenteIdx}
            partiIdx={partiIdx} onParti={setPartiIdx}
            movs={movs} onMovs={setMovs} onFrenteReal={setFrente}
          />
        </Card>
      </div>
    </div>
  );
}
