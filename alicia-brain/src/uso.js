// Cuánto costó cada turno. La Fase 2 sube el gasto (contexto de pantalla en cada
// mensaje, el doble de iteraciones) y sin esto no hay forma de saber cuánto hasta
// que llega la factura. Pagar la deuda ahora, mientras se toca el loop igual, sale
// casi gratis — ver D19 en el spec.

export function usoVacio() {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
}

// Devuelve uno nuevo en vez de mutar: el acumulador viaja por el loop y un mutador
// silencioso es justo el bug que nadie encuentra.
export function acumularUso(acc, usage) {
  const u = usage || {};
  return {
    input:      acc.input      + (u.input_tokens || 0),
    output:     acc.output     + (u.output_tokens || 0),
    cacheRead:  acc.cacheRead  + (u.cache_read_input_tokens || 0),
    cacheWrite: acc.cacheWrite + (u.cache_creation_input_tokens || 0),
  };
}

// Best-effort a propósito: si la tabla no existe todavía o la escritura falla,
// se pierde una medición — jamás el turno de la persona.
export function registrarUso(db, { userId, channel, model, iterations, uso }) {
  try {
    db.prepare(
      `INSERT INTO turn_usage (user_id, channel, model, iterations,
         input_tokens, output_tokens, cache_read_tokens, cache_write_tokens)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(userId, channel, model, iterations, uso.input, uso.output, uso.cacheRead, uso.cacheWrite);
  } catch (e) {
    console.error("no pude registrar el uso del turno:", e.message);
  }
}
