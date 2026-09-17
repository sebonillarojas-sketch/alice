// El mapeo entre lo que produce el motor de Mica ({valor, cita}) y las columnas
// gemelas del CRM. Es la costura donde un bug silencioso mete un dato sin su
// evidencia — exactamente lo que el esquema existe para impedir.
import test from "node:test";
import assert from "node:assert/strict";
import {
  personaARow, personaDesdeRow, leadDesdeRow, leadARow,
  eventoARow, eventoDesdeRow, mesesDesdeTexto, fmtMonto, mensajeDeError,
} from "../src/lib/crm-map.js";

// ── personaARow · del motor a la base ───────────────────────────────────────

test("un campo con valor y cita viaja entero", () => {
  const row = personaARow({ motivacion: { valor: "mudarse", cita: "nos queremos mudar" } });
  assert.equal(row.motivacion, "mudarse");
  assert.equal(row.motivacion_cita, "nos queremos mudar");
});

test("un valor SIN cita no viaja: se cae el campo, no la fila", () => {
  const row = personaARow({
    motivacion: { valor: "mudarse" },                                  // sin cita
    hogar: { valor: "pareja con un hijo", cita: "somos tres" },        // completo
  });
  assert.equal(row.motivacion, null);
  assert.equal(row.motivacion_cita, null);
  // Lo bueno sobrevive: si dejáramos caer la fila entera, un campo mal extraído
  // borraría todo lo que sí estaba sostenido.
  assert.equal(row.hogar, "pareja con un hijo");
});

test("una cita huérfana tampoco viaja", () => {
  const row = personaARow({ hogar: { cita: "somos tres" } });
  assert.equal(row.hogar, null);
  assert.equal(row.hogar_cita, null);
});

test("los blancos cuentan como vacío: ' ' no es una cita", () => {
  const row = personaARow({ motivacion: { valor: "mudarse", cita: "   " } });
  assert.equal(row.motivacion, null);
  assert.equal(row.motivacion_cita, null);
});

test("metraje: el rango entra con min, max y una sola cita", () => {
  const row = personaARow({ metraje: { min: 80, max: 100, cita: "entre 80 y 100" } });
  assert.equal(row.metraje_min, 80);
  assert.equal(row.metraje_max, 100);
  assert.equal(row.metraje_cita, "entre 80 y 100");
});

test("metraje: alcanza con un extremo", () => {
  const row = personaARow({ metraje: { min: 90, cita: "mínimo 90" } });
  assert.equal(row.metraje_min, 90);
  assert.equal(row.metraje_max, null);
  assert.equal(row.metraje_cita, "mínimo 90");
});

test("metraje sin ningún número no entra, aunque traiga cita", () => {
  const row = personaARow({ metraje: { cita: "algo grande" } });
  assert.equal(row.metraje_min, null);
  assert.equal(row.metraje_max, null);
  assert.equal(row.metraje_cita, null);
});

test("metraje invertido se endereza en vez de romper el CHECK del rango", () => {
  const row = personaARow({ metraje: { min: 100, max: 80, cita: "de 100 a 80" } });
  assert.equal(row.metraje_min, 80);
  assert.equal(row.metraje_max, 100);
});

test("prioridad fuera del vocabulario se descarta con su cita", () => {
  // El modelo tiene instruido devolver sala|habitaciones|ambos, pero si se sale
  // del libreto el CHECK de Postgres rechazaría la fila ENTERA. Filtrar acá
  // convierte un error total en un campo menos.
  const row = personaARow({ prioridad: { valor: "cocina", cita: "me importa la cocina" } });
  assert.equal(row.prioridad, null);
  assert.equal(row.prioridad_cita, null);
});

test("prioridad del vocabulario pasa", () => {
  const row = personaARow({ prioridad: { valor: "sala", cita: "quiero una sala grande" } });
  assert.equal(row.prioridad, "sala");
});

test("plazo: el texto de la persona se guarda tal cual", () => {
  const row = personaARow({ plazo: { valor: "para antes de fin de año", cita: "antes de fin de año" } });
  assert.equal(row.plazo_texto, "para antes de fin de año");
  assert.equal(row.plazo_cita, "antes de fin de año");
  assert.equal(row.plazo_meses, null, "no hay número inequívoco: no se inventa uno");
});

test("plazo: si la frase trae un número claro, se normaliza a meses", () => {
  assert.equal(personaARow({ plazo: { valor: "en 3 meses", cita: "en 3 meses" } }).plazo_meses, 3);
  assert.equal(personaARow({ plazo: { valor: "en 2 años", cita: "en 2 años" } }).plazo_meses, 24);
});

test("tipologia guarda lo que dijo la persona, sin traducir", () => {
  const row = personaARow({ tipologia: { valor: "townhouse", cita: "el townhouse que vi" } });
  assert.equal(row.tipologia, "townhouse");
  assert.equal(row.tipologia_id, null, "el match contra el catálogo es otro paso");
});

test("una persona vacía no escribe nada, pero devuelve todas las columnas en null", () => {
  const row = personaARow({});
  // Todas las columnas presentes y en null: un upsert parcial dejaría vivos los
  // valores de una extracción anterior que la conversación ya desmintió.
  for (const k of ["motivacion", "motivacion_cita", "hogar", "hogar_cita",
                   "metraje_min", "metraje_max", "metraje_cita",
                   "tipologia", "tipologia_cita",
                   "prioridad", "prioridad_cita",
                   "plazo_texto", "plazo_meses", "plazo_cita"]) {
    assert.equal(row[k], null, `${k} debería venir en null`);
  }
});

test("no se cuela basura: entradas que no son objetos se ignoran", () => {
  const row = personaARow({ motivacion: "mudarse", hogar: null, metraje: 80 });
  assert.equal(row.motivacion, null);
  assert.equal(row.hogar, null);
  assert.equal(row.metraje_min, null);
});

// ── mesesDesdeTexto · la normalización, aislada ─────────────────────────────

test("solo normaliza lo inequívoco", () => {
  assert.equal(mesesDesdeTexto("en 6 meses"), 6);
  assert.equal(mesesDesdeTexto("1 mes"), 1);
  assert.equal(mesesDesdeTexto("un año y medio"), null, "'un' no es un número explícito");
  assert.equal(mesesDesdeTexto("fin de año"), null);
  assert.equal(mesesDesdeTexto("cuando venda el depa"), null);
  assert.equal(mesesDesdeTexto(""), null);
  assert.equal(mesesDesdeTexto(undefined), null);
});

// ── personaDesdeRow · de la base a la pantalla ──────────────────────────────

test("la vuelta reconstruye {valor, cita}", () => {
  const p = personaDesdeRow({ motivacion: "mudarse", motivacion_cita: "nos mudamos" });
  assert.deepEqual(p.motivacion, { valor: "mudarse", cita: "nos mudamos" });
});

test("la vuelta NO muestra un dato sin cita, aunque esté en la fila", () => {
  // Si alguna vez entra una fila sin evidencia (CHECK deshabilitado, import viejo),
  // la pantalla no puede mostrarla como si estuviera respaldada: se omite.
  const p = personaDesdeRow({ hogar: "pareja", hogar_cita: null });
  assert.equal(p.hogar, undefined);
});

test("la vuelta arma el metraje con la forma que espera el dossier", () => {
  const p = personaDesdeRow({ metraje_min: 80, metraje_max: 100, metraje_cita: "80 a 100" });
  assert.deepEqual(p.metraje, { min: 80, max: 100, cita: "80 a 100" });
});

test("ida y vuelta conserva lo que estaba sostenido", () => {
  const original = {
    motivacion: { valor: "mudarse", cita: "nos mudamos" },
    metraje: { min: 80, max: 100, cita: "entre 80 y 100" },
    prioridad: { valor: "sala", cita: "sala grande" },
  };
  const vuelta = personaDesdeRow(personaARow(original));
  assert.deepEqual(vuelta.motivacion, original.motivacion);
  assert.deepEqual(vuelta.metraje, original.metraje);
  assert.deepEqual(vuelta.prioridad, original.prioridad);
});

test("plazo vuelve con el texto de la persona, no con el número", () => {
  const p = personaDesdeRow({ plazo_texto: "antes de fin de año", plazo_meses: null, plazo_cita: "fin de año" });
  assert.equal(p.plazo.valor, "antes de fin de año");
  assert.equal(p.plazo.cita, "fin de año");
});

test("una fila nula no rompe la pantalla", () => {
  assert.deepEqual(personaDesdeRow(null), {});
  assert.deepEqual(personaDesdeRow(undefined), {});
});

// ── leads ───────────────────────────────────────────────────────────────────

test("el lead viaja a camelCase sin perder la evidencia de temperatura", () => {
  const lead = leadDesdeRow({
    id: "L1", canal: "whatsapp", external_id: "+51999", telefono: "+51999",
    nombre: "Ana", temperatura: "hot", temperatura_cita: "pasame los planos",
    etapa: "handoff", alice_id: "jt", ultimo_contacto: "2026-09-16T10:00:00Z",
  });
  assert.equal(lead.temperatura, "hot");
  assert.equal(lead.temperaturaCita, "pasame los planos");
  assert.equal(lead.aliceId, "jt");
  assert.equal(lead.ultimoContacto, "2026-09-16T10:00:00Z");
});

test("un lead tibio o hot sin cita no se puede escribir", () => {
  // Es el CHECK de Postgres, adelantado: mejor un error claro acá que un 400 opaco.
  assert.throws(() => leadARow({ canal: "whatsapp", temperatura: "hot" }), /cita/i);
});

test("un lead frío sin cita sí: frío es la ausencia de evidencia", () => {
  const row = leadARow({ canal: "web", temperatura: "frio" });
  assert.equal(row.temperatura, "frio");
  assert.equal(row.temperatura_cita, null);
});

test("leadARow no manda columnas que no le tocan", () => {
  const row = leadARow({ id: "L1", canal: "web", temperatura: "frio" });
  assert.equal("created_at" in row, false);
  assert.equal("primer_contacto" in row, false, "lo pone la base y no se pisa al actualizar");
});

// ── eventos ─────────────────────────────────────────────────────────────────

test("un mensaje exige dirección; los demás eventos no la llevan", () => {
  const msg = eventoARow({ leadId: "L1", tipo: "mensaje", direccion: "entrante", texto: "hola" });
  assert.equal(msg.direccion, "entrante");
  const ho = eventoARow({ leadId: "L1", tipo: "handoff", texto: "te paso con José" });
  assert.equal(ho.direccion, null);
  assert.throws(() => eventoARow({ leadId: "L1", tipo: "mensaje", texto: "hola" }), /direcci/i);
});

test("un tipo de evento inventado se rechaza antes de salir", () => {
  assert.throws(() => eventoARow({ leadId: "L1", tipo: "llamada" }), /tipo/i);
});

test("el evento vuelve con sus datos estructurados", () => {
  const e = eventoDesdeRow({ id: 7, lead_id: "L1", tipo: "temperatura", actor: "mica",
    texto: "pasame los planos", datos: { de: "tibio", a: "hot" }, created_at: "2026-09-16T10:00:00Z" });
  assert.equal(e.id, 7);
  assert.equal(e.leadId, "L1");
  assert.deepEqual(e.datos, { de: "tibio", a: "hot" });
});

// ── plata ───────────────────────────────────────────────────────────────────

test("todo monto sale con su moneda: rental_comps está en PEN y el CRM en USD", () => {
  assert.equal(fmtMonto(120000, "USD"), "USD 120,000");
  assert.equal(fmtMonto(120000, "PEN"), "PEN 120,000");
});

test("sin moneda explícita no se asume ninguna", () => {
  // Un número pelado al lado de un comp en soles es el bug que nadie ve hasta
  // que alguien cotiza mal. Preferimos no mostrar el monto.
  assert.equal(fmtMonto(120000, null), "—");
  assert.equal(fmtMonto(null, "USD"), "—");
});

// ── errores · lo que lee José cuando algo no guarda ─────────────────────────

test("el CHECK de citas se explica, no se transcribe", () => {
  const msg = mensajeDeError({
    code: "23514",
    message: 'new row for relation "crm_buyer_persona" violates check constraint "crm_bp_motivacion_con_cita"',
  });
  assert.match(msg, /qué te dijo|frase/i, "tiene que decir qué falta");
  assert.doesNotMatch(msg, /violates|check constraint|23514/i, "y nunca el texto de Postgres");
});

test("cada campo se explica por su nombre, no como 'un campo'", () => {
  assert.match(mensajeDeError({ code: "23514", message: 'constraint "crm_bp_metraje_con_cita"' }), /metraje/i);
  assert.match(mensajeDeError({ code: "23514", message: 'constraint "crm_leads_temp_con_evidencia"' }), /temperatura/i);
});

test("el lead duplicado dice que ya existe, no 'unique violation'", () => {
  const msg = mensajeDeError({ code: "23505", message: 'duplicate key value violates unique constraint "idx_crm_leads_canal_externo"' });
  assert.match(msg, /ya (existe|está)/i);
  assert.doesNotMatch(msg, /duplicate key|unique constraint/i);
});

test("un error que no conocemos no se inventa: se avisa que no se guardó", () => {
  const msg = mensajeDeError({ code: "08006", message: "connection failure" });
  assert.match(msg, /no se guard/i);
});

test("sin error no hay mensaje", () => {
  assert.equal(mensajeDeError(null), null);
});
