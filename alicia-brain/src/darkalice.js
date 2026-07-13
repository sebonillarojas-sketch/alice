// Dark Alice 🖤 · jefa de operaciones de Wonderland (ver docs/WONDERLAND_IT.md)
// Recibe las escalaciones de todos los agentes y produce el estado de operaciones.
//
// ⚠️ NIVEL DE AUTORIDAD (respetado a propósito): hoy Dark Alice es L0 → OBSERVA,
// SINTETIZA y PROPONE. NO ejecuta L2 (rollback/restart/cuarentena) de forma autónoma.
// La ejecución con guardrails llega en la sesión de la supercomputadora (kill switch
// QUARANTINE, catálogo autorizado, confirmación humana para L3). Un agente que reinicia
// servicios solo a las 3am sin catálogo es más peligroso que cualquier bug.
import { query } from "./db.js";

const AGENTS = {
  "white-rabbit": "🐰 White Rabbit", "cheshire": "😺 Cheshire", "mad-hatter": "🎩 Mad Hatter",
  "tea-table": "🫖 Tea Table", "bandersnatch": "⚔️ Bandersnatch", "jabberwocky": "⚡ Jabberwocky",
};

// Propuestas que Dark Alice sugiere (texto) según la categoría del hallazgo — NO ejecuta
const PLAYBOOK = {
  "infra-publica": "Verificar DNS/certificado del dominio y el estado del servicio en Railway.",
  "erp-caido": "Revisar el último deploy de Netlify; considerar rollback a la versión previa.",
  "performance": "Revisar queries/latencia del endpoint; evaluar caché o índices.",
  "ux-login": "Revisar el flujo de auth (Supabase) y el manejo de errores en el front.",
  "js-errors": "Abrir la consola del bundle en prod; probablemente derivado de otro hallazgo.",
  "capacidad": "Evaluar limpieza/rotación de datos o subir el plan de almacenamiento.",
};

export async function runDarkAlice({ notify = true } = {}) {
  const quarantine = process.env.QUARANTINE === "true";
  const { rows: lastRuns } = query(`SELECT r.agent, r.result, r.summary, r.created_at FROM agent_runs r
    INNER JOIN (SELECT agent, MAX(id) mx FROM agent_runs GROUP BY agent) m ON r.agent = m.agent AND r.id = m.mx
    WHERE r.agent != 'dark-alice'`);
  const { rows: open } = query(`SELECT agent, severity, category, detail, created_at FROM agent_findings
    WHERE status IN ('open','escalated') ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'major' THEN 1 WHEN 'minor' THEN 2 ELSE 3 END, created_at DESC LIMIT 30`);

  const criticals = open.filter(f => f.severity === "critical");
  const majors = open.filter(f => f.severity === "major");
  const silent = Object.keys(AGENTS).filter(a => !lastRuns.some(r => r.agent === a));

  // Propuestas dedup por categoría (Dark Alice PROPONE, no ejecuta)
  const proposals = [...new Set(open.map(f => PLAYBOOK[f.category]).filter(Boolean))];

  // agent_runs.result solo acepta ok/issues/error (CHECK constraint)
  const result = criticals.length ? "error" : majors.length ? "issues" : "ok";
  const summary = `${open.length} hallazgo(s) abierto(s) (${criticals.length} críticos, ${majors.length} mayores) · ${lastRuns.length} agentes activos`;

  const report = [
    `🖤 *Dark Alice · Operaciones*`,
    quarantine ? "⚠️ MODO CUARENTENA activo (agentes solo observan)" : null,
    ``,
    `*Agentes activos*: ${lastRuns.map(r => `${AGENTS[r.agent] || r.agent} (${r.result})`).join(" · ") || "ninguno"}`,
    silent.length ? `*Sin correr aún*: ${silent.map(a => AGENTS[a]).join(", ")}` : null,
    ``,
    criticals.length ? `🔴 *Críticos*:\n${criticals.map(f => `• ${AGENTS[f.agent] || f.agent}: ${f.detail}`).join("\n")}` : `✅ Sin críticos abiertos`,
    majors.length ? `\n🟡 *Mayores*: ${majors.length}\n${majors.slice(0, 5).map(f => `• ${f.detail}`).join("\n")}` : null,
    proposals.length ? `\n*Propuestas de la mesa* (requieren tu ok — no ejecuto sola):\n${proposals.map(p => `→ ${p}`).join("\n")}` : null,
  ].filter(Boolean).join("\n");

  const { lastID: runId } = query(
    `INSERT INTO agent_runs (agent, finished_at, result, summary, actions_taken, report) VALUES ('dark-alice', datetime('now'), ?, ?, ?, ?)`,
    [result, summary, JSON.stringify({ proposals, silent, criticals: criticals.length, majors: majors.length }), report]
  );

  // WhatsApp SOLO si hay críticos o mayores (sin spam en días tranquilos)
  if (notify && (criticals.length || majors.length) && process.env.PHONE_sb) {
    const { sendWA } = await import("./wa.js");
    await sendWA(process.env.PHONE_sb, report.slice(0, 1400)).catch(e => console.error("Dark Alice WA:", e.message));
  }

  console.log(`🖤 Dark Alice · ${result} · ${summary}`);
  return { runId, result, summary, report };
}
