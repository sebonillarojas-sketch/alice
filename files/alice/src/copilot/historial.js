// El caché del hilo en el browser.
//
// Vivía adentro de AliciaView, y ahora lo necesitan dos: el space viejo y el
// CopilotoProvider, que monta por encima del router. Se movió tal cual, sin
// tocar ni la clave ni el recorte a los últimos 100 mensajes — la clave
// `alicia_chat_<uid>_v1` ya está escrita en los navegadores de todo el equipo
// (y en el humo), así que renombrarla sería tirarles el hilo a la basura.
//
// OJO: esto es caché optimista, NO la fuente de verdad. El hilo vive en el
// servidor (tabla `messages`); esto sólo existe para que la pantalla pinte algo
// al instante mientras el fetch del historial viaja.

export const chatKey = (uid) => `alicia_chat_${uid}_v1`;

export function loadChat(uid) {
  try { const r = localStorage.getItem(chatKey(uid)); return r ? JSON.parse(r) : []; }
  catch { return []; }
}

export function saveChat(uid, msgs) {
  try { localStorage.setItem(chatKey(uid), JSON.stringify(msgs.slice(-100))); }
  catch {}
}
