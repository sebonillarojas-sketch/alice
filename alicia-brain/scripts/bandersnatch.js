// Bandersnatch ⚔️ · chaos tester · STUB (esperando clon nocturno).
// REGLA DE ORO: jamás contra prod con datos reales. Hasta que exista el clon,
// solo reporta 'en espera'. Ver docs/WONDERLAND_IT.md + spec.
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
  console.log("⚔️ Bandersnatch (stub) · en espera del clon nocturno");
  process.exit(0);
}
