// Relay efímero de archivos para enviarlos por WhatsApp (sendWAMedia necesita una URL).
// Espeja el patrón de ttsCache: buffer en memoria, id corto, TTL 5 min. NO es storage.
const cache = new Map(); // id → { buffer, mime, filename }
const TTL_MS = 5 * 60 * 1000;
let seq = 0;

export function stageFile({ buffer, mime = "application/octet-stream", filename = "archivo" }) {
  const id = `${Date.now().toString(36)}${(seq++).toString(36)}`;
  cache.set(id, { buffer, mime, filename });
  setTimeout(() => cache.delete(id), TTL_MS).unref?.();
  return id;
}

export function getStagedFile(id) {
  return cache.get(id) || null;
}
