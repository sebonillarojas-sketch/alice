// Vanos derivados sobre el grafo de muros (§7-8 de
// docs/superpowers/specs/2026-09-07-muros-vanos-design.md).
//
// Puertas: la regla de conectividad ataca los espacios inaccesibles POR CONSTRUCCIÓN,
// no detectándolos. Cada unidad recibe una entrada y un árbol de recubrimiento sobre
// sus muros "interior" garantiza que todo ambiente de la unidad tiene camino real
// (con puerta) hacia esa entrada. El núcleo (escalera/ascensor/hall núcleo) NO es una
// unidad — no tiene unitRef — y se resuelve aparte, con sus propias reglas (§7, nota
// final): puerta desde el corredor en todo muro `a_nucleo`, puerta hall→pieza en los
// `nucleo` que tocan el hall, nada entre escalera y ascensor.
//
// Ventanas: el ancho sale del catálogo existente (mobiliario.js) aproximado por área
// del ambiente — es un SUPUESTO declarado (se registra como aviso), nunca una
// afirmación de cumplimiento normativo. No hay evidencia verificada de RNE acá y el
// sistema tiene prohibido declarar conformidad sin ella.
//
// Módulo puro: sin React, sin estado, sin I/O.
import { area as polygonArea } from "./geometry.js";
import { porId as CATALOGO_POR_ID } from "./mobiliario.js";

// Holgura mínima del §7.5: 0.15 m contra cada extremo del muro.
const HOLGURA_MIN = 0.15;
const EPS = 1e-6;

const round3 = (n) => Math.round(n * 1000) / 1000;

const normTxt = (s) =>
  (s || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

const textoDe = (room) => `${normTxt(room?.tipo)} ${normTxt(room?.name)}`;

// §7.4: ancho de puerta por ambiente de DESTINO. Match por palabra clave sobre
// tipo+nombre, no por igualdad estricta de `tipo`: los datos reales traen
// "sala-comedor" con tipo "social" para el living, "pasillo" para el hall interior de
// la unidad, etc. — una igualdad estricta contra "dormitorio"/"baño"/... se queda muda
// justo en los ambientes que más puertas reciben. Ver distribucion.js/reglas.js.
function anchoPuertaPorDestino(room) {
  const s = textoDe(room);
  if (/ba[nñ]o/.test(s)) return 0.80;
  if (/dorm/.test(s)) return 0.80;
  if (/cocina/.test(s)) return 0.90;
  if (/sala|comedor|estar|social/.test(s)) return 1.00;
  return 0.80; // "lo que no reconozcas, 0.80" (pliego §7.4)
}

// §8: qué ambientes piden luz.
//
// CORRECCIÓN sobre el pliego (anotada para el reporte): el pliego enumera "sala,
// comedor, estar" como si fueran ambientes propios, pero el generador real
// (distribucion.js `room("sala-comedor", "social", ...)`, `room("studio", "social",
// ...)`) nunca produce un ambiente con tipo/nombre "sala" o "comedor" sueltos — el
// living siempre sale como un único ambiente combinado con tipo "social". Matchear
// literal esas tres palabras habría dejado el living real sin pedir ventana jamás, que
// es exactamente el síntoma que este módulo existe para evitar. Se agrega "social" al
// patrón de luz.
const NO_PIDE_LUZ = /ba[nñ]o|clo?set|lavand|pasillo|corredor|dep[oó]sito|deposito|hall/;
const PIDE_LUZ = /dorm|sala|comedor|estar|cocina|estudio|social/;
function pideLuz(room) {
  const s = textoDe(room);
  if (NO_PIDE_LUZ.test(s)) return false;
  return PIDE_LUZ.test(s);
}

const esVoid = (room) => normTxt(room?.tipo) === "void";
const esUnidad = (room) => room?.unitRef != null;

// ¿admite `ancho` con 0.15 m de holgura a cada lado, centrado?
function cabeEnMuro(largoMuro, ancho) {
  return largoMuro - ancho >= 2 * HOLGURA_MIN - EPS;
}

// de una lista de muros que ya se sabe conectan el par correcto, el de mayor largo
// que admite `ancho` con la holgura del §7.5 (o null si ninguno sirve).
function elegirMuro(candidatos, ancho) {
  const ordenados = [...candidatos].sort((a, b) => b.largo - a.largo);
  return ordenados.find((m) => cabeEnMuro(m.largo, ancho)) || null;
}

function nuevoVano(id, muro, ancho, tipo, entre) {
  return { id: `vano_${id}`, muroId: muro.id, t: round3(muro.largo / 2), ancho, tipo, entre };
}

// §8: ancho de ventana del catálogo existente por área. Aproximación DECLARADA, no una
// verificación normativa — ver nota de módulo. El umbral (12 m²) es un criterio propio
// de este módulo, no una cita de norma.
function ventanaPorArea(areaRoom) {
  return areaRoom >= 12 ? CATALOGO_POR_ID["ventana-180"] : CATALOGO_POR_ID["ventana-120"];
}

/**
 * Deriva puertas y ventanas del grafo de muros (§7-8 del spec).
 * @param {Array} muros - salida de construirMuros(rooms, contexto).muros
 * @param {Array} rooms - los mismos ambientes pasados a construirMuros
 * @param {Object} contexto - no lo usa hoy; se acepta por simetría con construirMuros
 * @returns {{ vanos: Array, hallazgos: Array, avisos: string[] }}
 */
export function construirVanos(muros = [], rooms = [], contexto = {}) {
  const avisos = [];
  const hallazgos = [];
  const vanos = [];
  let autoId = 1;

  const roomsById = new Map((rooms || []).filter((r) => r?.id != null).map((r) => [r.id, r]));
  const realRooms = (rooms || []).filter((r) => Array.isArray(r?.pts) && r.pts.length >= 3 && !esVoid(r));

  const agregarVano = (muro, ancho, tipo, entre) => vanos.push(nuevoVano(autoId++, muro, ancho, tipo, entre));

  // ================= §7: puertas dentro de cada unidad =================
  const unidades = new Map(); // unitRef -> Set(roomId)
  for (const r of realRooms) {
    if (!esUnidad(r)) continue;
    if (!unidades.has(r.unitRef)) unidades.set(r.unitRef, new Set());
    unidades.get(r.unitRef).add(r.id);
  }

  for (const [unitRef, roomIds] of unidades) {
  // Preferencia arquitectónica de un paso entre dos ambientes. Menor es mejor.
  // Sin esto el árbol conecta por adyacencia y sale una vivienda que nadie construiría:
  // se entra al departamento por un dormitorio y se pasa de un dormitorio al otro.
  const zonaDe = (room) => {
    const t = (room?.tipo || "").toLowerCase();
    if (t === "social" || t === "pasillo" || t === "circulacion" || t === "corredor") return "estar";
    if (t === "intima") return "intima";
    return "servicio";
  };
  const costoPaso = (ra, rb) => {
    const za = zonaDe(ra), zb = zonaDe(rb);
    if (za === "estar" || zb === "estar") return 0;   // por el estar se pasa a todo
    if (za === "intima" && zb === "intima") return 5; // dormitorio a dormitorio: casi nunca
    if (za === "intima" || zb === "intima") return 1; // baño en suite: aceptable
    return 2;                                          // servicio con servicio
  };

    // 1. la entrada: el muro a_corredor más largo de la unidad, con ancho por el
    // ambiente al que da del lado de la unidad.
    const aCorredor = muros.filter((m) => m.clase === "a_corredor" && m.lados.some((id) => roomIds.has(id)));
    if (aCorredor.length === 0) {
      hallazgos.push({
        codigo: "unidad_sin_acceso",
        mensaje: `unidad "${unitRef}": ningún muro a_corredor — no tiene por dónde entrar, no se inventa una entrada contra una medianera`,
        roomId: unitRef,
      });
      continue;
    }

    // Se entra por donde entraría una persona: primero un ambiente de estar, después
    // servicio, y solo si no queda otra por un dormitorio. A igual zona, el muro más largo.
    const zonaEntrada = (m) => zonaDe(roomsById.get(m.lados.find((id) => roomIds.has(id))));
    const rankZona = { estar: 0, servicio: 1, intima: 2 };
    const candidatosEntrada = [...aCorredor].sort((a, b) =>
      (rankZona[zonaEntrada(a)] - rankZona[zonaEntrada(b)]) || (b.largo - a.largo));
    let muroEntrada = null, roomEntrada = null, corredorRoomId = null, anchoEntrada = null;
    for (const m of candidatosEntrada) {
      const ladoUnidad = m.lados.find((id) => roomIds.has(id));
      const ladoOtro = m.lados.find((id) => id !== ladoUnidad);
      const ancho = anchoPuertaPorDestino(roomsById.get(ladoUnidad));
      if (cabeEnMuro(m.largo, ancho)) {
        muroEntrada = m; roomEntrada = ladoUnidad; corredorRoomId = ladoOtro; anchoEntrada = ancho;
        break;
      }
    }
    if (!muroEntrada) {
      const mayor = candidatosEntrada[0];
      const ladoUnidad = mayor.lados.find((id) => roomIds.has(id));
      const ladoOtro = mayor.lados.find((id) => id !== ladoUnidad);
      hallazgos.push({
        codigo: "sin_muro_para_puerta",
        mensaje: `unidad "${unitRef}": ningún muro a_corredor admite una puerta (mejor candidato "${ladoUnidad}"–"${ladoOtro}", ${mayor.largo} m disponibles)`,
        roomId: ladoUnidad,
      });
      continue;
    }
    agregarVano(muroEntrada, anchoEntrada, "puerta", [roomEntrada, corredorRoomId]);
    avisos.push(`unidad "${unitRef}": entrada por muro ${muroEntrada.id} (${muroEntrada.largo} m) hacia "${roomEntrada}"`);
    // Si la única forma de entrar es por un dormitorio, el reparto de la unidad está mal:
    // ningún ambiente de estar llega al corredor. El motor no puede arreglarlo desde acá
    // —es una decisión de volumen, no de interior— pero callarlo sería dibujar el error.
    if (zonaDe(roomsById.get(roomEntrada)) === "intima") {
      hallazgos.push({
        codigo: "entrada_por_dormitorio",
        mensaje: `unidad "${unitRef}": se entra por "${roomEntrada}", que es un dormitorio — ningún ambiente de estar llega al corredor`,
        roomId: roomEntrada,
      });
    }

    // 2. grafo de adyacencia interior de la unidad: se arma sobre TODOS los muros
    // "interior" que conectan dos ambientes de esta unidad, sin filtrar por si el vano
    // cabe — eso se decide recién al plantar la puerta, en el paso 4.
    const vecinos = new Map();
    const paresInteriores = new Map(); // "a|b" (ids ordenados) -> muros[]
    for (const id of roomIds) vecinos.set(id, new Set());
    for (const m of muros) {
      if (m.clase !== "interior" || m.lados.length !== 2) continue;
      const [a, b] = m.lados;
      if (!roomIds.has(a) || !roomIds.has(b)) continue;
      vecinos.get(a).add(b);
      vecinos.get(b).add(a);
      const key = [a, b].sort().join("|");
      if (!paresInteriores.has(key)) paresInteriores.set(key, []);
      paresInteriores.get(key).push(m);
    }

    // 3. alcance TOPOLÓGICO desde la entrada (BFS que ignora si el vano cabe): separa
    // "no toca nada" de "toca algo pero ningún muro admite la puerta" — son dos
    // hallazgos distintos (§7.6 vs. §7.5) y conviene no confundirlos.
    const topo = new Set([roomEntrada]);
    {
      const colaTopo = [roomEntrada];
      while (colaTopo.length) {
        const actual = colaTopo.shift();
        for (const vecino of vecinos.get(actual) || []) {
          if (!topo.has(vecino)) { topo.add(vecino); colaTopo.push(vecino); }
        }
      }
    }

    // 4. árbol de recubrimiento CON reintento: si la puerta no cabe en el muro entre
    // el nodo que se está expandiendo y un vecino sin visitar, el vecino NO se
    // abandona — puede llegar más tarde por otro ambiente ya (o todavía no) visitado
    // que también lo toque. Solo si NINGÚN vecino logra plantarle una puerta queda de
    // verdad sin alcance real. Sin este reintento, un ambiente con dos paredes
    // compartidas —una angosta, una que sí admite la puerta— podía reportarse como
    // inaccesible solo por el orden en que el recorrido lo visitó primero.
    const visitado = new Set([roomEntrada]);
    const cola = [roomEntrada];
    const mejorFallo = new Map(); // roomId sin puerta -> { ancho, largo, origen }
    while (cola.length) {
      const actual = cola.shift();
      // Un ambiente de servicio —baño, clóset, lavandería, depósito— es SIEMPRE destino,
      // nunca pasillo: no se atraviesa un baño para llegar a un dormitorio. Si el árbol lo
      // usa de paso, esa unidad termina con un baño de tres puertas. Medido: pasaba en 3 de
      // los 13 baños de una planta.
      const esServicioTerminal = (id) => {
        const r = roomsById.get(id);
        return /ba[ñn]o|ss\.?hh|cl[oó]set|lavander|dep[oó]sito|ducha/i.test(r?.name || "");
      };
      if (actual !== roomEntrada && esServicioTerminal(actual)) continue;

      // orden de expansión por plausibilidad: si un ambiente se puede alcanzar por el
      // estar o por otro dormitorio, gana el estar.
      const porPreferencia = [...(vecinos.get(actual) || [])].sort((x, y) =>
        costoPaso(roomsById.get(actual), roomsById.get(x)) - costoPaso(roomsById.get(actual), roomsById.get(y)));
      for (const vecino of porPreferencia) {
        if (visitado.has(vecino)) continue;
        const key = [actual, vecino].sort().join("|");
        const candidatos = paresInteriores.get(key) || [];
        const ancho = anchoPuertaPorDestino(roomsById.get(vecino));
        const muro = elegirMuro(candidatos, ancho);
        if (muro) {
          visitado.add(vecino);
          // mejor-primero: se expanden antes los ambientes de estar, así son ellos los
          // que reparten las puertas al resto en vez de encadenarse cuarto tras cuarto.
          cola.push(vecino);
          cola.sort((x, y) => rankZona[zonaDe(roomsById.get(x))] - rankZona[zonaDe(roomsById.get(y))]);
          agregarVano(muro, ancho, "puerta", [actual, vecino]);
          // Un dormitorio que solo se alcanza atravesando otro dormitorio no es una
          // vivienda vendible. Se dibuja igual —hay que poder verlo— pero se reporta.
          if (zonaDe(roomsById.get(actual)) === "intima" && zonaDe(roomsById.get(vecino)) === "intima") {
            hallazgos.push({
              codigo: "paso_entre_dormitorios",
              mensaje: `"${vecino}" solo se alcanza atravesando "${actual}": dormitorio a dormitorio, sin pasar por un ambiente de estar`,
              roomId: vecino,
            });
          }
          continue;
        }
        const masLargo = [...candidatos].sort((a, b) => b.largo - a.largo)[0];
        const largoIntento = masLargo ? masLargo.largo : 0;
        const previo = mejorFallo.get(vecino);
        if (!previo || largoIntento > previo.largo) mejorFallo.set(vecino, { ancho, largo: largoIntento, origen: actual });
      }
    }

    for (const roomId of roomIds) {
      if (visitado.has(roomId)) continue;
      if (!topo.has(roomId)) {
        hallazgos.push({
          codigo: "ambiente_inaccesible",
          mensaje: `"${roomId}" (unidad "${unitRef}"): no toca ningún ambiente de la unidad por un muro interior`,
          roomId,
        });
        continue;
      }
      const info = mejorFallo.get(roomId);
      hallazgos.push({
        codigo: "sin_muro_para_puerta",
        mensaje: `"${info?.origen}"–"${roomId}": ningún muro interior admite una puerta de ${info?.ancho} m (mejor candidato ${info?.largo ?? 0} m disponibles)`,
        roomId,
      });
    }
  }

  // ================= §7 (nota final): el núcleo, que NO es una unidad =================
  // Escalera, ascensor y hall núcleo no tienen unitRef: si el bucle de arriba fuera lo
  // único, el núcleo se queda sin puertas y la escalera sin acceso. Regla explícita,
  // no un árbol de recubrimiento: puerta en todo muro a_nucleo (el corredor entra al
  // núcleo); puerta en todo muro `nucleo` que toque el hall (hall→escalera,
  // hall→ascensor); nada entre escalera y ascensor.
  const esNucleoRoom = (id) => /\bcore\b|nucleo/.test(`${normTxt(roomsById.get(id)?.tipo)} ${normTxt(roomsById.get(id)?.role)}`);
  const esHall = (id) => /hall/.test(normTxt(roomsById.get(id)?.name));

  const paresNucleo = new Map(); // "clase|a|b" -> muros[]
  for (const m of muros) {
    if ((m.clase !== "a_nucleo" && m.clase !== "nucleo") || m.lados.length !== 2) continue;
    const [a, b] = [...m.lados].sort();
    const key = `${m.clase}|${a}|${b}`;
    if (!paresNucleo.has(key)) paresNucleo.set(key, []);
    paresNucleo.get(key).push(m);
  }

  let nucleoEvaluados = 0;
  for (const [key, candidatos] of paresNucleo) {
    const [clase, a, b] = key.split("|");
    let destino;
    if (clase === "nucleo") {
      if (!(esHall(a) || esHall(b))) continue; // escalera contra ascensor: sin puerta, a propósito
      destino = esHall(a) ? b : a;
    } else {
      destino = esNucleoRoom(a) ? a : b;
    }
    const origen = destino === a ? b : a;
    nucleoEvaluados++;
    const ancho = anchoPuertaPorDestino(roomsById.get(destino));
    const muro = elegirMuro(candidatos, ancho);
    if (!muro) {
      hallazgos.push({
        codigo: "sin_muro_para_puerta",
        mensaje: `"${origen}"–"${destino}" (núcleo): ningún muro admite una puerta de ${ancho} m`,
        roomId: destino,
      });
      continue;
    }
    agregarVano(muro, ancho, "puerta", [origen, destino]);
  }
  if (nucleoEvaluados > 0) avisos.push(`núcleo: ${nucleoEvaluados} muro(s) de acceso evaluados (a_nucleo + nucleo→hall)`);

  // ================= §8: ventanas =================
  for (const room of realRooms) {
    if (!pideLuz(room)) continue;
    const candidatos = muros.filter((m) => m.lados.length === 1 && m.lados[0] === room.id && (m.clase === "fachada" || m.clase === "fachada_patio"));
    if (candidatos.length === 0) {
      hallazgos.push({
        codigo: "ambiente_sin_luz",
        mensaje: `"${room.id}": pide luz y no tiene ningún muro de fachada (ni fachada_patio)`,
        roomId: room.id,
      });
      continue;
    }
    const muroFachada = [...candidatos].sort((a, b) => b.largo - a.largo)[0];
    const areaRoom = round3(polygonArea(room.pts));
    const elegido = ventanaPorArea(areaRoom);
    const chica = CATALOGO_POR_ID["ventana-120"];

    let anchoFinal = null;
    if (cabeEnMuro(muroFachada.largo, elegido.w)) anchoFinal = elegido.w;
    else if (elegido.id !== chica.id && cabeEnMuro(muroFachada.largo, chica.w)) anchoFinal = chica.w;

    if (anchoFinal == null) {
      hallazgos.push({
        codigo: "ventana_no_cabe",
        mensaje: `"${room.id}": el muro de fachada más largo (${muroFachada.largo} m) no admite ni la ventana más chica del catálogo (${chica.w} m con holgura)`,
        roomId: room.id,
      });
      continue;
    }
    agregarVano(muroFachada, anchoFinal, "ventana", [room.id, null]);
    avisos.push(`ventana de "${room.id}": ${anchoFinal} m elegido por área (${areaRoom} m²) del catálogo existente — aproximación declarada, sin evidencia normativa verificada`);
  }

  return { vanos, hallazgos, avisos };
}

// ── Resolución geométrica de un vano ──────────────────────────────────────────────
// Un vano guarda `muroId` y `t` (metros desde el extremo `a`), nunca coordenadas propias.
// Esta función es la ÚNICA manera de obtener su posición en el plano, y la deriva del muro.
// Es a propósito: si el renderer calculara la posición por su cuenta, una puerta podría
// quedar desalineada del muro que dice ocupar, que es justo el defecto que veníamos de
// arreglar. Acá eso no puede pasar — la puerta no tiene posición propia que desalinear.
//
// Devuelve las coordenadas del mundo, no de pantalla: `angulo` en grados con la convención
// atan2(dy, dx). El mapeo a pantalla es del renderer.
export function resolverVano(vano, muro) {
  if (!vano || !muro) return null;
  const dx = muro.b.x - muro.a.x, dy = muro.b.y - muro.a.y;
  const largo = Math.hypot(dx, dy);
  if (!(largo > 0)) return null;
  const ux = dx / largo, uy = dy / largo;             // unitario a lo largo del muro
  const mitad = vano.ancho / 2;
  // se acota contra los extremos: aunque la colocación ya respeta la holgura, resolver
  // nunca debe devolver un vano que se salga del muro.
  const t = Math.min(Math.max(vano.t, mitad), largo - mitad);
  const cx = muro.a.x + ux * t, cy = muro.a.y + uy * t;
  return {
    centro: { x: cx, y: cy },
    p1: { x: cx - ux * mitad, y: cy - uy * mitad },
    p2: { x: cx + ux * mitad, y: cy + uy * mitad },
    angulo: Math.atan2(dy, dx) * 180 / Math.PI,
    ancho: vano.ancho,
    recortado: Math.abs(t - vano.t) > 1e-9,
  };
}

// ── Ajuste de vanos contra el mobiliario y contra otros vanos ─────────────────────
// La colocación por conectividad pone cada puerta centrada en su muro. Eso ignora dos
// cosas que en un plano de verdad mandan: que el barrido no puede pisar un mueble, y que
// dos puertas no pueden barrer sobre el mismo suelo.
//
// Se corrige moviendo la PUERTA, no el mueble. Una cama o una ducha están donde están por
// el muro que las admite o por las instalaciones; la puerta, en cambio, puede deslizarse a
// lo largo de su muro sin que nada más cambie. Medido sobre una planta de 7 unidades: 25
// barridos pisaban un mueble y 4 puertas se pisaban entre sí.

const r2v = (n) => Math.round(n * 100) / 100;
const cajaMueble = (t) => {
  const rot = ((t.rot || 0) % 180 + 180) % 180, vert = rot > 45 && rot < 135;
  const w = vert ? t.d : t.w, h = vert ? t.w : t.d;
  return { x0: t.x - w / 2, y0: t.y - h / 2, x1: t.x + w / 2, y1: t.y + h / 2 };
};
const pisan = (a, b, tol = 0.06) =>
  Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > tol && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > tol;

/** Caja del barrido de una hoja: el cuadrado de lado = ancho, apoyado en el vano, hacia `lado`. */
function cajaBarrido(muro, t, ancho, lado) {
  const L = Math.hypot(muro.b.x - muro.a.x, muro.b.y - muro.a.y);
  if (!(L > 0)) return null;
  const ux = (muro.b.x - muro.a.x) / L, uy = (muro.b.y - muro.a.y) / L;
  const nx = -uy * lado, ny = ux * lado, h = ancho / 2;
  const p1 = { x: muro.a.x + ux * (t - h), y: muro.a.y + uy * (t - h) };
  const p2 = { x: muro.a.x + ux * (t + h), y: muro.a.y + uy * (t + h) };
  const xs = [p1.x, p2.x, p1.x + nx * ancho, p2.x + nx * ancho];
  const ys = [p1.y, p2.y, p1.y + ny * ancho, p2.y + ny * ancho];
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/**
 * Desliza cada puerta a lo largo de su muro hasta que su barrido no pise ni un mueble ni el
 * barrido de otra puerta. Elige además el lado de giro con menos estorbo.
 *
 * Las entradas de unidad se resuelven primero: son las que menos margen tienen para moverse
 * y las que peor se ven mal puestas.
 *
 * @returns {{ vanos, movidos, sinLugar }} vanos con `t` ajustado y `lado` decidido
 */
export function ajustarVanos(vanos = [], muros = [], items = [], { paso = 0.08, margen = 0.15, rooms = [] } = {}) {
  const porId = new Map(muros.map((m) => [m.id, m]));
  const cajasMuebles = items.map(cajaMueble);
  const out = vanos.map((v) => ({ ...v }));
  const movidos = [], sinLugar = [];
  const yaPuestas = [];   // barridos ya fijados, que las siguientes tienen que respetar

  const orden = [...out.keys()].sort((i, j) => {
    const pri = (v) => (porId.get(v.muroId)?.clase === "a_corredor" ? 0 : 1);
    return pri(out[i]) - pri(out[j]);
  });

  for (const idx of orden) {
    const v = out[idx];
    if (v.tipo === "ventana") continue;
    const muro = porId.get(v.muroId);
    if (!muro) continue;
    const L = muro.largo, h = v.ancho / 2;
    const tMin = h + margen, tMax = L - h - margen;
    if (tMax < tMin) continue;                       // el muro no da ni para centrarla

    // candidatos: la posición actual primero, después alejándose de a poco a los dos lados
    const cands = [v.t];
    for (let d = paso; d <= L; d += paso) {
      if (v.t + d <= tMax) cands.push(r2v(v.t + d));
      if (v.t - d >= tMin) cands.push(r2v(v.t - d));
    }
    let puesto = null;
    for (const t of cands) {
      if (t < tMin - 1e-9 || t > tMax + 1e-9) continue;
      for (const lado of [1, -1]) {
        const b = cajaBarrido(muro, t, v.ancho, lado);
        if (!b) continue;
        // la hoja no puede cruzar un muro: una puerta no abre hacia adentro de otro cuarto
        if (rooms.length && barridoSaleDelAmbiente({ ...v, t }, muro, rooms, lado)) continue;
        if (cajasMuebles.some((c) => pisan(b, c))) continue;
        if (yaPuestas.some((c) => pisan(b, c))) continue;
        puesto = { t, lado, caja: b };
        break;
      }
      if (puesto) break;
    }
    if (puesto) {
      if (Math.abs(puesto.t - v.t) > 1e-6) {
        movidos.push({ id: v.id, de: v.t, a: puesto.t, motivo: "su barrido pisaba un mueble u otra puerta" });
      }
      v.t = puesto.t; v.lado = puesto.lado;
      yaPuestas.push(puesto.caja);
    } else {
      // se deja donde estaba, con el lado menos malo, y se reporta
      const b1 = cajaBarrido(muro, v.t, v.ancho, 1), b2 = cajaBarrido(muro, v.t, v.ancho, -1);
      const choques = (b) => b ? cajasMuebles.filter((c) => pisan(b, c)).length + yaPuestas.filter((c) => pisan(b, c)).length : 99;
      v.lado = choques(b1) <= choques(b2) ? 1 : -1;
      yaPuestas.push(cajaBarrido(muro, v.t, v.ancho, v.lado));
      sinLugar.push({ id: v.id, entre: v.entre,
        motivo: "no hay posición en este muro donde el barrido no pise algo: el ambiente está muy cargado" });
    }
  }
  return { vanos: out, movidos, sinLugar };
}

// ── Flujos de circulación ────────────────────────────────────────────────────────
// El recorrido que hace una persona dentro de la unidad: de la entrada a cada ambiente,
// cruzando las puertas. No se dibuja —es una planta, no un diagrama— pero OCUPA: un mueble
// puesto encima de un flujo es un mueble que hay que esquivar para vivir ahí.
//
// Es lo que faltaba para que el mobiliario dejara de colocarse "al azar": respetar las
// puertas evita el choque obvio, pero no evita el sillón plantado justo en el paso entre
// la entrada y el dormitorio.

const centro = (pts) => {
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
};

/**
 * Los tramos de circulación: por dónde se ATRAVIESA, no por dónde se entra.
 *
 * Un ambiente con dos o más puertas es de paso, y el flujo va de puerta a puerta: el hall,
 * el pasillo, la sala que distribuye. Un ambiente con una sola puerta es DESTINO —el
 * dormitorio, el baño— y ahí no hay circulación que proteger más allá del propio vano, que
 * ya cubre la zona de paso.
 *
 * La primera versión iba de cada puerta al centro de cada ambiente y marcaba 52 muebles de
 * 121 sobre un flujo: en un dormitorio de 3 m la cama está justo entre la puerta y el
 * centro, y eso no es un defecto sino cómo se amuebla un dormitorio.
 *
 * @param ancho  ancho libre de paso (m). 0.80 es el de una persona con algo en la mano.
 * @returns [{ a, b, ancho, entre }]
 */
export function construirFlujos(rooms = [], vanos = [], muros = [], { ancho = 0.8 } = {}) {
  const porId = new Map(muros.map((m) => [m.id, m]));
  const puertas = vanos.filter((v) => v.tipo !== "ventana");
  // puertas que tocan cada ambiente, con su punto en el muro
  const porAmbiente = new Map();
  for (const v of puertas) {
    const g = resolverVano(v, porId.get(v.muroId));
    if (!g) continue;
    for (const id of v.entre || []) {
      if (!id) continue;
      if (!porAmbiente.has(id)) porAmbiente.set(id, []);
      porAmbiente.get(id).push({ id: v.id, punto: g.centro });
    }
  }
  const tramos = [];
  for (const [roomId, ps] of porAmbiente) {
    if (ps.length < 2) continue;                    // ambiente destino: no se atraviesa
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        tramos.push({ a: { ...ps[i].punto }, b: { ...ps[j].punto }, ancho,
                      entre: [ps[i].id, ps[j].id], ambiente: roomId });
      }
    }
  }
  return tramos;
}

/**
 * Cajas de los flujos, para usarlos como obstáculo del mobiliario.
 *
 * El recorrido se descompone en dos tramos en ÁNGULO RECTO, que es como se camina en una
 * planta rectilínea: primero en una dirección, después en la otra. Usar la caja envolvente
 * del segmento en diagonal cubría el ambiente entero y marcaba medio mobiliario como
 * estorbo — 51 muebles de 121, la mayoría aparatos de baño que no estorban nada.
 */
export function cajasDeFlujo(flujos = [], { recorte = 0.5 } = {}) {
  const out = [];
  for (const f0 of flujos) {
    const h = f0.ancho / 2;
    // Los extremos del tramo caen sobre las puertas, y ese suelo ya lo protege zonasDePaso.
    // Sin recortarlos el flujo se mete medio metro dentro del ambiente vecino y marca como
    // estorbo a los aparatos de baño, que no estorban nada: se contaba dos veces.
    const largo = Math.hypot(f0.b.x - f0.a.x, f0.b.y - f0.a.y);
    if (largo <= recorte * 2 + 0.2) continue;      // tramo corto: es todo zona de puerta
    const ux = (f0.b.x - f0.a.x) / largo, uy = (f0.b.y - f0.a.y) / largo;
    const f = { ...f0,
      a: { x: f0.a.x + ux * recorte, y: f0.a.y + uy * recorte },
      b: { x: f0.b.x - ux * recorte, y: f0.b.y - uy * recorte } };
    const dx = Math.abs(f.b.x - f.a.x), dy = Math.abs(f.b.y - f.a.y);
    if (dx < 0.05 || dy < 0.05) {          // recto: un solo tramo
      out.push({ x0: Math.min(f.a.x, f.b.x) - h, x1: Math.max(f.a.x, f.b.x) + h,
                 y0: Math.min(f.a.y, f.b.y) - h, y1: Math.max(f.a.y, f.b.y) + h });
      continue;
    }
    // en L: se gira por el eje MÁS LARGO primero, que es el recorrido natural
    const codo = dx >= dy ? { x: f.b.x, y: f.a.y } : { x: f.a.x, y: f.b.y };
    for (const [p, q] of [[f.a, codo], [codo, f.b]]) {
      out.push({ x0: Math.min(p.x, q.x) - h, x1: Math.max(p.x, q.x) + h,
                 y0: Math.min(p.y, q.y) - h, y1: Math.max(p.y, q.y) + h });
    }
  }
  return out;
}

/**
 * ¿El barrido de la puerta se sale de los ambientes que conecta? Una hoja que cruza un muro
 * es un dibujo imposible: la puerta no puede abrir hacia adentro de otro cuarto.
 */
export function barridoSaleDelAmbiente(vano, muro, rooms = [], lado = 1) {
  const g = resolverVano(vano, muro);
  if (!g) return false;
  const L = Math.hypot(muro.b.x - muro.a.x, muro.b.y - muro.a.y) || 1;
  const nx = -(muro.b.y - muro.a.y) / L * lado, ny = (muro.b.x - muro.a.x) / L * lado;
  // el ambiente hacia el que barre: el que contiene el punto justo del otro lado del vano
  const sonda = { x: g.centro.x + nx * 0.12, y: g.centro.y + ny * 0.12 };
  const dentro = (r, p) => {
    const xs = r.pts.map((q) => q.x), ys = r.pts.map((q) => q.y);
    return p.x >= Math.min(...xs) - 1e-6 && p.x <= Math.max(...xs) + 1e-6
        && p.y >= Math.min(...ys) - 1e-6 && p.y <= Math.max(...ys) + 1e-6;
  };
  const destino = rooms.find((r) => r.pts?.length && dentro(r, sonda));
  if (!destino) return true;                       // barre hacia la nada
  // la punta de la hoja tiene que caer dentro de ese mismo ambiente
  return !dentro(destino, { x: g.p1.x + nx * vano.ancho, y: g.p1.y + ny * vano.ancho });
}
