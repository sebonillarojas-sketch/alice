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
import { classifyAgentRun } from "../src/agent-requests.js";

const execFileP = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");            // alicia-brain/
const NODE = process.execPath;
const STATE_PATH = join(homedir(), "Library/Application Support/wonderland/schedule-state.json");
const running = new Set();                 // lock en memoria por proceso
// Cola on-demand: el brain guarda los pedidos de run_agent; acá los drenamos.
// La key se lee en cada llamada (no en un const de import) para no capturar un valor viejo.
const BRAIN = process.env.BRAIN_URL || "https://alice-production-462e.up.railway.app";
const agentKey = () => process.env.AGENTS_API_KEY || "";

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

// Drena la cola on-demand del brain: corre los agentes de bestia pedidos vía run_agent.
async function markRequestDone(fetchImpl, id, status, note) {
  try {
    await fetchImpl(`${BRAIN}/api/agents/run-requests/${id}/done`, {
      method: "POST",
      headers: { "x-agent-key": agentKey(), "Content-Type": "application/json" },
      body: JSON.stringify({ status, note }),
    });
  } catch (e) { console.error("🕰️ no pude marcar la request:", e.message); }
}

export async function drainRequests({ fetchImpl = globalThis.fetch, spawn = defaultSpawn } = {}) {
  if (!agentKey()) return 0;
  let requests = [];
  try {
    const r = await fetchImpl(`${BRAIN}/api/agents/run-requests`, {
      headers: { "x-agent-key": agentKey() }, signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) return 0;
    ({ requests = [] } = await r.json());
  } catch (e) { console.error("🕰️ no pude leer la cola on-demand:", e.message); return 0; }

  for (const req of requests) {
    const plan = classifyAgentRun(req.agent);
    if (!plan || plan.mode !== "queue") { await markRequestDone(fetchImpl, req.id, "error", `agente ${req.agent} no ejecutable en la bestia`); continue; }
    let status = "done", note = null;
    try { await spawn({ id: req.agent, script: plan.script, args: plan.args || [] }); }
    catch (e) { status = "error"; note = e.message; }
    await markRequestDone(fetchImpl, req.id, status, note);
  }
  return requests.length;
}

export async function tick({ now = Date.now(), statePath = STATE_PATH, pull = defaultPull, spawn = defaultSpawn, fetchImpl = globalThis.fetch } = {}) {
  if (process.env.QUARANTINE === "true") { console.log("🕰️ QUARANTINE — no disparo nada"); return; }
  await pull();
  let state = readState(statePath);
  const due = dueJobs(SCHEDULE, state, now);
  for (const job of due) {
    await spawn(job);
    state = markRan(state, job.id, now);
    writeState(statePath, state); // persistir por job (crash-safe)
  }
  // Después de lo agendado, drenar los pedidos on-demand (run_agent).
  const onDemand = await drainRequests({ fetchImpl, spawn });
  console.log(`🕰️ tick · ${due.length} agendado(s) + ${onDemand} on-demand`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  tick().then(() => process.exit(0)).catch(e => { console.error("🕰️ tick crash:", e.message); process.exit(1); });
}
