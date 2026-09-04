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
  assert.equal(result.promptVersion, "1.1.0");
});

test("Tweedledee consumes forced structured output without relying on JSON text", async () => {
  const calls = [];
  const output = { verdict: "revise", score: 72, summary: "One material issue", findings: [] };
  const client = { messages: { create: async (request) => {
    calls.push(request);
    return { stop_reason: "tool_use", content: [{ type: "tool_use", id: "toolu_critic", name: "submit_tweedledee_output", input: output }] };
  } } };
  const service = createArchitectureService({ client, model: "test-model" });

  const result = await service.critique({
    context,
    planVersion: { id: "v2", layout: { ambientes: [{ nombre: "sala", ref_id: "r1", poligono: [[0, 0], [4, 0], [4, 3], [0, 3]] }] } },
    deterministicValidation: { ok: true, findings: [] },
  });

  assert.equal(result.score, 72);
  assert.deepEqual(calls[0].tool_choice, { type: "tool", name: "submit_tweedledee_output", disable_parallel_tool_use: true });
  assert.equal(calls[0].tools[0].input_schema.required.includes("findings"), true);
});

test("Tweedledum consumes forced structured output without relying on JSON text", async () => {
  const output = {
    summary: "New plan",
    assumptions: [],
    tradeoffs: [],
    layout: { ambientes: [{ nombre: "sala", ref_id: "r2", poligono: [[0, 0], [5, 0], [5, 3], [0, 3]] }] },
    rationale: "Compact circulation",
  };
  const client = { messages: { create: async () => ({
    stop_reason: "tool_use",
    content: [{ type: "tool_use", id: "toolu_designer", name: "submit_tweedledum_output", input: output }],
  }) } };
  const service = createArchitectureService({ client, model: "test-model" });

  const result = await service.design({ context: { ...context, sourcePlanVersionId: null }, brief: { dormitorios: 2 } });
  assert.equal(result.layout.ambientes[0].ref_id, "r2");
});

test("Tweedledee sends a bounded critique request to the model", async () => {
  const calls = [];
  const client = { messages: { create: async (request) => {
    calls.push(request);
    return { content: [{ type: "text", text: JSON.stringify({ verdict: "pass", score: 90, summary: "Sound plan", findings: [] }) }] };
  } } };
  const rooms = Array.from({ length: 24 }, (_, index) => ({
    nombre: `ambiente ${index + 1}`,
    ref_id: `r${index + 1}`,
    poligono: [[index, 0], [index + 4, 0], [index + 4, 3], [index, 3]],
  }));
  const service = createArchitectureService({ client, model: "test-model" });

  await service.critique({
    context,
    planVersion: { id: "v2", layout: { ambientes: rooms } },
    deterministicValidation: { ok: true, findings: [] },
  });

  assert.equal(calls[0].max_tokens, 2500);
  assert.ok(calls[0].system.length < 6000, `critic system prompt is ${calls[0].system.length} characters`);
  assert.ok(calls[0].messages[0].content.length < 6000, `critic payload is ${calls[0].messages[0].content.length} characters`);
});

test("Tweedledum design includes project context and returns normalized structured output", async () => {
  const calls = [];
  const client = { messages: { create: async (request) => {
    calls.push(request);
    return { content: [{ type: "text", text: "```json\n{\"summary\":\"Balanced plan\",\"assumptions\":[],\"tradeoffs\":[\"compact hall\"],\"layout\":{\"ambientes\":[{\"nombre\":\"sala\",\"ref_id\":\"r1\",\"poligono\":[[0,0],[4,0],[4,3],[0,3]]}]},\"rationale\":\"private\"}\n```" }] };
  } } };
  const service = createArchitectureService({ client, model: "test-model" });
  const result = await service.design({ context: { ...context, sourcePlanVersionId: null }, brief: { dormitorios: 2 } });
  assert.match(JSON.stringify(calls[0].messages), /DC01/);
  assert.equal(result.layout.ambientes.length, 1);
  assert.equal(result.agent.key, "tweedledum");
  assert.equal(result.promptVersion, "1.1.0");
});

test("Tweedledum rejects a design response with no drawable room geometry", async () => {
  const client = { messages: { create: async () => ({
    content: [{ type: "text", text: JSON.stringify({
      summary: "Here is the concept",
      assumptions: [],
      tradeoffs: [],
      layout: { ambientes: [] },
      rationale: "Narrative only",
    }) }],
  }) } };
  const service = createArchitectureService({ client, model: "test-model" });

  await assert.rejects(
    () => service.design({ context: { ...context, sourcePlanVersionId: null }, brief: { dormitorios: 2 } }),
    /drawable room geometry/i,
  );
});

test("Tweedledum rejects an unchanged source plan when asked for a new design", async () => {
  const sourceLayout = {
    ambientes: [{ nombre: "sala", ref_id: "r1", poligono: [[0, 0], [4, 0], [4, 3], [0, 3]] }],
  };
  const client = { messages: { create: async () => ({
    content: [{ type: "text", text: JSON.stringify({
      summary: "The existing plan works",
      assumptions: [],
      tradeoffs: [],
      layout: sourceLayout,
      rationale: "No geometry changed",
    }) }],
  }) } };
  const service = createArchitectureService({ client, model: "test-model" });

  await assert.rejects(
    () => service.design({
      context,
      brief: { dormitorios: 2 },
      planVersion: { id: "v2", layout: sourceLayout },
    }),
    /new plan geometry/i,
  );
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
