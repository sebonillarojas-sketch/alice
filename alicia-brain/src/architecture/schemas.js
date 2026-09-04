const SEVERITIES = new Set(["critical", "major", "minor", "info"]);
const SEVERITY_RANK = Object.freeze({ critical: 0, major: 1, minor: 2, info: 3 });
const CATEGORIES = new Set(["circulation", "furnishability", "daylight", "privacy", "structure", "mep", "buildability", "commercial", "regulatory", "other"]);
const REGULATORY = new Set(["not_applicable", "advisory", "verification_required", "verified"]);
const FLOOR_ROLES = new Set(["unidad", "core", "circulacion", "void"]);

export class ArchitectureValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = "ArchitectureValidationError";
    this.code = "ARCHITECTURE_VALIDATION_ERROR";
    this.details = details;
  }
}

const requiredText = (value, field) => {
  const text = String(value || "").trim();
  if (!text) throw new ArchitectureValidationError(`${field} is required`, [field]);
  return text;
};

const requireContext = (context = {}) => {
  requiredText(context.project?.id, "context.project.id");
  requiredText(context.project?.name, "context.project.name");
};

const stringArray = (value) => Array.isArray(value) ? value.map(String) : [];

const normalizePolygon = (value, field) => {
  const valid = Array.isArray(value) && value.length >= 3 && value.every((point) =>
    Array.isArray(point) && point.length === 2 && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1])));
  if (!valid) throw new ArchitectureValidationError(`${field} requires drawable polygon geometry`, [field]);
  return value.map(([x, y]) => [Number(x), Number(y)]);
};

export function validateDesignRequest(input = {}) {
  requireContext(input.context);
  const hasBrief = input.brief && typeof input.brief === "object";
  const hasPlan = input.planVersion?.layout && typeof input.planVersion.layout === "object";
  if (!hasBrief && !hasPlan) throw new ArchitectureValidationError("brief or planVersion.layout is required", ["brief", "planVersion.layout"]);
  return input;
}

export function validateCritiqueRequest(input = {}) {
  requireContext(input.context);
  const expected = requiredText(input.context?.sourcePlanVersionId, "context.sourcePlanVersionId");
  const actual = requiredText(input.planVersion?.id, "planVersion.id");
  if (expected !== actual) throw new ArchitectureValidationError("Source plan version does not match planVersion.id", [expected, actual]);
  if (!input.planVersion?.layout || typeof input.planVersion.layout !== "object") {
    throw new ArchitectureValidationError("planVersion.layout is required", ["planVersion.layout"]);
  }
  if (!input.deterministicValidation || typeof input.deterministicValidation !== "object") {
    throw new ArchitectureValidationError("deterministicValidation is required", ["deterministicValidation"]);
  }
  return input;
}

export function validateFloorPlanRequest(input = {}) {
  requireContext(input.context);
  requiredText(input.context?.sourceCabidaVersionId, "context.sourceCabidaVersionId");
  if (!input.floorBrief || typeof input.floorBrief !== "object") {
    throw new ArchitectureValidationError("floorBrief is required", ["floorBrief"]);
  }
  if (!input.deterministicFallback || typeof input.deterministicFallback !== "object") {
    throw new ArchitectureValidationError("deterministicFallback is required", ["deterministicFallback"]);
  }
  return input;
}

export function normalizeFloorPlanOutput(input = {}) {
  if (!input || typeof input !== "object") throw new ArchitectureValidationError("Tweedledum floor output must be an object");
  const sourceCabidaVersionId = requiredText(input.floor?.sourceCabidaVersionId, "floor.sourceCabidaVersionId");
  if (!Array.isArray(input.floor?.polygons) || input.floor.polygons.length === 0) {
    throw new ArchitectureValidationError("floor.polygons requires drawable geometry", ["floor.polygons"]);
  }
  const polygonIds = new Set();
  const unitPrograms = new Map();
  const polygons = input.floor.polygons.map((polygon, index) => {
    const field = `floor.polygons[${index}]`;
    const polygonId = requiredText(polygon?.polygonId, `${field}.polygonId`);
    if (polygonIds.has(polygonId)) throw new ArchitectureValidationError(`Floor polygons require a unique polygonId: ${polygonId}`, [`${field}.polygonId`]);
    polygonIds.add(polygonId);
    const role = String(polygon?.role || "");
    if (!FLOOR_ROLES.has(role)) throw new ArchitectureValidationError(`${field}.role is invalid`, [`${field}.role`]);
    const unitRef = polygon?.unitRef == null ? null : requiredText(polygon.unitRef, `${field}.unitRef`);
    if (role === "unidad" && !unitRef) throw new ArchitectureValidationError(`${field}.unitRef is required for unidad`, [`${field}.unitRef`]);
    if (role !== "unidad" && unitRef !== null) throw new ArchitectureValidationError(`${field}.unitRef must be null for ${role}`, [`${field}.unitRef`]);
    let unitProgram = null;
    if (role === "unidad") {
      const dormitorios = Number(polygon.unitProgram?.dormitorios);
      const banos = Number(polygon.unitProgram?.banos);
      if (!Number.isInteger(dormitorios) || dormitorios < 0 || !Number.isInteger(banos) || banos < 0) {
        throw new ArchitectureValidationError(`${field}.unitProgram requires non-negative integer dormitorios and banos`, [`${field}.unitProgram`]);
      }
      unitProgram = { dormitorios, banos };
      const prior = unitPrograms.get(unitRef);
      if (prior && (prior.dormitorios !== dormitorios || prior.banos !== banos)) {
        throw new ArchitectureValidationError(`Unit pieces for ${unitRef} require one consistent unitProgram`, [`${field}.unitProgram`]);
      }
      unitPrograms.set(unitRef, unitProgram);
    }
    return {
      polygonId,
      role,
      name: requiredText(polygon?.name, `${field}.name`),
      unitRef,
      unitProgram,
      polygon: normalizePolygon(polygon?.polygon, `${field}.polygon`),
    };
  });
  return {
    summary: String(input.summary || ""),
    floor: { sourceCabidaVersionId, polygons },
    assumptions: stringArray(input.assumptions),
    tradeoffs: stringArray(input.tradeoffs),
  };
}

export function normalizeDesignOutput(input = {}) {
  if (!input || typeof input !== "object" || !input.layout || typeof input.layout !== "object") {
    throw new ArchitectureValidationError("Tweedledum output requires layout", ["layout"]);
  }
  const rooms = input.layout.ambientes;
  if (!Array.isArray(rooms) || rooms.length === 0) {
    throw new ArchitectureValidationError("Tweedledum output requires drawable room geometry", ["layout.ambientes"]);
  }
  const refs = new Set();
  rooms.forEach((room, index) => {
    requiredText(room?.nombre, `layout.ambientes[${index}].nombre`);
    const refId = requiredText(room?.ref_id, `layout.ambientes[${index}].ref_id`);
    if (refs.has(refId)) throw new ArchitectureValidationError(`Tweedledum room ${index + 1} requires a unique ref_id`, [`layout.ambientes[${index}].ref_id`]);
    refs.add(refId);
    const polygon = room?.poligono;
    const valid = Array.isArray(polygon) && polygon.length >= 3 && polygon.every((point) =>
      Array.isArray(point) && point.length >= 2 && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1])));
    if (!valid) throw new ArchitectureValidationError(`Tweedledum room ${index + 1} requires drawable polygon geometry`, [`layout.ambientes[${index}].poligono`]);
  });
  return {
    summary: String(input.summary || ""),
    assumptions: Array.isArray(input.assumptions) ? input.assumptions.map(String) : [],
    tradeoffs: Array.isArray(input.tradeoffs) ? input.tradeoffs.map(String) : [],
    layout: structuredClone(input.layout),
    rationale: String(input.rationale || ""),
  };
}

export function normalizeCritiqueOutput(input = {}, context = {}) {
  if (!input || typeof input !== "object") throw new ArchitectureValidationError("Tweedledee output must be an object");
  const score = Number(input.score);
  if (!Number.isFinite(score) || score < 0 || score > 100) throw new ArchitectureValidationError("score must be between 0 and 100", ["score"]);
  const suppliedEvidence = new Set((context.verifiedEvidence || []).filter((e) => e?.verified === true).map((e) => String(e.id)));
  const candidates = Array.isArray(input.findings) ? [...input.findings] : [];
  candidates.sort((a, b) => (SEVERITY_RANK[a?.severity] ?? 2) - (SEVERITY_RANK[b?.severity] ?? 2));
  const findings = candidates.slice(0, 6).map((finding, index) => {
    const category = CATEGORIES.has(finding.category) ? finding.category : "other";
    const evidenceRefs = (Array.isArray(finding.evidenceRefs) ? finding.evidenceRefs : []).map(String).filter((id) => suppliedEvidence.has(id));
    let regulatoryStatus = REGULATORY.has(finding.regulatoryStatus) ? finding.regulatoryStatus : "not_applicable";
    if (category === "regulatory" && regulatoryStatus === "verified" && evidenceRefs.length === 0) regulatoryStatus = "verification_required";
    if (category !== "regulatory" && regulatoryStatus === "verified" && evidenceRefs.length === 0) regulatoryStatus = "advisory";
    const point = finding.location?.point;
    return {
      id: String(finding.id || `finding_${index + 1}`),
      severity: SEVERITIES.has(finding.severity) ? finding.severity : "minor",
      category,
      title: requiredText(finding.title, `findings[${index}].title`),
      observation: requiredText(finding.observation, `findings[${index}].observation`),
      consequence: requiredText(finding.consequence, `findings[${index}].consequence`),
      recommendation: requiredText(finding.recommendation, `findings[${index}].recommendation`),
      location: {
        roomId: finding.location?.roomId ? String(finding.location.roomId) : null,
        itemId: finding.location?.itemId ? String(finding.location.itemId) : null,
        point: point && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y))
          ? { x: Number(point.x), y: Number(point.y) }
          : null,
      },
      regulatoryStatus,
      evidenceRefs,
    };
  });
  return {
    verdict: ["pass", "revise", "reject"].includes(input.verdict) ? input.verdict : "revise",
    score,
    summary: requiredText(input.summary, "summary"),
    findings,
  };
}

export const DESIGN_OUTPUT_SCHEMA = {
  type: "object",
  required: ["summary", "assumptions", "tradeoffs", "layout"],
  properties: {
    summary: { type: "string" }, assumptions: { type: "array", items: { type: "string" } },
    tradeoffs: { type: "array", items: { type: "string" } },
    layout: {
      type: "object",
      required: ["ambientes"],
      properties: {
        ambientes: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            required: ["nombre", "ref_id", "poligono"],
            properties: {
              nombre: { type: "string", minLength: 1 },
              ref_id: { type: "string", minLength: 1 },
              tipo: { type: "string" },
              zona: { type: "string" },
              luz: { type: "boolean" },
              poligono: {
                type: "array",
                minItems: 3,
                items: { type: "array", minItems: 2, maxItems: 2, items: { type: "number" } },
              },
            },
          },
        },
      },
    },
    rationale: { type: "string" },
  },
};

export const CRITIQUE_OUTPUT_SCHEMA = {
  type: "object",
  required: ["verdict", "score", "summary", "findings"],
  properties: {
    verdict: { enum: ["pass", "revise", "reject"] }, score: { type: "number", minimum: 0, maximum: 100 },
    summary: { type: "string" }, findings: { type: "array", maxItems: 6, items: { type: "object" } },
  },
};

export const FLOOR_PLAN_OUTPUT_SCHEMA = {
  type: "object",
  required: ["summary", "floor", "assumptions", "tradeoffs"],
  properties: {
    summary: { type: "string" },
    floor: {
      type: "object",
      required: ["sourceCabidaVersionId", "polygons"],
      properties: {
        sourceCabidaVersionId: { type: "string", minLength: 1 },
        polygons: {
          type: "array", minItems: 1,
          items: {
            type: "object",
            required: ["polygonId", "role", "name", "unitRef", "unitProgram", "polygon"],
            properties: {
              polygonId: { type: "string", minLength: 1 },
              role: { enum: ["unidad", "core", "circulacion", "void"] },
              name: { type: "string", minLength: 1 },
              unitRef: { type: ["string", "null"] },
              unitProgram: {
                anyOf: [
                  { type: "null" },
                  { type: "object", required: ["dormitorios", "banos"], properties: { dormitorios: { type: "integer", minimum: 0 }, banos: { type: "integer", minimum: 0 } } },
                ],
              },
              polygon: { type: "array", minItems: 3, items: { type: "array", minItems: 2, maxItems: 2, items: { type: "number" } } },
            },
          },
        },
      },
    },
    assumptions: { type: "array", items: { type: "string" } },
    tradeoffs: { type: "array", items: { type: "string" } },
  },
};
