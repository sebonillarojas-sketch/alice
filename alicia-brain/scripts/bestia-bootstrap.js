// Auto-bootstrap del reloj único (sin SSH) · lo llama scrape.js al final de su corrida.
// Copia el plist a ~/Library/LaunchAgents, lo carga, y SOLO si quedó activo retira el
// plist viejo del scraper (com.hygge.white-rabbit) para no duplicar el scraper.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const LA_DIR = join(homedir(), "Library/LaunchAgents");
const NEW_LABEL = "com.hygge.wonderland";
const OLD_LABEL = "com.hygge.white-rabbit";
const uid = process.getuid();

async function isLoaded(label) {
  try { await execFileP("launchctl", ["print", `gui/${uid}/${label}`]); return true; }
  catch { return false; }
}

const DAEMON_LABEL = "com.hygge.wonderland.clock";

export async function ensureWonderlandClock() {
  // Si el reloj ya corre como LaunchDaemon (scripts/bestia/install.sh), este
  // bootstrap no tiene nada que hacer: reinstalar el LaunchAgent dejaría DOS relojes
  // disparando el mismo scraper cada 10 min. El daemon manda.
  try {
    await execFileP("launchctl", ["print", `system/${DAEMON_LABEL}`]);
    // Y de paso, si quedó el agente viejo cargado, retirarlo (idempotente).
    for (const viejo of [NEW_LABEL, OLD_LABEL]) {
      try { await execFileP("launchctl", ["bootout", `gui/${uid}/${viejo}`]); } catch {}
    }
    console.log("🕰️ el reloj corre como daemon — no toco los LaunchAgents");
    return { installed: true, daemon: true };
  } catch { /* no hay daemon: seguimos con el camino viejo */ }

  // Si el reloj nuevo YA está cargado, no tocar nada: un bootout aquí mataría
  // el árbol de procesos actual (bestia-runner + este scrape.js) a mitad del
  // await, y el bootstrap de reemplazo nunca llegaría a correr (sin SSH para
  // recuperarlo). Ver FINDING C1.
  if (await isLoaded(NEW_LABEL)) {
    console.log("🕰️ reloj ya activo — nada que hacer");
    return { installed: true, alreadyActive: true };
  }

  mkdirSync(LA_DIR, { recursive: true });
  const dst = join(LA_DIR, `${NEW_LABEL}.plist`);
  copyFileSync(join(HERE, `${NEW_LABEL}.plist`), dst);
  // (re)cargar el nuevo
  try { await execFileP("launchctl", ["bootout", `gui/${uid}/${NEW_LABEL}`]); } catch {}
  await execFileP("launchctl", ["bootstrap", `gui/${uid}`, dst]);

  if (!(await isLoaded(NEW_LABEL))) {
    console.error("🕰️ bootstrap: el reloj nuevo NO quedó cargado — NO retiro el viejo (heartbeat a salvo)");
    return { installed: false };
  }
  // el nuevo está vivo → retirar el viejo para no duplicar el scraper
  try { await execFileP("launchctl", ["bootout", `gui/${uid}/${OLD_LABEL}`]); } catch {}
  console.log(`🕰️ bootstrap OK · ${NEW_LABEL} activo · ${OLD_LABEL} retirado`);
  return { installed: true };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  ensureWonderlandClock().then(() => process.exit(0)).catch(e => { console.error("bootstrap:", e.message); process.exit(1); });
}
