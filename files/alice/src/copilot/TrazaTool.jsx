// Una herramienta en el hilo. Dice en castellano qué está haciendo; el JSON queda
// detrás del colapso. La traza es para confiar, no para depurar.
import { useState } from "react";

const C = { muted: "#6B6863", line: "#D9D5CD", surface: "#E5E1D6", brick: "#A85B5B" };

// Nombre de tool → frase legible. Lo que no esté acá cae al nombre crudo, que es
// mejor que inventar una traducción equivocada.
const FRASES = {
  radar_query: "consultando el radar",
  radar_refresh: "refrescando el radar",
  get_tasks: "revisando tus tareas",
  create_task: "creando una tarea",
  update_task: "actualizando una tarea",
  calendar_list: "mirando tu agenda",
  calendar_create: "agendando",
  check_availability: "viendo disponibilidad del equipo",
  gmail_search: "buscando en tu correo",
  dropbox_search: "buscando en Dropbox",
  dropbox_read: "leyendo un archivo",
  web_search: "buscando en la web",
  search_knowledge: "buscando en el conocimiento",
  search_resources: "buscando en recursos",
  read_conversation: "releyendo la conversación",
};

// input puede venir con referencias circulares o con BigInt (montos/ids grandes
// del ERP); JSON.stringify lanza en ambos casos y no hay error boundary alrededor
// del chat, así que se degrada a un texto honesto en vez de tirar abajo el hilo.
function serializar(input) {
  try {
    return JSON.stringify(input ?? {}, null, 2);
  } catch {
    return "(no se pudo mostrar el input)";
  }
}

export default function TrazaTool({ tool, ok, input }) {
  const [abierto, setAbierto] = useState(false);
  const frase = FRASES[tool] || tool;
  const estado = ok === null ? "…" : ok ? "✓" : "✕";
  return (
    <div style={{ margin: "4px 0" }}>
      <button
        onClick={() => setAbierto(v => !v)}
        style={{
          background: "none", border: "none", padding: 0, cursor: "pointer",
          fontSize: 11, color: ok === false ? C.brick : C.muted, display: "flex", gap: 6,
        }}
      >
        <span>{estado}</span><span>{frase}</span>
      </button>
      {abierto && (
        <pre style={{
          margin: "4px 0 0", padding: 8, background: C.surface, border: `1px solid ${C.line}`,
          borderRadius: 2, fontSize: 10, overflowX: "auto", color: C.muted,
        }}>{serializar(input)}</pre>
      )}
    </div>
  );
}
