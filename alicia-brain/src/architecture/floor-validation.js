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

function segmentsIntersect(a, b, c, d) {
  if (properIntersection(a, b, c, d)) return true;
  return pointOnSegment(c, a, b) || pointOnSegment(d, a, b)
    || pointOnSegment(a, c, d) || pointOnSegment(b, c, d);
}

function isSimplePolygon(polygon) {
  const pts = points(polygon);
  if (pts.length < 3) return false;
  for (let i = 0; i < pts.length; i += 1) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    if (Math.hypot(a.x - b.x, a.y - b.y) <= EPS) return false;
    for (let j = i + 1; j < pts.length; j += 1) {
      if (j === i || j === i + 1 || (i === 0 && j === pts.length - 1)) continue;
      const c = pts[j], d = pts[(j + 1) % pts.length];
      if (segmentsIntersect(a, b, c, d)) return false;
    }
  }
  return true;
}

const signedArea = (pts) => pts.reduce((sum, point, index) => {
  const next = pts[(index + 1) % pts.length];
  return sum + point.x * next.y - next.x * point.y;
}, 0) / 2;

const pointInTriangle = (point, a, b, c) =>
  cross(a, b, point) >= -EPS && cross(b, c, point) >= -EPS && cross(c, a, point) >= -EPS;

function triangulate(polygon) {
  let pts = points(polygon);
  if (signedArea(pts) < 0) pts = [...pts].reverse();
  const indexes = pts.map((_, index) => index);
  const triangles = [];
  let guard = pts.length * pts.length;
  while (indexes.length > 3 && guard-- > 0) {
    let clipped = false;
    for (let i = 0; i < indexes.length; i += 1) {
      const before = indexes[(i - 1 + indexes.length) % indexes.length];
      const current = indexes[i];
      const after = indexes[(i + 1) % indexes.length];
      if (cross(pts[before], pts[current], pts[after]) <= EPS) continue;
      if (indexes.some((index) => index !== before && index !== current && index !== after
        && pointInTriangle(pts[index], pts[before], pts[current], pts[after]))) continue;
      triangles.push([pts[before], pts[current], pts[after]]);
      indexes.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) return [];
  }
  if (indexes.length === 3) triangles.push(indexes.map((index) => pts[index]));
  return triangles;
}

function lineIntersection(a, b, c, d) {
  const abx = b.x - a.x, aby = b.y - a.y;
  const cdx = d.x - c.x, cdy = d.y - c.y;
  const denominator = abx * cdy - aby * cdx;
  if (Math.abs(denominator) <= EPS) return b;
  const t = ((c.x - a.x) * cdy - (c.y - a.y) * cdx) / denominator;
  return { x: a.x + t * abx, y: a.y + t * aby };
}

function clipConvex(subject, clip) {
  let output = [...subject];
  for (let i = 0; i < clip.length && output.length; i += 1) {
    const c = clip[i], d = clip[(i + 1) % clip.length];
    const input = output;
    output = [];
    for (let j = 0; j < input.length; j += 1) {
      const a = input[j], b = input[(j + 1) % input.length];
      const aInside = cross(c, d, a) >= -EPS;
      const bInside = cross(c, d, b) >= -EPS;
      if (aInside && bInside) output.push(b);
      else if (aInside && !bInside) output.push(lineIntersection(a, b, c, d));
      else if (!aInside && bInside) output.push(lineIntersection(a, b, c, d), b);
    }
  }
  return output;
}

function polygonIntersectionArea(a, b) {
  if (!isSimplePolygon(a) || !isSimplePolygon(b)) return 0;
  return triangulate(a).reduce((total, triangleA) => total + triangulate(b).reduce((sum, triangleB) => {
    const clipped = clipConvex(triangleA, triangleB);
    return sum + (clipped.length >= 3 ? Math.abs(signedArea(clipped)) : 0);
  }, 0), 0);
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

function polygonsOverlap(a, b) {
  return polygonIntersectionArea(a, b) > OVERLAP_EPSILON_M2 + EPS;
}

function polygonInside(inner, outer) {
  const pts = points(inner);
  if (!pts.length || pts.some((point) => !pointInPolygon(point, outer, true))) return false;
  return edges(inner).every(([a, b]) => {
    const parameters = [0, 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    for (const [c, d] of edges(outer)) {
      const ex = d.x - c.x, ey = d.y - c.y;
      const denominator = dx * ey - dy * ex;
      if (Math.abs(denominator) > EPS) {
        const t = ((c.x - a.x) * ey - (c.y - a.y) * ex) / denominator;
        const u = ((c.x - a.x) * dy - (c.y - a.y) * dx) / denominator;
        if (t >= -EPS && t <= 1 + EPS && u >= -EPS && u <= 1 + EPS) parameters.push(Math.max(0, Math.min(1, t)));
      } else if (nearZero(cross(a, b, c)) && lengthSquared > EPS) {
        for (const point of [c, d]) {
          const t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared;
          if (t >= -EPS && t <= 1 + EPS) parameters.push(Math.max(0, Math.min(1, t)));
        }
      }
    }
    const sorted = [...new Set(parameters.map((value) => value.toFixed(9)))].map(Number).sort((x, y) => x - y);
    return sorted.slice(0, -1).every((start, index) => {
      const t = (start + sorted[index + 1]) / 2;
      return pointInPolygon({ x: a.x + dx * t, y: a.y + dy * t }, outer, true);
    });
  });
}

const finding = (code, message, polygonIds = [], unitRefs = [], severity = "major") => ({ code, severity, polygonIds, unitRefs, message });

export function validateFloorProposal(proposal = {}, options = {}) {
  const polygons = Array.isArray(proposal.floor?.polygons) ? proposal.floor.polygons : [];
  const findings = [];
  const footprint = options.buildableFootprint || [];
  const validInsidePolygons = [];

  if (proposal.floor?.sourceCabidaVersionId !== options.sourceCabidaVersionId) {
    findings.push(finding("source_version_mismatch", "La propuesta no corresponde a la versión actual de Cabida"));
  }

  for (const item of polygons) {
    if (!isSimplePolygon(item.polygon)) {
      findings.push(finding("self_intersecting_polygon", `${item.name} tiene geometría auto-intersectada`, [item.polygonId], item.unitRef ? [item.unitRef] : []));
    } else if (polygonArea(item.polygon) < OVERLAP_EPSILON_M2) {
      findings.push(finding("degenerate_polygon", `${item.name} no tiene área dibujable`, [item.polygonId], item.unitRef ? [item.unitRef] : []));
    } else if (!polygonInside(item.polygon, footprint)) {
      findings.push(finding("outside_buildable_footprint", `${item.name} sale de la huella edificable`, [item.polygonId], item.unitRef ? [item.unitRef] : []));
    } else validInsidePolygons.push(item);
  }

  const footprintArea = polygonArea(footprint);
  const coveredArea = validInsidePolygons.reduce((sum, item) => sum + polygonArea(item.polygon), 0);
  const coverageTolerance = Math.max(0.05, footprintArea * 0.001);
  if (footprintArea > 0 && footprintArea - coveredArea > coverageTolerance) {
    findings.push(finding("incomplete_partition", `La planta deja ${(footprintArea - coveredArea).toFixed(2)} m² sin asignar`));
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

  const coreConnectedHalls = new Set(circulation.filter((hall) => cores.some((core) => polygonsShareEdge(hall.polygon, core.polygon))).map((hall) => hall.polygonId));
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const hall of circulation) {
      if (coreConnectedHalls.has(hall.polygonId)) continue;
      if (circulation.some((other) => coreConnectedHalls.has(other.polygonId) && polygonsShareEdge(hall.polygon, other.polygon))) {
        coreConnectedHalls.add(hall.polygonId);
        expanded = true;
      }
    }
  }
  for (const [unitRef, unit] of units) {
    if (unit.pieces.length > 1) {
      findings.push(finding("unsupported_multi_piece_unit", `${unitRef} debe resolverse como un único polígono continuo para diseñar su interior`, unit.pieces.map((piece) => piece.polygonId), [unitRef]));
    }
    const accessible = unit.pieces.some((piece) => circulation.some((hall) => coreConnectedHalls.has(hall.polygonId) && polygonsShareEdge(piece.polygon, hall.polygon)));
    if (!accessible) findings.push(finding("unit_without_access", `${unitRef} no toca circulación común`, unit.pieces.map((piece) => piece.polygonId), [unitRef]));
    const exteriorFrontage = unit.pieces.some((piece) => polygonsShareEdge(piece.polygon, footprint));
    if (options.requireExteriorFrontage && !exteriorFrontage) findings.push(finding("unit_without_exterior_frontage", `${unitRef} no tiene frente exterior aprovechable`, unit.pieces.map((piece) => piece.polygonId), [unitRef]));
  }
  if (circulation.length && cores.length && coreConnectedHalls.size === 0) {
    findings.push(finding("circulation_without_core", "La circulación común no conecta con el core", circulation.map((item) => item.polygonId)));
  }

  const bedroomMix = { dormitorios1: 0, dormitorios2: 0, dormitorios3: 0 };
  for (const unit of units.values()) {
    const bedrooms = Number(unit.program?.dormitorios);
    if (!Number.isInteger(bedrooms) || bedrooms < 1 || bedrooms > 3) {
      findings.push(finding("invalid_unit_program", "El programa de unidad debe tener entre 1 y 3 dormitorios"));
      continue;
    }
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
  if (options.enforceIndividualUnitArea && targetArea > 0) {
    for (const [unitRef, unit] of units) {
      const bedrooms = Number(unit.program?.dormitorios);
      const typologyTarget = Number(options.targetAreaByBedrooms?.[`dormitorios${bedrooms}`]);
      const unitTarget = typologyTarget > 0 ? typologyTarget : targetArea;
      if (Math.abs(unit.area - unitTarget) / unitTarget > tolerance) {
        findings.push(finding("individual_unit_area_out_of_tolerance", `${unitRef} tiene ${unit.area.toFixed(1)} m² y no cumple el área objetivo de ${unitTarget.toFixed(1)} m² para ${bedrooms} dormitorio(s)`, unit.pieces.map((piece) => piece.polygonId), [unitRef]));
      }
    }
  }
  if (targetArea > 0 && Math.abs(averageUnitArea - targetArea) / targetArea > tolerance) {
    findings.push(finding("unit_area_out_of_tolerance", `El área promedio ${averageUnitArea.toFixed(1)} m² excede la tolerancia de ${(tolerance * 100).toFixed(0)}%`));
  }

  return {
    ok: findings.length === 0,
    findings,
    stats: { units: units.size, averageUnitArea, bedroomMix },
  };
}
