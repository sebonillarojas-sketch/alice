// files/alice/src/copilot/manos.js
//
// La capa 1 del spec: genérica, cubre los módulos del ERP con una tabla de rutas
// y el registro de contexto que ya existe. Sin JSX ni React: las dependencias
// (bus, registro, navigate) entran por parámetro, así se testea sin montar nada.

// moduleId → cómo llegar con navigate(space, view).
//
// El id de la izquierda es el que usa Alicia y el que los módulos declaran en
// useERPContext(). El space de la derecha es el de HyggeOS. Coinciden poco y nada
// —"velocity" vive en "app-velocity", "cabida" en "app-cabida"— y por eso existe
// esta tabla en vez de pasar el nombre derecho a navigate().
export const RUTAS = {
  cabida:     { space: "app-cabida",     nombre: "Cabida" },
  velocity:   { space: "app-velocity",   nombre: "Velocity · Mercado" },
  cotizacion: { space: "app-cotizacion", nombre: "Cotización" },
  mesa:       { space: "app-mesa",       nombre: "Mesa de Trabajo" },
  editor:     { space: "app-editor",     nombre: "Editor de Planos" },
  growth:     { space: "growth",         nombre: "Growth · Terrenos" },
  hq:         { space: "hq",             nombre: "Hygge HQ" },
  proyectos:  { space: "proyectos",      nombre: "Proyectos" },
  bam:        { space: "bam",            nombre: "BAM · Arquitectura" },
  finanzas:   { space: "finanzas",       nombre: "Finanzas" },
  legal:      { space: "legal",          nombre: "Legal" },
  comercial:  { space: "comercial",      nombre: "Comercial" },
  marketing:  { space: "marketing",      nombre: "Marketing" },
  inbox:      { space: "inbox",          nombre: "Smart Capture" },
  mistareas:  { space: "mistareas",      nombre: "Mis tareas" },
  calendario: { space: "calendar-tool",  nombre: "Calendario" },
  wikihygge:  { space: "wikihygge",      nombre: "WikiHygge" },
  // El space de un proyecto es su propio id (dc01, pu01, tg01, l36), así que la
  // ruta la da el entityId y no una constante.
  //
  // LÍMITE CONOCIDO: hoy ningún módulo se registra con moduleId "proyecto" ni
  // con los ids de proyecto (dc01/pu01/tg01/l36) — los que llaman a
  // useERPContext son growth, mesa, cotizacion, obra, cabida y velocity (grep
  // verificado). erp_navigate a un proyecto SÍ cambia la pantalla, pero el
  // erp_read que sigue siempre va a decir "no pude leer su estado": no hay
  // describe() que responda a esos ids todavía.
  proyecto:   { porEntidad: true,        nombre: "Un proyecto (pasá entityId: dc01, pu01, tg01, l36)" },
};

// LÍMITE CONOCIDO: `obra` no está acá. ObraTracker vive en una pestaña interna de
// ProjectDashboard (`tab === "obra"`), que no es direccionable por navigate(space,
// view) — `view` ya lo usan las vistas de tareas (list/board/gantt). Alicia puede
// leer obra si vos la tenés abierta, pero no puede abrirla. Hacerla direccionable
// es un cambio en ProjectDashboard y no entra en esta fase.

const TIMEOUT_MONTAJE = 3000;

const describirTexto = (d) => {
  if (!d) return null;
  const partes = [`módulo: ${d.module}`];
  if (d.title) partes.push(`título: ${d.title}`);
  if (d.entity) partes.push(`entidad: ${JSON.stringify(d.entity)}`);
  if (d.state) partes.push(`state (lo que cargó el usuario): ${JSON.stringify(d.state)}`);
  if (d.derived) partes.push(`derived (lo que el módulo calculó): ${JSON.stringify(d.derived)}`);
  if (Array.isArray(d.actions) && d.actions.length) partes.push(`acciones: ${d.actions.join(", ")}`);
  if (d.congelado) partes.push("(foto de cuando saliste del módulo, no el estado en vivo)");
  return partes.join("\n");
};

export function crearManos({ bus, registro, navigate }) {
  function listar() {
    const montados = new Set(registro.modulos());
    return Object.entries(RUTAS)
      .map(([id, r]) => `${id} — ${r.nombre}${montados.has(id) ? " (abierto ahora)" : ""}`)
      .join("\n");
  }

  function leer(moduleId) {
    const id = moduleId || registro.modulos()[0];
    if (!id) return "No hay ningún módulo abierto. Usá erp_navigate para abrir uno.";
    const texto = describirTexto(registro.describir(id));
    if (texto) return texto;
    return `El módulo "${id}" no está abierto, así que no puedo leer su estado. Abrilo con erp_navigate primero.`;
  }

  async function navegar({ module, entityId }) {
    const ruta = RUTAS[module];
    if (!ruta) return `El módulo "${module}" no existe. Estos son los que hay:\n${listar()}`;
    if (ruta.porEntidad && !entityId) return `Para abrir "${module}" necesito el entityId. ${ruta.nombre}`;

    navigate(ruta.porEntidad ? entityId : ruta.space, undefined);

    // Esperar a que monte: sin esto el erp_read que viene atrás lee un registro
    // vacío, porque React todavía no re-renderizó. Ver ERPContext.esperarRegistro.
    const monto = await registro.esperarRegistro(module, TIMEOUT_MONTAJE);
    if (!monto) {
      // No mentir: la pantalla SÍ cambió, lo que no pudimos es leerla. Puede ser
      // un space sin describe() (la mayoría todavía no lo tiene) o uno lento.
      return `Abrí "${module}" en la pantalla del usuario, pero no pude leer su estado (ese módulo todavía no se describe a sí mismo). Preguntale qué ve si necesitás los números.`;
    }
    // `monto` en true sólo dice que el módulo se registró — describe() puede
    // haber tirado (queda capturado en ERPContext y vuelve null) o devuelto
    // algo falsy justo en ese instante. Mismo criterio de honestidad: no
    // mentir con un texto tipo `...ahora:\nnull`.
    const texto = describirTexto(registro.describir(module));
    if (!texto) {
      return `Abrí "${module}" en la pantalla del usuario, pero no pude leer su estado justo ahora. Preguntale qué ve si necesitás los números.`;
    }
    return `Abrí "${module}". Esto es lo que hay ahora:\n${texto}`;
  }

  async function accionar({ action, args }) {
    try { return await bus.ejecutar(action, args); }
    catch (e) {
      // Esto termina como tool_result. Un throw acá mataría el turno por una
      // acción mal elegida, cuando el modelo puede leer el error y corregirse.
      return e?.message ?? String(e);
    }
  }

  async function ejecutar(tool, input = {}) {
    if (tool === "erp_list_modules") return listar();
    if (tool === "erp_read") return leer(input.module);
    if (tool === "erp_navigate") return navegar(input);
    if (tool === "erp_action") return accionar(input);
    return `La herramienta "${tool}" no existe del lado del ERP.`;
  }

  return { ejecutar };
}
