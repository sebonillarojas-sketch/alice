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

const stringArray = (value) => Array.isArray(value) ? value.map(String) : [];

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

// El contrato de floor-plan devuelve una DECISIÓN (parti), no un dibujo: números
// aproximados que el motor determinista de ALICE (files/alice) prorratea y tesela
// exacto. Por eso esta normalización es deliberadamente tolerante en magnitudes
// (anchos, posiciones) y estricta solo en forma (tipos, unicidad de unitRef,
// rango de dormitorios/baños): lo aproximado se corrige aguas abajo, lo mal
// tipado no se puede corregir y hay que rechazarlo temprano.
export function normalizeFloorPlanOutput(input = {}) {
  if (!input || typeof input !== "object") throw new ArchitectureValidationError("Tweedledum floor output must be an object");
  const parti = input.parti;
  if (!parti || typeof parti !== "object") throw new ArchitectureValidationError("parti is required", ["parti"]);
  const sourceCabidaVersionId = requiredText(parti.sourceCabidaVersionId, "parti.sourceCabidaVersionId");

  const crujiasRaw = Number(parti.crujias);
  const crujias = crujiasRaw === 1 || crujiasRaw === 2 ? crujiasRaw : null;

  const corredorProfundidadRaw = Number(parti.corredorProfundidad);
  const corredorProfundidad = Number.isFinite(corredorProfundidadRaw) && corredorProfundidadRaw > 0 ? corredorProfundidadRaw : null;

  const corePosicion = Number(parti.core?.posicion);
  const coreAncho = Number(parti.core?.ancho);
  if (!Number.isFinite(corePosicion) || !Number.isFinite(coreAncho)) {
    throw new ArchitectureValidationError("parti.core requires numeric posicion and ancho", ["parti.core"]);
  }

  // longitud: penetración aproximada del núcleo desde el frente hacia el fondo (metros).
  // Opcional y, como todo en este contrato, aproximada. Acá solo se filtra lo mal
  // tipado (igual que corredorProfundidad arriba); si falta o es absurda (<=0, o mayor
  // que el fondo disponible) normalizarParti (files/alice) aplica el default acotado —
  // esta capa nunca rechaza el parti por una longitud ausente o rara.
  const coreLongitudRaw = Number(parti.core?.longitud);
  const coreLongitud = Number.isFinite(coreLongitudRaw) && coreLongitudRaw > 0 ? coreLongitudRaw : null;

  // distanciaAlFrente: metros desde el frente (v=0, la fachada a la calle) hasta donde
  // empieza el núcleo. Opcional y aproximada, igual que longitud. 0 (núcleo pegado al
  // frente) es un valor válido, no un default a filtrar — solo lo negativo o mal tipado
  // cae a null. Si falta o es absurda, normalizarParti (files/alice) aplica 0 como
  // default SIN reportarlo como relleno silencioso: 0 es exactamente el comportamiento
  // de siempre, no una decisión que el motor le esconda al agente.
  const coreDistanciaAlFrenteRaw = Number(parti.core?.distanciaAlFrente);
  const coreDistanciaAlFrente = Number.isFinite(coreDistanciaAlFrenteRaw) && coreDistanciaAlFrenteRaw >= 0 ? coreDistanciaAlFrenteRaw : null;

  if (!Array.isArray(parti.units) || parti.units.length === 0) {
    throw new ArchitectureValidationError("parti.units requires at least one unit", ["parti.units"]);
  }
  const unitRefs = new Set();
  const units = parti.units.map((unit, index) => {
    const field = `parti.units[${index}]`;
    const unitRef = requiredText(unit?.unitRef, `${field}.unitRef`);
    if (unitRefs.has(unitRef)) throw new ArchitectureValidationError(`parti.units requires a unique unitRef: ${unitRef}`, [`${field}.unitRef`]);
    unitRefs.add(unitRef);
    const orden = Number(unit?.orden);
    if (!Number.isFinite(orden)) throw new ArchitectureValidationError(`${field}.orden must be a number`, [`${field}.orden`]);
    const ancho = Number(unit?.ancho);
    if (!Number.isFinite(ancho)) throw new ArchitectureValidationError(`${field}.ancho must be a number`, [`${field}.ancho`]);
    const dormitorios = Number(unit?.dormitorios);
    if (!Number.isInteger(dormitorios) || dormitorios < 1 || dormitorios > 3) {
      throw new ArchitectureValidationError(`${field}.dormitorios requires 1-3`, [`${field}.dormitorios`]);
    }
    const banos = Number(unit?.banos);
    if (!Number.isInteger(banos) || banos < 1) {
      throw new ArchitectureValidationError(`${field}.banos requires at least one baño`, [`${field}.banos`]);
    }
    // banda: 1 = banda del frente (a la calle), 2 = banda del fondo. Solo importa cuando
    // crujias es 2 (con crujía simple se ignora aguas abajo); cualquier valor ausente o
    // inválido cae a 1, así un parti sin banda se comporta exactamente como antes.
    const bandaRaw = Number(unit?.banda);
    const banda = bandaRaw === 1 || bandaRaw === 2 ? bandaRaw : 1;
    return { unitRef, orden, ancho, dormitorios, banos, banda };
  });

  return {
    summary: String(input.summary || ""),
    parti: {
      sourceCabidaVersionId,
      crujias,
      corredorProfundidad,
      core: { posicion: corePosicion, ancho: coreAncho, longitud: coreLongitud, distanciaAlFrente: coreDistanciaAlFrente },
      units,
    },
    assumptions: stringArray(input.assumptions),
    tradeoffs: stringArray(input.tradeoffs),
  };
}

// Validación de PROGRAMA (no de geometría: ya no hay polígonos que Tweedledum
// entregue). "findings" siguen el mismo shape liviano {code, severity, message,
// unitRefs} que consumía el ciclo de revisión, para que revise_floor reciba el
// mismo tipo de correcciones puntuales que antes.
export function validateFloorProgram(parti = {}, options = {}) {
  const findings = [];
  const units = Array.isArray(parti?.units) ? parti.units : [];

  if (options.sourceCabidaVersionId && parti?.sourceCabidaVersionId !== options.sourceCabidaVersionId) {
    findings.push({ code: "source_version_mismatch", severity: "major", unitRefs: [], message: "El parti no corresponde a la versión actual de Cabida" });
  }

  const expectedUnits = Number(options.unitsPerFloor);
  if (Number.isFinite(expectedUnits) && units.length !== expectedUnits) {
    findings.push({ code: "unit_count_mismatch", severity: "major", unitRefs: [], message: `El parti contiene ${units.length} unidades y Cabida solicita ${expectedUnits}` });
  }

  if (options.mix && typeof options.mix === "object") {
    const actual = { dormitorios1: 0, dormitorios2: 0, dormitorios3: 0 };
    for (const unit of units) {
      const bedrooms = Number(unit?.dormitorios);
      if (bedrooms >= 1 && bedrooms <= 3) actual[`dormitorios${bedrooms}`] += 1;
    }
    const mismatch = [1, 2, 3].some((bedrooms) => actual[`dormitorios${bedrooms}`] !== Number(options.mix[`dormitorios${bedrooms}`] || 0));
    if (mismatch) {
      findings.push({ code: "unit_mix_mismatch", severity: "major", unitRefs: units.map((unit) => String(unit?.unitRef || "")), message: "La mezcla de dormitorios no coincide con Cabida" });
    }
  }

  units.forEach((unit, index) => {
    const ancho = Number(unit?.ancho);
    if (!Number.isFinite(ancho) || ancho <= 0) {
      findings.push({ code: "invalid_unit_width", severity: "major", unitRefs: [String(unit?.unitRef || `unit-${index + 1}`)], message: `${unit?.unitRef || `unidad ${index + 1}`} tiene un ancho no positivo` });
    }
  });

  return { ok: findings.length === 0, findings };
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
  additionalProperties: false,
  required: ["summary", "parti", "assumptions", "tradeoffs"],
  properties: {
    summary: { type: "string" },
    parti: {
      type: "object",
      additionalProperties: false,
      required: ["sourceCabidaVersionId", "crujias", "corredorProfundidad", "core", "units"],
      properties: {
        sourceCabidaVersionId: { type: "string", minLength: 1 },
        crujias: { type: "integer", enum: [1, 2] },
        corredorProfundidad: { type: "number" },
        core: {
          type: "object",
          additionalProperties: false,
          required: ["posicion", "ancho"],
          properties: { posicion: { type: "number" }, ancho: { type: "number" }, longitud: { type: "number" }, distanciaAlFrente: { type: "number" } },
        },
        units: {
          type: "array", minItems: 1,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["unitRef", "orden", "ancho", "dormitorios", "banos"],
            properties: {
              unitRef: { type: "string", minLength: 1 },
              orden: { type: "integer", minimum: 1 },
              ancho: { type: "number" },
              dormitorios: { type: "integer", minimum: 1, maximum: 3 },
              banos: { type: "integer", minimum: 1 },
              banda: { type: "integer", enum: [1, 2] },
            },
          },
        },
      },
    },
    assumptions: { type: "array", items: { type: "string" } },
    tradeoffs: { type: "array", items: { type: "string" } },
  },
};
