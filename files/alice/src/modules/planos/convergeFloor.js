// La cadena: partis diversos -> unidad mas dificil primero -> materializar y validar
// -> critica estructurada -> corregir. Los hallazgos de volumen suben al reparto.
import { sonDistintos } from "./parti.js";
import { createLedger, findingKey } from "./findingsLedger.js";
import { esDeVolumen, rebalancear } from "./rebalance.js";
import { ordenarPorDificultad } from "./dificultad.js";

const LIMITES = { vueltasPorUnidad: 3, llamadasPorPiso: 10 };
const MAX_REINTENTOS_PARTI = 2;

// Suma `nuevos` a `actuales` conservando solo los que sean distintos de todo lo
// ya aceptado (no solo entre sí). Devuelve el conteo de partis descartados en
// este lote para acumularlo con los de lotes anteriores.
function mezclarPartisDistintos(actuales, nuevos) {
  const kept = [...actuales];
  let descartados = 0;
  for (const p of nuevos) {
    const esDistinto = kept.every((k) => sonDistintos(p, k));
    if (esDistinto) kept.push(p);
    else descartados += 1;
  }
  return { kept, descartados };
}

export async function convergeFloor(brief = {}, deps = {}, limits = {}) {
  const lim = { ...LIMITES, ...limits };
  const { planFloor, designUnit, critique, materialize, validate } = deps;
  const ledger = createLedger();
  let llamadas = 0;
  const tope = () => llamadas >= lim.llamadasPorPiso;

  // Tweedledum propone 3 partis obligatoriamente distintos. Si el colapso de modo
  // los deja en menos de 3 tras deduplicar, se vuelve a pedir con los ya vistos
  // como exclusión explícita: máximo 2 reintentos, cortando antes si ya hay 3
  // distintos o si el piso se quedó sin presupuesto de llamadas.
  let vistos = [];
  let kept = [];
  let partisDescartados = 0;
  let intentosParti = 0;
  const maxIntentosParti = 1 + MAX_REINTENTOS_PARTI;

  while (kept.length < 3 && intentosParti < maxIntentosParti && !tope()) {
    llamadas += 1;
    intentosParti += 1;
    const propuestos = await planFloor(brief, vistos.length ? { excluir: vistos } : undefined);
    vistos = vistos.concat(propuestos);
    const mezcla = mezclarPartisDistintos(kept, propuestos);
    kept = mezcla.kept;
    partisDescartados += mezcla.descartados;
  }

  let parti = kept[0];

  // Sin parti sobre el cual trabajar (planFloor vacío/fallido): no se entrega en silencio
  // ni se propaga la excepción cruda del .units.find de más abajo.
  if (!parti) {
    return {
      parti: null,
      partisDescartados,
      unidades: [],
      pendientes: (brief.units || []).map((u) => u.id),
      llamadas,
      motivo: "sin_parti",
    };
  }

  const unidades = [];
  const pendientes = [];
  let motivo = "ok";

  // Ancho del sobre contra el que cerró cada unidad ya resuelta. Si un rebalanceo
  // posterior lo cambia, esa unidad quedó obsoleta: se reporta, no se re-resuelve.
  const cerradasContra = new Map();
  const indexPorId = new Map();

  // Ejemplar: la primera unidad que converge sin hallazgos se guarda y se pasa
  // al contexto de Tweedledum para las que siguen. Mientras nadie convergió, null.
  let ejemplar = null;

  for (const u of ordenarPorDificultad(brief.units || [])) {
    let vuelta = 0;
    let cerrada = false;
    let layout = null;

    while (vuelta < lim.vueltasPorUnidad) {
      if (tope()) { motivo = "tope_piso"; break; }
      vuelta += 1;
      llamadas += 1;

      const sobre = parti.units.find((s) => s.id === u.id) || {};
      const decision = await designUnit({ unidad: u, sobre, mustFix: ledger.mustFix(u.id), ejemplar });
      layout = materialize(decision);
      const val = validate(layout);

      // El validador determinista corre siempre. Si alguno de sus hallazgos
      // reintroduce una clave que el ledger ya había dado por cerrada para esta
      // unidad, es una regresión: se marca sin gastar una llamada a Tweedledee.
      const hallazgosValidador = (val.errors || []).map((e) => ({ ...e, nivel: e.nivel || "interior" }));
      const cerradosPrevios = new Set(ledger.resueltos(u.id).map((f) => findingKey({ ...f, unidad: u.id })));
      const esRegresion = hallazgosValidador.some((f) => cerradosPrevios.has(findingKey({ ...f, unidad: u.id })));

      let findings;
      if (esRegresion) {
        findings = hallazgosValidador;
      } else {
        if (tope()) { motivo = "tope_piso"; break; }
        llamadas += 1;
        findings = [...hallazgosValidador, ...(await critique({ unidad: u, layout }))];
      }

      // Al saltear al crítico, esta vuelta no tiene la foto completa: no puede
      // cerrar por omisión un hallazgo abierto que solo el crítico reportaba
      // (todavía no fue re-verificado).
      ledger.record(u.id, findings, { cerrarOmitidos: !esRegresion });
      if (!findings.length) {
        cerrada = true;
        cerradasContra.set(u.id, sobre.w);
        if (!ejemplar) ejemplar = { unidad: u.id, layout };
        break;
      }

      if (ledger.bloqueado(u.id)) { motivo = "bloqueado"; break; }

      const deVolumen = findings.filter(esDeVolumen);
      if (deVolumen.length) {
        try {
          parti = rebalancear(parti, u.id, 0.60);
          // Revisar si el rebalanceo dejó obsoleta a alguna unidad ya cerrada:
          // su layout se materializó contra un sobre que el parti final ya no tiene.
          for (const [idCerrada, wCierre] of [...cerradasContra]) {
            const actual = parti.units.find((s) => s.id === idCerrada);
            const wActual = actual ? actual.w : undefined;
            if (wActual === undefined || Math.abs(wActual - wCierre) > 0.001) {
              const idx = indexPorId.get(idCerrada);
              if (idx !== undefined) unidades[idx].layout = null;
              if (!pendientes.includes(idCerrada)) pendientes.push(idCerrada);
              cerradasContra.delete(idCerrada);
              // La invalidada era la ejemplar: ya no es un modelo válido a imitar.
              if (ejemplar && ejemplar.unidad === idCerrada) ejemplar = null;
            }
          }
        } catch { /* sin margen: sigue como interior */ }
        continue;
      }
    }

    indexPorId.set(u.id, unidades.length);
    unidades.push({ id: u.id, layout, findings: ledger.mustFix(u.id) });
    if (!cerrada) pendientes.push(u.id);
  }

  if (motivo === "ok" && pendientes.length) motivo = "bloqueado";
  return { parti, partisDescartados, unidades, pendientes, llamadas, motivo };
}
