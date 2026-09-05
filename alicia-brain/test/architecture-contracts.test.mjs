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
  assert.equal(agents.find((agent) => agent.key === "tweedledum").floorPromptVersion, "1.2.0");
});

test("floor proposals preserve exclusive roles and stable unit references", () => {
  const output = normalizeFloorPlanOutput({
    summary: "Two-unit floor",
    floor: {
      sourceCabidaVersionId: "cabida_p1_v3",
      polygons: [
        { polygonId: "core-1", role: "core", name: "core", unitRef: null, unitProgram: null, polygon: [[4, 0], [6, 0], [6, 8], [4, 8]] },
        { polygonId: "unit-1-part-1", role: "unidad", name: "Tipo 1", unitRef: "unit-1", unitProgram: { dormitorios: 1, banos: 1 }, polygon: [[0, 0], [4, 0], [4, 8], [0, 8]] },
        { polygonId: "unit-2-part-1", role: "unidad", name: "Tipo 2", unitRef: "unit-2", unitProgram: { dormitorios: 2, banos: 2 }, polygon: [[6, 0], [10, 0], [10, 8], [6, 8]] },
      ],
    },
    assumptions: [],
    tradeoffs: [],
  });
  assert.equal(output.floor.polygons[1].unitRef, "unit-1");
  assert.deepEqual(output.floor.polygons[1].polygon[0], [0, 0]);
});

test("floor proposal contract rejects ambiguous roles and references", () => {
  const base = {
    floor: {
      sourceCabidaVersionId: "cabida_p1_v3",
      polygons: [{ polygonId: "p1", role: "unidad", name: "Tipo 1", unitRef: "unit-1", unitProgram: { dormitorios: 1, banos: 1 }, polygon: [[0, 0], [4, 0], [4, 4], [0, 4]] }],
    },
  };
  assert.throws(() => normalizeFloorPlanOutput({ ...base, floor: { ...base.floor, polygons: [{ ...base.floor.polygons[0], role: "terraza" }] } }), /role/i);
  assert.throws(() => normalizeFloorPlanOutput({ ...base, floor: { ...base.floor, polygons: [{ ...base.floor.polygons[0], unitRef: null }] } }), /unitRef/i);
  assert.throws(() => normalizeFloorPlanOutput({ ...base, floor: { ...base.floor, polygons: [base.floor.polygons[0], { ...base.floor.polygons[0] }] } }), /unique polygonId/i);
  assert.throws(() => normalizeFloorPlanOutput({ ...base, floor: { ...base.floor, polygons: [base.floor.polygons[0], { ...base.floor.polygons[0], polygonId: "p2" }] } }), /exactly one polygon/i);
  assert.throws(() => normalizeFloorPlanOutput({ floor: { polygons: base.floor.polygons } }), /sourceCabidaVersionId/i);
  assert.throws(() => normalizeFloorPlanOutput({ ...base, floor: { ...base.floor, polygons: [{ ...base.floor.polygons[0], role: "core" }] } }), /unitRef/i);
  assert.throws(() => normalizeFloorPlanOutput({ ...base, floor: { ...base.floor, polygons: [{ ...base.floor.polygons[0], unitProgram: { dormitorios: 0, banos: 1 } }] } }), /unitProgram/i);
  assert.throws(() => normalizeFloorPlanOutput({ ...base, floor: { ...base.floor, polygons: [{ ...base.floor.polygons[0], role: "core", unitRef: null, unitProgram: { dormitorios: 1, banos: 1 } }] } }), /unitProgram/i);
});

test("floor planning requires exact project and Cabida version context", () => {
  const deterministicFallback = { floor: { sourceCabidaVersionId: "cabida_p1_v3", polygons: [] } };
  assert.throws(() => validateFloorPlanRequest({ context: { project: { id: "p1", name: "DC01" } }, floorBrief: {}, deterministicFallback }), /sourceCabidaVersionId/i);
  assert.equal(validateFloorPlanRequest({ context: { project: { id: "p1", name: "DC01" }, sourceCabidaVersionId: "cabida_p1_v3" }, floorBrief: {}, deterministicFallback }).floorBrief instanceof Object, true);
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
