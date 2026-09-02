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
