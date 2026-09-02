import { Bot, GitBranch, ShieldCheck, Sparkles, X } from "lucide-react";

const C = { ink: "#373737", soft: "#9B998F", line: "#E4E2DC", card: "#FFFFFF", paper: "#EFEDE8", orange: "#F7643B", blue: "#3D52D5", red: "#A85B5B", green: "#5F8A6A" };
const mono = "'JetBrains Mono', 'SF Mono', Menlo, monospace";
const sans = "'Hanken Grotesk', 'Helvetica Neue', sans-serif";

const severityColor = { critical: C.red, major: C.orange, minor: "#C2A45A", info: C.blue };

function Action({ icon, title, copy, onClick, disabled, accent }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ textAlign: "left", border: `1px solid ${accent || C.line}`, borderRadius: 4, padding: "10px 11px", background: C.card, cursor: disabled ? "wait" : "pointer", opacity: disabled ? 0.55 : 1, color: C.ink }}>
      <span style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: sans, fontSize: 11.5, fontWeight: 800 }}>{icon}{title}</span>
      <span style={{ display: "block", marginTop: 4, fontFamily: sans, fontSize: 9.5, lineHeight: 1.35, color: C.soft }}>{copy}</span>
    </button>
  );
}

export default function ArchitectureReviewPanel({
  busy,
  error,
  result,
  currentVersion,
  versions,
  onDesign,
  onCritique,
  onCycle,
  onApplyVersion,
  onClose,
}) {
  const critique = result?.critique || (result?.mode === "critique" ? result.output : null);
  const findings = critique?.findings || [];
  return (
    <aside style={{ position: "absolute", top: 58, right: 12, bottom: 38, zIndex: 58, width: 390, maxWidth: "calc(100% - 24px)", display: "flex", flexDirection: "column", background: C.paper, border: `1px solid ${C.line}`, borderTop: `3px solid ${C.orange}`, borderRadius: 4, boxShadow: "0 12px 36px rgba(0,0,0,0.2)", overflow: "hidden" }}>
      <header style={{ padding: "13px 14px 10px", borderBottom: `1px solid ${C.line}`, background: C.card }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <GitBranch size={14} color={C.orange} />
          <div>
            <div style={{ fontFamily: sans, fontSize: 12, fontWeight: 850, color: C.ink }}>Architecture Review</div>
            <div style={{ marginTop: 1, fontFamily: mono, fontSize: 9, color: C.soft }}>{currentVersion?.label || "sin versión"} · {versions.length} versión{versions.length === 1 ? "" : "es"}</div>
          </div>
          <button onClick={onClose} title="Cerrar" style={{ marginLeft: "auto", border: "none", background: "none", cursor: "pointer", display: "flex" }}><X size={14} color={C.soft} /></button>
        </div>
      </header>

      <div style={{ padding: 12, overflowY: "auto", flex: 1 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
          <Action icon={<Sparkles size={13} color={C.blue} />} title="Tweedledum" copy="Diseña una nueva versión." onClick={onDesign} disabled={busy} accent="#B8C3EE" />
          <Action icon={<ShieldCheck size={13} color={C.red} />} title="Tweedledee" copy="Critica la versión actual." onClick={onCritique} disabled={busy} accent="#DDBDBD" />
          <div style={{ gridColumn: "1 / -1" }}>
            <Action icon={<Bot size={13} color={C.orange} />} title="Review cycle" copy="Tweedledum → reglas determinísticas → Tweedledee → una revisión máxima." onClick={onCycle} disabled={busy} accent={C.orange} />
          </div>
        </div>

        {busy && <div style={{ marginTop: 12, padding: 10, border: `1px solid ${C.line}`, background: C.card, fontFamily: mono, fontSize: 10, color: C.soft }}>procesando {busy}…</div>}
        {error && <div style={{ marginTop: 12, padding: 10, borderLeft: `3px solid ${C.red}`, background: "#FFF7F6", fontFamily: mono, fontSize: 10, lineHeight: 1.45, color: C.red }}>{error}</div>}

        {result && !busy && (
          <section style={{ marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontFamily: sans, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.09em", color: C.soft }}>{result.mode === "cycle" ? "Ciclo completo" : result.mode === "design" ? "Diseño" : "Crítica"}</span>
              {critique && <span style={{ fontFamily: mono, fontSize: 10, color: C.ink }}>{critique.verdict} · {critique.score}/100</span>}
            </div>
            <div style={{ marginTop: 7, padding: 10, background: C.card, border: `1px solid ${C.line}`, fontFamily: mono, fontSize: 10.5, lineHeight: 1.5, color: C.ink }}>
              {critique?.summary || result.design?.summary || result.output?.summary || "Resultado estructurado recibido."}
            </div>

            {findings.length > 0 && <div style={{ marginTop: 9, display: "flex", flexDirection: "column", gap: 6 }}>
              {findings.map((finding) => (
                <article key={finding.id} style={{ padding: "8px 9px", background: C.card, border: `1px solid ${C.line}`, borderLeft: `3px solid ${severityColor[finding.severity] || C.line}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontFamily: mono, fontSize: 8.5, color: severityColor[finding.severity], textTransform: "uppercase" }}>{finding.severity}</span>
                    <span style={{ fontFamily: sans, fontSize: 10.5, fontWeight: 750, color: C.ink }}>{finding.title}</span>
                    <span style={{ marginLeft: "auto", fontFamily: mono, fontSize: 8.5, color: C.soft }}>{finding.mappedLocation?.label || "Sin ubicación"}</span>
                  </div>
                  <div style={{ marginTop: 4, fontFamily: mono, fontSize: 9.5, lineHeight: 1.45, color: C.soft }}>{finding.observation}</div>
                  <div style={{ marginTop: 3, fontFamily: mono, fontSize: 9.5, lineHeight: 1.45, color: C.ink }}>→ {finding.recommendation}</div>
                  {finding.regulatoryStatus && finding.regulatoryStatus !== "not_applicable" && <div style={{ marginTop: 4, fontFamily: mono, fontSize: 8.5, color: C.orange }}>regulación: {finding.regulatoryStatus}</div>}
                </article>
              ))}
            </div>}

            {(result.applyVersionId || result.revisionVersionId || result.proposalVersionId) && (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                {result.revisionVersionId && <button onClick={() => onApplyVersion(result.revisionVersionId)} style={{ border: "none", borderRadius: 3, padding: "8px 10px", background: C.orange, color: "white", fontFamily: mono, fontSize: 10.5, cursor: "pointer" }}>aplicar revisión de Tweedledum →</button>}
                {!result.revisionVersionId && (result.applyVersionId || result.proposalVersionId) && <button onClick={() => onApplyVersion(result.applyVersionId || result.proposalVersionId)} style={{ border: "none", borderRadius: 3, padding: "8px 10px", background: C.blue, color: "white", fontFamily: mono, fontSize: 10.5, cursor: "pointer" }}>aplicar nueva versión →</button>}
              </div>
            )}
          </section>
        )}
      </div>
    </aside>
  );
}
