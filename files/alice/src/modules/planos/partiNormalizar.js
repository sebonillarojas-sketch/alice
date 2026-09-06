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

// --- Terrazas por unidad y patios de banda --------------------------------------------
// Dos figuras nuevas sobre la misma placa de rectángulos: una terraza le quita
// profundidad a SU unidad (contra la fachada de su banda) y la ocupa; un patio es una
// ranura vacía más en el orden de una banda. Las dos quedan rectangulares por
// construcción — nunca se recorta con un algoritmo que admita cóncavos.
export const TERRAZA_MIN_UTIL = 1.20; // por debajo de esto no vale la pena construirla
export const TERRAZA_UNIDAD_MIN_PROFUNDIDAD = 4.00; // la unidad nunca queda más angosta que esto
export const PATIO_MIN_ANCHO = 2.10; // pozo de luz mínimo en edificación multifamiliar

// Satura la terraza APROXIMADA que pidió el agente para una unidad contra los dos
// mínimos del contrato: 1.20 m para que sea útil, nunca dejar la propia unidad por
// debajo de 4.00 m de profundidad (bandDepth = profundidad total de la banda de esa
// unidad). Si hay que tocar el número, se recorta LA TERRAZA (nunca la unidad) y se
// devuelve un aviso — mismo patrón que avisosCore, más arriba: nada de ajustes en
// silencio. terraza:0 (o ausente) es "no pidió terraza": no genera aviso.
function saneaTerraza(terrazaAprox, bandDepth) {
  const pedida = Number(terrazaAprox);
  if (!Number.isFinite(pedida) || pedida <= 0) return { terraza: 0, aviso: null };
  const maxUtil = Math.max(0, bandDepth - TERRAZA_UNIDAD_MIN_PROFUNDIDAD);
  let terraza = Math.max(pedida, TERRAZA_MIN_UTIL);
  if (terraza > maxUtil + 1e-9) terraza = maxUtil;
  terraza = redondearMM(Math.max(0, terraza));
  if (terraza <= 1e-6) {
    return { terraza: 0, aviso: { motivo: "sin_espacio", pedida: redondearMM(pedida) } };
  }
  if (Math.abs(terraza - pedida) > 1e-6) {
    const motivo = terraza > pedida ? "elevada_al_minimo" : "recortada_por_minimo_unidad";
    return { terraza, aviso: { motivo, pedida: redondearMM(pedida), valor: terraza } };
  }
  return { terraza, aviso: null };
}

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
  const longitudProvista = parti.core?.longitud !== undefined && parti.core?.longitud !== null;
  const longitudBruta = Number(parti.core?.longitud);
  const longitudAbsurda = !Number.isFinite(longitudBruta) || longitudBruta <= 0
    || (Number.isFinite(fondoNum) && longitudBruta > fondoNum);
  const longitudDefault = Math.min(CORE_LONGITUD_DEFAULT, bandDepthFrente > 0 ? bandDepthFrente : (Number.isFinite(fondoNum) ? fondoNum : CORE_LONGITUD_DEFAULT));
  const coreLongitudBase = redondearMM(longitudAbsurda ? longitudDefault : Math.min(longitudBruta, Number.isFinite(fondoNum) ? fondoNum : longitudBruta));

  // avisosCore: qué campos del núcleo tuvo que rellenar o acotar este motor porque
  // Tweedledum no mandó una decisión utilizable (o mandó una que no cierra contra el
  // fondo). materializeFloorProposal (floorProposal.js) vuelca esto a `tradeoffs` en
  // texto legible — nunca un default silencioso.
  const avisosCore = [];
  if (longitudAbsurda) {
    avisosCore.push({ campo: "longitud", motivo: longitudProvista ? "invalida" : "ausente", valor: coreLongitudBase });
  }

  // distanciaAlFrente: metros desde el frente (v=0) hasta donde empieza el núcleo.
  // Aproximado, como todo el contrato. 0 (núcleo pegado al frente) es el default cuando
  // falta o es absurda (no numérica o negativa) — y a diferencia de `longitud`, ausente
  // NUNCA se reporta como relleno: 0 es exactamente el comportamiento de siempre, no una
  // decisión que el motor le esconda al agente (criterio de compatibilidad). Un valor SÍ
  // provisto pero inválido (negativo, mal tipado) sí se reporta: ahí el agente mandó
  // algo que no se pudo usar.
  const distanciaAlFrenteProvista = parti.core?.distanciaAlFrente !== undefined && parti.core?.distanciaAlFrente !== null;
  const distanciaAlFrenteBruta = Number(parti.core?.distanciaAlFrente);
  const distanciaAlFrenteValida = Number.isFinite(distanciaAlFrenteBruta) && distanciaAlFrenteBruta >= 0;
  const distanciaAlFrenteSana = distanciaAlFrenteValida ? distanciaAlFrenteBruta : 0;
  if (distanciaAlFrenteProvista && !distanciaAlFrenteValida) {
    avisosCore.push({ campo: "distanciaAlFrente", motivo: "invalida", valor: distanciaAlFrenteSana });
  }

  // distanciaAlFrente + longitud nunca puede exceder el fondo disponible del marco
  // entero: si excede, se recorta LONGITUD (nunca la distancia — esa es la decisión del
  // agente, no se mueve).
  let coreLongitud = coreLongitudBase;
  if (Number.isFinite(fondoNum) && distanciaAlFrenteSana + coreLongitud > fondoNum + 1e-9) {
    coreLongitud = redondearMM(Math.max(0, fondoNum - distanciaAlFrenteSana));
    avisosCore.push({ campo: "longitud", motivo: "acotada", valor: coreLongitud });
  }

  // ¿el núcleo penetra la banda del fondo? Solo importa con crujía doble: si no la
  // supera, la banda del fondo queda libre a todo lo ancho (Tarea 4); si la supera, esa
  // banda se reparte alrededor del núcleo como ya hacía antes de existir `longitud`. Se
  // mide desde el fondo real del núcleo (distanciaAlFrente + longitud), no solo la
  // longitud: con distanciaAlFrente=0 (el default/compatibilidad) esto es idéntico a la
  // fórmula de siempre.
  const nucleoExcedeBandaFrente = distanciaAlFrenteSana + coreLongitud > bandDepthFrente + 0.001;

  const unitsMapeadas = (Array.isArray(parti.units) ? parti.units : [])
    .map((u, index) => {
      // banda: 1 = frente, 2 = fondo. Cualquier valor ausente o inválido cae a 1 (misma
      // tolerancia que ya aplica schemas.js del lado del servidor).
      const bandaRaw = Number(u?.banda);
      const banda = bandaRaw === 1 || bandaRaw === 2 ? bandaRaw : 1;
      // terraza: se sanea acá contra la profundidad de la banda (bandDepthFrente vale
      // igual para banda 1 y banda 2 — ver calcularBandDepth, ambas bandas son simétricas
      // en este motor) — nunca contra el ancho, que se prorratea después.
      const { terraza, aviso: terrazaAviso } = saneaTerraza(u?.terraza, bandDepthFrente);
      return {
        isPatio: false,
        unitRef: String(u?.unitRef ?? `unit-${index + 1}`),
        orden: Number.isFinite(Number(u?.orden)) ? Number(u.orden) : index + 1,
        anchoAprox: Number(u?.ancho) > 0 ? Number(u.ancho) : 0,
        dormitorios: clampInt(u?.dormitorios, 1, 3, 1),
        banos: clampInt(u?.banos, 1, 9, 1),
        banda,
        terraza,
        terrazaAviso,
      };
    });

  // patios: ranuras vacías que se intercalan en el orden de su banda, exactamente como
  // una unidad más (mismo espacio de `orden`), pero sin programa. Su ancho ya sale
  // saneado al mínimo (PATIO_MIN_ANCHO) de esta etapa — no participa del prorrateo por
  // peso de las unidades reales (ver prorratearAnchosMM más abajo): se reserva tal cual.
  const patiosAvisos = [];
  const patiosMapeados = (Array.isArray(parti.patios) ? parti.patios : [])
    .map((p, index) => {
      const bandaRaw = Number(p?.banda);
      const banda = bandaRaw === 1 || bandaRaw === 2 ? bandaRaw : 1;
      const ordenRaw = Number(p?.orden);
      const orden = Number.isFinite(ordenRaw) ? ordenRaw : index + 1;
      const anchoPedido = Number(p?.ancho) > 0 ? Number(p.ancho) : 0;
      let ancho = anchoPedido;
      if (ancho > 0 && ancho < PATIO_MIN_ANCHO) {
        ancho = PATIO_MIN_ANCHO;
        patiosAvisos.push({ banda, orden, motivo: "elevado_al_minimo", pedido: redondearMM(anchoPedido), valor: PATIO_MIN_ANCHO });
      }
      ancho = redondearMM(ancho);
      return { isPatio: true, unitRef: null, orden, banda, ancho, anchoAprox: ancho, dormitorios: null, banos: null, terraza: 0, terrazaAviso: null };
    })
    .filter((p) => p.ancho > 0);

  // ¿algún patio no entra en su banda? Se chequea contra `disponible` (frente − core),
  // la cota más conservadora que usan las dos bandas (la banda "otra" a veces llega a
  // usar el frente completo — más generoso, nunca menos): si un patio no entra ni ahí,
  // se descarta entero y se reporta — nunca se le quita ancho a una unidad real para
  // hacerle lugar.
  const patiosPorBanda = { 1: [], 2: [] };
  patiosMapeados.forEach((p, idx) => patiosPorBanda[p.banda].push({ idx, ancho: p.ancho }));
  const descartarPatio = new Set();
  [1, 2].forEach((b) => {
    let usado = 0;
    patiosPorBanda[b].forEach(({ idx, ancho }) => {
      if (usado + ancho > disponible + 1e-9) {
        descartarPatio.add(idx);
        patiosAvisos.push({ banda: b, orden: patiosMapeados[idx].orden, motivo: "descartado_sin_espacio", valor: ancho });
      } else usado += ancho;
    });
  });
  const patiosFiltrados = patiosMapeados.filter((_, idx) => !descartarPatio.has(idx));

  const unitsOrdenados = [...unitsMapeadas, ...patiosFiltrados].sort((a, b) => a.orden - b.orden);

  const coreAnchoMM = redondearMM(coreAncho);

  if (!unitsMapeadas.length) {
    return {
      sourceCabidaVersionId: String(parti.sourceCabidaVersionId || ""),
      crujias,
      corredorProfundidad,
      core: { posicion: redondearMM(0), ancho: coreAnchoMM, longitud: coreLongitud, distanciaAlFrente: redondearMM(distanciaAlFrenteSana), avisos: avisosCore },
      units: [],
      patiosAvisos,
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
  // Los patios no pesan en el prorrateo: se reservan tal cual (ya saneados a su mínimo) y
  // solo las unidades reales se reparten proporcionalmente lo que sobra — mismo redondeo
  // a milímetros de siempre (residuo volcado a la última unidad real, nunca a un patio).
  const prorratearAnchosMM = (units, disponibleBanda) => {
    const anchoPatiosTotal = units.reduce((s, u) => s + (u.isPatio ? u.ancho : 0), 0);
    const disponibleUnidades = Math.max(0, disponibleBanda - anchoPatiosTotal);
    const idxUnidades = [];
    const pesos = [];
    units.forEach((u, i) => { if (!u.isPatio) { idxUnidades.push(i); pesos.push(u.anchoAprox); } });
    const anchosExactos = prorratearAnchos(pesos, disponibleUnidades);
    const anchosMM = new Array(units.length).fill(0);
    let residuo = 0;
    idxUnidades.forEach((i, k) => {
      const redondeado = redondearMM(anchosExactos[k]);
      residuo += anchosExactos[k] - redondeado;
      anchosMM[i] = redondeado;
    });
    if (idxUnidades.length) {
      const last = idxUnidades[idxUnidades.length - 1];
      anchosMM[last] = redondearMM(anchosMM[last] + residuo);
    }
    units.forEach((u, i) => { if (u.isPatio) anchosMM[i] = u.ancho; });
    return anchosMM;
  };

  const colocar = (units, anchosMM, cursorInicial) => {
    const salida = [];
    let cursor = cursorInicial;
    units.forEach((u, i) => {
      const ancho = anchosMM[i];
      if (u.isPatio) {
        salida.push({ isPatio: true, orden: u.orden, ancho, x: redondearMM(cursor), banda: u.banda });
      } else {
        salida.push({
          unitRef: u.unitRef, orden: u.orden, ancho, x: redondearMM(cursor),
          dormitorios: u.dormitorios, banos: u.banos, banda: u.banda,
          terraza: u.terraza, terrazaAviso: u.terrazaAviso,
        });
      }
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
    core: { posicion: redondearMM(corePosicion), ancho: coreAnchoMM, longitud: coreLongitud, distanciaAlFrente: redondearMM(distanciaAlFrenteSana), avisos: avisosCore },
    units: [...izquierdaRef.salida, ...derechaRef.salida, ...unitsOtra],
    patiosAvisos,
  };
}
