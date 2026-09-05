// Lo que Alicia ve de tu pantalla. Se arma UNA vez por turno, al mandar el
// mensaje — ni por render ni por polling: así el costo es acotado y previsible.
// Archivo sin JSX a propósito, para que `node --test` lo pueda importar directo.

export const SNAPSHOT_BUDGET = 2000;

// Cabecera de un módulo que NO es el activo: alcanza para que Alicia sepa que
// existe y pueda pedir su detalle con una tool, sin pagar por todos.
const cabecera = (e) => ({ module: e.module, title: e.title, entity: e.entity ?? null });

export function buildSnapshot(entries, activeModule, budget = SNAPSHOT_BUDGET) {
  const list = Array.isArray(entries) ? entries : [];
  const active = list.find((e) => e.module === activeModule) ?? null;
  const others = list.filter((e) => e.module !== activeModule).map(cabecera);
  const total = others.length;

  // El activo es intocable: es lo que la persona está mirando ahora mismo, y un
  // parámetro truncado le haría dar un número mal. Lo que se suelta son los otros.
  while (others.length > 0 && JSON.stringify({ active, others, dropped: total - others.length }).length > budget) {
    others.pop();
  }
  return { active, others, dropped: total - others.length };
}
