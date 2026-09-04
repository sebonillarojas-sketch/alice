import { generarDistribuciones } from "../planos/plantas.js";

const toPolygon = (pts) => pts.map((point) => [Number(point.x), Number(point.y)]);
const toPoints = (polygon) => polygon.map(([x, y]) => ({ x: Number(x), y: Number(y) }));

export function fallbackFloorProposal({ footprint, frontIdx = 0, brief = {}, sourceCabidaVersionId }) {
  const parti = generarDistribuciones(footprint, frontIdx, brief)[0];
  if (!parti?.res) throw new Error("La huella no admite una distribución determinística");
  const { core, corridors = [], corridor, units = [] } = parti.res;
  const halls = corridors.length ? corridors : (corridor ? [corridor] : []);
  const polygons = [];
  if (core) polygons.push({ polygonId: core.id, role: "core", name: "core", unitRef: null, unitProgram: null, polygon: toPolygon(core.pts) });
  halls.forEach((hall, index) => polygons.push({ polygonId: hall.id, role: "circulacion", name: `circulación ${index + 1}`, unitRef: null, unitProgram: null, polygon: toPolygon(hall.pts) }));
  units.forEach((unit) => {
    const dormitorios = Math.max(0, Number(unit.tipologia?.dorms ?? parseInt(unit.subtipo, 10) ?? 1) || 0);
    const banos = Math.max(0, Number(unit.tipologia?.banos ?? (dormitorios <= 1 ? 1 : 2)) || 0);
    polygons.push({
      polygonId: unit.id,
      role: "unidad",
      name: unit.name || `${dormitorios}D`,
      unitRef: unit.unitRef || unit.id,
      unitProgram: { dormitorios, banos },
      polygon: toPolygon(unit.pts),
    });
  });
  return {
    summary: "Respaldo determinístico de packFloor",
    floor: { sourceCabidaVersionId: String(sourceCabidaVersionId || ""), polygons },
    assumptions: [],
    tradeoffs: ["Distribución determinística utilizada como respaldo"],
  };
}

export function proposalToParti(proposal = {}) {
  const polygons = Array.isArray(proposal.floor?.polygons) ? proposal.floor.polygons : [];
  return {
    id: `floor_${proposal.floor?.sourceCabidaVersionId || "proposal"}`,
    nombre: proposal.summary || "Tweedledum",
    rooms: polygons.map((item) => ({
      id: item.polygonId,
      polygonId: item.polygonId,
      role: item.role,
      name: item.name,
      tipo: item.role === "circulacion" ? "pasillo" : item.role,
      unitRef: item.unitRef,
      unitProgram: item.unitProgram ? { ...item.unitProgram } : null,
      pts: toPoints(item.polygon),
      locked: item.role !== "unidad",
    })),
    items: [],
    notas: [proposal.summary || "Propuesta de planta típica"],
    stats: { uds: new Set(polygons.filter((item) => item.role === "unidad").map((item) => item.unitRef)).size },
  };
}
