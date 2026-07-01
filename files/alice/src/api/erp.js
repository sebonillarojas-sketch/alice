// ALICE ERP · cliente HTTP para el cockpit
const ERP_URL = import.meta.env.VITE_ERP_URL || "http://localhost:3002";
const ERP_KEY = import.meta.env.VITE_ERP_API_KEY || "alice-erp-dev-key";

async function erpFetch(method, path, body) {
  const res = await fetch(`${ERP_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ERP_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `ERP ${res.status}`);
  }
  return res.json();
}

// ── Tareas ─────────────────────────────────────────────────────────────────

export const erpTasks = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return erpFetch("GET", `/api/tasks${qs ? "?" + qs : ""}`);
  },
  create: (task, userId) => erpFetch("POST", "/api/tasks", {
    title:       task.title,
    description: task.note || task.description || null,
    space_id:    task.space || "hq",
    parent_id:   task.parentId || null,
    status:      cockpitStatusToERP(task.status, task.checked),
    priority:    task.priority || "media",
    assignee_id: task.assignee || null,
    due_date:    task.endDate || task.dueDate || null,
    created_by:  userId || null,
  }),
  update: (erpId, fields, userId) => erpFetch("PATCH", `/api/tasks/${erpId}`, {
    ...fields,
    updated_by: userId || null,
  }),
  addComment: (erpId, userId, content) =>
    erpFetch("POST", `/api/tasks/${erpId}/comments`, { user_id: userId, content }),
};

// ── Eventos ────────────────────────────────────────────────────────────────

export const erpEvents = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return erpFetch("GET", `/api/events${qs ? "?" + qs : ""}`);
  },
  create: (event, userId) => erpFetch("POST", "/api/events", {
    title:      event.title,
    date:       event.date,
    time:       event.time || null,
    attendees:  event.attendees || [],
    purpose:    event.purpose || null,
    brief:      event.brief || null,
    space_id:   event.space || null,
    created_by: userId || null,
  }),
};

// ── Health ─────────────────────────────────────────────────────────────────

export const erpHealth = () => erpFetch("GET", "/health").catch(() => null);

// ── Helpers ────────────────────────────────────────────────────────────────

function cockpitStatusToERP(status, checked) {
  if (checked) return "done";
  if (status === "in_progress") return "in_progress";
  if (status === "review")      return "review";
  if (status === "cancelled")   return "cancelled";
  return "todo";
}

export function erpStatusToCockpit(erpStatus) {
  const map = {
    todo:        { checked: false, status: "todo" },
    in_progress: { checked: false, status: "in_progress" },
    review:      { checked: false, status: "review" },
    done:        { checked: true,  status: "done" },
    cancelled:   { checked: false, status: "cancelled" },
  };
  return map[erpStatus] || { checked: false, status: "todo" };
}

// Convierte una tarea del ERP al formato del cockpit
export function erpTaskToCockpit(t) {
  const { checked, status } = erpStatusToCockpit(t.status);
  return {
    id:         t.id,
    title:      t.title,
    space:      t.space_id,
    parentId:   t.parent_id || null,
    checked,
    status,
    priority:   t.priority || "media",
    assignee:   t.assignee_id || null,
    endDate:    t.due_date || null,
    note:       t.description || "",
    comments:   [],
    attachments:[],
    activity:   [],
    _erpId:     t.id,
    _fromERP:   true,
  };
}
