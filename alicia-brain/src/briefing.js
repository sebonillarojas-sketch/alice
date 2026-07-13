// Briefing diario proactivo — corre cada mañana a las 7:00am Lima
import Anthropic from "@anthropic-ai/sdk";
import { erp } from "./erp-client.js";
import { googleCalendar, googleAvailable } from "./integrations/google.js";
import { tavily, tavilyAvailable } from "./integrations/tavily.js";
import { query } from "./db.js";
import dotenv from "dotenv";
dotenv.config();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

import { sendWA } from "./wa.js";

async function sendWhatsApp(to, text) {
  await sendWA(to, text).catch(e => console.error("Briefing WA falló:", e.message));
}

export async function runDailyBriefing() {
  console.log("📋 Generando briefing diario...");
  const today = new Date().toLocaleDateString("es-PE", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  // 1. Tareas vencidas
  const allTasks = await erp.getTasks({ status: "todo" }).catch(() => []);
  const todayStr = new Date().toISOString().split("T")[0];
  const overdue = allTasks.filter(t => t.due_date && t.due_date < todayStr);
  const dueSoon = allTasks.filter(t => t.due_date && t.due_date === todayStr);

  // 2. Calendario de hoy
  let calendarBlock = "";
  if (googleAvailable()) {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const events = await googleCalendar.listEvents({ timeMax: tomorrow }).catch(() => []);
    calendarBlock = events.length
      ? events.map(e => `• ${e.start?.slice(11,16) || ""} ${e.title}`).join("\n")
      : "Sin reuniones agendadas.";
  } else {
    calendarBlock = "(Google Calendar no configurado)";
  }

  // 3. Noticias del mercado
  let newsBlock = "";
  if (tavilyAvailable()) {
    const news = await tavily.search({ query: "mercado inmobiliario Lima Perú 2025", maxResults: 3 }).catch(() => null);
    newsBlock = news?.results?.map(r => `• ${r.title} — ${r.url}`).join("\n") || "Sin noticias encontradas.";
  } else {
    newsBlock = "(Tavily no configurado — activa web search con TAVILY_API_KEY)";
  }

  // 4. Knowledge relevante
  const { rows: knowledge } = query("SELECT topic, content FROM knowledge ORDER BY updated_at DESC LIMIT 5");
  const knowledgeBlock = knowledge.length
    ? knowledge.map(k => `• ${k.topic}: ${k.content.slice(0, 100)}`).join("\n")
    : "Base de conocimiento vacía aún.";

  // 5. Generar briefing con Claude
  const prompt = `Sos Alicia, asistente ejecutiva de Sebastián Bonilla, CEO de Hygge Holding Lima.
Hoy es ${today}.

Generá un briefing ejecutivo matutino conciso y útil para Sebastián. Tono: directo, cálido, peruano. Sin relleno.

DATOS:

CALENDARIO HOY:
${calendarBlock}

TAREAS VENCIDAS (${overdue.length}):
${overdue.map(t => `• #${t.id} ${t.title} — ${t.assignee_id || "sin asignar"} (venció ${t.due_date})`).join("\n") || "Ninguna"}

VENCEN HOY (${dueSoon.length}):
${dueSoon.map(t => `• #${t.id} ${t.title} — ${t.assignee_id || "sin asignar"}`).join("\n") || "Ninguna"}

NOTICIAS INMOBILIARIAS:
${newsBlock}

LO QUE SÉ DE HYGGE:
${knowledgeBlock}

Armá el briefing: calendario, alertas, noticias relevantes, y una sugerencia proactiva tuya.`;

  const resp = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 800,
    messages: [{ role: "user", content: prompt }],
  });

  const briefing = resp.content[0].text;
  console.log("📋 Briefing generado:\n", briefing);

  // 6. Enviar a Sebastián por WhatsApp
  const sbPhone = process.env.PHONE_SB;
  if (sbPhone) {
    await sendWhatsApp(sbPhone, briefing);
    console.log("✅ Briefing enviado a Sebastián por WhatsApp");
  }

  // 7. Alertas a colaboradores con tareas vencidas
  const byAssignee = {};
  for (const t of overdue) {
    if (!t.assignee_id) continue;
    if (!byAssignee[t.assignee_id]) byAssignee[t.assignee_id] = [];
    byAssignee[t.assignee_id].push(t);
  }
  for (const [userId, tasks] of Object.entries(byAssignee)) {
    const phone = process.env[`PHONE_${userId.toUpperCase()}`];
    if (!phone) continue;
    const { rows: [profile] } = query("SELECT name FROM profiles WHERE user_id = ?", [userId]);
    const nombre = profile?.name?.split(" ")[0] || userId;
    const msg = `Hola ${nombre} 👋 Tenés ${tasks.length} tarea${tasks.length > 1 ? "s" : ""} vencida${tasks.length > 1 ? "s" : ""}:\n${tasks.map(t => `• ${t.title}`).join("\n")}\n\n¿Cómo va? ¿Necesitás algo?`;
    await sendWhatsApp(phone, msg);
    console.log(`✅ Alerta enviada a ${nombre}`);
  }

  return briefing;
}
