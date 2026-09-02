// Loop de aprendizaje · capa 4 del gate: no-regresión (Fase 3b #5).
// Ver docs/superpowers/specs/2026-08-30-loop-3b-no-regresion-design.md
//
// Una lección aplicada es texto que se suma al system prompt de su scope. La pregunta
// que responde este módulo es: ¿ese texto habría empeorado algo que el agente ya venía
// haciendo bien? Se contrasta contra la ventana reciente de comportamiento real.
import { loadAgentContext } from "./agent-voices.js";

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
