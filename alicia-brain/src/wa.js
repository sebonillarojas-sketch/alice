// Envío saliente de WhatsApp — WA Cloud API (Meta directo, canal preferido) con fallback a Twilio
// Twilio queda solo como fallback de transición — Sebastián decidió salir de Twilio (13 jul 2026).
export async function sendWA(to, text) {
  if (!to || !text) return false;
  let phone = String(to).replace(/^whatsapp:/, "").replace(/[^\d+]/g, "");
  if (!phone.startsWith("+")) phone = "+" + phone;

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

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const tok = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

  if (sid && tok) {
    const chunks = text.length <= 1500 ? [text] : text.match(/[\s\S]{1,1500}/g) || [text];
    for (const body of chunks) {
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: "Basic " + Buffer.from(`${sid}:${tok}`).toString("base64"),
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
