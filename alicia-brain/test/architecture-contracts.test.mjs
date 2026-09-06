import test from "node:test";
import assert from "node:assert/strict";
import { normalizeProjectContext } from "../src/architecture/context.js";
import {
  ArchitectureValidationError,
  normalizeCritiqueOutput,
  normalizeDesignOutput,
  normalizeFloorPlanOutput,
  validateCritiqueRequest,
  validateDesignRequest,
  validateFloorPlanRequest,
  validateFloorProgram,
} from "../src/architecture/schemas.js";
import { publicAgentRegistry } from "../src/architecture/registry.js";

test("public registry exposes versions and schemas without prompt text", () => {
  const agents = publicAgentRegistry();
  assert.deepEqual(agents.map((agent) => agent.key), ["tweedledum", "tweedledee"]);
  assert.deepEqual(Object.fromEntries(agents.map((agent) => [agent.key, agent.promptVersion])), {
    tweedledum: "1.2.0",
    tweedledee: "1.1.0",
  });
  assert.ok(agents.every((agent) => agent.outputSchema && !("prompt" in agent)));
  assert.equal(agents.find((agent) => agent.key === "tweedledum").floorPromptVersion, "2.2.0");
});

test("floor parti normalization keeps unit order, program and Cabida version", () => {
  const output = normalizeFloorPlanOutput({
    summary: "Two-unit floor",
    parti: {
      sourceCabidaVersionId: "cabida_p1_v3",
      crujias: 1,
      corredorProfundidad: 1.6,
      core: { posicion: 8.4, ancho: 5.2 },
      units: [
        { unitRef: "unit-1", orden: 1, ancho: 7.4, dormitorios: 3, banos: 2 },
        { unitRef: "unit-2", orden: 2, ancho: 6.6, dormitorios: 2, banos: 2 },
      ],
    },
    assumptions: [],
    tradeoffs: [],
  });
  assert.equal(output.parti.sourceCabidaVersionId, "cabida_p1_v3");
  assert.equal(output.parti.units[1].unitRef, "unit-2");
  assert.equal(output.parti.units[1].orden, 2);
  assert.equal(output.parti.units[1].dormitorios, 2);
  // banda ausente en ninguna unidad → default 1 en las dos (comportamiento de siempre).
  assert.equal(output.parti.units[0].banda, 1);
  assert.equal(output.parti.units[1].banda, 1);
});

test("floor parti normalization accepts core.longitud and filters out invalid values", () => {
  const base = {
    sourceCabidaVersionId: "cabida_p1_v3",
    crujias: 1,
    corredorProfundidad: 1.6,
    units: [{ unitRef: "unit-1", orden: 1, ancho: 7, dormitorios: 1, banos: 1 }],
  };
  const conLongitud = normalizeFloorPlanOutput({ parti: { ...base, core: { posicion: 8, ancho: 5, longitud: 4.5 } } });
  assert.equal(conLongitud.parti.core.longitud, 4.5);

  // ausente, o un tipo/valor que no es un número positivo: se deja en null (normalizarParti,
  // en files/alice, es quien decide el default) — nunca rechaza el parti por esto.
  const sinLongitud = normalizeFloorPlanOutput({ parti: { ...base, core: { posicion: 8, ancho: 5 } } });
  assert.equal(sinLongitud.parti.core.longitud, null);

  const longitudAbsurda = normalizeFloorPlanOutput({ parti: { ...base, core: { posicion: 8, ancho: 5, longitud: -3 } } });
  assert.equal(longitudAbsurda.parti.core.longitud, null);
});

test("floor parti normalization accepts and normalizes banda per unit", () => {
  const base = {
    sourceCabidaVersionId: "cabida_p1_v3",
    crujias: 2,
    corredorProfundidad: 1.5,
    core: { posicion: 8, ancho: 5 },
  };
  const output = normalizeFloorPlanOutput({
    parti: {
      ...base,
      units: [
        { unitRef: "unit-1", orden: 1, ancho: 7, dormitorios: 2, banos: 1, banda: 1 },
        { unitRef: "unit-2", orden: 2, ancho: 6, dormitorios: 1, banos: 1, banda: 2 },
      ],
    },
  });
  assert.equal(output.parti.units[0].banda, 1);
  assert.equal(output.parti.units[1].banda, 2);

  // cualquier valor fuera de {1,2} (o ausente) cae a 1: no rompe, no descarta la unidad.
  const tolerant = normalizeFloorPlanOutput({
    parti: {
      ...base,
      units: [
        { unitRef: "unit-1", orden: 1, ancho: 7, dormitorios: 2, banos: 1, banda: 3 },
        { unitRef: "unit-2", orden: 2, ancho: 6, dormitorios: 1, banos: 1 },
      ],
    },
  });
  assert.equal(tolerant.parti.units[0].banda, 1);
  assert.equal(tolerant.parti.units[1].banda, 1);
});

test("floor parti contract rejects malformed shapes but tolerates numbers that do not close", () => {
  const base = {
    parti: {
      sourceCabidaVersionId: "cabida_p1_v3",
      crujias: 1,
      corredorProfundidad: 1.6,
      core: { posicion: 8, ancho: 5 },
      units: [{ unitRef: "unit-1", orden: 1, ancho: 7, dormitorios: 1, banos: 1 }],
    },
  };
  // números aproximados que no cierran (ancho de unidad no coincide con frente-core): tolerado, no es un error de forma.
  assert.doesNotThrow(() => normalizeFloorPlanOutput({ ...base, parti: { ...base.parti, units: [{ ...base.parti.units[0], ancho: 19.4 }] } }));
  // crujías fuera de {1,2} se tolera (se resuelve aguas abajo según el fondo, como packFloor).
  const tolerant = normalizeFloorPlanOutput({ ...base, parti: { ...base.parti, crujias: 7 } });
  assert.equal(tolerant.parti.crujias, null);

  assert.throws(() => normalizeFloorPlanOutput({}), /parti is required/i);
  assert.throws(() => normalizeFloorPlanOutput({ parti: { ...base.parti, sourceCabidaVersionId: "" } }), /sourceCabidaVersionId/i);
  assert.throws(() => normalizeFloorPlanOutput({ parti: { ...base.parti, core: { posicion: "x", ancho: 5 } } }), /core/i);
  assert.throws(() => normalizeFloorPlanOutput({ parti: { ...base.parti, units: [] } }), /units/i);
  assert.throws(() => normalizeFloorPlanOutput({ parti: { ...base.parti, units: [{ ...base.parti.units[0] }, { ...base.parti.units[0] }] } }), /unique unitRef/i);
  assert.throws(() => normalizeFloorPlanOutput({ parti: { ...base.parti, units: [{ ...base.parti.units[0], dormitorios: 0 }] } }), /dormitorios/i);
  assert.throws(() => normalizeFloorPlanOutput({ parti: { ...base.parti, units: [{ ...base.parti.units[0], banos: 0 }] } }), /banos/i);
  assert.throws(() => normalizeFloorPlanOutput({ parti: { ...base.parti, units: [{ ...base.parti.units[0], unitRef: "" }] } }), /unitRef/i);
});

test("floor planning requires exact project and Cabida version context", () => {
  const deterministicFallback = { floor: { sourceCabidaVersionId: "cabida_p1_v3", polygons: [] } };
  assert.throws(() => validateFloorPlanRequest({ context: { project: { id: "p1", name: "DC01" } }, floorBrief: {}, deterministicFallback }), /sourceCabidaVersionId/i);
  assert.equal(validateFloorPlanRequest({ context: { project: { id: "p1", name: "DC01" }, sourceCabidaVersionId: "cabida_p1_v3" }, floorBrief: {}, deterministicFallback }).floorBrief instanceof Object, true);
});

test("validateFloorProgram checks unit count, bedroom mix, version and positive widths — not geometry", () => {
  const parti = {
    sourceCabidaVersionId: "cabida_p1_v3",
    units: [
      { unitRef: "unit-1", ancho: 7, dormitorios: 1, banos: 1 },
      { unitRef: "unit-2", ancho: 6, dormitorios: 2, banos: 2 },
    ],
  };
  const options = { sourceCabidaVersionId: "cabida_p1_v3", unitsPerFloor: 2, mix: { dormitorios1: 1, dormitorios2: 1, dormitorios3: 0 } };
  assert.equal(validateFloorProgram(parti, options).ok, true);

  const wrongVersion = validateFloorProgram({ ...parti, sourceCabidaVersionId: "cabida_old" }, options);
  assert.ok(wrongVersion.findings.some((f) => f.code === "source_version_mismatch"));

  const wrongCount = validateFloorProgram({ ...parti, units: parti.units.slice(0, 1) }, options);
  assert.ok(wrongCount.findings.some((f) => f.code === "unit_count_mismatch"));

  const wrongMix = validateFloorProgram({ ...parti, units: [parti.units[0], { ...parti.units[1], dormitorios: 3 }] }, options);
  assert.ok(wrongMix.findings.some((f) => f.code === "unit_mix_mismatch"));

  const badWidth = validateFloorProgram({ ...parti, units: [{ ...parti.units[0], ancho: -1 }, parti.units[1]] }, options);
  assert.ok(badWidth.findings.some((f) => f.code === "invalid_unit_width" && f.unitRefs.includes("unit-1")));
});

test("Tweedledum rooms require stable references and preserve supported metadata", () => {
  assert.throws(() => normalizeDesignOutput({
    layout: { ambientes: [{ nombre: "sala", poligono: [[0, 0], [2, 0], [2, 2]] }] },
  }), /ref_id/);
  const output = normalizeDesignOutput({
    layout: { ambientes: [{ nombre: "sala", ref_id: "social", tipo: "social", zona: "social", luz: true, poligono: [[0, 0], [2, 0], [2, 2]] }] },
  });
  assert.deepEqual(output.layout.ambientes[0], {
    nombre: "sala", ref_id: "social", tipo: "social", zona: "social", luz: true, poligono: [[0, 0], [2, 0], [2, 2]],
  });
});

test("project context keeps the exact source plan version and safe defaults", () => {
  const context = normalizeProjectContext({
    project: { id: "p1", name: "DC01", privateField: "discard me" },
    sourcePlanVersionId: "plan_p1_v3",
  });
  assert.equal(context.sourcePlanVersionId, "plan_p1_v3");
  assert.deepEqual(context.project, { id: "p1", name: "DC01" });
  assert.deepEqual(context.lockedElements, []);
  assert.deepEqual(context.verifiedEvidence, []);
});

test("unbacked regulatory claims are downgraded", () => {
  const output = normalizeCritiqueOutput({
    verdict: "revise",
    score: 50,
    summary: "Verify the width",
    findings: [{
      id: "f1",
      severity: "major",
      category: "regulatory",
      title: "Width",
      observation: "Too narrow",
      consequence: "Approval risk",
      recommendation: "Verify against the applicable source",
      regulatoryStatus: "verified",
      evidenceRefs: ["missing"],
    }],
  }, { verifiedEvidence: [] });
  assert.equal(output.findings[0].regulatoryStatus, "verification_required");
  assert.deepEqual(output.findings[0].evidenceRefs, []);
});

test("verified regulatory claims retain only matching evidence references", () => {
  const output = normalizeCritiqueOutput({
    verdict: "revise",
    score: 70,
    summary: "One backed issue",
    findings: [{
      id: "f1",
      severity: "major",
      category: "regulatory",
      title: "Backed issue",
      observation: "Observed condition",
      consequence: "Documented consequence",
      recommendation: "Apply documented rule",
      regulatoryStatus: "verified",
      evidenceRefs: ["ev-1", "not-supplied"],
    }],
  }, { verifiedEvidence: [{ id: "ev-1", title: "Municipal certificate", verified: true }] });
  assert.equal(output.findings[0].regulatoryStatus, "verified");
  assert.deepEqual(output.findings[0].evidenceRefs, ["ev-1"]);
});

test("Tweedledee returns at most six prioritized findings", () => {
  const findings = Array.from({ length: 9 }, (_, index) => ({
    id: `f${index + 1}`,
    severity: index === 8 ? "critical" : index === 7 ? "major" : "minor",
    category: "circulation",
    title: `Issue ${index + 1}`,
    observation: "Observed condition",
    consequence: "Material consequence",
    recommendation: "Specific correction",
  }));
  const output = normalizeCritiqueOutput({ verdict: "reject", score: 30, summary: "Prioritized review", findings });
  assert.equal(output.findings.length, 6);
  assert.deepEqual(output.findings.map((finding) => finding.id), ["f9", "f8", "f1", "f2", "f3", "f4"]);
});

test("design and critique requests require an exact project and plan version", () => {
  assert.throws(() => validateDesignRequest({ context: { project: { id: "p1" } } }), ArchitectureValidationError);
  assert.throws(() => validateCritiqueRequest({
    context: { project: { id: "p1", name: "DC01" }, sourcePlanVersionId: "v1" },
    planVersion: { id: "v2", layout: { ambientes: [] } },
    deterministicValidation: { ok: true, findings: [] },
  }), /source plan version/i);
});
