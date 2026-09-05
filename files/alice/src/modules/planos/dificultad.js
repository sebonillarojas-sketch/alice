// La unidad dificil primero: es la que fuerza cambios de reparto.
export function puntajeDificultad(u = {}) {
  const area = Number(u.area) || 1;
  const fachadas = Math.max(1, Number(u.fachadas) || 1);
  const frente = Number(u.frente) || 1;
  const fondo = Number(u.fondo) || 1;
  const esbeltez = Math.max(frente, fondo) / Math.max(0.01, Math.min(frente, fondo));
  return (100 / area) + (10 / fachadas) + esbeltez;
}

export function ordenarPorDificultad(units = []) {
  return units
    .map((u, i) => ({ u, i, s: puntajeDificultad(u) }))
    .sort((a, b) => (b.s - a.s) || (a.i - b.i))
    .map(({ u }) => u);
}
