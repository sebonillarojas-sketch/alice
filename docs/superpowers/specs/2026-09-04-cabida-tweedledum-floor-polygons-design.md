# Cabida-Originated Tweedledum Floor Polygons

## Goal

Move the origin of typical-floor geometry into Cabida. From the buildable footprint and product brief, Tweedledum proposes a complete non-overlapping partition of units, core, circulation, and voids. The existing deterministic `packFloor` engine remains an automatic fallback, not the primary designer.

Planos consumes the selected Cabida proposal. It may subdivide each `unidad` polygon into its residential interior, but it must preserve core, circulation, and void polygons without redesigning them.

## Current problem

Today Cabida calculates commercial and dimensional feasibility, while `generarDistribuciones`/`packFloor` creates core, corridor, and unit blocks later in Planos. The current `packFloor` representation allows the core polygon to cross the corridor polygon. When Tweedledum subsequently redesigns the whole editor canvas, it receives infrastructure and apartment interiors in one undifferentiated room list. This creates two failure modes:

- infrastructure polygons are interpreted as ordinary rooms;
- the model redraws core, circulation, and apartment interiors together, producing ambiguous or genuinely overlapping geometry.

The desired fix is to establish one owner for each level of geometry instead of adding more overlap exceptions.

## Chosen approach

Use a staged hybrid workflow:

1. Cabida owns the buildable footprint and product program.
2. Tweedledum proposes the typical-floor zoning polygons.
3. ALICE validates the proposal deterministically.
4. If invalid, Tweedledum receives the exact deterministic findings and may revise once.
5. If the revision remains invalid or the model call fails, ALICE immediately uses `packFloor` and labels the result as a deterministic fallback.
6. The user selects or accepts the resulting proposal and sends it to Planos.
7. Planos preserves infrastructure and subdivides only unit polygons into interiors.

The action is manual. Tweedledum is not invoked whenever a Cabida input changes.

## Cabida interaction

Cabida adds a **Proponer planta con Tweedledum** action next to the typical-floor preview. Pressing it sends the current normalized inputs:

- parcel and buildable footprint polygons;
- front-edge index and lot type;
- setbacks already applied to the buildable footprint;
- units per floor;
- target average unit area;
- one-, two-, and three-bedroom mix;
- selected or derived unit typologies and bathroom counts when available;
- known locked elements or project constraints;
- exact Cabida/project version reference.

While the request runs, the action shows progress and cannot be invoked twice. Editing Cabida remains local and fast. A result card reports whether the proposal came from Tweedledum, a Tweedledum revision, or the deterministic fallback.

Accepting the proposal stores it in the active project's Cabida/plano bridge and opens or updates Planos through the existing project store. Regeneration creates a new proposal version instead of silently overwriting an accepted plan.

## Geometry contract

The Cabida floor proposal uses a dedicated structured contract rather than pretending infrastructure polygons are residential `ambientes`:

```json
{
  "summary": "string",
  "floor": {
    "sourceCabidaVersionId": "cabida_p1_v3",
    "polygons": [
      {
        "polygonId": "core-1",
        "role": "core",
        "name": "core",
        "unitRef": null,
        "unitProgram": null,
        "polygon": [[0, 0], [3, 0], [3, 8], [0, 8]]
      },
      {
        "polygonId": "unit-1-part-1",
        "role": "unidad",
        "name": "Tipo B",
        "unitRef": "unit-1",
        "unitProgram": { "dormitorios": 2, "banos": 2 },
        "polygon": [[3, 0], [9, 0], [9, 8], [3, 8]]
      }
    ]
  },
  "assumptions": [],
  "tradeoffs": []
}
```

Allowed roles are:

- `unidad`: exclusive apartment footprint to be subdivided later;
- `core`: vertical circulation/service infrastructure;
- `circulacion`: common horizontal access;
- `void`: non-occupiable light well, shaft, or deliberate opening.

Every polygon has a unique stable `polygonId`, a role, a non-empty name, and at least three finite coordinates. Unit polygons also carry a stable `unitRef` and their own program. One unit may use multiple polygon pieces with distinct `polygonId` values and the same `unitRef`; all other roles use a null `unitRef`. Core and circulation are never encoded as apartments or ordinary interior rooms.

## Deterministic validation

Before the proposal can be accepted, ALICE verifies:

- every polygon is drawable, non-degenerate, and inside the buildable footprint;
- no two proposal polygons materially overlap, including core and circulation;
- the partition contains at least one unit and an access system;
- every unit touches circulation or an explicitly modeled access edge;
- circulation reaches the core;
- the unit count matches the Cabida request;
- the aggregate unit mix and areas remain within explicit tolerances of the product brief;
- polygon IDs are unique and unit references resolve consistently;
- the proposal references the current Cabida version.

`void` polygons are exclusive cut-outs at this stage, not overlays. If a light well occupies area inside a unit envelope, the surrounding unit polygon must be clipped or represented as multiple non-overlapping polygon pieces sharing one `unitRef`. This removes the ambiguity that caused the earlier validation exceptions.

The validator returns structured findings mapped to polygon references. It does not claim RNE or municipal compliance. Regulatory observations remain advisory unless backed by the verified evidence mechanism already present in the architecture subsystem.

## Revision and fallback

Tweedledum receives a compact schema, the Cabida context, and no furniture. The normal path uses one model call.

If deterministic validation fails, the service sends the proposal plus only the validation findings to Tweedledum for one revision. A second invalid result, timeout, malformed response, or unavailable model triggers `packFloor` immediately. The fallback adapter converts the output into the same floor-proposal contract and subtracts the core footprint from circulation, splitting the corridor into separate polygon pieces when necessary. It must not preserve the current core/circulation overlay. The converted fallback passes through the same validator.

If the deterministic fallback itself fails, ALICE preserves the previous accepted proposal and shows the actionable error. It never replaces project geometry with an invalid result.

## Planos consumption

The accepted floor proposal becomes the source version for Planos:

- `core`, `circulacion`, and `void` polygons are locked infrastructure;
- each `unidad` is an independent design boundary with its own program;
- Tweedledum interior design runs per unit, not against the whole typical floor;
- the existing local furnishing engine materializes doors, windows, sanitary fixtures, and furniture after each unit subdivision;
- common circulation and core remain unchanged across interior revisions;
- findings retain polygon and unit references across Cabida and Planos versions.

For initial delivery, unit interiors may be processed sequentially to respect the existing request model and avoid uncontrolled parallel model spend. The UI can apply completed valid units together as one new plan version. If any unit fails both design and one revision, its source unit envelope remains visible and is identified as pending interior design rather than corrupting the rest of the floor.

## Services and endpoints

Extend the existing architecture subsystem instead of introducing a framework:

- add a versioned Cabida floor-planning prompt for Tweedledum;
- add input/output normalization and the floor-proposal schema;
- add a deterministic floor validator in the existing geometry layer;
- expose one minimal `POST /api/architecture/tweedledum/floor-plan` endpoint;
- keep existing design, revise, critique, and review-cycle endpoints compatible;
- store prompt content server-side and expose only prompt version metadata.

The endpoint returns the original proposal, optional revision, validation result, selected valid result, and `source: "tweedledum" | "revision" | "deterministic_fallback"`.

## Persistence and version references

The active project stores immutable floor-proposal records alongside existing Cabida and architecture data:

- proposal ID and version;
- source Cabida version ID;
- parent proposal ID;
- generation source;
- prompt version and model metadata when applicable;
- validated floor contract;
- created timestamp;
- deterministic findings and fallback reason when applicable.

The existing local-first project store and Supabase state synchronization remain unchanged in architecture. No new database is introduced.

## Performance

- Generation is user-triggered, never tied to every Cabida keystroke.
- Payloads contain only compact polygons, numeric program data, and references.
- The normal path makes one model call; the repair path makes at most two.
- Furniture and detailed apartment interiors are excluded from Cabida floor planning.
- `packFloor` supplies an immediate local fallback.
- Planos reuses accepted infrastructure instead of asking the model to redraw the entire floor.

## Compatibility and migration

Existing projects without an accepted Cabida floor proposal continue using the current Planos workflow and `packFloor`. Existing architecture versions remain readable. Once a project accepts a Cabida-originated proposal, Planos prefers it and treats its infrastructure as locked.

The pending local commit that adds one conditional Tweedledum interior revision remains compatible: it applies inside an individual unit boundary after this change.

## Testing

Add focused tests for:

- schema normalization and rejection of missing roles/references;
- non-overlap of core, circulation, units, and voids;
- connectivity from every unit through circulation to core;
- Cabida version mismatch;
- unit count, area, and mix validation;
- exactly one model revision after an invalid proposal;
- deterministic fallback selection and labeling;
- persistence and round-trip into the project store;
- Planos locking infrastructure and subdividing only units;
- existing architecture endpoints, frontend suites, and production build.
