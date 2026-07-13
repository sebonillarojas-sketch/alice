// Mad Hatter 🎩 · performance del sistema y costos (ver docs/WONDERLAND_IT.md)
// L0 · solo observa y reporta. Mide latencia REAL de los endpoints (muestreo), tamaño
// de la DB y volumen de uso. NADA de números inventados (regla "cero data falsa"):
// si algo no se puede medir todavía (ej. costo de tokens sin la usage API), lo dice.
import { query } from "./db.js";
import { statSync } from "fs";

const SAMPLES = 3;
const ENDPOINTS = [
  { id: "aliceai-health", url: "https://aliceai.bam.pe/health" },
  { id: "erp-health", url: (process.env.ERP_URL || "https://zonal-perfection-production-744d.up.railway.app") + "/health" },
];

async function measure(url) {
  const times = [];
  for (let i = 0; i < SAMPLES; i++) {
    const t0 = Date.now();
    try { const r = await fetch(url, { signal: AbortSignal.timeout(10000) }); await r.text(); times.push(Date.now() - t0); }
    catch { times.push(null); }
  }
  const ok = times.filter(t => t !== null);
  if (!ok.length) return { ok: false };
  ok.sort((a, b) => a - b);
  return { ok: true, p50: ok[Math.floor(ok.length / 2)], max: ok[ok.length - 1], fails: SAMPLES - ok.length };
}

function count(table) {
  try { return query(`SELECT COUNT(*) c FROM ${table}`).rows[0].c; } catch { return null; }
}

export async function runMadHatter() {
  const latency = [];
  for (const e of ENDPOINTS) latency.push({ ...e, ...(await measure(e.url)) });

  let dbBytes = null;
  try { dbBytes = statSync(process.env.SQLITE_PATH || "./alicia.db").size; } catch {}

  const volume = {
    messages: count("messages"),
    memories: count("memories"),
    knowledge: count("knowledge"),
    agent_runs: count("agent_runs"),
    findings_abiertos: (() => { try { return query("SELECT COUNT(*) c FROM agent_findings WHERE status IN ('open','escalated')").rows[0].c; } catch { return null; } })(),
  };

  // Mensajes últimas 24h — proxy de actividad (base para proyección de costo cuando exista usage API)
  let msgs24h = null;
  try { msgs24h = query("SELECT COUNT(*) c FROM messages WHERE created_at >= datetime('now','-1 day')").rows[0].c; } catch {}

  const findings = [];
  for (const l of latency) {
    if (!l.ok) findings.push({ severity: "major", category: "performance", detail: `${l.id} no respondió en el muestreo` });
    else if (l.p50 > 3000) findings.push({ severity: "minor", category: "performance", detail: `${l.id} lento: p50 ${l.p50}ms (max ${l.max}ms)` });
  }
  if (dbBytes && dbBytes > 200 * 1024 * 1024) findings.push({ severity: "minor", category: "capacidad", detail: `DB ${(dbBytes / 1048576).toFixed(0)}MB — evaluar limpieza/rotación` });

  const result = findings.some(f => f.severity === "major") ? "issues" : findings.length ? "issues" : "ok";
  const dbMB = dbBytes ? (dbBytes / 1048576).toFixed(1) + "MB" : "?";
  const lat = latency.map(l => `${l.id}:${l.ok ? l.p50 + "ms" : "caído"}`).join(" · ");
  const summary = `Latencia ${lat} · DB ${dbMB} · ${msgs24h ?? "?"} msgs/24h · ${volume.messages ?? "?"} msgs total`;

  // Auto-cerrar hallazgos previos del sombrerero si ahora está sano (mismo criterio que el conejo)
  if (!findings.length) {
    query(`UPDATE agent_findings SET status = 'auto-fixed', resolved_by = 'mad-hatter', updated_at = datetime('now')
           WHERE agent = 'mad-hatter' AND status IN ('open','escalated')`);
  }

  const { lastID: runId } = query(
    `INSERT INTO agent_runs (agent, finished_at, result, summary, actions_taken) VALUES ('mad-hatter', datetime('now'), ?, ?, ?)`,
    [result, summary, JSON.stringify({ latency, dbBytes, volume, msgs24h, nota_costos: "El costo real de tokens requiere la Anthropic usage API (pendiente) — hoy solo se reporta volumen." })]
  );
  for (const f of findings) {
    query(`INSERT INTO agent_findings (agent, run_id, severity, category, detail, status) VALUES ('mad-hatter', ?, ?, ?, ?, 'open')`,
      [runId, f.severity, f.category, f.detail]);
  }
  console.log(`🎩 Mad Hatter · ${result} · ${summary}`);
  return { runId, result, summary, latency, volume };
}
