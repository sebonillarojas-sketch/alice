// Bandersnatch ⚔️ · chaos tester · STUB (esperando clon nocturno).
// REGLA DE ORO: jamás contra prod con datos reales. Hasta que exista el clon,
// solo reporta 'en espera'. Se programa y corre a diario para que el cockpit
// lo muestre "en espera" (en vez de no aparecer). Ver docs/WONDERLAND_IT.md + spec.
import dotenv from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "..", ".env") });

const REPORT_URL = "https://alice-production-462e.up.railway.app/api/agents/report";

export function buildSkippedReport() {
  return {
    agent: "bandersnatch",
    result: "ok",
    summary: "En espera — esperando clon nocturno; no corre contra prod",
    actions_taken: [],
    findings: [],
  };
}

// Doble candado anti-prod: Bandersnatch SOLO puede apuntar al clon nocturno
// (:3099). Nunca corre chaos testing contra el brain real. Ver spec.
export function isCloneTarget(target) {
  return target === "http://localhost:3099";
}

export async function runChaos(target, { fetchImpl = globalThis.fetch } = {}) {
  if (!isCloneTarget(target)) throw new Error("Bandersnatch SOLO corre contra el clon (:3099), nunca prod");
  const actions = [];
  const findings = [];
  // Rampa de carga contra /health (endpoint barato) — mide a qué nivel se degrada.
  for (const mult of [1, 5, 20, 50]) {
    const t0 = Date.now();
    const reqs = Array.from({ length: mult }, () =>
      fetchImpl(`${target}/health`, { signal: AbortSignal.timeout(10000) }).then(r => r.ok).catch(() => false)
    );
    const oks = (await Promise.all(reqs)).filter(Boolean).length;
    const ms = Date.now() - t0;
    actions.push({ check: `carga x${mult}`, ok: oks === mult, detail: `${oks}/${mult} ok en ${ms}ms` });
    if (oks < mult) {
      findings.push({
        severity: "major",
        category: "chaos-degradacion",
        detail: `A carga x${mult} el brain degradó: ${oks}/${mult} respuestas ok (${ms}ms)`,
      });
    }
  }
  return {
    agent: "bandersnatch",
    result: findings.length ? "issues" : "ok",
    summary: `chaos contra clon: ${actions.map(a => a.check).join(", ")}`,
    actions_taken: actions,
    findings,
  };
}

async function reportToProd(payload) {
  if (process.env.QUARANTINE === "true") {
    console.log("⚔️ QUARANTINE activo — Bandersnatch no reporta");
    return;
  }
  try {
    await fetch(REPORT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-agent-key": process.env.AGENTS_API_KEY || "" },
      body: JSON.stringify(payload),
    });
    console.log("⚔️ Bandersnatch reportó a prod");
  } catch (e) {
    console.error("⚔️ Bandersnatch no pudo reportar:", e.message);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const target = process.argv[2];
  if (target) {
    try {
      const payload = await runChaos(target);
      console.log(`⚔️ Bandersnatch corrió chaos contra ${target}`);
      await reportToProd(payload);
    } catch (e) {
      console.error("⚔️ Bandersnatch abortó:", e.message);
      process.exit(1);
    }
  } else {
    const payload = buildSkippedReport();
    await reportToProd(payload);
    console.log("⚔️ Bandersnatch (stub) · en espera del clon nocturno · reportado");
  }
  process.exit(0);
}
