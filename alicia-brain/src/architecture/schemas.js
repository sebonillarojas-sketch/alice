const SEVERITIES = new Set(["critical", "major", "minor", "info"]);
const SEVERITY_RANK = Object.freeze({ critical: 0, major: 1, minor: 2, info: 3 });
const CATEGORIES = new Set(["circulation", "furnishability", "daylight", "privacy", "structure", "mep", "buildability", "commercial", "regulatory", "other"]);
const REGULATORY = new Set(["not_applicable", "advisory", "verification_required", "verified"]);

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

export function normalizeDesignOutput(input = {}) {
  if (!input || typeof input !== "object" || !input.layout || typeof input.layout !== "object") {
    throw new ArchitectureValidationError("Tweedledum output requires layout", ["layout"]);
  }
  const rooms = input.layout.ambientes;
  if (!Array.isArray(rooms) || rooms.length === 0) {
    throw new ArchitectureValidationError("Tweedledum output requires drawable room geometry", ["layout.ambientes"]);
  }
  rooms.forEach((room, index) => {
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
    tradeoffs: { type: "array", items: { type: "string" } }, layout: { type: "object" }, rationale: { type: "string" },
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
