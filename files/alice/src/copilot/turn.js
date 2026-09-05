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
    let detalle = {};
    try {
      detalle = await res.json();
    } catch (err) {
      // Si el signal se abortó mientras leíamos el body de error, no lo
      // disfracemos de fallo del servidor: que el AbortError suba tal cual,
      // así quien llama puede distinguir "cancelé esto" de "el server falló".
      if (signal?.aborted) throw err;
    }
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
  } catch (err) {
    // onEvento puede lanzar a propósito (frame de error) y el signal puede
    // abortarse a mitad de lectura: en ambos casos hay que cortar la conexión
    // de verdad, no solo soltar el lock, o el server sigue mandando datos a
    // un stream que ya nadie escucha. Si cancel() mismo falla, lo tragamos
    // para no tapar el error original.
    await reader.cancel(err).catch(() => {});
    throw err;
  } finally {
    reader.releaseLock?.();
  }
}
