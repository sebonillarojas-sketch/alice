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

/**
 * Cierra las juntas entre ambientes de una tipología adaptada.
 *
 * El atlas guarda los ambientes como se leen de la lámina: con el hueco del muro entre
 * ellos (por eso la ocupación ronda 0.88, no 1). Pero el modelo de ALICE deriva los muros
 * de las aristas COMPARTIDAS — dos ambientes separados por 12 cm no comparten nada, así
 * que no hay muro, no hay adyacencia, y vanos.js no puede abrir una puerta entre ellos.
 * Medido sobre la cadena completa: 8 ambientes inaccesibles y 10 sin muro para su puerta.
 *
 * La solución no es bajar la tolerancia de muros.js —eso fundiría muros que de verdad son
 * distintos— sino alinear las coordenadas acá: se agrupan los valores cercanos de x y de y
 * y cada uno se lleva al centro de su grupo. Los ambientes quedan tocándose, el muro pasa a
 * ser la arista compartida, y el espesor se dibuja después.
 *
 * Lo mismo vale en el PERÍMETRO, y ahí duele más: un ambiente que no llega al borde del
 * sobre no toca la fachada (se queda sin ventana) ni el corredor (la unidad se queda sin
 * acceso). Por eso `sobre` no es opcional en la práctica — sin él quedaban 18 ambientes
 * sin luz y 3 unidades sin entrada.
 *
 * @param ambientes  los de una tipología ya adaptada al sobre
 * @param sobre      { ancho, fondo } del sobre objetivo; si viene, se pegan los extremos
 * @param tol        separación máxima que se considera "la misma línea" (m)
 */
export function cerrarJuntas(ambientes = [], sobre = null, tol = 0.30) {
  if (!ambientes.length) return ambientes;
  // agrupa valores cercanos en una sola coordenada (el promedio del grupo)
  const mapaDe = (valores) => {
    const orden = [...new Set(valores.map((v) => r2(v)))].sort((a, b) => a - b);
    const mapa = new Map();
    let grupo = [orden[0]];
    const cerrar = () => {
      const centro = r2(grupo.reduce((s, v) => s + v, 0) / grupo.length);
      for (const v of grupo) mapa.set(v, centro);
    };
    for (const v of orden.slice(1)) {
      if (v - grupo[grupo.length - 1] <= tol) grupo.push(v);
      else { cerrar(); grupo = [v]; }
    }
    cerrar();
    return mapa;
  };
  const mx = mapaDe(ambientes.flatMap((a) => [a.x, a.x + a.w]));
  const my = mapaDe(ambientes.flatMap((a) => [a.y, a.y + a.h]));
  const g = (mapa, v) => mapa.get(r2(v)) ?? r2(v);

  // pegar los extremos al sobre: el grupo más bajo va a 0, el más alto al borde
  const W = num(sobre?.ancho), D = num(sobre?.fondo);
  const pegar = (mapa, limite) => {
    if (!(limite > 0)) return;
    const centros = [...new Set(mapa.values())].sort((a, b) => a - b);
    const min = centros[0], max = centros[centros.length - 1];
    if (min > 0 && min <= tol) for (const [k, v] of mapa) if (v === min) mapa.set(k, 0);
    if (max < limite && limite - max <= tol) for (const [k, v] of mapa) if (v === max) mapa.set(k, r2(limite));
  };
  pegar(mx, W); pegar(my, D);

  return ambientes.map((a) => {
    const x0 = g(mx, a.x), x1 = g(mx, a.x + a.w);
    const y0 = g(my, a.y), y1 = g(my, a.y + a.h);
    // un ambiente nunca se colapsa: si el ajuste lo dejaría sin ancho, se conserva el suyo
    return { ...a, x: x0, y: y0,
      w: x1 - x0 > 0.05 ? r2(x1 - x0) : a.w,
      h: y1 - y0 > 0.05 ? r2(y1 - y0) : a.h };
  });
}
