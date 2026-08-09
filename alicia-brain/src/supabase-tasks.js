// Tareas en Supabase — la MISMA base que lee/escribe el ERP (tabla `tasks`, con realtime).
// Reemplaza el erp-backend:3002 legacy: Alicia escribía ahí y el ERP nunca lo veía
// (split-brain). Acá se usa la REST API de Supabase (PostgREST) con la SECRET key,
// que bypassa RLS (Alicia es backend, no tiene sesión de usuario).
//
// Env: SUPABASE_URL + SUPABASE_SECRET_KEY (seteá la secret en Railway; no la hardcodees).
import dotenv from "dotenv";
import { isSandbox } from "./sandbox.js";
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
  // multiasignado: assignee_ids[] manda; si no, cae al single (assignee/assignee_id) o al que la crea.
  const assignees = Array.isArray(input.assignee_ids) && input.assignee_ids.length
    ? [...new Set(input.assignee_ids)]
    : [input.assignee ?? input.assignee_id ?? userId ?? "sb"];
  return {
    id: Date.now() * 1000 + Math.floor(Math.random() * 1000),  // entero (col bigint), baja colisión
    title: input.title,
    description: input.description ?? "",
    space: input.space ?? input.space_id ?? "hq",
    assignees,                                        // lista completa
    assignee: assignees[0],                           // primero = compat con lo single
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
  if (Array.isArray(out.assignee_ids)) { out.assignees = [...new Set(out.assignee_ids)]; out.assignee = out.assignees[0]; delete out.assignee_ids; }
  if ("assignee_id" in out) { out.assignee = out.assignee_id; delete out.assignee_id; }
  if ("space_id" in out) { out.space = out.space_id; delete out.space_id; }
  if ("due_date" in out) { out.due = out.due_date; delete out.due_date; }
  delete out.updated_by;
  return out;
}

export async function createTask(input, userId) {
  if (isSandbox()) { console.log("[SANDBOX] no toco Supabase"); return { id: 0, ...(input || {}), _sandbox: true }; }
  const row = toRow(input, userId);
  // Dedup: Alicia reintentaba create al confirmar/fallar y apilaba tareas idénticas
  // (#3..#16 en un mismo pedido). Si ya existe una con el mismo título+space creada
  // hace poco, devolvemos esa en vez de duplicar. Defensivo: si la consulta falla, se crea igual.
  try {
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const qs = new URLSearchParams({ select: "*", title: `ilike.${row.title}`, space: `eq.${row.space}`, updated_at: `gte.${since}`, order: "updated_at.desc", limit: "1" });
    const dupRes = await fetch(`${REST}?${qs}`, { headers: headers() });
    if (dupRes.ok) {
      const [dup] = await dupRes.json();
      if (dup) { console.log(`↩️ createTask dedup: "${row.title}" en ${row.space} ya existe (#${dup.id}), no duplico`); return dup; }
    }
  } catch (e) { console.warn("dedup check falló, creo igual:", e.message); }
  const res = await fetch(REST, { method: "POST", headers: headers({ Prefer: "return=representation" }), body: JSON.stringify(row) });
  if (!res.ok) throw new Error(`Supabase insert ${res.status}: ${await res.text()}`);
  const [created] = await res.json();
  return created;
}

export async function updateTask(id, fields) {
  if (isSandbox()) { console.log("[SANDBOX] no toco Supabase"); return { id: 0, ...(fields || {}), _sandbox: true }; }
  const res = await fetch(`${REST}?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: headers({ Prefer: "return=representation" }), body: JSON.stringify(mapFields(fields)) });
  if (!res.ok) throw new Error(`Supabase patch ${res.status}: ${await res.text()}`);
  const [row] = await res.json();
  return row;
}

export async function getTasks({ space, space_id, assignee, assignee_id, status, query } = {}) {
  if (isSandbox()) { console.log("[SANDBOX] no toco Supabase"); return []; }
  const qs = new URLSearchParams({ select: "*", order: "updated_at.desc", limit: "50" });
  const sp = space ?? space_id, as = assignee ?? assignee_id;
  if (sp) qs.set("space", `eq.${sp}`);
  if (as) qs.set("assignee", `eq.${as}`);
  if (status) qs.set("status", `eq.${status}`);
  // Búsqueda por título parcial (case-insensitive) para que Alicia encuentre la tarea
  // aunque le den el nombre aproximado. PostgREST: title=ilike.*palabra*
  if (query && String(query).trim()) qs.set("title", `ilike.*${String(query).trim()}*`);
  const res = await fetch(`${REST}?${qs}`, { headers: headers() });
  if (!res.ok) throw new Error(`Supabase select ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function deleteTask(id) {
  if (isSandbox()) { console.log("[SANDBOX] no toco Supabase"); return true; }
  const res = await fetch(`${REST}?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", headers: headers() });
  if (!res.ok) throw new Error(`Supabase delete ${res.status}: ${await res.text()}`);
  return true;
}
