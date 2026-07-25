// Envío saliente de WhatsApp — orden de canales:
//   1. WA Web (waweb.js) — el teléfono propio de Alicia, sin límites de ventana/plantillas
//   2. WA Cloud API (Meta directo)
// Twilio removido (2026-07-25) — Sebastián salió de Twilio.
export async function sendWA(to, text) {
  if (!to || !text) return false;
  let phone = String(to).replace(/^whatsapp:/, "").replace(/[^\d+]/g, "");
  if (!phone.startsWith("+")) phone = "+" + phone;

  if (process.env.WA_PREFER_CLOUD !== "1") {
    try {
      const { isWAWebConnected, sendWAWebText } = await import("./waweb.js");
      if (isWAWebConnected()) { await sendWAWebText(phone, text); return true; }
    } catch (e) {
      console.warn("sendWA: WA Web falló, probando Cloud API:", e.message);
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

  console.warn("sendWA: sin canal configurado (ni WA Web ni WA Cloud API)");
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
  return false;
}
