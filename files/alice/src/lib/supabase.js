import { createClient } from "@supabase/supabase-js";
import { ALICIA_URL } from "./brain.js";

const URL  = "https://apnzitklhxrcszectbxx.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwbnppdGtsaHhyY3N6ZWN0Ynh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4MjUzNjcsImV4cCI6MjA5OTQwMTM2N30.OdUe_GuchvgjoDxklh_nKxxNb_rPD_IpQzj8f_XyETI";

export const supabase = createClient(URL, ANON);

// ── JWT hacia aliceai (deuda #9, 14 jul 2026) ────────────────────────────────
// Toda llamada del ERP al backend de Alicia viaja con el access_token de la
// sesión: el gate del backend lo valida contra Supabase. Interceptor global
// para cubrir los ~15 call-sites (HyggeOS, AliciaView, módulos) sin tocarlos.
// En `vite dev` con el bypass no hay sesión → las rutas gateadas devuelven 401
// (esperado: el dev local es para UI; la IA se prueba en producción).
const _origFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  try {
    const url = typeof input === "string" ? input : (input?.url || "");
    if (url.includes("aliceai.bam.pe") || url.startsWith(ALICIA_URL)) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        init = { ...(init || {}) };
        init.headers = { ...(init.headers || {}), Authorization: `Bearer ${session.access_token}` };
      }
    }
  } catch { /* sin sesión → sigue sin header y el backend decide */ }
  return _origFetch(input, init);
};

// ─── tasks ───────────────────────────────────────────────────
export const db = {
  async getTasks() {
    const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(fromRow);
  },

  async upsertTask(task) {
    const { error } = await supabase.from("tasks").upsert(toRow(task), { onConflict: "id" });
    if (error) throw error;
  },

  async deleteTask(id) {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) throw error;
  },

  // Realtime: escucha INSERT/UPDATE/DELETE de la tabla tasks (respeta RLS).
  // onChange({ type, task?, id? }). Devuelve fn de cleanup para desuscribir.
  subscribeTasks(onChange) {
    // El realtime aplica RLS con el JWT de la conexión: si no está seteado,
    // conecta como anon y los eventos (policies `to authenticated`) no llegan.
    // CRÍTICO: hay que setear el token ANTES de .subscribe(); si suscribimos
    // mientras getSession() todavía resuelve, el canal conecta sin auth y RLS
    // silencia los eventos. Por eso ordenamos: getSession → setAuth → subscribe.
    let ch = null, cancelled = false;
    const attach = (t) => { if (t) { try { supabase.realtime.setAuth(t); } catch { /* noop */ } } };
    (async () => {
      try { const { data: { session } } = await supabase.auth.getSession(); attach(session?.access_token); } catch { /* noop */ }
      if (cancelled) return;
      ch = supabase
        .channel("tasks-realtime")
        .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, (payload) => {
          if (payload.eventType === "DELETE") onChange({ type: "DELETE", id: payload.old?.id });
          else onChange({ type: payload.eventType, task: fromRow(payload.new) });
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") console.log("🟢 realtime tasks · suscrito");
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") console.warn("⚠️ realtime tasks:", status, "— revisá publicación supabase_realtime + Realtime ON en el proyecto");
        });
    })();
    const { data: authSub } = supabase.auth.onAuthStateChange((_e, session) => attach(session?.access_token));
    return () => { cancelled = true; try { if (ch) supabase.removeChannel(ch); } catch { /* noop */ } try { authSub?.subscription?.unsubscribe(); } catch { /* noop */ } };
  },

  // ─── terrenos ─────────────────────────────────────────────
  async getTerrenos() {
    const { data, error } = await supabase.from("terrenos").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(fromTerrenoRow);
  },

  async upsertTerreno(terreno) {
    const { error } = await supabase.from("terrenos").upsert(toTerrenoRow(terreno), { onConflict: "id" });
    if (error) throw error;
  },

  async deleteTerreno(id) {
    const { error } = await supabase.from("terrenos").delete().eq("id", id);
    if (error) throw error;
  },

  // ─── presencia del equipo (sidebar "Equipo" · punto verde real) ──────────
  // Canal de Supabase Realtime Presence (no es postgres_changes, no requiere
  // RLS): cada sesión se une con su user id como key y hace track() de sí
  // misma. onChange recibe el Set de ids actualmente conectados — reemplaza
  // el campo `online` que antes vivía hardcodeado en `false`.
  subscribeTeamPresence(userId, onChange) {
    if (!userId) return () => {};
    let cancelled = false;
    const channel = supabase.channel("team-presence", { config: { presence: { key: userId } } });
    const syncState = () => { if (!cancelled) onChange(new Set(Object.keys(channel.presenceState()))); };
    channel
      .on("presence", { event: "sync" }, syncState)
      .on("presence", { event: "join" }, syncState)
      .on("presence", { event: "leave" }, syncState)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED" && !cancelled) await channel.track({ online_at: new Date().toISOString() });
      });
    return () => { cancelled = true; try { supabase.removeChannel(channel); } catch { /* noop */ } };
  },

  // ─── rental_comps (Cotización · Retorno) ──────────────────
  async getRentalComps() {
    const { data, error } = await supabase.from("rental_comps").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(fromRentalCompRow);
  },

  async upsertRentalComp(comp) {
    const { error } = await supabase.from("rental_comps").upsert(toRentalCompRow(comp), { onConflict: "id" });
    if (error) throw error;
  },

  async deleteRentalComp(id) {
    const { error } = await supabase.from("rental_comps").delete().eq("id", id);
    if (error) throw error;
  },

  // ─── generic app state (messages, activity, etc) ──────────
  async getState(key) {
    const { data } = await supabase.from("app_state").select("value").eq("key", key).single();
    return data?.value ?? null;
  },

  async setState(key, value) {
    const { error } = await supabase.from("app_state").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw error;
  },
};

// ─── row mappers ─────────────────────────────────────────────
function toRow(t) {
  return {
    id: t.id,
    parent_id: t.parentId ?? null,
    title: t.title,
    description: t.description ?? "",
    project: t.project ?? "",
    priority: t.priority ?? "media",
    due: t.due ?? "",
    start_date: t.startDate ?? "",
    end_date: t.endDate ?? "",
    space: t.space ?? "hq",
    checked: !!t.checked,
    status: t.status ?? "pendiente",   // requiere columna (ALTER TABLE 13 jul 2026) — sin esto el estado volvía a "pendiente" en cada reload
    archived: !!t.archived,
    assignee: t.assignee ?? "sb",
    tags: t.tags ?? [],
    type: t.type ?? null,
    amount: t.amount ?? null,
    person: t.person ?? null,
    source: t.source ?? null,
    captured_at: t.capturedAt ?? null,
    comments: t.comments ?? [],
    attachments: t.attachments ?? [],
    activity: t.activity ?? [],
    recurring: t.recurring ?? null,
    recurring_parent_id: t.recurringParentId ?? null,
    updated_at: new Date().toISOString(),
  };
}

function fromRow(r) {
  return {
    id: r.id,
    parentId: r.parent_id,
    title: r.title,
    description: r.description,
    project: r.project,
    priority: r.priority,
    due: r.due,
    startDate: r.start_date,
    endDate: r.end_date,
    space: r.space,
    checked: r.checked,
    status: r.status ?? "pendiente",
    archived: !!r.archived,
    assignee: r.assignee,
    tags: r.tags ?? [],
    type: r.type,
    amount: r.amount,
    person: r.person,
    source: r.source,
    capturedAt: r.captured_at,
    comments: r.comments ?? [],
    attachments: r.attachments ?? [],
    activity: r.activity ?? [],
    recurring: r.recurring,
    recurringParentId: r.recurring_parent_id,
  };
}

function toTerrenoRow(t) {
  return {
    id: t.id,
    name: t.name,
    district: t.district ?? null,
    address: t.address ?? null,
    area_m2: t.areaM2 ?? null,
    status: t.status ?? "scouting",
    score: t.score ?? null,
    price: t.price ?? null,
    price_m2: t.priceM2 ?? null,
    lat: t.lat ?? null,
    lng: t.lng ?? null,
    nse: t.nse ?? null,
    comments: t.comments ?? [],
    documents: t.documents ?? [],
    bam_proposal: t.bamProposal ?? null,
    updated_at: new Date().toISOString(),
  };
}

function toRentalCompRow(c) {
  return {
    id: c.id,
    district: c.district,
    tipologia: c.tipologia ?? null,
    source: c.source ?? "alquiler_tradicional",
    currency: c.currency ?? "PEN",
    monthly_rent: c.monthlyRent ?? null,
    daily_rate: c.dailyRate ?? null,
    occupancy_pct: c.occupancyPct ?? null,
    area_m2: c.areaM2 ?? null,
    url: c.url ?? null,
    notes: c.notes ?? null,
    entered_by: c.enteredBy ?? null,
    updated_at: new Date().toISOString(),
  };
}

function fromRentalCompRow(r) {
  return {
    id: r.id,
    district: r.district,
    tipologia: r.tipologia,
    source: r.source,
    currency: r.currency,
    monthlyRent: r.monthly_rent,
    dailyRate: r.daily_rate,
    occupancyPct: r.occupancy_pct,
    areaM2: r.area_m2,
    url: r.url,
    notes: r.notes,
    enteredBy: r.entered_by,
    createdAt: r.created_at,
  };
}

function fromTerrenoRow(r) {
  return {
    id: r.id,
    name: r.name,
    district: r.district,
    address: r.address,
    areaM2: r.area_m2,
    status: r.status,
    score: r.score,
    price: r.price,
    priceM2: r.price_m2,
    lat: r.lat,
    lng: r.lng,
    nse: r.nse,
    comments: r.comments ?? [],
    documents: r.documents ?? [],
    bamProposal: r.bam_proposal,
  };
}
