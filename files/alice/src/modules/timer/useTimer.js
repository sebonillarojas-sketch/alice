import { useState, useEffect, useCallback } from "react";

const SESSIONS_KEY = "alice:timer:sessions";
const ACTIVE_KEY = "alice:timer:active";

const load = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const save = (key, val) => localStorage.setItem(key, JSON.stringify(val));

const uid = () => Math.random().toString(36).slice(2, 10);

export function useTimer(currentUserId) {
  const [sessions, setSessions] = useState(() => load(SESSIONS_KEY, []));
  const [active, setActive] = useState(() => load(ACTIVE_KEY, null));
  const [tick, setTick] = useState(0);

  // Live clock tick while timer is running
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [active]);

  const persistSessions = useCallback((next) => {
    setSessions(next);
    save(SESSIONS_KEY, next);
  }, []);

  const startTimer = useCallback((task) => {
    // Stop any running timer first
    let current = load(ACTIVE_KEY, null);
    if (current) {
      const now = new Date().toISOString();
      const elapsed = Math.round((Date.now() - new Date(current.startedAt).getTime()) / 1000);
      const existing = load(SESSIONS_KEY, []);
      const updated = existing.map(s =>
        s.id === current.sessionId
          ? { ...s, endedAt: now, duration: elapsed }
          : s
      );
      save(SESSIONS_KEY, updated);
      setSessions(updated);
    }

    const startedAt = new Date().toISOString();
    const sessionId = uid();
    const newSession = {
      id: sessionId,
      taskId: task.id,
      taskTitle: task.title,
      space: task.space,
      userId: currentUserId,
      startedAt,
      endedAt: null,
      duration: null,
    };

    const existing = load(SESSIONS_KEY, []);
    const next = [...existing, newSession];
    persistSessions(next);

    const newActive = { sessionId, taskId: task.id, startedAt };
    setActive(newActive);
    save(ACTIVE_KEY, newActive);
    setTick(0);
  }, [currentUserId, persistSessions]);

  const stopTimer = useCallback(() => {
    if (!active) return;
    const now = new Date().toISOString();
    const elapsed = Math.round((Date.now() - new Date(active.startedAt).getTime()) / 1000);
    const next = sessions.map(s =>
      s.id === active.sessionId
        ? { ...s, endedAt: now, duration: elapsed }
        : s
    );
    persistSessions(next);
    setActive(null);
    save(ACTIVE_KEY, null);
    setTick(0);
  }, [active, sessions, persistSessions]);

  const deleteSession = useCallback((sessionId) => {
    const next = sessions.filter(s => s.id !== sessionId);
    persistSessions(next);
    if (active?.sessionId === sessionId) {
      setActive(null);
      save(ACTIVE_KEY, null);
    }
  }, [sessions, active, persistSessions]);

  // Remove all timer sessions for a set of task IDs (called when tasks are deleted)
  const deleteTaskSessions = useCallback((taskIds) => {
    const idSet = new Set(taskIds);
    const next = sessions.filter(s => !idSet.has(s.taskId));
    persistSessions(next);
    if (active && idSet.has(active.taskId)) {
      setActive(null);
      save(ACTIVE_KEY, null);
    }
  }, [sessions, active, persistSessions]);

  const isRunning = useCallback((taskId) => active?.taskId === taskId, [active]);

  // Seconds elapsed for the currently running timer (live)
  const liveSeconds = active
    ? Math.round((Date.now() - new Date(active.startedAt).getTime()) / 1000)
    : 0;

  // Total seconds logged for a task (completed sessions only)
  const getTaskTotal = useCallback((taskId) =>
    sessions
      .filter(s => s.taskId === taskId && s.duration != null)
      .reduce((acc, s) => acc + s.duration, 0),
  [sessions]);

  return {
    sessions,
    active,
    liveSeconds,
    startTimer,
    stopTimer,
    deleteSession,
    deleteTaskSessions,
    isRunning,
    getTaskTotal,
  };
}

// Formatting helpers (pure, no hook needed)
export const fmtDuration = (seconds) => {
  if (!seconds && seconds !== 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

export const fmtDate = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
};

export const fmtTime = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
};
