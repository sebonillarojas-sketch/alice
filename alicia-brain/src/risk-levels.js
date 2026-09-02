// Clasificación de riesgo de una lección · quién puede auto-aplicarse.
// Versionado a mano igual que hard-rules.js: agregar patrones con cuidado.
//
// El agente que propone una lección puede DECLARARLA cosmética (L0), pero un agente
// que decide su propio nivel de riesgo es un agente que puede promoverse solo: basta
// una lección envenenada en su contexto para que etiquete como "tono" algo que actúa.
// Por eso declarar L0 es una solicitud y esto es quien la concede.

// Marcadores de forma: cómo se dice algo, no qué se hace.
const COSMETICO = [
  /salud(o|ar|á|a)\b/i,
  /\btono\b/i,
  /\bemoji/i,
  /\b(breve|conciso|corto|largo|extenso)\b/i,
  /\b(wording|redacci[oó]n|fraseo|forma de decir)\b/i,
  /\bmarkdown\b/i,
  /\bformato\b/i,
  /\b(may[uú]sculas|min[uú]sculas|signos?|tildes?)\b/i,
  /\b(c[aá]lido|seco|formal|informal|directo)\b/i,
];

// Marcadores de acción: mutan estado o deciden algo. Su presencia descalifica,
// aunque la lección también hable de forma — una lección mixta cae del lado seguro.
const ACCION = [
  /\b(crear|cre[aá]|borrar|borr[aá]|eliminar|elimin[aá]|enviar|envi[aá])\b/i,
  /\b(asignar|asign[aá]|asignarle|aprobar|aprob[aá]|rechazar|rechaz[aá])\b/i,
  /\b(ejecutar|ejecut[aá]|correr|corr[eé]|agendar|agend[aá])\b/i,
  /\b(priorizar|prioriz[aá]|decidir|decid[ií]|escalar|escal[aá])\b/i,
  /\b(confirmar|confirm[aá]|reportar|report[aá]|revisar|revis[aá])\b/i,
  /\b(modificar|modific[aá]|actualizar|actualiz[aá]|guardar|guard[aá])\b/i,
];

export function isCosmetic(text) {
  if (typeof text !== "string" || !text.trim()) return false;
  if (!COSMETICO.some(re => re.test(text))) return false;
  return !ACCION.some(re => re.test(text));
}

// El guard. `claimed` es lo que la fuente pidió; el default sigue siendo L1.
export function resolveRiskLevel(claimed, text) {
  if (claimed !== "L0") return claimed || "L1";
  return isCosmetic(text) ? "L0" : "L1";
}
