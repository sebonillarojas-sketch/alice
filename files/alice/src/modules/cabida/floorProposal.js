import { generarDistribuciones } from "../planos/plantas.js";
import { clipPieces } from "../planos/clipFootprint.js";
import { orientedFrame } from "../planos/geometry.js";
import { normalizarParti } from "../planos/partiNormalizar.js";

const toPolygon = (pts) => pts.map((point) => [Number(point.x), Number(point.y)]);
const toPoints = (polygon) => polygon.map(([x, y]) => ({ x: Number(x), y: Number(y) }));
const clone = (value) => structuredClone(value);
const safeId = (value) => String(value || "project").replace(/[^a-zA-Z0-9_-]/g, "_");

// Traduce los avisos de normalizarParti (partiNormalizar.js) — qué campos del núcleo
// tuvo que rellenar o acotar el motor porque Tweedledum no mandó una decisión utilizable
// — a texto legible para `tradeoffs`. Nada de defaults silenciosos: si el motor decidió
// algo en lugar del agente, tiene que quedar escrito acá.
const AVISO_CORE_TEXTOS = {
  "longitud:ausente": (valor) => `profundidad del núcleo no especificada por el agente: se usó ${valor.toFixed(2)} m por defecto`,
  "longitud:invalida": (valor) => `profundidad del núcleo inválida en lo que mandó el agente: se usó ${valor.toFixed(2)} m por defecto`,
  "longitud:acotada": (valor) => `profundidad del núcleo recortada a ${valor.toFixed(2)} m: junto con la distancia al frente excedía el fondo del lote`,
  "distanciaAlFrente:invalida": (valor) => `distancia del núcleo al frente inválida en lo que mandó el agente: se usó ${valor.toFixed(2)} m por defecto`,
};
const describirAvisosCore = (avisos = []) => avisos.map((aviso) => {
  const texto = AVISO_CORE_TEXTOS[`${aviso.campo}:${aviso.motivo}`];
  return texto ? texto(Number(aviso.valor) || 0) : `núcleo: ${aviso.campo} ajustada por el motor (${aviso.motivo})`;
});

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
  const { posicion: coreU0, ancho: coreAncho, longitud: coreLongitud, distanciaAlFrente } = normalizado.core;
  const coreU1 = coreU0 + coreAncho;
  // el núcleo arranca `distanciaAlFrente` metros adentro del frente (v=0) — 0 es el
  // default/compatibilidad (pegado al frente, el comportamiento de siempre) — y penetra
  // `longitud` metros desde ahí: ya NO atraviesa el bloque entero por defecto (era el bug
  // — una franja entera de suelo vendible perdida detrás de una escalera). Lo que queda
  // por delante y por detrás, en su propia columna, se cierra como `circulacion` (o
  // `unidad`, si alguna la reclama) más abajo — nunca queda como hueco sin asignar.
  // (normalizarParti ya saneó ambos valores contra el fondo del marco; estos Math.min/max
  // son solo una red de seguridad.)
  const coreV0 = Math.max(0, Math.min(distanciaAlFrente, F.fondo));
  const coreV1 = Math.min(coreV0 + coreLongitud, F.fondo);
  piezas.push({
    id: "core", role: "core", name: "core", unitRef: null, unitProgram: null,
    pts: [F.toWorld(coreU0, coreV0), F.toWorld(coreU1, coreV0), F.toWorld(coreU1, coreV1), F.toWorld(coreU0, coreV1)],
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

  // Con crujía simple, banda se ignora: todas las unidades van a la única banda. Con
  // crujía doble, normalizarParti ya repartió cada unidad a su banda (1 = frente, 2 =
  // fondo). Se calcula acá arriba (y no más abajo, donde vivía antes) porque el tramo
  // entre el frente y el núcleo retirado necesita saber qué unidades de la banda 1 hay
  // ANTES de decidir si alguna reclama esa columna.
  const band1Units = doble ? normalizado.units.filter((unit) => unit.banda !== 2) : normalizado.units;
  const band2Units = doble ? normalizado.units.filter((unit) => unit.banda === 2) : [];

  // ¿alguna unidad de la banda del frente ya ocupa la columna del núcleo (su rango de
  // ancho se solapa con [coreU0,coreU1])? Con la geometría que produce normalizarParti
  // esto nunca pasa (las unidades se colocan siempre a los lados del núcleo, nunca sobre
  // su columna) — se comprueba de todos modos, defensivamente, en vez de asumirlo.
  const columnaNucleoReclamadaPorUnidad = (units) => units.some(
    (u) => u.ancho > 0 && u.x < coreU1 - 0.001 && u.x + u.ancho > coreU0 + 0.001,
  );

  // El tramo ENTRE el frente (v=0) y donde arranca el núcleo retirado (coreV0) nunca
  // puede quedar sin asignar — ya hubo un bug de producción de suelo sin asignar y no
  // puede volver. Si ninguna unidad de la banda del frente reclama esa columna (el caso
  // de siempre), se cierra como `circulacion`, simétrico a `circulacion-nucleo` (detrás).
  if (coreV0 > 0.05 && !columnaNucleoReclamadaPorUnidad(band1Units)) {
    piezas.push({
      id: "circulacion-nucleo-frente", role: "circulacion", name: "circulación núcleo (frente)", unitRef: null, unitProgram: null,
      pts: [F.toWorld(coreU0, 0), F.toWorld(coreU1, 0), F.toWorld(coreU1, coreV0), F.toWorld(coreU0, coreV0)],
    });
  }

  // ¿el núcleo penetra la banda del fondo? (misma comparación que ya hizo
  // normalizarParti para decidir si esa banda se reparte a todo el frente o alrededor
  // del núcleo — se recalcula acá porque acá es donde se sabe el fondo de cada tramo). Se
  // mide desde el fondo real del núcleo (coreV1, que ya incluye distanciaAlFrente): con
  // distanciaAlFrente=0 esto es idéntico a la fórmula de siempre.
  const nucleoExcedeBandaFrente = coreV1 > bandDepth + 0.001;
  // fondo de la propia columna del núcleo: el corredor si se queda en la banda del
  // frente (ahí termina "su banda"); el fondo del lote si penetra la banda del fondo (ya
  // no hay banda después, es el fin del lote). Rectángulo simple, sin polígonos en L.
  const finColumnaNucleo = nucleoExcedeBandaFrente ? F.fondo : corridorV1;
  if (finColumnaNucleo - coreV1 > 0.05) {
    piezas.push({
      id: "circulacion-nucleo", role: "circulacion", name: "circulación núcleo", unitRef: null, unitProgram: null,
      pts: [F.toWorld(coreU0, coreV1), F.toWorld(coreU1, coreV1), F.toWorld(coreU1, finColumnaNucleo), F.toWorld(coreU0, finColumnaNucleo)],
    });
  }

  const emitirUnidad = (unit, v0, v1) => {
    if (!(unit.ancho > 0)) return;
    piezas.push({
      id: unit.unitRef, role: "unidad", name: `${unit.dormitorios}D`,
      unitRef: unit.unitRef, unitProgram: { dormitorios: unit.dormitorios, banos: unit.banos },
      pts: [F.toWorld(unit.x, v0), F.toWorld(unit.x + unit.ancho, v0), F.toWorld(unit.x + unit.ancho, v1), F.toWorld(unit.x, v1)],
    });
  };

  // Completa con `circulacion` cualquier tramo de una fila (0..frente) que ni el núcleo
  // (cuando la cruza, `coreCruzaFila`) ni ninguna unidad terminen cubriendo. Sin esto,
  // una unidad única a un lado del núcleo puede dejar el otro lado — un tramo entero, con
  // ancho real — sin ningún polígono (bug de producción: banda del fondo con una sola
  // unidad declarada, el otro lado del núcleo quedaba en blanco). El propio núcleo (más
  // su `circulacion-nucleo`) ya cubre su columna en toda la profundidad de esta fila, así
  // que acá alcanza con marcarla como ocupada sin re-dibujarla.
  const emitirHuecosDeFila = (units, v0, v1, coreCruzaFila, idPrefix) => {
    if (v1 - v0 < 0.05) return;
    const ocupados = units.filter((u) => u.ancho > 0).map((u) => [u.x, u.x + u.ancho]);
    if (coreCruzaFila) ocupados.push([coreU0, coreU1]);
    ocupados.sort((a, b) => a[0] - b[0]);
    let cursor = 0;
    let hueco = 0;
    const cerrarHueco = (a, b) => {
      if (b - a < 0.05) return;
      hueco += 1;
      piezas.push({
        id: `${idPrefix}-hueco-${hueco}`, role: "circulacion", name: "circulación", unitRef: null, unitProgram: null,
        pts: [F.toWorld(a, v0), F.toWorld(b, v0), F.toWorld(b, v1), F.toWorld(a, v1)],
      });
    };
    ocupados.forEach(([a, b]) => { cerrarHueco(cursor, a); cursor = Math.max(cursor, b); });
    cerrarHueco(cursor, F.frente);
  };

  // Si ninguna unidad quedó en una banda, esa banda se emite como área común sin
  // programar (void) en vez de inventar unidades que Tweedledum no pidió, y así la huella
  // sigue quedando completamente asignada (sin incomplete_partition). Si ambas bandas
  // tienen unidades, ninguna queda como void: el fondo del lote se aprovecha.
  // (band1Units/band2Units ya se calcularon arriba, antes de dibujar el núcleo.)
  let simplificadoFrente = false;
  let simplificadoFondo = false;

  if (band1Units.length) {
    band1Units.forEach((unit) => emitirUnidad(unit, 0, bandDepth));
    // la columna del núcleo (retirado o no) siempre queda cubierta en toda la fila
    // [0,bandDepth] por circulacion-nucleo-frente + core + circulacion-nucleo juntos:
    // marcarla como ocupada evita re-dibujarla, pero cualquier otro tramo sin unidad sí
    // tiene que cerrarse.
    emitirHuecosDeFila(band1Units, 0, bandDepth, true, "banda-1");
  } else if (doble && bandDepth > 0.05) {
    simplificadoFondo = true; // solo la banda del fondo tiene unidades; el frente queda de servicio
    piezas.push({
      id: "banda-1-void", role: "void", name: "vacío", unitRef: null, unitProgram: null,
      pts: [F.toWorld(0, 0), F.toWorld(F.frente, 0), F.toWorld(F.frente, bandDepth), F.toWorld(0, bandDepth)],
    });
  }

  if (doble) {
    const backV0 = bandDepth + normalizado.corredorProfundidad;
    if (band2Units.length) {
      band2Units.forEach((unit) => emitirUnidad(unit, backV0, F.fondo));
      // la banda del fondo solo está cruzada por el núcleo cuando su longitud la supera
      // (nucleoExcedeBandaFrente): si no la alcanza, esta banda ya se repartió a todo el
      // frente en normalizarParti y no hay columna del núcleo que marcar acá.
      emitirHuecosDeFila(band2Units, backV0, F.fondo, nucleoExcedeBandaFrente, "banda-2");
    } else if (F.fondo - backV0 > 0.05) {
      simplificadoFrente = true; // ninguna unidad declaró banda 2: comportamiento de siempre
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
      ...describirAvisosCore(normalizado.core.avisos),
      ...(simplificadoFrente ? ["crujía doble simplificada: unidades solo en la banda del frente, la banda del fondo queda como vacío de servicio"] : []),
      ...(simplificadoFondo ? ["crujía doble simplificada: unidades solo en la banda del fondo, la banda del frente queda como vacío de servicio"] : []),
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
