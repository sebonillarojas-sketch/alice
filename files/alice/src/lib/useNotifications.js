import { useEffect, useRef } from "react";
import { supabase, db } from "./supabase";
import { selectPending, coalesce, taskIdFromDeepLink } from "./notifications.js";

// Muestra un banner. Detección de capacidad, no negociable: alice.bam.pe también
// se abre en navegador normal, y el shell de escritorio se actualiza más lento que
// la web. Si esto asumiera que window.alice existe, bastaría con que alguien tenga
// el shell viejo para que la web se le caiga.
function mostrar(banner, irA) {
  if (typeof window === "undefined") return;

  if (window.alice?.notify) {
    window.alice.notify(banner);   // el shell pone el banner nativo de macOS
    return;
  }

  if (typeof Notification === "undefined") return;
  if (Notification.permission === "granted") {
    const n = new Notification(banner.title, { body: banner.body });
    n.onclick = () => { window.focus(); irA(banner.deepLink); };
  } else if (Notification.permission === "default") {
    Notification.requestPermission();
  }
}

export function useNotifications({ enabled, setTasks, loaded }) {
  const mostradas = useRef(new Set());   // ids ya mostrados en esta sesión
  const setTasksRef = useRef(setTasks);
  setTasksRef.current = setTasks;

  useEffect(() => {
    if (!loaded || !enabled) return;

    let vivo = true;
    let canal = null;
    let quitarResume = null;
    let quitarOpen = null;

    const irA = (link) => { if (link) window.location.hash = link; };

    // Trae la tarea del deep link al estado local antes de que el usuario haga clic.
    const refrescarTarea = async (link) => {
      const id = taskIdFromDeepLink(link);
      if (id == null) return;
      try {
        const tarea = await db.getTask(id);
        setTasksRef.current(prev =>
          prev.some(t => t.id === tarea.id)
            ? prev.map(t => (t.id === tarea.id ? { ...t, ...tarea } : t))
            : [tarea, ...prev]
        );
      } catch { /* si falla, el banner igual sale; el panel se hidrata al recargar */ }
    };

    const entregar = async (filas) => {
      const pendientes = selectPending(filas, mostradas.current);
      if (!pendientes.length) return;

      // El refetch va sobre las filas pendientes, NO sobre los banners: cuando hay
      // coalescencia el banner resumen apunta a #/space/notifications y perdería
      // los deep links individuales, que son justo las tareas que hay que traer.
      await Promise.all(pendientes.map(n => refrescarTarea(n.deep_link)));

      const banners = coalesce(pendientes);
      if (!banners) return;

      for (const b of banners) {
        mostrar(b, irA);
        b.ids.forEach(id => mostradas.current.add(id));
      }

      const ids = banners.flatMap(b => b.ids);
      await supabase
        .from("notifications")
        .update({ delivered_at: new Date().toISOString() })
        .in("id", ids);
    };

    // Consulta de recuperación: lo que se perdió mientras la Mac dormía o la app
    // estuvo cerrada. Sin esto, todo evento ocurrido con el socket caído se pierde.
    const recuperar = async (uid) => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("recipient", uid)
        .is("delivered_at", null)
        .order("created_at", { ascending: true });
      if (vivo && data?.length) await entregar(data);
    };

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;           // uid de Supabase, NO authUser.id
      if (!uid || !vivo) return;

      await recuperar(uid);
      // Si el componente se desmontó durante el await de arriba, `vivo` ya es
      // false: cortamos acá para no crear un canal que el cleanup ya no vería
      // (quedaría suscrito para siempre — el cleanup de abajo corrió con canal
      // todavía en null).
      if (!vivo) return;

      // Mismo precedente que db.subscribeTasks (lib/supabase.js): el realtime
      // aplica RLS con el JWT de la conexión, y notifications tiene policies
      // `to authenticated`. Si no seteamos el token ANTES de .subscribe(), el
      // canal conecta como anon y RLS silencia los eventos — sin error visible.
      // No alcanza con que subscribeTasks ya llame setAuth() sobre el cliente
      // compartido: es una carrera, y si ese hook cambia o se desmonta primero,
      // las notificaciones se apagan en silencio.
      try { if (session?.access_token) supabase.realtime.setAuth(session.access_token); } catch { /* noop */ }

      canal = supabase
        .channel(`notif:${uid}`)
        .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `recipient=eq.${uid}` },
          payload => { if (vivo) entregar([payload.new]); })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") console.log("🟢 realtime notifications · suscrito");
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") console.warn("⚠️ realtime notifications:", status, "— revisá publicación supabase_realtime + Realtime ON en el proyecto");
        });

      // El shell avisa cuando la Mac despierta: el WebSocket se murió en silencio.
      quitarResume = window.alice?.onResume?.(() => recuperar(uid));
      // Y avisa cuándo se hizo clic en un banner nativo. El shell manda el destino;
      // la web decide qué hacer con él (nunca al revés).
      quitarOpen = window.alice?.onOpen?.(link => irA(link));
    })();

    return () => {
      vivo = false;
      if (canal) supabase.removeChannel(canal);
      if (quitarResume) quitarResume();
      if (quitarOpen) quitarOpen();
    };
  }, [enabled, loaded]);
}
