import { createClient } from "@supabase/supabase-js";

const URL  = "https://apnzitklhxrcszectbxx.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwbnppdGtsaHhyY3N6ZWN0Ynh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4MjUzNjcsImV4cCI6MjA5OTQwMTM2N30.OdUe_GuchvgjoDxklh_nKxxNb_rPD_IpQzj8f_XyETI";

export const supabase = createClient(URL, ANON);

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
    clickup_id: t.clickupId ?? null,
    clickup_url: t.clickupUrl ?? null,
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
    clickupId: r.clickup_id,
    clickupUrl: r.clickup_url,
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
