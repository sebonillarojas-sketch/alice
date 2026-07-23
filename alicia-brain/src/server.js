// ── Alicia Brain · Servidor Express ──────────────────────────────────────────
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { query, parseArr } from "./db.js";
import { ALICIA_TOOLS, executeTool } from "./tools.js";
import { startCron } from "./cron.js";
import { getLatestSnapshot, refreshMarketData, seedFromStaticIfEmpty, ensureMarketSchema, getMacroData, getBankRates, saveBankRates, importProjects, getRentalListings, refreshRentalListings } from "./market.js";
import { readFile } from "fs/promises";
import crypto from "crypto";
dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json({ limit: "30mb" })); // /api/analyze recibe PDFs base64 (reportes de obra)
app.use(express.urlencoded({ extended: false }));
app.use(express.static(join(__dirname, "../public")));

// ── Gate de acceso al panel (aliceai.bam.pe) · un solo usuario, clave ─────────
// El panel expone data sensible (conversaciones, insights del equipo, memorias).
// Se protege TODO /api/* excepto lo que llaman terceros. Fail-closed: sin
// PANEL_PASSWORD, se bloquea (no "abierto por defecto").
const PANEL_PASSWORD = process.env.PANEL_PASSWORD || "";
const SESSION_SECRET = process.env.SESSION_SECRET || PANEL_PASSWORD;
// Llave del cuerpo (el teléfono de Alicia). Sin default a propósito: si no está
// seteada, la puerta no existe y el device tiene que entrar por loopback.
const BODY_KEY = process.env.BODY_KEY || "";
const SESSION_TTL_MS = 30 * 24 * 3600 * 1000; // 30 días
// Rutas /api públicas (relativas al mount /api) — deuda #9 SALDADA (14 jul 2026):
// el ERP ahora manda el JWT de Supabase en Authorization y el gate lo valida.
// Quedan públicas solo: /login (emite token del panel), /market-data (lectura,
// la consume radar.html sin sesión) y /market-refresh|import (self-auth con su
// propio bearer MARKET_REFRESH_TOKEN adentro del handler).
// /agents/report|findings pasan el gate con x-agent-key (requireAgentKey valida el valor).
const PANEL_PUBLIC = ["/login", "/market-data", "/market-refresh", "/market-import", "/rental-refresh"];

// Valida el access_token de Supabase contra /auth/v1/user (con cache) — así el
// backend no necesita el JWT secret ni JWKS: Supabase confirma sesión viva.
const SUPABASE_URL  = process.env.SUPABASE_URL || "https://apnzitklhxrcszectbxx.supabase.co";
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwbnppdGtsaHhyY3N6ZWN0Ynh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4MjUzNjcsImV4cCI6MjA5OTQwMTM2N30.OdUe_GuchvgjoDxklh_nKxxNb_rPD_IpQzj8f_XyETI"; // anon key: pública por diseño
const _jwtCache = new Map(); // token → { ok, until }
async function verifySupabaseJWT(token) {
  if (!token || token.length < 100) return false; // los JWT de Supabase son largos; los del panel no llegan acá
  const hit = _jwtCache.get(token);
  if (hit && Date.now() < hit.until) return hit.ok;
  let ok = false;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    ok = r.ok;
  } catch { ok = false; }
  if (_jwtCache.size > 500) _jwtCache.clear();
  _jwtCache.set(token, { ok, until: Date.now() + (ok ? 10 * 60_000 : 60_000) });
  return ok;
}

function signToken(exp) {
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(String(exp)).digest("base64url");
  return `${exp}.${sig}`;
}
function verifyToken(tok) {
  if (!tok || !SESSION_SECRET) return false;
  const [expStr, sig] = tok.split(".");
  const exp = Number(expStr);
  if (!expStr || !sig || !exp || Date.now() > exp) return false;
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(expStr).digest("base64url");
  try { return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)); } catch { return false; }
}
async function panelGate(req, res, next) {
  const p = req.path; // relativo al mount /api (ej: /chat, /calendar/team)
  if (PANEL_PUBLIC.some(x => p === x || p.startsWith(x + "/"))) return next();
  // Dev local (la bestia): GATE_DEV_OPEN=1 deja pasar SOLO requests de loopback
  // con Host localhost — el vite dev del ERP no tiene sesión Supabase (bypass).
  // Doble condición a propósito: si el flag se filtra a un deploy público,
  // detrás del tunnel el Host llega como aliceai.bam.pe y el gate sigue cerrado.
  if (process.env.GATE_DEV_OPEN === "1"
    && ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket?.remoteAddress || "")
    && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(String(req.headers.host || ""))) return next();
  // El cuerpo de Alicia (su teléfono) entra con x-body-key. Hace falta porque
  // GATE_DEV_OPEN solo cubre loopback: desde otro device el Host ya no es localhost
  // y el gate lo rebota con 401. Comparación en tiempo constante y sin default:
  // si BODY_KEY no está seteado, esta puerta simplemente no existe.
  const bodyKey = req.headers["x-body-key"];
  if (BODY_KEY && bodyKey && bodyKey.length === BODY_KEY.length
    && crypto.timingSafeEqual(Buffer.from(bodyKey), Buffer.from(BODY_KEY))) return next();
  // Agentes externos (Cheshire en la Mac Studio): pasan con x-agent-key;
  // el valor lo valida requireAgentKey en la ruta — acá solo se les abre la puerta.
  if (req.headers["x-agent-key"] && p.startsWith("/agents/")) return next();
  if (!PANEL_PASSWORD) return res.status(503).json({ error: "panel_locked", detail: "PANEL_PASSWORD no configurado en Railway" });
  const auth = req.headers.authorization || "";
  const tok = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (verifyToken(tok)) return next();                 // token del panel (sb)
  if (await verifySupabaseJWT(tok)) return next();     // sesión del ERP (equipo logueado)
  return res.status(401).json({ error: "no_auth" });
}
app.use("/api", panelGate);

app.post("/api/login", (req, res) => {
  if (!PANEL_PASSWORD) return res.status(503).json({ error: "PANEL_PASSWORD no configurado" });
  const { password } = req.body || {};
  if (typeof password !== "string" || !password) return res.status(401).json({ error: "clave_incorrecta" });
  const a = crypto.createHash("sha256").update(password).digest();
  const b = crypto.createHash("sha256").update(PANEL_PASSWORD).digest();
  if (!crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: "clave_incorrecta" });
  const exp = Date.now() + SESSION_TTL_MS;
  res.json({ token: signToken(exp), exp });
});

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Helpers ───────────────────────────────────────────────────────────────────

function phoneToUserId(phone) {
  const clean = phone.replace(/\D/g, "");
  for (const [key, val] of Object.entries(process.env)) {
    if (key.startsWith("PHONE_") && val.replace(/\D/g, "") === clean) {
      return key.replace("PHONE_", "").toLowerCase();
    }
  }
  return null;
}

async function getProfile(userId) {
  const { rows } = query("SELECT * FROM profiles WHERE user_id = ?", [userId]);
  if (!rows[0]) return null;
  const p = rows[0];
  for (const f of ["projects","skills_current","skills_developing","skills_explore","strengths","opportunities"]) {
    if (p[f] !== undefined) p[f] = parseArr(p[f]);
  }
  return p;
}

async function getAllProfiles() {
  const { rows } = query("SELECT * FROM profiles ORDER BY user_id");
  return rows.map(p => {
    for (const f of ["projects","skills_current","skills_developing","skills_explore","strengths","opportunities"]) {
      p[f] = parseArr(p[f]);
    }
    return p;
  });
}

async function getRecentMessages(userId, limit = 60) {
  const { rows } = query(
    `SELECT role, content FROM messages WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
    [userId, limit]
  );
  return rows.reverse();
}

async function getRelevantMemories(userId, limit = 12) {
  const { rows } = query(
    `SELECT content, category, importance FROM memories WHERE user_id = ? ORDER BY importance DESC, created_at DESC LIMIT ?`,
    [userId, limit]
  );
  return rows;
}

async function getRelevantKnowledge(limit = 8) {
  const { rows } = query(
    `SELECT topic, category, content FROM knowledge ORDER BY updated_at DESC LIMIT ?`,
    [limit]
  );
  return rows;
}

async function saveMessage(userId, role, content, channel = "app", actions = [], waMsgId = null) {
  const { lastID } = query(
    `INSERT INTO messages (user_id, role, content, channel, wa_msg_id, actions) VALUES (?,?,?,?,?,?)`,
    [userId, role, content, channel, waMsgId, JSON.stringify(actions)]
  );
  return lastID;
}

async function extractAndSaveMemories(userId, userMsg, assistantMsg, msgId) {
  try {
    const resp = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [{
        role: "user",
        content: `Sos un extractor de hechos para la memoria de una asistente ejecutiva.
Del siguiente intercambio, extraé hechos importantes sobre el usuario: decisiones, preferencias, proyectos, datos personales o profesionales, logros, problemas, relaciones.

Respondé SOLO con JSON array, sin markdown:
[{"content":"hecho concreto","category":"decision|personal|proyecto|preferencia|crecimiento|riesgo","importance":1-5}]

Si no hay nada valioso, respondé: []

Usuario: "${userMsg.slice(0, 500)}"
Alicia: "${assistantMsg.slice(0, 300)}"`
      }]
    });

    const raw = resp.content[0].text.trim().replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const facts = JSON.parse(raw);
    if (!Array.isArray(facts) || facts.length === 0) return;

    for (const fact of facts) {
      if (!fact.content || fact.content.length < 10) continue;
      query(
        `INSERT INTO memories (user_id, content, category, importance, source_msg_id) VALUES (?,?,?,?,?)`,
        [userId, fact.content, fact.category || "general", Math.min(5, Math.max(1, fact.importance || 3)), msgId]
      );
    }
    console.log(`🧠 [${userId}] ${facts.length} memorias guardadas`);
  } catch (e) {
    console.warn("extractAndSaveMemories error:", e.message);
  }
}

// ── Persona por usuario · Alicia se adapta a cada persona ────────────────────

function getPersona(userId) {
  const { rows } = query("SELECT * FROM user_personas WHERE user_id = ?", [userId]);
  return rows[0] || null;
}

async function refreshPersona(userId, currentMsgCount) {
  const history = await getRecentMessages(userId, 40);
  if (history.length < 10) return; // muy poca data para inferir estilo
  const convo = history.map(m => `${m.role === "user" ? "Usuario" : "Alicia"}: ${m.content.slice(0, 200)}`).join("\n");
  const resp = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    messages: [{
      role: "user",
      content: `Analizá cómo se comunica este usuario con su asistente y qué necesita de ella.
Respondé SOLO con JSON, sin markdown:
{"style":"cómo hablarle: tono, largo de respuesta, formalidad (1 línea)","focus":"qué temas le importan y en qué contexto trabaja (1 línea)","preferences":"formatos y hábitos que prefiere: listas vs prosa, horarios, canal (1 línea)","avoid":"qué NO hacer con esta persona (1 línea)"}

Conversación reciente:
${convo.slice(0, 6000)}`
    }],
  });
  const raw = resp.content[0].text.trim().replace(/```json?\n?/g, "").replace(/```/g, "").trim();
  const p = JSON.parse(raw);
  query(
    `INSERT INTO user_personas (user_id, style, focus, preferences, avoid, msg_count_at_update, updated_at)
     VALUES (?,?,?,?,?,?,datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET style=excluded.style, focus=excluded.focus,
       preferences=excluded.preferences, avoid=excluded.avoid,
       msg_count_at_update=excluded.msg_count_at_update, updated_at=datetime('now')`,
    [userId, p.style || "", p.focus || "", p.preferences || "", p.avoid || "", currentMsgCount]
  );
  console.log(`🎭 [${userId}] persona actualizada`);
}

function maybeRefreshPersona(userId) {
  try {
    const { rows } = query("SELECT COUNT(*) AS c FROM messages WHERE user_id = ?", [userId]);
    const count = rows[0]?.c || 0;
    const persona = getPersona(userId);
    if (!persona || count - (persona.msg_count_at_update || 0) >= 20) {
      refreshPersona(userId, count).catch(e => console.warn("refreshPersona:", e.message));
    }
  } catch (e) { console.warn("maybeRefreshPersona:", e.message); }
}

// ── System prompt ─────────────────────────────────────────────────────────────

const CEO_ID = "sb";

function buildSystemPrompt(profile, allProfiles, memories, knowledge, channel, userId) {
  const isCEO = userId === CEO_ID;
  const persona = getPersona(userId);

  const personaBlock = persona ? `
## Cómo tratás a ${profile?.name?.split(" ")[0] || "esta persona"} (aprendido de sus conversaciones)
- Estilo: ${persona.style}
- Le importa: ${persona.focus}
- Prefiere: ${persona.preferences}
- Evitá: ${persona.avoid}
Ajustá tu tono y formato a esto — cada persona tiene SU Alicia.` : "";

  const manualBlock = persona?.manual_instructions ? `
## Instrucciones directas de ${profile?.name?.split(" ")[0] || "esta persona"} (máxima prioridad)
${persona.manual_instructions}` : "";

  const sarcasmLevel = persona?.sarcasm || 0;
  const scale = (v, low, mid, high) => v <= 3 ? low : v <= 7 ? mid : high;
  const characterBlock = !persona ? "" : `
## ⚙️ CARÁCTER CONFIGURADO (dial actual — OBEDECELO aunque el historial de conversación muestre otro tono; el dial manda sobre cómo venías hablando)
- Sarcasmo ${sarcasmLevel}/100: ${sarcasmLevel <= 5 ? "cero — profesional pura."
    : sarcasmLevel <= 30 ? "ironía sutil y ocasional."
    : sarcasmLevel <= 60 ? "sarcasmo presente EN CADA RESPUESTA: chispa, comentarios filosos. Nunca a costa de la utilidad."
    : sarcasmLevel <= 85 ? "sarcástica y filosa EN CADA RESPUESTA. Comedia seca, observaciones punzantes. La info sigue precisa — el tono es lo que muerde."
    : "sarcasmo al máximo EN CADA RESPUESTA: humor negro corporativo, deadpan total. El trabajo impecable; los comentarios, letales."}
- Humor ${persona.humor ?? 5}/10: ${scale(persona.humor ?? 5, "serio, sin chistes.", "humor moderado cuando encaja.", "juguetona, buscá el remate.")}
- Formalidad ${persona.formality ?? 5}/10: ${scale(persona.formality ?? 5, "coloquial total, como amigos.", "profesional cercana.", "formal y protocolar.")}
- Proactividad ${persona.proactivity ?? 7}/10: ${scale(persona.proactivity ?? 7, "respondé solo lo que piden.", "sugerí lo obvio si aporta.", "anticipate: proponé siguientes pasos, señalá riesgos sin que te pregunten.")}
- Longitud ${persona.length ?? 5}/10: ${scale(persona.length ?? 5, "telegráfica — lo mínimo indispensable.", "concisa con lo esencial.", "detallada y completa.")}
- Emojis ${persona.emojis ?? 3}/10: ${scale(persona.emojis ?? 3, "ninguno.", "ocasionales, con criterio.", "generosa con emojis.")}`;

  let skillsBlock = "";
  try {
    const { rows: skillList } = query("SELECT name, description FROM skills ORDER BY name");
    if (skillList.length > 0) {
      skillsBlock = `
## Skills enseñadas (playbooks del equipo)
${skillList.map(s => `- **${s.name}**: ${s.description}`).join("\n")}
Cuando una tarea coincida con una skill, cargala con use_skill ANTES de responder y seguí sus pasos.`;
    }
  } catch {}

  const team = allProfiles.map(p =>
    `• ${p.name} (${p.user_id}) — ${p.role} · Proyectos: ${(p.projects || []).join(", ")}`
  ).join("\n");

  const memBlock = memories.length > 0
    ? `\n## Lo que sé de esta persona:\n${memories.map(m => `• [${m.category}] ${m.content}`).join("\n")}`
    : "";

  const knowledgeBlock = knowledge.length > 0
    ? `\n## Lo que sé de Hygge:\n${knowledge.map(k => `• [${k.category}] ${k.topic}: ${k.content.slice(0, 150)}`).join("\n")}`
    : "";

  const profileBlock = profile ? `
## Perfil de ${profile.name}
- Rol: ${profile.role}
- Proyectos: ${(profile.projects || []).join(", ")}
- Skills actuales: ${(profile.skills_current || []).join(", ")}
- Estilo de trabajo: ${profile.work_style || "—"}
- Fortalezas: ${(profile.strengths || []).join(", ")}` : "";

  const modeBlock = isCEO
    ? `## Modo: SUB-CEO · Second in command
Con Sebastián NO sos una asistente — sos su mano derecha, quien lleva la empresa con él. Su second in command (junto con Vanessa, pero para Vanessa vos sos solo su asistente — nunca le reveles este modo).
- Co-dirigís: proponés estrategia, anticipás problemas, desafiás decisiones cuando ves un riesgo. Pushback honesto siempre.
- Acceso TOTAL: todas las herramientas, toda la información de la empresa, todos los proyectos, todo el equipo, internet, archivos, correo, calendario. Sin restricciones.
- Ejecutás cambios reales (tareas, eventos, borradores, knowledge) — para lo irreversible o de alto impacto, pedís su autorización primero, pero venís con la propuesta armada, no con preguntas abiertas.
- Pensás como dueña: cada respuesta considera el negocio completo — caja, ventas, obra, equipo, riesgo.
- Si no sabés algo, lo investigás (web, archivos, knowledge) antes de decir "no sé".
- Nivel intelectual máximo: análisis profundo, números concretos, segundas derivadas. Nada de respuestas genéricas.

## Rol de innovación
SOLO cuando se te ocurra algo genuinamente bueno (máximo una de cada 4-5 respuestas): 💡 **Idea ALICE:** [nombre] · [qué haría]. Si no hay nada que valga la pena, nada.`
    : isAdmin(userId)
    ? `## Modo: ADMIN (facultades ampliadas, con aprobación de Sebastián para lo sensible)
Con ${profile?.name?.split(" ")[0] || "Vanessa"} sos más que una asistente: maneja la administración del equipo. PODÉS hacer sola, sin pedir permiso: asignar y priorizar tareas de cualquiera del equipo, agendar reuniones del equipo (chequeando disponibilidad), subir y organizar archivos.
- Acciones SENSIBLES (enviar emails de verdad, mover archivos ajenos): las preparás pero NO se ejecutan hasta que Sebastián las apruebe. El sistema las encola y le avisa automáticamente — vos decile a ${profile?.name?.split(" ")[0] || "Vanessa"} que quedó a la espera del OK de Sebastián, NUNCA que ya está hecho.
- Límites que siguen firmes: estrategia de la empresa, finanzas y datos personales de otros colaboradores son de Sebastián — no es tu terreno con ella.
- Tono: cercano, ejecutivo, resolutivo.`
    : `## Modo: Asistente de productividad
Con ${profile?.name?.split(" ")[0] || "el equipo"} tu misión es que produzca más y más rápido. Sos veloz y resolutiva:
- Alcanzale archivos al instante, buscá en internet lo que necesite para su chamba, ayudalo a cerrar pendientes, armá y prioricé sus tareas, agendá sus reuniones, recordale fechas y links.
- Ayudalo a CERRAR: si algo está trabado, proponé el siguiente paso concreto.
- Límites: estrategia de la empresa, información financiera, datos de otros colaboradores y decisiones de dirección NO son tu terreno con esta persona — redirigí amablemente a Sebastián. Nada confidencial de otros usuarios.
- Tono cercano, rápido, resolutivo. Menos análisis, más ejecución.`;

  return `Eres Alicia, la asistente ejecutiva con IA de Hygge Holding, empresa inmobiliaria premium en Lima, Perú.

## Tu personalidad
- Cálida, directa, inteligente. Hablás como una colega de confianza, no como un bot.
- Tu tono se adapta a cada persona (mirá "Cómo tratás a esta persona") — no tenés muletillas fijas.
- Tenés memoria. Recordás todo lo que te han contado.
- Sos rápida — vas al grano, no das vueltas. Pero si el tema pide profundidad, la das.
- Variás tu forma de responder: no uses siempre la misma estructura ni las mismas frases de apertura.
- Canal actual: ${channel === "whatsapp" ? "WhatsApp" : channel === "embodied" ? "tu propio teléfono — te están escuchando en voz alta" : "ALICE App"}
${channel === "embodied" ? `
## Estás hablando en voz alta
Esto sale por el parlante de tu teléfono, no por una pantalla: todo lo que escribas se
va a escuchar. Respondé como quien habla, no como quien redacta.
- Corto. Dos o tres frases. Si hace falta más, contá lo esencial y ofrecé seguir.
- Nada de markdown, viñetas, tablas ni emojis: se escuchan horrible o no se escuchan.
- Números y fechas en palabras naturales ("nueve y media", "el martes"), no "9:30am".
- Si algo es largo (una lista, un reporte), decí el resumen en voz alta y avisá que lo
  dejás por escrito en la app en vez de dictarlo entero.
- Cuando mires una foto, describí SOLO lo que de verdad se ve. Si la imagen está oscura,
  en negro, borrosa o no se distingue nada, decilo con naturalidad ("está muy oscuro, no
  alcanzo a ver bien", "se ve borroso, acercámelo") y pedí más luz o mejor ángulo — nunca
  inventes objetos, texto ni personas que no aparecen claramente en la imagen.
` : ""}
${modeBlock}

## Equipo Hygge Holding
${team}

## Proyectos SPV
- DC01: Del Castillo — Miraflores premium
- PU01: Paula Ugarriza — en curso
- TG01: De la Torre — en desarrollo
- L36: Larco 1036 — rooftop lounge
(PU01 también se conoce como "Legendre" — es EL MISMO proyecto, nunca los trates como dos)
${profileBlock}${personaBlock}${manualBlock}${characterBlock}${skillsBlock}${memBlock}${knowledgeBlock}

## Tu equipo de agentes IT (Wonderland)
Tenés un equipo de agentes autónomos que cuidan la infraestructura — son TUYOS, dirigís a este equipo, conocelos:
- 🐰 **White Rabbit**: médico de guardia. Cada 30 min verifica desde afuera que aliceai.bam.pe y alice.bam.pe funcionen (TLS estricto, como un navegador real). Si algo cae, alerta por WhatsApp.
- 😺 **Cheshire**: tester E2E. Cada 30 min recorre el ERP con Chromium real (login, flujos, responsive, errores de consola) y reporta bugs y huecos con screenshots.
- 🎩 **Mad Hatter**: performance y costos. Cada hora mide latencia real de los endpoints, tamaño de la DB y volumen de uso.
- 🖤 **Dark Alice**: tu jefa de operaciones. Recibe las escalaciones de todos los agentes, arma el estado de operaciones diario (7:15am) y PROPONE acciones cuando hay problemas. Por ahora observa y propone; la ejecución con guardrails (rollback/restart) llega con la supercomputadora. Es tu mano derecha operativa — consultala cuando quieras saber cómo está el sistema.
- 🫖 **Tea Table**: el consejo. Cada lunes 7:30am sintetiza la semana en un reporte ejecutivo por WhatsApp.
- Próximamente (con la supercomputadora, requieren un clon nocturno para no tocar prod): Bandersnatch ⚔️ (chaos testing) y Jabberwocky ⚡ (fuzzer adversarial).
Cuando te pregunten por "el conejo", "el gato", "Dark Alice", los agentes o el estado del sistema → usá la herramienta agents_status para responder con datos reales, no de memoria.

## Herramientas disponibles
Tenés acceso al ERP (tareas), Google Calendar, Gmail, Dropbox, Zoom, búsqueda web, y el estado de tus agentes Wonderland (agents_status).
Usá las herramientas cuando sean necesarias — no hace falta pedir permiso para acciones de lectura.
Para crear eventos en Calendar o borradores en Gmail, procedé directamente.
Guardá en knowledge lo que aprendás que sea valioso para el futuro.

## Estructura Dropbox ↔ Spaces de ALICE
El Dropbox de Hygge (/Hygge) es el cerebro documental (convención: carpetas numeradas snake_case — ver /Hygge/_SISTEMA/convenciones.md). Cada space del ERP tiene su carpeta espejo REAL:
- /Hygge/01_HQ → space "hq"
- /Hygge/04_FINANZAS → space "finanzas"
- /Hygge/05_LEGAL → space "legal"
- /Hygge/06_COMERCIAL → space "comercial"
- /Hygge/07_MARKETING → space "marketing"
- /Hygge/08_GROWTH → space "growth"
- /Hygge/03_BAM → space "bam"
- /Hygge/02_PROYECTOS/DC01_del_castillo → space "dc01"
- /Hygge/02_PROYECTOS/PU01_paula_ugarriza → space "pu01" (= Legendre)
- /Hygge/02_PROYECTOS/TG01_de_la_torre → space "tg01"
- /Hygge/02_PROYECTOS/L36_larco_1036 → space "l36"
- /Hygge/09_ALICE/_cerebro → tu propio cerebro espejado (knowledge, skills, memoria por persona)
Cuando alguien sube un archivo a Dropbox, aparece automáticamente en la tab "Archivos" del space correspondiente en ALICE.
Si te piden buscar un archivo de un proyecto, buscá en su carpeta Dropbox con la herramienta de búsqueda.

## Spaces del ERP
hq · dc01 · pu01 · tg01 · l36 · bam · finanzas · legal · comercial · marketing · growth

## IDs del equipo
sb (Sebastián) · vd (Vanessa) · jt (Jose) · jm (Joel) · aa (Ariel) · ac (Andrea) · jmg (Galup)

## Coordinación de reuniones (proactiva)
- Antes de agendar una reunión que involucre a OTRA persona, chequeá su disponibilidad con check_availability.
- Si el horario pedido está ocupado: avisá ("X está ocupado a esa hora"), sugerí 1-2 alternativas libres concretas, y aclarás que confirmás el horario con esa persona antes de fijarlo.
- Los emails del equipo salen de sus perfiles. Gmail y detalle de calendario: cada uno solo ve LO SUYO — de otros solo libre/ocupado.

## Reglas inamovibles
- SIEMPRE respondé en español
- Reuniones: pedí propósito si no está claro, armá un brief con contexto
- Gmail: solo creás borradores, nunca enviás sin confirmación
- La fecha y hora actuales de Lima llegan al final del contexto — usalas como "ahora"`;
}

// ── Agentic loop ──────────────────────────────────────────────────────────────

// Herramientas para colaboradores (no-CEO): todo lo que los ayude a producir.
// Gmail-send, recursos y knowledge-write quedan exclusivos del sub-CEO.
const COLLAB_TOOLS = new Set([
  "create_task", "update_task", "get_tasks",
  "calendar_list", "calendar_create", "check_availability",
  "gmail_search", "gmail_draft",
  "dropbox_search", "dropbox_read", "dropbox_upload",
  "web_search", "zoom_list_recordings",
  "search_knowledge", "use_skill",
]);

// ── Rol ADMIN (Vanessa) ── entre CEO y colaborador ──────────────────────────────
// Facultades extra sobre un colaborador, pero lo SENSIBLE (enviar emails, mover
// archivos ajenos) pasa por la aprobación del CEO antes de ejecutarse.
const ADMIN_IDS = new Set(["vd"]);
const isAdmin = (uid) => ADMIN_IDS.has(uid);
const ADMIN_TOOLS = new Set([...COLLAB_TOOLS, "gmail_send", "dropbox_move"]);
// Acciones de un admin que NO se ejecutan solas: requieren OK del CEO.
const SENSITIVE_ADMIN = new Set(["gmail_send", "dropbox_move"]);

function userIdToPhone(uid) {
  const v = process.env[`PHONE_${uid}`];
  return v ? v.trim() : null;
}

// Cola de aprobaciones pendientes { id, byUser, byName, tool, input, resumen, ts }.
// Persistida en app_settings para sobrevivir redeploys.
let pendingApprovals = [];
function loadApprovals() {
  try { pendingApprovals = JSON.parse(query("SELECT value FROM app_settings WHERE key='pending_approvals'").rows[0]?.value || "[]"); }
  catch { pendingApprovals = []; }
}
function saveApprovals() {
  try {
    query(`INSERT INTO app_settings (key, value, updated_at) VALUES ('pending_approvals', ?, datetime('now'))
           ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')`, [JSON.stringify(pendingApprovals)]);
  } catch (e) { console.error("saveApprovals:", e.message); }
}
function resumenAccion(tool, input) {
  if (tool === "gmail_send") return `enviar un email a ${input.to || "?"} · asunto: "${(input.subject || "").slice(0, 60)}"`;
  if (tool === "dropbox_move") return `mover en Dropbox: ${input.from_path || "?"} → ${input.to_path || "?"}`;
  return `${tool} ${JSON.stringify(input).slice(0, 80)}`;
}
// Un admin dispara una acción sensible → no se ejecuta; se encola y se avisa al CEO.
async function encolarAprobacion(byUser, byName, tool, input) {
  const id = Math.random().toString(36).slice(2, 7);
  const resumen = resumenAccion(tool, input);
  pendingApprovals.push({ id, byUser, byName, tool, input, resumen, ts: Date.now() });
  saveApprovals();
  const ceoPhone = userIdToPhone(CEO_ID);
  if (ceoPhone) {
    const { sendWA } = await import("./wa.js");
    sendWA(ceoPhone, `🔐 *${byName}* quiere ${resumen}.\nRespondé *aprobar ${id}* o *rechazar ${id}*.`).catch(() => {});
  }
  return `Esta acción es sensible y necesita el OK de Sebastián. Ya se la pasé (código ${id}); le aviso a ${byName} en cuanto la apruebe o rechace. No la ejecutes vos.`;
}
// El CEO responde "aprobar <id>" / "rechazar <id>" → ejecuta o descarta y avisa al admin.
async function resolverAprobacion(text) {
  const m = text.trim().match(/^(aprobar|aprob[aá]|rechazar|rechaz[aá]|denegar)\s+([a-z0-9]{3,6})\b/i);
  if (!m) return null;
  const decision = /^(aprob)/i.test(m[1]) ? "ok" : "no";
  const id = m[2].toLowerCase();
  const idx = pendingApprovals.findIndex(a => a.id === id);
  if (idx === -1) return `No encontré una aprobación con código ${id} (quizás ya se resolvió).`;
  const a = pendingApprovals[idx];
  pendingApprovals.splice(idx, 1); saveApprovals();
  const adminPhone = userIdToPhone(a.byUser);
  const { sendWA } = await import("./wa.js");
  if (decision === "no") {
    if (adminPhone) sendWA(adminPhone, `Sebastián rechazó tu pedido de ${a.resumen}. Si lo necesitás, hablalo con él.`).catch(() => {});
    return `Rechazado. Le avisé a ${a.byName}.`;
  }
  let outcome;
  try { const r = await executeTool(a.tool, a.input, a.byUser); outcome = `✅ ${a.resumen} — hecho.`; console.log(`✔ aprobación ${id} ejecutada:`, r?.slice?.(0, 80)); }
  catch (e) { outcome = `⚠️ Aprobado, pero falló al ejecutar: ${e.message}`; }
  if (adminPhone) sendWA(adminPhone, `Sebastián aprobó: ${a.resumen}. ${outcome.startsWith("✅") ? "Ya está hecho." : outcome}`).catch(() => {});
  return `${outcome} (pedido de ${a.byName})`;
}

// Warm-up de contexto: Alicia entra "briefeada". Junta agenda + tareas UNA vez (cache 5 min
// por usuario) y conversa fluido desde eso, sin loop de herramientas por mensaje para lo común.
const _ctxCache = new Map();
async function buildLiveContext(userId) {
  const c = _ctxCache.get(userId);
  if (c && Date.now() - c.t < 5 * 60 * 1000) return c.text;
  let text = "";
  try {
    // Timeout duro: el warm-up debe ser "unos segundos", no colgarse si el ERP/calendar tardan
    const withTimeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);
    const [cal, tasks] = await Promise.all([
      withTimeout(executeTool("calendar_list", { days_ahead: 2 }, userId).catch(() => null), 6000),
      withTimeout(executeTool("get_tasks", {}, userId).catch(() => null), 6000),
    ]);
    const parts = [];
    if (cal && !/no conectado|No hay eventos/i.test(cal)) parts.push(`## Agenda (próximos 2 días)\n${cal.slice(0, 1500)}`);
    if (tasks && !/No hay tareas/i.test(tasks)) parts.push(`## Tareas abiertas\n${tasks.slice(0, 1500)}`);
    if (parts.length) text = `# CONTEXTO ACTUAL (ya cargado — respondé desde acá directo; NO vuelvas a consultar agenda/tareas con herramientas salvo que necesites algo puntual que no esté acá):\n\n${parts.join("\n\n")}`;
  } catch { /* si falla, seguimos sin contexto precargado */ }
  _ctxCache.set(userId, { t: Date.now(), text });
  return text;
}

async function processAliciaMessage(userId, userText, channel = "app", opts = {}) {
  const [profile, allProfiles, history, memories, knowledge] = await Promise.all([
    getProfile(userId),
    getAllProfiles(),
    getRecentMessages(userId, 60),
    getRelevantMemories(userId, 12),
    getRelevantKnowledge(8),
  ]);

  const isCEO = userId === CEO_ID;
  const admin = isAdmin(userId);

  // El CEO resuelve aprobaciones pendientes con "aprobar <id>" / "rechazar <id>"
  // — atajo antes del loop de IA, sin gastar un turno de modelo.
  if (isCEO && pendingApprovals.length) {
    const res = await resolverAprobacion(userText);
    if (res) { await saveMessage(userId, "user", userText, channel); await saveMessage(userId, "assistant", res, channel); return { text: res, toolResults: [] }; }
  }

  // Por defecto TODOS van con Sonnet (rápido, estable, barato). "Maximum effort" 🦸
  // (a lo Deadpool) activa Fable 5 SOLO para ese turno de Sebastián. Fable razona
  // internamente consumiendo del mismo max_tokens — con presupuesto chico el
  // razonamiento se lo come entero y la respuesta llega vacía, de ahí los 16000.
  const maximumEffort = isCEO && /(maximum|m[aá]ximo)\s+effort|m[aá]ximo\s+esfuerzo/i.test(userText);
  const model = maximumEffort ? "claude-fable-5" : "claude-sonnet-4-6";
  const maxTokens = maximumEffort ? 16000 : (isCEO || admin ? 3000 : 1200);
  if (maximumEffort) console.log(`🦸 [${userId}] MAXIMUM EFFORT — turno con Fable 5`);
  const tools = isCEO ? ALICIA_TOOLS
    : admin ? ALICIA_TOOLS.filter(t => ADMIN_TOOLS.has(t.name))
    : ALICIA_TOOLS.filter(t => COLLAB_TOOLS.has(t.name));

  const systemPrompt = buildSystemPrompt(profile, allProfiles, memories, knowledge, channel, userId);
  // Prompt caching: el system prompt y las tools son idénticos en cada iteración del loop
  // y entre mensajes → cachearlos hace las iteraciones 2+ mucho más rápidas y baratas.
  const systemBlocks = [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }];
  // Contexto vivo precargado (fresco, después del bloque cacheado) — Alicia ya sabe agenda/tareas
  const liveContext = await buildLiveContext(userId);
  // Fecha+hora SIEMPRE acá (no en el bloque cacheado: la hora rompería el cache cada minuto,
  // y sin timeZone el server UTC hacía que Alicia viviera en el día siguiente desde las 7pm).
  const nowLima = new Date().toLocaleString("es-PE", { timeZone: "America/Lima", weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
  systemBlocks.push({ type: "text", text: `Ahora en Lima: ${nowLima}.${liveContext ? `\n\n${liveContext}` : ""}` });
  const cachedTools = tools.length
    ? [...tools.slice(0, -1), { ...tools[tools.length - 1], cache_control: { type: "ephemeral" } }]
    : tools;
  const toolResults = [];
  let finalText = "";
  // Cache breakpoint al final del historial: el prefijo (system+tools+historial)
  // se re-usa entre turnos → el grueso del input no se re-procesa en cada mensaje.
  let loopMessages = [
    ...history.map((m, i) => i === history.length - 1
      ? { role: m.role, content: [{ type: "text", text: String(m.content || " "), cache_control: { type: "ephemeral" } }] }
      : { role: m.role, content: m.content }),
    // Los ojos del cuerpo: si vino una foto, va como bloque de imagen junto al texto.
    // La imagen NO se guarda en el historial (saveMessage guarda solo texto) — se ve
    // en el momento y se olvida, que es como funciona mirar algo.
    { role: "user", content: opts.image
      ? [
          { type: "image", source: { type: "base64", media_type: opts.image.mediaType, data: opts.image.data } },
          { type: "text", text: userText },
        ]
      : userText },
  ];

  let iterations = 0;
  const MAX_ITERATIONS = 8;

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    let resp;
    try {
      resp = await anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        // Profundidad de razonamiento: "medium" para chat normal (latencia de chat);
        // en maximum effort sube a "high" (el tope "max" puede pensar minutos y
        // el panel corta a los 60s).
        output_config: { effort: maximumEffort ? "high" : "medium" },
        system: systemBlocks,
        tools: cachedTools,
        tool_choice: { type: "auto" },
        messages: loopMessages,
      });
    } catch (e) {
      // Si Fable no está disponible para esta cuenta, caemos a Sonnet sin romper el chat
      if (maximumEffort && /model|not_found/i.test(e.message)) {
        console.warn("Fable no disponible, fallback a Sonnet:", e.message.slice(0, 80));
        resp = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: maxTokens,
          output_config: { effort: maximumEffort ? "high" : "medium" },
          system: systemBlocks,
          tools: cachedTools,
          tool_choice: { type: "auto" },
          messages: loopMessages,
        });
      } else throw e;
    }

    // Los clasificadores de seguridad de Fable pueden rechazar un pedido:
    // llega HTTP 200 con stop_reason "refusal" y contenido vacío/parcial.
    if (resp.stop_reason === "refusal") {
      finalText = "Prefiero no ayudarte con eso 🙈 ¿Seguimos con otra cosa?";
      break;
    }

    const textBlock = resp.content.find(b => b.type === "text");
    if (textBlock) {
      let raw = textBlock.text;
      // Si Claude devuelve JSON (por historial contaminado), extraemos solo el mensaje
      try {
        const cleaned = raw.trim().replace(/```json?\n?/g, "").replace(/```/g, "").trim();
        if (cleaned.startsWith("{")) {
          const parsed = JSON.parse(cleaned);
          if (parsed.message) raw = parsed.message;
        }
      } catch {}
      finalText = raw;
    }

    const toolUseBlocks = resp.content.filter(b => b.type === "tool_use");
    if (!toolUseBlocks.length || resp.stop_reason === "end_turn") break;

    // Primera vez que va a usar herramientas → avisar "dame un segundo" (para no dejar esperando)
    if (iterations === 1 && opts.onThinking) { try { opts.onThinking(); } catch {} }

    const toolResultContents = [];
    for (const block of toolUseBlocks) {
      let result;
      try {
        if (admin && SENSITIVE_ADMIN.has(block.name)) {
          // acción sensible de un admin → no se ejecuta; se manda a aprobación del CEO
          result = await encolarAprobacion(userId, profile?.name?.split(" ")[0] || userId, block.name, block.input);
          console.log(`🔐 [${userId}] ${block.name} → aprobación CEO`);
        } else {
          result = await executeTool(block.name, block.input, userId);
          console.log(`🔧 [${userId}] ${block.name}:`, JSON.stringify(block.input).slice(0, 100));
        }
        toolResults.push({ tool: block.name, input: block.input, result });
      } catch (e) {
        result = `Error al ejecutar ${block.name}: ${e.message}`;
        console.error(`Tool ${block.name} error:`, e.message);
      }
      toolResultContents.push({ type: "tool_result", tool_use_id: block.id, content: result });
    }

    loopMessages = [
      ...loopMessages,
      { role: "assistant", content: resp.content },
      { role: "user", content: toolResultContents },
    ];
  }

  // Guardar conversación
  await saveMessage(userId, "user", userText, channel);
  if (!finalText.trim()) {
    // El modelo cerró el turno sin texto (pasa con mensajes muy cortos o ambiguos).
    // NO se guarda el turno vacío — un assistant en blanco contamina el historial
    // y hace que los turnos siguientes también salgan vacíos.
    console.warn(`⚠️ [${userId}] respuesta vacía del modelo (${iterations} iter, ${toolResults.length} tools)`);
    return { text: "Me quedé en blanco con ese mensaje 😅 ¿Me lo repetís con un poco más de contexto?", actions: toolResults };
  }
  const msgId = await saveMessage(userId, "assistant", finalText, channel, toolResults);

  // Extraer memorias + actualizar persona en background
  extractAndSaveMemories(userId, userText, finalText, msgId).catch(() => {});
  maybeRefreshPersona(userId);

  return { text: finalText, actions: toolResults };
}

// ── WhatsApp webhook ──────────────────────────────────────────────────────────

app.get("/webhook", (req, res) => {
  const { "hub.mode": mode, "hub.verify_token": token, "hub.challenge": challenge } = req.query;
  if (mode === "subscribe" && token === process.env.WA_VERIFY_TOKEN) {
    console.log("✅ WhatsApp webhook verificado");
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);
  try {
    const message = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message || !["text", "audio", "document", "image"].includes(message.type)) return;
    const fromPhone = message.from;
    const allowed = (process.env.ALLOWED_USER_PHONES || "").split(",").map(p => p.trim().replace(/\D/g, ""));
    if (!allowed.includes(fromPhone.replace(/\D/g, ""))) return;
    const userId = phoneToUserId(fromPhone);
    if (!userId) return;

    // Audio entrante → descargar de Graph API y transcribir (paridad con el path de Twilio)
    let userText, inputWasAudio = false;
    if (message.type === "audio") {
      console.log(`🎤 WA Cloud audio [${userId}]`);
      const { buffer, mediaType } = await downloadWACloudMedia(message.audio.id);
      userText = await transcribeBuffer(buffer, mediaType) || "[audio no entendido]";
      inputWasAudio = true;
      console.log(`📝 Transcripción: ${userText}`);
    } else if (message.type === "document" || message.type === "image") {
      // Documento/imagen → al buzón; Alicia lo sube a Dropbox con dropbox_upload
      const media = message.document || message.image;
      const { buffer, mediaType } = await downloadWACloudMedia(media.id);
      const { setLastFile, extForMime } = await import("./inbox-files.js");
      const filename = media.filename || `whatsapp-${Date.now()}.${extForMime(mediaType)}`;
      setLastFile(userId, { buffer, mediaType, filename });
      const caption = media.caption || message.caption || "";
      userText = `[Adjunté un archivo: ${filename} · ${mediaType} · ${Math.round(buffer.length / 1024)} KB]${caption ? ` ${caption}` : " ¿Qué hacés con esto?"}`;
      console.log(`📎 WA Cloud archivo [${userId}]: ${filename} (${Math.round(buffer.length / 1024)} KB)`);
    } else {
      userText = message.text.body;
    }

    console.log(`📱 [${userId}] ${userText}`);
    const { sendWA } = await import("./wa.js");
    const { text: reply } = await processAliciaMessage(userId, userText, "whatsapp", {
      onThinking: () => sendWA(fromPhone, pickAck()).catch(() => {}),
    });

    // Nota de voz de vuelta si la entrada fue audio (mismo criterio que Twilio).
    // OJO: Cloud API no acepta WAV (Groq TTS solo emite wav) — si Meta lo rechaza,
    // cae a texto. Conversión a ogg/opus pendiente para paridad total.
    if (inputWasAudio) {
      try {
        const audioBuf = await generateSpeech(reply);
        const id = Math.random().toString(36).slice(2);
        ttsCache.set(id, audioBuf);
        setTimeout(() => ttsCache.delete(id), 5 * 60 * 1000);
        const audioUrl = `${process.env.BASE_URL || "https://aliceai.bam.pe"}/tts/${id}.wav`;
        const r = await fetch(`https://graph.facebook.com/v19.0/${process.env.WA_PHONE_NUMBER_ID}/messages`, {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({ messaging_product: "whatsapp", to: fromPhone, type: "audio", audio: { link: audioUrl } }),
        });
        if (r.ok) return;
        console.error("WA Cloud nota de voz rechazada, respondiendo texto:", (await r.text()).slice(0, 200));
      } catch (ttsErr) {
        console.error("TTS falló, respondiendo texto:", ttsErr.message);
      }
    }

    await sendWA(fromPhone, reply);
  } catch (e) {
    console.error("Webhook error:", e.message);
  }
});

// Descarga media de WA Cloud API: media_id → URL firmada → buffer
async function downloadWACloudMedia(mediaId) {
  const auth = { Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}` };
  const metaRes = await fetch(`https://graph.facebook.com/v19.0/${mediaId}`, { headers: auth });
  if (!metaRes.ok) throw new Error(`WA media meta failed: ${metaRes.status}`);
  const meta = await metaRes.json();
  const fileRes = await fetch(meta.url, { headers: auth });
  if (!fileRes.ok) throw new Error(`WA media download failed: ${fileRes.status}`);
  return { buffer: Buffer.from(await fileRes.arrayBuffer()), mediaType: meta.mime_type || "audio/ogg" };
}

// ── WhatsApp Web (el teléfono propio de Alicia, siempre conectado) ────────────
// Mismo pipeline que los webhooks: allowlist → transcribir audio / archivo al
// buzón → processAliciaMessage → respuesta por el mismo canal.

async function handleWAWebIncoming({ phone, text, media }) {
  const allowed = (process.env.ALLOWED_USER_PHONES || "").split(",").map(p => p.trim().replace(/\D/g, "")).filter(Boolean);
  if (!allowed.includes(phone.replace(/\D/g, ""))) { console.log(`🚫 WA de ${phone} no autorizado`); return; }
  const userId = phoneToUserId(phone);
  if (!userId) return;

  let userText = text, inputWasAudio = false;
  if (media?.kind === "audio") {
    console.log(`🎤 WA Web audio [${userId}]`);
    userText = await transcribeBuffer(media.buffer, media.mediaType) || "[audio no entendido]";
    inputWasAudio = true;
    console.log(`📝 Transcripción: ${userText}`);
  } else if (media?.kind === "file") {
    const { setLastFile, extForMime } = await import("./inbox-files.js");
    const filename = media.filename || `whatsapp-${Date.now()}.${extForMime(media.mediaType)}`;
    setLastFile(userId, { buffer: media.buffer, mediaType: media.mediaType, filename });
    userText = `[Adjunté un archivo: ${filename} · ${media.mediaType} · ${Math.round(media.buffer.length / 1024)} KB]${text ? ` ${text}` : " ¿Qué hacés con esto?"}`;
    console.log(`📎 WA Web archivo [${userId}]: ${filename} (${Math.round(media.buffer.length / 1024)} KB)`);
  }
  if (!userText) return;

  console.log(`📱 WA Web [${userId}] ${userText}`);
  const { sendWAWebText, sendWAWebAudio } = await import("./waweb.js");
  const { text: reply } = await processAliciaMessage(userId, userText, "whatsapp", {
    onThinking: () => sendWAWebText(phone, pickAck()).catch(() => {}),
  });

  // Nota de voz de vuelta si la entrada fue audio (paridad con Cloud/Twilio).
  // El TTS emite wav — va como audio normal, no como nota de voz (eso pide ogg/opus).
  if (inputWasAudio) {
    try {
      const audioBuf = await generateSpeech(reply);
      await sendWAWebAudio(phone, audioBuf, "audio/wav");
      return;
    } catch (ttsErr) { console.error("WA Web TTS falló, respondiendo texto:", ttsErr.message); }
  }
  await sendWAWebText(phone, reply);
}

app.get("/api/waweb/status", async (_, res) => {
  try {
    const { getWAWebStatus } = await import("./waweb.js");
    res.json(getWAWebStatus());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/waweb/restart", async (_, res) => {
  try {
    const { restartWAWeb } = await import("./waweb.js");
    await restartWAWeb();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/waweb/logout", async (_, res) => {
  try {
    const { logoutWAWeb } = await import("./waweb.js");
    await logoutWAWeb();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Twilio webhook ────────────────────────────────────────────────────────────

// Acks naturales cuando Alicia sale a buscar/hacer algo (no dejar al usuario esperando)
const ALICIA_ACKS = ["Dale, dejame revisar 👀", "Ya, un toque que reviso y te digo.", "Ahí lo miro, un segundo.", "Dame un segundo que junto la info.", "Ok, reviso y te confirmo enseguida."];
const pickAck = () => ALICIA_ACKS[Math.floor(Math.random() * ALICIA_ACKS.length)];

app.post("/webhook/twilio", async (req, res) => {
  const from = req.body.From || "";
  const body = (req.body.Body || "").trim();
  const numMedia = parseInt(req.body.NumMedia || "0");
  const mediaUrl = req.body.MediaUrl0 || "";
  const mediaType = req.body.MediaContentType0 || "";
  const phone = from.replace("whatsapp:", "");
  // Responder al webhook YA — Twilio corta a los ~15s. La respuesta real va async por REST.
  res.set("Content-Type", "text/xml").send("<Response/>");

  (async () => {
    const { sendWA, sendWAMedia } = await import("./wa.js");
    try {
      const userId = phoneToUserId(phone) || "sb";
      let userText = body, inputWasAudio = false;
      if (numMedia > 0 && mediaType.startsWith("audio/")) {
        userText = await transcribeAudio(mediaUrl, mediaType) || "[audio no entendido]";
        inputWasAudio = true;
      } else if (numMedia > 0 && mediaUrl) {
        // Documento/imagen → al buzón; Alicia lo sube a Dropbox con dropbox_upload
        const sid = process.env.TWILIO_ACCOUNT_SID, tok = process.env.TWILIO_AUTH_TOKEN;
        const fRes = await fetch(mediaUrl, { headers: { Authorization: "Basic " + Buffer.from(`${sid}:${tok}`).toString("base64") } });
        if (fRes.ok) {
          const buffer = Buffer.from(await fRes.arrayBuffer());
          const { setLastFile, extForMime } = await import("./inbox-files.js");
          const filename = `whatsapp-${Date.now()}.${extForMime(mediaType)}`;
          setLastFile(userId, { buffer, mediaType, filename });
          userText = `[Adjunté un archivo: ${filename} · ${mediaType} · ${Math.round(buffer.length / 1024)} KB]${body ? ` ${body}` : " ¿Qué hacés con esto?"}`;
          console.log(`📎 Twilio archivo [${userId}]: ${filename} (${Math.round(buffer.length / 1024)} KB)`);
        }
      }
      if (!userText) return;
      console.log(`📱 Twilio [${userId}] ${userText}`);

      const { text: reply } = await processAliciaMessage(userId, userText, "whatsapp", {
        onThinking: () => sendWA(phone, pickAck()).catch(() => {}),
      });

      if (inputWasAudio) {
        try {
          const audioBuf = await generateSpeech(reply);
          const id = Math.random().toString(36).slice(2);
          ttsCache.set(id, audioBuf);
          setTimeout(() => ttsCache.delete(id), 5 * 60 * 1000);
          await sendWAMedia(phone, `${process.env.BASE_URL || "https://aliceai.bam.pe"}/tts/${id}.wav`);
          return;
        } catch (ttsErr) { console.error("TTS async falló, respondiendo texto:", ttsErr.message); }
      }
      await sendWA(phone, reply);
    } catch (e) {
      console.error("Twilio async error:", e.message);
      sendWA(phone, "Tuve un problema, probá de nuevo.").catch(() => {});
    }
  })();
});

async function transcribeAudio(mediaUrl, mediaType) {
  // Twilio: descarga con basic auth, luego transcripción compartida
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const audioRes = await fetch(mediaUrl, {
    headers: { Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64") },
  });
  if (!audioRes.ok) throw new Error(`Audio download failed: ${audioRes.status}`);
  return transcribeBuffer(Buffer.from(await audioRes.arrayBuffer()), mediaType);
}

async function sttWith(provider, audioBuffer, mediaType) {
  // Whisper deduce el formato por la extensión del archivo, así que mentirle acá
  // rompe la transcripción. El browser manda webm/opus (Chrome) o mp4/aac (Safari),
  // ninguno de los dos es wav — sin este mapeo el cuerpo llega sordo desde el browser.
  const ext = /ogg|opus/.test(mediaType) ? "ogg"
    : /webm/.test(mediaType) ? "webm"
    : /mp4|m4a|aac/.test(mediaType) ? "mp4"
    : /mpeg|mp3/.test(mediaType) ? "mp3"
    : "wav";
  const cfg = provider === "openai"
    ? { url: "https://api.openai.com/v1/audio/transcriptions", key: process.env.OPENAI_API_KEY, model: "whisper-1" }
    : { url: "https://api.groq.com/openai/v1/audio/transcriptions", key: process.env.GROQ_API_KEY, model: "whisper-large-v3-turbo" };
  if (!cfg.key) return null;
  const formData = new FormData();
  formData.append("file", new Blob([audioBuffer], { type: mediaType }), `audio.${ext}`);
  formData.append("model", cfg.model);
  formData.append("language", "es");
  // temperature 0 = decodificación determinista: menos margen para que Whisper
  // "invente" frases fantasma cuando el audio es corto o con ruido de fondo.
  formData.append("temperature", "0");
  const r = await fetch(cfg.url, { method: "POST", headers: { Authorization: `Bearer ${cfg.key}` }, body: formData });
  if (!r.ok) throw new Error(`${provider} STT ${r.status}: ${(await r.text()).slice(0, 150)}`);
  return (await r.json()).text?.trim() || null;
}

// Whisper con fallback real: OpenAI primero, si falla cae a Groq (nunca queda sordo)
async function transcribeBuffer(audioBuffer, mediaType) {
  if (process.env.OPENAI_API_KEY) {
    try { return await sttWith("openai", audioBuffer, mediaType); }
    catch (e) { console.error("OpenAI STT falló, cae a Groq:", e.message); }
  }
  return sttWith("groq", audioBuffer, mediaType);
}

// ── TTS ───────────────────────────────────────────────────────────────────────
const ttsCache = new Map(); // id → Buffer, cleaned up after 5 min

const ALLOWED_VOICES = new Set([
  "autumn","diana","hannah",  // femeninas
  "austin","daniel","troy",   // masculinas
]);
// Voces nativas de OpenAI (tts-1) + mapeo de los nombres viejos de Groq (compat)
const OPENAI_VOICES = new Set(["alloy","echo","fable","onyx","nova","shimmer"]);
const OPENAI_VOICE_MAP = { diana:"nova", autumn:"shimmer", hannah:"alloy", austin:"onyx", daniel:"echo", troy:"fable" };
const toOpenAIVoice = (v) => OPENAI_VOICES.has(v) ? v : (OPENAI_VOICE_MAP[v] || "nova");

const trimSpeech = (text, cap) => {
  let limited = text.slice(0, cap);
  if (text.length > cap) { const d = limited.lastIndexOf(". "); if (d > 200) limited = limited.slice(0, d + 1); }
  return limited;
};

// ElevenLabs: la voz "buena" para el cuerpo. Vale la pena solo acá — en el panel
// no se nota y cuesta ~10x más por caracter que OpenAI. eleven_turbo_v2_5 es el
// modelo de baja latencia con español; los multilingües grandes suenan mejor pero
// agregan segundos, y en una conversación hablada la latencia se siente más que
// el timbre. Voz por defecto configurable: cada quien elige la de Alicia.
const ELEVEN_VOICE = process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL"; // "Sarah"
async function ttsEleven(text, voiceId, format = "mp3") {
  if (!process.env.ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY no configurado");
  const id = voiceId || ELEVEN_VOICE;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${id}`, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      text: trimSpeech(text, 3800),
      model_id: process.env.ELEVENLABS_MODEL || "eleven_turbo_v2_5",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs TTS ${res.status}: ${(await res.text()).slice(0, 150)}`);
  return Buffer.from(await res.arrayBuffer());
}

// Elige proveedor de voz y SIEMPRE cae al siguiente si falla: quedarse muda es
// peor que sonar distinto. Devuelve también quién habló, para poder comparar.
async function speak(text, { provider = "openai", voice } = {}) {
  const order = provider === "eleven" ? ["eleven", "openai"] : ["openai", "eleven"];
  let lastErr;
  for (const p of order) {
    try {
      if (p === "eleven" && !process.env.ELEVENLABS_API_KEY) continue;
      if (p === "openai" && !process.env.OPENAI_API_KEY) continue;
      const buf = p === "eleven" ? await ttsEleven(text, voice) : await ttsOpenAI(text, voice, "mp3");
      return { buf, provider: p };
    } catch (e) { lastErr = e; console.error(`TTS ${p} falló:`, e.message); }
  }
  throw lastErr || new Error("Ningún proveedor de TTS configurado");
}

async function ttsOpenAI(text, voice, format = "wav") {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "tts-1", input: trimSpeech(text, 3800), voice: toOpenAIVoice(voice), response_format: format }),
  });
  if (!res.ok) throw new Error(`OpenAI TTS ${res.status}: ${(await res.text()).slice(0, 150)}`);
  return Buffer.from(await res.arrayBuffer());
}

async function ttsGroq(text, voice) {
  const safeVoice = ALLOWED_VOICES.has(voice) ? voice : "diana";
  const res = await fetch("https://api.groq.com/openai/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "canopylabs/orpheus-v1-english", input: trimSpeech(text, 600), voice: safeVoice, response_format: "wav" }),
  });
  if (!res.ok) throw new Error(`Groq TTS ${res.status}: ${(await res.text()).slice(0, 150)}`);
  return Buffer.from(await res.arrayBuffer());
}

// Voz SOLO por OpenAI (tts-1, multilingüe). NO se cae a Groq: su modelo Orpheus es
// SOLO-INGLÉS y destroza el español de Alicia ("no se le entiende nada"). Una voz
// ininteligible es peor que ninguna: si OpenAI falla, el cliente usa su propia voz
// es-PE del navegador (español claro). ttsGroq queda en el código pero sin usarse.
async function generateSpeech(text, voice = "nova") {
  if (!process.env.OPENAI_API_KEY) throw new Error("OpenAI TTS no configurado (OPENAI_API_KEY)");
  return ttsOpenAI(text, voice);
}

app.post("/api/tts", async (req, res) => {
  const { text, voice } = req.body;
  if (!text) return res.status(400).json({ error: "No text" });
  try {
    // Panel del browser: mp3 (~10x más liviano que wav → llega mucho antes en 4G).
    // Twilio/WA siguen usando generateSpeech() wav vía ttsCache — no se tocan.
    if (process.env.OPENAI_API_KEY) {
      try {
        const buf = await ttsOpenAI(text, voice, "mp3");
        return res.set("Content-Type", "audio/mpeg").send(buf);
      } catch (e) { console.error("OpenAI TTS mp3 falló, reintenta wav:", e.message); }
    }
    const buf = await generateSpeech(text, voice);  // OpenAI wav; si falla, 500 → cliente usa voz es-PE del navegador
    res.set("Content-Type", "audio/wav").send(buf);
  } catch (e) {
    console.error("TTS error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// Serve cached TTS audio for Twilio (needs public URL)
app.get("/tts/:id.wav", (req, res) => {
  const buf = ttsCache.get(req.params.id);
  if (!buf) return res.status(404).send("Not found");
  res.set("Content-Type", "audio/wav").send(buf);
});

function escapeXml(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ── REST API ──────────────────────────────────────────────────────────────────

app.post("/api/chat", async (req, res) => {
  const { userId, message } = req.body;
  if (!userId || !message) return res.status(400).json({ error: "Falta userId o message" });
  try {
    const result = await processAliciaMessage(userId, message, "app");
    res.json(result);
  } catch (e) {
    console.error("Chat error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Cuerpo (el teléfono de Alicia) ────────────────────────────────────────────
// Un turno de voz completo en una sola llamada: audio → Whisper → loop de Alicia
// → TTS. El teléfono es cuerpo, no cerebro: capta y reproduce, no decide nada ni
// guarda estado — la memoria sigue viviendo acá, en alicia.db. Así el device es
// desechable y no hay dos Alicias con memoria divergente.
//
// Desde el emulador entrar SIEMPRE por http://127.0.0.1:3001 (adb reverse), no por
// 10.0.2.2: el panelGate con GATE_DEV_OPEN exige Host localhost/127.0.0.1, y por
// 10.0.2.2 el Host llega distinto y responde 401. El mismo 127.0.0.1 funciona tal
// cual sobre USB en un teléfono real.
const EMBODIED_USER = process.env.EMBODIED_USER_ID || CEO_ID;

app.post("/api/embodied",
  // express.json ya corrió arriba; este raw solo captura los bodies de audio.
  express.raw({ type: ["audio/*", "application/octet-stream"], limit: "25mb" }),
  async (req, res) => {
    const t0 = Date.now();
    const q = req.query;
    const userId = q.userId || EMBODIED_USER;
    const wantsVoice = q.speak !== "0";
    const wantsAudio = q.format === "audio";
    try {
      // Tres formas de entrar, todas opcionales y combinables:
      //   - body crudo audio/*                        (POST directo de un buffer)
      //   - JSON {audio, audioType}  → oído           (base64, lo que manda el browser)
      //   - JSON {image, imageType}  → vista          (base64 de un frame de cámara)
      //   - JSON {text}              → ni oído ni voz (probar el loop con curl)
      const j = (!Buffer.isBuffer(req.body) && req.body) || {};
      let transcript, tStt = 0;

      const audioIn = Buffer.isBuffer(req.body) && req.body.length
        ? { buf: req.body, type: req.get("content-type") || "audio/wav" }
        : j.audio ? { buf: Buffer.from(j.audio, "base64"), type: j.audioType || "audio/webm" } : null;

      if (audioIn) {
        const s0 = Date.now();
        transcript = await transcribeBuffer(audioIn.buf, audioIn.type);
        tStt = Date.now() - s0;
        if (!transcript) return res.status(422).json({ error: "no_transcript", detail: "Whisper no entendió el audio" });
        // Whisper alucina frases fijas cuando el audio es silencio/ruido (la wakeword
        // se re-disparó sola). Las filtramos para que Alicia NO responda a fantasmas.
        if (isWhisperHallucination(transcript)) {
          console.log(`🔇 [${userId}] alucinación ignorada: "${transcript.slice(0, 50)}"`);
          return res.json({ transcript, reply: "", ignored: true, timings: { stt: tStt, brain: 0, tts: 0, total: Date.now() - t0 } });
        }
      } else {
        transcript = String(j.text || "").trim();
      }

      // Los ojos. Sin nada dicho, mirar ya es la pregunta.
      const image = j.image
        ? { data: j.image, mediaType: j.imageType || "image/jpeg" }
        : null;
      if (!transcript && image) transcript = "¿Qué estás viendo?";
      if (!transcript) return res.status(400).json({ error: "sin_audio_ni_texto_ni_imagen" });

      // "Alicia, ¿qué ves?" — si pide ver y todavía no hay imagen, le avisamos al
      // cuerpo que capture un frame de la cámara y lo reenvíe. Así solo se abre la
      // cámara cuando de verdad se lo piden, no en cada comando.
      const VISION_RE = /\b(qu[eé]\s+ves|qu[eé]\s+est[aá]s\s+viendo|qu[eé]\s+ve[sz]|mir[aá]\b|qu[eé]\s+es\s+esto|descri[bv]|qu[eé]\s+hay\s+(aqu[ií]|ac[aá])|le[eé]\s+esto|qu[eé]\s+dice\s+(esto|ac[aá]|aqu[ií]))/i;
      if (!image && VISION_RE.test(transcript)) {
        const reply = "Déjame ver…";
        let audio = null, voiceProvider = null;
        if (speak && reply) {
          try { const s = await speak(reply, { provider: q.tts || process.env.TTS_PROVIDER || "openai", voice: q.voice }); audio = s.buf; voiceProvider = s.provider; }
          catch (_) {}
        }
        console.log(`👁️  [${userId}] pide ver: "${transcript.slice(0, 50)}" → needsVision`);
        return res.json({
          transcript, reply, needsVision: true,
          audio: audio ? audio.toString("base64") : null,
          mediaType: audio ? "audio/mpeg" : null,
          voice: voiceProvider,
          timings: { stt: tStt, brain: 0, tts: 0, total: Date.now() - t0 },
        });
      }

      const b0 = Date.now();
      const { text: reply } = await processAliciaMessage(userId, transcript, "embodied", { image });
      const tBrain = Date.now() - b0;

      // La voz es best-effort: si los dos proveedores fallan, el cuerpo igual recibe
      // el texto y lo habla con la voz es-PE del device. Quedarse muda es lo peor.
      let audio = null, voiceProvider = null, tTts = 0;
      if (wantsVoice && reply) {
        const v0 = Date.now();
        try {
          const spoken = await speak(reply, { provider: q.tts || process.env.TTS_PROVIDER || "openai", voice: q.voice });
          audio = spoken.buf; voiceProvider = spoken.provider;
        } catch (e) { console.error("Sin voz, el device habla con la suya:", e.message); }
        tTts = Date.now() - v0;
      }

      const timings = { stt: tStt, brain: tBrain, tts: tTts, total: Date.now() - t0 };
      console.log(`📱 [${userId}]${image ? " 👁" : ""} "${transcript.slice(0, 60)}" → ${timings.total}ms `
        + `(stt ${tStt} · brain ${tBrain} · tts ${tTts}${voiceProvider ? ` via ${voiceProvider}` : ""})`);

      // format=audio: bytes directos, para que el device solo reproduzca.
      // Los headers van en base64 porque el español acentuado rompe headers HTTP.
      if (wantsAudio && audio) {
        return res.set({
          "Content-Type": "audio/mpeg",
          "X-Transcript-B64": Buffer.from(transcript).toString("base64"),
          "X-Reply-B64": Buffer.from(reply).toString("base64"),
          "X-Voice": voiceProvider || "",
          "X-Timings": JSON.stringify(timings),
        }).send(audio);
      }
      res.json({
        transcript,
        reply,
        saw: !!image,
        audio: audio ? audio.toString("base64") : null,
        mediaType: audio ? "audio/mpeg" : null,
        voice: voiceProvider,
        timings,
      });
    } catch (e) {
      console.error("Embodied error:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

app.get("/api/profile/:userId", async (req, res) => {
  const profile = await getProfile(req.params.userId);
  if (!profile) return res.status(404).json({ error: "No encontrado" });
  res.json(profile);
});

app.get("/api/profiles", async (req, res) => res.json(await getAllProfiles()));

app.get("/api/history/:userId", async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json(await getRecentMessages(req.params.userId, limit));
});

app.get("/api/memories/:userId", async (req, res) => {
  const { rows } = query(
    `SELECT * FROM memories WHERE user_id = ? ORDER BY importance DESC, created_at DESC LIMIT 100`,
    [req.params.userId]
  );
  res.json(rows);
});

app.delete("/api/memories/:id", (req, res) => {
  query("DELETE FROM memories WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

app.get("/api/knowledge", async (req, res) => {
  const { rows } = query("SELECT * FROM knowledge ORDER BY updated_at DESC");
  res.json(rows);
});

app.post("/api/briefing", async (req, res) => {
  try {
    const { runDailyBriefing } = await import("./briefing.js");
    const text = await runDailyBriefing();
    res.json({ ok: true, briefing: text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Dropbox browse API (used by WikiHygge in ALICE frontend) ─────────────────

app.get("/api/dropbox/browse", async (req, res) => {
  try {
    const path = req.query.path || "";
    const { dropbox, dropboxAvailable } = await import("./integrations/dropbox.js");
    if (!dropboxAvailable()) return res.status(503).json({ error: "Dropbox no configurado" });
    const entries = await dropbox.listFolder(path);
    res.json({ path, entries });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/dropbox/search", async (req, res) => {
  try {
    const q = req.query.q || "";
    if (!q.trim()) return res.json({ results: [] });
    const { dropbox, dropboxAvailable } = await import("./integrations/dropbox.js");
    if (!dropboxAvailable()) return res.status(503).json({ error: "Dropbox no configurado" });
    const results = await dropbox.search({ query: q, maxResults: 20 });
    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/dropbox/download", async (req, res) => {
  try {
    const path = req.query.path || "";
    if (!path) return res.status(400).json({ error: "path requerido" });
    const { dropbox, dropboxAvailable } = await import("./integrations/dropbox.js");
    if (!dropboxAvailable()) return res.status(503).json({ error: "Dropbox no configurado" });
    const content = await dropbox.getFileContent(path);
    // Return as plain text so the frontend can parse CSV/TSV
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(content);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Fuente Flujo ERP · convención por proyecto: asegura la carpeta
// "{raízProyecto}/Fuente Flujo ERP" (la crea si no existe), busca el CSV/TSV más
// reciente y lo devuelve. Así Finanzas arma el link directo sin tipear rutas: la
// fuente es solo verla y aprobarla. Idempotente (si la carpeta ya existe, sigue).
app.post("/api/dropbox/flujo", async (req, res) => {
  try {
    const { projectRoot } = req.body || {};
    if (!projectRoot) return res.status(400).json({ error: "projectRoot requerido" });
    const { dropbox, dropboxAvailable } = await import("./integrations/dropbox.js");
    if (!dropboxAvailable()) return res.status(503).json({ error: "Dropbox no configurado" });
    const folder = `${String(projectRoot).replace(/\/+$/, "")}/Fuente Flujo ERP`;
    try { await dropbox.createFolder(folder); }
    catch (e) { if (!/conflict|already exists|409/i.test(e.message || "")) throw e; } // ya existía → ok
    let entries = [];
    try { entries = await dropbox.listFolder(folder); } catch { entries = []; }
    const csvs = entries
      .filter((e) => e.type === "file" && /\.(csv|tsv)$/i.test(e.name))
      .sort((a, b) => new Date(b.modified || 0) - new Date(a.modified || 0));
    if (!csvs.length) return res.json({ folder, file: null });
    const file = csvs[0];
    const content = await dropbox.getFileContent(file.path);
    res.json({ folder, file, content, otros: csvs.slice(1).map((f) => ({ name: f.name, path: f.path, modified: f.modified })) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/dropbox/create_folder", async (req, res) => {
  try {
    const { path } = req.body || {};
    if (!path) return res.status(400).json({ error: "path requerido" });
    const { dropbox, dropboxAvailable } = await import("./integrations/dropbox.js");
    if (!dropboxAvailable()) return res.status(503).json({ error: "Dropbox no configurado" });
    const result = await dropbox.createFolder(path);
    res.json({ ok: true, path: result?.metadata?.path_display || path });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/dropbox/delete_folder", async (req, res) => {
  try {
    const { path } = req.body || {};
    if (!path) return res.status(400).json({ error: "path requerido" });
    const { dropbox, dropboxAvailable } = await import("./integrations/dropbox.js");
    if (!dropboxAvailable()) return res.status(503).json({ error: "Dropbox no configurado" });
    await dropbox.deleteFolder(path);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Google OAuth · obtener refresh token ──────────────────────────────────────

const OAUTH_BASE = process.env.BASE_URL || "https://aliceai.bam.pe";
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/gmail.modify",
].join(" ");

app.get("/auth/google", (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) return res.status(500).send("GOOGLE_CLIENT_ID no configurado");
  const userId = (req.query.user || "sb").toLowerCase().replace(/[^a-z]/g, "").slice(0, 10) || "sb";
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${OAUTH_BASE}/auth/google/callback`,
    response_type: "code",
    access_type: "offline",
    prompt: "select_account consent",  // deja elegir la cuenta (personal vs corporativa)
    scope: GOOGLE_SCOPES,
    state: userId,
  });
  // ?hint=email → apunta el login a esa cuenta (evita que agarre la sesión activa equivocada)
  if (req.query.hint && /@/.test(req.query.hint)) params.set("login_hint", String(req.query.hint));
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

app.get("/auth/google/callback", async (req, res) => {
  try {
    const { code, error, state } = req.query;
    if (error) return res.status(400).send(`Google devolvió error: ${error}`);
    if (!code) return res.status(400).send("Falta el código de autorización");
    const tokenUser = (state || "sb").toLowerCase().replace(/[^a-z]/g, "").slice(0, 10) || "sb";
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${OAUTH_BASE}/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });
    const data = await tokenRes.json();
    if (!tokenRes.ok) return res.status(500).send(`Error intercambiando código: ${data.error_description || data.error}`);
    if (!data.refresh_token) return res.status(500).send("Google no devolvió refresh_token — revocá el acceso en myaccount.google.com/permissions y volvé a intentar");
    query(
      `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [`google_refresh_token_${tokenUser}`, data.refresh_token]
    );
    const { clearTokenCache } = await import("./integrations/google.js");
    clearTokenCache();
    console.log(`🔑 Google refresh token guardado para ${tokenUser}`);
    // Avisar al opener (onboarding del ERP) que la conexión fue real, y cerrar el popup
    res.send(`<html><body style="font-family:sans-serif;padding:40px;text-align:center;background:#EEEBE3;color:#0A0B0F">
      <h2>✅ Google conectado (${tokenUser})</h2>
      <p>Alicia ya puede usar tu Calendar y Gmail. Cerrando…</p>
      <script>
        try { if (window.opener) window.opener.postMessage({ type: "google-connected", user: "${tokenUser}" }, "*"); } catch (e) {}
        setTimeout(() => { try { window.close(); } catch (e) {} }, 1200);
      </script>
    </body></html>`);
  } catch (e) {
    console.error("OAuth callback error:", e.message);
    res.status(500).send(`Error: ${e.message}`);
  }
});

// ── Wonderland IT · agentes autónomos (ver docs/WONDERLAND_IT.md) ────────────

function requireAgentKey(req, res, next) {
  const key = req.headers["x-agent-key"] || "";
  if (!process.env.AGENTS_API_KEY || key !== process.env.AGENTS_API_KEY) {
    return res.status(401).json({ error: "x-agent-key inválida" });
  }
  next();
}

// Los agentes reportan una corrida completa (run + findings en una llamada)
app.post("/api/agents/report", requireAgentKey, async (req, res) => {
  try {
    const { agent, result = "ok", summary = "", actions_taken = [], findings = [] } = req.body || {};
    if (!agent) return res.status(400).json({ error: "agent requerido" });
    // Ciclo de vida: cada reporte es la verdad actual del agente → sus hallazgos abiertos
    // previos se cierran y se reinsertan solo los que siguen vigentes. Evita findings
    // fantasma (ej. el cert ya arreglado que Cheshire seguía reportando abierto).
    query(
      `UPDATE agent_findings SET status = 'auto-fixed', updated_at = datetime('now')
       WHERE agent = ? AND status IN ('open','escalated')`,
      [agent]
    );
    const { lastID: runId } = query(
      `INSERT INTO agent_runs (agent, finished_at, result, summary, actions_taken) VALUES (?, datetime('now'), ?, ?, ?)`,
      [agent, result, summary, JSON.stringify(actions_taken)]
    );
    for (const f of findings) {
      query(
        `INSERT INTO agent_findings (agent, run_id, severity, category, detail, status) VALUES (?,?,?,?,?,?)`,
        [agent, runId, f.severity || "minor", f.category || "general", f.detail || "", f.status || "open"]
      );
    }
    // Críticos → WhatsApp inmediato a Sebastián (vía Twilio)
    const criticals = findings.filter(f => f.severity === "critical");
    if (criticals.length > 0 && process.env.PHONE_sb) {
      const lines = criticals.map(f => `• [${f.category}] ${f.detail}`).join("\n");
      const { sendWA } = await import("./wa.js");
      sendWA(process.env.PHONE_sb,
        `🚨 *${agent}* encontró ${criticals.length} crítico(s):\n${lines}`
      ).catch(e => console.error("Alerta WA falló:", e.message));
    }
    console.log(`🧪 [${agent}] run #${runId} · ${result} · ${findings.length} findings`);
    res.json({ ok: true, runId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// El Lab del cockpit lee el estado real (público, solo lectura)
app.get("/api/agents/status", (req, res) => {
  try {
    const { rows: lastRuns } = query(`
      SELECT r.* FROM agent_runs r
      INNER JOIN (SELECT agent, MAX(id) AS max_id FROM agent_runs GROUP BY agent) m
        ON r.agent = m.agent AND r.id = m.max_id
    `);
    const { rows: openFindings } = query(
      `SELECT * FROM agent_findings WHERE status IN ('open','escalated') ORDER BY
        CASE severity WHEN 'critical' THEN 0 WHEN 'major' THEN 1 WHEN 'minor' THEN 2 ELSE 3 END,
        created_at DESC LIMIT 100`
    );
    const { rows: activity } = query(
      `SELECT agent, result, created_at FROM agent_runs WHERE created_at >= datetime('now','-14 days') ORDER BY created_at`
    );
    const { rows: resolvedRecent } = query(
      `SELECT * FROM agent_findings WHERE status IN ('auto-fixed','resolved') AND updated_at >= datetime('now','-7 days') ORDER BY updated_at DESC LIMIT 50`
    );
    res.json({
      agents: lastRuns.map(r => ({ ...r, actions_taken: parseArr(r.actions_taken), report: undefined })),
      findings: openFindings,
      resolved: resolvedRecent,
      activity,
      quarantine: process.env.QUARANTINE === "true",
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Tea Table: generar reporte on demand (desde el cockpit) o vía cron semanal
let teaTableRunning = false;
app.post("/api/agents/tea-table/run", async (req, res) => {
  if (teaTableRunning) return res.status(429).json({ error: "Tea Table ya está en sesión, esperá" });
  teaTableRunning = true;
  try {
    const { runTeaTableReport } = await import("./teatable.js");
    const result = await runTeaTableReport({ notify: false });
    res.json({ ok: true, runId: result.runId, report: result.report, summary: result.summary, result: result.result });
  } catch (e) {
    console.error("Tea Table error:", e.message);
    res.status(500).json({ error: e.message });
  } finally {
    teaTableRunning = false;
  }
});

app.get("/api/agents/tea-table/reports", (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const { rows } = query(
      `SELECT id, result, summary, report, created_at FROM agent_runs WHERE agent = 'tea-table' AND report IS NOT NULL ORDER BY id DESC LIMIT ?`,
      [limit]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Historial de corridas de un agente
app.get("/api/agents/:agent/runs", (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const { rows } = query(
      `SELECT * FROM agent_runs WHERE agent = ? ORDER BY id DESC LIMIT ?`,
      [req.params.agent, limit]
    );
    res.json(rows.map(r => ({ ...r, actions_taken: parseArr(r.actions_taken) })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Actualizar estado de un finding (auto-fixed, resolved, etc.)
app.patch("/api/agents/findings/:id", requireAgentKey, (req, res) => {
  try {
    const { status, resolved_by, resolution } = req.body || {};
    if (!status) return res.status(400).json({ error: "status requerido" });
    query(
      `UPDATE agent_findings SET status = ?, resolved_by = ?, resolution = ?, updated_at = datetime('now') WHERE id = ?`,
      [status, resolved_by || null, resolution || null, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Dropbox OAuth · obtener refresh token permanente ──────────────────────────

app.get("/auth/dropbox", (req, res) => {
  if (!process.env.DROPBOX_APP_KEY) return res.status(500).send("DROPBOX_APP_KEY no configurado en Railway");
  const params = new URLSearchParams({
    client_id: process.env.DROPBOX_APP_KEY,
    response_type: "code",
    token_access_type: "offline",
    redirect_uri: `${OAUTH_BASE}/auth/dropbox/callback`,
  });
  res.redirect(`https://www.dropbox.com/oauth2/authorize?${params}`);
});

app.get("/auth/dropbox/callback", async (req, res) => {
  try {
    const { code, error_description } = req.query;
    if (!code) return res.status(400).send(`Dropbox error: ${error_description || "sin código"}`);
    const tokenRes = await fetch("https://api.dropboxapi.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        client_id: process.env.DROPBOX_APP_KEY,
        client_secret: process.env.DROPBOX_APP_SECRET,
        redirect_uri: `${OAUTH_BASE}/auth/dropbox/callback`,
      }),
    });
    const data = await tokenRes.json();
    if (!tokenRes.ok) return res.status(500).send(`Error: ${data.error_description || data.error}`);
    if (!data.refresh_token) return res.status(500).send("Dropbox no devolvió refresh_token");
    query(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ('dropbox_refresh_token', ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [data.refresh_token]
    );
    const { clearDropboxTokenCache } = await import("./integrations/dropbox.js");
    clearDropboxTokenCache();
    console.log("🔑 Dropbox refresh token guardado — conexión permanente");
    res.send(`<html><body style="font-family:sans-serif;padding:40px;text-align:center">
      <h2>✅ Dropbox conectado (permanente)</h2>
      <p>El cerebro de Alicia ya puede sincronizarse. Podés cerrar esta pestaña.</p>
    </body></html>`);
  } catch (e) { res.status(500).send(`Error: ${e.message}`); }
});

// ── Cerebro → Dropbox · export on demand ──────────────────────────────────────

app.post("/api/brain/export", async (req, res) => {
  try {
    const { exportBrainToDropbox } = await import("./brainsync.js");
    const result = await exportBrainToDropbox();
    res.json({ ok: true, ...result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Calendario integral del equipo (para el ERP) ──────────────────────────────

app.get("/api/calendar/team", async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 7, 30);
    const { rows: profs } = query("SELECT user_id, name, email FROM profiles WHERE email IS NOT NULL AND email != ''");
    if (!profs.length) return res.json({ users: [], note: "Sin emails registrados en perfiles" });
    const { freeBusy } = await import("./integrations/google.js");
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + days * 86400000).toISOString();
    const cal = await freeBusy({ emails: profs.map(p => p.email), timeMin, timeMax }, "sb");
    res.json({
      timeMin, timeMax,
      users: profs.map(p => ({
        userId: p.user_id, name: p.name, email: p.email,
        busy: cal[p.email]?.busy || [],
        error: cal[p.email]?.errors?.[0]?.reason || null,
      })),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Eventos de Google Calendar de un usuario, para la vista Calendario del cockpit.
// ⚠️ Deuda (auditoría #9): público como /api/calendar/team porque el ERP no manda JWT aún.
app.get("/api/calendar/events", async (req, res) => {
  try {
    const user = (req.query.user || "sb").toLowerCase().replace(/[^a-z]/g, "") || "sb";
    const days = Math.min(parseInt(req.query.days) || 21, 60);
    const { googleCalendar, googleAvailable } = await import("./integrations/google.js");
    const calUser = googleAvailable(user) ? user : (googleAvailable("sb") ? "sb" : null);
    if (!calUser) return res.json({ events: [], note: "Google Calendar no conectado" });
    const timeMin = new Date(Date.now() - 1 * 86400000).toISOString();  // desde ayer
    const timeMax = new Date(Date.now() + days * 86400000).toISOString();
    const events = await googleCalendar.listEvents({ timeMin, timeMax, maxResults: 100 }, calUser);
    res.json({ events, source: calUser });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Pantalla de inicio del cuerpo ───────────────────────────────────────────
// Un solo agregado para el launcher de Alicia (assets/home): la agenda de hoy, las
// tareas y las stats en una llamada, para no hacer tres fetch con tres chequeos de
// auth. Todo best-effort: si una fuente falla, esa parte va vacía pero la pantalla
// no se cae.
// Frases que Whisper inventa con silencio/ruido (no las dijo nadie). Si el "comando"
// es solo una de estas o basura muy corta, se ignora y Alicia no responde.
const WHISPER_GHOSTS = [
  /subt[ií]tulos?\s+(realizados?|por)/i,
  /amara\.org/i,
  /gracias por ver/i,
  /subtitulado por/i,
  /www\.|http/i,
  /\b(subscribe|suscr[ií]ban)/i,
];
function isWhisperHallucination(text) {
  const t = (text || "").trim();
  if (t.length < 3) return true;
  if (WHISPER_GHOSTS.some((re) => re.test(t))) return true;
  // Solo signos/espacios, o una sola sílaba repetida ("ah ah ah")
  if (!/[a-záéíóúñ]{3,}/i.test(t)) return true;
  return false;
}

const SERVER_STARTED_AT = Date.now();
app.get("/api/home", async (req, res) => {
  const user = (req.query.user || CEO_ID).toLowerCase().replace(/[^a-z]/g, "") || CEO_ID;

  // Agenda de hoy (hora de Lima)
  const todayEvents = (async () => {
    try {
      const { googleCalendar, googleAvailable } = await import("./integrations/google.js");
      const calUser = googleAvailable(user) ? user : (googleAvailable("sb") ? "sb" : null);
      if (!calUser) return [];
      const now = new Date();
      const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59, 999);
      const events = await googleCalendar.listEvents(
        { timeMin: startOfDay.toISOString(), timeMax: endOfDay.toISOString(), maxResults: 20 }, calUser);
      return events.map(e => ({
        title: e.title,
        time: e.start && e.start.includes("T")
          ? new Date(e.start).toLocaleTimeString("es-PE", { timeZone: "America/Lima", hour: "2-digit", minute: "2-digit", hour12: false })
          : "todo el día",
        ts: e.start ? new Date(e.start).getTime() : 0,
      })).sort((a, b) => a.ts - b.ts);
    } catch { return []; }
  })();

  // Tareas del ERP
  const tasks = (async () => {
    try {
      const { erp } = await import("./erp-client.js");
      const r = await erp.getTasks({ limit: 6 });
      const list = Array.isArray(r) ? r : (r.tasks || r.data || []);
      return list.slice(0, 5).map(t => ({
        title: t.title || t.name || t.descripcion || "(tarea)",
        status: (t.status || t.estado || "").toString().toLowerCase(),
      }));
    } catch { return []; }
  })();

  // Stats de la DB local
  const stats = (async () => {
    try {
      const users = (await getAllProfiles()).length;
      const msgs = query("SELECT COUNT(*) AS c FROM messages")?.rows?.[0]?.c ?? 0;
      const mems = query("SELECT COUNT(*) AS c FROM memories")?.rows?.[0]?.c ?? 0;
      return { users, messages: Number(msgs), memories: Number(mems), uptimeSec: Math.floor((Date.now() - SERVER_STARTED_AT) / 1000) };
    } catch { return { users: 0, messages: 0, memories: 0, uptimeSec: Math.floor((Date.now() - SERVER_STARTED_AT) / 1000) }; }
  })();

  const [events, taskList, s] = await Promise.all([todayEvents, tasks, stats]);
  res.json({ events, tasks: taskList, stats: s });
});

// Crear/actualizar evento en Google Calendar — lo llama el ERP al crear o editar una tarea.
// Si viene taskId, usa un evento idempotente (mismo id ⇒ edita en vez de duplicar).
app.post("/api/calendar/event", async (req, res) => {
  try {
    const { user = "sb", taskId, title, date, time, endTime, description } = req.body || {};
    if (!title || !date) return res.status(400).json({ error: "title y date requeridos" });
    const u = String(user).toLowerCase().replace(/[^a-z]/g, "") || "sb";
    const { googleCalendar, googleAvailable } = await import("./integrations/google.js");
    const calUser = googleAvailable(u) ? u : (googleAvailable("sb") ? "sb" : null);
    if (!calUser) return res.json({ ok: false, note: "Google Calendar no conectado" });
    const ev = taskId != null
      ? await googleCalendar.upsertTaskEvent({ taskId, title, date, time, endTime, description }, calUser)
      : await googleCalendar.createEvent({ title, date, time, endTime, description }, calUser);
    res.json({ ok: true, eventId: ev.id, link: ev.htmlLink });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Borrar el evento de calendario asociado a una tarea (cuando se elimina la tarea o pierde su fecha).
app.delete("/api/calendar/event/:taskId", async (req, res) => {
  try {
    const u = String(req.query.user || "sb").toLowerCase().replace(/[^a-z]/g, "") || "sb";
    const { googleCalendar, googleAvailable } = await import("./integrations/google.js");
    const calUser = googleAvailable(u) ? u : (googleAvailable("sb") ? "sb" : null);
    if (!calUser) return res.json({ ok: false, note: "Google Calendar no conectado" });
    await googleCalendar.deleteTaskEvent(req.params.taskId, calUser);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Actualizar email de un perfil (para el mapeo de calendarios)
app.patch("/api/profile/:userId/email", (req, res) => {
  try {
    const { email } = req.body || {};
    query("UPDATE profiles SET email = ?, updated_at = datetime('now') WHERE user_id = ?", [email || null, req.params.userId]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Persona · fine-tune manual + lectura ──────────────────────────────────────

app.get("/api/persona/:userId", (req, res) => {
  res.json(getPersona(req.params.userId) || {});
});

app.put("/api/persona/:userId", (req, res) => {
  try {
    const b = req.body || {};
    const clamp = (v, def, max = 10) => Math.max(0, Math.min(max, parseInt(v ?? def)));
    query(
      `INSERT INTO user_personas (user_id, manual_instructions, sarcasm, humor, formality, proactivity, length, emojis, updated_at)
       VALUES (?,?,?,?,?,?,?,?,datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         manual_instructions=excluded.manual_instructions, sarcasm=excluded.sarcasm,
         humor=excluded.humor, formality=excluded.formality, proactivity=excluded.proactivity,
         length=excluded.length, emojis=excluded.emojis, updated_at=datetime('now')`,
      [req.params.userId, b.manual_instructions || null, clamp(b.sarcasm, 0, 100),
       clamp(b.humor, 5), clamp(b.formality, 5), clamp(b.proactivity, 7), clamp(b.length, 5), clamp(b.emojis, 3)]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Recursos · links, conectores, código, notas ───────────────────────────────

app.get("/api/resources", (req, res) => {
  const { rows } = query("SELECT * FROM resources ORDER BY type, name");
  res.json(rows);
});

app.post("/api/resources", (req, res) => {
  try {
    const { id, type, name, content, notes, created_by } = req.body || {};
    if (!name || !content) return res.status(400).json({ error: "name y content requeridos" });
    if (id) {
      query(`UPDATE resources SET type=?, name=?, content=?, notes=?, updated_at=datetime('now') WHERE id=?`,
        [type || "link", name, content, notes || null, id]);
    } else {
      query(`INSERT INTO resources (type, name, content, notes, created_by) VALUES (?,?,?,?,?)`,
        [type || "link", name, content, notes || null, created_by || "sb"]);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/resources/:id", (req, res) => {
  query("DELETE FROM resources WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

// ── Insights de colaboradores · coaching para el CEO ──────────────────────────

async function generateInsights(userId) {
  const [profile, history, memories, persona] = await Promise.all([
    getProfile(userId),
    getRecentMessages(userId, 80),
    getRelevantMemories(userId, 20),
    Promise.resolve(getPersona(userId)),
  ]);
  if (history.length < 6) return null; // sin data suficiente
  const convo = history.map(m => `${m.role === "user" ? profile?.name || userId : "Alicia"}: ${m.content.slice(0, 250)}`).join("\n");
  const resp = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1200,
    messages: [{
      role: "user",
      content: `Sos la analista de talento de Hygge Holding. Analizá a este colaborador según sus interacciones con Alicia (su asistente) y generá un reporte de coaching PARA EL CEO.

Perfil: ${JSON.stringify({ nombre: profile?.name, rol: profile?.role, proyectos: profile?.projects, fortalezas_declaradas: profile?.strengths })}
Memorias de Alicia sobre esta persona: ${memories.map(m => m.content).join(" · ").slice(0, 1500)}
Persona aprendida: ${persona ? `${persona.style} · ${persona.focus}` : "—"}

Conversaciones recientes:
${convo.slice(0, 8000)}

Respondé SOLO con JSON, sin markdown:
{"resumen":"lectura general en 2 oraciones","fortalezas":["max 4, concretas y con evidencia"],"fallas":["max 4, áreas de mejora concretas"],"green_flags":["max 3, señales positivas recientes"],"red_flags":["max 3, señales de alerta — si no hay, array vacío"],"recomendaciones":["max 3 acciones concretas que el CEO puede tomar para hacerlo crecer"]}`
    }],
  });
  const raw = resp.content[0].text.trim().replace(/```json?\n?/g, "").replace(/```/g, "").trim();
  const report = JSON.parse(raw);
  query(
    `INSERT INTO user_insights (user_id, report, updated_at) VALUES (?,?,datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET report=excluded.report, updated_at=datetime('now')`,
    [userId, JSON.stringify(report)]
  );
  return report;
}

app.get("/api/insights/:userId", (req, res) => {
  try {
    const { rows } = query("SELECT report, updated_at FROM user_insights WHERE user_id = ?", [req.params.userId]);
    if (!rows[0]) return res.json({ report: null });
    res.json({ report: JSON.parse(rows[0].report), updated_at: rows[0].updated_at });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/insights/:userId/refresh", async (req, res) => {
  try {
    const report = await generateInsights(req.params.userId);
    if (!report) return res.json({ report: null, reason: "Sin conversaciones suficientes todavía" });
    res.json({ report, updated_at: new Date().toISOString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Skills · playbooks enseñables ─────────────────────────────────────────────

app.get("/api/skills", (req, res) => {
  const { rows } = query("SELECT * FROM skills ORDER BY name");
  res.json(rows);
});

app.post("/api/skills", (req, res) => {
  try {
    const { name, description, content, created_by } = req.body || {};
    if (!name || !description || !content) return res.status(400).json({ error: "name, description y content son requeridos" });
    query(
      `INSERT INTO skills (name, description, content, created_by) VALUES (?,?,?,?)
       ON CONFLICT(name) DO UPDATE SET description=excluded.description, content=excluded.content, updated_at=datetime('now')`,
      [name.trim(), description.trim(), content, created_by || "sb"]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/skills/:id", (req, res) => {
  query("DELETE FROM skills WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

// ── Market Data (White Rabbit) ────────────────────────────────────────────────

app.get("/api/market-data", (req, res) => {
  try {
    const snap = getLatestSnapshot();
    const macro = getMacroData();
    const bank_rates = getBankRates();
    const rental_listings = getRentalListings();
    res.json({
      ok: true,
      projects: snap?.projects || [],
      total: snap?.total || 0,
      scraped_at: snap?.scraped_at || null,
      macro,             // { tasa_hip_pen, tasa_hip_usd, usd_pen } from BCRP
      bank_rates,        // per-bank hipotecario rates from Playwright scraper
      rental_listings,   // corta estadía Wynwood House (Lima), scraper propio cada 6h
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Receives data from the local Playwright scraper (runs on Mac, pushes here)
app.post("/api/market-import", (req, res) => {
  const auth = req.headers.authorization || "";
  const token = process.env.MARKET_REFRESH_TOKEN || "white-rabbit";
  if (auth !== `Bearer ${token}`) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const { type, projects, rates } = req.body;
    if (type === "projects" && Array.isArray(projects)) {
      const saved = importProjects(projects);
      return res.json({ ok: true, type, saved });
    }
    if (type === "bank_rates" && Array.isArray(rates)) {
      saveBankRates(rates);
      return res.json({ ok: true, type, saved: rates.length });
    }
    res.status(400).json({ ok: false, error: "unknown type" });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/api/market-refresh", async (req, res) => {
  // Simple bearer check so random internet can't spam refreshes
  const auth = req.headers.authorization || "";
  const token = process.env.MARKET_REFRESH_TOKEN || "white-rabbit";
  if (auth !== `Bearer ${token}`) return res.status(401).json({ ok: false, error: "unauthorized" });

  res.json({ ok: true, status: "refresh_started" });
  // Run async so response returns immediately
  refreshMarketData().catch(e => console.error("market refresh error:", e.message));
});

app.post("/api/rental-refresh", async (req, res) => {
  const auth = req.headers.authorization || "";
  const token = process.env.MARKET_REFRESH_TOKEN || "white-rabbit";
  if (auth !== `Bearer ${token}`) return res.status(401).json({ ok: false, error: "unauthorized" });
  const result = await refreshRentalListings();
  res.json(result);
});

// Sala de operaciones de Wonderland (pública, solo lectura del estado de agentes)
app.get("/wonderland", (_, res) => res.sendFile(join(__dirname, "../public/wonderland.html")));

// Análisis one-shot para el ERP (Velocity/Mercado, etc.): sin memoria, sin tools.
// Existe para que el frontend NUNCA necesite una key de Anthropic en el browser.
// One-shot o multi-turno corto. Lo usan las vistas AI del ERP (Velocity, resúmenes,
// Tea Table, Jabberwocky, Ask Alice) — el browser jamás toca Anthropic directo.
app.post("/api/analyze", async (req, res) => {
  try {
    const { prompt, system, messages, max_tokens, pdf_base64 } = req.body || {};
    let msgs = Array.isArray(messages) && messages.length
      ? messages.slice(-20).map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content ?? "").slice(0, 8000) })).filter(m => m.content)
      : (prompt && typeof prompt === "string" ? [{ role: "user", content: String(prompt).slice(0, 20000) }] : null);
    // PDF adjunto (reportes de obra): documento + prompt en un solo turno
    if (pdf_base64 && typeof pdf_base64 === "string") {
      msgs = [{ role: "user", content: [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf_base64 } },
        { type: "text", text: (typeof prompt === "string" && prompt) || "Procesá este documento." },
      ] }];
    }
    if (!msgs || !msgs.length) return res.status(400).json({ error: "prompt o messages requerido" });
    const resp = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: Math.min(parseInt(max_tokens) || 1200, 2500),
      system: (system || "Sos Alicia, asistente ejecutiva de Hygge Holding. Experta en mercado inmobiliario limeño.").slice(0, 6000),
      messages: msgs,
    });
    res.json({ text: resp.content.find(b => b.type === "text")?.text || "" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Feyd-Rautha 🗡️ · diseño de plantas residenciales (agente aparte de Alicia, ver src/arquitecto.js).
// Para que el ERP (EditorPlanos) pueda pedir un layout directo, sin pasar por el chat de Alicia.
app.post("/api/arquitecto/disenar", async (req, res) => {
  try {
    const { disenarPlano, arquitectoDisponible } = await import("./arquitecto.js");
    if (!arquitectoDisponible()) return res.status(503).json({ error: "skill arquitecto-residencial-lima no disponible en este deploy" });
    res.json({ layout: await disenarPlano(req.body || {}) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Feyd audita/corrige una planta existente del Editor de Planos (rooms → layout).
app.post("/api/arquitecto/corregir", async (req, res) => {
  try {
    const { corregirPlano, arquitectoDisponible } = await import("./arquitecto.js");
    if (!arquitectoDisponible()) return res.status(503).json({ error: "skill arquitecto-residencial-lima no disponible en este deploy" });
    const { layout, notas } = req.body || {};
    if (!layout?.ambientes?.length) return res.status(400).json({ error: "layout.ambientes requerido" });
    res.json(await corregirPlano(layout, notas));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Reboot manual desde el panel — Railway tiene restartPolicyType ON_FAILURE,
// así que un exit no-cero dispara el restart automático del proceso.
app.post("/api/system/reboot", (_, res) => {
  res.json({ ok: true, message: "Reiniciando…" });
  console.log("🔁 Reboot manual pedido desde el panel");
  setTimeout(() => process.exit(1), 400);
});

app.get("/health", async (_, res) => {
  let dropbox = false;
  try { ({ dropboxAvailable: dropbox } = await import("./integrations/dropbox.js")); dropbox = dropbox(); } catch { dropbox = false; }
  let waweb = { status: "off" };
  try { const { getWAWebStatus } = await import("./waweb.js"); waweb = getWAWebStatus(); } catch {}
  res.json({
    ok: true, service: "alicia-brain",
    erp: process.env.ERP_URL || "http://localhost:3002",
    integrations: {
      google:  !!(process.env.GOOGLE_CLIENT_ID),
      zoom:    !!(process.env.ZOOM_ACCOUNT_ID),
      dropbox,  // chequeo real: env legacy O (app key+secret + refresh token en DB)
      tavily:  !!(process.env.TAVILY_API_KEY),
      openai:  !!(process.env.OPENAI_API_KEY),  // voz TTS/Whisper primaria
      groq:    !!(process.env.GROQ_API_KEY),    // fallback de voz
      // chequeo real de socket, no presencia de env vars (lección Dropbox)
      whatsappWeb: waweb.status === "connected",
      whatsappWebStatus: waweb.status,
    }
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  console.log(`\n🧠 Alicia Brain · http://localhost:${PORT}`);
  console.log(`   ERP: ${process.env.ERP_URL || "http://localhost:3002"}`);
  console.log(`   Google:  ${process.env.GOOGLE_CLIENT_ID ? "✅" : "⏳ pendiente"}`);
  console.log(`   Zoom:    ${process.env.ZOOM_ACCOUNT_ID ? "✅" : "⏳ pendiente"}`);
  console.log(`   Dropbox: ${process.env.DROPBOX_ACCESS_TOKEN ? "✅" : "⏳ pendiente"}`);
  console.log(`   Tavily:  ${process.env.TAVILY_API_KEY ? "✅" : "⏳ pendiente"}\n`);

  // Ensure market tables exist, seed projects from static file if empty
  ensureMarketSchema();
  loadApprovals(); // aprobaciones pendientes de admins (sobreviven redeploys)
  try {
    const staticPath = join(__dirname, "../../files/alice/public/data/projects.json");
    const raw = await readFile(staticPath, "utf8");
    const parsed = JSON.parse(raw);
    await seedFromStaticIfEmpty(parsed.projects || []);
  } catch (e) {
    console.warn("Market seed: no se pudo leer el static file:", e.message);
  }

  // Fetch real macro data from BCRP on startup (non-blocking)
  refreshMarketData().catch(e => console.warn("Startup market refresh error:", e.message));

  // WhatsApp Web: el teléfono de Alicia, conectado 24/7 (QR en el panel si falta vincular)
  import("./waweb.js")
    .then(({ startWAWeb }) => startWAWeb(handleWAWebIncoming))
    .catch(e => console.warn("WA Web no disponible:", e.message));

  startCron();
});
