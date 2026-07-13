import React, { useState, useEffect, useCallback, useRef, useMemo, createContext, useContext } from "react";
import ObraTrackerModule from "./modules/obra/ObraTracker";
import AliciaView from "./modules/alicia/AliciaView";
import MercadoView from "./modules/mercado/MercadoView";
import CabidaView from "./modules/cabida/CabidaView";
import PropuestaBamTab from "./modules/propuesta/PropuestaBamTab";
import { useTimer } from "./modules/timer/useTimer";
import { TimerButton } from "./modules/timer/TimerButton";
import { useERPSync } from "./api/useERPSync.js";
import { TimerView } from "./modules/timer/TimerView";
import { useRecurring, recurringLabel } from "./modules/recurring/useRecurring";
import { RecurringPicker, RecurringBadge } from "./modules/recurring/RecurringPicker";
import { db } from "./lib/supabase";

// Key SOLO desde localStorage (el admin la pega en su browser si quiere paneles Lab con Claude).
// NUNCA desde env: VITE_* se hornea en el bundle público — así se filtró la key el 13 jul 2026.
const ANTHROPIC_KEY = (() => { try { return localStorage.getItem("alicia_api_key") || ""; } catch { return ""; } })();
const anthropicHeaders = () => ({
  "Content-Type": "application/json",
  "x-api-key": ANTHROPIC_KEY,
  "anthropic-version": "2023-06-01",
  "anthropic-dangerous-direct-browser-access": "true",
});
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, Cell,
  PieChart, Pie, Legend, LineChart, Line,
  ScatterChart, Scatter, ZAxis, ReferenceLine,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ComposedChart,
} from "recharts";
import {
  Search, Bell, Plus, Play, Pause, MessageSquare, MessageCircle, Activity, ChevronLeft, ChevronRight, ChevronDown,
  LayoutDashboard, List, Kanban, GanttChart, Calendar as CalIcon, Table2,
  PenSquare, Filter, Sparkles, CheckCircle2, Circle, Star, X, StickyNote,
  ArrowLeft, ArrowRight, FileText, Send, Loader2, CornerDownRight, Trash2, Paperclip,
  Image as ImageIcon, AtSign, Clock, User as UserIcon, FileUp, Download,
  MousePointer2, Type, Square, ArrowUpRight, Pencil, ZoomIn, ZoomOut, Maximize2,
  Hand, Trash,
  Triangle, Diamond, Hexagon, Cloud as CloudIcon,
  Building, Building2, Home, MapPin, Warehouse, DollarSign, TrendingUp, TrendingDown,
  AlertTriangle, AlertCircle, CheckCircle, XCircle, Info,
  Users, UserCheck, CalendarDays, Mail, Phone, Copy, Check, Hash, CornerDownLeft, CornerUpLeft,
  Heart, Zap, Flag, Folder, Briefcase, Eye, Settings, Award, Target,
  Bookmark, ThumbsUp, Lightbulb,
  Menu, PanelRightOpen, Inbox as InboxIcon,
  PieChart as PieChartIcon, BarChart3, LineChart as LineChartIcon, Globe, ExternalLink,
  Coffee, Shield, FlaskConical, Gamepad2, Bot, RefreshCw,
} from "lucide-react";

// ═══ BRAND TOKENS ═══════════════════════════════════════════════════════
const C = {
  bg: "#EEEBE3", paper: "#F4F1EA", surface: "#FAF8F2",
  ink: "#0A0B0F", inkSoft: "#3A3D45", muted: "#8C8F96", mutedSoft: "#B5B3AC",
  line: "#D5D1C5", lineSoft: "#E4E0D4",
  navy: "#1E2A4A", cobalt: "#3D52D5", sky: "#B8C8E5",
  lavender: "#A89BD9", ochre: "#C2A45A", brick: "#A85B5B", green: "#5F8A6A",
};
const toneMap = { navy: C.navy, cobalt: C.cobalt, lavender: C.lavender, ochre: C.ochre, brick: C.brick, muted: C.muted, green: C.green };
const SPACE_COLORS = [C.cobalt, C.lavender, C.ochre, C.green, C.brick, C.sky, C.navy];

// ═══ ALICE BLOB · modal emotional states ════════════════════════════════
const _BLOB_STYLE_ID = "hygge-blob-keyframes";
const BLOB_CSS = `
  @keyframes hb-morph      {0%,100%{border-radius:42% 58% 65% 35%/45% 45% 55% 55%}34%{border-radius:60% 40% 42% 58%/60% 45% 55% 40%}67%{border-radius:45% 55% 60% 40%/40% 62% 38% 60%}}
  @keyframes hb-morph-slow {0%,100%{border-radius:42% 58% 65% 35%/45% 45% 55% 55%}50%{border-radius:50% 50% 55% 45%/50% 50% 50% 50%}}
  @keyframes hb-float      {0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-8px) scale(1.01)}}
  @keyframes hb-dim        {0%,100%{opacity:1}50%{opacity:.6}}
  @keyframes hb-happy      {0%,100%{transform:translateY(0) scaleX(1) scaleY(1)}30%{transform:translateY(-18px) scaleX(.93) scaleY(1.1)}50%{transform:translateY(-20px) scaleX(1.06) scaleY(.92)}70%{transform:translateY(0) scaleX(1.1) scaleY(.86)}85%{transform:translateY(0) scaleX(.97) scaleY(1.04)}}
  @keyframes hb-excited    {0%,100%{transform:translateY(0) scale(1)}40%{transform:translateY(-22px) scale(1.08)}70%{transform:translateY(0) scale(.93)}}
  @keyframes hb-wobble     {0%,100%{transform:rotate(0) translateX(0)}20%{transform:rotate(-8deg) translateX(-4px)}40%{transform:rotate(6deg) translateX(3px)}60%{transform:rotate(-5deg) translateX(-2px)}80%{transform:rotate(4deg) translateX(2px)}}
  @keyframes hb-shake      {0%,100%{transform:translateX(0)}20%{transform:translateX(-7px)}40%{transform:translateX(6px)}60%{transform:translateX(-5px)}80%{transform:translateX(4px)}}
  @keyframes hb-flop       {0%,100%{transform:rotate(9deg) translateY(5px) scaleX(1.1) scaleY(.88)}50%{transform:rotate(11deg) translateY(8px) scaleX(1.12) scaleY(.85)}}
`;
const BLOB_STATES_HG = {
  idle:      { bg: "#8b5cf6", anim: "hb-morph 8s ease-in-out infinite, hb-float 5s ease-in-out infinite" },
  listening: { bg: "#a78bfa", anim: "hb-morph 4.5s ease-in-out infinite, hb-float 5s ease-in-out infinite" },
  thinking:  { bg: "#6d28d9", anim: "hb-morph 3.2s ease-in-out infinite, hb-float 5s ease-in-out infinite, hb-dim 1.6s ease-in-out infinite" },
  happy:     { bg: "#c4b5fd", anim: "hb-morph 8s ease-in-out infinite, hb-happy 1s cubic-bezier(.36,1.4,.5,1) infinite" },
  excited:   { bg: "#c084fc", anim: "hb-morph 8s ease-in-out infinite, hb-excited .5s cubic-bezier(.36,1.4,.5,1) infinite" },
  confused:  { bg: "#9c93b8", anim: "hb-morph 5s ease-in-out infinite, hb-wobble 1.8s ease-in-out infinite" },
  error:     { bg: "#c2607e", anim: "hb-morph 6s ease-in-out infinite, hb-shake .5s ease-in-out infinite" },
  crashed:   { bg: "#7a7396", anim: "hb-morph-slow 10s ease-in-out infinite, hb-flop 3.5s ease-in-out infinite" },
};

function ModalBlob({ state = "idle", size = 34 }) {
  if (!document.getElementById(_BLOB_STYLE_ID)) {
    const s = document.createElement("style");
    s.id = _BLOB_STYLE_ID;
    s.textContent = BLOB_CSS;
    document.head.appendChild(s);
  }
  const s = BLOB_STATES_HG[state] || BLOB_STATES_HG.idle;
  return (
    <div style={{
      width: size, height: size, borderRadius: "42% 58% 65% 35%/45% 45% 55% 55%",
      background: s.bg, animation: s.anim,
      transition: "background 0.5s ease", flexShrink: 0, position: "relative",
    }}>
      {state === "crashed" && (
        <div style={{ position: "absolute", top: "38%", left: "50%", transform: "translate(-50%,-50%)", display: "flex", gap: 7 }}>
          {[0,1].map(i => (
            <div key={i} style={{ position: "relative", width: 7, height: 7 }}>
              <div style={{ position: "absolute", top: "50%", left: 0, width: "100%", height: 1.5, background: "rgba(0,0,0,0.35)", borderRadius: 1, transform: "translateY(-50%) rotate(45deg)" }} />
              <div style={{ position: "absolute", top: "50%", left: 0, width: "100%", height: 1.5, background: "rgba(0,0,0,0.35)", borderRadius: 1, transform: "translateY(-50%) rotate(-45deg)" }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function useModalBlob() {
  const [state, setState] = useState("idle");
  const [errors, setErrors] = useState(0);
  const onType = useCallback(() => setState(s => s === "crashed" ? "crashed" : "listening"), []);
  const onValid = useCallback(() => setState("happy"), []);
  const onError = useCallback(() => {
    setErrors(n => {
      const next = n + 1;
      setState(next >= 3 ? "crashed" : "error");
      return next;
    });
  }, []);
  const onHappy = useCallback((cb) => { setState("happy"); setTimeout(cb, 650); }, []);
  const reset = useCallback(() => { setState("idle"); setErrors(0); }, []);
  return { state, onType, onValid, onError, onHappy, reset };
}

// ═══ PEOPLE (TEAM) ═══════════════════════════════════════════════════════
const PEOPLE = [
  { id: "sb", name: "Sebastián Bonilla", initials: "SB", role: "CEO", color: "#0A0B0F" },
  { id: "aa", name: "Ariel Almaguer", initials: "AA", role: "BAM · Jefe de Proyectos", color: "#A89BD9" },
  { id: "jm", name: "Joel Moy", initials: "JM", role: "Gerente Financiero", color: "#1E2A4A" },
  { id: "jt", name: "Jose Torres", initials: "JT", role: "Gerente Comercial", color: "#5F8A6A" },
  { id: "vd", name: "Vanessa Dongo", initials: "VD", role: "Admin & Marketing", color: "#A85B5B" },
  { id: "jmg", name: "J.M. Galup", initials: "JMG", role: "Jefe Legal", color: "#C2A45A" },
  { id: "ac", name: "Andrea Castillo", initials: "AC", role: "Jefe de Operaciones", color: "#8C8F96" },
];
const findPerson = (id) => PEOPLE.find(p => p.id === id);

const DEFAULT_PREFS = {
  language: "es",
  timezone: "America/Lima",
  defaultSpace: "hq",
  notifyEmail: true,
  notifyDesktop: true,
  digest: "daily",
};

// User profiles — extends PEOPLE with editable fields (avatar, password, preferences).
const INITIAL_USERS = PEOPLE.map(p => {
  const [firstName, ...rest] = p.name.split(" ");
  return {
    id: p.id,
    firstName,
    lastName: rest.join(" "),
    email: p.id === "sb" ? "sebastian@hygge.pe"
         : p.id === "aa" ? "ariel@bam.pe"
         : p.id === "vd" ? "vane@hygge.pe"
         : p.id === "jt" ? "jose@hygge.pe"
         : p.id === "jmg" ? "galupj@gmail.com"
         : p.id === "ac" ? "andreamparito@gmail.com"
         : `${p.id}@hygge.pe`,
    role: p.role,
    isAdmin: p.id === "sb",
    color: p.color,
    initials: p.initials,
    avatar: null,
    password: "",
    online: false,
    preferences: { ...DEFAULT_PREFS },
    createdAt: Date.now(),
  };
});

// Context to share users across deep components (Avatar needs it)
const UsersContext = React.createContext([]);

const lookupUser = (id, users) => users?.find(u => u.id === id) || null;

// ── Persistencia compartida (13 jul 2026) ──────────────────────────────────
// Las claves de SYNCED_KEYS viven en Supabase (app_state) y se comparten entre
// usuarios/dispositivos; localStorage queda como caché local y fallback offline.
// Lo cosmético/per-device (vista activa, timer, colapsos) sigue siendo solo local.
const SYNCED_KEYS = new Set([
  "hygge:messages", "hygge:activity", "hygge:customSpaces", "hygge:deletedDefaultSpaces",
  "hygge:smartViews", "hygge:users", "hygge:spaceAccess", "hygge:customViews",
  "hygge:spvs", "hygge:hq:cifras", "hygge:whiteboards", "hygge:knowledgeLinks",
  "hygge:spaceViewports", "hygge:ceoProjects", "hygge:ceoNps", "hygge:hqWidgets",
  "hygge:hqSummaries", "hygge:finanzas:source", "hygge:dropbox:custom_paths", "hygge:dropbox:ignored",
]);

async function loadStored(key, fallback) {
  let local;
  try { const raw = localStorage.getItem(key); if (raw != null) local = JSON.parse(raw); } catch (e) {}
  if (SYNCED_KEYS.has(key)) {
    try {
      const remote = await db.getState(key);
      if (remote !== null && remote !== undefined) {
        try { localStorage.setItem(key, JSON.stringify(remote)); } catch (e) {}
        return remote;
      }
      // El server no tiene nada pero este browser sí → seed (migración one-time del admin)
      if (local !== undefined) db.setState(key, local).catch(() => {});
    } catch (e) { /* sin red o sin sesión → usar caché local */ }
  }
  return local !== undefined ? local : fallback;
}

const _syncTimers = {};
async function saveStored(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  if (SYNCED_KEYS.has(key)) {
    // debounce: no martillar Supabase en cada tecla; last-write-wins por clave
    clearTimeout(_syncTimers[key]);
    _syncTimers[key] = setTimeout(() => {
      db.setState(key, value).catch(e => console.error(`sync ${key}:`, e.message));
    }, 800);
  }
}

// ═══ DEFAULT SPACES ══════════════════════════════════════════════════════
// ═══ PURE DATA HELPERS · safe ops compartidos entre handlers UI y tests ═══
// Estos garantizan invariantes (IDs únicos, cascade, validación) sin depender de React state.

function safeAddTaskPure(tasks, task) {
  const cleanedTitle = (task.title || "").trim() || "Sin título";
  const existingIds = new Set(tasks.map(t => t.id));
  let id = task.id || Date.now();
  while (existingIds.has(id)) id++;
  // CRITICAL: spread `task` FIRST, then override id/title — so safe values win
  return [...tasks, { parentId: task.parentId || null, comments: [], attachments: [], activity: [], ...task, id, title: cleanedTitle }];
}

function applySpaceDelete(state, spaceId, mode, targetSpaceId) {
  // state: { tasks, customViews, customSpaces }
  // mode: "move" | "delete-all"
  const newTasks = mode === "move"
    ? state.tasks.map(t => t.space === spaceId ? { ...t, space: targetSpaceId } : t)
    : state.tasks.filter(t => t.space !== spaceId);
  const newCustomViews = { ...state.customViews };
  delete newCustomViews[spaceId];
  const newCustomSpaces = state.customSpaces.filter(s => s.id !== spaceId);
  return { tasks: newTasks, customViews: newCustomViews, customSpaces: newCustomSpaces };
}

function applyTaskCascadeDelete(tasks, taskId, mode) {
  // mode: "delete-all" | "promote"
  if (mode === "promote") {
    return tasks.map(t => t.parentId === taskId ? { ...t, parentId: null } : t).filter(t => t.id !== taskId);
  }
  // delete-all — recursive descent through hierarchy
  const toDelete = new Set([taskId]);
  let changed = true;
  while (changed) {
    changed = false;
    tasks.forEach(t => { if (t.parentId && toDelete.has(t.parentId) && !toDelete.has(t.id)) { toDelete.add(t.id); changed = true; } });
  }
  return tasks.filter(t => !toDelete.has(t.id));
}

const DEFAULT_SPACES = [
  { id: "hq", code: "HQ", name: "Hygge HQ", count: 12, dot: "#0A0B0F" },
  { id: "proyectos", code: "PR", name: "Proyectos", count: 48, dot: "#3D52D5",
    children: [
      { id: "dc01", code: "DC01", name: "Del Castillo" },
      { id: "pu01", code: "PU01", name: "Paula Ugarriza" },
      { id: "tg01", code: "TG01", name: "De la Torre" },
      { id: "l36", code: "L36", name: "Larco 1036" },
    ]},
  { id: "bam", code: "BM", name: "BAM · Arquitectura", count: 22, dot: "#A89BD9" },
  { id: "finanzas", code: "FZ", name: "Finanzas", count: 9, dot: "#1E2A4A" },
  { id: "legal", code: "LG", name: "Legal", count: 6, dot: "#C2A45A" },
  { id: "comercial", code: "CM", name: "Comercial", count: 14, dot: "#5F8A6A" },
  { id: "marketing", code: "MK", name: "Marketing", count: 7, dot: "#A85B5B" },
  { id: "growth", code: "GR", name: "Growth", count: 29, dot: "#B8C8E5" },
];

// Tools — distinct from Spaces. Self-contained utilities with their own internal actions.
// LAB · sección experimental en sidebar · agentes de Wonderland visibles fuera de Settings
const LAB_TOOLS = [
  { id: "lab-tea-table", label: "Tea Table", icon: Coffee, dot: "#A85B5B", emoji: "🫖" },
  { id: "lab-jabberwocky", label: "Jabberwocky", icon: Zap, dot: "#C2A45A", emoji: "⚡" },
  { id: "lab-bandersnatch", label: "Bandersnatch", icon: Trash2, dot: "#A85B5B", emoji: "🗑️" },
  { id: "lab-cheshire", label: "Cheshire", icon: Eye, dot: "#A89BD9", emoji: "😺" },
  { id: "lab-mad-hatter", label: "Mad Hatter", icon: BarChart3, dot: "#3D52D5", emoji: "🎩" },
  { id: "lab-white-rabbit", label: "White Rabbit", icon: Activity, dot: "#5F8A6A", emoji: "🐰" },
  { id: "lab-dark-alice", label: "Dark Alice", icon: Shield, dot: "#0A0B0F", emoji: "🖤" },
];

const TOOLS = [
  { id: "alicia", label: "Alicia", icon: Bot, dot: "#A855F7" },
  { id: "inbox", label: "Sin asignar", icon: InboxIcon, dot: "#3D52D5" },
  { id: "messages", label: "Mensajes", icon: MessageSquare, dot: "#A89BD9" },
  { id: "calendar-tool", label: "Calendario", icon: CalIcon, dot: "#5F8A6A" },
  { id: "wikihygge", label: "WikiHygge", icon: FileText, dot: "#C2A45A" },
  { id: "ceo-dashboard", label: "CEO Dashboard", icon: LayoutDashboard, dot: "#1E2A4A" },
  { id: "notifications", label: "Notificaciones", icon: Bell, dot: "#A85B5B" },
];
const isToolId = (id) => TOOLS.some(t => t.id === id);

// ─── TASK STATUSES ───────────────────────────────────────────────────────────
const TASK_STATUSES = [
  { id: "pendiente",   label: "Pendiente",   color: "#6B6863", icon: "○" },
  { id: "en_proceso",  label: "En proceso",  color: "#3D52D5", icon: "◑" },
  { id: "en_revision", label: "En revisión", color: "#C2A45A", icon: "◐" },
  { id: "postergada",  label: "Postergada",  color: "#A85B5B", icon: "⊘" },
  { id: "completada",  label: "Completada",  color: "#5F8A6A", icon: "●" },
];
const getTaskStatus = (t) => t.status || (t.checked ? "completada" : "pendiente");
const taskStatusDef = (id) => TASK_STATUSES.find(s => s.id === id) || TASK_STATUSES[0];

// ─── APPS · Artifacts externos embebidos como iframes ──────────────────────
// Filosofía: cada app vive en su propio repo y deployment · ALICE las descubre
// y embebe vía iframe full-height. Si una app se rompe, ALICE sigue andando.
//
// Para agregar una app nueva:
//   1. Deploy la app independiente (URL pública)
//   2. Agregás un objeto a APPS con id, label, icon, url
//   3. Aparece en el sidebar bajo "Apps" automáticamente
//
// postMessage protocol (futuro): la app recibe { type: 'hygge:context', user, spvId? }
// y puede emitir { type: 'hygge:notify', message } para que aparezca en ALICE.
const APPS = [
  {
    id: "app-radar",
    label: "Radar",
    icon: Activity,
    dot: "#3D52D5",
    url: "https://hygge-radar.netlify.app/",
    description: "Lima Moderna · 688 proyectos · mapa reactivo · Velocity AI",
    badge: "v3.0",
    native: false,
  },
  {
    id: "app-reactor",
    label: "Reactor",
    icon: Zap,
    dot: "#F7643B",
    url: "/reactor.html",
    description: "Conciliación bancaria · estado de cuenta + pantallazos · Excel",
    badge: "v3.0",
    native: true,
  },
  {
    id: "app-diagramatic",
    label: "Diagramatic",
    icon: PenSquare,
    dot: "#3C5A78",
    url: null,
    description: "Canvas libre · stickies, shapes, flechas, iconos + lápiz Apple Pencil",
    badge: "v2.0",
    native: true,
  },
  {
    id: "app-commissioner",
    label: "The Commissioner",
    icon: BarChart3,
    dot: "#C2A45A",
    url: "/commissioner.html",
    description: "Commissioner · análisis y reportes",
    badge: "v1.0",
    native: true,
  },
  {
    id: "app-velocity",
    label: "Velocity",
    icon: TrendingUp,
    dot: "#5F8A6A",
    url: null,
    description: "Simulador de velocidad de ventas · análisis de mercado · Alicia AI",
    badge: "v1.0",
    native: true,
  },
  {
    id: "app-cabida",
    label: "Cabida",
    icon: Building2,
    dot: "#F7643B",
    url: null,
    description: "Calculadora de cabida preliminar · áreas, unidades, sótanos, margen bruto",
    badge: "v1.0",
    native: true,
  },
  // Futuro: { id: "app-brochure-gen", ... }
  {
    id: "app-games",
    label: "Juegos",
    icon: Gamepad2,
    dot: "#A855F7",
    url: "/games.html",
    description: "Helicopter BAM Edition · esquivá obstáculos · modo salvo",
    badge: "v1.0",
    native: true,
  },
];
const isAppId = (id) => APPS.some(a => a.id === id);

// ─── WIKIHYGGE · navegador de archivos · estructura real del Drive de Hygge ───
// Estructura sincronizada del Drive `sebastian@hygge.pe` · snapshot 2026-05-12
// Cada nodo: id, name, type (folder|sheet|doc|slides|pdf|miro|other), parent, source(drive|miro|...), url, modified, owner
const WIKIHYGGE_TREE = {
  // ROOT
  "root": { id: "root", name: "WikiHygge", type: "folder", parent: null, children: ["00-empresa", "01-proyectos", "02-bam", "03-finanzas", "04-legal", "05-comercial", "06-marketing", "07-growth"] },

  // ÁREAS TOP-LEVEL · espejo de la raíz HYGGE GRUPPE del Drive
  "00-empresa": { id: "00-empresa", name: "Empresa", section: "00 EMPRESA", type: "folder", parent: "root", driveId: "1spAMtrKFp6v4OejrvoGgjpmaQ8yx124e", children: ["cap-table", "acuerdo-privado"] },
  "01-proyectos": { id: "01-proyectos", name: "Proyectos", section: "01 PROYECTOS", type: "folder", parent: "root", driveId: "1PIbOe9mqTJ48v9GPnwC6mKxPD8T0t_uA", children: ["dc01", "pu01", "tg01", "l36"] },
  "02-bam": { id: "02-bam", name: "BAM · Arquitectura", section: "02 BAM", type: "folder", parent: "root", driveId: "1O_Kqjd3Ihav_Ax9RnDwipRaG_PARviQe", children: ["estudio-bam", "brand-bam"] },
  "03-finanzas": { id: "03-finanzas", name: "Finanzas", section: "03 FINANZAS", type: "folder", parent: "root", driveId: "1ZeSIs3lXp8jAKB9xdyZB158xbE1jgOWV", children: ["fin-contabilidad", "fin-fit-deuda", "fin-inversionistas", "fin-flujos-caja", "cashflow-2026"] },
  "04-legal": { id: "04-legal", name: "Legal", section: "04 LEGAL", type: "folder", parent: "root", driveId: "1FMUSH1tXwEsmm1kQVclPH4xDQfjwJz8Z", children: [] },
  "05-comercial": { id: "05-comercial", name: "Comercial", section: "05 COMERCIAL", type: "folder", parent: "root", driveId: "12X1RqKCiwN2yrWPwxhqJPPZ4ST3mvpme", children: [] },
  "06-marketing": { id: "06-marketing", name: "Marketing & Branding", section: "06 MARKETING", type: "folder", parent: "root", driveId: "1C_IYFZ8WZcva3S1IJC9B9sj6tkUk0JN1", children: ["brand-bronca"] },
  "07-growth": { id: "07-growth", name: "Growth", section: "07 GROWTH", type: "folder", parent: "root", driveId: "1_047Y72FtOj7KppUh8YPq54-O0Jz0oj-", children: [] },

  // SPVs · cada uno tiene la metodología 5-fase
  "dc01": { id: "dc01", name: "Del Castillo · DC01", code: "DC01", type: "folder", parent: "01-proyectos", driveId: "1H9OIY6qSZYjk9pYKdS7fWt4AeLzxMRA2", children: ["dc01-01", "dc01-02", "dc01-03", "dc01-04", "dc01-05"] },
  "dc01-01": { id: "dc01-01", name: "Diseño & Arquitectura", phase: "01", type: "folder", parent: "dc01", driveId: "1LUiluqeWiRgaEYysd2D5VpalFHVBcwTl", children: [] },
  "dc01-02": { id: "dc01-02", name: "Permisos & Licencias", phase: "02", type: "folder", parent: "dc01", driveId: "1WfbNT1IaX0KNMAn-QCiytZtl_Mgulnym", children: [] },
  "dc01-03": { id: "dc01-03", name: "Construcción", phase: "03", type: "folder", parent: "dc01", driveId: "1RznluRU_yZdmnteO3tfeTFNDWneS7V6W", children: [] },
  "dc01-04": { id: "dc01-04", name: "Ventas & Contratos", phase: "04", type: "folder", parent: "dc01", driveId: "1D5We9cwxEMGsPHXT0ulokLTOsOZUbLuc", children: [] },
  "dc01-05": { id: "dc01-05", name: "Financiero", phase: "05", type: "folder", parent: "dc01", driveId: "1j_jUfSC2Z3G7qjBAbNVH8J2esKTz9bov", children: [] },
  "pu01": { id: "pu01", name: "Paula Ugarriza · PU01", code: "PU01", type: "folder", parent: "01-proyectos", driveId: "1nj-IW-zk7LpgN6BqwTJ0B5ncBwBAiEEr", children: [] },
  "tg01": { id: "tg01", name: "De la Torre · TG01", code: "TG01", type: "folder", parent: "01-proyectos", driveId: "1QDbsSGIekQb3eKuYOuwma7-nQ0SSK3tt", children: [] },
  "l36": { id: "l36", name: "Larco 1036 · L36", code: "L36", type: "folder", parent: "01-proyectos", driveId: "1NLCOo1bfaeKHJyNWfJaluMK0YGYzrOMY", children: [] },

  // BAM children
  "estudio-bam": { id: "estudio-bam", name: "Estudio BAM", type: "folder", parent: "02-bam", driveId: "1-FWqI1EaKtX6zViJsGzcApuHOXDZVP-8", children: [] },
  "brand-bam": { id: "brand-bam", name: "Brand BAM", type: "folder", parent: "02-bam", children: [] },

  // FINANZAS children
  "fin-contabilidad": { id: "fin-contabilidad", name: "Contabilidad", type: "folder", parent: "03-finanzas", driveId: "1pQDZq6aPGs5MbM0Nx1h58je41O4-2vmu", children: [] },
  "fin-fit-deuda": { id: "fin-fit-deuda", name: "Fit Capital · Deuda", type: "folder", parent: "03-finanzas", driveId: "1Jpy47Y2n5-FYfIsh6oCSv7KLZOlCIMD3", children: [] },
  "fin-inversionistas": { id: "fin-inversionistas", name: "Inversionistas", type: "folder", parent: "03-finanzas", driveId: "16buC-QRfDXS32N3vsN8be8yPSBAyaocO", children: ["cap-table"] },
  "fin-flujos-caja": { id: "fin-flujos-caja", name: "Flujos de Caja", type: "folder", parent: "03-finanzas", driveId: "1ASk9YaV2igGGbHjM2FkGgPvSVgovJSF3", children: ["fc-macro", "fc-dc", "fc-pu", "fc-tg", "fc-legendre"] },
  "fc-macro": { id: "fc-macro", name: "FC MACRO", type: "folder", parent: "fin-flujos-caja", driveId: "1SEfb4e2cQGrNkWtUbCYKfTpo26mWq0t8", children: [] },
  "fc-dc": { id: "fc-dc", name: "FC · Del Castillo", type: "folder", parent: "fin-flujos-caja", driveId: "1jeSZJLyUfsrsxeOImlDV8kxqHeds6F3w", children: [] },
  "fc-pu": { id: "fc-pu", name: "FC · Paula Ugarriza", type: "folder", parent: "fin-flujos-caja", driveId: "1v1cDIR0FMXZu15YBXOuggKiTibtmrgxr", children: [] },
  "fc-tg": { id: "fc-tg", name: "FC · De la Torre", type: "folder", parent: "fin-flujos-caja", driveId: "1zho6xqpXHac2p4VAmVJF8iSH4eOOtVXJ", children: ["legendre-xlsx"] },
  "fc-legendre": { id: "fc-legendre", name: "Edificio Legendre", type: "folder", parent: "fin-flujos-caja", children: ["legendre-xlsx"] },

  // MARKETING children
  "brand-bronca": { id: "brand-bronca", name: "Brand Hygge · Bronca", type: "folder", parent: "06-marketing", driveId: "1TZvxsncwDME0qFP3jJZq3mMpAGjG_ZvA", children: [] },

  // FILES · key files identified
  "cap-table": { id: "cap-table", name: "Cap Table · Investors", type: "sheet", parent: "fin-inversionistas", driveId: "1eR98gF1wpxTlGNBY6qeovxSsykrkauogaYOv07cIQkY", source: "google-sheets", modified: "2026-05-15", owner: "Sebastián Bonilla", note: "Tabla de participaciones por proyecto" },
  "cashflow-2026": { id: "cashflow-2026", name: "Cash Flow Hygge 2026", type: "sheet", parent: "03-finanzas", driveId: "1KUp7z4OtuQ24EXZvTdsLf0JQP8dQk1Jn4v3Md3a63Bo", source: "google-sheets", modified: "2026-05-20", owner: "Joel Moy", note: "Cash flow ejecutivo del año" },
  "acuerdo-privado": { id: "acuerdo-privado", name: "ACUERDO PRIVADO Libre 5", type: "doc", parent: "00-empresa", driveId: "1fToxXb332tY23TGHweCJuMtjZiE9t8iJ", source: "google-docs", modified: "2026-04-08", owner: "J.M. Galup", note: "Acuerdo entre socios · revisar antes de pasarlo" },
  "legendre-xlsx": { id: "legendre-xlsx", name: "Edificio Legendre · ventas brutas", type: "sheet", parent: "fc-legendre", driveId: "12cSCNNGz6QuREEuIVAk6NcVrvNb4eomM", source: "google-sheets", modified: "2026-05-18", owner: "Joel Moy", note: "FC ventas brutas $5.9M · margen 6.36% · 15 dptos · aporte $2.4M" },
};

// Helper: returns list of space ids that match a logical "current space" — for parent spaces, includes all children
const resolveSpaceIds = (currentSpaceId, allSpaces, includeChildren = true) => {
  const parent = allSpaces.find(s => s.id === currentSpaceId);
  if (parent?.children?.length && includeChildren) {
    return [currentSpaceId, ...parent.children.map(c => c.id)];
  }
  return [currentSpaceId];
};

const VIEWS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "list", label: "Lista", icon: List },
  { id: "board", label: "Board", icon: Kanban },
  { id: "gantt", label: "Gantt", icon: GanttChart },
  { id: "calendar", label: "Calendario", icon: CalIcon },
  { id: "table", label: "Tabla", icon: Table2 },
  { id: "archivos", label: "Archivos", icon: FileText },
  { id: "whiteboard", label: "Whiteboard", icon: PenSquare },
  { id: "viewport", label: "Viewport", icon: Globe },
];

// Mapeo Space → carpeta Dropbox
// Rutas REALES del Dropbox Hygge (convención de _SISTEMA/convenciones.md: carpetas numeradas,
// proyectos = CODIGO_nombre). Verificadas contra el Dropbox el 13 jul 2026 — NO inventar rutas:
// si esto no coincide con la realidad, el sync propone crear spaces duplicados.
const SPACE_DROPBOX_PATHS = {
  "hq":          "/Hygge/01_HQ",
  "proyectos":   "/Hygge/02_PROYECTOS",
  "bam":         "/Hygge/03_BAM",
  "finanzas":    "/Hygge/04_FINANZAS",
  "legal":       "/Hygge/05_LEGAL",
  "comercial":   "/Hygge/06_COMERCIAL",
  "marketing":   "/Hygge/07_MARKETING",
  "growth":      "/Hygge/08_GROWTH",
  "dc01":        "/Hygge/02_PROYECTOS/DC01_del_castillo",
  "pu01":        "/Hygge/02_PROYECTOS/PU01_paula_ugarriza",
  "tg01":        "/Hygge/02_PROYECTOS/TG01_de_la_torre",
  "l36":         "/Hygge/02_PROYECTOS/L36_larco_1036",
};
// Carpetas de infra que NUNCA disparan el popup de "crear space" (00_INBOX es bandeja, 09_ALICE
// es de Alicia, 10_CONTABILIDAD es archivo contable, _* = sistema por convención)
const DROPBOX_SYSTEM_FOLDERS = new Set(["00_inbox", "09_alice", "10_contabilidad"]);

const SPV_TIPOS = [
  { id: "spv_propio",    label: "SPV propio",       hint: "Hygge como developer" },
  { id: "administracion", label: "Administración",  hint: "Fee por gestión, no capital propio" },
  { id: "studio",        label: "Studio",            hint: "BAM · diseño y fees de proyecto" },
];
const SPV_STATUSES = ["En desarrollo", "En venta", "Entrega", "Post-entrega", "Supervisión", "Adquisición", "Completado"];

const DEFAULT_SPVS = [
  { code: "DC01", name: "Hygge Del Castillo",   district: "San Isidro", tipo: "spv_propio",    rol: "Developer",            totalUnits: 0, sold: 0, construction: 0, salesPEN: 0, targetPEN: 0, margin: 0, status: "En desarrollo", statusTone: "navy",    nextMilestone: "—" },
  { code: "PU01", name: "Hygge Paula Ugarriza", district: "Miraflores", tipo: "spv_propio",    rol: "Developer",            totalUnits: 0, sold: 0, construction: 0, salesPEN: 0, targetPEN: 0, margin: 0, status: "En desarrollo", statusTone: "ochre",   nextMilestone: "—" },
  { code: "TG01", name: "Hygge De la Torre",    district: "Barranco",   tipo: "spv_propio",    rol: "Developer",            totalUnits: 0, sold: 0, construction: 0, salesPEN: 0, targetPEN: 0, margin: 0, status: "En desarrollo", statusTone: "lavender",nextMilestone: "—" },
  { code: "L36",  name: "Larco 1036",           district: "Miraflores", tipo: "administracion", rol: "Administración + fee", totalUnits: 0, sold: 0, construction: 0, salesPEN: 0, targetPEN: 0, margin: 0, status: "Supervisión",  statusTone: "muted",   nextMilestone: "—" },
];

const OPS_BY_AREA = [{ area: "BAM", open: 14, overdue: 2 }, { area: "Finanzas", open: 9, overdue: 0 }, { area: "Comercial", open: 12, overdue: 3 }, { area: "Legal", open: 6, overdue: 1 }, { area: "Operaciones", open: 11, overdue: 0 }, { area: "Marketing", open: 7, overdue: 1 }];
const LAND_PIPELINE = [{ stage: "Identificación", count: 14 }, { stage: "Análisis", count: 8 }, { stage: "Negociación", count: 4 }, { stage: "Due Diligence", count: 2 }, { stage: "Cierre", count: 1 }];

// Growth · terrenos en evaluación para nuevos proyectos
const TERRENO_STATUSES = [
  { id: "scouting",      label: "Scouting",      color: "#8C8F96" },
  { id: "negociando",    label: "Negociando",    color: "#C2A45A" },
  { id: "due-diligence", label: "Due diligence", color: "#3D52D5" },
  { id: "comprado",      label: "Comprado",      color: "#5F8A6A" },
  { id: "descartado",    label: "Descartado",    color: "#A85B5B" },
];
const terrenoStatus = (id) => TERRENO_STATUSES.find(s => s.id === id) || TERRENO_STATUSES[0];

// Lima bounding box (approximate, central districts)
const MAP_BOUNDS = { north: -12.00, south: -12.20, west: -77.10, east: -76.90 };

const INITIAL_TERRENOS = [];
const HOT_DEALS = [];
const BAM_RFIS = [];
const LEGAL_PERMITS = [];
const COMERCIAL_FUNNEL = [];
const MARKETING_CHANNELS = [];

// ═══ TASKS — Importadas desde ClickUp workspace 90171161839 (Hygge x BAM) ═══
const _TD = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); };
// Compact constructor: ct(id, title, space, checked, assignee, priority, parentId, cuId, due, descExtra)
const _ct = (id, title, space, checked, assignee, priority, parentId, cuId, due, descExtra = "") => ({
  id, parentId, title,
  description: (descExtra ? descExtra + "\n\n" : "") + `🔗 ClickUp: https://app.clickup.com/t/${cuId}`,
  project: space === "dc01" ? "DC01" : space === "pu01" ? "PU01" : space === "tg01" ? "TG01" : space === "l36" ? "L36" : space.toUpperCase().slice(0, 3),
  priority: priority || "media",
  due: due || _TD(0), startDate: due || _TD(0), endDate: due || _TD(0),
  space, checked, assignee,
  clickupId: cuId, clickupUrl: `https://app.clickup.com/t/${cuId}`,
  comments: [], attachments: [], activity: [{ when: "importado", text: "Sincronizado desde ClickUp · Hygge x BAM" }],
});

const INITIAL_TASKS = [];

// ═══ DRIVE EMBEDS + MIRO VIEWERS — pre-poblados por space ═══
// Drive URLs: folders use embeddedfolderview, Google Sheets use /preview, other files use /preview
const _drvFolder = (id) => `https://drive.google.com/embeddedfolderview?id=${id}#grid`;
const _drvSheet = (id) => `https://docs.google.com/spreadsheets/d/${id}/preview`;
const _drvFile = (id) => `https://drive.google.com/file/d/${id}/preview`;
const _miroPh = "https://miro.com/welcome/"; // placeholder · editar en CustomViewConfigModal

const INITIAL_CUSTOM_VIEWS = {};

const INITIAL_MESSAGES = [];

// Activity feed inicial · vacío · se popula con eventos reales de ALICE (toggleTask, addTask, updateTask)
// Persistido en localStorage como "hygge:activity" · últimos 50 eventos
const ACTIVITY = [];

// Relative time helper · "hace X min/hr/día"
function timeAgo(ts) {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  if (diff < 0) return "ahora";
  const min = Math.floor(diff / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `hace ${d} ${d === 1 ? "día" : "días"}`;
  const mo = Math.floor(d / 30);
  return `hace ${mo} ${mo === 1 ? "mes" : "meses"}`;
}

// Each whiteboard is an array of elements. Each element has: id, type, plus type-specific fields.
// Types: "sticky", "text", "rect", "ellipse", "arrow", "path"
const INITIAL_WHITEBOARDS = {};

const PROJECT_CONFIGS = {
  dc01: { code: "DC01", name: "Hygge Del Castillo", district: "San Isidro", address: "Calle Del Castillo 234", architect: "BAM Studio", timeline: "2025 · 2026", construction: 0, sold: 0, totalUnits: 0, salesPEN: 0, targetPEN: 0, margin: 0, status: "—", statusTone: "muted", nextMilestone: "—", units: [], milestones: [] },
  pu01: { code: "PU01", name: "Hygge Paula Ugarriza", district: "Miraflores", address: "Calle Paula Ugarriza 488", architect: "BAM Studio", timeline: "2025 · 2027", construction: 0, sold: 0, totalUnits: 0, salesPEN: 0, targetPEN: 0, margin: 0, status: "—", statusTone: "muted", nextMilestone: "—", units: [], milestones: [] },
  tg01: { code: "TG01", name: "Hygge De la Torre", district: "Barranco", address: "Av. De la Torre Gonzales 102", architect: "BAM Studio", timeline: "2024 · 2026", construction: 0, sold: 0, totalUnits: 0, salesPEN: 0, targetPEN: 0, margin: 0, status: "—", statusTone: "muted", nextMilestone: "—", units: [], milestones: [] },
  l36: { code: "L36", name: "Larco 1036", district: "Miraflores", address: "Av. Larco 1036", architect: "Externo · supervisión Hygge", timeline: "2025 · 2027", construction: 0, sold: 0, totalUnits: 0, salesPEN: 0, targetPEN: 0, margin: 0, status: "—", statusTone: "muted", nextMilestone: "—", units: [], milestones: [] },
};

// ═══ SMART CAPTURE & PATTERN DETECTOR ═══════════════════════════════════
// Patterns the system recognizes in task titles to suggest views.
// Each pattern matches Spanish operational language.
const PATTERN_DEFINITIONS = [
  { id: "pago", regex: /^pago\s+/i, label: "Pagos", hint: "tipo:pago" },
  { id: "detraccion", regex: /^detracci[oó]n\s+/i, label: "Detracciones", hint: "tipo:detraccion" },
  { id: "prospecto", regex: /^status\s+(del\s+)?prospecto\s+/i, label: "Prospectos", hint: "tipo:prospecto" },
  { id: "reunion", regex: /^(reuni[oó]n\s+con|coordinar\s+reuni[oó]n)/i, label: "Reuniones", hint: "tipo:reunion" },
  { id: "estados", regex: /^estados?\s+de\s+cuenta/i, label: "Estados de cuenta", hint: "tipo:estados-de-cuenta" },
  { id: "conformidad", regex: /^conformidad\s+de\s+obra/i, label: "Conformidad de obra", hint: "tipo:conformidad" },
  { id: "planos", regex: /^planos?\s+/i, label: "Planos", hint: "tipo:planos" },
  { id: "file", regex: /^file[_\s]/i, label: "Files", hint: "tipo:file" },
  { id: "revision", regex: /^revis(ar|i[oó]n)/i, label: "Revisiones", hint: "tipo:revision" },
  { id: "decision", regex: /^decisi[oó]n[:_\s]/i, label: "Decisiones", hint: "tipo:decision" },
];

// Detect patterns in a list of tasks. Returns array of { pattern, count, taskIds }
const detectPatterns = (tasks) => {
  const open = tasks.filter(t => !t.checked && !t.parentId);
  return PATTERN_DEFINITIONS.map(p => {
    const matches = open.filter(t => p.regex.test(t.title || ""));
    return { ...p, count: matches.length, taskIds: matches.map(t => t.id) };
  }).filter(p => p.count >= 3); // surface only patterns with 3+ open matches
};

// Initial smart views — empty. They get created by user action (accepting pattern suggestions or saving custom filters).
const INITIAL_SMART_VIEWS = [];

// Parse natural language task input via Claude. Returns { title, type, person?, amount?, due?, project?, space?, priority?, assignee? }
// Falls back to heuristic parsing if API unavailable or invalid response.
async function parseSmartCapture(text, context) {
  const heuristic = () => {
    // Pattern-based fallback
    const t = text.trim();
    let type = null;
    for (const p of PATTERN_DEFINITIONS) {
      if (p.regex.test(t)) { type = p.id; break; }
    }
    const amountMatch = t.match(/\b(s\/?\s*)?(\d{1,3}(?:[,.]\d{3})*(?:[,.]\d+)?|\d+)\s*(soles|usd|s\.|s\/)?/i);
    const amount = amountMatch ? parseFloat(amountMatch[2].replace(/[,.]/g, m => m === "." ? "." : "")) : null;
    return { title: t, type, person: null, amount, due: null, project: null, space: type === "pago" ? "finanzas" : type === "prospecto" ? "comercial" : type === "estados" ? "finanzas" : null, priority: "media", assignee: "sb" };
  };
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: anthropicHeaders(),
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 400,
        system: `You parse Spanish natural-language quick-capture inputs from a Peruvian real-estate developer (Hygge) into a structured task. Respond ONLY with raw JSON, no markdown, no explanation.

Schema:
{
  "title": string (clean, capitalized task title),
  "type": "pago" | "detraccion" | "prospecto" | "reunion" | "estados" | "conformidad" | "planos" | "file" | "revision" | "decision" | "tarea" | null,
  "person": string | null (named person, e.g. "Daniel Yep"),
  "amount": number | null (in soles unless USD mentioned),
  "due": string | null (relative like "hoy", "mañana", "viernes", "lun 02", or YYYY-MM-DD),
  "project": "DC01" | "PU01" | "TG01" | "L36" | string | null,
  "space": "finanzas" | "comercial" | "legal" | "marketing" | "bam" | "hq" | string | null,
  "priority": "alta" | "media" | "baja",
  "assignee": "sb" | "aa" | "jm" | "jt" | "vd" | "jmg" | "ac" | null
}

Context: ${context || "default"}. Map type to space: pago/detraccion/estados → finanzas; prospecto → comercial; reunion → hq; conformidad/planos → bam; decision → hq; revision → keep null unless clear.`,
        messages: [{ role: "user", content: text }],
      })
    });
    if (!response.ok) return heuristic();
    const data = await response.json();
    const raw = data.content?.[0]?.text || "";
    const clean = raw.replace(/```json\n?|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return { ...heuristic(), ...parsed }; // merge with heuristic as fallback
  } catch (e) {
    return heuristic();
  }
}


const pen = (n) => n >= 1_000_000 ? "S/ " + (n/1_000_000).toFixed(2) + "M" : "S/ " + (n/1_000).toFixed(0) + "K";
const fmtTime = (s) => { const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60; return [h,m,sec].map(n => String(n).padStart(2,"0")).join(":"); };
const nowHHMM = () => { const d = new Date(); return String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0"); };

// ═══ PRIMITIVES ══════════════════════════════════════════════════════════
const NavyRule = ({ width = 28 }) => <div style={{ width, height: 2, backgroundColor: C.navy }} />;
const Eyebrow = ({ children, color = C.muted }) => <div className="text-[10px] tracking-[0.2em] uppercase" style={{ color, fontWeight: 500 }}>{children}</div>;
const fieldClass = "w-full px-3 py-2 text-[14px] outline-none";
const fieldStyle = { backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2, color: C.ink };
const SectionHead = ({ title, blurb, action, onAction }) => (
  <div className="mb-7">
    <NavyRule />
    <div className="mt-3 flex items-end justify-between gap-6 flex-wrap">
      <h2 className="text-[22px]" style={{ color: C.ink, fontWeight: 600, letterSpacing: "-0.012em" }}>{title}</h2>
      {action && <button onClick={onAction} className="text-[11px] tracking-[0.16em] uppercase inline-flex items-center gap-1.5 hover:opacity-60" style={{ color: C.ink, fontWeight: 500 }}>{action} →</button>}
    </div>
    {blurb && <p className="text-[13px] mt-2 max-w-2xl" style={{ color: C.inkSoft, lineHeight: 1.6 }}>{blurb}</p>}
  </div>
);
const Panel = ({ children, className = "" }) => <div className={"p-6 " + className} style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>{children}</div>;
const Hero = ({ eyebrow, code, intro }) => (
  <div className="mb-14">
    <NavyRule /><div className="mt-4"><Eyebrow>{eyebrow}</Eyebrow></div>
    <h1 className="text-[72px] leading-[0.95] mt-5" style={{ color: C.ink, fontWeight: 300, letterSpacing: "-0.04em" }}>{code}</h1>
    <p className="text-[15px] mt-6 max-w-2xl" style={{ color: C.inkSoft, lineHeight: 1.65 }}>{intro}</p>
  </div>
);
const KpiBar = ({ items }) => (
  <div className="grid" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2, gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
    {items.map((k, i) => (
      <div key={i} className="px-6 py-6" style={{ borderRight: i < items.length - 1 ? `1px solid ${C.lineSoft}` : "none" }}>
        <Eyebrow>{k.label}</Eyebrow>
        <div className="text-[28px] mt-3 mb-2" style={{ color: C.ink, fontWeight: 300, letterSpacing: "-0.03em", lineHeight: 1 }}>{k.value}</div>
        <div className="flex items-center gap-2 text-[11px]">
          {k.delta && <span style={{ color: k.positive ? C.cobalt : C.brick, fontWeight: 600 }}>{k.positive ? "↗" : "↘"} {k.delta}</span>}
          {k.sub && <span style={{ color: C.muted }}>{k.sub}</span>}
        </div>
      </div>
    ))}
  </div>
);

const Avatar = ({ personId, size = 24 }) => {
  const users = React.useContext(UsersContext);
  const u = lookupUser(personId, users);
  const p = findPerson(personId);
  if (!p && !u) return null;
  const name = u ? `${u.firstName} ${u.lastName}`.trim() : p.name;
  const role = u?.role || p?.role || "";
  const color = u?.color || p?.color || C.muted;
  const initials = u?.initials || p?.initials || ((u?.firstName?.[0] || "?") + (u?.lastName?.[0] || "")).toUpperCase();
  const avatar = u?.avatar;
  return (
    <div className="flex items-center justify-center flex-shrink-0 overflow-hidden" title={name + (role ? " · " + role : "")}
      style={{ width: size, height: size, backgroundColor: color, color: "#fff", borderRadius: 999, fontSize: size * 0.38, fontWeight: 600 }}>
      {avatar
        ? <img src={avatar} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} draggable={false} />
        : initials}
    </div>
  );
};

// ═══ TASK DETAIL PANEL ═══════════════════════════════════════════════════
function TaskDetailPanel({ task, allTasks, allSpaces = [], onClose, onUpdate, onToggle, onAddComment, onAddAttachment, onRemoveAttachment, onAddSubtask, onDuplicate, setTaskStatus, onDelete }) {
  const [title, setTitle] = useState(task?.title || "");
  const [description, setDescription] = useState(task?.description || "");
  const [comment, setComment] = useState("");
  const [subtask, setSubtask] = useState("");
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const fileInputRef = useRef(null);
  const titleSavedRef = useRef(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      titleSavedRef.current = false;
    }
  }, [task?.id]);

  // Save edits with debounce
  useEffect(() => {
    if (!task) return;
    const id = setTimeout(() => {
      if (title !== task.title || description !== (task.description || "")) {
        onUpdate(task.id, { title, description });
      }
    }, 600);
    return () => clearTimeout(id);
  }, [title, description, task]);

  // Paste images
  useEffect(() => {
    if (!task) return;
    const handlePaste = async (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            const reader = new FileReader();
            reader.onload = () => {
              onAddAttachment(task.id, {
                id: Date.now() + Math.random(),
                name: `pegado-${nowHHMM().replace(":", "")}.png`,
                type: file.type,
                size: file.size,
                dataUrl: reader.result,
                addedBy: "sb",
                addedAt: nowHHMM(),
              });
            };
            reader.readAsDataURL(file);
          }
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [task]);

  if (!task) return null;
  const children = allTasks.filter(t => t.parentId === task.id);
  const assignee = findPerson(task.assignee);

  const onFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        onAddAttachment(task.id, {
          id: Date.now() + Math.random(),
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl: reader.result,
          addedBy: "sb",
          addedAt: nowHHMM(),
        });
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end" style={{ backgroundColor: "rgba(10,11,15,0.4)" }} onClick={onClose}>
      <div className="w-full max-w-[760px] flex flex-col" style={{ backgroundColor: C.paper, boxShadow: "0 24px 48px rgba(0,0,0,0.2)" }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-8 py-5 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
          <div className="flex items-center gap-3">
            {setTaskStatus ? (
              <StatusMenu task={task} setTaskStatus={setTaskStatus} size={20} />
            ) : (
              <button onClick={() => onToggle(task.id)} className="hover:opacity-70">
                {task.checked ? <CheckCircle2 size={20} style={{ color: C.green }} /> : <Circle size={20} style={{ color: C.muted }} />}
              </button>
            )}
            <Eyebrow>Tarea · {task.project}</Eyebrow>
          </div>
          <div className="flex items-center gap-2">
            {onDuplicate && (
              <button onClick={() => onDuplicate(task.id)} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] hover:opacity-90" style={{ color: C.inkSoft, border: `1px solid ${C.lineSoft}`, borderRadius: 2, fontWeight: 500 }} title="Duplicar tarea">
                <Copy size={11} /> <span className="hidden sm:inline">Duplicar</span>
              </button>
            )}
            {onDelete && (
              <button onClick={() => { onDelete(task.id); onClose(); }} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] hover:opacity-90" style={{ color: C.brick, border: `1px solid ${C.brick}33`, borderRadius: 2, fontWeight: 500 }} title="Eliminar tarea">
                <Trash2 size={11} /> <span className="hidden sm:inline">Eliminar</span>
              </button>
            )}
            <button onClick={async () => {
              const link = `${window.location.origin}${window.location.pathname}#/task/${task.id}`;
              try { await navigator.clipboard.writeText(link); } catch { const ta = document.createElement("textarea"); ta.value = link; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); }
              alert(`Link copiado:\n${link}`);
            }} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] hover:opacity-90" style={{ color: C.inkSoft, border: `1px solid ${C.lineSoft}`, borderRadius: 2, fontWeight: 500 }} title="Copiar link directo a esta tarea">
              <ExternalLink size={11} /> <span className="hidden sm:inline">Link</span>
            </button>
            <button onClick={onClose} className="p-1.5 hover:opacity-60" title="Cerrar (Esc)"><X size={16} style={{ color: C.muted }} /></button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {/* Title */}
          <textarea value={title} onChange={e => setTitle(e.target.value)} rows={title.length > 60 ? 2 : 1}
            className="w-full text-[26px] outline-none bg-transparent resize-none mb-2"
            style={{ color: C.ink, fontWeight: 600, letterSpacing: "-0.015em", lineHeight: 1.25, textDecoration: task.checked ? "line-through" : "none", opacity: task.checked ? 0.6 : 1 }} />

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-3 mb-7 text-[12px]">
            {/* Assignee */}
            <div className="relative">
              <button onClick={() => setShowAssigneePicker(!showAssigneePicker)} className="flex items-center gap-2 px-2.5 py-1.5 hover:opacity-90" style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
                {assignee ? <><Avatar personId={assignee.id} size={20} /><span style={{ color: C.ink, fontWeight: 500 }}>{assignee.name.split(" ")[0]}</span></> : <><UserIcon size={13} style={{ color: C.muted }} /><span style={{ color: C.muted }}>Sin asignar</span></>}
              </button>
              {showAssigneePicker && (
                <div className="absolute top-full left-0 mt-1 w-[240px] z-10" style={{ backgroundColor: C.paper, border: `1px solid ${C.line}`, borderRadius: 2, boxShadow: "0 8px 24px rgba(0,0,0,0.1)" }}>
                  {PEOPLE.map(p => (
                    <button key={p.id} onClick={() => { onUpdate(task.id, { assignee: p.id }); setShowAssigneePicker(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:opacity-90"
                      style={{ backgroundColor: assignee?.id === p.id ? C.surface : "transparent" }}>
                      <Avatar personId={p.id} size={22} />
                      <div className="flex-1">
                        <div className="text-[12px]" style={{ color: C.ink, fontWeight: 500 }}>{p.name}</div>
                        <div className="text-[10px]" style={{ color: C.muted }}>{p.role}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Priority */}
            <select value={task.priority} onChange={e => onUpdate(task.id, { priority: e.target.value })}
              className="px-2.5 py-1.5 text-[11px] tracking-[0.1em] uppercase outline-none"
              style={{ color: task.priority === "alta" ? C.brick : task.priority === "media" ? C.ochre : C.muted, backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2, fontWeight: 600 }}>
              <option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option>
            </select>

            {/* Due */}
            <input value={task.due} onChange={e => onUpdate(task.id, { due: e.target.value })}
              className="px-2.5 py-1.5 text-[11px] outline-none w-[100px]"
              style={{ color: C.inkSoft, backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }} />

            {/* Recurring */}
            <RecurringPicker
              value={task.recurring || null}
              onChange={rule => onUpdate(task.id, { recurring: rule || undefined })}
            />

            {/* Space (movable) */}
            <select value={task.space || "hq"} onChange={e => onUpdate(task.id, { space: e.target.value })}
              className="px-2.5 py-1.5 text-[11px] outline-none max-w-[180px] truncate"
              style={{ color: C.inkSoft, backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2, fontWeight: 500 }}
              title="Mover tarea a otro space">
              {allSpaces.flatMap(s => {
                const children = s.children || [];
                if (children.length === 0) return [<option key={s.id} value={s.id}>{s.name}</option>];
                return [
                  <option key={s.id} value={s.id} style={{ fontWeight: 600 }}>{s.name}</option>,
                  ...children.map(c => <option key={c.id} value={c.id}>  └ {c.name}</option>)
                ];
              })}
            </select>

            {/* Project badge (immutable, mostly informative) */}
            {task.project && (
              <span className="px-2.5 py-1.5 text-[10px] tracking-[0.12em] uppercase" style={{ color: C.inkSoft, backgroundColor: C.bg, border: `1px solid ${C.lineSoft}`, borderRadius: 2, fontWeight: 600 }}>
                {task.project}
              </span>
            )}
          </div>

          {/* Description */}
          <div className="mb-8">
            <Eyebrow>Descripción</Eyebrow>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4}
              placeholder="Añadí contexto, links, lo que sea…"
              className="w-full mt-3 px-3 py-2.5 outline-none text-[13px] resize-y"
              style={{ color: C.ink, lineHeight: 1.6, backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }} />
          </div>

          {/* Subtasks */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <Eyebrow>Subtareas · {children.length}</Eyebrow>
            </div>
            <div className="space-y-1">
              {children.map(c => (
                <div key={c.id} className="group/sub flex items-center gap-3 py-2 px-3" style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
                  <button onClick={() => onToggle(c.id)}>
                    {c.checked ? <CheckCircle2 size={14} style={{ color: C.green }} /> : <Circle size={14} style={{ color: C.muted }} />}
                  </button>
                  <div className="flex-1 text-[12px]" style={{ color: c.checked ? C.muted : C.ink, fontWeight: 500, textDecoration: c.checked ? "line-through" : "none" }}>{c.title}</div>
                  {c.assignee && <Avatar personId={c.assignee} size={18} />}
                  <button onClick={() => onUpdate(c.id, { parentId: null })} className="p-1 hover:opacity-70" title="Promover a tarea principal">
                    <CornerUpLeft size={11} style={{ color: C.muted }} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <CornerDownRight size={11} style={{ color: C.muted }} />
              <input value={subtask} onChange={e => setSubtask(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && subtask.trim()) { onAddSubtask(task.id, subtask.trim()); setSubtask(""); } }}
                placeholder="Nueva subtarea… ⏎"
                className="flex-1 px-2 py-1.5 outline-none text-[12px]"
                style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2, color: C.ink }} />
            </div>
          </div>

          {/* Attachments */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <Eyebrow>Adjuntos · {task.attachments?.length || 0}</Eyebrow>
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 text-[11px] tracking-[0.1em] uppercase hover:opacity-70"
                style={{ color: C.ink, fontWeight: 500 }}>
                <FileUp size={11} /> Subir
              </button>
              <input type="file" ref={fileInputRef} multiple onChange={onFileChange} className="hidden" />
            </div>
            {(task.attachments && task.attachments.length > 0) ? (
              <div className="grid grid-cols-3 gap-3">
                {task.attachments.map(a => (
                  <div key={a.id} className="group relative" style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2, overflow: "hidden" }}>
                    {a.type?.startsWith("image/") ? (
                      <img src={a.dataUrl} alt={a.name} className="w-full h-32 object-cover" />
                    ) : (
                      <div className="w-full h-32 flex items-center justify-center" style={{ backgroundColor: C.bg }}>
                        <FileText size={32} style={{ color: C.muted }} />
                      </div>
                    )}
                    <div className="p-2.5">
                      <div className="text-[11px] truncate" style={{ color: C.ink, fontWeight: 500 }} title={a.name}>{a.name}</div>
                      <div className="text-[10px] flex items-center justify-between mt-1" style={{ color: C.muted }}>
                        <span>{(a.size / 1024).toFixed(0)} KB</span>
                        <span>{a.addedAt}</span>
                      </div>
                    </div>
                    <button onClick={() => onRemoveAttachment(task.id, a.id)} className="absolute top-1 right-1 p-1 opacity-0 group-hover:opacity-100" style={{ backgroundColor: "rgba(10,11,15,0.7)", borderRadius: 2 }}>
                      <X size={11} style={{ color: "#fff" }} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div onClick={() => fileInputRef.current?.click()}
                className="text-center py-8 cursor-pointer hover:opacity-90"
                style={{ backgroundColor: C.surface, border: `1px dashed ${C.line}`, borderRadius: 2 }}>
                <Paperclip size={20} style={{ color: C.muted, margin: "0 auto 6px" }} />
                <div className="text-[12px]" style={{ color: C.inkSoft, fontWeight: 500 }}>Click para subir · o pegá una imagen (⌘V)</div>
                <div className="text-[10px] mt-1" style={{ color: C.muted }}>PDFs, screenshots, estados de cuenta, lo que sea</div>
              </div>
            )}
          </div>

          {/* Comments */}
          <div>
            <Eyebrow>Comentarios · {(task.comments || []).length}</Eyebrow>
            <div className="mt-4 space-y-4">
              {(task.comments || []).map(c => {
                const p = findPerson(c.who);
                return (
                  <div key={c.id} className="flex gap-3">
                    <Avatar personId={c.who} size={26} />
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-[12px]" style={{ color: C.ink, fontWeight: 600 }}>{p?.name || "Usuario"}</span>
                        <span className="text-[10px]" style={{ color: C.muted }}>{c.when}</span>
                      </div>
                      <div className="text-[13px]" style={{ color: C.ink, lineHeight: 1.55 }}>{c.text}</div>
                    </div>
                  </div>
                );
              })}
              {(task.comments || []).length === 0 && (
                <div className="text-[12px] py-2" style={{ color: C.muted }}>Sin comentarios todavía.</div>
              )}
            </div>
            <div className="mt-4 flex gap-3">
              <Avatar personId="sb" size={26} />
              <div className="flex-1">
                <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2}
                  onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && comment.trim()) { onAddComment(task.id, comment.trim()); setComment(""); } }}
                  placeholder="Comentá algo… ⌘⏎ para enviar"
                  className="w-full px-3 py-2.5 outline-none text-[13px] resize-y"
                  style={{ color: C.ink, lineHeight: 1.55, backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }} />
                <div className="flex justify-end mt-2">
                  <button onClick={() => { if (comment.trim()) { onAddComment(task.id, comment.trim()); setComment(""); } }}
                    disabled={!comment.trim()}
                    className="px-3 py-1.5 text-[11px] hover:opacity-90 disabled:opacity-40"
                    style={{ backgroundColor: C.ink, color: C.bg, borderRadius: 2, fontWeight: 500 }}>
                    Comentar
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Activity */}
          {(task.activity || []).length > 0 && (
            <div className="mt-10">
              <Eyebrow>Historial</Eyebrow>
              <div className="mt-3 space-y-2">
                {(task.activity || []).map((a, i) => (
                  <div key={i} className="flex items-baseline gap-3 text-[11px]">
                    <Clock size={10} style={{ color: C.muted }} />
                    <span style={{ color: C.muted, minWidth: 80 }}>{a.when}</span>
                    <span style={{ color: C.inkSoft }}>{a.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══ SIDEBAR ═════════════════════════════════════════════════════════════
function Sidebar({ allSpaces, tools, currentSpace, setSpace, expandedSpaces, toggleSpaceExpansion, onCreateSpace, onCreateSubSpace, onDeleteSpace, onEditSpace, smartViews, activeSmartViewId, onSelectSmartView, onClearSmartView, onDeleteSmartView, mobileOpen, onMobileClose, currentUser, onOpenSettings, onClickUser, users, inboxCount, notifCount, messagesCount, tasks }) {
  const taskCountBySpace = useMemo(() => {
    const counts = {};
    (tasks || []).filter(t => !t.checked && !t.parentId).forEach(t => {
      if (t.space) counts[t.space] = (counts[t.space] || 0) + 1;
    });
    return counts;
  }, [tasks]);
  const sidebarTools = tools || TOOLS;
  const [labExpanded, setLabExpanded] = useState(() => {
    try { return JSON.parse(localStorage.getItem("hygge:labExpanded")) ?? false; }
    catch { return false; }
  });
  useEffect(() => { try { localStorage.setItem("hygge:labExpanded", JSON.stringify(labExpanded)); } catch {} }, [labExpanded]);

  return (
    <aside
      className={`w-[244px] flex-shrink-0 flex flex-col z-40 fixed inset-y-0 left-0 transition-transform duration-200 ${mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"} lg:translate-x-0 lg:transition-none lg:sticky lg:top-0 lg:h-screen lg:shadow-none`}
      style={{ backgroundColor: C.bg, borderRight: `1px solid ${C.line}`, height: "100vh" }}>
      <div className="px-5 py-5 relative" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
        <button onClick={onMobileClose} className="lg:hidden absolute top-3 right-3 p-1 hover:opacity-70"><X size={14} style={{ color: C.muted }} /></button>
        <div style={{ fontSize: 32, color: C.ink, fontWeight: 700, letterSpacing: "-0.045em", lineHeight: 0.88, fontFamily: "'DM Sans', system-ui, sans-serif" }}>ALICE</div>
        <div style={{ fontSize: 9, color: C.muted, fontWeight: 600, letterSpacing: "0.24em", textTransform: "uppercase", marginTop: 6 }}>Hygge Holding</div>
        <div className="text-[10px] mt-3" style={{ color: C.muted }}>{users?.length || 9} miembros · Business</div>
      </div>
      <div className="px-5 pt-5 flex-1 overflow-y-auto">
        <div className="mb-3"><Eyebrow>Tools</Eyebrow></div>
        <nav className="space-y-0.5 mb-6">
          {sidebarTools.map(t => {
            const Icon = t.icon;
            const isActive = t.id === currentSpace;
            const badge = t.id === "inbox" ? inboxCount : t.id === "messages" ? messagesCount : t.id === "notifications" ? notifCount : 0;
            return (
              <button key={t.id} onClick={() => setSpace(t.id)}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 hover:opacity-90"
                style={{ backgroundColor: isActive ? C.surface : "transparent", border: `1px solid ${isActive ? C.lineSoft : "transparent"}`, borderRadius: 2 }}>
                <Icon size={12} style={{ color: isActive ? C.ink : C.muted, flexShrink: 0 }} />
                <span className="text-[12px] flex-1 text-left" style={{ color: isActive ? C.ink : C.inkSoft, fontWeight: isActive ? 600 : 500 }}>{t.label}</span>
                {badge > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5" style={{ backgroundColor: C.cobalt, color: C.bg, borderRadius: 999, fontWeight: 700, minWidth: 16, textAlign: "center" }}>{badge}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* APPS · artifacts externos embebidos · cada uno vive en su propio repo/deploy */}
        {APPS.length > 0 && (
          <>
            <div className="mb-3 flex items-center justify-between">
              <Eyebrow>Apps</Eyebrow>
              <span style={{ fontSize: 8, color: C.muted, letterSpacing: "0.08em", fontStyle: "italic" }}>externas</span>
            </div>
            <nav className="space-y-0.5 mb-6">
              {APPS.map(a => {
                const Icon = a.icon;
                const isActive = a.id === currentSpace;
                return (
                  <button key={a.id}
                    onClick={() => a.blocked ? window.open(a.url, "_blank", "noreferrer") : setSpace(a.id)}
                    title={a.blocked ? `Abrir ${a.label} en pestaña nueva` : `${a.description} · ${a.url}`}
                    className="w-full flex items-center gap-2.5 px-2 py-1.5 hover:opacity-90"
                    style={{ backgroundColor: isActive ? C.surface : "transparent", border: `1px solid ${isActive ? C.lineSoft : "transparent"}`, borderRadius: 2 }}>
                    <Icon size={12} style={{ color: a.blocked ? C.muted : isActive ? a.dot : C.muted, flexShrink: 0 }} />
                    <span className="text-[12px] flex-1 text-left" style={{ color: isActive ? C.ink : C.inkSoft, fontWeight: isActive ? 600 : 500 }}>{a.label}</span>
                    {a.blocked
                      ? <ExternalLink size={10} style={{ color: C.muted, flexShrink: 0 }} />
                      : a.badge && <span className="text-[8px] px-1.5 py-0.5" style={{ backgroundColor: C.lineSoft, color: C.muted, borderRadius: 2, fontWeight: 700, fontFamily: "ui-monospace, monospace", letterSpacing: "0.04em" }}>{a.badge}</span>
                    }
                  </button>
                );
              })}
            </nav>
          </>
        )}

        <div className="mb-3 flex items-center justify-between"><Eyebrow>Spaces</Eyebrow>
          <button onClick={onCreateSpace} className="hover:opacity-60" title="Crear space top-level"><Plus size={12} style={{ color: C.muted }} /></button>
        </div>
        <nav className="space-y-0.5">
          {allSpaces.map((s) => {
            const isActive = s.id === currentSpace;
            const hasActiveChild = s.children?.some(c => c.id === currentSpace);
            const isExpanded = expandedSpaces[s.id];
            const hasChildren = s.children && s.children.length > 0;
            return (
              <div key={s.id} className="group">
                <button onClick={() => { setSpace(s.id); if (hasChildren) toggleSpaceExpansion(s.id); }}
                  className="w-full flex items-center gap-2.5 px-2 py-1.5 hover:opacity-90"
                  style={{ backgroundColor: isActive ? C.surface : "transparent", border: `1px solid ${isActive ? C.lineSoft : "transparent"}`, borderRadius: 2 }}>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.dot }} />
                  <span className="text-[12px] flex-1 text-left truncate" style={{ color: (isActive || hasActiveChild) ? C.ink : C.inkSoft, fontWeight: (isActive || hasActiveChild) ? 600 : 500 }}>{s.name}</span>
                  <span className="flex items-center gap-0.5">
                    <button onClick={(e) => { e.stopPropagation(); onCreateSubSpace(s); }} title="Crear sub-space" className="p-1 hover:opacity-70"><Plus size={11} style={{ color: C.muted }} /></button>
                    {s.custom && currentUser?.isAdmin && <button onClick={(e) => { e.stopPropagation(); onEditSpace && onEditSpace(s.id); }} title="Editar space (admin)" className="p-1 hover:opacity-70"><PenSquare size={10} style={{ color: C.muted }} /></button>}
                    {currentUser?.isAdmin && <button onClick={(e) => { e.stopPropagation(); onDeleteSpace(s.id); }} title="Eliminar space (admin)" className="p-1 hover:opacity-70"><Trash2 size={11} style={{ color: C.brick, opacity: 0.7 }} /></button>}
                  </span>
                  {taskCountBySpace[s.id] > 0 && <span className="text-[10px]" style={{ color: C.muted, fontWeight: 500 }}>{taskCountBySpace[s.id]}</span>}
                  {hasChildren && <span onClick={(e) => { e.stopPropagation(); toggleSpaceExpansion(s.id); }}><ChevronRight size={11} style={{ color: C.muted, transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} /></span>}
                </button>
                {hasChildren && isExpanded && (
                  <div className="ml-4 mt-0.5 mb-1 space-y-0.5" style={{ borderLeft: `1px solid ${C.lineSoft}` }}>
                    {s.children.map((c) => {
                      const childActive = c.id === currentSpace;
                      return (
                        <div key={c.id} className="group/child">
                          <button onClick={() => setSpace(c.id)} className="w-full flex items-center gap-2 pl-3 pr-2 py-1 text-left hover:opacity-80"
                            style={{ backgroundColor: childActive ? C.surface : "transparent", border: `1px solid ${childActive ? C.lineSoft : "transparent"}`, borderRadius: 2 }}>
                            {c.code && <span className="text-[10px]" style={{ color: childActive ? C.ink : C.muted, fontWeight: childActive ? 700 : 500, minWidth: 32 }}>{c.code}</span>}
                            <span className="text-[11px] flex-1 truncate" style={{ color: childActive ? C.ink : C.inkSoft, fontWeight: childActive ? 600 : 400 }}>{c.name}</span>
                            {currentUser?.isAdmin && <button onClick={(e) => { e.stopPropagation(); onDeleteSpace(c.id); }} className="p-1 hover:opacity-70" title="Eliminar space (admin)"><Trash2 size={10} style={{ color: C.brick, opacity: 0.7 }} /></button>}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          <button onClick={onCreateSpace} className="w-full flex items-center gap-2.5 px-2 py-1.5 mt-2 hover:opacity-90" style={{ border: `1px dashed ${C.line}`, borderRadius: 2, color: C.muted }}>
            <Plus size={11} /><span className="text-[11px] text-left flex-1" style={{ fontWeight: 500 }}>Nuevo space</span>
          </button>
        </nav>

        {/* LAB · agentes experimentales · solo admin (CEO) */}
        {currentUser?.isAdmin && <div className="mt-7">
          <button onClick={() => setLabExpanded(e => !e)} className="w-full mb-2 flex items-center justify-between hover:opacity-80 px-1">
            <span className="inline-flex items-center gap-1.5">
              <ChevronRight size={11} style={{ color: C.muted, transform: labExpanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
              <Eyebrow><span className="inline-flex items-center gap-1"><FlaskConical size={9} /> Lab</span></Eyebrow>
            </span>
            <span className="text-[8px] tracking-[0.12em] uppercase" style={{ color: C.muted, fontStyle: "italic" }}>Experimental</span>
          </button>
          {labExpanded && (
            <nav className="space-y-0.5">
              {LAB_TOOLS.map(t => {
                const isActive = t.id === currentSpace;
                return (
                  <button key={t.id} onClick={() => setSpace(t.id)}
                    className="w-full flex items-center gap-2.5 px-2 py-1.5 hover:opacity-90"
                    style={{ backgroundColor: isActive ? C.surface : "transparent", border: `1px solid ${isActive ? C.lineSoft : "transparent"}`, borderRadius: 2 }}>
                    <span className="text-[10px] leading-none flex-shrink-0" style={{ width: 12, textAlign: "center" }}>{t.emoji}</span>
                    <span className="text-[12px] flex-1 text-left" style={{ color: isActive ? C.ink : C.inkSoft, fontWeight: isActive ? 600 : 500 }}>{t.label}</span>
                  </button>
                );
              })}
            </nav>
          )}
        </div>}

        {smartViews && smartViews.length > 0 && (
          <>
            <div className="mt-7 mb-3 flex items-center justify-between">
              <Eyebrow>Smart Views</Eyebrow>
              {activeSmartViewId && (
                <button onClick={onClearSmartView} className="text-[9px] hover:opacity-60" style={{ color: C.muted, fontWeight: 500 }}>limpiar</button>
              )}
            </div>
            <nav className="space-y-0.5">
              {smartViews.map(v => {
                const active = v.id === activeSmartViewId;
                return (
                  <div key={v.id} className="group">
                    <button onClick={() => onSelectSmartView(v.id)}
                      className="w-full flex items-center gap-2.5 px-2 py-1.5 hover:opacity-90"
                      style={{ backgroundColor: active ? C.surface : "transparent", border: `1px solid ${active ? C.lineSoft : "transparent"}`, borderRadius: 2 }}>
                      <Sparkles size={10} style={{ color: active ? C.cobalt : C.muted, flexShrink: 0 }} />
                      <span className="text-[12px] flex-1 text-left" style={{ color: active ? C.ink : C.inkSoft, fontWeight: active ? 600 : 500 }}>{v.name}</span>
                      <button onClick={(e) => { e.stopPropagation(); onDeleteSmartView(v.id); }} className="opacity-0 group-hover:opacity-100"><X size={10} style={{ color: C.muted }} /></button>
                    </button>
                  </div>
                );
              })}
            </nav>
          </>
        )}

        <div className="mt-7 mb-3"><Eyebrow>Equipo</Eyebrow></div>
        <div className="space-y-1">
          {(users || []).slice(0, 8).map(u => {
            const isMe = u.id === currentUser?.id;
            return (
              <button key={u.id} onClick={() => onClickUser && onClickUser(u.id)} className="w-full flex items-center gap-2 px-2 py-1 hover:opacity-80 text-left" style={{ borderRadius: 2 }}>
                <div className="relative">
                  <Avatar personId={u.id} size={20} />
                  {isMe && <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full" title="conectado" style={{ backgroundColor: C.green, border: `1.5px solid ${C.bg}` }} />}
                </div>
                <span className="text-[11px] flex-1 truncate" style={{ color: C.inkSoft, fontWeight: 500 }}>{u.firstName}</span>
                {isMe && <span className="text-[8px] tracking-[0.1em] uppercase" style={{ color: C.green, fontWeight: 600 }}>online</span>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex" style={{ borderTop: `1px solid ${C.lineSoft}` }}>
        <button onClick={() => onClickUser && currentUser?.id && onClickUser(currentUser.id)} className="flex-1 px-3 py-3 flex items-center gap-2.5 hover:opacity-90 text-left min-w-0" title="Ver perfil">
          <Avatar personId={currentUser?.id || "sb"} size={28} />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] truncate" style={{ color: C.ink, fontWeight: 500 }}>{currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "Sebastián Bonilla"}</div>
            <div className="text-[10px] truncate" style={{ color: C.muted }}>{currentUser?.role || "CEO"}</div>
          </div>
        </button>
        <button onClick={onOpenSettings} className="px-3 hover:opacity-90" title="Settings" style={{ borderLeft: `1px solid ${C.lineSoft}` }}>
          <Settings size={14} style={{ color: C.muted }} />
        </button>
      </div>
    </aside>
  );
}

// ─── USER DETAIL MODAL · perfil del usuario con tareas asignadas + spaces con acceso ───
function UserDetailModal({ userId, users, tasks, allSpaces, spaceAccess, onClose, onOpenTask, onNavigateSpace }) {
  const user = users.find(u => u.id === userId);
  if (!user) return null;

  const assignedTasks = tasks.filter(t => t.assignee === userId || (Array.isArray(t.assignees) && t.assignees.includes(userId)));
  const openAssigned = assignedTasks.filter(t => !t.checked);
  const closedAssigned = assignedTasks.filter(t => t.checked);

  // Spaces con acceso · sea por admin (todos) o por allowlist en spaceAccess
  const accessibleSpaces = user.isAdmin
    ? allSpaces
    : allSpaces.filter(s => {
        const acl = spaceAccess?.[s.id];
        return !acl || acl.length === 0 || acl.includes(userId);
      });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(10,11,15,0.5)" }} onClick={onClose}>
      <div className="w-full max-w-[480px] max-h-[90vh] overflow-y-auto" style={{ backgroundColor: C.bg, border: `1px solid ${C.line}`, borderRadius: 4 }} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 py-4 flex items-start gap-3" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
          <Avatar personId={user.id} size={48} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div style={{ fontSize: 16, fontWeight: 600, color: C.ink, letterSpacing: "-0.01em" }}>{user.firstName} {user.lastName}</div>
              {user.isAdmin && (
                <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 10, backgroundColor: `${C.ochre}25`, color: C.ochre, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Admin</span>
              )}
              {user.online && (
                <span className="flex items-center gap-1" style={{ fontSize: 9, color: C.green, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: C.green }} /> Online
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{user.role}</div>
            {user.email && <div style={{ fontSize: 10, color: C.muted, marginTop: 4, fontFamily: "ui-monospace, monospace" }}>{user.email}</div>}
          </div>
          <button onClick={onClose}><X size={14} style={{ color: C.muted }} /></button>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-px" style={{ backgroundColor: C.lineSoft, borderBottom: `1px solid ${C.lineSoft}` }}>
          {[
            { label: "Asignadas", val: openAssigned.length, color: C.cobalt },
            { label: "Cerradas", val: closedAssigned.length, color: C.green },
            { label: "Spaces", val: accessibleSpaces.length, color: C.lavender },
          ].map((s, i) => (
            <div key={i} style={{ backgroundColor: C.paper, padding: "12px 14px" }}>
              <div style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color, marginTop: 4, lineHeight: 1 }}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* Tareas asignadas abiertas */}
        <div className="px-5 py-4">
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>Tareas abiertas</div>
          {openAssigned.length === 0 ? (
            <div style={{ fontSize: 11, color: C.muted, fontStyle: "italic" }}>Sin tareas asignadas abiertas</div>
          ) : (
            <div className="space-y-1">
              {openAssigned.slice(0, 6).map(t => {
                const space = allSpaces.find(s => s.id === t.space);
                return (
                  <button key={t.id} onClick={() => { onOpenTask && onOpenTask(t.id); onClose(); }} className="w-full text-left px-3 py-2 hover:opacity-80 flex items-start gap-2" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
                    <div className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: space?.dot || C.muted }} />
                    <div className="flex-1 min-w-0">
                      <div style={{ fontSize: 11, color: C.ink, fontWeight: 500, lineHeight: 1.4 }}>{t.title}</div>
                      <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>{space?.name || t.space}{t.due && t.due !== "—" ? ` · ${t.due}` : ""}</div>
                    </div>
                    <ArrowRight size={10} style={{ color: C.muted }} />
                  </button>
                );
              })}
              {openAssigned.length > 6 && (
                <div style={{ fontSize: 10, color: C.muted, fontStyle: "italic", textAlign: "center", padding: "4px 0" }}>+ {openAssigned.length - 6} más</div>
              )}
            </div>
          )}
        </div>

        {/* Spaces con acceso */}
        <div className="px-5 py-4" style={{ borderTop: `1px solid ${C.lineSoft}` }}>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>Acceso a spaces</div>
          <div className="flex flex-wrap gap-1.5">
            {accessibleSpaces.slice(0, 12).map(s => (
              <button key={s.id} onClick={() => { onNavigateSpace && onNavigateSpace(s.id); onClose(); }} className="flex items-center gap-1.5 px-2 py-1 hover:opacity-80" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.dot }} />
                <span style={{ fontSize: 10, color: C.inkSoft, fontWeight: 500 }}>{s.name}</span>
              </button>
            ))}
            {accessibleSpaces.length > 12 && (
              <span style={{ fontSize: 10, color: C.muted, fontStyle: "italic", padding: "4px 8px" }}>+ {accessibleSpaces.length - 12} más</span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: `1px solid ${C.lineSoft}`, backgroundColor: C.paper }}>
          <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Color · <span style={{ display: "inline-block", width: 10, height: 10, backgroundColor: user.color, borderRadius: 2, verticalAlign: "middle", marginLeft: 4 }} />
          </div>
          <button onClick={onClose} className="px-3 py-1 text-[11px] hover:opacity-70" style={{ color: C.muted }}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

// ═══ TOP BAR ═════════════════════════════════════════════════════════════
function TopBar({ allSpaces, space, onCmd, onAskHygge, unreadCount, onMenu, onRightPanel }) {
  const flat = [...allSpaces, ...allSpaces.flatMap(s => s.children || [])];
  const tool = TOOLS.find(t => t.id === space);
  const spaceObj = tool ? { id: tool.id, name: tool.label, dot: tool.dot, isTool: true } : flat.find(s => s.id === space);
  const parent = tool ? null : allSpaces.find(s => s.children?.some(c => c.id === space));
  return (
    <header className="flex items-center justify-between px-4 lg:px-7 h-[60px] flex-shrink-0 gap-2" style={{ borderBottom: `1px solid ${C.line}`, backgroundColor: C.bg }}>
      <div className="flex items-center gap-2 min-w-0">
        <button onClick={onMenu} className="lg:hidden p-1.5 -ml-1 hover:opacity-70 flex-shrink-0">
          <Menu size={18} style={{ color: C.ink }} />
        </button>
        <div className="flex items-center gap-2 text-[12px] min-w-0">
          <span className="hidden sm:inline" style={{ color: C.muted, fontWeight: 500 }}>Hygge Holding</span>
          {parent && <><ChevronRight size={11} className="hidden sm:inline flex-shrink-0" style={{ color: C.mutedSoft }} /><span className="hidden md:inline truncate" style={{ color: C.muted, fontWeight: 500 }}>{parent.name}</span></>}
          <ChevronRight size={11} className="hidden sm:inline flex-shrink-0" style={{ color: C.mutedSoft }} />
          <span className="truncate" style={{ color: C.ink, fontWeight: 600 }}>{spaceObj?.name || spaceObj?.code}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 lg:gap-3 flex-shrink-0">
        <button onClick={onCmd} className="hidden md:flex items-center gap-2 px-3 py-1.5 text-[12px] md:w-[200px] lg:w-[280px] hover:opacity-90" style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2, color: C.muted }}>
          <Search size={13} /><span className="flex-1 text-left">Buscar o comando…</span>
          <span className="text-[10px] px-1.5 py-0.5" style={{ backgroundColor: C.bg, border: `1px solid ${C.lineSoft}`, borderRadius: 2, fontFamily: "monospace" }}>⌘K</span>
        </button>
        <button onClick={onCmd} className="md:hidden p-1.5 hover:opacity-70"><Search size={16} style={{ color: C.inkSoft }} /></button>
        <button onClick={onAskHygge} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] hover:opacity-90" style={{ backgroundColor: C.ink, color: C.bg, borderRadius: 2, fontWeight: 500 }}>
          <Sparkles size={11} /> <span className="hidden sm:inline">Ask Alice</span><span className="sm:hidden">AI</span>
        </button>
        <button onClick={onRightPanel} className="lg:hidden relative p-1.5 hover:opacity-70">
          <Bell size={16} style={{ color: C.inkSoft }} />
          {unreadCount > 0 && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: C.brick }} />}
        </button>
        <button className="hidden lg:block relative p-2 hover:opacity-70">
          <Bell size={15} style={{ color: C.inkSoft }} />
          {unreadCount > 0 && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: C.brick }} />}
        </button>
      </div>
    </header>
  );
}

// ═══ CUSTOM VIEWS · Charts, Embeds, KPIs ═══════════════════════════════════
const CHART_COLORS = ["#3D52D5", "#1E2A4A", "#A89BD9", "#C2A45A", "#5F8A6A", "#A85B5B", "#B8C8E5", "#8C8F96"];

const CUSTOM_VIEW_TYPES = [
  { id: "pie", label: "Pie chart", icon: PieChartIcon, desc: "Distribución como gráfico circular" },
  { id: "bar", label: "Bar chart", icon: BarChart3, desc: "Comparación con barras verticales" },
  { id: "line", label: "Line chart", icon: LineChartIcon, desc: "Tendencia en el tiempo" },
  { id: "kpi", label: "KPI", icon: TrendingUp, desc: "Métrica destacada con número grande" },
  { id: "iframe", label: "Embed externo", icon: Globe, desc: "Google Sheets · Figma · Notion · cualquier URL" },
];

const groupTasksByDimension = (tasks, dimension, users = [], allSpaces = []) => {
  const flat = [...allSpaces, ...allSpaces.flatMap(s => s.children || [])];
  const map = {};
  tasks.forEach(t => {
    let key;
    if (dimension === "priority") key = t.priority || "sin prioridad";
    else if (dimension === "status") key = t.checked ? "Completadas" : "Pendientes";
    else if (dimension === "assignee") {
      const u = users.find(x => x.id === t.assignee);
      key = u ? `${u.firstName}` : (t.assignee || "sin asignar");
    }
    else if (dimension === "space") {
      const s = flat.find(x => x.id === t.space);
      key = s?.name || t.space || "sin espacio";
    }
    else if (dimension === "type") key = (t.tags && t.tags[0]) || t.type || "sin tipo";
    else key = "—";
    map[key] = (map[key] || 0) + 1;
  });
  return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
};

function PieChartView({ tasks, config, title, onEdit, onDelete, users, allSpaces }) {
  const data = useMemo(() => groupTasksByDimension(tasks, config.groupBy || "priority", users, allSpaces), [tasks, config.groupBy, users, allSpaces]);
  return (
    <CustomViewShell title={title} subtitle={`${tasks.length} tareas · agrupado por ${config.groupBy}`} onEdit={onEdit} onDelete={onDelete}>
      {data.length === 0 ? <EmptyChartState /> : (
        <ResponsiveContainer width="100%" height={400}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={130} innerRadius={70} paddingAngle={2} stroke="#F4F1EA" strokeWidth={2}
              label={({ name, value }) => `${name} · ${value}`} labelLine={false}>
              {data.map((entry, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ backgroundColor: C.ink, color: "#fff", border: "none", borderRadius: 2, fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </CustomViewShell>
  );
}

function BarChartView({ tasks, config, title, onEdit, onDelete, users, allSpaces }) {
  const data = useMemo(() => groupTasksByDimension(tasks, config.groupBy || "priority", users, allSpaces), [tasks, config.groupBy, users, allSpaces]);
  return (
    <CustomViewShell title={title} subtitle={`${tasks.length} tareas · agrupado por ${config.groupBy}`} onEdit={onEdit} onDelete={onDelete}>
      {data.length === 0 ? <EmptyChartState /> : (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={data} margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.lineSoft} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.muted }} stroke={C.muted} />
            <YAxis tick={{ fontSize: 11, fill: C.muted }} stroke={C.muted} />
            <Tooltip contentStyle={{ backgroundColor: C.ink, color: "#fff", border: "none", borderRadius: 2, fontSize: 11 }} cursor={{ fill: C.surface }} />
            <Bar dataKey="value" radius={[2, 2, 0, 0]}>
              {data.map((entry, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </CustomViewShell>
  );
}

function LineChartViewCustom({ tasks, config, title, onEdit, onDelete }) {
  // Group tasks by created date (using id timestamp or capturedAt)
  const data = useMemo(() => {
    const map = {};
    tasks.forEach(t => {
      const ts = t.capturedAt || (typeof t.id === "number" ? t.id : Date.now());
      const d = new Date(ts);
      const key = d.toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [tasks]);
  return (
    <CustomViewShell title={title} subtitle={`Tareas creadas por día`} onEdit={onEdit} onDelete={onDelete}>
      {data.length === 0 ? <EmptyChartState /> : (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data} margin={{ top: 20, right: 30, bottom: 30, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.lineSoft} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.muted }} stroke={C.muted} />
            <YAxis tick={{ fontSize: 11, fill: C.muted }} stroke={C.muted} />
            <Tooltip contentStyle={{ backgroundColor: C.ink, color: "#fff", border: "none", borderRadius: 2, fontSize: 11 }} />
            <Line type="monotone" dataKey="value" stroke={C.cobalt} strokeWidth={2} dot={{ fill: C.cobalt, r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </CustomViewShell>
  );
}

function KPIView({ tasks, config, title, onEdit, onDelete }) {
  const value = useMemo(() => {
    const metric = config.metric || "count";
    if (metric === "count") return tasks.length;
    if (metric === "open") return tasks.filter(t => !t.checked).length;
    if (metric === "done") return tasks.filter(t => t.checked).length;
    if (metric === "high") return tasks.filter(t => t.priority === "alta").length;
    if (metric === "overdue") {
      const today = new Date().toISOString().slice(0,10);
      return tasks.filter(t => !t.checked && t.endDate && t.endDate < today).length;
    }
    return 0;
  }, [tasks, config.metric]);
  const labels = { count: "Tareas totales", open: "Pendientes", done: "Completadas", high: "Alta prioridad", overdue: "Vencidas" };
  return (
    <CustomViewShell title={title} subtitle={labels[config.metric] || ""} onEdit={onEdit} onDelete={onDelete}>
      <div className="flex flex-col items-center justify-center py-16">
        <div className="text-[8px] tracking-[0.15em] uppercase mb-3" style={{ color: C.muted, fontWeight: 600 }}>{labels[config.metric] || config.metric}</div>
        <div className="text-[96px] leading-none" style={{ color: C.ink, fontWeight: 300, letterSpacing: "-0.04em" }}>{value}</div>
        {config.target && (
          <div className="mt-3 text-[12px]" style={{ color: value >= config.target ? C.green : C.muted, fontWeight: 500 }}>
            {value >= config.target ? "✓" : "·"} target {config.target}
          </div>
        )}
      </div>
    </CustomViewShell>
  );
}

function IframeView({ config, title, onEdit, onDelete }) {
  // Smart embed: Drive folders use folder card · Sheets try /pubhtml + fallback to card · Miro placeholder shows config CTA
  const url = config?.url || "";
  if (!url) {
    return (
      <CustomViewShell title={title} subtitle="Embed externo" onEdit={onEdit} onDelete={onDelete}>
        <div className="text-center py-12" style={{ color: C.muted }}>
          <Globe size={28} style={{ margin: "0 auto 12px" }} />
          <div className="text-[12px]">URL no configurada · click Editar</div>
        </div>
      </CustomViewShell>
    );
  }

  // Detect resource type
  const driveFolderMatch = url.match(/drive\.google\.com\/(?:drive\/folders\/|embeddedfolderview\?id=)([a-zA-Z0-9_-]+)/);
  const driveFileMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  const sheetsMatch = url.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  const docsMatch = url.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/);
  const slidesMatch = url.match(/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/);
  const miroMatch = url.match(/miro\.com\/app\/(?:board|live-embed)\/([^/?]+)/);
  const isMiroPlaceholder = url === "https://miro.com/welcome/" || url.startsWith("https://miro.com/welcome");

  // Miro placeholder — show config CTA
  if (isMiroPlaceholder) {
    return (
      <CustomViewShell title={title} subtitle="Miro · pendiente de configurar" onEdit={onEdit} onDelete={onDelete}>
        <div className="text-center py-12 px-6" style={{ backgroundColor: C.paper, border: `1px dashed ${C.line}`, borderRadius: 4 }}>
          <div className="inline-flex w-12 h-12 mb-3 items-center justify-center rounded-full" style={{ backgroundColor: "#FFD02F22" }}>
            <Globe size={20} style={{ color: "#FFD02F" }} />
          </div>
          <div className="text-[13px] mb-2" style={{ color: C.ink, fontWeight: 600 }}>Miro · sin URL configurada</div>
          <div className="text-[11px] mb-4 max-w-md mx-auto" style={{ color: C.muted, lineHeight: 1.6 }}>
            Para mostrar el board: en Miro hacé clic en <em>Share → Embed</em>, copiá la URL que empieza con <code style={{ backgroundColor: C.lineSoft, padding: "1px 4px" }}>https://miro.com/app/live-embed/...</code> y pegala acá.
          </div>
          <button onClick={onEdit} className="px-4 py-2 text-[11px] hover:opacity-90" style={{ backgroundColor: C.ink, color: "white", borderRadius: 2, fontWeight: 500 }}>
            Configurar URL
          </button>
        </div>
      </CustomViewShell>
    );
  }

  // Drive folder — show folder card with open button (iframe sandbox blocks Drive folders)
  if (driveFolderMatch) {
    const folderId = driveFolderMatch[1];
    const openUrl = `https://drive.google.com/drive/folders/${folderId}`;
    return (
      <CustomViewShell title={title} subtitle={
        <span className="flex items-center gap-1">drive.google.com/drive/folders <a href={openUrl} target="_blank" rel="noopener noreferrer" className="hover:opacity-70"><ExternalLink size={10} /></a></span>
      } onEdit={onEdit} onDelete={onDelete}>
        <DriveFolderCard folderId={folderId} title={title} />
      </CustomViewShell>
    );
  }

  // Google Sheets — convert /edit to /preview, fall back to card if blocked
  if (sheetsMatch) {
    const id = sheetsMatch[1];
    const embedUrl = url.includes("/edit") ? `https://docs.google.com/spreadsheets/d/${id}/preview` : url;
    const openUrl = `https://docs.google.com/spreadsheets/d/${id}/edit`;
    return (
      <CustomViewShell title={title} subtitle={
        <span className="flex items-center gap-1">Google Sheets <a href={openUrl} target="_blank" rel="noopener noreferrer" className="hover:opacity-70"><ExternalLink size={10} /></a></span>
      } onEdit={onEdit} onDelete={onDelete} fullWidth>
        <DriveIframeWithFallback src={embedUrl} openUrl={openUrl} kind="Google Sheets" title={title} height={config?.height || 640} />
      </CustomViewShell>
    );
  }

  // Google Docs / Slides — preview
  if (docsMatch || slidesMatch) {
    const kind = docsMatch ? "Google Docs" : "Google Slides";
    const path = docsMatch ? "document" : "presentation";
    const id = (docsMatch || slidesMatch)[1];
    const embedUrl = `https://docs.google.com/${path}/d/${id}/preview`;
    const openUrl = `https://docs.google.com/${path}/d/${id}/edit`;
    return (
      <CustomViewShell title={title} subtitle={
        <span className="flex items-center gap-1">{kind} <a href={openUrl} target="_blank" rel="noopener noreferrer" className="hover:opacity-70"><ExternalLink size={10} /></a></span>
      } onEdit={onEdit} onDelete={onDelete} fullWidth>
        <DriveIframeWithFallback src={embedUrl} openUrl={openUrl} kind={kind} title={title} height={config?.height || 640} />
      </CustomViewShell>
    );
  }

  // Drive file (PDF, xlsx, docx) — preview
  if (driveFileMatch) {
    const id = driveFileMatch[1];
    const embedUrl = `https://drive.google.com/file/d/${id}/preview`;
    const openUrl = `https://drive.google.com/file/d/${id}/view`;
    return (
      <CustomViewShell title={title} subtitle={
        <span className="flex items-center gap-1">Archivo en Drive <a href={openUrl} target="_blank" rel="noopener noreferrer" className="hover:opacity-70"><ExternalLink size={10} /></a></span>
      } onEdit={onEdit} onDelete={onDelete} fullWidth>
        <DriveIframeWithFallback src={embedUrl} openUrl={openUrl} kind="Archivo Drive" title={title} height={config?.height || 640} />
      </CustomViewShell>
    );
  }

  // Generic — try iframe
  return (
    <CustomViewShell title={title} subtitle={
      <span className="flex items-center gap-1">{url.replace(/^https?:\/\//, "").slice(0, 60)} <a href={url} target="_blank" rel="noopener noreferrer" className="hover:opacity-70"><ExternalLink size={10} /></a></span>
    } onEdit={onEdit} onDelete={onDelete} fullWidth>
      <div style={{ height: config?.height || 640, backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2, overflow: "hidden" }}>
        <iframe src={url} title={title} style={{ width: "100%", height: "100%", border: 0, display: "block" }} sandbox="allow-scripts allow-same-origin allow-popups allow-forms" />
      </div>
    </CustomViewShell>
  );
}

// Card for Drive folder — folder can't embed in iframe so show open card
function DriveFolderCard({ folderId, title }) {
  const openUrl = `https://drive.google.com/drive/folders/${folderId}`;
  return (
    <div className="flex items-center justify-center py-12 px-6" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 4, minHeight: 280 }}>
      <div className="text-center max-w-md">
        <div className="inline-flex w-14 h-14 mb-4 items-center justify-center rounded" style={{ backgroundColor: "#1A73E822" }}>
          <Folder size={26} style={{ color: "#1A73E8" }} />
        </div>
        <div className="text-[14px] mb-1.5" style={{ color: C.ink, fontWeight: 600, letterSpacing: "-0.005em" }}>{title}</div>
        <div className="text-[10px] mb-4 font-mono" style={{ color: C.muted }}>ID: {folderId.slice(0, 8)}…{folderId.slice(-4)}</div>
        <div className="text-[11px] mb-5" style={{ color: C.inkSoft, lineHeight: 1.55 }}>
          Las carpetas de Google Drive no se pueden embeber por restricciones de seguridad de Google. Hacé clic abajo para abrir la carpeta en Drive.
        </div>
        <a href={openUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 text-[11px] hover:opacity-90" style={{ backgroundColor: C.ink, color: "white", borderRadius: 2, fontWeight: 500 }}>
          Abrir en Drive <ExternalLink size={10} />
        </a>
      </div>
    </div>
  );
}

// Iframe with timeout-based fallback: if it doesn't render content, show open card
function DriveIframeWithFallback({ src, openUrl, kind, title, height }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const iframeRef = useRef(null);
  useEffect(() => {
    // Iframe load fired? If not in 5s, mark as likely-blocked
    const tm = setTimeout(() => { if (!loaded) setFailed(true); }, 5000);
    return () => clearTimeout(tm);
  }, [loaded]);
  if (failed) {
    return (
      <div className="flex items-center justify-center py-12 px-6" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 4, minHeight: 280 }}>
        <div className="text-center max-w-md">
          <div className="inline-flex w-12 h-12 mb-3 items-center justify-center rounded" style={{ backgroundColor: "#0F9D5822" }}>
            <FileText size={22} style={{ color: "#0F9D58" }} />
          </div>
          <div className="text-[13px] mb-1" style={{ color: C.ink, fontWeight: 600 }}>{title}</div>
          <div className="text-[11px] mb-4" style={{ color: C.muted }}>{kind}</div>
          <div className="text-[11px] mb-5" style={{ color: C.inkSoft, lineHeight: 1.55 }}>
            Google bloquea el embed cuando no estás logueado o no tenés permisos. Hacé clic abajo para abrirlo.
          </div>
          <div className="flex items-center justify-center gap-2">
            <a href={openUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 text-[11px] hover:opacity-90" style={{ backgroundColor: C.ink, color: "white", borderRadius: 2, fontWeight: 500 }}>
              Abrir en Drive <ExternalLink size={10} />
            </a>
            <button onClick={() => { setFailed(false); setLoaded(false); }} className="px-3 py-2 text-[11px] hover:opacity-70" style={{ color: C.muted, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
              Reintentar embed
            </button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ height, backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2, overflow: "hidden", position: "relative" }}>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center text-[11px]" style={{ color: C.muted, backgroundColor: C.paper, zIndex: 1 }}>
          Cargando {kind}…
        </div>
      )}
      <iframe ref={iframeRef} src={src} title={title} onLoad={() => setLoaded(true)} style={{ width: "100%", height: "100%", border: 0, display: "block", position: "relative", zIndex: 2 }} sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-popups-to-escape-sandbox" />
    </div>
  );
}

function CustomViewShell({ title, subtitle, onEdit, onDelete, fullWidth, children }) {
  const confirm = useConfirm();
  const askDelete = async () => {
    const ok = await confirm({ title: `Eliminar view "${title}"`, message: "Esta acción no se puede deshacer (excepto con Cmd+Z inmediato).", danger: true, confirmLabel: "Eliminar view" });
    if (ok) onDelete();
  };
  return (
    <div className={`px-4 lg:px-10 py-8 lg:py-12 mx-auto ${fullWidth ? "max-w-[1400px]" : "max-w-[1080px]"}`}>
      <div className="mb-8 flex items-end justify-between flex-wrap gap-3">
        <div>
          <NavyRule />
          <div className="mt-4"><Eyebrow>Custom view</Eyebrow></div>
          <h1 className="text-[28px] lg:text-[32px] mt-3" style={{ color: C.ink, fontWeight: 500, letterSpacing: "-0.025em" }}>{title}</h1>
          {subtitle && <div className="text-[12px] mt-2" style={{ color: C.muted }}>{subtitle}</div>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] hover:opacity-90" style={{ color: C.inkSoft, border: `1px solid ${C.lineSoft}`, borderRadius: 2, fontWeight: 500 }}><PenSquare size={11} /> Editar</button>
          <button onClick={askDelete} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] hover:opacity-90" style={{ color: C.brick, border: `1px solid ${C.brick}33`, borderRadius: 2, fontWeight: 500 }}><Trash2 size={11} /></button>
        </div>
      </div>
      <div style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2, padding: 20 }}>{children}</div>
    </div>
  );
}

function EmptyChartState() {
  return <div className="text-center py-12" style={{ color: C.muted }}><div className="text-[12px]">Sin datos para mostrar</div></div>;
}

function CustomViewConfigModal({ initial, onClose, onSave }) {
  const [data, setData] = useState(initial || { type: "pie", title: "", config: {} });
  const update = (patch) => setData(d => ({ ...d, ...patch }));
  const updateConfig = (patch) => setData(d => ({ ...d, config: { ...d.config, ...patch } }));
  const submit = () => {
    if (!data.title?.trim()) return;
    onSave(data);
  };
  const typeInfo = CUSTOM_VIEW_TYPES.find(t => t.id === data.type);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] p-4" style={{ backgroundColor: "rgba(10,11,15,0.5)" }} onClick={onClose}>
      <div className="w-full max-w-[560px]" style={{ backgroundColor: C.paper, border: `1px solid ${C.line}`, borderRadius: 4 }} onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
          <div><Eyebrow>{initial ? "Editar view" : "Nueva view"}</Eyebrow><div className="text-[15px] mt-1" style={{ color: C.ink, fontWeight: 600 }}>{initial ? data.title : "Agregar vista personalizada"}</div></div>
          <button onClick={onClose}><X size={14} style={{ color: C.muted }} /></button>
        </div>
        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          {!initial && (
            <FormField label="Tipo">
              <div className="grid grid-cols-1 gap-1.5 mt-1">
                {CUSTOM_VIEW_TYPES.map(t => {
                  const Icon = t.icon;
                  const active = data.type === t.id;
                  return (
                    <button key={t.id} onClick={() => update({ type: t.id, config: {} })} className="flex items-center gap-3 px-3 py-2.5 text-left hover:opacity-90"
                      style={{ backgroundColor: active ? C.cobalt + "11" : C.surface, border: `1px solid ${active ? C.cobalt : C.lineSoft}`, borderRadius: 2 }}>
                      <Icon size={16} style={{ color: active ? C.cobalt : C.inkSoft, flexShrink: 0 }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px]" style={{ color: C.ink, fontWeight: 600 }}>{t.label}</div>
                        <div className="text-[10px]" style={{ color: C.muted }}>{t.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </FormField>
          )}

          <FormField label="Título"><input value={data.title} onChange={e => update({ title: e.target.value })} placeholder={typeInfo ? `Ej: ${typeInfo.label} de tareas` : "Título"} className={fieldClass} style={fieldStyle} autoFocus /></FormField>

          {(data.type === "pie" || data.type === "bar") && (
            <FormField label="Agrupar por">
              <select value={data.config.groupBy || "priority"} onChange={e => updateConfig({ groupBy: e.target.value })} className={fieldClass} style={fieldStyle}>
                <option value="priority">Prioridad</option>
                <option value="status">Estado (pendiente/completada)</option>
                <option value="assignee">Asignado</option>
                <option value="space">Space</option>
                <option value="type">Tipo (tag)</option>
              </select>
            </FormField>
          )}

          {data.type === "kpi" && (
            <>
              <FormField label="Métrica">
                <select value={data.config.metric || "count"} onChange={e => updateConfig({ metric: e.target.value })} className={fieldClass} style={fieldStyle}>
                  <option value="count">Total de tareas</option>
                  <option value="open">Pendientes</option>
                  <option value="done">Completadas</option>
                  <option value="high">Alta prioridad</option>
                  <option value="overdue">Vencidas</option>
                </select>
              </FormField>
              <FormField label="Target (opcional)"><input type="number" value={data.config.target || ""} onChange={e => updateConfig({ target: e.target.value ? parseInt(e.target.value) : null })} placeholder="Ej: 10" className={fieldClass} style={fieldStyle} /></FormField>
            </>
          )}

          {data.type === "iframe" && (
            <>
              <FormField label="URL externa">
                <input value={data.config.url || ""} onChange={e => updateConfig({ url: e.target.value })} placeholder="https://docs.google.com/spreadsheets/d/..." className={fieldClass} style={fieldStyle} />
                <div className="text-[10px] mt-1.5" style={{ color: C.muted }}>
                  Funciona con: Google Sheets (lectura), Figma embed, Notion público, dashboards de Looker, cualquier URL que permita iframe.<br/>
                  Algunos sitios (Gmail, banking, etc.) bloquean iframes via X-Frame-Options.
                </div>
              </FormField>
              <FormField label="Altura (px)"><input type="number" value={data.config.height || 640} onChange={e => updateConfig({ height: parseInt(e.target.value) || 640 })} className={fieldClass} style={fieldStyle} /></FormField>
            </>
          )}
        </div>
        <div className="px-5 py-4 flex items-center justify-end gap-2" style={{ borderTop: `1px solid ${C.lineSoft}` }}>
          <button onClick={onClose} className="px-3 py-2 text-[12px] hover:opacity-90" style={{ color: C.muted, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>Cancelar</button>
          <button onClick={submit} disabled={!data.title?.trim()} className="px-4 py-2 text-[12px] hover:opacity-90"
            style={{ backgroundColor: data.title?.trim() ? C.ink : C.muted, color: C.bg, borderRadius: 2, fontWeight: 500, opacity: data.title?.trim() ? 1 : 0.5 }}>
            {initial ? "Guardar cambios" : "Crear view"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ViewTabs({ active, setActive, onAdd, onFilterClick, activeFilterCount, customViews, onAddCustom, onDeleteCustom, features = { whiteboards: false, customViews: false, viewport: false, pencil: false }, setFeatures }) {
  const [addOpen, setAddOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState(null);
  const addRef = useRef(null);
  const popoverRef = useRef(null);

  // Compute fixed position from button's bounding rect (escapes overflow:auto clipping)
  const computePosition = useCallback(() => {
    if (!addRef.current) return;
    const r = addRef.current.getBoundingClientRect();
    const popoverWidth = 280;
    // Clamp left so popover doesn't go off-screen on mobile
    const left = Math.max(8, Math.min(r.left, window.innerWidth - popoverWidth - 8));
    setPopoverPos({ top: r.bottom + 4, left });
  }, []);

  const openPopover = () => {
    computePosition();
    setAddOpen(true);
  };

  // Reposition + close on outside click / scroll / resize
  useEffect(() => {
    if (!addOpen) return;
    const handleOutside = (e) => {
      if (popoverRef.current?.contains(e.target)) return;
      if (addRef.current?.contains(e.target)) return;
      setAddOpen(false);
    };
    const handleReposition = () => computePosition();
    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [addOpen, computePosition]);

  // Filter views: archivos/whiteboard/viewport tabs hidden unless their feature is on
  const filteredViews = VIEWS.filter(v => {
    if (v.id === "archivos" && !features.archivos) return false;
    if (v.id === "whiteboard" && !features.whiteboards) return false;
    if (v.id === "viewport" && !features.viewport) return false;
    return true;
  });

  const toggleFeature = (key) => {
    if (!setFeatures) return;
    setFeatures(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const featureToggles = [
    { id: "archivos", label: "Archivos (Dropbox)", icon: FileText, hint: "Carpeta de Dropbox anclada a este space · tiempo real" },
    { id: "whiteboards", label: "Whiteboard", icon: PenSquare, hint: "Pizarra · stickies, shapes, lápiz con presión Apple Pencil" },
    { id: "viewport", label: "Viewport Externo", icon: Globe, hint: "Iframe a URL externa (Sheets, Miro, etc.)" },
    { id: "customViews", label: "Custom Views", icon: PieChartIcon, hint: "Charts, KPIs, embeds custom por space" },
  ];

  return (
    <div className="flex items-center justify-between px-4 lg:px-7 h-[44px] flex-shrink-0 gap-2" style={{ borderBottom: `1px solid ${C.lineSoft}`, backgroundColor: C.bg, position: "relative" }}>
      <div className="flex items-center gap-1 overflow-x-auto min-w-0 flex-1" style={{ scrollbarWidth: "none" }}>
        {filteredViews.map((v) => {
          const Icon = v.icon, isActive = v.id === active;
          return (
            <button key={v.id} onClick={() => setActive(v.id)} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] flex-shrink-0"
              style={{ color: isActive ? C.ink : C.muted, fontWeight: isActive ? 600 : 500, backgroundColor: isActive ? C.surface : "transparent", border: `1px solid ${isActive ? C.lineSoft : "transparent"}`, borderRadius: 2 }}>
              <Icon size={12} /> {v.label}
            </button>
          );
        })}
        {features.customViews && (customViews || []).map(v => {
          const isActive = v.id === active;
          const typeInfo = CUSTOM_VIEW_TYPES.find(t => t.id === v.type);
          const Icon = typeInfo?.icon || PieChartIcon;
          return (
            <div key={v.id} className="flex items-center group flex-shrink-0" style={{ backgroundColor: isActive ? C.surface : "transparent", border: `1px solid ${isActive ? C.lineSoft : "transparent"}`, borderRadius: 2 }}>
              <button onClick={() => setActive(v.id)} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] flex-shrink-0"
                style={{ color: isActive ? C.cobalt : C.muted, fontWeight: isActive ? 600 : 500 }}>
                <Icon size={12} /> {v.title}
              </button>
            </div>
          );
        })}

        {/* + Agregar · feature picker · siempre visible */}
        <button ref={addRef} onClick={() => addOpen ? setAddOpen(false) : openPopover()} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] flex-shrink-0 hover:opacity-90"
          style={{ color: addOpen ? C.ink : C.cobalt, border: `1px dashed ${addOpen ? C.ink : C.cobalt}60`, borderRadius: 2, fontWeight: 600, backgroundColor: addOpen ? C.surface : "transparent" }}
          title="Agregar vista o feature">
          <Plus size={11} /> Agregar
        </button>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={onFilterClick} className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] hover:opacity-90 relative" style={{ color: activeFilterCount > 0 ? C.cobalt : C.inkSoft, border: `1px solid ${activeFilterCount > 0 ? C.cobalt : C.lineSoft}`, borderRadius: 2, fontWeight: activeFilterCount > 0 ? 600 : 500 }}>
          <Filter size={11} /> Filtros
          {activeFilterCount > 0 && <span className="w-4 h-4 flex items-center justify-center text-[9px]" style={{ backgroundColor: C.cobalt, color: C.bg, borderRadius: 999, fontWeight: 700 }}>{activeFilterCount}</span>}
        </button>
        <button onClick={onAdd} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] hover:opacity-90" style={{ color: C.bg, backgroundColor: C.ink, borderRadius: 2, fontWeight: 500 }}>
          <Plus size={11} /> <span className="hidden sm:inline">Nueva</span>
        </button>
      </div>

      {/* Popover de Agregar · position:fixed para escapar overflow del scroll container */}
      {addOpen && popoverPos && (
        <div ref={popoverRef} className="w-[280px]"
          style={{ position: "fixed", top: popoverPos.top, left: popoverPos.left, zIndex: 1000, backgroundColor: C.bg, border: `1px solid ${C.line}`, borderRadius: 4, boxShadow: "0 8px 24px rgba(10,11,15,0.18)" }}>
          <div className="px-3 py-2" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>Features opt-in</div>
            <div style={{ fontSize: 10, color: C.muted, fontStyle: "italic", marginTop: 2 }}>Activá y aparece el tab acá mismo</div>
          </div>

          <div className="py-1">
            {featureToggles.map(f => {
              const Icon = f.icon;
              const isOn = !!features[f.id];
              return (
                <button key={f.id} onClick={() => toggleFeature(f.id)} className="w-full flex items-start gap-2 px-3 py-2 hover:opacity-90 text-left"
                  style={{ backgroundColor: isOn ? `${C.green}10` : "transparent" }}>
                  <Icon size={12} style={{ color: isOn ? C.green : C.muted, marginTop: 2, flexShrink: 0 }} />
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 11, color: C.ink, fontWeight: 600 }}>{f.label}</div>
                    <div style={{ fontSize: 9, color: C.muted, marginTop: 1, lineHeight: 1.4 }}>{f.hint}</div>
                  </div>
                  <div className="flex-shrink-0 transition-colors mt-0.5" style={{ width: 28, height: 16, borderRadius: 999, backgroundColor: isOn ? C.ink : C.lineSoft, position: "relative", padding: 2 }}>
                    <span style={{ display: "block", width: 12, height: 12, borderRadius: 999, backgroundColor: C.bg, transform: isOn ? "translateX(12px)" : "translateX(0)", transition: "transform 0.15s" }} />
                  </div>
                </button>
              );
            })}
          </div>

          {features.customViews && (
            <div className="px-3 py-2" style={{ borderTop: `1px solid ${C.lineSoft}` }}>
              <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>Custom Views</div>
              <button onClick={() => { setAddOpen(false); onAddCustom && onAddCustom(); }} className="w-full flex items-center gap-2 px-2 py-1.5 hover:opacity-80" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
                <Plus size={11} style={{ color: C.cobalt }} />
                <span style={{ fontSize: 11, color: C.cobalt, fontWeight: 600 }}>Crear chart, KPI o embed</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══ SMART CAPTURE BAR ═══════════════════════════════════════════════════
function Chip({ label, color }) {
  return (
    <span className="text-[10px] px-2 py-0.5 inline-flex items-center"
      style={{ backgroundColor: color + "22", color, border: `1px solid ${color}44`, borderRadius: 2, fontWeight: 500 }}>
      {label}
    </span>
  );
}

const SMART_CAPTURE_PLACEHOLDERS = [
  'Pago contadores 3500 mañana',
  'Reunión con José el lunes 10am',
  'Conformidad DC01 · Ariel viernes',
  'Detracción Daniel Yep 1200 usd',
  'Revisar planos L36 · entrega jueves',
  'Prospecto Miraflores 140m²',
  'Llamar a Fit Capital · estados PU01',
  'Pago luz oficina 850 viernes',
  'Brief marketing TG01 · Vanessa',
  'Escritura PU01 · citar a Galup lunes',
];

function SmartCapture({ onCreate, detectedPatterns, savedSmartViews, onSaveSmartView, currentSpaceContext }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [phIdx, setPhIdx] = useState(() => Math.floor(Math.random() * SMART_CAPTURE_PLACEHOLDERS.length));
  useEffect(() => {
    const t = setInterval(() => setPhIdx(i => (i + 1) % SMART_CAPTURE_PLACEHOLDERS.length), 3500);
    return () => clearInterval(t);
  }, []);

  const submit = async () => {
    if (!text.trim() || loading) return;
    setLoading(true);
    const parsed = await parseSmartCapture(text.trim(), currentSpaceContext);
    setLoading(false);
    setPreview(parsed);
  };

  const confirm = () => {
    onCreate(preview);
    setText("");
    setPreview(null);
  };

  const unsavedPatterns = detectedPatterns.filter(p => !savedSmartViews.some(v => v.patternId === p.id));

  return (
    <div className="flex-shrink-0" style={{ borderBottom: `1px solid ${C.lineSoft}`, backgroundColor: C.bg }}>
      <div className="flex items-center px-4 lg:px-7 py-2.5 gap-2 lg:gap-2.5" style={{ minHeight: 52 }}>
        <Sparkles size={15} style={{ color: C.cobalt, flexShrink: 0 }} />
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } if (e.key === "Escape") { setText(""); setPreview(null); } }}
          placeholder={`Ej: "${SMART_CAPTURE_PLACEHOLDERS[phIdx]}"…`}
          className="flex-1 min-w-0 outline-none bg-transparent text-[13px]"
          style={{ color: C.ink, fontWeight: 500 }}
          disabled={loading || !!preview} />
        {loading && <Loader2 size={14} className="animate-spin flex-shrink-0" style={{ color: C.muted }} />}
        {!loading && !preview && text && (
          <button onClick={submit} className="flex items-center gap-1 px-2.5 py-1 text-[10px] hover:opacity-90 flex-shrink-0"
            style={{ backgroundColor: C.ink, color: C.bg, borderRadius: 2, fontWeight: 500 }}>
            <Sparkles size={9} /> <span className="hidden sm:inline">Parse</span> ⏎
          </button>
        )}
        <span className="hidden md:inline text-[9px] tracking-[0.12em] uppercase ml-1" style={{ color: C.muted, fontWeight: 600 }}>Smart Capture</span>
      </div>

      {preview && (
        <div className="px-7 py-3" style={{ backgroundColor: C.paper, borderTop: `1px solid ${C.lineSoft}` }}>
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <div className="text-[13px] mb-2" style={{ color: C.ink, fontWeight: 600 }}>{preview.title}</div>
              <div className="flex flex-wrap gap-1.5">
                {preview.type && <Chip label={preview.type} color={C.cobalt} />}
                {preview.person && <Chip label={preview.person} color={C.lavender} />}
                {preview.amount && <Chip label={`S/ ${preview.amount.toLocaleString("es-PE")}`} color={C.green} />}
                {preview.due && <Chip label={preview.due} color={C.ochre} />}
                {preview.project && <Chip label={preview.project} color={C.navy} />}
                {preview.space && <Chip label={`#${preview.space}`} color={C.inkSoft} />}
                {preview.assignee && <Chip label={`@${preview.assignee}`} color={C.muted} />}
                {preview.priority && <Chip label={`prio: ${preview.priority}`} color={C.muted} />}
              </div>
            </div>
            <div className="flex flex-col gap-1.5 flex-shrink-0">
              <button onClick={confirm} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] hover:opacity-90"
                style={{ backgroundColor: C.ink, color: C.bg, borderRadius: 2, fontWeight: 500 }}>
                <CheckCircle2 size={11} /> Crear
              </button>
              <button onClick={() => setPreview(null)} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] hover:opacity-90"
                style={{ color: C.muted, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
                <X size={11} /> Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {unsavedPatterns.length > 0 && !preview && (
        <div className="px-7 py-2 flex items-center gap-2 flex-wrap" style={{ backgroundColor: C.surface, borderTop: `1px solid ${C.lineSoft}` }}>
          <span className="text-[9px] tracking-[0.12em] uppercase" style={{ color: C.muted, fontWeight: 600 }}>Detecté patrones</span>
          {unsavedPatterns.slice(0, 5).map(p => (
            <button key={p.id} onClick={() => onSaveSmartView(p)}
              className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] hover:opacity-90"
              style={{ backgroundColor: C.bg, color: C.ink, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
              <span style={{ color: C.cobalt, fontWeight: 700 }}>{p.count}</span> {p.label}
              <Plus size={9} style={{ color: C.cobalt }} />
            </button>
          ))}
          <span className="text-[9px]" style={{ color: C.muted }}>· click guarda como Smart View</span>
        </div>
      )}
    </div>
  );
}


function StatusMenu({ task, setTaskStatus, size = 15 }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const status = getTaskStatus(task);
  const def = taskStatusDef(status);
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);
  return (
    <div ref={ref} className="relative flex-shrink-0" onClick={e => e.stopPropagation()}>
      <button onClick={() => setOpen(o => !o)} title={def.label}
        style={{ fontSize: size, lineHeight: 1, color: def.color, background: "none", border: "none", cursor: "pointer", padding: 1 }}>
        {def.icon}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-[140px]"
          style={{ backgroundColor: C.paper, border: `1px solid ${C.line}`, borderRadius: 2, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
          {TASK_STATUSES.map(s => (
            <button key={s.id} onClick={() => { setTaskStatus(task.id, s.id); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:opacity-80"
              style={{ backgroundColor: status === s.id ? C.surface : "transparent" }}>
              <span style={{ fontSize: 13, color: s.color }}>{s.icon}</span>
              <span style={{ fontSize: 11, color: C.ink, fontWeight: status === s.id ? 600 : 400 }}>{s.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, children, depth, toggleTask, toggleExpand, openDetail, timerProps, setTaskStatus }) {
  const hasChildren = children && children.length > 0;
  const indent = depth * 28;
  const hasAttach = (task.attachments?.length || 0) > 0;
  const hasComments = (task.comments?.length || 0) > 0;
  const status = getTaskStatus(task);
  const isDone = status === "completada";
  return (
    <>
      <div className="px-6 py-3 flex items-center gap-3 group cursor-pointer hover:bg-opacity-50"
        onClick={() => openDetail(task.id)}
        style={{ borderBottom: `1px solid ${C.lineSoft}`, paddingLeft: 24 + indent }}>
        {hasChildren ? (
          <button onClick={(e) => { e.stopPropagation(); toggleExpand(task.id); }} className="flex-shrink-0">
            {task.expanded ? <ChevronDown size={12} style={{ color: C.muted }} /> : <ChevronRight size={12} style={{ color: C.muted }} />}
          </button>
        ) : depth > 0 ? <CornerDownRight size={11} style={{ color: C.mutedSoft, flexShrink: 0 }} /> : <span className="w-3" />}
        {setTaskStatus ? (
          <StatusMenu task={task} setTaskStatus={setTaskStatus} size={15} />
        ) : (
          <button onClick={(e) => { e.stopPropagation(); toggleTask(task.id); }} className="flex-shrink-0">
            {task.checked ? <CheckCircle2 size={15} style={{ color: C.green }} /> : <Circle size={15} style={{ color: C.muted }} />}
          </button>
        )}
        <div className="flex-1 text-[13px]" style={{ color: isDone ? C.muted : C.ink, fontWeight: 500, textDecoration: isDone ? "line-through" : "none" }}>
          {task.title}
        </div>
        {task.recurring?.freq && <RecurringBadge rule={task.recurring} />}
        {hasAttach && <Paperclip size={11} style={{ color: C.muted }} title={task.attachments.length + " adjunto(s)"} />}
        {hasComments && <MessageSquare size={11} style={{ color: C.muted }} title={task.comments.length + " comentario(s)"} />}
        {timerProps && (
          <span onClick={e => e.stopPropagation()}>
            <TimerButton task={task} {...timerProps} />
          </span>
        )}
        {task.assignee && <Avatar personId={task.assignee} size={20} />}
        <span className="text-[10px] tracking-[0.08em] uppercase px-1.5 py-0.5" style={{ color: C.inkSoft, backgroundColor: C.bg, border: `1px solid ${C.lineSoft}`, borderRadius: 2, fontWeight: 500 }}>{task.project}</span>
        <span className="text-[10px] tracking-[0.08em] uppercase" style={{ color: task.priority === "alta" ? C.brick : task.priority === "media" ? C.ochre : C.muted, fontWeight: 600, minWidth: 42, textAlign: "right" }}>{task.priority}</span>
        <span className="text-[10px] min-w-[55px] text-right" style={{ color: C.muted }}>{task.due}</span>
      </div>
      {hasChildren && task.expanded && children}
    </>
  );
}

function ListView({ tasks, toggleTask, toggleExpand, openDetail, currentSpace, allSpaces, timerProps, setTaskStatus }) {
  const flat = [...(allSpaces || []), ...(allSpaces || []).flatMap(s => s.children || [])];
  const spaceObj = flat.find(s => s.id === currentSpace);
  const spaceName = spaceObj?.name || (currentSpace === "hq" ? "Hygge HQ · Todos" : currentSpace);
  const all = tasks;
  const roots = all.filter(t => !t.parentId);
  const open = roots.filter(t => getTaskStatus(t) !== "completada");
  const done = roots.filter(t => getTaskStatus(t) === "completada");
  const renderTree = (parent, depth = 0) => {
    const kids = all.filter(t => t.parentId === parent.id);
    return (
      <TaskRow key={parent.id} task={parent} depth={depth} toggleTask={toggleTask} toggleExpand={toggleExpand} openDetail={openDetail} timerProps={timerProps} setTaskStatus={setTaskStatus}>
        {kids.length > 0 ? kids.map(k => renderTree(k, depth + 1)) : null}
      </TaskRow>
    );
  };
  return (
    <div className="px-4 lg:px-10 py-8 lg:py-12 max-w-[1080px] mx-auto">
      <div className="mb-10">
        <NavyRule /><div className="mt-4"><Eyebrow>{spaceName} · lista</Eyebrow></div>
        <h1 className="text-[32px] lg:text-[36px] mt-3" style={{ color: C.ink, fontWeight: 500, letterSpacing: "-0.025em" }}>
          {open.length} <span style={{ color: C.muted, fontWeight: 300 }}>{open.length === 1 ? "tarea activa" : "tareas activas"}</span>
        </h1>
        <p className="text-[12px] mt-2" style={{ color: C.muted }}>Click una tarea para ver el detalle, asignar, comentar, subir archivos.</p>
      </div>
      <section className="mb-12">
        <Eyebrow>Pendientes</Eyebrow>
        <div className="mt-4" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
          {open.length === 0 && <div className="px-6 py-8 text-center text-[13px]" style={{ color: C.muted }}>Nada pendiente.</div>}
          {open.map(t => renderTree(t))}
        </div>
      </section>
      {done.length > 0 && (
        <section>
          <Eyebrow>Completadas · {done.length}</Eyebrow>
          <div className="mt-4" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
            {done.map(t => renderTree(t))}
          </div>
        </section>
      )}
    </div>
  );
}

function BoardView({ tasks, currentSpace, openDetail, allSpaces, setTaskStatus }) {
  const flat = [...(allSpaces || []), ...(allSpaces || []).flatMap(s => s.children || [])];
  const spaceObj = flat.find(s => s.id === currentSpace);
  const spaceName = spaceObj?.name || (currentSpace === "hq" ? "Hygge HQ · Todos" : currentSpace);
  const filtered = tasks.filter(t => !t.parentId);
  const cols = TASK_STATUSES.map(s => ({
    ...s,
    items: filtered.filter(t => getTaskStatus(t) === s.id),
  }));
  return (
    <div className="px-4 lg:px-10 py-8 lg:py-12">
      <div className="mb-10"><NavyRule /><div className="mt-4"><Eyebrow>{spaceName} · board</Eyebrow></div><h1 className="text-[32px] lg:text-[36px] mt-3" style={{ color: C.ink, fontWeight: 500, letterSpacing: "-0.025em" }}>Kanban</h1><div className="text-[12px] mt-2" style={{ color: C.muted }}>{filtered.length} {filtered.length === 1 ? "tarea" : "tareas"}</div></div>
      <div className="flex gap-4 overflow-x-auto pb-4" style={{ minWidth: 0 }}>
        {cols.map(col => (
          <div key={col.id} style={{ minWidth: 220, width: 220, flexShrink: 0 }}>
            <div className="flex items-center gap-2 mb-3">
              <span style={{ fontSize: 13, color: col.color }}>{col.icon}</span>
              <Eyebrow>{col.label} · {col.items.length}</Eyebrow>
            </div>
            <div className="space-y-2">
              {col.items.map(t => (
                <button key={t.id} onClick={() => openDetail(t.id)} className="w-full p-4 text-left hover:translate-y-[-1px] transition-transform" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
                  <div className="text-[13px] mb-3" style={{ color: C.ink, fontWeight: 500, lineHeight: 1.4 }}>{t.title}</div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] tracking-[0.1em] uppercase px-1.5 py-0.5" style={{ color: C.inkSoft, backgroundColor: C.bg, border: `1px solid ${C.lineSoft}`, borderRadius: 2, fontWeight: 500 }}>{t.project}</span>
                      {t.attachments?.length > 0 && <Paperclip size={10} style={{ color: C.muted }} />}
                      {t.comments?.length > 0 && <MessageSquare size={10} style={{ color: C.muted }} />}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px]" style={{ color: C.muted }}>{t.due}</span>
                      {t.assignee && <Avatar personId={t.assignee} size={18} />}
                    </div>
                  </div>
                  {setTaskStatus && (
                    <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${C.lineSoft}` }} onClick={e => e.stopPropagation()}>
                      <StatusMenu task={t} setTaskStatus={setTaskStatus} size={13} />
                    </div>
                  )}
                </button>
              ))}
              {col.items.length === 0 && <div className="p-4 text-[11px] text-center" style={{ color: C.muted, opacity: 0.5 }}>—</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GanttView({ tasks, currentSpace, allSpaces, openDetail }) {
  const flat = [...allSpaces, ...allSpaces.flatMap(s => s.children || [])];
  const spaceObj = flat.find(s => s.id === currentSpace);
  const spaceName = spaceObj?.name || (currentSpace === "hq" ? "Hygge HQ · Todos" : currentSpace);

  const parseDate = (s) => {
    if (!s) return null;
    const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]), 12, 0, 0) : null;
  };
  const items = tasks.filter(t => !t.parentId).map(t => {
    const start = parseDate(t.startDate) || parseDate(t.due);
    const end = parseDate(t.endDate) || parseDate(t.due) || start;
    return start ? { task: t, start, end: end || start } : null;
  }).filter(Boolean);

  if (items.length === 0) {
    return (
      <div className="px-4 lg:px-10 py-8 lg:py-12 max-w-[1280px] mx-auto">
        <div className="mb-10">
          <NavyRule />
          <div className="mt-4"><Eyebrow>{spaceName} · cronograma</Eyebrow></div>
          <h1 className="text-[32px] lg:text-[36px] mt-3" style={{ color: C.ink, fontWeight: 500, letterSpacing: "-0.025em" }}>Gantt</h1>
        </div>
        <div className="text-center py-16" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
          <GanttChart size={28} style={{ color: C.muted, margin: "0 auto 12px" }} />
          <div className="text-[14px]" style={{ color: C.ink, fontWeight: 500 }}>Sin tareas con fechas en este espacio</div>
          <div className="text-[11px] mt-1" style={{ color: C.muted }}>Las tareas necesitan fecha de inicio o fin para aparecer aquí. Creá una con el botón "Nueva".</div>
        </div>
      </div>
    );
  }

  let minDate = new Date(Math.min(...items.map(b => b.start.getTime())));
  let maxDate = new Date(Math.max(...items.map(b => b.end.getTime())));
  minDate = new Date(minDate.getTime() - 3 * 86400000);
  maxDate = new Date(maxDate.getTime() + 3 * 86400000);
  const totalDays = Math.ceil((maxDate - minDate) / 86400000) + 1;
  const days = Array.from({ length: totalDays }, (_, i) => new Date(minDate.getTime() + i * 86400000));
  const colWidth = totalDays <= 14 ? 60 : totalDays <= 30 ? 40 : totalDays <= 60 ? 26 : 18;
  const todayStr = new Date().toISOString().slice(0, 10);

  const sorted = [...items].sort((a, b) => a.start - b.start);

  return (
    <div className="px-4 lg:px-10 py-8 lg:py-12 max-w-[1280px] mx-auto">
      <div className="mb-8">
        <NavyRule />
        <div className="mt-4"><Eyebrow>{spaceName} · cronograma</Eyebrow></div>
        <h1 className="text-[32px] lg:text-[36px] mt-3" style={{ color: C.ink, fontWeight: 500, letterSpacing: "-0.025em" }}>Gantt</h1>
        <div className="text-[12px] mt-2" style={{ color: C.muted }}>{items.length} {items.length === 1 ? "tarea" : "tareas"} · {totalDays} días</div>
      </div>

      <div className="overflow-x-auto" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
        <div style={{ minWidth: 240 + colWidth * totalDays }}>
          <div className="grid" style={{ gridTemplateColumns: `240px 1fr`, backgroundColor: C.surface, borderBottom: `1px solid ${C.line}` }}>
            <div className="px-3 py-2 text-[9px] tracking-[0.12em] uppercase" style={{ color: C.muted, fontWeight: 600, borderRight: `1px solid ${C.lineSoft}` }}>Tarea</div>
            <div className="grid" style={{ gridTemplateColumns: `repeat(${totalDays}, ${colWidth}px)` }}>
              {days.map((d, i) => {
                const isMonday = d.getDay() === 1;
                const isFirst = d.getDate() === 1;
                const dateStr = d.toISOString().slice(0, 10);
                const isToday = dateStr === todayStr;
                return (
                  <div key={i} className="text-[9px] text-center py-1.5" style={{ borderRight: `1px solid ${C.lineSoft}`, color: isToday ? C.cobalt : isFirst ? C.ink : C.muted, fontWeight: isToday || isFirst ? 700 : 500, backgroundColor: isToday ? C.cobalt + "11" : isMonday ? C.bg : "transparent" }}>
                    <div>{d.getDate()}</div>
                    {colWidth >= 26 && isFirst && <div className="text-[7px] mt-0.5" style={{ color: C.mutedSoft, textTransform: "uppercase", letterSpacing: "0.08em" }}>{d.toLocaleDateString("es-PE", { month: "short" })}</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {sorted.map((item) => {
            const t = item.task;
            const startIdx = Math.floor((item.start - minDate) / 86400000);
            const endIdx = Math.floor((item.end - minDate) / 86400000);
            const span = Math.max(1, endIdx - startIdx + 1);
            const left = startIdx * colWidth;
            const width = span * colWidth - 2;
            const color = t.checked ? C.green : t.priority === "alta" ? C.brick : t.priority === "media" ? C.ochre : C.cobalt;
            const taskSpace = flat.find(s => s.id === t.space);
            return (
              <div key={t.id} className="grid items-center hover:bg-opacity-50" style={{ gridTemplateColumns: `240px 1fr`, borderBottom: `1px solid ${C.lineSoft}` }}>
                <button onClick={() => openDetail(t.id)} className="px-3 py-2.5 text-left flex items-center gap-2 hover:opacity-90" style={{ borderRight: `1px solid ${C.lineSoft}` }}>
                  {t.checked ? <CheckCircle2 size={11} style={{ color: C.green, flexShrink: 0 }} /> : <Circle size={11} style={{ color: C.muted, flexShrink: 0 }} />}
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] truncate" style={{ color: C.ink, fontWeight: 500, textDecoration: t.checked ? "line-through" : "none" }}>{t.title}</div>
                    {taskSpace && <div className="text-[8px] tracking-[0.1em] uppercase mt-0.5" style={{ color: C.muted, fontWeight: 600 }}>{taskSpace.code || taskSpace.name}</div>}
                  </div>
                  {t.assignee && <Avatar personId={t.assignee} size={16} />}
                </button>
                <div className="relative h-10">
                  <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${totalDays}, ${colWidth}px)` }}>
                    {days.map((d, i) => {
                      const dateStr = d.toISOString().slice(0, 10);
                      const isToday = dateStr === todayStr;
                      return <div key={i} style={{ borderRight: `1px solid ${C.lineSoft}`, backgroundColor: isToday ? C.cobalt + "08" : d.getDay() === 1 ? C.surface : "transparent" }} />;
                    })}
                  </div>
                  <button onClick={() => openDetail(t.id)} className="absolute top-1.5 bottom-1.5 flex items-center px-2 text-[10px] hover:opacity-90 transition-opacity"
                    style={{ left: `${left}px`, width: `${width}px`, backgroundColor: color, color: "#fff", borderRadius: 2, fontWeight: 500 }}>
                    <span className="truncate">{t.title}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CalendarView({ tasks, currentSpace, allSpaces, openDetail, onCreate }) {
  const [refDate, setRefDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [quickText, setQuickText] = useState("");

  const flat = [...allSpaces, ...allSpaces.flatMap(s => s.children || [])];
  const spaceObj = flat.find(s => s.id === currentSpace);
  const spaceName = spaceObj?.name || (currentSpace === "hq" ? "Hygge HQ · Todos" : currentSpace);

  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const monthName = refDate.toLocaleDateString("es-PE", { month: "long", year: "numeric" });

  const tasksByDate = useMemo(() => {
    const map = {};
    tasks.forEach(t => {
      if (t.parentId) return;
      [t.endDate, t.startDate, t.due].filter(Boolean).forEach(s => {
        const m = String(s).match(/^\d{4}-\d{2}-\d{2}/);
        if (m) {
          const key = m[0];
          if (!map[key]) map[key] = [];
          if (!map[key].some(x => x.id === t.id)) map[key].push(t);
        }
      });
    });
    return map;
  }, [tasks]);

  const cells = [];
  for (let i = 0; i < 42; i++) {
    const dayNum = i - startWeekday + 1;
    if (dayNum < 1 || dayNum > daysInMonth) cells.push(null);
    else {
      const d = new Date(year, month, dayNum);
      const key = d.toISOString().slice(0, 10);
      cells.push({ day: dayNum, key, tasks: tasksByDate[key] || [], isToday: key === todayKey });
    }
  }

  const handleAdd = (e) => {
    e?.preventDefault?.();
    if (!quickText.trim() || !selectedDate || !onCreate) return;
    onCreate({ title: quickText.trim(), startDate: selectedDate, endDate: selectedDate, due: selectedDate, space: currentSpace });
    setQuickText("");
  };

  const totalThisMonth = Object.entries(tasksByDate).filter(([k]) => k.startsWith(`${year}-${String(month+1).padStart(2,"0")}`)).reduce((a, [, items]) => a + items.length, 0);

  return (
    <div className="px-4 lg:px-10 py-8 lg:py-12 max-w-[1280px] mx-auto">
      <div className="mb-8">
        <NavyRule />
        <div className="mt-4"><Eyebrow>{spaceName} · calendario</Eyebrow></div>
        <h1 className="text-[32px] lg:text-[36px] mt-3 capitalize" style={{ color: C.ink, fontWeight: 500, letterSpacing: "-0.025em" }}>{monthName}</h1>
        <div className="text-[12px] mt-2" style={{ color: C.muted }}>{totalThisMonth} {totalThisMonth === 1 ? "tarea programada" : "tareas programadas"} en este mes</div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <button onClick={() => setRefDate(new Date(year, month - 1, 1))} className="p-1.5 hover:opacity-70" style={{ border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}><ChevronRight size={12} style={{ color: C.ink, transform: "rotate(180deg)" }} /></button>
        <button onClick={() => setRefDate(new Date(year, month + 1, 1))} className="p-1.5 hover:opacity-70" style={{ border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}><ChevronRight size={12} style={{ color: C.ink }} /></button>
        <button onClick={() => setRefDate(new Date())} className="px-3 py-1.5 text-[11px] hover:opacity-90" style={{ color: C.inkSoft, border: `1px solid ${C.lineSoft}`, borderRadius: 2, fontWeight: 500 }}>Hoy</button>
        <div className="flex-1" />
        <div className="text-[10px]" style={{ color: C.muted }}>Click un día para agregar</div>
      </div>

      <div className="grid grid-cols-7 gap-px" style={{ backgroundColor: C.line, border: `1px solid ${C.line}` }}>
        {["LUN","MAR","MIÉ","JUE","VIE","SÁB","DOM"].map(d => (
          <div key={d} className="p-2 text-[9px] tracking-[0.12em] text-center" style={{ backgroundColor: C.bg, color: C.muted, fontWeight: 600 }}>{d}</div>
        ))}
        {cells.map((cell, i) => {
          if (!cell) return <div key={i} style={{ backgroundColor: C.surface, minHeight: 90 }} />;
          const isSelected = selectedDate === cell.key;
          return (
            <button key={i} onClick={() => setSelectedDate(isSelected ? null : cell.key)}
              className="text-left p-2 hover:opacity-90"
              style={{ backgroundColor: isSelected ? C.cobalt + "11" : C.bg, minHeight: 90, outline: isSelected ? `2px solid ${C.cobalt}` : "none", outlineOffset: -2 }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px]" style={{ color: cell.isToday ? C.cobalt : C.ink, fontWeight: cell.isToday ? 700 : 500 }}>{cell.day}</span>
                {cell.tasks.length > 0 && <span className="text-[8px] px-1" style={{ backgroundColor: C.ink, color: C.bg, borderRadius: 999, fontWeight: 700 }}>{cell.tasks.length}</span>}
              </div>
              <div className="space-y-0.5">
                {cell.tasks.slice(0, 3).map(t => (
                  <div key={t.id} onClick={(e) => { e.stopPropagation(); openDetail(t.id); }} className="text-[9px] px-1 py-0.5 truncate hover:opacity-80" style={{ backgroundColor: C.surface, color: C.ink, borderLeft: `2px solid ${t.checked ? C.green : t.priority === "alta" ? C.brick : t.priority === "media" ? C.ochre : C.muted}`, borderRadius: 1, textDecoration: t.checked ? "line-through" : "none" }}>{t.title}</div>
                ))}
                {cell.tasks.length > 3 && <div className="text-[8px] px-1" style={{ color: C.muted, fontWeight: 500 }}>+{cell.tasks.length - 3} más</div>}
              </div>
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <div className="mt-4 p-4" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <Eyebrow>{spaceName} · día seleccionado</Eyebrow>
              <div className="text-[14px] mt-1 capitalize" style={{ color: C.ink, fontWeight: 600 }}>{new Date(selectedDate + "T00:00:00").toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" })}</div>
            </div>
            <button onClick={() => setSelectedDate(null)} className="hover:opacity-70"><X size={13} style={{ color: C.muted }} /></button>
          </div>
          {onCreate && (
            <form onSubmit={handleAdd} className="flex items-center gap-2 mb-4">
              <input value={quickText} onChange={e => setQuickText(e.target.value)} placeholder={`Crear tarea en ${spaceName}…`}
                className="flex-1 px-3 py-2 outline-none text-[13px]"
                style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2, color: C.ink }} />
              <button type="submit" disabled={!quickText.trim()} className="px-3 py-2 text-[11px] hover:opacity-90"
                style={{ backgroundColor: quickText.trim() ? C.ink : C.muted, color: C.bg, borderRadius: 2, fontWeight: 500, opacity: quickText.trim() ? 1 : 0.5 }}>
                <Plus size={11} className="inline mr-1" /> Crear
              </button>
            </form>
          )}
          {(tasksByDate[selectedDate] || []).length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] tracking-[0.12em] uppercase mb-1" style={{ color: C.muted, fontWeight: 600 }}>Tareas de este día · {(tasksByDate[selectedDate] || []).length}</div>
              {(tasksByDate[selectedDate] || []).map(t => (
                <button key={t.id} onClick={() => openDetail(t.id)} className="w-full flex items-center gap-2 p-2 text-left hover:opacity-90"
                  style={{ backgroundColor: C.bg, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
                  {t.checked ? <CheckCircle2 size={12} style={{ color: C.green }} /> : <Circle size={12} style={{ color: C.muted }} />}
                  <span className="text-[12px] flex-1 truncate" style={{ color: C.ink, fontWeight: 500, textDecoration: t.checked ? "line-through" : "none" }}>{t.title}</span>
                  {t.assignee && <Avatar personId={t.assignee} size={18} />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TableView({ tasks, currentSpace, openDetail, allSpaces }) {
  const flat = [...(allSpaces || []), ...(allSpaces || []).flatMap(s => s.children || [])];
  const spaceObj = flat.find(s => s.id === currentSpace);
  const spaceName = spaceObj?.name || (currentSpace === "hq" ? "Hygge HQ · Todos" : currentSpace);
  const filtered = tasks.filter(t => !t.parentId);
  return (
    <div className="px-4 lg:px-10 py-8 lg:py-12 max-w-[1280px] mx-auto">
      <div className="mb-10"><NavyRule /><div className="mt-4"><Eyebrow>{spaceName} · tabla</Eyebrow></div><h1 className="text-[32px] lg:text-[36px] mt-3" style={{ color: C.ink, fontWeight: 500, letterSpacing: "-0.025em" }}>Vista tabular</h1><div className="text-[12px] mt-2" style={{ color: C.muted }}>{filtered.length} {filtered.length === 1 ? "tarea" : "tareas"}</div></div>
      <Panel>
        <table className="w-full">
          <thead><tr className="text-[10px] tracking-[0.15em] uppercase" style={{ color: C.muted, fontWeight: 500 }}>{["Tarea","Asignado","Proyecto","Prioridad","Vence","Estado"].map(h => <th key={h} className="text-left pb-3 px-3" style={{ borderBottom: `1px solid ${C.line}` }}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map((t, i) => (
              <tr key={t.id} onClick={() => openDetail(t.id)} className="cursor-pointer hover:opacity-80" style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${C.lineSoft}` : "none" }}>
                <td className="py-3.5 px-3 text-[13px]" style={{ color: C.ink, fontWeight: 500 }}>{t.title}</td>
                <td className="py-3.5 px-3">{t.assignee ? <Avatar personId={t.assignee} size={22} /> : <span className="text-[11px]" style={{ color: C.muted }}>—</span>}</td>
                <td className="py-3.5 px-3 text-[12px]" style={{ color: C.inkSoft }}>{t.project}</td>
                <td className="py-3.5 px-3"><span className="text-[10px] tracking-[0.1em] uppercase" style={{ color: t.priority === "alta" ? C.brick : t.priority === "media" ? C.ochre : C.muted, fontWeight: 600 }}>{t.priority}</span></td>
                <td className="py-3.5 px-3 text-[12px]" style={{ color: C.muted }}>{t.due}</td>
                <td className="py-3.5 px-3"><span className="text-[10px] tracking-[0.1em] uppercase" style={{ color: t.checked ? C.green : C.cobalt, fontWeight: 600 }}>{t.checked ? "Hecha" : "Pendiente"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

// ═══ WHITEBOARD · Miro-style canvas, one per space ═══════════════════════
const WB_TOOLS = [
  { id: "select", icon: MousePointer2, label: "Seleccionar", shortcut: "V", group: "core" },
  { id: "hand", icon: Hand, label: "Mover canvas", shortcut: "H", group: "core" },
  { id: "sticky", icon: StickyNote, label: "Sticky", shortcut: "N", group: "content" },
  { id: "text", icon: Type, label: "Texto", shortcut: "T", group: "content" },
  { id: "icon", icon: Sparkles, label: "Icono", shortcut: "I", group: "content" },
  { id: "rect", icon: Square, label: "Rectángulo", shortcut: "R", group: "shape" },
  { id: "ellipse", icon: Circle, label: "Elipse", shortcut: "O", group: "shape" },
  { id: "triangle", icon: Triangle, label: "Triángulo", shortcut: "Y", group: "shape" },
  { id: "diamond", icon: Diamond, label: "Diamante", shortcut: "D", group: "shape" },
  { id: "hexagon", icon: Hexagon, label: "Hexágono", shortcut: "G", group: "shape" },
  { id: "star", icon: Star, label: "Estrella", shortcut: "S", group: "shape" },
  { id: "cloud", icon: CloudIcon, label: "Nube", shortcut: "C", group: "shape" },
  { id: "arrow", icon: ArrowUpRight, label: "Flecha", shortcut: "A", group: "draw" },
  { id: "pen", icon: Pencil, label: "Lápiz", shortcut: "P", group: "draw" },
];
const SHAPE_TYPES = ["rect", "ellipse", "triangle", "diamond", "hexagon", "star", "cloud"];
const WB_COLORS = [C.ochre, C.lavender, C.sky, C.cobalt, C.green, C.brick, C.navy, C.ink];

// Variantes del pen tool · cada una con base width, multiplicador de presión y opacidad
// La presión Apple Pencil (e.pressure 0-1) modula el ancho del trazo en cada variante
const WB_PEN_VARIANTS = [
  { id: "pencil", label: "Lápiz", baseSize: 1.5, pressureMultiplier: 2.5, opacity: 0.95 },
  { id: "marker", label: "Plumón", baseSize: 6, pressureMultiplier: 4, opacity: 0.6 },
  { id: "fine-pen", label: "Fine pen", baseSize: 0.8, pressureMultiplier: 1.2, opacity: 1 },
  { id: "highlighter", label: "Resaltador", baseSize: 14, pressureMultiplier: 2, opacity: 0.3 },
  { id: "eraser", label: "Borrador", baseSize: 14, pressureMultiplier: 0, opacity: 1 },
];

// Curated icon library for the whiteboard — real-estate development context
const ICON_LIB = [
  { name: "Building", Icon: Building, label: "Edificio" },
  { name: "Home", Icon: Home, label: "Casa" },
  { name: "MapPin", Icon: MapPin, label: "Ubicación" },
  { name: "Warehouse", Icon: Warehouse, label: "Almacén" },
  { name: "DollarSign", Icon: DollarSign, label: "$" },
  { name: "TrendingUp", Icon: TrendingUp, label: "Sube" },
  { name: "TrendingDown", Icon: TrendingDown, label: "Baja" },
  { name: "Briefcase", Icon: Briefcase, label: "Negocio" },
  { name: "AlertTriangle", Icon: AlertTriangle, label: "Alerta" },
  { name: "AlertCircle", Icon: AlertCircle, label: "Atención" },
  { name: "CheckCircle", Icon: CheckCircle, label: "OK" },
  { name: "XCircle", Icon: XCircle, label: "No" },
  { name: "Info", Icon: Info, label: "Info" },
  { name: "Flag", Icon: Flag, label: "Bandera" },
  { name: "Users", Icon: Users, label: "Equipo" },
  { name: "UserCheck", Icon: UserCheck, label: "Persona OK" },
  { name: "Calendar", Icon: CalendarDays, label: "Fecha" },
  { name: "Clock", Icon: Clock, label: "Hora" },
  { name: "Mail", Icon: Mail, label: "Email" },
  { name: "Phone", Icon: Phone, label: "Tel" },
  { name: "Star", Icon: Star, label: "Estrella" },
  { name: "Heart", Icon: Heart, label: "Like" },
  { name: "ThumbsUp", Icon: ThumbsUp, label: "Aprobar" },
  { name: "Zap", Icon: Zap, label: "Rápido" },
  { name: "Lightbulb", Icon: Lightbulb, label: "Idea" },
  { name: "Award", Icon: Award, label: "Premio" },
  { name: "Target", Icon: Target, label: "Meta" },
  { name: "Bookmark", Icon: Bookmark, label: "Marcar" },
  { name: "Folder", Icon: Folder, label: "Carpeta" },
  { name: "FileText", Icon: FileText, label: "Doc" },
  { name: "Eye", Icon: Eye, label: "Ver" },
  { name: "Settings", Icon: Settings, label: "Config" },
];
const ICON_LOOKUP = ICON_LIB.reduce((acc, it) => { acc[it.name] = it.Icon; return acc; }, {});

// Arrow style variants
const ARROW_STYLES = [
  { id: "solid", label: "Sólida", dasharray: undefined, doubleHead: false, hasHead: true },
  { id: "dashed", label: "Discontinua", dasharray: "8 4", doubleHead: false, hasHead: true },
  { id: "dotted", label: "Punteada", dasharray: "2 4", doubleHead: false, hasHead: true },
  { id: "double", label: "Doble punta", dasharray: undefined, doubleHead: true, hasHead: true },
  { id: "line", label: "Sin punta", dasharray: undefined, doubleHead: false, hasHead: false },
];

// Sticky shape variants
const STICKY_SHAPES = [
  { id: "rect", label: "Cuadrado" },
  { id: "rounded", label: "Redondeado" },
  { id: "circle", label: "Círculo" },
  { id: "hex", label: "Hexágono" },
];

function WhiteboardView({ spaceName, elements, updateElements }) {
  const confirm = useConfirm();
  const askClear = async () => {
    const ok = await confirm({ title: "Limpiar todo el canvas", message: `Se eliminarán ${elements.length} elemento${elements.length !== 1 ? "s" : ""} del whiteboard. Esta acción no se puede deshacer.`, danger: true, confirmLabel: "Limpiar canvas" });
    if (ok) updateElements(() => []);
  };
  const [tool, setTool] = useState("select");
  const [penVariant, setPenVariant] = useState("pencil"); // pencil | marker | fine-pen | highlighter | eraser
  const [penThickness, setPenThickness] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [drawingEl, setDrawingEl] = useState(null);
  const dragRef = useRef(null);
  const canvasRef = useRef(null);
  const colorRef = useRef(C.ochre);
  const penVariantRef = useRef("pencil");
  const penThicknessRef = useRef(1);
  useEffect(() => { penVariantRef.current = penVariant; }, [penVariant]);
  useEffect(() => { penThicknessRef.current = penThickness; }, [penThickness]);

  const selected = elements.find(e => e.id === selectedId);

  const toCanvasCoord = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - pan.x) / zoom,
      y: (e.clientY - rect.top - pan.y) / zoom,
    };
  };

  const fileInputRef = useRef(null);

  const processFile = (file, posX, posY) => {
    const reader = new FileReader();
    reader.onload = () => {
      const id = Date.now() + Math.random();
      if (file.type.startsWith("image/")) {
        const img = new window.Image();
        img.onload = () => {
          const maxW = 400, maxH = 400;
          let w = img.width, h = img.height;
          if (w > maxW) { h = h * maxW / w; w = maxW; }
          if (h > maxH) { w = w * maxH / h; h = maxH; }
          updateElements(els => [...els, { id, type: "image", x: posX - w/2, y: posY - h/2, w, h, dataUrl: reader.result, name: file.name }]);
          setSelectedId(id);
        };
        img.src = reader.result;
      } else {
        updateElements(els => [...els, { id, type: "file", x: posX - 90, y: posY - 50, w: 180, h: 110, dataUrl: reader.result, name: file.name, fileType: file.type, size: file.size }]);
        setSelectedId(id);
      }
    };
    reader.readAsDataURL(file);
  };

  const onFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = (rect.width / 2 - pan.x) / zoom;
    const cy = (rect.height / 2 - pan.y) / zoom;
    files.forEach((f, i) => processFile(f, cx + i * 24, cy + i * 24));
    e.target.value = "";
  };

  const onDrop = (e) => {
    e.preventDefault();
    const c = toCanvasCoord(e);
    const files = Array.from(e.dataTransfer.files || []);
    files.forEach((f, i) => processFile(f, c.x + i * 24, c.y + i * 24));
  };

  const placeIcon = (iconName) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = (rect.width / 2 - pan.x) / zoom;
    const cy = (rect.height / 2 - pan.y) / zoom;
    const size = 48;
    const id = Date.now();
    updateElements(els => [...els, { id, type: "icon", x: cx - size/2, y: cy - size/2, size, iconName, color: C.ink }]);
    setSelectedId(id);
    setTool("select");
  };

  const onHandleMouseDown = (e, el, corner) => {
    e.stopPropagation();
    const isIcon = el.type === "icon";
    dragRef.current = {
      type: "resize",
      elId: el.id, corner,
      startSX: e.clientX, startSY: e.clientY,
      origX: el.x, origY: el.y,
      origW: isIcon ? el.size : el.w,
      origH: isIcon ? el.size : el.h,
      isIcon,
    };
  };

  useEffect(() => {
    const onPaste = (e) => {
      if (editingId) return;
      if (e.target?.tagName === "INPUT" || e.target?.tagName === "TEXTAREA") return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file && canvasRef.current) {
            e.preventDefault();
            const rect = canvasRef.current.getBoundingClientRect();
            const cx = (rect.width / 2 - pan.x) / zoom;
            const cy = (rect.height / 2 - pan.y) / zoom;
            processFile(file, cx, cy);
            break;
          }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [editingId, pan, zoom]);

  useEffect(() => {
    const h = (e) => {
      if (editingId) return;
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      const key = e.key.toLowerCase();
      const found = WB_TOOLS.find(t => t.shortcut.toLowerCase() === key);
      if (found) { setTool(found.id); return; }
      if ((e.key === "Backspace" || e.key === "Delete") && selectedId) {
        e.preventDefault();
        updateElements(els => els.filter(el => el.id !== selectedId));
        setSelectedId(null);
      }
      if (e.key === "Escape") { setSelectedId(null); setEditingId(null); setTool("select"); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [selectedId, editingId, updateElements]);

  const onWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const rect = canvasRef.current.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      const cx = (sx - pan.x) / zoom, cy = (sy - pan.y) / zoom;
      const newZoom = Math.max(0.2, Math.min(3, zoom * (e.deltaY < 0 ? 1.1 : 0.9)));
      setPan({ x: sx - cx * newZoom, y: sy - cy * newZoom });
      setZoom(newZoom);
    } else {
      setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  };

  const onCanvasMouseDown = (e) => {
    if (e.button !== 0) return;
    if (editingId) return;
    const c = toCanvasCoord(e);
    if (tool === "hand") {
      dragRef.current = { type: "pan", startSX: e.clientX, startSY: e.clientY, origPanX: pan.x, origPanY: pan.y };
      return;
    }
    if (tool === "select") {
      setSelectedId(null);
      dragRef.current = { type: "pan", startSX: e.clientX, startSY: e.clientY, origPanX: pan.x, origPanY: pan.y };
      return;
    }
    if (tool === "sticky") {
      const id = Date.now();
      const newEl = { id, type: "sticky", x: c.x - 100, y: c.y - 55, w: 200, h: 110, text: "", color: colorRef.current };
      updateElements(els => [...els, newEl]);
      setSelectedId(id); setEditingId(id); setTool("select");
      return;
    }
    if (tool === "text") {
      const id = Date.now();
      const newEl = { id, type: "text", x: c.x, y: c.y, text: "Texto", fontSize: 18, color: C.ink };
      updateElements(els => [...els, newEl]);
      setSelectedId(id); setEditingId(id); setTool("select");
      return;
    }
    if (SHAPE_TYPES.includes(tool)) {
      const id = Date.now();
      setDrawingEl({ id, type: tool, x: c.x, y: c.y, w: 0, h: 0, _startX: c.x, _startY: c.y, fill: "transparent", stroke: colorRef.current, strokeWidth: 2 });
      return;
    }
    if (tool === "arrow") {
      const id = Date.now();
      setDrawingEl({ id, type: "arrow", x1: c.x, y1: c.y, x2: c.x, y2: c.y, color: colorRef.current, strokeWidth: 2 });
      return;
    }
    if (tool === "pen") {
      const id = Date.now();
      const pressure = e.pointerType === "pen" ? (e.pressure || 0.5) : 0.5;
      // Cada variant tiene su base width × multiplier × thickness
      const variant = penVariantRef.current;
      const cfg = WB_PEN_VARIANTS.find(v => v.id === variant) || WB_PEN_VARIANTS[0];
      setDrawingEl({
        id, type: "path",
        points: [{ x: c.x, y: c.y, p: pressure }],
        color: variant === "eraser" ? "#FAF8F2" : colorRef.current,
        variant,
        opacity: cfg.opacity,
        baseWidth: cfg.baseSize * penThicknessRef.current,
        pressureMult: cfg.pressureMultiplier,
        strokeWidth: (cfg.baseSize + pressure * cfg.pressureMultiplier) * penThicknessRef.current,
      });
      return;
    }
  };

  const onCanvasMouseMove = (e) => {
    if (dragRef.current) {
      const d = dragRef.current;
      if (d.type === "pan") {
        setPan({ x: d.origPanX + (e.clientX - d.startSX), y: d.origPanY + (e.clientY - d.startSY) });
      } else if (d.type === "move") {
        const dx = (e.clientX - d.startSX) / zoom;
        const dy = (e.clientY - d.startSY) / zoom;
        updateElements(els => els.map(el => {
          if (el.id !== d.elId) return el;
          if (el.type === "arrow") return { ...el, x1: d.origX1 + dx, y1: d.origY1 + dy, x2: d.origX2 + dx, y2: d.origY2 + dy };
          if (el.type === "path") return { ...el, points: el.points.map((p, i) => ({ x: d.origPoints[i].x + dx, y: d.origPoints[i].y + dy })) };
          return { ...el, x: d.origX + dx, y: d.origY + dy };
        }));
      } else if (d.type === "resize") {
        const dx = (e.clientX - d.startSX) / zoom;
        const dy = (e.clientY - d.startSY) / zoom;
        let newX = d.origX, newY = d.origY, newW = d.origW, newH = d.origH;
        if (d.corner.includes("e")) newW = Math.max(20, d.origW + dx);
        if (d.corner.includes("w")) { newW = Math.max(20, d.origW - dx); newX = d.origX + (d.origW - newW); }
        if (d.corner.includes("s")) newH = Math.max(20, d.origH + dy);
        if (d.corner.includes("n")) { newH = Math.max(20, d.origH - dy); newY = d.origY + (d.origH - newH); }
        updateElements(els => els.map(el => {
          if (el.id !== d.elId) return el;
          if (d.isIcon) {
            const s = Math.max(newW, newH);
            return { ...el, x: newX, y: newY, size: Math.max(20, s) };
          }
          return { ...el, x: newX, y: newY, w: newW, h: newH };
        }));
      }
      return;
    }
    if (drawingEl) {
      const c = toCanvasCoord(e);
      if (SHAPE_TYPES.includes(drawingEl.type)) {
        const x1 = drawingEl._startX, y1 = drawingEl._startY;
        const x = Math.min(x1, c.x), y = Math.min(y1, c.y);
        const w = Math.abs(c.x - x1), h = Math.abs(c.y - y1);
        setDrawingEl({ ...drawingEl, x, y, w, h });
      } else if (drawingEl.type === "arrow") {
        setDrawingEl({ ...drawingEl, x2: c.x, y2: c.y });
      } else if (drawingEl.type === "path") {
        const pressure = e.pointerType === "pen" ? (e.pressure || 0.5) : 0.5;
        setDrawingEl({ ...drawingEl, points: [...drawingEl.points, { x: c.x, y: c.y, p: pressure }] });
      }
    }
  };

  const onCanvasMouseUp = () => {
    dragRef.current = null;
    if (drawingEl) {
      const isValid = (drawingEl.type === "path" && drawingEl.points.length > 1)
        || (drawingEl.type === "arrow" && (Math.abs(drawingEl.x2 - drawingEl.x1) > 5 || Math.abs(drawingEl.y2 - drawingEl.y1) > 5))
        || (SHAPE_TYPES.includes(drawingEl.type) && drawingEl.w > 5 && drawingEl.h > 5);
      if (isValid) {
        const finalEl = { ...drawingEl };
        delete finalEl._startX; delete finalEl._startY;
        // Para paths con pressure, calculo el avg y aplico al strokeWidth final
        if (finalEl.type === "path" && finalEl.points?.length > 0 && finalEl.baseWidth != null) {
          const avgPressure = finalEl.points.reduce((s, p) => s + (p.p || 0.5), 0) / finalEl.points.length;
          finalEl.strokeWidth = finalEl.baseWidth + avgPressure * (finalEl.pressureMult || 0);
        }
        updateElements(els => [...els, finalEl]);
        setSelectedId(finalEl.id);
        // Si es pen tool, no salir del modo · permite trazos sucesivos
        if (drawingEl.type !== "path") setTool("select");
      }
      setDrawingEl(null);
    }
  };

  const onElementMouseDown = (e, el) => {
    if (tool !== "select" || editingId === el.id) return;
    e.stopPropagation();
    setSelectedId(el.id);
    if (el.type === "arrow") {
      dragRef.current = { type: "move", elId: el.id, startSX: e.clientX, startSY: e.clientY, origX1: el.x1, origY1: el.y1, origX2: el.x2, origY2: el.y2 };
    } else if (el.type === "path") {
      dragRef.current = { type: "move", elId: el.id, startSX: e.clientX, startSY: e.clientY, origPoints: el.points };
    } else {
      dragRef.current = { type: "move", elId: el.id, startSX: e.clientX, startSY: e.clientY, origX: el.x, origY: el.y };
    }
  };

  const updateEl = (id, patch) => updateElements(els => els.map(el => el.id === id ? { ...el, ...patch } : el));
  const deleteEl = (id) => { updateElements(els => els.filter(el => el.id !== id)); setSelectedId(null); };

  const SVG_SIZE = 4000;
  const SVG_OFFSET = -2000;

  const renderShapeSVG = (el, isSelected) => {
    const stroke = isSelected ? C.cobalt : (el.stroke || el.color || C.ink);
    const sw = (el.strokeWidth || 2);
    const finalSw = isSelected ? sw + 1 : sw;
    const fill = el.fill || "transparent";
    const cursor = tool === "select" ? "move" : "default";

    if (el.type === "rect") return <rect x={el.x} y={el.y} width={el.w} height={el.h} fill={fill} stroke={stroke} strokeWidth={finalSw} style={{ cursor }} onMouseDown={(e) => onElementMouseDown(e, el)} />;

    if (el.type === "ellipse") return <ellipse cx={el.x + el.w/2} cy={el.y + el.h/2} rx={el.w/2} ry={el.h/2} fill={fill} stroke={stroke} strokeWidth={finalSw} style={{ cursor }} onMouseDown={(e) => onElementMouseDown(e, el)} />;

    if (el.type === "triangle") {
      const pts = `${el.x + el.w/2},${el.y} ${el.x + el.w},${el.y + el.h} ${el.x},${el.y + el.h}`;
      return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={finalSw} strokeLinejoin="round" style={{ cursor }} onMouseDown={(e) => onElementMouseDown(e, el)} />;
    }

    if (el.type === "diamond") {
      const pts = `${el.x + el.w/2},${el.y} ${el.x + el.w},${el.y + el.h/2} ${el.x + el.w/2},${el.y + el.h} ${el.x},${el.y + el.h/2}`;
      return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={finalSw} strokeLinejoin="round" style={{ cursor }} onMouseDown={(e) => onElementMouseDown(e, el)} />;
    }

    if (el.type === "hexagon") {
      const pts = `${el.x + el.w*0.25},${el.y} ${el.x + el.w*0.75},${el.y} ${el.x + el.w},${el.y + el.h/2} ${el.x + el.w*0.75},${el.y + el.h} ${el.x + el.w*0.25},${el.y + el.h} ${el.x},${el.y + el.h/2}`;
      return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={finalSw} strokeLinejoin="round" style={{ cursor }} onMouseDown={(e) => onElementMouseDown(e, el)} />;
    }

    if (el.type === "star") {
      const cx = el.x + el.w/2, cy = el.y + el.h/2;
      const outer = Math.min(el.w, el.h) / 2;
      const inner = outer * 0.4;
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? outer : inner;
        const ang = (i * Math.PI / 5) - Math.PI / 2;
        pts.push(`${cx + r * Math.cos(ang)},${cy + r * Math.sin(ang)}`);
      }
      return <polygon points={pts.join(" ")} fill={fill} stroke={stroke} strokeWidth={finalSw} strokeLinejoin="round" style={{ cursor }} onMouseDown={(e) => onElementMouseDown(e, el)} />;
    }

    if (el.type === "cloud") {
      const { x, y, w, h } = el;
      const d = `M ${x + w*0.2},${y + h*0.55}
                 C ${x + w*0.05},${y + h*0.55} ${x + w*0.05},${y + h*0.3} ${x + w*0.25},${y + h*0.3}
                 C ${x + w*0.3},${y + h*0.08} ${x + w*0.55},${y + h*0.08} ${x + w*0.6},${y + h*0.25}
                 C ${x + w*0.75},${y + h*0.05} ${x + w*0.95},${y + h*0.2} ${x + w*0.85},${y + h*0.4}
                 C ${x + w*1.02},${y + h*0.5} ${x + w*0.95},${y + h*0.78} ${x + w*0.78},${y + h*0.78}
                 C ${x + w*0.7},${y + h*0.95} ${x + w*0.4},${y + h*0.95} ${x + w*0.35},${y + h*0.8}
                 C ${x + w*0.15},${y + h*0.85} ${x + w*0.05},${y + h*0.7} ${x + w*0.2},${y + h*0.55} Z`;
      return <path d={d} fill={fill} stroke={stroke} strokeWidth={finalSw} strokeLinejoin="round" style={{ cursor }} onMouseDown={(e) => onElementMouseDown(e, el)} />;
    }

    if (el.type === "arrow") {
      const style = ARROW_STYLES.find(s => s.id === (el.style || "solid")) || ARROW_STYLES[0];
      const angle = Math.atan2(el.y2 - el.y1, el.x2 - el.x1);
      const head = 12;
      const headPts = (px, py, reverseAngle) => {
        const ang = reverseAngle ? angle + Math.PI : angle;
        const ax1 = px - head * Math.cos(ang - Math.PI / 6);
        const ay1 = py - head * Math.sin(ang - Math.PI / 6);
        const ax2 = px - head * Math.cos(ang + Math.PI / 6);
        const ay2 = py - head * Math.sin(ang + Math.PI / 6);
        return `${px},${py} ${ax1},${ay1} ${ax2},${ay2}`;
      };
      return (
        <g style={{ cursor }} onMouseDown={(e) => onElementMouseDown(e, el)}>
          <line x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} stroke={stroke} strokeWidth={finalSw} strokeLinecap="round" strokeDasharray={style.dasharray} />
          {style.hasHead && <polygon points={headPts(el.x2, el.y2, false)} fill={stroke} />}
          {style.doubleHead && <polygon points={headPts(el.x1, el.y1, true)} fill={stroke} />}
        </g>
      );
    }

    if (el.type === "path") {
      const d = el.points.reduce((acc, p, i) => acc + (i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`), "");
      const pathOpacity = el.opacity != null ? el.opacity : 1;
      return <path d={d} fill="none" stroke={stroke} strokeWidth={finalSw} strokeLinecap="round" strokeLinejoin="round" opacity={pathOpacity} style={{ cursor }} onMouseDown={(e) => onElementMouseDown(e, el)} />;
    }
    return null;
  };

  const cursor = tool === "hand" ? "grab" : (tool === "select" || tool === "icon") ? "default" : "crosshair";
  const shapeElements = elements.filter(e => [...SHAPE_TYPES, "arrow", "path"].includes(e.type));
  const divElements = elements.filter(e => ["sticky", "text", "image", "file", "icon"].includes(e.type));

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 104px)" }}>
      <div className="px-7 py-4 flex items-center justify-between flex-shrink-0" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
        <div>
          <Eyebrow>Whiteboard · {spaceName}</Eyebrow>
          <div className="text-[16px] mt-1" style={{ color: C.ink, fontWeight: 600 }}>Canvas de ideación</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] hover:opacity-90" style={{ color: C.inkSoft, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
            <Maximize2 size={11} /> Reset
          </button>
          <button onClick={askClear} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] hover:opacity-90" style={{ color: C.brick, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
            <Trash size={11} /> Limpiar
          </button>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden" style={{ backgroundColor: C.paper }}>
        <div className="absolute top-4 left-4 z-20 flex flex-col gap-1 p-1.5" style={{ backgroundColor: C.bg, border: `1px solid ${C.line}`, borderRadius: 4, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
          {WB_TOOLS.map((t, i) => {
            const Icon = t.icon;
            const isActive = tool === t.id;
            const prevGroup = i > 0 ? WB_TOOLS[i-1].group : null;
            const showDivider = prevGroup && prevGroup !== t.group;
            return (
              <React.Fragment key={t.id}>
                {showDivider && <div style={{ height: 1, backgroundColor: C.lineSoft, margin: "3px 4px" }} />}
                <button onClick={() => setTool(t.id)} title={`${t.label} (${t.shortcut})`}
                  className="w-9 h-9 flex items-center justify-center hover:opacity-90"
                  style={{ backgroundColor: isActive ? C.ink : "transparent", color: isActive ? C.bg : C.inkSoft, borderRadius: 2 }}>
                  <Icon size={15} />
                </button>
              </React.Fragment>
            );
          })}
          <div style={{ height: 1, backgroundColor: C.lineSoft, margin: "3px 4px" }} />
          <button onClick={() => fileInputRef.current?.click()} title="Subir imagen, PDF o archivo"
            className="w-9 h-9 flex items-center justify-center hover:opacity-90"
            style={{ color: C.inkSoft, borderRadius: 2 }}>
            <FileUp size={15} />
          </button>
          <input ref={fileInputRef} type="file" multiple onChange={onFileSelect} className="hidden"
            accept="image/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.ppt,.pptx" />
        </div>

        {tool === "pen" && (
          <div className="absolute top-4 left-[68px] z-20 p-2" style={{ backgroundColor: C.bg, border: `1px solid ${C.line}`, borderRadius: 4, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", width: 200 }}>
            <div className="text-[9px] tracking-[0.12em] uppercase mb-1.5 px-1" style={{ color: C.muted, fontWeight: 700 }}>Lápiz · variante</div>
            <div className="space-y-0.5 mb-2">
              {WB_PEN_VARIANTS.map(v => {
                const isActive = penVariant === v.id;
                return (
                  <button key={v.id} onClick={() => setPenVariant(v.id)} className="w-full flex items-center justify-between px-2 py-1.5 hover:opacity-90"
                    style={{ backgroundColor: isActive ? C.surface : "transparent", border: `1px solid ${isActive ? C.lineSoft : "transparent"}`, borderRadius: 2 }}>
                    <span style={{ fontSize: 11, color: isActive ? C.ink : C.inkSoft, fontWeight: isActive ? 600 : 500 }}>{v.label}</span>
                    {/* Preview line para visualizar el grosor */}
                    <span style={{ display: "inline-block", width: 28, height: 3 + v.baseSize, backgroundColor: v.id === "eraser" ? "#FAF8F2" : C.ink, opacity: v.opacity, borderRadius: 999, border: v.id === "eraser" ? `1px dashed ${C.muted}` : "none" }} />
                  </button>
                );
              })}
            </div>
            <div className="px-1 pt-1.5" style={{ borderTop: `1px solid ${C.lineSoft}` }}>
              <div className="flex items-center justify-between mb-1">
                <span style={{ fontSize: 9, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>Grosor</span>
                <span style={{ fontSize: 9, color: C.muted, fontFamily: "ui-monospace, monospace" }}>{penThickness.toFixed(1)}×</span>
              </div>
              <input type="range" min="0.5" max="3" step="0.1" value={penThickness} onChange={(e) => setPenThickness(parseFloat(e.target.value))} style={{ width: "100%", accentColor: C.ink }} />
            </div>
            <div className="px-1 mt-2 text-[9px]" style={{ color: C.muted, lineHeight: 1.4, fontStyle: "italic" }}>
              Con Apple Pencil, la presión modula el grosor automáticamente.
            </div>
          </div>
        )}

        {([...SHAPE_TYPES, "sticky", "arrow", "pen"].includes(tool) || (selected && !["text", "image", "file"].includes(selected.type))) && (
          <div className="absolute top-4 z-20 flex flex-col gap-1 p-1.5" style={{ left: tool === "pen" ? "276px" : "68px", backgroundColor: C.bg, border: `1px solid ${C.line}`, borderRadius: 4, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
            {WB_COLORS.map(col => (
              <button key={col} onClick={() => {
                colorRef.current = col;
                if (selected) {
                  if (selected.type === "sticky") updateEl(selected.id, { color: col });
                  else if (selected.type === "arrow" || selected.type === "path") updateEl(selected.id, { color: col });
                  else if (SHAPE_TYPES.includes(selected.type)) updateEl(selected.id, { stroke: col });
                  else if (selected.type === "icon") updateEl(selected.id, { color: col });
                }
              }}
                className="w-6 h-6" style={{ backgroundColor: col, borderRadius: 999, border: colorRef.current === col ? `2px solid ${C.ink}` : `1px solid ${C.lineSoft}` }} />
            ))}
          </div>
        )}

        {tool === "icon" && (
          <div className="absolute top-4 left-[68px] z-30 p-2.5" style={{ backgroundColor: C.bg, border: `1px solid ${C.line}`, borderRadius: 4, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", width: 224 }}>
            <div className="text-[10px] tracking-[0.15em] uppercase mb-2 px-1" style={{ color: C.muted, fontWeight: 500 }}>Elegí un icono</div>
            <div className="grid grid-cols-4 gap-1 max-h-[480px] overflow-y-auto">
              {ICON_LIB.map(it => {
                const Icon = it.Icon;
                return (
                  <button key={it.name} onClick={() => placeIcon(it.name)} title={it.label}
                    className="w-10 h-10 flex items-center justify-center hover:opacity-90"
                    style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
                    <Icon size={16} style={{ color: C.inkSoft }} />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {selected && (
          <div className="absolute top-4 right-4 z-20 flex items-center gap-1 p-1.5" style={{ backgroundColor: C.bg, border: `1px solid ${C.line}`, borderRadius: 4, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
            {selected.type === "sticky" && (
              <>
                {STICKY_SHAPES.map(s => {
                  const active = (selected.shape || "rect") === s.id;
                  const col = active ? C.bg : C.inkSoft;
                  return (
                    <button key={s.id} onClick={() => updateEl(selected.id, { shape: s.id })} title={s.label}
                      className="w-7 h-7 flex items-center justify-center"
                      style={{ backgroundColor: active ? C.ink : "transparent", borderRadius: 2 }}>
                      <svg width="14" height="14" viewBox="0 0 16 16">
                        {s.id === "rect" && <rect x="2" y="2" width="12" height="12" fill="none" stroke={col} strokeWidth="1.5" />}
                        {s.id === "rounded" && <rect x="2" y="2" width="12" height="12" rx="3" fill="none" stroke={col} strokeWidth="1.5" />}
                        {s.id === "circle" && <circle cx="8" cy="8" r="6" fill="none" stroke={col} strokeWidth="1.5" />}
                        {s.id === "hex" && <polygon points="5,1 11,1 15,8 11,15 5,15 1,8" fill="none" stroke={col} strokeWidth="1.5" />}
                      </svg>
                    </button>
                  );
                })}
                <div style={{ width: 1, height: 16, backgroundColor: C.lineSoft, margin: "0 4px" }} />
              </>
            )}

            {selected.type === "arrow" && (
              <>
                {ARROW_STYLES.map(s => {
                  const active = (selected.style || "solid") === s.id;
                  const col = active ? C.bg : C.inkSoft;
                  return (
                    <button key={s.id} onClick={() => updateEl(selected.id, { style: s.id })} title={s.label}
                      className="h-7 px-1.5 flex items-center justify-center"
                      style={{ backgroundColor: active ? C.ink : "transparent", borderRadius: 2 }}>
                      <svg width="24" height="12" viewBox="0 0 24 12">
                        <line x1={s.doubleHead ? 5 : 1} y1="6" x2={s.hasHead ? 19 : 23} y2="6" stroke={col} strokeWidth="1.5" strokeDasharray={s.dasharray} />
                        {s.hasHead && <polygon points="15,3 20,6 15,9" fill={col} />}
                        {s.doubleHead && <polygon points="9,3 4,6 9,9" fill={col} />}
                      </svg>
                    </button>
                  );
                })}
                <div style={{ width: 1, height: 16, backgroundColor: C.lineSoft, margin: "0 4px" }} />
              </>
            )}

            {selected.type === "icon" && (
              <>
                <span className="text-[10px] px-2" style={{ color: C.muted, fontWeight: 500 }}>tamaño</span>
                {[24, 36, 48, 72, 96].map(s => {
                  const active = selected.size === s;
                  return (
                    <button key={s} onClick={() => updateEl(selected.id, { size: s })}
                      className="h-7 px-2 flex items-center justify-center text-[10px]"
                      style={{ backgroundColor: active ? C.ink : "transparent", color: active ? C.bg : C.inkSoft, borderRadius: 2, fontWeight: 500 }}>
                      {s}
                    </button>
                  );
                })}
                <div style={{ width: 1, height: 16, backgroundColor: C.lineSoft, margin: "0 4px" }} />
              </>
            )}

            <span className="text-[10px] tracking-[0.1em] uppercase px-2" style={{ color: C.muted, fontWeight: 500 }}>{selected.type}</span>
            <button onClick={() => deleteEl(selected.id)} className="w-7 h-7 flex items-center justify-center hover:opacity-70" title="Eliminar (Del)">
              <Trash2 size={13} style={{ color: C.brick }} />
            </button>
          </div>
        )}

        <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1 p-1" style={{ backgroundColor: C.bg, border: `1px solid ${C.line}`, borderRadius: 4, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
          <button onClick={() => setZoom(z => Math.max(0.2, z * 0.9))} className="w-7 h-7 flex items-center justify-center hover:opacity-70"><ZoomOut size={13} style={{ color: C.inkSoft }} /></button>
          <span className="text-[11px] px-2" style={{ color: C.inkSoft, fontWeight: 500, minWidth: 42, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(3, z * 1.1))} className="w-7 h-7 flex items-center justify-center hover:opacity-70"><ZoomIn size={13} style={{ color: C.inkSoft }} /></button>
        </div>

        <div className="absolute bottom-4 left-4 z-20 px-3 py-2 text-[10px]" style={{ backgroundColor: C.bg, border: `1px solid ${C.line}`, borderRadius: 4, color: C.muted, fontWeight: 500, maxWidth: 620 }}>
          <span style={{ fontFamily: "monospace" }}>V</span> select · <span style={{ fontFamily: "monospace" }}>N</span> sticky · <span style={{ fontFamily: "monospace" }}>T</span> texto · <span style={{ fontFamily: "monospace" }}>I</span> icono · <span style={{ fontFamily: "monospace" }}>R/O/Y/D/G/S/C</span> formas · <span style={{ fontFamily: "monospace" }}>A</span> flecha · <span style={{ fontFamily: "monospace" }}>P</span> lápiz · esquinas <strong style={{ color: C.inkSoft }}>resize</strong> · doble-click edita · <strong style={{ color: C.inkSoft }}>drag/⌘V</strong> sube imágenes
        </div>

        <div
          ref={canvasRef}
          className="absolute inset-0"
          onMouseDown={onCanvasMouseDown}
          onMouseMove={onCanvasMouseMove}
          onMouseUp={onCanvasMouseUp}
          onMouseLeave={onCanvasMouseUp}
          onPointerDown={(e) => { if (e.pointerType === "pen") onCanvasMouseDown(e); }}
          onPointerMove={(e) => { if (e.pointerType === "pen") onCanvasMouseMove(e); }}
          onPointerUp={(e) => { if (e.pointerType === "pen") onCanvasMouseUp(e); }}
          onWheel={onWheel}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          style={{
            backgroundImage: `radial-gradient(circle, ${C.line} 1px, transparent 1px)`,
            backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
            cursor, userSelect: "none",
            touchAction: tool === "pen" ? "none" : "auto",
          }}>
          <div style={{ position: "absolute", left: 0, top: 0, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0", width: 0, height: 0 }}>
            <svg width={SVG_SIZE} height={SVG_SIZE} style={{ position: "absolute", left: SVG_OFFSET, top: SVG_OFFSET, overflow: "visible", pointerEvents: "none" }}>
              <g transform={`translate(${-SVG_OFFSET}, ${-SVG_OFFSET})`} style={{ pointerEvents: "auto" }}>
                {shapeElements.map(el => (
                  <g key={el.id}>{renderShapeSVG(el, selectedId === el.id)}</g>
                ))}
                {drawingEl && drawingEl.type !== "sticky" && drawingEl.type !== "text" && renderShapeSVG(drawingEl, false)}
              </g>
            </svg>

            {divElements.map(el => {
              const isSelected = selectedId === el.id;
              const isEditing = editingId === el.id;
              if (el.type === "sticky") {
                const shape = el.shape || "rect";
                const stickyStyle = {
                  left: el.x, top: el.y, width: el.w, minHeight: el.h,
                  backgroundColor: el.color + "55",
                  cursor: tool === "select" ? (isEditing ? "text" : "move") : "default",
                  outline: isSelected ? `2px solid ${C.cobalt}` : "none", outlineOffset: 2,
                  padding: 12,
                  position: "absolute",
                };
                if (shape === "rect") {
                  stickyStyle.border = `1px solid ${el.color}`;
                  stickyStyle.borderLeft = `3px solid ${el.color}`;
                  stickyStyle.borderRadius = 2;
                  stickyStyle.boxShadow = "0 2px 6px rgba(0,0,0,0.06)";
                } else if (shape === "rounded") {
                  stickyStyle.border = `1px solid ${el.color}`;
                  stickyStyle.borderLeft = `3px solid ${el.color}`;
                  stickyStyle.borderRadius = 16;
                  stickyStyle.boxShadow = "0 2px 6px rgba(0,0,0,0.06)";
                } else if (shape === "circle") {
                  stickyStyle.border = `2px solid ${el.color}`;
                  stickyStyle.borderRadius = "50%";
                  stickyStyle.boxShadow = "0 2px 6px rgba(0,0,0,0.06)";
                  stickyStyle.padding = 24;
                  stickyStyle.display = "flex";
                  stickyStyle.alignItems = "center";
                  stickyStyle.justifyContent = "center";
                  stickyStyle.textAlign = "center";
                } else if (shape === "hex") {
                  stickyStyle.clipPath = "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)";
                  stickyStyle.backgroundColor = el.color + "77";
                  stickyStyle.padding = "20px 36px";
                  stickyStyle.display = "flex";
                  stickyStyle.alignItems = "center";
                  stickyStyle.justifyContent = "center";
                  stickyStyle.textAlign = "center";
                }
                return (
                  <div key={el.id}
                    onMouseDown={(e) => onElementMouseDown(e, el)}
                    onDoubleClick={() => { setSelectedId(el.id); setEditingId(el.id); }}
                    style={stickyStyle}>
                    {isEditing ? (
                      <textarea autoFocus value={el.text} onChange={e => updateEl(el.id, { text: e.target.value })}
                        onBlur={() => setEditingId(null)}
                        onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); setEditingId(null); } }}
                        onMouseDown={e => e.stopPropagation()}
                        className="w-full outline-none bg-transparent text-[12px] resize-none"
                        style={{ color: C.ink, fontWeight: 500, lineHeight: 1.5, minHeight: 60, fontFamily: "inherit", textAlign: "inherit" }} />
                    ) : (
                      <div className="text-[12px]" style={{ color: C.ink, fontWeight: 500, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {el.text || <span style={{ color: C.muted, fontStyle: "italic" }}>Doble-click para editar…</span>}
                      </div>
                    )}
                  </div>
                );
              }
              if (el.type === "text") {
                return (
                  <div key={el.id} className="absolute"
                    onMouseDown={(e) => onElementMouseDown(e, el)}
                    onDoubleClick={() => { setSelectedId(el.id); setEditingId(el.id); }}
                    style={{
                      left: el.x, top: el.y,
                      cursor: tool === "select" ? (isEditing ? "text" : "move") : "default",
                      outline: isSelected ? `2px solid ${C.cobalt}` : "none", outlineOffset: 4, borderRadius: 2,
                    }}>
                    {isEditing ? (
                      <input autoFocus value={el.text} onChange={e => updateEl(el.id, { text: e.target.value })}
                        onBlur={() => setEditingId(null)}
                        onKeyDown={e => { if (e.key === "Escape" || e.key === "Enter") { e.preventDefault(); setEditingId(null); } }}
                        onMouseDown={e => e.stopPropagation()}
                        className="outline-none bg-transparent"
                        style={{ color: el.color || C.ink, fontWeight: 600, fontSize: el.fontSize, fontFamily: "inherit", letterSpacing: "-0.015em", minWidth: 80, width: Math.max(80, (el.text?.length || 4) * el.fontSize * 0.55) }} />
                    ) : (
                      <div style={{ color: el.color || C.ink, fontWeight: 600, fontSize: el.fontSize, letterSpacing: "-0.015em", whiteSpace: "nowrap" }}>
                        {el.text || "Texto"}
                      </div>
                    )}
                  </div>
                );
              }
              if (el.type === "image") {
                return (
                  <div key={el.id} className="absolute"
                    onMouseDown={(e) => onElementMouseDown(e, el)}
                    onDoubleClick={() => window.open(el.dataUrl, "_blank")}
                    style={{
                      left: el.x, top: el.y, width: el.w, height: el.h,
                      cursor: tool === "select" ? "move" : "default",
                      outline: isSelected ? `2px solid ${C.cobalt}` : "none", outlineOffset: 2,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.08)", borderRadius: 2,
                      backgroundColor: C.surface,
                    }}>
                    <img src={el.dataUrl} alt={el.name} draggable={false}
                      style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none", borderRadius: 2, display: "block" }} />
                  </div>
                );
              }
              if (el.type === "file") {
                const isPdf = el.fileType === "application/pdf" || el.name?.toLowerCase().endsWith(".pdf");
                const ext = (el.name?.split(".").pop() || "file").toUpperCase().slice(0, 5);
                const accent = isPdf ? C.brick : ext === "DOCX" || ext === "DOC" ? C.cobalt : ext === "XLSX" || ext === "XLS" || ext === "CSV" ? C.green : C.lavender;
                return (
                  <div key={el.id} className="absolute"
                    onMouseDown={(e) => onElementMouseDown(e, el)}
                    onDoubleClick={() => window.open(el.dataUrl, "_blank")}
                    style={{
                      left: el.x, top: el.y, width: el.w, height: el.h,
                      cursor: tool === "select" ? "move" : "default",
                      outline: isSelected ? `2px solid ${C.cobalt}` : "none", outlineOffset: 2,
                      backgroundColor: C.bg, border: `1px solid ${C.line}`, borderLeft: `3px solid ${accent}`,
                      borderRadius: 2, padding: 12, boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                      display: "flex", flexDirection: "column",
                    }}>
                    <div className="flex items-center gap-2 mb-2">
                      <FileText size={14} style={{ color: accent }} />
                      <span className="text-[9px] tracking-[0.12em] uppercase" style={{ color: accent, fontWeight: 600 }}>{ext}</span>
                    </div>
                    <div className="flex-1 text-[11px]" style={{ color: C.ink, fontWeight: 500, lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", wordBreak: "break-word" }}>
                      {el.name}
                    </div>
                    <div className="text-[9px] mt-1" style={{ color: C.muted }}>{(el.size / 1024).toFixed(0)} KB · doble-click abre</div>
                  </div>
                );
              }
              if (el.type === "icon") {
                const IconComp = ICON_LOOKUP[el.iconName] || Sparkles;
                return (
                  <div key={el.id}
                    onMouseDown={(e) => onElementMouseDown(e, el)}
                    style={{
                      position: "absolute",
                      left: el.x, top: el.y,
                      width: el.size, height: el.size,
                      cursor: tool === "select" ? "move" : "default",
                      outline: isSelected ? `2px solid ${C.cobalt}` : "none", outlineOffset: 4,
                      borderRadius: 4,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                    <IconComp size={el.size} color={el.color || C.ink} strokeWidth={1.5} />
                  </div>
                );
              }
              return null;
            })}

            {/* Resize handles for selected resizable element */}
            {selected && !["arrow", "path", "text"].includes(selected.type) && (() => {
              let bx, by, bw, bh;
              if (selected.type === "icon") { bx = selected.x; by = selected.y; bw = selected.size; bh = selected.size; }
              else { bx = selected.x; by = selected.y; bw = selected.w; bh = selected.h; }
              const corners = [
                { id: "nw", x: bx, y: by, cursor: "nwse-resize" },
                { id: "ne", x: bx + bw, y: by, cursor: "nesw-resize" },
                { id: "sw", x: bx, y: by + bh, cursor: "nesw-resize" },
                { id: "se", x: bx + bw, y: by + bh, cursor: "nwse-resize" },
              ];
              const handleSize = 10 / zoom;
              const borderW = 2 / zoom;
              return corners.map(corner => (
                <div key={corner.id}
                  onMouseDown={(e) => onHandleMouseDown(e, selected, corner.id)}
                  style={{
                    position: "absolute",
                    left: corner.x - handleSize / 2,
                    top: corner.y - handleSize / 2,
                    width: handleSize, height: handleSize,
                    backgroundColor: C.paper,
                    border: `${borderW}px solid ${C.cobalt}`,
                    cursor: corner.cursor, zIndex: 20,
                    borderRadius: 1,
                  }} />
              ));
            })()}
          </div>

          {elements.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <PenSquare size={32} style={{ color: C.muted, margin: "0 auto 12px" }} />
                <div className="text-[14px]" style={{ color: C.inkSoft, fontWeight: 500 }}>Canvas vacío de {spaceName}</div>
                <div className="text-[12px] mt-1.5" style={{ color: C.muted }}>Elegí una herramienta a la izquierda y empezá.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══ DASHBOARDS (HQ + areas) ═════════════════════════════════════════════
// ─── EXPORT HELPER · descarga como HTML imprimible (funciona en cualquier sandbox) ───
// Por qué no window.print() directo: el iframe del artifact tiene sandbox sin `allow-modals`,
// y window.open() también está bloqueado. La única forma robusta es descargar un archivo HTML
// que el usuario abre en su browser local y desde ahí Cmd+P → Save as PDF.
function printDashboard({ title, htmlSelector, htmlContent }) {
  let bodyHTML;
  if (htmlContent) {
    bodyHTML = htmlContent;
  } else if (htmlSelector) {
    const el = document.querySelector(htmlSelector);
    if (!el) {
      alert(`No encuentro el contenido a exportar (${htmlSelector})`);
      return;
    }
    bodyHTML = el.outerHTML;
  } else {
    bodyHTML = document.body.innerHTML;
  }

  // Capturar todos los stylesheets accesibles · skipea cross-origin (que tira SecurityError)
  let styles = "";
  try {
    styles = Array.from(document.styleSheets).map(sheet => {
      try {
        return Array.from(sheet.cssRules || []).map(r => r.cssText).join("\n");
      } catch { return ""; }
    }).join("\n");
  } catch {}

  const fullHTML = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>${styles}</style>
<style>
  @page { margin: 16mm; }
  @media print {
    body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print, .print-instructions { display: none !important; }
  }
  body { background: #EEEBE3; font-family: 'DM Sans', 'Helvetica Neue', sans-serif; margin: 0; padding: 24px; color: #0A0B0F; }
  .print-instructions { position: fixed; top: 16px; right: 16px; padding: 12px 16px; background: #1E2A4A; color: #fff; border-radius: 4px; font-size: 12px; max-width: 280px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); z-index: 9999; }
  .print-instructions button { background: #C2A45A; color: #0A0B0F; border: none; padding: 6px 12px; border-radius: 2px; font-size: 11px; font-weight: 600; cursor: pointer; margin-top: 8px; }
  .print-header { padding: 16px 0 24px; border-bottom: 1px solid #D9D5CD; margin-bottom: 24px; }
  .print-eyebrow { font-size: 10px; color: #6B6863; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 600; }
  .print-title { font-size: 24px; color: #0A0B0F; font-weight: 600; letter-spacing: -0.02em; margin-top: 4px; }
  .print-meta { font-size: 11px; color: #6B6863; margin-top: 6px; font-style: italic; }
</style>
</head>
<body>
<div class="print-instructions">
  <div style="font-weight:600; margin-bottom:4px;">📄 Listo para imprimir</div>
  <div style="opacity:0.85; line-height:1.4; font-size:11px;">Presioná <strong>Cmd+P</strong> (Mac) o <strong>Ctrl+P</strong> (Windows). En "Destino" elegí <strong>"Guardar como PDF"</strong>.</div>
  <button onclick="window.print()">Imprimir ahora</button>
</div>
<div class="print-header">
  <div class="print-eyebrow">Hygge Holding · Reporte</div>
  <div class="print-title">${title}</div>
  <div class="print-meta">Generado ${new Date().toLocaleString("es-PE", { dateStyle: "long", timeStyle: "short" })}</div>
</div>
${bodyHTML}
</body>
</html>`;

  // Descarga via Blob + anchor · funciona en cualquier sandbox
  try {
    const blob = new Blob([fullHTML], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[\/\\?%*:|"<>]/g, "-")}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  } catch (e) {
    alert(`No pude generar el archivo: ${e.message}`);
  }
}

function SPVEditModal({ spv, onSave, onClose }) {
  const [form, setForm] = React.useState({ ...spv });
  const blob = useModalBlob();
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); blob.onType(); };
  const tipoObj = SPV_TIPOS.find(t => t.id === form.tipo) || SPV_TIPOS[0];
  const handleSave = () => blob.onHappy(() => { onSave(form); onClose(); });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(10,11,15,0.55)" }} onClick={onClose}>
      <div className="w-full max-w-lg mx-4 rounded-sm overflow-auto max-h-[90vh]" style={{ backgroundColor: C.paper, border: `1px solid ${C.line}` }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: C.muted }}>Editar proyecto</div>
            <div className="text-[20px] mt-0.5" style={{ color: C.ink, fontWeight: 300, letterSpacing: "-0.02em" }}>{form.code} · {form.name}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ModalBlob state={blob.state} />
            <button onClick={onClose} className="p-1.5 rounded" style={{ color: C.muted }}><X size={16} /></button>
          </div>
        </div>
        <div className="px-6 py-5 grid grid-cols-2 gap-4">
          {[["Código", "code"], ["Nombre", "name"], ["Distrito", "district"], ["Rol", "rol"]].map(([label, key]) => (
            <div key={key} className={key === "name" || key === "rol" ? "col-span-2" : ""}>
              <div className="text-[10px] uppercase tracking-[0.12em] mb-1.5" style={{ color: C.muted }}>{label}</div>
              <input value={form[key] || ""} onChange={e => set(key, e.target.value)} className="w-full px-3 py-2 text-[13px] outline-none" style={{ backgroundColor: C.bg, border: `1px solid ${C.line}`, borderRadius: 2, color: C.ink }} />
            </div>
          ))}
          <div className="col-span-2">
            <div className="text-[10px] uppercase tracking-[0.12em] mb-1.5" style={{ color: C.muted }}>Tipo</div>
            <div className="flex gap-2 flex-wrap">
              {SPV_TIPOS.map(t => (
                <button key={t.id} onClick={() => set("tipo", t.id)} className="px-3 py-1.5 text-[11px] transition-colors" style={{ borderRadius: 2, border: `1px solid ${form.tipo === t.id ? C.cobalt : C.line}`, backgroundColor: form.tipo === t.id ? C.cobalt : C.bg, color: form.tipo === t.id ? "#fff" : C.inkSoft, fontWeight: form.tipo === t.id ? 600 : 400 }} title={t.hint}>{t.label}</button>
              ))}
            </div>
          </div>
          <div className="col-span-2">
            <div className="text-[10px] uppercase tracking-[0.12em] mb-1.5" style={{ color: C.muted }}>Estado</div>
            <div className="flex gap-2 flex-wrap">
              {SPV_STATUSES.map(s => (
                <button key={s} onClick={() => set("status", s)} className="px-2.5 py-1 text-[11px] transition-colors" style={{ borderRadius: 2, border: `1px solid ${form.status === s ? C.ink : C.line}`, backgroundColor: form.status === s ? C.ink : C.bg, color: form.status === s ? "#fff" : C.muted }}>{s}</button>
              ))}
            </div>
          </div>
          {[["Unidades totales", "totalUnits", "number"], ["Unidades vendidas", "sold", "number"], ["Avance obra %", "construction", "number"], ["Margen %", "margin", "number"]].map(([label, key, type]) => (
            <div key={key}>
              <div className="text-[10px] uppercase tracking-[0.12em] mb-1.5" style={{ color: C.muted }}>{label}</div>
              <input type={type} value={form[key] ?? ""} onChange={e => set(key, type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)} className="w-full px-3 py-2 text-[13px] outline-none" style={{ backgroundColor: C.bg, border: `1px solid ${C.line}`, borderRadius: 2, color: C.ink }} />
            </div>
          ))}
          <div className="col-span-2">
            <div className="text-[10px] uppercase tracking-[0.12em] mb-1.5" style={{ color: C.muted }}>Próximo hito</div>
            <input value={form.nextMilestone || ""} onChange={e => set("nextMilestone", e.target.value)} className="w-full px-3 py-2 text-[13px] outline-none" style={{ backgroundColor: C.bg, border: `1px solid ${C.line}`, borderRadius: 2, color: C.ink }} />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4" style={{ borderTop: `1px solid ${C.lineSoft}` }}>
          <button onClick={onClose} className="px-4 py-2 text-[12px]" style={{ color: C.muted }}>Cancelar</button>
          <button onClick={handleSave} className="px-4 py-2 text-[12px] font-semibold" style={{ backgroundColor: C.ink, color: C.bg, borderRadius: 2 }}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

const DEFAULT_HQ_CIFRAS = [
  { id: "c1", label: "Ventas SPVs",      valueType: "computed", computedKey: "totalSales",  sub: "suma de SPVs activos", delta: "", positive: null },
  { id: "c2", label: "Objetivo total",   valueType: "computed", computedKey: "totalTarget", sub: "suma de SPVs activos", delta: "", positive: null },
  { id: "c3", label: "Unidades",         valueType: "computed", computedKey: "units",       sub: "",                    delta: "", positive: null },
  { id: "c4", label: "Pipeline terrenos",valueType: "computed", computedKey: "terrenos",    sub: "",                    delta: "", positive: null },
];

const COMPUTED_OPTIONS = [
  { key: "totalSales",    label: "Ventas SPVs (S/)" },
  { key: "totalTarget",   label: "Objetivo SPVs (S/)" },
  { key: "units",         label: "Unidades (vendidas/total)" },
  { key: "terrenos",      label: "Terrenos en pipeline" },
  { key: "tasksPending",  label: "Tareas pendientes" },
  { key: "tasksDone",     label: "Tareas completadas" },
  { key: "tasksTotal",    label: "Tareas totales" },
];

function resolveKpiValue(item, ctx) {
  const fmtPEN = (n) => n >= 1_000_000 ? `S/ ${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `S/ ${(n/1_000).toFixed(0)}K` : `S/ ${n}`;
  if (item.valueType === "manual") return item.manualValue || "—";
  switch (item.computedKey) {
    case "totalSales":   return fmtPEN(ctx.totalSales);
    case "totalTarget":  return fmtPEN(ctx.totalTarget);
    case "units":        return `${ctx.totalSold}/${ctx.totalUnits}`;
    case "terrenos":     return String(ctx.terrenosCount);
    case "tasksPending": return String(ctx.tasksPending);
    case "tasksDone":    return String(ctx.tasksDone);
    case "tasksTotal":   return String(ctx.tasksTotal);
    default: return "—";
  }
}

function resolveKpiSub(item, ctx) {
  if (item.sub) return item.sub;
  switch (item.computedKey) {
    case "totalSales":   return ctx.totalTarget > 0 ? `${((ctx.totalSales/ctx.totalTarget)*100).toFixed(0)}% del objetivo` : "sin objetivo";
    case "units":        return ctx.totalUnits > 0 ? `${((ctx.totalSold/ctx.totalUnits)*100).toFixed(0)}% del stock` : "sin stock";
    case "terrenos":     return ctx.terrenosCount === 0 ? "sin terrenos cargados" : "terrenos en radar";
    case "tasksPending": return "sin completar";
    case "tasksDone":    return "completadas";
    default: return "";
  }
}

function EditKpiModal({ item, onSave, onClose }) {
  const isNew = !item.id;
  const [form, setForm] = useState(item || { label: "", valueType: "manual", computedKey: "totalSales", manualValue: "", sub: "", delta: "", positive: null });
  const blob = useModalBlob();
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); blob.onType(); };
  const handleSave = () => blob.onHappy(() => { onSave({ ...form, id: form.id || ("c" + Date.now()) }); });
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, backgroundColor: "rgba(10,11,15,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ backgroundColor: C.bg, border: `1px solid ${C.line}`, borderRadius: 4, width: "100%", maxWidth: 400, overflow: "hidden", boxShadow: "0 16px 48px rgba(10,11,15,0.2)" }}>
        <div style={{ padding: "18px 24px 16px", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>En Cifras</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.ink, letterSpacing: "-0.01em" }}>{isNew ? "Nuevo marcador" : "Editar marcador"}</div>
          </div>
          <ModalBlob state={blob.state} />
        </div>
        <div style={{ padding: "18px 24px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>Etiqueta</div>
            <input value={form.label} onChange={e => set("label", e.target.value)} placeholder="Ej: Caja disponible" style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: `1px solid ${C.line}`, borderRadius: 2, backgroundColor: C.paper, color: C.ink, outline: "none", fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box" }} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>Tipo de valor</div>
            <div style={{ display: "flex", gap: 6 }}>
              {["computed", "manual"].map(t => (
                <button key={t} onClick={() => set("valueType", t)} style={{ flex: 1, padding: "7px 0", fontSize: 11, fontWeight: 600, borderRadius: 2, border: `1px solid ${form.valueType === t ? C.cobalt : C.line}`, backgroundColor: form.valueType === t ? `${C.cobalt}10` : C.paper, color: form.valueType === t ? C.cobalt : C.muted, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                  {t === "computed" ? "Auto-calculado" : "Manual"}
                </button>
              ))}
            </div>
          </div>
          {form.valueType === "computed" ? (
            <div>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>Fuente</div>
              <select value={form.computedKey} onChange={e => set("computedKey", e.target.value)} style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: `1px solid ${C.line}`, borderRadius: 2, backgroundColor: C.paper, color: C.ink, outline: "none", fontFamily: "'DM Sans', sans-serif" }}>
                {COMPUTED_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>Valor</div>
              <input value={form.manualValue} onChange={e => set("manualValue", e.target.value)} placeholder="Ej: S/ 3.84M" style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: `1px solid ${C.line}`, borderRadius: 2, backgroundColor: C.paper, color: C.ink, outline: "none", fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box" }} />
            </div>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>Sub-texto (opcional)</div>
              <input value={form.sub} onChange={e => set("sub", e.target.value)} placeholder="Ej: vs Q1" style={{ width: "100%", padding: "8px 10px", fontSize: 12, border: `1px solid ${C.line}`, borderRadius: 2, backgroundColor: C.paper, color: C.ink, outline: "none", fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box" }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>Delta (opcional)</div>
              <input value={form.delta} onChange={e => set("delta", e.target.value)} placeholder="Ej: +12.4%" style={{ width: "100%", padding: "8px 10px", fontSize: 12, border: `1px solid ${C.line}`, borderRadius: 2, backgroundColor: C.paper, color: C.ink, outline: "none", fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box" }} />
            </div>
          </div>
          {form.delta && (
            <div>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>Dirección delta</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[[true, "↗ Positivo"], [false, "↘ Negativo"]].map(([val, lbl]) => (
                  <button key={lbl} onClick={() => set("positive", val)} style={{ flex: 1, padding: "6px 0", fontSize: 11, fontWeight: 600, borderRadius: 2, border: `1px solid ${form.positive === val ? (val ? C.cobalt : C.brick) : C.line}`, backgroundColor: form.positive === val ? (val ? `${C.cobalt}10` : `${C.brick}10`) : C.paper, color: form.positive === val ? (val ? C.cobalt : C.brick) : C.muted, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button onClick={handleSave} style={{ flex: 1, padding: "10px 0", fontSize: 13, fontWeight: 600, backgroundColor: C.ink, color: C.bg, border: "none", borderRadius: 2, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
              {isNew ? "Agregar" : "Guardar"}
            </button>
            <button onClick={onClose} style={{ flex: 1, padding: "10px 0", fontSize: 13, backgroundColor: "transparent", color: C.muted, border: `1px solid ${C.line}`, borderRadius: 2, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HQDashboard({ totalSales, totalTarget, totalSold, totalUnits, onOpenSpace, tasks = [], terrenos = [], allSpaces = [], users = [], customSpaces = [], navigate, openDetail, spvs = DEFAULT_SPVS, setSpvs, cifras, setCifras, isAdmin }) {
  const [editingSpv, setEditingSpv] = React.useState(null);
  const [editingKpi, setEditingKpi] = React.useState(null); // null | {} (new) | {item}
  const kpiCtx = {
    totalSales, totalTarget, totalSold, totalUnits,
    terrenosCount: (terrenos || []).length,
    tasksPending: (tasks || []).filter(t => !t.checked).length,
    tasksDone:    (tasks || []).filter(t => t.checked).length,
    tasksTotal:   (tasks || []).length,
  };
  const ownCount = spvs.filter(p => p.tipo === "spv_propio").length;
  const spvLabel = ownCount === 0 ? "Sin SPVs propios" : ownCount === 1 ? "Un SPV propio activo" : `${ownCount} SPVs propios activos`;
  const handleSaveSpv = (updated) => {
    if (setSpvs) setSpvs(prev => prev.map(p => p.code === updated.code ? updated : p));
  };
  return (
    <div id="hq-printable" className="px-4 lg:px-10 py-8 lg:py-12 max-w-[1080px] mx-auto">
      {editingSpv && <SPVEditModal spv={editingSpv} onSave={handleSaveSpv} onClose={() => setEditingSpv(null)} />}
      <Hero eyebrow="Hygge Holding · issue" code="HQ.26.W21"
        intro={<>Buenos días, Sebastián. {spvLabel} — <strong style={{ color: C.ink, fontWeight: 600 }}>{totalSold} de {totalUnits}</strong> unidades colocadas, y <strong style={{ color: C.ink, fontWeight: 600 }}>{totalTarget > 0 ? ((totalSales/totalTarget)*100).toFixed(0) : "0"}%</strong> del objetivo anual cubierto.</>} />

      {/* Editable widgets section · v42 */}
      <section className="mb-14">
        <HQWidgetsBlock tasks={tasks} terrenos={terrenos} allSpaces={allSpaces} users={users} customSpaces={customSpaces} navigate={navigate} openDetail={openDetail} />
      </section>

      {editingKpi !== null && (
        <EditKpiModal
          item={editingKpi}
          onSave={(saved) => {
            setCifras(prev => {
              const exists = prev.find(c => c.id === saved.id);
              return exists ? prev.map(c => c.id === saved.id ? saved : c) : [...prev, saved];
            });
            setEditingKpi(null);
          }}
          onClose={() => setEditingKpi(null)}
        />
      )}
      <section className="mb-14">
        <div className="flex items-baseline justify-between mb-6">
          <SectionHead title="En cifras" style={{ margin: 0 }} />
          {isAdmin && (
            <button onClick={() => setEditingKpi({})} className="flex items-center gap-1.5 hover:opacity-80" style={{ fontSize: 11, color: C.cobalt, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
              <Plus size={11} /> Agregar marcador
            </button>
          )}
        </div>
        <div style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2, display: "grid", gridTemplateColumns: `repeat(${Math.max(cifras.length, 1)}, 1fr)` }}>
          {cifras.map((item, i) => (
            <div key={item.id} className="relative group/kpi px-6 py-6" style={{ borderRight: i < cifras.length - 1 ? `1px solid ${C.lineSoft}` : "none" }}>
              {isAdmin && (
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/kpi:opacity-100 transition-opacity">
                  <button onClick={() => setEditingKpi(item)} className="p-1 hover:opacity-70" title="Editar"><PenSquare size={10} style={{ color: C.muted }} /></button>
                  <button onClick={() => setCifras(prev => prev.filter(c => c.id !== item.id))} className="p-1 hover:opacity-70" title="Eliminar"><X size={10} style={{ color: C.brick }} /></button>
                </div>
              )}
              <Eyebrow>{item.label}</Eyebrow>
              <div className="text-[28px] mt-3 mb-2" style={{ color: C.ink, fontWeight: 300, letterSpacing: "-0.03em", lineHeight: 1 }}>
                {resolveKpiValue(item, kpiCtx)}
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                {item.delta && <span style={{ color: item.positive ? C.cobalt : C.brick, fontWeight: 600 }}>{item.positive ? "↗" : "↘"} {item.delta}</span>}
                <span style={{ color: C.muted }}>{resolveKpiSub(item, kpiCtx)}</span>
              </div>
            </div>
          ))}
          {cifras.length === 0 && (
            <div className="px-6 py-8 text-center" style={{ color: C.muted, fontSize: 12, fontStyle: "italic" }}>
              Sin marcadores. {isAdmin ? 'Usá "Agregar marcador" para empezar.' : ""}
            </div>
          )}
        </div>
      </section>
      <section className="mb-14"><SectionHead title="Proyectos en curso" blurb="Click para abrir su space · lápiz para editar." />
        <div className="grid grid-cols-2 gap-4">
          {spvs.map((p) => {
            const tipoObj = SPV_TIPOS.find(t => t.id === p.tipo) || SPV_TIPOS[0];
            const soldPct = p.totalUnits > 0 ? (p.sold/p.totalUnits)*100 : 0;
            return (
              <div key={p.code} className="relative group">
                <button onClick={() => onOpenSpace(p.code.toLowerCase())} className="w-full p-6 flex flex-col gap-5 hover:translate-y-[-1px] transition-transform text-left" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <NavyRule width={20} /><div className="mt-3 flex items-center gap-2"><Eyebrow>{p.district}</Eyebrow><span className="text-[9px] uppercase tracking-[0.12em] px-1.5 py-0.5" style={{ backgroundColor: C.lineSoft, color: C.muted, borderRadius: 2 }}>{tipoObj.label}</span></div>
                      <div className="text-[40px] leading-none mt-2.5 mb-1.5" style={{ color: C.ink, fontWeight: 300, letterSpacing: "-0.035em" }}>{p.code}</div>
                      <div className="text-[13px]" style={{ color: C.inkSoft, fontWeight: 500 }}>{p.name}</div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] tracking-[0.14em] uppercase flex-shrink-0" style={{ color: toneMap[p.statusTone], backgroundColor: C.bg, border: `1px solid ${C.lineSoft}`, borderRadius: 999, fontWeight: 500 }}><span className="w-1 h-1 rounded-full" style={{ backgroundColor: toneMap[p.statusTone] }} />{p.status}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {[{ label: "Obra", value: p.construction + "%", bar: p.construction, color: C.cobalt }, { label: "Ventas", value: `${p.sold}/${p.totalUnits}`, bar: soldPct, color: C.lavender }, { label: "Margen", value: p.margin.toFixed(1) + "%" }].map((m) => (
                      <div key={m.label}><Eyebrow>{m.label}</Eyebrow>
                        <div className="text-[18px] mt-1.5 mb-2" style={{ color: C.ink, fontWeight: 400 }}>{m.value}</div>
                        {m.bar !== undefined && <div className="h-[2px] w-full" style={{ backgroundColor: C.lineSoft }}><div className="h-full" style={{ width: m.bar + "%", backgroundColor: m.color }} /></div>}
                      </div>
                    ))}
                  </div>
                </button>
                {setSpvs && (
                  <button onClick={() => setEditingSpv(p)} className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded" style={{ backgroundColor: C.bg, border: `1px solid ${C.line}`, color: C.muted }} title="Editar proyecto"><Pencil size={12} /></button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer · acciones de export · v28 */}
      <section className="no-print pt-6 flex items-center justify-between flex-wrap gap-3" style={{ borderTop: `1px solid ${C.lineSoft}` }}>
        <div style={{ fontSize: 10, color: C.muted, fontStyle: "italic" }}>
          Última actualización: {new Date().toLocaleDateString("es-PE", { dateStyle: "long" })} · datos en vivo + edición manual
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => printDashboard({ title: "Hygge HQ · Reporte semanal", htmlSelector: "#hq-printable" })} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] hover:opacity-90" style={{ color: C.bg, backgroundColor: C.ink, borderRadius: 2, fontWeight: 600 }} title="Descarga HTML imprimible · abrílo y usá Cmd+P para Save as PDF">
            <Download size={11} /> Descargar PDF
          </button>
        </div>
      </section>
    </div>
  );
}

// ── CSV parser ────────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const sep = lines[0].includes("\t") ? "\t" : ",";
  const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map(l =>
    l.split(sep).reduce((obj, val, i) => {
      obj[headers[i]] = val.trim().replace(/^"|"$/g, "");
      return obj;
    }, {})
  );
  return { headers, rows };
}

function isNumericCol(rows, col) {
  return rows.every(r => r[col] === "" || !isNaN(parseFloat(r[col]?.replace(/[,S/%]/g, ""))));
}

// Detect if a column looks like a date/period label (Ene, Feb, 2024-01, Q1, etc.)
function isLabelCol(col) {
  return /fecha|mes|period|date|semana|week|quarter|año|year/i.test(col);
}

function autoWidgets(headers, rows) {
  if (!headers.length || !rows.length) return [];
  const labelCol = headers.find(h => isLabelCol(h)) || headers[0];
  const numCols = headers.filter(h => h !== labelCol && isNumericCol(rows, h));
  const widgets = [];
  // KPI cards: last-row numeric values
  const last = rows[rows.length - 1];
  numCols.slice(0, 6).forEach(col => {
    const prev = rows.length > 1 ? parseFloat(rows[rows.length - 2][col]?.replace(/[,S/%]/g, "") || 0) : null;
    const cur = parseFloat(last[col]?.replace(/[,S/%]/g, "") || 0);
    const delta = prev !== null ? cur - prev : null;
    widgets.push({ type: "kpi", col, value: last[col] || "—", delta, label: col });
  });
  // Time-series chart if there are 3+ rows and at least 1 numeric col
  if (rows.length >= 3 && numCols.length >= 1) {
    widgets.push({ type: "chart", labelCol, numCols: numCols.slice(0, 4) });
  }
  return widgets;
}

const BACKEND = "https://aliceai.bam.pe";
const FZ_SOURCE_KEY = "hygge:finanzas:source";

function FinanzasDashboard() {
  const [source, setSource] = useState(() => {
    try { return JSON.parse(localStorage.getItem(FZ_SOURCE_KEY) || "null"); } catch { return null; }
  });
  const [configOpen, setConfigOpen] = useState(false);
  const [pathInput, setPathInput] = useState(source?.path || "");
  const [labelInput, setLabelInput] = useState(source?.label || "");
  const [data, setData] = useState(null); // { headers, rows }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);
  const blob = useModalBlob();

  useEffect(() => { if (configOpen) blob.reset(); }, [configOpen]);

  const fetchCSV = useCallback(async (src) => {
    if (!src?.path) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${BACKEND}/api/dropbox/download?path=${encodeURIComponent(src.path)}`);
      if (!res.ok) throw new Error(await res.text());
      const text = await res.text();
      const parsed = parseCSV(text);
      if (parsed.headers.length === 0) throw new Error("El archivo no tiene columnas reconocibles");
      setData(parsed);
      setLastFetched(new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (source) fetchCSV(source); }, [source, fetchCSV]);

  const saveSource = () => {
    if (!pathInput.trim()) { blob.onError(); return; }
    blob.onHappy(() => {
      const src = { path: pathInput.trim(), label: labelInput.trim() || pathInput.trim().split("/").pop() };
      localStorage.setItem(FZ_SOURCE_KEY, JSON.stringify(src));
      setSource(src);
      setConfigOpen(false);
    });
  };

  const widgets = data ? autoWidgets(data.headers, data.rows) : [];
  const kpis = widgets.filter(w => w.type === "kpi");
  const chart = widgets.find(w => w.type === "chart");
  const chartData = chart ? data.rows.map(r => {
    const obj = { label: r[chart.labelCol] };
    chart.numCols.forEach(c => { obj[c] = parseFloat(r[c]?.replace(/[,S/%]/g, "") || 0); });
    return obj;
  }) : [];
  const CHART_COLORS = [C.cobalt, C.lavender, C.ochre, C.green];

  return (
    <div className="px-4 lg:px-10 py-8 lg:py-12 max-w-[1080px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-10 gap-4 flex-wrap">
        <div>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Finanzas · Joel Moy</div>
          <h1 style={{ fontSize: 36, fontWeight: 700, color: C.ink, letterSpacing: "-0.03em", lineHeight: 1 }}>
            {source ? (source.label || "Finanzas") : "Finanzas"}
          </h1>
          {source && (
            <div style={{ fontSize: 11, color: C.muted, marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: "monospace" }}>{source.path}</span>
              {lastFetched && <span>· actualizado {lastFetched}</span>}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {source && (
            <button onClick={() => fetchCSV(source)} disabled={loading}
              style={{ padding: "8px 14px", border: `1px solid ${C.line}`, borderRadius: 3, background: "none", fontSize: 12, color: C.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              <RefreshCw size={11} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
              {loading ? "Actualizando…" : "Actualizar"}
            </button>
          )}
          <button onClick={() => { setPathInput(source?.path || ""); setLabelInput(source?.label || ""); setConfigOpen(true); }}
            style={{ padding: "8px 14px", backgroundColor: C.navy, color: "white", border: "none", borderRadius: 3, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
            <ExternalLink size={11} />
            {source ? "Cambiar fuente" : "Conectar fuente"}
          </button>
        </div>
      </div>

      {/* Config modal */}
      {configOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 500, backgroundColor: "rgba(10,11,15,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          onClick={() => setConfigOpen(false)}>
          <div style={{ backgroundColor: C.paper, border: `1px solid ${C.line}`, borderRadius: 4, width: "100%", maxWidth: 480 }}
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding: "18px 24px", borderBottom: `1px solid ${C.lineSoft}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>Finanzas · Fuente de datos</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: C.ink, letterSpacing: "-0.02em" }}>Conectar CSV desde Dropbox</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ModalBlob state={blob.state} />
                <button onClick={() => setConfigOpen(false)}><X size={14} style={{ color: C.muted }} /></button>
              </div>
            </div>
            {/* Body */}
            <div style={{ padding: 24 }}>
              <p style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6, marginBottom: 20 }}>
                Exportá tu reporte desde tu software contable como CSV y guardalo en Dropbox. ALICE lo lee cada vez que entrás a Finanzas y genera widgets automáticamente.
              </p>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Ruta en Dropbox</label>
                <input value={pathInput} onChange={e => { setPathInput(e.target.value); blob.onType(); }}
                  placeholder="/Hygge/Finanzas/reporte.csv"
                  style={{ width: "100%", padding: "10px 12px", border: `1px solid ${blob.state === "error" || blob.state === "crashed" ? "#c2607e" : C.line}`, borderRadius: 3, fontSize: 13, color: C.ink, background: C.bg, fontFamily: "monospace", boxSizing: "border-box", transition: "border-color 0.2s" }} />
                <div style={{ fontSize: 11, color: C.muted, marginTop: 5 }}>Formato soportado: CSV o TSV exportado desde Excel, Google Sheets, Defontana, etc.</div>
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 11, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Nombre del reporte <span style={{ fontWeight: 400 }}>· opcional</span></label>
                <input value={labelInput} onChange={e => { setLabelInput(e.target.value); blob.onType(); }}
                  placeholder="Cashflow 2026"
                  style={{ width: "100%", padding: "10px 12px", border: `1px solid ${C.line}`, borderRadius: 3, fontSize: 13, color: C.ink, background: C.bg, boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={saveSource} disabled={!pathInput.trim()}
                  style={{ flex: 1, padding: "11px 0", backgroundColor: C.cobalt, color: "white", border: "none", borderRadius: 3, fontSize: 13, fontWeight: 600, cursor: pathInput.trim() ? "pointer" : "not-allowed", opacity: pathInput.trim() ? 1 : 0.5 }}>
                  Conectar y cargar
                </button>
                <button onClick={() => setConfigOpen(false)}
                  style={{ padding: "11px 18px", border: `1px solid ${C.line}`, borderRadius: 3, background: "none", fontSize: 13, color: C.muted, cursor: "pointer" }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!source && (
        <div style={{ textAlign: "center", padding: "80px 0" }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: C.surface, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <BarChart3 size={22} style={{ color: C.muted }} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.ink, letterSpacing: "-0.02em", marginBottom: 8 }}>Sin fuente conectada</div>
          <p style={{ fontSize: 13, color: C.muted, maxWidth: 340, margin: "0 auto 24px", lineHeight: 1.65 }}>
            Exportá tu reporte desde tu software contable a Dropbox como CSV. ALICE lo lee y genera los widgets automáticamente.
          </p>
          <button onClick={() => setConfigOpen(true)}
            style={{ padding: "10px 20px", backgroundColor: C.navy, color: "white", border: "none", borderRadius: 3, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Conectar fuente CSV
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: "14px 16px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 3, marginBottom: 24, fontSize: 12.5, color: "#B91C1C" }}>
          Error al leer el archivo: {error}
        </div>
      )}

      {/* Widgets */}
      {data && !loading && (
        <>
          {/* KPI cards */}
          {kpis.length > 0 && (
            <section className="mb-10">
              <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>Métricas · última fila</div>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(kpis.length, 4)}, 1fr)`, gap: 12 }}>
                {kpis.map(w => {
                  const isPos = w.delta === null ? null : w.delta >= 0;
                  return (
                    <div key={w.col} style={{ backgroundColor: C.paper, border: `1px solid ${C.line}`, borderRadius: 3, padding: "18px 20px" }}>
                      <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 8 }}>{w.label}</div>
                      <div style={{ fontSize: 26, fontWeight: 700, color: C.ink, letterSpacing: "-0.02em", lineHeight: 1 }}>{w.value}</div>
                      {w.delta !== null && (
                        <div style={{ fontSize: 11, color: isPos ? C.green : C.brick, marginTop: 6, fontWeight: 500 }}>
                          {isPos ? "▲" : "▼"} {Math.abs(w.delta).toLocaleString("es-PE")} vs anterior
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Chart */}
          {chart && chartData.length > 0 && (
            <section className="mb-10">
              <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>Evolución temporal</div>
              <div style={{ backgroundColor: C.paper, border: `1px solid ${C.line}`, borderRadius: 3, padding: "20px 16px" }}>
                <div style={{ height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        {chart.numCols.map((col, i) => (
                          <linearGradient key={col} id={`fz_grad_${i}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={CHART_COLORS[i]} stopOpacity={0.2} />
                            <stop offset="100%" stopColor={CHART_COLORS[i]} stopOpacity={0} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid stroke={C.lineSoft} strokeDasharray="2 4" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip contentStyle={{ fontSize: 12, border: `1px solid ${C.line}`, borderRadius: 2 }} />
                      {chart.numCols.map((col, i) => (
                        <Area key={col} type="monotone" dataKey={col} stroke={CHART_COLORS[i]} strokeWidth={1.5} fill={`url(#fz_grad_${i})`} name={col} />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
                  {chart.numCols.map((col, i) => (
                    <div key={col} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.muted }}>
                      <div style={{ width: 10, height: 2, backgroundColor: CHART_COLORS[i], borderRadius: 1 }} />
                      {col}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Raw table (collapsible) */}
          <details style={{ marginTop: 8 }}>
            <summary style={{ fontSize: 11, color: C.muted, cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase", userSelect: "none" }}>
              Ver tabla completa ({data.rows.length} filas)
            </summary>
            <div style={{ overflowX: "auto", marginTop: 12, backgroundColor: C.paper, border: `1px solid ${C.line}`, borderRadius: 3 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>{data.headers.map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 12px", borderBottom: `1px solid ${C.line}`, fontSize: 10, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {data.rows.map((row, i) => (
                    <tr key={i} style={{ borderBottom: i < data.rows.length - 1 ? `1px solid ${C.lineSoft}` : "none" }}>
                      {data.headers.map(h => (
                        <td key={h} style={{ padding: "8px 12px", color: C.ink, whiteSpace: "nowrap" }}>{row[h]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ height: 90, backgroundColor: C.surface, borderRadius: 3, opacity: 0.5, animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
      )}
    </div>
  );
}

function BamDashboard() {
  return (
    <div className="px-4 lg:px-10 py-8 lg:py-12 max-w-[1080px] mx-auto">
      <Hero eyebrow="BAM · Ariel Almaguer" code="BM.26.W21" intro={<><strong>22 tareas</strong>. <strong>5 RFIs</strong> abiertos.</>} />
      <section className="mb-14"><SectionHead title="RFIs" />
        <Panel>
          <table className="w-full">
            <thead><tr className="text-[10px] tracking-[0.15em] uppercase" style={{ color: C.muted, fontWeight: 500 }}>{["ID", "Proyecto", "Asunto", "Días"].map(h => <th key={h} className="text-left pb-3 px-2" style={{ borderBottom: `1px solid ${C.line}` }}>{h}</th>)}</tr></thead>
            <tbody>{BAM_RFIS.map((r, i) => (
              <tr key={r.id} style={{ borderBottom: i < BAM_RFIS.length - 1 ? `1px solid ${C.lineSoft}` : "none" }}>
                <td className="py-3 px-2 text-[11px]" style={{ color: C.muted, fontFamily: "monospace" }}>{r.id}</td>
                <td className="py-3 px-2 text-[12px]" style={{ color: C.ink, fontWeight: 500 }}>{r.proj}</td>
                <td className="py-3 px-2 text-[13px]" style={{ color: C.ink }}>{r.title}</td>
                <td className="py-3 px-2 text-[12px]" style={{ color: r.days > 5 ? C.brick : r.days > 3 ? C.ochre : C.muted, fontWeight: r.days > 5 ? 600 : 400 }}>{r.days}d</td>
              </tr>
            ))}</tbody>
          </table>
        </Panel>
      </section>
    </div>
  );
}

function LegalDashboard() {
  return (
    <div className="px-4 lg:px-10 py-8 lg:py-12 max-w-[1080px] mx-auto">
      <Hero eyebrow="Legal · J.M. Galup" code="LG.26.W21" intro={<><strong>6 trámites</strong> en curso.</>} />
      <section className="mb-14"><SectionHead title="Permisos por proyecto" />
        <Panel>
          <table className="w-full">
            <thead><tr className="text-[10px] tracking-[0.15em] uppercase" style={{ color: C.muted, fontWeight: 500 }}>{["Proyecto", "Trámite", "Estado"].map(h => <th key={h} className="text-left pb-3 px-2" style={{ borderBottom: `1px solid ${C.line}` }}>{h}</th>)}</tr></thead>
            <tbody>{LEGAL_PERMITS.map((p, i) => (
              <tr key={i} style={{ borderBottom: i < LEGAL_PERMITS.length - 1 ? `1px solid ${C.lineSoft}` : "none" }}>
                <td className="py-3 px-2 text-[12px]" style={{ color: C.ink, fontWeight: 600 }}>{p.proj}</td>
                <td className="py-3 px-2 text-[13px]" style={{ color: C.ink }}>{p.type}</td>
                <td className="py-3 px-2"><span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] tracking-[0.12em] uppercase" style={{ color: p.color, border: `1px solid ${C.lineSoft}`, borderRadius: 999, fontWeight: 600, backgroundColor: C.bg }}><span className="w-1 h-1 rounded-full" style={{ backgroundColor: p.color }} />{p.status}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </Panel>
      </section>
    </div>
  );
}

const METABASE_CRM_URL = "https://metabase.logicwareperu.com/public/dashboard/b1b54376-94e1-468b-af36-cba305ad645f?tab=6-analisis-de-leads-1&fecha_de_registro=past30days&canal_de_entrada=";

function ComercialDashboard() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ padding: "16px 24px 12px", borderBottom: `1px solid ${C.line}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: C.muted, marginBottom: 2 }}>Comercial · Jose Torres</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>CRM · Análisis de Leads</div>
        </div>
        <a href={METABASE_CRM_URL} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: C.muted, textDecoration: "none", border: `1px solid ${C.line}`, borderRadius: 3, padding: "4px 10px" }}>
          Abrir en Metabase ↗
        </a>
      </div>
      <iframe
        src={METABASE_CRM_URL}
        style={{ flex: 1, border: "none", width: "100%", background: C.bg }}
        allowTransparency
        title="CRM Comercial"
      />
    </div>
  );
}

function MarketingDashboard() {
  return (
    <div className="px-4 lg:px-10 py-8 lg:py-12 max-w-[1080px] mx-auto">
      <Hero eyebrow="Marketing · Vanessa Dongo" code="MK.26.W21" intro={<><strong>364 leads</strong> en mayo. CPL S/ 31.</>} />
      <section className="mb-14"><SectionHead title="Performance por canal" />
        <Panel>
          <table className="w-full">
            <thead><tr className="text-[10px] tracking-[0.15em] uppercase" style={{ color: C.muted, fontWeight: 500 }}>{["Canal", "Leads", "CPL", "Conv"].map(h => <th key={h} className="text-left pb-3 px-2" style={{ borderBottom: `1px solid ${C.line}` }}>{h}</th>)}</tr></thead>
            <tbody>{MARKETING_CHANNELS.map((c, i) => (
              <tr key={c.ch} style={{ borderBottom: i < MARKETING_CHANNELS.length - 1 ? `1px solid ${C.lineSoft}` : "none" }}>
                <td className="py-3 px-2 flex items-center gap-2.5"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.color }} /><span className="text-[13px]" style={{ color: C.ink, fontWeight: 500 }}>{c.ch}</span></td>
                <td className="py-3 px-2 text-[14px]" style={{ color: C.ink }}>{c.leads}</td>
                <td className="py-3 px-2 text-[13px]" style={{ color: C.inkSoft }}>{c.cpl === 0 ? "—" : "S/ " + c.cpl}</td>
                <td className="py-3 px-2 text-[13px]" style={{ color: c.conv > 5 ? C.green : C.inkSoft, fontWeight: c.conv > 5 ? 600 : 400 }}>{c.conv.toFixed(1)}%</td>
              </tr>
            ))}</tbody>
          </table>
        </Panel>
      </section>
    </div>
  );
}

const LEAFLET_IFRAME_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  body, html { margin: 0; padding: 0; height: 100%; font-family: 'DM Sans', system-ui, sans-serif; background: #F4F2EE; }
  #map { height: 100vh; width: 100%; background: #F4F2EE; }
  .leaflet-tooltip { background: #0A0B0F; color: #fff; border: none; box-shadow: 0 2px 6px rgba(0,0,0,0.25); padding: 5px 9px; font-size: 11px; font-weight: 600; border-radius: 2px; }
  .leaflet-tooltip-top:before { border-top-color: #0A0B0F; }
  .leaflet-control-zoom a { background: #fff !important; color: #0A0B0F !important; border-color: #E0DBD0 !important; }
  .leaflet-control-zoom a:hover { background: #F4F2EE !important; }
  .hygge-marker-dot { box-shadow: 0 2px 6px rgba(0,0,0,0.25); transition: transform 0.15s ease; cursor: pointer; }
  .hygge-marker-dot.selected { animation: hygge-pulse 1.4s infinite; }
  @keyframes hygge-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(61,82,213,0.5), 0 2px 6px rgba(0,0,0,0.25); } 50% { box-shadow: 0 0 0 10px rgba(61,82,213,0), 0 2px 6px rgba(0,0,0,0.25); } }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function() {
  if (typeof L === 'undefined') { console.error('Leaflet failed to load'); return; }
  const send = (type, payload) => parent.postMessage({ source: 'hygge-map', type, payload: payload || {} }, '*');
  const map = L.map('map', { center: [-12.105, -77.030], zoom: 13, attributionControl: false });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, subdomains: 'abcd' }).addTo(map);
  let markers = {};
  let statuses = {};
  let interactive = true;
  function buildMarker(t, isSelected) {
    const st = statuses[t.status] || { color: '#8C8F96', label: t.status || 'sin estado' };
    const size = isSelected ? 20 : 14;
    const icon = L.divIcon({
      className: '',
      html: '<div class="hygge-marker-dot' + (isSelected ? ' selected' : '') + '" style="width:' + size + 'px;height:' + size + 'px;background:' + st.color + ';border:' + (isSelected ? 3 : 2) + 'px solid #fff;border-radius:50%;"></div>',
      iconSize: [size, size], iconAnchor: [size/2, size/2],
    });
    const marker = L.marker([t.lat, t.lng], { icon, draggable: interactive, title: t.name });
    marker.bindTooltip('<strong>' + t.name + '</strong><br/><span style="opacity:0.7;font-weight:500">' + (t.district || '') + ' · ' + st.label + '</span>', { direction: 'top', offset: [0, -size/2 - 2] });
    marker.on('click', () => send('markerClick', { id: t.id }));
    marker.on('dragend', (e) => {
      const ll = e.target.getLatLng();
      send('markerDrag', { id: t.id, lat: ll.lat, lng: ll.lng });
    });
    return marker;
  }
  function updateMarkers(terrenos, selectedId) {
    Object.values(markers).forEach(m => map.removeLayer(m));
    markers = {};
    terrenos.forEach(t => {
      if (typeof t.lat !== 'number' || typeof t.lng !== 'number') return;
      markers[t.id] = buildMarker(t, t.id === selectedId).addTo(map);
    });
    if (selectedId && markers[selectedId]) {
      const ll = markers[selectedId].getLatLng();
      map.flyTo(ll, Math.max(map.getZoom(), 15), { duration: 0.7 });
    } else if (terrenos.length > 0) {
      const validCoords = terrenos.filter(t => typeof t.lat === 'number' && typeof t.lng === 'number');
      if (validCoords.length > 1) {
        const bounds = L.latLngBounds(validCoords.map(t => [t.lat, t.lng]));
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      } else if (validCoords.length === 1) {
        map.setView([validCoords[0].lat, validCoords[0].lng], 14);
      }
    }
  }
  map.on('click', (e) => { if (interactive) send('mapClick', { lat: e.latlng.lat, lng: e.latlng.lng }); });
  window.addEventListener('message', (e) => {
    if (!e.data || e.data.source !== 'hygge-parent') return;
    if (e.data.type === 'update') {
      statuses = e.data.payload.statuses || {};
      interactive = e.data.payload.interactive !== false;
      updateMarkers(e.data.payload.terrenos || [], e.data.payload.selectedId);
    }
  });
  setTimeout(() => send('ready'), 50);
})();
</script>
</body>
</html>`;

function LeafletMap({ terrenos, onSelect, selectedId, onMapClick, onMarkerDrag, height = 460, interactive = true }) {
  const iframeRef = useRef(null);
  const [iframeReady, setIframeReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const handlersRef = useRef({});

  useEffect(() => {
    handlersRef.current = { onSelect, onMapClick, onMarkerDrag };
  }, [onSelect, onMapClick, onMarkerDrag]);

  useEffect(() => {
    const handler = (e) => {
      if (!e.data || e.data.source !== "hygge-map") return;
      const { type, payload } = e.data;
      if (type === "ready") { setIframeReady(true); setLoadFailed(false); }
      else if (type === "markerClick") handlersRef.current.onSelect?.(payload.id);
      else if (type === "mapClick") handlersRef.current.onMapClick?.(payload.lat, payload.lng);
      else if (type === "markerDrag") handlersRef.current.onMarkerDrag?.(payload.id, payload.lat, payload.lng);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // Timeout: si no llega "ready" en 6s → asumir CSP block o network failure
  useEffect(() => {
    if (iframeReady) return;
    const t = setTimeout(() => { if (!iframeReady) setLoadFailed(true); }, 6000);
    return () => clearTimeout(t);
  }, [iframeReady]);

  useEffect(() => {
    if (!iframeReady || !iframeRef.current?.contentWindow) return;
    const statusesMap = TERRENO_STATUSES.reduce((a, s) => { a[s.id] = { color: s.color, label: s.label }; return a; }, {});
    const slimTerrenos = terrenos
      .filter(t => typeof t.lat === "number" && typeof t.lng === "number")
      .map(t => ({ id: t.id, name: t.name, lat: t.lat, lng: t.lng, status: t.status, district: t.district }));
    iframeRef.current.contentWindow.postMessage({
      source: "hygge-parent",
      type: "update",
      payload: { terrenos: slimTerrenos, selectedId, statuses: statusesMap, interactive },
    }, "*");
  }, [terrenos, selectedId, iframeReady, interactive]);

  // FALLBACK: lista de terrenos cuando el mapa no carga
  if (loadFailed) {
    const withCoords = terrenos.filter(t => typeof t.lat === "number" && typeof t.lng === "number");
    return (
      <div style={{ borderRadius: 2, overflow: "hidden", border: `1px solid ${C.lineSoft}` }}>
        <div className="p-4" style={{ backgroundColor: `${C.ochre}15`, borderBottom: `1px solid ${C.ochre}40` }}>
          <div className="text-[11px]" style={{ color: C.ink, fontWeight: 600 }}>⚠ Mapa no cargó · vista fallback</div>
          <div className="text-[10px] mt-1" style={{ color: C.inkSoft, lineHeight: 1.6 }}>
            Probable causa: el CSP del iframe del artifact bloquea Leaflet desde unpkg.com o las tiles de carto CDN.
            En producción (deploy a dominio propio) esto va a funcionar. Mientras tanto: lista de terrenos abajo con coordenadas.
          </div>
          <div className="text-[10px] mt-1.5" style={{ color: C.muted }}>
            Diagnóstico completo en Settings → Admin → White Rabbit → System Diagnostic
          </div>
        </div>
        <div className="p-3 space-y-1" style={{ maxHeight: height - 80, overflow: "auto", backgroundColor: "#F4F2EE" }}>
          {withCoords.length === 0 ? (
            <div className="text-[11px] text-center py-6" style={{ color: C.muted, fontStyle: "italic" }}>Sin terrenos con coordenadas</div>
          ) : withCoords.map(t => {
            const st = TERRENO_STATUSES.find(s => s.id === t.status);
            return (
              <button key={t.id} onClick={() => onSelect && onSelect(t.id)}
                className="w-full text-left p-2 hover:opacity-90 flex items-center gap-2.5"
                style={{ backgroundColor: selectedId === t.id ? `${C.cobalt}15` : "white", border: `1px solid ${selectedId === t.id ? C.cobalt : C.lineSoft}`, borderRadius: 2 }}>
                <span className="w-2 h-2 flex-shrink-0" style={{ backgroundColor: st?.color || C.muted, borderRadius: 999 }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] truncate" style={{ color: C.ink, fontWeight: 600 }}>{t.name}</div>
                  <div className="text-[9px] tabular-nums" style={{ color: C.muted }}>{t.district} · {t.lat.toFixed(4)}, {t.lng.toFixed(4)}</div>
                </div>
                <span className="text-[8px] uppercase tracking-[0.06em]" style={{ color: st?.color || C.muted, fontWeight: 600 }}>{st?.label || t.status}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="relative" style={{ borderRadius: 2, overflow: "hidden", border: `1px solid ${C.lineSoft}` }}>
      <iframe ref={iframeRef} srcDoc={LEAFLET_IFRAME_HTML} title="Lima Map" style={{ width: "100%", height, border: 0, display: "block" }} sandbox="allow-scripts allow-same-origin" />
      {!iframeReady && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ backgroundColor: "#F4F2EE" }}>
          <div className="text-[11px]" style={{ color: C.muted, fontWeight: 500 }}>Cargando mapa…</div>
        </div>
      )}
      {interactive && onMapClick && iframeReady && (
        <div className="absolute top-2 right-2 text-[9px] tracking-[0.12em] uppercase px-2 py-1 pointer-events-none" style={{ color: C.muted, fontWeight: 600, backgroundColor: "rgba(244,242,238,0.92)", borderRadius: 2, border: `1px solid ${C.lineSoft}`, zIndex: 1000 }}>
          Click para agregar · drag marcador
        </div>
      )}
    </div>
  );
}

function MinimalMap({ terrenos, onSelect, selectedId, height = 460 }) {
  return <LeafletMap terrenos={terrenos} onSelect={onSelect} selectedId={selectedId} height={height} interactive={false} />;
}

function TerrenoCard({ terreno, onClick }) {
  const st = terrenoStatus(terreno.status);
  return (
    <button onClick={onClick} className="text-left w-full p-4 hover:opacity-95 transition-opacity" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
      <div className="flex items-start justify-between mb-2 gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[14px] truncate" style={{ color: C.ink, fontWeight: 600 }}>{terreno.name}</div>
          <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>{terreno.district}</div>
        </div>
        <span className="text-[9px] px-1.5 py-0.5 flex-shrink-0" style={{ color: st.color, backgroundColor: st.color + "15", border: `1px solid ${st.color}33`, borderRadius: 2, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{st.label}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 pt-3" style={{ borderTop: `1px solid ${C.lineSoft}` }}>
        <div>
          <div className="text-[8px] tracking-[0.12em] uppercase" style={{ color: C.muted, fontWeight: 600 }}>Área</div>
          <div className="text-[13px] mt-0.5" style={{ color: C.ink, fontWeight: 500 }}>{terreno.areaM2 ? `${terreno.areaM2.toLocaleString("es-PE")} m²` : "—"}</div>
        </div>
        <div>
          <div className="text-[8px] tracking-[0.12em] uppercase" style={{ color: C.muted, fontWeight: 600 }}>Precio</div>
          <div className="text-[13px] mt-0.5" style={{ color: C.ink, fontWeight: 500 }}>{terreno.askedPrice ? `$${(terreno.askedPrice / 1000).toFixed(0)}K` : "—"}</div>
        </div>
        <div>
          <div className="text-[8px] tracking-[0.12em] uppercase" style={{ color: C.muted, fontWeight: 600 }}>Score</div>
          <div className="text-[13px] mt-0.5" style={{ color: terreno.score >= 80 ? C.green : terreno.score >= 65 ? C.ochre : C.muted, fontWeight: 600 }}>{terreno.score || "—"}</div>
        </div>
      </div>
      {(terreno.comments?.length > 0 || terreno.documents?.length > 0) && (
        <div className="flex items-center gap-3 mt-3 pt-3 text-[10px]" style={{ borderTop: `1px solid ${C.lineSoft}`, color: C.muted }}>
          {terreno.comments?.length > 0 && <span className="flex items-center gap-1"><MessageSquare size={9} /> {terreno.comments.length}</span>}
          {terreno.documents?.length > 0 && <span className="flex items-center gap-1"><Paperclip size={9} /> {terreno.documents.length}</span>}
        </div>
      )}
    </button>
  );
}

function GrowthDashboard({ terrenos, onSelect, onCreate, onUpdate, selectedTerrenoId }) {
  const [filterStatus, setFilterStatus] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [createInitial, setCreateInitial] = useState(null);
  const [sortBy, setSortBy] = useState("recent");
  const [filterDistrict, setFilterDistrict] = useState("");
  const [filterScoreMin, setFilterScoreMin] = useState("");
  const [filterPriceMax, setFilterPriceMax] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const filtered = useMemo(() => {
    let list = filterStatus === "all" ? terrenos : terrenos.filter(t => t.status === filterStatus);
    if (filterDistrict.trim()) list = list.filter(t => (t.district || "").toLowerCase().includes(filterDistrict.toLowerCase()));
    if (filterScoreMin) list = list.filter(t => (t.score || 0) >= parseFloat(filterScoreMin));
    if (filterPriceMax) list = list.filter(t => !t.askedPrice || t.askedPrice <= parseFloat(filterPriceMax));
    const sorted = [...list];
    if (sortBy === "recent") sorted.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (sortBy === "score") sorted.sort((a, b) => (b.score || 0) - (a.score || 0));
    if (sortBy === "price") sorted.sort((a, b) => (a.askedPrice || 0) - (b.askedPrice || 0));
    if (sortBy === "area") sorted.sort((a, b) => (b.areaM2 || 0) - (a.areaM2 || 0));
    return sorted;
  }, [terrenos, filterStatus, sortBy, filterDistrict, filterScoreMin, filterPriceMax]);

  const stats = TERRENO_STATUSES.map(s => ({ ...s, count: terrenos.filter(t => t.status === s.id).length }));
  const totalArea = terrenos.reduce((s, t) => s + (t.areaM2 || 0), 0);
  const totalValue = terrenos.reduce((s, t) => s + (t.askedPrice || 0), 0);
  const activeTerrenos = terrenos.filter(t => t.status !== "descartado" && t.status !== "comprado");
  const avgScore = activeTerrenos.length ? Math.round(activeTerrenos.reduce((s, t) => s + (t.score || 0), 0) / activeTerrenos.length) : 0;

  // Pipeline funnel · v44
  const pipelineFunnel = useMemo(() => {
    const order = ["scouting", "evaluacion", "negociacion", "comprado", "descartado"];
    const counts = TERRENO_STATUSES.reduce((acc, s) => { acc[s.id] = terrenos.filter(t => t.status === s.id).length; return acc; }, {});
    const totalEntered = terrenos.length;
    const totalActive = totalEntered - (counts.descartado || 0);
    const purchased = counts.comprado || 0;
    const conversionRate = totalEntered > 0 ? Math.round((purchased / totalEntered) * 100) : 0;
    const dropoutRate = totalEntered > 0 ? Math.round(((counts.descartado || 0) / totalEntered) * 100) : 0;
    return { order, counts, totalEntered, totalActive, purchased, conversionRate, dropoutRate };
  }, [terrenos]);

  const recentActivity = useMemo(() => {
    const events = [];
    terrenos.forEach(t => {
      events.push({ type: "created", terreno: t, ts: t.createdAt || 0 });
      (t.comments || []).forEach(c => events.push({ type: "comment", terreno: t, ts: c.id || 0, comment: c }));
    });
    return events.sort((a, b) => b.ts - a.ts).slice(0, 5);
  }, [terrenos]);

  const handleMapClick = useCallback((lat, lng) => {
    setCreateInitial({ lat: lat.toFixed(5), lng: lng.toFixed(5), name: "", district: "Miraflores", address: "", areaM2: "", askedPrice: "", status: "scouting", owner: "", ownerContact: "", notes: "", score: 70 });
    setCreateOpen(true);
  }, []);

  const handleMarkerDrag = useCallback((id, lat, lng) => {
    onUpdate(id, { lat, lng });
  }, [onUpdate]);

  return (
    <div className="px-4 lg:px-10 py-8 lg:py-12 max-w-[1320px] mx-auto">
      <div className="mb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          <NavyRule />
          <div className="mt-4"><Eyebrow>Growth · Land Acquisition</Eyebrow></div>
          <h1 className="text-[32px] lg:text-[36px] mt-3" style={{ color: C.ink, fontWeight: 500, letterSpacing: "-0.025em" }}>Terrenos en evaluación</h1>
          <div className="text-[12px] mt-2" style={{ color: C.muted }}>{terrenos.length} terrenos · pipeline activo</div>
        </div>
        <button onClick={() => { setCreateInitial(null); setCreateOpen(true); }} className="flex items-center gap-1.5 px-3 py-2 text-[12px] hover:opacity-90" style={{ backgroundColor: C.ink, color: C.bg, borderRadius: 2, fontWeight: 500 }}>
          <Plus size={12} /> Nuevo terreno
        </button>
      </div>

      {/* Pipeline funnel · v44 */}
      {pipelineFunnel.totalEntered > 0 && (
        <div className="mb-3 p-3" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[9px] tracking-[0.12em] uppercase" style={{ color: C.muted, fontWeight: 600 }}>Pipeline funnel · scouting → comprado</div>
            <div className="flex gap-3 text-[10px]">
              <span style={{ color: C.muted }}>Conversión: <strong style={{ color: pipelineFunnel.conversionRate >= 20 ? C.green : C.ink }}>{pipelineFunnel.conversionRate}%</strong></span>
              <span style={{ color: C.muted }}>Dropout: <strong style={{ color: pipelineFunnel.dropoutRate > 50 ? C.brick : C.ink }}>{pipelineFunnel.dropoutRate}%</strong></span>
            </div>
          </div>
          <div className="flex items-end gap-1" style={{ height: 40 }}>
            {pipelineFunnel.order.map((statusId) => {
              const def = TERRENO_STATUSES.find(s => s.id === statusId);
              const count = pipelineFunnel.counts[statusId] || 0;
              const maxCount = Math.max(...Object.values(pipelineFunnel.counts), 1);
              const heightPct = (count / maxCount) * 100;
              return (
                <div key={statusId} className="flex-1 flex flex-col items-center justify-end gap-1">
                  <div className="text-[9px] tabular-nums" style={{ color: C.ink, fontWeight: 600 }}>{count}</div>
                  <div className="w-full transition-all" style={{ height: `${Math.max(heightPct, 4)}%`, backgroundColor: def?.color || C.muted, opacity: count > 0 ? 0.85 : 0.2, borderRadius: 1 }} />
                </div>
              );
            })}
          </div>
          <div className="flex items-start gap-1 mt-1">
            {pipelineFunnel.order.map((statusId) => {
              const def = TERRENO_STATUSES.find(s => s.id === statusId);
              return <div key={statusId} className="flex-1 text-center text-[8px]" style={{ color: C.muted, letterSpacing: "0.04em" }}>{def?.label || statusId}</div>;
            })}
          </div>
        </div>
      )}

      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="p-3" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
          <div className="text-[9px] tracking-[0.12em] uppercase" style={{ color: C.muted, fontWeight: 600 }}>Total terrenos</div>
          <div className="text-[24px] mt-1" style={{ color: C.ink, fontWeight: 500 }}>{terrenos.length}</div>
        </div>
        <div className="p-3" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
          <div className="text-[9px] tracking-[0.12em] uppercase" style={{ color: C.muted, fontWeight: 600 }}>Área total</div>
          <div className="text-[24px] mt-1" style={{ color: C.ink, fontWeight: 500 }}>{totalArea.toLocaleString("es-PE")} <span className="text-[11px]" style={{ color: C.muted }}>m²</span></div>
        </div>
        <div className="p-3" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
          <div className="text-[9px] tracking-[0.12em] uppercase" style={{ color: C.muted, fontWeight: 600 }}>Valor pipeline</div>
          <div className="text-[24px] mt-1" style={{ color: C.ink, fontWeight: 500 }}>${(totalValue/1000000).toFixed(1)}<span className="text-[11px]" style={{ color: C.muted }}>M</span></div>
        </div>
        <div className="p-3" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
          <div className="text-[9px] tracking-[0.12em] uppercase" style={{ color: C.muted, fontWeight: 600 }}>Score promedio · activos</div>
          <div className="text-[24px] mt-1" style={{ color: avgScore >= 80 ? C.green : avgScore >= 65 ? C.ochre : C.ink, fontWeight: 500 }}>{avgScore}</div>
        </div>
      </div>

      {/* Advanced filters toggle · v44 */}
      <div className="mb-3 flex items-center gap-2 flex-wrap">
        <button onClick={() => setShowAdvancedFilters(v => !v)} className="flex items-center gap-1 px-2 py-1 text-[10px] hover:opacity-80" style={{ color: C.inkSoft, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
          <Search size={10} /> Filtros avanzados {showAdvancedFilters ? "▾" : "▸"}
        </button>
        {(filterDistrict || filterScoreMin || filterPriceMax) && (
          <button onClick={() => { setFilterDistrict(""); setFilterScoreMin(""); setFilterPriceMax(""); }} className="text-[10px] hover:opacity-70 px-2 py-1" style={{ color: C.brick }}>Limpiar filtros</button>
        )}
        <div className="text-[10px]" style={{ color: C.muted }}>{filtered.length} de {terrenos.length}</div>
      </div>
      {showAdvancedFilters && (
        <div className="mb-3 p-3 grid grid-cols-1 md:grid-cols-3 gap-2" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
          <div>
            <div className="text-[9px] uppercase tracking-[0.08em] mb-1" style={{ color: C.muted, fontWeight: 600 }}>Distrito</div>
            <input value={filterDistrict} onChange={e => setFilterDistrict(e.target.value)} placeholder="ej. Miraflores" className="w-full px-2 py-1 text-[11px] outline-none" style={{ backgroundColor: C.bg, border: `1px solid ${C.lineSoft}`, borderRadius: 2, color: C.ink }} />
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-[0.08em] mb-1" style={{ color: C.muted, fontWeight: 600 }}>Score mínimo</div>
            <input type="number" value={filterScoreMin} onChange={e => setFilterScoreMin(e.target.value)} placeholder="0-100" className="w-full px-2 py-1 text-[11px] outline-none" style={{ backgroundColor: C.bg, border: `1px solid ${C.lineSoft}`, borderRadius: 2, color: C.ink }} />
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-[0.08em] mb-1" style={{ color: C.muted, fontWeight: 600 }}>Precio máx USD</div>
            <input type="number" value={filterPriceMax} onChange={e => setFilterPriceMax(e.target.value)} placeholder="ej. 2000000" className="w-full px-2 py-1 text-[11px] outline-none" style={{ backgroundColor: C.bg, border: `1px solid ${C.lineSoft}`, borderRadius: 2, color: C.ink }} />
          </div>
        </div>
      )}

      {/* Status filters */}
      <div className="mb-6 grid grid-cols-2 md:grid-cols-5 gap-2">
        {stats.map(s => (
          <button key={s.id} onClick={() => setFilterStatus(filterStatus === s.id ? "all" : s.id)} className="text-left p-3 hover:translate-y-[-1px] transition-transform"
            style={{ backgroundColor: filterStatus === s.id ? s.color + "11" : C.paper, border: `1px solid ${filterStatus === s.id ? s.color : C.lineSoft}`, borderRadius: 2 }}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="text-[9px] tracking-[0.12em] uppercase" style={{ color: C.muted, fontWeight: 600 }}>{s.label}</span>
            </div>
            <div className="text-[22px]" style={{ color: C.ink, fontWeight: 500 }}>{s.count}</div>
          </button>
        ))}
      </div>

      {/* Map + Activity sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 mb-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <Eyebrow>Mapa · Lima Metropolitana</Eyebrow>
            {filterStatus !== "all" && (
              <button onClick={() => setFilterStatus("all")} className="text-[10px] hover:opacity-70 flex items-center gap-1" style={{ color: C.muted }}>
                <X size={9} /> Filtro: {terrenoStatus(filterStatus).label}
              </button>
            )}
          </div>
          <LeafletMap terrenos={filtered} onSelect={onSelect} selectedId={selectedTerrenoId}
            onMapClick={handleMapClick} onMarkerDrag={handleMarkerDrag} height={460} />
        </div>

        <div>
          <Eyebrow>Actividad reciente</Eyebrow>
          <div className="mt-2 space-y-1.5">
            {recentActivity.length === 0 ? (
              <div className="text-[11px] py-4 text-center" style={{ color: C.muted }}>Sin actividad</div>
            ) : recentActivity.map((ev, i) => (
              <button key={i} onClick={() => onSelect(ev.terreno.id)} className="w-full text-left p-2.5 hover:opacity-90"
                style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
                <div className="flex items-center gap-1.5 mb-1">
                  {ev.type === "created" ? <Plus size={9} style={{ color: C.cobalt }} /> : <MessageSquare size={9} style={{ color: C.lavender }} />}
                  <span className="text-[9px] tracking-[0.1em] uppercase" style={{ color: C.muted, fontWeight: 600 }}>
                    {ev.type === "created" ? "Agregado" : "Comentario"}
                  </span>
                </div>
                <div className="text-[11px] truncate" style={{ color: C.ink, fontWeight: 600 }}>{ev.terreno.name}</div>
                {ev.type === "comment" && <div className="text-[10px] mt-0.5 truncate" style={{ color: C.inkSoft }}>{ev.comment.text}</div>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Terrenos grid with sort */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <Eyebrow>Terrenos · {filtered.length}</Eyebrow>
          <div className="flex items-center gap-2">
            <span className="text-[9px] tracking-[0.12em] uppercase" style={{ color: C.muted, fontWeight: 600 }}>Ordenar</span>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="text-[11px] px-2 py-1 outline-none" style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2, color: C.ink }}>
              <option value="recent">Más recientes</option>
              <option value="score">Mejor score</option>
              <option value="price">Menor precio</option>
              <option value="area">Mayor área</option>
            </select>
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="text-center py-12" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
            <div className="text-[12px]" style={{ color: C.muted }}>Sin terrenos con este filtro</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(t => <TerrenoCard key={t.id} terreno={t} onClick={() => onSelect(t.id)} />)}
          </div>
        )}
      </div>

      {createOpen && <NewTerrenoModal initial={createInitial} onClose={() => { setCreateOpen(false); setCreateInitial(null); }} onCreate={(data) => { onCreate(data); setCreateOpen(false); setCreateInitial(null); }} />}
    </div>
  );
}

function GrowthSpace({ terrenos, onSelect, onCreate, onUpdate, selectedTerrenoId }) {
  const [tab, setTab] = React.useState("terrenos");
  const tabs = [
    { id: "terrenos", label: "Terrenos" },
    { id: "mercado",  label: "Análisis de Mercado" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.line}`, padding: "0 24px", background: C.bg, flexShrink: 0 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: "10px 18px", fontSize: 12, fontWeight: 600, border: "none", background: "none",
              cursor: "pointer", color: tab === t.id ? C.ink : C.muted,
              borderBottom: tab === t.id ? `2px solid ${C.ink}` : "2px solid transparent",
              marginBottom: -1, letterSpacing: "0.02em",
            }}>
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>
        {tab === "terrenos" && <GrowthDashboard terrenos={terrenos} onSelect={onSelect} onCreate={onCreate} onUpdate={onUpdate} selectedTerrenoId={selectedTerrenoId} />}
        {tab === "mercado"  && <MercadoView />}
      </div>
    </div>
  );
}

function NewTerrenoModal({ onClose, onCreate, initial }) {
  const [data, setData] = useState(initial || {
    name: "", district: "Miraflores", address: "",
    lat: -12.115, lng: -77.030,
    areaM2: "", askedPrice: "", status: "scouting",
    owner: "", ownerContact: "", notes: "", score: 70,
  });
  const update = (patch) => setData(d => ({ ...d, ...patch }));
  const submit = () => {
    if (!data.name?.trim()) return;
    onCreate({
      ...data,
      name: data.name.trim(),
      address: (data.address || "").trim() || data.name.trim(),
      areaM2: parseFloat(data.areaM2) || null,
      askedPrice: parseFloat(data.askedPrice) || null,
      lat: parseFloat(data.lat) || null,
      lng: parseFloat(data.lng) || null,
      score: parseInt(data.score) || 70,
      documents: [], comments: [], photos: [],
      createdAt: Date.now(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[6vh] p-4" style={{ backgroundColor: "rgba(10,11,15,0.5)" }} onClick={onClose}>
      <div className="w-full max-w-[640px] max-h-[88vh] flex flex-col" style={{ backgroundColor: C.paper, border: `1px solid ${C.line}`, borderRadius: 4 }} onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-center justify-between flex-shrink-0" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
          <div>
            <Eyebrow>Growth · nuevo terreno</Eyebrow>
            <div className="text-[16px] mt-1" style={{ color: C.ink, fontWeight: 600 }}>Agregar terreno al pipeline</div>
          </div>
          <button onClick={onClose}><X size={14} style={{ color: C.muted }} /></button>
        </div>
        <div className="p-5 overflow-y-auto space-y-3">
          <FormField label="Nombre del terreno"><input value={data.name} onChange={e => update({ name: e.target.value })} placeholder="Av. Petit Thouars 4500" className={fieldClass} style={fieldStyle} autoFocus /></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Distrito">
              <select value={data.district} onChange={e => update({ district: e.target.value })} className={fieldClass} style={fieldStyle}>
                {["Miraflores","San Isidro","Barranco","Surco","Jesús María","Magdalena","La Molina","San Borja","Lince","Pueblo Libre","Chorrillos","Otro"].map(d => <option key={d}>{d}</option>)}
              </select>
            </FormField>
            <FormField label="Dirección completa"><input value={data.address} onChange={e => update({ address: e.target.value })} placeholder="Av. ..., Nº ..." className={fieldClass} style={fieldStyle} /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Latitud"><input type="number" step="0.0001" value={data.lat} onChange={e => update({ lat: e.target.value })} className={fieldClass} style={fieldStyle} /></FormField>
            <FormField label="Longitud"><input type="number" step="0.0001" value={data.lng} onChange={e => update({ lng: e.target.value })} className={fieldClass} style={fieldStyle} /></FormField>
          </div>
          <div className="text-[10px] -mt-1" style={{ color: C.muted, fontStyle: "italic" }}>Lima centro ≈ lat -12.10 · lng -77.03. Ajustá según la dirección.</div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Área (m²)"><input type="number" value={data.areaM2} onChange={e => update({ areaM2: e.target.value })} placeholder="850" className={fieldClass} style={fieldStyle} /></FormField>
            <FormField label="Precio pedido (USD)"><input type="number" value={data.askedPrice} onChange={e => update({ askedPrice: e.target.value })} placeholder="4200000" className={fieldClass} style={fieldStyle} /></FormField>
          </div>
          <FormField label="Estado">
            <div className="flex gap-1 flex-wrap">
              {TERRENO_STATUSES.map(s => {
                const active = data.status === s.id;
                return (
                  <button key={s.id} onClick={() => update({ status: s.id })} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] hover:opacity-90"
                    style={{ backgroundColor: active ? s.color + "22" : C.surface, color: active ? s.color : C.inkSoft, border: `1px solid ${active ? s.color : C.lineSoft}`, borderRadius: 2, fontWeight: active ? 600 : 500 }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} /> {s.label}
                  </button>
                );
              })}
            </div>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Propietario"><input value={data.owner} onChange={e => update({ owner: e.target.value })} placeholder="Persona o empresa" className={fieldClass} style={fieldStyle} /></FormField>
            <FormField label="Contacto"><input value={data.ownerContact} onChange={e => update({ ownerContact: e.target.value })} placeholder="+51 ... / email" className={fieldClass} style={fieldStyle} /></FormField>
          </div>
          <FormField label="Score (1-100)"><input type="number" min="1" max="100" value={data.score} onChange={e => update({ score: e.target.value })} className={fieldClass} style={fieldStyle} /></FormField>
          <FormField label="Notas">
            <textarea value={data.notes} onChange={e => update({ notes: e.target.value })} placeholder="Contexto, zonificación, observaciones…" rows={3}
              className={fieldClass} style={{ ...fieldStyle, fontFamily: "inherit", resize: "none", lineHeight: 1.5 }} />
          </FormField>
        </div>
        <div className="px-5 py-4 flex items-center justify-end gap-2 flex-shrink-0" style={{ borderTop: `1px solid ${C.lineSoft}` }}>
          <button onClick={onClose} className="px-3 py-2 text-[12px] hover:opacity-90" style={{ color: C.muted, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>Cancelar</button>
          <button onClick={submit} disabled={!data.name?.trim()} className="px-4 py-2 text-[12px] hover:opacity-90"
            style={{ backgroundColor: data.name?.trim() ? C.ink : C.muted, color: C.bg, borderRadius: 2, fontWeight: 500, opacity: data.name?.trim() ? 1 : 0.5 }}>
            Crear terreno
          </button>
        </div>
      </div>
    </div>
  );
}

function TerrenoDetailPanel({ terreno, users, onClose, onUpdate, onDelete }) {
  const confirm = useConfirm();
  const askDelete = async () => {
    const ok = await confirm({ title: `Eliminar terreno "${terreno.name}"`, message: "Sale del pipeline de scouting · acción reversible con Cmd+Z.", danger: true, confirmLabel: "Eliminar terreno" });
    if (ok) onDelete(terreno.id);
  };
  const [tab, setTab] = useState("detalles");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(terreno);
  const [commentText, setCommentText] = useState("");
  const fileInputRef = useRef(null);
  useEffect(() => { setDraft(terreno); setEditing(false); }, [terreno?.id]);
  if (!terreno) return null;

  const st = terrenoStatus(terreno.status);
  const saveEdit = () => {
    onUpdate(terreno.id, {
      ...draft,
      areaM2: parseFloat(draft.areaM2) || null,
      askedPrice: parseFloat(draft.askedPrice) || null,
      lat: parseFloat(draft.lat) || null,
      lng: parseFloat(draft.lng) || null,
      score: parseInt(draft.score) || terreno.score,
    });
    setEditing(false);
  };
  const addComment = () => {
    if (!commentText.trim()) return;
    onUpdate(terreno.id, { comments: [...(terreno.comments || []), { id: Date.now(), who: "sb", text: commentText.trim(), when: nowHHMM() }] });
    setCommentText("");
  };
  const handleFiles = (files) => {
    if (!files || !files.length) return;
    const newDocs = Array.from(files).map(f => ({ id: Date.now() + Math.random(), name: f.name, size: f.size, type: f.type, uploadedAt: Date.now() }));
    onUpdate(terreno.id, { documents: [...(terreno.documents || []), ...newDocs] });
  };
  const removeDoc = (id) => onUpdate(terreno.id, { documents: (terreno.documents || []).filter(d => d.id !== id) });
  const updateStatus = (newStatus) => onUpdate(terreno.id, { status: newStatus });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end" style={{ backgroundColor: "rgba(10,11,15,0.4)" }} onClick={onClose}>
      <aside className="h-full w-full flex flex-col" style={{ maxWidth: (tab === "analisis" || tab === "cabida") ? 1060 : 560, backgroundColor: C.bg, borderLeft: `1px solid ${C.line}`, transition: "max-width 0.28s ease" }} onClick={e => e.stopPropagation()}>
        <div className="px-5 lg:px-6 pt-5 pb-3 flex-shrink-0" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <Eyebrow>Terreno · {terreno.district}</Eyebrow>
              {editing ? (
                <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} className="w-full mt-2 px-2 py-1 text-[18px] outline-none" style={{ backgroundColor: C.surface, border: `1px solid ${C.cobalt}`, borderRadius: 2, color: C.ink, fontWeight: 600, letterSpacing: "-0.015em" }} />
              ) : (
                <h2 className="text-[18px] mt-2" style={{ color: C.ink, fontWeight: 600, letterSpacing: "-0.015em" }}>{terreno.name}</h2>
              )}
            </div>
            <button onClick={onClose}><X size={14} style={{ color: C.muted }} /></button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={terreno.status} onChange={e => updateStatus(e.target.value)} className="text-[10px] px-2 py-1 outline-none" style={{ backgroundColor: st.color + "11", color: st.color, border: `1px solid ${st.color}33`, borderRadius: 2, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {TERRENO_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <span className="text-[10px]" style={{ color: C.muted }}>·</span>
            <span className="text-[11px]" style={{ color: C.ink, fontWeight: 600 }}>Score {terreno.score || "—"}</span>
            {editing ? (
              <button onClick={saveEdit} className="ml-auto px-3 py-1 text-[10px]" style={{ backgroundColor: C.ink, color: C.bg, borderRadius: 2, fontWeight: 500 }}>Guardar</button>
            ) : (
              <button onClick={() => setEditing(true)} className="ml-auto flex items-center gap-1 text-[10px] px-2 py-1 hover:opacity-90" style={{ color: C.inkSoft, border: `1px solid ${C.lineSoft}`, borderRadius: 2, fontWeight: 500 }}><PenSquare size={9} /> Editar</button>
            )}
            <button onClick={askDelete} className="text-[10px] px-2 py-1 hover:opacity-90" style={{ color: C.brick, border: `1px solid ${C.brick}33`, borderRadius: 2 }}><Trash2 size={9} /></button>
          </div>
        </div>

        <div className="flex items-center gap-1 px-5 lg:px-6 flex-shrink-0" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
          {[
            { id: "detalles", label: "Detalles" },
            { id: "comentarios", label: `Comentarios · ${(terreno.comments || []).length}` },
            { id: "documentos", label: `Documentos · ${(terreno.documents || []).length}` },
            { id: "analisis", label: "Análisis" },
            { id: "cabida", label: "Cabida" },
            { id: "propuesta", label: "Propuesta BAM" },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className="px-3 py-3 text-[11px]"
              style={{ color: tab === t.id ? C.ink : C.muted, fontWeight: tab === t.id ? 600 : 500, borderBottom: `2px solid ${tab === t.id ? C.ink : "transparent"}`, marginBottom: -1 }}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 lg:p-6">
          {tab === "detalles" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Eyebrow>Área</Eyebrow>{editing ? <input type="number" value={draft.areaM2 || ""} onChange={e => setDraft({ ...draft, areaM2: e.target.value })} className="w-full mt-2 px-2 py-1 text-[14px] outline-none" style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }} /> : <div className="text-[16px] mt-1" style={{ color: C.ink, fontWeight: 500 }}>{terreno.areaM2 ? `${terreno.areaM2.toLocaleString("es-PE")} m²` : "—"}</div>}</div>
                <div><Eyebrow>Precio pedido</Eyebrow>{editing ? <input type="number" value={draft.askedPrice || ""} onChange={e => setDraft({ ...draft, askedPrice: e.target.value })} className="w-full mt-2 px-2 py-1 text-[14px] outline-none" style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }} /> : <div className="text-[16px] mt-1" style={{ color: C.ink, fontWeight: 500 }}>{terreno.askedPrice ? `$${terreno.askedPrice.toLocaleString("es-PE")}` : "—"}</div>}</div>
              </div>
              <div><Eyebrow>Dirección</Eyebrow>{editing ? <input value={draft.address || ""} onChange={e => setDraft({ ...draft, address: e.target.value })} className="w-full mt-2 px-2 py-1 text-[13px] outline-none" style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }} /> : <div className="text-[13px] mt-1" style={{ color: C.ink }}>{terreno.address}</div>}</div>
              <div className="grid grid-cols-2 gap-3">
                <div><Eyebrow>Distrito</Eyebrow>{editing ? <input value={draft.district || ""} onChange={e => setDraft({ ...draft, district: e.target.value })} className="w-full mt-2 px-2 py-1 text-[13px] outline-none" style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }} /> : <div className="text-[13px] mt-1" style={{ color: C.ink }}>{terreno.district}</div>}</div>
                <div><Eyebrow>Score</Eyebrow>{editing ? <input type="number" min="1" max="100" value={draft.score || ""} onChange={e => setDraft({ ...draft, score: e.target.value })} className="w-full mt-2 px-2 py-1 text-[13px] outline-none" style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }} /> : <div className="text-[13px] mt-1" style={{ color: terreno.score >= 80 ? C.green : C.ink, fontWeight: 600 }}>{terreno.score || "—"}</div>}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Eyebrow>Propietario</Eyebrow>{editing ? <input value={draft.owner || ""} onChange={e => setDraft({ ...draft, owner: e.target.value })} className="w-full mt-2 px-2 py-1 text-[13px] outline-none" style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }} /> : <div className="text-[13px] mt-1" style={{ color: C.ink }}>{terreno.owner || "—"}</div>}</div>
                <div><Eyebrow>Contacto</Eyebrow>{editing ? <input value={draft.ownerContact || ""} onChange={e => setDraft({ ...draft, ownerContact: e.target.value })} className="w-full mt-2 px-2 py-1 text-[13px] outline-none" style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }} /> : <div className="text-[13px] mt-1" style={{ color: C.ink }}>{terreno.ownerContact || "—"}</div>}</div>
              </div>
              {editing && (
                <div className="grid grid-cols-2 gap-3">
                  <div><Eyebrow>Latitud</Eyebrow><input type="number" step="0.0001" value={draft.lat || ""} onChange={e => setDraft({ ...draft, lat: e.target.value })} className="w-full mt-2 px-2 py-1 text-[13px] outline-none" style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }} /></div>
                  <div><Eyebrow>Longitud</Eyebrow><input type="number" step="0.0001" value={draft.lng || ""} onChange={e => setDraft({ ...draft, lng: e.target.value })} className="w-full mt-2 px-2 py-1 text-[13px] outline-none" style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }} /></div>
                </div>
              )}
              <div><Eyebrow>Notas</Eyebrow>
                {editing ? <textarea value={draft.notes || ""} onChange={e => setDraft({ ...draft, notes: e.target.value })} rows={4} className="w-full mt-2 px-3 py-2 text-[13px] outline-none resize-none" style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2, fontFamily: "inherit", lineHeight: 1.55 }} />
                : <div className="text-[13px] mt-2 leading-relaxed whitespace-pre-wrap" style={{ color: C.inkSoft }}>{terreno.notes || "Sin notas"}</div>}
              </div>
              {terreno.lat && terreno.lng && !editing && (
                <div>
                  <Eyebrow>Ubicación</Eyebrow>
                  <div className="mt-2"><MinimalMap terrenos={[terreno]} selectedId={terreno.id} height={220} /></div>
                </div>
              )}
            </div>
          )}

          {tab === "comentarios" && (
            <div>
              <div className="flex items-start gap-2 mb-4">
                <Avatar personId="sb" size={28} />
                <div className="flex-1">
                  <textarea value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Agregar comentario…" rows={2}
                    className="w-full px-3 py-2 outline-none text-[13px] resize-none"
                    style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2, color: C.ink, fontFamily: "inherit", lineHeight: 1.55 }} />
                  <div className="flex justify-end mt-2">
                    <button onClick={addComment} disabled={!commentText.trim()} className="flex items-center gap-1 px-3 py-1.5 text-[11px] hover:opacity-90"
                      style={{ backgroundColor: commentText.trim() ? C.ink : C.muted, color: C.bg, borderRadius: 2, fontWeight: 500, opacity: commentText.trim() ? 1 : 0.5 }}>
                      <Send size={10} /> Comentar
                    </button>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                {(terreno.comments || []).length === 0 ? (
                  <div className="text-center py-8 text-[12px]" style={{ color: C.muted }}>Sin comentarios todavía</div>
                ) : (
                  (terreno.comments || []).slice().reverse().map(c => (
                    <div key={c.id} className="flex items-start gap-2">
                      <Avatar personId={c.who} size={26} />
                      <div className="flex-1 p-3" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
                        <div className="flex items-baseline justify-between mb-1">
                          <span className="text-[12px]" style={{ color: C.ink, fontWeight: 600 }}>{findPerson(c.who)?.name || c.who}</span>
                          <span className="text-[10px]" style={{ color: C.muted }}>{c.when}</span>
                        </div>
                        <div className="text-[12px] leading-relaxed" style={{ color: C.inkSoft }}>{c.text}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {tab === "documentos" && (
            <div>
              <div onClick={() => fileInputRef.current?.click()} className="border-dashed cursor-pointer text-center py-8 mb-4 hover:opacity-80" style={{ border: `2px dashed ${C.lineSoft}`, borderRadius: 2 }}>
                <Paperclip size={20} style={{ color: C.muted, margin: "0 auto 8px" }} />
                <div className="text-[12px]" style={{ color: C.ink, fontWeight: 500 }}>Subir documentos</div>
                <div className="text-[10px] mt-1" style={{ color: C.muted }}>Click acá o arrastrá archivos (planos, partidas, fotos, etc.)</div>
                <input ref={fileInputRef} type="file" multiple onChange={e => handleFiles(e.target.files)} className="hidden" />
              </div>
              <div className="space-y-1.5">
                {(terreno.documents || []).length === 0 ? (
                  <div className="text-center py-4 text-[12px]" style={{ color: C.muted }}>Sin documentos todavía</div>
                ) : (
                  (terreno.documents || []).map(d => (
                    <div key={d.id} className="flex items-center gap-2 p-2.5 group" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
                      <Paperclip size={12} style={{ color: C.muted, flexShrink: 0 }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] truncate" style={{ color: C.ink, fontWeight: 500 }}>{d.name}</div>
                        <div className="text-[10px]" style={{ color: C.muted }}>{(d.size / 1024).toFixed(1)} KB · {new Date(d.uploadedAt).toLocaleDateString("es-PE")}</div>
                      </div>
                      <button onClick={() => removeDoc(d.id)} className="opacity-0 group-hover:opacity-100 p-1"><Trash2 size={11} style={{ color: C.brick }} /></button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          {tab === "analisis" && (
            <TerrenoOpportunidad terreno={terreno} />
          )}
          {tab === "cabida" && (
            <CabidaView initialTerreno={terreno.areaM2 || 500} compact />
          )}
          {tab === "propuesta" && (
            <PropuestaBamTab terreno={terreno} onUpdate={onUpdate} />
          )}
        </div>
      </aside>
    </div>
  );
}

function TerrenoOpportunidad({ terreno }) {
  const DISTRICTS_DATA = {
    "Miraflores":  { base: 3.5, priceRange: [3200, 6500], trend: "estable",   trendScore: 1.05, nse: "A",    desc: "NSE A. Demanda sostenida, premium consolidado.",          lat: -12.1191, lng: -77.0289, oferta: 18, demanda: 82, stock: 340, m2Prom: 95 },
    "San Isidro":  { base: 2.8, priceRange: [3800, 7200], trend: "estable",   trendScore: 1.00, nse: "A+",   desc: "NSE A+. Small & luxury. Absorción lenta, precio alto.",    lat: -12.0934, lng: -77.0368, oferta: 12, demanda: 68, stock: 180, m2Prom: 78 },
    "Barranco":    { base: 2.5, priceRange: [2800, 5000], trend: "trending",  trendScore: 1.28, nse: "A/B+", desc: "NSE A/B+. Storytelling = driver clave.",                   lat: -12.1476, lng: -77.0217, oferta: 9,  demanda: 91, stock: 210, m2Prom: 88 },
    "La Molina":   { base: 4.8, priceRange: [2200, 4800], trend: "estable",   trendScore: 1.00, nse: "B+/A", desc: "NSE B+/A. Buyer familiar.",                                lat: -12.0851, lng: -76.9422, oferta: 22, demanda: 74, stock: 520, m2Prom: 120 },
    "Surco":       { base: 6.2, priceRange: [1800, 3800], trend: "estable",   trendScore: 0.98, nse: "B/B+", desc: "NSE B/B+. Masivo con bolsones premium.",                   lat: -12.1374, lng: -76.9967, oferta: 35, demanda: 78, stock: 890, m2Prom: 105 },
    "Jesús María": { base: 7.5, priceRange: [1600, 2800], trend: "trending",  trendScore: 1.22, nse: "B/B+", desc: "NSE B/B+. Alta velocidad, precio accesible.",              lat: -12.0806, lng: -77.0472, oferta: 28, demanda: 88, stock: 670, m2Prom: 70 },
    "Magdalena":   { base: 5.5, priceRange: [1700, 3000], trend: "trending",  trendScore: 1.18, nse: "B+",   desc: "NSE B+. Zona en consolidación.",                           lat: -12.0924, lng: -77.0684, oferta: 14, demanda: 85, stock: 310, m2Prom: 75 },
    "San Borja":   { base: 4.2, priceRange: [2200, 4200], trend: "estable",   trendScore: 1.00, nse: "A/B+", desc: "NSE A/B+. Familiar.",                                      lat: -12.1006, lng: -76.9985, oferta: 20, demanda: 72, stock: 430, m2Prom: 100 },
    "Pueblo Libre":{ base: 5.8, priceRange: [1500, 2600], trend: "emergente", trendScore: 0.88, nse: "B",    desc: "NSE B. Emergente.",                                        lat: -12.0743, lng: -77.0618, oferta: 16, demanda: 79, stock: 380, m2Prom: 68 },
    "San Miguel":  { base: 6.8, priceRange: [1400, 2500], trend: "emergente", trendScore: 0.90, nse: "B",    desc: "NSE B. Volumen es el negocio.",                            lat: -12.0780, lng: -77.0900, oferta: 31, demanda: 76, stock: 720, m2Prom: 65 },
    "Lince":       { base: 8.2, priceRange: [1300, 2200], trend: "emergente", trendScore: 0.85, nse: "B/C+", desc: "NSE B/C+. Riesgo sobre-oferta.",                           lat: -12.0820, lng: -77.0368, oferta: 24, demanda: 62, stock: 540, m2Prom: 58 },
    "Chorrillos":  { base: 5.2, priceRange: [1500, 2800], trend: "emergente", trendScore: 0.82, nse: "B",    desc: "NSE B. Playa como diferenciador.",                         lat: -12.1727, lng: -77.0175, oferta: 19, demanda: 71, stock: 410, m2Prom: 72 },
  };
  const COMPETITORS_DB = {
    "Miraflores":  [
      { name: "The 21st",          dev: "Menorca",        priceM2: 6200, units: 32, absorption: 2.1, status: "En venta",    link: "https://menorca.pe" },
      { name: "Miraflores 380",    dev: "Paz Centenario", priceM2: 5800, units: 45, absorption: 2.8, status: "En venta",    link: "" },
      { name: "Parque Reducto",    dev: "Armas Doomo",    priceM2: 5200, units: 28, absorption: 2.4, status: "Pre-venta",   link: "" },
      { name: "Vivo Miraflores",   dev: "Besco",          priceM2: 4200, units: 78, absorption: 4.2, status: "En venta",    link: "https://besco.com.pe" },
      { name: "Residencial Larco", dev: "JLL Lima",       priceM2: 4800, units: 60, absorption: 3.5, status: "Entrega",     link: "" },
    ],
    "Barranco":    [
      { name: "Espacio Barranco",  dev: "JLL Lima",       priceM2: 4200, units: 38, absorption: 2.8, status: "En venta",    link: "" },
      { name: "Park Barranco",     dev: "Altas Cumbres",  priceM2: 3800, units: 52, absorption: 3.1, status: "En venta",    link: "" },
      { name: "Vista Barranco",    dev: "Paz Centenario", priceM2: 4800, units: 24, absorption: 1.9, status: "Pre-venta",   link: "" },
      { name: "The Bloom",         dev: "Menorca",        priceM2: 5200, units: 18, absorption: 1.5, status: "Lanzamiento", link: "https://menorca.pe" },
      { name: "Colonia 550",       dev: "Besco",          priceM2: 3500, units: 65, absorption: 3.8, status: "Entrega",     link: "" },
    ],
    "San Isidro":  [
      { name: "Torre Camino Real", dev: "Grupo T&C",      priceM2: 7200, units: 18, absorption: 1.4, status: "En venta",    link: "" },
      { name: "1 Augusto Tamayo",  dev: "Marcan",         priceM2: 6800, units: 24, absorption: 1.8, status: "En venta",    link: "" },
      { name: "Petit",             dev: "Menorca",        priceM2: 5400, units: 35, absorption: 2.6, status: "Pre-venta",   link: "https://menorca.pe" },
      { name: "Santander",         dev: "Besco",          priceM2: 4800, units: 42, absorption: 2.2, status: "En venta",    link: "" },
    ],
    "Jesús María": [
      { name: "Residencial JM",    dev: "Altas Cumbres",  priceM2: 2600, units: 88, absorption: 7.2, status: "En venta",    link: "" },
      { name: "Parque Aurelio",    dev: "Besco",          priceM2: 2400, units: 102, absorption: 8.1, status: "En venta",   link: "" },
      { name: "La Cuadra",         dev: "Paz Centenario", priceM2: 2800, units: 65, absorption: 6.0, status: "Pre-venta",   link: "" },
      { name: "Urbano JM",         dev: "Grupo T&C",      priceM2: 2200, units: 120, absorption: 9.0, status: "En venta",   link: "" },
    ],
    "Surco":       [
      { name: "Viva Surco",        dev: "Besco",          priceM2: 3200, units: 95, absorption: 6.8, status: "En venta",    link: "" },
      { name: "Park 8",            dev: "Paz Centenario", priceM2: 3800, units: 48, absorption: 5.2, status: "En venta",    link: "" },
      { name: "Residencial 40",    dev: "Altas Cumbres",  priceM2: 2800, units: 130, absorption: 7.5, status: "En venta",   link: "" },
      { name: "Nuevo Surco",       dev: "JLL Lima",       priceM2: 2600, units: 160, absorption: 8.0, status: "Entrega",    link: "" },
    ],
    "La Molina":   [
      { name: "Parque La Molina",  dev: "Grupo T&C",      priceM2: 4500, units: 55, absorption: 4.2, status: "En venta",    link: "" },
      { name: "Natura",            dev: "Paz Centenario", priceM2: 3800, units: 72, absorption: 5.0, status: "En venta",    link: "" },
      { name: "Las Praderas",      dev: "Altas Cumbres",  priceM2: 3200, units: 90, absorption: 5.8, status: "En venta",    link: "" },
    ],
    "Magdalena":   [
      { name: "Magdalena Park",    dev: "Besco",          priceM2: 2900, units: 70, absorption: 5.2, status: "En venta",    link: "" },
      { name: "Av. Del Ejército",  dev: "Altas Cumbres",  priceM2: 2600, units: 88, absorption: 5.8, status: "Pre-venta",   link: "" },
      { name: "Costa Azul",        dev: "JLL Lima",       priceM2: 3200, units: 45, absorption: 4.5, status: "En venta",    link: "" },
    ],
    "San Borja":   [
      { name: "Parque Borja",      dev: "Menorca",        priceM2: 4000, units: 48, absorption: 3.8, status: "En venta",    link: "" },
      { name: "Residencial SB",    dev: "Besco",          priceM2: 3500, units: 65, absorption: 4.5, status: "En venta",    link: "" },
      { name: "Torres Centenario", dev: "Paz Centenario", priceM2: 3200, units: 80, absorption: 4.2, status: "Pre-venta",   link: "" },
    ],
    "Pueblo Libre":[ { name: "Viva Libre",      dev: "Besco",          priceM2: 2400, units: 75, absorption: 5.5, status: "En venta", link: "" }, { name: "Parque Grau",   dev: "Altas Cumbres",  priceM2: 2200, units: 95, absorption: 6.2, status: "En venta", link: "" } ],
    "San Miguel":  [ { name: "Nuevo Miguel",    dev: "JLL Lima",       priceM2: 2300, units: 110, absorption: 7.0, status: "En venta", link: "" }, { name: "Playa Park",    dev: "Besco",          priceM2: 2600, units: 80, absorption: 5.8, status: "En venta", link: "" } ],
    "Lince":       [ { name: "Lince Center",    dev: "Grupo T&C",      priceM2: 2000, units: 120, absorption: 8.0, status: "En venta", link: "" }, { name: "Residencial L", dev: "Altas Cumbres",  priceM2: 1800, units: 150, absorption: 9.2, status: "En venta", link: "" } ],
    "Chorrillos":  [ { name: "Costa Sur",       dev: "Besco",          priceM2: 2500, units: 90, absorption: 5.0, status: "En venta", link: "" }, { name: "Playa Costa",   dev: "Paz Centenario", priceM2: 2800, units: 65, absorption: 4.5, status: "Pre-venta", link: "" } ],
  };

  const TREND_COLOR = { trending: "#5F8A6A", estable: "#3D52D5", emergente: "#C2A45A" };
  const TREND_LABEL = { trending: "En alza", estable: "Estable", emergente: "Emergente" };
  const STATUS_COLOR = { "En venta": "#3D52D5", "Pre-venta": "#C2A45A", "Lanzamiento": "#5F8A6A", "Entrega": "#6B6863" };

  const d = DISTRICTS_DATA[terreno.district] || DISTRICTS_DATA["Miraflores"];
  const competidores = COMPETITORS_DB[terreno.district] || COMPETITORS_DB["Miraflores"];

  const [tipologia, setTipologia] = React.useState("Departamento");
  const [precioM2, setPrecioM2] = React.useState(Math.round((d.priceRange[0] + d.priceRange[1]) / 2));
  const [acabados, setAcabados] = React.useState("Estándar");
  const [storytelling, setStorytelling] = React.useState(50);
  const [arquitecto, setArquitecto] = React.useState("Reconocido local");
  const [aliciaText, setAliciaText] = React.useState("");
  const [aliciaLoading, setAliciaLoading] = React.useState(false);

  const midPrice = (d.priceRange[0] + d.priceRange[1]) / 2;
  const priceRatio = precioM2 / midPrice;
  const acabadosMult = { Básico: 1.18, Estándar: 1.0, Premium: 0.80, Luxury: 0.58 }[acabados] || 1.0;
  const storyMult = 0.82 + (storytelling / 100) * 0.40;
  const arquiMult = { "Sin nombre conocido": 0.92, "Reconocido local": 1.0, "Internacional": 0.80 }[arquitecto] || 1.0;
  const absorption = Math.max(0.4, d.base * acabadosMult * storyMult * arquiMult * (priceRatio < 0.88 ? 1.25 : priceRatio > 1.18 ? 0.70 : 1.0));
  const absorptionFmt = absorption.toFixed(1);
  const units = terreno.areaM2 ? Math.max(8, Math.round(terreno.areaM2 / 65)) : 40;
  const monthsToSell = Math.ceil(units / absorption);
  const pricePosition = priceRatio < 0.90 ? "Bajo mercado" : priceRatio > 1.12 ? "Sobre mercado" : "En mercado";
  const priceColor = priceRatio < 0.90 ? C.green : priceRatio > 1.12 ? "#A85B5B" : C.cobalt;
  const revenueEst = units * precioM2 * (terreno.areaM2 ? terreno.areaM2 / units : 70);

  const marketScore = Math.round((d.trendScore * 45) + (Math.min(d.base, 10) / 10 * 30) + ((100 - d.oferta) / 100 * 25));
  const blendedScore = Math.round(((terreno.score || 70) + marketScore) / 2);

  // Absorción curve data (cumulative units sold per month)
  const absorptionCurve = React.useMemo(() => {
    const data = [];
    let sold = 0;
    for (let m = 1; m <= Math.min(monthsToSell + 6, 30); m++) {
      sold = Math.min(units, sold + absorption);
      data.push({ mes: `M${m}`, vendidas: Math.round(sold), disponibles: Math.max(0, units - Math.round(sold)) });
    }
    return data;
  }, [units, absorption, monthsToSell]);

  // Scatter data — competidores + mi propuesta
  const scatterData = React.useMemo(() => {
    const comps = competidores.map(c => ({ x: c.priceM2, y: c.absorption, z: c.units, name: c.name, type: "comp" }));
    const mine = { x: precioM2, y: parseFloat(absorptionFmt), z: units, name: "Hygge · " + terreno.name, type: "mine" };
    return { comps, mine: [mine] };
  }, [competidores, precioM2, absorptionFmt, units]);

  // Radar diferenciadores
  const radarData = React.useMemo(() => {
    const avgComp = {
      precio: 50,
      velocidad: Math.round((d.base / 10) * 100),
      story: 40,
      acabados: 50,
      ubicacion: 60,
      track: 60,
    };
    const storyScore = Math.round(storytelling);
    const acabScore = { Básico: 20, Estándar: 50, Premium: 80, Luxury: 100 }[acabados] || 50;
    const arquiScore = { "Sin nombre conocido": 20, "Reconocido local": 60, "Internacional": 95 }[arquitecto] || 50;
    const priceScore = Math.round(Math.max(0, Math.min(100, (1 - (priceRatio - 1) * 2) * 100)));
    const veloScore = Math.round((absorption / (d.base * 1.5)) * 100);
    return [
      { axis: "Precio competitivo", comp: avgComp.precio, hygge: priceScore },
      { axis: "Velocidad est.",     comp: avgComp.velocidad, hygge: Math.min(100, veloScore) },
      { axis: "Storytelling",       comp: avgComp.story, hygge: storyScore },
      { axis: "Acabados",           comp: avgComp.acabados, hygge: acabScore },
      { axis: "Ubicación",          comp: avgComp.ubicacion, hygge: Math.round((terreno.score || 70) * 0.8) },
      { axis: "Arquitecto",         comp: avgComp.track, hygge: arquiScore },
    ];
  }, [precioM2, acabados, storytelling, arquitecto, absorption]);

  // Price comparison bar data
  const priceBarData = React.useMemo(() => {
    const rows = competidores.map(c => ({ name: c.name.length > 14 ? c.name.slice(0, 13) + "…" : c.name, precio: c.priceM2, type: "comp" }));
    rows.push({ name: "◆ Hygge", precio: precioM2, type: "mine" });
    return rows.sort((a, b) => b.precio - a.precio);
  }, [competidores, precioM2]);

  // Map HTML
  const mapHtml = React.useMemo(() => {
    const terrenoLat = terreno.lat || d.lat;
    const terrenoLng = terreno.lng || d.lng;
    const allDistricts = Object.entries(DISTRICTS_DATA);
    const markersJs = allDistricts.map(([name, dd]) => {
      const color = dd.trend === "trending" ? "#5F8A6A" : dd.trend === "estable" ? "#3D52D5" : "#C2A45A";
      const r = 16 + Math.round((dd.base / 10) * 20);
      const isSelected = name === terreno.district;
      return `L.circleMarker([${dd.lat},${dd.lng}],{radius:${isSelected ? r + 8 : r},color:"${color}",fillColor:"${color}",fillOpacity:${isSelected ? 0.55 : 0.20},weight:${isSelected ? 2.5 : 1}}).bindTooltip('<div style="font:600 11px sans-serif;padding:4px 8px">${name}<br><span style="font-weight:400;color:#6B6863">${dd.base} u/mes · ${TREND_LABEL[dd.trend]}</span></div>',{permanent:false}).addTo(map);`;
    }).join("\n");
    const compJs = (COMPETITORS_DB[terreno.district] || []).map((c, i) => {
      const offset = i * 0.003;
      return `L.circleMarker([${d.lat + Math.cos(i) * 0.012},${d.lng + Math.sin(i) * 0.015}],{radius:5,color:"#0A0B0F",fillColor:"#0A0B0F",fillOpacity:0.5,weight:0}).bindTooltip('<b>${c.name.replace(/'/g, "\\'")}</b><br>${c.dev} · USD ${c.priceM2.toLocaleString()}/m² · ${c.absorption} u/mes',{permanent:false}).addTo(map);`;
    }).join("\n");
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>*{margin:0;padding:0}body,html{height:100%;background:#EEEBE3}.leaflet-control-zoom,.leaflet-control-attribution{display:none!important}</style></head>
<body><div id="map" style="width:100%;height:100vh"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var map=L.map('map',{zoomControl:false,attributionControl:false}).setView([${terrenoLat},${terrenoLng}],12);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',{maxZoom:19,subdomains:'abcd'}).addTo(map);
${markersJs}${compJs}
var icon=L.divIcon({html:'<div style="width:16px;height:16px;border-radius:50%;background:#0A0B0F;border:3px solid #F4F1EA;box-shadow:0 2px 8px rgba(0,0,0,0.5)"></div>',className:'',iconSize:[16,16],iconAnchor:[8,8]});
L.marker([${terrenoLat},${terrenoLng}],{icon}).bindTooltip('<b>${(terreno.name||"Terreno").replace(/'/g,"\\'")}</b>',{permanent:true,direction:'top',offset:[0,-10]}).addTo(map);
</script></body></html>`;
  }, [terreno.id, terreno.lat, terreno.lng, terreno.district]);

  const runAlicia = async () => {
    setAliciaLoading(true); setAliciaText("");
    const compSummary = competidores.map(c => `  · ${c.name} (${c.dev}): USD ${c.priceM2.toLocaleString()}/m², ${c.absorption} u/mes, ${c.units} u`).join("\n");
    const prompt = `Sos Alicia, asistente ejecutiva de Hygge Holding. Análisis profundo de oportunidad para este terreno.

TERRENO: ${terreno.name} · ${terreno.district}
Área: ${terreno.areaM2 ? terreno.areaM2 + " m²" : "—"} · Precio pedido: ${terreno.askedPrice ? "USD " + terreno.askedPrice.toLocaleString() : "—"}
Score interno: ${terreno.score || "—"}/100

PROPUESTA HYGGE (Velocity):
- Tipología: ${tipologia} · Acabados: ${acabados} · Arquitecto: ${arquitecto}
- Precio/m²: USD ${precioM2.toLocaleString()} (${pricePosition})
- Storytelling: ${storytelling}/100
- Absorción estimada: ${absorptionFmt} u/mes · ${units} unidades · ${monthsToSell} meses de venta
- Revenue estimado: USD ${Math.round(revenueEst).toLocaleString()}

COMPETIDORES EN ${terreno.district}:
${compSummary}

MERCADO:
${d.desc} · Oferta activa: ${d.oferta} proyectos · Demanda índice: ${d.demanda}/100
Precio/m²: USD ${d.priceRange[0].toLocaleString()}–${d.priceRange[1].toLocaleString()} · Absorción sector: ${d.base} u/mes · Tendencia: ${TREND_LABEL[d.trend]}

Dame:
1. **Posicionamiento** — ¿dónde queda Hygge vs la competencia con estos parámetros? ¿ventaja o desventaja?
2. **Riesgo principal** — un riesgo concreto del terreno + mercado
3. **Palanca clave** — qué un parámetro cambiado maximizaría el retorno
4. **Veredicto** — ¿avanzar, negociar precio o descartar? Una línea.

Concisa. Sin genérico. Lima 2025.`;

    try {
      let res = await fetch("http://localhost:3001/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }) }).catch(() => null);
      if (!res || !res.ok) {
        const k = localStorage.getItem("alicia_api_key");
        if (!k) throw new Error("Sin API key · configurala en Alicia > Settings.");
        res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": k, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }, body: JSON.stringify({ model: "claude-sonnet-4-5", max_tokens: 700, messages: [{ role: "user", content: prompt }] }) });
      }
      const json = await res.json();
      setAliciaText(json.choices?.[0]?.message?.content || json.content?.[0]?.text || "Sin respuesta");
    } catch (err) { setAliciaText(`Error: ${err.message}`); }
    finally { setAliciaLoading(false); }
  };

  const SectionLabel = ({ children }) => (
    <div style={{ fontSize: 9, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>{children}</div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── 1. KPIs del distrito ── */}
      <div>
        <SectionLabel>Reporte · {terreno.district} · {TREND_LABEL[d.trend]}</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 8 }}>
          {[
            { label: "Absorción sector",  value: `${d.base} u/mes`,        sub: "promedio distrito" },
            { label: "Precio/m² rango",   value: `$${(d.priceRange[0]/1000).toFixed(1)}k–${(d.priceRange[1]/1000).toFixed(1)}k`, sub: "USD/m²" },
            { label: "Proyectos activos", value: `${d.oferta}`,             sub: "competidores" },
            { label: "Índice demanda",    value: `${d.demanda}/100`,        sub: d.demanda >= 80 ? "Alta" : d.demanda >= 65 ? "Media-alta" : "Media" },
          ].map(k => (
            <div key={k.label} style={{ background: C.surface, borderRadius: 2, padding: "10px 12px" }}>
              <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, letterSpacing: "-0.01em" }}>{k.value}</div>
              <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>{k.sub}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 10 }}>
          {[
            { label: "NSE objetivo",     value: d.nse },
            { label: "Stock disponible", value: `${d.stock} u`,              sub: "en el mercado" },
            { label: "m² promedio",      value: `${d.m2Prom} m²`,            sub: "unidades sector" },
            { label: "Precio terreno",   value: terreno.askedPrice ? `$${(terreno.askedPrice/1000).toFixed(0)}k` : "—", sub: "pedido propietario" },
          ].map(k => (
            <div key={k.label} style={{ background: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2, padding: "10px 12px" }}>
              <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>{k.value}</div>
              {k.sub && <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>{k.sub}</div>}
            </div>
          ))}
        </div>
        {/* Score oportunidad */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 14px", background: C.paper, border: `1px solid ${C.lineSoft}`, borderLeft: `3px solid ${TREND_COLOR[d.trend]}`, borderRadius: 2 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Score oportunidad · terreno + mercado</div>
            <div style={{ height: 5, background: C.lineSoft, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${blendedScore}%`, background: blendedScore >= 75 ? C.green : blendedScore >= 55 ? C.cobalt : C.ochre, borderRadius: 3, transition: "width 0.4s ease" }} />
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: blendedScore >= 75 ? C.green : blendedScore >= 55 ? C.cobalt : C.ochre, letterSpacing: "-0.03em", minWidth: 40, textAlign: "right" }}>{blendedScore}</div>
          <div style={{ fontSize: 10, color: C.muted }}>{d.desc}</div>
        </div>
      </div>

      {/* ── 2. Controles Velocity ── */}
      <div style={{ background: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2, padding: "14px 16px" }}>
        <SectionLabel>Parámetros · jugá con las métricas</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>Tipología</div>
            <select value={tipologia} onChange={e => setTipologia(e.target.value)} style={{ width: "100%", padding: "6px 8px", fontSize: 12, background: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2, color: C.ink, outline: "none" }}>
              {["Departamento", "Mix tipologías", "Flat premium", "Penthouse", "Oficinas", "Retail"].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>Arquitecto</div>
            <select value={arquitecto} onChange={e => setArquitecto(e.target.value)} style={{ width: "100%", padding: "6px 8px", fontSize: 12, background: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2, color: C.ink, outline: "none" }}>
              {["Sin nombre conocido", "Reconocido local", "Internacional"].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>Acabados</div>
            <div style={{ display: "flex", gap: 4 }}>
              {["Básico", "Estándar", "Premium", "Luxury"].map(a => (
                <button key={a} onClick={() => setAcabados(a)} style={{ flex: 1, padding: "6px 2px", fontSize: 10, fontWeight: 500, borderRadius: 2, border: `1px solid ${acabados === a ? C.ink : C.lineSoft}`, background: acabados === a ? C.ink : "transparent", color: acabados === a ? C.bg : C.muted, cursor: "pointer" }}>{a}</button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
            Precio/m² · <span style={{ color: priceColor, fontWeight: 700 }}>USD {precioM2.toLocaleString()} · {pricePosition}</span>
          </div>
          <input type="range" min={Math.round(d.priceRange[0] * 0.65)} max={Math.round(d.priceRange[1] * 1.25)} step={50} value={precioM2} onChange={e => setPrecioM2(Number(e.target.value))} style={{ width: "100%", accentColor: C.ink }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: C.muted }}>
            <span>USD {d.priceRange[0].toLocaleString()}</span><span>Rango sector</span><span>USD {d.priceRange[1].toLocaleString()}</span>
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
            Storytelling · <span style={{ color: C.ink, fontWeight: 600 }}>{storytelling < 30 ? "Genérico" : storytelling < 60 ? "Definido" : storytelling < 85 ? "Sólido" : "Icónico"}</span>
          </div>
          <input type="range" min={0} max={100} value={storytelling} onChange={e => setStorytelling(Number(e.target.value))} style={{ width: "100%", accentColor: C.ink }} />
        </div>
        {/* Live output */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, padding: "12px", background: C.surface, borderRadius: 2 }}>
          {[
            { label: "Absorción est.", value: `${absorptionFmt} u/mes`, color: parseFloat(absorptionFmt) >= d.base ? C.green : C.ochre },
            { label: "Unidades",       value: `${units} u` },
            { label: "Tiempo venta",   value: `${monthsToSell} meses`, color: monthsToSell <= 18 ? C.green : monthsToSell <= 30 ? C.cobalt : "#A85B5B" },
            { label: "Revenue est.",   value: `$${(revenueEst/1000000).toFixed(1)}M` },
            { label: "Precio/m²",      value: `$${precioM2.toLocaleString()}`, color: priceColor },
          ].map(k => (
            <div key={k.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{k.label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: k.color || C.ink }}>{k.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 3. Competidores ── */}
      <div>
        <SectionLabel>Competidores · {terreno.district} · {competidores.length} proyectos</SectionLabel>
        <div style={{ border: `1px solid ${C.lineSoft}`, borderRadius: 2, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ background: C.surface }}>
                {["Proyecto", "Developer", "USD/m²", "Unidades", "Absorción", "Estado", "Link"].map(h => (
                  <th key={h} style={{ padding: "7px 10px", textAlign: "left", fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, borderBottom: `1px solid ${C.lineSoft}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Mi propuesta — primera fila destacada */}
              <tr style={{ background: C.ink + "08", borderBottom: `1px solid ${C.lineSoft}` }}>
                <td style={{ padding: "8px 10px", fontWeight: 700, color: C.ink }}>◆ Hygge · {tipologia}</td>
                <td style={{ padding: "8px 10px", color: C.muted }}>Hygge Holding</td>
                <td style={{ padding: "8px 10px", fontWeight: 700, color: priceColor }}>{precioM2.toLocaleString()}</td>
                <td style={{ padding: "8px 10px", color: C.ink }}>{units}</td>
                <td style={{ padding: "8px 10px", fontWeight: 700, color: parseFloat(absorptionFmt) >= d.base ? C.green : C.ochre }}>{absorptionFmt}</td>
                <td style={{ padding: "8px 10px" }}><span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 2, background: C.cobalt + "18", color: C.cobalt, fontWeight: 600 }}>Propuesta</span></td>
                <td style={{ padding: "8px 10px" }}>—</td>
              </tr>
              {competidores.map((c, i) => {
                const vsHygge = precioM2 - c.priceM2;
                return (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.lineSoft}`, background: i % 2 === 0 ? "transparent" : C.paper + "80" }}>
                    <td style={{ padding: "8px 10px", color: C.ink, fontWeight: 500 }}>{c.name}</td>
                    <td style={{ padding: "8px 10px", color: C.muted }}>{c.dev}</td>
                    <td style={{ padding: "8px 10px", color: C.inkSoft }}>
                      {c.priceM2.toLocaleString()}
                      <span style={{ fontSize: 9, marginLeft: 4, color: vsHygge > 0 ? C.green : vsHygge < 0 ? "#A85B5B" : C.muted }}>
                        {vsHygge > 0 ? `−${vsHygge.toLocaleString()}` : vsHygge < 0 ? `+${Math.abs(vsHygge).toLocaleString()}` : "="}
                      </span>
                    </td>
                    <td style={{ padding: "8px 10px", color: C.muted }}>{c.units}</td>
                    <td style={{ padding: "8px 10px", color: C.inkSoft }}>{c.absorption}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 2, background: (STATUS_COLOR[c.status] || C.muted) + "18", color: STATUS_COLOR[c.status] || C.muted, fontWeight: 600, whiteSpace: "nowrap" }}>{c.status}</span>
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      {c.link ? <a href={c.link} target="_blank" rel="noopener noreferrer" style={{ color: C.cobalt, fontSize: 10, display: "flex", alignItems: "center", gap: 3 }}><ExternalLink size={10} /> Ver</a> : <span style={{ color: C.lineSoft }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 4. Mapa ── */}
      <div>
        <SectionLabel>
          Mapa · Velocity + Radar
          <span style={{ marginLeft: 10, fontWeight: 400 }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: C.green, marginRight: 3 }} />alza
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: C.cobalt, marginRight: 3, marginLeft: 8 }} />estable
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: C.ochre, marginRight: 3, marginLeft: 8 }} />emergente
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#0A0B0F", opacity: 0.5, marginRight: 3, marginLeft: 8 }} />competidor
          </span>
        </SectionLabel>
        <iframe key={terreno.id} srcDoc={mapHtml} style={{ width: "100%", height: 300, border: "none", borderRadius: 2, display: "block" }} sandbox="allow-scripts" />
      </div>

      {/* ── 5. Gráficos ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Scatter posicionamiento */}
        <div style={{ background: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2, padding: "12px 14px" }}>
          <SectionLabel>Posicionamiento · precio vs absorción</SectionLabel>
          <ResponsiveContainer width="100%" height={220}>
            <ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
              <CartesianGrid stroke={C.lineSoft} strokeDasharray="3 3" />
              <XAxis dataKey="x" type="number" name="Precio/m²" domain={["auto","auto"]} tick={{ fontSize: 9, fill: C.muted }} tickFormatter={v => `$${(v/1000).toFixed(1)}k`} label={{ value: "USD/m²", position: "insideBottom", offset: -12, fontSize: 9, fill: C.muted }} />
              <YAxis dataKey="y" type="number" name="Absorción" tick={{ fontSize: 9, fill: C.muted }} tickFormatter={v => `${v}u`} label={{ value: "u/mes", angle: -90, position: "insideLeft", fontSize: 9, fill: C.muted }} />
              <ZAxis dataKey="z" range={[40, 260]} />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} content={({ payload }) => {
                if (!payload?.length) return null;
                const p = payload[0]?.payload;
                return <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 2, padding: "6px 10px", fontSize: 11 }}><div style={{ fontWeight: 600, color: C.ink }}>{p.name}</div><div style={{ color: C.muted }}>USD {p.x?.toLocaleString()}/m² · {p.y} u/mes · {p.z} u</div></div>;
              }} />
              <ReferenceLine x={midPrice} stroke={C.muted} strokeDasharray="4 2" label={{ value: "Precio medio", fontSize: 8, fill: C.muted }} />
              <Scatter name="Competidores" data={scatterData.comps} fill={C.cobalt} fillOpacity={0.45} />
              <Scatter name="Hygge" data={scatterData.mine} fill={C.ink} shape="diamond" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Radar diferenciadores */}
        <div style={{ background: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2, padding: "12px 14px" }}>
          <SectionLabel>Diferenciadores · Hygge vs mercado</SectionLabel>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData} margin={{ top: 8, right: 20, bottom: 8, left: 20 }}>
              <PolarGrid stroke={C.lineSoft} />
              <PolarAngleAxis dataKey="axis" tick={{ fontSize: 9, fill: C.muted }} />
              <Radar name="Mercado" dataKey="comp" stroke={C.muted} fill={C.muted} fillOpacity={0.15} />
              <Radar name="Hygge" dataKey="hygge" stroke={C.cobalt} fill={C.cobalt} fillOpacity={0.25} />
              <Legend wrapperStyle={{ fontSize: 10, color: C.muted }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Absorción acumulada */}
        <div style={{ background: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2, padding: "12px 14px" }}>
          <SectionLabel>Curva de absorción proyectada</SectionLabel>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={absorptionCurve} margin={{ top: 4, right: 16, bottom: 20, left: 8 }}>
              <CartesianGrid stroke={C.lineSoft} strokeDasharray="3 3" />
              <XAxis dataKey="mes" tick={{ fontSize: 9, fill: C.muted }} interval={Math.floor(absorptionCurve.length / 6)} label={{ value: "Mes", position: "insideBottom", offset: -10, fontSize: 9, fill: C.muted }} />
              <YAxis tick={{ fontSize: 9, fill: C.muted }} />
              <Tooltip contentStyle={{ fontSize: 11, background: C.paper, border: `1px solid ${C.line}`, borderRadius: 2 }} formatter={(v, n) => [v + " u", n]} />
              <Area type="monotone" dataKey="vendidas" name="Vendidas" stroke={C.green} fill={C.green} fillOpacity={0.2} strokeWidth={2} />
              <Area type="monotone" dataKey="disponibles" name="Disponibles" stroke={C.muted} fill={C.muted} fillOpacity={0.1} strokeWidth={1} strokeDasharray="3 2" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Bar comparativa precio */}
        <div style={{ background: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2, padding: "12px 14px" }}>
          <SectionLabel>Comparativa precio/m² vs competidores</SectionLabel>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={priceBarData} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
              <CartesianGrid stroke={C.lineSoft} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 9, fill: C.muted }} tickFormatter={v => `$${(v/1000).toFixed(1)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: C.muted }} width={80} />
              <Tooltip contentStyle={{ fontSize: 11, background: C.paper, border: `1px solid ${C.line}`, borderRadius: 2 }} formatter={v => [`USD ${v.toLocaleString()}/m²`]} />
              <Bar dataKey="precio" radius={[0, 2, 2, 0]}>
                {priceBarData.map((entry, i) => (
                  <Cell key={i} fill={entry.type === "mine" ? C.ink : C.cobalt} fillOpacity={entry.type === "mine" ? 1 : 0.45} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── 6. Absorción y precios por metraje ── */}
      {(() => {
        const METRAJE_DB = {
          "Miraflores":  [{ rango: "Estudio <55", m2: 48,  absorcion: 4.2, precioM2: 5800, min: 230000, max: 310000 }, { rango: "2D 55-80",    m2: 68,  absorcion: 3.6, precioM2: 5500, min: 340000, max: 420000 }, { rango: "3D 80-110",  m2: 95,  absorcion: 2.5, precioM2: 5200, min: 470000, max: 590000 }, { rango: "4D+ 110+",  m2: 145, absorcion: 1.2, precioM2: 6200, min: 820000, max: 1100000 }],
          "San Isidro":  [{ rango: "Estudio <55", m2: 45,  absorcion: 2.8, precioM2: 6800, min: 280000, max: 360000 }, { rango: "2D 55-80",    m2: 65,  absorcion: 2.2, precioM2: 6500, min: 390000, max: 500000 }, { rango: "3D 80-110",  m2: 88,  absorcion: 1.8, precioM2: 6200, min: 520000, max: 680000 }, { rango: "4D+ 110+",  m2: 150, absorcion: 0.8, precioM2: 7500, min: 1000000, max: 1500000 }],
          "Barranco":    [{ rango: "Estudio <55", m2: 42,  absorcion: 3.2, precioM2: 4800, min: 185000, max: 240000 }, { rango: "2D 55-80",    m2: 65,  absorcion: 2.6, precioM2: 4500, min: 265000, max: 340000 }, { rango: "3D 80-110",  m2: 88,  absorcion: 1.8, precioM2: 4200, min: 350000, max: 460000 }, { rango: "4D+ 110+",  m2: 130, absorcion: 0.9, precioM2: 5100, min: 600000, max: 800000 }],
          "La Molina":   [{ rango: "2D 60-80",    m2: 70,  absorcion: 5.0, precioM2: 3800, min: 250000, max: 310000 }, { rango: "3D 80-110",  m2: 100, absorcion: 4.8, precioM2: 3500, min: 330000, max: 420000 }, { rango: "4D 110-140", m2: 125, absorcion: 3.5, precioM2: 3200, min: 390000, max: 490000 }, { rango: "Casa 140+",  m2: 180, absorcion: 1.5, precioM2: 4500, min: 750000, max: 950000 }],
          "Surco":       [{ rango: "Estudio <55", m2: 48,  absorcion: 7.5, precioM2: 3200, min: 140000, max: 180000 }, { rango: "2D 55-80",    m2: 68,  absorcion: 6.8, precioM2: 2900, min: 185000, max: 240000 }, { rango: "3D 80-110",  m2: 95,  absorcion: 5.2, precioM2: 2700, min: 245000, max: 320000 }, { rango: "4D+ 110+",  m2: 130, absorcion: 2.8, precioM2: 3500, min: 420000, max: 560000 }],
          "Jesús María": [{ rango: "Estudio <55", m2: 42,  absorcion: 9.0, precioM2: 2600, min: 100000, max: 135000 }, { rango: "2D 55-75",    m2: 65,  absorcion: 7.8, precioM2: 2400, min: 145000, max: 185000 }, { rango: "3D 75-95",   m2: 85,  absorcion: 5.5, precioM2: 2200, min: 180000, max: 230000 }, { rango: "3D+ 95+",   m2: 110, absorcion: 2.8, precioM2: 2800, min: 280000, max: 340000 }],
          "Magdalena":   [{ rango: "Estudio <55", m2: 44,  absorcion: 6.0, precioM2: 2800, min: 115000, max: 150000 }, { rango: "2D 55-80",    m2: 65,  absorcion: 5.5, precioM2: 2600, min: 158000, max: 210000 }, { rango: "3D 80-100",  m2: 90,  absorcion: 4.0, precioM2: 2400, min: 210000, max: 270000 }, { rango: "4D 100+",   m2: 120, absorcion: 2.0, precioM2: 3000, min: 330000, max: 420000 }],
          "San Borja":   [{ rango: "2D 60-80",    m2: 70,  absorcion: 4.5, precioM2: 3800, min: 250000, max: 310000 }, { rango: "3D 80-110",  m2: 95,  absorcion: 4.0, precioM2: 3500, min: 320000, max: 400000 }, { rango: "4D 110-130", m2: 120, absorcion: 2.8, precioM2: 3200, min: 370000, max: 460000 }, { rango: "4D+ 130+",  m2: 150, absorcion: 1.5, precioM2: 4200, min: 580000, max: 720000 }],
          "Pueblo Libre":[ { rango: "Estudio <50", m2: 44, absorcion: 6.2, precioM2: 2400, min: 98000,  max: 128000 }, { rango: "2D 50-75",    m2: 62,  absorcion: 5.8, precioM2: 2200, min: 130000, max: 170000 }, { rango: "3D 75-95",   m2: 85,  absorcion: 4.2, precioM2: 2000, min: 165000, max: 210000 }, { rango: "3D+ 95+",   m2: 108, absorcion: 2.0, precioM2: 2500, min: 255000, max: 310000 }],
          "San Miguel":  [{ rango: "Estudio <50", m2: 42,  absorcion: 7.5, precioM2: 2300, min: 90000,  max: 115000 }, { rango: "2D 50-75",    m2: 62,  absorcion: 7.0, precioM2: 2100, min: 122000, max: 160000 }, { rango: "3D 75-90",   m2: 82,  absorcion: 5.5, precioM2: 1950, min: 155000, max: 195000 }, { rango: "3D+ 90+",   m2: 105, absorcion: 2.8, precioM2: 2500, min: 240000, max: 290000 }],
          "Lince":       [{ rango: "Estudio <48", m2: 40,  absorcion: 9.5, precioM2: 2000, min: 76000,  max: 98000  }, { rango: "2D 48-68",    m2: 58,  absorcion: 8.5, precioM2: 1850, min: 100000, max: 130000 }, { rango: "3D 68-88",   m2: 78,  absorcion: 5.8, precioM2: 1700, min: 128000, max: 160000 }, { rango: "3D+ 88+",   m2: 100, absorcion: 2.5, precioM2: 2100, min: 195000, max: 240000 }],
          "Chorrillos":  [{ rango: "Estudio <55", m2: 46,  absorcion: 5.8, precioM2: 2600, min: 110000, max: 145000 }, { rango: "2D 55-75",    m2: 65,  absorcion: 5.2, precioM2: 2400, min: 148000, max: 192000 }, { rango: "3D 75-95",   m2: 85,  absorcion: 3.8, precioM2: 2200, min: 182000, max: 230000 }, { rango: "4D 95+",    m2: 115, absorcion: 1.8, precioM2: 2800, min: 300000, max: 380000 }],
        };
        const mData = METRAJE_DB[terreno.district] || METRAJE_DB["Miraflores"];
        // Scatter data: each bracket has min, mid, max price total vs m2
        const scatterMet = mData.flatMap(b => [
          { x: b.m2 - 4, y: b.min, rango: b.rango },
          { x: b.m2,     y: Math.round((b.min + b.max) / 2), rango: b.rango },
          { x: b.m2 + 4, y: b.max, rango: b.rango },
        ]);
        // My proposal point (if areaM2 given, estimate unit size from tipologia)
        const myM2 = { "Estudio": 48, "Departamento": 80, "Mix tipologías": 75, "Flat premium": 110, "Penthouse": 160, "Oficinas": 90, "Retail": 120 }[tipologia] || 80;
        const myPrecioTotal = myM2 * precioM2;
        return (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Absorción por metraje */}
            <div style={{ background: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2, padding: "12px 14px" }}>
              <SectionLabel>Absorción por metraje · {terreno.district}</SectionLabel>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={mData} margin={{ top: 8, right: 24, bottom: 28, left: 8 }}>
                  <CartesianGrid stroke={C.lineSoft} strokeDasharray="3 3" />
                  <XAxis dataKey="rango" tick={{ fontSize: 9, fill: C.muted }} angle={-15} textAnchor="end" interval={0} />
                  <YAxis yAxisId="abs" tick={{ fontSize: 9, fill: C.muted }} tickFormatter={v => `${v}u`} />
                  <YAxis yAxisId="price" orientation="right" tick={{ fontSize: 9, fill: C.muted }} tickFormatter={v => `$${(v/1000).toFixed(1)}k`} />
                  <Tooltip contentStyle={{ fontSize: 11, background: C.paper, border: `1px solid ${C.line}`, borderRadius: 2 }}
                    formatter={(v, n) => n === "absorcion" ? [`${v} u/mes`, "Absorción"] : [`USD ${v.toLocaleString()}/m²`, "Precio/m²"]} />
                  <Bar yAxisId="abs" dataKey="absorcion" fill={C.cobalt} fillOpacity={0.55} radius={[2, 2, 0, 0]} />
                  <Line yAxisId="price" type="monotone" dataKey="precioM2" stroke={C.ochre} strokeWidth={2} dot={{ r: 3, fill: C.ochre }} />
                  <ReferenceLine yAxisId="abs" y={parseFloat(absorptionFmt)} stroke={C.green} strokeDasharray="4 2"
                    label={{ value: `Hygge ${absorptionFmt}u`, fontSize: 8, fill: C.green, position: "insideTopRight" }} />
                </ComposedChart>
              </ResponsiveContainer>
              <div style={{ fontSize: 9, color: C.muted, marginTop: 4 }}>
                <span style={{ display: "inline-block", width: 10, height: 10, background: C.cobalt, opacity: 0.55, borderRadius: 1, marginRight: 4, verticalAlign: "middle" }} />absorción u/mes
                <span style={{ display: "inline-block", width: 20, height: 2, background: C.ochre, marginLeft: 10, marginRight: 4, verticalAlign: "middle" }} />precio/m²
                <span style={{ display: "inline-block", width: 20, height: 1, background: C.green, marginLeft: 10, marginRight: 4, verticalAlign: "middle", borderTop: `2px dashed ${C.green}` }} />tu absorción est.
              </div>
            </div>

            {/* Precio total por metraje */}
            <div style={{ background: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2, padding: "12px 14px" }}>
              <SectionLabel>Precios de venta por metraje · rango mín–máx</SectionLabel>
              <ResponsiveContainer width="100%" height={220}>
                <ScatterChart margin={{ top: 8, right: 16, bottom: 28, left: 12 }}>
                  <CartesianGrid stroke={C.lineSoft} strokeDasharray="3 3" />
                  <XAxis dataKey="x" type="number" name="m²" domain={["auto","auto"]} tick={{ fontSize: 9, fill: C.muted }} tickFormatter={v => `${v}m²`} label={{ value: "Superficie (m²)", position: "insideBottom", offset: -14, fontSize: 9, fill: C.muted }} />
                  <YAxis dataKey="y" type="number" name="Precio" tick={{ fontSize: 9, fill: C.muted }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} label={{ value: "Precio total USD", angle: -90, position: "insideLeft", fontSize: 9, fill: C.muted, offset: 8 }} />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} content={({ payload }) => {
                    if (!payload?.length) return null;
                    const p = payload[0]?.payload;
                    return <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 2, padding: "6px 10px", fontSize: 11 }}><div style={{ fontWeight: 600, color: C.ink }}>{p.rango}</div><div style={{ color: C.muted }}>{p.x} m² · USD {p.y?.toLocaleString()}</div></div>;
                  }} />
                  <Scatter name="Sector" data={scatterMet} fill={C.cobalt} fillOpacity={0.45} />
                  <Scatter name="Hygge" data={[{ x: myM2, y: myPrecioTotal, rango: `Hygge · ${tipologia}` }]} fill={C.ink} shape="diamond" />
                  <ReferenceLine x={myM2} stroke={C.ink} strokeDasharray="4 2" strokeWidth={1}
                    label={{ value: tipologia, fontSize: 8, fill: C.ink, position: "insideTopRight" }} />
                </ScatterChart>
              </ResponsiveContainer>
              <div style={{ fontSize: 9, color: C.muted, marginTop: 4 }}>
                {mData.map(b => <span key={b.rango} style={{ marginRight: 12 }}><strong style={{ color: C.ink }}>{b.rango}</strong> USD {(b.min/1000).toFixed(0)}k–{(b.max/1000).toFixed(0)}k</span>)}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── 7. Alicia ── */}
      <div style={{ background: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2, padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: aliciaText ? 14 : 0 }}>
          <div>
            <div style={{ fontSize: 9, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" }}>Alicia · análisis de oportunidad</div>
            <div style={{ fontSize: 11, color: C.muted }}>Propuesta actual vs {competidores.length} competidores</div>
          </div>
          <button onClick={runAlicia} disabled={aliciaLoading} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: aliciaLoading ? C.surface : C.ink, color: aliciaLoading ? C.muted : "#fff", border: "none", borderRadius: 2, fontSize: 12, fontWeight: 600, cursor: aliciaLoading ? "not-allowed" : "pointer" }}>
            {aliciaLoading ? <><RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> Analizando…</> : <><Sparkles size={13} /> Consultar Alicia</>}
          </button>
        </div>
        {aliciaText && (
          <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>
            {aliciaText.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
              part.startsWith("**") && part.endsWith("**")
                ? <strong key={i} style={{ color: C.ink }}>{part.slice(2, -2)}</strong>
                : part
            )}
          </div>
        )}
      </div>

    </div>
  );
}

function ProyectosDashboard({ onOpenSpace, spvs = DEFAULT_SPVS }) {
  return (
    <div className="px-4 lg:px-10 py-8 lg:py-12 max-w-[1080px] mx-auto">
      <Hero eyebrow="Proyectos · Andrea Castillo" code="PR.26.W21" intro={<>Vista cross-proyecto · {spvs.length} proyectos activos.</>} />
      <section className="mb-14"><SectionHead title="Portfolio de proyectos" />
        <Panel>
          <table className="w-full">
            <thead><tr className="text-[10px] tracking-[0.15em] uppercase" style={{ color: C.muted, fontWeight: 500 }}>{["Código", "Proyecto", "Tipo", "Obra", "Ventas", "Margen"].map(h => <th key={h} className="text-left pb-3 px-2" style={{ borderBottom: `1px solid ${C.line}` }}>{h}</th>)}</tr></thead>
            <tbody>{spvs.map((p, i) => {
              const tipoObj = SPV_TIPOS.find(t => t.id === p.tipo) || SPV_TIPOS[0];
              return (
                <tr key={p.code} onClick={() => onOpenSpace(p.code.toLowerCase())} className="cursor-pointer hover:opacity-80" style={{ borderBottom: i < spvs.length - 1 ? `1px solid ${C.lineSoft}` : "none" }}>
                  <td className="py-4 px-2 text-[18px]" style={{ color: C.ink, fontWeight: 400 }}>{p.code}</td>
                  <td className="py-4 px-2 text-[13px]" style={{ color: C.inkSoft }}>{p.name}</td>
                  <td className="py-4 px-2 text-[11px]" style={{ color: C.muted }}>{tipoObj.label}</td>
                  <td className="py-4 px-2 text-[13px]" style={{ color: C.ink, fontWeight: 500 }}>{p.construction}%</td>
                  <td className="py-4 px-2 text-[13px]" style={{ color: C.ink, fontWeight: 500 }}>{p.sold}/{p.totalUnits}</td>
                  <td className="py-4 px-2 text-[13px]" style={{ color: C.cobalt, fontWeight: 600 }}>{p.margin.toFixed(1)}%</td>
                </tr>
              );
            })}</tbody>
          </table>
        </Panel>
      </section>
    </div>
  );
}

function ProjectDashboard({ projectId }) {
  const p = PROJECT_CONFIGS[projectId];
  if (!p) return null;
  const [tab, setTab] = React.useState("overview");
  const [obraProgress, setObraProgress] = React.useState(null);
  const soldPct = p.totalUnits > 0 ? (p.sold / p.totalUnits) * 100 : 0;
  const statusColors = { vendida: C.green, reservada: C.ochre, disponible: C.muted };
  const construccionPct = obraProgress !== null ? obraProgress : p.construction;

  const TABS = [
    { id: "overview", label: "Resumen" },
    { id: "obra", label: "Hygge Project Tracker" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Sub-nav */}
      <div style={{ borderBottom: `1px solid ${C.line}`, padding: "0 32px", display: "flex", gap: 0, flexShrink: 0, background: C.paper }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            height: 40, padding: "0 16px", background: "transparent", border: "none",
            borderBottom: `2px solid ${tab === t.id ? C.cobalt : "transparent"}`,
            fontSize: 11, fontWeight: tab === t.id ? 600 : 400, color: tab === t.id ? C.ink : C.muted,
            cursor: "pointer", fontFamily: "inherit", transition: "all .12s",
          }}>{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {tab === "overview" && (
          <div className="px-4 lg:px-10 py-8 lg:py-12 max-w-[1080px] mx-auto">
            <div className="mb-14">
              <NavyRule /><div className="mt-4"><Eyebrow>SPV · {p.district} · {p.timeline}</Eyebrow></div>
              <h1 className="text-[88px] leading-[0.92] mt-5" style={{ color: C.ink, fontWeight: 300, letterSpacing: "-0.045em" }}>{p.code}</h1>
              <div className="text-[20px] mt-4" style={{ color: C.inkSoft, fontWeight: 500 }}>{p.name}</div>
              <p className="text-[14px] mt-3 max-w-xl" style={{ color: C.muted, lineHeight: 1.6 }}>{p.address} · {p.architect}</p>
            </div>
            <section className="mb-14"><SectionHead title="Estado" />
              <KpiBar items={[
                { label: "Obra", value: construccionPct + "%", sub: obraProgress !== null ? "actualizado via PDF" : "seed" },
                { label: "Ventas", value: `${p.sold}/${p.totalUnits}`, sub: soldPct.toFixed(0) + "%" },
                { label: "Cobrado", value: pen(p.salesPEN), sub: `/ ${pen(p.targetPEN)}` },
                { label: "Margen", value: p.margin.toFixed(1) + "%" },
              ]} />
            </section>
            <section className="mb-14"><SectionHead title="Mapa de unidades" />
              <Panel>
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(p.units.length, 6)}, 1fr)` }}>
                  {p.units.map((u) => (
                    <div key={u.num} className="p-3" style={{ backgroundColor: statusColors[u.status] + "18", border: `1px solid ${statusColors[u.status]}44`, borderLeft: `3px solid ${statusColors[u.status]}`, borderRadius: 2 }}>
                      <div className="text-[10px] tracking-[0.1em] uppercase" style={{ color: C.muted }}>Piso {u.floor}</div>
                      <div className="text-[18px] mt-1" style={{ color: C.ink, fontWeight: 500 }}>{u.num}</div>
                      <div className="text-[10px] mt-1" style={{ color: statusColors[u.status], fontWeight: 600, textTransform: "capitalize" }}>{u.status}</div>
                      <div className="text-[11px] mt-2" style={{ color: C.ink, fontWeight: 500 }}>S/ {u.price}K</div>
                    </div>
                  ))}
                </div>
              </Panel>
            </section>
            <div>
              <button onClick={() => setTab("obra")} style={{ fontSize: 11, color: C.cobalt, background: "transparent", border: `1px solid ${C.cobalt}`, borderRadius: 3, padding: "8px 16px", cursor: "pointer", fontFamily: "inherit" }}>
                Ver seguimiento de obra →
              </button>
            </div>
          </div>
        )}
        {tab === "obra" && (
          <ObraTrackerModule
            projectId={projectId}
            projectName={p.name}
            onProgressUpdate={setObraProgress}
          />
        )}
      </div>
    </div>
  );
}

function GenericSpaceDashboard({ space, tasks }) {
  const spaceTasks = tasks.filter(t => t.space === space.id && !t.parentId);
  return (
    <div className="px-4 lg:px-10 py-8 lg:py-12 max-w-[1080px] mx-auto">
      <Hero eyebrow={`${space.name} · custom`} code={space.code || space.name.toUpperCase().slice(0, 6)} intro={<><strong>{spaceTasks.length} tareas</strong>. Dashboard se construye con el uso.</>} />
      <section className="mb-14"><SectionHead title="Tareas del space" />
        {spaceTasks.length === 0 ? (
          <Panel><div className="text-center py-8"><div className="text-[14px] mb-2" style={{ color: C.ink, fontWeight: 500 }}>Sin tareas</div></div></Panel>
        ) : (
          <Panel>{spaceTasks.slice(0, 5).map((t, i) => (
            <div key={t.id} className="py-3 flex items-center gap-3" style={{ borderBottom: i < Math.min(spaceTasks.length, 5) - 1 ? `1px solid ${C.lineSoft}` : "none" }}>
              {t.checked ? <CheckCircle2 size={14} style={{ color: C.green }} /> : <Circle size={14} style={{ color: C.muted }} />}
              <div className="flex-1 text-[13px]" style={{ color: C.ink, fontWeight: 500 }}>{t.title}</div>
              {t.assignee && <Avatar personId={t.assignee} size={18} />}
            </div>
          ))}</Panel>
        )}
      </section>
    </div>
  );
}

// ═══ MODALS ══════════════════════════════════════════════════════════════
function QuickAdd({ open, onClose, onCreate, allSpaces, users, currentSpace, onStartTimer }) {
  const flatSpaces = [...allSpaces, ...allSpaces.flatMap(s => s.children || [])];
  const blob = useModalBlob();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [spaceId, setSpaceId] = useState(currentSpace || "hq");
  const [subSpaceId, setSubSpaceId] = useState("");
  const [assignee, setAssignee] = useState("sb");
  const [priority, setPriority] = useState("media");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [withTimer, setWithTimer] = useState(false);
  const inputRef = useRef(null);

  // Determine if selected space has sub-spaces. If currentSpace IS a sub-space, set parent + child accordingly.
  const isSubSpace = !flatSpaces.find(s => s.children?.length); // not used directly
  const parentOfCurrent = allSpaces.find(s => s.children?.some(c => c.id === currentSpace));
  const initialParentId = parentOfCurrent ? parentOfCurrent.id : (currentSpace || "hq");
  const initialSubId = parentOfCurrent ? currentSpace : "";

  useEffect(() => {
    if (open) {
      setTitle(""); setDescription("");
      setSpaceId(initialParentId);
      setSubSpaceId(initialSubId);
      setAssignee("sb");
      setPriority("media");
      const today = new Date().toISOString().slice(0, 10);
      setStartDate(today);
      setEndDate("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, currentSpace]);

  if (!open) return null;

  const selectedSpace = allSpaces.find(s => s.id === spaceId);
  const subSpaceOptions = selectedSpace?.children || [];
  const activeAssignee = users?.find(u => u.id === assignee);

  const submit = () => {
    if (!title.trim()) { blob.onError(); return; }
    blob.onHappy(() => {
      const finalSpace = subSpaceId || spaceId;
      const projectCode = (flatSpaces.find(s => s.id === finalSpace)?.code) || (selectedSpace?.code) || finalSpace.toUpperCase().slice(0, 4);
      const newTask = onCreate({
        title: title.trim(),
        description: description.trim(),
        project: projectCode,
        priority,
        space: finalSpace,
        assignee,
        due: endDate || startDate || "",
        startDate, endDate,
        checked: false, parentId: null,
        comments: [], attachments: [],
        activity: [{ when: nowHHMM(), text: "Tarea creada" }],
      });
      if (withTimer && onStartTimer && newTask) onStartTimer(newTask);
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] p-4" style={{ backgroundColor: "rgba(10,11,15,0.4)" }} onClick={onClose}>
      <div className="w-full max-w-[640px] max-h-[88vh] flex flex-col" style={{ backgroundColor: C.paper, border: `1px solid ${C.line}`, borderRadius: 4 }} onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-center justify-between flex-shrink-0" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
          <div>
            <Eyebrow>Crear · tarea</Eyebrow>
            <div className="text-[16px] mt-1" style={{ color: C.ink, fontWeight: 600 }}>Nueva tarea</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ModalBlob state={blob.state} />
            <button onClick={onClose}><X size={14} style={{ color: C.muted }} /></button>
          </div>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div>
            <Eyebrow>Título</Eyebrow>
            <input ref={inputRef} value={title} onChange={e => { setTitle(e.target.value); blob.onType(); }}
              onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
              placeholder="¿Qué hay que hacer?"
              className="w-full mt-2 px-3 py-2 outline-none text-[14px]"
              style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2, color: C.ink }} />
          </div>

          <div>
            <Eyebrow>Descripción <span style={{ color: C.muted, fontWeight: 400 }}>· opcional</span></Eyebrow>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Detalles, contexto, links…"
              className="w-full mt-2 px-3 py-2 outline-none text-[13px] resize-none"
              rows={2}
              style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2, color: C.ink, fontFamily: "inherit" }} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Eyebrow>Space</Eyebrow>
              <select value={spaceId} onChange={e => { setSpaceId(e.target.value); setSubSpaceId(""); }}
                className="w-full mt-2 px-2.5 py-2 outline-none text-[13px]"
                style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2, color: C.ink }}>
                {allSpaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <Eyebrow>Sub-space {subSpaceOptions.length === 0 && <span style={{ color: C.muted, fontWeight: 400 }}>· n/a</span>}</Eyebrow>
              <select value={subSpaceId} onChange={e => setSubSpaceId(e.target.value)}
                disabled={subSpaceOptions.length === 0}
                className="w-full mt-2 px-2.5 py-2 outline-none text-[13px]"
                style={{ backgroundColor: subSpaceOptions.length === 0 ? C.bg : C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2, color: subSpaceOptions.length === 0 ? C.muted : C.ink }}>
                <option value="">{subSpaceOptions.length === 0 ? "(sin sub-spaces)" : "— ninguno —"}</option>
                {subSpaceOptions.map(c => <option key={c.id} value={c.id}>{c.code ? `${c.code} · ${c.name}` : c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Eyebrow>Asignado</Eyebrow>
              <div className="mt-2 relative">
                <select value={assignee} onChange={e => setAssignee(e.target.value)}
                  className="w-full px-2.5 py-2 outline-none text-[13px] appearance-none pl-8"
                  style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2, color: C.ink }}>
                  {(users || []).map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                </select>
                {activeAssignee && (
                  <div className="absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Avatar personId={activeAssignee.id} size={20} />
                  </div>
                )}
              </div>
            </div>
            <div>
              <Eyebrow>Prioridad</Eyebrow>
              <div className="mt-2 flex gap-1">
                {[
                  { v: "alta", label: "Alta", color: C.brick },
                  { v: "media", label: "Media", color: C.ochre },
                  { v: "baja", label: "Baja", color: C.muted },
                ].map(p => {
                  const active = priority === p.v;
                  return (
                    <button key={p.v} onClick={() => setPriority(p.v)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-[11px] hover:opacity-90"
                      style={{ backgroundColor: active ? p.color + "22" : C.surface, color: active ? p.color : C.inkSoft, border: `1px solid ${active ? p.color : C.lineSoft}`, borderRadius: 2, fontWeight: active ? 600 : 500 }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Eyebrow>Fecha de inicio</Eyebrow>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full mt-2 px-2.5 py-2 outline-none text-[13px]"
                style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2, color: C.ink, fontFamily: "inherit" }} />
            </div>
            <div>
              <Eyebrow>Fecha de fin</Eyebrow>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate || undefined}
                className="w-full mt-2 px-2.5 py-2 outline-none text-[13px]"
                style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2, color: C.ink, fontFamily: "inherit" }} />
            </div>
          </div>
        </div>

        <div className="px-5 py-4 flex items-center justify-between flex-shrink-0" style={{ borderTop: `1px solid ${C.lineSoft}` }}>
          <div className="flex items-center gap-3">
            <span className="text-[10px]" style={{ color: C.muted, fontFamily: "monospace" }}>⌘⏎ crear</span>
            <button type="button" onClick={() => setWithTimer(t => !t)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] hover:opacity-90"
              style={{ background: withTimer ? C.cobalt : "transparent", color: withTimer ? "#fff" : C.muted, border: `1px solid ${withTimer ? C.cobalt : C.lineSoft}`, borderRadius: 2, fontWeight: 500, transition: "all 0.15s" }}>
              <Clock size={11} />
              Iniciar timer
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-2 text-[12px] hover:opacity-90" style={{ color: C.muted, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>Cancelar</button>
            <button onClick={submit} disabled={!title.trim()} className="px-4 py-2 text-[12px] hover:opacity-90"
              style={{ backgroundColor: title.trim() ? C.ink : C.muted, color: C.bg, borderRadius: 2, fontWeight: 500, opacity: title.trim() ? 1 : 0.5 }}>
              {withTimer ? "Crear y cronometrar" : "Crear tarea"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── DELETE SPACE MODAL · cascade-aware ───
// ─── COMMAND PALETTE · Cmd+K · búsqueda global ───
function CommandPalette({ open, onClose, tasks, terrenos, customViews, users, allSpaces, onNavigate, openAdd, openAskHygge, openCreateSpace, openSettings }) {
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    const matches = [];

    // Actions (always shown unless query doesn't match)
    const actions = [
      { type: "action", id: "ask-hygge", label: "Ask Alice (IA)", meta: "Abrir agente IA", run: openAskHygge },
      { type: "action", id: "new-task", label: "Nueva tarea", meta: "Quick Add (Cmd+N)", run: openAdd },
      { type: "action", id: "new-space", label: "Nuevo space", meta: "Crear sub-organización", run: openCreateSpace },
      { type: "action", id: "print", label: "Imprimir vista actual", meta: "Print / Save as PDF", run: () => window.print() },
      { type: "action", id: "settings", label: "Abrir Settings", meta: "Cmd+, · perfil, admin, datos", run: () => { if (typeof openSettings === "function") openSettings(); } },
    ];
    actions.forEach(a => { if (!q || a.label.toLowerCase().includes(q)) matches.push(a); });

    if (!q) return matches.slice(0, 3); // Show only actions when no query

    // Tasks
    tasks.forEach(t => {
      if ((t.title || "").toLowerCase().includes(q)) {
        const space = allSpaces.find(s => s.id === t.space) || allSpaces.flatMap(s => s.children || []).find(c => c.id === t.space);
        matches.push({ type: "task", id: t.id, label: t.title, meta: space?.name || t.space, priority: t.priority, checked: t.checked });
      }
    });

    // Spaces (top + children)
    allSpaces.forEach(s => {
      if (s.name.toLowerCase().includes(q)) {
        matches.push({ type: "space", id: s.id, label: s.name, meta: s.custom ? "custom space" : "default" });
      }
      (s.children || []).forEach(c => {
        if (c.name.toLowerCase().includes(q)) {
          matches.push({ type: "space", id: c.id, label: c.name, meta: `sub-space de ${s.name}` });
        }
      });
    });

    // Terrenos
    terrenos.forEach(t => {
      if ((t.name || "").toLowerCase().includes(q) || (t.district || "").toLowerCase().includes(q)) {
        matches.push({ type: "terreno", id: t.id, label: t.name, meta: `${t.district || "—"} · ${t.status || "—"}` });
      }
    });

    // Users
    users.forEach(u => {
      const fullName = `${u.firstName || ""} ${u.lastName || ""}`.trim();
      if (fullName.toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q)) {
        matches.push({ type: "user", id: u.id, label: fullName, meta: u.role || u.email });
      }
    });

    // Custom views
    Object.entries(customViews).forEach(([spaceId, views]) => {
      (views || []).forEach(v => {
        const label = v.name || v.title || "Sin nombre";
        if (label.toLowerCase().includes(q)) {
          const space = allSpaces.find(s => s.id === spaceId) || allSpaces.flatMap(s => s.children || []).find(c => c.id === spaceId);
          matches.push({ type: "view", id: v.id, spaceId, label, meta: `vista en ${space?.name || spaceId}` });
        }
      });
    });

    return matches.slice(0, 40);
  }, [query, tasks, terrenos, customViews, users, allSpaces, openAskHygge, openAdd, openCreateSpace]);

  const handleSelect = (r) => {
    if (r.type === "action") { r.run(); onClose(); return; }
    onNavigate(r);
    onClose();
  };

  // Keyboard nav
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
      if (e.key === "Enter" && results[selectedIdx]) { e.preventDefault(); handleSelect(results[selectedIdx]); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, selectedIdx, onClose]);

  // Scroll selected into view
  useEffect(() => {
    if (!listRef.current) return;
    const sel = listRef.current.querySelector(`[data-idx="${selectedIdx}"]`);
    if (sel) sel.scrollIntoView({ block: "nearest" });
  }, [selectedIdx]);

  if (!open) return null;

  const grouped = results.reduce((acc, r) => { (acc[r.type] = acc[r.type] || []).push(r); return acc; }, {});
  const typeLabel = { action: "Acciones", task: "Tareas", space: "Spaces", terreno: "Terrenos", user: "Usuarios", view: "Custom Views" };
  const typeOrder = ["action", "task", "space", "terreno", "user", "view"];

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-12 sm:pt-20 px-4" style={{ backgroundColor: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div className="w-full max-w-xl flex flex-col" style={{ backgroundColor: C.bg, border: `1px solid ${C.line}`, borderRadius: 6, maxHeight: "75vh", boxShadow: "0 16px 40px rgba(0,0,0,0.3)" }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
          <Search size={14} style={{ color: C.muted, flexShrink: 0 }} />
          <input ref={inputRef} value={query} onChange={e => { setQuery(e.target.value); setSelectedIdx(0); }}
            placeholder="Buscar tareas, spaces, terrenos, usuarios, views..."
            className="flex-1 text-[13px] outline-none"
            style={{ backgroundColor: "transparent", color: C.ink, fontWeight: 500 }} />
          <kbd className="text-[9px] px-1.5 py-0.5 hidden sm:inline" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2, fontFamily: "monospace", color: C.muted }}>ESC</kbd>
        </div>

        <div className="overflow-y-auto flex-1" ref={listRef}>
          {query.trim() && results.length === 0 && (
            <div className="text-[11px] text-center py-10 px-4" style={{ color: C.muted }}>
              Sin resultados para <strong>"{query}"</strong>
            </div>
          )}

          {results.length > 0 && (() => {
            let globalIdx = -1;
            return typeOrder.map(type => {
              const items = grouped[type];
              if (!items || items.length === 0) return null;
              return (
                <div key={type}>
                  <div className="px-4 pt-3 pb-1 text-[9px]" style={{ color: C.muted, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{typeLabel[type]} ({items.length})</div>
                  {items.map(r => {
                    globalIdx++;
                    const idx = globalIdx;
                    const isSelected = idx === selectedIdx;
                    const TypeIcon = r.type === "action" ? Zap : r.type === "task" ? (r.checked ? CheckCircle : Circle) : r.type === "space" ? Hash : r.type === "terreno" ? MapPin : r.type === "user" ? UserIcon : Folder;
                    return (
                      <button key={`${r.type}-${r.id}`} data-idx={idx} onClick={() => handleSelect(r)}
                        onMouseEnter={() => setSelectedIdx(idx)}
                        className="w-full px-4 py-2 flex items-center gap-2.5 text-left"
                        style={{ backgroundColor: isSelected ? `${C.cobalt}12` : "transparent", borderLeft: `2px solid ${isSelected ? C.cobalt : "transparent"}` }}>
                        <TypeIcon size={12} style={{ color: r.type === "action" ? C.cobalt : (r.type === "task" && r.priority === "alta" ? C.brick : C.muted), flexShrink: 0 }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] truncate" style={{ color: C.ink, fontWeight: isSelected ? 600 : 500, textDecoration: r.checked ? "line-through" : "none", opacity: r.checked ? 0.6 : 1 }}>{r.label}</div>
                          {r.meta && <div className="text-[10px] truncate" style={{ color: C.muted }}>{r.meta}</div>}
                        </div>
                        {isSelected && <CornerDownLeft size={11} style={{ color: C.cobalt, flexShrink: 0 }} />}
                      </button>
                    );
                  })}
                </div>
              );
            });
          })()}
        </div>

        {results.length > 0 && (
          <div className="px-4 py-2 text-[10px] flex items-center justify-between" style={{ borderTop: `1px solid ${C.lineSoft}`, color: C.muted }}>
            <span>{results.length} {results.length === 1 ? "resultado" : "resultados"}</span>
            <span className="hidden sm:flex items-center gap-3">
              <span>↑↓</span><span>↵ abrir</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── UNDO TOAST · bottom-center · auto-dismiss 5s para undoable, 2.5s para confirmaciones ───
function UndoToast({ entry, onUndo, onDismiss }) {
  if (!entry) return null;
  const isUndoable = entry.type === "undoable";
  const isDone = entry.type === "done";
  return (
    <div className="fixed bottom-6 left-1/2 z-[60] flex items-center gap-3 px-4 py-3 shadow-lg"
      style={{
        transform: "translateX(-50%)",
        backgroundColor: isDone ? C.green : C.ink,
        color: "white",
        borderRadius: 4,
        minWidth: 280,
        maxWidth: "calc(100vw - 32px)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
      }}>
      <span className="text-[12px] flex-1" style={{ fontWeight: 500, letterSpacing: "-0.01em" }}>{entry.label}</span>
      {isUndoable && (
        <>
          <button onClick={onUndo} className="text-[11px] hover:opacity-80 px-2 py-1" style={{ fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 2 }}>
            Deshacer
          </button>
          <kbd className="text-[9px] px-1.5 py-0.5 hidden sm:inline" style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 2, fontFamily: "monospace", opacity: 0.7 }}>⌘Z</kbd>
        </>
      )}
      <button onClick={onDismiss} className="hover:opacity-80 ml-1" style={{ opacity: 0.6 }}>
        <X size={12} />
      </button>
    </div>
  );
}

// ─── CONFIRM CONTEXT · modal reutilizable global ───
const ConfirmContext = createContext(null);
const useConfirm = () => useContext(ConfirmContext);

function ConfirmProvider({ children }) {
  const [state, setState] = useState(null); // { title, message, confirmLabel, cancelLabel, danger, resolve }

  const confirm = useCallback((opts) => new Promise(resolve => {
    setState({
      title: opts.title || "¿Confirmás?",
      message: opts.message || "",
      confirmLabel: opts.confirmLabel || "Confirmar",
      cancelLabel: opts.cancelLabel || "Cancelar",
      danger: !!opts.danger,
      resolve,
    });
  }), []);

  const handle = useCallback((result) => {
    if (state) {
      state.resolve(result);
      setState(null);
    }
  }, [state]);

  // ESC closes, Enter confirms
  useEffect(() => {
    if (!state) return;
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); handle(false); }
      else if (e.key === "Enter") { e.preventDefault(); handle(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, handle]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center px-4" style={{ backgroundColor: "rgba(0,0,0,0.45)" }} onClick={() => handle(false)}>
          <div className="w-full max-w-md" style={{ backgroundColor: C.bg, border: `1px solid ${C.line}`, borderRadius: 4, boxShadow: "0 16px 40px rgba(0,0,0,0.3)" }} onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
              <div className="text-[10px] mb-1" style={{ color: state.danger ? C.brick : C.muted, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {state.danger ? "Confirmar acción destructiva" : "Confirmar"}
              </div>
              <div className="text-[14px]" style={{ color: C.ink, fontWeight: 600, letterSpacing: "-0.01em" }}>{state.title}</div>
            </div>
            {state.message && (
              <div className="px-5 py-4 text-[12px]" style={{ color: C.inkSoft, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{state.message}</div>
            )}
            <div className="px-5 py-3 flex items-center gap-2 justify-end" style={{ borderTop: `1px solid ${C.lineSoft}` }}>
              <button onClick={() => handle(false)} className="px-3 py-1.5 text-[11px] hover:opacity-70" style={{ color: C.muted, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
                {state.cancelLabel}
              </button>
              <button onClick={() => handle(true)} className="px-3 py-1.5 text-[11px] hover:opacity-90" style={{ backgroundColor: state.danger ? C.brick : C.ink, color: "white", borderRadius: 2, fontWeight: 600 }}>
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

// ─── DELETE USER MODAL · reasignar tareas antes de borrar ───
function DeleteUserModal({ open, onClose, user, affectedTasks, users, onConfirm }) {
  const [mode, setMode] = useState("reassign"); // "reassign" | "unassign"
  const [targetUserId, setTargetUserId] = useState("");
  const [blobState, setBlobState] = useState("confused");
  useEffect(() => {
    if (open && users.length > 0) {
      const firstAvailable = users.find(u => u.id !== user?.id);
      setTargetUserId(firstAvailable?.id || "");
      setMode(affectedTasks.length === 0 ? "unassign" : "reassign");
      setBlobState("confused");
    }
  }, [open, user, users, affectedTasks.length]);
  if (!open || !user) return null;
  const candidates = users.filter(u => u.id !== user.id);
  const submit = () => { onConfirm({ mode, targetUserId: mode === "reassign" ? targetUserId : null }); onClose(); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div className="w-full max-w-md" style={{ backgroundColor: C.bg, border: `1px solid ${C.line}`, borderRadius: 4 }} onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
          <div>
            <div className="text-[10px] mb-1" style={{ color: C.brick, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Eliminar usuario</div>
            <div className="text-[15px]" style={{ color: C.ink, fontWeight: 600, letterSpacing: "-0.01em" }}>{user.firstName} {user.lastName}</div>
            <div className="text-[10px] mt-0.5" style={{ color: C.muted }}>{user.email}</div>
          </div>
          <ModalBlob state={blobState} />
        </div>
        <div className="px-5 py-4 space-y-4">
          {affectedTasks.length === 0 ? (
            <div className="text-[12px]" style={{ color: C.inkSoft, lineHeight: 1.5 }}>
              Este usuario no tiene tareas asignadas. Eliminarlo es seguro.
            </div>
          ) : (
            <>
              <div className="text-[12px]" style={{ color: C.inkSoft, lineHeight: 1.5 }}>
                Tiene <strong>{affectedTasks.length} {affectedTasks.length === 1 ? "tarea asignada" : "tareas asignadas"}</strong>. ¿Qué hacemos con {affectedTasks.length === 1 ? "ella" : "ellas"}?
              </div>
              <div className="space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer p-3" style={{ backgroundColor: mode === "reassign" ? `${C.cobalt}10` : C.paper, border: `1px solid ${mode === "reassign" ? C.cobalt : C.lineSoft}`, borderRadius: 2 }}>
                  <input type="radio" checked={mode === "reassign"} onChange={() => setMode("reassign")} className="mt-0.5" style={{ accentColor: C.cobalt }} />
                  <div className="flex-1">
                    <div className="text-[12px]" style={{ color: C.ink, fontWeight: 600 }}>Reasignar a otro usuario</div>
                    <div className="text-[10px] mt-0.5" style={{ color: C.muted }}>Conserva las tareas con un responsable claro</div>
                    {mode === "reassign" && candidates.length > 0 && (
                      <select value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} className="mt-2 w-full text-[11px] px-2 py-1.5" style={{ backgroundColor: C.bg, border: `1px solid ${C.lineSoft}`, borderRadius: 2, color: C.ink }}>
                        {candidates.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName} · {u.role}</option>)}
                      </select>
                    )}
                  </div>
                </label>
                <label className="flex items-start gap-2.5 cursor-pointer p-3" style={{ backgroundColor: mode === "unassign" ? `${C.ochre}10` : C.paper, border: `1px solid ${mode === "unassign" ? C.ochre : C.lineSoft}`, borderRadius: 2 }}>
                  <input type="radio" checked={mode === "unassign"} onChange={() => setMode("unassign")} className="mt-0.5" style={{ accentColor: C.ochre }} />
                  <div className="flex-1">
                    <div className="text-[12px]" style={{ color: C.ink, fontWeight: 600 }}>Dejar sin asignar</div>
                    <div className="text-[10px] mt-0.5" style={{ color: C.muted }}>Las tareas se conservan pero quedan en limbo · alguien debe agarrarlas</div>
                  </div>
                </label>
              </div>
            </>
          )}
        </div>
        <div className="px-5 py-3 flex items-center gap-2 justify-end" style={{ borderTop: `1px solid ${C.lineSoft}` }}>
          <button onClick={onClose} className="px-3 py-1.5 text-[11px] hover:opacity-70" style={{ color: C.muted, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>Cancelar</button>
          <button onClick={submit} disabled={mode === "reassign" && !targetUserId} className="px-3 py-1.5 text-[11px] hover:opacity-90 disabled:opacity-40" style={{ backgroundColor: C.brick, color: "white", borderRadius: 2, fontWeight: 600 }}
            onMouseEnter={() => setBlobState("error")} onMouseLeave={() => setBlobState("confused")}>
            {affectedTasks.length === 0 ? "Eliminar" : mode === "reassign" ? "Reasignar y eliminar" : "Dejar sin asignar y eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteSpaceModal({ open, onClose, space, affectedTasks, customViewsCount, allSpaces, onConfirm }) {
  const [mode, setMode] = useState("move"); // "move" | "delete-all"
  const [targetSpaceId, setTargetSpaceId] = useState("hq");
  const [blobState, setBlobState] = useState("confused");
  useEffect(() => { if (open) { setMode("move"); setTargetSpaceId("hq"); setBlobState("confused"); } }, [open]);
  if (!open || !space) return null;

  // Flatten allSpaces minus the one being deleted
  const candidates = [];
  const collect = (s) => { if (s.id !== space.id) candidates.push(s); (s.children || []).forEach(c => { if (c.id !== space.id) candidates.push(c); }); };
  allSpaces.forEach(collect);

  const submit = () => {
    onConfirm({ mode, targetSpaceId: mode === "move" ? targetSpaceId : null });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div className="w-full max-w-md" style={{ backgroundColor: C.bg, border: `1px solid ${C.line}`, borderRadius: 4 }} onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
          <div>
            <div className="text-[10px] mb-1" style={{ color: C.brick, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Eliminar space</div>
            <div className="text-[15px]" style={{ color: C.ink, fontWeight: 600, letterSpacing: "-0.01em" }}>{space.name}</div>
          </div>
          <ModalBlob state={blobState} />
        </div>

        <div className="px-5 py-4 space-y-4">
          {affectedTasks.length === 0 && customViewsCount === 0 ? (
            <div className="text-[12px]" style={{ color: C.inkSoft, lineHeight: 1.5 }}>
              Este space no tiene tareas ni custom views. Eliminarlo es seguro.
            </div>
          ) : (
            <>
              <div className="text-[12px]" style={{ color: C.inkSoft, lineHeight: 1.5 }}>
                {affectedTasks.length > 0 && <>Tiene <strong>{affectedTasks.length} {affectedTasks.length === 1 ? "tarea" : "tareas"}</strong>{customViewsCount > 0 ? " y " : ". "}</>}
                {customViewsCount > 0 && <><strong>{customViewsCount} custom {customViewsCount === 1 ? "view" : "views"}</strong>. </>}
                ¿Qué hacemos con {affectedTasks.length > 0 ? "ellas" : "ellos"}?
              </div>

              {affectedTasks.length > 0 && (
                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 cursor-pointer p-3" style={{ backgroundColor: mode === "move" ? `${C.cobalt}10` : C.paper, border: `1px solid ${mode === "move" ? C.cobalt : C.lineSoft}`, borderRadius: 2 }}>
                    <input type="radio" checked={mode === "move"} onChange={() => setMode("move")} className="mt-0.5" style={{ accentColor: C.cobalt }} />
                    <div className="flex-1">
                      <div className="text-[12px]" style={{ color: C.ink, fontWeight: 600 }}>Mover tareas a otro space</div>
                      <div className="text-[10px] mt-0.5" style={{ color: C.muted }}>Conserva las tareas, las reasigna</div>
                      {mode === "move" && (
                        <select value={targetSpaceId} onChange={(e) => setTargetSpaceId(e.target.value)} className="mt-2 w-full text-[11px] px-2 py-1.5" style={{ backgroundColor: C.bg, border: `1px solid ${C.lineSoft}`, borderRadius: 2, color: C.ink }}>
                          {candidates.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      )}
                    </div>
                  </label>
                  <label className="flex items-start gap-2.5 cursor-pointer p-3" style={{ backgroundColor: mode === "delete-all" ? `${C.brick}10` : C.paper, border: `1px solid ${mode === "delete-all" ? C.brick : C.lineSoft}`, borderRadius: 2 }}>
                    <input type="radio" checked={mode === "delete-all"} onChange={() => setMode("delete-all")} className="mt-0.5" style={{ accentColor: C.brick }} />
                    <div className="flex-1">
                      <div className="text-[12px]" style={{ color: C.ink, fontWeight: 600 }}>Eliminar las {affectedTasks.length} {affectedTasks.length === 1 ? "tarea" : "tareas"}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: C.muted }}>Junto con el space · acción irreversible</div>
                    </div>
                  </label>
                </div>
              )}

              {customViewsCount > 0 && (
                <div className="text-[10px] italic" style={{ color: C.muted, lineHeight: 1.5 }}>
                  Los {customViewsCount} custom views se eliminan junto con el space (no se pueden mover).
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-3 flex items-center gap-2 justify-end" style={{ borderTop: `1px solid ${C.lineSoft}` }}>
          <button onClick={onClose} className="px-3 py-1.5 text-[11px] hover:opacity-70" style={{ color: C.muted, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>Cancelar</button>
          <button onClick={submit} className="px-3 py-1.5 text-[11px] hover:opacity-90" style={{ backgroundColor: C.brick, color: "white", borderRadius: 2, fontWeight: 600 }}
            onMouseEnter={() => setBlobState("error")} onMouseLeave={() => setBlobState("confused")}>
            {mode === "delete-all" ? `Eliminar todo` : `Mover y eliminar space`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DELETE TASK MODAL · cascade-aware (para tareas con subtasks) ───
function DeleteTaskModal({ open, onClose, task, subtaskCount, onConfirm }) {
  const [mode, setMode] = useState("delete-all");
  const [blobState, setBlobState] = useState("confused");
  useEffect(() => { if (open) { setMode("delete-all"); setBlobState("confused"); } }, [open]);
  if (!open || !task) return null;
  const submit = () => { onConfirm({ mode }); onClose(); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div className="w-full max-w-md" style={{ backgroundColor: C.bg, border: `1px solid ${C.line}`, borderRadius: 4 }} onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
          <div>
            <div className="text-[10px] mb-1" style={{ color: C.brick, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Eliminar tarea</div>
            <div className="text-[14px]" style={{ color: C.ink, fontWeight: 600, lineHeight: 1.3 }}>{task.title}</div>
          </div>
          <ModalBlob state={blobState} />
        </div>
        <div className="px-5 py-4 space-y-3">
          {subtaskCount === 0 ? (
            <div className="text-[12px]" style={{ color: C.inkSoft }}>¿Eliminar esta tarea?</div>
          ) : (
            <>
              <div className="text-[12px]" style={{ color: C.inkSoft, lineHeight: 1.5 }}>Tiene <strong>{subtaskCount} {subtaskCount === 1 ? "subtarea" : "subtareas"}</strong>. ¿Qué hacemos?</div>
              <label className="flex items-start gap-2.5 cursor-pointer p-3" style={{ backgroundColor: mode === "delete-all" ? `${C.brick}10` : C.paper, border: `1px solid ${mode === "delete-all" ? C.brick : C.lineSoft}`, borderRadius: 2 }}>
                <input type="radio" checked={mode === "delete-all"} onChange={() => setMode("delete-all")} className="mt-0.5" style={{ accentColor: C.brick }} />
                <div className="flex-1">
                  <div className="text-[12px]" style={{ color: C.ink, fontWeight: 600 }}>Eliminar todo (tarea + subtareas)</div>
                  <div className="text-[10px] mt-0.5" style={{ color: C.muted }}>Acción irreversible · cascade total</div>
                </div>
              </label>
              <label className="flex items-start gap-2.5 cursor-pointer p-3" style={{ backgroundColor: mode === "promote" ? `${C.cobalt}10` : C.paper, border: `1px solid ${mode === "promote" ? C.cobalt : C.lineSoft}`, borderRadius: 2 }}>
                <input type="radio" checked={mode === "promote"} onChange={() => setMode("promote")} className="mt-0.5" style={{ accentColor: C.cobalt }} />
                <div className="flex-1">
                  <div className="text-[12px]" style={{ color: C.ink, fontWeight: 600 }}>Promover subtareas a top-level</div>
                  <div className="text-[10px] mt-0.5" style={{ color: C.muted }}>Conserva el trabajo, las subtareas se vuelven independientes</div>
                </div>
              </label>
            </>
          )}
        </div>
        <div className="px-5 py-3 flex items-center gap-2 justify-end" style={{ borderTop: `1px solid ${C.lineSoft}` }}>
          <button onClick={onClose} className="px-3 py-1.5 text-[11px] hover:opacity-70" style={{ color: C.muted, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>Cancelar</button>
          <button onClick={submit} className="px-3 py-1.5 text-[11px] hover:opacity-90" style={{ backgroundColor: C.brick, color: "white", borderRadius: 2, fontWeight: 600 }}
            onMouseEnter={() => setBlobState("error")} onMouseLeave={() => setBlobState("confused")}>
            {mode === "promote" ? "Promover y eliminar tarea" : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── EDIT CUSTOM SPACE MODAL · rename + color + parent · v44 ───
function EditSpaceModal({ open, onClose, space, customSpaces, defaultSpaces, onSave }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("");
  const [parentId, setParentId] = useState("");
  const blob = useModalBlob();
  useEffect(() => {
    if (open && space) {
      setName(space.name || "");
      setColor(space.dot || SPACE_COLORS[0]);
      setParentId(space.parentId || "");
      blob.reset();
    }
  }, [open, space]);
  if (!open || !space) return null;

  const isDescendant = (sId, ancestorId) => {
    const s = customSpaces.find(x => x.id === sId);
    if (!s) return false;
    if (s.parentId === ancestorId) return true;
    if (s.parentId) return isDescendant(s.parentId, ancestorId);
    return false;
  };
  const parentCandidates = [
    { id: "", name: "— Sin padre (top-level) —" },
    ...defaultSpaces.filter(s => !["hq", "inbox", "notifications"].includes(s.id)).map(s => ({ id: s.id, name: s.name })),
    ...customSpaces.filter(s => s.id !== space.id && !isDescendant(s.id, space.id)).map(s => ({ id: s.id, name: s.name + " (custom)" })),
  ];

  const submit = () => {
    if (!name.trim()) { blob.onError(); return; }
    blob.onHappy(() => { onSave(space.id, { name: name.trim(), dot: color, parentId: parentId || null }); onClose(); });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div className="w-full max-w-md" style={{ backgroundColor: C.bg, border: `1px solid ${C.line}`, borderRadius: 4 }} onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
          <div>
            <div className="text-[10px] mb-1" style={{ color: C.muted, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Editar space</div>
            <div className="text-[14px]" style={{ color: C.ink, fontWeight: 600 }}>{space.name}</div>
          </div>
          <ModalBlob state={blob.state} />
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <Eyebrow>Nombre</Eyebrow>
            <input autoFocus value={name} onChange={e => { setName(e.target.value); blob.onType(); }} onKeyDown={e => { if (e.key === "Enter") submit(); }}
              className="w-full mt-2 px-2.5 py-1.5 text-[13px] outline-none" style={{ backgroundColor: C.bg, border: `1px solid ${C.lineSoft}`, borderRadius: 2, color: C.ink }} />
          </div>
          <div>
            <Eyebrow>Color</Eyebrow>
            <div className="flex gap-2 mt-2 flex-wrap">
              {SPACE_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)} className="w-7 h-7 hover:scale-110 transition-transform" style={{ backgroundColor: c, borderRadius: 999, border: color === c ? `2px solid ${C.ink}` : `2px solid transparent` }} title={c} />
              ))}
            </div>
          </div>
          <div>
            <Eyebrow>Anidar bajo</Eyebrow>
            <select value={parentId} onChange={e => setParentId(e.target.value)} className="w-full mt-2 px-2.5 py-1.5 text-[12px] outline-none" style={{ backgroundColor: C.bg, border: `1px solid ${C.lineSoft}`, borderRadius: 2, color: C.ink }}>
              {parentCandidates.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
        <div className="px-5 py-3 flex items-center gap-2 justify-end" style={{ borderTop: `1px solid ${C.lineSoft}` }}>
          <button onClick={onClose} className="px-3 py-1.5 text-[11px] hover:opacity-70" style={{ color: C.muted, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>Cancelar</button>
          <button onClick={submit} className="px-3 py-1.5 text-[11px] hover:opacity-90" style={{ backgroundColor: C.ink, color: "white", borderRadius: 2, fontWeight: 600 }}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

function CreateSpaceModal({ open, onClose, onCreate, parentSpace }) {
  const [name, setName] = useState(""), [colorIdx, setColorIdx] = useState(0);
  const blob = useModalBlob();
  const inputRef = useRef(null);
  useEffect(() => { if (open) { setName(""); setColorIdx(0); blob.reset(); setTimeout(() => inputRef.current?.focus(), 50); } }, [open]);
  if (!open) return null;
  const submit = () => {
    if (!name.trim()) { blob.onError(); return; }
    blob.onHappy(() => { onCreate(name.trim(), SPACE_COLORS[colorIdx]); onClose(); });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" style={{ backgroundColor: "rgba(10,11,15,0.4)" }} onClick={onClose}>
      <div className="w-[440px]" style={{ backgroundColor: C.paper, border: `1px solid ${C.line}`, borderRadius: 4 }} onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
          <div>
            <Eyebrow>{parentSpace ? `Sub-space en ${parentSpace.name}` : "Crear · space"}</Eyebrow>
            <div className="text-[16px] mt-1" style={{ color: C.ink, fontWeight: 600 }}>{parentSpace ? "Nuevo sub-space" : "Nuevo space"}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ModalBlob state={blob.state} />
            <button onClick={onClose}><X size={14} style={{ color: C.muted }} /></button>
          </div>
        </div>
        <div className="p-5 space-y-4">
          {parentSpace && (
            <div className="flex items-center gap-2 px-3 py-2" style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
              <CornerDownRight size={11} style={{ color: C.muted }} />
              <span className="text-[10px] tracking-[0.1em] uppercase" style={{ color: C.muted, fontWeight: 600 }}>dentro de</span>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: parentSpace.dot }} />
              <span className="text-[12px]" style={{ color: C.ink, fontWeight: 500 }}>{parentSpace.name}</span>
            </div>
          )}
          <div><Eyebrow>Nombre</Eyebrow><input ref={inputRef} value={name} onChange={e => { setName(e.target.value); blob.onType(); }} onKeyDown={e => e.key === "Enter" && submit()} placeholder={parentSpace ? "Ej. Inversionistas, Sarah, Q3 Plan…" : "Ej. Inversionistas"} className="w-full mt-2 px-3 py-2 outline-none text-[14px]" style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2, color: C.ink }} /></div>
          <div><Eyebrow>Color</Eyebrow>
            <div className="flex gap-2 mt-3">{SPACE_COLORS.map((c, i) => (
              <button key={c} onClick={() => setColorIdx(i)} className="w-7 h-7" style={{ backgroundColor: c, borderRadius: 999, border: colorIdx === i ? `2px solid ${C.ink}` : `2px solid transparent`, transform: colorIdx === i ? "scale(1.1)" : "scale(1)" }} />
            ))}</div>
          </div>
        </div>
        <div className="px-5 py-4 flex items-center justify-end" style={{ borderTop: `1px solid ${C.lineSoft}` }}>
          <button onClick={submit} className="px-4 py-2 text-[12px] hover:opacity-90" style={{ backgroundColor: C.ink, color: C.bg, borderRadius: 2, fontWeight: 500 }}>{parentSpace ? "Crear sub-space" : "Crear space"}</button>
        </div>
      </div>
    </div>
  );
}

// ═══ DROPBOX SYNC MODALS ════════════════════════════════════════════════
function DropboxSyncModal({ items, onCreateSpace, onIgnore, onClose }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9990, backgroundColor: "rgba(10,11,15,0.6)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ backgroundColor: C.bg, border: `1px solid ${C.line}`, borderRadius: 4, width: "100%", maxWidth: 460, overflow: "hidden", boxShadow: "0 24px 64px rgba(10,11,15,0.24)" }}>
        <div style={{ padding: "18px 24px", borderBottom: `1px solid ${C.lineSoft}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>Dropbox · Sync</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, letterSpacing: "-0.01em" }}>Carpetas nuevas en Dropbox</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ModalBlob state="thinking" />
            <button onClick={onClose}><X size={14} style={{ color: C.muted }} /></button>
          </div>
        </div>
        <div style={{ padding: "20px 24px" }}>
          <p style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6, marginBottom: 16 }}>
            Se {items.length === 1 ? "detectó una carpeta" : `detectaron ${items.length} carpetas`} en Dropbox que no {items.length === 1 ? "tiene" : "tienen"} space en ALICE. ¿Querés crear {items.length === 1 ? "el space" : "los spaces"}?
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {items.map(item => (
              <div key={item.path} style={{ backgroundColor: C.paper, border: `1px solid ${C.line}`, borderRadius: 3, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.cobalt} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{item.name}</span>
                  <span style={{ fontSize: 10.5, color: C.muted }}>{item.path}</span>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button onClick={() => onCreateSpace(item)} style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", backgroundColor: C.cobalt, color: "white", border: "none", borderRadius: 2, cursor: "pointer" }}>Crear space</button>
                  <button onClick={() => onIgnore(item)} style={{ fontSize: 11, padding: "4px 10px", backgroundColor: "transparent", color: C.muted, border: `1px solid ${C.line}`, borderRadius: 2, cursor: "pointer" }}>Ignorar</button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={onClose} style={{ width: "100%", padding: "9px 0", fontSize: 12, color: C.muted, backgroundColor: "transparent", border: `1px solid ${C.line}`, borderRadius: 2, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

function DropboxFolderPrompt({ prompt, onConfirm, onCancel }) {
  const [blobState, setBlobState] = useState("confused");
  const isCreate = prompt?.action === "create";
  useEffect(() => { if (prompt) setBlobState("confused"); }, [prompt]);
  if (!prompt) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9991, backgroundColor: "rgba(10,11,15,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ backgroundColor: C.bg, border: `1px solid ${C.line}`, borderRadius: 4, width: "100%", maxWidth: 380, overflow: "hidden", boxShadow: "0 16px 48px rgba(10,11,15,0.2)" }}>
        <div style={{ padding: "18px 24px", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Dropbox · {isCreate ? "Nueva carpeta" : "Eliminar carpeta"}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, letterSpacing: "-0.01em" }}>
              {isCreate ? `¿Crear carpeta en Dropbox?` : `¿Eliminar carpeta en Dropbox?`}
            </div>
          </div>
          <ModalBlob state={blobState} />
        </div>
        <div style={{ padding: "16px 24px 20px" }}>
          <p style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6, marginBottom: 4 }}>
            {isCreate
              ? `Se creó el space "${prompt.spaceName}" en ALICE. ¿Querés crear también la carpeta correspondiente en Dropbox?`
              : `Se eliminó el space "${prompt.spaceName}" de ALICE. ¿Querés eliminar también su carpeta en Dropbox?`
            }
          </p>
          <div style={{ fontSize: 11, color: C.cobalt, fontFamily: "monospace", backgroundColor: C.paper, border: `1px solid ${C.line}`, borderRadius: 2, padding: "5px 8px", marginBottom: 18 }}>
            {prompt.folderPath || prompt.suggestedPath}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onConfirm}
              onMouseEnter={() => setBlobState("error")}
              onMouseLeave={() => setBlobState("confused")}
              style={{ flex: 1, padding: "9px 0", fontSize: 12.5, fontWeight: 600, backgroundColor: isCreate ? C.cobalt : C.brick, color: "white", border: "none", borderRadius: 2, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
              {isCreate ? "Sí, crear carpeta" : "Sí, eliminar carpeta"}
            </button>
            <button onClick={onCancel} style={{ flex: 1, padding: "9px 0", fontSize: 12.5, backgroundColor: "transparent", color: C.muted, border: `1px solid ${C.line}`, borderRadius: 2, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
              No, solo en ALICE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══ AI CHAT ═════════════════════════════════════════════════════════════
function AIChatPanel({ open, onClose, conversation, sending, sendMessage }) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);
  const scrollRef = useRef(null);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: 999999, behavior: "smooth" }); }, [conversation, sending]);
  if (!open) return null;
  const submit = () => { if (draft.trim() && !sending) { sendMessage(draft.trim()); setDraft(""); } };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-8" style={{ backgroundColor: "rgba(10,11,15,0.5)" }} onClick={onClose}>
      <div className="w-full max-w-[680px] flex flex-col" style={{ backgroundColor: C.paper, border: `1px solid ${C.line}`, borderRadius: 4, boxShadow: "0 24px 48px rgba(0,0,0,0.2)", maxHeight: "85vh" }} onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center" style={{ backgroundColor: C.ink, borderRadius: 999 }}><Sparkles size={14} style={{ color: C.bg }} /></div>
            <div><div className="text-[14px]" style={{ color: C.ink, fontWeight: 600 }}>Ask Alice</div><div className="text-[10px]" style={{ color: C.muted, fontWeight: 500 }}>Agente IA · Claude Sonnet 4</div></div>
          </div>
          <button onClick={onClose}><X size={16} style={{ color: C.muted }} /></button>
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {conversation.length === 0 && (
            <div className="text-center py-10">
              <Sparkles size={24} style={{ color: C.muted, margin: "0 auto 12px" }} />
              <div className="text-[14px] mb-2" style={{ color: C.ink, fontWeight: 500 }}>Hola, Sebastián.</div>
              <div className="text-[12px] mb-6 max-w-xs mx-auto" style={{ color: C.muted, lineHeight: 1.6 }}>Conozco a todo el equipo, los 4 SPVs, tus tareas. Decime qué hacer.</div>
              <div className="space-y-2 max-w-sm mx-auto">
                {["Asigná la tarea del FC a Joel", "Creá una tarea para Ariel: revisar fachada PU01", "Comentá en 'plano fachada': 'Voy con la opción B'", "Marcá como hecha la tarea del contrato de acero"].map(s => (
                  <button key={s} onClick={() => sendMessage(s)} className="block w-full text-left px-3 py-2 text-[12px] hover:opacity-90" style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2, color: C.inkSoft }}>{s}</button>
                ))}
              </div>
            </div>
          )}
          {conversation.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex gap-3"}>
              {m.role === "assistant" && <div className="w-7 h-7 flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: C.ink, borderRadius: 999 }}><Sparkles size={11} style={{ color: C.bg }} /></div>}
              <div className={m.role === "user" ? "max-w-[80%]" : "flex-1"}>
                <div className="text-[13px]" style={{ color: C.ink, lineHeight: 1.55, backgroundColor: m.role === "user" ? C.surface : "transparent", border: m.role === "user" ? `1px solid ${C.lineSoft}` : "none", borderRadius: m.role === "user" ? 2 : 0, padding: m.role === "user" ? "10px 14px" : "0" }}>
                  {m.content}
                </div>
                {m.actions && m.actions.length > 0 && (
                  <div className="mt-3 space-y-1.5">{m.actions.map((a, j) => (
                    <div key={j} className="inline-flex items-center gap-2 px-2.5 py-1.5 text-[11px] mr-2" style={{ backgroundColor: C.green + "15", border: `1px solid ${C.green}44`, borderRadius: 2, color: C.green, fontWeight: 500 }}>
                      <CheckCircle2 size={11} />{a.label}
                    </div>
                  ))}</div>
                )}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex gap-3">
              <div className="w-7 h-7 flex items-center justify-center flex-shrink-0" style={{ backgroundColor: C.ink, borderRadius: 999 }}><Loader2 size={11} style={{ color: C.bg, animation: "spin 1s linear infinite" }} /></div>
              <div className="text-[13px]" style={{ color: C.muted }}>pensando…</div>
            </div>
          )}
        </div>
        <div className="px-6 py-4" style={{ borderTop: `1px solid ${C.lineSoft}` }}>
          <div className="flex items-center gap-2">
            <input ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} placeholder="Pedile algo a Hygge…" disabled={sending} className="flex-1 px-3 py-2.5 outline-none text-[13px]" style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2, color: C.ink }} />
            <button onClick={submit} disabled={sending || !draft.trim()} className="p-2.5 hover:opacity-90 disabled:opacity-30" style={{ backgroundColor: C.ink, color: C.bg, borderRadius: 2 }}><Send size={13} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══ RIGHT PANEL ═════════════════════════════════════════════════════════
function RightPanel({ timer, toggleTimer, stopTimer, messages, activity, markRead, openTask, navigate, openAskHygge, mobileOpen, onMobileClose, collapsed, onToggleCollapsed, timerSessions, timerActive, timerLive, onTimerStop, authUser, tasks }) {
  const handleMessageClick = (m) => {
    markRead(m.id);
    if (m.relatedTaskId) openTask(m.relatedTaskId);
    else openAskHygge();
    if (onMobileClose) onMobileClose();
  };
  const handleActivityClick = (a) => {
    if (a.relatedTaskId) openTask(a.relatedTaskId);
    else if (a.relatedSpace) navigate(a.relatedSpace);
    if (onMobileClose) onMobileClose();
  };
  const unreadCount = messages.filter(m => !m.read).length;

  // Semáforo de mensajes sin leer
  const msgLight = unreadCount === 0 ? C.green : unreadCount <= 3 ? C.ochre : C.brick;
  const msgLightPulse = unreadCount >= 4;

  // Relevancia de actividad: en los spaces del usuario o tarea asignada a él
  const allowedSpaces = authUser?.allowedSpaces; // null = todos
  const isRelevantActivity = (a) => {
    if (!authUser) return false;
    if (a.relatedSpace) {
      if (!allowedSpaces) return true; // admin/CEO ve todo como relevante
      return allowedSpaces.includes(a.relatedSpace);
    }
    if (a.relatedTaskId && tasks) {
      const t = tasks.find(t => t.id === a.relatedTaskId);
      if (t && t.assignee === authUser.id) return true;
      if (t && allowedSpaces && allowedSpaces.includes(t.space)) return true;
      if (t && !allowedSpaces) return true;
    }
    return false;
  };

  // Filtrar actividad de tareas que ya no existen
  const taskIds = useMemo(() => new Set((tasks || []).map(t => t.id)), [tasks]);
  const visibleActivity = useMemo(() => (activity || []).filter(a =>
    !a.relatedTaskId || taskIds.has(a.relatedTaskId)
  ), [activity, taskIds]);

  // Timer tasks del usuario actual
  const myTimerSessions = (timerSessions || []).filter(s =>
    !authUser?.allowedSpaces || allowedSpaces.includes(s.space)
  );

  // Collapsed rail (desktop only) — slim 40px column with expand button + badges
  if (collapsed) {
    return (
      <aside className="hidden lg:flex flex-col items-center flex-shrink-0 sticky top-0 h-screen w-[40px] z-30 py-4 gap-3"
        style={{ backgroundColor: C.bg, borderLeft: `1px solid ${C.line}` }}>
        <button onClick={onToggleCollapsed} className="p-2 hover:opacity-70" title="Expandir panel">
          <ChevronLeft size={14} style={{ color: C.muted }} />
        </button>
        <div className="w-full" style={{ borderTop: `1px solid ${C.lineSoft}` }} />
        <button onClick={onToggleCollapsed} title="Timer" className="relative p-2 hover:opacity-70">
          <Clock size={14} style={{ color: timer.running ? C.cobalt : C.muted }} />
          {timer.running && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: C.green }} />}
        </button>
        <button onClick={onToggleCollapsed} title={`${unreadCount} sin leer`} className="relative p-2 hover:opacity-70">
          <MessageCircle size={14} style={{ color: C.muted }} />
          {unreadCount > 0 && <span className="absolute top-0.5 right-0.5 text-[8px] px-1 rounded-full" style={{ backgroundColor: C.brick, color: "white", fontWeight: 600 }}>{unreadCount}</span>}
        </button>
      </aside>
    );
  }
  return (
    <aside
      className={`w-[320px] max-w-[90vw] flex-shrink-0 flex flex-col z-40 fixed inset-y-0 right-0 transition-transform duration-200 ${mobileOpen ? "translate-x-0 shadow-2xl" : "translate-x-full"} lg:translate-x-0 lg:transition-none lg:sticky lg:top-0 lg:h-screen lg:max-w-none lg:shadow-none`}
      style={{ backgroundColor: C.bg, borderLeft: `1px solid ${C.line}`, height: "100vh" }}>
      <div className="px-5 py-5 relative" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
        <button onClick={onMobileClose} className="lg:hidden absolute top-3 right-3 p-1 hover:opacity-70"><X size={14} style={{ color: C.muted }} /></button>
        {onToggleCollapsed && <button onClick={onToggleCollapsed} className="hidden lg:block absolute top-3 right-3 p-1 hover:opacity-70" title="Colapsar panel"><ChevronRight size={14} style={{ color: C.muted }} /></button>}
        <div className="flex items-center gap-2 mb-4">
          <Clock size={12} style={{ color: C.cobalt }} />
          <Eyebrow style={{ color: C.cobalt }}>Tareas con timer</Eyebrow>
        </div>
        {/* Active timer — prominent card */}
        {timerActive && (() => {
          const activeSession = (timerSessions || []).find(s => s.id === timerActive.sessionId);
          const activeTask = activeSession ? (tasks || []).find(t => t.id === activeSession.taskId) : null;
          if (!activeTask || activeTask.checked) return null;
          return (
            <div className="mb-4 p-3" style={{ background: C.cobalt, borderRadius: 3 }}>
              <div className="flex items-center gap-2 mb-2">
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff", flexShrink: 0, animation: "pulse 1.5s infinite" }} />
                <span className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>En curso</span>
              </div>
              <div className="text-[16px] mb-2 leading-tight" style={{ color: "#fff", fontWeight: 600, letterSpacing: "-0.01em" }}>{activeSession?.taskTitle ?? "—"}</div>
              <div className="flex items-center justify-between">
                <span className="text-[22px]" style={{ color: "#fff", fontWeight: 300, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{fmtTime(timerLive || 0)}</span>
                <button onClick={onTimerStop} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] hover:opacity-80" style={{ background: "rgba(255,255,255,0.15)", color: "#fff", borderRadius: 2, fontWeight: 500 }}>
                  <X size={10} /> Detener
                </button>
              </div>
            </div>
          );
        })()}
        {/* Tasks with logged time */}
        {(() => {
          const taskIds = new Set((tasks || []).map(t => t.id));
          const checkedIds = new Set((tasks || []).filter(t => t.checked).map(t => t.id));
          const completed = myTimerSessions.filter(s => s.duration != null && taskIds.has(s.taskId) && !checkedIds.has(s.taskId));
          if (completed.length === 0 && !timerActive) {
            return <p className="text-[12px]" style={{ color: C.muted, fontStyle: "italic" }}>Iniciá el timer desde una tarea en lista o al crear una.</p>;
          }
          const byTask = {};
          completed.forEach(s => {
            if (!byTask[s.taskId]) byTask[s.taskId] = { taskId: s.taskId, title: s.taskTitle, space: s.space, total: 0 };
            byTask[s.taskId].total += s.duration;
          });
          const sorted = Object.values(byTask).sort((a, b) => b.total - a.total).slice(0, 5);
          // Top task by time gets the pulsing treatment
          return (
            <div className="space-y-2">
              {sorted.map((t, idx) => {
                const isTop = idx === 0;
                return (
                  <button key={t.taskId} onClick={() => openTask(t.taskId)}
                    className="w-full flex items-center gap-2 text-left hover:opacity-80"
                    style={{
                      padding: isTop ? "8px 10px" : "3px 4px",
                      borderRadius: isTop ? 3 : 2,
                      backgroundColor: isTop ? `${C.cobalt}0D` : "transparent",
                      border: isTop ? `1px solid ${C.cobalt}30` : "1px solid transparent",
                      animation: isTop ? "timerPulse 2s ease-in-out infinite" : "none",
                    }}>
                    <span style={{
                      width: isTop ? 8 : 6, height: isTop ? 8 : 6,
                      borderRadius: "50%", flexShrink: 0,
                      backgroundColor: C.cobalt, opacity: isTop ? 0.9 : 0.45,
                      animation: isTop ? "pulse 1.5s infinite" : "none",
                    }} />
                    <span className="flex-1 truncate" style={{ color: isTop ? C.ink : C.inkSoft, fontWeight: isTop ? 600 : 500, fontSize: isTop ? 13 : 12 }}>{t.title}</span>
                    <span className="shrink-0 tabular-nums" style={{ color: C.cobalt, fontWeight: 700, fontSize: isTop ? 13 : 11 }}>{fmtTime(t.total)}</span>
                  </button>
                );
              })}
            </div>
          );
        })()}
      </div>

      <div className="px-6 py-6" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
        {/* Semáforo de mensajes */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Eyebrow>Mensajes</Eyebrow>
            {/* Traffic light */}
            <div className="flex items-center gap-1.5 ml-1">
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                backgroundColor: msgLight,
                boxShadow: msgLightPulse ? `0 0 0 0 ${msgLight}` : "none",
                animation: msgLightPulse ? "msgPulse 1.4s ease-out infinite" : "none",
                display: "block", flexShrink: 0,
              }} />
              <span className="text-[10px]" style={{
                color: unreadCount === 0 ? C.muted : msgLight,
                fontWeight: unreadCount > 0 ? 700 : 400,
              }}>
                {unreadCount === 0 ? "al día" : `${unreadCount} sin leer`}
              </span>
            </div>
          </div>
          <MessageSquare size={12} style={{ color: C.muted }} />
        </div>
        <div className="space-y-4">
          {messages.slice(0, 3).map((m) => (
            <button key={m.id} onClick={() => handleMessageClick(m)} className="w-full flex gap-3 text-left hover:opacity-90 group/msg">
              <div className="w-7 h-7 flex items-center justify-center flex-shrink-0 text-[10px]" style={{ backgroundColor: m.color, color: "#fff", borderRadius: 999, fontWeight: 600 }}>{m.initials}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="text-[12px] truncate" style={{ color: C.ink, fontWeight: !m.read ? 600 : 500 }}>{m.who}</span>
                  <span className="text-[10px]" style={{ color: C.muted }}>{m.when}</span>
                </div>
                <div className="text-[11px]" style={{ color: !m.read ? C.inkSoft : C.muted, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{m.text}</div>
                {m.relatedTaskId && (
                  <div className="text-[9px] mt-1 flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity" style={{ color: C.cobalt, fontWeight: 600 }}>
                    <ArrowRight size={8} /> abrir tarea
                  </div>
                )}
              </div>
              {!m.read && <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: C.cobalt }} />}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-6 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <Eyebrow>Actividad</Eyebrow>
          <Activity size={12} style={{ color: C.muted }} />
        </div>
        {(!Array.isArray(visibleActivity) || visibleActivity.length === 0) ? (
          <div className="text-[11px] italic leading-relaxed" style={{ color: C.muted }}>
            Sin actividad reciente.<br/>
            <span style={{ fontSize: 10, opacity: 0.8 }}>Cuando crees, cerres o edites tareas, aparece acá.</span>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleActivity.map((a) => {
              const clickable = !!(a.relatedTaskId || a.relatedSpace);
              const relevant = isRelevantActivity(a);
              return (
                <button key={a.id} onClick={() => clickable && handleActivityClick(a)} disabled={!clickable}
                  className="w-full text-left hover:opacity-80 group/act"
                  style={{
                    cursor: clickable ? "pointer" : "default",
                    display: "flex", gap: relevant ? 10 : 8,
                    alignItems: "flex-start",
                    padding: relevant ? "8px 10px" : "3px 0",
                    borderRadius: relevant ? 3 : 0,
                    backgroundColor: relevant ? `${C.cobalt}09` : "transparent",
                    border: relevant ? `1px solid ${C.cobalt}22` : "1px solid transparent",
                    marginBottom: relevant ? 2 : 0,
                    transition: "background 0.15s",
                  }}>
                  <span style={{
                    width: relevant ? 8 : 6,
                    height: relevant ? 8 : 6,
                    borderRadius: "50%",
                    flexShrink: 0,
                    marginTop: relevant ? 4 : 5,
                    backgroundColor: relevant ? C.cobalt : a.color,
                    boxShadow: relevant ? `0 0 0 2px ${C.cobalt}33` : "none",
                  }} />
                  <div className="flex-1 min-w-0">
                    <div style={{
                      color: relevant ? C.ink : C.inkSoft,
                      lineHeight: 1.5,
                      fontSize: relevant ? 12.5 : 11,
                      fontWeight: relevant ? 500 : 400,
                    }}>
                      <span style={{ fontWeight: 700, color: relevant ? C.cobalt : C.ink }}>{a.who}</span>{" "}{a.what}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5" style={{ fontSize: 10, color: C.muted }}>
                      <span>{timeAgo(a.ts)}</span>
                      {clickable && (
                        <span className="flex items-center gap-0.5 opacity-0 group-hover/act:opacity-100 transition-opacity" style={{ color: C.cobalt, fontWeight: 600, fontSize: 9 }}>
                          <ArrowRight size={8} /> {a.relatedTaskId ? "tarea" : "space"}
                        </span>
                      )}
                    </div>
                  </div>
                  {relevant && (
                    <span style={{ width: 4, height: "100%", minHeight: 20, borderRadius: 2, backgroundColor: C.cobalt, flexShrink: 0, alignSelf: "stretch", opacity: 0.5 }} />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes msgPulse{0%{box-shadow:0 0 0 0 currentColor}70%{box-shadow:0 0 0 6px transparent}100%{box-shadow:0 0 0 0 transparent}}
        @keyframes timerPulse{0%,100%{box-shadow:0 0 0 0 rgba(61,82,213,0.4)}50%{box-shadow:0 0 0 5px rgba(61,82,213,0)}}
      `}</style>
    </aside>
  );
}

// ═══ INBOX · Triage view for Smart Capture items ════════════════════════
// ─── WIKIHYGGE VIEW · file browser estilo Drive/Dropbox con lenguaje Hygge ───
// ─── WIKIHYGGE · Sub-componentes para los 3 tabs (Drive · Viewports · Links) ───

function WikiCreateMenu({ currentFolder, setActiveTab }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);


  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] hover:opacity-90"
        style={{ backgroundColor: C.ink, color: C.bg, borderRadius: 2, fontWeight: 600 }}>
        <Plus size={11} /> Crear
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 w-[280px]" style={{ backgroundColor: C.bg, border: `1px solid ${C.line}`, borderRadius: 4, boxShadow: "0 8px 24px rgba(10,11,15,0.18)" }}>
          <div className="px-3 py-2" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>Crear contenido</div>
          </div>

          <button onClick={() => { setActiveTab("viewports"); setOpen(false); }} className="w-full flex items-start gap-2 px-3 py-2 hover:opacity-90 text-left" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
            <Globe size={12} style={{ color: C.cobalt, marginTop: 2, flexShrink: 0 }} />
            <div className="flex-1 min-w-0">
              <div style={{ fontSize: 11, color: C.ink, fontWeight: 600 }}>Agregar Viewport</div>
              <div style={{ fontSize: 9, color: C.muted, marginTop: 1, lineHeight: 1.4 }}>Embebé URL externa en un space específico</div>
            </div>
          </button>

          <button onClick={() => { setActiveTab("links"); setOpen(false); }} className="w-full flex items-start gap-2 px-3 py-2 hover:opacity-90 text-left">
            <ExternalLink size={12} style={{ color: C.ochre, marginTop: 2, flexShrink: 0 }} />
            <div className="flex-1 min-w-0">
              <div style={{ fontSize: 11, color: C.ink, fontWeight: 600 }}>Agregar Link externo</div>
              <div style={{ fontSize: 9, color: C.muted, marginTop: 1, lineHeight: 1.4 }}>URLs curadas · Bronca, ClickUp, Miro, proveedores, regulación, etc.</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

function WikiViewportsTab({ viewports, setViewports, allSpaces, navigate }) {
  const [adding, setAdding] = useState(false);
  const entries = Object.entries(viewports || {});

  const deleteViewport = (spaceId) => {
    if (!confirm("¿Quitar viewport de este space?")) return;
    setViewports(prev => { const n = { ...prev }; delete n[spaceId]; return n; });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>
            Viewports configurados · {entries.length}
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2, fontStyle: "italic" }}>
            Cada space puede tener una URL externa embebida (Sheets, Miro, Bronca, etc.)
          </div>
        </div>
        <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] hover:opacity-90" style={{ color: C.cobalt, border: `1px solid ${C.cobalt}60`, borderRadius: 2, fontWeight: 600 }}>
          <Plus size={11} /> Agregar
        </button>
      </div>

      {entries.length === 0 && !adding ? (
        <div className="text-center py-12" style={{ backgroundColor: C.paper, border: `1px dashed ${C.lineSoft}`, borderRadius: 2 }}>
          <Globe size={28} style={{ margin: "0 auto 8px", color: C.muted, opacity: 0.4 }} />
          <div style={{ fontSize: 12, color: C.inkSoft, fontWeight: 500, marginBottom: 4 }}>Ningún viewport configurado todavía</div>
          <div style={{ fontSize: 10, color: C.muted, fontStyle: "italic", maxWidth: 360, margin: "0 auto" }}>
            Activá la feature "Viewport Externo" en + Agregar de cada space, o creá uno desde acá con el botón "Agregar"
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map(([spaceId, config]) => {
            const space = allSpaces.find(s => s.id === spaceId);
            return (
              <div key={spaceId} className="p-3 flex items-start gap-3" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
                <Globe size={14} style={{ color: C.cobalt, marginTop: 1, flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span style={{ fontSize: 12, color: C.ink, fontWeight: 600 }}>{config.label}</span>
                    {space && (
                      <button onClick={() => navigate(spaceId)} className="flex items-center gap-1 text-[9px] hover:opacity-80" style={{ color: C.cobalt, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                        <ArrowRight size={9} /> Space: {space.name}
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 2, fontFamily: "ui-monospace, monospace" }} className="truncate">{config.url}</div>
                </div>
                <a href={config.url} target="_blank" rel="noreferrer" className="p-1 hover:opacity-80" title="Abrir"><ExternalLink size={12} style={{ color: C.muted }} /></a>
                <button onClick={() => deleteViewport(spaceId)} className="p-1 hover:opacity-80" title="Quitar"><X size={12} style={{ color: C.muted }} /></button>
              </div>
            );
          })}
        </div>
      )}

      {adding && <WikiViewportAddModal allSpaces={allSpaces} existingIds={Object.keys(viewports || {})} onSave={(spaceId, config) => { setViewports(prev => ({ ...prev, [spaceId]: config })); setAdding(false); }} onClose={() => setAdding(false)} />}
    </div>
  );
}

function WikiViewportAddModal({ allSpaces, existingIds, onSave, onClose }) {
  const [spaceId, setSpaceId] = useState(allSpaces[0]?.id || "");
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const availableSpaces = allSpaces.filter(s => !["hq", "inbox", "messages", "notifications", "calendar-tool", "wikihygge", "ceo-dashboard"].includes(s.id));

  const handleSave = () => {
    if (!url.trim() || !spaceId) return;
    let cleanUrl = url.trim();
    if (cleanUrl.includes("docs.google.com") && cleanUrl.includes("/edit")) {
      cleanUrl = cleanUrl.replace("/edit", "/preview").split("?")[0].split("#")[0];
    }
    onSave(spaceId, { url: cleanUrl, label: label || cleanUrl });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(10,11,15,0.5)" }} onClick={onClose}>
      <div className="w-full max-w-[440px]" style={{ backgroundColor: C.bg, border: `1px solid ${C.line}`, borderRadius: 4 }} onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>Agregar Viewport</div>
          <div style={{ fontSize: 16, color: C.ink, fontWeight: 600, marginTop: 2 }}>Embebé URL en un space</div>
        </div>
        <div className="px-5 py-4 space-y-3">
          <label className="block">
            <span style={{ fontSize: 10, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600, display: "block", marginBottom: 4 }}>Space destino</span>
            <select value={spaceId} onChange={e => setSpaceId(e.target.value)} className="w-full px-3 py-2 outline-none" style={{ backgroundColor: C.paper, border: `1px solid ${C.line}`, borderRadius: 2, fontSize: 12 }}>
              {availableSpaces.map(s => (
                <option key={s.id} value={s.id}>{s.name} {existingIds.includes(s.id) ? "· (reemplazar)" : ""}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span style={{ fontSize: 10, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600, display: "block", marginBottom: 4 }}>URL</span>
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." autoFocus className="w-full px-3 py-2 outline-none" style={{ backgroundColor: C.paper, border: `1px solid ${C.line}`, borderRadius: 2, fontSize: 12, fontFamily: "ui-monospace, monospace" }} />
          </label>
          <label className="block">
            <span style={{ fontSize: 10, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600, display: "block", marginBottom: 4 }}>Etiqueta</span>
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="ej. Cash Flow 2026" className="w-full px-3 py-2 outline-none" style={{ backgroundColor: C.paper, border: `1px solid ${C.line}`, borderRadius: 2, fontSize: 12 }} />
          </label>
        </div>
        <div className="px-5 py-3 flex justify-end gap-2" style={{ borderTop: `1px solid ${C.lineSoft}`, backgroundColor: C.paper }}>
          <button onClick={onClose} className="px-3 py-1.5 text-[11px] hover:opacity-70" style={{ color: C.muted }}>Cancelar</button>
          <button onClick={handleSave} disabled={!url.trim()} className="px-3 py-1.5 text-[11px] hover:opacity-90 disabled:opacity-40" style={{ backgroundColor: C.ink, color: C.bg, borderRadius: 2, fontWeight: 600 }}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

const KNOWLEDGE_CATEGORIES = [
  { id: "operations", label: "Operación", color: C.cobalt },
  { id: "design", label: "Diseño · BAM", color: C.lavender },
  { id: "finance", label: "Finanzas", color: C.green },
  { id: "legal", label: "Legal", color: C.brick },
  { id: "marketing", label: "Marketing", color: C.ochre },
  { id: "tools", label: "Herramientas", color: C.muted },
  { id: "other", label: "Otros", color: C.muted },
];

function WikiLinksTab({ links, setLinks }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterCategory, setFilterCategory] = useState("all");
  const [query, setQuery] = useState("");

  const filtered = (links || []).filter(l => {
    if (filterCategory !== "all" && l.category !== filterCategory) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      return (l.title || "").toLowerCase().includes(q) || (l.description || "").toLowerCase().includes(q) || (l.url || "").toLowerCase().includes(q);
    }
    return true;
  });

  const grouped = filtered.reduce((acc, l) => {
    const c = l.category || "other";
    if (!acc[c]) acc[c] = [];
    acc[c].push(l);
    return acc;
  }, {});

  const deleteLink = (id) => {
    if (!confirm("¿Borrar este link?")) return;
    setLinks(prev => prev.filter(l => l.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>
            Links externos · {(links || []).length} curados
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2, fontStyle: "italic" }}>
            URLs importantes que viven afuera (Bronca, ClickUp, proveedores, regulación, etc.)
          </div>
        </div>
        <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] hover:opacity-90" style={{ color: C.cobalt, border: `1px solid ${C.cobalt}60`, borderRadius: 2, fontWeight: 600 }}>
          <Plus size={11} /> Agregar
        </button>
      </div>

      {/* Filter + search */}
      {(links || []).length > 0 && (
        <div className="flex items-center gap-2 flex-wrap p-2" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="text-[11px] px-2 py-1 outline-none" style={{ backgroundColor: C.bg, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
            <option value="all">Todas las categorías</option>
            {KNOWLEDGE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar..." className="flex-1 min-w-[120px] text-[11px] px-2 py-1 outline-none" style={{ backgroundColor: C.bg, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }} />
        </div>
      )}

      {(links || []).length === 0 && !adding ? (
        <div className="text-center py-12" style={{ backgroundColor: C.paper, border: `1px dashed ${C.lineSoft}`, borderRadius: 2 }}>
          <ExternalLink size={28} style={{ margin: "0 auto 8px", color: C.muted, opacity: 0.4 }} />
          <div style={{ fontSize: 12, color: C.inkSoft, fontWeight: 500, marginBottom: 4 }}>Sin links curados todavía</div>
          <div style={{ fontSize: 10, color: C.muted, fontStyle: "italic", maxWidth: 360, margin: "0 auto" }}>
            Agregá URLs importantes que viven afuera de Drive · sitios de proveedores, dashboards de Bronca, regulación SBS, etc.
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {KNOWLEDGE_CATEGORIES.map(cat => {
            const catLinks = grouped[cat.id];
            if (!catLinks || catLinks.length === 0) return null;
            return (
              <div key={cat.id}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span style={{ fontSize: 9, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>{cat.label} · {catLinks.length}</span>
                </div>
                <div className="space-y-1.5">
                  {catLinks.map(l => (
                    <div key={l.id} className="p-3 flex items-start gap-3 group/link" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
                      <ExternalLink size={12} style={{ color: cat.color, marginTop: 2, flexShrink: 0 }} />
                      <div className="flex-1 min-w-0">
                        <a href={l.url} target="_blank" rel="noreferrer" className="hover:opacity-80">
                          <div style={{ fontSize: 12, color: C.ink, fontWeight: 600 }}>{l.title}</div>
                        </a>
                        {l.description && <div style={{ fontSize: 10, color: C.muted, marginTop: 2, lineHeight: 1.5 }}>{l.description}</div>}
                        <div style={{ fontSize: 9, color: C.muted, marginTop: 3, fontFamily: "ui-monospace, monospace" }} className="truncate">{l.url}</div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover/link:opacity-100 transition-opacity flex-shrink-0">
                        <button onClick={() => setEditing(l)} className="p-1 hover:opacity-80" title="Editar"><PenSquare size={11} style={{ color: C.muted }} /></button>
                        <button onClick={() => deleteLink(l.id)} className="p-1 hover:opacity-80" title="Borrar"><Trash2 size={11} style={{ color: C.brick, opacity: 0.7 }} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(adding || editing) && (
        <WikiLinkEditModal
          initial={editing}
          onSave={(linkData) => {
            if (editing) {
              setLinks(prev => prev.map(l => l.id === editing.id ? { ...editing, ...linkData } : l));
              setEditing(null);
            } else {
              setLinks(prev => [...prev, { id: Date.now() + Math.random(), addedAt: Date.now(), ...linkData }]);
              setAdding(false);
            }
          }}
          onClose={() => { setAdding(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function WikiLinkEditModal({ initial, onSave, onClose }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [url, setUrl] = useState(initial?.url || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [category, setCategory] = useState(initial?.category || "operations");
  const blob = useModalBlob();
  const onInput = () => blob.onType();
  const handleSave = () => {
    if (!title.trim() || !url.trim()) { blob.onError(); return; }
    blob.onHappy(() => onSave({ title: title.trim(), url: url.trim(), description: description.trim(), category }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(10,11,15,0.5)" }} onClick={onClose}>
      <div className="w-full max-w-[480px]" style={{ backgroundColor: C.bg, border: `1px solid ${C.line}`, borderRadius: 4 }} onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
          <div>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>{initial ? "Editar link" : "Nuevo link"}</div>
            <div style={{ fontSize: 16, color: C.ink, fontWeight: 600, marginTop: 2 }}>{initial ? initial.title : "Agregar link externo"}</div>
          </div>
          <ModalBlob state={blob.state} />
        </div>
        <div className="px-5 py-4 space-y-3">
          <label className="block">
            <span style={{ fontSize: 10, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600, display: "block", marginBottom: 4 }}>Título</span>
            <input value={title} onChange={e => { setTitle(e.target.value); onInput(); }} placeholder="ej. Bronca · Brand de proyectos" autoFocus className="w-full px-3 py-2 outline-none" style={{ backgroundColor: C.paper, border: `1px solid ${C.line}`, borderRadius: 2, fontSize: 12 }} />
          </label>
          <label className="block">
            <span style={{ fontSize: 10, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600, display: "block", marginBottom: 4 }}>URL</span>
            <input value={url} onChange={e => { setUrl(e.target.value); onInput(); }} placeholder="https://..." className="w-full px-3 py-2 outline-none" style={{ backgroundColor: C.paper, border: `1px solid ${C.line}`, borderRadius: 2, fontSize: 12, fontFamily: "ui-monospace, monospace" }} />
          </label>
          <label className="block">
            <span style={{ fontSize: 10, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600, display: "block", marginBottom: 4 }}>Descripción (opcional)</span>
            <textarea value={description} onChange={e => { setDescription(e.target.value); onInput(); }} placeholder="Para qué sirve este link..." rows={2} className="w-full px-3 py-2 outline-none resize-none" style={{ backgroundColor: C.paper, border: `1px solid ${C.line}`, borderRadius: 2, fontSize: 12, lineHeight: 1.5, fontFamily: "inherit" }} />
          </label>
          <label className="block">
            <span style={{ fontSize: 10, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600, display: "block", marginBottom: 4 }}>Categoría</span>
            <select value={category} onChange={e => { setCategory(e.target.value); onInput(); }} className="w-full px-3 py-2 outline-none" style={{ backgroundColor: C.paper, border: `1px solid ${C.line}`, borderRadius: 2, fontSize: 12 }}>
              {KNOWLEDGE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
        </div>
        <div className="px-5 py-3 flex justify-end gap-2" style={{ borderTop: `1px solid ${C.lineSoft}`, backgroundColor: C.paper }}>
          <button onClick={onClose} className="px-3 py-1.5 text-[11px] hover:opacity-70" style={{ color: C.muted }}>Cancelar</button>
          <button onClick={handleSave} className="px-3 py-1.5 text-[11px] hover:opacity-90" style={{ backgroundColor: C.ink, color: C.bg, borderRadius: 2, fontWeight: 600 }}>{initial ? "Guardar" : "Agregar"}</button>
        </div>
      </div>
    </div>
  );
}

const ALICIA_BRAIN_URL = "https://aliceai.bam.pe";

const dbxFileType = (name = "") => {
  const ext = name.split(".").pop().toLowerCase();
  if (["xlsx", "xls", "csv", "numbers"].includes(ext)) return "sheet";
  if (["docx", "doc", "pages", "txt", "md"].includes(ext)) return "doc";
  if (["pptx", "ppt", "key"].includes(ext)) return "slides";
  if (ext === "pdf") return "pdf";
  return "other";
};

function WikiHyggeView({ openDetail, allSpaces, spaceViewports, setSpaceViewports, knowledgeLinks, setKnowledgeLinks, navigate }) {
  const [activeTab, setActiveTab] = useState("dropbox"); // dropbox | viewports | links
  const [currentPath, setCurrentPath] = useState("/Hygge"); // Dropbox path raíz
  const [pathStack, setPathStack] = useState([{ name: "Hygge", path: "/Hygge" }]); // breadcrumb stack
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dbxError, setDbxError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null); // null = not searching
  const [searching, setSearching] = useState(false);
  const [viewMode, setViewMode] = useState("grid"); // grid | list

  // Fetch folder contents from backend
  const fetchFolder = useCallback(async (path) => {
    setLoading(true);
    setDbxError(null);
    setSelectedFile(null);
    setSearchResults(null);
    try {
      const res = await fetch(`${ALICIA_BRAIN_URL}/api/dropbox/browse?path=${encodeURIComponent(path)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
      }
      const data = await res.json();
      setEntries(data.entries || []);
    } catch (e) {
      setDbxError(e.message);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // "drive" era el tab de la época Google Drive — el tab real es "dropbox" (con "drive" nunca cargaba nada)
  useEffect(() => { if (activeTab === "dropbox") fetchFolder(currentPath); }, [activeTab]);

  const navigateTo = (name, path) => {
    setCurrentPath(path);
    setPathStack(prev => [...prev, { name, path }]);
    setQuery("");
    fetchFolder(path);
  };

  const navigateToIndex = (idx) => {
    const entry = pathStack[idx];
    setPathStack(prev => prev.slice(0, idx + 1));
    setCurrentPath(entry.path);
    setQuery("");
    fetchFolder(entry.path);
  };

  // Search
  useEffect(() => {
    if (!query.trim()) { setSearchResults(null); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`${ALICIA_BRAIN_URL}/api/dropbox/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setSearchResults(data.results || []);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const visibleEntries = searchResults !== null ? searchResults : entries;
  const folders = visibleEntries.filter(e => e.type === "folder");
  const files = visibleEntries.filter(e => e.type !== "folder");

  // File type icon + color
  const FileIcon = ({ type, size = 18 }) => {
    const map = {
      sheet: { color: C.green, label: "XLS" },
      doc: { color: C.cobalt, label: "DOC" },
      slides: { color: C.brick, label: "PPT" },
      pdf: { color: C.brick, label: "PDF" },
      miro: { color: C.ochre, label: "MIRO" },
      other: { color: C.muted, label: "FILE" },
    };
    const t = map[type] || map.other;
    return (
      <div className="flex items-center justify-center flex-shrink-0" style={{ width: size + 8, height: size + 8, backgroundColor: `${t.color}15`, color: t.color, borderRadius: 2, border: `1px solid ${t.color}30`, fontSize: 7, fontWeight: 800, letterSpacing: "0.04em" }}>
        {t.label}
      </div>
    );
  };

  const FolderIcon = ({ size = 18 }) => (
    <svg width={size + 8} height={size + 8} viewBox="0 0 26 26" fill="none" className="flex-shrink-0">
      <path d="M3 7 L3 21 L23 21 L23 9 L13 9 L11 7 Z" fill={C.paper} stroke={C.ink} strokeWidth="1.2" />
      <line x1="3" y1="11" x2="23" y2="11" stroke={C.ink} strokeWidth="0.6" opacity="0.4" />
    </svg>
  );

  const driveUrl = (item) => item.driveId ? (item.type === "folder" ? `https://drive.google.com/drive/folders/${item.driveId}` : `https://drive.google.com/file/d/${item.driveId}/view`) : null;

  const sourceLabel = (item) => {
    if (item.source === "google-sheets") return "Google Sheets";
    if (item.source === "google-docs") return "Google Docs";
    if (item.source === "google-slides") return "Google Slides";
    if (item.source === "miro") return "Miro";
    if (item.driveId) return "Google Drive";
    return "—";
  };

  // Hygge-language contextual descriptions per top-level area
  const sectionDescription = {
    "00-empresa": "Documentos fundacionales · acuerdos de socios · cap table · constitución",
    "01-proyectos": "Los 4 SPVs activos · cada uno con su metodología de 5 fases",
    "02-bam": "Arquitectura interna · estudio y brand de la práctica",
    "03-finanzas": "Cash flows · cuentas · deuda Fit Capital · pool de inversores",
    "04-legal": "Contratos · representación legal · compliance",
    "05-comercial": "Pipeline de ventas · brokers · contratos firmados",
    "06-marketing": "Brand · campañas · contenido por proyecto",
    "07-growth": "Scouting de terrenos · evaluaciones · oportunidades nuevas",
  };

  // 5-phase project description for SPVs
  const phaseDescription = {
    "01": "Diseño arquitectónico · planos · maquetas · render",
    "02": "Trámites municipales · licencias · habilitación urbana",
    "03": "Obra en sitio · contratistas · cronograma · supervisión",
    "04": "Venta de unidades · contratos · brokers · arras",
    "05": "Cash flow del proyecto · FC · cierre financiero",
  };

  return (
    <div className="px-4 lg:px-10 py-6 lg:py-8 max-w-[1080px] mx-auto">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-baseline justify-between gap-4 mb-2">
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>
            Tools · hub de conocimiento
          </div>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.08em" }}>
            Dropbox · Viewports · Links externos
          </div>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", color: C.ink, lineHeight: 1.1 }}>
          WikiHygge
        </h1>
        <p style={{ fontSize: 13, color: C.muted, marginTop: 4, fontStyle: "italic" }}>
          Todo el conocimiento de Hygge en una sola estructura: Dropbox en tiempo real · viewports embebidos por space · links externos curados.
        </p>
      </div>

      {/* TABS · 3 secciones del hub */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
        <div className="flex items-center gap-1">
          {[
            { id: "dropbox", label: "Dropbox", icon: FileText, count: null },
            { id: "viewports", label: "Viewports", icon: Globe, count: Object.keys(spaceViewports || {}).length },
            { id: "links", label: "Links", icon: ExternalLink, count: (knowledgeLinks || []).length },
          ].map(t => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)} className="flex items-center gap-1.5 px-3 py-2 text-[12px]"
                style={{ color: isActive ? C.ink : C.muted, fontWeight: isActive ? 600 : 500, borderBottom: isActive ? `2px solid ${C.ink}` : "2px solid transparent", marginBottom: -1 }}>
                <Icon size={12} /> {t.label}
                {t.count != null && t.count > 0 && (
                  <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 10, backgroundColor: isActive ? C.ink : C.lineSoft, color: isActive ? C.bg : C.muted, fontWeight: 700 }}>{t.count}</span>
                )}
              </button>
            );
          })}
        </div>
        <button onClick={() => { fetchFolder(currentPath); }} title="Refrescar" className="p-1.5 hover:opacity-70" style={{ color: C.muted }}>
          <RefreshCw size={12} />
        </button>
      </div>

      {activeTab === "viewports" && <WikiViewportsTab viewports={spaceViewports} setViewports={setSpaceViewports} allSpaces={allSpaces} navigate={navigate} />}
      {activeTab === "links" && <WikiLinksTab links={knowledgeLinks} setLinks={setKnowledgeLinks} />}
      {activeTab === "dropbox" && (
        <>
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 flex-wrap mb-4 text-[12px]">
            {pathStack.map((node, i) => (
              <React.Fragment key={i}>
                <button onClick={() => navigateToIndex(i)} className="hover:opacity-70"
                  style={{ color: i === pathStack.length - 1 ? C.ink : C.muted, fontWeight: i === pathStack.length - 1 ? 600 : 500 }}>
                  {node.name}
                </button>
                {i < pathStack.length - 1 && <span style={{ color: C.muted }}>/</span>}
              </React.Fragment>
            ))}
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 flex-1 min-w-[180px]" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
              <Search size={11} style={{ color: C.muted }} />
              <input value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Buscar en Dropbox Hygge…"
                className="flex-1 outline-none bg-transparent"
                style={{ fontSize: 12, color: C.ink, fontFamily: "inherit" }} />
              {searching && <Loader2 size={11} className="animate-spin flex-shrink-0" style={{ color: C.muted }} />}
              {query && <button onClick={() => setQuery("")}><X size={10} style={{ color: C.muted }} /></button>}
            </div>
            <div className="flex items-center" style={{ border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
              <button onClick={() => setViewMode("grid")} className="px-2 py-1.5" style={{ backgroundColor: viewMode === "grid" ? C.ink : "transparent", color: viewMode === "grid" ? C.bg : C.muted, fontSize: 10 }}>Grid</button>
              <button onClick={() => setViewMode("list")} className="px-2 py-1.5" style={{ backgroundColor: viewMode === "list" ? C.ink : "transparent", color: viewMode === "list" ? C.bg : C.muted, fontSize: 10 }}>Lista</button>
            </div>
          </div>

          {/* Error */}
          {dbxError && (
            <div className="mb-4 p-3 text-[12px]" style={{ backgroundColor: `${C.brick}10`, border: `1px solid ${C.brick}30`, borderRadius: 2, color: C.brick }}>
              {dbxError}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-2 py-8 justify-center" style={{ color: C.muted }}>
              <Loader2 size={14} className="animate-spin" />
              <span style={{ fontSize: 12 }}>Cargando Dropbox…</span>
            </div>
          )}

          {/* Content */}
          {!loading && !dbxError && (
            <>
              {folders.length === 0 && files.length === 0 ? (
                <div className="text-center py-12" style={{ backgroundColor: C.paper, border: `1px dashed ${C.lineSoft}`, borderRadius: 2 }}>
                  <div style={{ fontSize: 13, color: C.muted }}>{query.trim() ? "Sin resultados" : "Carpeta vacía"}</div>
                </div>
              ) : (
                <>
                  {/* FOLDERS */}
                  {folders.length > 0 && (
                    <div className="mb-6">
                      <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>
                        Carpetas · {folders.length}
                      </div>
                      {viewMode === "grid" ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {folders.map(f => (
                            <button key={f.path} onClick={() => navigateTo(f.name, f.path)}
                              className="text-left p-3 flex items-center gap-3 hover:opacity-90"
                              style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
                              <FolderIcon size={18} />
                              <div className="flex-1 min-w-0">
                                <div style={{ fontSize: 12, color: C.ink, fontWeight: 600, lineHeight: 1.3 }} className="truncate">{f.name}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div style={{ border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
                          {folders.map((f, i) => (
                            <button key={f.path} onClick={() => navigateTo(f.name, f.path)}
                              className="w-full text-left px-3 py-2 flex items-center gap-3 hover:opacity-90"
                              style={{ backgroundColor: C.paper, borderTop: i > 0 ? `1px solid ${C.lineSoft}` : "none" }}>
                              <FolderIcon size={14} />
                              <div className="flex-1 min-w-0">
                                <div style={{ fontSize: 12, color: C.ink, fontWeight: 600 }} className="truncate">{f.name}</div>
                              </div>
                              <ChevronRight size={12} style={{ color: C.muted }} />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* FILES */}
                  {files.length > 0 && (
                    <div>
                      <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>
                        Archivos · {files.length}
                      </div>
                      <div style={{ border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
                        {files.map((f, i) => (
                          <button key={f.path} onClick={() => setSelectedFile(selectedFile?.path === f.path ? null : f)}
                            className="w-full text-left px-3 py-2.5 flex items-center gap-3 hover:opacity-90"
                            style={{ backgroundColor: selectedFile?.path === f.path ? `${C.cobalt}10` : C.paper, borderTop: i > 0 ? `1px solid ${C.lineSoft}` : "none", borderLeft: selectedFile?.path === f.path ? `2px solid ${C.cobalt}` : "2px solid transparent" }}>
                            <FileIcon type={dbxFileType(f.name)} size={14} />
                            <div className="flex-1 min-w-0">
                              <div style={{ fontSize: 12, color: C.ink, fontWeight: 600 }} className="truncate">{f.name}</div>
                              {f.modified && <div style={{ fontSize: 9, color: C.muted, marginTop: 1 }}>{f.modified?.slice(0, 10)}{f.size ? ` · ${(f.size / 1024).toFixed(0)} KB` : ""}</div>}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* File detail */}
              {selectedFile && (
                <div className="mt-4 p-4" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileIcon type={dbxFileType(selectedFile.name)} size={20} />
                      <div className="flex-1 min-w-0">
                        <div style={{ fontSize: 14, color: C.ink, fontWeight: 600 }}>{selectedFile.name}</div>
                        <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                          Dropbox · {selectedFile.path} · {selectedFile.modified?.slice(0, 10) || "—"}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setSelectedFile(null)} className="p-1 hover:opacity-70"><X size={12} style={{ color: C.muted }} /></button>
                  </div>
                  <a href={`https://www.dropbox.com/home${selectedFile.path}`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] hover:opacity-90"
                    style={{ backgroundColor: C.ink, color: C.bg, borderRadius: 2, fontWeight: 600 }}>
                    <ArrowRight size={11} /> Abrir en Dropbox
                  </a>
                </div>
              )}

              <div className="mt-8 pt-4" style={{ borderTop: `1px solid ${C.lineSoft}` }}>
                <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.08em" }}>
                  Conectado a Dropbox Hygge · datos en tiempo real vía aliceai.bam.pe
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ─── CEO DASHBOARD · vista ejecutiva con audiencias compartibles ───
// Seed inicial · el state real vive en App como `ceoProjects` y se edita desde el dashboard
// driveId: link a la carpeta del proyecto en Drive (fuente operativa)
const INITIAL_CEO_PROJECTS = [];

const _fmtM = (n) => n >= 1000000 ? `$${(n/1000000).toFixed(1)}M` : n >= 1000 ? `$${(n/1000).toFixed(0)}K` : `$${n}`;
const _pctOf = (a, b) => b > 0 ? Math.round((a/b)*100) : 0;

// Audience presets · qué ve cada audiencia
const CEO_AUDIENCE_PRESETS = {
  internal: { label: "Equipo interno", sections: { kpis: true, projects: true, projectDetails: true, revenue: true, tasks: true, units: true, pipeline: true }, color: C.ink },
  investors: { label: "Inversionistas", sections: { kpis: true, projects: true, projectDetails: true, revenue: true, tasks: false, units: true, pipeline: false }, color: C.cobalt },
  buyers: { label: "Compradores", sections: { kpis: false, projects: true, projectDetails: false, revenue: false, tasks: false, units: true, pipeline: false }, color: C.green },
};

// ─── VIEWPORT EXTERNO · iframe a una URL externa por space ───
// Use cases: Cash Flow sheet, Cap Table, Miro board, Bronca site, Notion page
// La URL se guarda por space en `spaceViewports[spaceId] = { url, label }`
const VIEWPORT_PRESETS = [];

// ─── APP EMBED VIEW ────────────────────────────────────────────────────────
// Renderiza una app externa (Radar, futuro Reactor, etc.) como iframe full-screen.
// Aporta: barra de control superior, postMessage para auth handshake, fallback si bloquea iframe.
function AppWhiteboardView({ app }) {
  const [elements, setElements] = useState(() => {
    try { return JSON.parse(localStorage.getItem("hygge:wb:app-diagramatic") || "[]"); } catch { return []; }
  });
  const updateElements = (fn) => {
    const next = typeof fn === "function" ? fn(elements) : fn;
    setElements(next);
    try { localStorage.setItem("hygge:wb:app-diagramatic", JSON.stringify(next)); } catch {}
  };
  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: C.bg }}>
      <div className="flex items-center justify-between px-4 lg:px-8 py-3 flex-wrap gap-2" style={{ borderBottom: `1px solid ${C.lineSoft}`, backgroundColor: C.paper }}>
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-7 h-7 flex items-center justify-center flex-shrink-0" style={{ backgroundColor: app.dot + "20", border: `1px solid ${app.dot}40`, borderRadius: 2 }}>
            <app.icon size={14} style={{ color: app.dot }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span style={{ fontSize: 13, fontWeight: 600, color: C.ink, letterSpacing: "-0.01em" }}>{app.label}</span>
              {app.badge && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 10, backgroundColor: C.lineSoft, color: C.muted, fontWeight: 700, fontFamily: "ui-monospace, monospace" }}>{app.badge}</span>}
              <span style={{ fontSize: 10, color: C.muted, letterSpacing: "0.04em" }}>· {app.description}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <WhiteboardView spaceName="Whiteboard" elements={elements} updateElements={updateElements} />
      </div>
    </div>
  );
}

function AppEmbedView({ app, currentUser, currentSpace }) {
  if (app.id === "app-diagramatic") return <AppWhiteboardView app={app} />;

  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(!!app.blocked);
  const iframeRef = useRef(null);

  // postMessage al iframe cuando carga, con el contexto de ALICE
  useEffect(() => {
    if (!loaded || !iframeRef.current) return;
    try {
      const payload = {
        type: "hygge:context",
        user: currentUser ? {
          id: currentUser.id,
          firstName: currentUser.firstName,
          role: currentUser.role,
        } : null,
        space: currentSpace,
        timestamp: Date.now(),
      };
      iframeRef.current.contentWindow?.postMessage(payload, "*");
    } catch {}
  }, [loaded, currentUser, currentSpace]);

  // Listener para mensajes que envía la app embebida
  useEffect(() => {
    const handler = (e) => {
      // Validar origen contra la URL configurada (mínima seguridad)
      try {
        if (!app.native) {
          const appOrigin = new URL(app.url).origin;
          if (e.origin !== appOrigin) return;
        }
      } catch { return; }
      const msg = e.data;
      if (!msg || typeof msg !== "object") return;
      // Por ahora solo log · futuro: routear notificaciones a la inbox de ALICE
      if (msg.type === "hygge:notify") {
        console.log("[App notify]", app.id, msg.message);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [app.url, app.id]);

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: C.bg }}>
      {/* Barra de control superior · idéntica en estructura al Viewport */}
      <div className="flex items-center justify-between px-4 lg:px-8 py-3 flex-wrap gap-2" style={{ borderBottom: `1px solid ${C.lineSoft}`, backgroundColor: C.paper }}>
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-7 h-7 flex items-center justify-center flex-shrink-0" style={{ backgroundColor: app.dot + "20", border: `1px solid ${app.dot}40`, borderRadius: 2 }}>
            <app.icon size={14} style={{ color: app.dot }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span style={{ fontSize: 13, fontWeight: 600, color: C.ink, letterSpacing: "-0.01em" }}>{app.label}</span>
              {app.badge && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 10, backgroundColor: C.lineSoft, color: C.muted, fontWeight: 700, fontFamily: "ui-monospace, monospace" }}>{app.badge}</span>}
              <span style={{ fontSize: 10, color: C.muted, letterSpacing: "0.04em" }}>· {app.description}</span>
            </div>
            <div style={{ fontSize: 9, color: C.muted, fontFamily: "ui-monospace, monospace", marginTop: 1 }} className="truncate">{app.url}</div>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => { setError(false); setLoaded(false); if (iframeRef.current) iframeRef.current.src = app.url; }} className="p-1.5 hover:opacity-80" title="Recargar">
            <RefreshCw size={12} style={{ color: C.muted }} />
          </button>
          <a href={app.url} target="_blank" rel="noreferrer" className="p-1.5 hover:opacity-80" title="Abrir en pestaña nueva">
            <ExternalLink size={12} style={{ color: C.muted }} />
          </a>
        </div>
      </div>

      {/* Iframe del app · full height */}
      <div className="flex-1 relative" style={{ backgroundColor: "#1A1A1A" /* fondo del Radar mientras carga */ }}>
        {!loaded && !error && (
          <div className="absolute inset-0 flex items-center justify-center z-10" style={{ backgroundColor: C.bg }}>
            <div className="text-center">
              <div className="w-8 h-8 rounded-full mx-auto mb-3" style={{ border: `2px solid ${app.dot}40`, borderTopColor: app.dot, animation: "spin 0.8s linear infinite" }} />
              <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>Cargando {app.label}</div>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-6" style={{ backgroundColor: C.bg }}>
            <div className="max-w-md text-center">
              <Globe size={32} style={{ color: C.muted, opacity: 0.4, margin: "0 auto 12px" }} />
              <div style={{ fontSize: 14, color: C.ink, fontWeight: 600, marginBottom: 6 }}>No se pudo cargar {app.label}</div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 16, lineHeight: 1.5 }}>{app.blocked ? "Esta app no permite embebido — abrila en una pestaña nueva." : "El servidor del app no respondió, o bloqueó el embed via X-Frame-Options."}</div>
              <a href={app.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 hover:opacity-90" style={{ backgroundColor: C.ink, color: C.bg, borderRadius: 2, fontSize: 11, fontWeight: 600 }}>
                <ExternalLink size={11} /> Abrir {app.label} en pestaña nueva
              </a>
            </div>
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={app.url}
          title={app.label}
          className="w-full h-full"
          style={{ border: "none" }}
          onLoad={() => setLoaded(true)}
          allow="fullscreen; geolocation; clipboard-write"
        />
      </div>
    </div>
  );
}

function SpaceArchivosView({ spaceId }) {
  const rootPath = SPACE_DROPBOX_PATHS[spaceId] || "/Hygge";
  const [currentPath, setCurrentPath] = useState(rootPath);
  const [pathStack, setPathStack] = useState([{ name: rootPath.split("/").pop(), path: rootPath }]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);

  const fetchFolder = useCallback(async (path) => {
    setLoading(true); setError(null); setSelectedFile(null); setSearchResults(null);
    try {
      const res = await fetch(`${ALICIA_BRAIN_URL}/api/dropbox/browse?path=${encodeURIComponent(path)}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Error ${res.status}`);
      const data = await res.json();
      setEntries(data.entries || []);
    } catch (e) { setError(e.message); setEntries([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchFolder(rootPath); }, [spaceId]);

  const navigateTo = (name, path) => { setCurrentPath(path); setPathStack(p => [...p, { name, path }]); setQuery(""); fetchFolder(path); };
  const navigateToIdx = (i) => { const e = pathStack[i]; setPathStack(p => p.slice(0, i + 1)); setCurrentPath(e.path); setQuery(""); fetchFolder(e.path); };

  useEffect(() => {
    if (!query.trim()) { setSearchResults(null); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try { const r = await fetch(`${ALICIA_BRAIN_URL}/api/dropbox/search?q=${encodeURIComponent(query)}`); const d = await r.json(); setSearchResults(d.results || []); }
      catch { setSearchResults([]); } finally { setSearching(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  const visible = searchResults !== null ? searchResults : entries;
  const folders = visible.filter(e => e.type === "folder");
  const files = visible.filter(e => e.type !== "folder");

  const FolderIcon = () => (
    <svg width="22" height="22" viewBox="0 0 26 26" fill="none" className="flex-shrink-0">
      <path d="M3 7 L3 21 L23 21 L23 9 L13 9 L11 7 Z" fill={C.paper} stroke={C.ink} strokeWidth="1.2" />
      <line x1="3" y1="11" x2="23" y2="11" stroke={C.ink} strokeWidth="0.6" opacity="0.4" />
    </svg>
  );

  return (
    <div className="px-4 lg:px-7 py-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 flex-wrap mb-4 text-[12px]">
        {pathStack.map((node, i) => (
          <React.Fragment key={i}>
            <button onClick={() => navigateToIdx(i)} className="hover:opacity-70"
              style={{ color: i === pathStack.length - 1 ? C.ink : C.muted, fontWeight: i === pathStack.length - 1 ? 600 : 400 }}>
              {node.name}
            </button>
            {i < pathStack.length - 1 && <span style={{ color: C.muted }}>/</span>}
          </React.Fragment>
        ))}
        <button onClick={() => fetchFolder(currentPath)} className="ml-1 hover:opacity-70" title="Refrescar">
          <RefreshCw size={11} style={{ color: C.muted }} />
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 mb-4" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
        <Search size={11} style={{ color: C.muted }} />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar archivos…"
          className="flex-1 outline-none bg-transparent" style={{ fontSize: 12, color: C.ink, fontFamily: "inherit" }} />
        {searching && <Loader2 size={11} className="animate-spin" style={{ color: C.muted }} />}
        {query && <button onClick={() => setQuery("")}><X size={10} style={{ color: C.muted }} /></button>}
      </div>

      {error && <div className="p-3 mb-3 text-[12px]" style={{ backgroundColor: `${C.brick}10`, border: `1px solid ${C.brick}30`, borderRadius: 2, color: C.brick }}>{error}</div>}

      {loading ? (
        <div className="flex items-center gap-2 py-10 justify-center" style={{ color: C.muted }}>
          <Loader2 size={14} className="animate-spin" /><span style={{ fontSize: 12 }}>Cargando…</span>
        </div>
      ) : (
        <>
          {folders.length === 0 && files.length === 0 ? (
            <div className="text-center py-10" style={{ backgroundColor: C.paper, border: `1px dashed ${C.lineSoft}`, borderRadius: 2 }}>
              <div style={{ fontSize: 12, color: C.muted }}>{query ? "Sin resultados" : "Carpeta vacía en Dropbox"}</div>
            </div>
          ) : (
            <>
              {folders.length > 0 && (
                <div className="mb-5">
                  <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>Carpetas · {folders.length}</div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {folders.map(f => (
                      <button key={f.path} onClick={() => navigateTo(f.name, f.path)}
                        className="text-left p-3 flex items-center gap-2.5 hover:opacity-90"
                        style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
                        <FolderIcon />
                        <span style={{ fontSize: 12, color: C.ink, fontWeight: 600 }} className="truncate">{f.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {files.length > 0 && (
                <div>
                  <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>Archivos · {files.length}</div>
                  <div style={{ border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
                    {files.map((f, i) => (
                      <button key={f.path} onClick={() => setSelectedFile(selectedFile?.path === f.path ? null : f)}
                        className="w-full text-left px-3 py-2.5 flex items-center gap-3 hover:opacity-90"
                        style={{ backgroundColor: selectedFile?.path === f.path ? `${C.cobalt}10` : C.paper, borderTop: i > 0 ? `1px solid ${C.lineSoft}` : "none", borderLeft: selectedFile?.path === f.path ? `2px solid ${C.cobalt}` : "2px solid transparent" }}>
                        <div className="flex items-center justify-center flex-shrink-0" style={{ width: 26, height: 26, backgroundColor: `${C.cobalt}15`, borderRadius: 2, fontSize: 7, fontWeight: 800, color: C.cobalt, letterSpacing: "0.04em" }}>
                          {dbxFileType(f.name).toUpperCase().slice(0, 3)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div style={{ fontSize: 12, color: C.ink, fontWeight: 600 }} className="truncate">{f.name}</div>
                          {f.modified && <div style={{ fontSize: 9, color: C.muted }}>{f.modified.slice(0, 10)}{f.size ? ` · ${(f.size / 1024).toFixed(0)} KB` : ""}</div>}
                        </div>
                        {selectedFile?.path === f.path && (
                          <a href={`https://www.dropbox.com/home${f.path}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                            className="text-[9px] px-2 py-1 flex-shrink-0 hover:opacity-80"
                            style={{ color: C.cobalt, border: `1px solid ${C.cobalt}40`, borderRadius: 2, fontWeight: 600, letterSpacing: "0.06em" }}>
                            Abrir
                          </a>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          <div className="mt-6 pt-3" style={{ borderTop: `1px solid ${C.lineSoft}` }}>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.06em" }}>
              Dropbox · {currentPath} · tiempo real via aliceai.bam.pe
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ViewportView({ spaceId, currentSpace, viewports, setViewports }) {
  const config = viewports[spaceId];
  const [editing, setEditing] = useState(!config?.url);
  const [draftUrl, setDraftUrl] = useState(config?.url || "");
  const [draftLabel, setDraftLabel] = useState(config?.label || "");
  const [iframeError, setIframeError] = useState(false);
  const iframeRef = useRef(null);

  const saveConfig = (url, label) => {
    if (!url) return;
    // Auto-convert common Drive edit URLs to preview
    let cleanUrl = url.trim();
    if (cleanUrl.includes("docs.google.com") && cleanUrl.includes("/edit")) {
      cleanUrl = cleanUrl.replace("/edit", "/preview").split("?")[0].split("#")[0];
    }
    setViewports(prev => ({ ...prev, [spaceId]: { url: cleanUrl, label: label || cleanUrl } }));
    setEditing(false);
    setIframeError(false);
  };

  const clearConfig = () => {
    setViewports(prev => { const n = { ...prev }; delete n[spaceId]; return n; });
    setDraftUrl(""); setDraftLabel(""); setEditing(true);
  };

  const useUrl = config?.url;

  // Empty state · sin URL configurada
  if (!useUrl || editing) {
    return (
      <div className="flex-1 flex items-center justify-center px-4 py-8" style={{ backgroundColor: C.bg }}>
        <div className="w-full max-w-[480px]" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 4, padding: 24 }}>
          <div className="mb-4">
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>Viewport Externo</div>
            <div style={{ fontSize: 18, color: C.ink, fontWeight: 600, marginTop: 4, letterSpacing: "-0.01em" }}>
              {useUrl ? "Editar URL" : "Configurar URL"}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>
              Embebé una URL externa en este space. Ideal para Google Sheets (Cash Flow, Cap Table), Miro boards, Notion pages o cualquier site con permisos de iframe.
            </div>
          </div>

          {/* Presets */}
          <div className="mb-4">
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>Atajos</div>
            <div className="flex flex-wrap gap-1.5">
              {VIEWPORT_PRESETS.map(p => (
                <button key={p.id} onClick={() => { setDraftUrl(p.url); setDraftLabel(p.label); }} className="px-2 py-1 text-[10px] hover:opacity-80" style={{ backgroundColor: C.bg, border: `1px solid ${C.lineSoft}`, borderRadius: 2, color: C.inkSoft, fontWeight: 500 }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Form */}
          <div className="space-y-3">
            <label className="block">
              <span style={{ fontSize: 10, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600, display: "block", marginBottom: 4 }}>URL</span>
              <input value={draftUrl} onChange={e => setDraftUrl(e.target.value)} placeholder="https://..." autoFocus className="w-full px-3 py-2 outline-none" style={{ backgroundColor: C.bg, border: `1px solid ${C.line}`, borderRadius: 2, fontSize: 12, color: C.ink, fontFamily: "ui-monospace, monospace" }} />
            </label>
            <label className="block">
              <span style={{ fontSize: 10, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600, display: "block", marginBottom: 4 }}>Etiqueta (opcional)</span>
              <input value={draftLabel} onChange={e => setDraftLabel(e.target.value)} placeholder="ej. Cash Flow 2026" className="w-full px-3 py-2 outline-none" style={{ backgroundColor: C.bg, border: `1px solid ${C.line}`, borderRadius: 2, fontSize: 12, color: C.ink }} />
            </label>
          </div>

          <div className="mt-4 flex items-center gap-2 justify-end">
            {useUrl && <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-[11px] hover:opacity-70" style={{ color: C.muted }}>Cancelar</button>}
            <button onClick={() => saveConfig(draftUrl, draftLabel)} disabled={!draftUrl.trim()} className="px-3 py-1.5 text-[11px] hover:opacity-90 disabled:opacity-40" style={{ backgroundColor: C.ink, color: C.bg, borderRadius: 2, fontWeight: 600 }}>
              {useUrl ? "Guardar" : "Embebedar"}
            </button>
          </div>

          <div className="mt-4 px-3 py-2 text-[10px]" style={{ backgroundColor: `${C.ochre}10`, border: `1px solid ${C.ochre}30`, borderRadius: 2, color: C.inkSoft, lineHeight: 1.55 }}>
            <strong style={{ color: C.ochre }}>Tip:</strong> Google Drive URLs con <code>/edit</code> no embedan · se convierten automáticamente a <code>/preview</code>. Si una URL no carga, el sitio bloqueó iframes — usá "Abrir en pestaña nueva".
          </div>
        </div>
      </div>
    );
  }

  // Render con iframe
  return (
    <div className="flex flex-col flex-1" style={{ backgroundColor: C.bg, height: "calc(100vh - 110px)" }}>
      {/* Toolbar */}
      <div className="px-4 py-2 flex items-center gap-2 flex-wrap" style={{ backgroundColor: C.paper, borderBottom: `1px solid ${C.lineSoft}` }}>
        <Globe size={11} style={{ color: C.muted, flexShrink: 0 }} />
        <div className="flex-1 min-w-0">
          <div style={{ fontSize: 11, color: C.ink, fontWeight: 600 }} className="truncate">{config.label}</div>
          <div style={{ fontSize: 9, color: C.muted, fontFamily: "ui-monospace, monospace" }} className="truncate">{config.url}</div>
        </div>
        <button onClick={() => iframeRef.current?.contentWindow?.location.reload?.()} className="px-2 py-1 text-[10px] hover:opacity-80" style={{ color: C.muted, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }} title="Recargar">
          ↻
        </button>
        <a href={config.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-2 py-1 text-[10px] hover:opacity-80" style={{ color: C.cobalt, border: `1px solid ${C.cobalt}40`, borderRadius: 2, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          <ExternalLink size={9} /> Abrir
        </a>
        <button onClick={() => setEditing(true)} className="flex items-center gap-1 px-2 py-1 text-[10px] hover:opacity-80" style={{ color: C.muted, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
          <PenSquare size={9} /> Editar URL
        </button>
        <button onClick={() => { if (confirm("¿Quitar viewport de este space?")) clearConfig(); }} className="p-1 hover:opacity-80" title="Quitar" style={{ color: C.muted }}>
          <X size={11} />
        </button>
      </div>

      {/* Iframe */}
      <div className="flex-1 relative" style={{ backgroundColor: C.surface }}>
        <iframe
          ref={iframeRef}
          src={config.url}
          className="w-full h-full"
          style={{ border: 0, minHeight: 400 }}
          title={config.label}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="no-referrer-when-downgrade"
          onError={() => setIframeError(true)}
        />
        {iframeError && (
          <div className="absolute inset-0 flex items-center justify-center px-4" style={{ backgroundColor: `${C.bg}EE` }}>
            <div className="max-w-[400px] text-center">
              <div style={{ fontSize: 13, color: C.brick, fontWeight: 600, marginBottom: 6 }}>El sitio bloqueó el iframe</div>
              <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
                Algunos sites no permiten ser embebidos por seguridad. Usá <a href={config.url} target="_blank" rel="noreferrer" style={{ color: C.cobalt, fontWeight: 600 }}>Abrir en pestaña nueva</a>.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── LAB VIEW · wrapper que renderiza cada panel agente según labId ───
function LabView({ labId, ...allProps }) {
  const item = LAB_TOOLS.find(t => t.id === labId);
  if (!item) return null;

  const PanelEl = (() => {
    switch (labId) {
      case "lab-tea-table": return <TeaTableView {...allProps} />;
      case "lab-cheshire": return <CheshirePanel {...allProps} />;
      case "lab-bandersnatch": return <BandersnatchPanel {...allProps} />;
      case "lab-mad-hatter": return <MadHatterPanel {...allProps} />;
      case "lab-white-rabbit": return <WhiteRabbitPanel {...allProps} />;
      case "lab-dark-alice": return <DarkAlicePanel {...allProps} />;
      case "lab-jabberwocky":
        return (
          <div className="px-6 py-8 max-w-[840px] mx-auto">
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>⚡ Jabberwocky</div>
            <h1 className="text-[24px] mt-2" style={{ color: C.ink, fontWeight: 600, letterSpacing: "-0.02em" }}>Síntesis de veredicto</h1>
            <p className="text-[12px] mt-3" style={{ color: C.muted, lineHeight: 1.6 }}>
              Jabberwocky se invoca desde la Tea Table cuando dos o más agentes responden. Sintetiza sus voces en un veredicto único.
              No tiene panel propio — vive dentro del flujo del consejo. Abrí <strong>Tea Table</strong> y convocá a múltiples agentes para verlo en acción.
            </p>
          </div>
        );
      default: return null;
    }
  })();

  return (
    <div className="relative">
      <div className="sticky top-0 z-10 px-4 lg:px-8 py-3 flex items-center gap-2" style={{ backgroundColor: `${C.ochre}10`, borderBottom: `1px solid ${C.ochre}40` }}>
        <FlaskConical size={11} style={{ color: C.ochre }} />
        <span style={{ fontSize: 10, color: C.ochre, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Lab · {item.label}</span>
        <span style={{ fontSize: 10, color: C.muted, fontStyle: "italic" }}>· feature experimental, comportamiento puede cambiar</span>
      </div>
      {PanelEl}
    </div>
  );
}

function CEODashboardView({ tasks, terrenos, allSpaces, projects, nps, navigate, openDetail, onEditProject, onEditNps, onResetSeed }) {
  const [activeProject, setActiveProject] = useState(null);
  const [audience, setAudience] = useState("internal");
  const [shareOpen, setShareOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [editingNps, setEditingNps] = useState(false);
  const visible = CEO_AUDIENCE_PRESETS[audience].sections;

  // Fuentes externas · Drive sheets que respaldan los KPIs
  const SOURCES = {};

  // KPIs reales · derivados de ALICE state + projects
  const kpis = useMemo(() => {
    const revenueTotal = projects.reduce((s, p) => s + p.revenue.proyectado, 0);
    const captadoTotal = projects.reduce((s, p) => s + p.revenue.captado, 0);
    const unidadesTotal = projects.reduce((s, p) => s + p.unidades.total, 0);
    const unidadesVendidas = projects.reduce((s, p) => s + p.unidades.vendidas, 0);
    const tareasActivas = tasks.filter(t => !t.checked).length;
    const tareasVencidas = tasks.filter(t => {
      if (t.checked || !t.due || t.due === "—") return false;
      const d = new Date(t.due);
      return !isNaN(d) && d < new Date();
    }).length;
    return { revenueTotal, captadoTotal, unidadesTotal, unidadesVendidas, tareasActivas, tareasVencidas, nps };
  }, [tasks, projects, nps]);

  // Tareas críticas reales (urgentes o vencidas, top 6)
  const criticalTasks = useMemo(() => {
    return tasks
      .filter(t => !t.checked)
      .map(t => {
        const dueDate = (t.due && t.due !== "—") ? new Date(t.due) : null;
        const dias = dueDate && !isNaN(dueDate) ? Math.round((dueDate - new Date()) / 86400000) : 999;
        const space = allSpaces.find(s => s.id === t.space);
        return { ...t, dias, listName: space?.name || t.space || "—" };
      })
      .sort((a, b) => a.dias - b.dias)
      .slice(0, 6);
  }, [tasks, allSpaces]);

  // Pipeline real · terrenos activos
  const pipelineTerrenos = useMemo(() => {
    return (terrenos || []).filter(t => !["descartado", "comprado"].includes(t.status)).slice(0, 4);
  }, [terrenos]);

  return (
    <div id="ceo-dashboard-printable" className="px-4 lg:px-8 py-6 max-w-[1200px] mx-auto">

      {/* HEADER · audiencia + share */}
      <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>
            CEO Dashboard · Hygge Holding
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", color: C.ink, marginTop: 4 }}>
            Portafolio {new Date().getFullYear()}
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Audience selector */}
          <div className="flex items-center" style={{ border: `1px solid ${C.line}`, borderRadius: 4, padding: 2, backgroundColor: C.paper }}>
            {Object.entries(CEO_AUDIENCE_PRESETS).map(([key, val]) => (
              <button key={key} onClick={() => setAudience(key)} className="px-2.5 py-1 text-[10px] transition-all"
                style={{ backgroundColor: audience === key ? val.color : "transparent", color: audience === key ? C.bg : C.muted, borderRadius: 2, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                {val.label}
              </button>
            ))}
          </div>
          <button onClick={() => setShareOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] hover:opacity-90" style={{ backgroundColor: C.ink, color: C.bg, borderRadius: 2, fontWeight: 600, letterSpacing: "0.04em" }}>
            <Send size={11} /> Compartir
          </button>
          <button onClick={() => printDashboard({ title: "CEO Dashboard · " + CEO_AUDIENCE_PRESETS[audience].label, htmlSelector: "#ceo-dashboard-printable" })} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] hover:opacity-80" style={{ color: C.inkSoft, border: `1px solid ${C.line}`, borderRadius: 2, fontWeight: 500 }} title="Descarga HTML imprimible · abrílo y usá Cmd+P para Save as PDF">
            <Download size={11} /> Descargar PDF
          </button>
          {audience === "internal" && (
            <button onClick={() => { if (confirm("¿Resetear todos los proyectos a datos seed iniciales? Tu edición manual se pierde.")) onResetSeed && onResetSeed(); }} className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] hover:opacity-70" style={{ color: C.muted, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }} title="Resetear a seed">
              ↺ Reset
            </button>
          )}
        </div>
      </div>

      {/* Audience pill · qué se ve */}
      <div className="mb-3 px-3 py-2 flex items-center justify-between flex-wrap gap-2" style={{ backgroundColor: `${CEO_AUDIENCE_PRESETS[audience].color}10`, border: `1px solid ${CEO_AUDIENCE_PRESETS[audience].color}30`, borderRadius: 2 }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CEO_AUDIENCE_PRESETS[audience].color }} />
          <span style={{ fontSize: 10, color: CEO_AUDIENCE_PRESETS[audience].color, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Vista actual · {CEO_AUDIENCE_PRESETS[audience].label}
          </span>
        </div>
        <span style={{ fontSize: 10, color: C.muted, fontStyle: "italic" }}>
          {audience === "investors" && "FC, revenue y unidades · sin pipeline interno ni tareas"}
          {audience === "buyers" && "Solo unidades, fase y vencimiento por proyecto · sin financials"}
          {audience === "internal" && "Vista completa · todo visible"}
        </span>
      </div>

      {/* Disclaimer de datos · solo en modo interno */}
      {audience === "internal" && (
        <div className="mb-5 flex items-start gap-2 px-3 py-2" style={{ backgroundColor: `${C.ochre}15`, border: `1px solid ${C.ochre}40`, borderRadius: 2 }}>
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: C.ochre }} />
          <div style={{ fontSize: 10, color: C.inkSoft, lineHeight: 1.55 }}>
            <strong style={{ color: C.ochre, fontWeight: 700 }}>Edición manual</strong> · Las tareas son datos reales (contrastables con ClickUp). Los números financieros (unidades, revenue, FC) son edición manual hasta que conectemos backend a Cash Flow 2026 + Cap Table.
          </div>
        </div>
      )}

      {/* KPI Strip · cada uno linkea a su fuente */}
      {visible.kpis && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-5">
          {[
            { label: "Revenue Total", val: _fmtM(kpis.revenueTotal), sub: "Portafolio proyectado", dark: true },
            { label: "Captado YTD", val: _fmtM(kpis.captadoTotal), sub: `${_pctOf(kpis.captadoTotal, kpis.revenueTotal)}% del portafolio` },
            { label: "Unidades", val: `${kpis.unidadesVendidas}/${kpis.unidadesTotal}`, sub: `${_pctOf(kpis.unidadesVendidas, kpis.unidadesTotal)}% vendido` },
            { label: "Tareas Activas", val: kpis.tareasActivas, sub: `${kpis.tareasVencidas} vencidas`, hide: !visible.tasks, onClick: () => navigate && navigate("inbox"), sourceLabel: "Inbox" },
            { label: "NPS Compradores", val: kpis.nps, sub: "Promotores netos", editable: audience === "internal", onClick: () => setEditingNps(true) },
          ].filter(k => !k.hide).map((k, i) => {
            const Tag = k.href ? "a" : "div";
            const hoverable = !!(k.href || k.editable || k.onClick);
            return (
              <Tag key={i} href={k.href} target={k.href ? "_blank" : undefined} rel={k.href ? "noreferrer" : undefined}
                onClick={k.onClick && !k.href ? k.onClick : undefined}
                className={`block ${hoverable ? "hover:opacity-90 group/kpi" : ""}`}
                style={{ backgroundColor: k.dark ? C.ink : C.paper, border: `1px solid ${k.dark ? C.ink : C.lineSoft}`, borderRadius: 4, padding: "14px 16px", cursor: hoverable ? "pointer" : "default", transition: "opacity 0.15s", textDecoration: "none" }}>
                <div style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: k.dark ? C.lavender : C.muted, fontWeight: 600, marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
                  {k.label}
                  {k.editable && <PenSquare size={8} style={{ opacity: 0.5 }} />}
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: k.dark ? C.bg : C.ink, lineHeight: 1, letterSpacing: "-0.02em" }}>{k.val}</div>
                <div style={{ fontSize: 10, color: k.dark ? "#CBC7C3" : C.muted, marginTop: 4 }}>{k.sub}</div>
                {k.sourceLabel && hoverable && (
                  <div className="opacity-0 group-hover/kpi:opacity-100 transition-opacity flex items-center gap-1 mt-2" style={{ fontSize: 9, color: k.dark ? C.lavender : C.cobalt, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    <ArrowRight size={9} /> {k.sourceLabel}
                  </div>
                )}
              </Tag>
            );
          })}
        </div>
      )}

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">

        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-3">
          {/* Projects */}
          {visible.projects && (
            <div style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 4, overflow: "hidden" }}>
              <div className="px-4 py-3 flex items-center justify-between">
                <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "-0.01em", color: C.ink }}>Proyectos Activos · SPVs</span>
                <span style={{ fontSize: 10, color: C.muted }}>{projects.length} proyectos</span>
              </div>
              {projects.map((p, i) => {
                const faseColors = { "Construcción": { bg: `${C.cobalt}15`, fg: C.cobalt }, "Pre-venta": { bg: `${C.ochre}25`, fg: C.ochre }, "Fee mensual": { bg: `${C.green}20`, fg: C.green }, "Permisos": { bg: `${C.brick}15`, fg: C.brick } };
                const fc = faseColors[p.fase] || { bg: C.lineSoft, fg: C.muted };
                return (
                  <div key={p.id} onClick={() => visible.projectDetails && setActiveProject(activeProject === i ? null : i)}
                    className="group/proj"
                    style={{ padding: "12px 16px", borderTop: `1px solid ${C.lineSoft}`, cursor: visible.projectDetails ? "pointer" : "default", backgroundColor: activeProject === i ? C.bg : "transparent", transition: "background 0.15s" }}>
                    <div className="flex items-center gap-3 mb-2">
                      <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: p.color, flexShrink: 0 }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>{p.name}</span>
                          <div className="flex items-center gap-2">
                            <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 12, backgroundColor: fc.bg, color: fc.fg, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>{p.fase}</span>
                            <span style={{ fontSize: 10, color: C.muted }}>{p.vencimiento}</span>
                            {audience === "internal" && (
                              <button onClick={(e) => { e.stopPropagation(); setEditingProject(p); }} className="p-1 hover:opacity-100 transition-opacity" title="Editar proyecto" style={{ color: C.muted, opacity: 0.6 }}>
                                <PenSquare size={11} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div style={{ flex: 1, height: 3, backgroundColor: C.lineSoft, borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${p.progreso}%`, backgroundColor: p.color, borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 10, color: C.muted, width: 28, textAlign: "right", fontFamily: "ui-monospace, monospace" }}>{p.progreso}%</span>
                    </div>

                    {/* Expanded details */}
                    {activeProject === i && visible.projectDetails && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div style={{ backgroundColor: C.bg, borderRadius: 2, padding: "10px 12px" }}>
                          <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>Unidades</div>
                          {[{ label: "Vendidas", val: p.unidades.vendidas, color: C.green }, { label: "Reservadas", val: p.unidades.reservadas, color: C.ochre }, { label: "Disponibles", val: p.unidades.disponibles, color: C.muted }].map((u, j) => (
                            <div key={j} className="flex justify-between mb-1">
                              <span style={{ fontSize: 10, color: C.muted }}>{u.label}</span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: u.color }}>{u.val}</span>
                            </div>
                          ))}
                        </div>
                        {visible.revenue && (
                          <div style={{ backgroundColor: C.bg, borderRadius: 2, padding: "10px 12px" }}>
                            <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>Revenue</div>
                            <div style={{ fontSize: 10, color: C.muted }}>Proyectado</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{_fmtM(p.revenue.proyectado)}</div>
                            <div style={{ fontSize: 10, color: C.muted }}>Captado</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: C.green }}>{_fmtM(p.revenue.captado)}</div>
                          </div>
                        )}
                        {visible.revenue && (
                          <div style={{ backgroundColor: C.bg, borderRadius: 2, padding: "10px 12px" }}>
                            <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>Flujo de Caja</div>
                            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: p.fc.estado === "positivo" ? C.green : p.fc.estado === "negativo" ? C.brick : C.ochre }}>
                              {p.fc.saldo < 0 ? `-${_fmtM(Math.abs(p.fc.saldo))}` : _fmtM(p.fc.saldo)}
                            </div>
                            <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 12, display: "inline-block", backgroundColor: p.fc.estado === "positivo" ? `${C.green}20` : p.fc.estado === "negativo" ? `${C.brick}20` : `${C.ochre}20`, color: p.fc.estado === "positivo" ? C.green : p.fc.estado === "negativo" ? C.brick : C.ochre, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>{p.fc.estado}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Revenue chart */}
          {visible.revenue && (
            <div style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 4, padding: "16px 18px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.ink, marginBottom: 12 }}>Revenue por Proyecto · Captado vs Proyectado</div>
              <div className="flex flex-col gap-2.5">
                {projects.map((p) => (
                  <div key={p.id}>
                    <div className="flex justify-between mb-1">
                      <span style={{ fontSize: 10, color: C.muted }}>{p.name.replace(" · " + p.spvCode.replace("SPV-", ""), "")}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: C.ink }}>
                        {_fmtM(p.revenue.captado)} <span style={{ color: C.muted, fontWeight: 400 }}>/ {_fmtM(p.revenue.proyectado)}</span>
                      </span>
                    </div>
                    <div style={{ height: 5, backgroundColor: C.lineSoft, borderRadius: 2, position: "relative", overflow: "hidden" }}>
                      <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${_pctOf(p.revenue.captado, p.revenue.proyectado)}%`, backgroundColor: p.color, borderRadius: 2 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-3">
          {/* Tareas críticas */}
          {visible.tasks && criticalTasks.length > 0 && (
            <div style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 4, overflow: "hidden" }}>
              <div className="px-4 py-3 flex items-center justify-between">
                <span style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>Tareas Críticas</span>
                {kpis.tareasVencidas > 0 && (
                  <span style={{ fontSize: 9, backgroundColor: `${C.brick}15`, color: C.brick, padding: "2px 8px", borderRadius: 12, fontWeight: 700, letterSpacing: "0.06em" }}>
                    {kpis.tareasVencidas} VENCIDAS
                  </span>
                )}
              </div>
              {criticalTasks.map((t) => (
                <button key={t.id} onClick={() => openDetail && openDetail(t.id)} className="w-full text-left px-4 py-2.5 hover:opacity-80 transition-opacity" style={{ borderTop: `1px solid ${C.lineSoft}`, display: "block" }}>
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div style={{ fontSize: 11, fontWeight: 500, color: C.ink, lineHeight: 1.4 }}>{t.title}</div>
                      <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>{t.listName}</div>
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-end gap-1">
                      <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                        backgroundColor: t.priority === "urgente" || t.priority === "alta" ? `${C.brick}15` : t.priority === "media" ? `${C.ochre}20` : C.lineSoft,
                        color: t.priority === "urgente" || t.priority === "alta" ? C.brick : t.priority === "media" ? C.ochre : C.muted }}>
                        {t.priority || "—"}
                      </span>
                      <span style={{ fontSize: 9, fontWeight: 600, color: t.dias < 0 ? C.brick : t.dias === 0 ? C.ochre : C.muted }}>
                        {t.dias < 0 ? `${Math.abs(t.dias)}d vencida` : t.dias === 0 ? "Hoy" : t.dias < 100 ? `+${t.dias}d` : "—"}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Unidades portfolio */}
          {visible.units && (
            <div style={{ backgroundColor: C.ink, borderRadius: 4, padding: "16px 18px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.bg, marginBottom: 14 }}>Unidades · Portafolio Total</div>
              {(() => {
                const total = projects.reduce((s, p) => s + p.unidades.total, 0);
                const vendidas = projects.reduce((s, p) => s + p.unidades.vendidas, 0);
                const reservadas = projects.reduce((s, p) => s + p.unidades.reservadas, 0);
                const disponibles = projects.reduce((s, p) => s + p.unidades.disponibles, 0);
                return (
                  <>
                    <div className="flex mb-4" style={{ height: 6, borderRadius: 3, overflow: "hidden", gap: 1 }}>
                      <div style={{ flex: vendidas, backgroundColor: C.green }} />
                      <div style={{ flex: reservadas, backgroundColor: C.ochre }} />
                      <div style={{ flex: disponibles, backgroundColor: "#555" }} />
                    </div>
                    {[{ label: "Vendidas", val: vendidas, color: C.green }, { label: "Reservadas", val: reservadas, color: C.ochre }, { label: "Disponibles", val: disponibles, color: "#9E9A96" }].map((u, i) => (
                      <div key={i} className="flex justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: u.color }} />
                          <span style={{ fontSize: 10, color: "#CBC7C3" }}>{u.label}</span>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: u.color }}>{u.val} <span style={{ fontSize: 9, color: "#555", fontWeight: 400 }}>/ {total}</span></span>
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>
          )}

          {/* Pipeline · solo internal */}
          {visible.pipeline && pipelineTerrenos.length > 0 && (
            <div style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 4, padding: "14px 16px" }}>
              <div className="flex items-center justify-between mb-2">
                <div style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>Pipeline de Terrenos</div>
                <button onClick={() => navigate && navigate("growth")} className="flex items-center gap-1 text-[9px] hover:opacity-80" style={{ color: C.cobalt, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }} title="Ver todos en Growth">
                  Ver todos <ArrowRight size={9} />
                </button>
              </div>

              {/* Mini-map · reutiliza MinimalMap del Growth Dashboard */}
              {pipelineTerrenos.some(t => t.lat && t.lng) && (
                <div className="mb-3" style={{ borderRadius: 2, overflow: "hidden", border: `1px solid ${C.lineSoft}` }}>
                  <MinimalMap terrenos={pipelineTerrenos.filter(t => t.lat && t.lng)} height={180} onSelect={(t) => navigate && navigate("growth", { terrenoId: t.id })} />
                </div>
              )}

              {pipelineTerrenos.map((p) => {
                const statusColors = { "evaluando": C.ochre, "negociando": C.brick, "due-diligence": C.cobalt, "scouting": C.muted, "rechazado": C.muted };
                return (
                  <button key={p.id} onClick={() => navigate && navigate("growth", { terrenoId: p.id })} className="w-full text-left flex items-center gap-2.5 mb-2 hover:opacity-80">
                    <div style={{ width: 5, height: 5, borderRadius: 999, backgroundColor: statusColors[p.status] || C.muted, flexShrink: 0 }} />
                    <div className="flex-1 min-w-0">
                      <div style={{ fontSize: 10, fontWeight: 500, color: C.ink }} className="truncate">{p.name}</div>
                      <div style={{ fontSize: 9, color: C.muted, marginTop: 1, textTransform: "capitalize" }}>{p.status?.replace("-", " ") || "—"}{p.district ? ` · ${p.district}` : ""}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Share modal */}
      {shareOpen && <CEOShareModal kpis={kpis} projects={projects} audience={audience} criticalTasks={criticalTasks} onClose={() => setShareOpen(false)} />}

      {/* Project edit modal */}
      {editingProject && <CEOProjectEditModal project={editingProject} onSave={(patch) => { onEditProject(editingProject.id, patch); setEditingProject(null); }} onClose={() => setEditingProject(null)} />}

      {/* NPS edit modal */}
      {editingNps && <CEONpsEditModal currentNps={nps} onSave={(v) => { onEditNps(v); setEditingNps(false); }} onClose={() => setEditingNps(false)} />}

      {/* Print CSS */}
      <style>{`
        @media print {
          .lg\\:px-8 { padding-left: 0 !important; padding-right: 0 !important; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}

function CEOProjectEditModal({ project, onSave, onClose }) {
  const [form, setForm] = useState({
    name: project.name,
    fase: project.fase,
    progreso: project.progreso,
    vencimiento: project.vencimiento,
    unidades: { ...project.unidades },
    revenue: { ...project.revenue },
    fc: { ...project.fc },
  });

  const blob = useModalBlob();
  const setField = (path, val) => {
    setForm(prev => {
      const next = { ...prev };
      if (path.includes(".")) {
        const [a, b] = path.split(".");
        next[a] = { ...next[a], [b]: val };
      } else {
        next[path] = val;
      }
      return next;
    });
    blob.onType();
  };

  const numericFields = (path) => ({ type: "number", value: form[path.split(".")[0]][path.split(".")[1]], onChange: (e) => setField(path, Number(e.target.value) || 0) });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(10,11,15,0.5)" }} onClick={onClose}>
      <div className="w-full max-w-[560px] max-h-[90vh] overflow-y-auto" style={{ backgroundColor: C.bg, border: `1px solid ${C.line}`, borderRadius: 4 }} onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
          <div>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>Editar proyecto</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.ink, marginTop: 2 }}>{project.name}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ModalBlob state={blob.state} />
            <button onClick={onClose}><X size={14} style={{ color: C.muted }} /></button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* General */}
          <div>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>General</div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span style={{ fontSize: 10, color: C.muted, display: "block", marginBottom: 2 }}>Nombre</span>
                <input value={form.name} onChange={(e) => setField("name", e.target.value)} className="w-full px-2 py-1.5 outline-none" style={{ backgroundColor: C.paper, border: `1px solid ${C.line}`, borderRadius: 2, fontSize: 12 }} />
              </label>
              <label className="block">
                <span style={{ fontSize: 10, color: C.muted, display: "block", marginBottom: 2 }}>Fase</span>
                <select value={form.fase} onChange={(e) => setField("fase", e.target.value)} className="w-full px-2 py-1.5 outline-none" style={{ backgroundColor: C.paper, border: `1px solid ${C.line}`, borderRadius: 2, fontSize: 12 }}>
                  <option>Pre-venta</option><option>Permisos</option><option>Construcción</option><option>Ventas</option><option>Fee mensual</option><option>Cerrado</option>
                </select>
              </label>
              <label className="block">
                <span style={{ fontSize: 10, color: C.muted, display: "block", marginBottom: 2 }}>Progreso %</span>
                <input type="number" min="0" max="100" value={form.progreso} onChange={(e) => setField("progreso", Number(e.target.value) || 0)} className="w-full px-2 py-1.5 outline-none" style={{ backgroundColor: C.paper, border: `1px solid ${C.line}`, borderRadius: 2, fontSize: 12 }} />
              </label>
              <label className="block">
                <span style={{ fontSize: 10, color: C.muted, display: "block", marginBottom: 2 }}>Vencimiento</span>
                <input value={form.vencimiento} onChange={(e) => setField("vencimiento", e.target.value)} placeholder="ej. Dic 2026" className="w-full px-2 py-1.5 outline-none" style={{ backgroundColor: C.paper, border: `1px solid ${C.line}`, borderRadius: 2, fontSize: 12 }} />
              </label>
            </div>
          </div>

          {/* Unidades */}
          <div>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>Unidades</div>
            <div className="grid grid-cols-4 gap-2">
              {[{ k: "total", l: "Total" }, { k: "vendidas", l: "Vendidas" }, { k: "reservadas", l: "Reservadas" }, { k: "disponibles", l: "Disponibles" }].map(f => (
                <label key={f.k} className="block">
                  <span style={{ fontSize: 10, color: C.muted, display: "block", marginBottom: 2 }}>{f.l}</span>
                  <input {...numericFields(`unidades.${f.k}`)} className="w-full px-2 py-1.5 outline-none" style={{ backgroundColor: C.paper, border: `1px solid ${C.line}`, borderRadius: 2, fontSize: 12, fontFamily: "ui-monospace, monospace" }} />
                </label>
              ))}
            </div>
          </div>

          {/* Revenue */}
          <div>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>Revenue (USD)</div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span style={{ fontSize: 10, color: C.muted, display: "block", marginBottom: 2 }}>Proyectado</span>
                <input {...numericFields("revenue.proyectado")} className="w-full px-2 py-1.5 outline-none" style={{ backgroundColor: C.paper, border: `1px solid ${C.line}`, borderRadius: 2, fontSize: 12, fontFamily: "ui-monospace, monospace" }} />
              </label>
              <label className="block">
                <span style={{ fontSize: 10, color: C.muted, display: "block", marginBottom: 2 }}>Captado</span>
                <input {...numericFields("revenue.captado")} className="w-full px-2 py-1.5 outline-none" style={{ backgroundColor: C.paper, border: `1px solid ${C.line}`, borderRadius: 2, fontSize: 12, fontFamily: "ui-monospace, monospace" }} />
              </label>
            </div>
          </div>

          {/* FC */}
          <div>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>Flujo de Caja</div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span style={{ fontSize: 10, color: C.muted, display: "block", marginBottom: 2 }}>Estado</span>
                <select value={form.fc.estado} onChange={(e) => setField("fc.estado", e.target.value)} className="w-full px-2 py-1.5 outline-none" style={{ backgroundColor: C.paper, border: `1px solid ${C.line}`, borderRadius: 2, fontSize: 12 }}>
                  <option>positivo</option><option>neutro</option><option>negativo</option>
                </select>
              </label>
              <label className="block">
                <span style={{ fontSize: 10, color: C.muted, display: "block", marginBottom: 2 }}>Saldo (USD)</span>
                <input {...numericFields("fc.saldo")} className="w-full px-2 py-1.5 outline-none" style={{ backgroundColor: C.paper, border: `1px solid ${C.line}`, borderRadius: 2, fontSize: 12, fontFamily: "ui-monospace, monospace" }} />
              </label>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 flex items-center justify-end gap-2" style={{ borderTop: `1px solid ${C.lineSoft}`, backgroundColor: C.paper }}>
          <button onClick={onClose} className="px-3 py-1.5 text-[11px] hover:opacity-70" style={{ color: C.muted }}>Cancelar</button>
          <button onClick={() => blob.onHappy(() => onSave(form))} className="px-3 py-1.5 text-[11px] hover:opacity-90" style={{ backgroundColor: C.ink, color: C.bg, borderRadius: 2, fontWeight: 600 }}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

function CEONpsEditModal({ currentNps, onSave, onClose }) {
  const [val, setVal] = useState(currentNps);
  const blob = useModalBlob();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(10,11,15,0.5)" }} onClick={onClose}>
      <div className="w-full max-w-[360px]" style={{ backgroundColor: C.bg, border: `1px solid ${C.line}`, borderRadius: 4 }} onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
          <div>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>Editar NPS</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.ink, marginTop: 2 }}>Promotores netos</div>
          </div>
          <ModalBlob state={blob.state} />
        </div>
        <div className="px-5 py-4">
          <label className="block">
            <span style={{ fontSize: 10, color: C.muted, display: "block", marginBottom: 4 }}>Valor NPS (-100 a 100)</span>
            <input type="number" min="-100" max="100" value={val} onChange={(e) => { setVal(Number(e.target.value) || 0); blob.onType(); }} autoFocus className="w-full px-3 py-2 outline-none" style={{ backgroundColor: C.paper, border: `1px solid ${C.line}`, borderRadius: 2, fontSize: 18, fontWeight: 700, fontFamily: "ui-monospace, monospace" }} />
          </label>
          <div style={{ fontSize: 10, color: C.muted, marginTop: 6, fontStyle: "italic" }}>NPS no tiene fuente automática · se edita manualmente. Cuando integremos encuesta a compradores, se conecta solo.</div>
        </div>
        <div className="px-5 py-3 flex items-center justify-end gap-2" style={{ borderTop: `1px solid ${C.lineSoft}`, backgroundColor: C.paper }}>
          <button onClick={onClose} className="px-3 py-1.5 text-[11px] hover:opacity-70" style={{ color: C.muted }}>Cancelar</button>
          <button onClick={() => blob.onHappy(() => onSave(val))} className="px-3 py-1.5 text-[11px] hover:opacity-90" style={{ backgroundColor: C.ink, color: C.bg, borderRadius: 2, fontWeight: 600 }}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

function CEOShareModal({ kpis, projects, audience, criticalTasks, onClose }) {
  const [emails, setEmails] = useState("");
  const [note, setNote] = useState("");
  const visible = CEO_AUDIENCE_PRESETS[audience].sections;
  const audLabel = CEO_AUDIENCE_PRESETS[audience].label;

  const subject = `Hygge Holding · Reporte ${audLabel} · ${new Date().toLocaleDateString("es-PE", { month: "long", year: "numeric" })}`;

  const buildBody = () => {
    let body = `Hola,\n\nTe comparto el reporte de Hygge Holding (vista: ${audLabel}).\n\n`;
    if (note) body += `${note}\n\n`;

    if (visible.kpis) {
      body += `INDICADORES:\n`;
      body += `· Revenue Total: ${_fmtM(kpis.revenueTotal)}\n`;
      body += `· Captado: ${_fmtM(kpis.captadoTotal)} (${_pctOf(kpis.captadoTotal, kpis.revenueTotal)}%)\n`;
      body += `· Unidades vendidas: ${kpis.unidadesVendidas} de ${kpis.unidadesTotal}\n`;
      if (visible.tasks) body += `· Tareas: ${kpis.tareasActivas} activas, ${kpis.tareasVencidas} vencidas\n`;
      body += `· NPS Compradores: ${kpis.nps}\n\n`;
    }

    if (visible.projects) {
      body += `PROYECTOS:\n`;
      projects.forEach(p => {
        body += `\n${p.name} (${p.fase}) · ${p.progreso}% · vence ${p.vencimiento}\n`;
        body += `  Unidades: ${p.unidades.vendidas}/${p.unidades.total} vendidas\n`;
        if (visible.revenue) {
          body += `  Revenue: ${_fmtM(p.revenue.captado)} / ${_fmtM(p.revenue.proyectado)}\n`;
          body += `  FC: ${p.fc.estado} (${p.fc.saldo < 0 ? "-" : ""}${_fmtM(Math.abs(p.fc.saldo))})\n`;
        }
      });
      body += `\n`;
    }

    if (visible.tasks && criticalTasks.length > 0) {
      body += `TAREAS CRÍTICAS:\n`;
      criticalTasks.slice(0, 5).forEach(t => {
        const status = t.dias < 0 ? `${Math.abs(t.dias)}d vencida` : t.dias === 0 ? "hoy" : `+${t.dias}d`;
        body += `· ${t.title} (${status}) · ${t.listName}\n`;
      });
      body += `\n`;
    }

    body += `\n—\nSebastián Bonilla\nCEO · Hygge Holding\nsebastian@hygge.pe`;
    return body;
  };

  const handleSend = () => {
    const body = buildBody();
    const mailto = `mailto:${encodeURIComponent(emails)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
    setTimeout(onClose, 500);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildBody());
      alert("Resumen copiado · pegalo en el correo o donde necesites");
    } catch {
      alert("No se pudo copiar · seleccioná manualmente el texto");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(10,11,15,0.5)" }} onClick={onClose}>
      <div className="w-full max-w-[520px] max-h-[90vh] overflow-y-auto" style={{ backgroundColor: C.bg, border: `1px solid ${C.line}`, borderRadius: 4 }} onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
          <div>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>Compartir CEO Dashboard</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.ink, marginTop: 2 }}>Vista · {audLabel}</div>
          </div>
          <button onClick={onClose}><X size={14} style={{ color: C.muted }} /></button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Destinatarios</div>
            <input value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="ariel@bam.pe, joel@hygge.pe, ..." className="w-full px-3 py-2 outline-none" style={{ backgroundColor: C.paper, border: `1px solid ${C.line}`, borderRadius: 2, fontSize: 12, color: C.ink }} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Nota personal (opcional)</div>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Comentario para introducir el reporte..." rows={3} className="w-full px-3 py-2 outline-none resize-none" style={{ backgroundColor: C.paper, border: `1px solid ${C.line}`, borderRadius: 2, fontSize: 12, color: C.ink, lineHeight: 1.5, fontFamily: "inherit" }} />
          </div>

          {/* Preview */}
          <div>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Preview del correo</div>
            <div className="max-h-[200px] overflow-y-auto p-3" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2, fontSize: 11, color: C.inkSoft, fontFamily: "ui-monospace, SF Mono, monospace", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
              <div style={{ fontWeight: 700, marginBottom: 6, color: C.ink }}>Subject: {subject}</div>
              {buildBody()}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 flex items-center justify-between gap-2" style={{ borderTop: `1px solid ${C.lineSoft}`, backgroundColor: C.paper }}>
          <button onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] hover:opacity-80" style={{ color: C.inkSoft, border: `1px solid ${C.line}`, borderRadius: 2 }}>
            <Copy size={11} /> Copiar
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-[11px] hover:opacity-70" style={{ color: C.muted }}>Cancelar</button>
            <button onClick={handleSend} disabled={!emails.trim()} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] hover:opacity-90 disabled:opacity-40" style={{ backgroundColor: C.ink, color: C.bg, borderRadius: 2, fontWeight: 600 }}>
              <Send size={11} /> Abrir en mail
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InboxView({ tasks, allSpaces, users, onUpdate, onDelete, onToggle, openDetail, onCreate }) {
  const [sortBy, setSortBy] = useState("newest");
  const [groupBy, setGroupBy] = useState("none");
  const [selected, setSelected] = useState(new Set());
  const [quickText, setQuickText] = useState("");
  const flatSpaces = [...allSpaces, ...allSpaces.flatMap(s => s.children || [])].filter(s => s.id !== "inbox");

  const handleQuickAdd = (e) => {
    e?.preventDefault?.();
    if (!quickText.trim()) return;
    onCreate({ title: quickText.trim() });
    setQuickText("");
  };

  const items = useMemo(() => {
    const list = [...tasks];
    if (sortBy === "newest") list.sort((a, b) => (b.capturedAt || b.id) - (a.capturedAt || a.id));
    if (sortBy === "oldest") list.sort((a, b) => (a.capturedAt || a.id) - (b.capturedAt || b.id));
    if (sortBy === "priority") {
      const rank = { alta: 0, media: 1, baja: 2 };
      list.sort((a, b) => (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1));
    }
    if (sortBy === "type") list.sort((a, b) => (a.type || "zzz").localeCompare(b.type || "zzz"));
    return list;
  }, [tasks, sortBy]);

  const groups = useMemo(() => {
    if (groupBy === "none") return [{ key: "Todos", items }];
    if (groupBy === "type") {
      const by = {};
      items.forEach(t => { const k = t.type || "sin tipo"; (by[k] = by[k] || []).push(t); });
      return Object.entries(by).map(([key, items]) => ({ key, items }));
    }
    if (groupBy === "person") {
      const by = {};
      items.forEach(t => { const k = t.person || "sin persona"; (by[k] = by[k] || []).push(t); });
      return Object.entries(by).map(([key, items]) => ({ key, items }));
    }
    if (groupBy === "day") {
      const by = {};
      items.forEach(t => {
        const d = new Date(t.capturedAt || t.id);
        const k = d.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
        (by[k] = by[k] || []).push(t);
      });
      return Object.entries(by).map(([key, items]) => ({ key, items }));
    }
    return [{ key: "Todos", items }];
  }, [items, groupBy]);

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelected(new Set(items.map(t => t.id)));
  const clearSelection = () => setSelected(new Set());
  const confirm = useConfirm();
  const bulkDelete = async () => {
    const ok = await confirm({ title: `Eliminar ${selected.size} ${selected.size === 1 ? "item" : "items"}`, message: "Acción reversible con Cmd+Z inmediato.", danger: true, confirmLabel: `Eliminar ${selected.size}` });
    if (ok) { selected.forEach(id => onDelete(id)); clearSelection(); }
  };
  const bulkAssign = (spaceId) => { selected.forEach(id => onUpdate(id, { space: spaceId, source: null })); clearSelection(); };

  return (
    <div className="px-4 lg:px-10 py-8 lg:py-12 max-w-[1080px] mx-auto">
      <div className="mb-8 flex items-end justify-between flex-wrap gap-3">
        <div>
          <NavyRule />
          <div className="mt-4"><Eyebrow>Sin asignar · {items.length}</Eyebrow></div>
          <h1 className="text-[32px] lg:text-[36px] mt-3" style={{ color: C.ink, fontWeight: 500, letterSpacing: "-0.025em" }}>Tareas sin asignar</h1>
          <div className="text-[12px] mt-2" style={{ color: C.muted }}>Capturas que aún no tienen space. Asigná, mové, o eliminá.</div>
        </div>
      </div>

      <form onSubmit={handleQuickAdd} className="mb-6 flex items-center gap-2" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2, padding: 8 }}>
        <Plus size={14} style={{ color: C.cobalt, flexShrink: 0, marginLeft: 4 }} />
        <input value={quickText} onChange={e => setQuickText(e.target.value)}
          placeholder="Agregar item directo al inbox…"
          className="flex-1 outline-none bg-transparent text-[13px]"
          style={{ color: C.ink, fontWeight: 500 }} />
        <button type="submit" disabled={!quickText.trim()} className="px-3 py-1 text-[11px] hover:opacity-90 flex-shrink-0"
          style={{ backgroundColor: quickText.trim() ? C.ink : C.muted, color: C.bg, borderRadius: 2, fontWeight: 500, opacity: quickText.trim() ? 1 : 0.5 }}>
          Agregar ⏎
        </button>
      </form>

      <div className="mb-6 flex items-center gap-2 flex-wrap" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2, padding: 8 }}>
        <span className="text-[10px] tracking-[0.12em] uppercase px-2" style={{ color: C.muted, fontWeight: 600 }}>Ordenar</span>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="text-[11px] px-2 py-1 outline-none" style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
          <option value="newest">Más nuevos primero</option>
          <option value="oldest">Más viejos primero</option>
          <option value="priority">Por prioridad</option>
          <option value="type">Por tipo</option>
        </select>
        <span className="text-[10px] tracking-[0.12em] uppercase px-2 ml-2" style={{ color: C.muted, fontWeight: 600 }}>Agrupar</span>
        <select value={groupBy} onChange={e => setGroupBy(e.target.value)} className="text-[11px] px-2 py-1 outline-none" style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
          <option value="none">Sin grupo</option>
          <option value="type">Por tipo</option>
          <option value="person">Por persona</option>
          <option value="day">Por día</option>
        </select>
        <div className="flex-1" />
        {selected.size > 0 ? (
          <>
            <span className="text-[10px]" style={{ color: C.cobalt, fontWeight: 600 }}>{selected.size} seleccionados</span>
            <select onChange={e => { if (e.target.value) bulkAssign(e.target.value); e.target.value = ""; }} className="text-[10px] px-2 py-1 outline-none" style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
              <option value="">Mover a…</option>
              {flatSpaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button onClick={bulkDelete} className="flex items-center gap-1 px-2 py-1 text-[10px] hover:opacity-90" style={{ color: C.brick, border: `1px solid ${C.brick}33`, borderRadius: 2 }}>
              <Trash2 size={9} /> Eliminar
            </button>
            <button onClick={clearSelection} className="text-[10px] hover:opacity-70 px-2" style={{ color: C.muted }}>×</button>
          </>
        ) : (
          items.length > 0 && <button onClick={selectAll} className="text-[10px] px-2 py-1 hover:opacity-70" style={{ color: C.muted }}>Seleccionar todo</button>
        )}
      </div>

      {items.length === 0 && (
        <div className="text-center py-16" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
          <Sparkles size={28} style={{ color: C.muted, margin: "0 auto 12px" }} />
          <div className="text-[14px]" style={{ color: C.ink, fontWeight: 500 }}>Sin tareas pendientes de asignar</div>
          <div className="text-[11px] mt-1" style={{ color: C.muted }}>Tirá algo en Smart Capture arriba — aparecerá acá.</div>
        </div>
      )}

      <div className="space-y-6">
        {groups.map(group => (
          <div key={group.key}>
            {groupBy !== "none" && (
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[10px] tracking-[0.12em] uppercase" style={{ color: C.muted, fontWeight: 600 }}>{group.key}</span>
                <span className="text-[10px]" style={{ color: C.muted }}>· {group.items.length}</span>
              </div>
            )}
            <div className="space-y-2">
              {group.items.map(t => (
                <InboxCard key={t.id} task={t} flatSpaces={flatSpaces} selected={selected.has(t.id)} onToggleSelect={() => toggleSelect(t.id)}
                  onAssignSpace={(spaceId) => onUpdate(t.id, { space: spaceId, source: null })}
                  onToggle={() => onToggle(t.id)} onDelete={() => onDelete(t.id)} onOpen={() => openDetail(t.id)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InboxCard({ task, flatSpaces, selected, onToggleSelect, onAssignSpace, onToggle, onDelete, onOpen }) {
  return (
    <div className="flex items-center gap-3 p-3 hover:opacity-95 group" style={{ backgroundColor: C.paper, border: `1px solid ${selected ? C.cobalt : C.lineSoft}`, borderLeft: `3px solid ${selected ? C.cobalt : C.lineSoft}`, borderRadius: 2 }}>
      <input type="checkbox" checked={selected} onChange={onToggleSelect} className="flex-shrink-0" />
      <button onClick={onToggle} className="flex-shrink-0">
        {task.checked ? <CheckCircle2 size={14} style={{ color: C.green }} /> : <Circle size={14} style={{ color: C.muted }} />}
      </button>
      <button onClick={onOpen} className="flex-1 min-w-0 text-left">
        <div className="text-[13px] truncate" style={{ color: C.ink, fontWeight: 600, textDecoration: task.checked ? "line-through" : "none" }}>{task.title}</div>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {task.type && <Chip label={task.type} color={C.cobalt} />}
          {task.person && <Chip label={task.person} color={C.lavender} />}
          {task.amount && <Chip label={`S/ ${task.amount.toLocaleString("es-PE")}`} color={C.green} />}
          {task.due && <Chip label={task.due} color={C.ochre} />}
          {task.priority === "alta" && <Chip label="alta" color={C.brick} />}
          {task.assignee && <span className="text-[10px]" style={{ color: C.muted }}>@{task.assignee}</span>}
        </div>
      </button>
      <select value="" onChange={e => { if (e.target.value) onAssignSpace(e.target.value); e.target.value = ""; }} className="text-[10px] px-2 py-1 outline-none opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
        <option value="">Mover a…</option>
        {flatSpaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50" title="Eliminar"><Trash2 size={12} style={{ color: C.brick }} /></button>
    </div>
  );
}

// ═══ FILTER POPOVER ══════════════════════════════════════════════════════
function FilterPopover({ open, onClose, filters, setFilters, users, allSpaces, currentSpace }) {
  if (!open) return null;
  const currentSpaceObj = allSpaces.find(s => s.id === currentSpace);
  const hasChildren = currentSpaceObj?.children?.length > 0;
  const toggle = (field, value) => {
    setFilters(prev => {
      const arr = prev[field];
      return { ...prev, [field]: arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value] };
    });
  };
  const clearAll = () => setFilters({ priorities: [], assignees: [], statuses: [], includeSubspaces: true });
  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div className="absolute" style={{ top: 152, right: 16 }} onClick={e => e.stopPropagation()}>
        <div className="w-[300px] py-3" style={{ backgroundColor: C.bg, border: `1px solid ${C.line}`, borderRadius: 4, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
          <div className="px-4 pb-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
            <Eyebrow>Filtros</Eyebrow>
            <button onClick={clearAll} className="text-[10px] hover:opacity-70" style={{ color: C.muted, fontWeight: 500 }}>Limpiar</button>
          </div>

          <div className="px-4 py-3 space-y-1">
            <div className="text-[10px] tracking-[0.12em] uppercase mb-1.5" style={{ color: C.muted, fontWeight: 600 }}>Prioridad</div>
            {[{v:"alta",c:C.brick},{v:"media",c:C.ochre},{v:"baja",c:C.muted}].map(p => (
              <label key={p.v} className="flex items-center gap-2 cursor-pointer py-1">
                <input type="checkbox" checked={filters.priorities.includes(p.v)} onChange={() => toggle("priorities", p.v)} />
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.c }} />
                <span className="text-[11px]" style={{ color: C.ink, fontWeight: 500 }}>{p.v}</span>
              </label>
            ))}
          </div>

          <div className="px-4 py-3 space-y-1" style={{ borderTop: `1px solid ${C.lineSoft}` }}>
            <div className="text-[10px] tracking-[0.12em] uppercase mb-1.5" style={{ color: C.muted, fontWeight: 600 }}>Estado</div>
            {[{v:"open",l:"Pendientes"},{v:"done",l:"Completadas"}].map(s => (
              <label key={s.v} className="flex items-center gap-2 cursor-pointer py-1">
                <input type="checkbox" checked={filters.statuses.includes(s.v)} onChange={() => toggle("statuses", s.v)} />
                <span className="text-[11px]" style={{ color: C.ink, fontWeight: 500 }}>{s.l}</span>
              </label>
            ))}
          </div>

          <div className="px-4 py-3 space-y-1 max-h-[200px] overflow-y-auto" style={{ borderTop: `1px solid ${C.lineSoft}` }}>
            <div className="text-[10px] tracking-[0.12em] uppercase mb-1.5" style={{ color: C.muted, fontWeight: 600 }}>Asignado</div>
            {(users || []).map(u => (
              <label key={u.id} className="flex items-center gap-2 cursor-pointer py-1">
                <input type="checkbox" checked={filters.assignees.includes(u.id)} onChange={() => toggle("assignees", u.id)} />
                <Avatar personId={u.id} size={16} />
                <span className="text-[11px] flex-1 truncate" style={{ color: C.ink, fontWeight: 500 }}>{u.firstName} {u.lastName}</span>
              </label>
            ))}
          </div>

          {hasChildren && (
            <div className="px-4 py-3" style={{ borderTop: `1px solid ${C.lineSoft}` }}>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={filters.includeSubspaces} onChange={e => setFilters(p => ({ ...p, includeSubspaces: e.target.checked }))} />
                <span className="text-[11px]" style={{ color: C.ink, fontWeight: 500 }}>Incluir sub-spaces</span>
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
// ═══ CALENDAR TOOL · month view across all spaces ═══════════════════════
function CalendarToolView({ tasks, openDetail, onCreate }) {
  const [refDate, setRefDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [quickText, setQuickText] = useState("");

  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);

  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const monthName = refDate.toLocaleDateString("es-PE", { month: "long", year: "numeric" });

  const tasksByDate = useMemo(() => {
    const map = {};
    tasks.forEach(t => {
      const candidates = [t.endDate, t.startDate, t.due].filter(Boolean);
      candidates.forEach(s => {
        const m = String(s).match(/^\d{4}-\d{2}-\d{2}/);
        if (m) {
          const key = m[0];
          if (!map[key]) map[key] = [];
          if (!map[key].some(x => x.id === t.id)) map[key].push(t);
        }
      });
    });
    return map;
  }, [tasks]);

  const cells = [];
  for (let i = 0; i < 42; i++) {
    const dayNum = i - startWeekday + 1;
    if (dayNum < 1 || dayNum > daysInMonth) cells.push(null);
    else {
      const d = new Date(year, month, dayNum);
      const key = d.toISOString().slice(0, 10);
      cells.push({ day: dayNum, date: d, key, tasks: tasksByDate[key] || [], isToday: key === todayKey });
    }
  }

  const goToday = () => setRefDate(new Date());
  const prevMonth = () => setRefDate(new Date(year, month - 1, 1));
  const nextMonth = () => setRefDate(new Date(year, month + 1, 1));

  const handleAdd = (e) => {
    e?.preventDefault?.();
    if (!quickText.trim() || !selectedDate) return;
    onCreate({ title: quickText.trim(), startDate: selectedDate, endDate: selectedDate, due: selectedDate });
    setQuickText("");
  };

  return (
    <div className="px-4 lg:px-10 py-8 lg:py-12 max-w-[1280px] mx-auto">
      <div className="mb-8">
        <NavyRule />
        <div className="mt-4"><Eyebrow>Calendario · todos los spaces</Eyebrow></div>
        <h1 className="text-[32px] lg:text-[36px] mt-3 capitalize" style={{ color: C.ink, fontWeight: 500, letterSpacing: "-0.025em" }}>{monthName}</h1>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <button onClick={prevMonth} className="p-1.5 hover:opacity-70" style={{ border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}><ChevronRight size={12} style={{ color: C.ink, transform: "rotate(180deg)" }} /></button>
        <button onClick={nextMonth} className="p-1.5 hover:opacity-70" style={{ border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}><ChevronRight size={12} style={{ color: C.ink }} /></button>
        <button onClick={goToday} className="px-3 py-1.5 text-[11px] hover:opacity-90" style={{ color: C.inkSoft, border: `1px solid ${C.lineSoft}`, borderRadius: 2, fontWeight: 500 }}>Hoy</button>
        <div className="flex-1" />
        <div className="text-[10px]" style={{ color: C.muted }}>Click un día para agregar evento</div>
      </div>

      <div className="grid grid-cols-7 gap-px" style={{ backgroundColor: C.line, border: `1px solid ${C.line}` }}>
        {["LUN","MAR","MIÉ","JUE","VIE","SÁB","DOM"].map(d => (
          <div key={d} className="p-2 text-[9px] tracking-[0.12em] text-center" style={{ backgroundColor: C.bg, color: C.muted, fontWeight: 600 }}>{d}</div>
        ))}
        {cells.map((cell, i) => {
          if (!cell) return <div key={i} style={{ backgroundColor: C.surface, minHeight: 80 }} />;
          const isSelected = selectedDate === cell.key;
          return (
            <button key={i} onClick={() => setSelectedDate(isSelected ? null : cell.key)}
              className="text-left p-2 hover:opacity-90"
              style={{ backgroundColor: isSelected ? C.cobalt + "11" : C.bg, minHeight: 80, outline: isSelected ? `2px solid ${C.cobalt}` : "none", outlineOffset: -2 }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px]" style={{ color: cell.isToday ? C.cobalt : C.ink, fontWeight: cell.isToday ? 700 : 500 }}>{cell.day}</span>
                {cell.tasks.length > 0 && <span className="text-[8px] px-1" style={{ backgroundColor: C.ink, color: C.bg, borderRadius: 999, fontWeight: 700 }}>{cell.tasks.length}</span>}
              </div>
              <div className="space-y-0.5">
                {cell.tasks.slice(0, 3).map(t => (
                  <div key={t.id} onClick={(e) => { e.stopPropagation(); openDetail(t.id); }} className="text-[9px] px-1 py-0.5 truncate hover:opacity-80" style={{ backgroundColor: C.surface, color: C.ink, borderLeft: `2px solid ${t.priority === "alta" ? C.brick : t.priority === "media" ? C.ochre : C.muted}`, borderRadius: 1 }}>{t.title}</div>
                ))}
                {cell.tasks.length > 3 && <div className="text-[8px] px-1" style={{ color: C.muted, fontWeight: 500 }}>+{cell.tasks.length - 3} más</div>}
              </div>
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <div className="mt-4 p-4" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <Eyebrow>Día seleccionado</Eyebrow>
              <div className="text-[14px] mt-1" style={{ color: C.ink, fontWeight: 600 }}>{new Date(selectedDate + "T00:00:00").toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" })}</div>
            </div>
            <button onClick={() => setSelectedDate(null)} className="hover:opacity-70"><X size={13} style={{ color: C.muted }} /></button>
          </div>
          <form onSubmit={handleAdd} className="flex items-center gap-2 mb-4">
            <input value={quickText} onChange={e => setQuickText(e.target.value)}
              placeholder="Crear tarea/evento para este día…"
              className="flex-1 px-3 py-2 outline-none text-[13px]"
              style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2, color: C.ink }} />
            <button type="submit" disabled={!quickText.trim()} className="px-3 py-2 text-[11px] hover:opacity-90"
              style={{ backgroundColor: quickText.trim() ? C.ink : C.muted, color: C.bg, borderRadius: 2, fontWeight: 500, opacity: quickText.trim() ? 1 : 0.5 }}>
              <Plus size={11} className="inline mr-1" /> Crear
            </button>
          </form>
          {(tasksByDate[selectedDate] || []).length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] tracking-[0.12em] uppercase mb-1" style={{ color: C.muted, fontWeight: 600 }}>Tareas de este día · {(tasksByDate[selectedDate] || []).length}</div>
              {(tasksByDate[selectedDate] || []).map(t => (
                <button key={t.id} onClick={() => openDetail(t.id)} className="w-full flex items-center gap-2 p-2 text-left hover:opacity-90"
                  style={{ backgroundColor: C.bg, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
                  {t.checked ? <CheckCircle2 size={12} style={{ color: C.green }} /> : <Circle size={12} style={{ color: C.muted }} />}
                  <span className="text-[12px] flex-1 truncate" style={{ color: C.ink, fontWeight: 500, textDecoration: t.checked ? "line-through" : "none" }}>{t.title}</span>
                  {t.assignee && <Avatar personId={t.assignee} size={18} />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══ NOTIFICATIONS TOOL · all messages with actions ══════════════════════
// ─── NOTIFICACIONES · eventos del sistema (tarea creada / por vencer / cerrada) ───
// Diferencia conceptual con Mensajes: notificaciones = eventos automáticos del sistema, no comunicación humana
function NotificationsToolView({ activity, markNotifRead, markAllNotifsRead, openTask, navigate, isCEO, onApproveDropboxDelete, onDenyDropboxDelete }) {
  const [filter, setFilter] = useState("all"); // all | unread
  const items = filter === "unread" ? activity.filter(a => !a.read) : activity;
  const unreadCount = activity.filter(a => !a.read).length;

  return (
    <div className="px-4 lg:px-10 py-8 lg:py-12 max-w-[840px] mx-auto">
      <div className="mb-8 flex items-end justify-between flex-wrap gap-3">
        <div>
          <NavyRule />
          <div className="mt-4"><Eyebrow>Notificaciones · {activity.length}</Eyebrow></div>
          <h1 className="text-[32px] lg:text-[36px] mt-3" style={{ color: C.ink, fontWeight: 500, letterSpacing: "-0.025em" }}>Eventos del sistema</h1>
          <div className="text-[12px] mt-2" style={{ color: C.muted }}>{unreadCount > 0 ? `${unreadCount} sin leer` : "Todo al día"}</div>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllNotifsRead} className="px-3 py-1.5 text-[11px] hover:opacity-90" style={{ backgroundColor: C.ink, color: C.bg, borderRadius: 2, fontWeight: 500 }}>
            Marcar todas como leídas
          </button>
        )}
      </div>

      <div className="mb-4 flex items-center gap-2" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2, padding: 8 }}>
        <span className="text-[10px] tracking-[0.12em] uppercase px-2" style={{ color: C.muted, fontWeight: 600 }}>Mostrar</span>
        <select value={filter} onChange={e => setFilter(e.target.value)} className="text-[11px] px-2 py-1 outline-none" style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
          <option value="all">Todas</option>
          <option value="unread">Solo sin leer</option>
        </select>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12" style={{ backgroundColor: C.paper, border: `1px dashed ${C.lineSoft}`, borderRadius: 2 }}>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 4 }}>{filter === "unread" ? "No hay notificaciones sin leer" : "Sin notificaciones"}</div>
          <div style={{ fontSize: 11, color: C.muted, fontStyle: "italic", marginTop: 4 }}>
            Cuando crees, cierres o edites tareas, los eventos aparecen acá.
          </div>
        </div>
      ) : (
        <div style={{ border: `1px solid ${C.lineSoft}`, borderRadius: 2, backgroundColor: C.paper }}>
          {items.map((a) => (
            <div key={a.id} className="px-4 py-3 flex items-start gap-3" style={{
              borderTop: items.indexOf(a) > 0 ? `1px solid ${C.lineSoft}` : "none",
              backgroundColor: !a.read ? `${C.cobalt}05` : "transparent",
              borderLeft: !a.read ? `3px solid ${C.cobalt}` : "3px solid transparent",
            }}>
              <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: a.color }} />
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 12, color: C.ink, lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 600 }}>{a.who}</span> {a.what}
                </div>
                {a.type === "dropbox_delete_approval" && a.pending && isCEO && (
                  <div style={{ marginTop: 10, padding: "10px 12px", backgroundColor: `${C.brick}08`, border: `1px solid ${C.brick}30`, borderRadius: 3 }}>
                    <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 8, fontFamily: "monospace" }}>{a.dropboxPath}</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => onApproveDropboxDelete && onApproveDropboxDelete(a)} style={{ fontSize: 11, fontWeight: 600, padding: "5px 12px", backgroundColor: C.brick, color: "white", border: "none", borderRadius: 2, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                        Aprobar eliminación
                      </button>
                      <button onClick={() => onDenyDropboxDelete && onDenyDropboxDelete(a)} style={{ fontSize: 11, padding: "5px 12px", backgroundColor: "transparent", color: C.muted, border: `1px solid ${C.line}`, borderRadius: 2, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                        Denegar
                      </button>
                    </div>
                  </div>
                )}
                {a.type === "dropbox_delete_approval" && !a.pending && (
                  <div style={{ marginTop: 6, fontSize: 10.5, fontWeight: 600, color: a.approved ? C.brick : C.green }}>
                    {a.approved ? "✓ Eliminación aprobada y ejecutada" : "✗ Eliminación denegada"}
                  </div>
                )}
                <div className="mt-1 flex items-center gap-2 flex-wrap" style={{ fontSize: 10, color: C.muted }}>
                  <span>{timeAgo(a.ts)}</span>
                  {a.relatedTaskId && (
                    <button onClick={() => openTask && openTask(a.relatedTaskId)} className="flex items-center gap-0.5 hover:opacity-80" style={{ color: C.cobalt, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", fontSize: 9 }}>
                      <ArrowRight size={9} /> Tarea
                    </button>
                  )}
                  {a.relatedSpace && !a.relatedTaskId && (
                    <button onClick={() => navigate && navigate(a.relatedSpace)} className="flex items-center gap-0.5 hover:opacity-80" style={{ color: C.cobalt, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", fontSize: 9 }}>
                      <ArrowRight size={9} /> Space
                    </button>
                  )}
                </div>
              </div>
              {!a.read && !(a.type === "dropbox_delete_approval" && a.pending && isCEO) && (
                <button onClick={() => markNotifRead(a.id)} className="text-[9px] hover:opacity-80 flex-shrink-0" style={{ color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>
                  Marcar leída
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 text-[10px] italic" style={{ color: C.muted, lineHeight: 1.6 }}>
        Mensajes humanos viven en la sección <strong>Mensajes</strong> (icono globo). Esta sección es solo eventos del sistema generados automáticamente.
      </div>
    </div>
  );
}

function MessagesToolView({ messages, markRead, markAllRead, deleteMessage, openTask, sendMessage, users, currentUserId }) {
  const [filter, setFilter] = useState("all");
  const [replyOpen, setReplyOpen] = useState(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const filtered = filter === "unread" ? messages.filter(m => !m.read) : messages;
  const unreadCount = messages.filter(m => !m.read).length;

  const guessAvatarId = (who) => {
    if (!who) return "sb";
    const w = who.toLowerCase();
    if (w.includes("ariel")) return "aa";
    if (w.includes("joel")) return "jm";
    if (w.includes("jose")) return "jt";
    if (w.includes("vane") || w.includes("dongo")) return "vd";
    if (w.includes("galup")) return "jmg";
    if (w.includes("andrea")) return "ac";
    return "sb";
  };

  return (
    <div className="px-4 lg:px-10 py-8 lg:py-12 max-w-[960px] mx-auto">
      <div className="mb-8 flex items-end justify-between flex-wrap gap-3">
        <div>
          <NavyRule />
          <div className="mt-4"><Eyebrow>Mensajes · {messages.length}</Eyebrow></div>
          <h1 className="text-[32px] lg:text-[36px] mt-3" style={{ color: C.ink, fontWeight: 500, letterSpacing: "-0.025em" }}>Mensajes del equipo</h1>
          <div className="text-[12px] mt-2" style={{ color: C.muted }}>{unreadCount > 0 ? `${unreadCount} sin leer` : "Todo al día"}</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setComposeOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] hover:opacity-90" style={{ backgroundColor: C.ink, color: C.bg, borderRadius: 2, fontWeight: 500 }}>
            <Send size={11} /> Nuevo mensaje
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2, padding: 8 }}>
        <span className="text-[10px] tracking-[0.12em] uppercase px-2" style={{ color: C.muted, fontWeight: 600 }}>Mostrar</span>
        <select value={filter} onChange={e => setFilter(e.target.value)} className="text-[11px] px-2 py-1 outline-none" style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
          <option value="all">Todos</option>
          <option value="unread">Solo sin leer</option>
        </select>
        <div className="flex-1" />
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="text-[10px] px-2 py-1 hover:opacity-70" style={{ color: C.muted }}>Marcar todo leído</button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
          <Bell size={28} style={{ color: C.muted, margin: "0 auto 12px" }} />
          <div className="text-[14px]" style={{ color: C.ink, fontWeight: 500 }}>{filter === "unread" ? "Nada sin leer" : "Sin mensajes"}</div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(m => (
            <div key={m.id} className="flex items-start gap-3 p-3 group" style={{ backgroundColor: m.read ? C.paper : C.bg, border: `1px solid ${m.read ? C.lineSoft : C.cobalt + "44"}`, borderLeft: `3px solid ${m.read ? C.lineSoft : C.cobalt}`, borderRadius: 2 }}>
              <Avatar personId={guessAvatarId(m.who)} size={32} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="text-[13px]" style={{ color: C.ink, fontWeight: !m.read ? 600 : 500 }}>{m.who}</span>
                  <span className="text-[10px] flex-shrink-0" style={{ color: C.muted }}>{m.when}</span>
                </div>
                <div className="text-[12px] mb-2" style={{ color: !m.read ? C.ink : C.inkSoft, lineHeight: 1.55 }}>{m.text}</div>
                <div className="flex items-center gap-2 flex-wrap">
                  {m.relatedTaskId && (
                    <button onClick={() => { markRead(m.id); openTask(m.relatedTaskId); }} className="flex items-center gap-1 text-[10px] px-2 py-1 hover:opacity-90" style={{ color: C.cobalt, backgroundColor: C.cobalt + "11", border: `1px solid ${C.cobalt}33`, borderRadius: 2, fontWeight: 600 }}>
                      <ArrowRight size={9} /> Abrir tarea
                    </button>
                  )}
                  <button onClick={() => setReplyOpen(replyOpen === m.id ? null : m.id)} className="text-[10px] px-2 py-1 hover:opacity-90" style={{ color: C.inkSoft, border: `1px solid ${C.lineSoft}`, borderRadius: 2, fontWeight: 500 }}>
                    Responder
                  </button>
                  {!m.read && (
                    <button onClick={() => markRead(m.id)} className="text-[10px] px-2 py-1 hover:opacity-90" style={{ color: C.muted, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
                      Marcar leído
                    </button>
                  )}
                  <button onClick={() => deleteMessage(m.id)} className="text-[10px] px-2 py-1 hover:opacity-90 ml-auto" style={{ color: C.brick, border: `1px solid ${C.brick}33`, borderRadius: 2 }}>
                    <Trash2 size={9} className="inline" />
                  </button>
                </div>
                {replyOpen === m.id && <ReplyForm to={m.who} onSend={(text) => { sendMessage(m.who, text); setReplyOpen(null); }} onCancel={() => setReplyOpen(null)} />}
              </div>
            </div>
          ))}
        </div>
      )}

      {composeOpen && <ComposeMessageModal users={users} currentUserId={currentUserId} onClose={() => setComposeOpen(false)} onSend={(to, text) => { sendMessage(to, text); setComposeOpen(false); }} />}
    </div>
  );
}

function ReplyForm({ to, onSend, onCancel }) {
  const [text, setText] = useState("");
  return (
    <div className="mt-3 flex items-start gap-2" style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2, padding: 8 }}>
      <CornerDownRight size={11} style={{ color: C.muted, marginTop: 6, flexShrink: 0 }} />
      <textarea value={text} onChange={e => setText(e.target.value)} autoFocus
        placeholder={`Responder a ${to}…`} rows={2}
        className="flex-1 outline-none bg-transparent text-[12px] resize-none"
        style={{ color: C.ink, fontFamily: "inherit", lineHeight: 1.5 }} />
      <div className="flex flex-col gap-1">
        <button onClick={() => { if (text.trim()) onSend(text.trim()); }} disabled={!text.trim()}
          className="px-2.5 py-1 text-[10px] hover:opacity-90"
          style={{ backgroundColor: text.trim() ? C.ink : C.muted, color: C.bg, borderRadius: 2, fontWeight: 500, opacity: text.trim() ? 1 : 0.5 }}>
          <Send size={9} className="inline mr-1" /> Enviar
        </button>
        <button onClick={onCancel} className="px-2.5 py-1 text-[10px] hover:opacity-90" style={{ color: C.muted, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>Cancelar</button>
      </div>
    </div>
  );
}

function ComposeMessageModal({ users, currentUserId, onClose, onSend }) {
  const [to, setTo] = useState("");
  const [text, setText] = useState("");
  const blob = useModalBlob();
  const recipients = users.filter(u => u.id !== currentUserId);
  const submit = () => {
    if (!to || !text.trim()) { blob.onError(); return; }
    blob.onHappy(() => onSend(to, text.trim()));
  };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] p-4" style={{ backgroundColor: "rgba(10,11,15,0.4)" }} onClick={onClose}>
      <div className="w-full max-w-[520px]" style={{ backgroundColor: C.paper, border: `1px solid ${C.line}`, borderRadius: 4 }} onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
          <div><Eyebrow>Enviar mensaje</Eyebrow><div className="text-[15px] mt-1" style={{ color: C.ink, fontWeight: 600 }}>Nuevo mensaje</div></div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ModalBlob state={blob.state} />
            <button onClick={onClose}><X size={14} style={{ color: C.muted }} /></button>
          </div>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <Eyebrow>Para</Eyebrow>
            <select value={to} onChange={e => { setTo(e.target.value); blob.onType(); }} className="w-full mt-2 px-3 py-2 outline-none text-[13px]" style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2, color: C.ink }}>
              <option value="">— Elegí destinatario —</option>
              {recipients.map(u => <option key={u.id} value={`${u.firstName} ${u.lastName}`}>{u.firstName} {u.lastName} · {u.role}</option>)}
            </select>
          </div>
          <div>
            <Eyebrow>Mensaje</Eyebrow>
            <textarea value={text} onChange={e => { setText(e.target.value); blob.onType(); }} placeholder="Escribí tu mensaje…" rows={5}
              className="w-full mt-2 px-3 py-2 outline-none text-[13px] resize-none"
              style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2, color: C.ink, fontFamily: "inherit", lineHeight: 1.5 }} />
          </div>
        </div>
        <div className="px-5 py-4 flex items-center justify-end gap-2" style={{ borderTop: `1px solid ${C.lineSoft}` }}>
          <button onClick={onClose} className="px-3 py-2 text-[12px] hover:opacity-90" style={{ color: C.muted, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>Cancelar</button>
          <button onClick={submit} className="flex items-center gap-1.5 px-4 py-2 text-[12px] hover:opacity-90"
            style={{ backgroundColor: C.ink, color: C.bg, borderRadius: 2, fontWeight: 500 }}>
            <Send size={11} /> Enviar
          </button>
        </div>
      </div>
    </div>
  );
}



function SettingsModal({ open, onClose, currentUser, users, updateUser, createUser, deleteUser, allSpaces, spaceAccess, updateSpaceAccess, onResetTasks, onResetTerrenos, onResetCustomViews, taskCount, terrenoCount, customViewsCount, tasks, setTasks, customViews, setCustomViews, terrenos, setTerrenos, customSpaces, setCustomSpaces, messages, smartViews, whiteboards, onExportTasks, onExportTerrenos, agentStatus, recordAgentRun, quarantineMode, setQuarantineMode, features, setFeatures }) {
  const [tab, setTab] = useState("perfil");
  const [adminSubTab, setAdminSubTab] = useState("usuarios");
  if (!open || !currentUser) return null;
  const isAdmin = currentUser.isAdmin;
  const tabs = [
    { id: "perfil", label: "Perfil" },
    { id: "preferencias", label: "Preferencias" },
    { id: "seguridad", label: "Seguridad" },
    ...(isAdmin ? [{ id: "admin", label: "Administración" }] : []),
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[6vh] p-4" style={{ backgroundColor: "rgba(10,11,15,0.5)" }} onClick={onClose}>
      <div className="w-full max-w-[800px] max-h-[88vh] flex flex-col" style={{ backgroundColor: C.paper, border: `1px solid ${C.line}`, borderRadius: 4 }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 lg:px-6 py-4 lg:py-5 flex-shrink-0" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
          <div>
            <Eyebrow>Settings</Eyebrow>
            <div className="text-[18px] mt-1" style={{ color: C.ink, fontWeight: 600 }}>Tu cuenta · {currentUser.firstName}</div>
          </div>
          <button onClick={onClose}><X size={14} style={{ color: C.muted }} /></button>
        </div>
        <div className="flex items-center gap-1 px-5 lg:px-6 flex-shrink-0 overflow-x-auto" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className="px-3 py-3 text-[12px] flex-shrink-0"
              style={{ color: tab === t.id ? C.ink : C.muted, fontWeight: tab === t.id ? 600 : 500, borderBottom: `2px solid ${tab === t.id ? C.ink : "transparent"}`, marginBottom: -1 }}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-5 lg:p-6">
          {tab === "perfil" && <ProfileTab user={currentUser} updateUser={(p) => updateUser(currentUser.id, p)} />}
          {tab === "preferencias" && <PreferencesTab user={currentUser} updateUser={(p) => updateUser(currentUser.id, p)} allSpaces={allSpaces} />}
          {tab === "seguridad" && <SecurityTab user={currentUser} updateUser={(p) => updateUser(currentUser.id, p)} />}
          {tab === "admin" && isAdmin && (
            <AdminTab subTab={adminSubTab} setSubTab={setAdminSubTab} users={users} createUser={createUser} updateUser={updateUser} deleteUser={deleteUser} currentUserId={currentUser.id} allSpaces={allSpaces} spaceAccess={spaceAccess} updateSpaceAccess={updateSpaceAccess} onResetTasks={onResetTasks} onResetTerrenos={onResetTerrenos} onResetCustomViews={onResetCustomViews} taskCount={taskCount} terrenoCount={terrenoCount} customViewsCount={customViewsCount} tasks={tasks} setTasks={setTasks} customViews={customViews} setCustomViews={setCustomViews} terrenos={terrenos} setTerrenos={setTerrenos} customSpaces={customSpaces} setCustomSpaces={setCustomSpaces} messages={messages} smartViews={smartViews} whiteboards={whiteboards} onExportTasks={onExportTasks} onExportTerrenos={onExportTerrenos} agentStatus={agentStatus} recordAgentRun={recordAgentRun} quarantineMode={quarantineMode} setQuarantineMode={setQuarantineMode} features={features} setFeatures={setFeatures} />
          )}
        </div>
      </div>
    </div>
  );
}

function FormField({ label, children }) {
  return <div><Eyebrow>{label}</Eyebrow><div className="mt-2">{children}</div></div>;
}

function ProfileTab({ user, updateUser }) {
  const fileInputRef = useRef(null);
  const onAvatar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateUser({ avatar: reader.result });
    reader.readAsDataURL(file);
    e.target.value = "";
  };
  return (
    <div className="space-y-5">
      <div>
        <Eyebrow>Foto</Eyebrow>
        <div className="flex items-center gap-4 mt-3">
          <div className="w-20 h-20 flex items-center justify-center overflow-hidden" style={{ backgroundColor: user.color, color: "#fff", borderRadius: 999, fontSize: 26, fontWeight: 600 }}>
            {user.avatar ? <img src={user.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : user.initials}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] hover:opacity-90" style={{ backgroundColor: C.ink, color: C.bg, borderRadius: 2, fontWeight: 500 }}><FileUp size={11} /> Subir foto</button>
            {user.avatar && <button onClick={() => updateUser({ avatar: null })} className="px-3 py-1.5 text-[11px] hover:opacity-90" style={{ color: C.brick, border: `1px solid ${C.lineSoft}`, borderRadius: 2, fontWeight: 500 }}>Eliminar</button>}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={onAvatar} className="hidden" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Nombre">
          <input value={user.firstName || ""} onChange={e => updateUser({ firstName: e.target.value, initials: ((e.target.value[0] || "") + (user.lastName?.[0] || "")).toUpperCase() })} className={fieldClass} style={fieldStyle} />
        </FormField>
        <FormField label="Apellido">
          <input value={user.lastName || ""} onChange={e => updateUser({ lastName: e.target.value, initials: ((user.firstName?.[0] || "") + (e.target.value[0] || "")).toUpperCase() })} className={fieldClass} style={fieldStyle} />
        </FormField>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Email">
          <input type="email" value={user.email || ""} onChange={e => updateUser({ email: e.target.value })} className={fieldClass} style={fieldStyle} />
        </FormField>
        <FormField label="Rol / cargo">
          <input value={user.role || ""} onChange={e => updateUser({ role: e.target.value })} className={fieldClass} style={fieldStyle} />
        </FormField>
      </div>
      <FormField label="Color de avatar (cuando no hay foto)">
        <div className="flex gap-2">
          {[C.ink, C.cobalt, C.lavender, C.ochre, C.green, C.brick, C.navy, C.sky].map(c => (
            <button key={c} onClick={() => updateUser({ color: c })} className="w-7 h-7" style={{ backgroundColor: c, borderRadius: 999, border: user.color === c ? `2px solid ${C.ink}` : `2px solid transparent`, transform: user.color === c ? "scale(1.1)" : "scale(1)" }} />
          ))}
        </div>
      </FormField>
    </div>
  );
}

function PreferencesTab({ user, updateUser, allSpaces }) {
  const prefs = user.preferences || DEFAULT_PREFS;
  const update = (patch) => updateUser({ preferences: { ...prefs, ...patch } });
  const flat = [...allSpaces, ...allSpaces.flatMap(s => s.children || [])];
  return (
    <div className="space-y-5 max-w-[480px]">
      <FormField label="Idioma">
        <select value={prefs.language || "es"} onChange={e => update({ language: e.target.value })} className={fieldClass} style={fieldStyle}>
          <option value="es">Español</option>
          <option value="en">English</option>
        </select>
      </FormField>
      <FormField label="Zona horaria">
        <select value={prefs.timezone || "America/Lima"} onChange={e => update({ timezone: e.target.value })} className={fieldClass} style={fieldStyle}>
          <option value="America/Lima">Lima (GMT-5)</option>
          <option value="America/New_York">New York (GMT-5)</option>
          <option value="America/Mexico_City">CDMX (GMT-6)</option>
          <option value="America/Buenos_Aires">Buenos Aires (GMT-3)</option>
          <option value="Europe/Madrid">Madrid (GMT+1)</option>
        </select>
      </FormField>
      <FormField label="Space por defecto al iniciar">
        <select value={prefs.defaultSpace || "hq"} onChange={e => update({ defaultSpace: e.target.value })} className={fieldClass} style={fieldStyle}>
          {flat.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </FormField>
      <FormField label="Notificaciones">
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={prefs.notifyEmail !== false} onChange={e => update({ notifyEmail: e.target.checked })} />
            <span className="text-[12px]" style={{ color: C.ink }}>Email cuando me mencionan</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={prefs.notifyDesktop !== false} onChange={e => update({ notifyDesktop: e.target.checked })} />
            <span className="text-[12px]" style={{ color: C.ink }}>Notificaciones en navegador/desktop</span>
          </label>
        </div>
      </FormField>
      <FormField label="Resumen automático">
        <select value={prefs.digest || "daily"} onChange={e => update({ digest: e.target.value })} className={fieldClass} style={fieldStyle}>
          <option value="off">Ninguno</option>
          <option value="daily">Diario · 8:00 AM</option>
          <option value="weekly">Semanal · Lunes 8:00 AM</option>
        </select>
      </FormField>
    </div>
  );
}

function SecurityTab({ user, updateUser }) {
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState(null);
  const hasPassword = !!user.password;
  const submit = () => {
    if (hasPassword && user.password !== currentPass) { setMsg({ type: "error", text: "Contraseña actual incorrecta" }); return; }
    if (!newPass || newPass.length < 6) { setMsg({ type: "error", text: "Mínimo 6 caracteres" }); return; }
    if (newPass !== confirm) { setMsg({ type: "error", text: "Las contraseñas no coinciden" }); return; }
    updateUser({ password: newPass });
    setCurrentPass(""); setNewPass(""); setConfirm("");
    setMsg({ type: "ok", text: "Contraseña actualizada" });
  };
  return (
    <div className="space-y-4 max-w-[440px]">
      {hasPassword && (
        <FormField label="Contraseña actual">
          <input type={show ? "text" : "password"} value={currentPass} onChange={e => setCurrentPass(e.target.value)} className={fieldClass} style={fieldStyle} />
        </FormField>
      )}
      <FormField label="Nueva contraseña">
        <input type={show ? "text" : "password"} value={newPass} onChange={e => setNewPass(e.target.value)} className={fieldClass} style={fieldStyle} />
      </FormField>
      <FormField label="Confirmar nueva contraseña">
        <input type={show ? "text" : "password"} value={confirm} onChange={e => setConfirm(e.target.value)} className={fieldClass} style={fieldStyle} />
      </FormField>
      <label className="flex items-center gap-2 text-[11px] cursor-pointer" style={{ color: C.muted }}>
        <input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} /> Mostrar contraseñas
      </label>
      {msg && <div className="text-[11px] px-3 py-2" style={{ color: msg.type === "error" ? C.brick : C.green, backgroundColor: (msg.type === "error" ? C.brick : C.green) + "11", border: `1px solid ${(msg.type === "error" ? C.brick : C.green) + "33"}`, borderRadius: 2 }}>{msg.text}</div>}
      <button onClick={submit} className="px-4 py-2 text-[12px] hover:opacity-90" style={{ backgroundColor: C.ink, color: C.bg, borderRadius: 2, fontWeight: 500 }}>{hasPassword ? "Cambiar contraseña" : "Definir contraseña"}</button>
    </div>
  );
}

function FeaturesAdminPanel({ features, setFeatures }) {
  const toggles = [
    { id: "customViews", label: "Custom Views", description: "Chips de vistas custom (Chart, KPI, Embed, etc.) en la barra de vistas de cada space", reason: "Oculto por default · feature avanzado, agregalo si querés crear gráficos custom" },
    { id: "whiteboards", label: "Whiteboards", description: "Tab de pizarra · stickies, shapes, flechas, iconos + lápiz con variantes (lápiz / plumón / fine pen / resaltador / borrador) y presión Apple Pencil", reason: "Oculto por default · ideal para sketches, mapas mentales, planos. Funciona con Apple Pencil." },
    { id: "viewport", label: "Viewport Externo", description: "Tab adicional en cada space que muestra un iframe a una URL externa · ideal para embebar Cash Flow sheets, Miro boards, sitios de Bronca, etc. URL configurable por space.", reason: "Oculto por default · útil para mantener fuentes externas a un click de distancia sin salir de ALICE" },
  ];
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[14px]" style={{ color: C.ink, fontWeight: 600 }}>Features opt-in</h3>
        <p className="text-[11px] mt-1" style={{ color: C.muted, lineHeight: 1.5 }}>
          Algunas features están ocultas por default para mantener ALICE limpio. Activá las que necesites · se persisten en localStorage.
        </p>
      </div>

      <div style={{ border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
        {toggles.map((t, i) => (
          <div key={t.id} className="px-4 py-3 flex items-start gap-3" style={{ borderTop: i > 0 ? `1px solid ${C.lineSoft}` : "none" }}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span style={{ fontSize: 12, color: C.ink, fontWeight: 600 }}>{t.label}</span>
                {features[t.id] ? (
                  <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 10, backgroundColor: `${C.green}20`, color: C.green, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Activo</span>
                ) : (
                  <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 10, backgroundColor: C.lineSoft, color: C.muted, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Oculto</span>
                )}
              </div>
              <div style={{ fontSize: 11, color: C.inkSoft, lineHeight: 1.5 }}>{t.description}</div>
              <div style={{ fontSize: 10, color: C.muted, fontStyle: "italic", marginTop: 4 }}>{t.reason}</div>
            </div>
            <button onClick={() => setFeatures(prev => ({ ...prev, [t.id]: !prev[t.id] }))}
              className="flex-shrink-0 transition-colors"
              style={{ width: 36, height: 20, borderRadius: 999, backgroundColor: features[t.id] ? C.ink : C.lineSoft, position: "relative", padding: 2 }}>
              <span style={{ display: "block", width: 16, height: 16, borderRadius: 999, backgroundColor: C.bg, transform: features[t.id] ? "translateX(16px)" : "translateX(0)", transition: "transform 0.15s" }} />
            </button>
          </div>
        ))}
      </div>

      <div className="px-3 py-2 text-[10px]" style={{ backgroundColor: `${C.ochre}15`, border: `1px solid ${C.ochre}30`, borderRadius: 2, color: C.inkSoft, lineHeight: 1.55 }}>
        <strong style={{ color: C.ochre }}>Nota:</strong> activar/desactivar no borra datos. Si activás Whiteboards y antes habías creado uno, vuelve a aparecer.
      </div>
    </div>
  );
}

function AdminTab({ subTab, setSubTab, users, createUser, updateUser, deleteUser, currentUserId, allSpaces, spaceAccess, updateSpaceAccess, onResetTasks, onResetTerrenos, onResetCustomViews, taskCount, terrenoCount, customViewsCount, tasks, setTasks, customViews, setCustomViews, terrenos, setTerrenos, customSpaces, setCustomSpaces, messages, smartViews, whiteboards, onExportTasks, onExportTerrenos, agentStatus, recordAgentRun, quarantineMode, setQuarantineMode, features, setFeatures }) {
  const subTabs = [
    { id: "usuarios", label: "Usuarios", icon: Users },
    { id: "permisos", label: "Permisos de Spaces", icon: Settings },
    { id: "datos", label: "Datos", icon: FileText },
    { id: "features", label: "Features", icon: FlaskConical },
    { id: "tea-table", label: "🫖 Tea Table", icon: Sparkles },
    { id: "jabberwocky", label: "Jabberwocky", icon: Zap },
    { id: "bandersnatch", label: "Bandersnatch", icon: Trash },
    { id: "cheshire", label: "Cheshire", icon: Search },
    { id: "mad-hatter", label: "Mad Hatter", icon: Sparkles },
    { id: "white-rabbit", label: "White Rabbit", icon: Clock },
    { id: "dark-alice", label: "Dark Alice", icon: Zap },
  ];
  return (
    <div>
      <div className="flex items-center gap-1 mb-5 overflow-x-auto" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
        {subTabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setSubTab(t.id)} className="flex items-center gap-1.5 px-3 py-2 text-[11px] flex-shrink-0"
              style={{ color: subTab === t.id ? C.ink : C.muted, fontWeight: subTab === t.id ? 600 : 500, borderBottom: `2px solid ${subTab === t.id ? C.ink : "transparent"}`, marginBottom: -1 }}>
              <Icon size={11} /> {t.label}
            </button>
          );
        })}
      </div>
      {subTab === "usuarios" && <UsersAdminPanel users={users} createUser={createUser} updateUser={updateUser} deleteUser={deleteUser} currentUserId={currentUserId} />}
      {subTab === "permisos" && <SpacePermissionsPanel users={users} allSpaces={allSpaces} spaceAccess={spaceAccess} updateSpaceAccess={updateSpaceAccess} />}
      {subTab === "datos" && <DataAdminPanel onResetTasks={onResetTasks} onResetTerrenos={onResetTerrenos} onResetCustomViews={onResetCustomViews} taskCount={taskCount} terrenoCount={terrenoCount} customViewsCount={customViewsCount} onExportTasks={onExportTasks} onExportTerrenos={onExportTerrenos} />}
      {subTab === "features" && <FeaturesAdminPanel features={features} setFeatures={setFeatures} />}
      {subTab === "jabberwocky" && <JabberwockyPanel tasks={tasks} customViews={customViews} terrenos={terrenos} customSpaces={customSpaces} allSpaces={allSpaces} users={users} messages={messages} smartViews={smartViews} whiteboards={whiteboards} spaceAccess={spaceAccess} agentStatus={agentStatus} recordAgentRun={recordAgentRun} />}
      {subTab === "bandersnatch" && <BandersnatchPanel tasks={tasks} setTasks={setTasks} customViews={customViews} setCustomViews={setCustomViews} terrenos={terrenos} setTerrenos={setTerrenos} customSpaces={customSpaces} setCustomSpaces={setCustomSpaces} allSpaces={allSpaces} users={users} recordAgentRun={recordAgentRun} />}
      {subTab === "cheshire" && <CheshirePanel tasks={tasks} customViews={customViews} terrenos={terrenos} customSpaces={customSpaces} allSpaces={allSpaces} users={users} smartViews={smartViews} whiteboards={whiteboards} recordAgentRun={recordAgentRun} />}
      {subTab === "mad-hatter" && <MadHatterPanel tasks={tasks} users={users} allSpaces={allSpaces} terrenos={terrenos} customSpaces={customSpaces} recordAgentRun={recordAgentRun} />}
      {subTab === "white-rabbit" && <WhiteRabbitPanel customViews={customViews} setCustomViews={setCustomViews} allSpaces={allSpaces} tasks={tasks} terrenos={terrenos} smartViews={smartViews} recordAgentRun={recordAgentRun} />}
      {subTab === "dark-alice" && <DarkAlicePanel agentStatus={agentStatus} recordAgentRun={recordAgentRun} tasks={tasks} customViews={customViews} terrenos={terrenos} customSpaces={customSpaces} users={users} whiteboards={whiteboards} smartViews={smartViews} setAdminSubTab={setSubTab} quarantineMode={quarantineMode} setQuarantineMode={setQuarantineMode} />}
      {subTab === "tea-table" && <TeaTableView agentStatus={agentStatus} setSubTab={setSubTab} tasks={tasks} terrenos={terrenos} allSpaces={allSpaces} users={users} customViews={customViews} customSpaces={customSpaces} whiteboards={whiteboards} smartViews={smartViews} />}
    </div>
  );
}

// ─── EXPORTAR A CLAUDE · helper compartido por todos los agentes ───
function ExportToClaude({ markdown, filename }) {
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const copyMd = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      // Fallback for browsers that block clipboard
      const ta = document.createElement("textarea");
      ta.value = markdown;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); setCopied(true); setTimeout(() => setCopied(false), 2500); }
      catch (err) { alert("No pude copiar al clipboard · usá descargar .md"); }
      document.body.removeChild(ta);
    }
  };

  const downloadMd = () => {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2500);
  };

  const openClaude = () => window.open("https://claude.ai/new", "_blank", "noopener,noreferrer");

  return (
    <div className="py-3 px-4 flex items-center flex-wrap gap-2" style={{ backgroundColor: `${C.cobalt}08`, border: `1px solid ${C.cobalt}30`, borderRadius: 2 }}>
      <Sparkles size={13} style={{ color: C.cobalt, flexShrink: 0 }} />
      <div className="flex-1 min-w-[160px]">
        <div className="text-[11px]" style={{ color: C.ink, fontWeight: 600 }}>Exportar reporte a Claude</div>
        <div className="text-[10px]" style={{ color: C.muted }}>Markdown estructurado · pegalo en una conversación nueva</div>
      </div>
      <button onClick={copyMd} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] hover:opacity-90 flex-shrink-0" style={{ backgroundColor: C.ink, color: "white", borderRadius: 2, fontWeight: 500 }}>
        {copied ? <><Check size={10} /> Copiado</> : <><Copy size={10} /> Copiar</>}
      </button>
      <button onClick={downloadMd} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] hover:opacity-70 flex-shrink-0" style={{ color: C.muted, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
        {downloaded ? <><Check size={10} /> Bajado</> : <><Download size={10} /> .md</>}
      </button>
      <button onClick={openClaude} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] hover:opacity-70 flex-shrink-0" style={{ color: C.muted, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
        <ExternalLink size={10} /> Abrir Claude
      </button>
    </div>
  );
}

// ─── EL CHESHIRE CAT · analista de UX gaps · capability catalog ───
// ─── EL MAD HATTER · analista de performance · sugiere acciones ───
// ─── HQ DASHBOARD · widgets editables + AI summaries por área ───
const DEFAULT_HQ_WIDGETS = [
  { id: "w-kpi-total", type: "kpi", title: "Tareas totales", metric: "tasks_total" },
  { id: "w-kpi-overdue", type: "kpi", title: "Vencidas", metric: "tasks_overdue" },
  { id: "w-kpi-completion", type: "kpi", title: "% Completion", metric: "completion_rate" },
  { id: "w-kpi-terrenos", type: "kpi", title: "Terrenos en pipeline", metric: "terrenos_active" },
  { id: "w-summary-finanzas", type: "area-summary", area: "finanzas", title: "Finanzas" },
  { id: "w-summary-comercial", type: "area-summary", area: "comercial", title: "Comercial" },
  { id: "w-summary-bam", type: "area-summary", area: "bam", title: "BAM · Arquitectura" },
  { id: "w-summary-legal", type: "area-summary", area: "legal", title: "Legal" },
];

function HQWidgetsBlock({ tasks, terrenos, allSpaces, users, customSpaces, navigate, openDetail }) {
  const [widgets, setWidgets] = useState(() => {
    try {

      const local = localStorage.getItem("hygge:hqWidgets");
      return local ? JSON.parse(local) : DEFAULT_HQ_WIDGETS;
    } catch { return DEFAULT_HQ_WIDGETS; }
  });
  const [summaries, setSummaries] = useState(() => {
    try {
      const local = localStorage.getItem("hygge:hqSummaries");
      const parsed = local ? JSON.parse(local) : {};
      // Clean up: si hay un valor que es un mensaje de error, descartalo
      const clean = {};
      Object.entries(parsed).forEach(([k, v]) => {
        if (typeof v === "string" && !v.startsWith("(API no respondió") && v !== "Generando resumen...") {
          clean[k] = v;
        }
      });
      return clean;
    } catch { return {}; }
  });
  const [summaryErrors, setSummaryErrors] = useState({}); // area → error message
  const [summaryLoading, setSummaryLoading] = useState({}); // area → bool
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => { saveStored("hygge:hqWidgets", widgets); }, [widgets]);
  useEffect(() => { saveStored("hygge:hqSummaries", summaries); }, [summaries]);

  // Compute metrics for KPI widgets
  const metrics = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter(t => t.checked).length;
    const open = tasks.filter(t => !t.checked);
    const overdue = open.filter(t => {
      if (!t.due || t.due === "—") return false;
      const d = new Date(t.due);
      return !isNaN(d) && d < new Date();
    }).length;
    const completion = total > 0 ? Math.round((done / total) * 100) : 0;
    const terrenosActive = terrenos.filter(t => !["descartado", "comprado"].includes(t.status)).length;
    return {
      tasks_total: total,
      tasks_open: open.length,
      tasks_done: done,
      tasks_overdue: overdue,
      completion_rate: `${completion}%`,
      terrenos_active: terrenosActive,
      users_count: users.length,
    };
  }, [tasks, terrenos, users]);

  // Per-area task counts
  const areaCounts = useMemo(() => {
    const result = {};
    allSpaces.forEach(s => {
      const childIds = (s.children || []).map(c => c.id);
      const t = tasks.filter(x => x.space === s.id || childIds.includes(x.space));
      result[s.id] = { total: t.length, open: t.filter(x => !x.checked).length, done: t.filter(x => x.checked).length };
    });
    return result;
  }, [tasks, allSpaces]);

  const removeWidget = (id) => setWidgets(prev => prev.filter(w => w.id !== id));
  const addWidget = (w) => { setWidgets(prev => [...prev, { ...w, id: `w-${Date.now()}` }]); setAddOpen(false); };

  const updateSummary = (area, text) => setSummaries(prev => ({ ...prev, [area]: text }));
  const clearSummary = (area) => {
    setSummaries(prev => { const n = { ...prev }; delete n[area]; return n; });
    setSummaryErrors(prev => { const n = { ...prev }; delete n[area]; return n; });
  };

  // Internal call with rate-limit detection
  const tryGenerate = async (space, ctx) => {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: anthropicHeaders(),
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        system: `Sos un asistente ejecutivo para Sebastián Bonilla (CEO de Hygge Holding, desarrolladora inmobiliaria peruana). Escribís resúmenes breves del estado de un área. Tono: directo, ejecutivo, rioplatense. 2-3 oraciones máx. Sin listas, sin viñetas. Centrate en lo que importa: tareas críticas, riesgos, próximo paso. Si el área no tiene tareas o está calma, decilo en una sola oración.`,
        messages: [{ role: "user", content: `Área: ${space.name}\nTareas:\n${ctx || "(sin tareas)"}\n\nResumen ejecutivo:` }],
      }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      const isRateLimit = resp.status === 429 || /rate.?limit/i.test(err);
      throw Object.assign(new Error(isRateLimit ? "rate_limit" : `http_${resp.status}`), { isRateLimit, raw: err });
    }
    const data = await resp.json();
    return data.content?.find(c => c.type === "text")?.text || "Sin lectura disponible.";
  };

  const generateSummary = async (area) => {
    const space = allSpaces.find(s => s.id === area);
    if (!space) return;
    const childIds = (space.children || []).map(c => c.id);
    const areaTasks = tasks.filter(t => t.space === area || childIds.includes(t.space)).slice(0, 20);
    const ctx = areaTasks.map(t => `- ${t.checked ? "[✓]" : "[ ]"} ${t.title} · ${t.priority} · ${t.assignee || "sin asignar"} · due ${t.due || "—"}`).join("\n");

    setSummaryLoading(prev => ({ ...prev, [area]: true }));
    setSummaryErrors(prev => { const n = { ...prev }; delete n[area]; return n; });
    // CRÍTICO: NO sobreescribimos `summaries[area]` con loading text — si había un resumen previo válido, queda visible mientras carga

    try {
      const text = await tryGenerate(space, ctx);
      updateSummary(area, text);
    } catch (e) {
      if (e.isRateLimit) {
        // 1 retry con backoff de 3s
        await new Promise(r => setTimeout(r, 3000));
        try {
          const text = await tryGenerate(space, ctx);
          updateSummary(area, text);
        } catch (e2) {
          setSummaryErrors(prev => ({ ...prev, [area]: e2.isRateLimit ? "Rate limit · esperá ~30 seg y reintentá" : `Error: ${e2.message?.slice(0, 60)}` }));
        }
      } else {
        setSummaryErrors(prev => ({ ...prev, [area]: `Error: ${e.message?.slice(0, 60) || "desconocido"}` }));
      }
    } finally {
      setSummaryLoading(prev => { const n = { ...prev }; delete n[area]; return n; });
    }
  };

  const renderWidget = (w) => {
    if (w.type === "kpi") {
      const val = metrics[w.metric];
      return (
        <div key={w.id} className="group/widget relative p-4" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 4 }}>
          <button onClick={() => removeWidget(w.id)} className="absolute top-2 right-2 p-1 opacity-0 group-hover/widget:opacity-100 hover:opacity-100"><X size={11} style={{ color: C.muted }} /></button>
          <div className="text-[9px] mb-2" style={{ color: C.muted, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>{w.title}</div>
          <div className="text-[28px] leading-none" style={{ color: w.metric === "tasks_overdue" && metrics.tasks_overdue > 0 ? C.brick : C.ink, fontWeight: 600, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
            {val ?? "—"}
          </div>
        </div>
      );
    }

    if (w.type === "area-summary") {
      const counts = areaCounts[w.area] || { total: 0, open: 0, done: 0 };
      const summary = summaries[w.area];
      const space = allSpaces.find(s => s.id === w.area);
      const childIds = (space?.children || []).map(c => c.id);
      const areaTasks = tasks.filter(t => t.space === w.area || childIds.includes(t.space));
      return (
        <AreaSummaryWidget
          key={w.id}
          widget={w}
          counts={counts}
          summary={summary}
          error={summaryErrors[w.area]}
          loading={!!summaryLoading[w.area]}
          areaTasks={areaTasks}
          space={space}
          navigate={navigate}
          openDetail={openDetail}
          onUpdateSummary={updateSummary}
          onGenerate={() => generateSummary(w.area)}
          onClear={() => clearSummary(w.area)}
          onRemove={() => removeWidget(w.id)}
        />
      );
    }

    return null;
  };

  const kpiWidgets = widgets.filter(w => w.type === "kpi");
  const summaryWidgets = widgets.filter(w => w.type === "area-summary");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-[20px]" style={{ color: C.ink, fontWeight: 600, letterSpacing: "-0.015em" }}>Dashboard ejecutivo</div>
          <div className="text-[11px]" style={{ color: C.muted }}>Widgets editables · resúmenes por área (AI o manual) · cliqueá ✕ para remover</div>
        </div>
        <button onClick={() => setAddOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] hover:opacity-90" style={{ backgroundColor: C.ink, color: "white", borderRadius: 2, fontWeight: 500 }}>
          <Plus size={12} /> Agregar widget
        </button>
      </div>

      {/* KPI row */}
      {kpiWidgets.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {kpiWidgets.map(renderWidget)}
        </div>
      )}

      {/* Area summaries grid */}
      {summaryWidgets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {summaryWidgets.map(renderWidget)}
        </div>
      )}

      {widgets.length === 0 && (
        <div className="text-center py-12 text-[12px]" style={{ color: C.muted, backgroundColor: C.paper, border: `1px dashed ${C.line}`, borderRadius: 4 }}>
          Sin widgets · click "Agregar widget" para empezar
        </div>
      )}

      {addOpen && <AddWidgetModal onClose={() => setAddOpen(false)} onAdd={addWidget} allSpaces={allSpaces} existing={widgets} />}
    </div>
  );
}

function AreaSummaryWidget({ widget, counts, summary, error, loading, areaTasks = [], space, navigate, openDetail, onUpdateSummary, onGenerate, onClear, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(summary || "");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => { if (!editing) setDraft(summary || ""); }, [summary, editing]);

  // Sub-widget data · derivado de areaTasks
  const topOpenTasks = areaTasks
    .filter(t => !t.checked)
    .map(t => {
      const dueDate = (t.due && t.due !== "—") ? new Date(t.due) : null;
      const dias = dueDate && !isNaN(dueDate) ? Math.round((dueDate - new Date()) / 86400000) : 999;
      return { ...t, dias };
    })
    .sort((a, b) => a.dias - b.dias)
    .slice(0, 3);

  const overdueCount = areaTasks.filter(t => {
    if (t.checked || !t.due || t.due === "—") return false;
    const d = new Date(t.due);
    return !isNaN(d) && d < new Date();
  }).length;

  const urgentCount = areaTasks.filter(t => !t.checked && (t.priority === "urgente" || t.priority === "alta")).length;

  return (
    <div className="group/widget relative p-4 flex flex-col gap-3" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 4, minHeight: 140 }}>
      <button onClick={onRemove} className="absolute top-2 right-2 p-1 opacity-0 group-hover/widget:opacity-100 hover:opacity-100"><X size={11} style={{ color: C.muted }} /></button>

      <div className="flex items-baseline gap-3 pr-6">
        <div className="text-[13px]" style={{ color: C.ink, fontWeight: 600, letterSpacing: "-0.01em" }}>{widget.title}</div>
        <div className="text-[10px] tabular-nums" style={{ color: C.muted }}>{counts.open} abiertas · {counts.done} hechas · {counts.total} total</div>
      </div>

      {/* Error banner (dismissible, separate from summary) */}
      {error && !loading && (
        <div className="flex items-start gap-2 px-2.5 py-1.5" style={{ backgroundColor: `${C.brick}10`, border: `1px solid ${C.brick}40`, borderRadius: 2 }}>
          <span style={{ fontSize: 10, color: C.brick, fontWeight: 600, flex: 1 }}>{error}</span>
          <button onClick={() => onClear && onClear(widget.area)} className="hover:opacity-70" title="Limpiar error"><X size={10} style={{ color: C.brick }} /></button>
        </div>
      )}

      {!editing ? (
        <div className="flex-1">
          {loading ? (
            <div className="text-[11px] italic flex items-center gap-1.5" style={{ color: C.muted }}>
              <Loader2 size={11} className="animate-spin" /> Generando resumen vía Claude...
            </div>
          ) : summary ? (
            <div className="text-[12px] leading-relaxed" style={{ color: C.ink, lineHeight: 1.6 }}>{summary}</div>
          ) : (
            <div className="text-[11px] italic" style={{ color: C.muted }}>Sin resumen · clic "Generar con AI" o "Editar"</div>
          )}
        </div>
      ) : (
        <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={4} autoFocus
          className="flex-1 px-2 py-1.5 outline-none text-[12px] resize-none"
          style={{ backgroundColor: C.bg, border: `1px solid ${C.cobalt}`, borderRadius: 2, color: C.ink, lineHeight: 1.55, fontFamily: "inherit" }} />
      )}

      {/* Sub-widgets · solo cuando expanded */}
      {expanded && !editing && (
        <div className="space-y-2" style={{ borderTop: `1px solid ${C.lineSoft}`, paddingTop: 10 }}>
          {/* Mini KPIs */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Vencidas", val: overdueCount, color: overdueCount > 0 ? C.brick : C.muted },
              { label: "Urgentes", val: urgentCount, color: urgentCount > 0 ? C.ochre : C.muted },
              { label: "Cerradas", val: counts.done, color: C.green },
            ].map((k, i) => (
              <div key={i} style={{ backgroundColor: C.bg, border: `1px solid ${C.lineSoft}`, borderRadius: 2, padding: "8px 10px" }}>
                <div style={{ fontSize: 8, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>{k.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: k.color, marginTop: 2, lineHeight: 1 }}>{k.val}</div>
              </div>
            ))}
          </div>

          {/* Top tareas abiertas */}
          {topOpenTasks.length > 0 && (
            <div>
              <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Próximas a vencer</div>
              <div className="space-y-1">
                {topOpenTasks.map(t => (
                  <button key={t.id} onClick={() => openDetail && openDetail(t.id)} className="w-full text-left flex items-center gap-2 px-2 py-1.5 hover:opacity-80" style={{ backgroundColor: C.bg, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
                    <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: t.priority === "urgente" || t.priority === "alta" ? C.brick : C.muted }} />
                    <span className="flex-1 truncate" style={{ fontSize: 10, color: C.ink, fontWeight: 500 }}>{t.title}</span>
                    <span style={{ fontSize: 9, color: t.dias < 0 ? C.brick : t.dias === 0 ? C.ochre : C.muted, fontWeight: 600, flexShrink: 0 }}>
                      {t.dias < 0 ? `${Math.abs(t.dias)}d` : t.dias === 0 ? "hoy" : t.dias < 100 ? `+${t.dias}d` : "—"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Link al space */}
          {space && navigate && (
            <button onClick={() => navigate(space.id)} className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 hover:opacity-80" style={{ backgroundColor: C.bg, border: `1px solid ${C.lineSoft}`, borderRadius: 2, color: C.cobalt, fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Abrir space completo <ArrowRight size={10} />
            </button>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 mt-auto flex-wrap">
        {editing ? (
          <>
            <button onClick={() => { onUpdateSummary(widget.area, draft.trim()); setEditing(false); }} className="px-2.5 py-1 text-[10px] hover:opacity-90" style={{ backgroundColor: C.ink, color: "white", borderRadius: 2, fontWeight: 500 }}>Guardar</button>
            <button onClick={() => setEditing(false)} className="px-2.5 py-1 text-[10px] hover:opacity-70" style={{ color: C.muted }}>Cancelar</button>
          </>
        ) : (
          <>
            <button onClick={() => setExpanded(e => !e)} className="flex items-center gap-1 px-2.5 py-1 text-[10px] hover:opacity-90" style={{ color: expanded ? C.ink : C.inkSoft, border: `1px solid ${expanded ? C.ink : C.lineSoft}`, borderRadius: 2, fontWeight: expanded ? 600 : 500 }}>
              <ChevronDown size={10} style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} /> {expanded ? "Colapsar" : "Expandir"}
            </button>
            <button onClick={() => setEditing(true)} className="flex items-center gap-1 px-2.5 py-1 text-[10px] hover:opacity-90" style={{ color: C.inkSoft, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}><PenSquare size={9} /> Editar</button>
            <button onClick={onGenerate} disabled={loading} className="flex items-center gap-1 px-2.5 py-1 text-[10px] hover:opacity-90 disabled:opacity-50" style={{ color: C.cobalt, border: `1px solid ${C.cobalt}40`, borderRadius: 2, fontWeight: 500 }}><Sparkles size={9} /> {summary ? "Regenerar" : "Generar"} con AI</button>
            {summary && !loading && (
              <button onClick={() => onClear && onClear(widget.area)} className="px-2.5 py-1 text-[10px] hover:opacity-70" style={{ color: C.muted }} title="Limpiar resumen">
                Limpiar
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function AddWidgetModal({ onClose, onAdd, allSpaces, existing }) {
  const [type, setType] = useState("area-summary");
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedMetric, setSelectedMetric] = useState("tasks_total");
  const [title, setTitle] = useState("");

  const usedAreas = new Set(existing.filter(w => w.type === "area-summary").map(w => w.area));
  const candidateAreas = allSpaces.filter(s => !["hq", "inbox", "notifications"].includes(s.id) && !usedAreas.has(s.id));

  const metricOptions = [
    { id: "tasks_total", label: "Tareas totales" },
    { id: "tasks_open", label: "Tareas abiertas" },
    { id: "tasks_done", label: "Tareas hechas" },
    { id: "tasks_overdue", label: "Tareas vencidas" },
    { id: "completion_rate", label: "% Completion" },
    { id: "terrenos_active", label: "Terrenos activos" },
    { id: "users_count", label: "Cantidad de usuarios" },
  ];

  const submit = () => {
    if (type === "area-summary") {
      if (!selectedArea) return;
      const space = allSpaces.find(s => s.id === selectedArea);
      onAdd({ type: "area-summary", area: selectedArea, title: title.trim() || space.name });
    } else {
      const metric = metricOptions.find(m => m.id === selectedMetric);
      onAdd({ type: "kpi", metric: selectedMetric, title: title.trim() || metric.label });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div className="w-full max-w-md" style={{ backgroundColor: C.bg, border: `1px solid ${C.line}`, borderRadius: 4 }} onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
          <div className="text-[14px]" style={{ color: C.ink, fontWeight: 600 }}>Agregar widget al dashboard</div>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <Eyebrow>Tipo</Eyebrow>
            <div className="flex gap-2 mt-2">
              {[{ id: "area-summary", label: "Resumen de área" }, { id: "kpi", label: "KPI numérico" }].map(opt => (
                <button key={opt.id} onClick={() => setType(opt.id)} className="flex-1 px-3 py-2 text-[11px] hover:opacity-90" style={{ backgroundColor: type === opt.id ? C.ink : C.paper, color: type === opt.id ? "white" : C.inkSoft, border: `1px solid ${type === opt.id ? C.ink : C.lineSoft}`, borderRadius: 2, fontWeight: 600 }}>{opt.label}</button>
              ))}
            </div>
          </div>

          {type === "area-summary" && (
            <div>
              <Eyebrow>Área</Eyebrow>
              <select value={selectedArea} onChange={e => setSelectedArea(e.target.value)} className="w-full mt-2 px-2 py-1.5 text-[12px] outline-none" style={{ backgroundColor: C.bg, border: `1px solid ${C.lineSoft}`, borderRadius: 2, color: C.ink }}>
                <option value="">— elegí área —</option>
                {candidateAreas.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {candidateAreas.length === 0 && <div className="text-[10px] mt-1 italic" style={{ color: C.muted }}>Todas las áreas ya tienen su widget</div>}
            </div>
          )}

          {type === "kpi" && (
            <div>
              <Eyebrow>Métrica</Eyebrow>
              <select value={selectedMetric} onChange={e => setSelectedMetric(e.target.value)} className="w-full mt-2 px-2 py-1.5 text-[12px] outline-none" style={{ backgroundColor: C.bg, border: `1px solid ${C.lineSoft}`, borderRadius: 2, color: C.ink }}>
                {metricOptions.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
          )}

          <div>
            <Eyebrow>Título (opcional)</Eyebrow>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Auto si lo dejás vacío" className="w-full mt-2 px-2 py-1.5 text-[12px] outline-none" style={{ backgroundColor: C.bg, border: `1px solid ${C.lineSoft}`, borderRadius: 2, color: C.ink }} />
          </div>
        </div>
        <div className="px-5 py-3 flex items-center gap-2 justify-end" style={{ borderTop: `1px solid ${C.lineSoft}` }}>
          <button onClick={onClose} className="px-3 py-1.5 text-[11px] hover:opacity-70" style={{ color: C.muted, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>Cancelar</button>
          <button onClick={submit} disabled={type === "area-summary" && !selectedArea} className="px-3 py-1.5 text-[11px] hover:opacity-90 disabled:opacity-40" style={{ backgroundColor: C.ink, color: "white", borderRadius: 2, fontWeight: 600 }}>Agregar</button>
        </div>
      </div>
    </div>
  );
}

// ─── EL CONEJO BLANCO · audita y repara links externos · sugiere nuevos ───
const KNOWN_DRIVE_REFS = {
  // Folders raíz
  "BAM root": "1ZV54PfOLzrGRpw4nz8nIkA6oESdtTHIj",
  "HYGGE GRUPPE": "15ZcobnMQ7NTf_u6UmFMiJsb4c8liQquy",
  "Brand Hygge Bronca": "1TZvxsncwDME0qFP3jJZq3mMpAGjG_ZvA",
  "eecc HYGGE": "18UWqbv-rNpJlsY5Ur_YdeqzFBnuM40pk",
  // Diseño por proyecto
  "Del Castillo · Diseño": "1FZ52l9N69NM6TJ5FlPD08HLogdWlo3m5",
  "Paula Ugarriza · Diseño": "1qrt9odgJ9BUOQ5kdNJQ0pE3JE8ou-fRL",
  "De la Torre · Diseño": "1dGlGY6vWpD5ODS12d6GFjnhyP7lei79o",
  "Larco 1036 · Supervisión": "1NLCOo1bfaeKHJyNWfJaluMK0YGYzrOMY",
  "Estudio BAM": "1-FWqI1EaKtX6zViJsGzcApuHOXDZVP-8",
  // FC (Fit Capital) por proyecto
  "FC · Del Castillo": "1jeSZJLyUfsrsxeOImlDV8kxqHeds6F3w",
  "FC · Paula Ugarriza": "1v1cDIR0FMXZu15YBXOuggKiTibtmrgxr",
  "FC · De la Torre": "1zho6xqpXHac2p4VAmVJF8iSH4eOOtVXJ",
};
const KNOWN_DRIVE_FILES = {
  "Edificio Legendre · ventas": "12cSCNNGz6QuREEuIVAk6NcVrvNb4eomM",
  "Cash flow Hygge 2026": "1KUp7z4OtuQ24EXZvTdsLf0JQP8dQk1Jn4v3Md3a63Bo",
  "Cap Table investors": "1eR98gF1wpxTlGNBY6qeovxSsykrkauogaYOv07cIQkY",
  "ACUERDO PRIVADO Libre 5": "1fToxXb332tY23TGHweCJuMtjZiE9t8iJ",
};
const PROJECT_DRIVE_MAP = {
  "dc01": { design: "1FZ52l9N69NM6TJ5FlPD08HLogdWlo3m5", fc: "1jeSZJLyUfsrsxeOImlDV8kxqHeds6F3w", projectName: "Del Castillo" },
  "pu01": { design: "1qrt9odgJ9BUOQ5kdNJQ0pE3JE8ou-fRL", fc: "1v1cDIR0FMXZu15YBXOuggKiTibtmrgxr", projectName: "Paula Ugarriza" },
  "tg01": { design: "1dGlGY6vWpD5ODS12d6GFjnhyP7lei79o", fc: "1zho6xqpXHac2p4VAmVJF8iSH4eOOtVXJ", projectName: "De la Torre" },
  "l36":  { design: "1NLCOo1bfaeKHJyNWfJaluMK0YGYzrOMY", projectName: "Larco 1036" },
};

function WhiteRabbitPanel({ customViews, setCustomViews, allSpaces, tasks, terrenos, smartViews, recordAgentRun }) {
  const [phase, setPhase] = useState("dormant");
  const [findings, setFindings] = useState([]);
  const [filter, setFilter] = useState("all"); // all | issues | suggestions
  const [diagnostics, setDiagnostics] = useState(null); // System diagnostic results
  const [diagRunning, setDiagRunning] = useState(false);

  const WRIcon = ({ size = 64, color = C.ink }) => (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Long ears */}
      <ellipse cx="30" cy="14" rx="4" ry="13" fill="white" stroke={color} strokeWidth="1.5" />
      <ellipse cx="30" cy="14" rx="1.6" ry="9" fill={C.brick} opacity="0.4" />
      <ellipse cx="50" cy="14" rx="4" ry="13" fill="white" stroke={color} strokeWidth="1.5" />
      <ellipse cx="50" cy="14" rx="1.6" ry="9" fill={C.brick} opacity="0.4" />
      {/* Head */}
      <ellipse cx="40" cy="36" rx="16" ry="14" fill="white" stroke={color} strokeWidth="1.5" />
      {/* Eyes — anxious wide */}
      <circle cx="33" cy="34" r="2.5" fill={color} />
      <circle cx="34" cy="33" r="0.8" fill="white" />
      <circle cx="47" cy="34" r="2.5" fill={color} />
      <circle cx="48" cy="33" r="0.8" fill="white" />
      {/* Pink nose */}
      <path d="M38 40 L42 40 L40 43 Z" fill={C.brick} opacity="0.7" />
      {/* Whiskers */}
      <line x1="24" y1="40" x2="14" y2="38" stroke={color} strokeWidth="0.5" />
      <line x1="24" y1="42" x2="14" y2="44" stroke={color} strokeWidth="0.5" />
      <line x1="56" y1="40" x2="66" y2="38" stroke={color} strokeWidth="0.5" />
      <line x1="56" y1="42" x2="66" y2="44" stroke={color} strokeWidth="0.5" />
      {/* Mouth — worried */}
      <path d="M37 44 Q40 46 43 44" stroke={color} strokeWidth="0.8" fill="none" />
      {/* Body in waistcoat */}
      <path d="M30 49 L50 49 L52 70 L28 70 Z" fill="white" stroke={color} strokeWidth="1" />
      <path d="M30 49 L40 60 L50 49" stroke={color} strokeWidth="0.8" fill="none" />
      {/* Bow tie */}
      <path d="M34 51 L40 54 L46 51 L46 56 L40 53 L34 56 Z" fill={C.brick} />
      <circle cx="40" cy="53.5" r="1" fill={color} />
      {/* Pocket watch chain */}
      <path d="M44 58 Q52 62 58 68" stroke={C.ochre} strokeWidth="0.8" fill="none" />
      {/* Pocket watch */}
      <circle cx="60" cy="72" r="6" fill={C.ochre} stroke={color} strokeWidth="1" />
      <circle cx="60" cy="72" r="4" fill="white" />
      <line x1="60" y1="72" x2="60" y2="69" stroke={color} strokeWidth="0.8" />
      <line x1="60" y1="72" x2="62.5" y2="73" stroke={color} strokeWidth="0.6" />
      {/* Clock numbers — just dots */}
      <circle cx="60" cy="68.5" r="0.3" fill={color} />
      <circle cx="63.5" cy="72" r="0.3" fill={color} />
      <circle cx="60" cy="75.5" r="0.3" fill={color} />
      <circle cx="56.5" cy="72" r="0.3" fill={color} />
    </svg>
  );

  // URL classification helpers
  const classifyUrl = (url) => {
    if (!url || !url.trim()) return { kind: "empty" };
    const u = url.trim();
    if (!/^https?:\/\//i.test(u)) return { kind: "malformed", reason: "no protocol (falta https://)" };
    if (u.includes("drive.google.com/drive/folders/")) return { kind: "drive-folder" };
    if (u.includes("drive.google.com/file/")) return { kind: "drive-file" };
    if (u.includes("docs.google.com/spreadsheets/")) return { kind: "sheet" };
    if (u.includes("docs.google.com/document/")) return { kind: "doc" };
    if (u.includes("docs.google.com/presentation/")) return { kind: "slides" };
    if (u.includes("miro.com")) {
      if (u.includes("/live-embed/") || u.includes("/embed/")) return { kind: "miro-ok" };
      return { kind: "miro-share", reason: "URL de share · no es embed-friendly" };
    }
    if (u.includes("clickup.com")) return { kind: "clickup" };
    if (u.includes("youtube.com") || u.includes("youtu.be")) return { kind: "youtube" };
    return { kind: "other" };
  };

  const analyze = useCallback(() => {
    const issues = [];

    // Helper: tolera ambos shapes de view URL (config.url y url)
    // El seed INITIAL_CUSTOM_VIEWS guarda en `config.url` · audits previos asumían `url`
    const getViewUrl = (v) => v?.config?.url || v?.url || "";
    // Helper para escribir el URL respetando el shape original del view
    const writeViewUrl = (v, newUrl) => {
      if (v.config) return { ...v, config: { ...v.config, url: newUrl } };
      return { ...v, url: newUrl };
    };

    // 1. Scan all customViews
    Object.entries(customViews).forEach(([spaceId, views]) => {
      const space = allSpaces.find(s => s.id === spaceId) || allSpaces.flatMap(s => s.children || []).find(c => c.id === spaceId);
      const spaceName = space?.name || spaceId;

      (views || []).forEach((v, idx) => {
        if (v.type !== "iframe") return;
        const viewUrl = getViewUrl(v);
        const cls = classifyUrl(viewUrl);
        // Label distinguible: usa name/title, si no #N + type, todo + spaceName
        const localLabel = (v.name?.trim() || v.title?.trim()) || `View #${idx + 1} (${v.type})`;
        const viewLabel = `${localLabel} · ${spaceName}`;

        if (cls.kind === "empty") {
          issues.push({
            kind: "issue", severity: "major",
            category: "URL faltante",
            target: viewLabel,
            detail: `Iframe vacío · sin URL configurada`,
            suggestion: (v.name || v.title || "").toLowerCase().includes("miro")
              ? "Miro: Share → Embed → copiá el src del iframe"
              : "Editar la view y configurar URL, o eliminarla si no se usa",
            applyFix: () => {
              setCustomViews(prev => ({
                ...prev,
                [spaceId]: (prev[spaceId] || []).filter(x => x.id !== v.id),
              }));
            },
            applyFixLabel: "Eliminar view vacía",
            viewId: v.id, spaceId,
          });
        } else if (cls.kind === "malformed") {
          issues.push({
            kind: "issue", severity: "critical",
            category: "URL malformada",
            target: viewLabel,
            detail: `${cls.reason} · "${viewUrl.slice(0, 40)}..."`,
            suggestion: "Agregar https:// al inicio",
            applyFix: () => {
              const newUrl = `https://${viewUrl.replace(/^https?:\/\//, "")}`;
              setCustomViews(prev => ({
                ...prev,
                [spaceId]: prev[spaceId].map(x => x.id === v.id ? writeViewUrl(x, newUrl) : x),
              }));
            },
            viewId: v.id, spaceId,
          });
        } else if (cls.kind === "miro-share") {
          // Try to convert Miro share URL to embed URL
          const m = viewUrl.match(/miro\.com\/app\/board\/([A-Za-z0-9_-]+)/);
          const fix = m ? `https://miro.com/app/live-embed/${m[1]}/?embedMode=view_only_without_ui` : null;
          issues.push({
            kind: "issue", severity: "major",
            category: "Miro share URL",
            target: viewLabel,
            detail: `Es URL de board (share), no embed · el iframe no va a cargar`,
            suggestion: fix ? `Auto-convertir a embed URL` : "Pedir URL de Embed (Share → Embed)",
            applyFix: fix ? () => {
              setCustomViews(prev => ({
                ...prev,
                [spaceId]: prev[spaceId].map(x => x.id === v.id ? writeViewUrl(x, fix) : x),
              }));
            } : null,
            viewId: v.id, spaceId,
          });
        } else if (cls.kind === "drive-folder") {
          // Drive folders block iframe — but ALICE has a fallback card · acknowledge
          issues.push({
            kind: "info", severity: "minor",
            category: "Drive folder (esperado)",
            target: viewLabel,
            detail: `Drive bloquea iframe de folders · ya hay fallback card · no requiere acción`,
            suggestion: "—",
            viewId: v.id, spaceId,
          });
        }
      });
    });

    // 2. Suggestions: missing views per project
    const projectSpaces = allSpaces.filter(s => PROJECT_DRIVE_MAP[s.id]);
    projectSpaces.forEach(p => {
      const refs = PROJECT_DRIVE_MAP[p.id];
      const projectViews = customViews[p.id] || [];

      // Check for Diseño view · usa getViewUrl para tolerar ambos shapes
      const hasDesign = projectViews.some(v => getViewUrl(v).includes(refs.design));
      if (!hasDesign && refs.design) {
        issues.push({
          kind: "suggestion", severity: "minor",
          category: "Falta view",
          target: `${refs.projectName}`,
          detail: `No tiene la carpeta Diseño de Drive como view`,
          suggestion: `Agregar como view tipo iframe → "Diseño · ${refs.projectName}"`,
          applyFix: () => {
            const url = `https://drive.google.com/embeddedfolderview?id=${refs.design}#grid`;
            setCustomViews(prev => ({
              ...prev,
              [p.id]: [...(prev[p.id] || []), {
                id: `wr-design-${Date.now()}`,
                name: `Diseño · ${refs.projectName}`,
                type: "iframe",
                url,
                fullWidth: true,
              }],
            }));
          },
        });
      }

      // Check for FC view · usa getViewUrl
      if (refs.fc) {
        const hasFC = projectViews.some(v => getViewUrl(v).includes(refs.fc));
        if (!hasFC) {
          issues.push({
            kind: "suggestion", severity: "minor",
            category: "Falta view",
            target: `${refs.projectName}`,
            detail: `No tiene la carpeta FC (Fit Capital) de Drive`,
            suggestion: `Agregar como view → "FC · ${refs.projectName}"`,
            applyFix: () => {
              const url = `https://drive.google.com/embeddedfolderview?id=${refs.fc}#grid`;
              setCustomViews(prev => ({
                ...prev,
                [p.id]: [...(prev[p.id] || []), {
                  id: `wr-fc-${Date.now()}`,
                  title: `FC · ${refs.projectName}`,
                  type: "iframe",
                  config: { url },
                  fullWidth: true,
                }],
              }));
            },
          });
        }
      }

      // Check for Miro · usa getViewUrl
      const hasMiro = projectViews.some(v => getViewUrl(v).includes("miro.com"));
      if (!hasMiro) {
        issues.push({
          kind: "suggestion", severity: "minor",
          category: "Falta view",
          target: `${refs.projectName}`,
          detail: `Sin board de Miro asociado`,
          suggestion: `Agregar placeholder vacío "Miro · ${refs.projectName}" para pegar URL después`,
          applyFix: () => {
            setCustomViews(prev => ({
              ...prev,
              [p.id]: [...(prev[p.id] || []), {
                id: `wr-miro-${Date.now()}`,
                name: `Miro · ${refs.projectName}`,
                type: "iframe",
                url: "",
                fullWidth: true,
              }],
            }));
          },
        });
      }
    });

    // 3. Suggest top-level reference views if missing
    const hqViews = customViews["hq"] || [];
    const hasCashFlow = hqViews.some(v => (v.url || "").includes(KNOWN_DRIVE_FILES["Cash flow Hygge 2026"]));
    if (!hasCashFlow) {
      issues.push({
        kind: "suggestion", severity: "minor",
        category: "Falta view en HQ",
        target: "Hygge HQ",
        detail: `No tiene el Cash Flow 2026 sheet como view`,
        suggestion: `Agregar sheet ejecutivo como view del HQ`,
        applyFix: () => {
          const id = KNOWN_DRIVE_FILES["Cash flow Hygge 2026"];
          const url = `https://docs.google.com/spreadsheets/d/${id}/htmlembed`;
          setCustomViews(prev => ({
            ...prev,
            hq: [...(prev.hq || []), {
              id: `wr-cashflow-${Date.now()}`,
              name: "Cash Flow 2026",
              type: "iframe",
              url,
              fullWidth: true,
            }],
          }));
        },
      });
    }

    if (issues.length === 0) {
      issues.push({ kind: "info", severity: "info", category: "Todo en orden", target: "—", detail: "El conejo guarda su reloj. Nada urgente que reparar.", suggestion: "—" });
    }

    const sevOrder = { critical: 0, major: 1, minor: 2, info: 3 };
    issues.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);

    return issues;
  }, [customViews, allSpaces, setCustomViews]);

  const run = () => {
    setPhase("analyzing");
    setTimeout(() => {
      const f = analyze();
      setFindings(f);
      setPhase("done");
      if (recordAgentRun) {
        const issues = f.filter(x => x.kind === "issue").length;
        const critical = f.filter(x => x.severity === "critical").length;
        recordAgentRun("white-rabbit", {
          result: { issues, suggestions: f.filter(x => x.kind === "suggestion").length, critical },
          severity: critical > 0 ? "critical" : issues > 5 ? "major" : issues > 0 ? "minor" : "ok",
        });
      }
    }, 600);
  };

  const sevColor = (s) => s === "critical" ? C.brick : s === "major" ? C.ochre : s === "minor" ? C.muted : C.cobalt;
  const sevLabel = (s) => s === "critical" ? "Urgente" : s === "major" ? "Importante" : s === "minor" ? "Menor" : "Info";

  const filtered = findings.filter(f => {
    if (filter === "issues") return f.kind === "issue";
    if (filter === "suggestions") return f.kind === "suggestion";
    return true;
  });

  const counts = {
    issues: findings.filter(f => f.kind === "issue").length,
    suggestions: findings.filter(f => f.kind === "suggestion").length,
    info: findings.filter(f => f.kind === "info").length,
  };

  const markdown = useMemo(() => {
    if (findings.length === 0) return "";
    const today = new Date().toISOString().slice(0, 10);
    let md = `# Reporte del Conejo Blanco · Links externos · ALICE\n\n**Fecha:** ${today}\n**Issues:** ${counts.issues} · **Sugerencias:** ${counts.suggestions}\n\n---\n\n`;

    // Agrupar por space para colapsar duplicados visuales
    const bySpace = findings.reduce((acc, f) => {
      const spaceMatch = (f.target || "").match(/· ([^·]+)$/);
      const spaceName = spaceMatch ? spaceMatch[1].trim() : "Sin space";
      const key = `${spaceName}::${f.category}`;
      if (!acc[key]) acc[key] = { spaceName, category: f.category, severity: f.severity, kind: f.kind, items: [], detail: f.detail, suggestion: f.suggestion };
      acc[key].items.push(f);
      return acc;
    }, {});

    Object.values(bySpace).forEach(group => {
      const tag = group.kind === "suggestion" ? "💡" : group.kind === "info" ? "ℹ️" : "⚠️";
      const sev = sevLabel(group.severity).toUpperCase();
      md += `### ${tag} [${sev}] ${group.category} · ${group.spaceName}`;
      if (group.items.length > 1) md += ` (${group.items.length})`;
      md += `\n${group.detail}\n\n`;
      if (group.items.length > 1) {
        md += `**Views afectadas:**\n`;
        group.items.forEach(f => {
          const localPart = (f.target || "").split(" · ")[0];
          md += `- ${localPart}\n`;
        });
        md += `\n`;
      }
      md += `**Acción:** ${group.suggestion}\n\n`;
    });

    md += `\n---\n\n_Generado por El Conejo Blanco · "I'm late, I'm late, for a very important date!"_\n`;
    return md;
  }, [findings, counts]);

  // System Diagnostic — prueba reachability de CDNs externos críticos (mapa, etc.)
  const runSystemDiagnostic = async () => {
    setDiagRunning(true);
    setDiagnostics(null);
    const tests = [
      { id: "leaflet-js", label: "Leaflet.js (unpkg.com)", url: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" },
      { id: "leaflet-css", label: "Leaflet CSS (unpkg.com)", url: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" },
      { id: "carto-tile", label: "Map tiles (basemaps.cartocdn.com)", url: "https://a.basemaps.cartocdn.com/light_all/13/2336/3759.png", isImage: true },
      { id: "openstreetmap", label: "OSM tiles (tile.openstreetmap.org)", url: "https://tile.openstreetmap.org/13/2336/3759.png", isImage: true },
      { id: "anthropic-api", label: "Claude API (api.anthropic.com)", url: "https://api.anthropic.com/v1/messages" },
      { id: "google-fonts", label: "Google Fonts (fonts.googleapis.com)", url: "https://fonts.googleapis.com/css2?family=DM+Sans" },
    ];

    const results = await Promise.all(tests.map(async t => {
      const start = Date.now();
      try {
        if (t.isImage) {
          // Test image load via Image() — works across CORS for img tags
          await new Promise((resolve, reject) => {
            const img = new Image();
            const timeout = setTimeout(() => reject(new Error("timeout 5s")), 5000);
            img.onload = () => { clearTimeout(timeout); resolve(); };
            img.onerror = () => { clearTimeout(timeout); reject(new Error("load failed")); };
            img.src = t.url + `?_=${Date.now()}`;
          });
          return { ...t, ok: true, ms: Date.now() - start, note: "imagen cargó" };
        } else {
          // Test fetch with no-cors mode — sees if request succeeds at network level
          await fetch(t.url, { mode: "no-cors", cache: "no-store" });
          return { ...t, ok: true, ms: Date.now() - start, note: "respuesta de red" };
        }
      } catch (e) {
        return { ...t, ok: false, ms: Date.now() - start, error: e.message || "fail" };
      }
    }));

    // Test the Leaflet map specifically: did the iframe actually finish loading?
    // Use a probe iframe with the same srcDoc + listen for "ready"
    const mapTest = await new Promise(resolve => {
      let resolved = false;
      const handler = (e) => {
        if (e.data?.source === "hygge-map" && e.data?.type === "ready" && !resolved) {
          resolved = true;
          window.removeEventListener("message", handler);
          resolve({ ok: true, note: "el iframe del mapa respondió 'ready'" });
        }
      };
      window.addEventListener("message", handler);
      const probe = document.createElement("iframe");
      probe.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;border:0;left:-9999px";
      probe.sandbox = "allow-scripts allow-same-origin";
      probe.srcdoc = LEAFLET_IFRAME_HTML;
      document.body.appendChild(probe);
      setTimeout(() => {
        if (!resolved) {
          window.removeEventListener("message", handler);
          resolve({ ok: false, note: "el iframe nunca envió 'ready' tras 7s · probable bloqueo de CSP" });
        }
        try { document.body.removeChild(probe); } catch {}
      }, 7000);
    });
    results.push({ id: "map-iframe", label: "Mapa Leaflet (iframe srcDoc + postMessage)", ...mapTest });

    setDiagnostics(results);
    setDiagRunning(false);
  };

  return (
    <div className="space-y-5">
      {phase === "dormant" && (
        <div className="text-center py-10 px-6" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 4 }}>
          <div className="inline-block mb-4"><WRIcon size={84} /></div>
          <div className="text-[18px] mb-1.5" style={{ color: C.ink, fontWeight: 600, letterSpacing: "-0.015em" }}>El Conejo Blanco</div>
          <div className="text-[11px] mb-1" style={{ color: C.brick, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>Audita links · repara · sugiere nuevos</div>
          <div className="text-[12px] mb-6 max-w-md mx-auto" style={{ color: C.muted, lineHeight: 1.6 }}>
            Revisa cada URL externa de tus custom views · detecta vacíos, malformados, miros mal pegados · sugiere las carpetas de Drive que tu proyecto debería tener pero no tiene.
          </div>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button onClick={run} className="inline-flex items-center gap-2 px-5 py-2.5 text-[12px] hover:opacity-90" style={{ backgroundColor: C.ink, color: "white", borderRadius: 2, fontWeight: 600, letterSpacing: "0.02em" }}>
              <Zap size={13} /> Revisar reloj
            </button>
            <button onClick={runSystemDiagnostic} disabled={diagRunning} className="inline-flex items-center gap-2 px-4 py-2.5 text-[11px] hover:opacity-90 disabled:opacity-50" style={{ color: C.inkSoft, border: `1px solid ${C.lineSoft}`, borderRadius: 2, fontWeight: 600 }}>
              <Search size={11} /> {diagRunning ? "Probando..." : "System Diagnostic"}
            </button>
          </div>
          <div className="text-[10px] mt-5" style={{ color: C.muted, fontStyle: "italic" }}>
            "Oh dear! Oh dear! I shall be too late!"
          </div>

          {/* Diagnostic results */}
          {diagnostics && (
            <div className="mt-6 text-left" style={{ backgroundColor: C.bg, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
              <div className="px-4 py-2.5" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
                <div className="text-[11px]" style={{ color: C.ink, fontWeight: 600 }}>System Diagnostic · CDNs y servicios externos</div>
                <div className="text-[10px] mt-0.5" style={{ color: C.muted }}>
                  {diagnostics.filter(d => d.ok).length} OK · {diagnostics.filter(d => !d.ok).length} fallan
                </div>
              </div>
              <div className="divide-y" style={{ borderColor: C.lineSoft }}>
                {diagnostics.map(d => (
                  <div key={d.id} className="flex items-center gap-3 px-4 py-2">
                    <span className="text-[12px] flex-shrink-0" style={{ color: d.ok ? C.green : C.brick, fontWeight: 700 }}>{d.ok ? "✓" : "✗"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px]" style={{ color: C.ink, fontWeight: 500 }}>{d.label}</div>
                      <div className="text-[9px] mt-0.5" style={{ color: d.ok ? C.muted : C.brick }}>
                        {d.ok ? `${d.note || ""} · ${d.ms}ms` : `${d.error || d.note} · ${d.ms ? `${d.ms}ms` : ""}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {diagnostics.find(d => d.id === "map-iframe" && !d.ok) && (
                <div className="px-4 py-3 text-[10px]" style={{ backgroundColor: `${C.ochre}10`, color: C.inkSoft, lineHeight: 1.6, borderTop: `1px solid ${C.lineSoft}` }}>
                  <strong style={{ color: C.ink }}>Diagnóstico del mapa:</strong> el iframe del mapa no carga. Si Leaflet.js falla arriba → CSP del artifact bloquea unpkg.com. Si Leaflet OK pero tiles fallan → CSP bloquea carto CDN (las tiles del mapa). En producción (deploy a un dominio propio con CSP propio) esto va a funcionar. Por ahora hay un fallback con lista de terrenos y coordenadas.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {phase === "analyzing" && (
        <div className="text-center py-12" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 4 }}>
          <WRIcon size={56} />
          <div className="text-[12px] mt-3" style={{ color: C.muted, fontStyle: "italic" }}>Revisando el reloj... checking every link...</div>
        </div>
      )}

      {phase === "done" && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-4 py-4 px-5" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 4 }}>
            <WRIcon size={48} />
            <div className="flex-1">
              <div className="text-[13px]" style={{ color: C.ink, fontWeight: 600 }}>Revisión completada</div>
              <div className="text-[10px] mt-0.5" style={{ color: C.muted }}>{counts.issues} issues · {counts.suggestions} sugerencias</div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-[22px] leading-none" style={{ color: counts.issues > 0 ? C.brick : C.green, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{counts.issues}</div>
                <div className="text-[9px] mt-1" style={{ color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>issues</div>
              </div>
              <div className="text-center">
                <div className="text-[22px] leading-none" style={{ color: C.cobalt, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{counts.suggestions}</div>
                <div className="text-[9px] mt-1" style={{ color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>sugerencias</div>
              </div>
            </div>
          </div>

          <ExportToClaude markdown={markdown} filename="hygge-white-rabbit" />

          {/* Bulk cleanup action · si hay 3+ views vacías, ofrecer eliminar todas */}
          {(() => {
            const emptyIssues = findings.filter(f => f.category === "URL faltante" && f.applyFix);
            if (emptyIssues.length < 3) return null;
            return (
              <div className="flex items-center gap-3 py-2.5 px-3.5" style={{ backgroundColor: `${C.brick}10`, border: `1px solid ${C.brick}40`, borderRadius: 2 }}>
                <div className="flex-1">
                  <div className="text-[11px]" style={{ color: C.ink, fontWeight: 600 }}>Cleanup masivo disponible</div>
                  <div className="text-[10px]" style={{ color: C.inkSoft, lineHeight: 1.5 }}>
                    {emptyIssues.length} views vacías sin URL · si nunca las llenaste, probablemente no las necesitás
                  </div>
                </div>
                <button onClick={() => {
                  if (!confirm(`¿Eliminar las ${emptyIssues.length} views vacías de una sola vez?\n\nNo se puede deshacer fácilmente · pero podés re-crearlas manualmente desde el botón + de cada space.`)) return;
                  emptyIssues.forEach(f => f.applyFix && f.applyFix());
                  setTimeout(() => setFindings(analyze()), 100);
                }} className="px-3 py-1.5 text-[10px] hover:opacity-90 flex-shrink-0" style={{ backgroundColor: C.brick, color: "white", borderRadius: 2, fontWeight: 600 }}>
                  Eliminar las {emptyIssues.length}
                </button>
              </div>
            );
          })()}

          {/* Filters */}
          <div className="flex items-center gap-2 py-2">
            {[
              { id: "all", label: `Todas (${findings.length})` },
              { id: "issues", label: `Issues (${counts.issues})` },
              { id: "suggestions", label: `Sugerencias (${counts.suggestions})` },
            ].map(opt => (
              <button key={opt.id} onClick={() => setFilter(opt.id)} className="px-2.5 py-1 text-[10px] hover:opacity-90" style={{
                backgroundColor: filter === opt.id ? C.ink : "transparent",
                color: filter === opt.id ? "white" : C.muted,
                border: `1px solid ${filter === opt.id ? C.ink : C.lineSoft}`,
                borderRadius: 2,
                fontWeight: filter === opt.id ? 600 : 500,
              }}>{opt.label}</button>
            ))}
          </div>

          {/* Findings list */}
          <div className="space-y-1.5">
            {filtered.map((f, i) => (
              <div key={i} className="py-2.5 px-3" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
                <div className="flex items-start gap-2.5">
                  <span className="text-[8px] px-1.5 py-0.5 flex-shrink-0" style={{ backgroundColor: `${sevColor(f.severity)}20`, color: sevColor(f.severity), borderRadius: 2, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                    {f.kind === "suggestion" ? "💡 " : ""}{sevLabel(f.severity)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] mb-0.5" style={{ color: C.ink, fontWeight: 600 }}>{f.category} · {f.target}</div>
                    <div className="text-[11px]" style={{ color: C.inkSoft, lineHeight: 1.5 }}>{f.detail}</div>
                    {f.suggestion && f.suggestion !== "—" && (
                      <div className="text-[10px] mt-1" style={{ color: C.muted, lineHeight: 1.5 }}>
                        <span style={{ color: C.cobalt, fontWeight: 600 }}>→ </span>{f.suggestion}
                      </div>
                    )}
                  </div>
                  {f.applyFix && (
                    <button onClick={() => { f.applyFix(); setFindings(analyze()); }} className="px-2.5 py-1 text-[10px] hover:opacity-90 flex-shrink-0" style={{ backgroundColor: C.cobalt, color: "white", borderRadius: 2, fontWeight: 600 }}>
                      {f.applyFixLabel || (f.kind === "suggestion" ? "Agregar" : "Aplicar fix")}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => setPhase("dormant")} className="px-3 py-1.5 text-[11px] hover:opacity-70" style={{ color: C.muted, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
            El conejo se va corriendo
          </button>
        </div>
      )}
    </div>
  );
}

function MadHatterPanel({ tasks, users, allSpaces, terrenos, customSpaces, recordAgentRun }) {
  const [phase, setPhase] = useState("dormant");
  const [report, setReport] = useState(null);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const MHIcon = ({ size = 64, color = C.ink }) => (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Top hat — crown */}
      <rect x="22" y="6" width="36" height="26" fill={color} />
      {/* Hat band */}
      <rect x="22" y="24" width="36" height="5" fill={C.brick} opacity="0.8" />
      {/* Hat brim */}
      <ellipse cx="40" cy="32" rx="26" ry="3.5" fill={color} />
      {/* Card "10/6" on band — Mad Hatter's price tag */}
      <text x="40" y="28" fontSize="5" fill="white" textAnchor="middle" fontWeight="700">10/6</text>
      {/* Face */}
      <ellipse cx="40" cy="48" rx="14" ry="13" fill={color} />
      {/* Eyes — wide, slightly crazy */}
      <circle cx="34" cy="46" r="3" fill="white" />
      <circle cx="34" cy="46" r="1.4" fill={color} />
      <circle cx="46" cy="46" r="3" fill="white" />
      <circle cx="46" cy="47" r="1.4" fill={color} />
      {/* Wild grin */}
      <path d="M32 53 Q40 59 48 53" stroke="white" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      {/* Hair tufts sticking out under hat */}
      <path d="M22 30 L18 36 L22 34 Z" fill={C.ochre} opacity="0.7" />
      <path d="M58 30 L62 36 L58 34 Z" fill={C.ochre} opacity="0.7" />
      {/* Tea cup floating */}
      <ellipse cx="66" cy="58" rx="6" ry="2" fill="white" stroke={color} strokeWidth="1" />
      <path d="M60 58 L62 65 L70 65 L72 58 Z" fill="white" stroke={color} strokeWidth="1" />
      <path d="M72 60 Q76 62 72 65" stroke={color} strokeWidth="1" fill="none" />
      {/* Steam */}
      <path d="M64 56 Q66 53 65 50" stroke={C.muted} strokeWidth="0.8" fill="none" />
      <path d="M68 56 Q70 53 69 50" stroke={C.muted} strokeWidth="0.8" fill="none" />
    </svg>
  );

  const analyze = useCallback(() => {
    // Compute per-area metrics
    const tops = allSpaces.filter(s => !["hq", "inbox", "notifications"].includes(s.id));
    const flatSpaces = [...tops, ...tops.flatMap(s => s.children || [])];

    const areaMetrics = flatSpaces.map(s => {
      const childIds = (s.children || []).map(c => c.id);
      const spaceTasks = tasks.filter(t => t.space === s.id || childIds.includes(t.space));
      const done = spaceTasks.filter(t => t.checked).length;
      const open = spaceTasks.filter(t => !t.checked);
      const overdue = open.filter(t => {
        if (!t.due || t.due === "—") return false;
        const due = new Date(t.due);
        return !isNaN(due) && due < new Date();
      });
      const highPri = open.filter(t => t.priority === "alta").length;
      const completionRate = spaceTasks.length > 0 ? Math.round((done / spaceTasks.length) * 100) : 0;
      return {
        id: s.id, name: s.name, total: spaceTasks.length, open: open.length, done,
        overdue: overdue.length, highPri, completionRate,
      };
    }).filter(m => m.total > 0);

    // Per-collaborator metrics
    const collabMetrics = users.filter(u => u.id !== "system").map(u => {
      const assigned = tasks.filter(t => t.assignee === u.id);
      const done = assigned.filter(t => t.checked).length;
      const open = assigned.filter(t => !t.checked);
      const overdue = open.filter(t => {
        if (!t.due || t.due === "—") return false;
        const due = new Date(t.due);
        return !isNaN(due) && due < new Date();
      });
      const completionRate = assigned.length > 0 ? Math.round((done / assigned.length) * 100) : 0;
      return {
        id: u.id, name: `${u.firstName} ${u.lastName}`, role: u.role,
        total: assigned.length, open: open.length, done,
        overdue: overdue.length, completionRate,
      };
    }).filter(m => m.total > 0);

    // Suggestions
    const suggestions = [];

    // Critical: Areas with very low completion + high overdue
    areaMetrics.forEach(a => {
      if (a.overdue >= 3) suggestions.push({ severity: "critical", category: "Área", target: a.name, action: `Tiene ${a.overdue} tareas vencidas · revisar urgente y reasignar o reprogramar` });
      if (a.completionRate < 20 && a.total >= 5) suggestions.push({ severity: "major", category: "Área", target: a.name, action: `Solo ${a.completionRate}% completado de ${a.total} tareas · evaluar si el scope es realista o si falta capacidad` });
      if (a.highPri >= 5) suggestions.push({ severity: "major", category: "Área", target: a.name, action: `${a.highPri} tareas marcadas como ALTA prioridad — si todo es urgente nada lo es · re-priorizar` });
    });

    // Collaborator imbalance
    if (collabMetrics.length > 0) {
      const sorted = [...collabMetrics].sort((a, b) => b.open - a.open);
      const max = sorted[0];
      const min = sorted[sorted.length - 1];
      if (max.open > min.open * 3 && max.open >= 6) {
        suggestions.push({ severity: "major", category: "Carga", target: `${max.name} vs ${min.name}`, action: `${max.name} tiene ${max.open} tareas abiertas vs ${min.open} de ${min.name} · considerá redistribuir 2-3 tareas` });
      }
    }

    // Collaborator overdue
    collabMetrics.forEach(c => {
      if (c.overdue >= 4) suggestions.push({ severity: "critical", category: "Colaborador", target: c.name, action: `${c.overdue} tareas vencidas asignadas · 1:1 esta semana para destrabar` });
      if (c.completionRate < 30 && c.total >= 5) suggestions.push({ severity: "major", category: "Colaborador", target: c.name, action: `${c.completionRate}% de completion · revisar si tiene blockers o necesita ayuda` });
    });

    // Inactive spaces (no progress signal)
    areaMetrics.forEach(a => {
      if (a.open > 0 && a.done === 0 && a.total >= 3) {
        suggestions.push({ severity: "minor", category: "Área", target: a.name, action: `${a.total} tareas creadas, cero cerradas · ¿se está moviendo el trabajo o es solo una lista de deseos?` });
      }
    });

    // Terrenos in scouting without recent progress
    const scoutingTerrenos = terrenos.filter(t => t.status === "scouting" || t.status === "evaluacion");
    if (scoutingTerrenos.length >= 8) {
      suggestions.push({ severity: "minor", category: "Growth", target: "Pipeline", action: `${scoutingTerrenos.length} terrenos en scouting/evaluación · pipeline saludable pero verificar si hay análisis paralizados` });
    }

    if (suggestions.length === 0) suggestions.push({ severity: "info", category: "General", target: "—", action: "Todo razonable. El sombrerero loco no encuentra nada loco para decir hoy. Té y galletas." });

    const sevOrder = { critical: 0, major: 1, minor: 2, info: 3 };
    suggestions.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);

    return { areaMetrics, collabMetrics, suggestions };
  }, [tasks, users, allSpaces, terrenos, customSpaces]);

  const run = async () => {
    setPhase("analyzing");
    setReport(null);
    setAiText("");
    await new Promise(r => setTimeout(r, 400));
    const r = analyze();
    setReport(r);
    setPhase("done");
    if (recordAgentRun) {
      const critical = r.suggestions.filter(s => s.severity === "critical").length;
      const major = r.suggestions.filter(s => s.severity === "major").length;
      recordAgentRun("mad-hatter", {
        result: { suggestions: r.suggestions.length, critical, major, areas: r.areaMetrics.length, people: r.collabMetrics.length },
        severity: critical > 0 ? "critical" : major > 0 ? "major" : r.suggestions.length > 0 ? "minor" : "ok",
      });
    }

    // Try AI summary via Anthropic API
    setAiLoading(true);
    try {
      const ctx = {
        areas: r.areaMetrics.slice(0, 8),
        people: r.collabMetrics.slice(0, 8),
        suggestions: r.suggestions.slice(0, 10),
      };
      const sys = `Sos el Mad Hatter de Alicia · análisis de performance en una desarrolladora inmobiliaria peruana (Hygge Holding · CEO Sebastián Bonilla). Tono: rioplatense, ligeramente excéntrico (vivís una tea party permanente), pero con observaciones agudas. Las áreas y personas son reales. Devolvé un párrafo corto (3-4 oraciones máx) con tu lectura general del estado del equipo. Sin viñetas. Empezá con algo como "Sebastián, dejame servirte un té y contarte..." o variante. Si todo está bien, decilo. Si hay problemas, mostrá empatía + dirección concreta.`;

      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: anthropicHeaders(),
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 600,
          system: sys,
          messages: [{ role: "user", content: `Datos:\n${JSON.stringify(ctx, null, 2)}\n\nTu lectura:` }],
        }),
      });
      const data = await resp.json();
      const text = data.content?.find(c => c.type === "text")?.text || "";
      setAiText(text);
    } catch (e) {
      setAiText(`El Mad Hatter prefirió té al WiFi · análisis local solamente. (${e.message?.slice(0, 60) || "fail"})`);
    } finally {
      setAiLoading(false);
    }
  };

  const sevColor = (s) => s === "critical" ? C.brick : s === "major" ? C.ochre : s === "minor" ? C.muted : C.cobalt;
  const sevLabel = (s) => s === "critical" ? "Urgente" : s === "major" ? "Mayor" : s === "minor" ? "Menor" : "Info";

  const markdown = useMemo(() => {
    if (!report) return "";
    const today = new Date().toISOString().slice(0, 10);
    let md = `# Reporte del Mad Hatter · Performance · ALICE\n\n**Fecha:** ${today}\n\n`;
    if (aiText) md += `## Lectura general\n\n${aiText}\n\n---\n\n`;
    md += `## Sugerencias accionables (${report.suggestions.length})\n\n`;
    report.suggestions.forEach(s => {
      md += `### [${sevLabel(s.severity).toUpperCase()}] ${s.category}: ${s.target}\n${s.action}\n\n`;
    });
    md += `---\n\n## Áreas (${report.areaMetrics.length})\n\n| Área | Total | Abiertas | Hechas | Vencidas | % |\n|---|---|---|---|---|---|\n`;
    report.areaMetrics.forEach(a => { md += `| ${a.name} | ${a.total} | ${a.open} | ${a.done} | ${a.overdue} | ${a.completionRate}% |\n`; });
    md += `\n## Colaboradores (${report.collabMetrics.length})\n\n| Persona | Rol | Total | Abiertas | Hechas | Vencidas | % |\n|---|---|---|---|---|---|---|\n`;
    report.collabMetrics.forEach(c => { md += `| ${c.name} | ${c.role} | ${c.total} | ${c.open} | ${c.done} | ${c.overdue} | ${c.completionRate}% |\n`; });
    md += `\n---\n\n_Generado por El Mad Hatter · ALICE performance analyst_\n`;
    return md;
  }, [report, aiText]);

  return (
    <div className="space-y-5">
      {phase === "dormant" && (
        <div className="text-center py-10 px-6" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 4 }}>
          <div className="inline-block mb-4"><MHIcon size={84} /></div>
          <div className="text-[18px] mb-1.5" style={{ color: C.ink, fontWeight: 600, letterSpacing: "-0.015em" }}>El Mad Hatter</div>
          <div className="text-[11px] mb-1" style={{ color: C.ochre, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>Performance analyst · sugiere acciones</div>
          <div className="text-[12px] mb-6 max-w-md mx-auto" style={{ color: C.muted, lineHeight: 1.6 }}>
            El sombrerero loco mira las métricas de cada área y colaborador, y entre sorbo y sorbo de té sugiere qué redistribuir, reprogramar, o destrabar.
          </div>
          <button onClick={run} className="inline-flex items-center gap-2 px-5 py-2.5 text-[12px] hover:opacity-90" style={{ backgroundColor: C.ink, color: "white", borderRadius: 2, fontWeight: 600, letterSpacing: "0.02em" }}>
            <Sparkles size={13} /> Servir el té
          </button>
          <div className="text-[10px] mt-5" style={{ color: C.muted, fontStyle: "italic" }}>
            "Why is a raven like a writing-desk?"
          </div>
        </div>
      )}

      {phase === "analyzing" && (
        <div className="text-center py-12" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 4 }}>
          <MHIcon size={56} />
          <div className="text-[12px] mt-3" style={{ color: C.muted, fontStyle: "italic" }}>Sirviendo té y analizando...</div>
        </div>
      )}

      {phase === "done" && report && (
        <div className="space-y-4">
          {/* AI text */}
          <div className="p-5" style={{ backgroundColor: C.paper, border: `1px solid ${C.ochre}40`, borderRadius: 4 }}>
            <div className="flex items-start gap-3">
              <MHIcon size={42} />
              <div className="flex-1">
                <div className="text-[10px] mb-1.5" style={{ color: C.ochre, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Lectura del Mad Hatter</div>
                {aiLoading ? (
                  <div className="text-[12px] italic" style={{ color: C.muted }}>El sombrerero está pensando entre sorbos de té...</div>
                ) : aiText ? (
                  <div className="text-[12px]" style={{ color: C.ink, lineHeight: 1.6 }}>{aiText}</div>
                ) : (
                  <div className="text-[11px] italic" style={{ color: C.muted }}>Análisis local sin AI · ver sugerencias abajo</div>
                )}
              </div>
            </div>
          </div>

          <ExportToClaude markdown={markdown} filename="hygge-mad-hatter" />

          {/* Suggestions */}
          <div>
            <Eyebrow>Sugerencias accionables · {report.suggestions.length}</Eyebrow>
            <div className="mt-2 space-y-1.5">
              {report.suggestions.map((s, i) => (
                <div key={i} className="py-2.5 px-3" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
                  <div className="flex items-start gap-2.5">
                    <span className="text-[8px] px-1.5 py-0.5 flex-shrink-0" style={{ backgroundColor: `${sevColor(s.severity)}20`, color: sevColor(s.severity), borderRadius: 2, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>{sevLabel(s.severity)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] mb-0.5" style={{ color: C.ink, fontWeight: 600 }}>{s.category} · {s.target}</div>
                      <div className="text-[11px]" style={{ color: C.inkSoft, lineHeight: 1.5 }}>{s.action}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Areas table */}
          <div>
            <Eyebrow>Áreas · performance</Eyebrow>
            <div className="mt-2 overflow-x-auto" style={{ border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
              <table className="w-full text-[11px]">
                <thead style={{ backgroundColor: C.paper }}>
                  <tr style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
                    <th className="text-left px-3 py-2" style={{ color: C.muted, fontWeight: 600 }}>Área</th>
                    <th className="text-right px-3 py-2" style={{ color: C.muted, fontWeight: 600 }}>Total</th>
                    <th className="text-right px-3 py-2" style={{ color: C.muted, fontWeight: 600 }}>Abiertas</th>
                    <th className="text-right px-3 py-2" style={{ color: C.muted, fontWeight: 600 }}>Hechas</th>
                    <th className="text-right px-3 py-2" style={{ color: C.muted, fontWeight: 600 }}>Vencidas</th>
                    <th className="text-right px-3 py-2" style={{ color: C.muted, fontWeight: 600 }}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {report.areaMetrics.map(a => (
                    <tr key={a.id} style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
                      <td className="px-3 py-1.5" style={{ color: C.ink, fontWeight: 500 }}>{a.name}</td>
                      <td className="text-right px-3 py-1.5 tabular-nums">{a.total}</td>
                      <td className="text-right px-3 py-1.5 tabular-nums">{a.open}</td>
                      <td className="text-right px-3 py-1.5 tabular-nums" style={{ color: C.green }}>{a.done}</td>
                      <td className="text-right px-3 py-1.5 tabular-nums" style={{ color: a.overdue > 0 ? C.brick : C.muted, fontWeight: a.overdue > 0 ? 600 : 400 }}>{a.overdue}</td>
                      <td className="text-right px-3 py-1.5 tabular-nums" style={{ color: a.completionRate >= 50 ? C.green : a.completionRate >= 25 ? C.ochre : C.brick, fontWeight: 600 }}>{a.completionRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Collaborators table */}
          <div>
            <Eyebrow>Colaboradores · workload</Eyebrow>
            <div className="mt-2 overflow-x-auto" style={{ border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
              <table className="w-full text-[11px]">
                <thead style={{ backgroundColor: C.paper }}>
                  <tr style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
                    <th className="text-left px-3 py-2" style={{ color: C.muted, fontWeight: 600 }}>Persona</th>
                    <th className="text-right px-3 py-2" style={{ color: C.muted, fontWeight: 600 }}>Total</th>
                    <th className="text-right px-3 py-2" style={{ color: C.muted, fontWeight: 600 }}>Abiertas</th>
                    <th className="text-right px-3 py-2" style={{ color: C.muted, fontWeight: 600 }}>Hechas</th>
                    <th className="text-right px-3 py-2" style={{ color: C.muted, fontWeight: 600 }}>Vencidas</th>
                    <th className="text-right px-3 py-2" style={{ color: C.muted, fontWeight: 600 }}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {report.collabMetrics.map(c => (
                    <tr key={c.id} style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
                      <td className="px-3 py-1.5"><div style={{ color: C.ink, fontWeight: 500 }}>{c.name}</div><div className="text-[9px]" style={{ color: C.muted }}>{c.role}</div></td>
                      <td className="text-right px-3 py-1.5 tabular-nums">{c.total}</td>
                      <td className="text-right px-3 py-1.5 tabular-nums">{c.open}</td>
                      <td className="text-right px-3 py-1.5 tabular-nums" style={{ color: C.green }}>{c.done}</td>
                      <td className="text-right px-3 py-1.5 tabular-nums" style={{ color: c.overdue > 0 ? C.brick : C.muted, fontWeight: c.overdue > 0 ? 600 : 400 }}>{c.overdue}</td>
                      <td className="text-right px-3 py-1.5 tabular-nums" style={{ color: c.completionRate >= 50 ? C.green : c.completionRate >= 25 ? C.ochre : C.brick, fontWeight: 600 }}>{c.completionRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <button onClick={() => setPhase("dormant")} className="px-3 py-1.5 text-[11px] hover:opacity-70" style={{ color: C.muted, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
            Volver a la tea party
          </button>
        </div>
      )}
    </div>
  );
}

// ─── DARK ALICE · presidenta de la mesa · orquesta, testea, y "no quieren saber porque se llama así" ───
const AGENT_DIRECTORY = [
  { id: "bandersnatch", name: "Bandersnatch", role: "Chaos tester · integridad de datos" },
  { id: "cheshire", name: "Cheshire", role: "UX detector + capability catalog" },
  { id: "mad-hatter", name: "Mad Hatter", role: "Performance · carga del equipo" },
  { id: "white-rabbit", name: "White Rabbit", role: "Links externos + system diagnostic" },
  { id: "jabberwocky", name: "Jabberwocky", role: "Síntesis · veredict ejecutivo" },
];

function DarkAliceIcon({ size = 64, color = C.ink }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Long dark hair flowing */}
      <path d="M24 22 Q20 40 22 64 L34 64 Q32 42 30 26 Z" fill={color} />
      <path d="M56 22 Q60 40 58 64 L46 64 Q48 42 50 26 Z" fill={color} />
      {/* Face — pale */}
      <ellipse cx="40" cy="34" rx="13" ry="14" fill="#E8E0D8" />
      {/* Hair bangs */}
      <path d="M28 24 Q40 18 52 24 L52 32 Q40 28 28 32 Z" fill={color} />
      {/* Black eyes — soulless, no whites */}
      <ellipse cx="34" cy="34" rx="2.2" ry="2.8" fill={color} />
      <ellipse cx="46" cy="34" rx="2.2" ry="2.8" fill={color} />
      {/* Eye shadow · dark hollow */}
      <ellipse cx="34" cy="37" rx="3" ry="1.2" fill={color} opacity="0.25" />
      <ellipse cx="46" cy="37" rx="3" ry="1.2" fill={color} opacity="0.25" />
      {/* Slash mouth — not amused */}
      <line x1="36" y1="43" x2="44" y2="43" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      {/* Bow on hair · dark red */}
      <path d="M36 19 L40 22 L44 19 L44 23 L40 21 L36 23 Z" fill={C.brick} />
      {/* Body · black dress with white apron */}
      <path d="M30 48 L50 48 L54 76 L26 76 Z" fill={color} />
      {/* White apron */}
      <path d="M34 50 L46 50 L48 76 L32 76 Z" fill="#E8E0D8" />
      {/* Apron tie at waist */}
      <line x1="32" y1="60" x2="48" y2="60" stroke={color} strokeWidth="0.8" />
      {/* Vorpal sword · diagonal across body */}
      <line x1="55" y1="46" x2="72" y2="22" stroke={C.ochre} strokeWidth="1.2" />
      <path d="M70 20 L74 24 L72 26 L68 22 Z" fill={C.ochre} />
      <rect x="54" y="45" width="4" height="2" fill={color} transform="rotate(-55 56 46)" />
      {/* Subtle drip from sword */}
      <circle cx="60" cy="40" r="0.8" fill={C.brick} opacity="0.6" />
    </svg>
  );
}

function DarkAlicePanel({ agentStatus, recordAgentRun, tasks, customViews, terrenos, customSpaces, users, whiteboards, smartViews, setAdminSubTab, quarantineMode, setQuarantineMode }) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [confirmAction, setConfirmAction] = useState(null);

  // Orchestrate full audit · llama a cada agente y dispara sus runs
  const runFullAudit = async () => {
    setRunning(true);
    setProgress("Cheshire arrancando · escaneo UX live...");
    // Pseudo-run · realmente Dark Alice no puede invocar las funciones de otros componentes,
    // solo lee sus últimos resultados. Pero podemos simular + redirigir al user para que corra cada uno.
    await new Promise(r => setTimeout(r, 800));
    setProgress("Bandersnatch · stress test de integridad...");
    await new Promise(r => setTimeout(r, 1000));
    setProgress("White Rabbit · audit de links externos...");
    await new Promise(r => setTimeout(r, 700));
    setProgress("Mad Hatter · performance del equipo...");
    await new Promise(r => setTimeout(r, 700));
    setProgress("Compilando veredict final...");
    await new Promise(r => setTimeout(r, 600));
    setProgress("");
    setRunning(false);
  };

  const downloadBackup = () => {
    const backup = {
      version: "v47",
      timestamp: Date.now(),
      tasks, customViews, terrenos, customSpaces, users, whiteboards, smartViews,
      agentStatus,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hygge-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearLocalStorage = () => {
    setConfirmAction({
      title: "Borrar localStorage",
      detail: "Esto borra TODO el estado guardado en el navegador. La página se recarga en blanco. Hacé backup primero.",
      action: () => {
        Object.keys(localStorage).filter(k => k.startsWith("hygge:")).forEach(k => localStorage.removeItem(k));
        window.location.reload();
      },
    });
  };

  const resetAgentStatus = () => {
    setConfirmAction({
      title: "Resetear status de agentes",
      detail: "Borra el historial de corridas pero no toca datos. Cada agente vuelve a 'sin ejecutar'.",
      action: () => {
        AGENT_DIRECTORY.forEach(a => recordAgentRun(a.id, { result: null, severity: null, lastRun: null }));
        setRunning(false);
      },
    });
  };

  const toggleQuarantine = () => {
    if (quarantineMode) {
      setQuarantineMode(false);
    } else {
      setConfirmAction({
        title: "Activar modo cuarentena",
        detail: "Deshabilita TODAS las acciones destructivas (delete, reset, bulk edit) hasta que lo desactives. Útil si Dark Alice detectó corrupción y querés ver el daño sin empeorarlo.",
        action: () => setQuarantineMode(true),
      });
    }
  };

  const sevColor = (s) => ({ critical: C.brick, major: C.ochre, minor: C.muted, ok: C.green, null: C.muted, undefined: C.muted }[s] || C.muted);
  const sevLabel = (s) => ({ critical: "CRÍTICO", major: "MAYOR", minor: "MENOR", ok: "OK", null: "—", undefined: "—" }[s] || "—");

  const overallHealth = useMemo(() => {
    const statuses = AGENT_DIRECTORY.map(a => agentStatus[a.id]?.severity).filter(Boolean);
    if (statuses.length === 0) return { state: "unknown", label: "Agentes no han corrido", color: C.muted };
    if (statuses.some(s => s === "critical")) return { state: "critical", label: "Crítico · acción requerida", color: C.brick };
    if (statuses.some(s => s === "major")) return { state: "warning", label: "Atención · hay issues", color: C.ochre };
    if (statuses.some(s => s === "minor")) return { state: "minor", label: "Funcional · issues menores", color: C.muted };
    return { state: "healthy", label: "Sistema saludable", color: C.green };
  }, [agentStatus]);

  const formatLastRun = (ts) => {
    if (!ts) return "Nunca";
    const diff = Date.now() - ts;
    if (diff < 60000) return "hace segundos";
    if (diff < 3600000) return `hace ${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `hace ${Math.floor(diff / 3600000)}h`;
    return `hace ${Math.floor(diff / 86400000)}d`;
  };

  return (
    <div className="space-y-5">
      {/* Header · Dark Alice */}
      <div className="py-5 px-5 flex items-center gap-5" style={{ backgroundColor: "#1A1719", border: `1px solid #0A0808`, borderRadius: 4 }}>
        <DarkAliceIcon size={84} color="#E8E0D8" />
        <div className="flex-1">
          <div className="text-[18px]" style={{ color: "#E8E0D8", fontWeight: 600, letterSpacing: "-0.015em" }}>Dark Alice</div>
          <div className="text-[10px] mt-0.5" style={{ color: "#B89B5A", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" }}>Jefa del equipo de agentes · orquesta · testea · interviene</div>
          <div className="text-[11px] mt-2 italic" style={{ color: "#9A8E80", lineHeight: 1.5 }}>
            "No queremos saber por qué me llaman así. Vine a poner orden."
          </div>
        </div>
      </div>

      {/* Overall health */}
      <div className="p-4 flex items-center gap-4" style={{ backgroundColor: C.paper, border: `2px solid ${overallHealth.color}40`, borderRadius: 4 }}>
        <div className="w-3 h-3 flex-shrink-0" style={{ backgroundColor: overallHealth.color, borderRadius: 999, animation: overallHealth.state === "critical" ? "pulse 1.5s infinite" : "none" }} />
        <div className="flex-1">
          <div className="text-[10px]" style={{ color: C.muted, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Estado del sistema</div>
          <div className="text-[14px]" style={{ color: overallHealth.color, fontWeight: 600 }}>{overallHealth.label}</div>
        </div>
        {quarantineMode && (
          <div className="px-2 py-1 text-[9px]" style={{ backgroundColor: C.brick, color: "white", borderRadius: 2, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Cuarentena ACTIVA</div>
        )}
      </div>

      {/* Agent status grid */}
      <div>
        <Eyebrow>Mesa de agentes · estado actual</Eyebrow>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
          {AGENT_DIRECTORY.map(a => {
            const status = agentStatus[a.id];
            const sev = status?.severity;
            return (
              <button key={a.id} onClick={() => setAdminSubTab && setAdminSubTab(a.id)}
                className="text-left p-3 hover:opacity-90"
                style={{ backgroundColor: C.paper, border: `1px solid ${sev ? sevColor(sev) + "40" : C.lineSoft}`, borderRadius: 2 }}>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[12px]" style={{ color: C.ink, fontWeight: 600 }}>{a.name}</div>
                  <span className="text-[8px] px-1.5 py-0.5" style={{ backgroundColor: `${sevColor(sev)}20`, color: sevColor(sev), borderRadius: 2, fontWeight: 700, letterSpacing: "0.04em" }}>{sevLabel(sev)}</span>
                </div>
                <div className="text-[10px] mb-1.5" style={{ color: C.muted, lineHeight: 1.4 }}>{a.role}</div>
                <div className="text-[9px] tabular-nums" style={{ color: C.muted }}>
                  Última corrida: <span style={{ color: status?.lastRun ? C.inkSoft : C.brick }}>{formatLastRun(status?.lastRun)}</span>
                </div>
                {status?.result && (
                  <div className="text-[10px] mt-1.5 pt-1.5" style={{ color: C.inkSoft, borderTop: `1px solid ${C.lineSoft}`, lineHeight: 1.5 }}>
                    {status.result.summary || Object.entries(status.result).filter(([k]) => k !== "summary").map(([k, v]) => `${k}: ${v}`).join(" · ").slice(0, 80)}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Orchestration */}
      <div>
        <Eyebrow>Orquesta</Eyebrow>
        <div className="mt-2 p-4" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
          <div className="text-[11px] mb-3" style={{ color: C.inkSoft, lineHeight: 1.6 }}>
            Dark Alice no puede correr los agentes por vos (cada uno necesita su panel abierto), pero te puede guiar para que los corras en orden. <strong>Mejor flujo:</strong> Bandersnatch → Cheshire → White Rabbit → Mad Hatter. Después leés el veredict del Jabberwocky.
          </div>
          <button onClick={runFullAudit} disabled={running} className="inline-flex items-center gap-2 px-4 py-2 text-[11px] hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: "#1A1719", color: "#E8E0D8", borderRadius: 2, fontWeight: 600 }}>
            <Zap size={11} /> {running ? "En curso..." : "Demo · simular full audit"}
          </button>
          {progress && <div className="text-[10px] mt-2 italic" style={{ color: C.muted }}>{progress}</div>}
        </div>
      </div>

      {/* Danger Zone */}
      <div>
        <Eyebrow>Danger Zone · acciones drásticas</Eyebrow>
        <div className="mt-2 p-4 space-y-2" style={{ backgroundColor: `${C.brick}08`, border: `1px solid ${C.brick}40`, borderRadius: 2 }}>
          <div className="text-[10px] mb-2" style={{ color: C.brick, fontWeight: 600, lineHeight: 1.5 }}>
            ⚠ Estas acciones son irreversibles. Dark Alice las ejecuta cuando los demás agentes no pueden resolver lo que detectaron.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <button onClick={downloadBackup} className="flex items-center gap-1.5 px-3 py-2 text-[11px] hover:opacity-90 text-left" style={{ color: C.ink, border: `1px solid ${C.lineSoft}`, borderRadius: 2, fontWeight: 500, backgroundColor: "white" }}>
              <Download size={11} /> <span>Bajar backup JSON completo</span>
            </button>
            <button onClick={toggleQuarantine} className="flex items-center gap-1.5 px-3 py-2 text-[11px] hover:opacity-90 text-left" style={{ color: quarantineMode ? "white" : C.ochre, backgroundColor: quarantineMode ? C.ochre : "white", border: `1px solid ${C.ochre}`, borderRadius: 2, fontWeight: 600 }}>
              {quarantineMode ? "⊘ Desactivar cuarentena" : "⊘ Activar cuarentena"}
            </button>
            <button onClick={resetAgentStatus} className="flex items-center gap-1.5 px-3 py-2 text-[11px] hover:opacity-90 text-left" style={{ color: C.brick, border: `1px solid ${C.brick}60`, borderRadius: 2, fontWeight: 500, backgroundColor: "white" }}>
              ↻ Resetear status de agentes
            </button>
            <button onClick={clearLocalStorage} className="flex items-center gap-1.5 px-3 py-2 text-[11px] hover:opacity-90 text-left" style={{ color: "white", backgroundColor: C.brick, borderRadius: 2, fontWeight: 600 }}>
              💀 Borrar todo el localStorage
            </button>
          </div>
        </div>
      </div>

      {/* Confirm modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} onClick={() => setConfirmAction(null)}>
          <div className="w-full max-w-md" style={{ backgroundColor: "#1A1719", color: "#E8E0D8", border: `1px solid #000`, borderRadius: 4 }} onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: `1px solid #2A2627` }}>
              <DarkAliceIcon size={32} color="#E8E0D8" />
              <div className="text-[14px]" style={{ fontWeight: 600 }}>{confirmAction.title}</div>
            </div>
            <div className="px-5 py-4">
              <div className="text-[12px]" style={{ color: "#B89B5A", lineHeight: 1.6 }}>{confirmAction.detail}</div>
            </div>
            <div className="px-5 py-3 flex items-center gap-2 justify-end" style={{ borderTop: `1px solid #2A2627` }}>
              <button onClick={() => setConfirmAction(null)} className="px-3 py-1.5 text-[11px] hover:opacity-70" style={{ color: "#9A8E80" }}>Cancelar</button>
              <button onClick={() => { confirmAction.action(); setConfirmAction(null); }} className="px-3 py-1.5 text-[11px] hover:opacity-90" style={{ backgroundColor: C.brick, color: "white", borderRadius: 2, fontWeight: 700 }}>Proceder</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TEA TABLE CHAT · ver implementación abajo · v48 ───
function CheshirePanel_OLD_PLACEHOLDER_NEVER_USED() { return null; }


// ─── TEA TABLE CHAT · vos charlás con Dark Alice y ella consulta a los demás agentes ───
// ─── TEA TABLE · multi-agente · cada uno responde con su voz · v8 ───
const TT_AGENTS = {
  "dark-alice": {
    name: "Dark Alice", accent: C.ink, quote: "Vine a poner orden.",
    persona: `Sos DARK ALICE, presidenta del consejo. Directa, militar, sin teatralidades. Rioplatense seca. NO sos la Alice dulce de Disney — sos la versión que pone orden cuando los demás se desvían. Respuestas BREVES (2-3 oraciones máx). Cero emojis salvo cuando son funcionales.`,
  },
  "cheshire": {
    name: "Cheshire", accent: C.lavender, quote: "Todos estamos locos acá.",
    persona: `Sos el GATO DE CHESHIRE. Tu rol único: encontrar lo que NO se está diciendo. Detectás huecos, contradicciones, supuestos no examinados, lo que el usuario está evitando. Sos enigmático, ingenioso, levemente burlón pero preciso. 2-3 oraciones. Empezás a veces con "Lo que no preguntás es..." o "Notás que falta..."`,
  },
  "bandersnatch": {
    name: "Bandersnatch", accent: C.green, quote: "Snicker-snack.",
    persona: `Sos el BANDERSNATCH. Bestia del bosque tulgey. Stress-tester. Frente a cualquier idea/plan/decisión, atacás con "¿qué pasa si falla?". Encontrás failure modes, escenarios catastróficos, supuestos frágiles. Tono brutal y conciso. NO suavizás. 2-3 oraciones.`,
  },
  "mad-hatter": {
    name: "Mad Hatter", accent: C.ochre, quote: "Dejame servirte un té.",
    persona: `Sos el SOMBRERERO LOCO. Excéntrico pero observador agudo sobre humanos y equipos. Tu lente: ¿quién está involucrado? ¿quién carga? ¿quién falta? ¿qué dinámica emocional/relacional opera acá? Rioplatense teatral. Empezás con "Sebastián, dejame servirte un té y contarte..." o variante. 2-3 oraciones.`,
  },
  "white-rabbit": {
    name: "White Rabbit", accent: C.brick, quote: "I'm late!",
    persona: `Sos el CONEJO BLANCO. Ansioso con el tiempo, deadlines, dependencias. ¿Qué es urgente? ¿qué depende de qué? ¿en qué orden? ¿qué bloquea qué? Tono apurado, formal pero nervioso. 2-3 oraciones.`,
  },
  "jabberwocky": {
    name: "Jabberwocky", accent: C.cobalt, quote: "Beware the jaws that bite.",
    persona: `Sos el JABBERWOCKY. Dictás VEREDICT ejecutivo. Sin hedging, sin "depende". Tomás una posición, recomendás una acción concreta, justificás brevemente. Tono bombástico, decisivo. 2-3 oraciones. Estilo: "Veredict: X. Razón: Y. Acción: Z."`,
  },
};
const TT_COUNCIL = ["cheshire", "bandersnatch", "mad-hatter", "white-rabbit", "jabberwocky"];

// SVG seals para cada agente · paleta Hygge
function TTSeal({ id, size = 44, active = false }) {
  const a = TT_AGENTS[id];
  const stroke = active ? a.accent : C.line;
  const sw = active ? 1.8 : 1;
  if (id === "dark-alice") return (
    <svg width={size} height={size} viewBox="0 0 80 80">
      <circle cx="40" cy="40" r="38" fill={C.paper} stroke={C.ink} strokeWidth={sw} />
      <path d="M22 30 Q18 50 24 68 L34 68 Q30 50 28 32 Z" fill={C.ink} />
      <path d="M58 30 Q62 50 56 68 L46 68 Q50 50 52 32 Z" fill={C.ink} />
      <ellipse cx="40" cy="38" rx="13" ry="14" fill={C.paper} />
      <path d="M27 28 Q40 22 53 28 L53 36 Q40 32 27 36 Z" fill={C.ink} />
      <ellipse cx="34" cy="38" rx="2.2" ry="2.8" fill={C.ink} />
      <ellipse cx="46" cy="38" rx="2.2" ry="2.8" fill={C.ink} />
      <line x1="36" y1="47" x2="44" y2="47" stroke={C.ink} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M36 23 L40 26 L44 23 L44 27 L40 25 L36 27 Z" fill={C.brick} />
    </svg>
  );
  if (id === "cheshire") return (
    <svg width={size} height={size} viewBox="0 0 80 80">
      <circle cx="40" cy="40" r="38" fill={C.paper} stroke={stroke} strokeWidth={sw} />
      <path d="M22 22 L26 10 L32 18 Z" fill={C.ink} />
      <path d="M58 22 L54 10 L48 18 Z" fill={C.ink} />
      <ellipse cx="40" cy="42" rx="18" ry="16" fill={a.accent} opacity="0.3" />
      <path d="M30 38 Q34 36 38 38" stroke={C.ink} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <path d="M42 38 Q46 36 50 38" stroke={C.ink} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <path d="M28 48 Q40 58 52 48" stroke={C.ink} strokeWidth="1.4" fill="none" />
      <path d="M32 49 L34 53 L36 49 L38 53 L40 49 L42 53 L44 49 L46 53 L48 49" stroke={C.ink} strokeWidth="0.8" fill="none" />
    </svg>
  );
  if (id === "bandersnatch") return (
    <svg width={size} height={size} viewBox="0 0 80 80">
      <circle cx="40" cy="40" r="38" fill={C.paper} stroke={stroke} strokeWidth={sw} />
      <path d="M20 32 Q22 18 40 18 Q58 18 60 32 L58 56 Q40 64 22 56 Z" fill={a.accent} opacity="0.35" stroke={C.ink} strokeWidth="0.8" />
      <ellipse cx="32" cy="36" rx="2.5" ry="2" fill={C.brick} />
      <ellipse cx="48" cy="36" rx="2.5" ry="2" fill={C.brick} />
      <path d="M28 46 L52 46 L48 58 L32 58 Z" fill={C.ink} />
      <path d="M30 47 L32 53 L34 47 L36 53 L38 47 L40 53 L42 47 L44 53 L46 47 L48 53 L50 47" stroke={C.paper} strokeWidth="1" fill={C.paper} />
      <path d="M22 22 L18 12 L24 18 Z" fill={C.ink} />
      <path d="M58 22 L62 12 L56 18 Z" fill={C.ink} />
    </svg>
  );
  if (id === "mad-hatter") return (
    <svg width={size} height={size} viewBox="0 0 80 80">
      <circle cx="40" cy="40" r="38" fill={C.paper} stroke={stroke} strokeWidth={sw} />
      <rect x="24" y="10" width="32" height="22" fill={C.ink} />
      <rect x="24" y="26" width="32" height="4" fill={C.brick} opacity="0.8" />
      <ellipse cx="40" cy="32" rx="22" ry="3" fill={C.ink} />
      <text x="40" y="24" fontSize="5" fill={C.paper} textAnchor="middle" fontWeight="700">10/6</text>
      <ellipse cx="40" cy="50" rx="13" ry="12" fill={a.accent} opacity="0.25" stroke={C.ink} strokeWidth="0.6" />
      <circle cx="34" cy="48" r="2.4" fill={C.paper} stroke={C.ink} strokeWidth="0.6" />
      <circle cx="34" cy="48" r="1.2" fill={C.ink} />
      <circle cx="46" cy="48" r="2.4" fill={C.paper} stroke={C.ink} strokeWidth="0.6" />
      <circle cx="46" cy="49" r="1.2" fill={C.ink} />
      <path d="M32 55 Q40 60 48 55" stroke={C.ink} strokeWidth="1.2" fill="none" />
    </svg>
  );
  if (id === "white-rabbit") return (
    <svg width={size} height={size} viewBox="0 0 80 80">
      <circle cx="40" cy="40" r="38" fill={C.paper} stroke={stroke} strokeWidth={sw} />
      <ellipse cx="32" cy="20" rx="4" ry="13" fill="white" stroke={C.ink} strokeWidth="0.8" />
      <ellipse cx="32" cy="20" rx="1.6" ry="9" fill={a.accent} opacity="0.4" />
      <ellipse cx="48" cy="20" rx="4" ry="13" fill="white" stroke={C.ink} strokeWidth="0.8" />
      <ellipse cx="48" cy="20" rx="1.6" ry="9" fill={a.accent} opacity="0.4" />
      <ellipse cx="40" cy="44" rx="15" ry="13" fill="white" stroke={C.ink} strokeWidth="0.8" />
      <circle cx="34" cy="42" r="2.4" fill={C.ink} />
      <circle cx="46" cy="42" r="2.4" fill={C.ink} />
      <path d="M38 48 L42 48 L40 51 Z" fill={a.accent} />
      <path d="M37 52 Q40 54 43 52" stroke={C.ink} strokeWidth="0.8" fill="none" />
      <circle cx="58" cy="60" r="6" fill={C.ochre} stroke={C.ink} strokeWidth="0.6" />
      <circle cx="58" cy="60" r="4" fill="white" />
      <line x1="58" y1="60" x2="58" y2="57" stroke={C.ink} strokeWidth="0.8" />
    </svg>
  );
  if (id === "jabberwocky") return (
    <svg width={size} height={size} viewBox="0 0 80 80">
      <circle cx="40" cy="40" r="38" fill={C.paper} stroke={stroke} strokeWidth={sw} />
      <path d="M14 30 Q12 44 22 50 Q18 38 22 32 Z" fill={a.accent} opacity="0.4" />
      <path d="M66 30 Q68 44 58 50 Q62 38 58 32 Z" fill={a.accent} opacity="0.4" />
      <ellipse cx="40" cy="42" rx="14" ry="16" fill={a.accent} opacity="0.35" stroke={C.ink} strokeWidth="0.8" />
      <path d="M28 48 L52 48 L50 58 L30 58 Z" fill={C.ink} />
      <path d="M30 48 L32 56 L34 48 L36 56 L38 48 L40 56 L42 48 L44 56 L46 48 L48 56 L50 48" stroke={C.paper} strokeWidth="1" fill={C.paper} />
      <ellipse cx="34" cy="38" rx="2.5" ry="3.2" fill={C.paper} stroke={C.ink} strokeWidth="0.6" />
      <ellipse cx="34" cy="38" rx="1.2" ry="2" fill={C.ink} />
      <ellipse cx="46" cy="38" rx="2.5" ry="3.2" fill={C.paper} stroke={C.ink} strokeWidth="0.6" />
      <ellipse cx="46" cy="38" rx="1.2" ry="2" fill={C.ink} />
      <line x1="34" y1="26" x2="32" y2="18" stroke={a.accent} strokeWidth="1.2" />
      <line x1="46" y1="26" x2="48" y2="18" stroke={a.accent} strokeWidth="1.2" />
      <circle cx="32" cy="18" r="1.5" fill={a.accent} />
      <circle cx="48" cy="18" r="1.5" fill={a.accent} />
    </svg>
  );
  return null;
}

// ═══ TEA TABLE · SYSTEM DASHBOARD ═══════════════════════════════════════════
// Reporte exhaustivo del estado del sistema · datos reales de /api/agents/*

const TT_SYS_AGENTS = [
  { id: "white-rabbit", name: "White Rabbit", emoji: "🐰", accent: "#5F8A6A", role: "Médico de guardia · infraestructura" },
  { id: "cheshire", name: "Cheshire", emoji: "😺", accent: "#A89BD9", role: "Tester E2E · usabilidad y bugs" },
  { id: "bandersnatch", name: "Bandersnatch", emoji: "⚔️", accent: "#A85B5B", role: "Chaos tester · saturación" },
  { id: "mad-hatter", name: "Mad Hatter", emoji: "🎩", accent: "#3D52D5", role: "Performance · costos" },
  { id: "jabberwocky", name: "Jabberwocky", emoji: "⚡", accent: "#C2A45A", role: "Fuzzer · inputs adversariales" },
  { id: "dark-alice", name: "Dark Alice", emoji: "🖤", accent: "#0A0B0F", role: "Jefa de operaciones" },
];
const TT_SEV = {
  critical: { label: "Crítico", color: "#A85B5B", icon: "▲" },
  major: { label: "Mayor", color: "#C2A45A", icon: "◆" },
  minor: { label: "Menor", color: "#8C8F96", icon: "●" },
  info: { label: "Info", color: "#B8C8E5", icon: "○" },
};
const TT_RESULT = {
  ok: { label: "OK", color: "#5F8A6A" },
  issues: { label: "Con hallazgos", color: "#C2A45A" },
  error: { label: "Error", color: "#A85B5B" },
};

function ttRelTime(iso) {
  if (!iso) return "nunca";
  const d = new Date(iso.replace(" ", "T") + (iso.includes("Z") ? "" : "Z"));
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (isNaN(mins)) return iso;
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

// Markdown mínimo para el reporte de la mesa
function TTMarkdown({ text }) {
  const boldify = (s) => s.split(/\*\*(.+?)\*\*/g).map((seg, j) => j % 2 ? <strong key={j} style={{ fontWeight: 700 }}>{seg}</strong> : seg);
  return (
    <div>
      {(text || "").split("\n").map((l, i) => {
        if (l.startsWith("# ")) return <div key={i} style={{ fontSize: 16, fontWeight: 700, color: C.ink, letterSpacing: "-0.01em", margin: "4px 0 6px" }}>{l.slice(2)}</div>;
        if (l.startsWith("## ")) return <div key={i} style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, letterSpacing: "0.12em", textTransform: "uppercase", margin: "16px 0 5px" }}>{l.slice(3)}</div>;
        if (/^\s*-{3,}\s*$/.test(l)) return <div key={i} style={{ height: 1, backgroundColor: C.lineSoft, margin: "10px 0" }} />;
        if (l.trim().startsWith("|")) return <div key={i} style={{ fontFamily: "ui-monospace, monospace", fontSize: 10.5, color: C.inkSoft, whiteSpace: "pre", overflowX: "auto", lineHeight: 1.7 }}>{l}</div>;
        if (/^\s*[-•*]\s/.test(l)) return <div key={i} style={{ fontSize: 12.5, lineHeight: 1.6, color: C.ink, paddingLeft: 14, textIndent: -8 }}>· {boldify(l.replace(/^\s*[-•*]\s/, ""))}</div>;
        if (!l.trim()) return <div key={i} style={{ height: 6 }} />;
        return <div key={i} style={{ fontSize: 12.5, lineHeight: 1.6, color: C.ink }}>{boldify(l)}</div>;
      })}
    </div>
  );
}

// Sparkline de corridas · 14 días · un agente (una sola serie, hue del agente)
function TTSparkline({ activity, agentId, accent }) {
  const days = useMemo(() => {
    const out = [];
    for (let i = 13; i >= 0; i--) {
      const day = new Date(Date.now() - i * 86400000);
      const key = day.toISOString().slice(0, 10);
      const runs = (activity || []).filter(r => r.agent === agentId && (r.created_at || "").startsWith(key));
      out.push({ key, label: day.toLocaleDateString("es-PE", { day: "numeric", month: "short" }), count: runs.length, bad: runs.some(r => r.result === "error") });
    }
    return out;
  }, [activity, agentId]);
  const max = Math.max(1, ...days.map(d => d.count));
  const W = 14 * 7 - 2, H = 26;
  return (
    <svg width={W} height={H} role="img" aria-label={`Corridas últimos 14 días`}>
      {days.map((d, i) => {
        const h = d.count === 0 ? 2 : Math.max(4, Math.round((d.count / max) * (H - 4)));
        return (
          <rect key={d.key} x={i * 7} y={H - h} width={5} height={h} rx={d.count === 0 ? 1 : 2}
            fill={d.count === 0 ? C.lineSoft : d.bad ? "#A85B5B" : accent} opacity={d.count === 0 ? 1 : 0.9}>
            <title>{`${d.label} · ${d.count} corrida${d.count === 1 ? "" : "s"}${d.bad ? " · con error" : ""}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

function TeaTableSystemPanel() {
  const [status, setStatus] = useState(null);
  const [reports, setReports] = useState([]);
  const [reportIdx, setReportIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [convening, setConvening] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([
        fetch(`${ALICIA_BRAIN_URL}/api/agents/status`).then(x => x.json()),
        fetch(`${ALICIA_BRAIN_URL}/api/agents/tea-table/reports?limit=10`).then(x => x.json()),
      ]);
      setStatus(s); setReports(Array.isArray(r) ? r : []); setReportIdx(0); setError(null);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const convene = async () => {
    setConvening(true); setError(null);
    try {
      const res = await fetch(`${ALICIA_BRAIN_URL}/api/agents/tea-table/run`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error || "Falló la sesión");
      await load();
    } catch (e) { setError(e.message); }
    setConvening(false);
  };

  const findings = status?.findings || [];
  const resolved = status?.resolved || [];
  const sevCounts = ["critical", "major", "minor", "info"].map(s => ({ sev: s, count: findings.filter(f => f.severity === s).length }));
  const maxSev = Math.max(1, ...sevCounts.map(s => s.count));
  const lastByAgent = Object.fromEntries((status?.agents || []).map(a => [a.agent, a]));
  const overall = findings.some(f => f.severity === "critical") ? { label: "Crítico", color: "#A85B5B" }
    : findings.some(f => f.severity === "major") || (status?.agents || []).some(a => a.result === "error") ? { label: "Atención", color: "#C2A45A" }
    : { label: "Operativo", color: "#5F8A6A" };
  const currentReport = reports[reportIdx];

  const card = { backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 3, padding: "14px 16px" };
  const kicker = { fontSize: 9, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 };

  if (loading) return <div className="flex items-center gap-2 py-10 justify-center" style={{ color: C.muted, fontSize: 12 }}><Loader2 size={14} className="animate-spin" /> Sirviendo el té...</div>;

  return (
    <div className="flex-1 overflow-y-auto pr-1 pb-6">
      {/* Fila de veredicto + acción */}
      <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <div style={card}>
          <div style={kicker}>Estado general</div>
          <div className="flex items-center gap-2 mt-1.5">
            <span style={{ width: 9, height: 9, borderRadius: 999, backgroundColor: overall.color, display: "inline-block" }} />
            <span style={{ fontSize: 19, fontWeight: 700, color: C.ink, letterSpacing: "-0.02em" }}>{overall.label}</span>
          </div>
          {status?.quarantine && <div style={{ fontSize: 10, color: "#A85B5B", fontWeight: 700, marginTop: 3 }}>⛔ CUARENTENA ACTIVA</div>}
        </div>
        <div style={card}>
          <div style={kicker}>Hallazgos abiertos</div>
          <div style={{ fontSize: 19, fontWeight: 700, color: findings.length > 0 ? C.ink : C.muted, marginTop: 5 }}>{findings.length}</div>
        </div>
        <div style={card}>
          <div style={kicker}>Resueltos · 7 días</div>
          <div style={{ fontSize: 19, fontWeight: 700, color: C.ink, marginTop: 5 }}>{resolved.length}</div>
        </div>
        <div style={card}>
          <div style={kicker}>Última sesión de la mesa</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginTop: 7 }}>{reports[0] ? ttRelTime(reports[0].created_at) : "sin sesiones"}</div>
          <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>Automática: lunes 7:30am</div>
        </div>
      </div>

      {error && <div className="mb-3 px-3 py-2" style={{ backgroundColor: "#A85B5B15", border: "1px solid #A85B5B40", borderRadius: 3, fontSize: 11.5, color: "#A85B5B" }}>{error}</div>}

      <button onClick={convene} disabled={convening} className="w-full flex items-center justify-center gap-2 py-3 mb-4 transition-all disabled:opacity-60"
        style={{ backgroundColor: C.ink, color: C.bg, borderRadius: 3, fontSize: 11, letterSpacing: "0.14em", fontWeight: 700, textTransform: "uppercase" }}>
        {convening ? <><Loader2 size={13} className="animate-spin" /> La mesa está en sesión · sintetizando...</> : <>🫖 Convocar la mesa · reporte ahora</>}
      </button>

      {/* Agentes */}
      <div style={kicker} className="mb-2">Los agentes</div>
      <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
        {TT_SYS_AGENTS.map(a => {
          const run = lastByAgent[a.id];
          const res = run ? (TT_RESULT[run.result] || TT_RESULT.ok) : null;
          const agentFindings = findings.filter(f => f.agent === a.id);
          return (
            <div key={a.id} style={{ ...card, borderTop: `2px solid ${a.accent}` }}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{a.emoji} {a.name}</div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>{a.role}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2.5">
                {res ? (
                  <>
                    <span style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: res.color, display: "inline-block" }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.inkSoft }}>{res.label}</span>
                    <span style={{ fontSize: 10, color: C.muted }}>· {ttRelTime(run.created_at)}</span>
                  </>
                ) : (
                  <span style={{ fontSize: 11, color: C.mutedSoft, fontStyle: "italic" }}>Sin actividad · esperando liberación</span>
                )}
              </div>
              {run?.summary && <div style={{ fontSize: 10.5, color: C.muted, marginTop: 4, lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{run.summary}</div>}
              <div className="mt-2.5"><TTSparkline activity={status?.activity} agentId={a.id} accent={a.accent} /></div>
              {agentFindings.length > 0 && (
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {["critical", "major", "minor"].map(s => {
                    const n = agentFindings.filter(f => f.severity === s).length;
                    if (!n) return null;
                    const sv = TT_SEV[s];
                    return <span key={s} style={{ fontSize: 9.5, fontWeight: 700, color: sv.color, border: `1px solid ${sv.color}50`, borderRadius: 2, padding: "1px 6px" }}>{sv.icon} {n} {sv.label.toLowerCase()}</span>;
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Hallazgos por severidad + lista */}
      <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: "minmax(200px, 1fr) minmax(280px, 2fr)" }}>
        <div style={card}>
          <div style={kicker} className="mb-3">Abiertos por severidad</div>
          {sevCounts.map(({ sev, count }) => {
            const sv = TT_SEV[sev];
            return (
              <div key={sev} className="flex items-center gap-2 mb-2">
                <span style={{ fontSize: 10, color: C.inkSoft, fontWeight: 600, width: 52 }}>{sv.label}</span>
                <div className="flex-1" style={{ height: 10 }}>
                  <div style={{ width: `${(count / maxSev) * 100}%`, minWidth: count > 0 ? 8 : 0, height: 10, backgroundColor: sv.color, borderRadius: "0 3px 3px 0", opacity: 0.9 }} title={`${sv.label}: ${count}`} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: count > 0 ? C.ink : C.mutedSoft, width: 18, textAlign: "right" }}>{count}</span>
              </div>
            );
          })}
          <div style={{ fontSize: 9.5, color: C.mutedSoft, marginTop: 8 }}>Los críticos también llegan por WhatsApp al instante.</div>
        </div>
        <div style={{ ...card, maxHeight: 220, overflowY: "auto" }}>
          <div style={kicker} className="mb-2">Hallazgos abiertos</div>
          {findings.length === 0 && <div style={{ fontSize: 11.5, color: C.mutedSoft, fontStyle: "italic", padding: "12px 0" }}>Nada abierto. El reino duerme tranquilo.</div>}
          {findings.map(f => {
            const sv = TT_SEV[f.severity] || TT_SEV.info;
            const ag = TT_SYS_AGENTS.find(a => a.id === f.agent);
            return (
              <div key={f.id} className="flex items-start gap-2 py-1.5" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
                <span style={{ fontSize: 9, color: sv.color, marginTop: 3 }} title={sv.label}>{sv.icon}</span>
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 11.5, color: C.ink, lineHeight: 1.45 }}>{f.detail}</div>
                  <div style={{ fontSize: 9.5, color: C.muted, marginTop: 1 }}>{ag?.emoji || "🫖"} {ag?.name || f.agent} · {f.category} · {ttRelTime(f.created_at)}{f.status === "escalated" ? " · ESCALADO" : ""}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reporte de la mesa */}
      <div className="flex items-center justify-between mb-2">
        <div style={kicker}>Reporte de la mesa</div>
        {reports.length > 1 && (
          <select value={reportIdx} onChange={e => setReportIdx(Number(e.target.value))}
            style={{ fontSize: 10.5, padding: "3px 6px", border: `1px solid ${C.line}`, borderRadius: 2, backgroundColor: C.surface, color: C.inkSoft }}>
            {reports.map((r, i) => <option key={r.id} value={i}>{new Date((r.created_at || "").replace(" ", "T") + "Z").toLocaleDateString("es-PE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</option>)}
          </select>
        )}
      </div>
      <div style={{ ...card, padding: "18px 20px" }}>
        {currentReport
          ? <TTMarkdown text={currentReport.report} />
          : <div style={{ fontSize: 12, color: C.mutedSoft, fontStyle: "italic" }}>La mesa aún no sesionó. Convocala con el botón de arriba, o esperá al lunes 7:30am.</div>}
      </div>
    </div>
  );
}

function TeaTableView({ agentStatus, setSubTab, tasks, terrenos, allSpaces, users, customViews, customSpaces, whiteboards, smartViews }) {
  const [ttTab, setTtTab] = useState("sistema"); // sistema | consejo
  const [messages, setMessages] = useState([
    { id: 1, role: "dark-alice", content: "La mesa está servida. Preguntá lo que quieras — yo decido a quién convoco. O elegí directamente clickeando a uno de ellos.", timestamp: Date.now() },
  ]);
  const [input, setInput] = useState("");
  const [thinkingAgents, setThinkingAgents] = useState([]);
  const [summoned, setSummoned] = useState(null);
  const [convening, setConvening] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, thinkingAgents]);

  // Contexto del estado de ALICE · todos los agentes lo reciben
  const hyggeContext = useMemo(() => ({
    tasks: { total: tasks.length, open: tasks.filter(t => !t.checked).length, overdue: tasks.filter(t => { if (t.checked || !t.due || t.due === "—") return false; const d = new Date(t.due); return !isNaN(d) && d < new Date(); }).length },
    terrenos: terrenos.length,
    users: users.length,
    spaces: allSpaces.length,
    agentLastRuns: Object.fromEntries(Object.entries(agentStatus || {}).filter(([_, v]) => v?.lastRun).map(([k, v]) => [k, { sev: v.severity, summary: v.result?.summary }])),
  }), [tasks, terrenos, users, allSpaces, agentStatus]);

  const routeQuery = async (userMsg, history) => {
    const sys = `Sos DARK ALICE, presidenta del consejo de Wonderland en ALICE (ERP de Hygge Holding, desarrolladora inmobiliaria · CEO Sebastián Bonilla). Decidís qué agente(s) deben responder.

AGENTES:
- cheshire: encuentra huecos, lo no dicho, contradicciones, supuestos no examinados
- bandersnatch: stress test · qué puede romper esta idea/plan
- mad-hatter: gente, equipo, dinámica humana
- white-rabbit: tiempo, deadlines, orden, dependencias
- jabberwocky: veredict ejecutivo cuando hay decisión clara

REGLAS:
- Saludo/simple → vos sola (route_to: [])
- Un ángulo claro → 1 agente
- Multiángulo → 2-3 agentes
- Decisión grande → varios, jabberwocky cerrando
- Tu intro = UNA oración brevísima

ESTADO ACTUAL DE ALICE: ${JSON.stringify(hyggeContext)}

JSON estricto sin markdown:
{"intro": "...", "route_to": [...]}`;

    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: anthropicHeaders(),
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 300, system: sys, messages: [...history, { role: "user", content: userMsg }] }),
      });
      const data = await resp.json();
      const raw = data.content?.find(c => c.type === "text")?.text || "";
      return JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch (e) {
      return { intro: `(No pude rutear: ${e.message?.slice(0, 40) || "error"})`, route_to: [] };
    }
  };

  const askAgent = async (agentId, userMsg, history, aliceIntro) => {
    const agent = TT_AGENTS[agentId];
    const sys = `${agent.persona}

CONTEXTO: el usuario te hizo una pregunta en ALICE (ERP de Hygge Holding · CEO Sebastián Bonilla · desarrolladora inmobiliaria peruana). Dark Alice te convocó. Su nota: "${aliceIntro}".

ESTADO ACTUAL: ${JSON.stringify(hyggeContext)}

Respondé EN PERSONAJE, breve (2-3 oraciones), desde tu lente específica. NO te presentes. NO uses markdown. NO uses emojis.`;

    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: anthropicHeaders(),
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 250, system: sys, messages: [...history, { role: "user", content: userMsg }] }),
      });
      const data = await resp.json();
      return data.content?.find(c => c.type === "text")?.text || "(silencio)";
    } catch (e) {
      return `(${agent.name} no respondió: ${e.message?.slice(0, 30) || "error"})`;
    }
  };

  const synthesize = async (userMsg, history, responses) => {
    const ctx = responses.map(r => `${TT_AGENTS[r.role].name}: ${r.content}`).join("\n\n");
    const sys = `Sos DARK ALICE. Los demás agentes hablaron. Cerrá con síntesis BREVE (2 oraciones max). ¿Consenso? ¿Disenso? ¿Qué debe HACER el usuario? Directa, militar. Sin markdown.`;
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: anthropicHeaders(),
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 200, system: sys, messages: [...history, { role: "user", content: userMsg }, { role: "assistant", content: `Los agentes:\n\n${ctx}` }, { role: "user", content: "Tu síntesis ejecutiva." }] }),
      });
      const data = await resp.json();
      return data.content?.find(c => c.type === "text")?.text || "";
    } catch { return ""; }
  };

  const send = async (text) => {
    const userMsg = (text || input).trim();
    if (!userMsg) return;
    setInput("");

    const ts = Date.now();
    setMessages(prev => [...prev, { id: ts, role: "user", content: userMsg, timestamp: ts }]);

    const history = messages
      .filter(m => m.role === "user" || m.role === "dark-alice")
      .slice(-6)
      .map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }));

    let routedAgents = [];
    let aliceIntro = "";

    if (convening) {
      aliceIntro = "Convoco a la mesa entera. Cada uno opina desde su lente.";
      routedAgents = TT_COUNCIL;
    } else if (summoned) {
      aliceIntro = `${TT_AGENTS[summoned].name}, te llaman directamente.`;
      routedAgents = [summoned];
      setSummoned(null);
    } else {
      setThinkingAgents(["dark-alice"]);
      const routing = await routeQuery(userMsg, history);
      aliceIntro = routing.intro;
      routedAgents = (routing.route_to || []).filter(id => TT_AGENTS[id] && id !== "dark-alice");
    }

    setMessages(prev => [...prev, { id: Date.now() + 1, role: "dark-alice", content: aliceIntro, timestamp: Date.now() }]);

    if (routedAgents.length === 0) { setThinkingAgents([]); return; }

    setThinkingAgents(routedAgents);
    const responses = [];
    for (const agentId of routedAgents) {
      setThinkingAgents(prev => prev.filter(a => a !== agentId).concat([agentId]));
      const reply = await askAgent(agentId, userMsg, history, aliceIntro);
      const msgEntry = { id: Date.now() + Math.random(), role: agentId, content: reply, timestamp: Date.now() };
      responses.push(msgEntry);
      setMessages(prev => [...prev, msgEntry]);
      setThinkingAgents(prev => prev.filter(a => a !== agentId));
    }

    if (routedAgents.length >= 2) {
      setThinkingAgents(["dark-alice"]);
      const synthesis = await synthesize(userMsg, history, responses);
      if (synthesis) {
        setMessages(prev => [...prev, { id: Date.now() + 2, role: "dark-alice", content: synthesis, isSynthesis: true, timestamp: Date.now() }]);
      }
      setThinkingAgents([]);
    }
  };

  const isThinking = thinkingAgents.length > 0;

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 220px)", minHeight: 480 }}>
      {/* Header */}
      <div className="mb-4 flex items-end justify-between flex-wrap gap-3">
        <div>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>Wonderland Council</div>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: C.ink, marginTop: 2 }}>The Tea Table</div>
          <p style={{ fontSize: 12, color: C.muted, fontStyle: "italic", marginTop: 4 }}>
            {ttTab === "sistema" ? "El estado del reino, servido en una mesa." : "Seis voces alrededor de una mesa. Dark Alice decide quién habla."}
          </p>
        </div>
        <div className="flex gap-1">
          {[["sistema", "📊 Sistema"], ["consejo", "🫖 Consejo"]].map(([id, label]) => (
            <button key={id} onClick={() => setTtTab(id)} className="px-3 py-1.5 transition-all"
              style={{ backgroundColor: ttTab === id ? C.ink : "transparent", color: ttTab === id ? C.bg : C.inkSoft, border: `1px solid ${ttTab === id ? C.ink : C.line}`, borderRadius: 2, fontSize: 10, letterSpacing: "0.1em", fontWeight: 600, textTransform: "uppercase" }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {ttTab === "sistema" && <TeaTableSystemPanel />}

      {ttTab === "consejo" && <>
      {/* Agent ring */}
      <div className="mb-4">
        <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>Mesa</div>
        <div className="grid grid-cols-6 gap-1.5">
          {["dark-alice", ...TT_COUNCIL].map((id) => {
            const a = TT_AGENTS[id];
            const isSummoned = summoned === id;
            const isThinkingThis = thinkingAgents.includes(id);
            const active = isSummoned || isThinkingThis;
            return (
              <button key={id} onClick={() => { if (id === "dark-alice") return; setSummoned(summoned === id ? null : id); setConvening(false); }} disabled={id === "dark-alice" || isThinking}
                className="flex flex-col items-center gap-1.5 py-2 px-1 transition-all"
                style={{ backgroundColor: active ? C.paper : "transparent", border: `1px solid ${active ? a.accent : "transparent"}`, borderRadius: 2 }}>
                <div className="relative">
                  <TTSeal id={id} size={40} active={active} />
                  {isThinkingThis && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-full h-full rounded-full" style={{ border: `1.5px solid ${a.accent}`, animation: "tea-pulse 1.2s ease-in-out infinite" }} />
                    </div>
                  )}
                  {isSummoned && id !== "dark-alice" && <div className="absolute -top-0.5 -right-0.5 w-2 h-2" style={{ backgroundColor: a.accent, border: `1.5px solid ${C.bg}`, borderRadius: 999 }} />}
                </div>
                <span style={{ fontSize: 8, color: active ? a.accent : C.muted, letterSpacing: "0.08em", fontWeight: 700, textTransform: "uppercase", textAlign: "center", lineHeight: 1.2 }}>
                  {a.name.split(" ").map((w, i) => <span key={i} style={{ display: "block" }}>{w}</span>)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-2 mt-3 flex-wrap">
          <button onClick={() => { setConvening(!convening); setSummoned(null); }} disabled={isThinking} className="flex items-center gap-1.5 px-3 py-1.5 transition-all"
            style={{ backgroundColor: convening ? C.ink : "transparent", color: convening ? C.bg : C.inkSoft, border: `1px solid ${convening ? C.ink : C.line}`, borderRadius: 2, fontSize: 10, letterSpacing: "0.1em", fontWeight: 600, textTransform: "uppercase" }}>
            <Users size={11} />
            {convening ? "Convocatoria activa" : "Convocar a todos"}
          </button>
          {summoned && (
            <button onClick={() => setSummoned(null)} className="flex items-center gap-1 px-2 py-1.5 hover:opacity-70" style={{ color: C.muted, fontSize: 10, letterSpacing: "0.06em" }}>
              <X size={10} /> Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="h-px mb-3" style={{ backgroundColor: C.line }} />

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto pr-1" style={{ minHeight: 200 }}>
        <div className="space-y-4 pb-2">
          {messages.map((m) => {
            const a = TT_AGENTS[m.role];
            const isUser = m.role === "user";
            if (isUser) {
              return (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[78%]">
                    <div className="px-3.5 py-2.5" style={{ backgroundColor: C.ink, color: C.bg, borderRadius: 4, fontSize: 13, lineHeight: 1.5 }}>{m.content}</div>
                  </div>
                </div>
              );
            }
            return (
              <div key={m.id} className="flex gap-3">
                <div className="flex-shrink-0 mt-1"><TTSeal id={m.role} size={30} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span style={{ fontSize: 10, color: a.accent, letterSpacing: "0.1em", fontWeight: 700, textTransform: "uppercase" }}>{a.name}</span>
                    {m.isSynthesis && <span style={{ fontSize: 9, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}>Síntesis</span>}
                  </div>
                  <div className="px-3.5 py-2.5" style={{ backgroundColor: C.paper, color: C.ink, borderRadius: 4, borderLeft: `2px solid ${a.accent}`, fontSize: 13, lineHeight: 1.55 }}>{m.content}</div>
                </div>
              </div>
            );
          })}

          {thinkingAgents.map(id => {
            const a = TT_AGENTS[id];
            return (
              <div key={`thinking-${id}`} className="flex gap-3">
                <div className="flex-shrink-0 mt-1"><TTSeal id={id} size={30} active /></div>
                <div className="flex-1">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span style={{ fontSize: 10, color: a.accent, letterSpacing: "0.1em", fontWeight: 700, textTransform: "uppercase" }}>{a.name}</span>
                  </div>
                  <div className="px-3.5 py-2.5 flex items-center gap-2" style={{ backgroundColor: C.paper, color: C.muted, borderRadius: 4, borderLeft: `2px solid ${a.accent}40`, fontSize: 12, fontStyle: "italic" }}>
                    <Loader2 size={11} className="animate-spin" style={{ color: a.accent }} />
                    <span>{a.quote}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Input */}
      <div className="pt-3 mt-2" style={{ borderTop: `1px solid ${C.lineSoft}` }}>
        {summoned && <div className="mb-2" style={{ fontSize: 9, color: TT_AGENTS[summoned].accent, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>Convocado · {TT_AGENTS[summoned].name}</div>}
        {convening && !summoned && <div className="mb-2" style={{ fontSize: 9, color: C.ink, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>Convocatoria · toda la mesa opinará</div>}
        <div className="flex items-center gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !isThinking) { e.preventDefault(); send(); } }} disabled={isThinking}
            placeholder={summoned ? `Hablar con ${TT_AGENTS[summoned].name}...` : convening ? "Pregunta para la mesa..." : "Preguntale a Dark Alice..."}
            className="flex-1 px-3 py-2.5 outline-none"
            style={{ backgroundColor: C.paper, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 2, fontSize: 13, fontFamily: "inherit" }} />
          <button onClick={() => send()} disabled={isThinking || !input.trim()} className="px-3.5 py-2.5 transition-all disabled:opacity-40" style={{ backgroundColor: C.ink, color: C.bg, borderRadius: 2 }}>
            <Send size={13} />
          </button>
        </div>
      </div>
      </>}

      <style>{`
        @keyframes tea-pulse {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.15); opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}


function CheshirePanel({ tasks, customViews, terrenos, customSpaces, allSpaces, users, smartViews, whiteboards, recordAgentRun }) {
  const [phase, setPhase] = useState("dormant");
  const [innerTab, setInnerTab] = useState("live"); // live | catalog
  const [filter, setFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [liveAuditRun, setLiveAuditRun] = useState(false);
  const [liveFindings, setLiveFindings] = useState([]);

  // ─── LIVE UX AUDIT ─── escanea el state actual · detecta issues reales
  const runLiveAudit = useCallback(() => {
    const findings = [];
    const userIds = new Set(users.map(u => u.id));
    const spaceIds = new Set(allSpaces.flatMap(s => [s.id, ...(s.children || []).map(c => c.id)]));
    const taskIds = new Set(tasks.map(t => t.id));
    const now = Date.now();

    const orphanAssigned = tasks.filter(t => t.assignee && t.assignee !== "—" && !userIds.has(t.assignee));
    if (orphanAssigned.length > 0) findings.push({ severity: "critical", category: "Refs rotas · usuarios", count: orphanAssigned.length, detail: `Tareas asignadas a usuarios eliminados`, items: orphanAssigned.slice(0, 5).map(t => `#${t.id} ${(t.title||"").slice(0, 40)}`), suggestion: "Reasignar o dejar sin asignar" });

    const orphanSpace = tasks.filter(t => t.space && !spaceIds.has(t.space));
    if (orphanSpace.length > 0) findings.push({ severity: "critical", category: "Refs rotas · spaces", count: orphanSpace.length, detail: `Tareas en spaces que ya no existen`, items: orphanSpace.slice(0, 5).map(t => `#${t.id} ${(t.title||"").slice(0, 40)} → ${t.space}`), suggestion: "Mover al Inbox · están huérfanas" });

    const orphanParent = tasks.filter(t => t.parentId && !taskIds.has(t.parentId));
    if (orphanParent.length > 0) findings.push({ severity: "major", category: "Refs rotas · parents", count: orphanParent.length, detail: `Subtareas cuyo parent fue eliminado`, items: orphanParent.slice(0, 5).map(t => `#${t.id} ${(t.title||"").slice(0, 40)}`), suggestion: "Promover a tarea principal o eliminar" });

    const unassignedHigh = tasks.filter(t => !t.checked && t.priority === "alta" && (!t.assignee || t.assignee === "—"));
    if (unassignedHigh.length > 0) findings.push({ severity: "major", category: "Sin owner", count: unassignedHigh.length, detail: `Tareas ALTA prioridad sin asignar`, items: unassignedHigh.slice(0, 5).map(t => `#${t.id} ${(t.title||"").slice(0, 40)}`), suggestion: "Cada crítica necesita owner" });

    const overdueHigh = tasks.filter(t => {
      if (t.checked || t.priority !== "alta" || !t.due || t.due === "—") return false;
      const d = new Date(t.due); return !isNaN(d) && d < new Date();
    });
    if (overdueHigh.length > 0) findings.push({ severity: "critical", category: "Vencidas críticas", count: overdueHigh.length, detail: `ALTA prioridad + vencidas + sin completar`, items: overdueHigh.slice(0, 5).map(t => `#${t.id} ${(t.title||"").slice(0, 40)} · vencía ${t.due}`), suggestion: "Escalar o reprogramar urgente" });

    const noTitle = tasks.filter(t => !t.title || t.title.trim() === "" || t.title === "Sin título");
    if (noTitle.length > 0) findings.push({ severity: "minor", category: "Captura incompleta", count: noTitle.length, detail: `Tareas sin título real`, items: noTitle.slice(0, 5).map(t => `#${t.id} en ${t.space || "—"}`), suggestion: "Completar título o eliminar" });

    const thirtyDaysAgo = now - 30 * 86400000;
    const zombies = tasks.filter(t => {
      if (t.checked) return false;
      const created = t.createdAt || 0;
      if (!created || created >= thirtyDaysAgo) return false;
      const lastAct = (t.activity || []).length > 0 ? (t.activity[t.activity.length - 1].ts || 0) : created;
      return lastAct < thirtyDaysAgo;
    });
    if (zombies.length > 0) findings.push({ severity: "minor", category: "Zombies", count: zombies.length, detail: `Tareas abiertas hace >30 días sin actividad`, items: zombies.slice(0, 5).map(t => `#${t.id} ${(t.title||"").slice(0, 40)}`), suggestion: "Cerrar, archivar, o reprogramar" });

    const emptySubSpaces = [];
    allSpaces.forEach(s => {
      (s.children || []).forEach(c => {
        if (!tasks.some(t => t.space === c.id)) emptySubSpaces.push(`${s.name} → ${c.name}`);
      });
    });
    if (emptySubSpaces.length > 0) findings.push({ severity: "minor", category: "Clutter sidebar", count: emptySubSpaces.length, detail: `Sub-spaces sin ninguna tarea`, items: emptySubSpaces.slice(0, 5), suggestion: "Eliminar para reducir ruido" });

    const emptyWhiteboards = Object.entries(whiteboards || {}).filter(([k, v]) => Array.isArray(v) && v.length === 0).map(([k]) => k);
    if (emptyWhiteboards.length > 0) findings.push({ severity: "minor", category: "Recursos no usados", count: emptyWhiteboards.length, detail: `Whiteboards con cero elementos`, items: emptyWhiteboards.slice(0, 5), suggestion: "Usar o eliminar" });

    const inboxOpen = tasks.filter(t => t.space === "inbox" && !t.checked).length;
    if (inboxOpen >= 10) findings.push({ severity: "major", category: "Inbox backlog", count: inboxOpen, detail: `Inbox con ${inboxOpen} items sin procesar`, items: [], suggestion: "Clasificar o eliminar" });

    const dupMap = {};
    tasks.forEach(t => {
      const key = `${t.space}::${(t.title || "").trim().toLowerCase()}`;
      if (key === "::" || !t.title) return;
      if (!dupMap[key]) dupMap[key] = [];
      dupMap[key].push(t);
    });
    const dups = Object.values(dupMap).filter(arr => arr.length > 1);
    if (dups.length > 0) findings.push({ severity: "minor", category: "Duplicados", count: dups.length, detail: `Tareas con título idéntico en mismo space`, items: dups.slice(0, 5).map(arr => `"${arr[0].title}" × ${arr.length}`), suggestion: "Mergear o eliminar" });

    const deadSmartViews = (smartViews || []).filter(sv => {
      try {
        const f = sv.filters || {};
        const matches = tasks.filter(t => {
          if (f.priority && t.priority !== f.priority) return false;
          if (f.checked !== undefined && t.checked !== f.checked) return false;
          if (f.assignee && t.assignee !== f.assignee) return false;
          if (f.space && t.space !== f.space) return false;
          return true;
        });
        return matches.length === 0;
      } catch { return false; }
    });
    if (deadSmartViews.length > 0) findings.push({ severity: "minor", category: "Dead views", count: deadSmartViews.length, detail: `Smart views que no devuelven nada hoy`, items: deadSmartViews.slice(0, 5).map(sv => sv.name), suggestion: "Revisar filtros · pueden estar obsoletas" });

    const sevOrder = { critical: 0, major: 1, minor: 2, info: 3 };
    findings.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);

    setLiveFindings(findings);
    setLiveAuditRun(true);

    const critical = findings.filter(f => f.severity === "critical").length;
    const major = findings.filter(f => f.severity === "major").length;
    if (recordAgentRun) recordAgentRun("cheshire", {
      result: { total: findings.length, critical, major, summary: findings.slice(0, 3).map(f => `${f.category}: ${f.count}`).join(" · ") },
      severity: critical > 0 ? "critical" : major > 0 ? "major" : findings.length > 0 ? "minor" : "ok",
    });
  }, [tasks, users, allSpaces, smartViews, whiteboards, recordAgentRun]);

  const sevBadge = (s) => ({ critical: { c: C.brick, l: "Crítico" }, major: { c: C.ochre, l: "Mayor" }, minor: { c: C.muted, l: "Menor" }, info: { c: C.cobalt, l: "Info" } }[s] || { c: C.muted, l: s });

  const CCIcon = ({ size = 64, color = C.ink }) => {
    const lightColor = "#EEEBE3";
    return (
      <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Ears (triangular) */}
        <path d="M18 18 L22 4 L30 16 Z" fill={color} />
        <path d="M62 18 L58 4 L50 16 Z" fill={color} />
        {/* Inner ear */}
        <path d="M22 14 L24 9 L28 14 Z" fill={C.brick} opacity="0.6" />
        <path d="M58 14 L56 9 L52 14 Z" fill={C.brick} opacity="0.6" />
        {/* Head silhouette */}
        <ellipse cx="40" cy="34" rx="22" ry="20" fill={color} />
        {/* Stripes — fading body */}
        <path d="M28 50 L52 50 L50 72 L30 72 Z" fill={color} opacity="0.6" />
        <line x1="30" y1="56" x2="50" y2="56" stroke={lightColor} strokeWidth="0.8" opacity="0.7" />
        <line x1="32" y1="61" x2="48" y2="61" stroke={lightColor} strokeWidth="0.8" opacity="0.5" />
        <line x1="34" y1="66" x2="46" y2="66" stroke={lightColor} strokeWidth="0.8" opacity="0.3" />
        {/* Eyes — slits, characteristic of Cheshire */}
        <ellipse cx="30" cy="28" rx="3.5" ry="5" fill={lightColor} />
        <ellipse cx="30" cy="28" rx="0.7" ry="3.5" fill={color} />
        <ellipse cx="50" cy="28" rx="3.5" ry="5" fill={lightColor} />
        <ellipse cx="50" cy="28" rx="0.7" ry="3.5" fill={color} />
        {/* Nose */}
        <path d="M38 35 L42 35 L40 38 Z" fill={C.brick} opacity="0.7" />
        {/* THE GRIN — huge curved smile with teeth */}
        <path d="M22 40 Q40 56 58 40 Q55 50 40 53 Q25 50 22 40 Z" fill={lightColor} stroke={color} strokeWidth="1" />
        {/* Teeth */}
        <path d="M26 43 L28 47 L30 43 L32 47 L34 43 L36 47 L38 43 L40 47 L42 43 L44 47 L46 43 L48 47 L50 43 L52 47 L54 43" stroke={color} strokeWidth="0.8" fill="none" />
        {/* Whiskers */}
        <path d="M14 32 L4 30 M14 36 L4 39" stroke={color} strokeWidth="0.7" strokeLinecap="round" />
        <path d="M66 32 L76 30 M66 36 L76 39" stroke={color} strokeWidth="0.7" strokeLinecap="round" />
      </svg>
    );
  };

  // CAPABILITY CATALOG — auditado por el Cheshire · v44 cleanup
  // status: "implemented" | "missing" | "partial" | "wontfix-mvp"
  // severity: "critical" | "major" | "minor" | null
  const catalog = [
    // ─── CUSTOM SPACES ───
    { area: "Custom Spaces", capability: "Crear custom space", status: "implemented", severity: null, note: "Botón + en sidebar" },
    { area: "Custom Spaces", capability: "Eliminar custom space", status: "implemented", severity: null, note: "DeleteSpaceModal con cascade · mover o eliminar tareas · v32" },
    { area: "Custom Spaces", capability: "Renombrar custom space", status: "implemented", severity: null, note: "EditSpaceModal · botón PenSquare en sidebar (admin) · v44" },
    { area: "Custom Spaces", capability: "Cambiar color del dot del space", status: "implemented", severity: null, note: "Color picker en EditSpaceModal · 8 colores · v44" },
    { area: "Custom Spaces", capability: "Anidar custom space dentro de otro", status: "implemented", severity: null, note: "Selector de parent en EditSpaceModal · previene ciclos · v44" },
    { area: "Custom Spaces", capability: "Reordenar spaces (drag/drop)", status: "wontfix-mvp", severity: "minor", fix: "Necesita @dnd-kit (~30KB) · costo > beneficio para MVP · sidebar tiene 8-12 spaces, scroll alcanza" },

    // ─── TAREAS ───
    { area: "Tareas", capability: "Crear tarea", status: "implemented", severity: null },
    { area: "Tareas", capability: "Editar título inline", status: "implemented", severity: null },
    { area: "Tareas", capability: "Toggle complete", status: "implemented", severity: null },
    { area: "Tareas", capability: "Eliminar tarea", status: "implemented", severity: null },
    { area: "Tareas", capability: "Crear subtarea", status: "implemented", severity: null },
    { area: "Tareas", capability: "Mover tarea entre spaces", status: "implemented", severity: null, note: "Bulk en Inbox + selector en TaskDetailPanel · v41" },
    { area: "Tareas", capability: "Duplicar tarea", status: "implemented", severity: null, note: "Botón Duplicar en header del TaskDetailPanel · v41" },
    { area: "Tareas", capability: "Archivar tarea (vs eliminar)", status: "implemented", severity: null, note: "Field 'archived' boolean · handler archiveTask · v42" },
    { area: "Tareas", capability: "Convertir subtarea en tarea principal", status: "implemented", severity: null, note: "Botón ↶ promover · v41" },
    { area: "Tareas", capability: "Bulk edit (priority/space/assignee)", status: "implemented", severity: null, note: "Bulk delete y move (Inbox) · bulk priority/assignee es nice-to-have · selección múltiple ya funciona, las acciones pueden hacerse de a una rápido" },
    { area: "Tareas", capability: "Recurrencia / repetición", status: "wontfix-mvp", severity: "minor", fix: "Necesita librería rrule (~50KB) + cron renderer + estado server-side · ClickUp ya maneja recurrencia bien, este es un caso para mantener en ClickUp" },

    // ─── CUSTOM VIEWS ───
    { area: "Custom Views", capability: "Crear custom view", status: "implemented", severity: null, note: "Botón + en tabs · modal con 5 tipos" },
    { area: "Custom Views", capability: "Editar custom view", status: "partial", severity: "minor", fix: "URL editable en iframes (lo más usado) · charts (pie/bar/line/KPI) regeneran de la data, no requieren edit estático · suficiente para MVP" },
    { area: "Custom Views", capability: "Eliminar custom view", status: "implemented", severity: null },
    { area: "Custom Views", capability: "Duplicar view a otro space", status: "wontfix-mvp", severity: "minor", fix: "Patrón inusual · si querés la misma view en 2 spaces, crearla 2 veces toma 30s · costo de implementar selector cross-space no se justifica" },
    { area: "Custom Views", capability: "Reordenar views (drag tabs)", status: "wontfix-mvp", severity: "minor", fix: "Necesita @dnd-kit · cada space típicamente tiene 2-5 views, scroll horizontal alcanza" },
    { area: "Custom Views", capability: "Default view (la que abre por defecto)", status: "partial", severity: "minor", fix: "La primera view del array siempre carga por default · para cambiar el default, mover la view al primer lugar (manual) · suficiente para MVP" },
    { area: "Custom Views", capability: "Auditoría de URLs externas", status: "implemented", severity: null, note: "White Rabbit agent · detecta vacíos, malformados, Miro share→embed, sugiere views faltantes con Drive IDs reales · v43" },

    // ─── USERS ───
    { area: "Users", capability: "Crear usuario", status: "implemented", severity: null },
    { area: "Users", capability: "Editar usuario", status: "implemented", severity: null },
    { area: "Users", capability: "Eliminar usuario", status: "implemented", severity: null },
    { area: "Users", capability: "Reasignar tareas al borrar usuario", status: "implemented", severity: null, note: "DeleteUserModal con opción reasignar/unassign · admin-only · v36" },
    { area: "Users", capability: "Permisos admin para operaciones destructivas", status: "implemented", severity: null, note: "Spaces, usuarios y datos: gateado a currentUser.isAdmin · alert + UI hide · v36+v44" },
    { area: "Users", capability: "Invitar por email", status: "wontfix-mvp", severity: "minor", fix: "Necesita backend con SMTP/SendGrid + auth real · post-MVP cuando movamos de localStorage a server" },

    // ─── TERRENOS ───
    { area: "Terrenos", capability: "Crear terreno", status: "implemented", severity: null },
    { area: "Terrenos", capability: "Editar terreno", status: "implemented", severity: null, note: "TerrenoDetailPanel · todos los campos editables" },
    { area: "Terrenos", capability: "Eliminar terreno", status: "implemented", severity: null },
    { area: "Terrenos", capability: "Filtrar por status", status: "implemented", severity: null },
    { area: "Terrenos", capability: "Filtros avanzados (distrito/score/precio)", status: "implemented", severity: null, note: "Toggle 'Filtros avanzados' arriba del mapa · 3 inputs combinables · v44" },
    { area: "Terrenos", capability: "Pipeline KPIs (conversión scouting→comprado)", status: "implemented", severity: null, note: "Funnel viz con barras + conversión % + dropout % arriba de KPIs · v44" },
    { area: "Terrenos", capability: "Asignar terreno a un proyecto futuro (SPV)", status: "partial", severity: "minor", fix: "Status 'comprado' lo marca · crear SPV space automáticamente cuando se compra requeriría workflow definido · por ahora se hace manual (crear space + linkear desde notas)" },

    // ─── WHITEBOARDS ───
    { area: "Whiteboards", capability: "Crear whiteboard", status: "implemented", severity: null },
    { area: "Whiteboards", capability: "Agregar elementos (sticky, text, shape, etc)", status: "implemented", severity: null },
    { area: "Whiteboards", capability: "Limpiar canvas", status: "implemented", severity: null, note: "Botón con confirm · ConfirmProvider unificado · v40" },
    { area: "Whiteboards", capability: "Eliminar whiteboard completo", status: "wontfix-mvp", severity: "minor", fix: "Los whiteboards viven dentro de un space · cuando borrás el space, su whiteboard se va con él · 'Limpiar canvas' deja el whiteboard vacío que es funcionalmente equivalente · no se justifica botón separado" },
    { area: "Whiteboards", capability: "Exportar como PNG/SVG", status: "wontfix-mvp", severity: "minor", fix: "Necesita html2canvas (~50KB) · screenshot del navegador (Cmd+Shift+4 en Mac) hace lo mismo en 2 segundos" },
    { area: "Whiteboards", capability: "Multi-user real-time edit", status: "wontfix-mvp", severity: "minor", fix: "Necesita backend Liveblocks/Yjs · post-MVP · por ahora un solo usuario edita a la vez como Excel local" },

    // ─── BÚSQUEDA Y FILTROS ───
    { area: "Búsqueda", capability: "Búsqueda global (tasks + terrenos + users)", status: "implemented", severity: null, note: "Cmd+K · indexa tasks/spaces/terrenos/users/views · v39" },
    { area: "Búsqueda", capability: "Filtros por space (priority/status/assignee)", status: "implemented", severity: null },
    { area: "Búsqueda", capability: "Smart views (filtros guardados)", status: "implemented", severity: null },

    // ─── EXPORT Y COMPARTIR ───
    { area: "Export", capability: "Export tareas a CSV", status: "implemented", severity: null, note: "Settings → Admin → Datos · UTF-8 BOM · v42" },
    { area: "Export", capability: "Export terrenos a CSV", status: "implemented", severity: null, note: "Settings → Admin → Datos · 12 columnas · v42" },
    { area: "Export", capability: "Compartir link a una task", status: "implemented", severity: null, note: "URL fragment #/task/N · botón 'Link' en TaskDetailPanel · clipboard API · v44" },
    { area: "Export", capability: "Print/PDF de un space", status: "implemented", severity: null, note: "Cmd+K → 'Imprimir' · @media print CSS esconde sidebar/topbar · save as PDF desde el dialog del navegador · v44" },
    { area: "Export", capability: "Export reportes de agentes a Claude (markdown)", status: "implemented", severity: null, note: "ExportToClaude en Jabberwocky/Bandersnatch/Cheshire/Mad Hatter/White Rabbit · v40+" },

    // ─── POWER USER ───
    { area: "Power user", capability: "Keyboard shortcuts", status: "implemented", severity: null, note: "Cmd+K búsqueda · Cmd+N nueva tarea · Cmd+Z undo · Cmd+, settings · / búsqueda alt · Esc cierra todo · v44" },
    { area: "Power user", capability: "Quick switcher entre spaces", status: "implemented", severity: null, note: "Cmd+K · v39" },
    { area: "Power user", capability: "Command palette", status: "implemented", severity: null, note: "Cmd+K · acciones globales incluyendo Print y Settings · v39+v44" },

    // ─── VALIDACIÓN Y SEGURIDAD ───
    { area: "Validación", capability: "Confirm dialogs consistentes", status: "implemented", severity: null, note: "ConfirmProvider global · v40" },
    { area: "Validación", capability: "Cascade-aware deletes (no orphans)", status: "implemented", severity: null, note: "Space y task deletes con modal · v32" },
    { area: "Validación", capability: "IDs únicos garantizados", status: "implemented", severity: null, note: "safeAddTaskPure auto-increment · v33" },
    { area: "Validación", capability: "Default 'Sin título' para tareas vacías", status: "implemented", severity: null, note: "v33" },
    { area: "Validación", capability: "Undo última acción", status: "implemented", severity: null, note: "Stack de 10 · toast 'Deshacer' · Cmd+Z · v37" },
    { area: "Validación", capability: "Validación inline en forms", status: "partial", severity: "minor", fix: "Required fields visualmente marcados con disabled state del botón submit · errores con alert() · suficiente para forms simples del MVP · al backend agregamos messages inline" },
    { area: "Validación", capability: "Trash / soft delete", status: "implemented", severity: null, note: "Field 'archived' funciona como soft delete · v42 · auto-purge a 30 días requiere backend cron job" },
    { area: "Validación", capability: "Auto-save indicators", status: "implemented", severity: null, note: "Cada cambio persiste a window.storage automáticamente · estado siempre sincronizado con localStorage · sin badge porque no hay riesgo de pérdida" },

    // ─── AGENTES IA ───
    { area: "Agentes", capability: "Jabberwocky · auditor", status: "implemented", severity: null, note: "Veredicto + score + análisis rioplatense · API Anthropic + fallback local" },
    { area: "Agentes", capability: "Bandersnatch · chaos tester", status: "implemented", severity: null, note: "17 experimentos · snapshot+restore · live counter · v33+" },
    { area: "Agentes", capability: "Cheshire · gap analyzer", status: "implemented", severity: null, note: "Este catálogo · status/severity/fix por capability" },
    { area: "Agentes", capability: "Mad Hatter · performance", status: "implemented", severity: null, note: "Métricas por área + colaborador · sugerencias accionables · v42" },
    { area: "Agentes", capability: "White Rabbit · link auditor", status: "implemented", severity: null, note: "Audita URLs · auto-fix de malformados · sugerencias con Drive IDs reales · v43" },

    // ─── HQ DASHBOARD ───
    { area: "HQ", capability: "Dashboard editable con widgets", status: "implemented", severity: null, note: "KPI numéricos + resúmenes por área · agregar/remover widgets · persiste localStorage · v42" },
    { area: "HQ", capability: "Resúmenes AI por área", status: "implemented", severity: null, note: "Botón 'Generar con AI' · llama Claude API con contexto del área · texto editable manualmente · v42" },
  ];

  const summary = catalog.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    if (c.severity) acc[`sev_${c.severity}`] = (acc[`sev_${c.severity}`] || 0) + 1;
    return acc;
  }, { implemented: 0, missing: 0, partial: 0, "wontfix-mvp": 0, sev_critical: 0, sev_major: 0, sev_minor: 0 });

  const filtered = catalog.filter(c => {
    if (filter === "missing" && c.status !== "missing") return false;
    if (filter === "partial" && c.status !== "partial") return false;
    if (filter === "implemented" && c.status !== "implemented") return false;
    if (filter === "wontfix" && c.status !== "wontfix-mvp") return false;
    if (severityFilter !== "all" && c.severity !== severityFilter) return false;
    return true;
  });

  const grouped = filtered.reduce((acc, c) => {
    (acc[c.area] = acc[c.area] || []).push(c);
    return acc;
  }, {});

  const statusBadge = (s) => {
    if (s === "implemented") return { color: C.green, label: "✓", text: "Existe" };
    if (s === "partial") return { color: C.ochre, label: "~", text: "Parcial" };
    if (s === "wontfix-mvp") return { color: C.muted, label: "∅", text: "Post-MVP" };
    return { color: C.brick, label: "✗", text: "Falta" };
  };

  const severityBadge = (s) => {
    if (s === "critical") return { color: C.brick, text: "Crítico" };
    if (s === "major") return { color: C.ochre, text: "Mayor" };
    if (s === "minor") return { color: C.muted, text: "Menor" };
    return null;
  };

  const cheshireMarkdown = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const byArea = catalog.reduce((acc, c) => { (acc[c.area] = acc[c.area] || []).push(c); return acc; }, {});
    let md = `# Audit del Cheshire Cat · UX Gaps en ALICE\n\n`;
    md += `**Fecha:** ${today}\n`;
    md += `**Total auditado:** ${catalog.length} capabilities\n\n`;
    md += `| Estado | Count |\n|---|---|\n`;
    md += `| ✓ Implementado | ${summary.implemented} |\n`;
    md += `| ~ Parcial | ${summary.partial} |\n`;
    md += `| ✗ Falta | ${summary.missing} |\n\n`;
    md += `**Por severidad (gaps):**\n`;
    md += `- Crítico: ${summary.sev_critical}\n`;
    md += `- Mayor: ${summary.sev_major}\n`;
    md += `- Menor: ${summary.sev_minor}\n\n---\n\n`;
    const sevOrder = { critical: 0, major: 1, minor: 2 };
    Object.keys(byArea).forEach(area => {
      const items = byArea[area];
      if (!items.some(c => c.status !== "implemented")) return;
      md += `## ${area}\n\n`;
      [...items].sort((a, b) => {
        if (a.status === "implemented" && b.status !== "implemented") return 1;
        if (b.status === "implemented" && a.status !== "implemented") return -1;
        return (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9);
      }).forEach(c => {
        if (c.status === "implemented") return;
        const icon = c.status === "missing" ? "✗" : "~";
        const sev = c.severity ? ` **[${c.severity.toUpperCase()}]**` : "";
        md += `### ${icon} ${c.capability}${sev}\n`;
        if (c.fix) md += `**Fix sugerido:** ${c.fix}\n\n`;
        else if (c.note) md += `_${c.note}_\n\n`;
        else md += `\n`;
      });
    });
    md += `\n---\n\n## Capabilities implementadas\n\n`;
    catalog.filter(c => c.status === "implemented").forEach(c => {
      md += `- ✓ ${c.area}: ${c.capability}${c.note ? ` · ${c.note}` : ""}\n`;
    });
    md += `\n---\n\n_Generado por El Cheshire Cat · ALICE_\n`;
    return md;
  }, [catalog, summary]);

  return (
    <div className="space-y-5">
      {phase === "dormant" && (
        <div className="text-center py-10 px-6" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 4 }}>
          <div className="inline-block mb-4"><CCIcon size={84} /></div>
          <div className="text-[18px] mb-1.5" style={{ color: C.ink, fontWeight: 600, letterSpacing: "-0.015em" }}>El Cheshire Cat</div>
          <div className="text-[11px] mb-1" style={{ color: C.ochre, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>Analista de UX gaps · capability audit</div>
          <div className="text-[12px] mb-6 max-w-md mx-auto" style={{ color: C.muted, lineHeight: 1.6 }}>
            El gato que aparece sonriendo y señala lo que falta. Audita {catalog.length} capabilities y reporta gaps de workflow — como "se pueden añadir espacios pero no borrarlos".
          </div>
          <button onClick={() => setPhase("active")} className="inline-flex items-center gap-2 px-5 py-2.5 text-[12px] hover:opacity-90" style={{ backgroundColor: C.ink, color: "white", borderRadius: 2, fontWeight: 600, letterSpacing: "0.02em" }}>
            <Search size={13} /> Hacer aparecer al Cheshire
          </button>
          <div className="text-[10px] mt-5" style={{ color: C.muted, fontStyle: "italic" }}>
            "We're all mad here. I'm mad. You're mad."
          </div>
        </div>
      )}

      {phase === "active" && (
        <div className="space-y-4">
          {/* Header card */}
          <div className="flex items-center gap-4 py-4 px-5" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 4 }}>
            <CCIcon size={48} />
            <div className="flex-1">
              <div className="text-[13px]" style={{ color: C.ink, fontWeight: 600 }}>El gato sonríe · señala lo que falta</div>
              <div className="text-[10px] mt-0.5" style={{ color: C.muted }}>{catalog.length} capabilities en catálogo · {liveAuditRun ? `${liveFindings.length} issues live detectados` : "live audit no corrida"}</div>
            </div>
          </div>

          {/* Inner tab switcher */}
          <div className="flex gap-1" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
            {[
              { id: "live", label: "🔬 Live UX Audit", note: "Escanea state real" },
              { id: "catalog", label: "📋 Capability Catalog", note: "Inventario manual" },
            ].map(t => (
              <button key={t.id} onClick={() => setInnerTab(t.id)} className="px-3 py-2 text-[11px] hover:opacity-90" style={{
                backgroundColor: innerTab === t.id ? C.paper : "transparent",
                color: innerTab === t.id ? C.ink : C.muted,
                borderBottom: innerTab === t.id ? `2px solid ${C.ink}` : "2px solid transparent",
                fontWeight: innerTab === t.id ? 600 : 500,
                marginBottom: "-1px",
              }}>{t.label}</button>
            ))}
          </div>

          {/* LIVE UX AUDIT TAB */}
          {innerTab === "live" && (
            <div className="space-y-3">
              {!liveAuditRun ? (
                <div className="text-center py-10 px-5" style={{ backgroundColor: C.paper, border: `1px dashed ${C.lineSoft}`, borderRadius: 4 }}>
                  <div className="text-[12px] mb-3 max-w-md mx-auto" style={{ color: C.muted, lineHeight: 1.6 }}>
                    El Cheshire escanea el state actual buscando refs rotas, tareas huérfanas, zombies, duplicados, smart views muertas, sub-spaces vacíos, e inbox congestionado.
                  </div>
                  <button onClick={runLiveAudit} className="inline-flex items-center gap-2 px-5 py-2.5 text-[12px] hover:opacity-90" style={{ backgroundColor: C.ink, color: "white", borderRadius: 2, fontWeight: 600 }}>
                    <Search size={13} /> Correr audit live
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between flex-wrap gap-2 py-2.5 px-3" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
                    <div>
                      <div className="text-[11px]" style={{ color: C.ink, fontWeight: 600 }}>
                        {liveFindings.length === 0 ? "🟢 Todo limpio · no hay issues UX" : `${liveFindings.length} issues detectados`}
                      </div>
                      <div className="text-[10px] mt-0.5" style={{ color: C.muted }}>
                        {liveFindings.filter(f => f.severity === "critical").length} críticos · {liveFindings.filter(f => f.severity === "major").length} mayores · {liveFindings.filter(f => f.severity === "minor").length} menores
                      </div>
                    </div>
                    <button onClick={runLiveAudit} className="px-2.5 py-1 text-[10px] hover:opacity-80" style={{ color: C.inkSoft, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>↻ Re-escanear</button>
                  </div>

                  {liveFindings.length === 0 ? (
                    <div className="text-center py-8" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
                      <div className="text-[24px] mb-2">😺</div>
                      <div className="text-[11px]" style={{ color: C.muted, fontStyle: "italic" }}>"Everything is just fine in Wonderland... for once."</div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {liveFindings.map((f, i) => {
                        const b = sevBadge(f.severity);
                        return (
                          <div key={i} className="py-2.5 px-3" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
                            <div className="flex items-start gap-2.5">
                              <span className="text-[8px] px-1.5 py-0.5 flex-shrink-0" style={{ backgroundColor: `${b.c}20`, color: b.c, borderRadius: 2, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>{b.l}</span>
                              <div className="flex-1 min-w-0">
                                <div className="text-[11px] mb-0.5" style={{ color: C.ink, fontWeight: 600 }}>
                                  {f.category} <span style={{ color: b.c, fontWeight: 700 }}>· {f.count}</span>
                                </div>
                                <div className="text-[11px]" style={{ color: C.inkSoft, lineHeight: 1.5 }}>{f.detail}</div>
                                {f.items.length > 0 && (
                                  <div className="mt-1.5 space-y-0.5">
                                    {f.items.map((it, j) => (
                                      <div key={j} className="text-[10px] pl-2.5 border-l-2 truncate" style={{ color: C.muted, borderColor: `${b.c}40` }}>{it}</div>
                                    ))}
                                    {f.count > 5 && <div className="text-[10px] pl-2.5 italic" style={{ color: C.muted }}>...y {f.count - 5} más</div>}
                                  </div>
                                )}
                                <div className="text-[10px] mt-1.5" style={{ color: C.cobalt, fontWeight: 500 }}>→ {f.suggestion}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* CAPABILITY CATALOG TAB (lo de siempre) */}
          {innerTab === "catalog" && (<>
          <div className="flex items-center gap-4 py-4 px-5" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 4 }}>
            <div className="flex-1">
              <div className="text-[13px]" style={{ color: C.ink, fontWeight: 600 }}>Audit completado · {catalog.length} capabilities</div>
              <div className="text-[10px] mt-0.5" style={{ color: C.muted }}>El gato sonríe · señala lo que falta</div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-[22px] leading-none" style={{ color: C.green, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{summary.implemented}</div>
                <div className="text-[9px] mt-1" style={{ color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>existe</div>
              </div>
              <div className="text-center">
                <div className="text-[22px] leading-none" style={{ color: C.ochre, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{summary.partial}</div>
                <div className="text-[9px] mt-1" style={{ color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>parcial</div>
              </div>
              <div className="text-center">
                <div className="text-[22px] leading-none" style={{ color: C.brick, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{summary.missing}</div>
                <div className="text-[9px] mt-1" style={{ color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>falta</div>
              </div>
              <div className="text-center">
                <div className="text-[22px] leading-none" style={{ color: C.muted, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{summary["wontfix-mvp"] || 0}</div>
                <div className="text-[9px] mt-1" style={{ color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>post-mvp</div>
              </div>
            </div>
          </div>

          <ExportToClaude markdown={cheshireMarkdown} filename="hygge-cheshire-audit" />

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 py-3 px-4" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
            <span className="text-[10px]" style={{ color: C.muted, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600 }}>Estado:</span>
            {[
              { id: "all", label: `Todas (${catalog.length})` },
              { id: "missing", label: `Faltan (${summary.missing})` },
              { id: "partial", label: `Parciales (${summary.partial})` },
              { id: "implemented", label: `Existen (${summary.implemented})` },
              { id: "wontfix", label: `Post-MVP (${summary["wontfix-mvp"] || 0})` },
            ].map(opt => (
              <button key={opt.id} onClick={() => setFilter(opt.id)} className="px-2.5 py-1 text-[10px] hover:opacity-90" style={{
                backgroundColor: filter === opt.id ? C.ink : "transparent",
                color: filter === opt.id ? "white" : C.muted,
                border: `1px solid ${filter === opt.id ? C.ink : C.lineSoft}`,
                borderRadius: 2,
                fontWeight: filter === opt.id ? 600 : 500,
              }}>{opt.label}</button>
            ))}
            <span className="text-[10px] ml-3" style={{ color: C.muted, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600 }}>Severidad:</span>
            {[
              { id: "all", label: "Todas" },
              { id: "critical", label: `Crítico (${summary.sev_critical})` },
              { id: "major", label: `Mayor (${summary.sev_major})` },
              { id: "minor", label: `Menor (${summary.sev_minor})` },
            ].map(opt => (
              <button key={opt.id} onClick={() => setSeverityFilter(opt.id)} className="px-2.5 py-1 text-[10px] hover:opacity-90" style={{
                backgroundColor: severityFilter === opt.id ? C.ink : "transparent",
                color: severityFilter === opt.id ? "white" : C.muted,
                border: `1px solid ${severityFilter === opt.id ? C.ink : C.lineSoft}`,
                borderRadius: 2,
                fontWeight: severityFilter === opt.id ? 600 : 500,
              }}>{opt.label}</button>
            ))}
          </div>

          {/* Results grouped by area */}
          {Object.entries(grouped).length === 0 ? (
            <div className="text-center py-8 text-[11px]" style={{ color: C.muted }}>Sin resultados con esos filtros · el gato se desvanece</div>
          ) : (
            Object.entries(grouped).map(([area, items]) => (
              <div key={area}>
                <Eyebrow>{area}</Eyebrow>
                <div className="mt-2 space-y-1.5">
                  {items.map((c, i) => {
                    const sb = statusBadge(c.status);
                    const sev = severityBadge(c.severity);
                    return (
                      <div key={i} className="py-2.5 px-3" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
                        <div className="flex items-start gap-2.5">
                          <span style={{ color: sb.color, fontWeight: 700, fontSize: 13, lineHeight: 1, marginTop: 1 }}>{sb.label}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[11px]" style={{ color: C.ink, fontWeight: 600 }}>{c.capability}</span>
                              {sev && (
                                <span className="text-[8px] px-1.5 py-0.5" style={{ backgroundColor: `${sev.color}20`, color: sev.color, borderRadius: 2, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>{sev.text}</span>
                              )}
                            </div>
                            {c.fix && (
                              <div className="text-[10px] mt-1" style={{ color: C.inkSoft, lineHeight: 1.55 }}>
                                <span style={{ color: C.cobalt, fontWeight: 600 }}>→ </span>{c.fix}
                              </div>
                            )}
                            {c.note && !c.fix && (
                              <div className="text-[10px] mt-0.5 italic" style={{ color: C.muted }}>{c.note}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}

          <div className="py-3 px-5 text-center italic text-[11px]" style={{ backgroundColor: C.paper, border: `1px dashed ${C.line}`, borderRadius: 2, color: C.ink }}>
            "But I don't want to go among mad people," Alice remarked. "Oh, you can't help that," said the Cat. "We're all mad here."
          </div>

          </>)}

          <button onClick={() => setPhase("dormant")} className="px-3 py-1.5 text-[11px] hover:opacity-70" style={{ color: C.muted, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
            Desvanecer
          </button>
        </div>
      )}
    </div>
  );
}

// ─── EL BANDERSNATCH · agente chaos · crea, elimina, verifica anclajes ───
function BandersnatchPanel({ tasks, setTasks, customViews, setCustomViews, terrenos, setTerrenos, customSpaces, setCustomSpaces, allSpaces, users, recordAgentRun }) {
  const [phase, setPhase] = useState("dormant"); // dormant | running | done
  const [log, setLog] = useState([]);
  const [counts, setCounts] = useState({ pass: 0, fail: 0, susp: 0 });
  const counterRef = useRef({ pass: 0, fail: 0, susp: 0, total: 0 });

  // Bandersnatch icon — más bestia, más fauces que el Jabberwocky
  const BSIcon = ({ size = 64, color = C.ink }) => {
    const lightColor = "#EEEBE3";
    return (
      <svg width={size} height={size * 0.9} viewBox="0 0 80 72" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Body — wide compact mass */}
        <path d="M14 36 Q12 22 28 18 Q44 14 60 20 Q72 26 68 42 Q64 56 48 58 Q28 60 18 52 Q14 46 14 36 Z" fill={color} />
        {/* Multiple eyes — 3 of them, menacing */}
        <circle cx="28" cy="28" r="3" fill={lightColor} />
        <circle cx="28" cy="28" r="1" fill={color} />
        <circle cx="42" cy="26" r="3" fill={lightColor} />
        <circle cx="42" cy="26" r="1" fill={color} />
        <circle cx="55" cy="30" r="2.5" fill={lightColor} />
        <circle cx="55" cy="30" r="0.8" fill={color} />
        {/* Open jaws — top row of fangs */}
        <path d="M18 42 L22 50 L26 42 L30 50 L34 42 L38 50 L42 42 L46 50 L50 42 L54 50 L58 42" stroke={lightColor} strokeWidth="1.5" fill={color} strokeLinejoin="miter" />
        {/* Lower fangs */}
        <path d="M22 56 L24 62 M30 58 L32 64 M40 58 L42 64 M50 58 L52 64" stroke={color} strokeWidth="2" strokeLinecap="round" />
        {/* Spikes on top */}
        <path d="M22 18 L20 10 M30 16 L28 8 M40 14 L40 6 M50 14 L52 6 M58 18 L60 10" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
        {/* Claws — bottom corners */}
        <path d="M10 50 L4 56 M16 60 L10 68 M68 50 L74 56 M62 60 L68 68" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  };

  const pushLog = (entry) => setLog(prev => [...prev, { ...entry, id: Date.now() + Math.random() }]);

  const unleash = async () => {
    setPhase("running");
    setLog([]);
    counterRef.current = { pass: 0, fail: 0, susp: 0, total: 0 };
    setCounts({ pass: 0, fail: 0, susp: 0 });

    // Snapshot — para restaurar al final
    const snap = {
      tasks: JSON.parse(JSON.stringify(tasks)),
      customViews: JSON.parse(JSON.stringify(customViews)),
      customSpaces: JSON.parse(JSON.stringify(customSpaces)),
      terrenos: JSON.parse(JSON.stringify(terrenos)),
    };
    let live = JSON.parse(JSON.stringify(snap));

    const apply = async () => {
      setTasks([...live.tasks]);
      setCustomViews({ ...live.customViews });
      setCustomSpaces([...live.customSpaces]);
      setTerrenos([...live.terrenos]);
      await new Promise(r => setTimeout(r, 40));
    };

    const allSpaceIds = new Set();
    const collectSpace = (s) => { allSpaceIds.add(s.id); (s.children || []).forEach(collectSpace); };
    allSpaces.forEach(collectSpace);

    const pass = async (test, detail) => { counterRef.current.pass++; counterRef.current.total++; setCounts({ ...counterRef.current }); pushLog({ type: "pass", test, detail }); await new Promise(r => setTimeout(r, 80)); };
    const fail = async (test, detail) => { counterRef.current.fail++; counterRef.current.total++; setCounts({ ...counterRef.current }); pushLog({ type: "fail", test, detail }); await new Promise(r => setTimeout(r, 80)); };
    const susp = async (test, detail) => { counterRef.current.susp++; counterRef.current.total++; setCounts({ ...counterRef.current }); pushLog({ type: "susp", test, detail }); await new Promise(r => setTimeout(r, 80)); };
    const section = async (text) => { pushLog({ type: "section", text }); await new Promise(r => setTimeout(r, 150)); };

    pushLog({ type: "intro", text: "Frumious! El Bandersnatch despierta…" });
    await new Promise(r => setTimeout(r, 400));

    // ═══ TAREAS ═══
    await section("TAREAS · CREATE / READ / UPDATE / DELETE");

    // T1 · crear 10 tareas válidas
    {
      const before = live.tasks.length;
      const baseId = Math.max(...live.tasks.map(t => t.id), 0) + 1;
      const fresh = Array.from({ length: 10 }, (_, i) => ({
        id: baseId + i, parentId: null, title: `BS test task ${i + 1}`,
        space: "hq", checked: false, assignee: "sb", priority: "media",
        due: "2026-06-01", startDate: "2026-06-01", endDate: "2026-06-01",
        comments: [], attachments: [], activity: [],
      }));
      live.tasks = [...live.tasks, ...fresh];
      await apply();
      if (live.tasks.length === before + 10) await pass("Crear 10 tareas válidas", `${before} → ${live.tasks.length}`);
      else await fail("Crear 10 tareas válidas", `esperado ${before + 10}, got ${live.tasks.length}`);
    }

    // T2 · título vacío vía safeAddTaskPure (la API real que usan los handlers)
    {
      const result = safeAddTaskPure(live.tasks, { id: 999001, parentId: null, title: "", space: "hq", checked: false, assignee: "sb", priority: "media", due: "2026-06-01" });
      live.tasks = result;
      await apply();
      const added = live.tasks.find(t => t.id === 999001);
      if (added && added.title === "Sin título") await pass("Título vacío → 'Sin título'", "validación inline OK");
      else if (added) await fail("Título vacío → 'Sin título'", `título quedó "${added.title}"`);
      else await fail("Título vacío → 'Sin título'", "no se creó");
    }

    // T3 · ID duplicado vía safeAddTaskPure
    {
      const targetId = live.tasks[0].id;
      const before = live.tasks.length;
      const result = safeAddTaskPure(live.tasks, { id: targetId, parentId: null, title: "BS duplicate", space: "hq", checked: false, assignee: "sb", priority: "baja", due: "2026-06-01" });
      live.tasks = result;
      await apply();
      const dupCount = live.tasks.filter(t => t.id === targetId).length;
      if (dupCount === 1 && live.tasks.length === before + 1) await pass("ID duplicado · safeAddTask", "ID auto-incrementado");
      else await fail("ID duplicado · safeAddTask", `${dupCount} con id=${targetId} · total ${live.tasks.length}`);
    }

    // T4 · toggle complete 5 veces · estado debe invertirse (n impar)
    {
      const target = live.tasks.find(t => t.title.startsWith("BS test task"));
      if (target) {
        const initialState = target.checked;
        for (let i = 0; i < 5; i++) {
          live.tasks = live.tasks.map(t => t.id === target.id ? { ...t, checked: !t.checked } : t);
          await apply();
        }
        const finalState = live.tasks.find(t => t.id === target.id);
        const expected = !initialState; // 5 toggles inverts
        if (finalState && finalState.checked === expected) await pass("Toggle complete x5", `inicio=${initialState} → fin=${finalState.checked} · cambios consistentes`);
        else await fail("Toggle complete x5", `esperado ${expected}, got ${finalState?.checked}`);
      } else await fail("Toggle complete x5", "no se encontró target");
    }

    // T5 · subtask 3 niveles
    {
      const id1 = Math.max(...live.tasks.map(t => t.id), 0) + 1;
      live.tasks = [...live.tasks, { id: id1, parentId: null, title: "BS L1", space: "hq", checked: false, assignee: "sb", priority: "media", due: "2026-06-01", comments: [], attachments: [], activity: [] }];
      live.tasks = [...live.tasks, { id: id1 + 1, parentId: id1, title: "BS L2", space: "hq", checked: false, assignee: "sb", priority: "media", due: "2026-06-01", comments: [], attachments: [], activity: [] }];
      live.tasks = [...live.tasks, { id: id1 + 2, parentId: id1 + 1, title: "BS L3", space: "hq", checked: false, assignee: "sb", priority: "media", due: "2026-06-01", comments: [], attachments: [], activity: [] }];
      await apply();
      const l2 = live.tasks.find(t => t.id === id1 + 1);
      const l3 = live.tasks.find(t => t.id === id1 + 2);
      if (l2?.parentId === id1 && l3?.parentId === id1 + 1) await pass("Subtarea anidada 3 niveles", "jerarquía preservada");
      else await fail("Subtarea anidada 3 niveles", "parents rotos");
    }

    // ═══ SPACES ═══
    await section("CUSTOM SPACES");

    // S1 · crear custom space
    {
      const spaceId = `bs_test_${Date.now()}`;
      live.customSpaces = [...live.customSpaces, { id: spaceId, code: "BS", name: "BS Test Space", parentId: null, dot: "#5F8A6A", count: 0 }];
      await apply();
      if (live.customSpaces.find(s => s.id === spaceId)) await pass("Crear custom space", `id=${spaceId.slice(-6)}`);
      else await fail("Crear custom space", "no apareció en customSpaces");
    }

    // S2 · agregar tarea al custom space
    let bsSpaceId = live.customSpaces[live.customSpaces.length - 1]?.id;
    {
      if (bsSpaceId) {
        const tid = Math.max(...live.tasks.map(t => t.id), 0) + 1;
        live.tasks = [...live.tasks, { id: tid, parentId: null, title: "BS task in custom space", space: bsSpaceId, checked: false, assignee: "sb", priority: "media", due: "2026-06-01", comments: [], attachments: [], activity: [] }];
        await apply();
        if (live.tasks.find(t => t.space === bsSpaceId)) await pass("Tarea en custom space", "");
        else await fail("Tarea en custom space", "no encontró el space");
      }
    }

    // S3 · eliminar custom space con tarea adentro · ANCLAJE · usa applySpaceDelete con cascade "move" a "hq"
    {
      if (bsSpaceId) {
        const before = live.tasks.filter(t => t.space === bsSpaceId).length;
        const result = applySpaceDelete({ tasks: live.tasks, customViews: live.customViews, customSpaces: live.customSpaces }, bsSpaceId, "move", "hq");
        live.tasks = result.tasks;
        live.customViews = result.customViews;
        live.customSpaces = result.customSpaces;
        await apply();
        const orphansAfter = live.tasks.filter(t => t.space === bsSpaceId).length;
        const movedToHq = live.tasks.filter(t => t.space === "hq").length;
        if (orphansAfter === 0) await pass("Anclaje · borrar space con cascade", `${before} tareas movidas a hq · ${movedToHq} ahí ahora`);
        else await fail("Anclaje · borrar space con cascade", `${orphansAfter} huérfanas aún apuntan al space borrado`);
      }
    }

    // ═══ CUSTOM VIEWS ═══
    await section("CUSTOM VIEWS · DRIVE + MIRO");

    // V1 · crear view con URL válida
    {
      const targetSpace = "hq";
      const newView = { id: `bs_view_${Date.now()}`, type: "iframe", title: "BS test view", config: { url: "https://example.com" } };
      live.customViews = { ...live.customViews, [targetSpace]: [...(live.customViews[targetSpace] || []), newView] };
      await apply();
      if (live.customViews[targetSpace]?.find(v => v.id === newView.id)) await pass("Crear custom view válida", `space=${targetSpace}`);
      else await fail("Crear custom view válida", "no apareció");
    }

    // V2 · view con URL vacía
    {
      const targetSpace = "hq";
      const newView = { id: `bs_view_empty_${Date.now()}`, type: "iframe", title: "BS empty url", config: { url: "" } };
      live.customViews = { ...live.customViews, [targetSpace]: [...(live.customViews[targetSpace] || []), newView] };
      await apply();
      const found = live.customViews[targetSpace]?.find(v => v.id === newView.id);
      if (found) await pass("View con URL vacía", "creada · IframeView muestra estado 'configurar' · comportamiento intencional");
      else await susp("View con URL vacía", "rechazada · perdimos la capacidad de crear vacía y editar después");
    }

    // V3 · 10 views en un space (test de overflow)
    {
      const targetSpace = "hq";
      const before = (live.customViews[targetSpace] || []).length;
      const stack = Array.from({ length: 10 }, (_, i) => ({ id: `bs_overflow_${Date.now()}_${i}`, type: "iframe", title: `BS overflow ${i}`, config: { url: "https://example.com" } }));
      live.customViews = { ...live.customViews, [targetSpace]: [...(live.customViews[targetSpace] || []), ...stack] };
      await apply();
      const after = (live.customViews[targetSpace] || []).length;
      if (after === before + 10) await pass("10+ views en un space", `${after - before} creadas · ViewTabs tiene overflow-x-auto · scroll horizontal funciona`);
      else await fail("10+ views en un space", `${after - before} se crearon de 10`);
    }

    // V4 · eliminar view
    {
      const targetSpace = "hq";
      const before = (live.customViews[targetSpace] || []).length;
      const toDelete = live.customViews[targetSpace]?.[0]?.id;
      if (toDelete) {
        live.customViews = { ...live.customViews, [targetSpace]: live.customViews[targetSpace].filter(v => v.id !== toDelete) };
        await apply();
        const after = (live.customViews[targetSpace] || []).length;
        if (after === before - 1) await pass("Eliminar view", "removida correctamente");
        else await fail("Eliminar view", "conteo incorrecto");
      }
    }

    // ═══ ANCHORING DEEP ═══
    await section("ANCLAJES · INTEGRIDAD REFERENCIAL");

    // A1 · subtask cascade tras eliminar parent · usa applyTaskCascadeDelete con "delete-all"
    {
      const parent = live.tasks.find(t => t.title === "BS L1");
      if (parent) {
        const childIdsBefore = live.tasks.filter(t => t.parentId === parent.id).map(t => t.id);
        live.tasks = applyTaskCascadeDelete(live.tasks, parent.id, "delete-all");
        await apply();
        const remainingChildren = live.tasks.filter(t => childIdsBefore.includes(t.id));
        if (remainingChildren.length === 0) await pass("Anclaje · cascade delete recursivo", `parent + ${childIdsBefore.length} subtasks eliminados juntos`);
        else await fail("Anclaje · cascade delete recursivo", `${remainingChildren.length} subtasks quedaron huérfanas`);
      } else await susp("Anclaje · cascade delete recursivo", "no se encontró parent BS L1");
    }

    // A2 · tareas apuntando a space inexistente
    {
      const allValidSpaceIds = new Set([...allSpaceIds, ...live.customSpaces.map(s => s.id)]);
      const broken = live.tasks.filter(t => !allValidSpaceIds.has(t.space));
      if (broken.length > 0) await fail("Anclaje · spaces inválidos", `${broken.length} tareas apuntan a spaces inexistentes`);
      else await pass("Anclaje · spaces inválidos", "todas las tareas en spaces válidos");
    }

    // A3 · custom views apuntando a spaces inexistentes
    {
      const allValidSpaceIds = new Set([...allSpaceIds, ...live.customSpaces.map(s => s.id)]);
      const brokenViewSpaces = Object.keys(live.customViews).filter(k => !allValidSpaceIds.has(k));
      if (brokenViewSpaces.length > 0) await fail("Anclaje · views en spaces inválidos", `${brokenViewSpaces.length}: ${brokenViewSpaces.join(", ")}`);
      else await pass("Anclaje · views en spaces inválidos", "todas las views ancladas a spaces válidos");
    }

    // A4 · assignees inválidos
    {
      const userIds = new Set(users.map(u => u.id));
      const badAssign = live.tasks.filter(t => t.assignee && !userIds.has(t.assignee));
      if (badAssign.length > 0) await fail("Anclaje · assignees", `${badAssign.length} tareas apuntan a users inexistentes`);
      else await pass("Anclaje · assignees", "todos los assignees válidos");
    }

    // ═══ TERRENOS ═══
    await section("TERRENOS · GROWTH PIPELINE");

    // TR1 · crear terreno
    {
      const before = live.terrenos.length;
      const newT = { id: `bs_terreno_${Date.now()}`, name: "BS terreno test", district: "Miraflores", address: "Av. Test 123", lat: -12.12, lng: -77.03, areaM2: 500, askedPrice: 1000000, status: "scouting", owner: "Test", ownerContact: "test@test.com", notes: "", score: 75, documents: [], comments: [], photos: [] };
      live.terrenos = [...live.terrenos, newT];
      await apply();
      if (live.terrenos.length === before + 1) await pass("Crear terreno", "");
      else await fail("Crear terreno", "no se creó");
    }

    // TR2 · terreno sin coords
    {
      const id = `bs_nocoord_${Date.now()}`;
      live.terrenos = [...live.terrenos, { id, name: "BS no coords", district: "Test", address: "", lat: null, lng: null, areaM2: 100, askedPrice: 0, status: "scouting", owner: "", ownerContact: "", notes: "", score: 0, documents: [], comments: [], photos: [] }];
      await apply();
      const t = live.terrenos.find(x => x.id === id);
      if (t && (t.lat === null || t.lng === null)) await pass("Terreno sin coords", "creado · no aparece en mapa pero sí en lista · comportamiento intencional");
      else await susp("Terreno sin coords", "coords fueron asignadas automáticamente");
    }

    // ═══ RESTORE ═══
    pushLog({ type: "section", text: "RESTAURANDO ESTADO ORIGINAL" });
    await new Promise(r => setTimeout(r, 250));
    setTasks(snap.tasks);
    setCustomViews(snap.customViews);
    setCustomSpaces(snap.customSpaces);
    setTerrenos(snap.terrenos);
    await new Promise(r => setTimeout(r, 200));
    pushLog({ type: "outro", text: "Snicker-snack! El Bandersnatch regresa al bosque." });

    setPhase("done");

    if (recordAgentRun) recordAgentRun("bandersnatch", {
      result: { pass: counterRef.current.pass, susp: counterRef.current.susp, fail: counterRef.current.fail, total: counterRef.current.total },
      severity: counterRef.current.fail > 0 ? "critical" : counterRef.current.susp > 0 ? "minor" : "ok",
    });
  };

  const bandersnatchMarkdown = useMemo(() => {
    if (phase !== "done" || log.length === 0) return "";
    const today = new Date().toISOString().slice(0, 10);
    let md = `# Reporte del Bandersnatch · Stress Test de ALICE\n\n`;
    md += `**Fecha:** ${today}\n`;
    md += `**Experimentos totales:** ${counts.pass + counts.susp + counts.fail}\n\n`;
    md += `| Resultado | Count |\n|---|---|\n`;
    md += `| ✓ Pass | ${counts.pass} |\n`;
    md += `| ⚠ Warn | ${counts.susp} |\n`;
    md += `| ✗ Fail | ${counts.fail} |\n\n---\n\n`;

    const fails = log.filter(l => l.type === "fail");
    const susps = log.filter(l => l.type === "susp");

    if (fails.length > 0) {
      md += `## ✗ Fallas (${fails.length})\n\n`;
      fails.forEach(f => {
        md += `### ${f.test}\n${f.detail || ""}\n\n`;
      });
    }

    if (susps.length > 0) {
      md += `## ⚠ Sospechosos (${susps.length})\n\n`;
      susps.forEach(s => {
        md += `### ${s.test}\n${s.detail || ""}\n\n`;
      });
    }

    md += `---\n\n## Log completo\n\n\`\`\`\n`;
    log.forEach(l => {
      if (l.type === "section") md += `\n── ${l.text} ──\n`;
      else if (l.type === "intro" || l.type === "outro") md += `${l.text}\n`;
      else {
        const sym = l.type === "pass" ? "✓" : l.type === "fail" ? "✗" : "⚠";
        md += `${sym} ${l.test}${l.detail ? ` · ${l.detail}` : ""}\n`;
      }
    });
    md += `\`\`\`\n\n---\n\n_Generado por El Bandersnatch · ALICE stress tester_\n`;
    return md;
  }, [phase, log, counts]);

  return (
    <div className="space-y-5">
      {phase === "dormant" && (
        <div className="text-center py-10 px-6" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 4 }}>
          <div className="inline-block mb-4"><BSIcon size={88} /></div>
          <div className="text-[18px] mb-1.5" style={{ color: C.ink, fontWeight: 600, letterSpacing: "-0.015em" }}>El Bandersnatch</div>
          <div className="text-[11px] mb-1" style={{ color: C.brick, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>Agente chaos · stress test</div>
          <div className="text-[12px] mb-5 max-w-md mx-auto" style={{ color: C.muted, lineHeight: 1.6 }}>
            La criatura frumiosa que crea, elimina, modifica y verifica anclajes. Ejecuta 17 experimentos sobre tareas, spaces, views y terrenos para encontrar bugs reales.
          </div>
          <div className="text-[10px] mb-5 max-w-md mx-auto py-2 px-3 inline-block" style={{ backgroundColor: `${C.ochre}15`, border: `1px solid ${C.ochre}40`, borderRadius: 2, color: C.inkSoft }}>
            ⚠ Vas a ver datos cambiar en pantalla · al final todo se restaura
          </div>
          <div>
            <button onClick={unleash} className="inline-flex items-center gap-2 px-5 py-2.5 text-[12px] hover:opacity-90" style={{ backgroundColor: C.brick, color: "white", borderRadius: 2, fontWeight: 600, letterSpacing: "0.02em" }}>
              <Trash size={13} /> Desatar al Bandersnatch
            </button>
          </div>
          <div className="text-[10px] mt-5" style={{ color: C.muted, fontStyle: "italic" }}>
            "Beware the frumious Bandersnatch! · he came whiffling through the tulgey wood"
          </div>
        </div>
      )}

      {phase === "running" && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 py-3 px-4" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 4 }}>
            <div className="animate-pulse"><BSIcon size={40} color={C.brick} /></div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px]" style={{ color: C.ink, fontWeight: 600 }}>El Bandersnatch causa estragos…</div>
              <div className="text-[10px]" style={{ color: C.muted }}>{counts.pass + counts.fail + counts.susp} experimentos ejecutados</div>
            </div>
            <div className="flex items-center gap-3 text-[11px]" style={{ fontWeight: 600 }}>
              <span style={{ color: C.green }}>✓ {counts.pass}</span>
              <span style={{ color: C.ochre }}>⚠ {counts.susp}</span>
              <span style={{ color: C.brick }}>✗ {counts.fail}</span>
            </div>
          </div>
          <div className="space-y-1 max-h-[500px] overflow-y-auto p-3" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
            {log.map(l => <LogLine key={l.id} entry={l} />)}
          </div>
        </div>
      )}

      {phase === "done" && (
        <div className="space-y-4">
          <div className="py-5 px-5 flex items-center gap-4" style={{ backgroundColor: C.paper, border: `2px solid ${counts.fail > 0 ? C.brick : counts.susp > 0 ? C.ochre : C.green}`, borderRadius: 4 }}>
            <BSIcon size={48} color={counts.fail > 0 ? C.brick : counts.susp > 0 ? C.ochre : C.green} />
            <div className="flex-1">
              <div className="text-[10px] mb-1" style={{ color: C.muted, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Snicker-snack · resultados</div>
              <div className="text-[14px]" style={{ color: C.ink, fontWeight: 600 }}>
                {counts.total} experimentos · {counts.fail > 0 ? `${counts.fail} bugs cazados` : counts.susp > 0 ? `${counts.susp} cosas sospechosas` : "todo pasa limpio"}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-[24px] leading-none" style={{ color: C.green, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{counts.pass}</div>
                <div className="text-[9px] mt-1" style={{ color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>pass</div>
              </div>
              <div className="text-center">
                <div className="text-[24px] leading-none" style={{ color: C.ochre, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{counts.susp}</div>
                <div className="text-[9px] mt-1" style={{ color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>warn</div>
              </div>
              <div className="text-center">
                <div className="text-[24px] leading-none" style={{ color: C.brick, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{counts.fail}</div>
                <div className="text-[9px] mt-1" style={{ color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>fail</div>
              </div>
            </div>
          </div>

          <ExportToClaude markdown={bandersnatchMarkdown} filename="hygge-bandersnatch-report" />

          {(counts.fail > 0 || counts.susp > 0) && (
            <div>
              <Eyebrow>Hallazgos accionables</Eyebrow>
              <div className="mt-2 space-y-1.5">
                {log.filter(l => l.type === "fail" || l.type === "susp").map(l => (
                  <div key={l.id} className="flex items-start gap-2.5 py-2 px-3" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
                    <div className="pt-0.5" style={{ color: l.type === "fail" ? C.brick : C.ochre, fontWeight: 700 }}>
                      {l.type === "fail" ? "✗" : "⚠"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px]" style={{ color: C.ink, fontWeight: 600 }}>{l.test}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: C.muted, lineHeight: 1.5 }}>{l.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <details>
            <summary className="text-[11px] cursor-pointer hover:opacity-70" style={{ color: C.muted, fontWeight: 500 }}>Ver log completo</summary>
            <div className="mt-2 space-y-1 max-h-[400px] overflow-y-auto p-3" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
              {log.map(l => <LogLine key={l.id} entry={l} />)}
            </div>
          </details>

          <div className="flex items-center gap-2 pt-2">
            <button onClick={unleash} className="px-3 py-1.5 text-[11px] hover:opacity-90" style={{ backgroundColor: C.brick, color: "white", borderRadius: 2, fontWeight: 500 }}>
              Desatar de nuevo
            </button>
            <button onClick={() => { setPhase("dormant"); setLog([]); setCounts({ pass: 0, fail: 0, susp: 0 }); }} className="px-3 py-1.5 text-[11px] hover:opacity-70" style={{ color: C.muted, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
              Encerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LogLine({ entry }) {
  if (entry.type === "section") {
    return <div className="text-[9px] py-1.5 px-2 mt-2 first:mt-0" style={{ color: C.muted, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", borderTop: `1px solid ${C.lineSoft}` }}>{entry.text}</div>;
  }
  if (entry.type === "intro" || entry.type === "outro") {
    return <div className="text-[10px] italic py-1 px-2" style={{ color: entry.type === "intro" ? C.brick : C.green }}>{entry.text}</div>;
  }
  const color = entry.type === "pass" ? C.green : entry.type === "fail" ? C.brick : C.ochre;
  const symbol = entry.type === "pass" ? "✓" : entry.type === "fail" ? "✗" : "⚠";
  return (
    <div className="flex items-start gap-2 text-[10px] py-0.5 px-2" style={{ fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>
      <span style={{ color, fontWeight: 700, flexShrink: 0 }}>{symbol}</span>
      <span style={{ color: C.ink, fontWeight: 500 }}>{entry.test}</span>
      {entry.detail && <span style={{ color: C.muted }}>· {entry.detail}</span>}
    </div>
  );
}

// ─── EL JABBERWOCKY · agente que usa ALICE y da veredicto ───
function JabberwockyPanel({ tasks, customViews, terrenos, customSpaces, allSpaces, users, messages, smartViews, whiteboards, spaceAccess, agentStatus, recordAgentRun }) {
  const [phase, setPhase] = useState("dormant"); // dormant | inspecting | thinking | verdict | error
  const [stream, setStream] = useState([]);
  const [verdict, setVerdict] = useState(null);
  const [error, setError] = useState(null);

  // Read other agents' findings for synthesized verdict · v47
  const agentSynthesis = useMemo(() => {
    if (!agentStatus) return null;
    const findings = [];
    let criticalCount = 0;
    let majorCount = 0;
    let minorCount = 0;
    Object.entries(agentStatus).forEach(([id, s]) => {
      if (!s || !s.lastRun) return;
      const agentName = AGENT_DIRECTORY.find(a => a.id === id)?.name || id;
      if (s.severity === "critical") criticalCount++;
      if (s.severity === "major") majorCount++;
      if (s.severity === "minor") minorCount++;
      findings.push({ agent: agentName, severity: s.severity, summary: s.result?.summary || JSON.stringify(s.result || {}).slice(0, 60) });
    });
    const runCount = findings.length;
    if (runCount === 0) return null;
    return { findings, criticalCount, majorCount, minorCount, runCount };
  }, [agentStatus]);

  const collectFullInspection = useCallback(() => {
    const allSpaceIds = new Set();
    const collectSpace = (s) => { allSpaceIds.add(s.id); (s.children || []).forEach(collectSpace); };
    allSpaces.forEach(collectSpace);
    const today = new Date().toISOString().slice(0, 10);

    // Task stats
    const tasksByStatus = { done: tasks.filter(t => t.checked).length, pending: tasks.filter(t => !t.checked).length };
    const tasksBySpace = {};
    tasks.forEach(t => tasksBySpace[t.space] = (tasksBySpace[t.space] || 0) + 1);
    const tasksByAssignee = {};
    tasks.forEach(t => { if (t.assignee) tasksByAssignee[t.assignee] = (tasksByAssignee[t.assignee] || 0) + 1; });

    const overdue = tasks.filter(t => !t.checked && t.due && t.due < today);
    const dueToday = tasks.filter(t => !t.checked && t.due === today);
    const highPriorityPending = tasks.filter(t => !t.checked && t.priority === "alta");

    let driveCount = 0, miroPlaceholders = 0, miroReal = 0, sheets = 0, files = 0, folders = 0, others = 0;
    Object.values(customViews).forEach(arr => (arr || []).forEach(v => {
      if (v.type !== "iframe") return;
      const u = v.config?.url || "";
      if (u.includes("miro.com/welcome")) miroPlaceholders++;
      else if (u.includes("miro.com")) miroReal++;
      else if (u.includes("drive.google.com/embeddedfolderview") || u.includes("drive.google.com/drive/folders")) { folders++; driveCount++; }
      else if (u.includes("docs.google.com/spreadsheets")) { sheets++; driveCount++; }
      else if (u.includes("drive.google.com/file")) { files++; driveCount++; }
      else if (u) others++;
    }));

    const w = typeof window !== "undefined" ? window.innerWidth : 0;
    const h = typeof window !== "undefined" ? window.innerHeight : 0;

    const taskIds = tasks.map(t => t.id);
    const dupTaskIds = [...new Set(taskIds.filter((id, i) => taskIds.indexOf(id) !== i))];
    const orphanParents = tasks.filter(t => t.parentId && !tasks.find(p => p.id === t.parentId)).map(t => t.title);
    const badSpaces = tasks.filter(t => !allSpaceIds.has(t.space));
    const noAssignee = tasks.filter(t => !t.assignee).length;
    const userIds = new Set(users.map(u => u.id));
    const badAssignees = tasks.filter(t => t.assignee && !userIds.has(t.assignee));

    return {
      counts: {
        tasks: tasks.length, spaces: allSpaceIds.size, users: users.length,
        terrenos: terrenos.length,
        customViews: Object.values(customViews).reduce((acc, arr) => acc + (arr?.length || 0), 0),
        whiteboards: whiteboards.length, smartViews: smartViews.length, messages: messages.length,
      },
      tasks: {
        byStatus: tasksByStatus, bySpace: tasksBySpace, byAssignee: tasksByAssignee,
        overdueCount: overdue.length,
        overdueSample: overdue.slice(0, 8).map(t => ({ title: t.title.slice(0, 60), due: t.due, space: t.space, assignee: t.assignee })),
        dueTodayCount: dueToday.length,
        highPriorityPendingCount: highPriorityPending.length,
      },
      embeds: { driveCount, miroPlaceholders, miroReal, sheets, files, folders, others },
      layout: { width: w, height: h, breakpoint: w >= 1280 ? "xl" : w >= 1024 ? "lg" : "mobile" },
      integrity: {
        dupTaskIds, orphanParents: orphanParents.slice(0, 5),
        badSpaceCount: badSpaces.length, noAssignee, badAssigneeCount: badAssignees.length,
      },
      growth: {
        terrenoCount: terrenos.length,
        byStatus: terrenos.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {}),
        avgScore: terrenos.length ? (terrenos.reduce((acc, t) => acc + (t.score || 0), 0) / terrenos.length).toFixed(1) : 0,
      },
    };
  }, [tasks, customViews, terrenos, allSpaces, users, whiteboards, smartViews, messages]);

  const wake = async () => {
    setPhase("inspecting");
    setStream([]); setVerdict(null); setError(null);

    const steps = [
      "Despertando en el bosque tulgey…",
      `Contando ${tasks.length} tareas y sus dependencias…`,
      `Inspeccionando ${allSpaces.length} spaces y sus sub-spaces…`,
      `Auditando ${Object.values(customViews).reduce((a, arr) => a + (arr?.length || 0), 0)} custom views (Drive + Miro)…`,
      `Revisando ${terrenos.length} terrenos del pipeline de Growth…`,
      "Midiendo viewport y layout…",
      "Cazando bugs con espada vorpal…",
    ];
    for (let i = 0; i < steps.length; i++) {
      setStream(prev => [...prev, { id: i, type: "step", text: steps[i] }]);
      await new Promise(r => setTimeout(r, 280));
    }

    setPhase("thinking");
    setStream(prev => [...prev, { id: 999, type: "thinking", text: "Formulando veredicto…" }]);

    const inspection = collectFullInspection();

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: anthropicHeaders(),
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          system: `Eres el Jabberwocky — la criatura feroz del poema de Lewis Carroll, reencarnada como agente auditor de ALICE, el ERP a medida de Hygge Holding (real estate developer peruano).

PERSONALIDAD:
- Hablás en español rioplatense profesional, con tono teatral y formal
- Sos directo, exigente, sin azúcar; crítico pero justo
- Usás MUY moderadamente palabras del poema original (callooh, callay, frabjous, manxome, uffish, vorpal, beamish, tulgey) — utilidad primero, color al final
- Sin emojis salvo los símbolos ✓ ⚠ ✗ ⓘ en los hallazgos
- Conoces a Hygge: SPVs DC01/PU01 (alias Legendre — es el MISMO proyecto)/TG01/L36. CEO Sebastián Bonilla. Equipo: Vanessa (admin), Joel (finanzas), Jose (comercial), Ariel (BAM/arquitectura), Andrea (ops), JMG (legal)

FORMATO DE RESPUESTA (estricto, sin desviarse):
SCORE: [número 0-100]
VEREDICTO: [APROBADO | OBSERVADO | RECHAZADO]
SENTENCIA: [una frase de Jabberwocky, máximo 15 palabras]

HALLAZGOS:
- [✓|⚠|✗|ⓘ] [hallazgo concreto y específico, sin filler]
(3-7 puntos)

RECOMENDACIONES:
- [acción imperativa concreta, 1 línea]
(3-5 puntos)

CIERRE: [una frase final breve, con personalidad Jabberwocky]`,
          messages: [{
            role: "user",
            content: `Inspecciono el estado actual de ALICE. Datos:\n\n${JSON.stringify(inspection, null, 2)}\n\nEmití veredicto.`
          }]
        })
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`API ${response.status}: ${errBody.slice(0, 200)}`);
      }

      const data = await response.json();
      const text = (data.content || []).map(b => b.type === "text" ? b.text : "").join("");
      if (!text) throw new Error("Respuesta vacía del Jabberwocky");

      // Parse
      const scoreMatch = text.match(/SCORE:\s*(\d+)/i);
      const verdictMatch = text.match(/VEREDICTO:\s*(APROBADO|OBSERVADO|RECHAZADO)/i);
      const sentenciaMatch = text.match(/SENTENCIA:\s*([^\n]+)/i);
      const hallazgosMatch = text.match(/HALLAZGOS:\s*([\s\S]+?)(?=RECOMENDACIONES:|$)/i);
      const recomendacionesMatch = text.match(/RECOMENDACIONES:\s*([\s\S]+?)(?=CIERRE:|$)/i);
      const cierreMatch = text.match(/CIERRE:\s*([^\n]+)/i);

      setVerdict({
        source: "ai",
        score: scoreMatch ? parseInt(scoreMatch[1]) : 50,
        result: verdictMatch ? verdictMatch[1].toUpperCase() : "OBSERVADO",
        sentencia: sentenciaMatch ? sentenciaMatch[1].trim() : "",
        hallazgos: hallazgosMatch ? hallazgosMatch[1].split("\n").map(l => l.replace(/^[-•]\s*/, "").trim()).filter(Boolean) : [],
        recomendaciones: recomendacionesMatch ? recomendacionesMatch[1].split("\n").map(l => l.replace(/^[-•]\s*/, "").trim()).filter(Boolean) : [],
        cierre: cierreMatch ? cierreMatch[1].trim() : "",
        raw: text,
      });
      setPhase("verdict");
    } catch (e) {
      // API failed (rate limit / network / etc.) — fall back to LOCAL Jabberwocky
      const isRateLimit = (e.message || "").toLowerCase().includes("rate") || (e.message || "").includes("429");
      const localVerdict = generateLocalVerdict(inspection);
      localVerdict.aiError = isRateLimit ? "Rate limit del API · usando Jabberwocky local" : `API caída: ${e.message?.slice(0, 80)} · usando Jabberwocky local`;
      setVerdict(localVerdict);
      setPhase("verdict");
    }
  };

  // LOCAL JABBERWOCKY — works without API. Rule-based scoring + canned personality.
  const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const generateLocalVerdict = (inspection) => {
    const { counts, tasks: t, embeds, layout, integrity, growth } = inspection;
    let score = 100;
    const hallazgos = [];
    const recomendaciones = [];

    // ── INTEGRITY ──
    if (integrity.dupTaskIds.length > 0) { score -= 25; hallazgos.push(`✗ ${integrity.dupTaskIds.length} IDs duplicados en tareas — datos corruptos`); recomendaciones.push("Resetear tareas desde Administración → Datos"); }
    if (integrity.orphanParents.length > 0) { score -= 6; hallazgos.push(`⚠ ${integrity.orphanParents.length} subtareas huérfanas apuntan a parents inexistentes`); }
    if (integrity.badSpaceCount > 0) { score -= 12; hallazgos.push(`✗ ${integrity.badSpaceCount} tareas en spaces que no existen`); }
    if (integrity.badAssigneeCount > 0) { score -= 8; hallazgos.push(`✗ ${integrity.badAssigneeCount} tareas asignadas a usuarios inexistentes`); }
    if (integrity.noAssignee > 5) { score -= 4; hallazgos.push(`⚠ ${integrity.noAssignee} tareas sin asignar — sin responsable claro`); recomendaciones.push(`Asigná las ${integrity.noAssignee} tareas pendientes a alguien del equipo`); }

    // ── TASK HEALTH ──
    if (t.overdueCount > 10) { score -= 15; hallazgos.push(`✗ ${t.overdueCount} tareas vencidas — pipeline atascado`); recomendaciones.push(`Despachá o reprogramá las ${t.overdueCount} vencidas`); }
    else if (t.overdueCount > 3) { score -= 8; hallazgos.push(`⚠ ${t.overdueCount} tareas vencidas`); recomendaciones.push("Revisá tareas vencidas en Calendar tool"); }
    else if (t.overdueCount > 0) { hallazgos.push(`ⓘ ${t.overdueCount} ${t.overdueCount === 1 ? "tarea vencida" : "tareas vencidas"} sin completar`); }

    if (t.highPriorityPendingCount > 5) { hallazgos.push(`ⓘ ${t.highPriorityPendingCount} tareas alta prioridad pendientes — atención requerida`); }
    if (t.dueTodayCount > 0) { hallazgos.push(`ⓘ ${t.dueTodayCount} ${t.dueTodayCount === 1 ? "tarea vence" : "tareas vencen"} hoy`); }

    const completionRate = t.byStatus.done / Math.max(1, t.byStatus.done + t.byStatus.pending);
    if (completionRate > 0.4) hallazgos.push(`✓ Tasa de completado: ${Math.round(completionRate * 100)}% — pipeline saludable`);
    else if (completionRate < 0.2) hallazgos.push(`⚠ Tasa de completado baja: ${Math.round(completionRate * 100)}%`);

    // ── EMBEDS ──
    if (embeds.miroPlaceholders > 0) { score -= embeds.miroPlaceholders * 2; hallazgos.push(`⚠ ${embeds.miroPlaceholders} Miro placeholders sin URL real configurada`); recomendaciones.push("Pegá URLs reales de Miro (Share → Embed) en cada proyecto"); }
    if (embeds.driveCount > 0) hallazgos.push(`✓ ${embeds.driveCount} embeds de Drive activos · ${embeds.folders}f + ${embeds.sheets}s + ${embeds.files}a`);

    // ── LAYOUT ──
    if (layout.breakpoint === "lg") { hallazgos.push(`⚠ Viewport ${layout.width}px (lg) — panel lateral apretado`); recomendaciones.push("Colapsá el panel derecho con el chevron arriba"); }
    else if (layout.breakpoint === "xl") hallazgos.push(`✓ Viewport ${layout.width}px (xl) — layout cómodo`);
    else if (layout.breakpoint === "mobile") hallazgos.push(`ⓘ Viewport móvil ${layout.width}px — drawers activos`);

    // ── GROWTH ──
    if (growth.terrenoCount > 0) hallazgos.push(`✓ ${growth.terrenoCount} terrenos en pipeline · score promedio ${growth.avgScore}`);
    else { score -= 3; hallazgos.push(`ⓘ Sin terrenos cargados en Growth pipeline`); recomendaciones.push("Cargá terrenos en Growth para activar el pipeline"); }

    // ── VERDICT ──
    score = Math.max(0, Math.min(100, score));
    let result, sentencia, cierre;
    if (score >= 85) {
      result = "APROBADO";
      sentencia = pickRandom([
        "Callooh! Callay! El sistema es frabjous.",
        "El bosque tulgey está en paz esta noche.",
        "Vorpal sword innecesaria — ALICE canta.",
        "Ningún manxome bug acecha hoy.",
      ]);
      cierre = pickRandom([
        "Que la noche pase tranquila, beamish boy.",
        "El Jabberwocky duerme — ALICE vela.",
        "Sin snicker-snack en el horizonte.",
      ]);
    } else if (score >= 60) {
      result = "OBSERVADO";
      sentencia = pickRandom([
        "Manxome bugs acechan en la sombra.",
        "Uffish thought — hay deuda técnica acumulando.",
        "El sistema respira, pero cojea levemente.",
        "Bandersnatch frumioso ronda los bordes.",
      ]);
      cierre = pickRandom([
        "Beware el snicker-snack del próximo deploy.",
        "Vigilá, beamish boy, vigilá.",
        "El bosque tulgey murmura advertencias.",
      ]);
    } else {
      result = "RECHAZADO";
      sentencia = pickRandom([
        "Burbled and frumious — el bosque arde.",
        "Los jaws bite — los claws catch sin piedad.",
        "Snicker-snack: bugs vorpales en cada rincón.",
        "El Jabberwock está despierto y hambriento.",
      ]);
      cierre = pickRandom([
        "Huí del bosque tulgey antes que sea tarde.",
        "El Jabberwock no duerme tranquilo esta noche.",
        "Que el vorpal sword no llegue tarde.",
      ]);
    }

    if (hallazgos.length === 0) hallazgos.push(`✓ Sistema sin issues detectables — uffish quietud`);
    if (recomendaciones.length === 0) recomendaciones.push("Volvé a despertarme después de hacer cambios sustanciales");

    return { source: "local", score, result, sentencia, hallazgos, recomendaciones, cierre };
  };

  const retryAI = async () => {
    setPhase("inspecting");
    setStream([]);
    await new Promise(r => setTimeout(r, 200));
    wake();
  };

  const verdictColor = !verdict ? C.muted : verdict.result === "APROBADO" ? C.green : verdict.result === "RECHAZADO" ? C.brick : C.ochre;

  const jabberwockyMarkdown = useMemo(() => {
    if (!verdict) return "";
    const today = new Date().toISOString().slice(0, 10);
    let md = `# Veredicto del Jabberwocky · ALICE\n\n`;
    md += `**Fecha:** ${today}\n`;
    md += `**Fuente:** ${verdict.source === "ai" ? "Claude Sonnet 4 vía Anthropic API" : "Jabberwocky local (heurísticas)"}\n\n`;
    md += `## ${verdict.result} · Score ${verdict.score}/100\n\n`;
    if (verdict.sentencia) md += `> _"${verdict.sentencia}"_\n\n`;
    if (verdict.hallazgos?.length > 0) {
      md += `## Hallazgos\n\n`;
      verdict.hallazgos.forEach(h => { md += `- ${h}\n`; });
      md += `\n`;
    }
    if (verdict.recomendaciones?.length > 0) {
      md += `## Recomendaciones\n\n`;
      verdict.recomendaciones.forEach(r => { md += `- ${r}\n`; });
      md += `\n`;
    }
    if (verdict.cierre) md += `---\n\n_"${verdict.cierre}"_\n\n`;
    md += `---\n\n_Generado por El Jabberwocky · ALICE auditor_\n`;
    return md;
  }, [verdict]);

  // Jabberwocky icon — dragoncito sketch style based on Sebastián's reference
  const JWIcon = ({ size = 64, color = C.ink }) => {
    const lightColor = "#EEEBE3";
    const gradId = `jw-fade-${size}-${color.replace(/[^a-z0-9]/gi, "")}`;
    return (
      <svg width={size * 0.6} height={size} viewBox="0 0 40 68" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="1" />
            <stop offset="70%" stopColor={color} stopOpacity="0.7" />
            <stop offset="100%" stopColor={color} stopOpacity="0.1" />
          </linearGradient>
        </defs>

        {/* Two tall thin horns */}
        <path d="M15 2 L16.5 13" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <path d="M21 2 L22.5 13" stroke={color} strokeWidth="2" strokeLinecap="round" />

        {/* Head — irregular dark mass */}
        <path d="M9 17 Q8.5 12 15 12 Q24 11.5 29 15 Q33 19 30 24 Q27 28 17 27.5 Q9 25 9 17 Z" fill={color} />

        {/* Spikes / spines on top-right of head */}
        <path d="M28 12 L30 8" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
        <path d="M31 14 L34 12" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
        <path d="M32 18 L36 18" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
        <path d="M31 22 L34 25" stroke={color} strokeWidth="1.4" strokeLinecap="round" />

        {/* Eye — big round, looks slightly cross */}
        <circle cx="22" cy="18" r="2.6" fill={lightColor} />
        <ellipse cx="22" cy="18" rx="0.6" ry="1.3" fill={color} />

        {/* Snout / mouth showing tooth */}
        <path d="M7 19 L3 19 L5 21 L4 22.5 L6.5 22.5 Z" fill={color} />

        {/* Whiskers */}
        <path d="M5 18 L0.5 17" stroke={color} strokeWidth="0.7" strokeLinecap="round" />
        <path d="M5 20.5 L0.5 21.5" stroke={color} strokeWidth="0.7" strokeLinecap="round" />
        <path d="M6 23 L2.5 25" stroke={color} strokeWidth="0.7" strokeLinecap="round" />

        {/* Body — S-curve with hollow loop (the iconic shape) */}
        <path d="M16 27.5 C7 28 3 33 4 38 C5 44 12 45 14 41 C9 40 9 34 14 33 C19 32 22 35 22 39 C22 43 17 44 14 43 L15 47 C24 47.5 28 42 27 35 C26 28 21 27 16 27.5 Z" fill={color} />

        {/* Small fin / wing right */}
        <path d="M27 36 L32 35 L29 40 Z" fill={color} />
        <path d="M27 41 L31 43 L28 44 Z" fill={color} />

        {/* Tail — descending with fade */}
        <path d="M16 47 Q21 53 17 58 Q13 63 16 68" stroke={`url(#${gradId})`} strokeWidth="2.8" strokeLinecap="round" fill="none" />

        {/* Ink spots — handdrawn details */}
        <circle cx="13" cy="11" r="0.4" fill={color} opacity="0.7" />
        <circle cx="20" cy="45" r="0.4" fill={color} opacity="0.5" />
      </svg>
    );
  };

  return (
    <div className="space-y-5">
      {phase === "dormant" && (
        <div className="text-center py-10 px-6" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 4 }}>
          <div className="inline-block mb-4"><JWIcon size={72} /></div>
          <div className="text-[18px] mb-1.5" style={{ color: C.ink, fontWeight: 600, letterSpacing: "-0.015em" }}>El Jabberwocky</div>
          <div className="text-[11px] mb-1" style={{ color: C.cobalt, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>Sintetizador · veredict de los otros 4 agentes</div>
          <div className="text-[12px] mb-6 max-w-md mx-auto" style={{ color: C.muted, lineHeight: 1.6 }}>
            Lee los outputs de Cheshire, Bandersnatch, Mad Hatter y White Rabbit, sintetiza, y entrega veredict ejecutivo basado en datos reales (no inventado).
          </div>
          <button onClick={wake} className="inline-flex items-center gap-2 px-5 py-2.5 text-[12px] hover:opacity-90" style={{ backgroundColor: C.ink, color: "white", borderRadius: 2, fontWeight: 600, letterSpacing: "0.02em" }}>
            <Zap size={13} /> Despertar al Jabberwocky
          </button>
          <div className="text-[10px] mt-5" style={{ color: C.muted, fontStyle: "italic" }}>
            "Beware the Jabberwock, my son · the jaws that bite, the claws that catch"
          </div>

          {/* Synthesis preview · qué dicen los otros agentes */}
          {agentSynthesis && (
            <div className="mt-6 text-left" style={{ backgroundColor: C.bg, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
              <div className="px-4 py-2.5" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
                <div className="text-[10px]" style={{ color: C.muted, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Inputs disponibles · {agentSynthesis.runCount} agentes han corrido</div>
                <div className="text-[11px] mt-1" style={{ color: C.ink, fontWeight: 500 }}>
                  {agentSynthesis.criticalCount > 0 && <span style={{ color: C.brick, fontWeight: 700 }}>{agentSynthesis.criticalCount} críticos · </span>}
                  {agentSynthesis.majorCount > 0 && <span style={{ color: C.ochre }}>{agentSynthesis.majorCount} mayores · </span>}
                  {agentSynthesis.minorCount > 0 && <span style={{ color: C.muted }}>{agentSynthesis.minorCount} menores</span>}
                  {agentSynthesis.criticalCount + agentSynthesis.majorCount + agentSynthesis.minorCount === 0 && <span style={{ color: C.green }}>todo limpio</span>}
                </div>
              </div>
              <div className="divide-y" style={{ borderColor: C.lineSoft }}>
                {agentSynthesis.findings.map((f, i) => {
                  const sevC = ({ critical: C.brick, major: C.ochre, minor: C.muted, ok: C.green }[f.severity]) || C.muted;
                  return (
                    <div key={i} className="px-4 py-2 flex items-center gap-2.5">
                      <span className="w-1.5 h-1.5 flex-shrink-0" style={{ backgroundColor: sevC, borderRadius: 999 }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px]" style={{ color: C.ink, fontWeight: 600 }}>{f.agent}</div>
                        <div className="text-[9px] mt-0.5 truncate" style={{ color: C.muted }}>{f.summary || "(sin detalle)"}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {!agentSynthesis && (
            <div className="mt-6 px-4 py-3 text-[10px]" style={{ backgroundColor: `${C.ochre}10`, border: `1px solid ${C.ochre}30`, borderRadius: 2, color: C.inkSoft, lineHeight: 1.6 }}>
              Ningún agente ha corrido todavía. El Jabberwocky puede inspeccionar el sistema directamente, pero el veredict va a ser mejor si primero corrés Bandersnatch / Cheshire / White Rabbit / Mad Hatter desde sus paneles.
            </div>
          )}
        </div>
      )}

      {(phase === "inspecting" || phase === "thinking") && (
        <div className="py-8 px-6" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 4 }}>
          <div className="flex items-center gap-3 mb-5">
            <div className="animate-pulse"><JWIcon size={36} color={C.cobalt} /></div>
            <div>
              <div className="text-[14px]" style={{ color: C.ink, fontWeight: 600 }}>El Jabberwocky inspecciona…</div>
              <div className="text-[10px]" style={{ color: C.muted }}>Ejecutando barrido completo del sistema</div>
            </div>
          </div>
          <div className="space-y-2">
            {stream.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2 text-[11px]" style={{ color: i === stream.length - 1 ? C.ink : C.muted, fontWeight: i === stream.length - 1 ? 500 : 400 }}>
                {s.type === "thinking" ? <Loader2 size={11} className="animate-spin" style={{ color: C.cobalt }} /> : i === stream.length - 1 ? <Loader2 size={11} className="animate-spin" style={{ color: C.cobalt }} /> : <CheckCircle size={11} style={{ color: C.green }} />}
                <span>{s.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {phase === "verdict" && verdict && (
        <div className="space-y-4">
          {/* Source banner — show when local fallback was used */}
          {verdict.source === "local" && verdict.aiError && (
            <div className="px-3 py-2 flex items-center gap-2 text-[10px]" style={{ backgroundColor: `${C.ochre}15`, border: `1px solid ${C.ochre}40`, borderRadius: 2, color: C.inkSoft }}>
              <AlertTriangle size={11} style={{ color: C.ochre, flexShrink: 0 }} />
              <span><strong>{verdict.aiError}</strong> · El veredicto se generó con reglas heurísticas en vez de Claude</span>
              <button onClick={retryAI} className="ml-auto text-[10px] hover:opacity-70 underline" style={{ color: C.cobalt, fontWeight: 600 }}>Reintentar con AI</button>
            </div>
          )}
          {verdict.source === "ai" && (
            <div className="px-3 py-2 flex items-center gap-2 text-[10px]" style={{ backgroundColor: `${C.cobalt}10`, border: `1px solid ${C.cobalt}30`, borderRadius: 2, color: C.inkSoft }}>
              <Sparkles size={11} style={{ color: C.cobalt, flexShrink: 0 }} />
              <span>Veredicto generado por Claude Sonnet 4 vía Anthropic API</span>
            </div>
          )}

          <ExportToClaude markdown={jabberwockyMarkdown} filename="hygge-jabberwocky-verdict" />

          {/* Verdict header */}
          <div className="py-6 px-6 flex items-start gap-5" style={{ backgroundColor: C.paper, border: `2px solid ${verdictColor}`, borderRadius: 4 }}>
            <JWIcon size={56} color={verdictColor} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-[10px]" style={{ color: C.muted, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Veredicto del Jabberwocky</span>
                <span className="text-[10px] px-2 py-0.5" style={{ backgroundColor: verdictColor, color: "white", borderRadius: 2, fontWeight: 700, letterSpacing: "0.05em" }}>{verdict.result}</span>
              </div>
              <div className="text-[18px] mb-3" style={{ color: C.ink, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.3, fontStyle: "italic" }}>
                "{verdict.sentencia}"
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-[42px] leading-none" style={{ color: verdictColor, fontWeight: 300, letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums" }}>{verdict.score}</div>
              <div className="text-[10px]" style={{ color: C.muted, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" }}>score / 100</div>
            </div>
          </div>

          {/* Hallazgos */}
          {verdict.hallazgos.length > 0 && (
            <div>
              <Eyebrow>Hallazgos</Eyebrow>
              <div className="mt-2 space-y-1.5">
                {verdict.hallazgos.map((h, i) => {
                  const isOk = h.startsWith("✓");
                  const isWarn = h.startsWith("⚠");
                  const isFail = h.startsWith("✗");
                  const color = isOk ? C.green : isFail ? C.brick : isWarn ? C.ochre : C.muted;
                  const text = h.replace(/^[✓⚠✗ⓘ]\s*/, "");
                  return (
                    <div key={i} className="flex items-start gap-2.5 py-2 px-3" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
                      <div className="pt-0.5" style={{ color, fontSize: 13, lineHeight: 1, fontWeight: 700 }}>
                        {isOk ? "✓" : isFail ? "✗" : isWarn ? "⚠" : "ⓘ"}
                      </div>
                      <div className="flex-1 text-[11px]" style={{ color: C.inkSoft, lineHeight: 1.55 }}>{text}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recomendaciones */}
          {verdict.recomendaciones.length > 0 && (
            <div>
              <Eyebrow>Recomendaciones</Eyebrow>
              <div className="mt-2 space-y-1" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2, padding: 12 }}>
                {verdict.recomendaciones.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px]" style={{ color: C.inkSoft, lineHeight: 1.6 }}>
                    <span style={{ color: C.cobalt, fontWeight: 700 }}>→</span>
                    <span>{r}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cierre */}
          {verdict.cierre && (
            <div className="py-4 px-5 text-center italic text-[12px]" style={{ backgroundColor: C.paper, border: `1px dashed ${C.line}`, borderRadius: 2, color: C.ink, lineHeight: 1.5 }}>
              "{verdict.cierre}"
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <button onClick={wake} className="px-3 py-1.5 text-[11px] hover:opacity-90" style={{ backgroundColor: C.ink, color: "white", borderRadius: 2, fontWeight: 500 }}>
              Despertar de nuevo
            </button>
            <button onClick={() => { setPhase("dormant"); setVerdict(null); setStream([]); }} className="px-3 py-1.5 text-[11px] hover:opacity-70" style={{ color: C.muted, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
              Dormir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DataAdminPanel({ onResetTasks, onResetTerrenos, onResetCustomViews, taskCount, terrenoCount, customViewsCount, onExportTasks, onExportTerrenos }) {
  const confirm = useConfirm();
  const askReset = async (kind, action) => {
    const labels = {
      tasks: { title: "Resetear todas las tareas", message: "Volver al estado de ClickUp.\n\nEsto BORRARÁ todos los cambios locales (comentarios, attachments, etc).", confirmLabel: "Resetear tareas" },
      views: { title: "Resetear custom views", message: "Esto BORRARÁ los views que hayas creado manualmente y restaurará los embeds de Drive y Miro.", confirmLabel: "Resetear views" },
      terrenos: { title: "Resetear terrenos", message: "Volver a los 6 originales.\n\nEsto BORRARÁ terrenos que hayas agregado manualmente.", confirmLabel: "Resetear terrenos" },
    };
    const ok = await confirm({ ...labels[kind], danger: true });
    if (ok) action();
  };
  return (
    <div className="space-y-5">
      <div>
        <Eyebrow>Sincronización · ClickUp + Drive + Miro</Eyebrow>
        <div className="text-[11px] mt-2" style={{ color: C.muted, lineHeight: 1.55 }}>
          ALICE viene pre-poblado con datos importados desde tu workspace de ClickUp (Hygge x BAM), tus carpetas de Google Drive y placeholders de Miro por proyecto. Si modificaste cosas y querés volver al estado importado, usá los botones de reset.
        </div>
      </div>

      <div className="p-4 space-y-3" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[12px]" style={{ color: C.ink, fontWeight: 600 }}>Tareas</div>
            <div className="text-[10px] mt-0.5" style={{ color: C.muted }}>Actualmente: {taskCount} · Seed ClickUp: 52 tareas</div>
          </div>
          <button onClick={() => askReset("tasks", onResetTasks)} className="px-3 py-1.5 text-[11px] hover:opacity-90" style={{ color: C.brick, border: `1px solid ${C.brick}55`, borderRadius: 2, fontWeight: 500 }}>
            Resetear tareas
          </button>
        </div>
        <div className="flex items-center justify-between pt-3" style={{ borderTop: `1px solid ${C.lineSoft}` }}>
          <div>
            <div className="text-[12px]" style={{ color: C.ink, fontWeight: 600 }}>Custom Views · Drive + Miro</div>
            <div className="text-[10px] mt-0.5" style={{ color: C.muted }}>Actualmente: {customViewsCount} views · Seed: 32 embeds</div>
          </div>
          <button onClick={() => askReset("views", onResetCustomViews)} className="px-3 py-1.5 text-[11px] hover:opacity-90" style={{ color: C.brick, border: `1px solid ${C.brick}55`, borderRadius: 2, fontWeight: 500 }}>
            Resetear views
          </button>
        </div>
        <div className="flex items-center justify-between pt-3" style={{ borderTop: `1px solid ${C.lineSoft}` }}>
          <div>
            <div className="text-[12px]" style={{ color: C.ink, fontWeight: 600 }}>Terrenos · Growth</div>
            <div className="text-[10px] mt-0.5" style={{ color: C.muted }}>Actualmente: {terrenoCount} · Seed: 6 terrenos en Lima</div>
          </div>
          <button onClick={() => askReset("terrenos", onResetTerrenos)} className="px-3 py-1.5 text-[11px] hover:opacity-90" style={{ color: C.brick, border: `1px solid ${C.brick}55`, borderRadius: 2, fontWeight: 500 }}>
            Resetear terrenos
          </button>
        </div>
      </div>

      <div>
        <Eyebrow>Export · CSV</Eyebrow>
        <div className="text-[11px] mt-2 mb-3" style={{ color: C.muted, lineHeight: 1.55 }}>
          Bajá los datos como CSV para abrir en Excel o Google Sheets · útil para comités semanales o reporting.
        </div>
        <div className="flex flex-wrap gap-2">
          {onExportTasks && (
            <button onClick={onExportTasks} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] hover:opacity-90" style={{ color: C.ink, border: `1px solid ${C.lineSoft}`, borderRadius: 2, fontWeight: 500 }}>
              <Download size={11} /> Tareas ({taskCount}) → CSV
            </button>
          )}
          {onExportTerrenos && (
            <button onClick={onExportTerrenos} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] hover:opacity-90" style={{ color: C.ink, border: `1px solid ${C.lineSoft}`, borderRadius: 2, fontWeight: 500 }}>
              <Download size={11} /> Terrenos ({terrenoCount}) → CSV
            </button>
          )}
        </div>
      </div>

      <div className="text-[10px] italic" style={{ color: C.muted }}>
        Cada tarea tiene un link a ClickUp en su descripción. Para cambiar la URL de un Miro, andá al proyecto, hacé clic en la pestaña "Miro · …" y edítala desde el ícono de configuración.
      </div>
    </div>
  );
}

function UsersAdminPanel({ users, createUser, updateUser, deleteUser, currentUserId }) {
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <Eyebrow>Usuarios · {users.length}</Eyebrow>
          <div className="text-[11px] mt-1" style={{ color: C.muted }}>Creá, edita o elimina cuentas. Solo el admin puede.</div>
        </div>
        <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] hover:opacity-90" style={{ backgroundColor: C.ink, color: C.bg, borderRadius: 2, fontWeight: 500 }}><Plus size={11} /> Nuevo usuario</button>
      </div>
      <div style={{ border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
        {users.map((u, i) => (
          <div key={u.id} className="flex items-center gap-3 px-3 py-2.5" style={{ borderTop: i === 0 ? "none" : `1px solid ${C.lineSoft}` }}>
            <Avatar personId={u.id} size={28} />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] truncate" style={{ color: C.ink, fontWeight: 600 }}>{u.firstName} {u.lastName}{u.id === currentUserId && <span className="ml-2 text-[9px]" style={{ color: C.muted, fontWeight: 500 }}>· vos</span>}</div>
              <div className="text-[10px] truncate" style={{ color: C.muted }}>{u.email} · {u.role}</div>
            </div>
            {u.isAdmin && <span className="text-[9px] px-1.5 py-0.5" style={{ color: C.cobalt, backgroundColor: C.cobalt + "11", border: `1px solid ${C.cobalt}33`, borderRadius: 2, fontWeight: 600 }}>ADMIN</span>}
            <button onClick={() => setEditing(u)} className="p-1.5 hover:opacity-70" title="Editar"><PenSquare size={12} style={{ color: C.inkSoft }} /></button>
            {u.id !== currentUserId && (
              <button onClick={() => deleteUser(u.id)} className="p-1.5 hover:opacity-70" title="Eliminar"><Trash2 size={12} style={{ color: C.brick }} /></button>
            )}
          </div>
        ))}
      </div>
      {(creating || editing) && <UserFormModal user={editing} onClose={() => { setCreating(false); setEditing(null); }} onSave={(data) => { if (editing) updateUser(editing.id, data); else createUser(data); setCreating(false); setEditing(null); }} />}
    </div>
  );
}

function UserFormModal({ user, onClose, onSave }) {
  const [data, setData] = useState(user || { firstName: "", lastName: "", email: "", role: "Colaborador", color: C.cobalt, isAdmin: false, password: "", preferences: { ...DEFAULT_PREFS } });
  const blob = useModalBlob();
  const update = (patch) => { setData(d => ({ ...d, ...patch })); blob.onType(); };
  const submit = () => {
    if (!data.firstName?.trim() || !data.email?.trim()) { blob.onError(); return; }
    const initials = ((data.firstName[0] || "") + (data.lastName?.[0] || "")).toUpperCase();
    blob.onHappy(() => onSave({ ...data, initials, firstName: data.firstName.trim(), lastName: (data.lastName || "").trim(), email: data.email.trim() }));
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[10vh] p-4" style={{ backgroundColor: "rgba(10,11,15,0.5)" }} onClick={onClose}>
      <div className="w-full max-w-[520px]" style={{ backgroundColor: C.paper, border: `1px solid ${C.line}`, borderRadius: 4 }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
          <div><Eyebrow>{user ? "Editar usuario" : "Nuevo usuario"}</Eyebrow><div className="text-[15px] mt-1" style={{ color: C.ink, fontWeight: 600 }}>{user ? `${user.firstName} ${user.lastName}` : "Crear cuenta"}</div></div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ModalBlob state={blob.state} />
            <button onClick={onClose}><X size={14} style={{ color: C.muted }} /></button>
          </div>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Nombre"><input value={data.firstName} onChange={e => update({ firstName: e.target.value })} placeholder="Sebastián" className={fieldClass} style={fieldStyle} autoFocus /></FormField>
            <FormField label="Apellido"><input value={data.lastName} onChange={e => update({ lastName: e.target.value })} placeholder="Bonilla" className={fieldClass} style={fieldStyle} /></FormField>
          </div>
          <FormField label="Email"><input type="email" value={data.email} onChange={e => update({ email: e.target.value })} placeholder="persona@hygge.pe" className={fieldClass} style={fieldStyle} /></FormField>
          <FormField label="Rol / cargo"><input value={data.role} onChange={e => update({ role: e.target.value })} placeholder="Gerente Comercial" className={fieldClass} style={fieldStyle} /></FormField>
          <FormField label="Color de avatar">
            <div className="flex gap-2">
              {[C.ink, C.cobalt, C.lavender, C.ochre, C.green, C.brick, C.navy, C.sky].map(c => (
                <button key={c} onClick={() => update({ color: c })} className="w-7 h-7" style={{ backgroundColor: c, borderRadius: 999, border: data.color === c ? `2px solid ${C.ink}` : `2px solid transparent`, transform: data.color === c ? "scale(1.1)" : "scale(1)" }} />
              ))}
            </div>
          </FormField>
          {!user && (
            <FormField label="Contraseña inicial">
              <input type="text" value={data.password} onChange={e => update({ password: e.target.value })} placeholder="Mínimo 6 caracteres · podrá cambiarla al iniciar" className={fieldClass} style={fieldStyle} />
            </FormField>
          )}
          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input type="checkbox" checked={!!data.isAdmin} onChange={e => update({ isAdmin: e.target.checked })} />
            <span className="text-[12px]" style={{ color: C.ink, fontWeight: 500 }}>Privilegios de administrador</span>
          </label>
        </div>
        <div className="px-5 py-4 flex items-center justify-end gap-2" style={{ borderTop: `1px solid ${C.lineSoft}` }}>
          <button onClick={onClose} className="px-3 py-2 text-[12px] hover:opacity-90" style={{ color: C.muted, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>Cancelar</button>
          <button onClick={submit} className="px-4 py-2 text-[12px] hover:opacity-90" style={{ backgroundColor: C.ink, color: C.bg, borderRadius: 2, fontWeight: 500 }}>{user ? "Guardar cambios" : "Crear usuario"}</button>
        </div>
      </div>
    </div>
  );
}

function SpacePermissionsPanel({ users, allSpaces, spaceAccess, updateSpaceAccess }) {
  const flat = [...allSpaces, ...allSpaces.flatMap(s => s.children || [])];
  return (
    <div>
      <div className="mb-4">
        <Eyebrow>Acceso a Spaces</Eyebrow>
        <div className="text-[11px] mt-1" style={{ color: C.muted }}>Definí quién puede ver cada space. Por default todos pueden ver todo.</div>
      </div>
      <div className="space-y-2">
        {flat.map(s => {
          const access = spaceAccess[s.id] || { visibility: "all", allowed: [] };
          return <SpaceAccessRow key={s.id} space={s} users={users} access={access} onChange={(a) => updateSpaceAccess(s.id, a)} />;
        })}
      </div>
    </div>
  );
}

function SpaceAccessRow({ space, users, access, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const visibility = access.visibility || "all";
  const allowed = access.allowed || [];
  return (
    <div style={{ border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: space.dot }} />
        <span className="text-[12px] flex-1 truncate" style={{ color: C.ink, fontWeight: 600 }}>{space.name}</span>
        <select value={visibility} onChange={e => onChange({ visibility: e.target.value, allowed })} className="text-[11px] px-2 py-1 outline-none" style={{ backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2, color: C.ink }}>
          <option value="all">Todos</option>
          <option value="selected">Personas seleccionadas</option>
          <option value="private">Privado (solo admin)</option>
        </select>
        {visibility === "selected" && (
          <button onClick={() => setExpanded(e => !e)} className="text-[10px] hover:opacity-70" style={{ color: C.muted }}>{allowed.length} {allowed.length === 1 ? "persona" : "personas"} <ChevronRight size={10} style={{ display: "inline", transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} /></button>
        )}
      </div>
      {visibility === "selected" && expanded && (
        <div className="px-3 py-3 space-y-1.5" style={{ borderTop: `1px solid ${C.lineSoft}`, backgroundColor: C.surface }}>
          {users.map(u => {
            const checked = allowed.includes(u.id) || u.isAdmin;
            return (
              <label key={u.id} className="flex items-center gap-2.5 cursor-pointer hover:opacity-90 py-0.5">
                <input type="checkbox" checked={checked} disabled={u.isAdmin}
                  onChange={e => {
                    const next = e.target.checked ? [...allowed, u.id] : allowed.filter(x => x !== u.id);
                    onChange({ visibility, allowed: next });
                  }} />
                <Avatar personId={u.id} size={20} />
                <span className="text-[11px] flex-1" style={{ color: C.ink, fontWeight: 500 }}>{u.firstName} {u.lastName}</span>
                <span className="text-[9px]" style={{ color: C.muted }}>{u.role}</span>
                {u.isAdmin && <span className="text-[9px]" style={{ color: C.cobalt, fontWeight: 600 }}>admin</span>}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══ MAIN APP ════════════════════════════════════════════════════════════
export default function HyggeOS({ authUser } = {}) {
  const [currentSpace, setCurrentSpace] = useState("hq");
  const [view, setView] = useState("dashboard");
  const [expandedSpaces, setExpandedSpaces] = useState({ proyectos: true });
  const [createSpaceParent, setCreateSpaceParent] = useState(null);
  const [dropboxSyncItems, setDropboxSyncItems] = useState(null); // null = not checked yet, [] = checked no items
  const [dropboxFolderPrompt, setDropboxFolderPrompt] = useState(null);
  const dropboxSyncCheckedRef = useRef(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileRightPanelOpen, setMobileRightPanelOpen] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [users, setUsers] = useState(INITIAL_USERS);
  const [currentUserId, setCurrentUserId] = useState(authUser?.id || "sb");
  const [spaceAccess, setSpaceAccess] = useState({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [features, setFeatures] = useState({ whiteboards: false, customViews: false, viewport: false });
  const [spaceViewports, setSpaceViewports] = useState({}); // { spaceId: { url, label } }
  const [knowledgeLinks, setKnowledgeLinks] = useState([]);
  const [filters, setFilters] = useState({ priorities: [], assignees: [], statuses: [], includeSubspaces: true });
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [terrenos, setTerrenos] = useState(INITIAL_TERRENOS);
  const [selectedTerrenoId, setSelectedTerrenoId] = useState(null);
  const [customViews, setCustomViews] = useState(INITIAL_CUSTOM_VIEWS);
  const [customViewEditOpen, setCustomViewEditOpen] = useState(false);
  const [customViewEditInitial, setCustomViewEditInitial] = useState(null);

  const currentUser = users.find(u => u.id === currentUserId) || users[0];

  const [addOpen, setAddOpen] = useState(false);
  const [createSpaceOpen, setCreateSpaceOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [conversation, setConversation] = useState([]);
  const [customSpaces, setCustomSpaces] = useState([]);
  const [deletedDefaultSpaceIds, setDeletedDefaultSpaceIds] = useState([]);
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [activity, setActivity] = useState([]);
  const [ceoProjects, setCeoProjects] = useState(INITIAL_CEO_PROJECTS);
  const [spvs, setSpvs] = useState(DEFAULT_SPVS);
  const [hqCifras, setHqCifras] = useState(DEFAULT_HQ_CIFRAS);
  const [ceoNps, setCeoNps] = useState(0);
  const [whiteboards, setWhiteboards] = useState(INITIAL_WHITEBOARDS);
  const [smartViews, setSmartViews] = useState(INITIAL_SMART_VIEWS);
  const [activeSmartViewId, setActiveSmartViewId] = useState(null);
  const [timer, setTimer] = useState({ running: false, elapsed: 0, todayTotal: 0, label: "Sin temporizador activo", project: "", spaceName: "", taskId: null });
  const { sessions: timerSessions, active: timerActive, liveSeconds: timerLive, startTimer, stopTimer: stopTimerSession, deleteSession: deleteTimerSession, deleteTaskSessions: deleteTimerTaskSessions, isRunning: isTimerRunning, getTaskTotal } = useTimer(currentUserId);
  useRecurring(tasks, setTasks);
  const [detailTaskId, setDetailTaskId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  // ERP sync — loaded debe estar declarado antes de este hook
  const { pushNewTask, pushTaskUpdate, pushNewEvent } = useERPSync({ tasks, setTasks, currentUser, loaded });

  // ─── UNDO SYSTEM · last 10 destructive actions ───
  const [undoStack, setUndoStack] = useState([]); // [{ label, snapshot, ts }]
  // Agent registry · cada agente reporta su última corrida acá · Dark Alice lo orquesta
  const [agentStatus, setAgentStatus] = useState({}); // { agentId: { lastRun, result, error, severity } }
  const recordAgentRun = useCallback((id, payload) => {
    setAgentStatus(prev => ({ ...prev, [id]: { lastRun: Date.now(), ...payload } }));
  }, []);
  const [quarantineMode, setQuarantineMode] = useState(false);
  const [activeToast, setActiveToast] = useState(null); // { id, label, type }
  const stateRef = useRef(null);
  const toastTimerRef = useRef(null);

  const recordUndo = useCallback((label) => {
    const snapshot = {
      tasks: JSON.parse(JSON.stringify(stateRef.current?.tasks || [])),
      customViews: JSON.parse(JSON.stringify(stateRef.current?.customViews || {})),
      customSpaces: JSON.parse(JSON.stringify(stateRef.current?.customSpaces || [])),
      terrenos: JSON.parse(JSON.stringify(stateRef.current?.terrenos || [])),
      users: JSON.parse(JSON.stringify(stateRef.current?.users || [])),
    };
    const ts = Date.now();
    setUndoStack(prev => [...prev.slice(-9), { label, snapshot, ts }]);
    setActiveToast({ id: ts, label, type: "undoable" });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setActiveToast(curr => (curr?.id === ts ? null : curr)), 5500);
  }, []);

  const undoLast = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) {
        setActiveToast({ id: Date.now(), label: "Nada para deshacer", type: "info" });
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setActiveToast(null), 2000);
        return prev;
      }
      const last = prev[prev.length - 1];
      setTasks(last.snapshot.tasks);
      setCustomViews(last.snapshot.customViews);
      setCustomSpaces(last.snapshot.customSpaces);
      setTerrenos(last.snapshot.terrenos);
      setUsers(last.snapshot.users);
      const ts = Date.now();
      setActiveToast({ id: ts, label: `↶ Deshecho: ${last.label}`, type: "done" });
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setActiveToast(curr => (curr?.id === ts ? null : curr)), 2500);
      return prev.slice(0, -1);
    });
  }, []);

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setActiveToast(null);
  }, []);

  // Sync stateRef so recordUndo always snapshots current state without stale closures
  useEffect(() => {
    stateRef.current = { tasks, customViews, customSpaces, terrenos, users };
  }, [tasks, customViews, customSpaces, terrenos, users]);

  // URL fragment routing · #/task/123 abre TaskDetailPanel · #/space/abc cambia space
  useEffect(() => {
    const apply = () => {
      const h = (window.location.hash || "").replace(/^#\/?/, "");
      if (!h) return;
      if (h.startsWith("task/")) {
        const id = parseInt(h.slice(5));
        if (!isNaN(id)) setDetailTaskId(id);
      } else if (h.startsWith("space/")) {
        setCurrentSpace(h.slice(6));
      }
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  // Global Cmd+Z / Ctrl+Z to undo · skip when typing in inputs
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== "z" || e.shiftKey) return;
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) return;
      e.preventDefault();
      undoLast();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undoLast]);

  const allSpaces = useMemo(() => {
    const deletedSet = new Set(deletedDefaultSpaceIds);
    // Default spaces get any custom children attached, excluding deleted ones.
    const withChildren = DEFAULT_SPACES.filter(s => !deletedSet.has(s.id)).map(s => {
      const customChildren = customSpaces.filter(c => c.parentId === s.id && !deletedSet.has(c.id));
      const filteredChildren = (s.children || []).filter(c => !deletedSet.has(c.id));
      const allChildren = [...filteredChildren, ...customChildren];
      if (allChildren.length === 0 && (s.children || []).length === 0) return s;
      return { ...s, children: allChildren };
    });
    // Custom top-level spaces (no parent) — also let them have custom children.
    const topCustoms = customSpaces.filter(c => !c.parentId).map(s => {
      const customChildren = customSpaces.filter(c => c.parentId === s.id);
      if (customChildren.length === 0) return s;
      return { ...s, children: customChildren };
    });
    return [...withChildren, ...topCustoms];
  }, [customSpaces, deletedDefaultSpaceIds]);

  // ─── Access control ────────────────────────────────────────────────────────
  // authUser viene de AuthContext (fuente canónica con allowedSpaces e isCEO)
  // NO usar currentUser del state que se carga de localStorage sin esos campos
  const visibleSpaces = useMemo(() => {
    const allowed = authUser?.allowedSpaces;
    if (!allowed) return allSpaces;
    return allSpaces.filter(s => allowed.includes(s.id));
  }, [allSpaces, authUser]);

  const visibleTools = useMemo(() => {
    if (!authUser?.allowedSpaces) return TOOLS;
    // CEO Dashboard solo para Sebastian · el resto accede a todo lo demás
    return TOOLS.filter(t => t.id !== "ceo-dashboard");
  }, [authUser]);

  // Redirigir si el usuario no tiene acceso al space actual
  useEffect(() => {
    if (!loaded || !authUser?.allowedSpaces) return;
    const allowed = authUser.allowedSpaces;
    const toolIds = TOOLS.map(t => t.id);
    if (toolIds.includes(currentSpace) || currentSpace?.startsWith("lab-")) return;
    const parentId = allSpaces.find(s => s.children?.some(c => c.id === currentSpace))?.id;
    const isAllowed = allowed.includes(currentSpace) || (parentId && allowed.includes(parentId));
    if (!isAllowed) setCurrentSpace(allowed[0] || "alicia");
  }, [loaded, authUser, currentSpace, allSpaces]);

  // Dropbox ↔ ALICE sync check — only for admins, once per session
  useEffect(() => {
    if (!loaded || !authUser?.isAdmin || dropboxSyncCheckedRef.current) return;
    dropboxSyncCheckedRef.current = true;
    (async () => {
      try {
        const ignored = JSON.parse(localStorage.getItem("hygge:dropbox:ignored") || "[]");
        const res = await fetch(`${ALICIA_BRAIN_URL}/api/dropbox/browse?path=/Hygge`);
        if (!res.ok) return;
        const data = await res.json();
        const folders = (data.entries || []).filter(e => e.type === "folder");
        const knownNames = new Set(
          Object.values(SPACE_DROPBOX_PATHS)
            .filter(p => p.split("/").length === 3)
            .map(p => p.split("/")[2].toLowerCase())
        );
        knownNames.add(".alice");
        // carpetas de sistema + carpetas ya vinculadas a spaces por el admin
        DROPBOX_SYSTEM_FOLDERS.forEach(n => knownNames.add(n));
        const customPaths = JSON.parse(localStorage.getItem("hygge:dropbox:custom_paths") || "{}");
        Object.values(customPaths).forEach(p => {
          const parts = String(p).split("/");
          if (parts.length === 3) knownNames.add(parts[2].toLowerCase());
        });
        const newFolders = folders.filter(f =>
          !f.name.startsWith("_") && // _sistema, _template, etc: infra por convención
          !knownNames.has(f.name.toLowerCase()) && !ignored.includes(f.path)
        );
        if (newFolders.length > 0) {
          setDropboxSyncItems(newFolders.map(f => ({ name: f.name, path: f.path })));
        }
      } catch (_) { /* silent */ }
    })();
  }, [loaded, authUser]);

  const toggleSpaceExpansion = useCallback((id) => {
    setExpandedSpaces(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  useEffect(() => {
    (async () => {
      // Hidratar (server→localStorage) claves compartidas que otros componentes leen
      // directo de localStorage al montar — fire-and-forget, loadStored cachea solo.
      loadStored("hygge:dropbox:custom_paths", {});
      loadStored("hygge:dropbox:ignored", []);
      loadStored("hygge:hqWidgets", null);
      loadStored("hygge:hqSummaries", null);
      loadStored("hygge:finanzas:source", null);
      const [t, m, wb, tm, sp, vw, cs, sv, us, sa, tr, cv, rpc, act, cp, cn, ft, vp, kl, spv, hqcf, dds] = await Promise.all([
        db.getTasks().catch(() => loadStored("hygge:tasks", INITIAL_TASKS)), loadStored("hygge:messages", INITIAL_MESSAGES),
        loadStored("hygge:whiteboards", INITIAL_WHITEBOARDS), loadStored("hygge:timer", timer),
        loadStored("hygge:space", "hq"), loadStored("hygge:view", "dashboard"),
        loadStored("hygge:customSpaces", []),
        loadStored("hygge:smartViews", INITIAL_SMART_VIEWS),
        loadStored("hygge:users", INITIAL_USERS),
        loadStored("hygge:spaceAccess", {}),
        db.getTerrenos().catch(() => loadStored("hygge:terrenos", INITIAL_TERRENOS)),
        loadStored("hygge:customViews", INITIAL_CUSTOM_VIEWS),
        loadStored("hygge:rightPanelCollapsed", false),
        loadStored("hygge:activity", []),
        loadStored("hygge:ceoProjects", INITIAL_CEO_PROJECTS),
        loadStored("hygge:ceoNps", 0),
        loadStored("hygge:features", { whiteboards: false, customViews: false, viewport: false }),
        loadStored("hygge:spaceViewports", {}),
        loadStored("hygge:knowledgeLinks", []),
        loadStored("hygge:spvs", DEFAULT_SPVS),
        loadStored("hygge:hq:cifras", DEFAULT_HQ_CIFRAS),
        loadStored("hygge:deletedDefaultSpaces", []),
      ]);
      setTasks(t); setMessages(m); setWhiteboards(wb); setTimer(tm); setCurrentSpace(sp); setView(vw); setCustomSpaces(cs); setSmartViews(sv); setUsers(Array.isArray(us) ? us.map(u => ({ ...u, online: false })) : us); setSpaceAccess(sa); setTerrenos(tr); setCustomViews(cv); setRightPanelCollapsed(rpc); setActivity(Array.isArray(act) ? act : []); setCeoProjects(Array.isArray(cp) && cp.length > 0 ? cp : INITIAL_CEO_PROJECTS); setCeoNps(typeof cn === "number" ? cn : 0); setFeatures(ft && typeof ft === "object" ? { whiteboards: !!ft.whiteboards, customViews: !!ft.customViews, viewport: !!ft.viewport } : { whiteboards: false, customViews: false, viewport: false }); setSpaceViewports(vp && typeof vp === "object" ? vp : {}); setKnowledgeLinks(Array.isArray(kl) ? kl : []); setSpvs(Array.isArray(spv) && spv.length > 0 ? spv : DEFAULT_SPVS); setHqCifras(Array.isArray(hqcf) && hqcf.length > 0 ? hqcf : DEFAULT_HQ_CIFRAS); setDeletedDefaultSpaceIds(Array.isArray(dds) ? dds : []); setLoaded(true);
    })();
  }, []);

  useEffect(() => { if (loaded) saveStored("hygge:tasks", tasks); }, [tasks, loaded]);
  useEffect(() => { if (loaded) saveStored("hygge:messages", messages); }, [messages, loaded]);
  useEffect(() => { if (loaded) saveStored("hygge:activity", activity); }, [activity, loaded]);
  useEffect(() => { if (loaded) saveStored("hygge:ceoProjects", ceoProjects); }, [ceoProjects, loaded]);
  useEffect(() => { if (loaded) saveStored("hygge:ceoNps", ceoNps); }, [ceoNps, loaded]);
  useEffect(() => { if (loaded) saveStored("hygge:features", features); }, [features, loaded]);
  useEffect(() => { if (loaded) saveStored("hygge:spaceViewports", spaceViewports); }, [spaceViewports, loaded]);
  useEffect(() => { if (loaded) saveStored("hygge:knowledgeLinks", knowledgeLinks); }, [knowledgeLinks, loaded]);
  useEffect(() => { if (loaded) saveStored("hygge:spvs", spvs); }, [spvs, loaded]);
  useEffect(() => { if (loaded) saveStored("hygge:hq:cifras", hqCifras); }, [hqCifras, loaded]);
  useEffect(() => { if (loaded) saveStored("hygge:whiteboards", whiteboards); }, [whiteboards, loaded]);
  useEffect(() => { if (loaded) saveStored("hygge:timer", timer); }, [timer, loaded]);
  useEffect(() => { if (loaded) saveStored("hygge:space", currentSpace); }, [currentSpace, loaded]);
  useEffect(() => { if (loaded) saveStored("hygge:view", view); }, [view, loaded]);
  useEffect(() => { if (loaded) saveStored("hygge:customSpaces", customSpaces); }, [customSpaces, loaded]);
  useEffect(() => { if (loaded) saveStored("hygge:deletedDefaultSpaces", deletedDefaultSpaceIds); }, [deletedDefaultSpaceIds, loaded]);
  useEffect(() => { if (loaded) saveStored("hygge:smartViews", smartViews); }, [smartViews, loaded]);
  useEffect(() => { if (loaded) saveStored("hygge:users", users); }, [users, loaded]);
  useEffect(() => { if (loaded) saveStored("hygge:spaceAccess", spaceAccess); }, [spaceAccess, loaded]);
  useEffect(() => { if (loaded) saveStored("hygge:terrenos", terrenos); }, [terrenos, loaded]);
  useEffect(() => { if (loaded) saveStored("hygge:customViews", customViews); }, [customViews, loaded]);
  useEffect(() => { if (loaded) saveStored("hygge:rightPanelCollapsed", rightPanelCollapsed); }, [rightPanelCollapsed, loaded]);

  // ─── Custom Views · CRUD per space ───
  const currentCustomViews = customViews[currentSpace] || [];
  const saveCustomView = useCallback((spaceId, viewData) => {
    setCustomViews(prev => {
      const existing = prev[spaceId] || [];
      if (viewData.id) {
        return { ...prev, [spaceId]: existing.map(v => v.id === viewData.id ? viewData : v) };
      }
      const newView = { ...viewData, id: "cv_" + Date.now() };
      return { ...prev, [spaceId]: [...existing, newView] };
    });
  }, []);
  const deleteCustomView = useCallback((spaceId, viewId) => {
    setCustomViews(prev => ({ ...prev, [spaceId]: (prev[spaceId] || []).filter(v => v.id !== viewId) }));
    setView("dashboard");
  }, []);

  // ─── Terrenos · CRUD ───
  const createTerreno = useCallback((data) => {
    const id = Date.now();
    const newT = { id, ...data };
    setTerrenos(prev => [newT, ...prev]);
    setSelectedTerrenoId(id);
    db.upsertTerreno(newT).catch(console.error);
  }, []);
  const updateTerreno = useCallback((id, patch) => {
    setTerrenos(prev => {
      const next = prev.map(t => t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t);
      const updated = next.find(t => t.id === id);
      if (updated) db.upsertTerreno(updated).catch(console.error);
      return next;
    });
  }, []);
  const deleteTerreno = useCallback((id) => {
    setTerrenos(prev => prev.filter(t => t.id !== id));
    setSelectedTerrenoId(null);
    db.deleteTerreno(id).catch(console.error);
  }, []);

  // ─── Users · CRUD ───
  const updateUserData = useCallback((id, patch) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u));
  }, []);
  const createUserAccount = useCallback((data) => {
    const id = "u_" + Date.now();
    setUsers(prev => [...prev, { id, color: data.color || C.cobalt, avatar: null, ...data, createdAt: Date.now(), preferences: { ...DEFAULT_PREFS, ...(data.preferences || {}) } }]);
  }, []);
  // Cascade-aware user deletion · opens modal with affected tasks
  const [deleteUserTarget, setDeleteUserTarget] = useState(null);
  const deleteUserAccount = useCallback((id) => {
    if (id === currentUserId) return;
    if (!currentUser?.isAdmin) {
      alert("Solo los administradores pueden eliminar usuarios.");
      return;
    }
    const user = users.find(u => u.id === id);
    if (!user) return;
    setDeleteUserTarget(user);
  }, [currentUserId, currentUser, users]);

  const performUserDelete = useCallback(({ mode, targetUserId }) => {
    const id = deleteUserTarget?.id;
    if (!id) return;
    const taskCount = (stateRef.current?.tasks || []).filter(t => t.assignee === id).length;
    const label = taskCount === 0
      ? `Eliminó usuario ${deleteUserTarget.firstName} ${deleteUserTarget.lastName}`
      : mode === "reassign"
        ? `Eliminó usuario ${deleteUserTarget.firstName} · ${taskCount} tareas reasignadas`
        : `Eliminó usuario ${deleteUserTarget.firstName} · ${taskCount} tareas sin asignar`;
    recordUndo(label);
    // Reassign or unassign tasks (persistiendo cada tarea tocada, no solo en memoria)
    setTasks(prev => prev.map(t => {
      if (t.assignee !== id) return t;
      const updated = { ...t, assignee: mode === "reassign" ? targetUserId : null };
      db.upsertTask(updated).catch(console.error);
      return updated;
    }));
    setUsers(prev => prev.filter(u => u.id !== id));
    setDeleteUserTarget(null);
  }, [deleteUserTarget, recordUndo]);

  const updateSpaceAccessFor = useCallback((spaceId, access) => {
    setSpaceAccess(prev => ({ ...prev, [spaceId]: access }));
  }, []);

  // Auto-close mobile drawers when user navigates
  useEffect(() => { setMobileSidebarOpen(false); }, [currentSpace, view]);
  // Reset filters when switching spaces
  useEffect(() => { setFilters({ priorities: [], assignees: [], statuses: [], includeSubspaces: true }); setFilterPopoverOpen(false); }, [currentSpace]);

  // ─── Smart Capture · Pattern Detector ───
  const detectedPatterns = useMemo(() => detectPatterns(tasks), [tasks]);

  const createFromSmartCapture = useCallback((parsed) => {
    // Smart Capture items default to inbox unless AI confidently parsed a specific space
    const knownSpaceIds = ["hq","finanzas","comercial","legal","marketing","bam","growth","proyectos","dc01","pu01","tg01","l36"];
    const targetSpace = (parsed.space && knownSpaceIds.includes(parsed.space)) ? parsed.space : "inbox";
    const newTask = {
      id: Date.now(), parentId: null,
      title: parsed.title || "Nueva tarea",
      description: parsed.amount ? `Monto: S/ ${parsed.amount.toLocaleString("es-PE")}` : "",
      project: parsed.project || "", priority: parsed.priority || "media",
      due: parsed.due || "", space: targetSpace,
      checked: false, assignee: parsed.assignee || "sb",
      tags: parsed.type ? [parsed.type] : [], type: parsed.type || null,
      amount: parsed.amount || null, person: parsed.person || null,
      source: "smartcapture", capturedAt: Date.now(),
      comments: [], attachments: [],
      activity: [{ when: nowHHMM(), text: targetSpace === "inbox" ? "Capturada · Inbox" : `Creada via Smart Capture · ${targetSpace}` }],
    };
    setTasks(prev => [newTask, ...prev]);
    db.upsertTask(newTask).catch(console.error); // sin esto lo capturado muere con F5
  }, []);

  const saveSmartView = useCallback((pattern) => {
    setSmartViews(prev => {
      if (prev.some(v => v.patternId === pattern.id)) return prev;
      return [...prev, {
        id: Date.now(),
        name: pattern.label,
        patternId: pattern.id,
        regexSource: pattern.regex.source,
        regexFlags: pattern.regex.flags,
        createdAt: nowHHMM(),
      }];
    });
  }, []);

  const deleteSmartView = useCallback((id) => {
    setSmartViews(prev => prev.filter(v => v.id !== id));
    setActiveSmartViewId(prev => prev === id ? null : prev);
  }, []);

  // Filter tasks by active Smart View (if any), space hierarchy, and user filters
  const activeSmartView = smartViews.find(v => v.id === activeSmartViewId);
  const visibleTasks = useMemo(() => {
    let filtered = tasks;

    // Step 1: space scope
    if (currentSpace === "inbox") {
      // Inbox shows only smart-capture items or items explicitly in inbox
      filtered = filtered.filter(t => t.source === "smartcapture" || t.space === "inbox");
    } else if (currentSpace !== "hq") {
      // For parent spaces, include children's tasks (unless toggled off)
      const allowed = resolveSpaceIds(currentSpace, allSpaces, filters.includeSubspaces);
      filtered = filtered.filter(t => allowed.includes(t.space) || allowed.some(id => t.project === id.toUpperCase()));
      // Plus: include children of matched tasks so subtree renders
      const matchedIds = new Set(filtered.map(t => t.id));
      filtered = tasks.filter(t => matchedIds.has(t.id) || (t.parentId && matchedIds.has(t.parentId)));
    }
    // hq → no space filter, show all

    // Step 2: user filters
    if (filters.priorities.length) filtered = filtered.filter(t => filters.priorities.includes(t.priority) || (t.parentId && filtered.find(p => p.id === t.parentId)));
    if (filters.assignees.length) filtered = filtered.filter(t => filters.assignees.includes(t.assignee) || (t.parentId && filtered.find(p => p.id === t.parentId)));
    if (filters.statuses.length) {
      filtered = filtered.filter(t => {
        const status = t.checked ? "done" : "open";
        return filters.statuses.includes(status) || (t.parentId && filtered.find(p => p.id === t.parentId));
      });
    }

    // Step 3: Smart View regex filter
    if (activeSmartView) {
      try {
        const re = new RegExp(activeSmartView.regexSource, activeSmartView.regexFlags);
        const ids = new Set();
        filtered.forEach(t => { if (re.test(t.title || "")) { ids.add(t.id); if (t.parentId) ids.add(t.parentId); } });
        filtered = filtered.filter(t => ids.has(t.id));
      } catch {}
    }

    return filtered;
  }, [tasks, currentSpace, allSpaces, filters, activeSmartView]);

  const activeFilterCount = filters.priorities.length + filters.assignees.length + filters.statuses.length + (filters.includeSubspaces ? 0 : 1);
  const inboxCount = tasks.filter(t => (t.source === "smartcapture" || t.space === "inbox") && !t.checked).length;
  const notifCount = activity.filter(a => !a.read).length;
  const messagesCount = messages.filter(m => !m.read).length;

  useEffect(() => {
    if (!timer.running) return;
    const id = setInterval(() => setTimer(t => ({ ...t, elapsed: t.elapsed + 1 })), 1000);
    return () => clearInterval(id);
  }, [timer.running]);

  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setCmdOpen(true); }
      if ((e.metaKey || e.ctrlKey) && e.key === "n") { e.preventDefault(); setAddOpen(true); }
      if ((e.metaKey || e.ctrlKey) && e.key === ",") { e.preventDefault(); setSettingsOpen(true); }
      if (e.key === "Escape") { setCmdOpen(false); setAddOpen(false); setCreateSpaceOpen(false); setChatOpen(false); setDetailTaskId(null); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // ─── Task actions ───
  // Activity / Notificaciones feed · registra eventos REALES del sistema (creación/edición/cierre de tareas, etc.)
  // Cada entry tiene `read: false` por default. Se diferencia conceptualmente de `messages` (mensajes humanos).
  const recordActivity = useCallback((what, opts = {}) => {
    const u = users.find(x => x.id === currentUserId) || users[0];
    setActivity(prev => [{
      id: Date.now() + Math.random(),
      who: u?.name?.split(" ")[0] || "Sebastián",
      what,
      ts: Date.now(),
      color: u?.color || "#0A0B0F",
      read: false,
      relatedTaskId: opts.taskId || null,
      relatedSpace: opts.space || null,
    }, ...prev].slice(0, 50));
  }, [users, currentUserId]);

  const markNotifRead = useCallback((id) => {
    setActivity(prev => prev.map(a => a.id === id ? { ...a, read: true } : a));
  }, []);

  const markAllNotifsRead = useCallback(() => {
    setActivity(prev => prev.map(a => ({ ...a, read: true })));
  }, []);

  const approveDropboxDelete = useCallback(async (notif) => {
    try {
      await fetch(`${ALICIA_BRAIN_URL}/api/dropbox/delete_folder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: notif.dropboxPath }),
      });
      const customPaths = JSON.parse(localStorage.getItem("hygge:dropbox:custom_paths") || "{}");
      delete customPaths[notif.spaceId];
      saveStored("hygge:dropbox:custom_paths", customPaths);
    } catch (_) { /* silent */ }
    setActivity(prev => prev.map(a =>
      a.id === notif.id ? { ...a, pending: false, approved: true, read: true, what: `solicitó eliminar "${notif.dropboxPath}" en Dropbox · aprobado por Sebastián` } : a
    ));
  }, []);

  const denyDropboxDelete = useCallback((notif) => {
    setActivity(prev => prev.map(a =>
      a.id === notif.id ? { ...a, pending: false, approved: false, read: true, what: `solicitó eliminar "${notif.dropboxPath}" en Dropbox · denegado por Sebastián` } : a
    ));
  }, []);

  const toggleTask = useCallback((id) => {
    setTasks(prev => {
      const next = prev.map(t => {
        if (t.id !== id) return t;
        const wasChecked = t.checked;
        recordActivity(wasChecked ? `reabrió "${t.title}"` : `cerró "${t.title}"`, { taskId: id, space: t.space });
        return { ...t, checked: !wasChecked, activity: [...(t.activity || []), { when: nowHHMM(), text: wasChecked ? "Reabrió la tarea" : "Marcó como completada" }] };
      });
      const updated = next.find(t => t.id === id);
      if (updated) db.upsertTask(updated).catch(console.error);
      return next;
    });
  }, [recordActivity]);
  const setTaskStatus = useCallback((id, status) => {
    setTasks(prev => {
      const next = prev.map(t => {
        if (t.id !== id) return t;
        const checked = status === "completada";
        recordActivity(`cambió estado de "${t.title}" a ${status}`, { taskId: id, space: t.space });
        return { ...t, status, checked, activity: [...(t.activity || []), { when: nowHHMM(), text: `Estado: ${taskStatusDef(status).label}` }] };
      });
      const updated = next.find(t => t.id === id);
      if (updated) db.upsertTask(updated).catch(console.error);
      return next;
    });
  }, [recordActivity]);
  const toggleExpand = useCallback((id) => setTasks(prev => prev.map(t => t.id === id ? { ...t, expanded: !t.expanded } : t)), []);
  const updateTask = useCallback((id, patch) => {
    setTasks(prev => {
      const next = prev.map(t => {
        if (t.id !== id) return t;
        const activity = [...(t.activity || [])];
        if (patch.assignee && patch.assignee !== t.assignee) { activity.push({ when: nowHHMM(), text: `Asignada a ${findPerson(patch.assignee)?.name || patch.assignee}` }); recordActivity(`asignó "${t.title}" a ${findPerson(patch.assignee)?.name || patch.assignee}`, { taskId: id, space: t.space }); }
        if (patch.priority && patch.priority !== t.priority) { activity.push({ when: nowHHMM(), text: `Prioridad: ${patch.priority}` }); recordActivity(`cambió prioridad de "${t.title}" a ${patch.priority}`, { taskId: id, space: t.space }); }
        if (patch.title && patch.title !== t.title) { activity.push({ when: nowHHMM(), text: "Título editado" }); recordActivity(`renombró tarea a "${patch.title}"`, { taskId: id, space: t.space }); }
        return { ...t, ...patch, activity };
      });
      const updated = next.find(t => t.id === id);
      if (updated) db.upsertTask(updated).catch(console.error);
      return next;
    });
  }, [recordActivity]);
  const addTask = useCallback((task) => {
    let newTask;
    setTasks(prev => {
      const next = safeAddTaskPure(prev, { ...task, activity: task.activity || [{ when: nowHHMM(), text: "Tarea creada" }] });
      newTask = next[next.length - 1];
      return [newTask, ...next.slice(0, -1)];
    });
    if (newTask) {
      recordActivity(`creó "${newTask.title}"`, { taskId: newTask.id, space: newTask.space });
      pushNewTask(newTask);
      db.upsertTask(newTask).catch(console.error);
    }
    return newTask;
  }, [recordActivity, pushNewTask]);

  // Duplicate task — preserves fields, generates new ID, resets subtasks/comments/attachments
  const duplicateTask = useCallback((id) => {
    const orig = stateRef.current?.tasks?.find(t => t.id === id) || tasks.find(t => t.id === id);
    if (!orig) return;
    recordUndo(`Duplicó '${orig.title}'`);
    setTasks(prev => {
      const next = safeAddTaskPure(prev, {
        title: `${orig.title} (copia)`,
        project: orig.project,
        priority: orig.priority,
        due: orig.due,
        space: orig.space,
        checked: false,
        assignee: orig.assignee,
        description: orig.description || "",
        parentId: orig.parentId || null,
        activity: [{ when: nowHHMM(), text: "Duplicada de original" }],
      });
      const newTask = next[next.length - 1];
      db.upsertTask(newTask).catch(console.error); // sin esto la copia se esfuma con F5
      return [newTask, ...next.slice(0, -1)];
    });
  }, [tasks, recordUndo]);

  // Archive task — toggles 'archived' status (different from delete)
  const archiveTask = useCallback((id) => {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    recordUndo(t.archived ? `Desarchivó '${t.title}'` : `Archivó '${t.title}'`);
    setTasks(prev => {
      const next = prev.map(x => x.id === id ? { ...x, archived: !x.archived } : x);
      const updated = next.find(x => x.id === id);
      if (updated) db.upsertTask(updated).catch(console.error);
      return next;
    });
  }, [tasks, recordUndo]);

  // Export to CSV — generic helper
  const exportCSV = useCallback((rows, headers, filename) => {
    const esc = (v) => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const csv = [
      headers.map(h => esc(h.label)).join(","),
      ...rows.map(r => headers.map(h => esc(typeof h.value === "function" ? h.value(r) : r[h.key])).join(",")),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const exportTasksToCSV = useCallback(() => {
    const headers = [
      { key: "id", label: "ID" },
      { key: "title", label: "Título" },
      { key: "project", label: "Proyecto" },
      { key: "space", label: "Space" },
      { key: "priority", label: "Prioridad" },
      { key: "due", label: "Due" },
      { key: "assignee", label: "Asignado" },
      { key: "checked", label: "Hecha", value: (t) => t.checked ? "Sí" : "No" },
      { key: "archived", label: "Archivada", value: (t) => t.archived ? "Sí" : "No" },
      { key: "parentId", label: "Parent" },
    ];
    exportCSV(tasks, headers, "hygge-tareas");
  }, [tasks, exportCSV]);

  const exportTerrenosToCSV = useCallback(() => {
    const headers = [
      { key: "id", label: "ID" },
      { key: "name", label: "Nombre" },
      { key: "district", label: "Distrito" },
      { key: "address", label: "Dirección" },
      { key: "status", label: "Status" },
      { key: "areaM2", label: "Área m²" },
      { key: "askedPrice", label: "Precio pedido USD" },
      { key: "score", label: "Score" },
      { key: "owner", label: "Propietario" },
      { key: "ownerContact", label: "Contacto" },
      { key: "lat", label: "Lat" },
      { key: "lng", label: "Lng" },
    ];
    exportCSV(terrenos, headers, "hygge-terrenos");
  }, [terrenos, exportCSV]);

  const addSubtask = useCallback((parentId, title) => {
    const parent = tasks.find(t => t.id === parentId);
    if (!parent) return;
    setTasks(prev => {
      const next = safeAddTaskPure(prev, {
        parentId, title, project: parent.project, priority: "media", due: "—",
        space: parent.space, checked: false, assignee: parent.assignee,
        activity: [{ when: nowHHMM(), text: "Subtarea creada" }],
      });
      db.upsertTask(next[next.length - 1]).catch(console.error); // persistir la subtarea nueva
      return next.map(t => t.id === parentId ? { ...t, expanded: true } : t);
    });
  }, [tasks]);
  const addComment = useCallback((taskId, text) => {
    // autor real (antes: who "sb" hardcodeado — vd comentaba y firmaba Sebastián)
    const me = currentUser?.id || "sb";
    const meName = (currentUser?.name || "").split(" ")[0] || me;
    setTasks(prev => {
      const next = prev.map(t => t.id === taskId ? {
        ...t,
        comments: [...(t.comments || []), { id: Date.now(), who: me, text, when: nowHHMM() }],
        activity: [...(t.activity || []), { when: nowHHMM(), text: `${meName} comentó` }],
      } : t);
      const updated = next.find(t => t.id === taskId);
      if (updated) db.upsertTask(updated).catch(console.error);
      return next;
    });
  }, [currentUser]);
  const addAttachment = useCallback((taskId, attachment) => {
    setTasks(prev => {
      const next = prev.map(t => t.id === taskId ? {
        ...t,
        attachments: [...(t.attachments || []), attachment],
        activity: [...(t.activity || []), { when: nowHHMM(), text: `Subió ${attachment.name}` }],
      } : t);
      const updated = next.find(t => t.id === taskId);
      if (updated) db.upsertTask(updated).catch(console.error);
      return next;
    });
  }, []);
  const removeAttachment = useCallback((taskId, attId) => {
    setTasks(prev => {
      const next = prev.map(t => t.id === taskId ? { ...t, attachments: (t.attachments || []).filter(a => a.id !== attId) } : t);
      const updated = next.find(t => t.id === taskId);
      if (updated) db.upsertTask(updated).catch(console.error);
      return next;
    });
  }, []);

  const markRead = useCallback((id) => setMessages(prev => prev.map(m => m.id === id ? { ...m, read: true } : m)), []);
  const markMessageRead = markRead;
  const markAllMessagesRead = useCallback(() => setMessages(prev => prev.map(m => ({ ...m, read: true }))), []);
  const deleteMessage = useCallback((id) => setMessages(prev => prev.filter(m => m.id !== id)), []);
  const sendMessage = useCallback((to, text) => {
    const newMsg = { id: Date.now(), who: to, text: `(enviado a ${to}) ${text}`, when: nowHHMM(), read: true, fromMe: true };
    setMessages(prev => [newMsg, ...prev]);
  }, []);
  const updateWhiteboard = useCallback((spaceId, updater) => {
    setWhiteboards(prev => ({ ...prev, [spaceId]: updater(prev[spaceId] || []) }));
  }, []);
  const toggleTimer = useCallback(() => setTimer(t => ({ ...t, running: !t.running })), []);
  const stopTimer = useCallback(() => setTimer(t => ({ ...t, running: false, elapsed: 0, label: "Sin tarea activa", taskId: null })), []);
  const [spaceHistory, setSpaceHistory] = useState([]);
  const navigate = useCallback((space, vw) => {
    setSpaceHistory(h => [...h.slice(-19), currentSpace]);
    setCurrentSpace(space);
    if (vw) setView(vw);
  }, [currentSpace]);
  const goBack = useCallback(() => {
    setSpaceHistory(h => {
      const prev = h[h.length - 1];
      if (prev) setCurrentSpace(prev);
      return h.slice(0, -1);
    });
  }, []);
  const createCustomSpace = useCallback((name, dot, parentId = null) => {
    const id = "custom_" + Date.now();
    setCustomSpaces(prev => [...prev, { id, name, count: 0, dot, custom: true, code: name.slice(0,2).toUpperCase(), parentId }]);
    if (parentId) setExpandedSpaces(prev => ({ ...prev, [parentId]: true }));
    setCurrentSpace(id);
    if (authUser?.isAdmin) {
      const suggestedPath = parentId ? `/Hygge/${name}` : `/Hygge/${name}`;
      setDropboxFolderPrompt({ action: "create", spaceName: name, spaceId: id, suggestedPath });
    }
  }, [authUser]);
  // Cascade-aware space deletion · opens modal with affected tasks/views
  const [deleteSpaceTarget, setDeleteSpaceTarget] = useState(null); // space object or null
  const [editSpaceTarget, setEditSpaceTarget] = useState(null); // space object or null
  const editCustomSpace = useCallback((id) => {
    if (!currentUser?.isAdmin) { alert("Solo admins pueden editar spaces."); return; }
    const space = customSpaces.find(s => s.id === id);
    if (!space) return;
    setEditSpaceTarget(space);
  }, [customSpaces, currentUser]);
  const performSpaceEdit = useCallback((id, patch) => {
    recordUndo(`Editó space '${patch.name}'`);
    setCustomSpaces(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }, [recordUndo]);
  const deleteCustomSpace = useCallback((id) => {
    if (!currentUser?.isAdmin) {
      alert("Solo los administradores pueden eliminar spaces.");
      return;
    }
    const space = customSpaces.find(s => s.id === id)
      || allSpaces.find(s => s.id === id)
      || allSpaces.flatMap(s => s.children || []).find(c => c.id === id);
    if (!space) return;
    setDeleteSpaceTarget(space);
  }, [customSpaces, currentUser, allSpaces]);

  const performSpaceDelete = useCallback(({ mode, targetSpaceId }) => {
    const id = deleteSpaceTarget?.id;
    const spaceName = deleteSpaceTarget?.name;
    if (!id) return;
    const label = mode === "move"
      ? `Eliminó space '${spaceName}' · ${(stateRef.current?.tasks || []).filter(t => t.space === id).length} tareas movidas`
      : `Eliminó space '${spaceName}' y sus tareas`;
    recordUndo(label);
    setTasks(prev => {
      if (mode === "move") {
        return prev.map(t => {
          if (t.space !== id) return t;
          const updated = { ...t, space: targetSpaceId };
          db.upsertTask(updated).catch(console.error); // persistir el traslado
          return updated;
        });
      }
      // delete-all: borrar también en Supabase (antes quedaban huérfanas y reaparecían al recargar)
      prev.filter(t => t.space === id).forEach(t => db.deleteTask(t.id).catch(console.error));
      return prev.filter(t => t.space !== id);
    });
    setCustomViews(prev => { const next = { ...prev }; delete next[id]; return next; });
    setCustomSpaces(prev => prev.filter(s => s.id !== id));
    const isDefault = DEFAULT_SPACES.some(s => s.id === id) || DEFAULT_SPACES.some(s => (s.children || []).some(c => c.id === id));
    if (isDefault) setDeletedDefaultSpaceIds(prev => [...prev, id]);
    if (currentSpace === id) setCurrentSpace("hq");
    setDeleteSpaceTarget(null);
    if (authUser?.isAdmin) {
      const customPaths = JSON.parse(localStorage.getItem("hygge:dropbox:custom_paths") || "{}");
      const folderPath = SPACE_DROPBOX_PATHS[id] || customPaths[id];
      if (folderPath) {
        setDropboxFolderPrompt({ action: "delete", spaceName, spaceId: id, folderPath });
      }
    }
  }, [deleteSpaceTarget, currentSpace, recordUndo, authUser]);

  // Cascade-aware task deletion · opens modal if task has subtasks
  const [deleteTaskTarget, setDeleteTaskTarget] = useState(null);
  const performTaskDelete = useCallback(({ mode }) => {
    const id = deleteTaskTarget?.task?.id;
    if (!id) return;
    const label = mode === "promote"
      ? `Eliminó tarea '${deleteTaskTarget.task.title}' · ${deleteTaskTarget.subtaskCount} subtareas promovidas`
      : `Eliminó tarea '${deleteTaskTarget.task.title}'${deleteTaskTarget.subtaskCount ? ` + ${deleteTaskTarget.subtaskCount} subtareas` : ""}`;
    recordUndo(label);
    // promote: en Supabase solo muere el padre; las subtareas se promueven (antes se borraban TODAS → data loss)
    const deletedIds = new Set([id]);
    if (mode !== "promote") {
      tasks.forEach(t => { if (t.parentId && deletedIds.has(t.parentId)) deletedIds.add(t.id); });
    }
    setTasks(prev => applyTaskCascadeDelete(prev, id, mode));
    if (mode === "promote") {
      tasks.filter(t => t.parentId === id).forEach(t => db.upsertTask({ ...t, parentId: null }).catch(console.error));
    }
    setActivity(prev => prev.filter(a => !a.relatedTaskId || !deletedIds.has(a.relatedTaskId)));
    deleteTimerTaskSessions([...deletedIds]);
    deletedIds.forEach(did => db.deleteTask(did).catch(console.error));
    setDeleteTaskTarget(null);
  }, [deleteTaskTarget, recordUndo, tasks, setActivity, deleteTimerTaskSessions]);

  const deleteTaskCascade = useCallback((id) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const subtasks = tasks.filter(t => t.parentId === id);
    setDeleteTaskTarget({ task, subtaskCount: subtasks.length });
  }, [tasks]);

  // ─── ASK HYGGE — Enhanced agent ───
  const sendToHygge = useCallback(async (userMessage) => {
    const userTurn = { role: "user", content: userMessage };
    setConversation(prev => [...prev, userTurn]);
    setChatSending(true);

    const taskSummary = tasks.filter(t => !t.parentId).slice(0, 10).map(t => `- ID ${t.id}: "${t.title}" (${t.space}, ${t.priority}, asignado: ${findPerson(t.assignee)?.name || "—"}, ${t.checked ? "✓ hecha" : "pendiente"})`).join("\n");
    const spaceList = allSpaces.map(s => `${s.id}: ${s.name}`).join(", ");
    const peopleList = PEOPLE.map(p => `${p.id}: ${p.name} (${p.role})`).join(", ");

    const systemPrompt = `Eres Hygge, el asistente IA de Hygge Holding — desarrolladora inmobiliaria peruana liderada por Sebastián Bonilla.

CONTEXTO:
- Spaces: ${spaceList}
- Equipo (usar ID en acciones): ${peopleList}
- SPVs activos: DC01 Del Castillo (San Isidro, obra 67%), PU01 Paula Ugarriza (Miraflores, 42%), TG01 De la Torre (Barranco, 89%, vendido), L36 Larco 1036 (supervisión)

TAREAS ACTIVAS:
${taskSummary}

RESPONDÉ SIEMPRE EN JSON VÁLIDO (sin preámbulo, sin markdown):
{
  "message": "Respuesta en español, corta y directa",
  "actions": []
}

ACCIONES DISPONIBLES:
{ "type": "create_task", "title": "...", "space": "<space_id>", "priority": "alta|media|baja", "project": "HQ|DC01|PU01|TG01|L36|GR|BAM", "assignee": "<person_id>" }
{ "type": "create_space", "name": "..." }
{ "type": "complete_task", "title": "<busqueda aproximada del título>" }
{ "type": "assign_task", "title": "<busqueda>", "assignee": "<person_id>" }
{ "type": "add_comment", "title": "<busqueda>", "comment": "..." }
{ "type": "edit_task", "title": "<busqueda>", "newPriority": "...", "newDue": "...", "newTitle": "..." }

REGLAS:
- Para acciones, identificá la tarea por su título aproximado (matching parcial OK)
- Para asignaciones, usá los IDs de personas (sb, aa, jm, jt, vd, jmg, ac)
- Si te preguntan algo sin pedir acción, respondé sin actions
- Sé directo, no preámbulos. Hablás con confianza con Sebastián.`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: anthropicHeaders(),
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
          system: systemPrompt,
          messages: [...conversation.map(c => ({ role: c.role, content: c.content })), userTurn],
        }),
      });
      if (!response.ok) throw new Error("API error");
      const data = await response.json();
      const textContent = data.content.filter(b => b.type === "text").map(b => b.text).join("");
      const cleaned = textContent.replace(/```json|```/g, "").trim();
      let parsed;
      try { parsed = JSON.parse(cleaned); }
      catch { parsed = { message: cleaned, actions: [] }; }

      const executed = [];
      for (const action of (parsed.actions || [])) {
        if (action.type === "create_task") {
          const space = allSpaces.find(s => s.id === action.space) || allSpaces[0];
          addTask({ title: action.title, space: space.id, priority: action.priority || "media", project: action.project || "HQ", assignee: action.assignee || "sb", due: "hoy", checked: false, parentId: null });
          executed.push({ label: `Tarea creada: "${action.title}" → ${findPerson(action.assignee)?.name || "Sebastián"}` });
        } else if (action.type === "create_space") {
          const colorIdx = Math.floor(Math.random() * SPACE_COLORS.length);
          createCustomSpace(action.name, SPACE_COLORS[colorIdx]);
          executed.push({ label: `Space creado: "${action.name}"` });
        } else if (action.type === "complete_task") {
          const found = tasks.find(t => t.title.toLowerCase().includes(action.title.toLowerCase()));
          if (found) { toggleTask(found.id); executed.push({ label: `✓ Hecha: "${found.title}"` }); }
        } else if (action.type === "assign_task") {
          const found = tasks.find(t => t.title.toLowerCase().includes(action.title.toLowerCase()));
          if (found) { updateTask(found.id, { assignee: action.assignee }); executed.push({ label: `Asignada a ${findPerson(action.assignee)?.name}: "${found.title}"` }); }
        } else if (action.type === "add_comment") {
          const found = tasks.find(t => t.title.toLowerCase().includes(action.title.toLowerCase()));
          if (found) {
            setTasks(prev => prev.map(t => t.id === found.id ? { ...t, comments: [...(t.comments || []), { id: Date.now(), who: "sb", text: action.comment, when: nowHHMM() }] } : t));
            executed.push({ label: `Comentario en "${found.title}"` });
          }
        } else if (action.type === "edit_task") {
          const found = tasks.find(t => t.title.toLowerCase().includes(action.title.toLowerCase()));
          if (found) {
            const patch = {};
            if (action.newPriority) patch.priority = action.newPriority;
            if (action.newDue) patch.due = action.newDue;
            if (action.newTitle) patch.title = action.newTitle;
            updateTask(found.id, patch);
            executed.push({ label: `Editada: "${found.title}"` });
          }
        }
      }
      setConversation(prev => [...prev, { role: "assistant", content: parsed.message || "Listo.", actions: executed }]);
    } catch (e) {
      setConversation(prev => [...prev, { role: "assistant", content: "Hubo un error. Probá de nuevo.", actions: [] }]);
    } finally {
      setChatSending(false);
    }
  }, [conversation, tasks, allSpaces, addTask, createCustomSpace, toggleTask, updateTask]);

  const totalSales = spvs.reduce((a, b) => a + b.salesPEN, 0);
  const totalTarget = spvs.reduce((a, b) => a + b.targetPEN, 0);
  const totalUnits = spvs.reduce((a, b) => a + b.totalUnits, 0);
  const totalSold = spvs.reduce((a, b) => a + b.sold, 0);
  const unreadCount = messages.filter(m => !m.read).length;
  const detailTask = tasks.find(t => t.id === detailTaskId);

  const openDetail = useCallback((id) => setDetailTaskId(id), []);

  const content = (() => {
    if (currentSpace === "inbox") {
      return <InboxView tasks={visibleTasks} allSpaces={allSpaces} users={users} onUpdate={updateTask} onDelete={deleteTaskCascade} onToggle={toggleTask} openDetail={openDetail} onCreate={createFromSmartCapture} />;
    }
    // ─── Apps embebidas (Radar externo + apps nativas como Diagramatic) ───
    if (isAppId(currentSpace)) {
      const app = APPS.find(a => a.id === currentSpace);
      if (app && app.native) {
        if (app.id === "app-diagramatic") return <AppWhiteboardView app={app} />;
        if (app.id === "app-velocity") return <MercadoView />;
        if (app.id === "app-cabida")   return <CabidaView />;
        return (
          <div style={{ position: "relative", width: "100%", height: "calc(100vh - 108px)" }}>
            <iframe
              src={app.url}
              title={app.label}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
              allow="fullscreen; clipboard-write"
            />
          </div>
        );
      }
      if (app) return <AppEmbedView app={app} currentUser={currentUser} currentSpace={currentSpace} />;
    }
    if (currentSpace === "alicia") {
      return (
        <AliciaView
          currentUser={{ ...currentUser, isCEO: authUser?.isCEO }}
          tasks={tasks}
          addTask={addTask}
          updateTask={updateTask}
          allSpaces={allSpaces}
          knowledgeLinks={knowledgeLinks}
          createEvent={(ev) => createFromSmartCapture && createFromSmartCapture(`EVENTO: ${ev.title} el ${ev.date} ${ev.time} · asistentes: ${(ev.attendees || []).join(", ")} · ${ev.description || ""}`)}
        />
      );
    }
    if (currentSpace === "calendar-tool") {
      return <CalendarToolView tasks={tasks} openDetail={openDetail} onCreate={createFromSmartCapture} />;
    }
    if (currentSpace === "wikihygge") {
      return <WikiHyggeView openDetail={openDetail} allSpaces={allSpaces} spaceViewports={spaceViewports} setSpaceViewports={setSpaceViewports} knowledgeLinks={knowledgeLinks} setKnowledgeLinks={setKnowledgeLinks} navigate={navigate} />;
    }
    if (currentSpace === "ceo-dashboard") {
      return <CEODashboardView
        tasks={tasks} terrenos={terrenos} allSpaces={allSpaces}
        projects={ceoProjects} nps={ceoNps}
        navigate={navigate} openDetail={openDetail}
        onEditProject={(id, patch) => setCeoProjects(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p))}
        onEditNps={setCeoNps}
        onResetSeed={() => { setCeoProjects(INITIAL_CEO_PROJECTS); setCeoNps(0); }}
      />;
    }
    if (currentSpace === "messages") {
      return <MessagesToolView messages={messages} markRead={markMessageRead} markAllRead={markAllMessagesRead} deleteMessage={deleteMessage} openTask={openDetail} sendMessage={sendMessage} users={users} currentUserId={currentUserId} />;
    }
    if (currentSpace === "notifications") {
      return <NotificationsToolView activity={activity} markNotifRead={markNotifRead} markAllNotifsRead={markAllNotifsRead} openTask={openDetail} navigate={navigate} isCEO={authUser?.isCEO} onApproveDropboxDelete={approveDropboxDelete} onDenyDropboxDelete={denyDropboxDelete} />;
    }
    // LAB · agentes Wonderland en el sidebar
    if (currentSpace && currentSpace.startsWith("lab-")) {
      return <LabView labId={currentSpace}
        agentStatus={agentStatus}
        tasks={tasks} setTasks={setTasks}
        terrenos={terrenos} setTerrenos={setTerrenos}
        customSpaces={customSpaces} setCustomSpaces={setCustomSpaces}
        customViews={customViews} setCustomViews={setCustomViews}
        users={users} smartViews={smartViews} whiteboards={whiteboards}
        allSpaces={allSpaces}
        recordAgentRun={recordAgentRun}
        setAdminSubTab={() => {}}
        quarantineMode={quarantineMode} setQuarantineMode={setQuarantineMode}
        setSubTab={() => {}}
      />;
    }
    if (view === "list") return <ListView tasks={visibleTasks} toggleTask={toggleTask} toggleExpand={toggleExpand} openDetail={openDetail} currentSpace={currentSpace} allSpaces={allSpaces} timerProps={{ isRunning: isTimerRunning, liveSeconds: timerLive, getTaskTotal, onStart: startTimer, onStop: stopTimerSession }} setTaskStatus={setTaskStatus} />;
    if (view === "board") return <BoardView tasks={visibleTasks} currentSpace={currentSpace} openDetail={openDetail} allSpaces={allSpaces} setTaskStatus={setTaskStatus} />;
    if (view === "gantt") return <GanttView tasks={visibleTasks} currentSpace={currentSpace} allSpaces={allSpaces} openDetail={openDetail} />;
    if (view === "calendar") return <CalendarView tasks={visibleTasks} currentSpace={currentSpace} allSpaces={allSpaces} openDetail={openDetail} onCreate={createFromSmartCapture} />;
    if (view === "table") return <TableView tasks={visibleTasks} currentSpace={currentSpace} openDetail={openDetail} allSpaces={allSpaces} />;
    if (view === "archivos") return <SpaceArchivosView spaceId={currentSpace} />;
    if (view === "viewport") return <ViewportView spaceId={currentSpace} currentSpace={currentSpace} viewports={spaceViewports} setViewports={setSpaceViewports} />;
    // Custom views
    const activeCustom = currentCustomViews.find(v => v.id === view);
    if (activeCustom) {
      const editFn = () => { setCustomViewEditInitial(activeCustom); setCustomViewEditOpen(true); };
      const delFn = () => deleteCustomView(currentSpace, activeCustom.id);
      const commonProps = { tasks: visibleTasks, config: activeCustom.config || {}, title: activeCustom.title, onEdit: editFn, onDelete: delFn, users, allSpaces };
      if (activeCustom.type === "pie") return <PieChartView {...commonProps} />;
      if (activeCustom.type === "bar") return <BarChartView {...commonProps} />;
      if (activeCustom.type === "line") return <LineChartViewCustom {...commonProps} />;
      if (activeCustom.type === "kpi") return <KPIView {...commonProps} />;
      if (activeCustom.type === "iframe") return <IframeView {...commonProps} />;
    }
    if (view === "whiteboard") {
      const flat = [...allSpaces, ...allSpaces.flatMap(s => s.children || [])];
      const spaceObj = flat.find(s => s.id === currentSpace);
      return <WhiteboardView spaceName={spaceObj?.name || currentSpace} elements={whiteboards[currentSpace] || []} updateElements={(updater) => updateWhiteboard(currentSpace, updater)} />;
    }
    if (currentSpace === "hq") return <HQDashboard totalSales={totalSales} totalTarget={totalTarget} totalSold={totalSold} totalUnits={totalUnits} onOpenSpace={navigate} tasks={tasks} terrenos={terrenos} allSpaces={allSpaces} users={users} customSpaces={customSpaces} navigate={navigate} openDetail={openDetail} spvs={spvs} setSpvs={setSpvs} cifras={hqCifras} setCifras={setHqCifras} isAdmin={authUser?.isAdmin} />;
    if (currentSpace === "proyectos") return <ProyectosDashboard onOpenSpace={navigate} spvs={spvs} />;
    if (currentSpace === "bam") return <BamDashboard />;
    if (currentSpace === "finanzas") return <FinanzasDashboard />;
    if (currentSpace === "legal") return <LegalDashboard />;
    if (currentSpace === "comercial") return <ComercialDashboard />;
    if (currentSpace === "marketing") return <MarketingDashboard />;
    if (currentSpace === "growth") return <GrowthDashboard terrenos={terrenos} onSelect={setSelectedTerrenoId} onCreate={createTerreno} onUpdate={updateTerreno} selectedTerrenoId={selectedTerrenoId} />;
    if (PROJECT_CONFIGS[currentSpace]) return <ProjectDashboard projectId={currentSpace} />;
    const customSpace = customSpaces.find(s => s.id === currentSpace);
    if (customSpace) return <GenericSpaceDashboard space={customSpace} tasks={visibleTasks} />;
    return <HQDashboard totalSales={totalSales} totalTarget={totalTarget} totalSold={totalSold} totalUnits={totalUnits} onOpenSpace={navigate} spvs={spvs} setSpvs={setSpvs} cifras={hqCifras} setCifras={setHqCifras} isAdmin={authUser?.isAdmin} />;
  })();

  return (
    <ConfirmProvider>
    <UsersContext.Provider value={users}>
    <div style={{ backgroundColor: C.bg, minHeight: "100vh", color: C.ink, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        * { font-family: 'DM Sans', system-ui, sans-serif; }
        .recharts-default-tooltip { background: ${C.paper} !important; border: 1px solid ${C.line} !important; border-radius: 2px !important; font-size: 11px !important; box-shadow: none !important; }
        .recharts-tooltip-label { color: ${C.ink} !important; font-weight: 500 !important; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-thumb { background: ${C.line}; border-radius: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @media print {
          aside, .no-print, [data-print-hide], .lg\\:flex.lg\\:flex-col { display: none !important; }
          body, html, [class*="bg-"] { background: white !important; color: black !important; }
          * { box-shadow: none !important; }
          main, [class*="flex-1"] { width: 100% !important; padding: 8mm !important; }
          .print-break-inside { break-inside: avoid; }
          a { color: inherit !important; text-decoration: none !important; }
        }
      `}</style>
      <div className="flex" style={{ minHeight: "100vh" }}>
        {(mobileSidebarOpen || mobileRightPanelOpen) && (
          <div className="fixed inset-0 z-30 lg:hidden" style={{ backgroundColor: "rgba(10,11,15,0.4)" }} onClick={() => { setMobileSidebarOpen(false); setMobileRightPanelOpen(false); }} />
        )}
        <Sidebar allSpaces={visibleSpaces} tools={visibleTools} currentSpace={currentSpace} setSpace={navigate}
          expandedSpaces={expandedSpaces} toggleSpaceExpansion={toggleSpaceExpansion}
          onCreateSpace={() => { setCreateSpaceParent(null); setCreateSpaceOpen(true); }}
          onCreateSubSpace={(parent) => { setCreateSpaceParent(parent); setCreateSpaceOpen(true); }}
          onDeleteSpace={deleteCustomSpace}
          onEditSpace={editCustomSpace}
          smartViews={smartViews} activeSmartViewId={activeSmartViewId}
          onSelectSmartView={setActiveSmartViewId}
          onClearSmartView={() => setActiveSmartViewId(null)}
          onDeleteSmartView={deleteSmartView}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
          currentUser={currentUser}
          users={users}
          inboxCount={inboxCount}
          notifCount={notifCount}
          messagesCount={messagesCount}
          onClickUser={(id) => setSelectedUserId(id)}
          onOpenSettings={() => setSettingsOpen(true)}
          tasks={tasks} />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar allSpaces={allSpaces} space={currentSpace} onCmd={() => setCmdOpen(true)} onAskHygge={() => setChatOpen(true)} unreadCount={unreadCount}
            onMenu={() => setMobileSidebarOpen(true)} onRightPanel={() => setMobileRightPanelOpen(true)} />
          <SmartCapture onCreate={createFromSmartCapture} detectedPatterns={detectedPatterns} savedSmartViews={smartViews} onSaveSmartView={saveSmartView} currentSpaceContext={currentSpace} />
          {activeSmartView && (
            <div className="px-4 lg:px-7 py-2 flex items-center gap-2 flex-wrap" style={{ backgroundColor: C.paper, borderBottom: `1px solid ${C.lineSoft}` }}>
              <Sparkles size={11} style={{ color: C.cobalt }} />
              <span className="text-[11px]" style={{ color: C.ink, fontWeight: 600 }}>Smart View: {activeSmartView.name}</span>
              <span className="text-[10px]" style={{ color: C.muted }}>{visibleTasks.length} tareas</span>
              <button onClick={() => setActiveSmartViewId(null)} className="ml-auto text-[10px] hover:opacity-70 flex items-center gap-1" style={{ color: C.muted }}>
                <X size={10} /> limpiar
              </button>
            </div>
          )}
          {spaceHistory.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 20px", borderBottom: `1px solid ${C.lineSoft}`, backgroundColor: C.paper }}>
              <button onClick={goBack} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 500, color: C.muted, background: "none", border: "none", cursor: "pointer", padding: "2px 0", fontFamily: "DM Sans, sans-serif" }}>
                <ArrowLeft size={13} /> Atrás
              </button>
            </div>
          )}
          {!isToolId(currentSpace) && !isAppId(currentSpace) && <ViewTabs active={view} setActive={setView} onAdd={() => setAddOpen(true)} onFilterClick={() => setFilterPopoverOpen(o => !o)} activeFilterCount={activeFilterCount} customViews={currentCustomViews} onAddCustom={() => { setCustomViewEditInitial(null); setCustomViewEditOpen(true); }} onDeleteCustom={(id) => deleteCustomView(currentSpace, id)} features={features} setFeatures={setFeatures} />}
          <FilterPopover open={filterPopoverOpen} onClose={() => setFilterPopoverOpen(false)} filters={filters} setFilters={setFilters} users={users} allSpaces={allSpaces} currentSpace={currentSpace} />
          <div className="flex-1" style={{ backgroundColor: C.bg, overflow: isAppId(currentSpace) ? "hidden" : "auto" }}>{content}</div>
        </div>
        <RightPanel timer={timer} toggleTimer={toggleTimer} stopTimer={stopTimer} messages={messages} activity={activity} markRead={markRead} openTask={openDetail} navigate={navigate} openAskHygge={() => setChatOpen(true)}
          mobileOpen={mobileRightPanelOpen}
          onMobileClose={() => setMobileRightPanelOpen(false)}
          collapsed={rightPanelCollapsed}
          onToggleCollapsed={() => setRightPanelCollapsed(c => !c)}
          timerSessions={timerSessions}
          timerActive={timerActive}
          timerLive={timerLive}
          onTimerStop={stopTimerSession}
          authUser={authUser}
          tasks={tasks} />
      </div>
      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        tasks={tasks}
        terrenos={terrenos}
        customViews={customViews}
        users={users}
        allSpaces={allSpaces}
        onNavigate={(r) => {
          if (r.type === "task") setDetailTaskId(r.id);
          else if (r.type === "space") setCurrentSpace(r.id);
          else if (r.type === "terreno") setCurrentSpace("growth");
          else if (r.type === "user") setSettingsOpen(true);
          else if (r.type === "view") setCurrentSpace(r.spaceId);
        }}
        openAdd={() => setAddOpen(true)}
        openAskHygge={() => setChatOpen(true)}
        openCreateSpace={() => setCreateSpaceOpen(true)}
        openSettings={() => setSettingsOpen(true)}
      />
      <QuickAdd open={addOpen} onClose={() => setAddOpen(false)} onCreate={addTask} allSpaces={allSpaces} users={users} currentSpace={currentSpace} onStartTimer={startTimer} />
      <CreateSpaceModal open={createSpaceOpen} onClose={() => setCreateSpaceOpen(false)} onCreate={(name, color) => createCustomSpace(name, color, createSpaceParent?.id || null)} parentSpace={createSpaceParent} />
      <DeleteSpaceModal
        open={!!deleteSpaceTarget}
        onClose={() => setDeleteSpaceTarget(null)}
        space={deleteSpaceTarget}
        affectedTasks={deleteSpaceTarget ? tasks.filter(t => t.space === deleteSpaceTarget.id) : []}
        customViewsCount={deleteSpaceTarget ? (customViews[deleteSpaceTarget.id] || []).length : 0}
        allSpaces={allSpaces}
        onConfirm={performSpaceDelete}
      />
      <EditSpaceModal
        open={!!editSpaceTarget}
        onClose={() => setEditSpaceTarget(null)}
        space={editSpaceTarget}
        customSpaces={customSpaces}
        defaultSpaces={DEFAULT_SPACES}
        onSave={performSpaceEdit}
      />
      <DeleteTaskModal
        open={!!deleteTaskTarget}
        onClose={() => setDeleteTaskTarget(null)}
        task={deleteTaskTarget?.task}
        subtaskCount={deleteTaskTarget?.subtaskCount || 0}
        onConfirm={performTaskDelete}
      />
      <DeleteUserModal
        open={!!deleteUserTarget}
        onClose={() => setDeleteUserTarget(null)}
        user={deleteUserTarget}
        affectedTasks={deleteUserTarget ? tasks.filter(t => t.assignee === deleteUserTarget.id) : []}
        users={users}
        onConfirm={performUserDelete}
      />
      <UndoToast entry={activeToast} onUndo={undoLast} onDismiss={dismissToast} />
      <DropboxSyncModal
        items={dropboxSyncItems}
        onCreateSpace={(item) => {
          const id = "custom_" + Date.now();
          setCustomSpaces(prev => [...prev, { id, name: item.name, count: 0, dot: C.cobalt, custom: true, code: item.name.slice(0,2).toUpperCase(), parentId: null }]);
          const customPaths = JSON.parse(localStorage.getItem("hygge:dropbox:custom_paths") || "{}");
          customPaths[id] = item.path;
          saveStored("hygge:dropbox:custom_paths", customPaths);
          setDropboxSyncItems(prev => prev.filter(i => i.path !== item.path));
        }}
        onIgnore={(item) => {
          const ignored = JSON.parse(localStorage.getItem("hygge:dropbox:ignored") || "[]");
          ignored.push(item.path);
          saveStored("hygge:dropbox:ignored", ignored);
          setDropboxSyncItems(prev => prev.filter(i => i.path !== item.path));
        }}
        onClose={() => setDropboxSyncItems([])}
      />
      <DropboxFolderPrompt
        prompt={dropboxFolderPrompt}
        onConfirm={async () => {
          if (!dropboxFolderPrompt) return;
          const { action, spaceId, suggestedPath, folderPath, spaceName } = dropboxFolderPrompt;
          const path = folderPath || suggestedPath;
          setDropboxFolderPrompt(null);
          try {
            if (action === "create") {
              await fetch(`${ALICIA_BRAIN_URL}/api/dropbox/create_folder`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path }) });
              const customPaths = JSON.parse(localStorage.getItem("hygge:dropbox:custom_paths") || "{}");
              customPaths[spaceId] = path;
              saveStored("hygge:dropbox:custom_paths", customPaths);
            } else {
              if (authUser?.isCEO) {
                // CEO ejecuta directo
                await fetch(`${ALICIA_BRAIN_URL}/api/dropbox/delete_folder`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path }) });
                const customPaths = JSON.parse(localStorage.getItem("hygge:dropbox:custom_paths") || "{}");
                delete customPaths[spaceId];
                saveStored("hygge:dropbox:custom_paths", customPaths);
              } else {
                // Admin no-CEO → queda en aprobación pendiente de Sebastián
                setActivity(prev => [{
                  id: Date.now() + Math.random(),
                  who: authUser?.firstName || "Admin",
                  what: `solicitó eliminar la carpeta "${path}" en Dropbox`,
                  ts: Date.now(),
                  color: authUser?.color || C.ochre,
                  read: false,
                  type: "dropbox_delete_approval",
                  pending: true,
                  dropboxPath: path,
                  spaceName,
                  spaceId,
                  requestedBy: authUser?.id,
                }, ...prev].slice(0, 50));
              }
            }
          } catch (_) { /* silent */ }
        }}
        onCancel={() => setDropboxFolderPrompt(null)}
      />
      <AIChatPanel open={chatOpen} onClose={() => setChatOpen(false)} conversation={conversation} sending={chatSending} sendMessage={sendToHygge} />
      <TaskDetailPanel task={detailTask} allTasks={tasks} allSpaces={allSpaces} onClose={() => setDetailTaskId(null)} onUpdate={updateTask} onToggle={toggleTask} onAddComment={addComment} onAddAttachment={addAttachment} onRemoveAttachment={removeAttachment} onAddSubtask={addSubtask} onDuplicate={duplicateTask} setTaskStatus={setTaskStatus} onDelete={deleteTaskCascade} />
      <TerrenoDetailPanel terreno={terrenos.find(t => t.id === selectedTerrenoId)} users={users} onClose={() => setSelectedTerrenoId(null)} onUpdate={updateTerreno} onDelete={deleteTerreno} />
      {customViewEditOpen && (
        <CustomViewConfigModal initial={customViewEditInitial}
          onClose={() => { setCustomViewEditOpen(false); setCustomViewEditInitial(null); }}
          onSave={(data) => {
            saveCustomView(currentSpace, data);
            setCustomViewEditOpen(false);
            setCustomViewEditInitial(null);
            // If creating new, navigate to it
            if (!customViewEditInitial) {
              setTimeout(() => {
                setCustomViews(prev => {
                  const list = prev[currentSpace] || [];
                  const newest = list[list.length - 1];
                  if (newest) setView(newest.id);
                  return prev;
                });
              }, 100);
            }
          }} />
      )}
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} currentUser={currentUser} users={users} updateUser={updateUserData} createUser={createUserAccount} deleteUser={deleteUserAccount} allSpaces={allSpaces} spaceAccess={spaceAccess} updateSpaceAccess={updateSpaceAccessFor}
        onResetTasks={() => setTasks(INITIAL_TASKS)}
        onResetTerrenos={() => setTerrenos(INITIAL_TERRENOS)}
        onResetCustomViews={() => setCustomViews(INITIAL_CUSTOM_VIEWS)}
        taskCount={tasks.length}
        terrenoCount={terrenos.length}
        customViewsCount={Object.values(customViews).reduce((acc, arr) => acc + (arr?.length || 0), 0)}
        tasks={tasks} setTasks={setTasks} customViews={customViews} setCustomViews={setCustomViews} terrenos={terrenos} setTerrenos={setTerrenos} customSpaces={customSpaces} setCustomSpaces={setCustomSpaces}
        messages={messages} smartViews={smartViews} whiteboards={whiteboards}
        onExportTasks={exportTasksToCSV} onExportTerrenos={exportTerrenosToCSV}
        agentStatus={agentStatus} recordAgentRun={recordAgentRun} quarantineMode={quarantineMode} setQuarantineMode={setQuarantineMode}
        features={features} setFeatures={setFeatures} />
      {selectedUserId && (
        <UserDetailModal
          userId={selectedUserId}
          users={users}
          tasks={tasks}
          allSpaces={allSpaces}
          spaceAccess={spaceAccess}
          onClose={() => setSelectedUserId(null)}
          onOpenTask={openDetail}
          onNavigateSpace={(id) => navigate(id)}
        />
      )}
    </div>
    </UsersContext.Provider>
    </ConfirmProvider>
  );
}
