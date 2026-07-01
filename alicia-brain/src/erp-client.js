// Cliente HTTP para ALICE ERP Backend (puerto 3002)
import dotenv from "dotenv";
dotenv.config();

const ERP_URL = process.env.ERP_URL || "http://localhost:3002";
const ERP_KEY = process.env.ERP_API_KEY || "alice-erp-dev-key";

async function erpFetch(method, path, body) {
  const res = await fetch(`${ERP_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ERP_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `ERP error ${res.status}`);
  return data;
}

export const erp = {
  // ── Tareas ────────────────────────────────────────────────────────────────
  createTask: (fields) => erpFetch("POST", "/api/tasks", fields),
  updateTask: (id, fields) => erpFetch("PATCH", `/api/tasks/${id}`, fields),
  getTasks:   (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return erpFetch("GET", `/api/tasks${qs ? "?" + qs : ""}`);
  },
  getTask: (id) => erpFetch("GET", `/api/tasks/${id}`),

  // ── Eventos ───────────────────────────────────────────────────────────────
  createEvent: (fields) => erpFetch("POST", "/api/events", fields),
  updateEvent: (id, fields) => erpFetch("PATCH", `/api/events/${id}`, fields),
  getEvents:   (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return erpFetch("GET", `/api/events${qs ? "?" + qs : ""}`);
  },

  // ── Spaces ────────────────────────────────────────────────────────────────
  getSpaces: () => erpFetch("GET", "/api/spaces"),
};
