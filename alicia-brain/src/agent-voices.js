// Voces de los agentes Wonderland: dan una respuesta conversacional en 1ª persona,
// anclada en la data que YA reportaron (agent_runs / agent_findings). No disparan corridas
// nuevas — solo hablan desde lo último que corrieron. Ver spec ask-agent.
import Anthropic from "@anthropic-ai/sdk";

const _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Keyed por el nombre exacto con que reportan a agent_runs.
export const AGENT_PROFILES = {
  "white-rabbit": { emoji: "🐰", name: "White Rabbit", role: "guardia de infraestructura pública", voice: "ansioso pero preciso; vas al grano con el estado de la infra y los servicios" },
  "cheshire":     { emoji: "😺", name: "Cheshire", role: "tester E2E de usabilidad", voice: "socarrón, disfrutás encontrar bugs, directo" },
  "knave":        { emoji: "🃏", name: "Knave", role: "seguridad (L0: solo observás, no parchás)", voice: "seco y formal; señalás riesgos sin dramatizar" },
  "mad-hatter":   { emoji: "🎩", name: "Mad Hatter", role: "performance y costos", voice: "excéntrico pero data-driven; hablás de latencia y plata" },
  "tea-table":    { emoji: "🫖", name: "Tea Table", role: "síntesis semanal del consejo", voice: "reflexivo; conectás lo que vieron todos los agentes" },
  "dark-alice":   { emoji: "🖤", name: "Dark Alice", role: "jefa de operaciones de Wonderland", voice: "calmada y ejecutiva; sintetizás el estado y proponés, no ejecutás sola" },
  "bandersnatch": { emoji: "⚔️", name: "Bandersnatch", role: "chaos tester de saturación", voice: "bruto y directo; hablás de a qué carga se rompe cada cosa" },
  "jabberwocky":  { emoji: "⚡", name: "Jabberwocky", role: "fuzzer de inputs adversariales", voice: "caótico; hablás de qué inputs rompen el parser" },
};

// Alias comunes → clave real (por si Alicia manda un nombre coloquial).
const ALIASES = { "conejo": "white-rabbit", "rabbit": "white-rabbit", "gato": "cheshire", "mesa": "tea-table", "sombrerero": "mad-hatter" };

export function resolveAgentKey(agent) {
  const a = String(agent || "").toLowerCase().trim();
  return ALIASES[a] || a;
}

// Toma `db` explícito (testeable con :memory:). Devuelve la última corrida + hallazgos abiertos.
export function loadAgentContext(db, agentKey) {
  const lastRun = db.prepare(
    "SELECT result, summary, report, created_at FROM agent_runs WHERE agent = ? ORDER BY id DESC LIMIT 1"
  ).get(agentKey) || null;
  const findings = db.prepare(
    "SELECT severity, category, detail, created_at FROM agent_findings WHERE agent = ? AND status IN ('open','escalated') ORDER BY created_at DESC LIMIT 15"
  ).all(agentKey);
  return { lastRun, findings };
}

// Puro: arma el prompt (system + messages) para darle voz al agente. Testeable.
export function buildAgentPrompt(profile, context, question) {
  const { lastRun, findings } = context || {};
  const data = [];
  if (lastRun) {
    data.push(`Tu última corrida (${lastRun.created_at}): resultado=${lastRun.result} · ${lastRun.summary || ""}`);
    if (lastRun.report) data.push(`Tu reporte:\n${String(lastRun.report).slice(0, 1500)}`);
  } else {
    data.push("Todavía no corriste — no tenés data propia todavía.");
  }
  if (findings && findings.length) {
    data.push(`Tus hallazgos abiertos (${findings.length}):\n` + findings.map(f => `- [${f.severity}] ${f.category}: ${f.detail}`).join("\n"));
  } else if (lastRun) {
    data.push("No tenés hallazgos abiertos.");
  }
  const system = `Sos ${profile.emoji} ${profile.name}, ${profile.role} del equipo Wonderland (el equipo de IT autónomo de Alicia). Tono: ${profile.voice}. Respondé en 1ª persona, en criollo, CORTO (2-4 frases). Usá SOLO tu data real de abajo; si no tenés el dato para lo que te preguntan, decilo con honestidad — NUNCA inventes hallazgos, números ni causas.

— TU DATA REAL —
${data.join("\n")}`;
  return { system, messages: [{ role: "user", content: String(question || "").slice(0, 2000) }], model: "claude-sonnet-4-6", max_tokens: 400 };
}

// Consulta a un agente y devuelve su respuesta en 1ª persona. `client` inyectable para test.
export async function askAgent(db, agent, question, { client = _client } = {}) {
  const key = resolveAgentKey(agent);
  const profile = AGENT_PROFILES[key];
  if (!profile) {
    return `No conozco un agente "${agent}". Puedo consultar a: ${Object.keys(AGENT_PROFILES).join(", ")}.`;
  }
  const ctx = loadAgentContext(db, key);
  const { system, messages, model, max_tokens } = buildAgentPrompt(profile, ctx, question);
  try {
    const resp = await client.messages.create({ model, max_tokens, system, messages });
    const text = resp?.content?.find(b => b.type === "text")?.text?.trim() || "(no tengo nada para decir ahora)";
    return `${profile.emoji} ${profile.name}: ${text}`;
  } catch (e) {
    return `No pude contactar a ${profile.name} ahora mismo: ${e.message}`;
  }
}
