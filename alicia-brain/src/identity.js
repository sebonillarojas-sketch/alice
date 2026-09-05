// Quién es quién. Antes de esto el gate contestaba "¿hay alguien logueado?" y
// /api/chat le creía el userId al body: cualquiera del equipo podía mandar
// userId:"sb" y quedarse con las tools, el historial y las memorias del CEO.
// Acá la identidad sale del JWT y el body deja de tener voto.

export const CEO_ID = "sb";

// El puente entre las dos identidades: Supabase conoce emails, el cerebro
// conoce ids cortos (sb, vd, jt…). profiles.email es la tabla de traducción.
export function emailToUserId(db, email) {
  const e = String(email || "").trim();
  if (!e) return null;
  const row = db.prepare(
    "SELECT user_id FROM profiles WHERE lower(email) = lower(?)"
  ).get(e);
  return row?.user_id || null;
}

// Solo el CEO puede mirar la conversación de otro (es el "ver como" del panel).
// Para todos los demás, pedir otro userId es un intento de impersonación.
export function resolveActingUser({ actorId, requestedUserId } = {}) {
  if (!actorId) return { ok: false, error: "no_auth" };
  if (!requestedUserId || requestedUserId === actorId) {
    return { ok: true, actorId, userId: actorId, impersonating: false };
  }
  if (actorId !== CEO_ID) return { ok: false, error: "impersonacion_no_permitida" };
  return { ok: true, actorId, userId: requestedUserId, impersonating: true };
}

// ¿puede este actor tocar los datos de esta persona? Sólo los suyos, salvo que
// sea el CEO. Misma regla que resolveActingUser, pero para las rutas que reciben
// al usuario objetivo por path o query (/api/history/:userId y compañía) en vez
// de por body: ahí no hay "actuar como", sólo leer o escribir sobre alguien.
export function puedeVer(actorId, targetId) {
  if (!actorId) return false;
  if (actorId === CEO_ID) return true;
  return actorId === targetId;
}
