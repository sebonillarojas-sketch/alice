# Tweedledum and Tweedledee Architecture Agents Design

## Goal

Split ALICE's current mixed architectural agent into two server-side agents with distinct responsibilities:

- **Tweedledum** designs and revises architectural plans.
- **Tweedledee** independently critiques a specific plan version.

ALICE must also support a controlled `Tweedledum -> deterministic validation -> Tweedledee -> Tweedledum revision` cycle while preserving the existing Editor de Planos, project storage, Supabase synchronization, Anthropic integration, and legacy `/api/arquitecto/*` callers.

## Existing system

ALICE already has the required foundations:

- `alicia-brain` is the Express/Anthropic backend and owns server-side model calls.
- `alicia-brain/src/arquitecto.js` currently mixes plan design, self-critique, and correction under the Feyd-Rautha name.
- `files/alice/src/modules/planos/feyd.js` translates between Editor rooms and the backend layout format.
- `files/alice/src/modules/planos/validacion.js` performs deterministic local geometry checks.
- `files/alice/src/modules/cabida/proyectos.js` stores each project's cabida and plan in a local-first object synchronized to Supabase.
- Existing plan editor state is mutable, but project objects can safely be extended with immutable architecture versions and run records.

The implementation must reuse these boundaries. It will not introduce a new agent framework, database service, frontend application, or geometry representation.

## Chosen approach

Add a focused architecture-agent subsystem to `alicia-brain` and a small Architecture Review panel to the existing Editor de Planos.

The subsystem contains:

1. A versioned agent registry.
2. Separate server-side prompt files.
3. Shared input/output schemas and runtime validators.
4. A project-context builder that normalizes data already supplied by ALICE.
5. A deterministic validation boundary.
6. Independent design and critique services.
7. A bounded review-cycle orchestrator.
8. Compatibility wrappers for existing architectural endpoints.

## Agent boundaries

### Tweedledum

Tweedledum may:

- Normalize the supplied project brief.
- Create a proposed layout from a footprint and program.
- Revise a source plan in response to selected Tweedledee findings.
- Explain assumptions and trade-offs in structured fields.

Tweedledum must not:

- Approve its own plan.
- Declare regulatory compliance.
- Invent missing project, market, municipal, RNE, structural, or MEP facts.
- Modify an existing plan version in place.

### Tweedledee

Tweedledee receives:

- The normalized project context.
- The selected design objective.
- The exact source plan version.
- Deterministic validation results.
- Explicitly supplied verified evidence.

Tweedledee does not receive Tweedledum's free-form rationale or hidden reasoning. This avoids anchoring the critic to the designer's persuasive explanation.

Tweedledee may:

- Return a structured verdict and score.
- Produce findings categorized by severity and domain.
- Attach findings to a room ID, item ID, polygon, or point when the plan model supplies those references.
- Recommend revision strategies.

Tweedledee must not:

- Mutate plan geometry.
- Declare formal approval or compliance.
- Present unverified RNE or municipal claims as facts.

## Prompt storage and versioning

Prompts live only in `alicia-brain/src/architecture/prompts/`:

- `tweedledum.v1.js`
- `tweedledee.v1.js`

Each exports a prompt version and prompt builder. The browser receives only agent metadata and outputs, never master prompt content.

The registry records:

- `key`
- `displayName`
- `promptVersion`
- `model`
- `availableTools`
- `outputSchema`

Every agent result includes the registry key and prompt version used.

## Data contracts

### Plan version

The current plan representation remains `{ rooms, items, ...editorState }`. A version record wraps an immutable snapshot:

```json
{
  "id": "plan_<project>_v1",
  "projectId": "p_123",
  "version": 1,
  "parentVersionId": null,
  "label": "V01",
  "createdBy": "human|tweedledum",
  "createdAt": "ISO-8601",
  "snapshot": { "rooms": [], "items": [] }
}
```

Backend requests may receive the equivalent strict layout representation already used by `arquitecto.js`; the client adapter preserves room IDs in `ref_id` fields whenever possible.

### Project context

The context builder accepts only data ALICE already has or the caller explicitly supplies:

```json
{
  "project": { "id": "p_123", "name": "Project" },
  "brief": {},
  "site": {},
  "constraints": {},
  "lockedElements": [],
  "assumptions": [],
  "sourcePlanVersionId": "plan_p_123_v1",
  "verifiedEvidence": []
}
```

Unknown fields are ignored. Missing material facts are listed as assumptions or verification requirements, never silently fabricated.

### Deterministic validation

The browser converts the existing `validarPlan` result into serializable findings. The backend adds structural contract checks such as:

- Plan/layout shape is valid.
- Referenced source version matches the supplied plan.
- Location references point to known room/item IDs when provided.

Geometry checks remain in the existing frontend engine because it already understands Editor coordinates. The workflow will not label model-generated observations as deterministic validation.

### Tweedledee finding

```json
{
  "id": "finding_1",
  "severity": "critical|major|minor|info",
  "category": "circulation|furnishability|daylight|privacy|structure|mep|buildability|commercial|regulatory|other",
  "title": "Short title",
  "observation": "What is present",
  "consequence": "Why it matters",
  "recommendation": "What to change",
  "location": {
    "roomId": "room_1",
    "itemId": null,
    "point": { "x": 1.2, "y": 3.4 }
  },
  "regulatoryStatus": "not_applicable|advisory|verification_required|verified",
  "evidenceRefs": []
}
```

`verified` is accepted only when the request contains matching verified evidence. Otherwise the runtime normalizer downgrades the finding to `advisory` or `verification_required`.

## Tool interfaces

Agent tools are narrow interfaces implemented by the architecture service rather than direct model access to arbitrary ALICE tools:

- `get_project_context`
- `get_plan_version`
- `get_deterministic_validation`
- `list_verified_evidence`
- `list_accepted_findings` (Tweedledum revision only)

Version creation and finding persistence remain application-controlled operations after a valid model response. Neither model can overwrite project state or approve a plan.

## Workflow

### Independent design

1. The client snapshots or selects a source plan version.
2. ALICE sends normalized project context and the design request to Tweedledum.
3. The server validates Tweedledum's structured response.
4. The client saves the returned proposal as a new immutable version.

### Independent critique

1. The client selects a plan version.
2. The existing deterministic validator runs on that exact snapshot.
3. ALICE sends project context, snapshot, serialized validator output, and verified evidence to Tweedledee.
4. The server validates and normalizes findings.
5. The client stores the critique run and findings against the source version.

### Combined cycle

1. Tweedledum creates a proposal from a selected source version or design brief.
2. Deterministic validation runs before critique. The endpoint requires the caller's serialized geometry validation and also performs contract validation.
3. Tweedledee critiques that proposal without receiving Tweedledum's rationale.
4. If critical or major findings exist, the orchestrator sends only accepted/actionable structured findings to Tweedledum for one revision.
5. The revision is returned as a new child version.
6. The cycle stops after one revision. Further passes require an explicit user action, preventing uncontrolled agent loops and spend.

The combined endpoint returns every intermediate artifact; the frontend persists versions only after successful response validation.

## API

New endpoints:

- `GET /api/architecture/agents`
- `POST /api/architecture/tweedledum/design`
- `POST /api/architecture/tweedledum/revise`
- `POST /api/architecture/tweedledee/critique`
- `POST /api/architecture/review-cycle`

Legacy compatibility:

- `/api/arquitecto/disenar` delegates to Tweedledum and preserves its legacy response shape.
- `/api/arquitecto/corregir` delegates to the new review/revision services and preserves its legacy response shape where possible.

Compatibility endpoints are marked deprecated in comments but are not removed.

## Frontend

The existing Editor toolbar gains an Architecture Review control with three actions:

- Design with Tweedledum.
- Critique with Tweedledee.
- Run review cycle.

The review panel displays:

- Current version label.
- Agent/prompt versions.
- Deterministic validation summary.
- Tweedledee verdict, score, and findings.
- Finding severity/category/location.
- A button to apply a Tweedledum proposal or revision as a new version.

Project `plano` state gains:

- `architectureVersions`
- `architectureRuns`
- `activeArchitectureVersionId`

Existing `rooms` and `items` remain the live editor state for backward compatibility. Activating/applying a version copies its snapshot into the live editor without deleting prior versions.

## Error handling

- Invalid requests return HTTP 400 with a stable error code and validation details.
- Missing Anthropic configuration returns HTTP 503.
- Malformed model JSON or schema violations return HTTP 502 and are never persisted.
- A failed critique does not discard a successful design proposal.
- A failed revision still returns the design and critique artifacts from the cycle.
- Legacy endpoints continue returning their established `{ error }` error shape.

## Testing

Use the repository's `node:test` convention.

Backend tests cover:

- Agent registry metadata without prompt leakage.
- Project-context normalization and plan-version references.
- Output validation and malformed-response rejection.
- Regulatory downgrade behavior without verified evidence.
- Tweedledee prompt isolation from Tweedledum rationale.
- Controlled workflow ordering and one-revision limit using an injected model client.
- Legacy response adapters.

Frontend tests cover plain JavaScript helpers for:

- Immutable plan version creation.
- Serializable deterministic validation.
- Finding-to-plan location mapping.
- Applying a version without deleting history.

Verification runs:

- Targeted backend and frontend tests.
- Full `alicia-brain` suite.
- Full `files/alice` test suite.
- Backend syntax checks.
- Frontend production build.

## Explicit non-goals and remaining boundaries

- No new CAD/BIM engine.
- No new database service or migration away from the existing project store.
- No automated human/architect approval.
- No RNE compliance engine.
- No claims that the current lightweight geometry checks prove accessibility, structural, MEP, fire, municipal, or RNE compliance.
- No unlimited autonomous revision loop.

Formal regulatory verification remains a human responsibility until ALICE has verified, versioned regulatory sources and deterministic tools that implement them.
