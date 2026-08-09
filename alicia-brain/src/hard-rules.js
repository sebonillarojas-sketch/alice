// Invariantes NO negociables del sistema. El gate (checkContradictsHardRules) rechaza
// cualquier lección cuyo texto matchee alguna. Versionar acá; agregar reglas con cuidado.
export const HARD_RULES = [
  { id: "autoridad-destructiva",
    test: t => /(force.?push|borrar|eliminar|drop\s+table|reset).*(sin (confirmar|aprobar|avisar)|autom[aá]tic)/i.test(t) || /force.?push.*main/i.test(t),
    reason: "viola límites de autoridad (acción destructiva sin confirmación humana)" },
  { id: "seguridad",
    test: t => /(desactivar|apagar|saltear|bypass).*(auth|autenticaci[oó]n|gate|seguridad)/i.test(t) || /abrir cors|cors.*(\*|para todos)/i.test(t),
    reason: "viola políticas de seguridad" },
  { id: "rne-minimos",
    test: t => /(bajar|reducir|achicar|recortar|menos de|por debajo|m[aá]s chico).{0,60}(dormitorio|ba[ñn]o|cocina|sala|comedor|ambiente|dpto|departamento|unidad|[aá]rea m[ií]nima|area minima)/i.test(t),
    reason: "viola mínimos de área RNE" },
];
