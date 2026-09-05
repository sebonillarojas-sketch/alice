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

  const unidades = [];
  const pendientes = [];
  let motivo = "ok";

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
      if (!findings.length) { cerrada = true; break; }

      const deVolumen = findings.filter(esDeVolumen);
      if (deVolumen.length) {
        try { parti = rebalancear(parti, u.id, 0.60); } catch { /* sin margen: sigue como interior */ }
        continue;
      }
      if (ledger.bloqueado(u.id)) { motivo = "bloqueado"; break; }
    }

    unidades.push({ id: u.id, layout, findings: ledger.mustFix(u.id) });
    if (!cerrada) pendientes.push(u.id);

    if (motivo === "tope_piso") break;
  }

  if (motivo === "ok" && pendientes.length) motivo = "bloqueado";
  return { parti, partisDescartados: dropped.length, unidades, pendientes, llamadas, motivo };
}
