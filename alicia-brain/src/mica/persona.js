// El buyer persona, extraído de lo que la persona realmente dijo.
// La regla del spec (§8) y del esquema del CRM es la misma: sin evidencia no hay dato.
// Acá se hace cumplir del lado del código, ANTES de que llegue a la base: un modelo
// que inventa una cita es más peligroso que uno que no extrae nada, porque el dossier
// que lee José se ve igual de creíble en los dos casos.

const CAMPOS = ["motivacion", "hogar", "metraje", "tipologia", "prioridad", "plazo"];

// Comparar citas al pie de la letra rompe por una tilde o una mayúscula y tira datos
// buenos; compararlas "parecido" deja pasar invenciones. Se normaliza solo el ruido:
// tildes, mayúsculas, puntuación y espacios de más.
const normalizar = (s) => String(s || "")
  .toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[.,;:!?¿¡"'()]/g, "")
  .replace(/\s+/g, " ")
  .trim();

// Separador entre mensajes: impide que una "cita" matchee pegando el final de un
// mensaje con el principio del siguiente, que es una frase que nadie dijo nunca.
const SEP = " >>> ";

export function validarCitas(persona = {}, mensajes = []) {
  // Solo lo que dijo el prospecto es evidencia. Lo que preguntó Mica, no: si contara,
  // cualquier dato quedaría "respaldado" por la propia pregunta que lo sugirió.
  const dicho = mensajes.filter(m => m.rol === "prospecto").map(m => normalizar(m.texto)).join(SEP);
  const limpio = {};
  for (const campo of CAMPOS) {
    const v = persona[campo];
    if (!v || typeof v !== "object") continue;
    const cita = normalizar(v.cita);
    if (!cita) continue;
    if (!dicho.includes(cita)) continue;
    limpio[campo] = v;
  }
  return limpio;
}

const INSTRUCCION = `Extraé el buyer persona de esta conversación.

Devolvé SOLO un JSON, sin texto alrededor, con las claves que puedas sostener:
{
  "motivacion": {"valor": "...", "cita": "..."},
  "hogar":      {"valor": "...", "cita": "..."},
  "metraje":    {"min": 0, "max": 0, "cita": "..."},
  "tipologia":  {"valor": "townhouse|flat|duplex", "cita": "..."},
  "prioridad":  {"valor": "sala|habitaciones|ambos", "cita": "..."},
  "plazo":      {"valor": "...", "cita": "..."}
}

La "cita" tiene que ser un fragmento TEXTUAL de algo que dijo el PROSPECTO, copiado
carácter por carácter. No la parafrasees, no la corrijas, no la completes.
Si un dato no lo dijo, omití la clave entera. Es preferible un buyer persona corto
y cierto a uno completo e inventado.`;

export async function extraerPersona({ mensajes = [], llm }) {
  const transcripcion = mensajes
    .map(m => `${m.rol === "prospecto" ? "Prospecto" : "Mica"}: ${m.texto}`).join("\n");
  let crudo;
  try {
    crudo = await llm({ system: INSTRUCCION, mensajes: [{ rol: "prospecto", texto: transcripcion }] });
  } catch { return {}; }
  try {
    const s = String(crudo);
    return validarCitas(JSON.parse(s.slice(s.indexOf("{"), s.lastIndexOf("}") + 1)), mensajes);
  } catch {
    // El modelo no devolvió JSON. Un buyer persona vacío es un resultado válido:
    // significa "todavía no sé nada de esta persona", que es la verdad.
    return {};
  }
}
