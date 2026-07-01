import React from "react";
import { Play, Square } from "lucide-react";
import { fmtDuration } from "./useTimer";

const C = {
  cobalt: "#3D52D5", brick: "#A85B5B",
  ink: "#0A0B0F", muted: "#8C8F96",
  line: "#D5D1C5", paper: "#F4F1EA",
};

/**
 * Inline play/stop button for task rows.
 * Props: task, isRunning, liveSeconds, getTaskTotal, onStart, onStop
 */
export function TimerButton({ task, isRunning, liveSeconds, getTaskTotal, onStart, onStop }) {
  const running = isRunning(task.id);
  const total = getTaskTotal(task.id);
  const displaySeconds = running ? liveSeconds : total;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {displaySeconds > 0 && (
        <span style={{
          fontSize: 11, color: running ? C.cobalt : C.muted,
          fontVariantNumeric: "tabular-nums", minWidth: 36,
        }}>
          {fmtDuration(displaySeconds)}
        </span>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); running ? onStop() : onStart(task); }}
        title={running ? "Detener timer" : "Iniciar timer"}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 24, height: 24, borderRadius: 4, border: "none", cursor: "pointer",
          background: running ? "#FEF2F2" : C.paper,
          color: running ? C.brick : C.muted,
          transition: "all 0.15s",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = running ? "#FEE2E2" : "#E8E4DC";
          e.currentTarget.style.color = running ? C.brick : C.ink;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = running ? "#FEF2F2" : C.paper;
          e.currentTarget.style.color = running ? C.brick : C.muted;
        }}
      >
        {running ? <Square size={12} fill="currentColor" /> : <Play size={12} />}
      </button>
    </div>
  );
}
