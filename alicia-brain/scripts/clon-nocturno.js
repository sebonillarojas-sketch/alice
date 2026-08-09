// Clon nocturno: copia el SQLite del brain, levanta una 2ª instancia sandboxeada en
// :3099, corre Bandersnatch/Jabberwocky contra ELLA, y la tira. Ver spec.
import { copyFileSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn as _spawn, execFile } from "node:child_process";
import { promisify } from "node:util";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");
const PORT = "3099";
const CLONE_DB = join(REPO, "alicia-clone.db");
const SECRET_KEYS = /(TOKEN|KEY|SECRET|PASSWORD|SID|DROPBOX_REFRESH|SUPABASE|ANTHROPIC|GROQ|OPENAI|TWILIO|WA_|ZOOM|GOOGLE)/i;

export function cloneDbPath() { return CLONE_DB; }

export function buildCloneEnv(base = process.env) {
  const env = {};
  for (const [k, v] of Object.entries(base)) if (!SECRET_KEYS.test(k)) env[k] = v;
  env.SANDBOX = "1";
  env.PORT = PORT;
  env.SQLITE_PATH = CLONE_DB;
  return env;
}

async function healthOk(fetchImpl) {
  try { const r = await fetchImpl(`http://localhost:${PORT}/health`, { signal: AbortSignal.timeout(3000) }); return r.ok; }
  catch { return false; }
}

export async function run({ spawn = _spawn, fetchImpl = globalThis.fetch, sleep = (ms) => new Promise(r => setTimeout(r, ms)) } = {}) {
  if (process.env.QUARANTINE === "true") { console.log("🌒 QUARANTINE — no levanto el clon"); return; }
  // 1. snapshot del SQLite de prod
  const src = process.env.SQLITE_PATH || join(REPO, "alicia.db");
  if (!existsSync(src)) { console.error("🌒 no hay alicia.db para clonar"); return; }
  try { rmSync(CLONE_DB, { force: true }); rmSync(CLONE_DB + "-wal", { force: true }); rmSync(CLONE_DB + "-shm", { force: true }); } catch {}
  copyFileSync(src, CLONE_DB);
  // 2. levantar clon sandboxeado
  const child = spawn(process.execPath, [join(REPO, "src/server.js")], { cwd: REPO, env: buildCloneEnv(), stdio: "ignore", detached: false });
  try {
    // 3. esperar /health (máx ~30s)
    let up = false;
    for (let i = 0; i < 15; i++) { if (await healthOk(fetchImpl)) { up = true; break; } await sleep(2000); }
    if (!up) { console.error("🌒 el clon no levantó a tiempo"); return; }
    const target = `http://localhost:${PORT}`;
    // 4. correr los agentes contra el clon
    const execFileP = promisify(execFile);
    for (const agent of ["bandersnatch.js", "jabberwocky.js"]) {
      try { await execFileP(process.execPath, [join(HERE, agent), target], { cwd: REPO, timeout: 20 * 60_000 }); }
      catch (e) { console.error(`🌒 ${agent} falló:`, e.message); }
    }
  } finally {
    // 5. teardown
    try { child.kill("SIGKILL"); } catch {}
    try { rmSync(CLONE_DB, { force: true }); rmSync(CLONE_DB + "-wal", { force: true }); rmSync(CLONE_DB + "-shm", { force: true }); } catch {}
    console.log("🌒 clon nocturno: teardown completo");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(() => process.exit(0)).catch(e => { console.error("🌒 clon crash:", e.message); process.exit(1); });
}
