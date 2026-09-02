export function validateArchitectureLayout(layout, { planVersionId = null } = {}) {
  const findings = [];
  const rooms = Array.isArray(layout?.ambientes) ? layout.ambientes : null;
  if (!rooms) {
    findings.push({ code: "invalid_layout", severity: "critical", targetId: null, message: "layout.ambientes must be an array" });
  } else {
    if (rooms.length === 0) findings.push({ code: "empty_layout", severity: "major", targetId: null, message: "The proposal contains no environments" });
    const ids = new Set();
    rooms.forEach((room, index) => {
      const id = room?.ref_id ? String(room.ref_id) : `room_${index + 1}`;
      if (ids.has(id)) findings.push({ code: "duplicate_room_reference", severity: "major", targetId: id, message: `Duplicate room reference ${id}` });
      ids.add(id);
      const polygon = room?.poligono;
      const validPolygon = Array.isArray(polygon) && polygon.length >= 3 && polygon.every((point) =>
        Array.isArray(point) && point.length >= 2 && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1])));
      if (!validPolygon) findings.push({ code: "invalid_room_polygon", severity: "critical", targetId: id, message: `${room?.nombre || id} has invalid polygon geometry` });
    });
  }
  return {
    planVersionId,
    validator: "architecture-layout-contract@1.0.0",
    ok: findings.length === 0,
    findings,
    scope: ["layout shape", "finite polygon coordinates", "unique room references"],
    exclusions: ["RNE compliance", "municipal compliance", "accessibility", "fire", "structure", "MEP", "geometric collisions"],
  };
}
