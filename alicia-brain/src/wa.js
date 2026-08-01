// Envío saliente de WhatsApp — orden de canales:
//   1. WA Web (waweb.js) — el teléfono propio de Alicia, sin límites de ventana/plantillas
//   2. WA Cloud API (Meta directo)
//   3. Twilio — solo fallback de transición; Sebastián decidió salir de Twilio (13 jul 2026).
// Credenciales de Twilio. Con API Key (TWILIO_API_KEY_SID/SECRET) autentica con
// esa; el Account SID se sigue necesitando aparte porque va en la ruta de la URL.
// Sin API Key cae a Account SID + Auth Token, como antes.
export function twilioCreds() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const user = process.env.TWILIO_API_KEY_SID || accountSid;
  const pass = process.env.TWILIO_API_KEY_SECRET || process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !user || !pass) return null;
  return { accountSid, header: "Basic " + Buffer.from(`${user}:${pass}`).toString("base64") };
}

export async function sendWA(to, text) {
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
