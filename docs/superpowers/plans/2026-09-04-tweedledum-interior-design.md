# Tweedledum Interior Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Tweedledum generate complete residential room subdivisions that ALICE deterministically furnishes with its existing doors, windows, sanitary fixtures, and furniture assets.

**Architecture:** Keep the model response focused on compact room geometry and stable references. Pure frontend helpers normalize the selected program, validate generated geometry, and materialize native `{ rooms, items }` snapshots with the existing furnishing engine; the backend contract and prompt enforce the same program and boundary vocabulary.

**Tech Stack:** Node 22 ESM, `node:test`, Express 4, Anthropic structured tool output, React 18, Vite 5, existing ALICE geometry/furniture modules.

**Spec:** `docs/superpowers/specs/2026-09-04-tweedledum-interior-design.md`

## Global Constraints

- Reuse `mobiliario.js`, `distribucion.js`, `{ rooms, items }`, architecture versions, and existing endpoints.
- Do not add an agent framework, database service, parallel agent loop, asset catalog, or compliance engine.
- Independent design performs one model call; combined review performs at most one revision.
- Regulatory observations remain advisory unless backed by existing verified evidence.
- Invalid generated geometry must not replace the live canvas.

---

### Task 1: Interior snapshot and program helpers

**Files:**
- Modify: `files/alice/src/modules/planos/feyd.js`
- Modify: `files/alice/src/modules/planos/architecture.js`
- Test: `files/alice/test/architecture.test.mjs`

**Interfaces:**
- Produces: `resolveArchitectureProgram(brief, rooms)`, `validateGeneratedInterior({ rooms, items, boundary, program })`, and `materializeInteriorLayout(layout, { boundary, program })`.
- Changes: `roomsALayout` writes `ref_id`; `layoutARooms` preserves it.

- [ ] **Step 1: Write failing round-trip, program, validation, and furnishing tests**

```js
test("architecture room references survive a layout round trip", () => {
  const layout = roomsALayout([{ id: "room-social", name: "sala", pts: square(0, 0, 4, 4) }]);
  assert.equal(layout.ambientes[0].ref_id, "room-social");
  assert.equal(layoutARooms(layout)[0].id, "room-social");
});

test("materialized Tweedledum layouts contain native interior assets", () => {
  const result = materializeInteriorLayout(furnishedFixture, { boundary: square(0, 0, 8, 8), program: { dormitorios: 1, banos: 1, nse: "C" } });
  assert.equal(result.validation.ok, true);
  assert.ok(result.items.some((item) => item.ref.startsWith("puerta-")));
  assert.ok(result.items.some((item) => item.ref.startsWith("ventana-")));
  assert.ok(result.items.some((item) => item.ref.startsWith("cama-")));
  assert.ok(result.items.some((item) => item.ref === "inodoro"));
});
```

- [ ] **Step 2: Run `cd files/alice && node --test test/architecture.test.mjs` and confirm failures identify missing stable refs/helpers.**
- [ ] **Step 3: Implement minimal pure helpers and generate items through `amoblarDesdeLayout`; reject missing program rooms, overlap, outside-boundary geometry, furniture without a room, and unreachable rooms.**
- [ ] **Step 4: Re-run the targeted frontend test and confirm it passes.**
- [ ] **Step 5: Commit `feat(planos): materialize Tweedledum interiors`.**

### Task 2: Strict compact backend contract

**Files:**
- Modify: `alicia-brain/src/architecture/schemas.js`
- Modify: `alicia-brain/src/architecture/prompts/tweedledum.v1.js`
- Modify: `alicia-brain/src/architecture/registry.js`
- Test: `alicia-brain/test/architecture-contracts.test.mjs`
- Test: `alicia-brain/test/architecture-service.test.mjs`

**Interfaces:**
- Consumes: `brief.program`, `context.site.designBoundary`, and stable room `ref_id` values.
- Produces: `normalizeDesignOutput` with strict room-level schema while retaining optional layout metadata.

- [ ] **Step 1: Add a failing contract test proving a room without `nombre`, stable `ref_id`, or a finite polygon is rejected and valid room metadata is preserved.**

```js
assert.throws(() => normalizeDesignOutput({ layout: { ambientes: [{ nombre: "sala", poligono: [[0,0],[1,0],[1,1]] }] } }), /ref_id/);
const output = normalizeDesignOutput({ layout: { ambientes: [{ nombre: "sala", ref_id: "social", tipo: "social", poligono: [[0,0],[1,0],[1,1]] }] } });
assert.equal(output.layout.ambientes[0].ref_id, "social");
```

- [ ] **Step 2: Run targeted backend tests and confirm the missing `ref_id` constraint fails.**
- [ ] **Step 3: Tighten `DESIGN_OUTPUT_SCHEMA`, normalize room fields, and update Tweedledum prompt to use `designBoundary`, satisfy explicit room counts, and omit individual furniture placement. Increment the prompt version.**
- [ ] **Step 4: Run architecture contract/service tests and confirm they pass with forced structured output.**
- [ ] **Step 5: Commit `feat(architecture): require complete compact interiors`.**

### Task 3: Editor flow and compact controls

**Files:**
- Modify: `files/alice/src/modules/planos/ArchitectureReviewPanel.jsx`
- Modify: `files/alice/src/modules/planos/EditorPlanos.jsx`
- Test: `files/alice/test/architecture.test.mjs`

**Interfaces:**
- Consumes: `resolveArchitectureProgram`, `materializeInteriorLayout`, and step-3 brief/room state.
- Produces: furnished independent design, furnished revision, `lotBoundary`/`designBoundary` context, compact critique item summaries, and fallback bedroom/bathroom controls.

- [ ] **Step 1: Add a failing payload/snapshot test proving the design boundary and explicit program reach the architecture request and the generated snapshot contains fresh catalog items rather than reanchored stale items.**
- [ ] **Step 2: Run the targeted test and confirm it fails against the current reanchoring path.**
- [ ] **Step 3: Wire the helpers into design and revision, validate before applying, serialize compact item references for critique, and show bedroom/bathroom fallback selectors in the panel.**
- [ ] **Step 4: Run frontend tests and `npm run build`; fix only failures caused by this change.**
- [ ] **Step 5: Commit `feat(planos): generate full Tweedledum interiors`.**

### Task 4: Performance and full verification

**Files:**
- Modify only files implicated by measured payload or test failures.
- Test: existing backend/frontend suites.

**Interfaces:**
- Verifies the complete feature; introduces no new public interface unless measurement exposes a concrete regression.

- [ ] **Step 1: Measure representative serialized design and critique payload sizes and confirm the critique excludes designer rationale and duplicate editor state.**
- [ ] **Step 2: Run `cd alicia-brain && node --test test/*.test.mjs`.**
- [ ] **Step 3: Run `cd files/alice && npm test && npm run build`.**
- [ ] **Step 4: Inspect `git diff --check`, `git status --short`, and the complete diff against the spec.**
- [ ] **Step 5: Commit any verification-only fixes with a scoped message, then report exact files, commands, results, invocation flow, and remaining gaps.**

