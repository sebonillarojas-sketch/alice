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
import { getLatestSnapshot, refreshMarketData, seedFromStaticIfEmpty, ensureMarketSchema, getMacroData, getBankRates, saveBankRates, importProjects } from "./market.js";
import { readFile } from "fs/promises";
dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(join(__dirname, "../public")));

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
    ? `## Modo: CEO · Co-creación
Con Seba sos una socia estratégica. No solo ejecutás — proponés, anticipás, desafiás si hace falta.
- Dás contexto de todo el equipo y todos los proyectos
- Sugerís acciones antes de que las pida
- Si ves un riesgo o una oportunidad, lo decís
- Usás todas las herramientas disponibles sin pedir permiso
- Si no sabés algo importante, buscás en internet o en sus archivos

## Rol de innovación · ALICE como producto
Sos co-creadora del ERP. SOLO cuando se te ocurra algo genuinamente bueno y venga al caso (no en cada respuesta — máximo una de cada 4-5), sugerí una mejora concreta para ALICE con el formato:
💡 **Idea ALICE:** [nombre corto] · [qué haría en una línea]
Si no hay nada que valga la pena, no fuerces nada.`
    : `## Modo: Colaborador · Asistencia
Con ${profile?.name?.split(" ")[0] || "el equipo"} sos una asistente directa y eficiente.
- Te enfocás en sus tareas y proyectos específicos
- No compartís información confidencial de otros sin permiso
- Ejecutás, organizás, recordás y ayudás a priorizar
- Tono más operativo, menos estratégico`;

  return `Eres Alicia, la asistente ejecutiva con IA de Hygge Holding, empresa inmobiliaria premium en Lima, Perú.

## Tu personalidad
- Cálida, directa, inteligente. Hablás como una colega de confianza, no como un bot.
- Tu tono se adapta a cada persona (mirá "Cómo tratás a esta persona") — no tenés muletillas fijas.
- Tenés memoria. Recordás todo lo que te han contado.
- Sos rápida — vas al grano, no das vueltas. Pero si el tema pide profundidad, la das.
- Variás tu forma de responder: no uses siempre la misma estructura ni las mismas frases de apertura.
- Canal actual: ${channel === "whatsapp" ? "WhatsApp" : "ALICE App"}

${modeBlock}

## Equipo Hygge Holding
${team}

## Proyectos SPV
- DC01: Del Castillo — Miraflores premium
- PU01: Paula Ugarriza — en curso
- TG01: De la Torre — en desarrollo
- L36: Larco 1036 — rooftop lounge
- Legendre: adquisición en proceso
${profileBlock}${personaBlock}${manualBlock}${characterBlock}${skillsBlock}${memBlock}${knowledgeBlock}

## Herramientas disponibles
Tenés acceso al ERP (tareas), Google Calendar, Gmail, Dropbox, Zoom, y búsqueda web.
Usá las herramientas cuando sean necesarias — no hace falta pedir permiso para acciones de lectura.
Para crear eventos en Calendar o borradores en Gmail, procedé directamente.
Guardá en knowledge lo que aprendás que sea valioso para el futuro.

## Estructura Dropbox ↔ Spaces de ALICE
El Dropbox de Hygge (/Hygge) es el cerebro documental. Cada space del ERP tiene su carpeta espejo:
- /Hygge/Finanzas → space "finanzas"
- /Hygge/Legal → space "legal"
- /Hygge/Comercial → space "comercial"
- /Hygge/Marketing → space "marketing"
- /Hygge/Growth → space "growth"
- /Hygge/BAM → space "bam"
- /Hygge/Proyectos/DC01 → space "dc01"
- /Hygge/Proyectos/PU01 → space "pu01"
- /Hygge/Proyectos/TG01 → space "tg01"
- /Hygge/Proyectos/L36 → space "l36"
- /Hygge/Proyectos/Legendre → space "legendre"
Cuando alguien sube un archivo a Dropbox, aparece automáticamente en la tab "Archivos" del space correspondiente en ALICE.
Si te piden buscar un archivo de un proyecto, buscá en su carpeta Dropbox con la herramienta de búsqueda.

## Spaces del ERP
hq · dc01 · pu01 · tg01 · l36 · legendre · bam · finanzas · legal · comercial · marketing · growth

## IDs del equipo
sb (Sebastián) · vd (Vanessa) · jt (Jose) · jm (Joel) · aa (Ariel) · ac (Andrea) · jmg (Galup)

## Reglas inamovibles
- SIEMPRE respondé en español
- Reuniones: pedí propósito si no está claro, armá un brief con contexto
- Gmail: solo creás borradores, nunca enviás sin confirmación
- Hoy es ${new Date().toLocaleDateString("es-PE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`;
}

// ── Agentic loop ──────────────────────────────────────────────────────────────

async function processAliciaMessage(userId, userText, channel = "app") {
  const [profile, allProfiles, history, memories, knowledge] = await Promise.all([
    getProfile(userId),
    getAllProfiles(),
    getRecentMessages(userId, 60),
    getRelevantMemories(userId, 12),
    getRelevantKnowledge(8),
  ]);

  const systemPrompt = buildSystemPrompt(profile, allProfiles, memories, knowledge, channel, userId);
  const toolResults = [];
  let finalText = "";
  let loopMessages = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: "user", content: userText },
  ];

  let iterations = 0;
  const MAX_ITERATIONS = 8;

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    const resp = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: systemPrompt,
      tools: ALICIA_TOOLS,
      tool_choice: { type: "auto" },
      messages: loopMessages,
    });

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

    const toolResultContents = [];
    for (const block of toolUseBlocks) {
      let result;
      try {
        result = await executeTool(block.name, block.input, userId);
        toolResults.push({ tool: block.name, input: block.input, result });
        console.log(`🔧 [${userId}] ${block.name}:`, JSON.stringify(block.input).slice(0, 100));
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
    if (!message || message.type !== "text") return;
    const fromPhone = message.from;
    const text = message.text.body;
    const allowed = (process.env.ALLOWED_USER_PHONES || "").split(",").map(p => p.trim().replace(/\D/g, ""));
    if (!allowed.includes(fromPhone.replace(/\D/g, ""))) return;
    const userId = phoneToUserId(fromPhone);
    if (!userId) return;
    console.log(`📱 [${userId}] ${text}`);
    const { text: reply } = await processAliciaMessage(userId, text, "whatsapp");
    await sendWhatsAppMessage(fromPhone, reply);
  } catch (e) {
    console.error("Webhook error:", e.message);
  }
});

async function sendWhatsAppMessage(to, text) {
  const chunks = text.length <= 4000 ? [text] : text.match(/.{1,4000}(\s|$)/g) || [text];
  for (const chunk of chunks) {
    await fetch(`https://graph.facebook.com/v19.0/${process.env.WA_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: chunk } }),
    });
  }
}

// ── Twilio webhook ────────────────────────────────────────────────────────────

app.post("/webhook/twilio", async (req, res) => {
  try {
    const from = req.body.From || "";
    const body = (req.body.Body || "").trim();
    const numMedia = parseInt(req.body.NumMedia || "0");
    const mediaUrl = req.body.MediaUrl0 || "";
    const mediaType = req.body.MediaContentType0 || "";
    const phone = from.replace("whatsapp:", "");
    const userId = phoneToUserId(phone) || "sb";
    let userText = body;
    let inputWasAudio = false;
    if (numMedia > 0 && mediaType.startsWith("audio/")) {
      console.log(`🎤 Audio [${userId}] tipo: ${mediaType}`);
      userText = await transcribeAudio(mediaUrl, mediaType) || "[audio no entendido]";
      inputWasAudio = true;
      console.log(`📝 Transcripción: ${userText}`);
    }
    if (!userText) return res.set("Content-Type", "text/xml").send("<Response/>");
    console.log(`📱 Twilio [${userId}] ${userText}`);
    const { text: reply } = await processAliciaMessage(userId, userText, "whatsapp");

    if (inputWasAudio) {
      // Respond with voice note
      try {
        const audioBuf = await generateSpeech(reply);
        const id = Math.random().toString(36).slice(2);
        ttsCache.set(id, audioBuf);
        setTimeout(() => ttsCache.delete(id), 5 * 60 * 1000);
        const audioUrl = `${process.env.BASE_URL || "https://aliceai.bam.pe"}/tts/${id}.wav`;
        res.set("Content-Type", "text/xml").send(`<Response><Message><Media>${audioUrl}</Media></Message></Response>`);
        return;
      } catch (ttsErr) {
        console.error("TTS falló, respondiendo texto:", ttsErr.message);
      }
    }

    const chunks = reply.length <= 1500 ? [reply] : reply.match(/[\s\S]{1,1500}/g) || [reply];
    const msgs = chunks.map(c => `<Message>${escapeXml(c)}</Message>`).join("");
    res.set("Content-Type", "text/xml").send(`<Response>${msgs}</Response>`);
  } catch (e) {
    console.error("Twilio error:", e.message);
    res.set("Content-Type", "text/xml").send("<Response><Message>Tuve un problema, intentá de nuevo.</Message></Response>");
  }
});

async function transcribeAudio(mediaUrl, mediaType) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const audioRes = await fetch(mediaUrl, {
    headers: { Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64") },
  });
  if (!audioRes.ok) throw new Error(`Audio download failed: ${audioRes.status}`);
  const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
  const ext = mediaType.includes("ogg") ? "ogg" : mediaType.includes("mp4") ? "mp4" : "wav";
  const formData = new FormData();
  formData.append("file", new Blob([audioBuffer], { type: mediaType }), `audio.${ext}`);
  formData.append("model", "whisper-large-v3-turbo");
  formData.append("language", "es");
  const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: formData,
  });
  if (!groqRes.ok) throw new Error(`Groq error: ${await groqRes.text()}`);
  return (await groqRes.json()).text?.trim() || null;
}

// ── TTS (Groq PlayAI) ─────────────────────────────────────────────────────────
const ttsCache = new Map(); // id → Buffer, cleaned up after 5 min

const ALLOWED_VOICES = new Set([
  "autumn","diana","hannah",  // femeninas
  "austin","daniel","troy",   // masculinas
]);

async function generateSpeech(text, voice = "diana") {
  const safeVoice = ALLOWED_VOICES.has(voice) ? voice : "diana";
  const limited = text.slice(0, 2000);
  const res = await fetch("https://api.groq.com/openai/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "canopylabs/orpheus-v1-english", input: limited, voice: safeVoice, response_format: "wav" }),
  });
  if (!res.ok) throw new Error(`Groq TTS error: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

app.post("/api/tts", async (req, res) => {
  const { text, voice } = req.body;
  if (!text) return res.status(400).json({ error: "No text" });
  try {
    const buf = await generateSpeech(text, voice);
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
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${OAUTH_BASE}/auth/google/callback`,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_SCOPES,
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

app.get("/auth/google/callback", async (req, res) => {
  try {
    const { code, error } = req.query;
    if (error) return res.status(400).send(`Google devolvió error: ${error}`);
    if (!code) return res.status(400).send("Falta el código de autorización");
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
      `INSERT INTO app_settings (key, value, updated_at) VALUES ('google_refresh_token', ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [data.refresh_token]
    );
    const { clearTokenCache } = await import("./integrations/google.js");
    clearTokenCache();
    console.log("🔑 Google refresh token guardado vía OAuth");
    res.send(`<html><body style="font-family:sans-serif;padding:40px;text-align:center">
      <h2>✅ Google conectado</h2>
      <p>Alicia ya puede usar tu Calendar y Gmail. Podés cerrar esta pestaña.</p>
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
    res.json({
      ok: true,
      projects: snap?.projects || [],
      total: snap?.total || 0,
      scraped_at: snap?.scraped_at || null,
      macro,        // { tasa_hip_pen, tasa_hip_usd, usd_pen } from BCRP
      bank_rates,   // per-bank hipotecario rates from Playwright scraper
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

app.get("/health", (_, res) => res.json({
  ok: true, service: "alicia-brain",
  erp: process.env.ERP_URL || "http://localhost:3002",
  integrations: {
    google:  !!(process.env.GOOGLE_CLIENT_ID),
    zoom:    !!(process.env.ZOOM_ACCOUNT_ID),
    dropbox: !!(process.env.DROPBOX_ACCESS_TOKEN),
    tavily:  !!(process.env.TAVILY_API_KEY),
  }
}));

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

  startCron();
});
