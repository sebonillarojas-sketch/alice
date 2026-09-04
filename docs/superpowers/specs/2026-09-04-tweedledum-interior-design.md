# Tweedledum Interior Design

## Goal

Make Tweedledum produce a complete, usable residential interior in the existing ALICE plan editor: subdivided rooms, interior walls, doors, windows, sanitary fixtures, and basic furniture. Reuse ALICE's current geometry, catalog, validation, versioning, and architecture-agent stack.

The interaction must stay fast. The model designs the spatial subdivision; deterministic ALICE code creates catalog items and checks the result.

## Current behavior and cause

The architecture endpoint currently requires drawable room polygons, but it does not require a complete residential program or stable room references. When the editor applies a Tweedledum layout, `snapshotFromLayout` converts the polygons and calls `reanclarItems`, which only moves furniture from the previous plan. An empty or newly subdivided plan therefore receives no new interior assets.

The project context also exposes the lot boundary as the generic design boundary. That is insufficient when the editable apartment or building footprint is smaller than the lot.

## Chosen approach

Use a hybrid pipeline:

1. Tweedledum returns the complete room program and polygons inside an explicit design boundary.
2. ALICE validates the geometry and required program deterministically.
3. ALICE's existing `amoblarDesdeLayout` and furniture catalog generate doors, windows, sanitary fixtures, and basic furniture.
4. Tweedledee critiques the furnished proposal and its deterministic findings.
5. A review cycle may request at most one geometric revision, after which ALICE regenerates the interior assets.

The model will not place individual catalog assets. This avoids a larger response, invented asset identifiers, coordinate drift, and unnecessary model latency.

## Program source

The requested residential program comes from the unit typology selected in step 3. Architecture Review will use that selection when available. If no typology is available, it will expose compact bedroom and bathroom controls rather than silently guessing a program from area alone.

The normalized brief sent to Tweedledum includes at minimum:

- bedroom count;
- bathroom count;
- optional visitor bathroom;
- kitchen type;
- laundry requirement;
- socioeconomic segment used by ALICE's furniture rules;
- target area;
- explicit design boundary.

## Data contract

Each returned room must contain:

- `nombre`;
- stable `ref_id`;
- `poligono` with at least three finite `[x, y]` coordinates;
- optional `tipo`, `zona`, and `luz` metadata already understood by ALICE.

`roomsALayout` preserves editor room IDs as `ref_id`. `layoutARooms` reuses valid `ref_id` values and creates an ID only when the model supplies none. This lets Tweedledee findings map back to rooms and improves revision stability.

The project context distinguishes:

- `site.lotBoundary`: the legal/site parcel outline when known;
- `site.designBoundary`: the footprint within which Tweedledum must subdivide the plan.

The existing fields remain readable during migration so current callers are not broken.

## Interior materialization

After valid room geometry is received, the editor calculates its bounds and calls the existing deterministic furnishing engine. That engine reuses assets from `mobiliario.js` and produces:

- interior doors from room adjacency;
- one principal entrance when a social room touches the applicable perimeter;
- windows for habitable perimeter rooms;
- beds, closets, desks, sofas, tables, kitchen equipment, sanitary fixtures, and other supported basic furniture according to room names and NSE.

Generated plans replace stale generated furnishings instead of reanchoring them. Applying an old saved version continues to use the exact saved snapshot.

## Deterministic validation

Before a generated proposal is applied, ALICE checks:

- every room is inside the design boundary;
- room polygons are drawable and have positive area;
- rooms do not materially overlap;
- the requested bedroom and bathroom counts are present;
- a social space and kitchen are present for a residential program;
- generated furniture belongs to a room;
- every room is reachable through the generated door graph;
- the result is materially different from the source for a design operation.

Failed proposals remain recoverable as architecture artifacts but do not replace the live canvas. Validation messages use room references where available.

RNE or municipal observations remain advisory unless the request contains verified evidence already recognized by the architecture subsystem.

## Fast path

Independent Tweedledum design uses one model call followed by local validation and furnishing. It does not call Tweedledee automatically.

The combined cycle remains bounded to design, local validation, critique, and at most one revision. Payloads contain compact room geometry and item summaries only; image data, duplicate editor state, and designer rationale are excluded from Tweedledee. The existing reduced Tweedledee token budget remains in force.

## UI behavior

Architecture Review keeps its three actions:

- Tweedledum: generate and apply a complete furnished interior after validation;
- Tweedledee: critique the current furnished version;
- Review cycle: generate, validate, critique, and optionally revise once.

When no step-3 typology is available, the panel shows bedroom and bathroom selectors. While a request runs, only architecture actions are disabled; the rest of the editor remains usable where current state handling allows it.

Errors distinguish model failure from an invalid spatial proposal and summarize the first actionable validation issues.

## Compatibility and persistence

No new framework, database, geometry representation, catalog, or compliance engine is introduced. Existing plan snapshots remain `{ rooms, items }`, existing architecture versions remain immutable, and legacy `/api/arquitecto/*` routes keep their response shape.

## Verification

Add focused tests for:

- stable room-reference round trips;
- complete-program validation;
- deterministic furnishing of a generated layout;
- use of `designBoundary` instead of the full lot;
- critique payloads containing compact item references;
- rejection of invalid generated interiors;
- the one-revision limit;
- frontend build and the complete existing backend/frontend test suites.

