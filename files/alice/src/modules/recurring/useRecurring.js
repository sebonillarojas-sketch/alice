import { useEffect, useRef } from "react";

// ─── date helpers ────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, "0");

function toYMD(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseYMD(str) {
  if (!str) return null;
  const [y, m, d] = str.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function addWeeks(date, n) { return addDays(date, n * 7); }

function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function nextOccurrence(rule, fromDate) {
  const base = new Date(fromDate);
  switch (rule.freq) {
    case "daily":   return addDays(base, rule.interval || 1);
    case "weekly":  return addWeeks(base, rule.interval || 1);
    case "monthly": return addMonths(base, rule.interval || 1);
    case "yearly":  return addMonths(base, (rule.interval || 1) * 12);
    default:        return null;
  }
}

// ─── spawn next task from a completed recurring task ─────────
function spawnNext(task) {
  const rule = task.recurring;
  if (!rule || !rule.freq) return null;

  const baseDateStr = task.due || toYMD(new Date());
  const baseDate = parseYMD(baseDateStr) || new Date();
  const next = nextOccurrence(rule, baseDate);
  if (!next) return null;

  const nextDue = toYMD(next);

  // stop if past end date
  if (rule.until && nextDue > rule.until) return null;

  return {
    ...task,
    id: Date.now() + Math.floor(Math.random() * 1000),
    checked: false,
    due: nextDue,
    startDate: nextDue,
    endDate: nextDue,
    completedAt: null,
    comments: [],
    activity: [{ when: new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }), text: `Generada automáticamente · recurrencia ${rule.freq}` }],
    recurringParentId: task.id,
  };
}

// ─── hook ────────────────────────────────────────────────────
export function useRecurring(tasks, setTasks) {
  const checkedRef = useRef(new Set());

  useEffect(() => {
    const recurring = tasks.filter(t => t.checked && t.recurring?.freq);
    const toSpawn = [];

    for (const task of recurring) {
      if (checkedRef.current.has(task.id)) continue;
      checkedRef.current.add(task.id);

      // don't spawn if next sibling already exists
      const alreadyHasNext = tasks.some(
        t => t.recurringParentId === task.id && !t.checked
      );
      if (alreadyHasNext) continue;

      const next = spawnNext(task);
      if (next) toSpawn.push(next);
    }

    if (toSpawn.length > 0) {
      setTasks(prev => [...toSpawn, ...prev]);
    }
  }, [tasks, setTasks]);
}

// ─── UI helpers ──────────────────────────────────────────────
export const FREQ_OPTIONS = [
  { value: "daily",   label: "Diario" },
  { value: "weekly",  label: "Semanal" },
  { value: "monthly", label: "Mensual" },
  { value: "yearly",  label: "Anual" },
];

export const INTERVAL_LABELS = {
  daily:   (n) => n === 1 ? "Cada día" : `Cada ${n} días`,
  weekly:  (n) => n === 1 ? "Cada semana" : `Cada ${n} semanas`,
  monthly: (n) => n === 1 ? "Cada mes" : `Cada ${n} meses`,
  yearly:  (n) => n === 1 ? "Cada año" : `Cada ${n} años`,
};

export function recurringLabel(rule) {
  if (!rule?.freq) return null;
  const fn = INTERVAL_LABELS[rule.freq];
  return fn ? fn(rule.interval || 1) : rule.freq;
}
