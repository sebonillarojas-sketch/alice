// Reloj único de la bestia 🕰️ · lo dispara com.hygge.wonderland.plist cada ~10 min.
// En cada tick: git pull → leer estado → disparar jobs vencidos (con lock) → guardar.
// Ver docs/superpowers/specs/2026-08-08-wonderland-knave-agents-design.md
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { SCHEDULE, dueJobs, markRan } from "./schedule.js";

const execFileP = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");            // alicia-brain/
const NODE = process.execPath;
const STATE_PATH = join(homedir(), "Library/Application Support/wonderland/schedule-state.json");
const running = new Set();                 // lock en memoria por proceso

export function readState(path) {
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return {}; }
}
export function writeState(path, state) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(state, null, 2));
}

async function defaultPull() {
  try { await execFileP("git", ["pull", "--ff-only"], { cwd: join(REPO, "..") }); }
  catch (e) { console.error("🕰️ git pull falló (sigo con el código actual):", e.message); }
}

async function defaultSpawn(job) {
  if (running.has(job.id)) { console.log(`🕰️ ${job.id} sigue corriendo — salto`); return; }
  running.add(job.id);
  try {
    await execFileP(NODE, [join(HERE, job.script), ...(job.args || [])], { cwd: REPO, timeout: 10 * 60_000 });
    console.log(`🕰️ ${job.id} OK`);
  } catch (e) { console.error(`🕰️ ${job.id} falló:`, e.message); }
  finally { running.delete(job.id); }
}

export async function tick({ now = Date.now(), statePath = STATE_PATH, pull = defaultPull, spawn = defaultSpawn } = {}) {
  if (process.env.QUARANTINE === "true") { console.log("🕰️ QUARANTINE — no disparo nada"); return; }
  await pull();
  let state = readState(statePath);
  const due = dueJobs(SCHEDULE, state, now);
  for (const job of due) {
    await spawn(job);
    state = markRan(state, job.id, now);
    writeState(statePath, state); // persistir por job (crash-safe)
  }
  console.log(`🕰️ tick · ${due.length} job(s) disparados`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  tick().then(() => process.exit(0)).catch(e => { console.error("🕰️ tick crash:", e.message); process.exit(1); });
}
