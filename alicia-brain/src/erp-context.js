// El snapshot del ERP convertido en algo que el modelo pueda leer.
//
// IMPORTANTE: este bloque va DESPUÉS del breakpoint de caché del system prompt.
// Si entrara al bloque cacheado, cada vez que la persona navega a otro módulo se
// invalidaría el prefijo entero (system + tools + 60 mensajes) y se reprocesaría
// todo. Se paga a precio completo a propósito. Ver deuda D15 del spec.

// Tope propio del servidor. El cliente ya capa a 2000, pero el cliente es
// código que corre en el browser de otro: no se le cree.
export const ERP_CONTEXT_CAP = 2400;

export function renderErpContext(snapshot, cap = ERP_CONTEXT_CAP) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return "";
  const { active, others } = snapshot;
  if (!active && !(Array.isArray(others) && others.length)) return "";

  const lines = ["# PANTALLA (lo que la persona está viendo AHORA en el ERP)"];

  if (active) {
    lines.push(`\n## Módulo activo: ${active.title || active.module}`);
    if (active.entity?.id) lines.push(`Entidad abierta: ${active.entity.type || "item"} ${active.entity.id}`);
    if (active.state) lines.push(`Parámetros en pantalla: ${JSON.stringify(active.state)}`);
    if (active.derived) lines.push(`Ya calculado por el módulo (NO recalcules): ${JSON.stringify(active.derived)}`);
    if (active.actions?.length) lines.push(`Acciones disponibles acá: ${active.actions.join(", ")}`);
  }

  if (Array.isArray(others) && others.length) {
    lines.push(`\n## Otros módulos abiertos (pedí su detalle si lo necesitás)`);
    for (const o of others) lines.push(`- ${o.title || o.module}`);
  }

  const text = lines.join("\n");
  if (text.length <= cap) return text;
  // El aviso de recorte también cuenta contra el tope: se descuenta su propio
  // largo del slice para que el total nunca se pase del cap.
  const suffix = "\n[…recortado por presupuesto]";
  return `${text.slice(0, Math.max(0, cap - suffix.length))}${suffix}`;
}
