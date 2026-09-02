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
