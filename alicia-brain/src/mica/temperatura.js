// Temperatura auditable, no intuición. Cada veredicto viaja con la frase textual
// que lo causó: sin evidencia no hay dato (spec §8).
// Solo cuenta lo que dice el prospecto — lo que ofrece Mica no es interés de nadie.

// Pedir planos o precio es la señal directa de hot: es, literalmente, el momento
// del handoff. No necesita acumular nada más.
const PEDIDO = /\b(planos?|precios?|cu[áa]nto (cuesta|est[áa]|sale)|costo|disponibilidad|cotizaci[óo]n|brochure)\b/i;
// Señales de que hay alguien buscando de verdad, aunque todavía no pida nada.
const INTERES = /\b(me interesa|estoy buscando|busco|m2|m²|metros|dormitorios?|townhouse|flat|d[úu]plex|departamento)\b/i;

export function clasificar(mensajes = []) {
  let temperatura = "frio";
  let evidencia = null;

  for (const m of mensajes) {
    if (m.rol !== "prospecto") continue;
    const t = String(m.texto || "");
    if (PEDIDO.test(t)) { temperatura = "hot"; evidencia = t; continue; }
    if (temperatura !== "hot" && INTERES.test(t)) { temperatura = "tibio"; evidencia = t; }
  }
  return { temperatura, evidencia };
}
