// Envío saliente de WhatsApp — orden de canales:
//   1. WA Web (waweb.js) — el teléfono propio de Alicia, sin límites de ventana/plantillas
//   2. WA Cloud API (Meta directo)
//   3. Twilio — solo fallback de transición; Sebastián decidió salir de Twilio (13 jul 2026).
import { isSandbox } from "./sandbox.js";
// Credenciales de Twilio. Con API Key (TWILIO_API_KEY_SID/SECRET) autentica con
// esa; el Account SID se sigue necesitando aparte porque va en la ruta de la URL.
// Sin API Key cae a Account SID + Auth Token, como antes.
export function twilioCreds() {
  const accountSid = (process.env.TWILIO_ACCOUNT_SID || "").trim();
  if (!accountSid) return null;
  const keySid = (process.env.TWILIO_API_KEY_SID || "").trim();
  const keySecret = (process.env.TWILIO_API_KEY_SECRET || "").trim();
  // La API Key vale solo como par completo: mezclar el Key SID con el Auth Token
  // arma credenciales inválidas y Twilio responde 20003 (401).
  const [user, pass] = keySid && keySecret
    ? [keySid, keySecret]
    : [accountSid, (process.env.TWILIO_AUTH_TOKEN || "").trim()];
  if (!user || !pass) return null;
  return { accountSid, header: "Basic " + Buffer.from(`${user}:${pass}`).toString("base64") };
}

export async function sendWA(to, text) {
  if (isSandbox()) { console.log("[SANDBOX] no envío WhatsApp"); return false; }
  if (!to || !text) return false;
  let phone = String(to).replace(/^whatsapp:/, "").replace(/[^\d+]/g, "");
  if (!phone.startsWith("+")) phone = "+" + phone;

  if (process.env.WA_PREFER_CLOUD !== "1") {
    try {
      const { isWAWebConnected, sendWAWebText } = await import("./waweb.js");
      if (isWAWebConnected()) { await sendWAWebText(phone, text); return true; }
    } catch (e) {
      console.warn("sendWA: WA Web falló, probando Cloud/Twilio:", e.message);
    }
  }

  if (process.env.WA_PHONE_NUMBER_ID && process.env.WA_ACCESS_TOKEN) {
    // Límite de texto de Cloud API: 4096 chars — cortamos en 4000
    const chunks = text.length <= 4000 ? [text] : text.match(/[\s\S]{1,4000}/g) || [text];
    for (const body of chunks) {
      const r = await fetch(`https://graph.facebook.com/v19.0/${process.env.WA_PHONE_NUMBER_ID}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: phone.replace("+", ""), type: "text", text: { body } }),
      });
      if (!r.ok) throw new Error(`WA Cloud send failed: ${(await r.text()).slice(0, 200)}`);
    }
    return true;
  }

  const creds = twilioCreds();
  const from = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

  if (creds) {
    const chunks = text.length <= 1500 ? [text] : text.match(/[\s\S]{1,1500}/g) || [text];
    for (const body of chunks) {
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: creds.header,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ From: from, To: `whatsapp:${phone}`, Body: body }),
      });
      if (!r.ok) throw new Error(`Twilio send failed: ${(await r.text()).slice(0, 200)}`);
    }
    return true;
  }

  console.warn("sendWA: sin canal configurado (ni WA Cloud ni Twilio)");
  return false;
}

// Envío de nota de voz (audio) por URL pública — para respuestas async
export async function sendWAMedia(to, mediaUrl) {
  if (isSandbox()) { console.log("[SANDBOX] no envío WhatsApp"); return false; }
  if (!to || !mediaUrl) return false;
  let phone = String(to).replace(/^whatsapp:/, "").replace(/[^\d+]/g, "");
  if (!phone.startsWith("+")) phone = "+" + phone;

  if (process.env.WA_PHONE_NUMBER_ID && process.env.WA_ACCESS_TOKEN) {
    const r = await fetch(`https://graph.facebook.com/v19.0/${process.env.WA_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: phone.replace("+", ""), type: "audio", audio: { link: mediaUrl } }),
    });
    if (!r.ok) throw new Error(`WA Cloud media failed: ${(await r.text()).slice(0, 200)}`);
    return true;
  }

  const creds = twilioCreds();
  const from = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";
  if (creds) {
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: creds.header, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ From: from, To: `whatsapp:${phone}`, MediaUrl: mediaUrl }),
    });
    if (!r.ok) throw new Error(`Twilio media failed: ${(await r.text()).slice(0, 200)}`);
    return true;
  }
  return false;
}

// Envío de documento (PDF, imagen, Excel, etc.) — prefiere WA Web (buffer directo,
// sin depender de una URL pública), luego Twilio y por último Cloud API (ambos
// necesitan `url`, que viene del file-relay como fallback).
export async function sendWADocument(to, { buffer, mimetype, filename, url } = {}) {
  if (isSandbox()) { console.log("[SANDBOX] no envío WhatsApp"); return false; }
  if (!to) return false;
  let phone = String(to).replace(/^whatsapp:/, "").replace(/[^\d+]/g, "");
  if (!phone.startsWith("+")) phone = "+" + phone;

  if (process.env.WA_PREFER_CLOUD !== "1") {
    try {
      const { isWAWebConnected, sendWAWebDocument } = await import("./waweb.js");
      if (isWAWebConnected() && buffer) {
        await sendWAWebDocument(to, buffer, mimetype, filename);
        return true;
      }
    } catch (e) {
      console.warn("sendWADocument: WA Web falló, probando Twilio/Cloud:", e.message);
    }
  }

  const creds = twilioCreds();
  const from = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";
  if (creds && url) {
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: creds.header, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ From: from, To: `whatsapp:${phone}`, MediaUrl: url }),
    });
    if (!r.ok) throw new Error(`Twilio document failed: ${(await r.text()).slice(0, 200)}`);
    return true;
  }

  if (process.env.WA_PHONE_NUMBER_ID && process.env.WA_ACCESS_TOKEN && url) {
    const r = await fetch(`https://graph.facebook.com/v19.0/${process.env.WA_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: phone.replace("+", ""), type: "document", document: { link: url, filename } }),
    });
    if (!r.ok) throw new Error(`WA Cloud document failed: ${(await r.text()).slice(0, 200)}`);
    return true;
  }

  return false;
}
