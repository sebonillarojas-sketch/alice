// La cadena: partis diversos -> unidad mas dificil primero -> materializar y validar
// -> critica estructurada -> corregir. Los hallazgos de volumen suben al reparto.
import { dedupePartis } from "./parti.js";
import { createLedger } from "./findingsLedger.js";
import { esDeVolumen, rebalancear } from "./rebalance.js";
import { ordenarPorDificultad } from "./dificultad.js";

const LIMITES = { vueltasPorUnidad: 3, llamadasPorPiso: 10 };

export async function convergeFloor(brief = {}, deps = {}, limits = {}) {
  const lim = { ...LIMITES, ...limits };
  const { planFloor, designUnit, critique, materialize, validate } = deps;
  const ledger = createLedger();
  let llamadas = 0;
  const tope = () => llamadas >= lim.llamadasPorPiso;

  llamadas += 1;
  const propuestos = await planFloor(brief);
  const { kept, dropped } = dedupePartis(propuestos);
  let parti = kept[0];

  // Sin parti sobre el cual trabajar (planFloor vacío/fallido): no se entrega en silencio
  // ni se propaga la excepción cruda del .units.find de más abajo.
  if (!parti) {
    return {
      parti: null,
      partisDescartados: dropped.length,
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

  for (const u of ordenarPorDificultad(brief.units || [])) {
    let vuelta = 0;
    let cerrada = false;
    let layout = null;

    while (vuelta < lim.vueltasPorUnidad) {
      if (tope()) { motivo = "tope_piso"; break; }
      vuelta += 1;
      llamadas += 1;

      const sobre = parti.units.find((s) => s.id === u.id) || {};
      const decision = await designUnit({ unidad: u, sobre, mustFix: ledger.mustFix(u.id) });
      layout = materialize(decision);
      const val = validate(layout);

      if (tope()) { motivo = "tope_piso"; break; }
      llamadas += 1;
      const findings = [...(val.errors || []).map((e) => ({ ...e, nivel: e.nivel || "interior" })),
                        ...(await critique({ unidad: u, layout }))];

      ledger.record(u.id, findings);
      if (!findings.length) { cerrada = true; cerradasContra.set(u.id, sobre.w); break; }

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
  return { parti, partisDescartados: dropped.length, unidades, pendientes, llamadas, motivo };
}
