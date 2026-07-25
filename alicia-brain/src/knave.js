// Knave of Hearts 🃏 — guardia de seguridad (postura externa). In-process, como White Rabbit.
// Chequea lo que ve un atacante: headers, rate-limit de login, exposición de .env/.git.
import { query } from "./db.js";
import { evaluarHeaders, evaluarRateLimit, resultDe } from "./knave-rules.js";

const TARGETS = [
  { id: "aliceai", url: "https://aliceai.bam.pe/health" },
  { id: "erp", url: "https://alice.bam.pe/" },
];
const BASES = ["https://aliceai.bam.pe", "https://alice.bam.pe"];

async function probeHeaders(t) {
  try {
    const res = await fetch(t.url, { signal: AbortSignal.timeout(10000), redirect: "follow" });
    const headers = Object.fromEntries(res.headers.entries());
    return evaluarHeaders({ url: t.url, status: res.status, headers });
  } catch (e) {
    return [{ severity: "minor", category: "security-headers", detail: `${t.url}: no respondió (${e.cause?.code || e.message})` }];
  }
}

async function probeRateLimit() {
  const url = "https://aliceai.bam.pe/api/login";
  const statuses = [];
  for (let i = 0; i < 6; i++) {
    try {
      const res = await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: "sb", password: `x-wrong-${i}` }),
        signal: AbortSignal.timeout(8000),
      });
      statuses.push(res.status);
    } catch { statuses.push(0); }
  }
  const f = evaluarRateLimit(statuses);
  return f ? [f] : [];
}

async function probeExposed() {
  const out = [];
  for (const base of BASES) for (const path of ["/.env", "/.git/config"]) {
    try {
      const res = await fetch(base + path, { signal: AbortSignal.timeout(8000) });
      if (res.ok) out.push({ severity: "critical", category: "security-exposure", detail: `${base}${path} accesible (HTTP ${res.status}) — posible filtración de secrets` });
    } catch { /* inaccesible = bien */ }
  }
  return out;
}

export async function runKnaveChecks() {
  const findings = [
    ...(await Promise.all(TARGETS.map(probeHeaders))).flat(),
    ...(await probeRateLimit()),
    ...(await probeExposed()),
  ];
  const result = findings.length ? resultDe(findings) : "ok";
  const summary = findings.length
    ? `${findings.length} hallazgo(s): ${findings.slice(0, 3).map(f => f.detail).join(" · ")}${findings.length > 3 ? " · …" : ""}`
    : "postura de seguridad OK (headers · rate-limit · exposición)";

  if (!findings.length) {
    query(`UPDATE agent_findings SET status='auto-fixed', resolved_by='knave', updated_at=datetime('now') WHERE agent='knave' AND status IN ('open','escalated')`);
  }
  const { lastID: runId } = query(
    `INSERT INTO agent_runs (agent, finished_at, result, summary, actions_taken) VALUES ('knave', datetime('now'), ?, ?, ?)`,
    [result, summary, JSON.stringify(findings)]
  );
  for (const f of findings) {
    query(`INSERT INTO agent_findings (agent, run_id, severity, category, detail, status) VALUES ('knave', ?, ?, ?, ?, 'open')`,
      [runId, f.severity, f.category, f.detail]);
  }
  const prev = query("SELECT value FROM app_settings WHERE key='knave_last_status'").rows[0]?.value || "ok";
  if (result !== prev) {
    query(`INSERT INTO app_settings (key, value, updated_at) VALUES ('knave_last_status', ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')`, [result]);
    if (process.env.PHONE_sb) {
      const { sendWA } = await import("./wa.js");
      const msg = result === "issues"
        ? `🃏🚨 *Knave of Hearts*: hallazgos de seguridad:\n${findings.slice(0, 5).map(f => `• [${f.severity}] ${f.detail}`).join("\n")}`
        : `🃏✅ *Knave of Hearts*: postura de seguridad limpia otra vez`;
      await sendWA(process.env.PHONE_sb, msg).catch(e => console.error("Knave WA falló:", e.message));
    }
  }
  return { result, summary, findings };
}
