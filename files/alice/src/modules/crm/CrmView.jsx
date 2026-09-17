// CRM comercial · la vista de José.
// Dos cosas y nada más: la BANDEJA (a quién le escribo primero) y la FICHA (qué le
// digo). Kanban, reportes y comisiones quedan fuera por el §3 del diseño de Mica:
// acá se construye solo lo que hace falta para no perder el lead.
//
// Lo que hace que un CRM se use es que José abra el link del WhatsApp y entienda todo
// en diez segundos (§9). Por eso la ficha es dossier primero y formulario después.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Flame, Thermometer, Snowflake, RefreshCw, UserPlus, XCircle } from "lucide-react";
import { crm } from "../../lib/crm.js";
import { fmtMonto } from "../../lib/crm-map.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { useERPContext } from "../../copilot/ERPContext.jsx";
import {
  ordenarBandeja, filtrarBandeja, contarPorTemperatura, armarFicha, camposSinCita,
  ETIQUETAS, SIN_DUENO,
} from "./bandeja.js";

// Mismos tokens que el resto de ALICE (ver HyggeOS.jsx § BRAND TOKENS).
const C = {
  bg: "#EEEBE3", paper: "#F4F1EA", surface: "#FAF8F2", ink: "#0A0B0F", inkSoft: "#3A3D45",
  muted: "#8C8F96", line: "#D5D1C5", lineSoft: "#E4E0D4",
  navy: "#1E2A4A", cobalt: "#3D52D5", ochre: "#C2A45A", brick: "#A85B5B", green: "#5F8A6A",
};

const TEMP = {
  hot:   { label: "Caliente", color: C.brick,  Icon: Flame },
  tibio: { label: "Tibio",    color: C.ochre,  Icon: Thermometer },
  frio:  { label: "Frío",     color: C.muted,  Icon: Snowflake },
};

const CANAL_LABEL = { whatsapp: "WhatsApp", instagram: "Instagram", messenger: "Messenger", web: "Web" };
const PRIORIDAD_OPCIONES = [
  { valor: "", label: "—" },
  { valor: "sala", label: "Sala amplia" },
  { valor: "habitaciones", label: "Más habitaciones" },
  { valor: "ambos", label: "Las dos" },
];

const hace = (iso) => {
  if (!iso) return "—";
  const ms = Date.now() - Date.parse(iso);
  if (Number.isNaN(ms)) return "—";
  const min = Math.floor(ms / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
};

const Eyebrow = ({ children, color = C.muted }) => (
  <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color, fontWeight: 500 }}>{children}</div>
);

const Boton = ({ children, onClick, disabled, tono = C.navy, ghost }) => (
  <button onClick={onClick} disabled={disabled}
    style={{
      fontSize: 11, padding: "6px 12px", borderRadius: 2, cursor: disabled ? "default" : "pointer",
      border: `1px solid ${ghost ? C.line : tono}`, background: ghost ? "transparent" : tono,
      color: ghost ? C.inkSoft : "#fff", opacity: disabled ? 0.45 : 1, fontWeight: 500,
    }}>{children}</button>
);

// ── bandeja ─────────────────────────────────────────────────────────────────

function FilaLead({ lead, activo, onClick }) {
  const t = TEMP[lead.temperatura] || TEMP.frio;
  return (
    <button onClick={onClick}
      style={{
        display: "block", width: "100%", textAlign: "left", padding: "10px 14px",
        background: activo ? C.surface : "transparent", border: "none",
        borderBottom: `1px solid ${C.lineSoft}`, cursor: "pointer",
        borderLeft: `2px solid ${activo ? C.navy : "transparent"}`,
        opacity: lead.descartadoAt ? 0.5 : 1,
      }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <t.Icon size={12} color={t.color} />
        <span style={{ fontSize: 13, fontWeight: 600, color: C.ink, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {lead.nombre || lead.telefono || lead.externalId || "Sin nombre"}
        </span>
        {/* Sin dueño es la señal que ordena la bandeja: nadie lo está mirando. */}
        {!lead.aliceId && !lead.descartadoAt && (
          <span style={{ fontSize: 9, color: C.brick, border: `1px solid ${C.brick}`, borderRadius: 2, padding: "1px 4px" }}>libre</span>
        )}
      </div>
      <div style={{ fontSize: 10.5, color: C.muted, marginTop: 3, display: "flex", gap: 8 }}>
        <span>{CANAL_LABEL[lead.canal] || lead.canal}</span>
        <span>·</span>
        <span>{lead.etapa}</span>
        <span>·</span>
        <span>{hace(lead.ultimoContacto)}</span>
      </div>
      {/* La frase que puso al lead donde está. Es lo que hace que la bandeja se pueda
          priorizar leyendo, sin abrir cada ficha. */}
      {lead.temperaturaCita && (
        <div style={{ fontSize: 10.5, color: C.inkSoft, marginTop: 4, fontStyle: "italic",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          “{lead.temperaturaCita}”
        </div>
      )}
    </button>
  );
}

// ── ficha · los datos con su cita ───────────────────────────────────────────

function Dossier({ ficha }) {
  if (ficha.vacia) {
    return (
      <div style={{ fontSize: 12.5, color: C.muted, padding: "10px 0" }}>
        Todavía no alcanzó a contar nada de lo que busca.
      </div>
    );
  }
  return (
    <div>
      {ficha.datos.map(d => (
        <div key={d.campo} style={{ marginBottom: 12 }}>
          <Eyebrow>{d.etiqueta}</Eyebrow>
          <div style={{ fontSize: 13.5, color: C.ink, marginTop: 2 }}>{d.valor}</div>
          {/* El valor es la lectura; la cita es la prueba. Nunca va una sin la otra:
              José tiene que poder verificarlo, no creernos (§7). */}
          <div style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 3, paddingLeft: 10,
                        borderLeft: `2px solid ${C.lineSoft}`, fontStyle: "italic" }}>
            “{d.cita}”
          </div>
        </div>
      ))}
    </div>
  );
}

// El formulario de carga manual.
// El campo de la cita va AL LADO del dato y se llama "¿qué te dijo?": a José no le
// pedimos que documente, le pedimos que recuerde la frase. Si no la recuerda, lo
// correcto es dejar el dato vacío — no inventar una cita para pasar el CHECK.
function CampoConCita({ etiqueta, children, cita, onCita, resaltar }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 10, marginBottom: 10,
                  padding: 8, borderRadius: 2,
                  background: resaltar ? "#FBF3F3" : "transparent",
                  border: `1px solid ${resaltar ? C.brick : "transparent"}` }}>
      <div>
        <Eyebrow>{etiqueta}</Eyebrow>
        <div style={{ marginTop: 4 }}>{children}</div>
      </div>
      <div>
        <Eyebrow color={resaltar ? C.brick : C.muted}>¿Qué te dijo?</Eyebrow>
        <input value={cita} onChange={e => onCita(e.target.value)}
          placeholder="sus palabras, tal cual"
          style={{ marginTop: 4, width: "100%", fontSize: 12, padding: "5px 7px", borderRadius: 2,
                   border: `1px solid ${resaltar ? C.brick : C.line}`, background: "#fff", color: C.ink }} />
      </div>
    </div>
  );
}

const inputStyle = { width: "100%", fontSize: 12, padding: "5px 7px", borderRadius: 2, border: `1px solid ${C.line}`, background: "#fff", color: C.ink };

function EditorPersona({ leadId, personaRow, onGuardado }) {
  const inicial = useMemo(() => ({
    motivacion: { valor: personaRow?.motivacion || "", cita: personaRow?.motivacion_cita || "" },
    hogar: { valor: personaRow?.hogar || "", cita: personaRow?.hogar_cita || "" },
    metraje: { min: personaRow?.metraje_min ?? "", max: personaRow?.metraje_max ?? "", cita: personaRow?.metraje_cita || "" },
    tipologia: { valor: personaRow?.tipologia || "", cita: personaRow?.tipologia_cita || "" },
    prioridad: { valor: personaRow?.prioridad || "", cita: personaRow?.prioridad_cita || "" },
    plazo: { valor: personaRow?.plazo_texto || "", cita: personaRow?.plazo_cita || "" },
  }), [personaRow]);

  const [p, setP] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => { setP(inicial); setError(null); }, [inicial]);

  const set = (campo, parte) => (valor) => setP(prev => ({ ...prev, [campo]: { ...prev[campo], [parte]: valor } }));
  const faltan = camposSinCita(p);
  const resaltado = Object.fromEntries(faltan.map(f => [f.campo, true]));

  const guardar = async () => {
    // El chequeo se hace acá y no se delega al CHECK de Postgres porque el mensaje
    // tiene que decir qué falta y por qué sirve, no traer el texto de la base.
    if (faltan.length) {
      setError(faltan.map(f =>
        f.falta === "cita"
          ? `Falta la frase de “${f.etiqueta}”. Si no te acordás de cómo lo dijo, borrá el dato: un buyer persona con tres datos ciertos vale más que uno con seis y dos inventados.`
          : `Guardaste una frase en “${f.etiqueta}” pero no el dato que sostiene.`
      ).join(" "));
      return;
    }
    setGuardando(true); setError(null);
    try {
      await crm.guardarBuyerPersona(leadId, {
        ...p,
        metraje: { min: p.metraje.min === "" ? null : Number(p.metraje.min),
                   max: p.metraje.max === "" ? null : Number(p.metraje.max),
                   cita: p.metraje.cita },
      });
      onGuardado?.();
    } catch (e) {
      setError(e.message);          // ya viene traducido por mensajeDeError
    } finally { setGuardando(false); }
  };

  return (
    <div>
      <CampoConCita etiqueta={ETIQUETAS.motivacion} cita={p.motivacion.cita} onCita={set("motivacion", "cita")} resaltar={resaltado.motivacion}>
        <input value={p.motivacion.valor} onChange={e => set("motivacion", "valor")(e.target.value)} style={inputStyle} placeholder="para qué busca" />
      </CampoConCita>
      <CampoConCita etiqueta={ETIQUETAS.hogar} cita={p.hogar.cita} onCita={set("hogar", "cita")} resaltar={resaltado.hogar}>
        <input value={p.hogar.valor} onChange={e => set("hogar", "valor")(e.target.value)} style={inputStyle} placeholder="quiénes son" />
      </CampoConCita>
      <CampoConCita etiqueta={ETIQUETAS.metraje} cita={p.metraje.cita} onCita={set("metraje", "cita")} resaltar={resaltado.metraje}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="number" value={p.metraje.min} onChange={e => set("metraje", "min")(e.target.value)} style={inputStyle} placeholder="mín" />
          <span style={{ fontSize: 11, color: C.muted }}>a</span>
          <input type="number" value={p.metraje.max} onChange={e => set("metraje", "max")(e.target.value)} style={inputStyle} placeholder="máx" />
          <span style={{ fontSize: 11, color: C.muted }}>m²</span>
        </div>
      </CampoConCita>
      <CampoConCita etiqueta={ETIQUETAS.tipologia} cita={p.tipologia.cita} onCita={set("tipologia", "cita")} resaltar={resaltado.tipologia}>
        <input value={p.tipologia.valor} onChange={e => set("tipologia", "valor")(e.target.value)} style={inputStyle} placeholder="townhouse · flat · dúplex" />
      </CampoConCita>
      <CampoConCita etiqueta={ETIQUETAS.prioridad} cita={p.prioridad.cita} onCita={set("prioridad", "cita")} resaltar={resaltado.prioridad}>
        <select value={p.prioridad.valor} onChange={e => set("prioridad", "valor")(e.target.value)} style={inputStyle}>
          {PRIORIDAD_OPCIONES.map(o => <option key={o.valor} value={o.valor}>{o.label}</option>)}
        </select>
      </CampoConCita>
      <CampoConCita etiqueta={ETIQUETAS.plazo} cita={p.plazo.cita} onCita={set("plazo", "cita")} resaltar={resaltado.plazo}>
        {/* Texto libre y no meses: la gente dice "antes de fin de año". La base guarda
            la frase; el número sale de ahí solo cuando es inequívoco. */}
        <input value={p.plazo.valor} onChange={e => set("plazo", "valor")(e.target.value)} style={inputStyle} placeholder="cuándo quiere mudarse" />
      </CampoConCita>

      {error && <div style={{ fontSize: 11.5, color: C.brick, marginBottom: 8, lineHeight: 1.5 }}>{error}</div>}
      <Boton onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</Boton>
    </div>
  );
}

function Hilo({ ficha }) {
  if (!ficha.timeline.length) {
    return <div style={{ fontSize: 12.5, color: C.muted }}>Sin actividad registrada todavía.</div>;
  }
  return (
    <div>
      {ficha.timeline.map(e => (
        <div key={e.id} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${C.lineSoft}` }}>
          <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
            <Eyebrow color={e.tipo === "handoff" ? C.brick : C.muted}>
              {e.tipo === "mensaje" ? (e.direccion === "entrante" ? "Prospecto" : "Mica") : e.tipo}
            </Eyebrow>
            <span style={{ fontSize: 10, color: C.muted }}>{hace(e.createdAt)}</span>
          </div>
          {e.texto && <div style={{ fontSize: 12.5, color: C.ink, marginTop: 3, whiteSpace: "pre-wrap" }}>{e.texto}</div>}
        </div>
      ))}
    </div>
  );
}

// ── la vista ────────────────────────────────────────────────────────────────

export default function CrmView({ metabaseUrl = null }) {
  const { user } = useAuth();
  const yo = user?.id || null;

  const [leads, setLeads] = useState([]);
  const [estado, setEstado] = useState("cargando");   // cargando · listo · error
  const [errorCarga, setErrorCarga] = useState(null);
  const [filtros, setFiltros] = useState({ temperatura: null, aliceId: null });
  const [seleccionId, setSeleccionId] = useState(null);
  const [fichaCruda, setFichaCruda] = useState(null);
  const [tab, setTab] = useState("dossier");          // dossier · editar · hilo

  const cargar = useCallback(async () => {
    setEstado("cargando");
    try {
      setLeads(await crm.getLeads());
      setEstado("listo");
    } catch (e) { setErrorCarga(e.message); setEstado("error"); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Realtime: el que escribe es el brain, en otra máquina. Sin esto José se entera de
  // un lead caliente recién cuando recarga, y lo que se pierde es el momento (§1).
  useEffect(() => crm.subscribeLeads(({ type, lead, id }) => {
    setLeads(prev => {
      if (type === "DELETE") return prev.filter(l => l.id !== id);
      const resto = prev.filter(l => l.id !== lead.id);
      return [...resto, lead];
    });
  }), []);

  const cargarFicha = useCallback(async (leadId) => {
    setFichaCruda(null);
    try { setFichaCruda(await crm.getFicha(leadId)); }
    catch (e) { setErrorCarga(e.message); }
  }, []);

  useEffect(() => { if (seleccionId) cargarFicha(seleccionId); }, [seleccionId, cargarFicha]);

  const visibles = useMemo(() => ordenarBandeja(filtrarBandeja(leads, filtros)), [leads, filtros]);
  const conteo = useMemo(() => contarPorTemperatura(leads), [leads]);
  const ficha = useMemo(() => armarFicha({
    lead: fichaCruda?.lead || null, personaRow: fichaCruda?.personaRow || null,
    eventos: fichaCruda?.eventos || null, yo,
  }), [fichaCruda, yo]);

  useERPContext("crm", () => ({
    title: "CRM · bandeja de leads",
    entity: ficha.lead ? { type: "lead", id: ficha.lead.id } : null,
    state: { visibles: visibles.length, hot: conteo.hot, tibio: conteo.tibio, frio: conteo.frio },
    actions: [],
  }));

  const tomar = async () => {
    const anterior = ficha.lead?.aliceId || null;
    await crm.tomarLead(ficha.lead.id, yo, anterior);
    await cargarFicha(ficha.lead.id);
    cargar();
  };

  const descartar = async () => {
    const motivo = window.prompt("¿Por qué se cae el lead? (queda en la línea de tiempo)");
    if (motivo === null) return;
    await crm.descartarLead(ficha.lead.id, motivo, yo);
    await cargarFicha(ficha.lead.id);
    cargar();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: C.bg }}>
      {/* cabecera */}
      <div style={{ padding: "14px 20px 10px", borderBottom: `1px solid ${C.line}`, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <Eyebrow>Comercial · Jose Torres</Eyebrow>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.ink, marginTop: 2 }}>CRM · Leads de Mica</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {["hot", "tibio", "frio"].map(t => (
            <button key={t} onClick={() => setFiltros(f => ({ ...f, temperatura: f.temperatura === t ? null : t }))}
              style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, padding: "4px 9px", borderRadius: 2,
                       cursor: "pointer", background: filtros.temperatura === t ? C.surface : "transparent",
                       border: `1px solid ${filtros.temperatura === t ? TEMP[t].color : C.line}`, color: C.inkSoft }}>
              {(() => { const I = TEMP[t].Icon; return <I size={11} color={TEMP[t].color} />; })()}
              {TEMP[t].label} <strong>{conteo[t]}</strong>
            </button>
          ))}
          <button onClick={() => setFiltros(f => ({ ...f, aliceId: f.aliceId === SIN_DUENO ? null : SIN_DUENO }))}
            style={{ fontSize: 11, padding: "4px 9px", borderRadius: 2, cursor: "pointer", color: C.inkSoft,
                     background: filtros.aliceId === SIN_DUENO ? C.surface : "transparent",
                     border: `1px solid ${filtros.aliceId === SIN_DUENO ? C.brick : C.line}` }}>
            Sin dueño
          </button>
          <button onClick={cargar} title="Refrescar"
            style={{ border: `1px solid ${C.line}`, background: "transparent", borderRadius: 2, padding: "4px 7px", cursor: "pointer" }}>
            <RefreshCw size={12} color={C.muted} />
          </button>
          {metabaseUrl && (
            <a href={metabaseUrl} target="_blank" rel="noopener noreferrer"
               style={{ fontSize: 10, color: C.muted, textDecoration: "none", border: `1px solid ${C.line}`, borderRadius: 3, padding: "4px 10px" }}>
              Metabase ↗
            </a>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* bandeja */}
        <div style={{ width: 300, borderRight: `1px solid ${C.line}`, overflowY: "auto", flexShrink: 0, background: C.paper }}>
          {estado === "cargando" && <div style={{ padding: 16, fontSize: 12, color: C.muted }}>Cargando…</div>}
          {estado === "error" && (
            <div style={{ padding: 16, fontSize: 12, color: C.brick, lineHeight: 1.5 }}>
              {errorCarga}
              <div style={{ marginTop: 8 }}><Boton ghost onClick={cargar}>Reintentar</Boton></div>
            </div>
          )}
          {/* Estado vacío honesto: no hay leads de mentira para que la pantalla se vea
              llena. Si no entró nadie, lo que corresponde es decirlo. */}
          {estado === "listo" && visibles.length === 0 && (
            <div style={{ padding: 16, fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
              {leads.length === 0
                ? "Todavía no entró ningún lead. Cuando Mica atienda una conversación, aparece acá."
                : "Ningún lead con esos filtros."}
            </div>
          )}
          {visibles.map(l => (
            <FilaLead key={l.id} lead={l} activo={l.id === seleccionId} onClick={() => { setSeleccionId(l.id); setTab("dossier"); }} />
          ))}
        </div>

        {/* ficha */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>
          {!seleccionId && (
            <div style={{ fontSize: 12.5, color: C.muted, marginTop: 40, textAlign: "center" }}>
              Elegí un lead de la bandeja.
            </div>
          )}
          {seleccionId && !fichaCruda && <div style={{ fontSize: 12, color: C.muted }}>Cargando ficha…</div>}
          {seleccionId && fichaCruda && ficha.lead && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 19, fontWeight: 600, color: C.ink, letterSpacing: "-0.012em" }}>
                    {ficha.lead.nombre || ficha.lead.telefono || "Sin nombre"}
                  </div>
                  <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3 }}>
                    {CANAL_LABEL[ficha.lead.canal] || ficha.lead.canal}
                    {ficha.lead.telefono ? ` · ${ficha.lead.telefono}` : ""}
                    {ficha.lead.correo ? ` · ${ficha.lead.correo}` : ""}
                    {ficha.lead.proyectoId ? ` · ${ficha.lead.proyectoId}` : ""}
                    {` · ${ficha.lead.etapa}`}
                    {ficha.lead.aliceId ? ` · de ${ficha.lead.aliceId}` : " · sin dueño"}
                  </div>
                  {/* La frase que disparó el pase. Va arriba de todo porque es lo que
                      José necesita leer antes de escribir el primer mensaje (§7). */}
                  {ficha.lead.temperaturaCita && (
                    <div style={{ fontSize: 12.5, color: C.inkSoft, marginTop: 8, fontStyle: "italic",
                                  borderLeft: `2px solid ${TEMP[ficha.lead.temperatura]?.color || C.line}`, paddingLeft: 10 }}>
                      “{ficha.lead.temperaturaCita}”
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  {ficha.tomable && <Boton onClick={tomar}><UserPlus size={11} style={{ verticalAlign: -1, marginRight: 4 }} />Tomar</Boton>}
                  {!ficha.lead.descartadoAt && <Boton ghost onClick={descartar}><XCircle size={11} style={{ verticalAlign: -1, marginRight: 4 }} />Se cayó</Boton>}
                </div>
              </div>

              {ficha.lead.descartadoAt && (
                <div style={{ fontSize: 11.5, color: C.brick, marginBottom: 12 }}>
                  Descartado · {ficha.lead.descartadoMotivo || "sin motivo"}
                </div>
              )}

              <div style={{ display: "flex", gap: 14, borderBottom: `1px solid ${C.line}`, marginBottom: 14 }}>
                {[["dossier", "Dossier"], ["editar", "Cargar datos"], ["hilo", "Conversación"]].map(([id, label]) => (
                  <button key={id} onClick={() => setTab(id)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: "0 0 8px",
                             fontSize: 12, fontWeight: tab === id ? 600 : 400, color: tab === id ? C.ink : C.muted,
                             borderBottom: `2px solid ${tab === id ? C.navy : "transparent"}` }}>
                    {label}
                  </button>
                ))}
              </div>

              {tab === "dossier" && <Dossier ficha={ficha} />}
              {tab === "editar" && (
                <EditorPersona leadId={ficha.lead.id} personaRow={fichaCruda.personaRow}
                               onGuardado={() => { cargarFicha(ficha.lead.id); setTab("dossier"); }} />
              )}
              {tab === "hilo" && <Hilo ficha={ficha} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Exportado para el stock: todo monto sale con su moneda al lado. `rental_comps` está
// en PEN y el CRM en USD, y no hay tipo de cambio en el sistema — un número pelado en
// la misma pantalla que un comp de alquiler es dos monedas mezcladas sin avisar.
export function PrecioUnidad({ unidad }) {
  return <span style={{ fontSize: 12.5, color: C.ink }}>{fmtMonto(unidad?.precio_lista, unidad?.moneda)}</span>;
}
