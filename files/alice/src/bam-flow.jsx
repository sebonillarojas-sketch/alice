// Flujo BAM standalone — cabida → planos → mesa con los componentes REALES,
// fuera del shell del ERP y sin auth. Los tres pasos comparten el proyecto activo
// vía useProyectos (localStorage), así que lo que definís en Cabida llega a Planos
// y lo que dibujás en Planos llega a la Mesa. Entry de Vite (bam-flow.html).
import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import ProyectoTabs from "./modules/cabida/ProyectoTabs.jsx";
import CabidaView from "./modules/cabida/CabidaView.jsx";
import EditorPlanos from "./modules/planos/EditorPlanos.jsx";
import MesaDeTrabajo from "./modules/mesa/MesaDeTrabajo.jsx";

const C = { ink: "#373737", peri: "#95ABE8", orange: "#F7643B", paper: "#EFEDE8", card: "#FFFFFF", line: "#E4E2DC", soft: "#9B998F" };
const sans = "'Hanken Grotesk', 'Helvetica Neue', sans-serif";
const mono = "'JetBrains Mono', 'SF Mono', Menlo, monospace";

const STEPS = [
  { id: "cabida", n: "1", label: "Cabida", hint: "terreno · masa · esquema" },
  { id: "planos", n: "2", label: "Planos", hint: "lote → distribución → tipologías" },
  { id: "mesa", n: "3", label: "Mesa", hint: "láminas · concepto · presentación" },
];

// aísla un paso: si un componente crashea, no se lleva puesto todo el flujo
class Boundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (this.state.err) return (
      <div style={{ padding: 24, fontFamily: mono, fontSize: 12, color: "#A85B5B" }}>
        ▲ este paso tiró un error: {String(this.state.err.message || this.state.err)}
      </div>
    );
    return this.props.children;
  }
}

function BamFlow() {
  const [step, setStep] = useState("cabida");
  // EditorPlanos llama navigate("app-mesa") al enviar a la Mesa; lo mapeamos al stepper
  const navigate = (dest) => {
    if (dest === "app-mesa" || dest === "mesa") setStep("mesa");
    else if (dest === "app-editor" || dest === "planos") setStep("planos");
    else if (dest === "cabida") setStep("cabida");
  };

  return (
    <div style={{ minHeight: "100vh", background: C.paper, color: C.ink, fontFamily: sans, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "12px 18px", borderBottom: `1px solid ${C.line}`, background: C.card }}>
        <span style={{ fontWeight: 800, fontSize: 15, color: C.peri, letterSpacing: "-.01em" }}>BAM</span>
        <span style={{ fontSize: 13, fontWeight: 700 }}>flujo · cabida → planos → mesa</span>
        <span style={{ fontFamily: mono, fontSize: 10, color: C.soft }}>local · módulos reales · sin ERP</span>
      </div>

      <div style={{ display: "flex", gap: 8, padding: "10px 18px", borderBottom: `1px solid ${C.line}`, background: "#F4F2EC" }}>
        {STEPS.map((s) => {
          const active = s.id === step;
          return (
            <button key={s.id} onClick={() => setStep(s.id)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", borderRadius: 4, cursor: "pointer",
                border: `1px solid ${active ? C.ink : C.line}`, background: active ? C.ink : C.card, color: active ? C.card : C.ink }}>
              <b style={{ fontFamily: mono, fontSize: 11, color: active ? C.peri : C.orange }}>{s.n}</b>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{s.label}</span>
              <span style={{ fontFamily: mono, fontSize: 9.5, color: active ? "#B9C4DE" : C.soft }}>{s.hint}</span>
            </button>
          );
        })}
      </div>

      {/* switcher de proyectos compartido; en Planos lo omito porque el editor trae el suyo */}
      {step !== "planos" && <ProyectoTabs />}

      {/* solo el paso activo montado — más seguro; el estado persiste vía localStorage */}
      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <Boundary key={step}>
          {step === "cabida" && <CabidaView />}
          {step === "planos" && <div style={{ height: "calc(100vh - 150px)" }}><EditorPlanos navigate={navigate} /></div>}
          {step === "mesa" && <MesaDeTrabajo />}
        </Boundary>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode><BamFlow /></React.StrictMode>
);
