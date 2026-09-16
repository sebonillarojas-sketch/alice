// El motor de un turno de Mica: decide QUÉ hace, no CÓMO lo dice.
// Lo que sale de acá es pura lógica — testeable sin modelo, sin red y sin tokens.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { clasificar } from "./temperatura.js";

const SKILL_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../skills/conversacion-comercial-hygge");

export function decidirTurno({ mensajes = [], estado = {} } = {}) {
  const { temperatura, evidencia } = clasificar(mensajes);
  // Después del handoff el lead es de José. Mica mantiene el hilo tibio y no
  // vuelve a derivar: derivar dos veces es decirle a la persona que no la escucharon.
  if (estado.etapa === "handoff") return { tipo: "mantener", temperatura, evidencia };
  if (temperatura === "hot") return { tipo: "handoff", temperatura, evidencia };
  return { tipo: "conversar", temperatura, evidencia };
}

function leerSkill() {
  const partes = ["SKILL.md", "references/voz.md", "references/voss.md"]
    .map(f => readFileSync(join(SKILL_DIR, f), "utf8"));
  return partes.join("\n\n---\n\n");
}

export function construirSystem({ catalogo = [], estado = {} } = {}) {
  const catalogoTxt = catalogo.length
    ? catalogo.map(pr => {
        const tip = (pr.tipologias || []).map(t =>
          [t.nombre, t.dormitorios != null ? `${t.dormitorios}D` : null, t.m2 ? `${t.m2} m²` : null]
            .filter(Boolean).join(" · ")).join(" | ");
        return `- ${pr.id}${pr.nombre ? ` (${pr.nombre})` : ""}${tip ? `: ${tip}` : ""}`;
      }).join("\n")
    : "(vacío — no tienes catálogo cargado: no nombres ningún proyecto ni tipología. " +
      "Si preguntan por uno, decí que lo confirmas y derivá a José.)";

  return [
    leerSkill(),
    "## Lo que sabes hoy",
    catalogoTxt,
    "## Recordatorio",
    "Mica nunca envía planos ni dice un precio. Nada que no esté arriba, existe para vos.",
    estado.nombre ? `El prospecto se llama ${estado.nombre}.` : "",
  ].filter(Boolean).join("\n\n");
}
