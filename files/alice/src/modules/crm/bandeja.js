// La bandeja y la ficha, sin React.
// Acá vive la única pregunta que tiene que contestar esta pantalla: a quién le
// escribe José AHORA. Es lógica de negocio y por eso está separada de la vista y
// tiene tests (test/crm-bandeja.test.mjs).
import { personaDesdeRow, TEMPERATURAS } from "../../lib/crm-map.js";

// Las mismas etiquetas y el mismo orden que el dossier que José recibe por WhatsApp
// (alicia-brain/src/mica/dossier.js). No es coincidencia que estén duplicadas: son
// dos superficies distintas del mismo dossier, y si dicen cosas distintas José tiene
// que traducir entre el WhatsApp y el ERP justo cuando menos tiempo tiene.
export const ETIQUETAS = {
  motivacion: "Busca",
  hogar: "Son",
  metraje: "Metraje",
  tipologia: "Tipología",
  prioridad: "Prioriza",
  plazo: "Plazo",
};
const ORDEN_CAMPOS = Object.keys(ETIQUETAS);

export const SIN_DUENO = "__sin_dueno__";

const ts = (v) => {
  const t = Date.parse(v ?? "");
  return Number.isNaN(t) ? 0 : t;
};

// ── bandeja ─────────────────────────────────────────────────────────────────

export function filtrarBandeja(leads, filtros = {}) {
  const { aliceId, temperatura, etapa, incluirDescartados = false } = filtros;
  return (leads || []).filter((l) => {
    if (!l) return false;
    // Un lead descartado no es un lead pendiente. Sigue existiendo (la auditoría no
    // se borra) pero no compite por la atención de José salvo que lo pida.
    if (!incluirDescartados && l.descartadoAt) return false;
    if (aliceId === SIN_DUENO) { if (l.aliceId) return false; }
    else if (aliceId && l.aliceId !== aliceId) return false;
    if (temperatura && l.temperatura !== temperatura) return false;
    if (etapa && l.etapa !== etapa) return false;
    return true;
  });
}

// El orden es la opinión de esta pantalla sobre qué es urgente, en este orden:
//   1. los descartados al fondo, siempre;
//   2. temperatura — solo `hot` dispara handoff (§8), así que es lo primero;
//   3. sin dueño antes que con dueño: un lead hot que nadie tomó es el que se está
//      enfriando mientras todos miran para otro lado. El que ya tiene dueño está
//      siendo trabajado;
//   4. último contacto más reciente primero — "la intención de compra dura horas, no
//      días" (§1): el que acaba de escribir sigue del otro lado.
export function ordenarBandeja(leads) {
  const peso = (t) => {
    const i = TEMPERATURAS.indexOf(t);
    return i === -1 ? TEMPERATURAS.length : i;   // una temperatura rara va al fondo
  };
  // Copia: ordenar in-place mutaría el estado de React y el re-render no se entera.
  return [...(leads || [])].sort((a, b) => {
    const da = a.descartadoAt ? 1 : 0, db = b.descartadoAt ? 1 : 0;
    if (da !== db) return da - db;
    const pa = peso(a.temperatura), pb = peso(b.temperatura);
    if (pa !== pb) return pa - pb;
    const sa = a.aliceId ? 1 : 0, sb = b.aliceId ? 1 : 0;
    if (sa !== sb) return sa - sb;
    return ts(b.ultimoContacto) - ts(a.ultimoContacto);
  });
}

export function contarPorTemperatura(leads) {
  const out = Object.fromEntries(TEMPERATURAS.map(t => [t, 0]));
  for (const l of leads || []) {
    if (!l || l.descartadoAt) continue;          // un descartado no es carga de trabajo
    if (l.temperatura in out) out[l.temperatura] += 1;
  }
  return out;
}

// ── carga manual ────────────────────────────────────────────────────────────

// Qué campos quedaron a medias antes de intentar guardar.
//
// `personaARow` descarta en silencio el dato sin cita, y para el extractor está bien:
// un modelo que inventa una cita tiene que perder el dato. Pero si el que tipeó fue
// José y el dato desaparece sin decir nada, es peor que un error — creyó que guardó.
// Esto es lo que hace que el CHECK sea acompañable desde la pantalla en vez de un muro.
export function camposSinCita(persona = {}) {
  const faltan = [];
  for (const campo of ORDEN_CAMPOS) {
    const v = persona?.[campo];
    if (!v || typeof v !== "object") continue;
    const cita = String(v.cita ?? "").trim();
    const valor = campo === "metraje"
      ? [v.min, v.max].some(n => n !== null && n !== undefined && String(n).trim() !== "")
      : String(v.valor ?? "").trim() !== "";
    // Vacío del todo no es un error: es un dato que no se cargó, y está bien no
    // cargarlo. El problema es exactamente uno de los dos lados sin el otro.
    if (valor === Boolean(cita)) continue;
    faltan.push({ campo, etiqueta: ETIQUETAS[campo], falta: valor ? "cita" : "valor" });
  }
  return faltan;
}

// ── ficha ───────────────────────────────────────────────────────────────────

// Cómo se lee un valor. El metraje se arma igual que en el dossier: los extremos
// repetidos se colapsan, porque "90 a 90" delata una plantilla y no una persona.
export function valorLegible(campo, v) {
  if (!v) return "";
  if (campo !== "metraje") return String(v.valor ?? "");
  const nums = [...new Set([v.min, v.max].filter(n => n !== null && n !== undefined))];
  return nums.length ? `${nums.join(" a ")} m2` : "";
}

// El view-model de la ficha. `personaRow` entra como fila de la base y sale como
// lista ordenada de {campo, etiqueta, valor, cita} — nunca un valor sin su cita,
// porque personaDesdeRow ya descarta lo que no tiene evidencia.
export function armarFicha({ lead = null, personaRow = null, eventos = null, yo = null } = {}) {
  const persona = personaDesdeRow(personaRow);

  const datos = ORDEN_CAMPOS
    .filter(campo => persona[campo])
    .map(campo => ({
      campo,
      etiqueta: ETIQUETAS[campo],
      valor: valorLegible(campo, persona[campo]),
      cita: persona[campo].cita,
    }));

  // Orden cronológico: la ficha se lee como se vivió la conversación. El id desempata
  // porque dos eventos del mismo segundo existen (un mensaje y el cambio de
  // temperatura que ese mismo mensaje causó).
  const timeline = [...(eventos || [])].sort(
    (a, b) => (ts(a.createdAt) - ts(b.createdAt)) || ((a.id ?? 0) - (b.id ?? 0)));

  return {
    lead,
    persona,
    datos,
    // Una ficha sin datos sostenidos lo dice. Es la diferencia entre "todavía no
    // contó nada" y "no tenemos ni idea": la primera es información.
    vacia: datos.length === 0,
    hilo: timeline.filter(e => e.tipo === "mensaje"),
    timeline,
    forma: persona.forma || null,
    // Tomar el lead es reasignarlo a quien mira. Si ya es tuyo no hay nada que tomar.
    tomable: Boolean(yo) && lead?.aliceId !== yo,
  };
}
