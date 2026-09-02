// Scheduler — tareas periódicas de Alicia
import cron from "node-cron";
import { runDailyBriefing } from "./briefing.js";
import { refreshMarketData, refreshRentalListings } from "./market.js";

export function startCron() {
  // Briefing diario a las 9:00am hora Lima. La expresión va en hora LOCAL: node-cron
  // ya hace la conversión con el `timezone`. Antes decía "0 12" (pre-convertido a UTC
  // a mano) y encima pasaba America/Lima, así que se disparaba al mediodía de Lima.
  //
  // Mismo horario, dos mensajes con propósito distinto: el ejecutivo para Sebastián
  // (mercado + sugerencia de Alicia) y el matutino de cada miembro del equipo con sus
  // tareas, reuniones y correos. Van en serie para no pegarle al ERP en paralelo.
  cron.schedule("0 9 * * *", async () => {
    console.log("⏰ Cron: briefing diario");
    await runDailyBriefing().catch(e => console.error("Briefing error:", e.message));

    try {
      const { isSandbox } = await import("./sandbox.js");
      if (isSandbox()) return;
      const { getDB, query } = await import("./db.js");
      const today = new Date().toISOString().slice(0, 10);
      const last = query("SELECT value FROM app_settings WHERE key='team_briefing_date'").rows[0]?.value;
      if (last === today) return; // ya salió hoy
      const { runTeamBriefing } = await import("./team-briefing.js");
      const r = await runTeamBriefing({ db: getDB() });
      if (r.sent > 0) {
        query(`INSERT INTO app_settings (key,value,updated_at) VALUES ('team_briefing_date',?,datetime('now'))
               ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')`, [today]);
      }
    } catch (e) { console.error("Briefing equipo error:", e.message); }
  }, { timezone: "America/Lima" });

  // Market data refresh cada hora (White Rabbit)
  cron.schedule("0 * * * *", async () => {
    console.log("🐰 Cron: refresh market data");
    await refreshMarketData().catch(e => console.error("Market refresh error:", e.message));
  }, { timezone: "America/Lima" });

  // Notificador de lecciones pendientes (Loop 3b): 1×/día a las 9am Lima, si hay
  // lecciones esperando el OK de Sebastián, se las manda en batch por WhatsApp.
  // Idempotente por fecha (app_settings.lessons_notified_date) y silencioso si no hay.
  cron.schedule("0 9 * * *", async () => {
    try {
      const { isSandbox } = await import("./sandbox.js");
      if (isSandbox() || !process.env.PHONE_sb) return;
      const { getDB, query } = await import("./db.js");
      const { pendingLessonsForCEO } = await import("./lessons.js");
      const rows = pendingLessonsForCEO(getDB());
      if (!rows.length) return;
      const today = new Date().toISOString().slice(0, 10);
      const last = query("SELECT value FROM app_settings WHERE key='lessons_notified_date'").rows[0]?.value;
      if (last === today) return; // ya avisé hoy
      const { sendWA } = await import("./wa.js");
      const body = `🧠 Aprendí ${rows.length} cosa(s) que esperan tu OK:\n${rows.map(r => `#${r.id} [${r.risk_level}] ${r.lesson}`).join("\n")}\n\nRespondeme cuáles aplico (ej. "aplicá la 1 y la 3").`;
      const ok = await sendWA(process.env.PHONE_sb, body);
      if (ok !== false) {
        query(`INSERT INTO app_settings (key,value,updated_at) VALUES ('lessons_notified_date',?,datetime('now'))
               ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')`, [today]);
        console.log(`🧠 Notifiqué ${rows.length} lección(es) pendiente(s) a Sebastián`);
      }
    } catch (e) { console.error("Notificador lecciones error:", e.message); }
  }, { timezone: "America/Lima" });

  // Rental listings (Wynwood House, Lima) cada 6h — cadencia baja a propósito,
  // los precios de corta estadía no cambian tan seguido como para justificar
  // pegarle a su sitio cada hora.
  cron.schedule("0 */6 * * *", async () => {
    console.log("🐰 Cron: refresh rental listings (Wynwood House)");
    await refreshRentalListings().catch(e => console.error("Rental listings error:", e.message));
  }, { timezone: "America/Lima" });

  // Tea Table semanal — lunes 7:30am Lima · reporte de sistema + WhatsApp a Sebastián
  cron.schedule("30 7 * * 1", async () => {
    console.log("🫖 Cron: Tea Table semanal");
    const { runTeaTableReport } = await import("./teatable.js");
    await runTeaTableReport({ notify: true }).catch(e => console.error("Tea Table error:", e.message));
  }, { timezone: "America/Lima" });

  // White Rabbit 🐰 · guardia de infra pública cada 30 min (TLS estricto desde afuera)
  cron.schedule("*/30 * * * *", async () => {
    const { runWhiteRabbitChecks } = await import("./whiterabbit.js");
    await runWhiteRabbitChecks().catch(e => console.error("White Rabbit error:", e.message));
  }, { timezone: "America/Lima" });

  // Mad Hatter 🎩 · performance/costos cada hora
  cron.schedule("15 * * * *", async () => {
    const { runMadHatter } = await import("./madhatter.js");
    await runMadHatter().catch(e => console.error("Mad Hatter error:", e.message));
  }, { timezone: "America/Lima" });

  // Dark Alice 🖤 · revisión de operaciones diaria 7:15am Lima (WhatsApp solo si hay críticos/mayores)
  cron.schedule("15 7 * * *", async () => {
    const { runDarkAlice } = await import("./darkalice.js");
    await runDarkAlice({ notify: true }).catch(e => console.error("Dark Alice error:", e.message));
  }, { timezone: "America/Lima" });

  // Scraper agent 🐰 · SBS (tasas hipotecarias por banco) diario 6:00am Lima.
  // Fuente dura (Incapsula) → render JS; las tasas cambian a diario.
  cron.schedule("0 6 * * *", async () => {
    console.log("🐰 Cron: scraper SBS (tasas por banco)");
    const { runScraperAgent } = await import("./scrapers/index.js");
    await runScraperAgent({ sources: ["sbs"] }).catch(e => console.error("Scraper SBS error:", e.message));
  }, { timezone: "America/Lima" });

  // Scraper agent 🐰 · Urbania (listings Lima) cada 12h. Fuente dura (Cloudflare) →
  // render JS + proxy premium PE; cadencia baja porque cada corrida gasta proxy.
  cron.schedule("30 5,17 * * *", async () => {
    console.log("🐰 Cron: scraper Urbania (listings Lima)");
    const { runScraperAgent } = await import("./scrapers/index.js");
    await runScraperAgent({ sources: ["urbania"] }).catch(e => console.error("Scraper Urbania error:", e.message));
  }, { timezone: "America/Lima" });

  // Loop de aprendizaje · gate-pass diario sobre lecciones proposed
  cron.schedule("30 6 * * *", async () => {
    try {
      const { runGatePass } = await import("./lessons.js");
      const { HARD_RULES } = await import("./hard-rules.js");
      const { getDB } = await import("./db.js");
      const r = await runGatePass(getDB(), { hardRules: HARD_RULES, minEvidence: 3 });
      console.log(`🧠 gate-pass diario · ${JSON.stringify(r)}`);
    } catch (e) { console.error("gate-pass diario error:", e.message); }
  }, { timezone: "America/Lima" });

  // Loop de aprendizaje · auto-reflexión semanal (lunes 7:00 Lima, antes del Tea Table).
  // Cada agente mira su actividad reciente y propone a lo sumo una lección (source reflection).
  // El gate-pass diario las recoge; nada se auto-aplica. Guard sandbox.
  cron.schedule("0 7 * * 1", async () => {
    try {
      const { isSandbox } = await import("./sandbox.js");
      if (isSandbox()) return;
      const { getDB } = await import("./db.js");
      const { runReflectionPass } = await import("./reflection.js");
      const r = await runReflectionPass(getDB());
      console.log(`🧠 auto-reflexión semanal · ${JSON.stringify(r)}`);
    } catch (e) { console.error("auto-reflexión error:", e.message); }
  }, { timezone: "America/Lima" });

  // Cerebro → Dropbox · espejo nocturno 3:30am Lima
  cron.schedule("30 3 * * *", async () => {
    console.log("🧠 Cron: export cerebro a Dropbox");
    const { exportBrainToDropbox } = await import("./brainsync.js");
    await exportBrainToDropbox().catch(e => console.error("Brain export error:", e.message));
  }, { timezone: "America/Lima" });

  // Puente Bammy → Taller · 1:00am Lima (tras el estudio nocturno ~00:40). La rutina
  // cloud pushea las plantas al repo pero no alcanza el backend (egress 403); este puente
  // las lee de GitHub y las cuelga en el Taller + avisa por WhatsApp. Requiere GITHUB_TOKEN.
  cron.schedule("0 1 * * *", async () => {
    console.log("🌉 Cron: puente Bammy → Taller");
    const { ingestLatestBammyStudy } = await import("./bammy-bridge.js");
    await ingestLatestBammyStudy({ notify: true }).catch(e => console.error("Bammy bridge error:", e.message));
  }, { timezone: "America/Lima" });

  // Vuelta del loop · 23:45 Lima (justo antes del estudio de las 00:08): escribe las
  // correcciones del Taller al repo para que Bammy las lea sin tocar el backend.
  cron.schedule("45 23 * * *", async () => {
    console.log("🌉 Cron: correcciones Taller → repo");
    const { syncCorrectionsToRepo } = await import("./bammy-bridge.js");
    await syncCorrectionsToRepo().catch(e => console.error("Bammy corrections sync error:", e.message));
  }, { timezone: "America/Lima" });

  // Primer barrido a los 90s del boot: conejo + sombrerero (no esperar al próximo tick)
  setTimeout(async () => {
    const { runWhiteRabbitChecks } = await import("./whiterabbit.js");
    await runWhiteRabbitChecks().catch(e => console.error("White Rabbit boot error:", e.message));
    const { runMadHatter } = await import("./madhatter.js");
    await runMadHatter().catch(e => console.error("Mad Hatter boot error:", e.message));
    const { runDarkAlice } = await import("./darkalice.js");
    await runDarkAlice({ notify: false }).catch(e => console.error("Dark Alice boot error:", e.message));
    await refreshRentalListings().catch(e => console.error("Rental listings boot error:", e.message));
  }, 90000);

  console.log("⏰ Cron activo · briefing 9am (ejecutivo + equipo) · market refresh · rental listings c/6h · White Rabbit c/30min · Mad Hatter c/hora · Dark Alice 7:15am · Tea Table lunes 7:30 · scraper SBS 6am · scraper Urbania c/12h · gate-pass 6:30am · cerebro→Dropbox 3:30am");
}
