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

// Lo que se le contesta al cerebro cuando una escritura NO se ejecutó: el "No"
// del usuario, un diálogo que quedó abierto de la conversación de otra persona,
// o un frame que este cliente se niega a ejecutar. Es un solo texto porque desde
// el modelo las tres son la misma cosa —nadie autorizó esto— y porque repetir el
// literal es cómo se desincronizan.
const TEXTO_RECHAZO = "El usuario NO autorizó esta acción. No la reintentes: preguntale qué prefiere.";

export function CopilotoProvider({ children, userId = null }) {
  // `userId` entra por prop y no por useAuth() a propósito: el provider no tiene
  // por qué depender del árbol de auth, y así se puede montar en un test con un
  // uid de mentira.
  //
  // Se lee UNA sola vez, como semilla. No hay efecto que lo sincronice después
  // porque no hace falta: App.jsx devuelve LoginScreen si no hay `user`, así que
  // cuando este provider monta el uid ya es real, y un cambio de persona (logout
  // → login) pasa por ahí y remonta todo. De acá en adelante el dueño del uid es
  // `selectedUserId`, que además carga el "ver como" del CEO — un efecto que lo
  // pisara con la prop le rompería eso.
  const [selectedUserId, setSelectedUserId] = useState(userId);
  // localStorage es caché optimista: pinta el hilo al instante mientras el fetch
  // del historial del servidor viaja. La fuente de verdad sigue siendo el
  // cerebro (tabla `messages`).
  const [mensajes, setMensajes] = useState(() => (userId ? loadChat(userId) : []));
  const [enviando, setEnviando] = useState(false);
  // El borrador del composer. Vivía adentro de Conversacion, y ahí no alcanza:
  // el micrófono del space `alicia` tiene que poder APPENDEARLE lo dictado (se
  // dicta, se corrige y recién se manda — dictar sin poder corregir es peor que
  // no dictar, sobre todo con nombres propios y números), y ese botón vive
  // afuera del composer. De yapa, acá arriba el borrador sobrevive a cambiar de
  // space: lo que estabas escribiendo no se pierde porque Alicia te navegó.
  const [borrador, setBorrador] = useState("");
  const [abierto, setAbierto] = useState(false);
  // { call_id, id, tool, input, resolver } — lo que el dock le muestra al usuario.
  // `id` es el mismo block.id que viajó en el tool_start: sirve para ligar el
  // diálogo con su fila de la traza. Todavía no lo lee nadie (Tarea 8), pero si
  // no se guarda acá se pierde y no hay de dónde recuperarlo.
  const [confirmacion, setConfirmacion] = useState(null);
  // No se pudo traer el hilo del servidor: lo que se ve es el caché local.
  const [hiloFallo, setHiloFallo] = useState(false);

  // Se incrementa cada vez que `enviar` toca `mensajes` a mano. El fetch del
  // historial guarda la generación vigente ANTES de salir a la red; si al volver
  // ya cambió, alguien mandó un mensaje mientras tanto y aplicar la respuesta
  // pisaría ese turno en pantalla. No la borres para "simplificar": `vivo` cubre
  // desmontaje/cambio de usuario, esto cubre el turno propio.
  //
  // El contador y el fetch viajan JUNTOS, siempre: separarlos (el contador acá y
  // el fetch en AliciaView, o al revés) es exactamente cómo se reintrodujo este
  // bug la vez pasada. Por eso el fetch se mudó al provider con `enviar`, en vez
  // de quedarse en el space.
  const generacion = useRef(0);

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

  // Rehidratar al cambiar de persona (el "ver como" del CEO). El primer render ya
  // hidrató en el useState de arriba, así que este ref evita el setState redundante.
  const uidHidratado = useRef(selectedUserId);
  useEffect(() => {
    if (uidHidratado.current === selectedUserId) return;
    uidHidratado.current = selectedUserId;
    setMensajes(selectedUserId ? loadChat(selectedUserId) : []);
    // El borrador pertenece a la conversación que estabas escribiendo, no a la
    // siguiente. Sobrevivir a cambiar de SPACE es la gracia (lo que estabas
    // tipeando no se pierde porque Alicia te navegó); sobrevivir a cambiar de
    // PERSONA es cruzar datos entre hilos. Se parecen y son cosas opuestas.
    setBorrador("");
    // Un diálogo de confirmación abierto pide autorizar una ESCRITURA de la
    // conversación anterior, y es alcanzable con teclado: el overlay no atrapa
    // el foco, así que con Tab se llega al <select> de "Viendo como", se cambia
    // de persona y Shift+Tab vuelve a "Ejecutar" (que tiene autoFocus).
    // Se RESUELVE en false, no se borra con un setConfirmacion(null) pelado:
    // borrarlo saca el diálogo de la pantalla pero deja el turno del otro lado
    // colgado 180 segundos esperando un click que ya no puede llegar.
    confirmacion?.resolver(false);
  }, [selectedUserId, confirmacion]);   // `confirmacion` en las deps es seguro: la primera línea corta si el uid no cambió

  // El hilo vive en el servidor (tabla `messages`, un hilo por persona, todos los
  // canales). localStorage es caché: pinta al instante y lo reemplaza lo que
  // llegue del cerebro. Antes era la fuente de verdad, y por eso la pantalla
  // mostraba una conversación que Alicia no recordaba.
  //
  // Vive acá arriba y ya no en el space `alicia` porque el dock muestra el mismo
  // hilo desde CUALQUIER space: si el fetch se quedara adentro del space, el dock
  // pintaría para siempre el caché del navegador sin refrescarlo nunca. Y porque
  // la guarda `generacion` tiene que compartir alcance con `enviar`, que está acá.
  // Depende de [selectedUserId, userId], así que corre al montar y al cambiar de
  // persona — no en cada repintado del dock.
  useEffect(() => {
    let vivo = true;
    const gen = generacion.current;   // snapshot: si `enviar` avanza esto antes de que vuelva el fetch, se descarta
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data?.session?.access_token;
        const qs = new URLSearchParams({ limit: "60" });
        if (selectedUserId !== userId) qs.set("userId", selectedUserId);
        const res = await fetch(`${ALICIA_URL}/api/copilot/history?${qs}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: AbortSignal.timeout(10000),
        });
        // Un 403, una sesión vencida o Railway despertándose dejaban la copia
        // vieja en pantalla sin decir nada: exactamente el síntoma de "Alicia no
        // se acuerda" que este hilo vino a matar, con otra causa. Lo avisamos.
        if (!res.ok) { if (vivo && generacion.current === gen) setHiloFallo(true); return; }
        const { messages: hilo } = await res.json();
        if (!vivo || generacion.current !== gen || !Array.isArray(hilo)) return;
        const mapped = hilo.map((m) => ({
          role: m.role, content: m.content, actions: m.actions || [],
          // SQLite devuelve "YYYY-MM-DD HH:MM:SS" (con espacio); Safari no lo
          // parsea, así que lo pasamos a ISO antes de agregarle la "Z".
          channel: m.channel, ts: Date.parse(m.createdAt.replace(" ", "T") + "Z") || Date.now(),
        }));
        setMensajes(mapped);
        saveChat(selectedUserId, mapped);
        setHiloFallo(false);
      } catch {
        // el caché de localStorage ya está en pantalla, pero desactualizado
        if (vivo && generacion.current === gen) setHiloFallo(true);
      }
    })();
    return () => { vivo = false; };
  }, [selectedUserId, userId]);

  // Contesta un client_tool/confirm por la ruta de resultados. Es una request
  // aparte: la del turno está ocupada streameando.
  // `ok` es lo que ve la TRAZA, `result` lo que ve el modelo: son dos cosas
  // distintas. Un "No" contesta igual (el modelo tiene que enterarse) pero con
  // ok:false, para que su fila no quede en verde diciendo que se hizo algo que
  // no se hizo. Por defecto true: una lectura que salió bien no dice nada.
  const contestar = useCallback(async (turnId, callId, token, result, ok = true) => {
    try {
      await fetch(`${ALICIA_URL}/api/copilot/turn/${turnId}/result`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ call_id: callId, result, ok, userId: selectedUserId }),
      });
    } catch (e) {
      // Si el POST falla, el servidor va a cortar solo por timeout. Insistir
      // desde acá sólo agregaría ruido a un turno que ya está perdido.
      console.warn("[copilot] no pude contestar el call:", e?.message ?? e);
    }
  }, [selectedUserId]);

  const enviar = useCallback(async (texto) => {
    if (!texto.trim() || enviando) return;
    // El borrador se vacía acá y no en el composer: ahora que vive en el provider,
    // el que lo consume es el que lo tiene que soltar.
    setBorrador("");
    const userMsg = { role: "user", content: texto.trim(), ts: Date.now() };
    const base = [...mensajes, userMsg];
    generacion.current++;   // invalida cualquier fetch de historial que haya salido antes de este turno
    setMensajes(base);
    setEnviando(true);

    // De quién es este turno. Un turno dura hasta 90s y el CEO puede cambiar de
    // persona en el medio: sin esto, la respuesta (y cada frame del stream, que
    // repinta `base` entero) se escribiría ENCIMA del hilo de la otra persona.
    // `uidHidratado` es justamente el ref que dice qué conversación está a la
    // vista, así que alcanza con preguntarle antes de tocar la pantalla.
    // Ojo: lo que se GUARDA va siempre bajo `uidTurno` — el turno es de quien lo
    // mandó, mires lo que mires ahora.
    const uidTurno = selectedUserId;
    const aLaVista = () => uidHidratado.current === uidTurno;

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
      const pintarYa = () => {
        if (!aLaVista()) return;   // el CEO se fue a otra conversación: no le pintes esta encima
        setMensajes([...base, {
          role: "assistant", content: acumulado, pasos, ts: Date.now(), streaming: true,
        }]);
      };
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
            // El servidor manda el `efecto` en el mismo frame y hasta acá el
            // browser lo ignoraba: ejecutaba CUALQUIER tool que llegara por
            // `client_tool`, con lo cual todo el gate de escritura era un solo
            // `if` del servidor. Un rollback parcial, un bug o un cerebro
            // comprometido que emitiera `client_tool` con `tool: "erp_action"`
            // escribía sin diálogo. Esto no re-litiga quién clasifica —la
            // clasificación la sigue decidiendo el catálogo del cerebro—, sólo
            // hace que el gate deje de ser un único punto de falla.
            const deLectura = data.efecto === "read" || data.efecto === "navigate";
            if (!deLectura || data.tool === "erp_action") {
              contestar(turnId, data.call_id, token, TEXTO_RECHAZO, false);
              return;
            }
            manos.ejecutar(data.tool, data.input)
              .then((r) => contestar(turnId, data.call_id, token, r))
              .catch((e) => contestar(turnId, data.call_id, token, `Falló en la pantalla: ${e?.message ?? e}`, false));
          }
          // Una escritura. NO se ejecuta hasta que el usuario haga click: la
          // promesa queda guardada en el estado y la resuelve el diálogo.
          else if (event === "confirm") {
            // Del otro lado de este `ok` hay una ESCRITURA real (crear una tarea,
            // mandar un mail). Que hoy sea inalcanzable un doble click —React
            // flushea el setConfirmacion(null) antes— es un detalle de scheduling,
            // y una escritura no se apoya en eso: la guarda es del closure, así
            // que cubre tanto a responderConfirmacion como a quien agarre
            // `resolver` del estado y lo llame de más.
            let contestado = false;
            // Si el CEO ya se fue a la conversación de otra persona, este diálogo
            // pide autorizar una escritura de un hilo que no está mirando. No se
            // le muestra: se rechaza con el MISMO texto del "No", que es la
            // verdad (no lo autorizó) y además le dice al cerebro que vuelva a
            // preguntar en vez de quedarse colgado hasta el timeout.
            if (!aLaVista()) {
              contestar(turnId, data.call_id, token, TEXTO_RECHAZO, false);
              return;
            }
            setConfirmacion({
              call_id: data.call_id, id: data.id, tool: data.tool, input: data.input,
              resolver: async (ok) => {
                if (contestado) return;
                contestado = true;
                setConfirmacion(null);
                // `!aLaVista()` acá adentro además del efecto de `uidHidratado`:
                // el efecto limpia el diálogo que ya estaba abierto cuando se
                // cambia de persona, pero este chequeo cierra la carrera aunque
                // ese efecto llegue tarde (el click y el re-render compiten).
                // Autorizar acá es ejecutar una escritura de la conversación de
                // otro, que es exactamente lo que no puede pasar.
                if (!ok || !aLaVista()) return contestar(turnId, data.call_id, token, TEXTO_RECHAZO, false);
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
      // Guardar SIEMPRE (el turno es de `uidTurno`), pintar sólo si esa sigue
      // siendo la conversación a la vista.
      if (aLaVista()) setMensajes(hilo);
      if (uidTurno) saveChat(uidTurno, hilo);
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
      if (aLaVista()) setMensajes(hilo);
      if (uidTurno) saveChat(uidTurno, hilo);
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

  // El nombre del contrato para lo que el diálogo tiene que poder hacer. La
  // capacidad ya estaba en `confirmacion.resolver`; esto es para que el dock no
  // tenga que ir a buscarla adentro del estado. Sin confirmación pendiente no
  // hace nada: un botón que llega tarde no puede romper nada.
  const responderConfirmacion = useCallback((ok) => confirmacion?.resolver(ok), [confirmacion]);

  const value = useMemo(() => ({
    mensajes, setMensajes, enviando, enviar, hiloFallo,
    borrador, setBorrador,
    confirmacion, responderConfirmacion, abierto, setAbierto,
    registrarAccion, registrarNavigate,
    selectedUserId, setSelectedUserId,
  }), [mensajes, enviando, enviar, hiloFallo, borrador, confirmacion, responderConfirmacion, abierto, registrarAccion, registrarNavigate, selectedUserId]);

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
    // Depende de `registrarAccion`, NO del ctx entero: `enviar` cambia de identidad
    // con cada repintado del stream, así que el value rota ~60 veces por segundo
    // mientras Alicia escribe. Con `ctx` en las deps, cada módulo del ERP se
    // desregistraría y re-registraría a ese ritmo, todos a la vez, por estar esto
    // montado por encima del router. `registrarAccion` es useCallback con dep
    // [bus]: estable de verdad.
  }, [ctx?.registrarAccion, nombre]);
}
