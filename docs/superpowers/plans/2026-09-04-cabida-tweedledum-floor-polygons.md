# Cabida-Originated Tweedledum Floor Polygons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Tweedledum propose a validated typical-floor partition directly from Cabida, retain `packFloor` as a labeled fallback, and make Planos preserve infrastructure while designing residential interiors per unit.

**Architecture:** Extend the existing `alicia-brain/src/architecture` service with a separate versioned floor-planning prompt, schema, validator, and orchestration method. Cabida constructs the model request and local deterministic fallback from its current footprint, stores immutable accepted proposals in the existing project store, and hands the selected contract to Planos. Planos converts locked infrastructure directly and runs the existing interior materializer independently inside each unit boundary.

**Tech Stack:** Node.js ESM, Express, Anthropic tool-use schemas, React 18, Vite, Node test runner, existing ALICE polygon utilities and local-first/Supabase project store.

**Spec:** `docs/superpowers/specs/2026-09-04-cabida-tweedledum-floor-polygons-design.md`

## Global Constraints

- Keep Tweedledum prompts server-side, versioned, and separate from the interior-design prompt.
- Allowed floor roles are exactly `unidad`, `core`, `circulacion`, and `void`.
- `polygonId` is unique per polygon piece; unit pieces share a stable `unitRef` when they belong to one apartment.
- Core, circulation, units, and voids are exclusive geometry and may not materially overlap.
- The model receives at most one corrective revision before the deterministic fallback is selected.
- `packFloor` remains a fallback and its circulation must be split around the core before validation.
- No RNE or municipal compliance claim is made without matching verified evidence.
- Cabida generation is manual and does not run on input changes.
- Planos must preserve accepted core, circulation, and void geometry.

---

### Task 1: Define the floor-planning contract and dedicated Tweedledum prompt

**Files:**
- Modify: `alicia-brain/src/architecture/schemas.js`
- Create: `alicia-brain/src/architecture/prompts/tweedledum-floor.v1.js`
- Modify: `alicia-brain/src/architecture/registry.js`
- Test: `alicia-brain/test/architecture-contracts.test.mjs`

**Interfaces:**
- Produces: `validateFloorPlanRequest(input)`, `normalizeFloorPlanOutput(input)`, and `FLOOR_PLAN_OUTPUT_SCHEMA` from `schemas.js`.
- Produces: `buildTweedledumFloorSystemPrompt(referenceMaterial)` and `TWEEDLEDUM_FLOOR_PROMPT_VERSION` from the new prompt module.
- Extends `ARCHITECTURE_AGENT_REGISTRY.tweedledum` with `floorPromptVersion` without exposing prompt text.

- [ ] **Step 1: Write failing contract tests**

Add tests that call `normalizeFloorPlanOutput` with one core, two circulation pieces, and two units; assert numeric coordinates are normalized, `polygonId` values are unique, unit pieces require `unitRef`, non-unit pieces reject a non-null `unitRef`, roles outside the four allowed values fail, and `sourceCabidaVersionId` is required. Add a registry assertion for `floorPromptVersion: "1.0.0"`.

```js
const floor = normalizeFloorPlanOutput({
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
assert.equal(floor.floor.polygons[1].unitRef, "unit-1");
```

- [ ] **Step 2: Run the contract test and verify it fails because the exports do not exist**

Run: `cd alicia-brain && node --test test/architecture-contracts.test.mjs`

Expected: FAIL on the missing floor-contract exports.

- [ ] **Step 3: Implement strict normalization and JSON schema**

Add `FLOOR_ROLES`, shared finite-polygon normalization, exact role/unit-reference rules, required program integers for units, and a JSON schema whose required fields mirror normalization. Do not perform spatial validation in this module.

```js
export function validateFloorPlanRequest(input = {}) {
  requireContext(input.context);
  requiredText(input.context?.sourceCabidaVersionId, "context.sourceCabidaVersionId");
  if (!input.floorBrief || typeof input.floorBrief !== "object") throw new ArchitectureValidationError("floorBrief is required", ["floorBrief"]);
  if (!input.deterministicFallback || typeof input.deterministicFallback !== "object") throw new ArchitectureValidationError("deterministicFallback is required", ["deterministicFallback"]);
  return input;
}

export function normalizeFloorPlanOutput(input = {}) {
  const sourceCabidaVersionId = requiredText(input.floor?.sourceCabidaVersionId, "floor.sourceCabidaVersionId");
  const polygons = normalizeFloorPolygons(input.floor?.polygons);
  return { summary: String(input.summary || ""), floor: { sourceCabidaVersionId, polygons }, assumptions: stringArray(input.assumptions), tradeoffs: stringArray(input.tradeoffs) };
}
```

- [ ] **Step 4: Create the compact floor prompt and register its version**

The prompt must instruct Tweedledum to partition only the supplied buildable footprint, return no furniture or room interiors, preserve the exact Cabida version, use the four roles, make every polygon exclusive, and treat references as advisory rather than verified regulation.

- [ ] **Step 5: Run the contract test and commit**

Run: `cd alicia-brain && node --test test/architecture-contracts.test.mjs`

Expected: PASS.

Commit: `feat(architecture): define Tweedledum floor contract`

---

### Task 2: Add deterministic floor validation

**Files:**
- Create: `alicia-brain/src/architecture/floor-validation.js`
- Test: `alicia-brain/test/architecture-floor-validation.test.mjs`

**Interfaces:**
- Consumes: normalized output from `normalizeFloorPlanOutput`.
- Produces: `validateFloorProposal(proposal, { buildableFootprint, sourceCabidaVersionId, unitsPerFloor, mix, targetAverageArea, areaTolerance = 0.2 })` returning `{ ok, findings, stats }`.
- Finding shape: `{ code, severity, polygonIds, unitRefs, message }`.

- [ ] **Step 1: Write failing geometry tests**

Cover: polygons outside the footprint, positive-area overlap for every role pair, touching edges accepted, duplicate/fragmented unit references counted once, missing core/circulation, unit disconnected from circulation, circulation disconnected from core, Cabida-version mismatch, wrong unit count, bedroom-mix mismatch, and average unit-area outside 20% tolerance.

```js
const result = validateFloorProposal(proposal, {
  buildableFootprint: rect(0, 0, 10, 8),
  sourceCabidaVersionId: "cabida_p1_v3",
  unitsPerFloor: 2,
  mix: { dormitorios1: 1, dormitorios2: 1, dormitorios3: 0 },
  targetAverageArea: 28,
});
assert.equal(result.ok, true, result.findings.map((finding) => finding.message).join(" · "));
```

- [ ] **Step 2: Run the validator test and verify the missing module failure**

Run: `cd alicia-brain && node --test test/architecture-floor-validation.test.mjs`

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement dependency-free polygon predicates**

Implement signed area, segment intersection, point-on-segment, point-in-polygon, polygon containment, and positive-area overlap. Treat shared boundaries as adjacency, not overlap. Reject non-degenerate crossing or strict containment.

- [ ] **Step 4: Implement reference, program, access, and version checks**

Group `unidad` pieces by `unitRef`; count and aggregate their areas once per apartment; verify every unit group touches `circulacion`, and at least one circulation polygon touches `core`. Use explicit constants `AREA_TOLERANCE = 0.20` and `OVERLAP_EPSILON_M2 = 0.01`.

- [ ] **Step 5: Run tests and commit**

Run: `cd alicia-brain && node --test test/architecture-floor-validation.test.mjs`

Expected: PASS.

Commit: `feat(architecture): validate floor proposal geometry`

---

### Task 3: Orchestrate design, one revision, and validated fallback on the backend

**Files:**
- Modify: `alicia-brain/src/architecture/service.js`
- Modify: `alicia-brain/src/architecture/routes.js`
- Test: `alicia-brain/test/architecture-service.test.mjs`
- Test: `alicia-brain/test/architecture-routes.test.mjs`

**Interfaces:**
- Consumes: `validateFloorPlanRequest`, `normalizeFloorPlanOutput`, `FLOOR_PLAN_OUTPUT_SCHEMA`, `validateFloorProposal`, and the floor prompt.
- Produces: `service.planFloor(input)`.
- Produces endpoint: `POST /api/architecture/tweedledum/floor-plan`.
- Response: `{ originalProposal, revision, validation, selected, source, agent, promptVersion, model }`, where `source` is `tweedledum`, `revision`, or `deterministic_fallback`.

- [ ] **Step 1: Write failing service tests for all three selection paths**

Test that a valid first response makes one model call; an invalid first response sends structured findings and makes exactly one revision call; an invalid revision selects the supplied validated fallback; and an invalid fallback throws without returning invalid geometry. Assert the model tool schema is `FLOOR_PLAN_OUTPUT_SCHEMA` and the prompt version is `1.0.0`.

- [ ] **Step 2: Run focused service tests and confirm failure**

Run: `cd alicia-brain && node --test test/architecture-service.test.mjs`

Expected: FAIL because `planFloor` is absent.

- [ ] **Step 3: Generalize the internal model call without changing existing agents**

Allow `call` to accept an explicit tool schema, tool suffix, and token budget. Keep interior design at 6000 tokens and floor planning at 3500 tokens.

```js
const call = async (agentKey, system, payload, normalize, options = {}) => {
  const outputToolName = options.toolName || `submit_${agentKey}_output`;
  const inputSchema = options.outputSchema || ARCHITECTURE_AGENT_REGISTRY[agentKey].outputSchema;
  // existing request and normalization path
};
```

- [ ] **Step 4: Implement `planFloor` with one bounded revision**

Normalize and validate the original response. If invalid, call Tweedledum once with `operation: "revise_floor"`, the original proposal, and only deterministic findings. Validate again. Then normalize and validate `input.deterministicFallback`; select it only if both model results fail. Preserve the original and revision for traceability.

- [ ] **Step 5: Add the route and HTTP tests**

Assert a valid request returns 200 and `source`; missing source version returns 400; model failure with a valid fallback returns 200 with `deterministic_fallback`; and all invalid candidates return 502 without leaking prompt text.

- [ ] **Step 6: Run backend architecture tests and commit**

Run: `cd alicia-brain && node --test test/architecture-contracts.test.mjs test/architecture-floor-validation.test.mjs test/architecture-service.test.mjs test/architecture-routes.test.mjs test/architecture-workflow.test.mjs`

Expected: PASS.

Commit: `feat(architecture): orchestrate Cabida floor planning`

---

### Task 4: Convert `packFloor` into an exclusive fallback contract

**Files:**
- Modify: `files/alice/src/modules/planos/lote.js`
- Modify: `files/alice/src/modules/planos/plantas.js`
- Create: `files/alice/src/modules/cabida/floorProposal.js`
- Test: `files/alice/test/architecture.test.mjs`

**Interfaces:**
- Extends `packFloor` return value with `corridors: Array<{ id, tipo, pts }>`; retains `corridor` only as a deprecated compatibility value when there is exactly one exclusive piece.
- Produces: `fallbackFloorProposal({ footprint, frontIdx, brief, sourceCabidaVersionId })`.
- Produces: `proposalToParti(proposal)` for preview/Planos bridging.

- [ ] **Step 1: Write failing fallback tests**

Assert the adapter returns the requested source version, unique `polygonId`s, exactly the requested unit groups, and no core/circulation overlap. Add a test that two corridor pieces may touch the core on opposite sides. Assert `proposalToParti` retains `role`, `polygonId`, `unitRef`, and `unitProgram` on rooms.

- [ ] **Step 2: Run the frontend test and verify failure**

Run: `cd files/alice && node --test test/architecture.test.mjs`

Expected: FAIL because `floorProposal.js` is absent.

- [ ] **Step 3: Split deterministic circulation around the core**

In the oriented frame, create the corridor as `[0, coreU0]` and `[coreU1, frente]` rectangles, omit sub-epsilon pieces, clip each to the footprint, and expose them as `corridors`. Update both `generarDistribuciones` and `amoblarParti` to add every corridor piece. This removes the core/circulation overlay from new deterministic output.

- [ ] **Step 4: Implement fallback conversion**

Call `generarDistribuciones`, select the first viable partition, group split unit blocks by their original requested-unit identity, and emit the dedicated floor contract. If the current packer lacks a stable original unit identity, add `unitRef` before segment splitting in `packFloor` and preserve it on each piece.

- [ ] **Step 5: Run frontend tests and commit**

Run: `cd files/alice && npm test`

Expected: PASS.

Commit: `fix(planos): make floor fallback geometry exclusive`

---

### Task 5: Add Cabida API calls, immutable proposal state, and manual UI

**Files:**
- Modify: `files/alice/src/modules/planos/architecture.js`
- Modify: `files/alice/src/modules/cabida/proyectos.js`
- Modify: `files/alice/src/modules/cabida/CabidaView.jsx`
- Modify: `files/alice/src/modules/cabida/EsquemaPlanta.jsx`
- Test: `files/alice/test/architecture.test.mjs`

**Interfaces:**
- Produces: `planFloorWithTweedledum(payload, options)` in the existing architecture API module.
- Produces store methods `addFloorProposal(projectId, record)` and `acceptFloorProposal(projectId, proposalId)`.
- Proposal record: `{ id, version, sourceCabidaVersionId, parentProposalId, source, promptVersion, model, floor, validation, createdAt }`.
- `EsquemaPlanta` receives `floorProposals`, `activeFloorProposalId`, `onProposeFloor`, and `onAcceptFloor`.

- [ ] **Step 1: Write failing pure API/store tests**

Mock `fetch` and assert the client posts to `/api/architecture/tweedledum/floor-plan`. Exercise immutable proposal append/accept helpers exported from `proyectos.js`: prior records remain unchanged, versions increment, and accepting writes both `cabida.activeFloorProposalId` and `plano.floorProposal`.

- [ ] **Step 2: Run tests and confirm failure**

Run: `cd files/alice && node --test test/architecture.test.mjs`

Expected: FAIL on missing exports.

- [ ] **Step 3: Add the API wrapper and project-store operations**

Reuse `callArchitecture`. Store no server prompt content. Keep local-first persistence and existing background Supabase synchronization unchanged.

- [ ] **Step 4: Build the current Cabida version and request payload**

Derive a stable version token from the project ID plus the Cabida inputs that define geometry/program. Include the exact buildable footprint, front edge, lot type, units per floor, average area, integer bedroom-mix targets, and the locally built deterministic fallback.

- [ ] **Step 5: Add the manual interaction**

Place **Proponer planta con Tweedledum** beside the real typical-floor preview. Disable it while running, show `Diseñando planta…`, show errors inline, preview the selected valid response, label its source (`Tweedledum`, `revisión`, or `respaldo determinístico`), and provide **Aceptar y enviar a Planos**. Editing inputs must not call the endpoint automatically.

- [ ] **Step 6: Run tests and production build, then commit**

Run: `cd files/alice && npm test`

Run: `cd files/alice && npm run build`

Expected: both PASS.

Commit: `feat(cabida): propose typical floors with Tweedledum`

---

### Task 6: Make Planos preserve infrastructure and design each unit independently

**Files:**
- Modify: `files/alice/src/modules/planos/feyd.js`
- Modify: `files/alice/src/modules/planos/EditorPlanos.jsx`
- Test: `files/alice/test/architecture.test.mjs`

**Interfaces:**
- Produces: `splitAcceptedFloor(floor)` returning `{ lockedRooms, units }`.
- Produces: `materializeUnitInteriors({ floor, designUnit, reviseUnit })` returning `{ rooms, items, unitResults }`.
- `designUnit` receives `{ unitRef, polygonId, boundary, program }`; each request uses the unit polygon as `context.site.designBoundary`.

- [ ] **Step 1: Write failing unit-isolation tests**

Use a floor with core, two corridor pieces, a void, and two units. Assert locked rooms are returned byte-for-byte, exactly two sequential design calls occur, each call sees only its unit boundary/program, generated room IDs are namespaced by `unitRef`, and failure after one revision leaves only that unit envelope as `pendingInterior: true` while the other unit succeeds.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `cd files/alice && node --test test/architecture.test.mjs`

Expected: FAIL because the new helpers do not exist.

- [ ] **Step 3: Implement floor splitting and sequential unit materialization**

Map `core`, `circulacion`, and `void` directly to locked native rooms. Process unique unit groups with a `for...of` loop, call the existing `materializeWithOneRevision` per unit, namespace rooms/items, and never pass common infrastructure to the apartment prompt.

- [ ] **Step 4: Prefer the accepted Cabida proposal when initializing Planos**

Read `proyecto.plano.floorProposal`. If present, materialize its locked rooms and unit envelopes rather than calling `generarDistribuciones`. Keep the current path for legacy projects without a proposal.

- [ ] **Step 5: Route Tweedledum design through unit boundaries**

When an accepted floor exists, the Architecture Review panel's Tweedledum action invokes the per-unit helper and applies all valid completed units together as one architecture version. Core, circulation, and void snapshots remain unchanged. Keep whole-canvas behavior for legacy projects.

- [ ] **Step 6: Run frontend regression tests and build, then commit**

Run: `cd files/alice && npm test`

Run: `cd files/alice && npm run build`

Expected: both PASS.

Commit: `feat(planos): design accepted Cabida units independently`

---

### Task 7: Verify the complete workflow and document invocation

**Files:**
- Modify: `files/alice/README.md`
- Modify: `alicia-brain/test/architecture-routes.test.mjs`
- Modify: `files/alice/test/architecture.test.mjs`

**Interfaces:**
- Documents the existing independent designer/critic calls and the new combined Cabida floor call.
- Produces no new runtime interface.

- [ ] **Step 1: Add a route-level regression for the exact Cabida payload and response envelope**

Assert the route preserves `sourceCabidaVersionId`, never returns prompt text, and includes mapped polygon IDs in invalid-candidate findings.

- [ ] **Step 2: Document how to invoke and use the flow**

Document:

```text
Cabida UI: distribución esquemática → Proponer planta con Tweedledum → Aceptar y enviar a Planos
POST /api/architecture/tweedledum/floor-plan
POST /api/architecture/tweedledum/design
POST /api/architecture/tweedledum/revise
POST /api/architecture/tweedledee/critique
POST /api/architecture/review-cycle
```

State that regulatory checks are advisory unless backed by `verifiedEvidence`, and that legacy projects continue using `packFloor`.

- [ ] **Step 3: Run all available verification**

Run: `cd alicia-brain && node --test test/*.test.mjs`

Run: `cd files/alice && npm test`

Run: `cd files/alice && npm run build`

Run: `git diff --check`

Expected: all tests pass, the Vite production build succeeds, and the diff check prints nothing.

- [ ] **Step 4: Review the final diff for scope and accidental prompt exposure**

Run: `git diff --stat origin/main...HEAD`

Run: `rg -n "You are Tweedledum|SERVER-SIDE ADVISORY" files/alice/src || true`

Expected: prompt text appears only under `alicia-brain/src/architecture/prompts`; frontend search prints nothing.

- [ ] **Step 5: Commit documentation and final regression coverage**

Commit: `docs(architecture): document Cabida floor workflow`
