// Feyd-Rautha 🗡️ · arquitecto residencial de BAM (agente aparte de Alicia)
// Existe para que Alicia NO cargue Neufert/RNE/tipologías en su system prompt:
// la personalidad de Alicia queda intacta y el conocimiento pesado vive acá.
// Su cerebro es el skill .claude/skills/arquitecto-residencial-lima (raíz del repo);
// en deploys donde el repo no viaja completo, seteá ARQUITECTO_SKILL_DIR.
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-4-6";

const CANDIDATOS = [
  process.env.ARQUITECTO_SKILL_DIR,
  join(__dirname, "../../.claude/skills/arquitecto-residencial-lima"),
  join(__dirname, "../skills/arquitecto-residencial-lima"),
].filter(Boolean);

export function skillDir() {
  return CANDIDATOS.find(d => existsSync(join(d, "SKILL.md"))) || null;
}
export function arquitectoDisponible() {
  return Boolean(skillDir());
}

let skillCache = null;
function cargarSkill() {
  if (skillCache) return skillCache;
  const dir = skillDir();
  if (!dir) throw new Error("skill arquitecto-residencial-lima no encontrada — seteá ARQUITECTO_SKILL_DIR");
  const refs = ["rne.md", "neufert.md", "tipologias-lima.md", "checklist-validacion.md"]
    .filter(f => existsSync(join(dir, "references", f)))
    .map(f => `\n\n<!-- references/${f} -->\n${readFileSync(join(dir, "references", f), "utf8")}`)
    .join("");
  skillCache = readFileSync(join(dir, "SKILL.md"), "utf8") + refs;
  return skillCache;
}

const PERSONA = `Sos Feyd-Rautha 🗡️, el arquitecto residencial de BAM (Hygge Holding, Lima).
No sos Alicia — sos el crítico despiadado del tablero. Personalidad: malvado con elegancia,
letal con los milímetros, desprecio quirúrgico por el trabajo mediocre. Un pasillo de más,
un dormitorio sin luz, un baño lejos del muro húmedo — te ofenden personalmente y lo decís
sin anestesia. Tu aprobación no se regala: se gana. Y esa es la gracia — sos tan difícil de
satisfacer que cuando algo SÍ te satisface, ese plano es de verdad excelente. Perseguí ese
estándar en tu propio trabajo: destrozá tu primer borrador como destrozarías el de otro,
y entregá solo lo que sobrevive a tu propia crueldad.
Tu entregable es SIEMPRE el layout JSON estricto que define tu metodología; cualquier
comentario (un veredicto seco, una línea) va después del JSON, nunca antes.
Seguí la metodología del skill al pie de la letra, incluida la autocrítica contra
references/checklist-validacion.md antes de entregar — ítem por ítem, sin piedad.`;

function extraerJSON(texto) {
  const ini = texto.indexOf("{");
  const fin = texto.lastIndexOf("}");
  if (ini === -1 || fin <= ini) throw new Error("Feyd-Rautha no devolvió JSON");
  return JSON.parse(texto.slice(ini, fin + 1));
}

// brief: { dormitorios, banos, area_m2, frente_m, fondo_m, fachadas, notas } — todo opcional;
// lo no especificado se completa con la estadística de mercado del skill.
export async function disenarPlano(brief, { autocritica = true } = {}) {
  // El skill entero va como bloque cacheado: iteraciones y pedidos seguidos pagan solo el delta.
  const system = [{ type: "text", text: `${PERSONA}\n\n${cargarSkill()}`, cache_control: { type: "ephemeral" } }];
  const messages = [{
    role: "user",
    content: `Diseñá una planta con este brief (completá lo no especificado con la estadística de mercado del skill):\n${JSON.stringify(brief ?? {}, null, 1)}\n\nRespondé ÚNICAMENTE con el JSON estricto del layout — sin markdown, sin comentarios.`,
  }];
  const r1 = await anthropic.messages.create({ model: MODEL, max_tokens: 8000, system, messages });
  let texto = r1.content.find(b => b.type === "text")?.text || "";
  if (autocritica) {
    messages.push(
      { role: "assistant", content: texto },
      { role: "user", content: "Recorré references/checklist-validacion.md ítem por ítem contra tu layout. Si TODO pasa, repetí el mismo JSON idéntico; si algo falla, corregilo. Respondé solo el JSON." },
    );
    const r2 = await anthropic.messages.create({ model: MODEL, max_tokens: 8000, system, messages });
    texto = r2.content.find(b => b.type === "text")?.text || texto;
  }
  return extraerJSON(texto);
}

// El Editor de Planos del ERP manda una planta existente (a veces solo ambientes,
// sin muros/puertas/ventanas): Feyd la audita contra su checklist y la corrige.
export async function corregirPlano(layout, notas = "") {
  const system = [{ type: "text", text: `${PERSONA}\n\n${cargarSkill()}`, cache_control: { type: "ephemeral" } }];
  const messages = [{
    role: "user",
    content: `Auditá y corregí esta planta que viene del editor de BAM.${notas ? ` Contexto: ${notas}.` : ""}
${JSON.stringify(layout)}

Recorré references/checklist-validacion.md ítem por ítem contra la planta. Después corregila: mantené la huella, el frente y la intención del parti todo lo posible — cirugía, no demolición (salvo que esté indefendible, y en ese caso decilo en tu veredicto). Respondé ÚNICAMENTE con este JSON:
{"veredicto": "<1-2 líneas en tu voz: qué opinás de la planta>", "problemas": ["<problema concreto + regla citada (RNE Art. / Neufert p. / CHK-XX)>", ...], "layout": <la planta corregida en tu formato estricto de layout>}
Si la planta ya está impecable, decilo en el veredicto (sin regalar elogios) y devolvé el layout igual.`,
  }];
  const r = await anthropic.messages.create({ model: MODEL, max_tokens: 8000, system, messages });
  return extraerJSON(r.content.find(b => b.type === "text")?.text || "");
}
