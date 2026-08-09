// Reloj único de la bestia · tabla de horarios + lógica de "vencido" (pura).
// bestia-runner.js tickea cada ~10 min y usa esto para decidir qué disparar.
const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR, WEEK = 7 * DAY;

// script = ruta relativa a scripts/ ; los stubs corren pero no hacen nada útil aún.
export const SCHEDULE = [
  { id: "scraper", script: "scrape.js", args: ["all"], everyMs: 6 * HOUR },
  { id: "cheshire", script: "cheshire.js", args: [], everyMs: 30 * MIN },
  { id: "knave", script: "knave.js", args: [], everyMs: 1 * HOUR },
  { id: "knave-audit", script: "knave.js", args: ["audit"], everyMs: 1 * DAY },
  { id: "knave-review", script: "knave.js", args: ["review"], everyMs: 1 * WEEK },
  { id: "bandersnatch", script: "bandersnatch.js", args: [], everyMs: 1 * DAY },
  { id: "jabberwocky", script: "jabberwocky.js", args: [], everyMs: 1 * DAY },
];

export function dueJobs(schedule, state = {}, nowMs) {
  return schedule.filter(j => {
    const last = state[j.id];
    return last == null || (nowMs - last) >= j.everyMs;
  });
}

export function markRan(state, id, nowMs) {
  return { ...state, [id]: nowMs };
}
