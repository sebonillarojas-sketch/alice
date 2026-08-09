// Mappers PUROS: convierten datos de una señal en args para proposeLesson (o null/[]).
// Sin DB ni red — testeables. Ver spec §2 (Captura).

export function lessonFromCorrection(corr = {}) {
  const notas = (corr.notas || "").trim();
  if (!notas) return null;
  return { scope: "agent:bammy", source: "correction", trigger: `corrección unidad ${corr.unidad || "?"}`, lesson: notas, risk_level: "L1" };
}

export function lessonFromFinding(finding = {}) {
  if (finding.status !== "wont-fix") return null;
  return {
    scope: `agent:${finding.agent || "unknown"}`,
    source: "correction",
    trigger: `finding descartado: ${finding.category || ""}`.trim(),
    lesson: `No reportar como problema: ${finding.detail || finding.category || "(sin detalle)"}`,
    risk_level: "L1",
  };
}

export function lessonsFromTeaTable(reportText = "") {
  const lines = String(reportText).split("\n");
  const out = [];
  let inSection = false;
  for (const l of lines) {
    if (/^##\s+Lecciones/i.test(l)) { inSection = true; continue; }
    if (/^##\s+/.test(l)) { inSection = false; continue; }
    if (inSection) {
      const m = l.match(/^\s*[-*•]\s+(.*\S)/);
      if (m) out.push({ scope: "global", source: "teatable", trigger: "síntesis semanal", lesson: m[1].trim(), risk_level: "L1" });
    }
  }
  return out;
}
