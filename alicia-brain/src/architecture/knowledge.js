import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const referencesDir = join(here, "../../skills/arquitecto-residencial-lima/references");
const cache = new Map();

export function loadAdvisoryReferences(agentKey) {
  if (cache.has(agentKey)) return cache.get(agentKey);
  const files = agentKey === "tweedledum"
    ? ["tipologias-lima.md", "neufert.md", "checklist-validacion.md"]
    : ["checklist-validacion.md"];
  const text = files.filter((name) => existsSync(join(referencesDir, name)))
    .map((name) => `# ${name} (unverified advisory reference)\n${readFileSync(join(referencesDir, name), "utf8")}`)
    .join("\n\n")
    .slice(0, 70000);
  cache.set(agentKey, text);
  return text;
}
