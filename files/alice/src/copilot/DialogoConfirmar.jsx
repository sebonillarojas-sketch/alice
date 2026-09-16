// La confirmación de una escritura. Muestra la acción y sus argumentos CRUDOS a
// propósito: el punto de confirmar es ver qué se va a ejecutar, no leer un
// resumen que el modelo escribió.
import { useCopiloto } from "./CopilotoProvider.jsx";

const C = { paper: "#F4F1EA", ink: "#0A0B0F", muted: "#6B6863", line: "#D9D5CD", surface: "#E5E1D6", verde: "#5F8A6A", rojo: "#A85B5B" };

export default function DialogoConfirmar() {
  // `responderConfirmacion` es el contrato del provider (ya trae la guarda de
  // idempotencia en su closure): el diálogo no toca `confirmacion.resolver`
  // directo.
  const { confirmacion, responderConfirmacion } = useCopiloto();
  if (!confirmacion) return null;

  const { tool, input } = confirmacion;
  // `?? tool` para que un frame `confirm` malformado (sin `input.action`) no
  // deje el título en blanco: peor que un nombre feo es un diálogo que pide
  // autorizar algo sin decir qué.
  const accion = tool === "erp_action" ? (input?.action ?? tool) : tool;
  const args = tool === "erp_action" ? input?.args : input;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, backgroundColor: "rgba(10,11,15,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 460, maxWidth: "92vw", backgroundColor: C.paper, border: `1px solid ${C.line}`, borderRadius: 3, padding: 20 }}>
        <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, marginBottom: 10, fontWeight: 700 }}>
          Alicia quiere modificar algo
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 12 }}>{accion}</div>
        <pre style={{ fontSize: 11, backgroundColor: C.surface, border: `1px solid ${C.line}`, borderRadius: 2, padding: 10, maxHeight: 220, overflow: "auto", whiteSpace: "pre-wrap", color: C.ink }}>
          {JSON.stringify(args ?? {}, null, 2)}
        </pre>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button onClick={() => responderConfirmacion(false)}
            style={{ padding: "8px 16px", fontSize: 12, fontWeight: 600, border: `1px solid ${C.line}`, background: "transparent", borderRadius: 2, cursor: "pointer", color: C.rojo }}>
            No
          </button>
          <button onClick={() => responderConfirmacion(true)} autoFocus
            style={{ padding: "8px 16px", fontSize: 12, fontWeight: 600, border: "none", borderRadius: 2, cursor: "pointer", backgroundColor: C.verde, color: "#fff" }}>
            Ejecutar
          </button>
        </div>
      </div>
    </div>
  );
}
