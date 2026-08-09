// Coalescencia de mensajes entrantes.
// La gente manda un mensaje y a los segundos otro que lo complementa
// ("Pásame los planos" → "de Francisco del Castillo"). Si Alicia responde cada
// fragmento pierde la hilación y contesta cosas a medias o se contradice.
// Acá juntamos los mensajes de un mismo usuario que llegan dentro de una ventana
// de silencio y procesamos UNA sola vez, con el texto completo.
//
// Tradeoff aceptado (pedido por Sebastián): un mensaje suelto espera hasta
// MSG_COALESCE_MS antes de responderse. Tuneable por env.

const WINDOW_MS = Number(process.env.MSG_COALESCE_MS || 7000);
const buffers = new Map(); // userId -> { parts, wasAudio, handler, timer }

// Agrega `text` al buffer de `userId` y (re)agenda el flush. `handler(joined, {wasAudio})`
// se llama una vez cuando pasa la ventana sin mensajes nuevos. El handler más reciente gana
// (por si el usuario cambió de canal en medio del burst).
export function coalesceMessage(userId, text, handler, { wasAudio = false, windowMs = WINDOW_MS } = {}) {
  let entry = buffers.get(userId);
  if (entry) {
    if (text) entry.parts.push(text);
    entry.wasAudio = entry.wasAudio || wasAudio;
    entry.handler = handler;
    clearTimeout(entry.timer);
  } else {
    entry = { parts: text ? [text] : [], wasAudio, handler, timer: null };
    buffers.set(userId, entry);
  }
  entry.timer = setTimeout(() => { flush(userId).catch(() => {}); }, windowMs);
  entry.timer.unref?.();
}

async function flush(userId) {
  const entry = buffers.get(userId);
  if (!entry) return;
  buffers.delete(userId); // sacar ANTES de await: un mensaje que llegue durante el proceso abre un burst nuevo
  const joined = entry.parts.join("\n").trim();
  if (!joined) return;
  try { await entry.handler(joined, { wasAudio: entry.wasAudio }); }
  catch (e) { console.error("coalesce flush error:", e.message); }
}

// ── Helpers de test (no usar en runtime) ──
export function _pending(userId) { return buffers.get(userId)?.parts.slice() || []; }
export async function _flushNow(userId) { const e = buffers.get(userId); if (e) clearTimeout(e.timer); return flush(userId); }
export function _reset() { for (const e of buffers.values()) clearTimeout(e.timer); buffers.clear(); }
