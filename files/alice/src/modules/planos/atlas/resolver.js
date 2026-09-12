// Resuelve los interiores de una planta aceptada usando el atlas: por cada unidad busca la
// tipología más parecida, la adapta al sobre y la deja lista para que el motor derive muros,
// vanos y mobiliario. La unidad que el atlas no puede resolver queda marcada para que la
// atienda Tweedledum — es el mismo reparto que documentamos de Finch3D: la biblioteca
// primero, el generador solo como respaldo.
//
// Ver docs/investigacion/2026-09-10-finch3d-metodo.md
import { calzar, cerrarJuntas, rellenarHuecos } from "./calce.js";
import ATLAS from "./atlas.json" with { type: "json" };

// Por encima de esto la tipología elegida deja de ser la que se eligió, y conviene que la
// unidad la resuelva el agente en vez de entregar una planta estirada al doble.
export const DEFORMACION_MAX = 1.35;
export const CALCE_MIN = 0.55;

const r2 = (n) => Math.round(n * 100) / 100;

/** Sobre y fachadas de una unidad, leídos de su contorno contra la huella del piso. */
export function sobreDeUnidad(unit, footprint = []) {
  const pts = unit?.boundary || [];
  if (pts.length < 3) return null;
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys);
  const fx = footprint.map((p) => p.x), fy = footprint.map((p) => p.y);
  const F = footprint.length >= 3
    ? { x0: Math.min(...fx), y0: Math.min(...fy), x1: Math.max(...fx), y1: Math.max(...fy) }
    : null;
  // fachada: los bordes del sobre que caen sobre el perímetro de la huella. Lo demás da a
  // un vecino o al corredor, y ahí no va una ventana.
  const fachadas = [];
  if (F) {
    const t = 0.06;
    if (y0 <= F.y0 + t) fachadas.push("abajo");
    if (y1 >= F.y1 - t) fachadas.push("arriba");
    if (x0 <= F.x0 + t) fachadas.push("izquierda");
    if (x1 >= F.x1 - t) fachadas.push("derecha");
  }
  return { x0, y0, ancho: r2(x1 - x0), fondo: r2(y1 - y0), fachadas };
}

/**
 * @param floor      la planta aceptada, ya partida (splitAcceptedFloor)
 * @param footprint  huella del piso, para saber qué bordes son fachada
 * @returns {{ rooms, resultados }} rooms en coordenadas del piso; resultados, uno por unidad
 */
export function resolverConAtlas({ units = [], footprint = [], atlas = ATLAS } = {}) {
  const rooms = [];
  const resultados = [];

  for (const unit of units) {
    const s = sobreDeUnidad(unit, footprint);
    if (!s) {
      resultados.push({ unitRef: unit.unitRef, ok: false, motivo: "sin contorno utilizable" });
      continue;
    }
    const objetivo = {
      ancho: s.ancho, fondo: s.fondo, fachadas: s.fachadas,
      dormitorios: unit.program?.dormitorios, banos: unit.program?.banos,
    };
    const [mejor] = calzar(atlas, objetivo, { top: 1, scoreMin: CALCE_MIN });

    if (!mejor) {
      resultados.push({ unitRef: unit.unitRef, ok: false, sobre: objetivo,
        motivo: `ninguna tipología de ${objetivo.dormitorios}D calza en ${s.ancho}×${s.fondo}` });
      continue;
    }
    const def = mejor.adaptacion?.adaptividad ?? 99;
    if (def > DEFORMACION_MAX) {
      resultados.push({ unitRef: unit.unitRef, ok: false, sobre: objetivo, score: mejor.score, deformacion: def,
        motivo: `el mejor calce hay que deformarlo ${def}×: el sobre no corresponde a un ${objetivo.dormitorios}D` });
      continue;
    }
    // cerrarJuntas: el atlas guarda el hueco del muro entre ambientes, pero ALICE deriva los
    // muros de las aristas compartidas. Sin esto no hay adyacencia, no hay puertas, y los
    // ambientes quedan encerrados.
    // rellenarHuecos: una tipología leída de una lámina casi nunca tesela su propio sobre
    // —el lector rotula los cuartos y se saltea el hall— y ese hueco queda como área
    // residual sin delimitar. Emitirlo como circulación lo cierra y además da la adyacencia
    // que vanos.js necesita para abrir la puerta que pasaría por ahí.
    const ambientes = rellenarHuecos(
      cerrarJuntas(mejor.adaptacion.ambientes, { ancho: s.ancho, fondo: s.fondo }),
      { ancho: s.ancho, fondo: s.fondo });
    for (const a of ambientes) {
      rooms.push({
        id: `${unit.unitRef}:${a.nombre}`,
        name: a.nombre, tipo: a.tipo, unitRef: unit.unitRef,
        sourcePolygonId: unit.polygonId,
        pts: [
          { x: r2(s.x0 + a.x), y: r2(s.y0 + a.y) },
          { x: r2(s.x0 + a.x + a.w), y: r2(s.y0 + a.y) },
          { x: r2(s.x0 + a.x + a.w), y: r2(s.y0 + a.y + a.h) },
          { x: r2(s.x0 + a.x), y: r2(s.y0 + a.y + a.h) },
        ],
      });
    }
    resultados.push({
      unitRef: unit.unitRef, ok: true, sobre: objetivo,
      score: mejor.score, deformacion: def, rotada: mejor.adaptacion.rotada,
      tipologia: mejor.entrada.fuente?.proyecto || mejor.entrada.fuente?.imagen || mejor.entrada.id,
      area: mejor.entrada.area?.declarada ?? null,
      confianza: mejor.entrada.confianza,
      ambientes: mejor.adaptacion.ambientes.length,
    });
  }
  return { rooms, resultados };
}

export const atlasDisponible = () => ATLAS.length;
