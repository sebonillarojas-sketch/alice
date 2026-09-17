#!/bin/bash
# Un tick del reloj de Wonderland. Lo dispara com.hygge.wonderland.clock cada 10 min.
#
# Es un wrapper y no el node directo por dos razones:
#   1. Resuelve node en runtime (ver node-resolve.sh) — nada de rutas hardcodeadas.
#   2. Deja la marca `last-fire` ANTES de arrancar. Esa marca es la que distingue
#      "el reloj no disparó" de "disparó y node se murió" — dos causas con arreglos
#      opuestos, y sin acceso a la máquina es la única forma de saber cuál fue.
set -u

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"                 # …/alicia-brain
STATE="${HOME}/Library/Application Support/wonderland"

mkdir -p "$STATE"
date -u +%Y-%m-%dT%H:%M:%SZ > "$STATE/last-fire"

NODE="$("$HERE/node-resolve.sh")" || {
  echo "🕰️ $(date -u +%H:%M:%SZ) sin node — el watchdog lo va a reportar" >&2
  echo "sin-node" > "$STATE/last-error"
  exit 78                                          # EX_CONFIG: falta configuración
}

cd "$REPO" || exit 1
exec "$NODE" scripts/bestia-runner.js
