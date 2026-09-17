// El canal de WhatsApp de Mica, sobre Twilio — el único canal de WhatsApp que ALICE
// usa de verdad (baileys y Meta Cloud son código muerto en el brain).
// Mica tiene su PROPIO número: el de Alicia es por donde habla el equipo, y mezclar
// prospectos ahí le mete compradores en el chat interno a Jose.

// De lo que postea Twilio al formato que el motor ya entiende. null = ignorar.
export function normalizarTwilio(body = {}) {
  const from = String(body.From || "");
  if (!from.startsWith("whatsapp:")) return null;
  const texto = String(body.Body || "").trim();
  const adjunto = Number(body.NumMedia || 0) > 0 ? String(body.MediaContentType0 || "adjunto") : null;
  // Sin texto y sin adjunto no hay nada que responder.
  if (!texto && !adjunto) return null;
  return {
    canal: "whatsapp",
    telefono: from.replace("whatsapp:", ""),
    texto,
    adjunto,
    mensajeId: body.SmsMessageSid || body.MessageSid || null,
    nombrePerfil: body.ProfileName || null,
  };
}

// El cuerpo del POST a la API de Twilio. Separado del envío para poder testearlo sin red.
export function construirEnvio({ to, from, texto }) {
  if (!from) throw new Error("falta MICA_WHATSAPP_FROM — Mica no manda por el número de Alicia");
  const params = new URLSearchParams();
  params.set("To", to.startsWith("whatsapp:") ? to : `whatsapp:${to}`);
  params.set("From", from.startsWith("whatsapp:") ? from : `whatsapp:${from}`);
  params.set("Body", texto);
  return { body: params };
}

export async function enviarWA({ to, texto, sid, token, from, fetchImpl = globalThis.fetch }) {
  const { body } = construirEnvio({ to, from, texto });
  const r = await fetchImpl(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!r.ok) throw new Error(`Twilio ${r.status}: ${await r.text()}`);
  return r.json();
}

// Validación de firma de Twilio (HMAC-SHA1 sobre URL + params ordenados).
// El webhook es una URL pública: sin esto, cualquiera puede inventar conversaciones
// y hacernos gastar tokens respondiéndolas. El default es rechazar.
import { createHmac, timingSafeEqual } from "node:crypto";

export function firmaValida({ url, params = {}, firma, token }) {
  if (!firma || !token) return false;
  const base = Object.keys(params).sort().reduce((s, k) => s + k + params[k], String(url));
  const esperada = createHmac("sha1", token).update(Buffer.from(base, "utf8")).digest("base64");
  const a = Buffer.from(esperada), b = Buffer.from(String(firma));
  return a.length === b.length && timingSafeEqual(a, b);
}
