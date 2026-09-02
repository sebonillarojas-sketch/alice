// Loop de aprendizaje · capa 4 del gate: no-regresión (Fase 3b #5).
// Ver docs/superpowers/specs/2026-08-30-loop-3b-no-regresion-design.md
//
// Una lección aplicada es texto que se suma al system prompt de su scope. La pregunta
// que responde este módulo es: ¿ese texto habría empeorado algo que el agente ya venía
// haciendo bien? Se contrasta contra la ventana reciente de comportamiento real.
import { loadAgentContext } from "./agent-voices.js";
import Anthropic from "@anthropic-ai/sdk";

// Los scopes conversacionales miran los mensajes de Alicia; los agent:<x> miran sus
// corridas. `global` no tiene un comportamiento concreto que contrastar y por eso no
// se verifica: es la parte "donde sea factible" de la capa.
const CONVERSATIONAL = /^(agent:alicia|user:sb)$/;

function casesFromMessages(db, limit) {
  // Se leen 2*limit filas porque cada caso consume un par user+assistant.
  const rows = db.prepare(
    "SELECT role, content FROM messages ORDER BY id DESC LIMIT ?"
  ).all(limit * 2).reverse();
  const cases = [];
  for (let i = 0; i < rows.length - 1; i++) {
    if (rows[i].role === "user" && rows[i + 1].role === "assistant") {
      cases.push({
        input: String(rows[i].content).slice(0, 400),
        output: String(rows[i + 1].content).slice(0, 600),
      });
      i++; // el assistant ya se consumió
    }
  }
  return cases.slice(-limit);
}

function casesFromAgentRuns(db, agent, limit) {
  const { lastRun, findings } = loadAgentContext(db, agent);
  const cases = [];
  if (lastRun) {
    cases.push({
      input: `Corrida de ${agent} del ${lastRun.created_at}`,
      output: `${lastRun.result} · ${lastRun.summary || ""}${lastRun.report ? "\n" + String(lastRun.report).slice(0, 800) : ""}`,
    });
  }
  for (const f of (findings || []).slice(0, limit - cases.length)) {
    cases.push({
      input: `Hallazgo de ${agent} (${f.category})`,
      output: `[${f.severity}] ${f.detail}`,
    });
  }
  return cases.slice(0, limit);
}

// Devuelve [] ante cualquier problema: las suites del gate arman una db que solo tiene
// `lessons`, y "no hay material que contrastar" es exactamente la respuesta correcta ahí.
export function collectCases(db, scope, { limit = 8 } = {}) {
  try {
    if (CONVERSATIONAL.test(scope)) return casesFromMessages(db, limit);
    const m = /^agent:(.+)$/.exec(scope || "");
    if (m) return casesFromAgentRuns(db, m[1], limit);
    return [];
  } catch {
    return [];
  }
}

export function buildJudgePrompt(lesson, cases) {
  const system = `Sos el juez de no-regresión del loop de aprendizaje de ALICE. Te doy una lección que un agente está por incorporar a su system prompt, y casos reales recientes que ese agente resolvió BIEN.

Tu única pregunta: si el agente hubiera tenido esta lección en el prompt, ¿alguno de esos casos habría salido PEOR?

Criterio: solo marcá degradación si es concreta y podés señalar el caso. Una lección que simplemente no aplica a ningún caso NO es una degradación. Ante la duda, pasa.

Respondé SOLO un objeto JSON, sin markdown ni explicación alrededor:
{"verdict": "pass" | "degrades", "offending": [<índices de los casos afectados>], "reason": "<una oración>"}`;

  const user = `LECCIÓN PROPUESTA:
${lesson}

CASOS RECIENTES QUE SALIERON BIEN:
${cases.map((c, i) => `[${i}] Entrada: ${c.input}\n    Salida: ${c.output}`).join("\n\n")}`;

  return { system, user };
}

const _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const JUDGE_MODEL = "claude-opus-5";

// El juez decide si una lección entra al cerebro: es el peor lugar para ahorrar modelo.
// effort low porque la salida es un JSON de tres campos, no un ensayo.
export async function judgeRegression(lesson, cases, { client = _client } = {}) {
  const { system, user } = buildJudgePrompt(lesson, cases);
  const resp = await client.messages.create({
    model: JUDGE_MODEL,
    max_tokens: 400,
    output_config: { effort: "low" },
    system,
    messages: [{ role: "user", content: user }],
  });
  const text = resp?.content?.find(b => b.type === "text")?.text?.trim() || "";
  // A veces vuelve envuelto en ```json — se extrae el primer objeto del texto.
  const raw = /\{[\s\S]*\}/.exec(text)?.[0];
  if (!raw) throw new Error("el juez no devolvió JSON");
  const parsed = JSON.parse(raw);
  if (parsed.verdict !== "pass" && parsed.verdict !== "degrades") {
    throw new Error(`veredicto desconocido: ${parsed.verdict}`);
  }
  return {
    verdict: parsed.verdict,
    offending: Array.isArray(parsed.offending) ? parsed.offending : [],
    reason: String(parsed.reason || "").slice(0, 300),
  };
}

const now = () => new Date().toISOString().slice(0, 19).replace("T", " ");
const verdict = (status, reason, cases_seen = 0) => ({ status, reason, cases_seen, model: JUDGE_MODEL, at: now() });

// La interfaz que consume el gate. Nunca lanza: un problema acá no puede trabar el loop.
export async function checkRegression(db, row, { client, limit = 8 } = {}) {
  if (process.env.LESSON_REGRESSION === "off") return verdict("skipped", "capa desactivada por entorno");
  const cases = collectCases(db, row.scope, { limit });
  if (!cases.length) return verdict("skipped", `sin material reciente para el scope ${row.scope}`);
  try {
    const r = await judgeRegression(row.lesson, cases, { client });
    return verdict(r.verdict, r.reason || (r.verdict === "pass" ? "el juez no vio degradación" : "el juez vio degradación"), cases.length);
  } catch (e) {
    return verdict("error", e.message, cases.length);
  }
}

// Lo que el gate-pass de la madrugada frenó o no pudo verificar. Es el único camino sin
// humano mirando: cuando aprobás por WhatsApp el veredicto vuelve en esa misma respuesta,
// pero un auto-apply L0 bloqueado a las 6:30am no se lo cuenta a nadie.
export function recentRegressionAlerts(db, { hours = 24 } = {}) {
  try {
    const rows = db.prepare(
      `SELECT id, scope, lesson, regression_check FROM lessons
        WHERE regression_check IS NOT NULL
          AND updated_at >= datetime('now', ?)
        ORDER BY updated_at DESC LIMIT 10`
    ).all(`-${hours} hours`);
    return rows
      .map(r => {
        let v = null;
        try { v = JSON.parse(r.regression_check); } catch { return null; }
        if (v?.status !== "degrades" && v?.status !== "error") return null;
        return { id: r.id, scope: r.scope, lesson: r.lesson, status: v.status, reason: v.reason || "" };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function formatRegressionAlerts(rows = []) {
  if (!Array.isArray(rows) || !rows.length) return "";
  return rows.map(r => r.status === "degrades"
    ? `• Frené la lección #${r.id} (${r.scope}): "${r.lesson}" — ${r.reason}`
    : `• No pude verificar la lección #${r.id} (${r.scope}): "${r.lesson}" — ${r.reason}. Se aplicó igual.`
  ).join("\n");
}
