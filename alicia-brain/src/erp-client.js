// Cliente de tareas/eventos de ALICE.
//
// FUENTE ÚNICA DE VERDAD = Supabase (tabla `tasks`), la MISMA que lee el ERP web
// (files/alice/src/lib/supabase.js). Antes Alicia escribía en una SQLite propia
// del "ERP backend" (puerto 3002) que el frontend NO lee → las tareas creadas por
// Alicia nunca aparecían en alice.bam.pe (split-brain, 27 jul 2026). Ahora Alicia
// escribe donde el ERP web mira.
//
// Requiere SUPABASE_SERVICE_KEY (service_role) en Railway: el backend bypassa RLS
// (las policies del ERP son `to authenticated`; el anon key no puede escribir).
// Si no está configurada, cae al ERP backend HTTP viejo con un warning — pero eso
// reintroduce el split-brain, así que hay que setear la variable.
import dotenv from "dotenv";
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || "https://apnzitklhxrcszectbxx.supabase.co";
// service_role bypassa RLS. Fallback a anon solo para que dev no explote (anon NO
// puede escribir por RLS → los writes fallarán y caeremos al backend HTTP).
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || "";
const USE_SUPABASE = !!process.env.SUPABASE_SERVICE_KEY;

// Fallback legacy (solo si no hay service key)
const ERP_URL = process.env.ERP_URL || "http://localhost:3002";
const ERP_KEY = process.env.ERP_API_KEY || "alice-erp-dev-key";

if (!USE_SUPABASE) {
  console.warn("⚠️ SUPABASE_SERVICE_KEY no seteada — Alicia escribe en el ERP backend viejo (SQLite), que el ERP web NO lee. Seteá la variable en Railway para que las tareas aparezcan en alice.bam.pe.");
}

// ── Supabase REST (PostgREST) ────────────────────────────────────────────────
async function sb(method, pathAndQuery, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.message) || `Supabase ${res.status}`);
  return data;
}

// Alicia habla en {title, space_id, assignee_id, priority, due_date, description,
// parent_id, status}. El ERP web guarda columnas distintas. Traducimos.
function toTaskRow(input, existing = {}) {
  const row = { updated_at: new Date().toISOString() };
  if (input.title != null)       row.title = String(input.title).trim();
  if (input.description != null) row.description = input.description || "";
  if (input.space_id != null)    { row.space = input.space_id; row.project = String(input.space_id).toUpperCase().slice(0, 6); }
  if (input.priority != null)    row.priority = input.priority;
  if (input.due_date != null)    { row.due = input.due_date; row.end_date = input.due_date; }
  if (input.parent_id != null)   row.parent_id = input.parent_id;
  if (input.assignee_id != null) { row.assignee = input.assignee_id; row.assignees = [input.assignee_id]; }
  if (input.status != null) {
    row.status = input.status;
    row.checked = input.status === "done" || input.status === "completada";
  }
  return row;
}

// Row de Supabase → forma que espera tools.js (con aliases *_id).
function fromTaskRow(r) {
  if (!r) return null;
  const assignees = Array.isArray(r.assignees) && r.assignees.length ? r.assignees
    : (r.assignee ? [r.assignee] : []);
  return {
    id: r.id,
    title: r.title,
    space_id: r.space,
    assignee_id: assignees[0] || null,
    assignees,
    priority: r.priority,
    status: r.status || (r.checked ? "done" : "todo"),
    due_date: r.due || r.end_date || null,
    description: r.description || "",
    parent_id: r.parent_id ?? null,
  };
}

// ── Fallback: ERP backend HTTP viejo ─────────────────────────────────────────
async function erpFetch(method, path, body) {
  const res = await fetch(`${ERP_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "x-api-key": ERP_KEY },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `ERP error ${res.status}`);
  return data;
}

export const erp = {
  // ── Tareas ────────────────────────────────────────────────────────────────
  createTask: async (fields) => {
    if (!USE_SUPABASE) return erpFetch("POST", "/api/tasks", fields);
    const row = toTaskRow(fields);
    // id numérico estilo cockpit (Date.now) — misma convención que el ERP web.
    row.id = Date.now();
    if (row.status == null) { row.status = "todo"; row.checked = false; }
    if (row.priority == null) row.priority = "media";
    // arrays no-null que el frontend espera
    row.tags = []; row.comments = []; row.attachments = [];
    row.activity = [{ when: new Date().toISOString().slice(11, 16), text: "Creada por Alicia" }];
    row.source = "alicia";
    const [created] = await sb("POST", "tasks", row);
    return fromTaskRow(created);
  },

  updateTask: async (id, fields) => {
    if (!USE_SUPABASE) return erpFetch("PATCH", `/api/tasks/${id}`, fields);
    const row = toTaskRow(fields);
    const [updated] = await sb("PATCH", `tasks?id=eq.${encodeURIComponent(id)}`, row);
    return fromTaskRow(updated);
  },

  getTasks: async (params = {}) => {
    if (!USE_SUPABASE) {
      const qs = new URLSearchParams(params).toString();
      return erpFetch("GET", `/api/tasks${qs ? "?" + qs : ""}`);
    }
    const filters = [];
    if (params.space_id) filters.push(`space=eq.${encodeURIComponent(params.space_id)}`);
    if (params.status)   filters.push(`status=eq.${encodeURIComponent(params.status)}`);
    filters.push("order=updated_at.desc");
    const rows = await sb("GET", `tasks?${filters.join("&")}`);
    let tasks = (rows || []).map(fromTaskRow);
    // assignee: filtro client-side (es multi-asignación → array)
    if (params.assignee_id) tasks = tasks.filter(t => t.assignees.includes(params.assignee_id));
    return tasks;
  },

  getTask: async (id) => {
    if (!USE_SUPABASE) return erpFetch("GET", `/api/tasks/${id}`);
    const rows = await sb("GET", `tasks?id=eq.${encodeURIComponent(id)}`);
    return fromTaskRow(rows && rows[0]);
  },

  // ── Eventos ───────────────────────────────────────────────────────────────
  // (siguen en el ERP backend HTTP por ahora — el ERP web aún no consume eventos
  //  desde Supabase; migrar en un paso aparte)
  createEvent: (fields) => erpFetch("POST", "/api/events", fields),
  updateEvent: (id, fields) => erpFetch("PATCH", `/api/events/${id}`, fields),
  getEvents: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return erpFetch("GET", `/api/events${qs ? "?" + qs : ""}`);
  },

  // ── Spaces ────────────────────────────────────────────────────────────────
  getSpaces: () => erpFetch("GET", "/api/spaces"),
};
