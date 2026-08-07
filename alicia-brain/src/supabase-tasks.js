// Tareas en Supabase — la MISMA base que lee/escribe el ERP (tabla `tasks`, con realtime).
// Reemplaza el erp-backend:3002 legacy: Alicia escribía ahí y el ERP nunca lo veía
// (split-brain). Acá se usa la REST API de Supabase (PostgREST) con la SECRET key,
// que bypassa RLS (Alicia es backend, no tiene sesión de usuario).
//
// Env: SUPABASE_URL + SUPABASE_SECRET_KEY (seteá la secret en Railway; no la hardcodees).
import dotenv from "dotenv";
dotenv.config();

const URL = process.env.SUPABASE_URL || "https://apnzitklhxrcszectbxx.supabase.co";
const KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_KEY || "";
const REST = `${URL}/rest/v1/tasks`;

function headers(extra = {}) {
  if (!KEY) throw new Error("falta SUPABASE_SECRET_KEY en el entorno de alicia-brain (seteala en Railway)");
  return { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...extra };
}

// entrada semántica de Alicia (tolera nombres viejos assignee_id/space_id/due_date) → fila `tasks` del ERP
function toRow(input = {}, userId) {
  return {
    id: Date.now() * 1000 + Math.floor(Math.random() * 1000),  // entero (col bigint), baja colisión
    title: input.title,
    description: input.description ?? "",
    space: input.space ?? input.space_id ?? "hq",
    assignee: input.assignee ?? input.assignee_id ?? userId ?? "sb",
    status: input.status ?? "pendiente",             // el ERP usa "pendiente", no "todo"
    priority: input.priority ?? "media",
    due: input.due ?? input.due_date ?? "",
    tags: input.tags ?? [],
    checked: false,
    archived: false,
    activity: [],
    comments: [],
    attachments: [],
    updated_at: new Date().toISOString(),
  };
}

// campos de update (mapea nombres viejos a las columnas del ERP)
function mapFields(f = {}) {
  const out = { ...f, updated_at: new Date().toISOString() };
  if ("assignee_id" in out) { out.assignee = out.assignee_id; delete out.assignee_id; }
  if ("space_id" in out) { out.space = out.space_id; delete out.space_id; }
  if ("due_date" in out) { out.due = out.due_date; delete out.due_date; }
  delete out.updated_by;
  return out;
}

export async function createTask(input, userId) {
  const res = await fetch(REST, { method: "POST", headers: headers({ Prefer: "return=representation" }), body: JSON.stringify(toRow(input, userId)) });
  if (!res.ok) throw new Error(`Supabase insert ${res.status}: ${await res.text()}`);
  const [row] = await res.json();
  return row;
}

export async function updateTask(id, fields) {
  const res = await fetch(`${REST}?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: headers({ Prefer: "return=representation" }), body: JSON.stringify(mapFields(fields)) });
  if (!res.ok) throw new Error(`Supabase patch ${res.status}: ${await res.text()}`);
  const [row] = await res.json();
  return row;
}

export async function getTasks({ space, space_id, assignee, assignee_id, status } = {}) {
  const qs = new URLSearchParams({ select: "*", order: "updated_at.desc", limit: "50" });
  const sp = space ?? space_id, as = assignee ?? assignee_id;
  if (sp) qs.set("space", `eq.${sp}`);
  if (as) qs.set("assignee", `eq.${as}`);
  if (status) qs.set("status", `eq.${status}`);
  const res = await fetch(`${REST}?${qs}`, { headers: headers() });
  if (!res.ok) throw new Error(`Supabase select ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function deleteTask(id) {
  const res = await fetch(`${REST}?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", headers: headers() });
  if (!res.ok) throw new Error(`Supabase delete ${res.status}: ${await res.text()}`);
  return true;
}
