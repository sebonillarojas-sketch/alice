import { test } from "node:test";
import assert from "node:assert/strict";
import { limpiarParaVoz, construirTTS } from "../src/mica/voz.js";

test("los emojis no se leen en voz alta", () => {
  assert.equal(limpiarParaVoz("Qué bueno que te haya gustado 🙂✨"), "Qué bueno que te haya gustado");
});

test("los metrajes se dicen como se hablan, no como se escriben", () => {
  assert.equal(limpiarParaVoz("un flat de 90 m2"), "un flat de 90 metros cuadrados");
  assert.equal(limpiarParaVoz("90 m²"), "90 metros cuadrados");
});

test("el código de proyecto se deletrea para que no salga 'olvrcerouno'", () => {
  assert.equal(limpiarParaVoz("José lleva OLVR-01"), "José lleva O-L-V-R cero uno");
});

test("los saltos de línea se vuelven pausas, no se comen las frases", () => {
  assert.equal(limpiarParaVoz("Hola.\n\n¿Qué buscas?"), "Hola. ¿Qué buscas?");
});

test("el pedido a ElevenLabs va con la voz de Mica y el modelo multilingüe", () => {
  const r = construirTTS({ texto: "Hola", voiceId: "VOZMICA", apiKey: "k" });
  assert.match(r.url, /VOZMICA/);
  assert.equal(r.headers["xi-api-key"], "k");
  assert.equal(JSON.parse(r.body).model_id, "eleven_multilingual_v2");
  assert.equal(JSON.parse(r.body).text, "Hola");
});

test("sin voz propia configurada no habla — nunca cae a la voz de Alicia", () => {
  assert.throws(() => construirTTS({ texto: "Hola", voiceId: "", apiKey: "k" }), /MICA_VOICE_ID/);
});

test("sacar el emoji no deja un espacio huérfano antes del punto", () => {
  assert.equal(limpiarParaVoz("Qué bueno 🙂. José lleva el proyecto"), "Qué bueno. José lleva el proyecto");
  assert.equal(limpiarParaVoz("Listo ✨, te escribe"), "Listo, te escribe");
});
