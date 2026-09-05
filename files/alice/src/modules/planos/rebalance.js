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
  const core = parti.core;

  const target = units.find((u) => u.id === unidadId);
  if (!target) throw new RangeError(`unidad ${unidadId} no existe en el parti`);
  const otras = units.filter((u) => u.id !== unidadId);
  const anchoOtras = otras.reduce((s, u) => s + u.w, 0);
  if (!otras.length || anchoOtras <= 0) throw new RangeError("no hay vecinas para reequilibrar");

  // Verificar que ninguna vecina quedará por debajo del mínimo antes de modificar
  for (const u of otras) {
    const quita = deltaM * (u.w / anchoOtras);
    if (u.w - quita < MIN_ANCHO_UNIDAD) {
      throw new RangeError(`${u.id} quedaria en ${(u.w - quita).toFixed(2)} m (min ${MIN_ANCHO_UNIDAD})`);
    }
  }

  // Separar unidades en izquierda/derecha ANTES de cambiar anchos (usando posiciones originales)
  const coreEnd = Math.round((core.x + core.w) * 1000) / 1000;
  const unidadesIzq = units.filter((u) => Math.round((u.x + u.w) * 1000) / 1000 <= core.x).sort((a, b) => a.x - b.x);
  const unidadesDer = units.filter((u) => u.x >= coreEnd).sort((a, b) => a.x - b.x);

  // Calcular descuentos y redistribuir con residuo a la última vecina
  const descuentos = [];
  let residuoAcumulado = 0;
  for (let i = 0; i < otras.length; i++) {
    const quita = deltaM * (otras[i].w / anchoOtras);
    const quitaRedondeada = Math.round(quita * 1000) / 1000;
    descuentos.push(quitaRedondeada);
    residuoAcumulado += quita - quitaRedondeada;
  }
  // Asignar el residuo a la última vecina para conservar el total
  if (otras.length > 0) {
    descuentos[otras.length - 1] += Math.round(residuoAcumulado * 1000) / 1000;
  }

  // Aplicar nuevos anchos
  for (let i = 0; i < otras.length; i++) {
    otras[i].w = Math.round((otras[i].w - descuentos[i]) * 1000) / 1000;
  }
  target.w = Math.round((target.w + deltaM) * 1000) / 1000;

  // Reubicar en el frente considerando el core como obstáculo
  let cursor = unidadesIzq.length > 0 ? unidadesIzq[0].x : core.x;
  for (const u of unidadesIzq) {
    u.x = Math.round(cursor * 1000) / 1000;
    cursor += u.w;
  }

  const newCoreX = Math.round(cursor * 1000) / 1000;
  const newCore = { ...core, x: newCoreX };

  cursor = newCoreX + core.w;
  for (const u of unidadesDer) {
    u.x = Math.round(cursor * 1000) / 1000;
    cursor += u.w;
  }

  return { ...parti, core: newCore, units };
}
