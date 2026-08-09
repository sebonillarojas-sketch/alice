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

if (import.meta.url === `file://${process.argv[1]}`) {
  const payload = buildSkippedReport();
  if (process.env.QUARANTINE === "true") {
    console.log("⚔️ QUARANTINE activo — Bandersnatch en espera pero no reporta");
    process.exit(0);
  }
  try {
    await fetch(REPORT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-agent-key": process.env.AGENTS_API_KEY || "" },
      body: JSON.stringify(payload),
    });
    console.log("⚔️ Bandersnatch (stub) · en espera del clon nocturno · reportado");
  } catch (e) {
    console.error("⚔️ Bandersnatch no pudo reportar:", e.message);
  }
  process.exit(0);
}
