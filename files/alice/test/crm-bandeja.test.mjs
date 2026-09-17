// El orden de la bandeja y el armado de la ficha. Es lo que decide a quién le
// escribe José primero, así que es lógica de negocio, no de presentación.
import test from "node:test";
import assert from "node:assert/strict";
import {
  ordenarBandeja, filtrarBandeja, contarPorTemperatura, armarFicha, valorLegible,
  camposSinCita,
} from "../src/modules/crm/bandeja.js";

const lead = (over = {}) => ({
  id: "L", canal: "whatsapp", temperatura: "frio", etapa: "captura",
  aliceId: null, ultimoContacto: "2026-09-16T10:00:00Z", descartadoAt: null, ...over,
});

// ── orden ───────────────────────────────────────────────────────────────────

test("primero los hot, después tibios, después fríos", () => {
  const r = ordenarBandeja([lead({ id: "f", temperatura: "frio" }),
                            lead({ id: "h", temperatura: "hot", temperaturaCita: "planos" }),
                            lead({ id: "t", temperatura: "tibio", temperaturaCita: "busco" })]);
  assert.deepEqual(r.map(l => l.id), ["h", "t", "f"]);
});

test("dentro de la misma temperatura, el que nadie tomó va primero", () => {
  // Un lead hot con dueño ya lo está trabajando alguien. El que no tiene dueño es
  // el que se está enfriando mientras nadie lo mira: ese es el que urge.
  const r = ordenarBandeja([lead({ id: "conDueno", temperatura: "hot", temperaturaCita: "x", aliceId: "jt" }),
                            lead({ id: "sinDueno", temperatura: "hot", temperaturaCita: "x" })]);
  assert.deepEqual(r.map(l => l.id), ["sinDueno", "conDueno"]);
});

test("a igual temperatura y dueño, el que escribió hace menos va primero", () => {
  // La intención de compra dura horas, no días (spec §1): el que acaba de escribir
  // es el que todavía está del otro lado.
  const r = ordenarBandeja([lead({ id: "viejo", ultimoContacto: "2026-09-10T10:00:00Z" }),
                            lead({ id: "nuevo", ultimoContacto: "2026-09-16T10:00:00Z" })]);
  assert.deepEqual(r.map(l => l.id), ["nuevo", "viejo"]);
});

test("los descartados caen al final aunque estén calientes", () => {
  const r = ordenarBandeja([lead({ id: "muerto", temperatura: "hot", temperaturaCita: "x", descartadoAt: "2026-09-15T10:00:00Z" }),
                            lead({ id: "vivo", temperatura: "frio" })]);
  assert.deepEqual(r.map(l => l.id), ["vivo", "muerto"]);
});

test("ordenar no muta la lista que recibe", () => {
  const original = [lead({ id: "a", temperatura: "frio" }), lead({ id: "b", temperatura: "hot", temperaturaCita: "x" })];
  const copia = [...original];
  ordenarBandeja(original);
  assert.deepEqual(original.map(l => l.id), copia.map(l => l.id));
});

test("una lista vacía o nula devuelve lista vacía, no explota", () => {
  assert.deepEqual(ordenarBandeja([]), []);
  assert.deepEqual(ordenarBandeja(null), []);
});

// ── filtros ─────────────────────────────────────────────────────────────────

test("por defecto la bandeja no muestra descartados", () => {
  const r = filtrarBandeja([lead({ id: "a" }), lead({ id: "d", descartadoAt: "2026-09-15T10:00:00Z" })], {});
  assert.deepEqual(r.map(l => l.id), ["a"]);
});

test("se pueden pedir los descartados explícitamente", () => {
  const ls = [lead({ id: "a" }), lead({ id: "d", descartadoAt: "2026-09-15T10:00:00Z" })];
  assert.equal(filtrarBandeja(ls, { incluirDescartados: true }).length, 2);
});

test("filtra por dueño, temperatura y etapa", () => {
  const ls = [
    lead({ id: "1", aliceId: "jt", temperatura: "hot", temperaturaCita: "x", etapa: "handoff" }),
    lead({ id: "2", aliceId: "jt", temperatura: "frio", etapa: "captura" }),
    lead({ id: "3", aliceId: "sb", temperatura: "hot", temperaturaCita: "x", etapa: "handoff" }),
  ];
  assert.deepEqual(filtrarBandeja(ls, { aliceId: "jt" }).map(l => l.id), ["1", "2"]);
  assert.deepEqual(filtrarBandeja(ls, { temperatura: "hot" }).map(l => l.id), ["1", "3"]);
  assert.deepEqual(filtrarBandeja(ls, { etapa: "captura" }).map(l => l.id), ["2"]);
});

test("'sin dueño' es un filtro propio: es la cola que nadie está mirando", () => {
  const ls = [lead({ id: "1", aliceId: "jt" }), lead({ id: "2", aliceId: null })];
  assert.deepEqual(filtrarBandeja(ls, { aliceId: "__sin_dueno__" }).map(l => l.id), ["2"]);
});

test("el conteo por temperatura ignora descartados", () => {
  const c = contarPorTemperatura([
    lead({ temperatura: "hot", temperaturaCita: "x" }),
    lead({ temperatura: "hot", temperaturaCita: "x", descartadoAt: "2026-09-15T10:00:00Z" }),
    lead({ temperatura: "frio" }),
  ]);
  assert.equal(c.hot, 1);
  assert.equal(c.frio, 1);
  assert.equal(c.tibio, 0);
});

// ── ficha ───────────────────────────────────────────────────────────────────

const personaRow = {
  motivacion: "mudarse con su pareja", motivacion_cita: "nos queremos mudar con mi esposa",
  metraje_min: 80, metraje_max: 100, metraje_cita: "algo entre 80 y 100",
  plazo_texto: "antes de fin de año", plazo_meses: null, plazo_cita: "queremos estar antes de fin de año",
};

test("la ficha arma los datos del dossier, cada uno con su cita", () => {
  const f = armarFicha({ lead: lead({ id: "L1" }), personaRow, eventos: [] });
  const mot = f.datos.find(d => d.campo === "motivacion");
  assert.equal(mot.valor, "mudarse con su pareja");
  assert.equal(mot.cita, "nos queremos mudar con mi esposa");
  assert.equal(mot.etiqueta, "Busca", "las mismas etiquetas que el dossier de WhatsApp");
});

test("la ficha no incluye campos sin evidencia", () => {
  const f = armarFicha({ lead: lead(), personaRow: { hogar: "pareja", hogar_cita: null }, eventos: [] });
  assert.equal(f.datos.length, 0);
  assert.equal(f.vacia, true, "y lo dice, en vez de mostrar una ficha que parece llena");
});

test("los datos salen en el orden del dossier, no en el que vinieron", () => {
  const f = armarFicha({ lead: lead(), personaRow, eventos: [] });
  assert.deepEqual(f.datos.map(d => d.campo), ["motivacion", "metraje", "plazo"]);
});

test("el hilo va en orden cronológico y separa mensajes del resto", () => {
  const eventos = [
    { id: 3, tipo: "handoff", texto: "te paso con José", createdAt: "2026-09-16T12:00:00Z" },
    { id: 1, tipo: "mensaje", direccion: "entrante", texto: "hola", createdAt: "2026-09-16T10:00:00Z" },
    { id: 2, tipo: "mensaje", direccion: "saliente", texto: "hola!", createdAt: "2026-09-16T11:00:00Z" },
  ];
  const f = armarFicha({ lead: lead(), personaRow, eventos });
  assert.deepEqual(f.hilo.map(e => e.id), [1, 2]);
  assert.deepEqual(f.timeline.map(e => e.id), [1, 2, 3], "la línea de tiempo lleva todo");
});

test("el metraje se lee como en el dossier", () => {
  assert.equal(valorLegible("metraje", { min: 80, max: 100 }), "80 a 100 m2");
  // "90 a 90" delata una plantilla; el dossier ya lo colapsa y la ficha también.
  assert.equal(valorLegible("metraje", { min: 90, max: 90 }), "90 m2");
  assert.equal(valorLegible("metraje", { min: null, max: 100 }), "100 m2");
});

test("el lead se puede tomar si no tiene dueño o si es de otro", () => {
  assert.equal(armarFicha({ lead: lead({ aliceId: null }), personaRow, eventos: [], yo: "jt" }).tomable, true);
  assert.equal(armarFicha({ lead: lead({ aliceId: "sb" }), personaRow, eventos: [], yo: "jt" }).tomable, true);
  assert.equal(armarFicha({ lead: lead({ aliceId: "jt" }), personaRow, eventos: [], yo: "jt" }).tomable, false);
});

// ── carga manual · el CHECK del esquema, avisado antes de guardar ───────────
// personaARow DESCARTA en silencio el dato sin cita, que es lo correcto cuando el
// que extrae es un modelo. Pero si José tipeó el dato y desaparece sin decir nada,
// es peor que un error: creyó que guardó. Por eso la ficha chequea antes.

test("avisa qué campos quedaron sin la frase que los sostiene", () => {
  const faltan = camposSinCita({
    motivacion: { valor: "mudarse", cita: "" },
    hogar: { valor: "pareja", cita: "somos dos" },
    metraje: { min: 80, cita: "" },
  });
  assert.deepEqual(faltan.map(f => f.campo).sort(), ["metraje", "motivacion"]);
  assert.match(faltan[0].etiqueta, /\w/, "el aviso nombra el campo como lo ve José");
});

test("un campo vacío del todo no es un error: es un dato que no se cargó", () => {
  assert.deepEqual(camposSinCita({ motivacion: { valor: "", cita: "" } }), []);
  assert.deepEqual(camposSinCita({}), []);
});

test("una cita sin dato también se avisa", () => {
  // Es el otro lado del mismo CHECK: evidencia de nada no es evidencia.
  const faltan = camposSinCita({ plazo: { valor: "", cita: "me dijo algo de fin de año" } });
  assert.deepEqual(faltan.map(f => f.campo), ["plazo"]);
});

test("una ficha sin lead no rompe", () => {
  const f = armarFicha({ lead: null, personaRow: null, eventos: null });
  assert.equal(f.lead, null);
  assert.deepEqual(f.datos, []);
  assert.deepEqual(f.hilo, []);
});
