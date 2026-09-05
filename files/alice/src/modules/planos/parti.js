// Diversidad de partis verificada por codigo, no pedida por prompt: dos partis que
// coinciden en nucleo y reparto son el mismo, y uno se descarta.
const q = (n, tol) => Math.round(Math.round(Number(n || 0) / tol / 3) * tol * 3 * 100) / 100;

export function partiSignature(parti = {}, tol = 0.30) {
  const core = parti.core || {};
  const units = [...(parti.units || [])].sort((a, b) => (a.x || 0) - (b.x || 0));
  const c = `c:${q(core.x, tol)},${q(core.y, tol)},${q(core.w, tol)},${q(core.d, tol)}`;
  const u = units.map((it) => `${q(it.x, tol)}:${q(it.w, tol)}`).join("|");
  return `${c}#${u}`;
}

export function sonDistintos(a, b, tol = 0.30) {
  return partiSignature(a, tol) !== partiSignature(b, tol);
}

export function dedupePartis(list = [], tol = 0.30) {
  const vistos = new Set();
  const kept = [];
  const dropped = [];
  for (const p of list) {
    const sig = partiSignature(p, tol);
    if (vistos.has(sig)) { dropped.push(p); continue; }
    vistos.add(sig);
    kept.push(p);
  }
  return { kept, dropped };
}
