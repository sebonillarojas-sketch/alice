// Supabase (Postgres del ERP alice.bam.pe) · REST directo con service role.
// El frontend lee public.tasks con suscripción realtime: lo que se escribe acá
// aparece EN VIVO en el tablero sin refresh. Server-side only — el service role
// bypasea RLS, jamás exponerlo al frontend ni loguearlo.
import dotenv from "dotenv";
dotenv.config();

const URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const supabaseAvailable = () => !!(URL && KEY);

async function rest(method, path, body) {
  if (!supabaseAvailable()) {
    throw new Error("Supabase no configurado: faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (Railway → alice → Variables)");
  }
  const res = await fetch(`${URL}/rest/v1${path}`, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || data?.hint || `Supabase ${res.status}`);
  return data;
}

// Tareas del ERP (tabla public.tasks). Statuses reales del frontend
// (TASK_STATUSES en HyggeOS.jsx): pendiente · en_proceso · en_revision ·
// postergada · completada. `checked` es el espejo legacy de completada.
export const erpTasks = {
  // La tabla no autogenera id: el frontend usa Date.now() y acá clonamos el patrón.
  async create(fields) {
    const rows = await rest("POST", "/tasks", { id: Date.now(), status: "pendiente", source: "alicia", ...fields });
    return rows[0];
  },

  async update(id, fields) {
    const rows = await rest("PATCH", `/tasks?id=eq.${encodeURIComponent(id)}`, { ...fields, updated_at: new Date().toISOString() });
    return rows[0] || null;
  },

  // filters: { space, assignee, status, open, limit } · open=true excluye completadas.
  // Siempre excluye archivadas (not.is.true cubre false Y null de filas pre-columna).
  async list({ space, assignee, status, open, limit } = {}) {
    const p = new URLSearchParams();
    if (space) p.set("space", `eq.${space}`);
    if (assignee) p.set("assignee", `eq.${assignee}`);
    if (status) p.set("status", `eq.${status}`);
    if (open) p.set("status", "not.eq.completada");
    p.set("archived", "not.is.true");
    p.set("order", "created_at.desc");
    if (limit) p.set("limit", String(limit));
    return rest("GET", `/tasks?${p.toString()}`);
  },
};
