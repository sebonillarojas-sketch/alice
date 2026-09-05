// Diversidad de partis verificada por codigo, no pedida por prompt: dos partis que
// coinciden en nucleo y reparto son el mismo, y uno se descarta.

// Componentes para display legible y estable, no para comparación de igualdad
const q = (n, tol) => {
  const rounded = Math.round(Number(n || 0) / tol) * tol;
  return Math.round(rounded * 100) / 100;
};

export function partiSignature(parti = {}, tol = 0.30) {
  const core = parti.core || {};
  const units = [...(parti.units || [])].sort((a, b) => (a.x || 0) - (b.x || 0));
  const c = `c:${q(core.x, tol)},${q(core.y, tol)},${q(core.w, tol)},${q(core.d, tol)}`;
  const u = units.map((it) => `${q(it.x, tol)}:${q(it.w, tol)}`).join("|");
  return `${c}#${u}`;
}

export function sonDistintos(a, b, tol = 0.30) {
  const coreA = a.core || {};
  const coreB = b.core || {};

  // Comparar componentes del núcleo
  if (Math.abs((coreA.x || 0) - (coreB.x || 0)) > tol) return true;
  if (Math.abs((coreA.y || 0) - (coreB.y || 0)) > tol) return true;
  if (Math.abs((coreA.w || 0) - (coreB.w || 0)) > tol) return true;
  if (Math.abs((coreA.d || 0) - (coreB.d || 0)) > tol) return true;

  // Comparar número de unidades
  const unitsA = [...(a.units || [])].sort((u1, u2) => (u1.x || 0) - (u2.x || 0));
  const unitsB = [...(b.units || [])].sort((u1, u2) => (u1.x || 0) - (u2.x || 0));

  if (unitsA.length !== unitsB.length) return true;

  // Comparar cada unidad (ya ordenadas por x)
  for (let i = 0; i < unitsA.length; i++) {
    if (Math.abs((unitsA[i].x || 0) - (unitsB[i].x || 0)) > tol) return true;
    if (Math.abs((unitsA[i].w || 0) - (unitsB[i].w || 0)) > tol) return true;
  }

  return false;
}

export function dedupePartis(list = [], tol = 0.30) {
  const kept = [];
  const dropped = [];

  for (const p of list) {
    // Revisar si es distinto contra TODOS los ya conservados
    let esDistinto = true;
    for (const existing of kept) {
      if (!sonDistintos(p, existing, tol)) {
        esDistinto = false;
        break;
      }
    }

    if (esDistinto) {
      kept.push(p);
    } else {
      dropped.push(p);
    }
  }

  return { kept, dropped };
}
