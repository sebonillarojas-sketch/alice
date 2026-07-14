// Buzón en memoria del último archivo que cada usuario mandó por WhatsApp.
// Alicia lo consume con la tool dropbox_upload ("guardá eso en 08_GROWTH").
// TTL 30 min — es un handoff inmediato, no storage (los archivos viven en Dropbox).

const TTL_MS = 30 * 60 * 1000;
const _inbox = new Map(); // userId → { buffer, mediaType, filename, ts }

export function setLastFile(userId, { buffer, mediaType, filename }) {
  _inbox.set(userId, { buffer, mediaType, filename, ts: Date.now() });
}

export function getLastFile(userId) {
  const f = _inbox.get(userId);
  if (!f) return null;
  if (Date.now() - f.ts > TTL_MS) { _inbox.delete(userId); return null; }
  return f;
}

export function clearLastFile(userId) { _inbox.delete(userId); }

export const extForMime = (mime = "") => ({
  "application/pdf": "pdf",
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/msword": "doc", "application/vnd.ms-excel": "xls",
  "text/csv": "csv", "text/plain": "txt",
}[mime.split(";")[0]] || "bin");
