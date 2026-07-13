// Tea Table 🫖 — síntesis ejecutiva del estado del sistema (ver docs/WONDERLAND_IT.md)
import Anthropic from "@anthropic-ai/sdk";
import { query, parseArr } from "./db.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const AGENT_META = {
  "white-rabbit": { name: "White Rabbit", emoji: "🐰", role: "Médico de guardia · salud de infraestructura" },
  "cheshire": { name: "Cheshire", emoji: "😺", role: "Tester E2E · usabilidad y bugs" },
  "bandersnatch": { name: "Bandersnatch", emoji: "⚔️", role: "Chaos tester · saturación nocturna" },
  "mad-hatter": { name: "Mad Hatter", emoji: "🎩", role: "Performance del sistema · costos" },
  "jabberwocky": { name: "Jabberwocky", emoji: "⚡", role: "Fuzzer · inputs adversariales" },
  "dark-alice": { name: "Dark Alice", emoji: "🖤", role: "Jefa de operaciones · L2" },
  "tea-table": { name: "Tea Table", emoji: "🫖", role: "Síntesis semanal" },
};

async function liveChecks() {
  const checks = [];
  const timeout = () => AbortSignal.timeout(8000);

  try {
    const r = await fetch(`${process.env.ERP_URL || "http://localhost:3002"}/health`, { signal: timeout() });
    checks.push({ id: "erp", label: "ERP backend", ok: r.ok });
  } catch (e) {
    checks.push({ id: "erp", label: "ERP backend", ok: false, error: e.message });
  }

  try {
    const r = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` }, signal: timeout(),
    });
    const d = await r.json();
    const ids = (d.data || []).map(m => m.id);
    checks.push({ id: "groq-tts", label: "Groq TTS (orpheus vigente)", ok: ids.some(i => i.includes("orpheus")) });
    checks.push({ id: "groq-whisper", label: "Groq Whisper", ok: ids.some(i => i.includes("whisper")) });
  } catch (e) {
    checks.push({ id: "groq", label: "Groq API", ok: false, error: e.message });
  }

  checks.push({ id: "anthropic", label: "Claude API key", ok: !!process.env.ANTHROPIC_API_KEY });
  checks.push({ id: "google", label: "Google (Calendar/Gmail)", ok: !!process.env.GOOGLE_REFRESH_TOKEN });
  checks.push({ id: "dropbox", label: "Dropbox", ok: !!process.env.DROPBOX_ACCESS_TOKEN });
  checks.push({ id: "zoom", label: "Zoom", ok: !!(process.env.ZOOM_ACCOUNT_ID && process.env.ZOOM_CLIENT_ID) });
  checks.push({ id: "tavily", label: "Búsqueda web (Tavily)", ok: !!process.env.TAVILY_API_KEY });
  checks.push({ id: "whatsapp", label: "WhatsApp Cloud API", ok: !!(process.env.WA_PHONE_NUMBER_ID && process.env.WA_ACCESS_TOKEN) });
  return checks;
}

export async function gatherSystemData() {
  const { rows: lastRuns } = query(`
    SELECT r.* FROM agent_runs r
    INNER JOIN (SELECT agent, MAX(id) AS max_id FROM agent_runs GROUP BY agent) m
      ON r.agent = m.agent AND r.id = m.max_id
  `);
  const { rows: recentRuns } = query(
    `SELECT agent, result, created_at FROM agent_runs WHERE created_at >= datetime('now','-14 days') ORDER BY created_at`
  );
  const { rows: findings } = query(
    `SELECT * FROM agent_findings WHERE status IN ('open','escalated')
       OR created_at >= datetime('now','-7 days')
     ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'major' THEN 1 WHEN 'minor' THEN 2 ELSE 3 END, created_at DESC
     LIMIT 200`
  );
  const checks = await liveChecks();
  return {
    lastRuns: lastRuns.map(r => ({ ...r, actions_taken: parseArr(r.actions_taken) })),
    recentRuns,
    findings,
    checks,
    agents: AGENT_META,
    quarantine: process.env.QUARANTINE === "true",
    generatedAt: new Date().toISOString(),
  };
}

export async function runTeaTableReport({ notify = false } = {}) {
  const data = await gatherSystemData();
  const openFindings = data.findings.filter(f => ["open", "escalated"].includes(f.status));
  const failedChecks = data.checks.filter(c => !c.ok);

  const context = {
    checks: data.checks,
    lastRunPerAgent: data.lastRuns.map(r => ({ agent: r.agent, result: r.result, summary: r.summary, when: r.created_at })),
    runsLast14d: data.recentRuns.length,
    openFindings: openFindings.map(f => ({ agent: f.agent, severity: f.severity, category: f.category, detail: f.detail, since: f.created_at })),
    recentResolved: data.findings.filter(f => ["auto-fixed", "resolved"].includes(f.status)).map(f => ({ agent: f.agent, severity: f.severity, detail: f.detail, resolution: f.resolution })),
  };

  const sys = `Sos la TEA TABLE 🫖 del consejo de Wonderland — la síntesis ejecutiva del estado técnico de ALICE (ERP + Alicia brain de Hygge Holding, CEO Sebastián Bonilla).
Recibís el estado crudo del sistema y escribís un reporte ejecutivo EN ESPAÑOL, en markdown, con este esqueleto exacto:

# Estado del sistema · [fecha de hoy]

## Veredicto
[1-2 oraciones: ¿el sistema está sano, degradado o en riesgo? Directo.]

## Infraestructura
[Qué está arriba, qué está caído o sin configurar. Solo lo relevante.]

## Por agente
[Una línea por agente que haya corrido: qué encontró, qué reparó. Los que nunca corrieron: "sin actividad".]

## Riesgos y pendientes
[Lista priorizada. Si no hay nada, decilo.]

## Recomendación de la mesa
[1-3 acciones concretas para Sebastián, en orden de prioridad.]

Tono: directo, cálido, cero relleno. Máximo ~350 palabras.`;

  let report;
  try {
    const resp = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      system: sys,
      messages: [{ role: "user", content: `Estado crudo del sistema:\n${JSON.stringify(context, null, 2)}` }],
    });
    report = resp.content.find(b => b.type === "text")?.text || "Sin síntesis";
  } catch (e) {
    report = `# Estado del sistema\n\n(Claude no disponible: ${e.message})\n\nChecks fallando: ${failedChecks.map(c => c.label).join(", ") || "ninguno"}\nFindings abiertos: ${openFindings.length}`;
  }

  const result = failedChecks.length > 0 || openFindings.some(f => f.severity === "critical") ? "issues" : "ok";
  const summary = `${failedChecks.length} check(s) fallando · ${openFindings.length} finding(s) abiertos`;
  const { lastID: runId } = query(
    `INSERT INTO agent_runs (agent, finished_at, result, summary, actions_taken, report) VALUES ('tea-table', datetime('now'), ?, ?, ?, ?)`,
    [result, summary, JSON.stringify(data.checks), report]
  );

  if (notify && process.env.PHONE_sb && process.env.WA_ACCESS_TOKEN) {
    const head = report.split("\n").slice(0, 12).join("\n").slice(0, 900);
    await fetch(`https://graph.facebook.com/v19.0/${process.env.WA_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp", to: process.env.PHONE_sb, type: "text",
        text: { body: `🫖 *Tea Table semanal*\n\n${head}\n\nReporte completo en el Lab de ALICE.` },
      }),
    }).catch(e => console.error("Tea Table WA notify falló:", e.message));
  }

  console.log(`🫖 Tea Table run #${runId} · ${result} · ${summary}`);
  return { runId, result, summary, report, data };
}
