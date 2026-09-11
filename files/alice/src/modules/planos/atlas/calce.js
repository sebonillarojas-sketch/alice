// Motor de calce: dado un sobre real y un programa, elige de la biblioteca la tipología más
// parecida y la adapta. Es la pieza que convierte al atlas en producto — sin esto el atlas
// es un archivo que nadie consulta.
//
// Sigue el modelo que documentamos de Finch3D: un score de coincidencia para elegir, y una
// métrica de "adaptividad" que reporta cuánto hubo que estirar o comprimir cada ambiente
// para que entrara. Esa segunda métrica es la que importa: un calce del 90% que deformó un
// dormitorio al 160% no sirve, y sin medirlo no se nota.
import { validarEntrada } from "./esquema.js";

const r2 = (n) => Math.round(n * 100) / 100;
const r3 = (n) => Math.round(n * 1000) / 1000;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

// Cuánto se parecen dos números, 1 = idénticos, 0 = el doble o la mitad.
const cercania = (a, b) => {
  if (!(a > 0) || !(b > 0)) return 0;
  return Math.max(0, 1 - Math.abs(a - b) / Math.max(a, b));
};

/**
 * Puntúa una entrada del atlas contra un sobre objetivo.
 *
 * El programa es un FILTRO DURO, no un peso: un 2D no puede resolver un pedido de 3D por
 * mucho que el área calce. Lo demás pondera.
 *
 * @param entrada  entrada del atlas
 * @param objetivo { ancho, fondo, dormitorios, banos, fachadas: [aristas] }
 */
export function puntuar(entrada, objetivo = {}) {
  const dormsPedidos = num(objetivo.dormitorios);
  const dormsEntrada = num(entrada.programa?.dormitorios);
  if (dormsPedidos !== null && dormsEntrada !== dormsPedidos) {
    return { score: 0, descartada: "programa distinto", desglose: null };
  }

  const aO = num(objetivo.ancho), fO = num(objetivo.fondo);
  const aE = num(entrada.sobre?.ancho), fE = num(entrada.sobre?.fondo);
  if (!(aO > 0) || !(fO > 0) || !(aE > 0) || !(fE > 0)) {
    return { score: 0, descartada: "sobre inválido", desglose: null };
  }

  // Área: lo más importante. Es el número comercial y el que decide si el depa es vendible.
  const area = cercania(aO * fO, aE * fE);
  // Proporción: un sobre de 4×14 y uno de 7×8 tienen la misma área y no admiten la misma
  // planta. Se compara la esbeltez, no ancho contra ancho, porque la tipología se puede
  // rotar 90° al adaptarla.
  const propO = Math.max(aO, fO) / Math.min(aO, fO);
  const propE = Math.max(aE, fE) / Math.min(aE, fE);
  const proporcion = cercania(propO, propE);
  // Baños: pondera, no filtra. Un baño de más o de menos se resuelve.
  const banos = objetivo.banos ? cercania(num(entrada.programa?.banos) || 1, num(objetivo.banos)) : 1;
  // Fachadas: cuántas de las que la tipología necesita están disponibles en el objetivo.
  const fE_ = entrada.fachadas || [];
  const fO_ = objetivo.fachadas || [];
  const fachadas = fE_.length === 0 ? 0
    : fO_.length === 0 ? 0.5
      : Math.min(1, fO_.length / fE_.length);
  // La confianza de la lectura entra como peso: entre dos calces iguales gana el que está
  // mejor medido. No filtra — una tipología "baja" bien calzada sigue sirviendo.
  const conf = { alta: 1, media: 0.92, baja: 0.82 }[entrada.confianza] || 0.8;

  const score = (area * 0.42 + proporcion * 0.33 + fachadas * 0.15 + banos * 0.10) * conf;
  return {
    score: r3(score),
    descartada: null,
    desglose: { area: r3(area), proporcion: r3(proporcion), fachadas: r3(fachadas), banos: r3(banos), confianza: conf },
  };
}

/**
 * Adapta una entrada a un sobre objetivo estirando/comprimiendo por eje, y reporta cuánto.
 * Rota 90° si el objetivo está orientado al revés que la tipología.
 *
 * `adaptividad` es la métrica que hay que mirar: el factor del ambiente que más se deformó.
 * Por encima de ~1.35 la tipología deja de ser la que se eligió.
 */
export function adaptar(entrada, objetivo = {}) {
  const aO = num(objetivo.ancho), fO = num(objetivo.fondo);
  const aE = num(entrada.sobre?.ancho), fE = num(entrada.sobre?.fondo);
  if (!(aO > 0) || !(fO > 0) || !(aE > 0) || !(fE > 0)) return null;

  // ¿conviene rotarla? Se compara cómo quedan los factores en cada orientación.
  const costo = (kx, ky) => Math.max(kx, ky, 1 / kx, 1 / ky);
  const directo = costo(aO / aE, fO / fE);
  const rotado = costo(aO / fE, fO / aE);
  const rotar = rotado < directo;

  const anchoBase = rotar ? fE : aE, fondoBase = rotar ? aE : fE;
  const kx = aO / anchoBase, ky = fO / fondoBase;

  const ambientes = (entrada.ambientes || []).map((a) => {
    // al rotar 90°: (x,y,w,h) → (y, anchoOriginal - x - w, h, w)
    const base = rotar
      ? { x: a.y, y: aE - a.x - a.w, w: a.h, h: a.w }
      : { x: a.x, y: a.y, w: a.w, h: a.h };
    return { ...a, x: r2(base.x * kx), y: r2(base.y * ky), w: r2(base.w * kx), h: r2(base.h * ky) };
  });

  const factores = [kx, ky];
  const adaptividad = r3(Math.max(...factores, ...factores.map((k) => 1 / k)));
  return {
    ambientes,
    rotada: rotar,
    factores: { x: r3(kx), y: r3(ky) },
    adaptividad,
    aviso: adaptividad > 1.35
      ? `deformación ${adaptividad}×: a este sobre la tipología deja de ser la que se eligió`
      : null,
  };
}

/**
 * Busca en la biblioteca. Devuelve los mejores calces, ya adaptados.
 * @returns [{ entrada, score, desglose, adaptacion }]
 */
export function calzar(atlas = [], objetivo = {}, { top = 5, scoreMin = 0.45 } = {}) {
  const out = [];
  for (const entrada of atlas) {
    const p = puntuar(entrada, objetivo);
    if (p.descartada || p.score < scoreMin) continue;
    out.push({ entrada, score: p.score, desglose: p.desglose, adaptacion: adaptar(entrada, objetivo) });
  }
  // a igualdad de score gana el que menos hay que deformar
  out.sort((a, b) => (b.score - a.score) || ((a.adaptacion?.adaptividad || 9) - (b.adaptacion?.adaptividad || 9)));
  return out.slice(0, top);
}
