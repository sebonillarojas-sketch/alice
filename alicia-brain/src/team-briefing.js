// Briefing matutino del equipo — corre cada mañana a las 9:00am Lima.
//
// A diferencia del briefing ejecutivo (briefing.js), este NO pasa por el LLM: las
// tareas y la agenda de cada persona se mandan tal cual salen del ERP y de Google.
// Un modelo que "resume" la lista de pendientes de alguien es un modelo que puede
// inventarle o comerse una tarea, y acá el costo de eso lo paga el equipo.
//
// Degrada por persona: quien tenga su Google conectado recibe reuniones y correos;
// quien no, recibe sus tareas y el link para conectarlo.
import { resolvePhone } from "./tools.js";

const BASE_URL = () => process.env.BASE_URL || "https://aliceai.bam.pe";

// ── Roster ────────────────────────────────────────────────────────────────────

// El equipo vive en dos lados: la tabla `profiles` y las variables PHONE_<id> del
// entorno (en minúsculas: PHONE_sb, PHONE_vd, …). Tomamos la unión para no dejar a
// nadie afuera, y resolvemos el teléfono con el mismo resolvePhone que usa el resto
// del brain (profiles.phone gana, el env es el fallback).
export function buildRoster(db, env = process.env) {
  const ids = new Set();
  for (const key of Object.keys(env)) {
    const m = /^PHONE_([A-Za-z0-9]+)$/.exec(key);
    if (m) ids.add(m[1].toLowerCase());
  }
  try {
    for (const row of db.prepare("SELECT user_id FROM profiles").all()) ids.add(row.user_id);
  } catch {}

  const roster = [];
  for (const userId of [...ids].sort()) {
    const phone = resolvePhone(db, userId, env);
    if (!phone) continue; // sin número no hay a dónde mandarle
    const row = db.prepare("SELECT name FROM profiles WHERE user_id = ?").get(userId);
    roster.push({ userId, name: row?.name?.split(" ")[0] || userId, phone });
  }
  return roster;
}

// ── Formato del mensaje ───────────────────────────────────────────────────────

const hhmm = (iso) => (typeof iso === "string" && iso.length >= 16 ? iso.slice(11, 16) : "");
const senderName = (from = "") => from.replace(/<[^>]*>/g, "").replace(/"/g, "").trim() || from;

const MAX_ITEMS = 5;

// Una línea por bloque, ítems separados por " · ". Los bloques vacíos se omiten:
// un mensaje diario que se lee de un vistazo se abre; uno que hay que scrollear, no.
function linea(items) {
  const shown = items.slice(0, MAX_ITEMS).join(" · ");
  const rest = items.length - MAX_ITEMS;
  return rest > 0 ? `${shown} …+${rest}` : shown;
}

export function formatTeamBriefing({ name, tasksToday = [], overdue = [], meetings = [], emails = [], googleUrl = null }) {
  const bloques = [];

  if (tasksToday.length) bloques.push(`📋 Hoy (${tasksToday.length}): ${linea(tasksToday.map(t => t.title))}`);
  if (overdue.length)    bloques.push(`⚠️ Vencidas (${overdue.length}): ${linea(overdue.map(t => t.title))}`);

  // Sin Google conectado no mostramos agenda ni correos: la ausencia de datos y la
  // ausencia de conexión no son lo mismo, y un "sin reuniones" mentiroso es peor que nada.
  if (googleUrl) {
    bloques.push(`🔗 Conectá tu Google: ${googleUrl}`);
  } else {
    if (meetings.length) bloques.push(`📅 ${linea(meetings.map(m => `${hhmm(m.start)} ${m.title}`.trim()))}`);
    if (emails.length)   bloques.push(`📧 ${emails.length} sin leer: ${linea(emails.map(e => senderName(e.from)))}`);
  }

  if (!bloques.length) bloques.push("Todo despejado: sin tareas, reuniones ni correos pendientes.");

  return [`Buenos días, ${name} ☕🌞`, "", ...bloques].join("\n");
}

// ── Orquestación ──────────────────────────────────────────────────────────────

// `only` acota el envío a un solo userId — para probar en producción sin escribirle
// al equipo entero. Sin `only`, va a todo el roster.
export async function runTeamBriefing({ db, only = null, deps = {} } = {}) {
  const {
    getTasks     = async (...a) => (await import("./erp-client.js")).erp.getTasks(...a),
    listEvents   = async (...a) => (await import("./integrations/google.js")).googleCalendar.listEvents(...a),
    searchEmails = async (...a) => (await import("./integrations/google.js")).gmail.searchEmails(...a),
    hasGoogle    = async (uid) => (await import("./integrations/google.js")).googleAvailable(uid),
    send         = async (...a) => (await import("./wa.js")).sendWA(...a),
  } = deps;

  const roster = buildRoster(db).filter(p => !only || p.userId === only);
  if (!roster.length) {
    console.log("📋 Briefing de equipo: roster vacío, nada que mandar");
    return { sent: 0, skipped: 0 };
  }

  const todayStr = new Date().toISOString().split("T")[0];
  const allTasks = await getTasks({ status: "todo" }).catch(e => {
    console.error("Briefing equipo · ERP falló:", e.message);
    return [];
  });

  const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);

  let sent = 0, skipped = 0;
  for (const person of roster) {
    try {
      const mine = allTasks.filter(t => t.assignee_id === person.userId);
      const tasksToday = mine.filter(t => t.due_date === todayStr);
      const overdue    = mine.filter(t => t.due_date && t.due_date < todayStr);

      let meetings = [], emails = [], googleUrl = null;
      if (await hasGoogle(person.userId)) {
        meetings = await listEvents({ timeMax: endOfDay.toISOString() }, person.userId).catch(() => []);
        emails = await searchEmails({ query: "is:unread newer_than:1d", maxResults: 5 }, person.userId).catch(() => []);
      } else {
        googleUrl = `${BASE_URL()}/auth/google?user=${person.userId}`;
      }

      const msg = formatTeamBriefing({ name: person.name, tasksToday, overdue, meetings, emails, googleUrl });
      const ok = await send(person.phone, msg);
      if (ok === false) { skipped++; continue; }
      sent++;
      console.log(`📋 Briefing enviado a ${person.name} (${person.userId})`);
    } catch (e) {
      skipped++;
      console.error(`Briefing equipo · ${person.userId} falló:`, e.message);
    }
  }

  console.log(`📋 Briefing de equipo · ${sent} enviado(s), ${skipped} salteado(s)`);
  return { sent, skipped };
}
