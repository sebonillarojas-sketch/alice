// El interior que no cierra suele ser un problema de reparto, no de muebles:
// el hallazgo sube y cambia el ancho de la unidad sobre la huella.
export const MIN_ANCHO_UNIDAD = 3.0;

const REGLAS_DE_VOLUMEN = new Set(["no_cabe", "sin_fachada", "sobre_insuficiente"]);

export function esDeVolumen(f = {}) {
  if (f.nivel === "volumen") return true;
  return REGLAS_DE_VOLUMEN.has(f.regla);
}

export function rebalancear(parti, unidadId, deltaM) {
  const units = (parti.units || []).map((u) => ({ ...u }));
  const target = units.find((u) => u.id === unidadId);
  if (!target) throw new RangeError(`unidad ${unidadId} no existe en el parti`);
  const otras = units.filter((u) => u.id !== unidadId);
  const anchoOtras = otras.reduce((s, u) => s + u.w, 0);
  if (!otras.length || anchoOtras <= 0) throw new RangeError("no hay vecinas para reequilibrar");

  for (const u of otras) {
    const quita = deltaM * (u.w / anchoOtras);
    if (u.w - quita < MIN_ANCHO_UNIDAD) {
      throw new RangeError(`${u.id} quedaria en ${(u.w - quita).toFixed(2)} m (min ${MIN_ANCHO_UNIDAD})`);
    }
  }
  for (const u of otras) u.w = Math.round((u.w - deltaM * (u.w / anchoOtras)) * 1000) / 1000;
  target.w = Math.round((target.w + deltaM) * 1000) / 1000;

  // reubicar en el frente conservando el orden
  const orden = [...units].sort((a, b) => a.x - b.x);
  let cursor = orden[0].x;
  for (const u of orden) { u.x = Math.round(cursor * 1000) / 1000; cursor += u.w; }

  return { ...parti, units };
}
