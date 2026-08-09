# Runbook · reloj único de la bestia

**Bestia:** `alicias-mac-pro-1`, Tailscale `100.88.12.17`, user `eduardobonilla`,
repo `~/Desktop/ALICE`, node `~/.volta/bin/node`. **Sin SSH** → todo por git.

## Cómo se activa (sin intervención)
1. Merge a `main`.
2. La bestia, en su próxima corrida del plist viejo (`com.hygge.white-rabbit`, c/6h),
   hace `git pull` y `scrape.js` llama a `ensureWonderlandClock()`.
3. Se instala `com.hygge.wonderland` (tick ~10 min); si queda activo, se retira el
   plist viejo. De ahí en más el reloj único corre todo.

## Horarios (scripts/schedule.js)
scraper 6h · Cheshire 30min · Knave 1h · knave-audit diario · knave-review semanal ·
Bandersnatch/Jabberwocky stubs (skipped).

## Diagnóstico
- Logs: `~/Library/Logs/wonderland.out.log` y `.err.log`.
- Estado: `~/Library/Application Support/wonderland/schedule-state.json`.
- Kill switch: `QUARANTINE=true` en el `.env` de la bestia → todo observa, nada corre.
- ¿Cargado? `launchctl print gui/$(id -u)/com.hygge.wonderland`.
