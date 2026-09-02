import { ALICIA_URL } from "../../lib/brain.js";

const clone = (value) => structuredClone(value);
const safeId = (value) => String(value || "project").replace(/[^a-zA-Z0-9_-]/g, "_");

export function createPlanVersion(history = [], {
  projectId,
  parentVersionId = null,
  createdBy = "human",
  snapshot,
  now = new Date().toISOString(),
  label = null,
} = {}) {
  const existing = Array.isArray(history) ? history : [];
  const versionNumber = existing.reduce((max, item) => Math.max(max, Number(item.version) || 0), 0) + 1;
  const version = {
    id: `plan_${safeId(projectId)}_v${versionNumber}`,
    projectId: String(projectId || ""),
    version: versionNumber,
    parentVersionId: parentVersionId || null,
    label: label || `V${String(versionNumber).padStart(2, "0")}`,
    createdBy,
    createdAt: typeof now === "string" ? now : new Date(now).toISOString(),
    snapshot: clone(snapshot || { rooms: [], items: [] }),
  };
  return { version, history: [...existing.map(clone), version] };
}

export function architectureDesignReadiness({ rooms = [], boundary = null, areaTarget = 0 } = {}) {
  const hasRooms = Array.isArray(rooms) && rooms.some((room) => Array.isArray(room?.pts) && room.pts.length >= 3);
  const hasBoundary = Array.isArray(boundary) && boundary.length >= 3;
  const hasArea = Number.isFinite(Number(areaTarget)) && Number(areaTarget) > 0;
  return hasRooms || hasBoundary || hasArea
    ? { ok: true, reason: null }
    : { ok: false, reason: "Define el lote, un área objetivo o al menos un ambiente antes de diseñar." };
}

export function createActivatedPlanVersion(history = [], options = {}) {
  const created = createPlanVersion(history, options);
  return {
    ...created,
    activeVersionId: created.version.id,
    snapshot: clone(created.version.snapshot),
  };
}

export function applyPlanVersion(history = [], versionId) {
  const version = history.find((item) => item.id === versionId);
  if (!version) throw new Error(`Plan version ${versionId} not found`);
  return { activeVersionId: version.id, snapshot: clone(version.snapshot), history: history.map(clone) };
}

export function serializeValidation(value = {}) {
  const findings = [];
  for (const item of value.fueraLote || []) findings.push({
    code: "outside_boundary",
    severity: "major",
    targetType: item.tipo === "mueble" ? "item" : "room",
    targetId: String(item.id),
    message: `${item.name || item.id} está fuera del terreno`,
  });
  for (const item of value.sinPiso || []) findings.push({
    code: "item_without_room",
    severity: "major",
    targetType: "item",
    targetId: String(item.id),
    message: `${item.name || item.id} no está dentro de un ambiente`,
  });
  for (const item of value.aislados || []) findings.push({
    code: "unreachable_room",
    severity: "major",
    targetType: "room",
    targetId: String(item.id),
    message: `${item.name || item.id} no es alcanzable desde la circulación`,
  });
  return { ok: value.ok === true, total: findings.length, findings, messages: Array.isArray(value.mensajes) ? value.mensajes.map(String) : [] };
}

export function mapFindingLocation(finding = {}, rooms = [], items = []) {
  const location = finding.location || {};
  const room = location.roomId ? rooms.find((entry) => entry.id === location.roomId) : null;
  if (room) return { targetType: "room", targetId: room.id, label: room.name || room.id, point: location.point || null };
  const item = location.itemId ? items.find((entry) => entry.id === location.itemId) : null;
  if (item) return { targetType: "item", targetId: item.id, label: item.ref || item.id, point: location.point || null };
  return { targetType: null, targetId: null, label: "Sin ubicación", point: location.point || null };
}

async function callArchitecture(path, payload, fetchImpl = fetch) {
  const response = await fetchImpl(`${ALICIA_URL}/api/architecture/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) throw new Error("tu sesión venció — volvé a entrar");
    throw new Error(data.error || `architecture ${response.status}`);
  }
  return data;
}

export const designWithTweedledum = (payload, options = {}) => callArchitecture("tweedledum/design", payload, options.fetchImpl);
export const reviseWithTweedledum = (payload, options = {}) => callArchitecture("tweedledum/revise", payload, options.fetchImpl);
export const critiqueWithTweedledee = (payload, options = {}) => callArchitecture("tweedledee/critique", payload, options.fetchImpl);
export const runArchitectureCycle = (payload, options = {}) => callArchitecture("review-cycle", payload, options.fetchImpl);
