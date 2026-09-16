//
// Dónde vive un turno que está esperando al browser.
//
// El loop del agente es síncrono en su forma: pide una tool, recibe un resultado,
// sigue. Cuando la tool la ejecuta el browser, ese "recibe un resultado" es un
// POST que llega por OTRA request HTTP, minutos después si del otro lado hay un
// humano mirando un diálogo de confirmación. Este registro es el puente: guarda
// el `resolve` de la promesa que el loop está esperando, para que el handler de
// esa otra request lo pueda llamar.
//
// LÍMITE ACEPTADO (spec, "Transporte"): esto vive en memoria. Un deploy de Railway
// corta los turnos en vuelo, y asume UNA sola instancia. Si algún día hay más de
// una, hacen falta sticky sessions. No se resuelve por adelantado.

const nuevoIdPorDefecto = () => Math.random().toString(36).slice(2, 10);

export function crearRegistroTurnos({ nuevoId = nuevoIdPorDefecto } = {}) {
  // turnId → { userId, pendientes: Map<callId, {resolver, timer}> }
  const turnos = new Map();

  function abrir(userId) {
    const turnId = nuevoId();
    turnos.set(turnId, { userId, pendientes: new Map() });
    return turnId;
  }

  function pedir(turnId, { timeoutMs = 60000 } = {}) {
    const callId = nuevoId();
    const turno = turnos.get(turnId);
    // El turno ya se cerró (el cliente se fue mientras el modelo pensaba): no
    // registramos nada ni armamos un timer que nadie va a limpiar.
    if (!turno) return { callId, promesa: Promise.resolve(TEXTO_CERRADO) };

    let resolver;
    const promesa = new Promise((res) => { resolver = res; });
    const timer = setTimeout(() => {
      const p = turnos.get(turnId)?.pendientes;
      if (p?.delete(callId)) resolver(TEXTO_TIMEOUT);
    }, timeoutMs);
    // Un turno esperando no es motivo para que el proceso no pueda salir.
    timer.unref?.();

    turno.pendientes.set(callId, { resolver, timer });
    return { callId, promesa };
  }

  function resolver({ turnId, callId, userId, result }) {
    const turno = turnos.get(turnId);
    if (!turno) return "turno_desconocido";
    // La identidad se chequea ANTES de mirar el call_id: si no, un usuario ajeno
    // podría sondear qué call_id existen por la diferencia entre las dos
    // respuestas.
    if (turno.userId !== userId) return "no_autorizado";
    const pendiente = turno.pendientes.get(callId);
    if (!pendiente) return "call_desconocido";
    turno.pendientes.delete(callId);
    clearTimeout(pendiente.timer);
    pendiente.resolver(result);
    return "ok";
  }

  function cerrar(turnId) {
    const turno = turnos.get(turnId);
    if (!turno) return;
    // Soltar lo que quedó esperando ANTES de borrar el turno: si no, el loop se
    // queda con una promesa que nadie va a resolver nunca y la ruta nunca corre
    // su finally.
    for (const [, p] of turno.pendientes) {
      clearTimeout(p.timer);
      p.resolver(TEXTO_CERRADO);
    }
    turnos.delete(turnId);
  }

  const pendientes = (turnId) => turnos.get(turnId)?.pendientes.size ?? 0;

  return { abrir, pedir, resolver, cerrar, pendientes };
}

// Los dos textos viajan al modelo como tool_result, así que están escritos para
// que entienda qué pasó y pueda seguir con otra cosa en vez de reintentar.
export const TEXTO_TIMEOUT =
  "La pantalla del usuario no respondió a tiempo. No sabemos si la acción llegó a ejecutarse: no la repitas, preguntale al usuario qué ve.";
export const TEXTO_CERRADO =
  "El turno se cerró antes de que la pantalla contestara (el usuario cerró ALICE o se cortó la conexión).";
