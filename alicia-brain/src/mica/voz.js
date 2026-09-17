// La voz de Mica (ElevenLabs). Voz PROPIA: la de Alicia es otra persona, hablándole
// al equipo. Sin MICA_VOICE_ID no habla — prefiere callarse a sonar como Alicia.

// Lo que se lee en voz alta no es lo que se lee con los ojos.
export function limpiarParaVoz(texto = "") {
  return String(texto)
    // Emojis y símbolos decorativos: leídos en voz alta son ruido.
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2190}-\u{21FF}]/gu, "")
    // "OLVR-01" leído tal cual sale "olvrcerouno". Se deletrea la sigla y se
    // dicen los dígitos sueltos, que es como lo diría una persona.
    .replace(/\b([A-Z]{2,})-0*(\d+)\b/g, (_, sigla, num) =>
      sigla.split("").join("-") + " " + (num === "1" ? "cero uno" : num.split("").map(d => DIGITOS[d]).join(" ")))
    // Metraje: "90 m2" se dice "90 metros cuadrados".
    // Ojo con el \b: "²" no es carácter de palabra, así que "m²\b" no matchea nunca.
    .replace(/\s*m(?:2\b|²)/g, " metros cuadrados")
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    // El emoji se fue y dejó un espacio pegado a la puntuación.
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

const DIGITOS = { 0: "cero", 1: "uno", 2: "dos", 3: "tres", 4: "cuatro", 5: "cinco", 6: "seis", 7: "siete", 8: "ocho", 9: "nueve" };

export function construirTTS({ texto, voiceId, apiKey }) {
  if (!voiceId) throw new Error("falta MICA_VOICE_ID — Mica no habla con la voz de Alicia");
  return {
    url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
    // multilingual_v2: el castellano peruano con v1 suena a doblaje neutro.
    body: JSON.stringify({
      text: limpiarParaVoz(texto),
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.2 },
    }),
  };
}

export async function sintetizar({ texto, voiceId, apiKey, fetchImpl = globalThis.fetch }) {
  const { url, headers, body } = construirTTS({ texto, voiceId, apiKey });
  const r = await fetchImpl(url, { method: "POST", headers, body });
  if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${await r.text()}`);
  return Buffer.from(await r.arrayBuffer());
}

// Las voces de la cuenta, para poder elegir la de Mica escuchándolas.
export async function listarVoces({ apiKey, fetchImpl = globalThis.fetch }) {
  const r = await fetchImpl("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": apiKey } });
  if (!r.ok) throw new Error(`ElevenLabs ${r.status}`);
  const d = await r.json();
  return (d.voices || []).map(v => ({ id: v.voice_id, nombre: v.name, preview: v.preview_url, etiquetas: v.labels || {} }));
}
