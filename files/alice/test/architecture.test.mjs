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
