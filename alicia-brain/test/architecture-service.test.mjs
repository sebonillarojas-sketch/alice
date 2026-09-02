import test from "node:test";
import assert from "node:assert/strict";
import { createArchitectureService, ArchitectureModelError } from "../src/architecture/service.js";

const context = {
  project: { id: "p1", name: "DC01" },
  brief: {}, site: {}, constraints: {}, lockedElements: [], assumptions: [],
  sourcePlanVersionId: "v2", verifiedEvidence: [],
};

test("Tweedledee receives plan and validation but not Tweedledum rationale", async () => {
  const calls = [];
  const client = { messages: { create: async (request) => {
    calls.push(request);
    return { content: [{ type: "text", text: JSON.stringify({ verdict: "revise", score: 70, summary: "One issue", findings: [] }) }] };
  } } };
  const service = createArchitectureService({ client, model: "test-model" });
  const result = await service.critique({
    context,
    planVersion: { id: "v2", layout: { ambientes: [{ nombre: "sala", ref_id: "r1", poligono: [[0, 0], [1, 0], [1, 1]] }] } },
    deterministicValidation: { ok: true, findings: [] },
    designObjective: "livability",
    designerRationale: "anchor the critic",
  });
  const body = JSON.stringify(calls[0].messages);
  assert.match(body, /deterministicValidation/);
  assert.match(body, /sourcePlanVersionId/);
  assert.doesNotMatch(body, /anchor the critic/);
  assert.equal(result.agent.key, "tweedledee");
  assert.equal(result.promptVersion, "1.0.0");
});

test("Tweedledum design includes project context and returns normalized structured output", async () => {
  const calls = [];
  const client = { messages: { create: async (request) => {
    calls.push(request);
    return { content: [{ type: "text", text: "```json\n{\"summary\":\"Balanced plan\",\"assumptions\":[],\"tradeoffs\":[\"compact hall\"],\"layout\":{\"ambientes\":[]},\"rationale\":\"private\"}\n```" }] };
  } } };
  const service = createArchitectureService({ client, model: "test-model" });
  const result = await service.design({ context: { ...context, sourcePlanVersionId: null }, brief: { dormitorios: 2 } });
  assert.match(JSON.stringify(calls[0].messages), /DC01/);
  assert.equal(result.layout.ambientes.length, 0);
  assert.equal(result.agent.key, "tweedledum");
  assert.equal(result.promptVersion, "1.0.0");
});

test("malformed model JSON fails closed", async () => {
  const client = { messages: { create: async () => ({ content: [{ type: "text", text: "not json" }] }) } };
  const service = createArchitectureService({ client });
  await assert.rejects(() => service.design({ context: { ...context, sourcePlanVersionId: null }, brief: { dormitorios: 2 } }), ArchitectureModelError);
});

test("critique rejects plan-version mismatch before calling the model", async () => {
  let called = false;
  const client = { messages: { create: async () => { called = true; return { content: [] }; } } };
  const service = createArchitectureService({ client });
  await assert.rejects(() => service.critique({
    context,
    planVersion: { id: "wrong", layout: { ambientes: [] } },
    deterministicValidation: { ok: true, findings: [] },
  }), /source plan version/i);
  assert.equal(called, false);
});
