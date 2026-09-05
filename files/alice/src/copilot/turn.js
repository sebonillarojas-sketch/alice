// Abre un turno del copiloto y va entregando los eventos a medida que llegan.
import { crearParserSSE } from "./sseParser.js";

export async function abrirTurno({ url, token, body, onEvento, signal }) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });
  // Los errores de auth (401/403) llegan como JSON, no como stream: el servidor
  // los responde antes de escribir los headers de SSE.
  if (!res.ok) {
    const detalle = await res.json().catch(() => ({}));
    throw new Error(detalle.error || `turno ${res.status}`);
  }
  if (!res.body) throw new Error("el navegador no expone el body del stream");

  const parser = crearParserSSE(onEvento);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      // stream:true es obligatorio: un carácter multibyte (un acento, un emoji)
      // puede quedar partido entre dos chunks y sin esto se decodifica como basura.
      parser.alimentar(decoder.decode(value, { stream: true }));
    }
  } finally {
    reader.releaseLock?.();
  }
}
