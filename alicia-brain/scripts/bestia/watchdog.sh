#!/bin/bash
# Watchdog del reloj de Wonderland. Corre como root cada 10 min
# (com.hygge.wonderland.watchdog) y hace exactamente dos cosas:
#
#   1. REPARA el reloj: si el daemon no está cargado lo carga; si está cargado pero
#      no dispara, lo patea.
#   2. LATE al cerebro con curl puro.
#
# POR QUÉ ES BASH Y NO NODE: el bug que dejó la flota muerta una semana fue que el
# único que reinstalaba el reloj era una corrida que el reloj mismo disparaba —
# recuperación que solo existe cuando no se necesita. Este vigilante no comparte
# NADA con el vigilado: ni node, ni volta, ni el repo, ni el estado de git. Si allá
# todo eso está roto, este igual late y nos dice qué está roto. Eso es lo que hace
# que sea un watchdog y no otra pieza de la misma cadena.
set -u

CLOCK="com.hygge.wonderland.clock"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"                      # …/alicia-brain
PLIST="/Library/LaunchDaemons/${CLOCK}.plist"

# Corre como root, así que HOME es /var/root: el usuario real sale del dueño del repo
# (auto-corrige si algún día el repo se mueve a otra cuenta).
USUARIO="${WONDERLAND_USER:-$(stat -f %Su "$REPO")}"
# WONDERLAND_STATE solo se usa para probar el script fuera de la máquina.
STATE="${WONDERLAND_STATE:-/Users/${USUARIO}/Library/Application Support/wonderland}"
NOW=$(date -u +%s)
NOTAS=""

nota() { NOTAS="${NOTAS}${NOTAS:+; }$1"; echo "🐕 $1"; }

# Corre algo como el usuario dueño del reloj. `sudo -n` para que NUNCA se quede
# esperando una contraseña: es un script desatendido, un prompt acá sería un cuelgue
# cada 10 minutos. Y si ya somos ese usuario, sudo no hace falta (así se puede
# probar el script sin privilegios).
como_usuario() {
  if [ "$(id -un)" = "$USUARIO" ]; then "$@"; else sudo -n -u "$USUARIO" "$@"; fi
}

# Edad en minutos de una marca ISO-8601 UTC; 99999 si no existe o no se puede leer.
edad_min() {
  local f="$1" ts epoch
  [ -f "$f" ] || { echo 99999; return; }
  ts=$(head -1 "$f" 2>/dev/null | tr -d '[:space:]')
  [ -n "$ts" ] || { echo 99999; return; }
  epoch=$(TZ=UTC date -j -f "%Y-%m-%dT%H:%M:%SZ" "$ts" +%s 2>/dev/null) || { echo 99999; return; }
  echo $(( (NOW - epoch) / 60 ))
}

# ── 1. Reparar ────────────────────────────────────────────────────────────────
if ! launchctl print "system/${CLOCK}" >/dev/null 2>&1; then
  if [ ! -f "$PLIST" ]; then
    nota "falta $PLIST — hay que correr install.sh"
    CLOCK_STATE="sin-plist"
  elif launchctl bootstrap system "$PLIST" 2>/dev/null; then
    nota "reloj descargado → lo cargué"
    CLOCK_STATE="recargado"
  else
    nota "reloj descargado y el bootstrap FALLÓ"
    CLOCK_STATE="caido"
  fi
else
  CLOCK_STATE="cargado"
  # Cargado no es lo mismo que vivo: si no dispara hace más de 25 min (cadencia 10),
  # está trabado y una patada es más barata que esperar a que alguien viaje.
  FIRE_MIN=$(edad_min "$STATE/last-fire")
  if [ "$FIRE_MIN" -gt 25 ]; then
    launchctl kickstart -k "system/${CLOCK}" 2>/dev/null \
      && nota "cargado pero sin disparar hace ${FIRE_MIN} min → pateado" \
      || nota "cargado, sin disparar hace ${FIRE_MIN} min, y el kickstart falló"
    CLOCK_STATE="pateado"
  fi
fi

# ── 2. Latir ──────────────────────────────────────────────────────────────────
ENV_FILE="$REPO/.env"
leer_env() { [ -f "$ENV_FILE" ] && grep -m1 "^$1=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"'"'"'[:space:]'; }
KEY="${AGENTS_API_KEY:-$(leer_env AGENTS_API_KEY)}"
BRAIN="${BRAIN_URL:-$(leer_env BRAIN_URL)}"
BRAIN="${BRAIN:-https://alice-production-462e.up.railway.app}"

limpio() { printf '%s' "${1:-}" | tr -d '"\\\n\r' | cut -c1-200; }
NODE_BIN=$(como_usuario "$HERE/node-resolve.sh" 2>/dev/null || echo "NO HAY NODE")
BRANCH=$(como_usuario git -C "$REPO" branch --show-current 2>/dev/null || echo "?")
TICK_MIN=$(edad_min "$STATE/last-tick")
FIRE_MIN=$(edad_min "$STATE/last-fire")

# El diagnóstico que ahorra el viaje: disparó (fire fresco) pero no terminó el tick
# (tick viejo) = el reloj anda y node/el runner se están muriendo.
if [ "$FIRE_MIN" -lt 25 ] && [ "$TICK_MIN" -gt 40 ]; then
  nota "el reloj dispara pero el runner no completa un tick hace ${TICK_MIN} min"
fi

if [ -z "$KEY" ]; then
  echo "🐕 sin AGENTS_API_KEY en $ENV_FILE — no puedo latir (el reloj igual quedó atendido)" >&2
  exit 0
fi

BODY=$(printf '{"host":"%s","clock":"%s","node":"%s","branch":"%s","last_tick":"%s","note":"%s"}' \
  "$(limpio "$(hostname -s)")" \
  "$(limpio "$CLOCK_STATE")" \
  "$(limpio "$NODE_BIN")" \
  "$(limpio "$BRANCH")" \
  "$([ "$TICK_MIN" -ge 99999 ] && echo "nunca" || echo "hace ${TICK_MIN} min")" \
  "$(limpio "${NOTAS:-sin novedad}")")

curl -fsS -m 15 -X POST "${BRAIN}/api/bestia/heartbeat" \
  -H "x-agent-key: ${KEY}" -H "Content-Type: application/json" \
  -d "$BODY" >/dev/null 2>&1 \
  && echo "🐕 latido enviado · reloj ${CLOCK_STATE} · tick hace ${TICK_MIN} min" \
  || echo "🐕 no pude latir al cerebro (¿red? ¿key?) — reintento en 10 min" >&2

exit 0
