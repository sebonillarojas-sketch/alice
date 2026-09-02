import test from "node:test";
import assert from "node:assert/strict";
import { normalizeProjectContext } from "../src/architecture/context.js";
import {
  ArchitectureValidationError,
  normalizeCritiqueOutput,
  validateCritiqueRequest,
  validateDesignRequest,
} from "../src/architecture/schemas.js";
import { publicAgentRegistry } from "../src/architecture/registry.js";

test("public registry exposes versions and schemas without prompt text", () => {
  const agents = publicAgentRegistry();
  assert.deepEqual(agents.map((agent) => agent.key), ["tweedledum", "tweedledee"]);
  assert.deepEqual(Object.fromEntries(agents.map((agent) => [agent.key, agent.promptVersion])), {
    tweedledum: "1.1.0",
    tweedledee: "1.0.0",
  });
  assert.ok(agents.every((agent) => agent.outputSchema && !("prompt" in agent)));
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

test("design and critique requests require an exact project and plan version", () => {
  assert.throws(() => validateDesignRequest({ context: { project: { id: "p1" } } }), ArchitectureValidationError);
  assert.throws(() => validateCritiqueRequest({
    context: { project: { id: "p1", name: "DC01" }, sourcePlanVersionId: "v1" },
    planVersion: { id: "v2", layout: { ambientes: [] } },
    deterministicValidation: { ok: true, findings: [] },
  }), /source plan version/i);
});
