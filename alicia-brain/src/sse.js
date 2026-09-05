// Formato de los frames del transporte del copiloto.
//
// Un frame SSE termina en línea en blanco, así que cualquier \n crudo dentro de
// `data:` lo parte a la mitad y el cliente recibe basura. Serializar con JSON.stringify
// escapa los saltos y de paso resuelve acentos y emojis, que en el ERP hay de sobra.

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  // `no-transform` es lo que impide que un proxy comprima y buffere el stream:
  // sin eso el texto llega en un solo golpe al final y se pierde todo el punto.
  "Cache-Control": "no-cache, no-transform",
  "Connection": "keep-alive",
  "X-Accel-Buffering": "no",
};

export function sseFrame(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data ?? {})}\n\n`;
}
