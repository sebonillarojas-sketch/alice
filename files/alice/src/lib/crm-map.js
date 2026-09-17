// CRM · la traducción entre lo que produce el motor de Mica y las columnas del CRM.
//
// Por qué vive en un archivo propio y no adentro de crm.js: `lib/supabase.js` parchea
// `window.fetch` al importarse, así que cualquier módulo que lo toque explota fuera del
// browser. Esto es la parte delicada y la que hay que poder probar con `node --test`,
// entonces no puede depender de nada. Sin imports, a propósito.
//
// La costura que cuida este archivo: el motor entrega {valor, cita} (o {min, max, cita}
// para el metraje, ver alicia-brain/src/mica/persona.js) y la base guarda columnas
// gemelas `campo` + `campo_cita` con un CHECK que exige que viajen juntas. Un bug acá
// no se ve: escribe un dato sin su evidencia, o tira una fila entera por un campo malo.

// ── vocabularios · tienen que coincidir con los CHECK de supabase/crm.sql ────
export const TEMPERATURAS = ["hot", "tibio", "frio"];      // en orden de urgencia
export const ETAPAS = ["captura", "calificacion", "handoff", "atencion", "cotizacion", "cierre", "postventa"];
export const PRIORIDADES = ["sala", "habitaciones", "ambos"];
export const CANALES = ["whatsapp", "instagram", "messenger", "web"];
export const TIPOS_EVENTO = ["mensaje", "temperatura", "brochure", "handoff", "seguimiento", "etapa", "dueno", "nota"];
export const ESTADOS_UNIDAD = ["disponible", "separada", "vendida", "bloqueada"];

const txt = (v) => {
  const s = String(v ?? "").trim();
  return s ? s : null;
};

const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Un par (valor, cita) solo existe si existen los dos. Es el CHECK del esquema
// aplicado antes de salir: si acá dejáramos pasar uno solo, Postgres rechazaría la
// fila ENTERA y se perderían también los campos que sí estaban bien extraídos.
const par = (campo) => {
  if (!campo || typeof campo !== "object") return [null, null];
  const valor = txt(campo.valor);
  const cita = txt(campo.cita);
  if (!valor || !cita) return [null, null];
  return [valor, cita];
};

// "en 3 meses" → 3. Solo lo inequívoco: un número explícito pegado a su unidad.
// "un año y medio", "fin de año" o "cuando venda el depa" devuelven null a propósito
// — la regla de `hot` compara plazo ≤ 6 meses (spec §8), y un plazo adivinado
// convierte un lead tibio en caliente y le hace perder el día a José. El texto de la
// persona igual se guarda entero en `plazo_texto`: no se pierde nada por no adivinar.
export function mesesDesdeTexto(texto) {
  const s = String(texto ?? "").toLowerCase();
  const meses = s.match(/(\d+)\s*(mes|meses)\b/);
  if (meses) return Number(meses[1]);
  const anios = s.match(/(\d+)\s*(a[nñ]o|a[nñ]os)\b/);
  if (anios) return Number(anios[1]) * 12;
  return null;
}

// ── buyer persona ───────────────────────────────────────────────────────────

// {campo: {valor, cita}} → fila de crm_buyer_persona.
// Devuelve SIEMPRE las catorce columnas, incluso en null: el upsert reemplaza la fila
// completa, y un objeto parcial dejaría vivo el valor de una extracción anterior que
// la conversación ya desmintió. Un buyer persona es una foto del estado actual, no un
// acumulado.
export function personaARow(persona = {}) {
  const p = persona && typeof persona === "object" ? persona : {};

  const [motivacion, motivacionCita] = par(p.motivacion);
  const [hogar, hogarCita] = par(p.hogar);
  const [tipologia, tipologiaCita] = par(p.tipologia);

  // Prioridad viene de una pregunta cerrada (§6: "¿sala amplia o más espacio en las
  // habitaciones?"). Si el modelo contesta otra cosa, el CHECK de Postgres tumbaría
  // la fila entera; descartar el campo acá convierte un error total en un dato menos.
  let [prioridad, prioridadCita] = par(p.prioridad);
  if (prioridad && !PRIORIDADES.includes(prioridad)) { prioridad = null; prioridadCita = null; }

  // Plazo: manda el texto. `plazo_meses` es una lectura opcional de ese texto.
  const [plazoTexto, plazoCita] = par(p.plazo);
  const plazoMeses = plazoTexto ? mesesDesdeTexto(`${plazoTexto} ${plazoCita}`) : null;

  // Metraje: una sola cita sostiene el rango. Alcanza con un extremo — "mínimo 90" es
  // un dato. Si no hay ningún número, la cita no sostiene nada y se cae el campo.
  let metrajeMin = null, metrajeMax = null, metrajeCita = null;
  const m = p.metraje;
  if (m && typeof m === "object") {
    const cita = txt(m.cita);
    let min = num(m.min), max = num(m.max);
    // Invertido se endereza en vez de romper el CHECK del rango: "de 100 a 80" es la
    // misma búsqueda dicha al revés, no un dato distinto.
    if (min !== null && max !== null && max < min) [min, max] = [max, min];
    if (cita && (min !== null || max !== null)) {
      metrajeMin = min; metrajeMax = max; metrajeCita = cita;
    }
  }

  return {
    motivacion, motivacion_cita: motivacionCita,
    hogar, hogar_cita: hogarCita,
    metraje_min: metrajeMin, metraje_max: metrajeMax, metraje_cita: metrajeCita,
    tipologia, tipologia_cita: tipologiaCita,
    // El match contra el catálogo real es otro paso (y otra decisión): acá solo va lo
    // que dijo la persona, con sus palabras.
    tipologia_id: null,
    prioridad, prioridad_cita: prioridadCita,
    plazo_texto: plazoTexto, plazo_meses: plazoMeses, plazo_cita: plazoCita,
  };
}

// Fila → {campo: {valor, cita}}, que es la forma que consume el dossier (mica/dossier.js)
// y la ficha. Un campo sin cita NO se devuelve: si alguna vez entra una fila sin
// evidencia (CHECK deshabilitado a mano, importación vieja), la pantalla no puede
// mostrarla como si estuviera respaldada. Lo que no tiene prueba, no se muestra.
export function personaDesdeRow(row) {
  if (!row || typeof row !== "object") return {};
  const out = {};
  const simple = (campo, col = campo, colCita = `${campo}_cita`) => {
    const valor = txt(row[col]), cita = txt(row[colCita]);
    if (valor && cita) out[campo] = { valor, cita };
  };
  simple("motivacion");
  simple("hogar");
  simple("tipologia");
  simple("prioridad");
  simple("plazo", "plazo_texto", "plazo_cita");

  const mCita = txt(row.metraje_cita);
  const min = num(row.metraje_min), max = num(row.metraje_max);
  if (mCita && (min !== null || max !== null)) out.metraje = { min, max, cita: mCita };

  if (row.forma && typeof row.forma === "object") out.forma = row.forma;
  return out;
}

// ── leads ───────────────────────────────────────────────────────────────────

export function leadDesdeRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    canal: r.canal,
    externalId: r.external_id,
    telefono: r.telefono,
    nombre: r.nombre,
    correo: r.correo,
    proyectoId: r.proyecto_id,
    temperatura: r.temperatura,
    temperaturaCita: r.temperatura_cita,
    temperaturaAt: r.temperatura_at,
    etapa: r.etapa,
    handoffAt: r.handoff_at,
    aliceId: r.alice_id,
    fuente: r.fuente,
    fuenteRef: r.fuente_ref,
    primerContacto: r.primer_contacto,
    ultimoContacto: r.ultimo_contacto,
    descartadoAt: r.descartado_at,
    descartadoMotivo: r.descartado_motivo,
  };
}

export function leadARow(lead = {}) {
  const temperatura = lead.temperatura || "frio";
  const cita = txt(lead.temperaturaCita);
  // El CHECK del esquema, adelantado. Sin esto el error llega como un 400 opaco de
  // PostgREST en medio de un guardado, y nadie sabe qué campo lo causó.
  if (temperatura !== "frio" && !cita) {
    throw new Error(
      `Un lead ${temperatura} necesita la cita textual que lo justifica. ` +
      `Sin la frase que lo dijo, la temperatura no es un dato: es una opinión.`);
  }
  if (!CANALES.includes(lead.canal)) throw new Error(`Canal desconocido: ${lead.canal}`);

  const row = {
    canal: lead.canal,
    external_id: txt(lead.externalId),
    telefono: txt(lead.telefono),
    nombre: txt(lead.nombre),
    correo: txt(lead.correo),
    proyecto_id: txt(lead.proyectoId),
    temperatura,
    temperatura_cita: cita,
    etapa: ETAPAS.includes(lead.etapa) ? lead.etapa : "captura",
    alice_id: txt(lead.aliceId),
    fuente: txt(lead.fuente),
    fuente_ref: txt(lead.fuenteRef),
    descartado_at: lead.descartadoAt ?? null,
    descartado_motivo: txt(lead.descartadoMotivo),
  };
  if (lead.id) row.id = lead.id;
  if (cita) row.temperatura_at = lead.temperaturaAt ?? new Date().toISOString();
  if (lead.handoffAt) row.handoff_at = lead.handoffAt;
  // `primer_contacto`, `created_at` y `updated_at` no se mandan nunca: los pone la
  // base. Mandarlos desde el cliente pisaría el primer contacto en cada edición, y
  // "hace cuánto que lo tenemos" dejaría de ser cierto.
  return row;
}

// ── eventos ─────────────────────────────────────────────────────────────────

export function eventoARow(ev = {}) {
  if (!TIPOS_EVENTO.includes(ev.tipo)) throw new Error(`Tipo de evento desconocido: ${ev.tipo}`);
  // Espeja el CHECK `crm_eventos_direccion_solo_mensaje`: un mensaje sin dirección no
  // se puede leer, y un handoff con dirección no significa nada.
  const esMensaje = ev.tipo === "mensaje";
  if (esMensaje && !["entrante", "saliente"].includes(ev.direccion)) {
    throw new Error("Un evento 'mensaje' necesita direccion 'entrante' o 'saliente'");
  }
  return {
    lead_id: ev.leadId,
    tipo: ev.tipo,
    direccion: esMensaje ? ev.direccion : null,
    actor: txt(ev.actor) || "mica",
    texto: txt(ev.texto),
    datos: ev.datos && typeof ev.datos === "object" ? ev.datos : {},
  };
}

export function eventoDesdeRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    leadId: r.lead_id,
    tipo: r.tipo,
    direccion: r.direccion,
    actor: r.actor,
    texto: r.texto,
    datos: r.datos || {},
    createdAt: r.created_at,
  };
}

// ── plata ───────────────────────────────────────────────────────────────────

// SIEMPRE con la moneda al lado. El CRM quedó en USD (decisión de Sebastián, 17 sep
// 2026) pero `rental_comps` está en PEN y no hay tipo de cambio en el sistema: dos
// números pelados en la misma pantalla son dos monedas mezcladas sin avisar, y ese es
// el bug que nadie ve hasta que alguien cotiza mal. Sin moneda explícita no se imprime
// el monto — preferimos un guion a una cifra ambigua.
export function fmtMonto(n, moneda) {
  const v = num(n);
  const m = txt(moneda);
  if (v === null || !m) return "—";
  return `${m} ${Math.round(v).toLocaleString("es-PE")}`;
}

// ── errores ─────────────────────────────────────────────────────────────────

// Qué lee José cuando algo no guarda.
//
// El CHECK de citas es firme también para la carga manual (decisión de Sebastián,
// 17 sep 2026), y una restricción que la interfaz no acompaña se vuelve un muro: la
// gente pega "x" con tal de guardar, el CHECK queda verde y la evidencia es basura.
// Por eso el mensaje dice QUÉ falta y PARA QUÉ sirve — nunca el texto crudo de
// Postgres, que no le explica nada a nadie y encima invita a bordearlo.
const POR_CONSTRAINT = {
  crm_bp_motivacion_con_cita: "la motivación",
  crm_bp_hogar_con_cita: "la composición del hogar",
  crm_bp_tipologia_con_cita: "la tipología",
  crm_bp_prioridad_con_cita: "la prioridad",
  crm_bp_plazo_con_cita: "el plazo",
  crm_bp_metraje_con_cita: "el metraje",
};

export function mensajeDeError(error) {
  if (!error) return null;
  const msg = String(error.message || "");
  const nombre = (msg.match(/constraint "([^"]+)"/) || [])[1] || "";

  if (POR_CONSTRAINT[nombre]) {
    return `Falta la frase que sostiene ${POR_CONSTRAINT[nombre]}: escribí qué te dijo la ` +
      `persona, con sus palabras. Si no te acordás de la frase exacta, dejá el dato vacío — ` +
      `tres datos ciertos valen más que seis con dos inventados.`;
  }
  if (nombre === "crm_leads_temp_con_evidencia") {
    return "La temperatura necesita la frase que la justifica: qué dijo la persona que te " +
      "hizo pensar que está tibia o caliente. Sin eso, la temperatura es una opinión.";
  }
  if (nombre === "crm_bp_metraje_rango_ok") return "El metraje mínimo no puede ser mayor que el máximo.";
  if (nombre === "crm_bp_plazo_meses_sostenido") return "El plazo en meses necesita la frase de la que salió.";
  if (error.code === "23505") {
    return nombre.includes("unidades")
      ? "Esa unidad ya está cargada en el proyecto."
      : "Ese contacto ya existe en el CRM: buscalo en la bandeja en vez de crearlo de nuevo.";
  }
  if (error.code === "23514") return "Ese valor no es uno de los que acepta el campo.";
  // Lo que no sabemos explicar, no lo adornamos: lo importante es que la persona sepa
  // que NO se guardó, para que no siga escribiendo sobre algo que se va a perder.
  return "No se guardó. Probá de nuevo; si sigue igual, avisá con lo que estabas cargando.";
}
