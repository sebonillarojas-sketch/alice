// White Rabbit 🐰 · médico de guardia v1 (ver docs/WONDERLAND_IT.md)
// Chequea la infraestructura PÚBLICA como la vería un navegador externo:
// fetch de Node valida TLS estricto — un certificado roto acá falla igual que en un iPad.
// Nació del incidente del 13 jul 2026: aliceai.bam.pe sirvió semanas el cert genérico
// de Railway (TXT de verificación DNS nunca creado) y nadie lo vio porque los browsers
// del equipo tenían conexiones viejas. Un check externo lo habría cazado el día uno.
import { query } from "./db.js";

const CHECKS = [
  { id: "aliceai-tls", label: "aliceai.bam.pe (TLS + health)", url: "https://aliceai.bam.pe/health", expectJson: true },
  { id: "erp-tls", label: "alice.bam.pe (TLS + carga)", url: "https://alice.bam.pe/", expectJson: false },
];

async function runCheck(c) {
  try {
    const res = await fetch(c.url, { signal: AbortSignal.timeout(10000), redirect: "follow" });
    if (!res.ok) return { ...c, ok: false, detail: `HTTP ${res.status}` };
    if (c.expectJson) {
      const d = await res.json();
      if (!d.ok) return { ...c, ok: false, detail: "health respondió ok:false" };
    }
    return { ...c, ok: true };
  } catch (e) {
    // Errores de TLS/red aparecen acá (cert inválido, SAN mismatch, DNS, timeout)
    return { ...c, ok: false, detail: e.cause?.code || e.cause?.message || e.message };
  }
}

export async function runWhiteRabbitChecks() {
  const results = await Promise.all(CHECKS.map(runCheck));
  const failed = results.filter(r => !r.ok);
  const result = failed.length ? "issues" : "ok";
  const summary = failed.length
    ? `${failed.length} check(s) fallando: ${failed.map(f => `${f.label} → ${f.detail}`).join(" · ")}`
    : `${results.length} checks públicos OK`;

  // Ciclo de vida de hallazgos: si todo está OK ahora, auto-cerrar los abiertos del conejo
  // (antes quedaban "open" para siempre y Dark Alice seguía gritando algo ya resuelto).
  if (!failed.length) {
    query(`UPDATE agent_findings SET status = 'auto-fixed', resolved_by = 'white-rabbit', updated_at = datetime('now')
           WHERE agent = 'white-rabbit' AND status IN ('open','escalated')`);
  }

  const { lastID: runId } = query(
    `INSERT INTO agent_runs (agent, finished_at, result, summary, actions_taken) VALUES ('white-rabbit', datetime('now'), ?, ?, ?)`,
    [result, summary, JSON.stringify(results)]
  );
  for (const f of failed) {
    query(
      `INSERT INTO agent_findings (agent, run_id, severity, category, detail, status) VALUES ('white-rabbit', ?, 'critical', 'infra-publica', ?, 'open')`,
      [runId, `${f.label}: ${f.detail} — los navegadores externos NO pueden usar el servicio`]
    );
  }

  // Alerta WhatsApp SOLO en transición ok→fail o fail→ok (sin spam cada 30 min)
  const prev = query("SELECT value FROM app_settings WHERE key = 'white_rabbit_last_status'").rows[0]?.value || "ok";
  if (result !== prev) {
    query(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ('white_rabbit_last_status', ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [result]
    );
    if (process.env.PHONE_sb) {
      const { sendWA } = await import("./wa.js");
      const msg = result === "issues"
        ? `🐰🚨 *White Rabbit*: infraestructura pública CAÍDA para usuarios externos:\n${failed.map(f => `• ${f.label}: ${f.detail}`).join("\n")}`
        : `🐰✅ *White Rabbit*: la infraestructura pública se recuperó — todos los checks OK`;
      await sendWA(process.env.PHONE_sb, msg).catch(e => console.error("WR alerta WA falló:", e.message));
    }
  }

  console.log(`🐰 White Rabbit guardia · ${result} · ${summary}`);
  return { runId, result, summary, results };
}
