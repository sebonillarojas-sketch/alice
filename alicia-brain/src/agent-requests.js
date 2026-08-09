// Cola de corridas on-demand. Alicia encola pedidos para los agentes de la bestia
// (Cheshire/Knave); el reloj único los drena en su próximo tick. Los in-process
// (White Rabbit/Tea Table/Dark Alice) NO pasan por acá — se corren sincrónicos.
// Ver spec run-agent. Helpers puros sobre `db` (testeables con :memory:).

// Cómo se corre cada agente. inline = función en el brain; queue = script en la bestia.
export const AGENT_RUN = {
  "white-rabbit": { mode: "inline", run: "white-rabbit" },
  "tea-table":    { mode: "inline", run: "tea-table" },
  "dark-alice":   { mode: "inline", run: "dark-alice" },
  "cheshire":     { mode: "queue", script: "cheshire.js", args: [] },
  "knave":        { mode: "queue", script: "knave.js", args: [] },
};

export function classifyAgentRun(agent) {
  return AGENT_RUN[String(agent || "").toLowerCase().trim()] || null;
}

export function enqueueRequest(db, agent, requestedBy = null) {
  const info = db.prepare(
    "INSERT INTO agent_run_requests (agent, requested_by, status) VALUES (?, ?, 'pending')"
  ).run(agent, requestedBy);
  return { id: Number(info.lastInsertRowid) };
}

// Claim-on-read: devuelve los pendientes y los marca 'running' en la misma pasada,
// para que el siguiente tick del reloj no los vuelva a disparar.
// ⚠️ NO metas un `await` acá dentro: node:sqlite es síncrono y esta función corre
// atómica en el event loop; un await abriría una ventana para doble-claim entre ticks.
export function claimPending(db) {
  const rows = db.prepare(
    "SELECT id, agent FROM agent_run_requests WHERE status = 'pending' ORDER BY created_at LIMIT 20"
  ).all();
  const claim = db.prepare("UPDATE agent_run_requests SET status = 'running', updated_at = datetime('now') WHERE id = ?");
  for (const r of rows) claim.run(r.id);
  return rows;
}

export function markRequest(db, id, status, note = null) {
  db.prepare(
    "UPDATE agent_run_requests SET status = ?, note = COALESCE(?, note), updated_at = datetime('now') WHERE id = ?"
  ).run(status, note, id);
  return { id, status };
}
