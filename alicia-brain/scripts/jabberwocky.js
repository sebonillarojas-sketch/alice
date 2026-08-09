// Jabberwocky ⚡ · fuzzer adversarial · STUB (esperando clon nocturno).
// Corre inputs adversariales SOLO en el clon, nunca en prod. Ver spec.
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
  console.log("⚡ Jabberwocky (stub) · en espera del clon nocturno");
  process.exit(0);
}
