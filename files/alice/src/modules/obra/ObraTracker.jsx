import React, { useState, useCallback } from "react";
import { aliciaAnalyze } from "../../lib/alicia";

const C = {
  bg: "#EEEBE3", paper: "#F4F1EA", ink: "#0A0B0F", inkSoft: "#2E2E33",
  muted: "#6B6863", line: "#D9D5CD", lineSoft: "#E5E1D6",
  green: "#5F8A6A", ochre: "#C2A45A", brick: "#A85B5B",
  cobalt: "#3D52D5", navy: "#1E2A4A",
};

const STORAGE_KEY = (projectId) => `obra_tracker_${projectId}`;

function loadState(projectId) {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY(projectId))) || { baseline: null, reports: [] };
  } catch { return { baseline: null, reports: [] }; }
}

function saveState(projectId, state) {
  localStorage.setItem(STORAGE_KEY(projectId), JSON.stringify(state));
}

function Semaforo({ pct, target }) {
  const diff = pct - target;
  if (diff >= 0) return <span style={{ color: C.green, fontWeight: 600, fontSize: 11 }}>● En tiempo</span>;
  if (diff >= -5) return <span style={{ color: C.ochre, fontWeight: 600, fontSize: 11 }}>● Leve retraso</span>;
  return <span style={{ color: C.brick, fontWeight: 600, fontSize: 11 }}>● Retraso crítico</span>;
}

function ProgressBar({ pct, target, color }) {
  return (
    <div style={{ position: "relative", height: 8, background: C.lineSoft, borderRadius: 2, overflow: "visible" }}>
      <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: color || C.cobalt, borderRadius: 2, transition: "width .4s" }} />
      {target != null && (
        <div style={{ position: "absolute", top: -4, left: `${Math.min(target, 100)}%`, transform: "translateX(-50%)", width: 2, height: 16, background: C.muted, borderRadius: 1 }} title={`Meta: ${target}%`} />
      )}
    </div>
  );
}

async function callClaude(systemPrompt, userPrompt) {
  return aliciaAnalyze({ system: systemPrompt, prompt: userPrompt, max_tokens: 2048 });
}

async function readPdfAsBase64(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(",")[1];
      res(base64);
    };
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}

async function parsePdfWithClaude(file, systemPrompt) {
  const base64 = await readPdfAsBase64(file);
  return aliciaAnalyze({
    system: systemPrompt,
    prompt: "Procesá este documento y devolvé SOLO el JSON solicitado, sin texto adicional.",
    pdf_base64: base64,
    max_tokens: 2500,
  });
}

const BASELINE_PROMPT = `Sos un experto en gestión de obras de construcción en Perú.
Te van a pasar un PDF con un Gantt o cronograma de obra.
Extraé la información y devolvé SOLO este JSON (sin markdown, sin explicación):
{
  "title": "nombre del proyecto",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "totalWeeks": número,
  "phases": [
    { "name": "nombre de fase/hito", "startWeek": número, "endWeek": número, "pctWeight": número }
  ],
  "parsedAt": "ISO date"
}
Los pctWeight deben sumar 100. Si no hay semanas exactas, estimá proporcionalmente.`;

const REPORT_PROMPT = (baseline) => `Sos un experto en gestión de obras de construcción en Perú.
Tenés el cronograma base del proyecto:
${JSON.stringify(baseline, null, 2)}

Te van a pasar un PDF del comité semanal de obra. Extraé el avance y devolvé SOLO este JSON:
{
  "weekNumber": número (semana del proyecto),
  "reportDate": "YYYY-MM-DD",
  "realPct": número (% real de avance global),
  "targetPct": número (% planificado para esta semana según cronograma base),
  "phaseUpdates": [
    { "name": "nombre fase", "realPct": número, "status": "on_track|delayed|critical|completed" }
  ],
  "alerts": ["alerta 1", "alerta 2"],
  "highlights": ["logro 1", "logro 2"],
  "summary": "resumen ejecutivo de 2-3 oraciones"
}`;

// ── Pantalla de carga de Gantt base ──
function LoadBaseline({ projectId, projectName, onLoaded }) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const processFile = useCallback(async (file) => {
    // Sin key en el browser — el PDF viaja al backend (aliceai) que tiene la key
    if (!file || file.type !== "application/pdf") { setError("Solo se aceptan archivos PDF"); return; }
    setLoading(true); setError(null);
    try {
      const raw = await parsePdfWithClaude(file, BASELINE_PROMPT);
      const clean = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      const baseline = JSON.parse(clean);
      baseline.parsedAt = new Date().toISOString();
      baseline.fileName = file.name;
      const state = { baseline, reports: [] };
      saveState(projectId, state);
      onLoaded(state);
    } catch (e) {
      setError("Error al procesar el PDF: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, onLoaded]);

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  return (
    <div style={{ padding: "48px 32px", maxWidth: 560, margin: "0 auto" }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: C.muted, marginBottom: 8 }}>
        Obra · {projectName}
      </div>
      <h2 style={{ fontSize: 28, fontWeight: 300, color: C.ink, letterSpacing: "-0.02em", marginBottom: 8 }}>
        Cargá el Gantt base
      </h2>
      <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 32 }}>
        Subí el PDF del cronograma inicial. ALICE lo interpreta y arma la línea base para comparar los reportes semanales de comité.
      </p>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          border: `2px dashed ${dragging ? C.cobalt : C.line}`,
          borderRadius: 4,
          padding: "48px 32px",
          textAlign: "center",
          background: dragging ? "#EEF0FB" : C.paper,
          transition: "all .15s",
          cursor: loading ? "wait" : "pointer",
        }}
        onClick={() => { if (!loading) document.getElementById(`gantt-input-${projectId}`).click(); }}
      >
        <input
          id={`gantt-input-${projectId}`}
          type="file"
          accept="application/pdf"
          style={{ display: "none" }}
          onChange={(e) => processFile(e.target.files[0])}
        />
        {loading ? (
          <>
            <div style={{ fontSize: 24, marginBottom: 12 }}>⏳</div>
            <div style={{ fontSize: 13, color: C.muted }}>ALICE está leyendo el Gantt…</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 28, marginBottom: 12, color: C.muted }}>📄</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, marginBottom: 4 }}>Arrastrá el PDF acá o hacé clic</div>
            <div style={{ fontSize: 11, color: C.muted }}>Cronograma inicial · Gantt · MS Project export</div>
          </>
        )}
      </div>
      {error && <div style={{ marginTop: 12, fontSize: 11, color: C.brick, padding: "8px 12px", background: C.brick + "10", borderRadius: 3 }}>{error}</div>}
    </div>
  );
}

// ── Card de reporte semanal ──
function ReportCard({ report, index, total }) {
  const [open, setOpen] = useState(index === 0);
  const diff = report.realPct - report.targetPct;
  const diffColor = diff >= 0 ? C.green : diff >= -5 ? C.ochre : C.brick;
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 3, marginBottom: 8, background: C.paper }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", color: C.muted }}>Sem {report.weekNumber}</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: C.ink }}>{report.reportDate}</div>
          <Semaforo pct={report.realPct} target={report.targetPct} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: C.ink }}>{report.realPct}%</div>
          <div style={{ fontSize: 11, color: diffColor, fontWeight: 500 }}>{diff >= 0 ? "+" : ""}{diff.toFixed(1)}%</div>
          <div style={{ fontSize: 10, color: C.muted }}>{open ? "▲" : "▼"}</div>
        </div>
      </div>
      {open && (
        <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${C.lineSoft}` }}>
          <p style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.6, margin: "12px 0" }}>{report.summary}</p>
          {report.alerts?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: ".1em", color: C.brick, marginBottom: 6 }}>Alertas</div>
              {report.alerts.map((a, i) => (
                <div key={i} style={{ fontSize: 11, color: C.inkSoft, padding: "4px 0", borderBottom: `1px solid ${C.lineSoft}` }}>⚠ {a}</div>
              ))}
            </div>
          )}
          {report.highlights?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: ".1em", color: C.green, marginBottom: 6 }}>Avances</div>
              {report.highlights.map((h, i) => (
                <div key={i} style={{ fontSize: 11, color: C.inkSoft, padding: "4px 0", borderBottom: `1px solid ${C.lineSoft}` }}>✓ {h}</div>
              ))}
            </div>
          )}
          {report.phaseUpdates?.length > 0 && (
            <div>
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: ".1em", color: C.muted, marginBottom: 8 }}>Fases</div>
              {report.phaseUpdates.map((ph, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: C.ink }}>{ph.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 500, color: ph.status === "completed" ? C.green : ph.status === "critical" ? C.brick : ph.status === "delayed" ? C.ochre : C.ink }}>{ph.realPct}%</span>
                  </div>
                  <ProgressBar pct={ph.realPct} color={ph.status === "completed" ? C.green : ph.status === "critical" ? C.brick : ph.status === "delayed" ? C.ochre : C.cobalt} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Vista principal ──
export default function ObraTracker({ projectId, projectName, onProgressUpdate }) {
  const [state, setState] = useState(() => loadState(projectId));
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const handleBaselineLoaded = (newState) => {
    setState(newState);
  };

  const processWeeklyReport = useCallback(async (file) => {
    // Sin key en el browser — el PDF viaja al backend (aliceai) que tiene la key
    if (!file || file.type !== "application/pdf") { setUploadError("Solo se aceptan PDFs"); return; }
    setUploading(true); setUploadError(null);
    try {
      const raw = await parsePdfWithClaude(file, REPORT_PROMPT(state.baseline));
      const clean = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      const report = JSON.parse(clean);
      report.fileName = file.name;
      report.uploadedAt = new Date().toISOString();
      const newReports = [report, ...state.reports];
      const newState = { ...state, reports: newReports };
      saveState(projectId, newState);
      setState(newState);
      if (onProgressUpdate) onProgressUpdate(report.realPct);
    } catch (e) {
      setUploadError("Error al procesar: " + e.message);
    } finally {
      setUploading(false);
    }
  }, [state, projectId, onProgressUpdate]);

  if (!state.baseline) {
    return <LoadBaseline projectId={projectId} projectName={projectName} onLoaded={handleBaselineLoaded} />;
  }

  const latest = state.reports[0];
  const baseline = state.baseline;

  const resetBaseline = () => {
    if (!window.confirm("¿Eliminar la línea base y todos los reportes?")) return;
    const empty = { baseline: null, reports: [] };
    saveState(projectId, empty);
    setState(empty);
    if (onProgressUpdate) onProgressUpdate(0);
  };

  return (
    <div style={{ padding: "32px 32px 48px", maxWidth: 720, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: C.muted, marginBottom: 4 }}>
            Obra · {projectName}
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 500, color: C.ink, letterSpacing: "-0.02em" }}>
            {baseline.title || "Cronograma"}
          </h2>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
            {baseline.startDate} → {baseline.endDate} · {baseline.totalWeeks} semanas · {state.reports.length} reportes
          </div>
        </div>
        <button onClick={resetBaseline} style={{ fontSize: 10, color: C.muted, background: "transparent", border: `1px solid ${C.line}`, borderRadius: 3, padding: "5px 10px", cursor: "pointer" }}>
          Resetear
        </button>
      </div>

      {/* KPIs */}
      {latest && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Avance real", value: latest.realPct + "%", sub: `Meta: ${latest.targetPct}%` },
            { label: "Desvío", value: `${latest.realPct - latest.targetPct >= 0 ? "+" : ""}${(latest.realPct - latest.targetPct).toFixed(1)}%`, sub: `Sem ${latest.weekNumber}`, color: latest.realPct >= latest.targetPct ? C.green : C.brick },
            { label: "Semáforo", value: null, sem: latest },
          ].map((k, i) => (
            <div key={i} style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 3, padding: "14px 16px" }}>
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: ".1em", color: C.muted, marginBottom: 6 }}>{k.label}</div>
              {k.sem ? (
                <Semaforo pct={k.sem.realPct} target={k.sem.targetPct} />
              ) : (
                <div style={{ fontSize: 22, fontWeight: 600, color: k.color || C.ink }}>{k.value}</div>
              )}
              {k.sub && <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{k.sub}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Progress bar global */}
      {latest && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: C.muted }}>Avance global</span>
            <span style={{ fontSize: 11, color: C.muted }}>Meta semana: {latest.targetPct}%</span>
          </div>
          <ProgressBar pct={latest.realPct} target={latest.targetPct} />
        </div>
      )}

      {/* Upload reporte semanal */}
      <div
        style={{ border: `1px dashed ${C.line}`, borderRadius: 3, padding: "20px 24px", marginBottom: 32, display: "flex", alignItems: "center", justifyContent: "space-between", background: C.paper, cursor: uploading ? "wait" : "pointer" }}
        onClick={() => { if (!uploading) document.getElementById(`report-input-${projectId}`).click(); }}
      >
        <input
          id={`report-input-${projectId}`}
          type="file"
          accept="application/pdf"
          style={{ display: "none" }}
          onChange={(e) => processWeeklyReport(e.target.files[0])}
        />
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: C.ink, marginBottom: 2 }}>
            {uploading ? "Procesando reporte…" : "Subir reporte de comité"}
          </div>
          <div style={{ fontSize: 10, color: C.muted }}>PDF del acta del comité semanal de obra</div>
        </div>
        <div style={{ fontSize: 20, color: C.muted }}>{uploading ? "⏳" : "📄 +"}</div>
      </div>
      {uploadError && <div style={{ marginBottom: 16, fontSize: 11, color: C.brick, padding: "8px 12px", background: C.brick + "10", borderRadius: 3 }}>{uploadError}</div>}

      {/* Historial */}
      {state.reports.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 0", color: C.muted, fontSize: 13 }}>
          Todavía no hay reportes. Subí el primer acta de comité.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: ".12em", color: C.muted, marginBottom: 12 }}>
            Historial · {state.reports.length} reportes
          </div>
          {state.reports.map((r, i) => (
            <ReportCard key={r.uploadedAt || i} report={r} index={i} total={state.reports.length} />
          ))}
        </>
      )}
    </div>
  );
}
