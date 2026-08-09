// Knave 🃏 · agente de seguridad · L0 (SOLO observa, NUNCA parcha ni ejecuta).
// Corre en la bestia (disparado por bestia-runner.js). Checks no-destructivos contra
// prod; reporta a Railway con x-agent-key. Ver docs/WONDERLAND_IT.md + spec.
import dotenv from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkSecurityHeaders, checkCorsOpen, checkAuthRejected } from "../src/knave-checks.js";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "..", ".env") });

const REPORT_URL = "https://alice-production-462e.up.railway.app/api/agents/report";
const DEFAULT_TARGETS = {
  base: "https://aliceai.bam.pe",
  protectedPath: "/api/tasks", // ruta que exige JWT
};

function headersToObject(resHeaders) {
  const o = {};
  if (resHeaders && typeof resHeaders.forEach === "function") {
    resHeaders.forEach((v, k) => { o[k.toLowerCase()] = v; });
  }
  return o;
}

async function defaultReporter(payload) {
  return fetch(REPORT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-agent-key": process.env.AGENTS_API_KEY || "" },
    body: JSON.stringify(payload),
  });
}

export async function runKnave({ fetchImpl = globalThis.fetch, reporter = defaultReporter, targets = DEFAULT_TARGETS } = {}) {
  const findings = [];
  const actions = [];
  const note = (ok, label, detail = "") => actions.push({ check: label, ok, detail });

  // 1) Headers de seguridad
  try {
    const r = await fetchImpl(targets.base + "/health", { signal: AbortSignal.timeout(10000) });
    const hf = checkSecurityHeaders(headersToObject(r.headers));
    findings.push(...hf);
    note(hf.length === 0, "Headers de seguridad", hf.length ? `faltan ${hf.length}` : "");
  } catch (e) { note(false, "Headers de seguridad", e.message); }

  // 2) CORS abierto (preflight con Origin hostil)
  try {
    const r = await fetchImpl(targets.base + "/health", {
      method: "OPTIONS",
      headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "GET" },
      signal: AbortSignal.timeout(10000),
    });
    const acao = r.headers?.get ? r.headers.get("access-control-allow-origin") : null;
    const cf = checkCorsOpen(acao);
    if (cf) findings.push(cf);
    note(!cf, "CORS", cf ? "abierto" : "");
  } catch (e) { note(false, "CORS", e.message); }

  // 3) Auth gate: ruta protegida sin credenciales debe rechazar
  try {
    const r = await fetchImpl(targets.base + targets.protectedPath, { signal: AbortSignal.timeout(10000) });
    const af = checkAuthRejected(r.status);
    if (af) findings.push(af);
    note(!af, "Auth gate", af ? `no rechaza (HTTP ${r.status})` : "");
  } catch (e) { note(false, "Auth gate", e.message); }

  const result = findings.length ? "issues" : "ok";
  const summary = findings.length
    ? `${findings.length} hallazgo(s) de seguridad: ${[...new Set(findings.map(f => f.category))].join(", ")}`
    : "Checks de seguridad OK";
  const payload = { agent: "knave", result, summary, actions_taken: actions, findings };

  if (process.env.QUARANTINE === "true") {
    console.log("🃏 QUARANTINE activo — Knave observa pero no reporta");
    return { result, findings, summary, reported: false };
  }
  try { await reporter(payload); } catch (e) { console.error("🃏 Knave no pudo reportar:", e.message); }
  return { result, findings, summary, reported: true };
}

// Entry point cuando se corre directo (bestia-runner lo invoca como subproceso)
if (import.meta.url === `file://${process.argv[1]}`) {
  runKnave().then(r => { console.log(`🃏 Knave · ${r.result} · ${r.summary}`); process.exit(0); })
    .catch(e => { console.error("🃏 Knave crash:", e.message); process.exit(1); });
}
