//
// Las tools que NO corren acá: el servidor las deriva al browser y espera la
// respuesta. Viven en su propio archivo (y no en tools.js) porque no comparten
// nada con las del servidor: no tienen ejecutor local, y la mitad del contrato
// es el `efecto`, que tools.js no conoce.
//
// `efecto` es LA pieza de seguridad de esta fase. Quién pide confirmación no lo
// decide el modelo mirando el nombre de la tool ni sus argumentos: lo decide esta
// tabla. Una tool `write` SIEMPRE emite `confirm`, aunque el modelo jure que es
// inofensiva.

export const CLIENT_TOOLS = [
  {
    name: "erp_list_modules",
    efecto: "read",
    description: "Lista los módulos del ERP que podés abrir con erp_navigate, con su id y su nombre. Usalo cuando no sepas cómo se llama el módulo que necesitás.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "erp_read",
    efecto: "read",
    description: "Lee el estado actual de un módulo que ya está abierto: lo que el usuario cargó (state) y lo que el módulo calculó (derived). Sin `module` lee el que está en pantalla.",
    input_schema: {
      type: "object",
      properties: { module: { type: "string", description: "id del módulo, por ejemplo \"cabida\"" } },
      required: [],
    },
  },
  {
    name: "erp_navigate",
    efecto: "navigate",
    description: "Abre un módulo del ERP en la pantalla del usuario y devuelve su estado ya cargado. Es lo que usás para ir a ver algo que no está abierto.",
    input_schema: {
      type: "object",
      properties: {
        module: { type: "string", description: "id del módulo o del space, por ejemplo \"cabida\" o \"growth\"" },
        entityId: { type: "string", description: "opcional: id del proyecto o terreno a abrir dentro del módulo" },
      },
      required: ["module"],
    },
  },
  {
    name: "erp_action",
    efecto: "write",
    description: "Ejecuta una acción que MODIFICA lo que el usuario tiene en pantalla. Siempre se le pide confirmación antes de correr: proponé la acción con los argumentos exactos y esperá.",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", description: "nombre exacto de la acción" },
        args: { type: "object", description: "argumentos de la acción", additionalProperties: true },
      },
      required: ["action"],
    },
  },
];

const POR_NOMBRE = new Map(CLIENT_TOOLS.map(t => [t.name, t]));

export const esClientTool = (nombre) => POR_NOMBRE.has(nombre);
export const efectoDe = (nombre) => POR_NOMBRE.get(nombre)?.efecto;

// Saca `efecto` antes de que la definición viaje a la API: es un campo nuestro y
// el contrato de tools de Anthropic no lo tiene.
const paraLaApi = ({ efecto, ...resto }) => resto;

// Las tools que se le ofrecen al modelo se filtran por lo que el contexto dice
// que está disponible acá y ahora (spec §"Filtrado de tools por contexto"). Las
// tres de lectura/navegación van siempre: sin ellas Alicia no puede ni averiguar
// qué existe. `erp_action` es la que se recorta, y fuerte: su enum son
// EXACTAMENTE las acciones que el módulo activo declaró. Así el modelo no puede
// ni nombrar una acción que el bus no tiene registrada.
export function clientToolsPara(erpContext) {
  const base = CLIENT_TOOLS.filter(t => t.efecto !== "write").map(paraLaApi);

  const activo = erpContext && typeof erpContext === "object" ? erpContext.active : null;
  const acciones = activo && typeof activo === "object" && Array.isArray(activo.actions)
    ? activo.actions.filter(a => typeof a === "string" && a)
    : [];
  if (!acciones.length) return base;

  const plantilla = POR_NOMBRE.get("erp_action");
  const conEnum = {
    ...paraLaApi(plantilla),
    input_schema: {
      ...plantilla.input_schema,
      properties: {
        ...plantilla.input_schema.properties,
        action: { ...plantilla.input_schema.properties.action, enum: acciones },
      },
    },
  };
  return [...base, conEnum];
}
