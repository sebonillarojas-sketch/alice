// Parser de frames SSE. EventSource no sirve acá: no hace POST ni manda headers,
// y el turno necesita las dos cosas. Así que leemos el body con fetch + ReadableStream
// y parseamos a mano.
//
// Lo único que importa de verdad: un chunk de red NO es un frame. Un frame puede
// llegar partido en dos chunks, y dos frames pueden llegar en uno solo. El buffer
// es lo que hace que eso no se note.

export function crearParserSSE(onEvento) {
  let buffer = "";

  function alimentar(texto) {
    buffer += texto;
    let corte;
    while ((corte = buffer.indexOf("\n\n")) !== -1) {
      const bloque = buffer.slice(0, corte);
      buffer = buffer.slice(corte + 2);

      let event = null;
      let dataCruda = "";
      for (const linea of bloque.split("\n")) {
        if (linea.startsWith(":")) continue;              // comentario (el latido)
        const colonIdx = linea.indexOf(":");
        if (colonIdx === -1) continue;                   // sin field
        const fieldName = linea.slice(0, colonIdx);
        let fieldValue = linea.slice(colonIdx + 1);
        // Spec SSE: un espacio después del colon es opcional
        if (fieldValue.startsWith(" ")) fieldValue = fieldValue.slice(1);
        if (fieldName === "event") event = fieldValue.trim();
        else if (fieldName === "data") {
          if (dataCruda) dataCruda += "\n";             // spec: múltiples data: se unen con \n
          dataCruda += fieldValue;
        }
      }
      if (!event) continue;                                // frame sin evento: no es nuestro
      let data;
      try { data = JSON.parse(dataCruda || "{}"); }
      catch { continue; }                                  // un frame roto no puede matar al resto
      onEvento({ event, data });
    }
  }

  return { alimentar };
}
