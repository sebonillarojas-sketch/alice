// Memoria de la corrida: un hallazgo que sobrevive dos vueltas detiene la cadena en
// vez de reintentar lo mismo por tercera vez.
export const findingKey = (f = {}) =>
  `${f.unidad || ""}|${f.ambiente || ""}|${f.regla || f.category || ""}`;

export function createLedger() {
  const abiertos = new Map();   // unidad -> Map(key, finding)
  const cerrados = new Map();   // unidad -> Set(key)
  const vueltas = new Map();    // key -> veces consecutivas visto

  const mapFor = (m, u) => { if (!m.has(u)) m.set(u, m === cerrados ? new Set() : new Map()); return m.get(u); };

  return {
    record(unidad, findings = []) {
      const abiertosU = mapFor(abiertos, unidad);
      const cerradosU = mapFor(cerrados, unidad);
      const vistos = new Set();
      const nuevos = [], repetidos = [], regresiones = [];

      for (const f of findings) {
        const key = findingKey({ ...f, unidad });
        vistos.add(key);
        if (abiertosU.has(key)) {
          vueltas.set(key, (vueltas.get(key) || 1) + 1);
          repetidos.push(f);
        } else if (cerradosU.has(key)) {
          cerradosU.delete(key);
          vueltas.set(key, 1);
          regresiones.push(f);
        } else {
          vueltas.set(key, 1);
          nuevos.push(f);
        }
        abiertosU.set(key, { ...f, unidad });
      }
      for (const key of [...abiertosU.keys()]) {
        if (!vistos.has(key)) { abiertosU.delete(key); cerradosU.add(key); vueltas.delete(key); }
      }
      return { nuevos, repetidos, regresiones };
    },
    mustFix(unidad) { return [...mapFor(abiertos, unidad).values()]; },
    bloqueado(unidad) {
      return [...mapFor(abiertos, unidad).keys()].some((k) => (vueltas.get(k) || 0) >= 2);
    },
    resueltos(unidad) { return [...mapFor(cerrados, unidad)]; },
  };
}
