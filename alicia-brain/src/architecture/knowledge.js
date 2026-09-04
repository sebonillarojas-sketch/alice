import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const referencesDir = join(here, "../../skills/arquitecto-residencial-lima/references");
const cache = new Map();

function compactCriticChecklist(text) {
  const checks = String(text || "").match(/^## CHK-\d+[^\n]*/gm) || [];
  return [
    "# Checklist architecture headings (unverified advisory reference)",
    "Use these only as review axes. Do not claim compliance or reproduce a full checklist.",
    ...checks.map((line) => line.replace(/^##\s*/, "- ")),
  ].join("\n");
}

export function loadAdvisoryReferences(agentKey) {
  if (cache.has(agentKey)) return cache.get(agentKey);
  if (agentKey === "tweedledee") {
    const checklistPath = join(referencesDir, "checklist-validacion.md");
    const text = existsSync(checklistPath) ? compactCriticChecklist(readFileSync(checklistPath, "utf8")) : "";
    cache.set(agentKey, text);
    return text;
  }
  const files = agentKey === "tweedledum"
    ? ["tipologias-lima.md", "neufert.md", "checklist-validacion.md"]
    : [];
  const text = files.filter((name) => existsSync(join(referencesDir, name)))
    .map((name) => `# ${name} (unverified advisory reference)\n${readFileSync(join(referencesDir, name), "utf8")}`)
    .join("\n\n")
    .slice(0, 70000);
  cache.set(agentKey, text);
  return text;
}
