import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizarTwilio, construirEnvio } from "../src/mica/wa.js";

// Lo que Twilio postea de verdad en el webhook (form-encoded, ya parseado).
const ENTRANTE = {
  SmsMessageSid: "SM123", From: "whatsapp:+51987654321", To: "whatsapp:+14155238886",
  Body: "hola, vi el proyecto en instagram", NumMedia: "0", ProfileName: "Camila",
};

test("el mensaje de Twilio se normaliza al formato que el motor ya entiende", () => {
  const m = normalizarTwilio(ENTRANTE);
  assert.equal(m.canal, "whatsapp");
  assert.equal(m.telefono, "+51987654321");   // sin el prefijo whatsapp:
  assert.equal(m.texto, "hola, vi el proyecto en instagram");
  assert.equal(m.mensajeId, "SM123");
  assert.equal(m.nombrePerfil, "Camila");     // el nombre que WhatsApp ya trae
});

test("un webhook sin cuerpo no explota — devuelve null y el server lo ignora", () => {
  assert.equal(normalizarTwilio({}), null);
  assert.equal(normalizarTwilio({ From: "whatsapp:+51987654321", Body: "   " }), null);
});

test("un audio o una foto se reconocen como adjunto, no como texto vacío", () => {
  const m = normalizarTwilio({ ...ENTRANTE, Body: "", NumMedia: "1", MediaContentType0: "audio/ogg" });
  assert.equal(m.adjunto, "audio/ogg");
  assert.equal(m.texto, "");
});

test("el envío va al número del prospecto desde el número de Mica, no el de Alicia", () => {
  const req = construirEnvio({ to: "+51987654321", from: "whatsapp:+14155238886", texto: "Hola" });
  assert.equal(req.body.get("To"), "whatsapp:+51987654321");
  assert.equal(req.body.get("From"), "whatsapp:+14155238886");
  assert.equal(req.body.get("Body"), "Hola");
});

test("sin número de Mica configurado, el envío falla fuerte en vez de mandar por el de Alicia", () => {
  assert.throws(() => construirEnvio({ to: "+51987654321", from: "", texto: "Hola" }), /MICA_WHATSAPP_FROM/);
});
