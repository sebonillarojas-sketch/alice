// Orquesta un turno completo: decide, y recién si hace falta gasta un modelo.
// El handoff NUNCA pasa por el modelo — es plantilla (spec §7).
import { decidirTurno, construirSystem } from "./motor.js";
import { armarHandoff } from "./handoff.js";

// Cuando el modelo no está, Mica sigue siendo educada y no promete nada.
const SI_SE_CAE = "Dame un momento y te respondo bien.";

export async function responder({ mensajes = [], estado = {}, catalogo = [], llm } = {}) {
  const d = decidirTurno({ mensajes, estado });
  const meta = { temperatura: d.temperatura, evidencia: d.evidencia };

  if (d.tipo === "handoff") {
    // Sin proyecto conocido no se inventa uno: se deriva igual, sin nombrarlo.
    const proyecto = estado.proyecto || catalogo[0]?.id || null;
    const { texto, combo } = armarHandoff({ proyecto, usadas: estado.combosUsados || [] });
    return { tipo: "handoff", texto, combo, ...meta };
  }

  const system = construirSystem({ catalogo, estado });
  try {
    const texto = await llm({ system, mensajes });
    return { tipo: d.tipo, texto, ...meta };
  } catch {
    return { tipo: "error", texto: SI_SE_CAE, ...meta };
  }
}
