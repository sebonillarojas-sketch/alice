import { test } from "node:test";
import assert from "node:assert/strict";
import { AGENT_PROFILES, resolveAgentKey, loadAgentContext, buildAgentPrompt, askAgent } from "../src/agent-voices.js";

// db falso estilo node:sqlite (prepare().get()/all())
function fakeDb({ run = null, findings = [] } = {}) {
  return {
    prepare(sql) {
      const isFindings = /agent_findings/.test(sql);
      return {
        get: () => run,
        all: () => (isFindings ? findings : []),
      };
    },
  };
}

test("AGENT_PROFILES: están los 8 Wonderland y los alias resuelven", () => {
  for (const k of ["white-rabbit","cheshire","knave","mad-hatter","tea-table","dark-alice","bandersnatch","jabberwocky"]) {
    assert.ok(AGENT_PROFILES[k], `falta perfil ${k}`);
  }
  assert.equal(resolveAgentKey("conejo"), "white-rabbit");
  assert.equal(resolveAgentKey("Gato"), "cheshire");
  assert.equal(resolveAgentKey("cheshire"), "cheshire");
});

test("loadAgentContext: arma {lastRun, findings}", () => {
  const db = fakeDb({
    run: { result: "issues", summary: "2 checks fallando", report: null, created_at: "2026-08-09 07:15:00" },
    findings: [{ severity: "major", category: "ux-login", detail: "login sin feedback", created_at: "x" }],
  });
  const ctx = loadAgentContext(db, "white-rabbit");
  assert.equal(ctx.lastRun.result, "issues");
  assert.equal(ctx.findings.length, 1);
});

test("loadAgentContext: agente sin corridas → lastRun null, findings []", () => {
  const ctx = loadAgentContext(fakeDb({ run: null, findings: [] }), "bandersnatch");
  assert.equal(ctx.lastRun, null);
  assert.deepEqual(ctx.findings, []);
});

test("buildAgentPrompt: system lleva rol/voz + data; con data incluye el hallazgo", () => {
  const p = AGENT_PROFILES["knave"];
  const ctx = { lastRun: { result: "issues", summary: "gap CORS", report: null, created_at: "x" }, findings: [{ severity: "critical", category: "cors", detail: "CORS abierto" }] };
  const { system, messages, model } = buildAgentPrompt(p, ctx, "¿cómo ves la seguridad?");
  assert.match(system, /Knave/);
  assert.match(system, /seguridad/i);
  assert.match(system, /CORS abierto/);
  assert.equal(messages[0].content, "¿cómo ves la seguridad?");
  assert.equal(model, "claude-sonnet-4-6");
});

test("buildAgentPrompt: sin data lo dice explícito (no invita a inventar)", () => {
  const { system } = buildAgentPrompt(AGENT_PROFILES["jabberwocky"], { lastRun: null, findings: [] }, "¿qué rompiste?");
  assert.match(system, /Todavía no corriste|no tenés data/i);
  assert.match(system, /NUNCA inventes/);
});

test("askAgent: agente inválido → mensaje legible SIN llamar al LLM", async () => {
  let called = false;
  const client = { messages: { create: async () => { called = true; return {}; } } };
  const out = await askAgent(fakeDb(), "sombrero-loco-inexistente", "hola", { client });
  assert.equal(called, false);
  assert.match(out, /No conozco un agente/);
});

test("askAgent: con client fake devuelve la respuesta prefijada con emoji+nombre", async () => {
  const client = { messages: { create: async () => ({ content: [{ type: "text", text: "Todo verde por acá." }] }) } };
  const out = await askAgent(fakeDb({ run: { result: "ok", summary: "3 checks OK", report: null, created_at: "x" } }), "white-rabbit", "¿cómo está la infra?", { client });
  assert.match(out, /🐰 White Rabbit: Todo verde por acá\./);
});

test("askAgent: si el LLM falla, lo reporta sin romper", async () => {
  const client = { messages: { create: async () => { throw new Error("timeout"); } } };
  const out = await askAgent(fakeDb(), "cheshire", "hola", { client });
  assert.match(out, /No pude contactar a Cheshire/);
});
