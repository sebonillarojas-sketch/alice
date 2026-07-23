// Mesa de Trabajo BAM — workspace multi-pestaña del proyecto:
// Portada → Growth (láminas A4 con la info de terreno + cabida) → 3D → Planos → Concepto BAM.
// Todo se guarda por nombre de proyecto (snapshot de cabida, lote, planos y concepto)
// y se exporta como presentación (imprimir → PDF, una lámina por hoja A4 apaisada).
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Save, Printer, RefreshCw, Trash2, Download, Upload } from "lucide-react";
import ConceptoBam from "./ConceptoBam.jsx";
import { useProyectos } from "../cabida/proyectos.js";
import {
  calcCabida, loadTerrenos, loadProyectos, saveProyecto, cargarProyecto, borrarProyecto, loadLS, K, kFor,
} from "./proyecto.js";
import {
  A4W, A4H, LamPortada, LamProyecto, LamUbicacion, LamAnalisis, LamEconomico,
  LamMercadoSector, LamMercadoPosicion, LamCabidaParams,
  LamVolumetria, LamPlanos,
} from "./laminas.jsx";

const BG = "#E3E1DE", INK = "#000000", ORANGE = "#F7643B";
const MONO = "'CS Genio Mono','JetBrains Mono','SF Mono',Menlo,monospace";
const META_STORE = "hygge:mesaMeta";

const TABS = [
  { id: "portada", label: "Portada" },
  { id: "growth", label: "( 1 ) Growth" },
  { id: "cabida", label: "( 2 ) Cabida" },
  { id: "3d", label: "( 3 ) 3D" },
  { id: "planos", label: "( 4 ) Planos" },
  { id: "concepto", label: "( 5 ) Concepto BAM" },
];

// apila láminas A4 y las escala al ancho disponible
function Laminas({ children }) {
  const ref = useRef(null);
  const [scale, setScale] = useState(0.6);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, (el.clientWidth - 40) / A4W));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const pages = Array.isArray(children) ? children.filter(Boolean) : [children];
  return (
    <div ref={ref} style={{ height: "100%", overflow: "auto", padding: "20px 0 40px" }}>
      {pages.map((p, i) => (
        <div key={i} style={{ width: A4W * scale, height: A4H * scale, margin: "0 auto 24px" }}>
          <div style={{ transform: `scale(${scale})`, transformOrigin: "0 0", width: A4W, height: A4H }}>{p}</div>
        </div>
      ))}
    </div>
  );
}

export default function MesaDeTrabajo() {
  const meta0 = loadLS(META_STORE, {}) || {};
  // Growth es el parent: la Mesa arranca con el proyecto activo de Cabida/Planos
  // (nombre + terreno vinculado) salvo que ya tengas una meta propia guardada.
  const { activo: proyectoActivo } = useProyectos();
  // si venís del Editor de Planos ("→ mesa de trabajo") la Mesa abre en Planos.
  // Lectura pura en el initializer (idempotente); el borrado va en un timeout con
  // cleanup, así sobrevive el doble-mount de StrictMode sin consumir el flag antes
  // del segundo montaje.
  const [tab, setTab] = useState(() => {
    try { return localStorage.getItem("hygge:mesaTabInicial") || "portada"; } catch { return "portada"; }
  });
  useEffect(() => {
    const id = setTimeout(() => { try { localStorage.removeItem("hygge:mesaTabInicial"); } catch { /* noop */ } }, 1500);
    return () => clearTimeout(id);
  }, []);
  const [nombre, setNombre] = useState(proyectoActivo?.nombre || meta0.nombre || "");
  // el terreno abierto desde Growth manda (proyectoActivo); meta guardada solo como fallback
  const [terrenoId, setTerrenoId] = useState(proyectoActivo?.terrenoId ?? meta0.terrenoId ?? "");
  // si desde Growth abriste otro terreno, la Mesa lo sigue
  useEffect(() => {
    if (proyectoActivo?.terrenoId != null && String(proyectoActivo.terrenoId) !== String(terrenoId)) {
      setTerrenoId(proyectoActivo.terrenoId);
      if (proyectoActivo.nombre) setNombre(proyectoActivo.nombre);
    }
  }, [proyectoActivo?.terrenoId]); // eslint-disable-line react-hooks/exhaustive-deps
  const [portadaImg, setPortadaImg] = useState(meta0.portadaImg || null);
  const [snap3d, setSnap3d] = useState(meta0.snap3d || null);
  const [printing, setPrinting] = useState(false);
  const [tick, setTick] = useState(0);
  const [aviso, setAviso] = useState(null);

  const terrenos = useMemo(() => loadTerrenos(), [tick]);
  const proyectos = useMemo(() => loadProyectos(), [tick, aviso]);
  const terreno = useMemo(
    () => terrenos.find((t) => String(t.id) === String(terrenoId)) || null,
    [terrenos, terrenoId]
  );
  // recalcula cabida del terreno activo (misma key scopeada que escribe Cabida)
  const cab = useMemo(() => calcCabida(terrenoId), [tick, tab, terrenoId]);
  // plano: el del proyecto activo (Editor guarda ahí vía abrirParaTerreno); fallback a key scopeada/global
  const editor = useMemo(() => {
    const p = proyectoActivo?.plano;
    if (p && (p.rooms || p.items)) return p;
    return loadLS(kFor(K.editor, terrenoId)) || loadLS(K.editor);
  }, [tick, tab, terrenoId, proyectoActivo]);
  const nombreEf = nombre.trim() || terreno?.name || "Nuevo proyecto";
  const fecha = new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });

  // meta viva (sobrevive recargas sin necesidad de "guardar proyecto")
  useEffect(() => {
    try { localStorage.setItem(META_STORE, JSON.stringify({ nombre, terrenoId, portadaImg, snap3d })); } catch { /* cuota */ }
  }, [nombre, terrenoId, portadaImg, snap3d]);

  const flash = (msg) => { setAviso(msg); setTimeout(() => setAviso(null), 2600); };
  const importRef = useRef(null);

  // memoria persistente de la distribución: los clics en la lámina (parti, frente,
  // mover bloques) se mergean en hygge:cabidaState — la MISMA fuente que lee Cabida,
  // así la elección sobrevive recargas y queda sincronizada ida y vuelta.
  const patchCabida = useCallback((patch) => {
    try {
      const cur = JSON.parse(localStorage.getItem(K.cabida) || "{}") || {};
      localStorage.setItem(K.cabida, JSON.stringify({ ...cur, ...patch }));
    } catch { /* cuota */ }
    setTick((t) => t + 1);
  }, []);

  // estado completo hygge:* ⇄ .json — el archivo se commitea al repo y la otra
  // máquina lo importa (el sync de app_state en Supabase está roto por RLS)
  const exportarEstado = useCallback(() => {
    const data = Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.startsWith("hygge:")));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `hygge-estado-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    flash(`Estado exportado · ${Object.keys(data).length} claves`);
  }, []);

  const importarEstado = useCallback((file) => {
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const data = JSON.parse(rd.result);
        const ks = Object.keys(data).filter((k) => k.startsWith("hygge:"));
        ks.forEach((k) => localStorage.setItem(k, data[k]));
        flash(`Estado importado · ${ks.length} claves — recargando`);
        setTimeout(() => window.location.reload(), 900);
      } catch {
        flash("Ese archivo no es un estado válido");
      }
    };
    rd.readAsText(file);
  }, []);

  const guardar = useCallback(() => {
    const p = saveProyecto(nombreEf, { terreno, portadaImg, snap3d });
    flash(p ? `Proyecto “${p.nombre}” guardado — cabida, 3D, planos y concepto` : "Ponle nombre al proyecto");
  }, [nombreEf, terreno, portadaImg, snap3d]);

  const cargar = useCallback((nom) => {
    const p = cargarProyecto(nom);
    if (!p) return;
    setNombre(p.nombre);
    setTerrenoId(p.terreno?.id ?? "");
    setPortadaImg(p.portadaImg || null);
    setSnap3d(p.snap3d || null);
    setTick((t) => t + 1);
    flash(`Proyecto “${p.nombre}” cargado — Cabida y Editor lo leen al abrirlos`);
  }, []);

  // exportar presentación: imprime el portal con TODAS las láminas (1 hoja A4 por lámina)
  useEffect(() => {
    if (!printing) return;
    document.body.classList.add("mesa-printing");
    const t = setTimeout(() => window.print(), 700);
    const done = () => setPrinting(false);
    window.addEventListener("afterprint", done);
    return () => {
      document.body.classList.remove("mesa-printing");
      clearTimeout(t);
      window.removeEventListener("afterprint", done);
    };
  }, [printing]);

  const btn = (active) => ({
    display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", cursor: "pointer",
    border: `1px solid ${INK}`, background: active ? INK : "transparent", color: active ? BG : INK,
    fontFamily: MONO, fontSize: 11, textTransform: "uppercase", whiteSpace: "nowrap",
  });

  const laminasGrowth = [
    <LamProyecto key="g1" nombre={nombreEf} terreno={terreno} cab={cab} />,
    <LamUbicacion key="g2" nombre={nombreEf} terreno={terreno} />,
    <LamMercadoSector key="g3" nombre={nombreEf} terreno={terreno} cab={cab} />,
    <LamMercadoPosicion key="g4" nombre={nombreEf} terreno={terreno} cab={cab} />,
  ];
  const laminasCabida = [
    <LamCabidaParams key="c1" nombre={nombreEf} cab={cab} />,
    <LamAnalisis key="c2" nombre={nombreEf} cab={cab} />,
    <LamEconomico key="c3" nombre={nombreEf} cab={cab} terreno={terreno} />,
  ];

  return (
    <div style={{ width: "100%", height: "calc(100vh - 108px)", display: "flex", flexDirection: "column", background: "#D6D4D0" }}>
      <style>{`
        .mesa-print { position: absolute; left: -99999px; top: 0; }
        @media print {
          @page { size: A4 landscape; margin: 0; }
          body.mesa-printing > *:not(.mesa-print) { display: none !important; }
          body.mesa-printing .mesa-print { position: static; left: 0; }
          .mesa-print .mesa-a4 { box-shadow: none !important; break-inside: avoid; page-break-inside: avoid; }
          .mesa-print .mesa-a4:not(:last-child) { break-after: page; page-break-after: always; }
          .mesa-noprint { display: none !important; }
        }
      `}</style>

      {/* chrome: proyecto + acciones */}
      <div className="mesa-noprint" style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 16px", background: BG, borderBottom: `1px solid ${INK}`, flexWrap: "wrap" }}>
        <span style={{ fontFamily: MONO, fontSize: 11, textTransform: "uppercase", color: "rgba(0,0,0,.55)" }}>Proyecto</span>
        <input
          value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={terreno?.name || "nombre del proyecto"}
          style={{ fontFamily: MONO, fontSize: 12, padding: "6px 10px", border: `1px solid ${INK}`, background: "#F9F9F9", outline: "none", width: 230 }}
        />
        <select value={terrenoId} onChange={(e) => { setTerrenoId(e.target.value); const t = terrenos.find((x) => String(x.id) === e.target.value); if (t && !nombre.trim()) setNombre(t.name); }}
          style={{ fontFamily: MONO, fontSize: 11, padding: "6px 8px", border: `1px solid ${INK}`, background: "#F9F9F9", outline: "none", maxWidth: 220 }}>
          <option value="">terreno growth…</option>
          {terrenos.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.district}</option>)}
        </select>
        <button onClick={guardar} style={btn(false)} title="Guarda cabida, lote, planos y concepto bajo este nombre"><Save size={12} /> Guardar</button>
        <select value="" onChange={(e) => e.target.value && cargar(e.target.value)}
          style={{ fontFamily: MONO, fontSize: 11, padding: "6px 8px", border: `1px solid ${INK}`, background: "#F9F9F9", outline: "none", maxWidth: 200 }}>
          <option value="">↳ abrir proyecto…</option>
          {Object.values(proyectos).sort((a, b) => b.ts - a.ts).map((p) => (
            <option key={p.nombre} value={p.nombre}>{p.nombre} · {new Date(p.ts).toLocaleDateString("es-PE")}</option>
          ))}
        </select>
        {proyectos[nombreEf] && (
          <button onClick={() => { borrarProyecto(nombreEf); flash(`“${nombreEf}” borrado`); }} style={btn(false)} title="Borrar snapshot guardado"><Trash2 size={12} /></button>
        )}
        <button onClick={() => setTick((t) => t + 1)} style={btn(false)} title="Releer cabida / planos"><RefreshCw size={12} /></button>
        {/* estado completo hygge:* como .json — para mover el trabajo entre máquinas vía repo */}
        <button onClick={exportarEstado} style={btn(false)} title="Descarga todo el estado local (hygge:*) como .json"><Download size={12} /> Estado</button>
        <button onClick={() => importRef.current?.click()} style={btn(false)} title="Carga un .json de estado exportado en otra máquina"><Upload size={12} /></button>
        <input ref={importRef} type="file" accept="application/json,.json" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) importarEstado(f); e.target.value = ""; }} />
        <button onClick={() => setPrinting(true)} style={{ ...btn(true), marginLeft: "auto" }}><Printer size={12} /> Exportar presentación</button>
      </div>

      {/* pestañas */}
      <div className="mesa-noprint" style={{ display: "flex", gap: 0, background: BG, borderBottom: `1px solid ${INK}` }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); setTick((x) => x + 1); }}
            style={{ padding: "10px 20px", fontFamily: MONO, fontSize: 12, textTransform: "uppercase", cursor: "pointer",
              border: "none", borderRight: `1px solid ${INK}`, background: tab === t.id ? INK : "transparent",
              color: tab === t.id ? BG : INK }}>
            {t.label}
          </button>
        ))}
        {aviso && <span style={{ marginLeft: "auto", alignSelf: "center", padding: "0 16px", fontFamily: MONO, fontSize: 11, color: ORANGE, textTransform: "uppercase" }}>{aviso}</span>}
      </div>

      {/* contenido */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {tab === "portada" && (
          <Laminas>
            <LamPortada nombre={nombreEf} terreno={terreno} img={portadaImg} onImg={setPortadaImg} fecha={fecha} />
          </Laminas>
        )}
        {tab === "growth" && <Laminas>{laminasGrowth}</Laminas>}
        {tab === "cabida" && <Laminas>{laminasCabida}</Laminas>}
        {tab === "3d" && (
          <Laminas>
            <LamVolumetria
              nombre={nombreEf} cab={cab} snap={snap3d} onSnap={setSnap3d}
              onParti={(i) => patchCabida({ partiIdx: i })}
              onMovs={(m) => patchCabida({ movs: m })}
              onFrente={(i) => patchCabida({ frenteIdx: i })}
              onFrenteReal={(f) => patchCabida({ frente: f })}
            />
          </Laminas>
        )}
        {tab === "planos" && (
          <Laminas>
            <LamPlanos nombre={nombreEf} editor={editor} />
          </Laminas>
        )}
        {tab === "concepto" && <ConceptoBam height="100%" />}
      </div>

      {/* presentación imprimible — todas las láminas, una por hoja */}
      {printing && createPortal(
        <div className="mesa-print">
          <LamPortada nombre={nombreEf} terreno={terreno} img={portadaImg} onImg={() => {}} fecha={fecha} />
          {laminasGrowth}
          {laminasCabida}
          <LamVolumetria nombre={nombreEf} cab={cab} snap={snap3d} print />
          <LamPlanos nombre={nombreEf} editor={editor} />
          {/* Concepto BAM: el board es retrato (2480×3720) — en apaisado quedaba como
              una tira vertical al medio. Lo partimos en dos hojas horizontales: cada
              mitad del board (1860px) escalada para llenar el alto A4. */}
          {(() => {
            const CW = 2480, CH = 3720, HALF = CH / 2;
            const cs = A4H / HALF;               // media hoja del board llena el alto A4
            const cl = (A4W - CW * cs) / 2;       // centrado horizontal
            return [0, 1].map((h) => (
              <div key={`concepto-${h}`} className="mesa-a4" style={{ width: A4W, height: A4H, background: "#D6D4D0", overflow: "hidden", position: "relative", contain: "layout paint size" }}>
                <div style={{ transform: `scale(${cs})`, transformOrigin: "0 0", position: "absolute", left: cl, top: -h * HALF * cs, width: CW }}>
                  <ConceptoBam height={`${CH}px`} />
                </div>
              </div>
            ));
          })()}
        </div>,
        document.body
      )}
    </div>
  );
}
