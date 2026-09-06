// Lógica pura de la compuerta de Calendar en el onboarding — sin red, sin
// localStorage, sin React. Separada así para poder testearla con `node --test`,
// igual que notifications.js. Todo lo que hable con el brain o el navegador
// va en App.jsx; acá solo vive la decisión.
//
// El bug que motivó este archivo (2026-08-30): el CEO quedó afuera del ERP
// porque `calGranted` salía solo de localStorage, y esa marca se borra con la
// caché, el navegador o el modo incógnito. La regla de oro de acá en adelante:
// una compuerta de onboarding rota NUNCA bloquea el acceso al ERP. Por eso
// toda rama de falla de esta función devuelve `pass: true`.

// Decide si dejar pasar (no mostrar el modal de Calendar) dado lo que dice la
// caché local y lo que contestó (o no) el brain.
//
// - cachedGranted: boolean — localStorage ya tenía la marca "1"
// - brainStatus: { ok: true, connected: boolean } | { ok: false } | null/undefined
//   resultado de preguntarle al brain (ok:false = no respondió, tardó, dio
//   error, o no se lo llegó a preguntar porque cachedGranted ya alcanzaba)
//
// Devuelve { pass, persist }:
//   pass    → true = no mostrar el modal, el usuario entra al ERP
//   persist → true = escribir "1" en localStorage (SOLO cuando el brain
//             confirmó con certeza que está conectado; nunca en el camino de
//             falla, porque ahí no sabemos el estado real y escribirlo sería
//             mentir sobre la conexión)
export function decideCalendarGate({ cachedGranted, brainStatus }) {
  if (cachedGranted) return { pass: true, persist: false }; // ya cacheado, ni hace falta preguntar
  if (brainStatus?.ok === true) {
    return brainStatus.connected
      ? { pass: true, persist: true }   // el brain confirma: ya tiene el token
      : { pass: false, persist: false }; // el brain confirma: todavía no conectó
  }
  // brain no respondió / tardó / tiró error → falla ABIERTA: entra igual,
  // sin escribir la caché (para que la próxima vez se vuelva a chequear).
  return { pass: true, persist: false };
}
