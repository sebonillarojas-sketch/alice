import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createArchitectureRouter } from "../src/architecture/routes.js";
import { createArchitectureService } from "../src/architecture/service.js";

async function withServer(router, run) {
  const app = express();
  app.use(express.json());
  app.use("/api/architecture", router);
  const server = await new Promise((resolve) => {
    const value = app.listen(0, "127.0.0.1", () => resolve(value));
  });
  try { await run(`http://127.0.0.1:${server.address().port}/api/architecture`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

const jsonResponse = (value) => ({ content: [{ type: "text", text: JSON.stringify(value) }] });

test("GET agents exposes callable metadata without server prompts", async () => {
  const service = createArchitectureService({ client: { messages: { create: async () => jsonResponse({}) } } });
  await withServer(createArchitectureRouter({ service }), async (base) => {
    const response = await fetch(`${base}/agents`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(body.agents.map((agent) => agent.key), ["tweedledum", "tweedledee"]);
    assert.doesNotMatch(JSON.stringify(body), /You are Tweedle/);
  });
});

test("design endpoint returns 400 for missing project context without calling the model", async () => {
  let called = false;
  const service = createArchitectureService({ client: { messages: { create: async () => { called = true; return jsonResponse({}); } } } });
  await withServer(createArchitectureRouter({ service }), async (base) => {
    const response = await fetch(`${base}/tweedledum/design`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ brief: { dormitorios: 2 } }) });
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.code, "ARCHITECTURE_VALIDATION_ERROR");
    assert.equal(called, false);
  });
});

test("design endpoint returns structured Tweedledum output", async () => {
  const layout = { ambientes: [{ nombre: "sala", ref_id: "r1", poligono: [[0, 0], [4, 0], [4, 3], [0, 3]] }] };
  const service = createArchitectureService({ client: { messages: { create: async () => jsonResponse({ summary: "Plan", assumptions: [], tradeoffs: [], layout }) } } });
  await withServer(createArchitectureRouter({ service }), async (base) => {
    const response = await fetch(`${base}/tweedledum/design`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ context: { project: { id: "p1", name: "DC01" } }, brief: { dormitorios: 2 } }) });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.agent.key, "tweedledum");
    assert.deepEqual(body.layout, layout);
  });
});

test("malformed model output maps to 502", async () => {
  const service = createArchitectureService({ client: { messages: { create: async () => ({ content: [{ type: "text", text: "broken" }] }) } } });
  await withServer(createArchitectureRouter({ service }), async (base) => {
    const response = await fetch(`${base}/tweedledum/design`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ context: { project: { id: "p1", name: "DC01" } }, brief: {} }) });
    assert.equal(response.status, 502);
  });
});

test("floor-plan endpoint returns the selected valid source", async () => {
  const selected = { summary: "Floor", floor: { sourceCabidaVersionId: "cabida_v1", polygons: [] }, assumptions: [], tradeoffs: [] };
  const service = { planFloor: async () => ({ originalProposal: selected, revision: null, validation: { ok: true, findings: [] }, selected, source: "tweedledum", promptVersion: "1.0.0" }) };
  await withServer(createArchitectureRouter({ service }), async (base) => {
    const response = await fetch(`${base}/tweedledum/floor-plan`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ any: "payload" }) });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.source, "tweedledum");
    assert.equal(body.selected.floor.sourceCabidaVersionId, "cabida_v1");
  });
});

test("floor-plan route preserves Cabida version and maps invalid candidates to polygon IDs", async () => {
  const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const valid = {
    summary: "Floor", assumptions: [], tradeoffs: [],
    floor: { sourceCabidaVersionId: "cabida_p1_v7", polygons: [
      { polygonId: "core", role: "core", name: "core", unitRef: null, unitProgram: null, polygon: rect(4, 4, 6, 10) },
      { polygonId: "hall-left", role: "circulacion", name: "circulación", unitRef: null, unitProgram: null, polygon: rect(0, 4, 4, 5) },
      { polygonId: "hall-right", role: "circulacion", name: "circulación", unitRef: null, unitProgram: null, polygon: rect(6, 4, 10, 5) },
      { polygonId: "unit-1", role: "unidad", name: "Tipo 1", unitRef: "unit-1", unitProgram: { dormitorios: 1, banos: 1 }, polygon: rect(0, 0, 4, 4) },
      { polygonId: "unit-2", role: "unidad", name: "Tipo 2", unitRef: "unit-2", unitProgram: { dormitorios: 2, banos: 2 }, polygon: rect(6, 0, 10, 4) },
    ] },
  };
  const invalid = structuredClone(valid);
  invalid.floor.polygons.find((item) => item.polygonId === "hall-left").polygon = rect(0, 3.5, 4, 5);
  const client = { messages: { create: async () => ({ content: [{ type: "tool_use", name: "submit_tweedledum_floor_output", input: invalid }] }) } };
  const service = createArchitectureService({ client, model: "test-model" });
  await withServer(createArchitectureRouter({ service }), async (base) => {
    const response = await fetch(`${base}/tweedledum/floor-plan`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        context: { project: { id: "p1", name: "DC01" }, sourceCabidaVersionId: "cabida_p1_v7", site: { buildableFootprint: rect(0, 0, 10, 10) } },
        floorBrief: { unitsPerFloor: 2, bedroomMix: { dormitorios1: 1, dormitorios2: 1, dormitorios3: 0 }, targetAverageArea: 16 },
        deterministicFallback: valid,
      }),
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.source, "deterministic_fallback");
    assert.equal(body.selected.floor.sourceCabidaVersionId, "cabida_p1_v7");
    assert.deepEqual(body.candidateValidation.original.findings.find((finding) => finding.code === "polygon_overlap").polygonIds.sort(), ["hall-left", "unit-1"]);
    assert.doesNotMatch(JSON.stringify(body), /You are Tweedledum/);
  });
});
