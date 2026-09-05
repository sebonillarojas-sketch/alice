import { generarDistribuciones } from "../planos/plantas.js";

const toPolygon = (pts) => pts.map((point) => [Number(point.x), Number(point.y)]);
const toPoints = (polygon) => polygon.map(([x, y]) => ({ x: Number(x), y: Number(y) }));
const clone = (value) => structuredClone(value);
const safeId = (value) => String(value || "project").replace(/[^a-zA-Z0-9_-]/g, "_");

export function cabidaVersionId(projectId, inputs = {}) {
  const source = JSON.stringify(inputs);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `cabida_${safeId(projectId)}_${(hash >>> 0).toString(36)}`;
}

export function appendFloorProposalRecord(project = {}, result = {}, { now = new Date().toISOString() } = {}) {
  const existing = Array.isArray(project.cabida?.floorProposals) ? project.cabida.floorProposals : [];
  const version = existing.reduce((max, item) => Math.max(max, Number(item.version) || 0), 0) + 1;
  const selected = result.selected || {};
  const record = {
    id: `floor_${safeId(project.id)}_v${version}`,
    version,
    sourceCabidaVersionId: String(selected.floor?.sourceCabidaVersionId || ""),
    parentProposalId: existing.at(-1)?.id || null,
    source: String(result.source || "tweedledum"),
    promptVersion: result.promptVersion ? String(result.promptVersion) : null,
    model: result.model ? String(result.model) : null,
    summary: String(selected.summary || ""),
    floor: clone(selected.floor || { sourceCabidaVersionId: "", polygons: [] }),
    validation: clone(result.validation || { ok: false, findings: [] }),
    candidateValidation: clone(result.candidateValidation || null),
    fallbackReason: result.fallbackReason ? String(result.fallbackReason) : null,
    createdAt: typeof now === "string" ? now : new Date(now).toISOString(),
  };
  return {
    record,
    project: {
      ...clone(project),
      cabida: { ...clone(project.cabida || {}), floorProposals: [...existing.map(clone), record] },
    },
  };
}

export function acceptFloorProposalRecord(project = {}, proposalId) {
  const proposals = Array.isArray(project.cabida?.floorProposals) ? project.cabida.floorProposals : [];
  const record = proposals.find((item) => item.id === proposalId);
  if (!record) throw new Error(`Floor proposal ${proposalId} not found`);
  return {
    ...clone(project),
    cabida: { ...clone(project.cabida || {}), activeFloorProposalId: record.id },
    plano: { ...clone(project.plano || {}), floorProposal: clone(record) },
  };
}

export function fallbackFloorProposal({ footprint, frontIdx = 0, brief = {}, sourceCabidaVersionId }) {
  const candidates = generarDistribuciones(footprint, frontIdx, brief);
  const parti = candidates.find((candidate) => {
    const refs = (candidate.res?.units || []).map((unit) => unit.unitRef);
    return refs.length === new Set(refs).size;
  }) || candidates[0];
  if (!parti?.res) throw new Error("La huella no admite una distribución determinística");
  const { core, corridors = [], corridor, units = [] } = parti.res;
  const halls = corridors.length ? corridors : (corridor ? [corridor] : []);
  const polygons = [];
  if (core) polygons.push({ polygonId: core.id, role: "core", name: "core", unitRef: null, unitProgram: null, polygon: toPolygon(core.pts) });
  halls.forEach((hall, index) => polygons.push({ polygonId: hall.id, role: "circulacion", name: `circulación ${index + 1}`, unitRef: null, unitProgram: null, polygon: toPolygon(hall.pts) }));
  units.forEach((unit) => {
    const dormitorios = Math.max(1, Math.min(3, Number(unit.requestedProgram?.dormitorios ?? unit.tipologia?.dorms ?? parseInt(unit.subtipo, 10) ?? 1) || 1));
    const banos = Math.max(1, Number(unit.requestedProgram?.banos ?? unit.tipologia?.banos ?? (dormitorios <= 1 ? 1 : 2)) || 1);
    polygons.push({
      polygonId: unit.id,
      role: "unidad",
      name: unit.name || `${dormitorios}D`,
      unitRef: unit.unitRef || unit.id,
      unitProgram: { dormitorios, banos },
      polygon: toPolygon(unit.pts),
    });
  });
  return {
    summary: "Respaldo determinístico de packFloor",
    floor: { sourceCabidaVersionId: String(sourceCabidaVersionId || ""), polygons },
    assumptions: [],
    tradeoffs: ["Distribución determinística utilizada como respaldo"],
  };
}

export function proposalToParti(proposal = {}) {
  const polygons = Array.isArray(proposal.floor?.polygons) ? proposal.floor.polygons : [];
  return {
    id: `floor_${proposal.floor?.sourceCabidaVersionId || "proposal"}`,
    nombre: proposal.summary || "Tweedledum",
    rooms: polygons.map((item) => ({
      id: item.polygonId,
      polygonId: item.polygonId,
      role: item.role,
      name: item.name,
      tipo: item.role === "circulacion" ? "pasillo" : item.role,
      unitRef: item.unitRef,
      unitProgram: item.unitProgram ? { ...item.unitProgram } : null,
      pts: toPoints(item.polygon),
      locked: item.role !== "unidad",
      pendingInterior: item.role === "unidad",
    })),
    items: [],
    notas: [proposal.summary || "Propuesta de planta típica"],
    stats: { uds: new Set(polygons.filter((item) => item.role === "unidad").map((item) => item.unitRef)).size },
  };
}
