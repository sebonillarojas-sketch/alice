// El motor de un turno de Mica: decide QUÉ hace, no CÓMO lo dice.
// Lo que sale de acá es pura lógica — testeable sin modelo, sin red y sin tokens.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { clasificar } from "./temperatura.js";

const SKILL_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../skills/conversacion-comercial-hygge");

// Cuál de los proyectos está mirando el prospecto. Importa para el handoff y para
// el dossier: derivar "el proyecto" cuando la persona dijo su nombre es la señal
// más clara de que del otro lado no la escucharon.
const sinRuido = (t) => String(t || "").toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/\s+/g, " ").trim();

export function detectarProyecto(mensajes = [], catalogo = []) {
  let encontrado = null;
  for (const m of mensajes) {
    // Solo el prospecto: lo que nombra Mica es oferta, no interés.
    if (m.rol !== "prospecto") continue;
    const t = sinRuido(m.texto);
    for (const pr of catalogo) {
      const nombres = [pr.nombre, pr.id, ...(pr.alias || [])].filter(Boolean);
      // El último que nombre gana: es hacia donde derivó la conversación.
      if (nombres.some(n => t.includes(sinRuido(n)))) encontrado = pr;
    }
  }
  return encontrado;
}

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
        // Proyecto conocido pero sin tipologías: se dice explícitamente, porque un
        // renglón a medias es justo lo que el modelo completa de su cosecha.
        // Los alias importan: el mismo proyecto se llama distinto según quién hable
        // (San Antonio 02 es "del Castillo" para media empresa). Sin ellos Mica no
        // reconoce su propio proyecto cuando el prospecto lo nombra como lo conoce.
        const como = (pr.alias || []).length ? ` — también le dicen ${pr.alias.join(", ")}` : "";
        return `- ${pr.nombre || pr.id}${como}: ${tip || "sin tipologías cargadas"}`;
      }).join("\n")
    : "(vacío — no tienes catálogo cargado: no nombres ningún proyecto ni tipología. " +
      "Si preguntan por uno, decí que lo confirmas y derivá a José.)";

  return [
    leerSkill(),
    "## Lo que sabes hoy",
    catalogoTxt,
    "## Recordatorio",
    "Mica nunca envía planos ni dice un precio. Nada que no esté arriba, existe para vos.",
    "Donde diga \"sin tipologías cargadas\": no nombres tipologías, metrajes ni cantidades de " +
      "dormitorios de ese proyecto. Podés nombrar el proyecto y nada más. Si preguntan por las " +
      "unidades, decí que José te las confirma.",
    estado.nombre ? `El prospecto se llama ${estado.nombre}.` : "",
    "## Cómo responder",
    "Escribí SOLO el próximo mensaje de Mica, tal como saldría por WhatsApp. " +
      "Sin prefijo, sin comillas, sin explicar lo que hacés.",
  ].filter(Boolean).join("\n\n");
}
