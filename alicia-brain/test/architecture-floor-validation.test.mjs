import test from "node:test";
import assert from "node:assert/strict";
import { validateFloorProposal } from "../src/architecture/floor-validation.js";

const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const polygon = (polygonId, role, points, extras = {}) => ({
  polygonId, role, name: polygonId, unitRef: null, unitProgram: null, polygon: points, ...extras,
});

const validProposal = () => ({
  summary: "Valid floor",
  floor: {
    sourceCabidaVersionId: "cabida_p1_v3",
    polygons: [
      polygon("core-1", "core", rect(4, 4, 6, 10)),
      polygon("hall-left", "circulacion", rect(0, 4, 4, 5)),
      polygon("hall-right", "circulacion", rect(6, 4, 10, 5)),
      polygon("unit-1-part-1", "unidad", rect(0, 0, 4, 4), { unitRef: "unit-1", unitProgram: { dormitorios: 1, banos: 1 } }),
      polygon("unit-2-part-1", "unidad", rect(6, 0, 10, 4), { unitRef: "unit-2", unitProgram: { dormitorios: 2, banos: 2 } }),
    ],
  },
});

const options = {
  buildableFootprint: rect(0, 0, 10, 10),
  sourceCabidaVersionId: "cabida_p1_v3",
  unitsPerFloor: 2,
  mix: { dormitorios1: 1, dormitorios2: 1, dormitorios3: 0 },
  targetAverageArea: 16,
};

test("a non-overlapping floor with shared access edges passes", () => {
  const result = validateFloorProposal(validProposal(), options);
  assert.equal(result.ok, true, result.findings.map((finding) => finding.message).join(" · "));
  assert.deepEqual(result.stats, { units: 2, averageUnitArea: 16, bedroomMix: { dormitorios1: 1, dormitorios2: 1, dormitorios3: 0 } });
});

test("positive-area overlap fails while a shared edge remains valid", () => {
  const proposal = validProposal();
  proposal.floor.polygons.find((item) => item.polygonId === "hall-left").polygon = rect(0, 3.5, 4, 5);
  const result = validateFloorProposal(proposal, options);
  const overlap = result.findings.find((finding) => finding.code === "polygon_overlap");
  assert.deepEqual(overlap.polygonIds.sort(), ["hall-left", "unit-1-part-1"]);
});

test("geometry outside the footprint and wrong Cabida version fail closed", () => {
  const proposal = validProposal();
  proposal.floor.sourceCabidaVersionId = "cabida_old";
  proposal.floor.polygons.find((item) => item.polygonId === "unit-2-part-1").polygon = rect(6, 0, 11, 4);
  const result = validateFloorProposal(proposal, options);
  assert.ok(result.findings.some((finding) => finding.code === "source_version_mismatch"));
  assert.ok(result.findings.some((finding) => finding.code === "outside_buildable_footprint" && finding.polygonIds.includes("unit-2-part-1")));
});

test("fragmented unit pieces count once and must use a consistent program", () => {
  const proposal = validProposal();
  const unit = proposal.floor.polygons.find((item) => item.polygonId === "unit-1-part-1");
  unit.polygon = rect(0, 0, 2, 4);
  proposal.floor.polygons.push(polygon("unit-1-part-2", "unidad", rect(2, 0, 4, 4), { unitRef: "unit-1", unitProgram: { dormitorios: 1, banos: 1 } }));
  const result = validateFloorProposal(proposal, options);
  assert.equal(result.stats.units, 2);
  assert.equal(result.ok, true, result.findings.map((finding) => finding.message).join(" · "));

  proposal.floor.polygons.at(-1).unitProgram = { dormitorios: 3, banos: 1 };
  assert.ok(validateFloorProposal(proposal, options).findings.some((finding) => finding.code === "inconsistent_unit_program"));
});

test("every unit must reach circulation and circulation must reach core", () => {
  const disconnectedUnit = validProposal();
  disconnectedUnit.floor.polygons.find((item) => item.polygonId === "hall-right").polygon = rect(6, 5, 10, 6);
  assert.ok(validateFloorProposal(disconnectedUnit, options).findings.some((finding) => finding.code === "unit_without_access" && finding.unitRefs.includes("unit-2")));

  const disconnectedCore = validProposal();
  disconnectedCore.floor.polygons = disconnectedCore.floor.polygons.filter((item) => item.polygonId !== "hall-right");
  disconnectedCore.floor.polygons.find((item) => item.polygonId === "hall-left").polygon = rect(0, 4, 3, 5);
  assert.ok(validateFloorProposal(disconnectedCore, options).findings.some((finding) => finding.code === "circulation_without_core"));
});

test("unit count, bedroom mix, and average area use explicit tolerances", () => {
  const proposal = validProposal();
  proposal.floor.polygons.find((item) => item.polygonId === "unit-2-part-1").unitProgram.dormitorios = 1;
  const result = validateFloorProposal(proposal, { ...options, unitsPerFloor: 3, targetAverageArea: 30 });
  assert.ok(result.findings.some((finding) => finding.code === "unit_count_mismatch"));
  assert.ok(result.findings.some((finding) => finding.code === "unit_mix_mismatch"));
  assert.ok(result.findings.some((finding) => finding.code === "unit_area_out_of_tolerance"));
});

test("a floor requires both core and circulation roles", () => {
  const proposal = validProposal();
  proposal.floor.polygons = proposal.floor.polygons.filter((item) => !["core", "circulacion"].includes(item.role));
  const codes = validateFloorProposal(proposal, options).findings.map((finding) => finding.code);
  assert.ok(codes.includes("missing_core"));
  assert.ok(codes.includes("missing_circulation"));
});
