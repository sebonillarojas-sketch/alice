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
      polygon("core-1", "core", rect(4, 0, 6, 10)),
      polygon("hall-left", "circulacion", rect(0, 4, 4, 5)),
      polygon("hall-right", "circulacion", rect(6, 4, 10, 5)),
      polygon("unit-1-part-1", "unidad", rect(0, 0, 4, 4), { unitRef: "unit-1", unitProgram: { dormitorios: 1, banos: 1 } }),
      polygon("unit-2-part-1", "unidad", rect(6, 0, 10, 4), { unitRef: "unit-2", unitProgram: { dormitorios: 2, banos: 2 } }),
      polygon("void-left", "void", rect(0, 5, 4, 10)),
      polygon("void-right", "void", rect(6, 5, 10, 10)),
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

test("fragmented unit pieces count once but are rejected before interior design", () => {
  const proposal = validProposal();
  const unit = proposal.floor.polygons.find((item) => item.polygonId === "unit-1-part-1");
  unit.polygon = rect(0, 0, 2, 4);
  proposal.floor.polygons.push(polygon("unit-1-part-2", "unidad", rect(2, 0, 4, 4), { unitRef: "unit-1", unitProgram: { dormitorios: 1, banos: 1 } }));
  const result = validateFloorProposal(proposal, options);
  assert.equal(result.stats.units, 2);
  assert.ok(result.findings.some((finding) => finding.code === "unsupported_multi_piece_unit"));

  proposal.floor.polygons.at(-1).unitProgram = { dormitorios: 3, banos: 1 };
  assert.ok(validateFloorProposal(proposal, options).findings.some((finding) => finding.code === "inconsistent_unit_program"));
});

test("disconnected pieces are rejected as unsupported unit geometry", () => {
  const proposal = validProposal();
  const unit = proposal.floor.polygons.find((item) => item.polygonId === "unit-1-part-1");
  unit.polygon = rect(0, 0, 1, 4);
  proposal.floor.polygons.push(polygon("unit-1-part-2", "unidad", rect(2, 0, 4, 4), { unitRef: "unit-1", unitProgram: { dormitorios: 1, banos: 1 } }));
  assert.ok(validateFloorProposal(proposal, options).findings.some((finding) => finding.code === "unsupported_multi_piece_unit" && finding.unitRefs.includes("unit-1")));
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

test("a unit must reach the core through the same connected circulation component", () => {
  const proposal = validProposal();
  proposal.floor.polygons.find((item) => item.polygonId === "hall-right").polygon = rect(7, 3, 10, 4);
  const result = validateFloorProposal(proposal, options);
  assert.ok(result.findings.some((finding) => finding.code === "unit_without_access" && finding.unitRefs.includes("unit-2")));
});

test("coverage gaps and self-intersecting polygons fail closed", () => {
  const gap = validProposal();
  gap.floor.polygons.find((item) => item.polygonId === "void-left").polygon = rect(0, 6, 4, 10);
  assert.ok(validateFloorProposal(gap, options).findings.some((finding) => finding.code === "incomplete_partition"));

  const bowTie = validProposal();
  bowTie.floor.polygons.find((item) => item.polygonId === "void-left").polygon = [[0, 5], [4, 10], [0, 10], [4, 5]];
  assert.ok(validateFloorProposal(bowTie, options).findings.some((finding) => finding.code === "self_intersecting_polygon"));
});

test("containment detects an edge that leaves and re-enters a concave footprint", () => {
  const concave = [[0, 0], [10, 0], [10, 2], [2, 2], [2, 4], [10, 4], [10, 6], [2, 6], [2, 8], [10, 8], [10, 10], [0, 10]];
  const proposal = {
    floor: {
      sourceCabidaVersionId: "concave-v1",
      polygons: [polygon("escaping", "void", rect(5, 1, 6, 9))],
    },
  };
  const result = validateFloorProposal(proposal, { buildableFootprint: concave, sourceCabidaVersionId: "concave-v1" });
  assert.ok(result.findings.some((finding) => finding.code === "outside_buildable_footprint"));
});

test("overlap tolerance is measured by intersection area", () => {
  const tiny = validProposal();
  tiny.floor.polygons.find((item) => item.polygonId === "hall-left").polygon = rect(0, 3.999, 4, 5);
  assert.equal(validateFloorProposal(tiny, options).findings.some((finding) => finding.code === "polygon_overlap"), false);

  const material = validProposal();
  material.floor.polygons.find((item) => item.polygonId === "hall-left").polygon = rect(0, 3.99, 4, 5);
  assert.equal(validateFloorProposal(material, options).findings.some((finding) => finding.code === "polygon_overlap"), true);
});

test("unit count, bedroom mix, and average area use explicit tolerances", () => {
  const proposal = validProposal();
  proposal.floor.polygons.find((item) => item.polygonId === "unit-2-part-1").unitProgram.dormitorios = 1;
  const result = validateFloorProposal(proposal, { ...options, unitsPerFloor: 3, targetAverageArea: 30 });
  assert.ok(result.findings.some((finding) => finding.code === "unit_count_mismatch"));
  assert.ok(result.findings.some((finding) => finding.code === "unit_mix_mismatch"));
  assert.ok(result.findings.some((finding) => finding.code === "unit_area_out_of_tolerance"));
});

test("cada unidad cumple la tolerancia de área aunque el promedio del piso coincida", () => {
  const proposal = validProposal();
  proposal.floor.polygons.find((item) => item.polygonId === "unit-1-part-1").polygon = rect(0, 0, 4, 2);
  proposal.floor.polygons.find((item) => item.polygonId === "hall-left").polygon = rect(0, 2, 4, 3);
  proposal.floor.polygons.find((item) => item.polygonId === "void-left").polygon = rect(0, 3, 4, 10);
  proposal.floor.polygons.find((item) => item.polygonId === "unit-2-part-1").polygon = rect(6, 0, 10, 6);
  proposal.floor.polygons.find((item) => item.polygonId === "hall-right").polygon = rect(6, 6, 10, 7);
  proposal.floor.polygons.find((item) => item.polygonId === "void-right").polygon = rect(6, 7, 10, 10);

  const result = validateFloorProposal(proposal, { ...options, enforceIndividualUnitArea: true });

  assert.equal(result.stats.averageUnitArea, 16);
  assert.ok(result.findings.some((finding) => finding.code === "individual_unit_area_out_of_tolerance" && finding.unitRefs.includes("unit-1")));
  assert.ok(result.findings.some((finding) => finding.code === "individual_unit_area_out_of_tolerance" && finding.unitRefs.includes("unit-2")));
});

test("las áreas individuales se comparan con la tipología de Cabida", () => {
  const proposal = validProposal();
  proposal.floor.polygons.find((item) => item.polygonId === "unit-1-part-1").polygon = rect(0, 0, 4, 2);
  proposal.floor.polygons.find((item) => item.polygonId === "hall-left").polygon = rect(0, 2, 4, 3);
  proposal.floor.polygons.find((item) => item.polygonId === "void-left").polygon = rect(0, 3, 4, 10);
  proposal.floor.polygons.find((item) => item.polygonId === "unit-2-part-1").polygon = rect(6, 0, 10, 6);
  proposal.floor.polygons.find((item) => item.polygonId === "hall-right").polygon = rect(6, 6, 10, 7);
  proposal.floor.polygons.find((item) => item.polygonId === "void-right").polygon = rect(6, 7, 10, 10);

  const result = validateFloorProposal(proposal, {
    ...options,
    enforceIndividualUnitArea: true,
    targetAreaByBedrooms: { dormitorios1: 8, dormitorios2: 24, dormitorios3: 30 },
  });

  assert.equal(result.findings.some((finding) => finding.code === "individual_unit_area_out_of_tolerance"), false);
});

test("una unidad sin frente exterior se rechaza como producto no vendible", () => {
  const proposal = validProposal();
  proposal.floor.polygons.find((item) => item.polygonId === "unit-1-part-1").polygon = rect(1, 1, 3, 3);
  proposal.floor.polygons.find((item) => item.polygonId === "hall-left").polygon = rect(0, 3, 4, 4);

  const result = validateFloorProposal(proposal, { ...options, requireExteriorFrontage: true });

  assert.ok(result.findings.some((finding) => finding.code === "unit_without_exterior_frontage" && finding.unitRefs.includes("unit-1")));
});

test("a floor requires both core and circulation roles", () => {
  const proposal = validProposal();
  proposal.floor.polygons = proposal.floor.polygons.filter((item) => !["core", "circulacion"].includes(item.role));
  const codes = validateFloorProposal(proposal, options).findings.map((finding) => finding.code);
  assert.ok(codes.includes("missing_core"));
  assert.ok(codes.includes("missing_circulation"));
});

// ── tolerancia constructiva ───────────────────────────────────────────────────
// El validador exigia EPS = 1e-7 m (0.1 micrones) para la contencion. Un vertice
// medio milimetro afuera —ruido de redondeo de packFloor o de un modelo que escribe
// coordenadas con 3 decimales— hacia rechazar la unidad entera, y con ella la planta.
// En obra, un centimetro no es un error de diseno: es la precision del replanteo.
test("un desborde de medio milimetro NO es salirse de la huella", () => {
  const huella = rect(0, 0, 20, 10);
  const res = validateFloorProposal({
    floor: { sourceCabidaVersionId: "V", polygons: [
      polygon("a", "core", [[0, 0], [10, 0], [10, 10], [0, 10]]),
      // 0.0005 m afuera en el borde derecho: ruido, no error
      polygon("b", "unidad", [[10, 0], [20.0005, 0], [20.0005, 10], [10, 10]],
        { unitRef: "u1", unitProgram: { dormitorios: 2, banos: 2 } }),
    ] },
  }, { buildableFootprint: huella, sourceCabidaVersionId: "V" });
  const codigos = res.findings.map((f) => f.code);
  assert.ok(!codigos.includes("outside_buildable_footprint"),
    `medio milimetro no debe rechazarse: ${JSON.stringify(res.findings)}`);
});

test("medio metro afuera SI se rechaza", () => {
  const huella = rect(0, 0, 20, 10);
  const res = validateFloorProposal({
    floor: { sourceCabidaVersionId: "V", polygons: [
      polygon("b", "unidad", [[10, 0], [20.5, 0], [20.5, 10], [10, 10]],
        { unitRef: "u1", unitProgram: { dormitorios: 2, banos: 2 } }),
    ] },
  }, { buildableFootprint: huella, sourceCabidaVersionId: "V" });
  assert.ok(res.findings.map((f) => f.code).includes("outside_buildable_footprint"),
    "medio metro afuera es un error real y debe marcarse");
});
