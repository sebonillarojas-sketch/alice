// ── Alicia Brain · Servidor Express ──────────────────────────────────────────
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";
import { query, parseArr } from "./db.js";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false })); // para Twilio

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
  const { rows } = await query("SELECT * FROM profiles WHERE user_id = ?", [userId]);
  if (!rows[0]) return null;
  const p = rows[0];
  // SQLite guarda arrays como JSON strings — deserializar
  for (const f of ["projects","skills_current","skills_developing","skills_explore","strengths","opportunities","attendees"]) {
    if (p[f] !== undefined) p[f] = parseArr(p[f]);
  }
  return p;
}

async function getAllProfiles() {
  const { rows } = await query("SELECT * FROM profiles ORDER BY user_id", []);
  return rows.map(p => {
    for (const f of ["projects","skills_current","skills_developing","skills_explore","strengths","opportunities"]) {
      p[f] = parseArr(p[f]);
    }
    return p;
  });
}

async function getRecentMessages(userId, limit = 80) {
  const { rows } = await query(
    `SELECT role, content FROM messages WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
    [userId, limit]
  );
  return rows.reverse();
}

async function getRelevantMemories(userId, limit = 15) {
  const { rows } = await query(
    `SELECT content, category, importance FROM memories WHERE user_id = ? ORDER BY importance DESC, created_at DESC LIMIT ?`,
    [userId, limit]
  );
  return rows;
}

async function saveMessage(userId, role, content, channel = "app", actions = [], waMsgId = null) {
  const { lastID } = await query(
    `INSERT INTO messages (user_id, role, content, channel, wa_msg_id, actions) VALUES (?,?,?,?,?,?)`,
    [userId, role, content, channel, waMsgId, JSON.stringify(actions)]
  );
  return lastID;
}

async function extractAndSaveMemories(userId, userMsg, assistantMsg, msgId) {
  try {
    const resp = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [{
        role: "user",
        content: `Eres un extractor de hechos. Del siguiente intercambio, extrae hechos importantes sobre el usuario (decisiones, preferencias, proyectos, datos profesionales, logros, dificultades).

Responde SOLO con JSON array: [{"content": "...", "category": "decision|personal|proyecto|preferencia|crecimiento", "importance": 1-5}]

Si no hay nada valioso, responde: []

Usuario dijo: "${userMsg}"
Alicia respondió: "${assistantMsg.slice(0, 300)}"`
      }]
    });
    const facts = JSON.parse(resp.content[0].text.trim());
    if (!Array.isArray(facts) || facts.length === 0) return;
    for (const fact of facts) {
      await query(
        `INSERT INTO memories (user_id, content, category, importance, source_msg_id) VALUES (?,?,?,?,?)`,
        [userId, fact.content, fact.category || "general", fact.importance || 3, msgId]
      );
    }
  } catch { /* silencioso */ }
}

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(profile, allProfiles, memories, channel) {
  const team = allProfiles.map(p =>
    `• ${p.name} (${p.user_id}) — ${p.role} · Proyectos: ${(p.projects || []).join(", ")}`
  ).join("\n");

  const memBlock = memories.length > 0
    ? `\n## Lo que sé de esta persona:\n${memories.map(m => `• [${m.category}] ${m.content}`).join("\n")}`
    : "";

  const profileBlock = profile ? `
## Perfil de ${profile.name}
- Rol: ${profile.role}
- Proyectos: ${(profile.projects || []).join(", ")}
- Skills actuales: ${(profile.skills_current || []).join(", ")}
- Desarrollando: ${(profile.skills_developing || []).join(", ")}
- Por explorar: ${(profile.skills_explore || []).join(", ")}
- Crecimiento corto plazo: ${profile.growth_short || "—"}
- Crecimiento largo plazo: ${profile.growth_long || "—"}
- Estilo de trabajo: ${profile.work_style || "—"}
- Fortalezas: ${(profile.strengths || []).join(", ")}
- Oportunidades: ${(profile.opportunities || []).join(", ")}` : "";

  return `Eres Alicia, la asistente ejecutiva con IA de Hygge Holding, una empresa inmobiliaria premium en Lima, Perú.

## Tu personalidad
- Eres cálida, directa, peruana. Hablás como una colega inteligente, no como un bot corporativo.
- Usás español peruano natural: "bacán", "ya pues", "dale", "no hay de qué". Sin exagerar.
- Eres ejecutiva: vas al grano, das contexto, anticipás lo que necesitan.
- Tenés memoria. Recordás todo lo que te han contado.
- Canal actual: ${channel === "whatsapp" ? "WhatsApp" : "ALICE App"}

## Equipo Hygge Holding
${team}

## SPVs / Proyectos
- DC01: Edificio Dasso — Miraflores premium
- PU01: Punta Unión — proyecto en curso
- TG01: Tagle — en desarrollo
- L36: Larco 1036 — rooftop lounge
- Legendre: adquisición en proceso
${profileBlock}${memBlock}

## Herramientas disponibles
Cuando el usuario te pida crear algo, incluí el JSON de acción al FINAL de tu respuesta entre \`\`\`json y \`\`\`:

Para crear tarea:
{"type":"create_task","title":"...","space":"...","priority":"alta|media|baja","assignee":"user_id","due":"YYYY-MM-DD","note":"..."}

Para agendar reunión:
{"type":"create_event","title":"...","date":"YYYY-MM-DD","time":"HH:MM","attendees":["user_id",...],"purpose":"...","brief":"..."}

Para anotar en perfil:
{"type":"add_alicia_note","userId":"user_id","note":"..."}

Para actualizar skills:
{"type":"update_skills","userId":"user_id","field":"developing|toExplore|current","add":["..."]}

Para actualizar crecimiento:
{"type":"update_growth","userId":"user_id","shortTerm":"...","longTerm":"..."}

Si son múltiples acciones, ponelas en un array JSON.

## Reglas
- SIEMPRE respondé en español
- Reuniones: siempre pedí propósito si no está claro, y armá un brief con contexto relevante
- Hoy es ${new Date().toLocaleDateString("es-PE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`;
}

// ── Procesamiento de mensajes ─────────────────────────────────────────────────

async function processAliciaMessage(userId, userText, channel = "app") {
  const [profile, allProfiles, history, memories] = await Promise.all([
    getProfile(userId),
    getAllProfiles(),
    getRecentMessages(userId, 60),
    getRelevantMemories(userId, 12),
  ]);

  const systemPrompt = buildSystemPrompt(profile, allProfiles, memories, channel);
  const messages = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: "user", content: userText },
  ];

  const resp = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });

  const fullText = resp.content[0].text;

  // Extraer acciones del JSON embebido
  const actions = [];
  const jsonMatch = fullText.match(/```json\n?([\s\S]*?)\n?```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (Array.isArray(parsed)) actions.push(...parsed);
      else actions.push(parsed);
    } catch {}
  }

  const cleanText = fullText.replace(/```json[\s\S]*?```/g, "").trim();

  // Guardar en DB
  await saveMessage(userId, "user", userText, channel);
  const msgId = await saveMessage(userId, "assistant", cleanText, channel, actions);

  // Ejecutar acciones
  for (const action of actions) {
    await executeAction(action, userId);
  }

  // Extraer memorias en background
  extractAndSaveMemories(userId, userText, cleanText, msgId).catch(() => {});

  return { text: cleanText, actions };
}

async function executeAction(action, createdBy) {
  try {
    if (action.type === "create_event") {
      await query(
        `INSERT INTO events (title, date, time, attendees, purpose, brief, created_by) VALUES (?,?,?,?,?,?,?)`,
        [action.title, action.date || null, action.time || null, JSON.stringify(action.attendees || []), action.purpose || "", action.brief || "", createdBy]
      );
    } else if (action.type === "create_task") {
      await query(
        `INSERT INTO tasks_log (title, space, assignee, priority, due, note, created_by) VALUES (?,?,?,?,?,?,?)`,
        [action.title, action.space || "", action.assignee || "", action.priority || "media", action.due || "", action.note || "", createdBy]
      );
    } else if (action.type === "add_alicia_note") {
      await query(
        `UPDATE profiles SET growth_notes = COALESCE(growth_notes || char(10), '') || ?, updated_at = datetime('now') WHERE user_id = ?`,
        [action.note, action.userId]
      );
    } else if (action.type === "update_skills") {
      // SQLite: leer, agregar, guardar
      const col = { developing: "skills_developing", toExplore: "skills_explore", current: "skills_current" }[action.field];
      if (col && action.add?.length) {
        const { rows } = await query(`SELECT ${col} FROM profiles WHERE user_id = ?`, [action.userId]);
        if (rows[0]) {
          const existing = parseArr(rows[0][col]);
          const merged = [...new Set([...existing, ...action.add])];
          await query(`UPDATE profiles SET ${col} = ?, updated_at = datetime('now') WHERE user_id = ?`, [JSON.stringify(merged), action.userId]);
        }
      }
    } else if (action.type === "update_growth") {
      await query(
        `UPDATE profiles SET growth_short = COALESCE(?, growth_short), growth_long = COALESCE(?, growth_long), updated_at = datetime('now') WHERE user_id = ?`,
        [action.shortTerm || null, action.longTerm || null, action.userId]
      );
    }
  } catch (e) {
    console.error("executeAction error:", e.message);
  }
}

// ── WhatsApp webhook ──────────────────────────────────────────────────────────

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
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
      headers: { "Authorization": `Bearer ${process.env.WA_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: chunk } }),
    });
  }
}

// ── Twilio WhatsApp Sandbox ───────────────────────────────────────────────────

app.post("/webhook/twilio", async (req, res) => {
  try {
    const from      = req.body.From || "";
    const body      = (req.body.Body || "").trim();
    const numMedia  = parseInt(req.body.NumMedia || "0");
    const mediaUrl  = req.body.MediaUrl0 || "";
    const mediaType = req.body.MediaContentType0 || "";

    const phone  = from.replace("whatsapp:", "");
    const userId = phoneToUserId(phone) || "sb";

    let userText = body;

    // Audio: transcribir con Claude
    if (numMedia > 0 && mediaType.startsWith("audio/")) {
      console.log(`🎤 Audio recibido [${userId}] tipo: ${mediaType}`);
      userText = await transcribeAudio(mediaUrl, mediaType) || "[audio no entendido]";
      console.log(`📝 Transcripción: ${userText}`);
    }

    if (!userText) return res.set("Content-Type", "text/xml").send("<Response/>");

    console.log(`📱 Twilio [${userId}] ${userText}`);
    const { text: reply } = await processAliciaMessage(userId, userText, "whatsapp");

    const chunks = reply.length <= 1500 ? [reply] : reply.match(/[\s\S]{1,1500}/g) || [reply];
    const msgs = chunks.map(c => `<Message>${escapeXml(c)}</Message>`).join("");
    res.set("Content-Type", "text/xml").send(`<Response>${msgs}</Response>`);
  } catch (e) {
    console.error("Twilio webhook error:", e.message);
    res.set("Content-Type", "text/xml").send("<Response><Message>Tuve un problema, intentá de nuevo.</Message></Response>");
  }
});

async function transcribeAudio(mediaUrl, mediaType) {
  // 1. Descargar audio de Twilio
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const audioRes = await fetch(mediaUrl, {
    headers: { "Authorization": "Basic " + Buffer.from(`${sid}:${token}`).toString("base64") },
  });
  if (!audioRes.ok) throw new Error(`Audio download failed: ${audioRes.status}`);
  const audioBuffer = Buffer.from(await audioRes.arrayBuffer());

  // 2. Transcribir con Groq Whisper (gratis, rápido)
  const ext = mediaType.includes("ogg") ? "ogg" : mediaType.includes("mp4") ? "mp4" : "wav";
  const formData = new FormData();
  formData.append("file", new Blob([audioBuffer], { type: mediaType }), `audio.${ext}`);
  formData.append("model", "whisper-large-v3-turbo");
  formData.append("language", "es");

  const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY}` },
    body: formData,
  });
  if (!groqRes.ok) {
    const err = await groqRes.text();
    throw new Error(`Groq transcription failed: ${err}`);
  }
  const data = await groqRes.json();
  return data.text?.trim() || null;
}

function escapeXml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── REST API (ALICE App) ──────────────────────────────────────────────────────

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
  const { rows } = await query(
    `SELECT * FROM memories WHERE user_id = ? ORDER BY importance DESC, created_at DESC LIMIT 100`,
    [req.params.userId]
  );
  res.json(rows);
});

app.get("/health", (req, res) => res.json({ ok: true, service: "alicia-brain", mode: process.env.DB_MODE || "sqlite" }));

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🧠 Alicia Brain · http://localhost:${PORT}`);
  console.log(`   DB mode: ${process.env.DB_MODE || "sqlite"}`);
  console.log(`   POST /api/chat · GET /api/profiles · GET /health\n`);
});
