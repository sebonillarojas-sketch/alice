import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Send, Mic, MicOff, Loader2, KeyRound, Trash2, Eye, EyeOff,
} from "lucide-react";

import { ALICIA_URL } from "../../lib/brain.js";
import { useCopilotSnapshot } from "../../copilot/ERPContext.jsx";
import { abrirTurno } from "../../copilot/turn.js";
import Markdown from "../../copilot/Markdown.jsx";
import TrazaTool from "../../copilot/TrazaTool.jsx";
import PanelContexto from "../../copilot/PanelContexto.jsx";
import { supabase } from "../../lib/supabase.js";

// ── Constants ─────────────────────────────────────────────────────────────────
const BAM = "#A855F7";
const PROFILES_KEY = "alicia_profiles_v1";
const API_KEY_KEY = "alicia_api_key";
const chatKey = (uid) => `alicia_chat_${uid}_v1`;

const SPV_CONTEXT = `
SPVs / proyectos de Hygge:
- DC01 Del Castillo · mixto comercial-residencial
- PU01 Paula Ugarriza · residencial premium · también llamado "Legendre" (es EL MISMO proyecto, nunca los trates como dos)
- TG01 De la Torre · residencial
- L36 Larco 1036 · supervisión post-venta

Sub-entidades: Hygge Inmobiliaria (ventas), BAM (arquitectura in-house), Fit Capital (financiera externa)

No inventes cifras de avance de obra, unidades vendidas ni montos. Si no tenés el dato real (del tracker de obra o que te lo pase el usuario), decí que no lo tenés a mano en vez de estimar.
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
// Sin key de env: el bundle es público (así se filtró la key el 13 jul 2026). El chat va vía
// backend aliceai; el fallback directo a Anthropic solo corre si el admin pegó su key en localStorage.
function loadApiKey() { try { return localStorage.getItem(API_KEY_KEY) || ""; } catch { return ""; } }
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
  const [hiloFallo, setHiloFallo] = useState(false);   // no se pudo traer el hilo del servidor
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  // Estado muerto a propósito: nadie lo lee ni lo setea todavía. Queda para que la
  // decisión de producto (¿damos un botón de "resetear la key"?) siga a la vista.
  const [showKeyReset, setShowKeyReset] = useState(false);
  const [listening, setListening] = useState(false);

  // Chequear backend al montar
  useEffect(() => {
    // OJO: antes pegaba a localhost hardcodeado → en prod nunca detectaba el backend y pedía API key
    const base = ALICIA_URL;
    fetch(`${base}/health`, { signal: AbortSignal.timeout(5000) })
      .then(r => r.ok && setBackendAvailable(true))
      .catch(() => {});
  }, []);

  const VOICE_OPTIONS = [
    { value: "nova",    label: "Nova — femenina cálida" },
    { value: "shimmer", label: "Shimmer — femenina suave" },
    { value: "alloy",   label: "Alloy — neutral" },
    { value: "fable",   label: "Fable — expresiva" },
    { value: "echo",    label: "Echo — masculina clara" },
    { value: "onyx",    label: "Onyx — masculina profunda" },
  ];

  const [voiceEnabled, setVoiceEnabled] = useState(() => localStorage.getItem("alicia_voice_enabled") !== "false");
  const VALID_VOICES = new Set(["nova","shimmer","alloy","fable","echo","onyx"]);
  const [selectedVoice, setSelectedVoice] = useState(() => {
    const saved = localStorage.getItem("alicia_voice");
    return (saved && VALID_VOICES.has(saved)) ? saved : "nova";
  });
  const [isSpeaking, setIsSpeaking] = useState(false);

  const endRef = useRef(null);
  // ¿El usuario está mirando el fondo del hilo? Se registra en el evento de scroll
  // y NO midiendo dentro del effect: para cuando el effect corre, el mensaje nuevo
  // ya está en el DOM y `scrollHeight` creció, así que alguien que estaba pegado al
  // fondo mide "lejos" y no se lo volvería a seguir nunca más.
  const pegadoAlFondo = useRef(true);
  const soltarScroll = useRef(null);
  // Callback ref y no useRef+useEffect([]): la lista de mensajes está detrás del
  // gate de `backendAvailable`, que se prende asincrónicamente cuando responde
  // /health. Un effect con deps vacías correría antes de que el nodo exista y el
  // listener no se ataría nunca.
  const hiloRef = useCallback((nodo) => {
    soltarScroll.current?.();
    soltarScroll.current = null;
    if (!nodo) return;
    const onScroll = () => {
      pegadoAlFondo.current = nodo.scrollHeight - nodo.scrollTop - nodo.clientHeight < 100;
    };
    nodo.addEventListener("scroll", onScroll, { passive: true });
    soltarScroll.current = () => nodo.removeEventListener("scroll", onScroll);
  }, []);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  const audioRef = useRef(null);
  // Se incrementa cada vez que `send` toca `messages` a mano. El fetch del
  // historial guarda la generación vigente ANTES de salir a la red; si al
  // volver ya cambió, alguien mandó un mensaje mientras tanto y aplicar la
  // respuesta pisaría ese turno en pantalla. No la borres para "simplificar":
  // `vivo` cubre desmontaje/cambio de usuario, esto cubre el turno propio.
  const generacion = useRef(0);

  const speak = useCallback(async (text) => {
    if (!voiceEnabled) return;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    window.speechSynthesis?.cancel();
    const clean = text.replace(/[*_`#]/g, "").trim();
    if (!clean) return;
    try {
      const brainUrl = ALICIA_URL;
      const res = await fetch(`${brainUrl}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean, voice: selectedVoice }),
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
  }, [voiceEnabled, selectedVoice]);

  const avatarState = sending ? "thinking" : isSpeaking ? "speaking" : "idle";

  const currentProfile = profiles[selectedUserId] || profiles[currentUserId];

  // Scroll al fondo con mensajes nuevos, PERO sólo si el usuario ya estaba ahí.
  // Antes del streaming `messages` cambiaba dos veces por turno; ahora cambia una
  // vez por frame, así que seguir al fondo sin preguntar le arranca la pantalla de
  // las manos a quien subió a releer algo, durante todo el turno.
  //
  // Sin `behavior: "smooth"` a propósito: a 60 repintados por segundo la animación
  // suave se reinicia en cada frame (no se ve suave, se ve temblando) y además sus
  // posiciones intermedias disparan eventos de scroll que apagarían `pegadoAlFondo`
  // a mitad de camino. Instantáneo es lo correcto para un feed que crece, y es lo
  // que hacen las terminales y los chats.
  useEffect(() => {
    if (pegadoAlFondo.current) endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  // When switching users (admin), load their chat
  useEffect(() => {
    if (isAdmin) {
      setMessages(loadChat(selectedUserId));
    }
  }, [selectedUserId, isAdmin]);

  // El hilo vive en el servidor (tabla `messages`, un hilo por persona, todos los
  // canales). localStorage pasa a ser caché: pinta al instante y lo reemplaza
  // lo que llegue del cerebro. Antes era la fuente de verdad, y por eso el space
  // mostraba una conversación que Alicia no recordaba.
  useEffect(() => {
    let vivo = true;
    const gen = generacion.current;   // snapshot: si `send` avanza esto antes de que vuelva el fetch, se descarta
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data?.session?.access_token;
        const qs = new URLSearchParams({ limit: "60" });
        if (selectedUserId !== currentUserId) qs.set("userId", selectedUserId);
        const res = await fetch(`${ALICIA_URL}/api/copilot/history?${qs}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: AbortSignal.timeout(10000),
        });
        // Un 403, una sesión vencida o Railway despertándose dejaban la copia
        // vieja en pantalla sin decir nada: exactamente el síntoma de "Alicia no
        // se acuerda" que este hilo vino a matar, con otra causa. Lo avisamos.
        if (!res.ok) { if (vivo && generacion.current === gen) setHiloFallo(true); return; }
        const { messages: hilo } = await res.json();
        if (!vivo || generacion.current !== gen || !Array.isArray(hilo)) return;
        const mapped = hilo.map((m) => ({
          role: m.role, content: m.content, actions: m.actions || [],
          // SQLite devuelve "YYYY-MM-DD HH:MM:SS" (con espacio); Safari no lo
          // parsea, así que lo pasamos a ISO antes de agregarle la "Z".
          channel: m.channel, ts: Date.parse(m.createdAt.replace(" ", "T") + "Z") || Date.now(),
        }));
        setMessages(mapped);
        saveChat(selectedUserId, mapped);
        setHiloFallo(false);
      } catch {
        // el caché de localStorage ya está en pantalla, pero desactualizado
        if (vivo && generacion.current === gen) setHiloFallo(true);
      }
    })();
    return () => { vivo = false; };
  }, [selectedUserId, currentUserId]);

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
  const BRAIN_URL = ALICIA_URL;
  const takeSnapshot = useCopilotSnapshot();

  const send = useCallback(async (text) => {
    if (!text.trim() || sending) return;
    const userMsg = { role: "user", content: text.trim(), ts: Date.now() };
    const newHistory = [...messages, userMsg];
    generacion.current++;   // invalida cualquier fetch de historial que haya salido antes de este turno
    setMessages(newHistory);
    setInput("");
    setSending(true);

    // Estas dos viven FUERA del try para que el `finally` pueda apagar el
    // repintado agrupado pase lo que pase. Un rAF que sobreviva al turno vuelve
    // a pintar la burbuja en vivo ENCIMA del mensaje final (o del de error) y
    // resucita texto que ya no existe en ningún lado.
    let rafId = null;
    let terminado = false;
    // `pasos` (la traza) también vive acá afuera: si el turno muere a mitad, el
    // catch tiene que poder decir qué herramientas alcanzaron a correr. Declarado
    // dentro del try, el mensaje de error perdía ese registro.
    let pasos = [];

    try {
      // Alicia vive en el backend (aliceai): cerebro Claude, memoria y herramientas.
      // Sin fallback a Anthropic-directo (sacamos la key del browser por seguridad).
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;

      // Burbuja del assistant que se va llenando en vivo. `pasos` es la traza.
      let acumulado = "";
      // Un setState por token re-renderiza AliciaView entero (1189 líneas) decenas
      // de veces por segundo. Agrupamos los repintados en el frame: se ve igual de
      // fluido y el navegador no se ahoga.
      let pendiente = false;
      const pintarYa = () => setMessages([...newHistory, {
        role: "assistant", content: acumulado, pasos, ts: Date.now(), streaming: true,
      }]);
      const pintar = () => {
        if (pendiente || terminado) return;
        pendiente = true;
        rafId = requestAnimationFrame(() => {
          pendiente = false;
          rafId = null;
          if (terminado) return;   // el turno ya cerró: este frame llegó tarde
          pintarYa();
        });
      };
      pintarYa();

      let final = null;
      await abrirTurno({
        url: `${BRAIN_URL}/api/copilot/turn`,
        token,
        // userId solo viaja para el "ver como" del CEO; el servidor lo ignora
        // para cualquier otro y toma la identidad del JWT.
        body: { userId: selectedUserId, message: text.trim(), erpContext: takeSnapshot() },
        // Techo duro. El POST /api/chat que esto reemplaza tenía uno de 60s; sin
        // nada, una conexión colgada deja `sending` en true para siempre y el
        // composer muerto sin forma de salir. Con streaming el usuario ve avance,
        // así que damos el doble antes de cortar.
        signal: AbortSignal.timeout(120000),
        onEvento: ({ event, data }) => {
          // `?? ""` y no `data.text` pelado: un frame malformado pegaría el literal
          // "undefined" en medio de la respuesta.
          if (event === "text_delta") { acumulado += data.text ?? ""; pintar(); }
          // El cerebro sólo guarda el texto de la última iteración: lo que el cliente
          // pintó en una vuelta anterior hay que descartarlo o la pantalla miente.
          else if (event === "text_reset") { acumulado = ""; pintar(); }
          else if (event === "tool_start") { pasos = [...pasos, { id: data.id, tool: data.tool, input: data.input, ok: null }]; pintar(); }
          else if (event === "tool_done") { pasos = pasos.map(p => p.id === data.id ? { ...p, ok: data.ok } : p); pintar(); }
          else if (event === "done") { final = data; }
          // El frame de error llega DESPUÉS de haber pintado deltas, y no viene
          // ningún `done` que los corrija porque el cerebro no guardó nada. Lanzar
          // corta el stream y deja que el catch tire esa burbuja: es texto que no
          // existe en ninguna base. Ignorarlo dejaría al usuario leyendo un
          // fantasma.
          else if (event === "error") {
            const e = new Error(data?.message || "el cerebro cortó el turno");
            e.delCerebro = true;
            throw e;
          }
        },
      });

      // Si el stream terminó sin `done`, el cerebro no cerró el turno y por lo tanto
      // no guardó nada: el buffer que pintamos no existe en ninguna base. Caer al
      // acumulado lo metería en el estado, en localStorage y en la voz, y encima el
      // turno siguiente se compondría contra un historial que el cerebro no comparte
      // (el effect de historial depende de [selectedUserId, currentUserId], no corre
      // por turno: la mentira sobrevive hasta un remontaje). Es exactamente la
      // divergencia que este bloque existe para cerrar, así que es un fallo.
      if (!final) {
        const e = new Error("el stream terminó sin cerrar el turno");
        e.delCerebro = true;
        throw e;
      }

      // SIEMPRE el texto de `done`, nunca el acumulado. Entre lo que se pinta y lo
      // que el cerebro guarda hay tres divergencias reales: un rechazo pisa el texto
      // sin mandar reset, la extracción de JSON stremea el envoltorio {"message":…}
      // crudo pero guarda el valor desenvuelto, y de cada iteración sólo se guarda
      // el primer bloque de texto aunque se pinten todos. Reemplazar la burbuja por
      // `final.text` al cerrar el turno las cierra a las tres de una.
      const responseText = final.text ?? "";
      const actions = final.actions || [];

      const aliciaMsg = { role: "assistant", content: responseText, actions, pasos, ts: Date.now() };
      const finalHistory = [...newHistory, aliciaMsg];
      setMessages(finalHistory);
      saveChat(selectedUserId, finalHistory);
      executeActions(actions, profiles);
      speak(responseText);
    } catch (err) {
      // `newHistory` no incluye la burbuja en vivo: reemplazar por esto la borra.
      const errMsg = {
        role: "assistant",
        content: err?.delCerebro
          ? `Corté el turno a mitad (${err.message}). Lo que alcancé a escribir no quedó guardado, así que lo descarté. Probá de nuevo.`
          : `Tuve un problema de conexión con el servidor (${err.message}). Reintentá en un momento.`,
        actions: [], pasos, ts: Date.now(), isError: true,
      };
      const finalHistory = [...newHistory, errMsg];
      setMessages(finalHistory);
      saveChat(selectedUserId, finalHistory);
    } finally {
      terminado = true;
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [apiKey, sending, messages, currentProfile, profiles, tasks, allSpaces, knowledgeLinks, selectedUserId, executeActions, takeSnapshot, speak, BRAIN_URL]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

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

  const chatProfile = profiles[selectedUserId] || profiles[currentUserId];

  // ── Render: main ─────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", height: "calc(100vh - 60px)", backgroundColor: C.bg, overflow: "hidden" }}>

      {/* ── Centro: Chat ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        {/* Chat topbar */}
        <div style={{ padding: "12px 20px", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", gap: 12, backgroundColor: C.paper, flexShrink: 0 }}>
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
            onClick={() => { const next = !voiceEnabled; setVoiceEnabled(next); localStorage.setItem("alicia_voice_enabled", next); window.speechSynthesis?.cancel(); if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; setIsSpeaking(false); } }}
            title={voiceEnabled ? "Silenciar voz" : "Activar voz"}
            style={{ padding: "4px 10px", borderRadius: 2, border: `1px solid ${voiceEnabled ? BAM + "60" : C.line}`, background: voiceEnabled ? BAM + "10" : "none", fontSize: 11, color: voiceEnabled ? BAM : C.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, transition: "all 0.15s" }}>
            {voiceEnabled ? "🔊" : "🔇"} Voz
          </button>
          {voiceEnabled && (
            <select
              value={selectedVoice}
              onChange={e => { setSelectedVoice(e.target.value); localStorage.setItem("alicia_voice", e.target.value); }}
              title="Voz de Alicia"
              style={{ padding: "4px 6px", borderRadius: 2, border: `1px solid ${C.line}`, background: C.card, color: C.text, fontSize: 11, cursor: "pointer", maxWidth: 140 }}>
              {VOICE_OPTIONS.map(v => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
          )}
          {/* Dice "vista local" porque es lo único que borra: el hilo vive en el
              servidor y vuelve entero al recargar. Antes el tacho prometía
              borrar la conversación y no borraba nada. */}
          {messages.length > 0 && (
            <button title="Vacía la pantalla y el caché del navegador. El hilo sigue en el servidor y vuelve al recargar." onClick={() => { window.speechSynthesis?.cancel(); if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; setIsSpeaking(false); } const cleared = []; setMessages(cleared); saveChat(selectedUserId, cleared); }} style={{ padding: "4px 10px", borderRadius: 2, border: `1px solid ${C.line}`, background: "none", fontSize: 11, color: C.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              <Trash2 size={11} /> Limpiar vista local
            </button>
          )}
        </div>

        {/* Messages */}
        <div ref={hiloRef} style={{ flex: 1, overflowY: "auto", padding: "20px 20px 8px", display: "flex", flexDirection: "column", gap: 14 }}>

          {hiloFallo && (
            <div style={{ fontSize: 11, color: C.muted, textAlign: "center", padding: "2px 0" }}>
              No pude cargar el hilo — estás viendo una copia local.
            </div>
          )}

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
                    {/* El usuario sigue en texto plano: no hay razón para interpretar
                        markdown en lo que escribe la persona. */}
                    {msg.role === "assistant" ? (
                      <>
                        {msg.pasos?.length > 0 && (
                          <div style={{ marginBottom: 6 }}>
                            {msg.pasos.map(p => <TrazaTool key={p.id} tool={p.tool} ok={p.ok} input={p.input} />)}
                          </div>
                        )}
                        <Markdown texto={msg.content} />
                        {msg.streaming && <span style={{ opacity: 0.4 }}>▍</span>}
                      </>
                    ) : msg.content}
                  </div>
                  {!isUser && msg.actions?.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingLeft: 4 }}>
                      {msg.actions.map((a, j) => <ActionResult key={j} action={a} />)}
                    </div>
                  )}
                  <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.04em", paddingInline: 4 }}>
                    {new Date(msg.ts).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                    {/* El badge existe para avisar que el mensaje entró por OTRA puerta
                        (WhatsApp, voz). "app" y "copilot" son las dos formas en que el
                        ERP se identificó a lo largo del tiempo: "app" en los mensajes
                        viejos, "copilot" desde la Fase 2 (el cerebro lo necesita para el
                        tope de iteraciones y para turn_usage). Los dos significan "esto
                        salió de acá", así que ninguno lleva badge — no borres uno. */}
                    {msg.channel && msg.channel !== "app" && msg.channel !== "copilot" && (
                      <span style={{ fontSize: 9, color: C.muted, marginLeft: 6, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                        {msg.channel === "whatsapp" ? "· whatsapp" : msg.channel === "embodied" ? "· voz" : `· ${msg.channel}`}
                      </span>
                    )}
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

      {/* ── Derecha: qué está viendo Alicia ahora mismo ── */}
      <div style={{ width: "min(280px, 80vw)", minWidth: "min(280px, 80vw)", flexShrink: 0 }}>
        <PanelContexto
          isAdmin={isAdmin}
          profiles={profiles}
          selectedUserId={selectedUserId}
          currentUserId={currentUserId}
          onSelectUser={setSelectedUserId}
        />
      </div>

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
