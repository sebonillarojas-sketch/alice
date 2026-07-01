import React, { useState, useMemo } from "react";
import { Clock, Trash2, Filter } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { fmtDuration, fmtDate, fmtTime } from "./useTimer";

const C = {
  bg: "#EEEBE3", paper: "#F4F1EA", surface: "#FAF8F2",
  ink: "#0A0B0F", inkSoft: "#3A3D45", muted: "#8C8F96",
  line: "#D5D1C5", lineSoft: "#E4E0D4",
  cobalt: "#3D52D5", lavender: "#A89BD9", ochre: "#C2A45A",
  brick: "#A85B5B", green: "#5F8A6A", navy: "#1E2A4A",
};

const SPACE_PALETTE = [C.cobalt, C.lavender, C.ochre, C.green, C.brick, C.navy, C.muted];

const startOfWeek = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay() + 1); // Monday
  return d;
};

const startOfDay = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const PEOPLE = [
  { id: "sb", name: "Sebastián" },
  { id: "aa", name: "Ariel" },
  { id: "jm", name: "Joel" },
  { id: "jt", name: "Jose" },
  { id: "vd", name: "Vanessa" },
  { id: "jmg", name: "Galup" },
  { id: "ac", name: "Andrea" },
];

export function TimerView({ sessions, active, liveSeconds, deleteSession, currentUserId }) {
  const [filterUser, setFilterUser] = useState("all");
  const [filterSpace, setFilterSpace] = useState("all");
  const [period, setPeriod] = useState("week"); // "today" | "week" | "all"

  const completedSessions = useMemo(() =>
    sessions.filter(s => s.duration != null),
  [sessions]);

  const filtered = useMemo(() => {
    const cutoff = period === "today" ? startOfDay()
                 : period === "week"  ? startOfWeek()
                 : new Date(0);
    return completedSessions.filter(s => {
      if (filterUser !== "all" && s.userId !== filterUser) return false;
      if (filterSpace !== "all" && s.space !== filterSpace) return false;
      if (new Date(s.startedAt) < cutoff) return false;
      return true;
    });
  }, [completedSessions, filterUser, filterSpace, period]);

  const totalSeconds = useMemo(() =>
    filtered.reduce((a, s) => a + s.duration, 0),
  [filtered]);

  const spaces = useMemo(() =>
    [...new Set(completedSessions.map(s => s.space))].sort(),
  [completedSessions]);

  const bySpace = useMemo(() => {
    const map = {};
    filtered.forEach(s => {
      map[s.space] = (map[s.space] || 0) + s.duration;
    });
    return Object.entries(map)
      .map(([space, seconds], i) => ({ space, seconds, h: +(seconds / 3600).toFixed(2), color: SPACE_PALETTE[i % SPACE_PALETTE.length] }))
      .sort((a, b) => b.seconds - a.seconds);
  }, [filtered]);

  return (
    <div style={{ padding: "32px 40px", maxWidth: 900, fontFamily: "'DM Sans', sans-serif" }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: C.muted, margin: 0 }}>
          ALICE · Módulo
        </p>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: C.ink, letterSpacing: "-0.02em", margin: "4px 0 0" }}>
          Timer
        </h1>
      </div>

      {/* Active session banner */}
      {active && (
        <div style={{
          background: C.cobalt, color: "#fff", borderRadius: 4,
          padding: "12px 20px", marginBottom: 24,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff", animation: "pulse 1.5s infinite" }} />
          <Clock size={14} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            Corriendo · {fmtDuration(liveSeconds)}
          </span>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", flex: 1 }}>
            {sessions.find(s => s.id === active.sessionId)?.taskTitle ?? ""}
          </span>
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
        {[
          { label: "HOY", seconds: completedSessions.filter(s => new Date(s.startedAt) >= startOfDay()).reduce((a, s) => a + s.duration, 0) },
          { label: "ESTA SEMANA", seconds: completedSessions.filter(s => new Date(s.startedAt) >= startOfWeek()).reduce((a, s) => a + s.duration, 0) },
          { label: "TOTAL FILTRADO", seconds: totalSeconds },
        ].map(({ label, seconds }) => (
          <div key={label} style={{
            background: C.paper, border: `1px solid ${C.line}`, borderRadius: 4, padding: "20px 24px",
          }}>
            <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: C.muted, margin: "0 0 6px" }}>{label}</p>
            <p style={{ fontSize: 24, fontWeight: 700, color: C.ink, letterSpacing: "-0.02em", margin: 0 }}>{fmtDuration(seconds)}</p>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      {bySpace.length > 0 && (
        <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 4, padding: "24px", marginBottom: 32 }}>
          <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: C.muted, margin: "0 0 16px" }}>
            TIEMPO POR SPACE (horas)
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={bySpace} barSize={28}>
              <XAxis dataKey="space" tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} unit="h" />
              <Tooltip
                formatter={(v) => [`${v}h`, "Horas"]}
                contentStyle={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 4, fontSize: 12 }}
              />
              <Bar dataKey="h" radius={[2, 2, 0, 0]}>
                {bySpace.map((entry) => <Cell key={entry.space} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <Filter size={14} color={C.muted} />
        {["today", "week", "all"].map(p => (
          <button key={p} onClick={() => setPeriod(p)} style={{
            padding: "4px 12px", borderRadius: 3, border: `1px solid ${period === p ? C.cobalt : C.line}`,
            background: period === p ? C.cobalt : "transparent",
            color: period === p ? "#fff" : C.muted, fontSize: 12, cursor: "pointer",
          }}>
            {p === "today" ? "Hoy" : p === "week" ? "Semana" : "Todo"}
          </button>
        ))}
        <select value={filterUser} onChange={e => setFilterUser(e.target.value)} style={{
          padding: "4px 10px", borderRadius: 3, border: `1px solid ${C.line}`,
          background: C.paper, color: C.ink, fontSize: 12, cursor: "pointer",
        }}>
          <option value="all">Todos los usuarios</option>
          {PEOPLE.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {spaces.length > 0 && (
          <select value={filterSpace} onChange={e => setFilterSpace(e.target.value)} style={{
            padding: "4px 10px", borderRadius: 3, border: `1px solid ${C.line}`,
            background: C.paper, color: C.ink, fontSize: 12, cursor: "pointer",
          }}>
            <option value="all">Todos los spaces</option>
            {spaces.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>

      {/* Sessions table */}
      <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 4, overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: C.muted, fontSize: 14 }}>
            Sin sesiones registradas para este período.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.line}` }}>
                {["Tarea", "Space", "Usuario", "Fecha", "Inicio", "Duración", ""].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: C.muted, fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...filtered].reverse().map((s, i) => {
                const person = PEOPLE.find(p => p.id === s.userId);
                return (
                  <tr key={s.id} style={{ borderBottom: `1px solid ${C.lineSoft}`, background: i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.01)" }}>
                    <td style={{ padding: "10px 16px", color: C.ink, maxWidth: 240 }}>
                      <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.taskTitle}</span>
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      <span style={{ fontSize: 11, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 3, padding: "2px 8px", color: C.inkSoft }}>{s.space}</span>
                    </td>
                    <td style={{ padding: "10px 16px", color: C.inkSoft }}>{person?.name ?? s.userId}</td>
                    <td style={{ padding: "10px 16px", color: C.muted }}>{fmtDate(s.startedAt)}</td>
                    <td style={{ padding: "10px 16px", color: C.muted }}>{fmtTime(s.startedAt)}</td>
                    <td style={{ padding: "10px 16px", color: C.ink, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmtDuration(s.duration)}</td>
                    <td style={{ padding: "10px 16px" }}>
                      <button onClick={() => deleteSession(s.id)} title="Eliminar" style={{
                        background: "none", border: "none", cursor: "pointer", color: C.muted, padding: 4, borderRadius: 3,
                      }}
                        onMouseEnter={e => e.currentTarget.style.color = C.brick}
                        onMouseLeave={e => e.currentTarget.style.color = C.muted}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}
