// Normalización PURA del parti aproximado que devuelve Tweedledum (la decisión
// de zonificación) a un parti exacto: anchos que suman exactamente el frente
// disponible, unidades por encima del mínimo constructivo y posiciones en
// milímetros. packFloor / clipPieces (lote.js) ya saben teselar un parti exacto
// contra la huella real; este módulo es el puente entre "Tweedledum decide" y
// "ALICE dibuja".
//
// Por diseño Tweedledum nunca tiene que hacer que sus números cierren: los
// anchos son aproximados y pueden sumar de más o de menos que el frente. Esta
// normalización es la que prorratea y redondea para que el resultado sea
// constructiva y geométricamente exacto, sin perder ni ganar ancho total.
import { MIN_ANCHO_UNIDAD } from "./rebalance.js";

// mismo criterio que usa packFloor (lote.js) para decidir crujía simple vs.
// doble cuando el fondo alcanza para dos bandas + corredor.
const BAND_MIN_DEPTH = 4.0;
export const CORREDOR_PROFUNDIDAD_DEFAULT = 1.6;

// profundidad por defecto del núcleo (escalera + ascensor + hall) cuando Tweedledum no
// la manda o manda algo absurdo: 4-6 m es lo típico para un núcleo real, tomamos el medio.
export const CORE_LONGITUD_DEFAULT = 5.0;

const MM = 0.001;
export const redondearMM = (value) => Math.round(Number(value) / MM) * MM;

// misma fórmula que usa materializeFloorProposal (floorProposal.js) para la profundidad
// de la banda del frente: se duplica acá (como ya se duplica BAND_MIN_DEPTH) porque este
// módulo necesita saber, antes de dibujar nada, si la longitud del núcleo se queda dentro
// de la banda del frente o la supera.
function calcularBandDepth(crujias, fondo, corredorProfundidad) {
  if (!Number.isFinite(fondo)) return 0;
  const depth = crujias === 2 ? (fondo - corredorProfundidad) / 2 : fondo - corredorProfundidad;
  return Math.max(depth, 0);
}

const clampInt = (value, min, max, fallback) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

function elegirCrujias(crujias, fondo, corredorProfundidad) {
  if (crujias === 1 || crujias === 2) return crujias;
  const fondoNum = Number(fondo);
  if (!Number.isFinite(fondoNum)) return 1;
  return fondoNum >= 2 * BAND_MIN_DEPTH + corredorProfundidad ? 2 : 1;
}

/**
 * Reparte `disponible` metros entre `pesos` (anchos aproximados, >=0),
 * respetando `minimo` por unidad cuando el espacio alcanza. Si no alcanza para
 * que todas lleguen al mínimo, reparte proporcionalmente sin forzarlo (mejor
 * esfuerzo: el resultado sigue sumando exactamente `disponible`).
 *
 * Invariante: sum(resultado) === disponible (salvo error de punto flotante).
 *
 * @param {number[]} pesos
 * @param {number} disponible
 * @param {number} [minimo]
 * @returns {number[]}
 */
export function prorratearAnchos(pesos, disponible, minimo = MIN_ANCHO_UNIDAD) {
  const n = pesos.length;
  if (n === 0) return [];
  if (!(disponible > 0)) return pesos.map(() => 0);

  const pesosSaneados = pesos.map((p) => (Number.isFinite(p) && p > 0 ? p : 0));
  const anchos = new Array(n).fill(0);
  const fijo = new Array(n).fill(false);
  let libres = pesosSaneados.map((_, i) => i);
  let restante = disponible;

  for (let iter = 0; iter < n + 1 && libres.length; iter += 1) {
    const puedeForzarMinimo = libres.length * minimo <= restante + 1e-9;
    const sumaPesosLibres = libres.reduce((s, i) => s + pesosSaneados[i], 0);
    libres.forEach((i) => {
      anchos[i] = sumaPesosLibres > 0 ? (pesosSaneados[i] / sumaPesosLibres) * restante : restante / libres.length;
    });
    if (!puedeForzarMinimo) break; // sin margen: reparto proporcional simple, sin forzar el mínimo
    const bajoMinimo = libres.filter((i) => anchos[i] < minimo - 1e-9);
    if (!bajoMinimo.length) break; // ya todas cumplen el mínimo
    bajoMinimo.forEach((i) => { fijo[i] = true; anchos[i] = minimo; restante -= minimo; });
    libres = libres.filter((i) => !fijo[i]);
  }
  return anchos;
}

/**
 * Convierte el parti APROXIMADO de Tweedledum en uno EXACTO: anchos que suman
 * el frente disponible (frente − core.ancho), redondeados a milímetros, con
 * las unidades ordenadas por `orden` y posicionadas de izquierda a derecha
 * alrededor del core. Función pura: no muta `parti`.
 *
 * @param {object} parti - { sourceCabidaVersionId, crujias, corredorProfundidad, core:{posicion,ancho}, units:[{unitRef,orden,ancho,dormitorios,banos}] }
 * @param {{frente:number, fondo:number}} marco - dimensiones del marco orientado (metros)
 * @returns {object} parti exacto: { sourceCabidaVersionId, crujias, corredorProfundidad, core:{posicion,ancho}, units:[{unitRef,orden,ancho,x,dormitorios,banos}] }
 */
export function normalizarParti(parti = {}, { frente, fondo } = {}) {
  const frenteNum = Number(frente);
  if (!(frenteNum > 0)) throw new RangeError("normalizarParti requiere un frente > 0");

  const corredorEntrada = Number(parti.corredorProfundidad);
  const corredorProfundidad = corredorEntrada > 0 ? corredorEntrada : CORREDOR_PROFUNDIDAD_DEFAULT;
  const crujias = elegirCrujias(parti.crujias, fondo, corredorProfundidad);

  // el core siempre necesita algo de ancho; si el aproximado es absurdo (<=0 o
  // más grande que el propio frente) se acota dejando margen para al menos una
  // unidad al mínimo constructivo.
  const coreAnchoBruto = Number(parti.core?.ancho);
  const coreAnchoSano = Number.isFinite(coreAnchoBruto) && coreAnchoBruto > 0 ? coreAnchoBruto : MIN_ANCHO_UNIDAD;
  const coreAncho = Math.min(coreAnchoSano, Math.max(0.01, frenteNum - 0.01));
  const disponible = Math.max(0, frenteNum - coreAncho);

  // longitud: penetración aproximada del núcleo desde el frente (metros). Absurda si
  // falta, es <=0, o es mayor que el fondo disponible del marco entero (nadie puede
  // atravesar más que el propio lote): en ese caso cae al default, acotado al fondo de
  // la banda del frente (si esa banda es más angosta que el default, el default no la
  // puede exceder). Un valor válido SÍ puede superar la banda del frente a propósito
  // (double crujía, el núcleo penetra la banda del fondo): eso no es absurdo, es la
  // Tarea 4 del contrato.
  const fondoNum = Number(fondo);
  const bandDepthFrente = calcularBandDepth(crujias, fondoNum, corredorProfundidad);
  const longitudBruta = Number(parti.core?.longitud);
  const longitudAbsurda = !Number.isFinite(longitudBruta) || longitudBruta <= 0
    || (Number.isFinite(fondoNum) && longitudBruta > fondoNum);
  const longitudDefault = Math.min(CORE_LONGITUD_DEFAULT, bandDepthFrente > 0 ? bandDepthFrente : (Number.isFinite(fondoNum) ? fondoNum : CORE_LONGITUD_DEFAULT));
  const coreLongitud = redondearMM(longitudAbsurda ? longitudDefault : Math.min(longitudBruta, Number.isFinite(fondoNum) ? fondoNum : longitudBruta));
  // ¿el núcleo penetra la banda del fondo? Solo importa con crujía doble: si no la
  // supera, la banda del fondo queda libre a todo lo ancho (Tarea 4); si la supera, esa
  // banda se reparte alrededor del núcleo como ya hacía antes de existir `longitud`.
  const nucleoExcedeBandaFrente = coreLongitud > bandDepthFrente + 0.001;

  const unitsOrdenados = (Array.isArray(parti.units) ? parti.units : [])
    .map((u, index) => {
      // banda: 1 = frente, 2 = fondo. Cualquier valor ausente o inválido cae a 1 (misma
      // tolerancia que ya aplica schemas.js del lado del servidor).
      const bandaRaw = Number(u?.banda);
      const banda = bandaRaw === 1 || bandaRaw === 2 ? bandaRaw : 1;
      return {
        unitRef: String(u?.unitRef ?? `unit-${index + 1}`),
        orden: Number.isFinite(Number(u?.orden)) ? Number(u.orden) : index + 1,
        anchoAprox: Number(u?.ancho) > 0 ? Number(u.ancho) : 0,
        dormitorios: clampInt(u?.dormitorios, 1, 3, 1),
        banos: clampInt(u?.banos, 1, 9, 1),
        banda,
      };
    })
    .sort((a, b) => a.orden - b.orden);

  const coreAnchoMM = redondearMM(coreAncho);

  if (!unitsOrdenados.length) {
    return {
      sourceCabidaVersionId: String(parti.sourceCabidaVersionId || ""),
      crujias,
      corredorProfundidad,
      core: { posicion: redondearMM(0), ancho: coreAnchoMM, longitud: coreLongitud },
      units: [],
    };
  }

  // ¿cuántas unidades (en orden, dentro de la banda que se está posicionando) caen antes
  // del core, según la posición y los anchos APROXIMADOS de Tweedledum? Esta cuenta no
  // necesita ser exacta: solo decide el lado del core en el que cae cada unidad; la
  // posición final del core se deriva de los anchos ya exactos de las unidades a su
  // izquierda en la banda de referencia (ver más abajo).
  const posicionAprox = Number(parti.core?.posicion);
  const posicionAproxSana = Number.isFinite(posicionAprox) ? Math.max(0, posicionAprox) : 0;
  const calcularIndiceCorte = (units) => {
    let acumulado = 0;
    let indiceCorte = units.length;
    for (let i = 0; i < units.length; i += 1) {
      if (acumulado >= posicionAproxSana) { indiceCorte = i; break; }
      acumulado += units[i].anchoAprox;
    }
    return indiceCorte;
  };

  // redondeo a milímetros con el residuo acumulado volcado a la última unidad (por
  // orden): el mismo criterio que ya usa rebalancear() para no perder ni ganar ancho
  // total al redondear.
  const prorratearAnchosMM = (units, disponibleBanda) => {
    const pesos = units.map((u) => u.anchoAprox);
    const anchosExactos = prorratearAnchos(pesos, disponibleBanda);
    let residuo = 0;
    const anchosMM = anchosExactos.map((w) => {
      const redondeado = redondearMM(w);
      residuo += w - redondeado;
      return redondeado;
    });
    if (anchosMM.length) {
      anchosMM[anchosMM.length - 1] = redondearMM(anchosMM[anchosMM.length - 1] + residuo);
    }
    return anchosMM;
  };

  const colocar = (units, anchosMM, cursorInicial) => {
    const salida = [];
    let cursor = cursorInicial;
    units.forEach((u, i) => {
      const ancho = anchosMM[i];
      salida.push({ unitRef: u.unitRef, orden: u.orden, ancho, x: redondearMM(cursor), dormitorios: u.dormitorios, banos: u.banos, banda: u.banda });
      cursor = redondearMM(cursor + ancho);
    });
    return { salida, cursorFinal: cursor };
  };

  // Con crujía simple, banda se ignora por completo: todas las unidades van a la única
  // banda, exactamente igual que antes. Con crujía doble, se reparten según su banda
  // declarada; si ninguna unidad declara banda 2, "band2" queda vacía y el resultado es
  // idéntico al de antes (compatibilidad) — es el mismo código, sin una rama aparte.
  const usaBandas = crujias === 2;
  const band1 = usaBandas ? unitsOrdenados.filter((u) => u.banda !== 2) : unitsOrdenados;
  const band2 = usaBandas ? unitsOrdenados.filter((u) => u.banda === 2) : [];
  // La banda de referencia fija la posición y el ancho del core (que atraviesa ambas
  // bandas): se usa la banda 1 si tiene unidades; si está vacía (todas las unidades
  // declararon banda 2), se usa la banda 2 en su lugar.
  const bandaReferencia = band1.length ? band1 : band2;
  const bandaOtra = bandaReferencia === band1 ? band2 : band1;

  const indiceCorteRef = calcularIndiceCorte(bandaReferencia);
  const anchosRefMM = prorratearAnchosMM(bandaReferencia, disponible);
  const izquierdaRef = colocar(bandaReferencia.slice(0, indiceCorteRef), anchosRefMM.slice(0, indiceCorteRef), 0);
  const corePosicion = izquierdaRef.cursorFinal;
  const derechaRef = colocar(
    bandaReferencia.slice(indiceCorteRef),
    anchosRefMM.slice(indiceCorteRef),
    redondearMM(corePosicion + coreAnchoMM),
  );

  // La banda restante no fija el core. Si es la banda del fondo (la física, banda 2) Y
  // el núcleo no la alcanza (su longitud no supera la banda del frente), el núcleo no la
  // interrumpe en absoluto: se reparte a todo el frente, igual que si el core no
  // existiera (Tarea 4, doble crujía). Si el núcleo SÍ la alcanza — o si la "otra" banda
  // resultó ser la banda 1 física (caso raro: todas las unidades declararon banda 2, ver
  // arriba), donde el núcleo siempre la atraviesa porque arranca en el frente — encaja en
  // los mismos huecos izquierdo/derecho que ya definió la banda de referencia, como
  // siempre: el core queda como una sola columna que atraviesa ambas bandas sin que
  // ninguna se solape con él.
  const otraEsBandaDelFondo = bandaOtra === band2;
  let unitsOtra = [];
  if (bandaOtra.length) {
    if (otraEsBandaDelFondo && !nucleoExcedeBandaFrente) {
      const anchosOtraMM = prorratearAnchosMM(bandaOtra, frenteNum);
      unitsOtra = colocar(bandaOtra, anchosOtraMM, 0).salida;
    } else {
      const leftWidth = corePosicion;
      const rightWidth = redondearMM(disponible - leftWidth);
      const indiceCorteOtra = calcularIndiceCorte(bandaOtra);
      const izquierdaOtraUnits = bandaOtra.slice(0, indiceCorteOtra);
      const derechaOtraUnits = bandaOtra.slice(indiceCorteOtra);
      const anchosIzqOtraMM = prorratearAnchosMM(izquierdaOtraUnits, leftWidth);
      const anchosDerOtraMM = prorratearAnchosMM(derechaOtraUnits, rightWidth);
      const izquierdaOtra = colocar(izquierdaOtraUnits, anchosIzqOtraMM, 0);
      const derechaOtra = colocar(derechaOtraUnits, anchosDerOtraMM, redondearMM(corePosicion + coreAnchoMM));
      unitsOtra = [...izquierdaOtra.salida, ...derechaOtra.salida];
    }
  }

  return {
    sourceCabidaVersionId: String(parti.sourceCabidaVersionId || ""),
    crujias,
    corredorProfundidad,
    core: { posicion: redondearMM(corePosicion), ancho: coreAnchoMM, longitud: coreLongitud },
    units: [...izquierdaRef.salida, ...derechaRef.salida, ...unitsOtra],
  };
}
