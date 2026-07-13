// Scheduler — tareas periódicas de Alicia
import cron from "node-cron";
import { runDailyBriefing } from "./briefing.js";
import { refreshMarketData } from "./market.js";

export function startCron() {
  // Briefing diario a las 7:00am hora Lima (UTC-5 → 12:00 UTC)
  cron.schedule("0 12 * * *", async () => {
    console.log("⏰ Cron: briefing diario");
    await runDailyBriefing().catch(e => console.error("Briefing error:", e.message));
  }, { timezone: "America/Lima" });

  // Market data refresh cada hora (White Rabbit)
  cron.schedule("0 * * * *", async () => {
    console.log("🐰 Cron: refresh market data");
    await refreshMarketData().catch(e => console.error("Market refresh error:", e.message));
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

  // Cerebro → Dropbox · espejo nocturno 3:30am Lima
  cron.schedule("30 3 * * *", async () => {
    console.log("🧠 Cron: export cerebro a Dropbox");
    const { exportBrainToDropbox } = await import("./brainsync.js");
    await exportBrainToDropbox().catch(e => console.error("Brain export error:", e.message));
  }, { timezone: "America/Lima" });

  // Primer chequeo del conejo a los 90s del boot (no esperar 30 min tras cada deploy)
  setTimeout(async () => {
    const { runWhiteRabbitChecks } = await import("./whiterabbit.js");
    await runWhiteRabbitChecks().catch(e => console.error("White Rabbit boot error:", e.message));
  }, 90000);

  console.log("⏰ Cron activo · briefing 7:00am + market refresh + White Rabbit c/30min + Tea Table lunes 7:30 + cerebro→Dropbox 3:30am");
}
