# Tweedledum and Tweedledee Architecture Agents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add independently invocable Tweedledum design and Tweedledee critique agents plus a bounded design-validation-critique-revision cycle to ALICE.

**Architecture:** `alicia-brain` owns prompt assembly, Anthropic calls, schema validation, and workflow ordering. The existing Editor de Planos supplies project context and deterministic geometry results, then persists immutable plan versions and mapped findings in its existing local-first project object.

**Tech Stack:** Node 22 ESM, Express 4, Anthropic SDK, `node:test`, React 18, Vite 5, existing Supabase-backed project store.

**Spec:** `docs/superpowers/specs/2026-09-01-tweedledum-tweedledee-architecture-agents-design.md`

## Global Constraints

- Preserve `/api/arquitecto/disenar` and `/api/arquitecto/corregir` response compatibility.
- Master prompts stay server-side and have explicit versions.
- Tweedledee never receives Tweedledum's rationale.
- A combined cycle performs at most one Tweedledum revision.
- Regulatory findings are advisory or verification-required unless matching verified evidence is supplied.
- Existing `{ rooms, items }` editor state and project synchronization remain compatible.
- No new framework, database service, compliance engine, or autonomous approval.

---

### Task 1: Architecture contracts, context, and registry

**Files:**
- Create: `alicia-brain/src/architecture/schemas.js`
- Create: `alicia-brain/src/architecture/context.js`
- Create: `alicia-brain/src/architecture/registry.js`
- Test: `alicia-brain/test/architecture-contracts.test.mjs`

**Interfaces:**
- Produces: `normalizeProjectContext(input)`, `validateDesignRequest(input)`, `validateCritiqueRequest(input)`, `normalizeDesignOutput(input)`, `normalizeCritiqueOutput(input, context)`, `publicAgentRegistry()`.

- [ ] **Step 1: Write failing contract tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeProjectContext } from "../src/architecture/context.js";
import { normalizeCritiqueOutput } from "../src/architecture/schemas.js";
import { publicAgentRegistry } from "../src/architecture/registry.js";

test("public registry exposes versions and schemas without prompt text", () => {
  const agents = publicAgentRegistry();
  assert.deepEqual(agents.map((a) => a.key), ["tweedledum", "tweedledee"]);
  assert.ok(agents.every((a) => a.promptVersion === "1.0.0"));
  assert.ok(agents.every((a) => a.outputSchema && !("prompt" in a)));
});

test("project context keeps the exact source plan version", () => {
  const context = normalizeProjectContext({ project: { id: "p1", name: "DC01" }, sourcePlanVersionId: "plan_p1_v3" });
  assert.equal(context.sourcePlanVersionId, "plan_p1_v3");
  assert.deepEqual(context.lockedElements, []);
  assert.deepEqual(context.verifiedEvidence, []);
});

test("unbacked regulatory claims are downgraded", () => {
  const output = normalizeCritiqueOutput({ verdict: "revise", score: 50, findings: [{ id: "f1", severity: "major", category: "regulatory", title: "Width", observation: "Too narrow", consequence: "Risk", recommendation: "Verify", regulatoryStatus: "verified", evidenceRefs: ["missing"] }] }, { verifiedEvidence: [] });
  assert.equal(output.findings[0].regulatoryStatus, "verification_required");
  assert.deepEqual(output.findings[0].evidenceRefs, []);
});
```

- [ ] **Step 2: Run `cd alicia-brain && node --test test/architecture-contracts.test.mjs` and verify failure because the architecture modules do not exist.**

- [ ] **Step 3: Implement strict object/enum checks, context normalization, evidence downgrading, and the public registry.**

- [ ] **Step 4: Re-run the targeted test and verify it passes.**

- [ ] **Step 5: Commit `feat(architecture): add agent contracts and registry`.**

### Task 2: Versioned prompts and independent agent services

**Files:**
- Create: `alicia-brain/src/architecture/prompts/tweedledum.v1.js`
- Create: `alicia-brain/src/architecture/prompts/tweedledee.v1.js`
- Create: `alicia-brain/src/architecture/service.js`
- Test: `alicia-brain/test/architecture-service.test.mjs`

**Interfaces:**
- Consumes: Task 1 validators and registry.
- Produces: `createArchitectureService({ client, model })` with `design(request)`, `revise(request)`, and `critique(request)`.

- [ ] **Step 1: Write a failing service test with a fake client that records complete Anthropic request payloads and returns complete text blocks.**

```js
test("Tweedledee receives plan and validation but not Tweedledum rationale", async () => {
  const calls = [];
  const client = { messages: { create: async (request) => {
    calls.push(request);
    return { content: [{ type: "text", text: JSON.stringify({ verdict: "revise", score: 70, summary: "One issue", findings: [] }) }] };
  } } };
  const service = createArchitectureService({ client, model: "test-model" });
  await service.critique({ context: { project: { id: "p1", name: "DC01" }, sourcePlanVersionId: "v2" }, planVersion: { id: "v2", layout: { ambientes: [{ nombre: "sala", poligono: [[0,0],[1,0],[1,1]] }] } }, deterministicValidation: { ok: true, findings: [] }, designObjective: "livability", designerRationale: "anchor the critic" });
  const body = JSON.stringify(calls[0].messages);
  assert.match(body, /deterministicValidation/);
  assert.doesNotMatch(body, /anchor the critic/);
});
```

- [ ] **Step 2: Run the test and verify the missing service causes failure.**

- [ ] **Step 3: Implement prompt builders, JSON extraction, injected client calls, response normalization, and distinct system identities.**

- [ ] **Step 4: Add malformed JSON and plan-version mismatch cases, then run the targeted test green.**

- [ ] **Step 5: Commit `feat(architecture): add Tweedledum and Tweedledee services`.**

### Task 3: Controlled workflow and legacy adapters

**Files:**
- Create: `alicia-brain/src/architecture/workflow.js`
- Modify: `alicia-brain/src/arquitecto.js`
- Test: `alicia-brain/test/architecture-workflow.test.mjs`

**Interfaces:**
- Consumes: `createArchitectureService`.
- Produces: `runArchitectureReviewCycle(request, { service })`, `disenarPlano`, and `corregirPlano` compatibility functions.

- [ ] **Step 1: Write a failing workflow-order test using a fake service with literal artifacts.**

```js
test("review cycle orders design, critique, and one revision", async () => {
  const order = [];
  const service = {
    design: async () => (order.push("design"), { layout: { ambientes: [] }, rationale: "hidden" }),
    critique: async (request) => {
      order.push("critique");
      assert.equal(request.designerRationale, undefined);
      return { verdict: "revise", score: 60, findings: [{ id: "f1", severity: "major", category: "circulation", title: "Route", observation: "Blocked", consequence: "No access", recommendation: "Move wall", regulatoryStatus: "not_applicable", evidenceRefs: [] }] };
    },
    revise: async () => (order.push("revise"), { layout: { ambientes: [{ nombre: "sala", poligono: [[0,0],[2,0],[2,2]] }] } }),
  };
  const result = await runArchitectureReviewCycle({ context: { project: { id: "p1", name: "DC01" } }, designRequest: {}, deterministicValidation: { ok: false, findings: [] } }, { service });
  assert.deepEqual(order, ["design", "critique", "revise"]);
  assert.equal(result.revisionPerformed, true);
});
```

- [ ] **Step 2: Run the test and verify failure because the workflow is missing.**

- [ ] **Step 3: Implement fixed ordering, actionable finding filtering, partial-artifact error handling, and exactly one revision.**

- [ ] **Step 4: Make `arquitecto.js` delegate old calls to the new service while retaining skill discovery and legacy response shapes.**

- [ ] **Step 5: Run workflow and existing architecture-related tests green, then commit `feat(architecture): orchestrate bounded review cycle`.**

### Task 4: Express endpoints

**Files:**
- Create: `alicia-brain/src/architecture/routes.js`
- Modify: `alicia-brain/src/server.js`
- Test: `alicia-brain/test/architecture-routes.test.mjs`

**Interfaces:**
- Produces: `createArchitectureRouter({ service })` and routes documented in the spec.

- [ ] **Step 1: Write failing route tests against an Express app on an ephemeral port, asserting 400 for missing context, 200 for injected valid service output, and no prompt text from `GET /agents`.**

- [ ] **Step 2: Run the test and verify failure because the router is missing.**

- [ ] **Step 3: Implement router handlers with stable status mapping: 400 request validation, 502 model/schema response, and 503 missing configuration.**

- [ ] **Step 4: Mount the router at `/api/architecture` before the legacy endpoints in `server.js`.**

- [ ] **Step 5: Run route tests and `node --check src/server.js src/architecture/*.js src/architecture/prompts/*.js`, then commit `feat(api): expose architecture agent endpoints`.**

### Task 5: Frontend versioning and API adapter

**Files:**
- Create: `files/alice/src/modules/planos/architecture.js`
- Create: `files/alice/test/architecture.test.mjs`
- Modify: `files/alice/src/modules/planos/feyd.js`

**Interfaces:**
- Produces: `createPlanVersion`, `applyPlanVersion`, `serializeValidation`, `mapFindingLocation`, `designWithTweedledum`, `critiqueWithTweedledee`, `runArchitectureCycle`.

- [ ] **Step 1: Write failing pure-helper tests.**

```js
test("new plan versions preserve their parent snapshot", () => {
  const history = [{ id: "v1", version: 1, snapshot: { rooms: [{ id: "r1" }], items: [] } }];
  const next = createPlanVersion(history, { projectId: "p1", parentVersionId: "v1", createdBy: "tweedledum", snapshot: { rooms: [{ id: "r2" }], items: [] }, now: "2026-09-01T12:00:00.000Z" });
  assert.equal(next.version.id, "plan_p1_v2");
  assert.equal(next.version.parentVersionId, "v1");
  assert.deepEqual(history[0].snapshot.rooms, [{ id: "r1" }]);
});

test("deterministic validation becomes serializable findings", () => {
  const value = serializeValidation({ ok: false, total: 1, fueraLote: [{ id: "r1", name: "sala" }], sinPiso: [], aislados: [], ids: new Set(["r1"]), mensajes: ["1 fuera"] });
  assert.deepEqual(value.findings[0], { code: "outside_boundary", severity: "major", targetType: "room", targetId: "r1", message: "sala está fuera del terreno" });
});
```

- [ ] **Step 2: Run `cd files/alice && npm test` and verify failure from the missing module.**

- [ ] **Step 3: Implement immutable helpers and fetch adapters using `ALICIA_URL`; keep old `feyd.js` exports as wrappers.**

- [ ] **Step 4: Run frontend tests green and commit `feat(planos): add architecture versions and API client`.**

### Task 6: Editor de Planos wiring

**Files:**
- Create: `files/alice/src/modules/planos/ArchitectureReviewPanel.jsx`
- Modify: `files/alice/src/modules/planos/EditorPlanos.jsx`

**Interfaces:**
- Consumes: Task 5 helpers and the existing `validarPlan` result.
- Produces: independent Tweedledum/Tweedledee actions, combined cycle action, findings display, and apply-as-new-version behavior.

- [ ] **Step 1: Add editor state initialized from `P.architectureVersions`, `P.architectureRuns`, and `P.activeArchitectureVersionId`; include these fields in the existing project save effect.**

- [ ] **Step 2: Add handlers that snapshot the current live plan, serialize `val`, inject `{ project: { id, name }, brief, site, constraints, lockedElements, sourcePlanVersionId }`, and call the Task 5 API functions.**

- [ ] **Step 3: Build the review panel using existing colors, typography, compact cards, and location labels; do not expose prompts.**

- [ ] **Step 4: Replace the old single Feyd toolbar action with the Architecture Review control while keeping old imports functional for other call sites.**

- [ ] **Step 5: Apply returned layouts through the existing room/layout adapter and `commit`, creating an immutable child version before changing live rooms/items.**

- [ ] **Step 6: Run `cd files/alice && npm test && npm run build`, then commit `feat(planos): wire Tweedledum and Tweedledee review UI`.**

### Task 7: Full verification and documentation

**Files:**
- Modify: `alicia-brain/.env.example`
- Modify: `HANDOFF.md`

**Interfaces:**
- Documents exact endpoints, request shapes, UI invocation, prompt versions, compatibility routes, and known limitations.

- [ ] **Step 1: Document model/API environment requirements without adding secrets.**

- [ ] **Step 2: Document independent agent and combined-cycle invocation in `HANDOFF.md`.**

- [ ] **Step 3: Run `cd alicia-brain && node --test test/*.test.mjs`.**

- [ ] **Step 4: Run backend syntax checks for every file under `alicia-brain/src` and `erp-backend/src`.**

- [ ] **Step 5: Run `cd files/alice && npm test && npm run build`.**

- [ ] **Step 6: Run `git diff --check`, inspect `git status --short`, and verify unrelated files remain untouched.**

- [ ] **Step 7: Commit `docs(architecture): document agent invocation and limits`.**
