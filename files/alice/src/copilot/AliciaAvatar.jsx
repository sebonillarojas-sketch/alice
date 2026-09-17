// La cara de Alicia. Vivía dentro de AliciaView y se mudó acá cuando el estado
// vacío del hilo (saludo + avatar grande + preguntas sugeridas) pasó a
// Conversacion.jsx: lo necesitan los dos, y el dock no puede importar nada de
// AliciaView sin quedar en un ciclo (AliciaView importa Conversacion).
//
// Se movió TAL CUAL, con sus keyframes adentro del propio componente: así el
// avatar se puede montar en cualquier lado sin depender de que alguien más haya
// declarado el CSS.
//
// `state` sólo cambia el dibujo a partir de 40px ("thinking" y "speaking"
// necesitan lugar para leerse); por debajo siempre es el blob.

const BAM = "#A855F7";

export default function AliciaAvatar({ size = 32, state = "idle" }) {
  const s = size;
  const isLarge = s >= 40;

  if (state === "speaking" && isLarge) {
    return (
      <div style={{ width: s, height: s, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{`
          @keyframes av-squeeze {
            0%,100% { border-radius:50%; transform:scaleX(1) scaleY(1); }
            25%     { border-radius:50%; transform:scaleX(1.22) scaleY(0.80); }
            50%     { border-radius:50%; transform:scaleX(0.82) scaleY(1.18); }
            75%     { border-radius:50%; transform:scaleX(1.10) scaleY(0.92); }
          }
        `}</style>
        <div style={{ width: s * 0.82, height: s * 0.82, background: BAM, borderRadius: "50%", animation: "av-squeeze 0.55s ease-in-out infinite" }} />
      </div>
    );
  }

  if (state === "thinking" && isLarge) {
    const dot = s * 0.14;
    return (
      <div style={{ width: s, height: s, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: s * 0.09 }}>
        <style>{`
          @keyframes av-dot {
            0%,80%,100% { transform:scale(0.55); opacity:0.3; }
            40%          { transform:scale(1);    opacity:1; }
          }
        `}</style>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: dot, height: dot, borderRadius: "50%", background: BAM, animation: `av-dot 1.2s ${i * 0.2}s ease-in-out infinite` }} />
        ))}
      </div>
    );
  }

  // idle — blob orgánico (todos los tamaños)
  return (
    <div style={{ width: s, height: s, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`
        @keyframes av-blob {
          0%,100% { border-radius:60% 40% 55% 45%/45% 55% 45% 55%; }
          25%     { border-radius:40% 60% 45% 55%/55% 45% 60% 40%; }
          50%     { border-radius:55% 45% 60% 40%/40% 60% 40% 60%; }
          75%     { border-radius:45% 55% 40% 60%/60% 40% 55% 45%; }
        }
      `}</style>
      <div style={{ width: s * 0.82, height: s * 0.82, background: BAM, animation: "av-blob 3.5s ease-in-out infinite" }} />
    </div>
  );
}
