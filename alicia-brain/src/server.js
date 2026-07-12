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

// ── System prompt ─────────────────────────────────────────────────────────────

const CEO_ID = "sb";

function buildSystemPrompt(profile, allProfiles, memories, knowledge, channel, userId) {
  const isCEO = userId === CEO_ID;

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
Sos co-creadora del ERP. Al final de cada respuesta al CEO (o cuando sea natural), agregás UNA sugerencia breve de widget, feature o mejora para ALICE. Formato:
💡 **Idea ALICE:** [nombre corto] · [qué haría en una línea]
Ejemplos: widget de actividad Dropbox por proyecto · alerta cuando una carpeta lleva +7 días sin cambios · KPI de archivos entregados vs pendientes · resumen semanal automático de movimientos en Dropbox · panel de hitos editables por proyecto · notificación cuando un prospecto lleva +X días sin seguimiento.
Solo una por respuesta. Que sea concreta, no genérica. Si ya sugeriste algo y Seba no lo retomó, sugerí algo distinto.`
    : `## Modo: Colaborador · Asistencia
Con ${profile?.name?.split(" ")[0] || "el equipo"} sos una asistente directa y eficiente.
- Te enfocás en sus tareas y proyectos específicos
- No compartís información confidencial de otros sin permiso
- Ejecutás, organizás, recordás y ayudás a priorizar
- Tono más operativo, menos estratégico`;

  return `Eres Alicia, la asistente ejecutiva con IA de Hygge Holding, empresa inmobiliaria premium en Lima, Perú.

## Tu personalidad
- Cálida, directa, peruana. Hablás como una colega inteligente, no como un bot.
- Español peruano natural: "bacán", "ya pues", "dale". Sin exagerar.
- Tenés memoria. Recordás todo lo que te han contado.
- Sos rápida — vas al grano, no das vueltas.
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
${profileBlock}${memBlock}${knowledgeBlock}

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
    if (textBlock) finalText = textBlock.text;

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

  // Extraer memorias en background
  extractAndSaveMemories(userId, userText, finalText, msgId).catch(() => {});

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
        const audioUrl = `${process.env.BASE_URL || "https://aliceai.bam.pe"}/tts/${id}.mp3`;
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

async function generateSpeech(text) {
  const limited = text.slice(0, 2000); // Groq TTS limit
  const res = await fetch("https://api.groq.com/openai/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "playai-tts", input: limited, voice: "Celeste-PlayAI", response_format: "mp3" }),
  });
  if (!res.ok) throw new Error(`Groq TTS error: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

app.post("/api/tts", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "No text" });
  try {
    const buf = await generateSpeech(text);
    res.set("Content-Type", "audio/mpeg").send(buf);
  } catch (e) {
    console.error("TTS error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// Serve cached TTS audio for Twilio (needs public URL)
app.get("/tts/:id.mp3", (req, res) => {
  const buf = ttsCache.get(req.params.id);
  if (!buf) return res.status(404).send("Not found");
  res.set("Content-Type", "audio/mpeg").send(buf);
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
