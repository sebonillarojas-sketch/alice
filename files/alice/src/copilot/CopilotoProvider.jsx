// El turno del copiloto, por encima del router de spaces.
//
// Vivía dentro de AliciaView, y ahí no puede seguir: erp_navigate cambia de space,
// eso desmonta AliciaView, y el turno que estaba esperando la respuesta del
// client_tool se muere con él. Acá arriba sobrevive a cualquier navegación — que
// es justamente lo que el copiloto tiene que hacer.
//
// El cuerpo de `enviar` es el `send` de la Fase 2 mudado tal cual: el repintado
// agrupado por frame, el techo por INACTIVIDAD (no por reloj de pared), el
// `text_reset`, el texto final que SIEMPRE sale de `done`, el stream sin `done`
// tratado como fallo y los tres textos de error. Cada una de esas rarezas está
// ahí por un bug que ya pasó; los comentarios de cada una explican cuál. Lo
// único que se agrega es el manejo de `turn_start`, `client_tool` y `confirm`.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ALICIA_URL } from "../lib/brain.js";
import { supabase } from "../lib/supabase.js";
import { useCopilotSnapshot, useRegistroERP } from "./ERPContext.jsx";
import { crearBus } from "./acciones.js";
import { crearManos } from "./manos.js";
import { abrirTurno } from "./turn.js";
import { loadChat, saveChat } from "./historial.js";

const Ctx = createContext(null);

export function CopilotoProvider({ children, userId = null }) {
  // `userId` entra por prop y no por useAuth() a propósito: el provider no tiene
  // por qué depender del árbol de auth, y así se puede montar en un test con un
  // uid de mentira.
  const [selectedUserId, setSelectedUserId] = useState(userId);
  // localStorage es caché optimista: pinta el hilo al instante mientras el fetch
  // del historial del servidor viaja. La fuente de verdad sigue siendo el
  // cerebro (tabla `messages`).
  const [mensajes, setMensajes] = useState(() => (userId ? loadChat(userId) : []));
  const [enviando, setEnviando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  // { call_id, id, tool, input, resolver } — lo que el dock le muestra al usuario.
  // `id` es el mismo block.id que viajó en el tool_start: sirve para ligar el
  // diálogo con su fila de la traza. Todavía no lo lee nadie (Tarea 8), pero si
  // no se guarda acá se pierde y no hay de dónde recuperarlo.
  const [confirmacion, setConfirmacion] = useState(null);

  const takeSnapshot = useCopilotSnapshot();
  const registro = useRegistroERP();

  // El bus y navigate viven en refs: registrar una acción NO puede re-renderizar
  // el ERP entero, igual que en ERPContext.
  const bus = useRef(crearBus()).current;
  const navigateRef = useRef(() => {});
  const registrarNavigate = useCallback((fn) => { navigateRef.current = fn; }, []);
  const registrarAccion = useCallback((nombre, fn) => bus.registrar(nombre, fn), [bus]);

  const manos = useMemo(
    () => crearManos({ bus, registro, navigate: (s, v) => navigateRef.current(s, v) }),
    [bus, registro]
  );

  // Si la sesión resuelve después de montar, el uid llega tarde: adoptarlo.
  useEffect(() => {
    if (userId) setSelectedUserId((prev) => prev ?? userId);
  }, [userId]);

  // Rehidratar al cambiar de persona (el "ver como" del CEO). El primer render ya
  // hidrató en el useState de arriba, así que este ref evita el setState redundante.
  const uidHidratado = useRef(selectedUserId);
  useEffect(() => {
    if (uidHidratado.current === selectedUserId) return;
    uidHidratado.current = selectedUserId;
    setMensajes(selectedUserId ? loadChat(selectedUserId) : []);
  }, [selectedUserId]);

  // Contesta un client_tool/confirm por la ruta de resultados. Es una request
  // aparte: la del turno está ocupada streameando.
  const contestar = useCallback(async (turnId, callId, token, result) => {
    try {
      await fetch(`${ALICIA_URL}/api/copilot/turn/${turnId}/result`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ call_id: callId, result, userId: selectedUserId }),
      });
    } catch (e) {
      // Si el POST falla, el servidor va a cortar solo por timeout. Insistir
      // desde acá sólo agregaría ruido a un turno que ya está perdido.
      console.warn("[copilot] no pude contestar el call:", e?.message ?? e);
    }
  }, [selectedUserId]);

  const enviar = useCallback(async (texto) => {
    if (!texto.trim() || enviando) return;
    const userMsg = { role: "user", content: texto.trim(), ts: Date.now() };
    const base = [...mensajes, userMsg];
    setMensajes(base);
    setEnviando(true);

    // Estas viven FUERA del try para que el `finally` pueda apagar el repintado
    // agrupado pase lo que pase. Un rAF que sobreviva al turno vuelve a pintar la
    // burbuja en vivo ENCIMA del mensaje final (o del de error) y resucita texto
    // que ya no existe en ningún lado. `pasos` también: si el turno muere a mitad,
    // el catch tiene que poder decir qué herramientas alcanzaron a correr.
    let rafId = null;
    let terminado = false;
    let pasos = [];
    // Techo por INACTIVIDAD, no por reloj de pared. El de pared que había (120s) no
    // alcanza: este canal permite 16 iteraciones y un turno con dropbox_read +
    // gmail_search + web_search pasa los dos minutos sin estar colgado. Al cortarlo,
    // el cerebro igual terminaba y GUARDABA la respuesta, así que el usuario reintentaba
    // y pagaba un turno entero de más. Lo que sí hay que cortar es el silencio: el
    // cerebro late cada 15s (`: ping`), así que 90s sin recibir un solo byte son 6
    // latidos perdidos — eso ya no es un turno lento, es una conexión muerta.
    const SILENCIO_MAX = 90000;
    const aborto = new AbortController();
    let porInactividad = false;
    let ocioso = null;
    const rearmarOcioso = () => {
      clearTimeout(ocioso);
      if (terminado) return;
      ocioso = setTimeout(() => { porInactividad = true; aborto.abort(); }, SILENCIO_MAX);
    };
    rearmarOcioso();   // el silencio antes del primer byte también cuenta

    // El turnId llega en `turn_start` y es a dónde hay que contestarle los calls.
    let turnId = null;

    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;

      // Burbuja del assistant que se va llenando en vivo. `pasos` es la traza.
      let acumulado = "";
      // Un setState por token re-renderiza el árbol entero decenas de veces por
      // segundo. Agrupamos los repintados en el frame: se ve igual de fluido y el
      // navegador no se ahoga.
      let pendiente = false;
      const pintarYa = () => setMensajes([...base, {
        role: "assistant", content: acumulado, pasos, ts: Date.now(), streaming: true,
      }]);
      const pintar = () => {
        if (pendiente || terminado) return;
        pendiente = true;
        rafId = requestAnimationFrame(() => {
          pendiente = false;
          rafId = null;
          if (terminado) return;   // el turno ya cerró: este frame llegó tarde
          pintarYa();
        });
      };
      pintarYa();

      let final = null;
      await abrirTurno({
        url: `${ALICIA_URL}/api/copilot/turn`,
        token,
        // userId solo viaja para el "ver como" del CEO; el servidor lo ignora
        // para cualquier otro y toma la identidad del JWT.
        body: { userId: selectedUserId, message: texto.trim(), erpContext: takeSnapshot() },
        // Sin ningún techo, una conexión colgada deja `enviando` en true para siempre
        // y el composer muerto sin forma de salir. El techo lo lleva `rearmarOcioso`.
        signal: aborto.signal,
        onActividad: rearmarOcioso,
        onEvento: ({ event, data }) => {
          if (event === "turn_start") { turnId = data.turnId; }
          // `?? ""` y no `data.text` pelado: un frame malformado pegaría el literal
          // "undefined" en medio de la respuesta.
          else if (event === "text_delta") { acumulado += data.text ?? ""; pintar(); }
          // El cerebro sólo guarda el texto de la última iteración: lo que el cliente
          // pintó en una vuelta anterior hay que descartarlo o la pantalla miente.
          else if (event === "text_reset") { acumulado = ""; pintar(); }
          else if (event === "tool_start") { pasos = [...pasos, { id: data.id, tool: data.tool, input: data.input, ok: null }]; pintar(); }
          else if (event === "tool_done") { pasos = pasos.map(p => p.id === data.id ? { ...p, ok: data.ok } : p); pintar(); }
          // Una tool que corre en el browser. read y navigate van directo: el
          // catálogo del cerebro ya decidió que no necesitan permiso.
          else if (event === "client_tool") {
            manos.ejecutar(data.tool, data.input)
              .then((r) => contestar(turnId, data.call_id, token, r))
              .catch((e) => contestar(turnId, data.call_id, token, `Falló en la pantalla: ${e?.message ?? e}`));
          }
          // Una escritura. NO se ejecuta hasta que el usuario haga click: la
          // promesa queda guardada en el estado y la resuelve el diálogo.
          else if (event === "confirm") {
            setConfirmacion({
              call_id: data.call_id, id: data.id, tool: data.tool, input: data.input,
              resolver: async (ok) => {
                setConfirmacion(null);
                if (!ok) return contestar(turnId, data.call_id, token, "El usuario NO autorizó esta acción. No la reintentes: preguntale qué prefiere.");
                const r = await manos.ejecutar(data.tool, data.input).catch((e) => `Falló al ejecutar: ${e?.message ?? e}`);
                return contestar(turnId, data.call_id, token, r);
              },
            });
          }
          else if (event === "done") { final = data; }
          // El frame de error llega DESPUÉS de haber pintado deltas, y no viene
          // ningún `done` que los corrija porque el cerebro no guardó nada. Lanzar
          // corta el stream y deja que el catch tire esa burbuja: es texto que no
          // existe en ninguna base. Ignorarlo dejaría al usuario leyendo un fantasma.
          else if (event === "error") {
            const e = new Error(data?.message || "el cerebro cortó el turno");
            e.delCerebro = true;
            throw e;
          }
        },
      });

      // Si el stream terminó sin `done`, el cerebro no cerró el turno y por lo tanto
      // no guardó nada: el buffer que pintamos no existe en ninguna base. Caer al
      // acumulado lo metería en el estado y en localStorage, y el turno siguiente se
      // compondría contra un historial que el cerebro no comparte. Es exactamente la
      // divergencia que este bloque existe para cerrar, así que es un fallo.
      if (!final) {
        const e = new Error("el stream terminó sin cerrar el turno");
        e.delCerebro = true;
        throw e;
      }

      // SIEMPRE el texto de `done`, nunca el acumulado. Entre lo que se pinta y lo
      // que el cerebro guarda hay tres divergencias reales: un rechazo pisa el texto
      // sin mandar reset, la extracción de JSON stremea el envoltorio {"message":…}
      // crudo pero guarda el valor desenvuelto, y de cada iteración sólo se guarda
      // el primer bloque de texto aunque se pinten todos. Reemplazar la burbuja por
      // `final.text` al cerrar el turno las cierra a las tres de una.
      const hilo = [...base, {
        role: "assistant", content: final.text ?? "", actions: final.actions || [], pasos, ts: Date.now(),
      }];
      setMensajes(hilo);
      if (selectedUserId) saveChat(selectedUserId, hilo);
    } catch (err) {
      // `base` no incluye la burbuja en vivo: reemplazar por esto la borra.
      // Tres textos distintos porque son tres situaciones distintas:
      //  - delCerebro: el cerebro avisó que cortó, así que NO guardó nada.
      //  - inactividad: cortamos NOSOTROS. El cerebro puede haber terminado igual y
      //    haber guardado la respuesta; decir "problema de conexión" es mentira y
      //    empuja a un reintento que paga un turno entero de más.
      //  - resto: fallo real de red o del servidor.
      // Nunca metemos `err.message` en el caso de inactividad: el DOMException del
      // AbortController dice "signal timed out" en inglés y no explica nada.
      const contenido = err?.delCerebro
        ? `Corté el turno a mitad (${err.message}). Lo que alcancé a escribir no quedó guardado, así que lo descarté. Probá de nuevo.`
        : porInactividad
          ? "Dejé de recibir respuesta del servidor y corté la espera. Puede que Alicia haya terminado igual y la respuesta esté guardada: recargá antes de volver a preguntar, así no pagás el turno dos veces."
          : `Tuve un problema de conexión con el servidor (${err.message}). Reintentá en un momento.`;
      const hilo = [...base, { role: "assistant", content: contenido, actions: [], pasos, ts: Date.now(), isError: true }];
      setMensajes(hilo);
      if (selectedUserId) saveChat(selectedUserId, hilo);
    } finally {
      terminado = true;
      // El timer de inactividad tiene que morir con el turno: si sobrevive, aborta
      // un AbortController que ya no controla nada y encima mantiene el turno vivo
      // en memoria por 90s más.
      clearTimeout(ocioso);
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      // Un diálogo de confirmación que sobrevive al turno es un botón que ya no
      // contesta a nadie: el turno cerró y el call_id no existe más.
      setConfirmacion(null);
      setEnviando(false);
    }
  }, [enviando, mensajes, selectedUserId, takeSnapshot, manos, contestar]);

  const value = useMemo(() => ({
    mensajes, setMensajes, enviando, enviar,
    confirmacion, abierto, setAbierto,
    registrarAccion, registrarNavigate,
    selectedUserId, setSelectedUserId,
  }), [mensajes, enviando, enviar, confirmacion, abierto, registrarAccion, registrarNavigate, selectedUserId]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCopiloto() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCopiloto fuera de CopilotoProvider");
  return ctx;
}

// Registra una acción del módulo en el bus mientras esté montado. Igual que
// useERPContext: la fn va a un ref, así el módulo no necesita envolverla en
// useCallback, y el cleanup del registro devuelve el desregistrar del bus.
export function useAccionERP(nombre, fn) {
  const ctx = useContext(Ctx);
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!ctx) return;            // sin provider (tests, storybook) no hace nada
    return ctx.registrarAccion(nombre, (args) => ref.current(args));
  }, [ctx, nombre]);
}
