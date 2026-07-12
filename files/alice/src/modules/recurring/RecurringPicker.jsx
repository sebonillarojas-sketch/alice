import { useState } from "react";
import { Repeat, X } from "lucide-react";
import { FREQ_OPTIONS, INTERVAL_LABELS, recurringLabel } from "./useRecurring";

const C = {
  ink: "#0A0B0F", muted: "#6B6863", line: "#D9D5CD",
  bg: "#EEEBE3", paper: "#F4F1EA", cobalt: "#3D52D5",
};
const sans = "DM Sans, Helvetica Neue, sans-serif";

// ─── inline picker shown inside task detail / quick add ─────
export function RecurringPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [freq, setFreq] = useState(value?.freq || "weekly");
  const [interval, setInterval] = useState(value?.interval || 1);
  const [until, setUntil] = useState(value?.until || "");

  const active = !!value?.freq;

  function apply() {
    onChange({ freq, interval: Number(interval) || 1, until: until || null });
    setOpen(false);
  }

  function clear(e) {
    e.stopPropagation();
    onChange(null);
    setOpen(false);
  }

  const label = active ? recurringLabel(value) : "Repetir";

  return (
    <div style={{ position: "relative", fontFamily: sans }}>
      {/* trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "4px 10px", fontSize: 11, fontWeight: 500,
          border: `1px solid ${active ? C.cobalt + "88" : C.line}`,
          background: active ? C.cobalt + "14" : "transparent",
          color: active ? C.cobalt : C.muted,
          borderRadius: 2, cursor: "pointer", fontFamily: sans,
        }}
      >
        <Repeat size={11} />
        {label}
        {active && (
          <span
            onClick={clear}
            style={{ marginLeft: 2, display: "flex", alignItems: "center", opacity: 0.6 }}
          >
            <X size={10} />
          </span>
        )}
      </button>

      {/* popover */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 999,
          background: C.paper, border: `1px solid ${C.line}`,
          borderRadius: 4, padding: 14, width: 230,
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        }}>
          {/* freq */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: C.muted, marginBottom: 6 }}>Frecuencia</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {FREQ_OPTIONS.map(o => (
                <button
                  key={o.value}
                  onClick={() => setFreq(o.value)}
                  style={{
                    padding: "4px 10px", fontSize: 11, borderRadius: 2, cursor: "pointer",
                    border: `1px solid ${freq === o.value ? C.cobalt : C.line}`,
                    background: freq === o.value ? C.cobalt : "transparent",
                    color: freq === o.value ? "#fff" : C.muted,
                    fontFamily: sans,
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* interval */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: C.muted, marginBottom: 6 }}>Intervalo</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="number" min={1} max={99} value={interval}
                onChange={e => setInterval(e.target.value)}
                style={{
                  width: 48, padding: "4px 8px", fontSize: 12, fontFamily: sans,
                  border: `1px solid ${C.line}`, borderRadius: 2, background: C.bg,
                  color: C.ink, outline: "none",
                }}
              />
              <span style={{ fontSize: 11, color: C.muted }}>
                {INTERVAL_LABELS[freq]?.(Number(interval) || 1)}
              </span>
            </div>
          </div>

          {/* until */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: C.muted, marginBottom: 6 }}>Termina (opcional)</div>
            <input
              type="date" value={until}
              onChange={e => setUntil(e.target.value)}
              style={{
                width: "100%", padding: "4px 8px", fontSize: 11, fontFamily: sans,
                border: `1px solid ${C.line}`, borderRadius: 2, background: C.bg,
                color: C.ink, outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={apply}
              style={{
                flex: 1, padding: "6px 0", fontSize: 11, fontWeight: 600,
                background: C.cobalt, color: "#fff", border: "none",
                borderRadius: 2, cursor: "pointer", fontFamily: sans,
              }}
            >
              Aplicar
            </button>
            <button
              onClick={() => setOpen(false)}
              style={{
                padding: "6px 12px", fontSize: 11, background: "transparent",
                border: `1px solid ${C.line}`, borderRadius: 2, cursor: "pointer",
                color: C.muted, fontFamily: sans,
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── badge shown in task row / task detail header ────────────
export function RecurringBadge({ rule }) {
  if (!rule?.freq) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      fontSize: 9, fontWeight: 600, textTransform: "uppercase",
      letterSpacing: "0.08em", padding: "2px 6px",
      background: C.cobalt + "18", color: C.cobalt,
      border: `1px solid ${C.cobalt + "44"}`, borderRadius: 2,
      fontFamily: sans,
    }}>
      <Repeat size={8} />
      {recurringLabel(rule)}
    </span>
  );
}
