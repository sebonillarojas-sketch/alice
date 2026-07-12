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

  console.log("⏰ Cron activo · briefing 7:00am + market refresh cada hora");
}
