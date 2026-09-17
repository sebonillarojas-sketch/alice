// El copiloto encima de cualquier módulo. Se monta en la raíz de HyggeOS, fuera
// del switch de spaces (eso es la Tarea 9): por eso sobrevive a que Alicia
// navegue con `erp_navigate`, que desmontaría un chat que viviera dentro del
// space.
//
// `<DialogoConfirmar />` aparece en las tres ramas a propósito: la confirmación
// tiene que poder aparecer con el dock cerrado, abierto u oculto (cuando el
// space `alicia` ya muestra la conversación a lo ancho y el dock sería la
// misma cosa dos veces en pantalla). No es duplicación a refactorizar.
import { useCopiloto } from "./CopilotoProvider.jsx";
import Conversacion from "./Conversacion.jsx";
import DialogoConfirmar from "./DialogoConfirmar.jsx";

const C = { paper: "#F4F1EA", ink: "#0A0B0F", muted: "#6B6863", line: "#D9D5CD", bam: "#A855F7" };

export default function CopilotoDock({ ocultar = false }) {
  const { abierto, setAbierto, enviando } = useCopiloto();

  if (ocultar) return <DialogoConfirmar />;

  if (!abierto) {
    return (
      <>
        <button
          onClick={() => setAbierto(true)}
          title="Alicia"
          style={{
            position: "fixed", right: 20, bottom: 20, zIndex: 40,
            width: 48, height: 48, borderRadius: 24, border: "none", cursor: "pointer",
            backgroundColor: C.bam, color: "#fff", fontSize: 18, fontWeight: 700,
            boxShadow: "0 2px 12px rgba(10,11,15,0.25)",
          }}
        >
          {enviando ? "…" : "A"}
        </button>
        <DialogoConfirmar />
      </>
    );
  }

  return (
    <>
      <aside
        style={{
          position: "fixed", right: 0, top: 0, bottom: 0, zIndex: 40,
          width: 380, maxWidth: "94vw", borderLeft: `1px solid ${C.line}`,
          backgroundColor: C.paper, display: "flex", flexDirection: "column",
          boxShadow: "-2px 0 12px rgba(10,11,15,0.06)",
        }}
      >
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${C.line}`, flexShrink: 0 }}>
          <span style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, fontWeight: 700 }}>Alicia · copiloto</span>
          <button
            onClick={() => setAbierto(false)}
            style={{ border: "none", background: "transparent", cursor: "pointer", color: C.muted, fontSize: 18, lineHeight: 1, padding: 4 }}
          >
            ×
          </button>
        </header>
        <div style={{ flex: 1, minHeight: 0 }}>
          <Conversacion ancho="dock" />
        </div>
      </aside>
      <DialogoConfirmar />
    </>
  );
}
