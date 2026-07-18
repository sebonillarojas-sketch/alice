// WhatsApp Web — el "teléfono" propio de Alicia, conectado 24/7 vía Baileys.
// Se vincula como "Dispositivo vinculado" (QR desde el panel) y la sesión vive en
// el volumen persistente de Railway (/data/wa-web-auth), así sobrevive deploys.
// Reconexión automática con backoff + watchdog cada 60s. Si el teléfono lo
// desvincula (loggedOut), limpia la sesión y queda esperando un QR nuevo.
//
// Canal preferido de salida (ver wa.js): WA Web → Cloud API → Twilio.
// Desactivable con WA_WEB_ENABLED=0.

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

const ENABLED = process.env.WA_WEB_ENABLED !== "0";
const AUTH_DIR =
  process.env.WA_WEB_AUTH_DIR ||
  join(dirname(process.env.SQLITE_PATH || "./alicia.db"), "wa-web-auth");

const state = {
  enabled: ENABLED,
  status: "off",        // off | starting | pairing | connected | reconnecting | logged_out | error
  qr: null,             // data URL del QR mientras status === "pairing"
  me: null,             // { id, name } del número vinculado
  lastConnected: null,
  lastError: null,
  attempts: 0,
};

let sock = null;
let onIncomingCb = null;
let starting = false;
let reconnectTimer = null;
let watchdog = null;
let logger = null;

export function getWAWebStatus() {
  return { ...state, authDir: AUTH_DIR, hasSession: existsSync(join(AUTH_DIR, "creds.json")) };
}

export function isWAWebConnected() {
  return state.status === "connected" && !!sock;
}

function toJid(phone) {
  const digits = String(phone).replace(/^whatsapp:/, "").replace(/\D/g, "");
  return `${digits}@s.whatsapp.net`;
}

export async function sendWAWebText(to, text) {
  if (!isWAWebConnected()) throw new Error("WA Web no conectado");
  const jid = toJid(to);
  const chunks = text.length <= 4000 ? [text] : text.match(/[\s\S]{1,4000}/g) || [text];
  for (const body of chunks) await sock.sendMessage(jid, { text: body });
  return true;
}

// Audio saliente (buffer). WhatsApp solo reproduce notas de voz en ogg/opus;
// wav/mp3 van como audio normal (ptt: false) para que no salga "mensaje dañado".
export async function sendWAWebAudio(to, buffer, mimetype = "audio/mp4") {
  if (!isWAWebConnected()) throw new Error("WA Web no conectado");
  const ptt = /ogg|opus/.test(mimetype);
  await sock.sendMessage(toJid(to), { audio: buffer, mimetype, ptt });
  return true;
}

export async function startWAWeb(onIncoming) {
  if (onIncoming) onIncomingCb = onIncoming;
  if (!ENABLED) { state.status = "off"; console.log("📵 WA Web desactivado (WA_WEB_ENABLED=0)"); return; }
  if (starting) return;
  starting = true;
  clearTimeout(reconnectTimer);

  try {
    const [baileys, QRCode, pino] = await Promise.all([
      import("@whiskeysockets/baileys"),
      import("qrcode").then(m => m.default),
      import("pino").then(m => m.default),
    ]);
    const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = baileys;
    logger = logger || pino({ level: "warn" });

    mkdirSync(AUTH_DIR, { recursive: true });
    const { state: authState, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));

    state.status = state.status === "connected" ? "reconnecting" : "starting";

    sock = makeWASocket({
      version,
      auth: authState,
      logger,
      printQRInTerminal: false,
      browser: ["Alicia · Hygge", "Chrome", "1.0"],
      syncFullHistory: false,
      markOnlineOnConnect: true,
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (u) => {
      const { connection, lastDisconnect, qr } = u;

      if (qr) {
        state.status = "pairing";
        try { state.qr = await QRCode.toDataURL(qr, { margin: 1, width: 320 }); }
        catch (e) { state.lastError = "QR render: " + e.message; }
        console.log("📲 WA Web: escaneá el QR desde el panel (Configuración → Teléfono de Alicia)");
      }

      if (connection === "open") {
        state.status = "connected";
        state.qr = null;
        state.attempts = 0;
        state.lastError = null;
        state.lastConnected = new Date().toISOString();
        state.me = sock.user ? { id: sock.user.id, name: sock.user.name || null } : null;
        console.log(`✅ WA Web conectado como ${state.me?.id || "?"}`);
      }

      if (connection === "close") {
        const code = lastDisconnect?.error?.output?.statusCode;
        state.lastError = lastDisconnect?.error?.message || null;
        if (code === DisconnectReason.loggedOut) {
          // El teléfono desvinculó a Alicia: sesión muerta, hay que re-escanear
          console.warn("⚠️ WA Web: sesión cerrada desde el teléfono — limpiando credenciales, esperando QR nuevo");
          try { rmSync(AUTH_DIR, { recursive: true, force: true }); } catch {}
          state.status = "logged_out";
          state.me = null;
          scheduleReconnect(3000); // reinicia para generar QR fresco
        } else {
          state.status = "reconnecting";
          const delay = Math.min(60_000, 2000 * 2 ** Math.min(state.attempts, 5));
          state.attempts++;
          console.warn(`🔁 WA Web desconectado (${code || "?"}) — reintento en ${Math.round(delay / 1000)}s`);
          scheduleReconnect(delay);
        }
      }
    });

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;
      for (const m of messages) {
        try { await handleIncoming(m, baileys); }
        catch (e) { console.error("WA Web incoming error:", e.message); }
      }
    });
  } catch (e) {
    state.status = "error";
    state.lastError = e.message;
    console.error("WA Web start error:", e.message);
    scheduleReconnect(30_000);
  } finally {
    starting = false;
  }

  // Watchdog: si por cualquier motivo quedó caído sin reintento agendado, lo levanta
  if (!watchdog) {
    watchdog = setInterval(() => {
      if (!ENABLED || starting || reconnectTimer) return;
      if (!["connected", "pairing"].includes(state.status)) {
        console.log("🩺 WA Web watchdog: reconectando…");
        startWAWeb().catch(() => {});
      }
    }, 60_000);
    watchdog.unref?.();
  }
}

function scheduleReconnect(delay) {
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    startWAWeb().catch(() => {});
  }, delay);
  reconnectTimer.unref?.();
}

// WhatsApp nuevo entrega al remitente como LID opaco (@lid) en vez del número.
// El número real (PN) viene en un campo alterno del key o en el mapeo LID→PN de baileys.
function resolverTelefono(m, jid) {
  if (jid.endsWith("@s.whatsapp.net")) return "+" + jid.split("@")[0];
  const alt = m.key?.remoteJidAlt || m.key?.senderPn || m.key?.participantPn || m.key?.participantAlt;
  if (alt && String(alt).endsWith("@s.whatsapp.net")) return "+" + String(alt).split("@")[0];
  try {
    const pn = sock?.signalRepository?.lidMapping?.getPNForLID?.(jid);
    if (pn) return "+" + String(pn).split("@")[0];
  } catch { /* API distinta en esta versión */ }
  return null;
}

async function handleIncoming(m, baileys) {
  console.log(`📥 WA in key: ${JSON.stringify(m.key)} · hasMsg=${!!m.message}`); // DIAG temporal
  if (!m.message || m.key.fromMe) return;
  const jid = m.key.remoteJid || "";
  // Chats directos por número (@s.whatsapp.net) O por LID (@lid, WhatsApp nuevo).
  // Grupos (@g.us), status y newsletters se ignoran.
  if (!jid.endsWith("@s.whatsapp.net") && !jid.endsWith("@lid")) return;
  const phone = resolverTelefono(m, jid);
  if (!phone) { console.log(`⚠️ WA no resolví el número de ${jid}`); return; }

  const msg = m.message.ephemeralMessage?.message || m.message;
  const audio = msg.audioMessage;
  const doc = msg.documentMessage || msg.imageMessage;
  const text =
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.documentMessage?.caption ||
    msg.imageMessage?.caption ||
    "";

  if (!audio && !doc && !text) return;
  if (!onIncomingCb) return;

  let media = null;
  if (audio || doc) {
    const buffer = await baileys.downloadMediaMessage(
      m, "buffer", {},
      { logger, reuploadRequest: sock.updateMediaMessage }
    );
    media = {
      kind: audio ? "audio" : "file",
      buffer,
      mediaType: (audio || doc).mimetype || "application/octet-stream",
      filename: msg.documentMessage?.fileName || null,
    };
  }

  // Visto ✓✓ en el teléfono — Alicia leyó
  try { await sock.readMessages([m.key]); } catch {}

  await onIncomingCb({ phone, text, media });
}

export async function logoutWAWeb() {
  try { await sock?.logout(); } catch {}
  try { sock?.end?.(); } catch {}
  sock = null;
  try { rmSync(AUTH_DIR, { recursive: true, force: true }); } catch {}
  state.status = "logged_out";
  state.me = null;
  state.qr = null;
  // Arranca de nuevo para generar QR fresco
  scheduleReconnect(1500);
  return true;
}

export async function restartWAWeb() {
  try { sock?.end?.(); } catch {}
  sock = null;
  clearTimeout(reconnectTimer);
  reconnectTimer = null;
  await startWAWeb();
  return true;
}
