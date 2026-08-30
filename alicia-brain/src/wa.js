// Envío saliente de WhatsApp — único canal: Twilio.
// Hubo dos intentos previos que ya no existen en este archivo: WA Web (Baileys,
// el teléfono propio de Alicia) fue el canal original, y después se probó WA
// Cloud API (Meta directo). Baileys se dejó de usar y Meta nunca se terminó de
// configurar (Railway no tiene WA_PHONE_NUMBER_ID ni WA_ACCESS_TOKEN — cero
// tráfico en logs). Twilio es el que factura y el que de hecho manda y recibe
// los WhatsApp de producción, así que quedó como el único camino.
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

  console.warn("sendWA: sin canal configurado (Twilio)");
  return false;
}

// Envío de nota de voz (audio) por URL pública — para respuestas async
export async function sendWAMedia(to, mediaUrl) {
  if (isSandbox()) { console.log("[SANDBOX] no envío WhatsApp"); return false; }
  if (!to || !mediaUrl) return false;
  let phone = String(to).replace(/^whatsapp:/, "").replace(/[^\d+]/g, "");
  if (!phone.startsWith("+")) phone = "+" + phone;

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

// Envío de documento (PDF, imagen, Excel, etc.) por Twilio — necesita `url`
// (viene del file-relay: stageFile + /file/:id). buffer/mimetype/filename
// llegan en el objeto de opciones pero hoy no los usa este envío; el caller
// (tools.js) los sigue mandando porque también los usa para el file-relay.
export async function sendWADocument(to, { url } = {}) {
  if (isSandbox()) { console.log("[SANDBOX] no envío WhatsApp"); return false; }
  if (!to) return false;
  let phone = String(to).replace(/^whatsapp:/, "").replace(/[^\d+]/g, "");
  if (!phone.startsWith("+")) phone = "+" + phone;

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

  return false;
}
