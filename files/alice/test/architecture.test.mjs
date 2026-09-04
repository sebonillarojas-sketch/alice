import test from "node:test";
import assert from "node:assert/strict";
import {
  applyPlanVersion,
  architectureDesignReadiness,
  createActivatedPlanVersion,
  createPlanVersion,
  mapFindingLocation,
  serializeValidation,
} from "../src/modules/planos/architecture.js";
import * as interior from "../src/modules/planos/feyd.js";
import * as architectureApi from "../src/modules/planos/architecture.js";
import { fallbackFloorProposal, proposalToParti } from "../src/modules/cabida/floorProposal.js";

const square = (x0, y0, x1, y1) => [
  { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 },
];

const completeLayout = {
  ambientes: [
    { nombre: "sala comedor", ref_id: "social", poligono: [[0, 0], [4, 0], [4, 4], [0, 4]] },
    { nombre: "cocina", ref_id: "kitchen", poligono: [[4, 0], [8, 0], [8, 4], [4, 4]] },
    { nombre: "dormitorio principal", ref_id: "bedroom", poligono: [[0, 4], [5, 4], [5, 8], [0, 8]] },
    { nombre: "baño 1", ref_id: "bathroom", poligono: [[5, 4], [8, 4], [8, 8], [5, 8]] },
  ],
};

test("Tweedledum can start from an empty canvas when project dimensions exist", () => {
  assert.deepEqual(
    architectureDesignReadiness({ rooms: [], boundary: null, areaTarget: 60 }),
    { ok: true, reason: null },
  );
  assert.equal(architectureDesignReadiness({ rooms: [], boundary: null, areaTarget: 0 }).ok, false);
});

test("a generated version becomes the active drawable canvas immediately", () => {
  const generated = createActivatedPlanVersion([], {
    projectId: "p1",
    parentVersionId: null,
    createdBy: "tweedledum",
    snapshot: { rooms: [{ id: "room_new", pts: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }] }], items: [] },
    now: "2026-09-02T12:00:00.000Z",
  });

  assert.equal(generated.activeVersionId, "plan_p1_v1");
  assert.equal(generated.snapshot.rooms[0].id, "room_new");
  assert.equal(generated.history.length, 1);
});

test("new plan versions preserve their parent snapshot", () => {
  const history = [{ id: "v1", version: 1, snapshot: { rooms: [{ id: "r1" }], items: [] } }];
  const next = createPlanVersion(history, {
    projectId: "p1",
    parentVersionId: "v1",
    createdBy: "tweedledum",
    snapshot: { rooms: [{ id: "r2" }], items: [] },
    now: "2026-09-01T12:00:00.000Z",
  });
  assert.equal(next.version.id, "plan_p1_v2");
  assert.equal(next.version.parentVersionId, "v1");
  assert.equal(next.version.label, "V02");
  assert.deepEqual(history[0].snapshot.rooms, [{ id: "r1" }]);
  next.version.snapshot.rooms[0].id = "changed";
  assert.equal(history[0].snapshot.rooms[0].id, "r1");
});

test("deterministic validation becomes serializable findings", () => {
  const value = serializeValidation({
    ok: false,
    total: 3,
    fueraLote: [{ id: "r1", tipo: "ambiente", name: "sala" }],
    sinPiso: [{ id: "i1", name: "sofá" }],
    aislados: [{ id: "r2", name: "dormitorio" }],
    ids: new Set(["r1", "i1", "r2"]),
    mensajes: ["3 problemas"],
  });
  assert.deepEqual(value.findings[0], { code: "outside_boundary", severity: "major", targetType: "room", targetId: "r1", message: "sala está fuera del terreno" });
  assert.equal(value.findings.length, 3);
  assert.equal(JSON.stringify(value).includes("Set"), false);
});

test("finding maps to an existing room and ignores missing references", () => {
  const rooms = [{ id: "r1", name: "sala" }];
  const items = [{ id: "i1", ref: "sofa" }];
  assert.deepEqual(mapFindingLocation({ location: { roomId: "r1", itemId: null, point: { x: 2, y: 3 } } }, rooms, items), { targetType: "room", targetId: "r1", label: "sala", point: { x: 2, y: 3 } });
  assert.deepEqual(mapFindingLocation({ location: { roomId: "missing", itemId: null, point: null } }, rooms, items), { targetType: null, targetId: null, label: "Sin ubicación", point: null });
});

test("applying a version returns a cloned snapshot without deleting history", () => {
  const history = [{ id: "v1", snapshot: { rooms: [{ id: "r1" }], items: [] } }, { id: "v2", snapshot: { rooms: [{ id: "r2" }], items: [] } }];
  const applied = applyPlanVersion(history, "v2");
  assert.equal(applied.activeVersionId, "v2");
  assert.equal(applied.history.length, 2);
  applied.snapshot.rooms[0].id = "changed";
  assert.equal(history[1].snapshot.rooms[0].id, "r2");
});

test("architecture room references survive a layout round trip", () => {
  const layout = interior.roomsALayout([{ id: "room-social", name: "sala", pts: square(0, 0, 4, 4) }]);
  assert.equal(layout.ambientes[0].ref_id, "room-social");
  assert.equal(interior.layoutARooms(layout)[0].id, "room-social");
});

test("architecture program uses explicit controls before room inference", () => {
  assert.equal(typeof interior.resolveArchitectureProgram, "function");
  assert.deepEqual(
    interior.resolveArchitectureProgram({ architectureDormitorios: 3, architectureBanos: 2, nse: "B" }, [{ name: "dormitorio" }]),
    { dormitorios: 3, banos: 2, nse: "B", cocina: "abierta", lavanderia: true, banoVisita: false },
  );
});

test("materialized Tweedledum layouts contain native interior assets", () => {
  assert.equal(typeof interior.materializeInteriorLayout, "function");
  const result = interior.materializeInteriorLayout(completeLayout, {
    boundary: square(0, 0, 8, 8),
    program: { dormitorios: 1, banos: 1, nse: "C" },
  });
  assert.equal(result.validation.ok, true, result.validation.messages?.join(" · "));
  assert.ok(result.items.some((item) => item.ref.startsWith("puerta-")));
  assert.ok(result.items.some((item) => item.ref.startsWith("ventana-")));
  assert.ok(result.items.some((item) => item.ref.startsWith("cama-")));
  assert.ok(result.items.some((item) => item.ref === "inodoro"));
});

test("generated interiors reject incomplete residential programs", () => {
  assert.equal(typeof interior.materializeInteriorLayout, "function");
  const result = interior.materializeInteriorLayout({ ambientes: completeLayout.ambientes.slice(0, 2) }, {
    boundary: square(0, 0, 8, 8),
    program: { dormitorios: 1, banos: 1, nse: "C" },
  });
  assert.equal(result.validation.ok, false);
  assert.deepEqual(result.validation.findings.map((finding) => finding.code), ["missing_bedrooms", "missing_bathrooms"]);
});

test("infrastructure and daylight overlays do not count as room overlaps", () => {
  const layout = {
    ambientes: [
      { nombre: "core", ref_id: "core", tipo: "core", poligono: [[0, 0], [2, 0], [2, 8], [0, 8]] },
      { nombre: "corredor", ref_id: "corridor", tipo: "pasillo", poligono: [[0, 3], [8, 3], [8, 4], [0, 4]] },
      { nombre: "sala", ref_id: "social", poligono: [[2, 0], [5, 0], [5, 3], [2, 3]] },
      { nombre: "cocina", ref_id: "kitchen", poligono: [[5, 0], [8, 0], [8, 3], [5, 3]] },
      { nombre: "baño 1", ref_id: "bath", poligono: [[2, 4], [5, 4], [5, 8], [2, 8]] },
      { nombre: "luz cenital", ref_id: "skylight", poligono: [[3, 5], [4, 5], [4, 6], [3, 6]] },
    ],
  };
  const rooms = interior.layoutARooms(layout);
  assert.equal(rooms.find((room) => room.id === "skylight").tipo, "void");
  const validation = interior.validateGeneratedInterior({ rooms, boundary: square(0, 0, 8, 8), program: { dormitorios: 0, banos: 1 } });
  assert.equal(validation.findings.some((finding) => finding.code === "overlapping_rooms"), false);
});

test("occupiable rooms still fail when they materially overlap", () => {
  const rooms = interior.layoutARooms({ ambientes: [
    { nombre: "sala", ref_id: "social", poligono: [[0, 0], [5, 0], [5, 4], [0, 4]] },
    { nombre: "cocina", ref_id: "kitchen", poligono: [[4, 0], [8, 0], [8, 4], [4, 4]] },
  ] });
  const validation = interior.validateGeneratedInterior({ rooms, boundary: square(0, 0, 8, 8), program: { dormitorios: 0, banos: 0 } });
  assert.equal(validation.findings.some((finding) => finding.code === "overlapping_rooms"), true);
});

test("an invalid Tweedledum interior gets exactly one targeted revision", async () => {
  assert.equal(typeof interior.materializeWithOneRevision, "function");
  const invalidLayout = {
    ambientes: [
      { nombre: "sala", ref_id: "social", poligono: [[0, 0], [4, 0], [4, 3], [0, 3]] },
      { nombre: "cocina", ref_id: "kitchen", poligono: [[4, 0], [8, 0], [8, 3], [4, 3]] },
      { nombre: "dormitorio principal", ref_id: "bedroom", poligono: [[0, 3], [6, 3], [6, 8], [0, 8]] },
      { nombre: "baño 1", ref_id: "bath-1", poligono: [[4, 3], [6, 3], [6, 5.5], [4, 5.5]] },
      { nombre: "baño 2", ref_id: "bath-2", poligono: [[6, 3], [8, 3], [8, 5.5], [6, 5.5]] },
      { nombre: "pasillo", ref_id: "hall", poligono: [[4, 5.5], [8, 5.5], [8, 8], [4, 8]] },
    ],
  };
  const correctedLayout = {
    ambientes: invalidLayout.ambientes.map((room) => room.ref_id === "bedroom"
      ? { ...room, poligono: [[0, 3], [4, 3], [4, 8], [0, 8]] }
      : room),
  };
  let revisions = 0;
  const result = await interior.materializeWithOneRevision({
    layout: invalidLayout,
    boundary: square(0, 0, 8, 8),
    program: { dormitorios: 1, banos: 2, nse: "C" },
    revise: async (findings) => {
      revisions += 1;
      assert.ok(findings.some((finding) => finding.code === "overlapping_rooms"));
      return { layout: correctedLayout };
    },
  });
  assert.equal(revisions, 1);
  assert.equal(result.repaired, true);
  assert.equal(result.generated.validation.ok, true, result.generated.validation.messages.join(" · "));
});

test("a valid Tweedledum interior avoids the revision call", async () => {
  assert.equal(typeof interior.materializeWithOneRevision, "function");
  const result = await interior.materializeWithOneRevision({
    layout: completeLayout,
    boundary: square(0, 0, 8, 8),
    program: { dormitorios: 1, banos: 1, nse: "C" },
    revise: async () => assert.fail("valid geometry must not be revised"),
  });
  assert.equal(result.repaired, false);
  assert.equal(result.generated.validation.ok, true);
});

test("architecture context distinguishes the lot from the design boundary", () => {
  assert.equal(typeof architectureApi.buildArchitectureContext, "function");
  const lotBoundary = square(0, 0, 12, 12);
  const designBoundary = square(2, 2, 10, 10);
  const context = architectureApi.buildArchitectureContext({
    project: { id: "p1", name: "Casa" }, brief: { nse: "C" }, lotBoundary, designBoundary,
    sourcePlanVersionId: "v2", program: { dormitorios: 2, banos: 1 },
  });
  assert.deepEqual(context.site.lotBoundary, lotBoundary);
  assert.deepEqual(context.site.designBoundary, designBoundary);
  assert.deepEqual(context.brief.program, { dormitorios: 2, banos: 1 });
  assert.equal(context.sourcePlanVersionId, "v2");
});

test("critique layout contains compact native item references", () => {
  assert.equal(typeof interior.planALayout, "function");
  const layout = interior.planALayout(
    [{ id: "r1", name: "sala", pts: square(0, 0, 4, 4) }],
    [{ id: "i1", ref: "sofa-2c", x: 2, y: 2, rot: 90, w: 1.6, d: 0.9, selected: true }],
  );
  assert.deepEqual(layout.items, [{ id: "i1", ref: "sofa-2c", x: 2, y: 2, rot: 90, w: 1.6, d: 0.9 }]);
});

test("packFloor fallback emits exclusive core and circulation polygons", () => {
  const proposal = fallbackFloorProposal({
    footprint: square(0, 0, 14, 12),
    frontIdx: 0,
    brief: { udsPiso: 4, pct1: 50, pct2: 50, areaObjetivo: 24 },
    sourceCabidaVersionId: "cabida_p1_v4",
  });
  assert.equal(proposal.floor.sourceCabidaVersionId, "cabida_p1_v4");
  const ids = proposal.floor.polygons.map((item) => item.polygonId);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(proposal.floor.polygons.filter((item) => item.role === "unidad").map((item) => item.unitRef)).size, 4);

  const boxes = (item) => {
    const xs = item.polygon.map(([x]) => x), ys = item.polygon.map(([, y]) => y);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  };
  const core = proposal.floor.polygons.find((item) => item.role === "core");
  for (const hall of proposal.floor.polygons.filter((item) => item.role === "circulacion")) {
    const a = boxes(core), b = boxes(hall);
    const overlapArea = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX))
      * Math.max(0, Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY));
    assert.equal(overlapArea, 0);
  }
});

test("floor proposal preview preserves polygon and unit metadata", () => {
  const proposal = fallbackFloorProposal({
    footprint: square(0, 0, 14, 12), frontIdx: 0,
    brief: { udsPiso: 2, pct1: 50, pct2: 50, areaObjetivo: 36 },
    sourceCabidaVersionId: "cabida_p1_v5",
  });
  const parti = proposalToParti(proposal);
  const unit = parti.rooms.find((room) => room.role === "unidad");
  assert.ok(unit.polygonId);
  assert.ok(unit.unitRef);
  assert.ok(Number.isInteger(unit.unitProgram.dormitorios));
  assert.deepEqual(unit.pts[0], { x: proposal.floor.polygons.find((item) => item.polygonId === unit.polygonId).polygon[0][0], y: proposal.floor.polygons.find((item) => item.polygonId === unit.polygonId).polygon[0][1] });
});
