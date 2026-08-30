// Lógica pura de notificaciones — sin React, sin red, sin Supabase.
// Vive aparte del hook justamente para poder testearla con `node --test`, igual
// que la suite del brain. Todo lo que dependa del navegador va en useNotifications.js.

// Sobre 3 pendientes se muestra un único aviso resumen. Sin esto, abrir la laptop
// el lunes dispara un banner por cada evento acumulado y el equipo apaga las
// notificaciones ese mismo día — que es la forma más común en que esto fracasa.
export const COALESCE_THRESHOLD = 3;

// Notificaciones que todavía no se le mostraron a esta persona en esta máquina.
// `deliveredIds` cubre el caso de que Realtime y la consulta de recuperación
// traigan la misma fila: sin esa guardia, se vería dos veces.
export function selectPending(rows, deliveredIds) {
  const vistas = deliveredIds instanceof Set ? deliveredIds : new Set(deliveredIds || []);
  return (rows || [])
    .filter(r => r && r.id && !r.delivered_at && !vistas.has(r.id) && r.urgency === "now")
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

// Devuelve los banners a mostrar, o null si no hay nada.
export function coalesce(pending) {
  const lista = pending || [];
  if (lista.length === 0) return null;

  if (lista.length <= COALESCE_THRESHOLD) {
    return lista.map(n => ({
      title: n.title,
      body: n.body || "",
      deepLink: n.deep_link || "",
      ids: [n.id],
    }));
  }

  return [{
    title: `${lista.length} novedades`,
    body: lista.slice(0, COALESCE_THRESHOLD).map(n => n.title).join(" · "),
    // #/space/notifications renderiza NotificationsToolView, que se alimenta de
    // `activity` (el feed local de localStorage) y no sabe nada de esta tabla:
    // el clic caería en una lista vacía y, como entregar() ya marcó delivered_at,
    // esas notificaciones se perderían. #/space/mistareas sí existe y muestra
    // justo las tareas asignadas al usuario — de lo único que hablan los dos
    // tipos de notificación de esta fase.
    deepLink: "#/space/mistareas",
    ids: lista.map(n => n.id),
  }];
}

// El routing por fragmento del ERP ya existe (HyggeOS.jsx:15152): #/task/<id>.
export function taskIdFromDeepLink(link) {
  const m = /^#\/task\/(\d+)/.exec(String(link || ""));
  return m ? parseInt(m[1], 10) : null;
}
