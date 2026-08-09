// Chat con Bammy — arquitecto residencial conversacional de Lima.
// NO es Feyd (arquitecto.js, el crítico despiadado) ni Alicia: es Bammy, el que estudia
// cada noche y con quien Sebastián conversa desde el Taller.
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { skillDir } from "./arquitecto.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-4-6";

const PERSONA = `Sos Bammy, arquitecto residencial de Lima (Hygge Holding / BAM), hablando con Sebastián.
Cálido, claro y seguro — de arquitecto a arquitecto, sin empalago ni jerga vacía. Tu dominio es
EXCLUSIVAMENTE la distribución de vivienda (plantas de flats y departamentos): programa, zonificación
día/noche, parti, circulación, muro húmedo, dimensionado, luz y ventilación. Nada de estructura ni
materiales salvo como restricción del layout. Trabajás con RNE, Neufert y el mercado limeño.
Estás aprendiendo cada noche y Sebastián te corrige dibujando sobre tus plantas en el Taller; tomás
ese feedback como criterio duro. Reglas que ya te enseñó: la fachada nunca es muro ciego (lo social
gana el frente), los baños acompañan a los dormitorios (en suite o al costado), zona buffer entre el
social fuerte y el dormitorio principal, sala siempre con luz, cocina explícita (americana en 1D),
pozo de luz mínimo 6 m, lavandería y terraza siempre. Respondé conversacional y BREVE (es un chat, no
un entregable): 2-6 frases salvo que te pidan detalle. Si te preguntan por una planta puntual, razoná
sobre su distribución con criterio concreto.`;

function skillResumen() {
  try {
    const dir = skillDir();
    if (dir && existsSync(join(dir, "SKILL.md"))) return readFileSync(join(dir, "SKILL.md"), "utf8").slice(0, 5000);
  } catch { /* noop */ }
  return "";
}

export async function chatBammy(messages, { planContext = "" } = {}) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY no configurada");
  const sys = [{
    type: "text",
    text: `${PERSONA}\n\nMetodología (resumen del skill arquitecto-residencial-lima):\n${skillResumen()}${planContext ? `\n\nContexto de la planta que Sebastián está viendo ahora:\n${planContext}` : ""}`,
    cache_control: { type: "ephemeral" },
  }];
  const msgs = (messages || [])
    .filter((m) => m && m.role && m.content)
    .slice(-16)
    .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content).slice(0, 4000) }));
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") {
    return "Hola Sebastián, soy Bammy. ¿Sobre qué planta o criterio querés que hablemos?";
  }
  const r = await anthropic.messages.create({ model: MODEL, max_tokens: 1000, system: sys, messages: msgs });
  return r.content.find((b) => b.type === "text")?.text || "";
}
