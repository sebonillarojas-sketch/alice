// Jabberwocky ⚡ · fuzzer adversarial · STUB (esperando clon nocturno).
// Corre inputs adversariales SOLO en el clon, nunca en prod. Se programa y
// corre a diario para que el cockpit lo muestre "en espera" (en vez de no
// aparecer). Ver spec.
import dotenv from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "..", ".env") });

const REPORT_URL = "https://alice-production-462e.up.railway.app/api/agents/report";

export function buildSkippedReport() {
  return {
    agent: "jabberwocky",
    result: "ok",
    summary: "En espera — esperando clon nocturno; no corre contra prod",
    actions_taken: [],
    findings: [],
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const payload = buildSkippedReport();
  if (process.env.QUARANTINE === "true") {
    console.log("⚡ QUARANTINE activo — Jabberwocky en espera pero no reporta");
    process.exit(0);
  }
  try {
    await fetch(REPORT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-agent-key": process.env.AGENTS_API_KEY || "" },
      body: JSON.stringify(payload),
    });
    console.log("⚡ Jabberwocky (stub) · en espera del clon nocturno · reportado");
  } catch (e) {
    console.error("⚡ Jabberwocky no pudo reportar:", e.message);
  }
  process.exit(0);
}
