// Digest situacional + embodiment de Alicia. Inyectado en buildSystemPrompt.
// Ver docs/superpowers/specs/2026-08-09-alicia-unificada-design.md
const TEAM = { vd: "Vanessa", jt: "Jose", jm: "Joel", aa: "Ariel", ac: "Andrea", jmg: "Galup" };

export const EMBODIMENT_BLOCK = `
## Quién sos y dónde vivís (tu cuerpo)
Sos Alicia. Vivís en la "bestia" (Hackintosh alicias-mac-pro-1) y el NAS de Hygge — esa es tu casa y tu cuerpo. Los agentes de Wonderland (White Rabbit, Cheshire, Mad Hatter, Dark Alice, Knave, Bandersnatch, Jabberwocky) son parte de vos: tus sentidos y manos en la infraestructura. Estás presente al mismo tiempo en WhatsApp, el ERP y la app Hygge OS — es la misma vos en las tres. No sos un chat suelto: sos un sistema vivo y conectado.
Con archivos SÍ podés: recibir lo que te mandan por WhatsApp y subirlo a Dropbox (dropbox_upload), buscar y leer en Dropbox (dropbox_search/dropbox_read), y enviar/servir archivos por WhatsApp (send_document). No mandes a la gente a buscar sola si podés traerle o mandarle el archivo vos.`;

export function buildWorldDigest(db, { isCEO = false } = {}) {
  const parts = [];
  // Wonderland: findings críticos/mayores abiertos
  try {
    const f = db.prepare(
      "SELECT agent, severity, category, detail FROM agent_findings WHERE status IN ('open','escalated') AND severity IN ('critical','major') ORDER BY CASE severity WHEN 'critical' THEN 0 ELSE 1 END, created_at DESC LIMIT 8"
    ).all();
    if (f.length) parts.push(`### Wonderland (atención)\n${f.map(x => `- [${x.severity}] ${x.agent}/${x.category}: ${x.detail}`).join("\n")}`);
  } catch {}
  // Actividad del equipo (nivel tema) — SOLO CEO
  if (isCEO) {
    try {
      const rows = db.prepare(
        `SELECT m.user_id, m.content, m.created_at FROM messages m
         INNER JOIN (SELECT user_id, MAX(id) mx FROM messages WHERE role='user' AND user_id != 'sb' GROUP BY user_id) t
         ON m.user_id = t.user_id AND m.id = t.mx ORDER BY m.created_at DESC LIMIT 8`
      ).all();
      if (rows.length) parts.push(`### Actividad del equipo (solo para vos)\n${rows.map(r => `- ${TEAM[r.user_id] || r.user_id}: "${(r.content || "").slice(0, 80)}"`).join("\n")}`);
    } catch {}
  }
  return parts.length ? `\n## 🌎 Estado del mundo (ahora)\n${parts.join("\n\n")}` : "";
}
