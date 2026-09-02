import test from "node:test";
import assert from "node:assert/strict";
import { runArchitectureReviewCycle } from "../src/architecture/workflow.js";

const baseContext = { project: { id: "p1", name: "DC01" }, sourcePlanVersionId: "v1" };

test("review cycle orders design, critique, and one revision", async () => {
  const order = [];
  const service = {
    design: async () => (order.push("design"), { layout: { ambientes: [] }, rationale: "hidden" }),
    critique: async (request) => {
      order.push("critique");
      assert.equal(request.designerRationale, undefined);
      assert.equal(request.context.sourcePlanVersionId, "plan_p1_cycle_proposal");
      return { verdict: "revise", score: 60, findings: [{ id: "f1", severity: "major", category: "circulation", title: "Route", observation: "Blocked", consequence: "No access", recommendation: "Move wall", regulatoryStatus: "not_applicable", evidenceRefs: [] }] };
    },
    revise: async (request) => {
      order.push("revise");
      assert.deepEqual(request.acceptedFindings.map((finding) => finding.id), ["f1"]);
      return { layout: { ambientes: [{ nombre: "sala", poligono: [[0, 0], [2, 0], [2, 2]] }] } };
    },
  };
  const result = await runArchitectureReviewCycle({
    context: baseContext,
    designRequest: { brief: { dormitorios: 2 } },
    deterministicValidation: { ok: false, findings: [] },
  }, { service });
  assert.deepEqual(order, ["design", "critique", "revise"]);
  assert.equal(result.revisionPerformed, true);
});

test("review cycle stops after critique when no major findings exist", async () => {
  let revisions = 0;
  const service = {
    design: async () => ({ layout: { ambientes: [] } }),
    critique: async () => ({ verdict: "pass", score: 90, findings: [{ id: "f1", severity: "minor" }] }),
    revise: async () => { revisions += 1; return {}; },
  };
  const result = await runArchitectureReviewCycle({ context: baseContext, designRequest: { brief: {} }, deterministicValidation: { ok: true, findings: [] } }, { service });
  assert.equal(revisions, 0);
  assert.equal(result.revisionPerformed, false);
});

test("revision failure retains successful design and critique artifacts", async () => {
  const service = {
    design: async () => ({ layout: { ambientes: [] } }),
    critique: async () => ({ verdict: "revise", score: 40, findings: [{ id: "f1", severity: "critical" }] }),
    revise: async () => { throw new Error("model unavailable"); },
  };
  const result = await runArchitectureReviewCycle({ context: baseContext, designRequest: { brief: {} }, deterministicValidation: { ok: false, findings: [] } }, { service });
  assert.ok(result.design);
  assert.ok(result.critique);
  assert.equal(result.revision, null);
  assert.equal(result.errors[0].stage, "revision");
});
