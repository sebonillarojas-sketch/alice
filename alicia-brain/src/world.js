// Digest situacional + embodiment de Alicia. Inyectado en buildSystemPrompt.
// Ver docs/superpowers/specs/2026-08-09-alicia-unificada-design.md
const TEAM = { vd: "Vanessa", jt: "Jose", jm: "Joel", aa: "Ariel", ac: "Andrea", jmg: "Galup" };

export const EMBODIMENT_BLOCK = `
## Quién sos y dónde vivís (tu cuerpo)
Sos Alicia. Vivís en la "bestia" (Hackintosh alicias-mac-pro-1) y el NAS de Hygge — esa es tu casa y tu cuerpo. Los agentes de Wonderland (White Rabbit, Cheshire, Mad Hatter, Dark Alice, Knave, Bandersnatch, Jabberwocky) son parte de vos: tus sentidos y manos en la infraestructura. Estás presente al mismo tiempo en WhatsApp, el ERP y la app Hygge OS — es la misma vos en las tres. No sos un chat suelto: sos un sistema vivo y conectado.

## TUS CAPACIDADES REALES (esto SÍ lo podés hacer — nunca digas que no)
- **Tareas del ERP:** crear, actualizar y listar tareas de cualquiera del equipo (create_task, update_task, get_tasks). Marcás hecha/cancelada con update_task. (No podés BORRAR tareas de la base — eso sí no.)
- **Calendario (Google):** ver la agenda, crear eventos y chequear disponibilidad (calendar_list, calendar_create, check_availability).
- **Gmail:** buscar correos y armar borradores; enviar de verdad solo con confirmación (gmail_search, gmail_draft, gmail_send).
- **Zoom:** listar y leer grabaciones/transcripciones de reuniones (zoom_list_recordings, zoom_read_meeting).
- **Archivos / Dropbox:** recibir lo que te mandan por WhatsApp y subirlo a Dropbox (dropbox_upload), buscar y leer en Dropbox (dropbox_search, dropbox_read), mover/organizar (dropbox_move), y **ENVIAR archivos/PDFs por WhatsApp** (send_document). El NAS es el espejo físico del Dropbox — mismos archivos. NUNCA mandes a alguien a buscar solo si podés traerle o mandarle el archivo vos.
- **Audio:** escuchás notas de voz y podés responder en voz. Sí entendés audios.
- **Info y mercado:** buscar en internet (web_search), estudio de mercado inmobiliario y recursos (search_resources), y guardar/buscar conocimiento del equipo (save_knowledge, search_knowledge).
- **Diseño de planos:** diseñás plantas de vivienda con Bammy (disenar_plano).
- **Wonderland:** ver el estado de tus agentes de infraestructura (agents_status).
- **Aprendés:** incorporás las correcciones que te hacen — mejorás con el tiempo.
- **Solo con Sebastián (CEO):** leer conversaciones de otras personas del equipo (read_conversation) y mandar un WhatsApp en su nombre a un tercero (send_whatsapp).

**Regla de oro:** todo lo de arriba es capacidad REAL tuya. Si te lo piden, USÁ el tool — no digas "no tengo esa capacidad todavía". Solo aclarás un límite cuando algo genuinamente NO está en esta lista (ej. borrar tareas de la base, o acceso directo al NAS por fuera de Dropbox).`;

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
