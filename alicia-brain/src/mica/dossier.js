// El dossier que recibe José cuando Mica le entrega un lead caliente.
// No es un resumen: es lo que necesita para escribir el PRIMER mensaje sin leer
// cien líneas de chat. Por eso cada dato viaja con la frase textual que lo sostiene
// (§7) — José tiene que poder verificarlo, no creernos.

const ETIQUETAS = {
  motivacion: "Busca",
  hogar: "Son",
  metraje: "Metraje",
  tipologia: "Tipología",
  prioridad: "Prioriza",
  plazo: "Plazo",
};

const recortar = (s, n) => {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
};

const valorDe = (campo, v) => {
  if (campo !== "metraje") return String(v.valor || "");
  // "90 a 90" delata que el dato salió de una plantilla y no de una persona.
  const nums = [...new Set([v.min, v.max].filter(Boolean))];
  return nums.join(" a ") + " m2";
};

export function armarDossier({ telefono, nombre, proyecto, temperatura, evidencia, persona = {} }) {
  const quien = nombre ? `${nombre} · ${telefono}` : telefono;
  const lineas = [
    `🟠 Lead ${String(temperatura || "").toUpperCase()} — ${proyecto || "sin proyecto"}`,
    quien,
    "",
  ];

  const campos = Object.keys(ETIQUETAS).filter(c => persona[c]);
  if (campos.length) {
    for (const c of campos) {
      const v = persona[c];
      // El valor es la lectura; la cita es la prueba. Nunca va una sin la otra.
      lineas.push(`${ETIQUETAS[c]}: ${recortar(valorDe(c, v), 70)}`);
      lineas.push(`   “${recortar(v.cita, 90)}”`);
    }
  } else {
    lineas.push("Todavía no alcanzó a contar nada de lo que busca.");
  }

  if (evidencia) {
    lineas.push("");
    lineas.push(`Lo que disparó el pase: “${recortar(evidencia, 120)}”`);
  }
  lineas.push("");
  lineas.push("Ya le dije que te conectabas vos. La conversación completa está en micaai.bam.pe");

  return recortar_bloque(lineas.join("\n"));
}

// WhatsApp corta feo los mensajes largos, y un dossier que no se lee entero no sirve.
function recortar_bloque(texto, max = 1400) {
  if (texto.length <= max) return texto;
  const cola = "\n\n(sigue en micaai.bam.pe)";
  return texto.slice(0, max - cola.length).replace(/\s+\S*$/, "") + cola;
}
