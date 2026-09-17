// CRM comercial · la capa de datos.
// Mismo patrón que lib/supabase.js: un objeto con métodos async, mappers afuera.
//
// Los mappers viven en crm-map.js y no acá a propósito: este archivo importa
// `supabase.js`, que parchea `window.fetch` al cargarse, así que no se puede importar
// desde `node --test`. Toda la lógica que hay que poder probar está del otro lado.
//
// Lo que este archivo deliberadamente NO expone:
//   · borrar un lead — el trigger append-only de crm_eventos lo impide mientras tenga
//     historia, y está bien que así sea: un lead no se borra, se descarta (§11).
//   · editar o borrar un evento — crm_eventos es append-only. Si esta capa tuviera un
//     `updateEvento`, alguien lo llamaría y se comería un 403 sin entender por qué.
import { supabase } from "./supabase.js";
import {
  leadDesdeRow, leadARow, personaARow, eventoARow, eventoDesdeRow, mensajeDeError,
} from "./crm-map.js";

// Todo error de PostgREST sale de acá traducido. El texto crudo ("violates check
// constraint...") no le explica nada a José y encima lo invita a bordear la regla.
// El original queda en `causa` para la consola, no para la pantalla.
function fallo(error, contexto) {
  const e = new Error(mensajeDeError(error));
  e.causa = error;
  e.contexto = contexto;
  console.error(`[crm] ${contexto}:`, error);
  return e;
}

export const crm = {
  // ── lectura ───────────────────────────────────────────────────────────────

  // La bandeja. El filtrado fino y el orden los hace bandeja.js (es lógica con tests);
  // acá solo se recorta lo que no tiene sentido traer entero del servidor.
  async getLeads({ aliceId, temperatura, etapa, limite = 200 } = {}) {
    let q = supabase.from("crm_leads").select("*")
      .order("ultimo_contacto", { ascending: false })
      .limit(limite);
    if (aliceId) q = q.eq("alice_id", aliceId);
    if (temperatura) q = q.eq("temperatura", temperatura);
    if (etapa) q = q.eq("etapa", etapa);
    const { data, error } = await q;
    if (error) throw fallo(error, "leer leads");
    return (data || []).map(leadDesdeRow);
  },

  // La ficha completa: lead + buyer persona + línea de tiempo.
  // Tres consultas en paralelo y no un embed de PostgREST: el embed ata la pantalla a
  // que PostgREST detecte las foreign keys, y cuando no lo hace falla con un error de
  // esquema en vez de traer menos datos. Tres consultas explícitas fallan por separado
  // y se entiende cuál.
  async getFicha(leadId) {
    const [lead, persona, eventos] = await Promise.all([
      supabase.from("crm_leads").select("*").eq("id", leadId).single(),
      supabase.from("crm_buyer_persona").select("*").eq("lead_id", leadId).maybeSingle(),
      supabase.from("crm_eventos").select("*").eq("lead_id", leadId)
        .order("created_at", { ascending: true }).order("id", { ascending: true }),
    ]);
    if (lead.error) throw fallo(lead.error, "leer el lead");
    if (persona.error) throw fallo(persona.error, "leer el buyer persona");
    if (eventos.error) throw fallo(eventos.error, "leer la línea de tiempo");
    return {
      lead: leadDesdeRow(lead.data),
      // Fila cruda a propósito: la traduce armarFicha(), que es lo que tiene tests.
      personaRow: persona.data || null,
      eventos: (eventos.data || []).map(eventoDesdeRow),
    };
  },

  // El catálogo por la VISTA, no por las tablas: `crm_catalogo_mica` no tiene columnas
  // de precio (spec §6). Acá eso no es una restricción sino la fuente correcta de
  // "qué hay y cuánto queda"; los precios de una unidad se leen aparte, cuando José
  // abre el stock y sabe en qué moneda está mirando.
  async getCatalogo() {
    const { data, error } = await supabase.from("crm_catalogo_mica").select("*")
      .order("proyecto_id").order("tipologia");
    if (error) throw fallo(error, "leer el catálogo");
    return data || [];
  },

  async getUnidades(proyectoId) {
    const { data, error } = await supabase.from("crm_unidades").select("*")
      .eq("proyecto_id", proyectoId).order("torre").order("numero");
    if (error) throw fallo(error, "leer el stock");
    return data || [];
  },

  // ── escritura ─────────────────────────────────────────────────────────────

  // Alta o actualización. `leadARow` valida antes de salir (temperatura sin cita,
  // canal desconocido) para que el error llegue con nombre y no como un 400 opaco.
  async upsertLead(lead) {
    const row = leadARow(lead);
    const { data, error } = await supabase.from("crm_leads")
      .upsert(row, { onConflict: "id" }).select().single();
    if (error) throw fallo(error, "guardar el lead");
    return leadDesdeRow(data);
  },

  // Tomar el lead: reasignarlo a quien está mirando la bandeja.
  // Deja rastro SIEMPRE. Sin el evento, dos personas se pisan un lead y no queda
  // registro de quién llegó primero — que es justo lo que un CRM tiene que saber.
  async tomarLead(leadId, aliceId, dueñoAnterior = null) {
    const { data, error } = await supabase.from("crm_leads")
      .update({ alice_id: aliceId }).eq("id", leadId).select().single();
    if (error) throw fallo(error, "tomar el lead");
    await this.registrarEvento({
      leadId, tipo: "dueno", actor: aliceId,
      texto: `Tomó el lead`,
      datos: { de: dueñoAnterior, a: aliceId },
    });
    return leadDesdeRow(data);
  },

  async moverEtapa(leadId, etapa, actor) {
    const patch = { etapa };
    // `handoff_at` se sella una sola vez, cuando pasa. Si se recalculara en cada
    // movimiento, "¿cuándo se lo entregamos?" cambiaría de respuesta sola.
    if (etapa === "handoff") patch.handoff_at = new Date().toISOString();
    const { data, error } = await supabase.from("crm_leads")
      .update(patch).eq("id", leadId).select().single();
    if (error) throw fallo(error, "mover de etapa");
    await this.registrarEvento({ leadId, tipo: "etapa", actor, texto: etapa, datos: { a: etapa } });
    return leadDesdeRow(data);
  },

  // Descartar, que es lo que el esquema deja hacer en vez de borrar (§11: un "no me
  // interesa", o el silencio tras el cuarto toque, cierra el lead).
  async descartarLead(leadId, motivo, actor) {
    const { data, error } = await supabase.from("crm_leads")
      .update({ descartado_at: new Date().toISOString(), descartado_motivo: motivo || null })
      .eq("id", leadId).select().single();
    if (error) throw fallo(error, "descartar el lead");
    await this.registrarEvento({ leadId, tipo: "nota", actor, texto: motivo || "Lead descartado",
      datos: { descartado: true } });
    return leadDesdeRow(data);
  },

  // El buyer persona. Recibe la forma del motor ({campo: {valor, cita}}) y la traduce
  // a columnas gemelas. `personaARow` devuelve SIEMPRE las catorce columnas, también
  // las vacías: el upsert reemplaza la fila entera, y un objeto parcial dejaría vivo
  // un valor que la conversación ya desmintió.
  async guardarBuyerPersona(leadId, persona, forma = null) {
    const row = { lead_id: leadId, ...personaARow(persona) };
    if (forma) row.forma = forma;
    const { data, error } = await supabase.from("crm_buyer_persona")
      .upsert(row, { onConflict: "lead_id" }).select().single();
    if (error) throw fallo(error, "guardar el buyer persona");
    return data;
  },

  // Append y nada más: crm_eventos no tiene policy de update ni de delete.
  async registrarEvento(evento) {
    const { data, error } = await supabase.from("crm_eventos")
      .insert(eventoARow(evento)).select().single();
    if (error) throw fallo(error, "registrar el evento");
    return eventoDesdeRow(data);
  },

  // ── realtime ──────────────────────────────────────────────────────────────

  // Quien escribe estos leads es el brain, en otra máquina. Sin esto, José se entera
  // de un lead caliente recién cuando recarga — y lo que se pierde es el momento (§1).
  // El orden importa y es el mismo que documenta lib/supabase.js: getSession → setAuth
  // → subscribe. Suscribir antes de setear el token conecta como `anon`, y las policies
  // son `to authenticated`: el canal queda abierto y mudo, que es el peor de los dos
  // fracasos porque parece que anda.
  subscribeLeads(onChange) {
    let ch = null, cancelled = false;
    const attach = (t) => { if (t) { try { supabase.realtime.setAuth(t); } catch { /* noop */ } } };
    (async () => {
      try { const { data: { session } } = await supabase.auth.getSession(); attach(session?.access_token); } catch { /* noop */ }
      if (cancelled) return;
      ch = supabase
        .channel("crm-leads-realtime")
        .on("postgres_changes", { event: "*", schema: "public", table: "crm_leads" }, (payload) => {
          if (payload.eventType === "DELETE") onChange({ type: "DELETE", id: payload.old?.id });
          else onChange({ type: payload.eventType, lead: leadDesdeRow(payload.new) });
        })
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.warn("⚠️ realtime crm_leads:", status, "— revisá la publicación supabase_realtime");
          }
        });
    })();
    const { data: authSub } = supabase.auth.onAuthStateChange((_e, session) => attach(session?.access_token));
    return () => {
      cancelled = true;
      try { if (ch) supabase.removeChannel(ch); } catch { /* noop */ }
      try { authSub?.subscription?.unsubscribe(); } catch { /* noop */ }
    };
  },
};
