import { generarDistribuciones } from "../planos/plantas.js";
import { clipPieces } from "../planos/clipFootprint.js";
import { orientedFrame } from "../planos/geometry.js";
import { normalizarParti } from "../planos/partiNormalizar.js";

const toPolygon = (pts) => pts.map((point) => [Number(point.x), Number(point.y)]);
const toPoints = (polygon) => polygon.map(([x, y]) => ({ x: Number(x), y: Number(y) }));
const clone = (value) => structuredClone(value);
const safeId = (value) => String(value || "project").replace(/[^a-zA-Z0-9_-]/g, "_");

export function cabidaVersionId(projectId, inputs = {}) {
  const source = JSON.stringify(inputs);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `cabida_${safeId(projectId)}_${(hash >>> 0).toString(36)}`;
}

export function appendFloorProposalRecord(project = {}, result = {}, { now = new Date().toISOString() } = {}) {
  const existing = Array.isArray(project.cabida?.floorProposals) ? project.cabida.floorProposals : [];
  const version = existing.reduce((max, item) => Math.max(max, Number(item.version) || 0), 0) + 1;
  const selected = result.selected || {};
  const record = {
    id: `floor_${safeId(project.id)}_v${version}`,
    version,
    sourceCabidaVersionId: String(selected.floor?.sourceCabidaVersionId || ""),
    parentProposalId: existing.at(-1)?.id || null,
    source: String(result.source || "tweedledum"),
    promptVersion: result.promptVersion ? String(result.promptVersion) : null,
    model: result.model ? String(result.model) : null,
    summary: String(selected.summary || ""),
    floor: clone(selected.floor || { sourceCabidaVersionId: "", polygons: [] }),
    validation: clone(result.validation || { ok: false, findings: [] }),
    candidateValidation: clone(result.candidateValidation || null),
    evaluation: clone(result.evaluation || null),
    candidateEvaluation: clone(result.candidateEvaluation || null),
    fallbackReason: result.fallbackReason ? String(result.fallbackReason) : null,
    createdAt: typeof now === "string" ? now : new Date(now).toISOString(),
  };
  return {
    record,
    project: {
      ...clone(project),
      cabida: { ...clone(project.cabida || {}), floorProposals: [...existing.map(clone), record] },
    },
  };
}

export function acceptFloorProposalRecord(project = {}, proposalId) {
  const proposals = Array.isArray(project.cabida?.floorProposals) ? project.cabida.floorProposals : [];
  const record = proposals.find((item) => item.id === proposalId);
  if (!record) throw new Error(`Floor proposal ${proposalId} not found`);
  return {
    ...clone(project),
    cabida: { ...clone(project.cabida || {}), activeFloorProposalId: record.id },
    plano: { ...clone(project.plano || {}), floorProposal: clone(record) },
  };
}

// Descartar OCULTA la propuesta pero nunca la borra: el historial de propuestas
// rechazadas, con su motivo, es la retroalimentación con la que Tweedledum aprende.
export function discardFloorProposalRecord(project = {}, proposalId, motivo = "", { now = new Date().toISOString() } = {}) {
  const proposals = Array.isArray(project.cabida?.floorProposals) ? project.cabida.floorProposals : [];
  const record = proposals.find((item) => item.id === proposalId);
  if (!record) throw new Error(`Floor proposal ${proposalId} not found`);
  const descartadaAt = typeof now === "string" ? now : new Date(now).toISOString();
  const cabida = clone(project.cabida || {});
  const base = {
    ...clone(project),
    cabida: {
      ...cabida,
      floorProposals: proposals.map((item) => (item.id === proposalId
        ? { ...clone(item), descartada: true, motivoDescarte: String(motivo || ""), descartadaAt }
        : clone(item))),
      // si la descartada estaba activa, deja de estarlo
      activeFloorProposalId: cabida.activeFloorProposalId === proposalId ? null : cabida.activeFloorProposalId,
    },
  };
  // Si la propuesta descartada es la que quedó sembrada en el Editor de Planos
  // (plano.floorProposal), hay que limpiarla también ahí: si no, el usuario descarta
  // en Cabida y la planta descartada sigue viva en Planos (EditorPlanos.jsx lee P.floorProposal).
  // Si la descartada no es la sembrada, plano queda intacto.
  if (project.plano?.floorProposal?.id === proposalId) {
    const plano = clone(project.plano);
    delete plano.floorProposal;
    delete plano.floorProposalMaterializedId;
    base.plano = plano;
  }
  return base;
}

export function fallbackFloorProposal({ footprint, frontIdx = 0, brief = {}, sourceCabidaVersionId }) {
  const candidates = generarDistribuciones(footprint, frontIdx, brief);
  const parti = candidates.find((candidate) => {
    const refs = (candidate.res?.units || []).map((unit) => unit.unitRef);
    return refs.length === new Set(refs).size;
  }) || candidates[0];
  if (!parti?.res) throw new Error("La huella no admite una distribución determinística");
  const { core, corridors = [], corridor, units = [] } = parti.res;
  const halls = corridors.length ? corridors : (corridor ? [corridor] : []);

  // packFloor empaqueta sobre el rectángulo envolvente orientado al frente y deja vértices
  // desbordados en las aristas oblicuas (medido: hasta 0.5 mm). El validador rechaza la
  // propuesta entera por eso — "core sale de la huella edificable · … · La planta deja
  // 272.64 m² sin asignar". Recortamos contra la huella real antes de emitir.
  const piezas = [];
  if (core) piezas.push({ id: core.id, role: "core", name: "core", unitRef: null, unitProgram: null, pts: core.pts });
  halls.forEach((hall, index) => piezas.push({
    id: hall.id, role: "circulacion", name: `circulación ${index + 1}`, unitRef: null, unitProgram: null, pts: hall.pts,
  }));
  units.forEach((unit) => {
    const dormitorios = Math.max(1, Math.min(3, Number(unit.requestedProgram?.dormitorios ?? unit.tipologia?.dorms ?? parseInt(unit.subtipo, 10) ?? 1) || 1));
    const banos = Math.max(1, Number(unit.requestedProgram?.banos ?? unit.tipologia?.banos ?? (dormitorios <= 1 ? 1 : 2)) || 1);
    piezas.push({
      id: unit.id,
      role: "unidad",
      name: unit.name || `${dormitorios}D`,
      unitRef: unit.unitRef || unit.id,
      unitProgram: { dormitorios, banos },
      pts: unit.pts,
    });
  });

  const { kept, dropped, split } = clipPieces(piezas, footprint);
  const polygons = kept.map((pieza) => ({
    polygonId: pieza.id,
    role: pieza.role,
    name: pieza.name,
    unitRef: pieza.unitRef,
    unitProgram: pieza.unitProgram,
    polygon: toPolygon(pieza.pts),
  }));
  return {
    summary: "Respaldo determinístico de packFloor",
    floor: { sourceCabidaVersionId: String(sourceCabidaVersionId || ""), polygons },
    assumptions: [],
    tradeoffs: [
      "Distribución determinística utilizada como respaldo",
      // que un recorte con pérdida sea visible y no se coma piezas en silencio
      ...(dropped.length ? [`${dropped.length} pieza(s) descartada(s) al recortar contra la huella`] : []),
      ...(split ? [`${split} pieza(s) partida(s) por la huella: se conservó el fragmento mayor`] : []),
    ],
  };
}

// Tweedledum ya no dibuja: devuelve un "parti" (decisión aproximada de
// zonificación — crujías, corredor, core, anchos de unidad) que ALICE tesela.
// Esta función es el otro lado de ese contrato: normaliza el parti a números
// exactos (partiNormalizar.js) y lo dibuja con el mismo motor de recorte que
// usa fallbackFloorProposal (clipPieces contra la huella real, que puede ser
// cóncava), así el resto del frontend sigue consumiendo polígonos igual.
export function materializeFloorProposal({ parti, footprint, frontIdx = 0, sourceCabidaVersionId, summary = "", assumptions = [], tradeoffs = [] }) {
  const F = orientedFrame(footprint, frontIdx);
  const normalizado = normalizarParti(parti, { frente: F.frente, fondo: F.fondo });
  const doble = normalizado.crujias === 2;
  // misma fórmula de bandDepth que packFloor (lote.js): crujía simple también
  // reserva el corredor al fondo, doble crujía reparte el fondo en dos bandas
  // iguales separadas por el corredor.
  const bandDepth = doble
    ? (F.fondo - normalizado.corredorProfundidad) / 2
    : Math.max(F.fondo - normalizado.corredorProfundidad, 0);

  const piezas = [];
  const { posicion: coreU0, ancho: coreAncho } = normalizado.core;
  const coreU1 = coreU0 + coreAncho;
  piezas.push({
    id: "core", role: "core", name: "core", unitRef: null, unitProgram: null,
    pts: [F.toWorld(coreU0, 0), F.toWorld(coreU1, 0), F.toWorld(coreU1, F.fondo), F.toWorld(coreU0, F.fondo)],
  });

  const corridorV0 = bandDepth;
  const corridorV1 = Math.min(bandDepth + normalizado.corredorProfundidad, F.fondo);
  [[0, coreU0], [coreU1, F.frente]].forEach(([u0, u1], index) => {
    if (u1 - u0 < 0.05 || corridorV1 - corridorV0 < 0.05) return;
    piezas.push({
      id: `circulacion-${index + 1}`, role: "circulacion", name: `circulación ${index + 1}`, unitRef: null, unitProgram: null,
      pts: [F.toWorld(u0, corridorV0), F.toWorld(u1, corridorV0), F.toWorld(u1, corridorV1), F.toWorld(u0, corridorV1)],
    });
  });

  normalizado.units.forEach((unit) => {
    if (!(unit.ancho > 0)) return;
    piezas.push({
      id: unit.unitRef, role: "unidad", name: `${unit.dormitorios}D`,
      unitRef: unit.unitRef, unitProgram: { dormitorios: unit.dormitorios, banos: unit.banos },
      pts: [F.toWorld(unit.x, 0), F.toWorld(unit.x + unit.ancho, 0), F.toWorld(unit.x + unit.ancho, bandDepth), F.toWorld(unit.x, bandDepth)],
    });
  });

  // crujía doble: hoy solo se reparten unidades en la banda del frente; la
  // segunda banda queda registrada como área común sin programar (void) en vez
  // de inventar unidades que Tweedledum no pidió, y así la huella sigue
  // quedando completamente asignada (sin incomplete_partition).
  if (doble) {
    const backV0 = bandDepth + normalizado.corredorProfundidad;
    if (F.fondo - backV0 > 0.05) {
      piezas.push({
        id: "banda-2-void", role: "void", name: "vacío", unitRef: null, unitProgram: null,
        pts: [F.toWorld(0, backV0), F.toWorld(F.frente, backV0), F.toWorld(F.frente, F.fondo), F.toWorld(0, F.fondo)],
      });
    }
  }

  const { kept, dropped, split } = clipPieces(piezas, footprint);
  const polygons = kept.map((pieza) => ({
    polygonId: pieza.id,
    role: pieza.role,
    name: pieza.name,
    unitRef: pieza.unitRef,
    unitProgram: pieza.unitProgram,
    polygon: toPolygon(pieza.pts),
  }));

  return {
    summary: String(summary || ""),
    floor: { sourceCabidaVersionId: String(sourceCabidaVersionId || normalizado.sourceCabidaVersionId || ""), polygons },
    assumptions: [...assumptions],
    tradeoffs: [
      ...tradeoffs,
      ...(doble ? ["crujía doble simplificada: unidades solo en la banda del frente, la banda del fondo queda como vacío de servicio"] : []),
      ...(dropped.length ? [`${dropped.length} pieza(s) descartada(s) al recortar contra la huella`] : []),
      ...(split ? [`${split} pieza(s) partida(s) por la huella: se conservó el fragmento mayor`] : []),
    ],
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
      pendingInterior: item.role === "unidad",
    })),
    items: [],
    notas: [proposal.summary || "Propuesta de planta típica"],
    stats: { uds: new Set(polygons.filter((item) => item.role === "unidad").map((item) => item.unitRef)).size },
  };
}
