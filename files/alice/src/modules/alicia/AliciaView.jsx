// El space `alicia` ya no es dueño del turno: la conversación (hilo + composer)
// sale de <Conversacion/>, y el turno vive en CopilotoProvider, por encima del
// router. Acá queda lo que NO es el turno y sólo tiene lugar en la vista ancha:
// el gate de API key, el selector de "ver como" del CEO, la voz (dictado y TTS),
// las acciones legadas y el panel de contexto.
//
// Tener dos `send` (uno acá y otro en el provider) NO es una opción: comparten la
// misma clave de localStorage y se pisan el hilo entre ellos. Por eso este
// archivo perdió el suyo entero.
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic, MicOff, KeyRound, Trash2, Eye, EyeOff,
} from "lucide-react";

import { ALICIA_URL } from "../../lib/brain.js";
import { useCopiloto } from "../../copilot/CopilotoProvider.jsx";
import AliciaAvatar from "../../copilot/AliciaAvatar.jsx";
import Conversacion from "../../copilot/Conversacion.jsx";
import PanelContexto from "../../copilot/PanelContexto.jsx";
import { saveChat } from "../../copilot/historial.js";

// ── Constants ─────────────────────────────────────────────────────────────────
const BAM = "#A855F7";
const PROFILES_KEY = "alicia_profiles_v1";
const API_KEY_KEY = "alicia_api_key";

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

// `Avatar` (el redondel con las iniciales del usuario) se fue con las burbujas:
// lo único que lo usaba era el hilo, que ahora dibuja <Conversacion/>.

// `AliciaAvatar` se mudó a src/copilot/AliciaAvatar.jsx: el estado vacío del
// hilo (que ahora dibuja Conversacion) también lo necesita, y el dock no puede
// importar nada de este archivo sin cerrar un ciclo.

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

// `ActionResult` (el badge de "Tarea creada: …") se mudó a Conversacion.jsx con
// las burbujas: se renderiza por mensaje, así que tenía que viajar con ellas o el
// dock mostraría `msg.actions` como nada.

// ── Main Alicia view ───────────────────────────────────────────────────────────
export default function AliciaView({ currentUser, tasks = [], addTask, updateTask, allSpaces = [], knowledgeLinks = [], createEvent }) {
  const currentUserId = currentUser?.id || "sb";
  // Solo el CEO puede ver y cambiar entre conversaciones de otros usuarios
  const isAdmin = currentUser?.isCEO === true;

  // El hilo, el "enviando" y la persona elegida los manda el provider. Lo que
  // antes era estado local acá adentro murió: mientras existieron los dos turnos
  // (este y el del provider) compartían la clave `alicia_chat_<uid>_v1` y se
  // pisaban el hilo entre ellos.
  const { mensajes, setMensajes, enviando, setBorrador, selectedUserId, setSelectedUserId } = useCopiloto();

  const [apiKey, setApiKey] = useState(loadApiKey);
  const [backendAvailable, setBackendAvailable] = useState(false);
  const [profiles, setProfiles] = useState(loadProfiles);
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

  // El auto-scroll del hilo (el ref `pegadoAlFondo` atado por callback ref) se fue
  // a Conversacion.jsx junto con las burbujas, igual que el fetch del historial y
  // su contador `generacion`, que se fueron al provider PEGADOS a `enviar`: la
  // guarda sólo sirve si el que incrementa y el que compara comparten alcance.
  const recognitionRef = useRef(null);
  const audioRef = useRef(null);

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

  const avatarState = enviando ? "thinking" : isSpeaking ? "speaking" : "idle";

  // El efecto que rehidrataba el hilo al cambiar de persona también se fue al
  // provider: ahí `selectedUserId` es el dueño del uid y ya tiene su `loadChat`.
  // Hacerlo dos veces dejaba dos escrituras compitiendo por el mismo estado.

  // Save profiles whenever they change
  useEffect(() => { saveProfiles(profiles); }, [profiles]);

  // Dictado. Lo dictado se APPENDEA al borrador, no se manda: dictás, corregís y
  // recién mandás. Mandarlo derecho es peor que no dictar, sobre todo con nombres
  // propios y números, que es de lo que habla este ERP. El borrador vive en el
  // provider justamente para que este botón —que está en la topbar, afuera del
  // composer— pueda escribirle.
  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = "es-PE";
    r.continuous = false;
    r.interimResults = false;
    r.onresult = e => {
      const t = e.results[0][0].transcript;
      setListening(false);
      if (t?.trim()) setBorrador(prev => prev + (prev ? " " : "") + t);
    };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    recognitionRef.current = r;
    r.start();
    setListening(true);
  }, [setBorrador]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  // CÓDIGO MUERTO, y no desde esta fase: nunca pudo matchear.
  //
  // El cerebro cierra el turno con `return { text: finalText, actions: toolResults }`
  // (alicia-brain/src/server.js:912), y `toolResults` se llena con objetos
  // `{ tool, input, result }` (alicia-brain/src/server.js:873) — SIN campo `type`.
  // Todo lo de abajo ramifica por `action.type === "create_task"` y compañía, así
  // que ninguna rama se ejecutó jamás. Queda tal cual, sin "arreglar", porque
  // arreglarlo significaría inventar un contrato que el servidor no emite: el
  // camino vivo de la Fase 3 es client_tool/confirm → manos → bus.
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

  // El turno ya no cierra acá, así que las consecuencias del último mensaje se
  // enganchan mirando el hilo. `ultimoProcesado` evita que un re-render las
  // vuelva a disparar: hablar dos veces la misma respuesta es lo que pasaba
  // cuando esto dependía sólo de mensajes.length.
  //
  // `huboTurno` es la otra mitad de la guarda, y hace falta porque el hilo ahora
  // llega de afuera: al montar, el último mensaje del historial YA es una
  // respuesta del assistant con sus `actions`. Sin esto, abrir el space leería en
  // voz alta la última respuesta vieja y volvería a ejecutar sus acciones (crear
  // de nuevo la tarea que ya existe). Sólo cuentan los turnos que arrancaron con
  // este componente montado.
  const ultimoProcesado = useRef(0);
  const huboTurno = useRef(false);
  useEffect(() => { if (enviando) huboTurno.current = true; }, [enviando]);
  useEffect(() => {
    if (!huboTurno.current) return;
    const ult = mensajes[mensajes.length - 1];
    if (!ult || ult.role !== "assistant" || ult.streaming || ult.isError) return;
    if (ult.ts === ultimoProcesado.current) return;
    ultimoProcesado.current = ult.ts;
    if (ult.actions?.length) executeActions(ult.actions, profiles);
    speak(ult.content);
  }, [mensajes, enviando, executeActions, profiles, speak]);


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
          {/* El micrófono subió del composer a la topbar: el composer ahora vive
              en <Conversacion/> y es compartido con el dock, que no dicta. Acá
              queda al lado del resto de los controles de voz, que es donde
              conceptualmente va. */}
          {(window.SpeechRecognition || window.webkitSpeechRecognition) && (
            <button
              onClick={listening ? stopListening : startListening}
              disabled={enviando}
              title={listening ? "Dejar de dictar" : "Dictarle a Alicia"}
              style={{ width: 28, height: 28, borderRadius: "50%", backgroundColor: listening ? BAM + "20" : "transparent", border: `1px solid ${listening ? BAM : C.line}`, cursor: enviando ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: listening ? BAM : C.muted, flexShrink: 0, transition: "all 0.15s" }}
            >
              {listening ? <MicOff size={13} /> : <Mic size={13} />}
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
          {mensajes.length > 0 && (
            <button title="Vacía la pantalla y el caché del navegador. El hilo sigue en el servidor y vuelve al recargar." onClick={() => { window.speechSynthesis?.cancel(); if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; setIsSpeaking(false); } const cleared = []; setMensajes(cleared); saveChat(selectedUserId, cleared); }} style={{ padding: "4px 10px", borderRadius: 2, border: `1px solid ${C.line}`, background: "none", fontSize: 11, color: C.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              <Trash2 size={11} /> Limpiar vista local
            </button>
          )}
        </div>

        {/* El hilo y el composer: los MISMOS que muestra el dock. `ancho="full"`
            sólo cambia márgenes y el alto del textarea; las burbujas, el
            markdown, la traza, el badge de canal y el cursor de streaming son
            literalmente el mismo componente. Dibujarlos de nuevo acá es cómo se
            separaron las dos vistas la vez pasada. */}
        <div style={{ flex: 1, minHeight: 0 }}>
          {/* `nombre` es para el saludo del hilo vacío. Sale de `chatProfile` y no
              de la persona logueada: con el "ver como" del CEO no son la misma. */}
          <Conversacion ancho="full" nombre={chatProfile?.name?.split(" ")[0] || ""} />
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

      {/* El <style> que había acá se fue entero: `bounce` viajó a Conversacion.jsx
          con los tres puntitos (su único usuario) y `spin` ya estaba declarado en
          HyggeOS.jsx, así que esta copia no hacía nada. */}
    </div>
  );
}
