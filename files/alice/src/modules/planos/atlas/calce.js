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
  const W = num(sobre?.ancho), D = num(sobre?.fondo);

  // Por eje: agrupar coordenadas cercanas, COLAPSAR los tramos que no cubre ningún
  // ambiente, y estirar el resultado para que ocupe el sobre entero.
  //
  // Agrupar solo por tolerancia no alcanza: un hueco de 60 cm entre dos ambientes queda
  // como queda, y sobre la planta completa eso fue 11% del piso sin asignar, con unidades
  // al 26%. Ese hueco no es espesor de muro: es que la tipología no llena su sobre. Se
  // colapsa el tramo vacío y después se reescala, así los muros quedan como aristas
  // compartidas (que es de donde muros.js los deriva) y el espesor se dibuja al final.
  const ejes = (lo, hi, limite) => {
    const vals = [...new Set(ambientes.flatMap((a) => [r2(lo(a)), r2(hi(a))]))].sort((x, y) => x - y);
    // 1. agrupar por tolerancia
    const centro = new Map();
    let grupo = [vals[0]];
    const cerrar = () => { const c = r2(grupo.reduce((s, v) => s + v, 0) / grupo.length);
      for (const v of grupo) centro.set(v, c); };
    for (const v of vals.slice(1)) {
      if (v - grupo[grupo.length - 1] <= tol) grupo.push(v); else { cerrar(); grupo = [v]; }
    }
    cerrar();
    const cs = [...new Set(centro.values())].sort((x, y) => x - y);
    // 2. un tramo entre dos coordenadas consecutivas es VACÍO si ningún ambiente lo cubre
    const cubierto = (a, b) => ambientes.some((m) => {
      const m0 = centro.get(r2(lo(m))) ?? r2(lo(m)), m1 = centro.get(r2(hi(m))) ?? r2(hi(m));
      return m0 <= a + 1e-9 && m1 >= b - 1e-9;
    });
    // 3. acumular el desplazamiento: cada tramo vacío corre hacia atrás todo lo que sigue
    const destino = new Map([[cs[0], 0]]);
    let acumulado = 0;
    for (let i = 1; i < cs.length; i++) {
      const ancho = cs[i] - cs[i - 1];
      if (cubierto(cs[i - 1], cs[i])) acumulado += ancho;
      destino.set(cs[i], r2(acumulado));
    }
    // 4. estirar lo que quedó para que llene el sobre
    const usado = acumulado;
    const k = limite > 0 && usado > 0 ? limite / usado : 1;
    const mapa = new Map();
    for (const [v, c] of centro) mapa.set(v, r2((destino.get(c) ?? 0) * k));
    return mapa;
  };

  const mx = ejes((a) => a.x, (a) => a.x + a.w, W);
  const my = ejes((a) => a.y, (a) => a.y + a.h, D);
  const g = (mapa, v) => mapa.get(r2(v)) ?? r2(v);

  return ambientes.map((a) => {
    const x0 = g(mx, a.x), x1 = g(mx, a.x + a.w);
    const y0 = g(my, a.y), y1 = g(my, a.y + a.h);
    return { ...a, x: x0, y: y0,
      w: x1 - x0 > 0.05 ? r2(x1 - x0) : a.w,
      h: y1 - y0 > 0.05 ? r2(y1 - y0) : a.h };
  });
}

/**
 * Rellena los huecos que quedan dentro del sobre emitiéndolos como ambientes de circulación.
 *
 * Una tipología leída de una lámina casi nunca tesela su propio sobre: el lector rotula los
 * cuartos y se saltea el hall, el pasadizo o el recibidor, que en el dibujo son el espacio
 * entre medias. Sobre la planta completa eso fue 11% del piso en blanco, con unidades al 26%,
 * y el hueco no está repartido como espesor de muro sino concentrado en un rincón.
 *
 * Dejarlo vacío rompe dos cosas: el dibujo muestra áreas residuales sin delimitar, y el grafo
 * de muros no encuentra adyacencia a través del hueco, así que vanos.js no puede abrir la
 * puerta que pasaría por ahí. Emitirlo como circulación es además lo más fiel a la lámina:
 * ese espacio existe en la planta, solo que sin rótulo.
 *
 * Descompone los huecos en rectángulos máximos sobre la grilla que forman las propias
 * coordenadas de los ambientes, así no inventa aristas nuevas.
 */
export function rellenarHuecos(ambientes = [], sobre = null, { minArea = 0.6 } = {}) {
  const W = num(sobre?.ancho), D = num(sobre?.fondo);
  if (!ambientes.length || !(W > 0) || !(D > 0)) return ambientes;

  const ejes = (vals, limite) => {
    const s = [...new Set([0, limite, ...vals.map(r2)])].filter((v) => v >= -1e-9 && v <= limite + 1e-9);
    return s.sort((a, b) => a - b).filter((v, i, arr) => i === 0 || v - arr[i - 1] > 0.02);
  };
  const XS = ejes(ambientes.flatMap((a) => [a.x, a.x + a.w]), W);
  const YS = ejes(ambientes.flatMap((a) => [a.y, a.y + a.h]), D);

  // celdas libres de la grilla
  const libre = [];
  for (let i = 0; i < XS.length - 1; i++) {
    libre[i] = [];
    for (let j = 0; j < YS.length - 1; j++) {
      const cx = (XS[i] + XS[i + 1]) / 2, cy = (YS[j] + YS[j + 1]) / 2;
      libre[i][j] = !ambientes.some((a) => cx > a.x && cx < a.x + a.w && cy > a.y && cy < a.y + a.h);
    }
  }
  // rectángulos máximos: se toma la celda libre de más abajo-izquierda y se crece
  const nuevos = [];
  for (let i = 0; i < XS.length - 1; i++) {
    for (let j = 0; j < YS.length - 1; j++) {
      if (!libre[i][j]) continue;
      let hasta = j;
      while (hasta + 1 < YS.length - 1 && libre[i][hasta + 1]) hasta++;
      let ancho = i;
      while (ancho + 1 < XS.length - 1) {
        let todas = true;
        for (let k = j; k <= hasta; k++) if (!libre[ancho + 1][k]) { todas = false; break; }
        if (!todas) break;
        ancho++;
      }
      for (let a = i; a <= ancho; a++) for (let k = j; k <= hasta; k++) libre[a][k] = false;
      const x = XS[i], y = YS[j], w = r2(XS[ancho + 1] - x), h = r2(YS[hasta + 1] - y);
      if (w * h >= minArea) nuevos.push({ nombre: "hall", tipo: "circulacion", x: r2(x), y: r2(y), w, h });
    }
  }
  if (!nuevos.length) return ambientes;
  // si hay más de uno se numeran, para que muros.js no los confunda entre sí
  return [...ambientes, ...nuevos.map((n, k) => ({ ...n, nombre: nuevos.length > 1 ? `hall ${k + 1}` : "hall" }))];
}
