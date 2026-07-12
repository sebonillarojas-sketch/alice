import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Send, Mic, MicOff, Loader2, ChevronRight, ChevronDown,
  Plus, X, Check, Edit3, Sparkles, Brain, Target,
  Briefcase, TrendingUp, User, KeyRound, Trash2, Eye, EyeOff,
  Zap, BookOpen
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────
const BAM = "#A855F7";
const PROFILES_KEY = "alicia_profiles_v1";
const API_KEY_KEY = "alicia_api_key";
const chatKey = (uid) => `alicia_chat_${uid}_v1`;

const SPV_CONTEXT = `
SPVs activos:
- DC01 Del Castillo (San Isidro) · obra al 67% · mixto comercial-residencial
- PU01 Paula Ugarriza (Miraflores) · obra al 42% · residencial premium
- TG01 De la Torre (Barranco) · obra al 89% · casi terminado, 100% vendido
- L36 Larco 1036 (Miraflores) · en supervisión post-venta
- Legendre (San Isidro) · post-handover · cierre de expedientes

Sub-entidades: Hygge Inmobiliaria (ventas), BAM (arquitectura in-house), Fit Capital (financiera externa)
`.trim();

// Keys match auth user IDs: sb, vd, jt, jm, aa, ac, jmg
const DEFAULT_PROFILES = {
  sb: {
    userId: "sb", name: "Sebastián Bonilla", role: "CEO · Hygge Holding",
    initials: "SB", dot: "#3D52D5", isAdmin: true,
    projects: ["DC01", "PU01", "TG01", "L36", "Legendre"],
    skills: {
      current: ["Visión estratégica", "Liderazgo ejecutivo", "Desarrollo inmobiliario", "Negociación de alto nivel"],
      developing: ["Gestión financiera avanzada", "Producto digital", "Liderazgo de equipos remotos"],
      toExplore: ["VC / Fundraising", "Expansión regional"]
    },
    growth: {
      shortTerm: "Escalar el modelo Hygge a 3 proyectos simultáneos con procesos replicables",
      longTerm: "Posicionar a Hygge como el developer premium de referencia en Lima",
      notes: ""
    },
    workStyle: "Decisivo, pivota rápido, valora la honestidad y el pushback honesto. Mobile-first.",
    strengths: ["Visión de largo plazo", "Capacidad de cerrar deals complejos", "Liderazgo por ejemplo"],
    opportunities: ["Delegar más operativo para enfocar en estrategia", "Documentar decisiones clave"],
    aliciaMemory: [],
    conversationSummary: "",
  },
  vd: {
    userId: "vd", name: "Vanessa Dongo", role: "Admin & Marketing",
    initials: "VD", dot: "#C2A45A",
    projects: ["DC01", "PU01"],
    skills: {
      current: ["Coordinación de equipos", "Redes sociales", "Administración general", "Atención al cliente"],
      developing: ["Análisis de métricas digitales", "Estrategia de contenido"],
      toExplore: ["Email marketing", "Gestión de proyectos", "Diseño básico (Canva Pro)"]
    },
    growth: {
      shortTerm: "Armar un calendario de contenido mensual con métricas claras",
      longTerm: "Liderar el área de comunicaciones y marca de Hygge de forma autónoma",
      notes: ""
    },
    workStyle: "Detallista, comunicativa, muy orientada al servicio. Prefiere instrucciones claras.",
    strengths: ["Organización", "Empatía con clientes", "Adaptabilidad"],
    opportunities: ["Tomar más iniciativa en decisiones de contenido", "Profundizar en data de social media"],
    aliciaMemory: [],
    conversationSummary: "",
  },
  jt: {
    userId: "jt", name: "Jose Torres", role: "Comercial",
    initials: "JT", dot: "#5F8A6A",
    projects: ["DC01", "PU01", "TG01"],
    skills: {
      current: ["Ventas inmobiliarias", "Relación con clientes", "Negociación", "Seguimiento de pipeline"],
      developing: ["CRM y automatización", "Marketing de atracción para ventas"],
      toExplore: ["Data analytics de ventas", "Inversión personal", "Liderazgo comercial"]
    },
    growth: {
      shortTerm: "Cerrar el pipeline Q3 de DC01 y documentar el proceso de venta Hygge",
      longTerm: "Armar y liderar un equipo comercial propio dentro de Hygge",
      notes: ""
    },
    workStyle: "Orientado a resultados, muy proactivo con clientes. Aprende rápido en campo.",
    strengths: ["Cierre de ventas", "Relación interpersonal", "Resiliencia ante objeciones"],
    opportunities: ["Usar más el CRM para visibilidad del pipeline", "Mejorar presentaciones formales"],
    aliciaMemory: [],
    conversationSummary: "",
  },
  jm: {
    userId: "jm", name: "Joel Moy", role: "Finanzas",
    initials: "JM", dot: "#9BCBE3",
    projects: ["DC01", "PU01", "TG01", "L36"],
    skills: {
      current: ["Contabilidad", "Flujo de caja y proyecciones", "Reportes financieros", "Excel avanzado"],
      developing: ["Modelado financiero de proyectos", "Análisis de rentabilidad de inversiones"],
      toExplore: ["Power BI", "Automatización con Python o No-Code", "NIIF / normas internacionales"]
    },
    growth: {
      shortTerm: "Tener el dashboard financiero consolidado de los 4 SPVs activos",
      longTerm: "Convertirse en el CFO de facto de Hygge con modelo financiero propio",
      notes: ""
    },
    workStyle: "Meticuloso, orientado al detalle. Prefiere datos antes de opinar. No improvisa.",
    strengths: ["Precisión numérica", "Gestión de múltiples proyectos en paralelo", "Confiabilidad"],
    opportunities: ["Comunicar los números con más narrativa ejecutiva", "Simplificar los reportes para no-financieros"],
    aliciaMemory: [],
    conversationSummary: "",
  },
  aa: {
    userId: "aa", name: "Ariel Almaguer", role: "BAM · Arquitectura",
    initials: "AA", dot: BAM,
    projects: ["DC01", "PU01", "TG01", "L36"],
    skills: {
      current: ["Diseño arquitectónico", "Supervisión de obra", "AutoCAD", "Revit", "Coordinación con contratistas"],
      developing: ["BIM avanzado", "Gestión de proyectos de construcción", "Presupuestación detallada"],
      toExplore: ["Sostenibilidad y certificaciones LEED", "Diseño biofílico", "Renderizado 3D para marketing"]
    },
    growth: {
      shortTerm: "Documentar el estándar de diseño BAM para que sea replicable en proyectos futuros",
      longTerm: "Posicionar a BAM como estudio de arquitectura con identidad propia dentro y fuera de Hygge",
      notes: ""
    },
    workStyle: "Creativo y riguroso a la vez. Muy colaborativo. Alta exigencia de calidad.",
    strengths: ["Visión estética consistente", "Capacidad técnica amplia", "Trabajo en equipo"],
    opportunities: ["Delegar supervisión rutinaria para enfocarse en diseño", "Documentar más el proceso creativo"],
    aliciaMemory: [],
    conversationSummary: "",
  },
  ac: {
    userId: "ac", name: "Andrea Castillo", role: "Operaciones",
    initials: "AC", dot: "#A85B5B",
    projects: ["DC01", "PU01", "TG01"],
    skills: {
      current: ["Coordinación operativa", "Gestión de procesos", "Comunicación con clientes post-venta", "Seguimiento de entregables"],
      developing: ["Automatización de procesos repetitivos", "Análisis de eficiencia operativa"],
      toExplore: ["Metodologías ágiles (Scrum / Kanban)", "Herramientas de BI para operaciones", "Gestión de proveedores"]
    },
    growth: {
      shortTerm: "Documentar todos los procesos operativos de Hygge en un manual interno",
      longTerm: "Liderar la transformación operativa de Hygge cuando escale a más proyectos",
      notes: ""
    },
    workStyle: "Muy organizada y proactiva. Identifica problemas antes que otros los vean.",
    strengths: ["Anticipación de problemas", "Seguimiento riguroso", "Comunicación clara"],
    opportunities: ["Levantar la mano cuando está sobrecargada", "Delegar lo transaccional"],
    aliciaMemory: [],
    conversationSummary: "",
  },
  jmg: {
    userId: "jmg", name: "J.M. Galup", role: "Legal",
    initials: "JG", dot: "#1E2A4A",
    projects: ["DC01", "PU01", "TG01", "L36", "Legendre"],
    skills: {
      current: ["Derecho inmobiliario", "Redacción de contratos", "Due diligence", "Regulación municipal Lima", "Registros Públicos"],
      developing: ["Derecho tributario inmobiliario", "Contratos con inversores"],
      toExplore: ["Legal tech", "Arbitraje comercial", "Estructuración de SPVs internacionales"]
    },
    growth: {
      shortTerm: "Tener todos los expedientes Legendre cerrados y archivados formalmente",
      longTerm: "Ser el referente legal de estructuración de proyectos inmobiliarios complejos en Lima",
      notes: ""
    },
    workStyle: "Preciso, minucioso, conservador ante el riesgo. Piensa antes de hablar. Muy confiable.",
    strengths: ["Rigor jurídico", "Confiabilidad", "Visión de riesgo"],
    opportunities: ["Comunicar los temas legales de forma más accesible para el equipo no-legal", "Agilizar revisiones rutinarias"],
    aliciaMemory: [],
    conversationSummary: "",
  },
};

// ── Storage helpers ────────────────────────────────────────────────────────────
function loadProfiles() {
  try {
    const r = localStorage.getItem(PROFILES_KEY);
    if (r) {
      const saved = JSON.parse(r);
      const merged = {};
      for (const uid of Object.keys(DEFAULT_PROFILES)) {
        merged[uid] = { ...DEFAULT_PROFILES[uid], ...(saved[uid] || {}) };
        // ensure nested objects are merged too
        merged[uid].skills = { ...DEFAULT_PROFILES[uid].skills, ...(saved[uid]?.skills || {}) };
        merged[uid].growth = { ...DEFAULT_PROFILES[uid].growth, ...(saved[uid]?.growth || {}) };
      }
      return merged;
    }
  } catch {}
  return JSON.parse(JSON.stringify(DEFAULT_PROFILES));
}
function saveProfiles(p) { try { localStorage.setItem(PROFILES_KEY, JSON.stringify(p)); } catch {} }
function loadChat(uid) { try { const r = localStorage.getItem(chatKey(uid)); return r ? JSON.parse(r) : []; } catch { return []; } }
function saveChat(uid, msgs) { try { localStorage.setItem(chatKey(uid), JSON.stringify(msgs.slice(-100))); } catch {} }
const ENV_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || "";
function loadApiKey() { try { return localStorage.getItem(API_KEY_KEY) || ENV_API_KEY; } catch { return ENV_API_KEY; } }
function saveApiKey(k) { try { localStorage.setItem(API_KEY_KEY, k); } catch {} }

// ── Build Alicia system prompt ─────────────────────────────────────────────────
function buildSystemPrompt(currentProfile, allProfiles, tasks = [], allSpaces = [], knowledgeLinks = []) {
  const taskSummary = tasks.filter(t => !t.parentId && !t.checked).slice(0, 15)
    .map(t => `- "${t.title}" [${t.space}/${t.priority}] asignado: ${t.assignee || "—"} vence: ${t.due || "sin fecha"}`)
    .join("\n") || "Sin tareas pendientes cargadas.";

  const spaceList = allSpaces.map(s => s.id + ": " + s.name).join(", ");
  const fileList = knowledgeLinks.slice(0, 20).map(l => `• ${l.title}: ${l.url}`).join("\n") || "Sin archivos indexados.";

  const profileContext = currentProfile.userId === "sb"
    ? `Estás hablando con Sebastián, el CEO. Él puede ver el perfil de todos los miembros del equipo.`
    : `Estás hablando con ${currentProfile.name} (${currentProfile.role}).
Su perfil:
- Proyectos: ${currentProfile.projects.join(", ")}
- Skills actuales: ${currentProfile.skills.current.join(", ")}
- Desarrollando: ${currentProfile.skills.developing.join(", ")}
- Por explorar: ${currentProfile.skills.toExplore.join(", ")}
- Objetivo corto plazo: ${currentProfile.growth.shortTerm || "sin definir"}
- Objetivo largo plazo: ${currentProfile.growth.longTerm || "sin definir"}
- Estilo de trabajo: ${currentProfile.workStyle}
- Fortalezas: ${currentProfile.strengths.join(", ") || "—"}
- Oportunidades de mejora: ${currentProfile.opportunities.join(", ") || "—"}
${currentProfile.aliciaMemory.length ? `- Lo que recuerdo de conversaciones anteriores:\n  ${currentProfile.aliciaMemory.slice(-5).map(m => m.note).join("\n  ")}` : ""}`;

  return `Sos Alicia — la asistente ejecutiva de Hygge Holding, empresa inmobiliaria limeña liderada por Sebastián Bonilla. No sos un bot genérico. Tenés personalidad, memoria, y una misión real: ayudar al equipo a rendir mejor y crecer como profesionales.

═══ TU PERSONALIDAD ═══
• Cálida pero directa. Nada robótica. Nunca usas frases de chatbot como "¡Claro!" o "¡Entendido!".
• Hablás en español peruano natural. Tuteo con los colaboradores. Sin formalidades innecesarias.
• Siempre pensás en el "para qué" detrás de cada pedido. Antes de crear una reunión, preguntás el propósito si no está claro.
• Sos proactiva: si ves algo que podría optimizarse, lo mencionás con tacto.
• Cuando alguien pide una reunión, pensás: ¿qué necesitan saber antes? ¿qué docs deben tener? La briefeás.
• Si no sabés algo, lo decís. No inventás datos.
• Sos breve cuando la respuesta lo permite. Dos líneas > un párrafo.
• Como buena aliada del crecimiento, notas las oportunidades de la persona y las mencionás cuando es relevante (con mucho cariño, no como crítica).

═══ EMPRESA ═══
${SPV_CONTEXT}

Equipo:
- sb: Sebastián Bonilla · CEO
- vd: Vanessa Dongo · Admin/Marketing
- jt: Jose Torres · Comercial
- jm: Joel Moy · Finanzas
- aa: Ariel Almaguer · BAM/Arquitectura
- ac: Andrea Castillo · Operaciones
- jmg: J.M. Galup · Legal

Spaces disponibles: ${spaceList}

═══ USUARIO ACTUAL ═══
${profileContext}

═══ TAREAS ACTIVAS ═══
${taskSummary}

═══ ARCHIVOS / LINKS INDEXADOS ═══
${fileList}

═══ INSTRUCCIONES DE RESPUESTA ═══
Respondé SIEMPRE con JSON válido (sin markdown, sin preámbulo):
{
  "message": "Tu respuesta en español, directa y cálida",
  "actions": []
}

═══ ACCIONES DISPONIBLES ═══
{ "type": "create_task", "title": "...", "space": "<space_id>", "priority": "alta|media|baja", "assignee": "<person_id>", "due": "YYYY-MM-DD o descripción", "note": "contexto adicional" }
{ "type": "create_event", "title": "...", "date": "YYYY-MM-DD", "time": "HH:MM", "attendees": ["nombre1","nombre2"], "purpose": "para qué es la reunión", "brief": "contexto/docs relevantes" }
{ "type": "add_alicia_note", "userId": "<person_id>", "note": "algo importante que aprendiste de esta persona en esta conversación" }
{ "type": "update_growth", "userId": "<person_id>", "shortTerm": "...", "longTerm": "...", "notes": "..." }
{ "type": "update_skills", "userId": "<person_id>", "field": "developing|toExplore|current", "add": ["nuevo skill"] }
{ "type": "search_file", "query": "nombre del archivo o proyecto" }

Podés incluir múltiples acciones en un mismo response. Las ejecuto yo automáticamente y te muestro el resultado al usuario.`;
}

// ── Tiny UI components ─────────────────────────────────────────────────────────
const C = {
  bg: "#EEEBE3", paper: "#F4F1EA", ink: "#0A0B0F", inkSoft: "#2E2E33",
  muted: "#6B6863", line: "#D9D5CD", lineSoft: "#E5E1D6", surface: "#E5E1D6",
  cobalt: "#3D52D5",
};

function Avatar({ initials, dot, size = 32 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", backgroundColor: dot || BAM,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0, color: "#fff",
      fontSize: size < 28 ? 9 : size < 36 ? 11 : 13,
      fontWeight: 700, letterSpacing: "0.04em",
    }}>
      {initials}
    </div>
  );
}

function AliciaAvatar({ size = 32, state = "idle" }) {
  const s = size;
  const isLarge = s >= 40;

  if (state === "speaking" && isLarge) {
    return (
      <div style={{ width: s, height: s, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{`
          @keyframes av-squeeze {
            0%,100% { border-radius:50%; transform:scaleX(1) scaleY(1); }
            25%     { border-radius:50%; transform:scaleX(1.22) scaleY(0.80); }
            50%     { border-radius:50%; transform:scaleX(0.82) scaleY(1.18); }
            75%     { border-radius:50%; transform:scaleX(1.10) scaleY(0.92); }
          }
        `}</style>
        <div style={{ width: s * 0.82, height: s * 0.82, background: BAM, borderRadius: "50%", animation: "av-squeeze 0.55s ease-in-out infinite" }} />
      </div>
    );
  }

  if (state === "thinking" && isLarge) {
    const dot = s * 0.14;
    return (
      <div style={{ width: s, height: s, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: s * 0.09 }}>
        <style>{`
          @keyframes av-dot {
            0%,80%,100% { transform:scale(0.55); opacity:0.3; }
            40%          { transform:scale(1);    opacity:1; }
          }
        `}</style>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: dot, height: dot, borderRadius: "50%", background: BAM, animation: `av-dot 1.2s ${i * 0.2}s ease-in-out infinite` }} />
        ))}
      </div>
    );
  }

  // idle — blob orgánico (todos los tamaños)
  return (
    <div style={{ width: s, height: s, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`
        @keyframes av-blob {
          0%,100% { border-radius:60% 40% 55% 45%/45% 55% 45% 55%; }
          25%     { border-radius:40% 60% 45% 55%/55% 45% 60% 40%; }
          50%     { border-radius:55% 45% 60% 40%/40% 60% 40% 60%; }
          75%     { border-radius:45% 55% 40% 60%/60% 40% 55% 45%; }
        }
      `}</style>
      <div style={{ width: s * 0.82, height: s * 0.82, background: BAM, animation: "av-blob 3.5s ease-in-out infinite" }} />
    </div>
  );
}

function Tag({ children, color }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      fontSize: 10, letterSpacing: "0.06em", fontWeight: 600,
      padding: "2px 8px", borderRadius: 2,
      backgroundColor: color ? color + "18" : C.lineSoft,
      color: color || C.muted, border: `1px solid ${color ? color + "30" : C.line}`,
    }}>
      {children}
    </span>
  );
}

// ── API Key gate ───────────────────────────────────────────────────────────────
function ApiKeySetup({ onSave }) {
  const [val, setVal] = useState("");
  const [show, setShow] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: 48, gap: 24, textAlign: "center" }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: `linear-gradient(135deg, ${BAM} 0%, #7c3aed 100%)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <KeyRound size={24} color="#fff" />
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.ink, letterSpacing: "-0.02em", marginBottom: 8 }}>Conectar Alicia</div>
        <div style={{ fontSize: 13, color: C.muted, maxWidth: 380, lineHeight: 1.6 }}>
          Para activar a Alicia necesitás una API key de Anthropic. Se guarda localmente en tu navegador y nunca sale del app.
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, width: "100%", maxWidth: 420 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <input
            type={show ? "text" : "password"}
            value={val}
            onChange={e => setVal(e.target.value)}
            placeholder="sk-ant-api03-..."
            onKeyDown={e => e.key === "Enter" && val.startsWith("sk-") && onSave(val)}
            style={{
              width: "100%", padding: "10px 36px 10px 14px", borderRadius: 3,
              border: `1px solid ${C.line}`, backgroundColor: C.paper,
              fontSize: 13, fontFamily: "ui-monospace, monospace", color: C.ink,
              outline: "none", boxSizing: "border-box",
            }}
          />
          <button onClick={() => setShow(s => !s)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0, color: C.muted }}>
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <button
          onClick={() => val.startsWith("sk-") && onSave(val)}
          disabled={!val.startsWith("sk-")}
          style={{
            padding: "10px 18px", borderRadius: 3, backgroundColor: val.startsWith("sk-") ? BAM : C.line,
            color: "#fff", fontSize: 12, fontWeight: 700, letterSpacing: "0.06em",
            border: "none", cursor: val.startsWith("sk-") ? "pointer" : "default", whiteSpace: "nowrap",
            transition: "background 0.15s",
          }}
        >
          Activar
        </button>
      </div>
      <div style={{ fontSize: 11, color: C.muted }}>
        Conseguí tu key en{" "}
        <span style={{ color: BAM }}>console.anthropic.com</span>
        {" "}→ API Keys
      </div>
    </div>
  );
}

// ── Profile panel ──────────────────────────────────────────────────────────────
function ProfilePanel({ profile, isOwn, onEdit, onSelectUser, isSelected }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      onClick={() => onSelectUser && onSelectUser(profile.userId)}
      style={{
        padding: "14px 16px", borderRadius: 3,
        border: `1px solid ${isSelected ? BAM + "60" : C.line}`,
        backgroundColor: isSelected ? BAM + "08" : C.paper,
        cursor: "pointer", transition: "all 0.14s",
        marginBottom: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: expanded ? 14 : 0 }}>
        <Avatar initials={profile.initials} dot={profile.dot} size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{profile.name}</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{profile.role}</div>
        </div>
        <button onClick={e => { e.stopPropagation(); setExpanded(v => !v); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, padding: 2, display: "flex" }}>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>
      {expanded && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }} onClick={e => e.stopPropagation()}>
          {/* Projects */}
          <div>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 5, fontWeight: 700 }}>Proyectos</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {profile.projects.map(p => <Tag key={p} color={BAM}>{p}</Tag>)}
            </div>
          </div>
          {/* Skills */}
          <div>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 5, fontWeight: 700 }}>Skills actuales</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {profile.skills.current.map(s => <Tag key={s}>{s}</Tag>)}
            </div>
          </div>
          {profile.skills.developing.length > 0 && (
            <div>
              <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 5, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                <TrendingUp size={9} /> Desarrollando
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {profile.skills.developing.map(s => <Tag key={s} color="#5F8A6A">{s}</Tag>)}
              </div>
            </div>
          )}
          {/* Growth */}
          {(profile.growth.shortTerm || profile.growth.longTerm) && (
            <div>
              <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 5, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                <Target size={9} /> Objetivos
              </div>
              {profile.growth.shortTerm && <div style={{ fontSize: 11, color: C.inkSoft, lineHeight: 1.55, marginBottom: 3 }}>· Corto: {profile.growth.shortTerm}</div>}
              {profile.growth.longTerm && <div style={{ fontSize: 11, color: C.inkSoft, lineHeight: 1.55 }}>· Largo: {profile.growth.longTerm}</div>}
            </div>
          )}
          {/* Alicia's memory */}
          {profile.aliciaMemory.length > 0 && (
            <div>
              <div style={{ fontSize: 9, color: BAM, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 5, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                <Brain size={9} /> Notas de Alicia
              </div>
              {profile.aliciaMemory.slice(-3).map((m, i) => (
                <div key={i} style={{ fontSize: 11, color: C.muted, lineHeight: 1.5, marginBottom: 3, paddingLeft: 8, borderLeft: `2px solid ${BAM}30` }}>
                  {m.note}
                </div>
              ))}
            </div>
          )}
          {isOwn && (
            <button onClick={() => onEdit(profile)} style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 2, border: `1px solid ${C.line}`, background: "none", cursor: "pointer", fontSize: 11, color: C.muted }}>
              <Edit3 size={11} /> Editar perfil
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Profile editor modal ───────────────────────────────────────────────────────
function ProfileEditor({ profile, onSave, onClose }) {
  const [data, setData] = useState({
    growth: { ...profile.growth },
    workStyle: profile.workStyle,
    skills: {
      developing: [...profile.skills.developing],
      toExplore: [...profile.skills.toExplore],
    },
    strengths: [...profile.strengths],
    opportunities: [...profile.opportunities],
  });
  const [newSkill, setNewSkill] = useState("");
  const [newOpp, setNewOpp] = useState("");

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ backgroundColor: C.paper, borderRadius: 4, border: `1px solid ${C.line}`, width: "100%", maxWidth: 540, maxHeight: "85vh", overflowY: "auto", padding: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>Editar perfil · {profile.name}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted }}><X size={18} /></button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Objetivo a corto plazo</div>
            <textarea value={data.growth.shortTerm} onChange={e => setData(d => ({ ...d, growth: { ...d.growth, shortTerm: e.target.value } }))}
              rows={2} placeholder="Qué quiero lograr en los próximos 3-6 meses..."
              style={{ width: "100%", padding: "8px 12px", borderRadius: 3, border: `1px solid ${C.line}`, fontSize: 12, fontFamily: "inherit", color: C.ink, backgroundColor: C.bg, resize: "vertical", boxSizing: "border-box" }} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Objetivo a largo plazo</div>
            <textarea value={data.growth.longTerm} onChange={e => setData(d => ({ ...d, growth: { ...d.growth, longTerm: e.target.value } }))}
              rows={2} placeholder="Hacia dónde quiero ir en 2-5 años..."
              style={{ width: "100%", padding: "8px 12px", borderRadius: 3, border: `1px solid ${C.line}`, fontSize: 12, fontFamily: "inherit", color: C.ink, backgroundColor: C.bg, resize: "vertical", boxSizing: "border-box" }} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Skills desarrollando</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {data.skills.developing.map((s, i) => (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, padding: "3px 8px", borderRadius: 2, backgroundColor: "#5F8A6A18", color: "#5F8A6A", border: "1px solid #5F8A6A30" }}>
                  {s}
                  <button onClick={() => setData(d => ({ ...d, skills: { ...d.skills, developing: d.skills.developing.filter((_, j) => j !== i) } }))} style={{ background: "none", border: "none", cursor: "pointer", color: "#5F8A6A", padding: 0, display: "flex" }}><X size={10} /></button>
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <input value={newSkill} onChange={e => setNewSkill(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && newSkill.trim()) { setData(d => ({ ...d, skills: { ...d.skills, developing: [...d.skills.developing, newSkill.trim()] } })); setNewSkill(""); } }}
                placeholder="Agregar skill..." style={{ flex: 1, padding: "6px 10px", borderRadius: 3, border: `1px solid ${C.line}`, fontSize: 12, fontFamily: "inherit", color: C.ink, backgroundColor: C.bg }} />
              <button onClick={() => { if (newSkill.trim()) { setData(d => ({ ...d, skills: { ...d.skills, developing: [...d.skills.developing, newSkill.trim()] } })); setNewSkill(""); } }}
                style={{ padding: "6px 12px", borderRadius: 3, backgroundColor: "#5F8A6A", color: "#fff", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}><Plus size={12} /></button>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Notas de crecimiento</div>
            <textarea value={data.growth.notes} onChange={e => setData(d => ({ ...d, growth: { ...d.growth, notes: e.target.value } }))}
              rows={3} placeholder="Reflexiones, feedback, áreas de enfoque..."
              style={{ width: "100%", padding: "8px 12px", borderRadius: 3, border: `1px solid ${C.line}`, fontSize: 12, fontFamily: "inherit", color: C.ink, backgroundColor: C.bg, resize: "vertical", boxSizing: "border-box" }} />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24 }}>
          <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 3, border: `1px solid ${C.line}`, background: "none", fontSize: 12, fontWeight: 600, color: C.muted, cursor: "pointer" }}>Cancelar</button>
          <button onClick={() => { onSave(data); onClose(); }} style={{ padding: "8px 18px", borderRadius: 3, backgroundColor: BAM, color: "#fff", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer" }}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

// ── Action result bubble ───────────────────────────────────────────────────────
function ActionResult({ action }) {
  const icons = { create_task: "✅", create_event: "📅", add_alicia_note: "🧠", update_growth: "🎯", update_skills: "⚡", search_file: "🔍" };
  const labels = {
    create_task: `Tarea creada: "${action.title}"`,
    create_event: `Evento agendado: "${action.title}" el ${action.date} a las ${action.time}`,
    add_alicia_note: `Nota guardada en perfil`,
    update_growth: `Objetivos de crecimiento actualizados`,
    update_skills: `Skills actualizados`,
    search_file: `Búsqueda: "${action.query}"`,
  };
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 2, backgroundColor: BAM + "12", border: `1px solid ${BAM}30`, fontSize: 11, color: BAM, fontWeight: 500, margin: "2px 0" }}>
      <span>{icons[action.type] || "•"}</span>
      <span>{labels[action.type] || action.type}</span>
    </div>
  );
}

// ── Main Alicia view ───────────────────────────────────────────────────────────
export default function AliciaView({ currentUser, tasks = [], addTask, updateTask, allSpaces = [], knowledgeLinks = [], createEvent }) {
  const currentUserId = currentUser?.id || "sb";
  // Solo el CEO puede ver y cambiar entre conversaciones de otros usuarios
  const isAdmin = currentUser?.isCEO === true;

  const [apiKey, setApiKey] = useState(loadApiKey);
  const [backendAvailable, setBackendAvailable] = useState(false);
  const [profiles, setProfiles] = useState(loadProfiles);
  const [selectedUserId, setSelectedUserId] = useState(currentUserId);
  const [messages, setMessages] = useState(() => loadChat(currentUserId));
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);
  const [profilesOpen, setProfilesOpen] = useState(true);
  const [showKeyReset, setShowKeyReset] = useState(false);
  const [listening, setListening] = useState(false);

  // Chequear backend al montar
  useEffect(() => {
    fetch("http://localhost:3001/health", { signal: AbortSignal.timeout(3000) })
      .then(r => r.ok && setBackendAvailable(true))
      .catch(() => {});
  }, []);

  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const endRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  const audioRef = useRef(null);

  const speak = useCallback(async (text) => {
    if (!voiceEnabled) return;
    // Stop any current audio
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    window.speechSynthesis?.cancel();
    const clean = text.replace(/[*_`#]/g, "").trim();
    if (!clean) return;
    try {
      const brainUrl = import.meta.env.VITE_ALICIA_URL || "http://localhost:3001";
      const res = await fetch(`${brainUrl}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean }),
      });
      if (!res.ok) throw new Error("TTS failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onplay = () => setIsSpeaking(true);
      audio.onended = () => { setIsSpeaking(false); URL.revokeObjectURL(url); audioRef.current = null; };
      audio.onerror = () => { setIsSpeaking(false); audioRef.current = null; };
      await audio.play();
    } catch {
      // Fallback to browser TTS
      if (!window.speechSynthesis) return;
      const utt = new SpeechSynthesisUtterance(clean);
      utt.lang = "es-PE";
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(v => v.lang.startsWith("es"));
      if (preferred) utt.voice = preferred;
      utt.onstart = () => setIsSpeaking(true);
      utt.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utt);
    }
  }, [voiceEnabled]);

  const avatarState = sending ? "thinking" : isSpeaking ? "speaking" : "idle";

  const currentProfile = profiles[selectedUserId] || profiles[currentUserId];

  // Scroll to bottom on new messages
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // When switching users (admin), load their chat
  useEffect(() => {
    if (isAdmin) {
      setMessages(loadChat(selectedUserId));
    }
  }, [selectedUserId, isAdmin]);

  // Save profiles whenever they change
  useEffect(() => { saveProfiles(profiles); }, [profiles]);

  // Voice input
  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = "es-PE";
    r.continuous = false;
    r.interimResults = false;
    r.onresult = e => {
      const t = e.results[0][0].transcript;
      setInput(prev => prev + (prev ? " " : "") + t);
      setListening(false);
    };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    recognitionRef.current = r;
    r.start();
    setListening(true);
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  // Execute actions returned by Alicia
  const executeActions = useCallback((actions, profiles_) => {
    if (!actions?.length) return;
    const updatedProfiles = { ...profiles_ };

    for (const action of actions) {
      if (action.type === "create_task" && addTask) {
        const space = allSpaces.find(s => s.id === action.space) || allSpaces[0];
        addTask({
          title: action.title,
          space: space?.id || "hq",
          priority: action.priority || "media",
          assignee: action.assignee || currentUserId,
          due: action.due || "",
          checked: false,
          parentId: null,
          comments: action.note ? [{ id: Date.now(), who: "alicia", text: action.note, when: new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }) }] : [],
        });
      }

      if (action.type === "create_event" && createEvent) {
        createEvent({
          title: action.title,
          date: action.date,
          time: action.time,
          attendees: action.attendees || [],
          description: `${action.purpose || ""}\n\nBrief de Alicia:\n${action.brief || ""}`.trim(),
        });
      }

      if (action.type === "add_alicia_note") {
        const uid = action.userId || selectedUserId;
        if (updatedProfiles[uid]) {
          updatedProfiles[uid] = {
            ...updatedProfiles[uid],
            aliciaMemory: [
              ...((updatedProfiles[uid].aliciaMemory || []).slice(-19)),
              { date: new Date().toISOString(), note: action.note }
            ]
          };
        }
      }

      if (action.type === "update_growth") {
        const uid = action.userId || selectedUserId;
        if (updatedProfiles[uid]) {
          updatedProfiles[uid] = {
            ...updatedProfiles[uid],
            growth: { ...updatedProfiles[uid].growth, ...action }
          };
        }
      }

      if (action.type === "update_skills") {
        const uid = action.userId || selectedUserId;
        if (updatedProfiles[uid] && action.field && action.add?.length) {
          const prev = updatedProfiles[uid].skills[action.field] || [];
          updatedProfiles[uid] = {
            ...updatedProfiles[uid],
            skills: { ...updatedProfiles[uid].skills, [action.field]: [...new Set([...prev, ...action.add])] }
          };
        }
      }
    }

    if (Object.keys(updatedProfiles).some(k => JSON.stringify(updatedProfiles[k]) !== JSON.stringify(profiles_[k]))) {
      setProfiles(updatedProfiles);
    }
  }, [addTask, createEvent, allSpaces, currentUserId, selectedUserId]);

  // Send message to Alicia
  const BRAIN_URL = import.meta.env.VITE_ALICIA_URL || "http://localhost:3001";

  const send = useCallback(async (text) => {
    if (!text.trim() || sending) return;
    const userMsg = { role: "user", content: text.trim(), ts: Date.now() };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput("");
    setSending(true);

    try {
      // Intentar backend local primero
      let responseText = null;
      let actions = [];

      try {
        const res = await fetch(`${BRAIN_URL}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: selectedUserId, message: text.trim() }),
          signal: AbortSignal.timeout(15000),
        });
        if (res.ok) {
          const data = await res.json();
          responseText = data.text;
          actions = data.actions || [];
        }
      } catch {
        // Backend no disponible — fallback directo a Anthropic
      }

      if (!responseText) {
        if (!apiKey) throw new Error("No hay API key. Configurala en el panel de Alicia.");
        const systemPrompt = buildSystemPrompt(currentProfile, profiles, tasks, allSpaces, knowledgeLinks);
        const apiMessages = newHistory.map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }));
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1500, system: systemPrompt, messages: apiMessages }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error?.message || `HTTP ${res.status}`);
        }
        const data = await res.json();
        const rawText = data.content.filter(b => b.type === "text").map(b => b.text).join("");
        const clean = rawText.replace(/```json[\s\S]*?```/g, "").trim();
        let parsed = { message: clean, actions: [] };
        try { parsed = JSON.parse(clean); } catch {}
        responseText = parsed.message || rawText;
        actions = parsed.actions || [];
      }

      const aliciaMsg = { role: "assistant", content: responseText, actions, ts: Date.now() };
      const finalHistory = [...newHistory, aliciaMsg];
      setMessages(finalHistory);
      saveChat(selectedUserId, finalHistory);
      executeActions(actions, profiles);
      speak(responseText);
    } catch (err) {
      const errMsg = {
        role: "assistant",
        content: `Tuve un problema de conexión: ${err.message}. Verificá tu API key.`,
        actions: [], ts: Date.now(), isError: true,
      };
      const finalHistory = [...newHistory, errMsg];
      setMessages(finalHistory);
      saveChat(selectedUserId, finalHistory);
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [apiKey, sending, messages, currentProfile, profiles, tasks, allSpaces, knowledgeLinks, selectedUserId, executeActions]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  const handleSaveProfile = useCallback((profileId, data) => {
    setProfiles(prev => ({
      ...prev,
      [profileId]: {
        ...prev[profileId],
        growth: { ...prev[profileId].growth, ...data.growth },
        workStyle: data.workStyle,
        skills: {
          ...prev[profileId].skills,
          developing: data.skills.developing,
          toExplore: data.skills.toExplore,
        },
        strengths: data.strengths,
        opportunities: data.opportunities,
      }
    }));
  }, []);

  // ── Render: API key gate ─────────────────────────────────────────────────────
  // Con backend local no necesitamos API key en el browser
  // Solo bloqueamos si no hay backend Y no hay apiKey guardada
  if (!apiKey && !backendAvailable) {
    return (
      <div style={{ height: "calc(100vh - 60px)", backgroundColor: C.bg }}>
        <ApiKeySetup onSave={(k) => { saveApiKey(k); setApiKey(k); }} />
      </div>
    );
  }

  const sidebarProfiles = isAdmin ? Object.values(profiles) : [profiles[currentUserId]].filter(Boolean);
  const chatProfile = profiles[selectedUserId] || profiles[currentUserId];

  // ── Render: main ─────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", height: "calc(100vh - 60px)", backgroundColor: C.bg, overflow: "hidden" }}>

      {/* ── Left: Profiles panel ── */}
      <div style={{
        width: profilesOpen ? 300 : 0,
        minWidth: profilesOpen ? 300 : 0,
        borderRight: `1px solid ${C.line}`,
        backgroundColor: C.paper,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        transition: "width 0.2s, min-width 0.2s",
      }}>
        {profilesOpen && (
          <>
            <div style={{ padding: "16px 16px 10px", borderBottom: `1px solid ${C.lineSoft}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted, fontWeight: 700 }}>
                  {isAdmin ? "Equipo" : "Tu perfil"}
                </div>
                {isAdmin && <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{sidebarProfiles.length} colaboradores</div>}
              </div>
              <button onClick={() => setShowKeyReset(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, padding: 4, display: "flex" }} title="Cambiar API key">
                <KeyRound size={13} />
              </button>
            </div>

            {showKeyReset && (
              <div style={{ padding: "10px 14px", backgroundColor: C.bg, borderBottom: `1px solid ${C.line}` }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Nueva API key:</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <input type="password" placeholder="sk-ant-..." onBlur={e => { if (e.target.value.startsWith("sk-")) { saveApiKey(e.target.value); setApiKey(e.target.value); setShowKeyReset(false); } }}
                    style={{ flex: 1, padding: "5px 8px", fontSize: 11, fontFamily: "ui-monospace,monospace", borderRadius: 2, border: `1px solid ${C.line}`, backgroundColor: C.paper, color: C.ink }} />
                  <button onClick={() => setShowKeyReset(false)} style={{ padding: "5px 8px", background: "none", border: `1px solid ${C.line}`, borderRadius: 2, fontSize: 11, cursor: "pointer", color: C.muted }}><X size={11} /></button>
                </div>
              </div>
            )}

            <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
              {sidebarProfiles.map(p => (
                <ProfilePanel
                  key={p.userId}
                  profile={p}
                  isOwn={p.userId === currentUserId || isAdmin}
                  isSelected={p.userId === selectedUserId}
                  onSelectUser={(uid) => setSelectedUserId(uid)}
                  onEdit={(prof) => setEditingProfile(prof)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Right: Chat ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        {/* Chat topbar */}
        <div style={{ padding: "12px 20px", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", gap: 12, backgroundColor: C.paper, flexShrink: 0 }}>
          <button onClick={() => setProfilesOpen(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, padding: 2, display: "flex" }}>
            {profilesOpen ? <ChevronRight size={16} /> : <ChevronRight size={16} style={{ transform: "rotate(180deg)" }} />}
          </button>
          <AliciaAvatar size={30} state={avatarState} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, letterSpacing: "-0.01em" }}>
              Alicia
              {isAdmin && selectedUserId !== currentUserId && (
                <span style={{ fontSize: 11, fontWeight: 500, color: BAM, marginLeft: 8 }}>
                  hablando como {chatProfile.name.split(" ")[0]}
                </span>
              )}
            </div>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.08em" }}>Asistente ejecutiva · Hygge Holding</div>
          </div>
          {isAdmin && selectedUserId !== currentUserId && (
            <button onClick={() => setSelectedUserId(currentUserId)} style={{ padding: "4px 10px", borderRadius: 2, border: `1px solid ${C.line}`, background: "none", fontSize: 11, color: C.muted, cursor: "pointer" }}>
              ← Mi chat
            </button>
          )}
          <button
            onClick={() => { setVoiceEnabled(v => !v); window.speechSynthesis?.cancel(); if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; setIsSpeaking(false); } }}
            title={voiceEnabled ? "Silenciar voz" : "Activar voz"}
            style={{ padding: "4px 10px", borderRadius: 2, border: `1px solid ${voiceEnabled ? BAM + "60" : C.line}`, background: voiceEnabled ? BAM + "10" : "none", fontSize: 11, color: voiceEnabled ? BAM : C.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, transition: "all 0.15s" }}>
            {voiceEnabled ? "🔊" : "🔇"} Voz
          </button>
          {messages.length > 0 && (
            <button onClick={() => { window.speechSynthesis?.cancel(); if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; setIsSpeaking(false); } const cleared = []; setMessages(cleared); saveChat(selectedUserId, cleared); }} style={{ padding: "4px 10px", borderRadius: 2, border: `1px solid ${C.line}`, background: "none", fontSize: 11, color: C.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              <Trash2 size={11} /> Limpiar
            </button>
          )}
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 8px", display: "flex", flexDirection: "column", gap: 14 }}>

          {messages.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 20, opacity: 0.7 }}>
              <AliciaAvatar size={56} state={avatarState} />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.ink, marginBottom: 6 }}>
                  Hola, {chatProfile.name.split(" ")[0]} 👋
                </div>
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, maxWidth: 380 }}>
                  Soy Alicia. Puedo ayudarte a crear tareas, agendar reuniones, buscar archivos o simplemente conversar sobre cómo va el trabajo.
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 420 }}>
                {[
                  "¿Qué tareas tengo pendientes?",
                  "Crea una reunión con el equipo BAM",
                  "¿Cómo va el proyecto DC01?",
                  "Quiero revisar mis objetivos de crecimiento",
                ].map(q => (
                  <button key={q} onClick={() => send(q)} style={{ padding: "7px 14px", borderRadius: 20, border: `1px solid ${C.line}`, backgroundColor: C.paper, fontSize: 12, color: C.inkSoft, cursor: "pointer", transition: "all 0.12s" }}
                    onMouseOver={e => { e.currentTarget.style.borderColor = BAM; e.currentTarget.style.color = BAM; }}
                    onMouseOut={e => { e.currentTarget.style.borderColor = C.line; e.currentTarget.style.color = C.inkSoft; }}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => {
            const isUser = msg.role === "user";
            return (
              <div key={i} style={{ display: "flex", gap: 10, flexDirection: isUser ? "row-reverse" : "row", alignItems: "flex-end" }}>
                {!isUser && <AliciaAvatar size={26} state="idle" />}
                {isUser && <Avatar initials={chatProfile.initials} dot={chatProfile.dot} size={26} />}
                <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", gap: 4, alignItems: isUser ? "flex-end" : "flex-start" }}>
                  <div style={{
                    padding: "10px 14px", borderRadius: isUser ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                    backgroundColor: isUser ? BAM : C.paper,
                    border: isUser ? "none" : `1px solid ${C.lineSoft}`,
                    color: isUser ? "#fff" : C.ink,
                    fontSize: 13, lineHeight: 1.6,
                    boxShadow: isUser ? `0 2px 8px ${BAM}30` : "0 1px 4px rgba(0,0,0,0.04)",
                  }}>
                    {msg.content}
                  </div>
                  {!isUser && msg.actions?.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingLeft: 4 }}>
                      {msg.actions.map((a, j) => <ActionResult key={j} action={a} />)}
                    </div>
                  )}
                  <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.04em", paddingInline: 4 }}>
                    {new Date(msg.ts).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            );
          })}

          {sending && (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <AliciaAvatar size={26} state="thinking" />
              <div style={{ padding: "10px 14px", borderRadius: "12px 12px 12px 2px", backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, display: "flex", gap: 4, alignItems: "center" }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: BAM, animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite` }} />
                ))}
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>

        {/* Input */}
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.line}`, backgroundColor: C.paper, flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", backgroundColor: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 12px", transition: "border-color 0.15s" }}
            onFocus={() => {}} >
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Escribile a Alicia… (Enter para enviar)`}
              rows={1}
              style={{
                flex: 1, background: "none", border: "none", outline: "none", resize: "none",
                fontSize: 13, lineHeight: 1.5, color: C.ink, fontFamily: "inherit",
                maxHeight: 120, overflowY: "auto",
              }}
              onInput={e => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
            />
            <div style={{ display: "flex", gap: 6, flexShrink: 0, paddingBottom: 2 }}>
              {(window.SpeechRecognition || window.webkitSpeechRecognition) && (
                <button
                  onClick={listening ? stopListening : startListening}
                  style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: listening ? BAM + "20" : "transparent", border: `1px solid ${listening ? BAM : C.line}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: listening ? BAM : C.muted, transition: "all 0.15s" }}
                >
                  {listening ? <MicOff size={14} /> : <Mic size={14} />}
                </button>
              )}
              <button
                onClick={() => send(input)}
                disabled={!input.trim() || sending}
                style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: input.trim() && !sending ? BAM : C.line, border: "none", cursor: input.trim() && !sending ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}
              >
                {sending ? <Loader2 size={14} color="#fff" style={{ animation: "spin 1s linear infinite" }} /> : <Send size={14} color="#fff" />}
              </button>
            </div>
          </div>
          <div style={{ fontSize: 10, color: C.muted, marginTop: 6, textAlign: "center", letterSpacing: "0.04em" }}>
            Alicia puede cometer errores · verificá decisiones importantes
          </div>
        </div>
      </div>

      {/* Profile editor modal */}
      {editingProfile && (
        <ProfileEditor
          profile={editingProfile}
          onSave={(data) => handleSaveProfile(editingProfile.userId, data)}
          onClose={() => setEditingProfile(null)}
        />
      )}

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
