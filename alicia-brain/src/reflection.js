// Auto-reflexión (Loop 3b #3a): cada agente mira su actividad reciente y propone A LO SUMO
// una lección accionable. Se enchufa a proposeLesson → gate-pass → superficies de aprobación.
// Nada se auto-aplica. Reusa agent-voices.js (contexto/personas) y lessons.js.
import Anthropic from "@anthropic-ai/sdk";
import { proposeLesson } from "./lessons.js";
import { AGENT_PROFILES, loadAgentContext } from "./agent-voices.js";

const _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Alicia no está en agent_runs — reflexiona sobre sus propios mensajes.
const ALICIA_PROFILE = { emoji: "💬", name: "Alicia", role: "asistente ejecutiva de Hygge Holding", voice: "reflexionás con honestidad sobre cómo le respondiste al equipo" };

// Los agentes que reflexionan por defecto (Wonderland con data + Alicia).
export const REFLECTION_AGENTS = ["white-rabbit", "cheshire", "knave", "mad-hatter", "tea-table", "dark-alice", "bandersnatch", "jabberwocky", "alicia"];

// Arma el material de reflexión; null si el agente no tiene actividad.
function contextText(db, agent) {
  if (agent === "alicia") {
    const rows = db.prepare("SELECT role, content FROM messages ORDER BY id DESC LIMIT 40").all().reverse();
    if (!rows.length) return null;
    return "Tus interacciones recientes (rol: contenido):\n" + rows.map(m => `${m.role}: ${String(m.content).slice(0, 300)}`).join("\n");
  }
  const { lastRun, findings } = loadAgentContext(db, agent);
  if (!lastRun && (!findings || !findings.length)) return null;
  const parts = [];
  if (lastRun) parts.push(`Última corrida (${lastRun.created_at}): ${lastRun.result} · ${lastRun.summary || ""}${lastRun.report ? "\n" + String(lastRun.report).slice(0, 1200) : ""}`);
  if (findings && findings.length) parts.push("Hallazgos abiertos:\n" + findings.map(f => `- [${f.severity}] ${f.category}: ${f.detail}`).join("\n"));
  return parts.join("\n");
}

export async function reflectAgent(db, agent, { client = _client } = {}) {
  const profile = agent === "alicia" ? ALICIA_PROFILE : AGENT_PROFILES[agent];
  if (!profile) return { agent, proposed: false, lesson: null };
  const ctx = contextText(db, agent);
  if (!ctx) return { agent, proposed: false, lesson: null }; // sin actividad → nada que reflexionar
  const system = `Sos ${profile.emoji} ${profile.name}, ${profile.role}. ${profile.voice}. Mirá tu actividad reciente y proponé A LO SUMO UNA lección concreta y accionable para hacerlo mejor la próxima vez. Reglas: máximo 1 oración; accionable (nada de obviedades ni relleno); si no hay nada claro para mejorar, respondé EXACTAMENTE "NONE". Sin markdown, sin explicación — solo la lección o NONE.`;
  let text;
  try {
    const resp = await client.messages.create({ model: "claude-sonnet-4-6", max_tokens: 120, system, messages: [{ role: "user", content: ctx }] });
    text = resp?.content?.find(b => b.type === "text")?.text?.trim() || "";
  } catch (e) { console.error(`reflexión ${agent} falló:`, e.message); return { agent, proposed: false, lesson: null }; }
  if (!text || /^NONE\b/i.test(text)) return { agent, proposed: false, lesson: null };
  const lesson = text.replace(/^["'\-\s]+/, "").slice(0, 300);
  proposeLesson(db, { scope: agent === "alicia" ? "agent:alicia" : `agent:${agent}`, source: "reflection", trigger: "auto-reflexión", lesson, risk_level: "L1" });
  return { agent, proposed: true, lesson };
}

export async function runReflectionPass(db, { client, agents = REFLECTION_AGENTS } = {}) {
  const counts = { evaluated: 0, proposed: 0 };
  for (const agent of agents) {
    try {
      const r = await reflectAgent(db, agent, { client });
      counts.evaluated++;
      if (r.proposed) counts.proposed++;
    } catch (e) { console.error(`reflexión pass ${agent}:`, e.message); }
  }
  return counts;
}
