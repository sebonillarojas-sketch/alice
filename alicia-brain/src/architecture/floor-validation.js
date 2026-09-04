const EPS = 1e-7;
export const AREA_TOLERANCE = 0.20;
export const OVERLAP_EPSILON_M2 = 0.01;
const MIN_SHARED_EDGE_M = 0.05;

const asPoint = ([x, y]) => ({ x: Number(x), y: Number(y) });
const points = (polygon) => (Array.isArray(polygon) ? polygon.map(asPoint) : []);
const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const nearZero = (value) => Math.abs(value) <= EPS;

function polygonArea(polygon) {
  const pts = points(polygon);
  return Math.abs(pts.reduce((sum, point, index) => {
    const next = pts[(index + 1) % pts.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0)) / 2;
}

function pointOnSegment(point, a, b) {
  if (!nearZero(cross(a, b, point))) return false;
  return point.x >= Math.min(a.x, b.x) - EPS && point.x <= Math.max(a.x, b.x) + EPS
    && point.y >= Math.min(a.y, b.y) - EPS && point.y <= Math.max(a.y, b.y) + EPS;
}

function pointInPolygon(point, polygon, includeBoundary = true) {
  const pts = points(polygon);
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[j], b = pts[i];
    if (pointOnSegment(point, a, b)) return includeBoundary;
    if ((b.y > point.y) !== (a.y > point.y)
      && point.x < ((a.x - b.x) * (point.y - b.y)) / (a.y - b.y) + b.x) inside = !inside;
  }
  return inside;
}

function edges(polygon) {
  const pts = points(polygon);
  return pts.map((point, index) => [point, pts[(index + 1) % pts.length]]);
}

function properIntersection(a, b, c, d) {
  const abC = cross(a, b, c), abD = cross(a, b, d);
  const cdA = cross(c, d, a), cdB = cross(c, d, b);
  return ((abC > EPS && abD < -EPS) || (abC < -EPS && abD > EPS))
    && ((cdA > EPS && cdB < -EPS) || (cdA < -EPS && cdB > EPS));
}

function sharedCollinearLength(a, b, c, d) {
  if (!nearZero(cross(a, b, c)) || !nearZero(cross(a, b, d))) return 0;
  const useX = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
  const [a0, a1] = useX ? [a.x, b.x] : [a.y, b.y];
  const [c0, c1] = useX ? [c.x, d.x] : [c.y, d.y];
  return Math.max(0, Math.min(Math.max(a0, a1), Math.max(c0, c1)) - Math.max(Math.min(a0, a1), Math.min(c0, c1)));
}

function polygonsShareEdge(a, b) {
  return edges(a).some(([a0, a1]) => edges(b).some(([b0, b1]) => sharedCollinearLength(a0, a1, b0, b1) >= MIN_SHARED_EDGE_M));
}

function centroid(polygon) {
  const pts = points(polygon);
  return pts.reduce((sum, point) => ({ x: sum.x + point.x / pts.length, y: sum.y + point.y / pts.length }), { x: 0, y: 0 });
}

function interiorProbes(polygon) {
  const center = centroid(polygon);
  return points(polygon).map((point) => ({
    x: point.x * 0.999 + center.x * 0.001,
    y: point.y * 0.999 + center.y * 0.001,
  }));
}

function polygonsOverlap(a, b) {
  if (polygonArea(a) < OVERLAP_EPSILON_M2 || polygonArea(b) < OVERLAP_EPSILON_M2) return false;
  if (edges(a).some(([a0, a1]) => edges(b).some(([b0, b1]) => properIntersection(a0, a1, b0, b1)))) return true;
  if (points(a).some((point) => pointInPolygon(point, b, false))) return true;
  if (points(b).some((point) => pointInPolygon(point, a, false))) return true;
  if (interiorProbes(a).some((point) => pointInPolygon(point, b, false))) return true;
  if (interiorProbes(b).some((point) => pointInPolygon(point, a, false))) return true;
  return pointInPolygon(centroid(a), b, false) || pointInPolygon(centroid(b), a, false);
}

function polygonInside(inner, outer) {
  const pts = points(inner);
  if (!pts.length || pts.some((point) => !pointInPolygon(point, outer, true))) return false;
  return edges(inner).every(([a, b]) => pointInPolygon({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, outer, true));
}

const finding = (code, message, polygonIds = [], unitRefs = [], severity = "major") => ({ code, severity, polygonIds, unitRefs, message });

export function validateFloorProposal(proposal = {}, options = {}) {
  const polygons = Array.isArray(proposal.floor?.polygons) ? proposal.floor.polygons : [];
  const findings = [];
  const footprint = options.buildableFootprint || [];

  if (proposal.floor?.sourceCabidaVersionId !== options.sourceCabidaVersionId) {
    findings.push(finding("source_version_mismatch", "La propuesta no corresponde a la versión actual de Cabida"));
  }

  for (const item of polygons) {
    if (polygonArea(item.polygon) < OVERLAP_EPSILON_M2) {
      findings.push(finding("degenerate_polygon", `${item.name} no tiene área dibujable`, [item.polygonId], item.unitRef ? [item.unitRef] : []));
    } else if (!polygonInside(item.polygon, footprint)) {
      findings.push(finding("outside_buildable_footprint", `${item.name} sale de la huella edificable`, [item.polygonId], item.unitRef ? [item.unitRef] : []));
    }
  }

  for (let i = 0; i < polygons.length; i += 1) {
    for (let j = i + 1; j < polygons.length; j += 1) {
      if (polygonsOverlap(polygons[i].polygon, polygons[j].polygon)) {
        findings.push(finding("polygon_overlap", `${polygons[i].name} se superpone con ${polygons[j].name}`, [polygons[i].polygonId, polygons[j].polygonId], [polygons[i].unitRef, polygons[j].unitRef].filter(Boolean)));
      }
    }
  }

  const cores = polygons.filter((item) => item.role === "core");
  const circulation = polygons.filter((item) => item.role === "circulacion");
  if (!cores.length) findings.push(finding("missing_core", "La planta no contiene core"));
  if (!circulation.length) findings.push(finding("missing_circulation", "La planta no contiene circulación común"));

  const units = new Map();
  for (const item of polygons.filter((candidate) => candidate.role === "unidad")) {
    const current = units.get(item.unitRef) || { pieces: [], program: item.unitProgram, area: 0 };
    if (current.program?.dormitorios !== item.unitProgram?.dormitorios || current.program?.banos !== item.unitProgram?.banos) {
      findings.push(finding("inconsistent_unit_program", `${item.unitRef} tiene programas incompatibles entre piezas`, [item.polygonId], [item.unitRef]));
    }
    current.pieces.push(item);
    current.area += polygonArea(item.polygon);
    units.set(item.unitRef, current);
  }

  for (const [unitRef, unit] of units) {
    const accessible = unit.pieces.some((piece) => circulation.some((hall) => polygonsShareEdge(piece.polygon, hall.polygon)));
    if (!accessible) findings.push(finding("unit_without_access", `${unitRef} no toca circulación común`, unit.pieces.map((piece) => piece.polygonId), [unitRef]));
  }
  if (circulation.length && cores.length && !circulation.some((hall) => cores.some((core) => polygonsShareEdge(hall.polygon, core.polygon)))) {
    findings.push(finding("circulation_without_core", "La circulación común no conecta con el core", circulation.map((item) => item.polygonId)));
  }

  const bedroomMix = { dormitorios1: 0, dormitorios2: 0, dormitorios3: 0 };
  for (const unit of units.values()) {
    const bedrooms = Math.max(1, Math.min(3, Number(unit.program?.dormitorios) || 1));
    bedroomMix[`dormitorios${bedrooms}`] += 1;
  }
  const unitAreas = [...units.values()].map((unit) => unit.area);
  const averageUnitArea = unitAreas.length ? unitAreas.reduce((sum, value) => sum + value, 0) / unitAreas.length : 0;
  const expectedUnits = Number(options.unitsPerFloor);
  if (Number.isFinite(expectedUnits) && units.size !== expectedUnits) {
    findings.push(finding("unit_count_mismatch", `La propuesta contiene ${units.size} unidades y Cabida solicita ${expectedUnits}`));
  }
  if (options.mix && [1, 2, 3].some((bedrooms) => bedroomMix[`dormitorios${bedrooms}`] !== Number(options.mix[`dormitorios${bedrooms}`] || 0))) {
    findings.push(finding("unit_mix_mismatch", "La mezcla de dormitorios no coincide con Cabida", [], [...units.keys()]));
  }
  const targetArea = Number(options.targetAverageArea);
  const tolerance = Number.isFinite(options.areaTolerance) ? options.areaTolerance : AREA_TOLERANCE;
  if (targetArea > 0 && Math.abs(averageUnitArea - targetArea) / targetArea > tolerance) {
    findings.push(finding("unit_area_out_of_tolerance", `El área promedio ${averageUnitArea.toFixed(1)} m² excede la tolerancia de ${(tolerance * 100).toFixed(0)}%`));
  }

  return {
    ok: findings.length === 0,
    findings,
    stats: { units: units.size, averageUnitArea, bedroomMix },
  };
}
