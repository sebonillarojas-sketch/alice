// Lo que Alicia está viendo ahora mismo. Existe para que el copiloto sea creíble:
// si no se ve qué contexto tiene, cada respuesta parece adivinación.
import { useCopilotSnapshot } from "./ERPContext.jsx";

const C = { paper: "#F4F1EA", ink: "#0A0B0F", muted: "#6B6863", line: "#D9D5CD", lineSoft: "#E5E1D6" };
const Eyebrow = ({ children }) => (
  <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, fontWeight: 700 }}>{children}</div>
);

export default function PanelContexto() {
  const takeSnapshot = useCopilotSnapshot();
  const { active, others } = takeSnapshot();

  return (
    <div style={{ padding: 16, borderLeft: `1px solid ${C.line}`, backgroundColor: C.paper, height: "100%", overflowY: "auto" }}>
      <Eyebrow>Contexto</Eyebrow>
      {!active ? (
        <div style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>
          Alicia no tiene ningún módulo a la vista. Abrí Cabida, Velocity o Growth y volvé.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 13, color: C.ink, fontWeight: 600, marginTop: 8 }}>{active.title || active.module}</div>
          {active.entity?.id && (
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{active.entity.type} {active.entity.id}</div>
          )}
          {active.derived && Object.keys(active.derived).length > 0 && (
            <div style={{ marginTop: 12 }}>
              <Eyebrow>Ya calculado</Eyebrow>
              <div style={{ marginTop: 6 }}>
                {Object.entries(active.derived).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "2px 0", borderBottom: `1px solid ${C.lineSoft}` }}>
                    <span style={{ color: C.muted }}>{k}</span>
                    <span style={{ color: C.ink }}>{typeof v === "number" ? v.toLocaleString("es-PE") : String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      {others?.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Eyebrow>También abiertos</Eyebrow>
          <div style={{ marginTop: 6 }}>
            {others.map(o => (
              <div key={o.module} style={{ fontSize: 11, color: C.muted, padding: "2px 0" }}>{o.title || o.module}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
