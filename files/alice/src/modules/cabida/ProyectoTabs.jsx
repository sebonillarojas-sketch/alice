// Barra de pestañas de proyectos de cabida — la misma en Cabida y en el Editor.
// Doble clic en la pestaña activa para renombrar; × para borrar; + para crear.
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useProyectos } from "./proyectos.js";

const C = { ink: "#373737", soft: "#9B998F", line: "#E4E2DC", card: "#FFFFFF", paper: "#EFEDE8", orange: "#F7643B" };
const sans = "'Hanken Grotesk', 'Helvetica Neue', sans-serif";

export default function ProyectoTabs() {
  const { proyectos, activoId, store } = useProyectos();
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState("");

  const startEdit = (p) => { setEditId(p.id); setDraft(p.nombre); };
  const commitEdit = () => { if (editId) store.renombrar(editId, draft); setEditId(null); };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap",
      padding: "6px 12px", borderBottom: `1px solid ${C.line}`, background: C.paper }}>
      <span style={{ fontFamily: sans, fontSize: 9, fontWeight: 800, letterSpacing: "0.12em",
        textTransform: "uppercase", color: C.soft, marginRight: 4 }}>proyectos</span>
      {proyectos.map((p) => {
        const active = p.id === activoId;
        return (
          <div key={p.id} onClick={() => store.setActivo(p.id)}
            onDoubleClick={() => active && startEdit(p)}
            title={active ? "Doble clic para renombrar" : "Ir a este proyecto"}
            style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer",
              padding: "4px 9px", borderRadius: 3, userSelect: "none",
              background: active ? C.ink : C.card, border: `1px solid ${active ? C.ink : C.line}` }}>
            {editId === p.id ? (
              <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
                onBlur={commitEdit} onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditId(null); }}
                onClick={(e) => e.stopPropagation()}
                style={{ font: `600 12px ${sans}`, width: Math.max(70, draft.length * 8), border: "none", outline: "none",
                  background: "transparent", color: active ? C.card : C.ink }} />
            ) : (
              <span style={{ fontFamily: sans, fontSize: 12, fontWeight: active ? 700 : 500,
                color: active ? C.card : C.ink, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.nombre}
              </span>
            )}
            {active && proyectos.length > 1 && (
              <button onClick={(e) => { e.stopPropagation(); if (confirm(`¿Borrar el proyecto "${p.nombre}"? El plano y la cabida se pierden.`)) store.eliminar(p.id); }}
                title="Borrar proyecto" style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
                <X size={12} color={C.card} />
              </button>
            )}
          </div>
        );
      })}
      <button onClick={() => store.crear()} title="Nuevo proyecto"
        style={{ display: "flex", alignItems: "center", gap: 3, cursor: "pointer",
          padding: "4px 8px", borderRadius: 3, background: C.card, border: `1px dashed ${C.line}`,
          fontFamily: sans, fontSize: 11.5, color: C.soft }}>
        <Plus size={12} /> nuevo
      </button>
    </div>
  );
}
