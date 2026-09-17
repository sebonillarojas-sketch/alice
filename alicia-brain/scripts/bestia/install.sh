#!/bin/bash
# Instala el reloj de Wonderland y su watchdog como LaunchDaemons. Una sola corrida,
# en la máquina de los agentes:
#
#   sudo bash ~/Desktop/ALICE/alicia-brain/scripts/bestia/install.sh
#
# Con --con-ssh además prende Sesión remota (SSH), para que el próximo diagnóstico
# no exija volver físicamente. Sin el flag, lo pregunta.
#
# Es idempotente: se puede correr de nuevo cuantas veces haga falta.
#
# ORDEN DELIBERADO: primero instala y VERIFICA lo nuevo, y solo después retira el
# LaunchAgent viejo. Si lo nuevo no queda cargado, lo viejo sigue en pie — un
# instalador que desarma el camino anterior antes de confirmar el nuevo deja la
# máquina sin ninguno, y acá no hay a quién pedirle que la revise.
set -u

CLOCK="com.hygge.wonderland.clock"
DOG="com.hygge.wonderland.watchdog"
VIEJOS=("com.hygge.wonderland" "com.hygge.white-rabbit")
LD="/Library/LaunchDaemons"
CON_SSH=0
[ "${1:-}" = "--con-ssh" ] && CON_SSH=1

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"

ok()   { echo "  ✅ $*"; }
mal()  { echo "  ❌ $*"; }
info() { echo "  ·  $*"; }

echo "── Reloj de Wonderland · instalación ──"
echo

# ── 0. Requisitos ─────────────────────────────────────────────────────────────
if [ "$(id -u)" -ne 0 ]; then
  mal "Esto necesita sudo (instala en $LD y toca pmset)."
  echo "     sudo bash $HERE/install.sh"
  exit 1
fi

USUARIO="${SUDO_USER:-}"
[ -z "$USUARIO" ] && USUARIO="$(stat -f %Su "$REPO")"
if [ "$USUARIO" = "root" ]; then
  mal "No puedo determinar el usuario real (¿sudo su?). Pasá SUDO_USER=<usuario>."
  exit 1
fi
UID_USUARIO="$(id -u "$USUARIO" 2>/dev/null)" || { mal "El usuario $USUARIO no existe"; exit 1; }

info "usuario: $USUARIO (uid $UID_USUARIO)"
info "repo:    $REPO"

DUENO="$(stat -f %Su "$REPO")"
[ "$DUENO" != "$USUARIO" ] && info "⚠️  el repo es de $DUENO, no de $USUARIO — el reloj correrá como $USUARIO"

chmod +x "$HERE"/*.sh 2>/dev/null
if NODE_BIN="$(sudo -u "$USUARIO" "$HERE/node-resolve.sh" 2>/dev/null)"; then
  ok "node: $NODE_BIN"
else
  mal "No hay node para $USUARIO. Instalalo antes (volta, brew o el .pkg oficial)."
  exit 1
fi
echo

# ── 1. Instalar los dos daemons ───────────────────────────────────────────────
echo "1· Daemons"
for label in "$CLOCK" "$DOG"; do
  plantilla="$HERE/${label}.plist"
  destino="$LD/${label}.plist"
  [ -f "$plantilla" ] || { mal "falta la plantilla $plantilla"; exit 1; }
  sed -e "s|__USER__|$USUARIO|g" -e "s|__REPO__|$REPO|g" "$plantilla" > "$destino"
  chown root:wheel "$destino"; chmod 644 "$destino"        # launchd rechaza plists escribibles por grupo
  launchctl bootout "system/${label}" 2>/dev/null
  if launchctl bootstrap system "$destino" 2>/dev/null; then ok "$label cargado"; else mal "$label NO cargó"; fi
done
echo

# ── 2. Verificar antes de desarmar nada ───────────────────────────────────────
echo "2· Verificación"
CLOCK_OK=0; DOG_OK=0
launchctl print "system/${CLOCK}" >/dev/null 2>&1 && { CLOCK_OK=1; ok "el reloj está en el dominio system"; }  || mal "el reloj no aparece cargado"
launchctl print "system/${DOG}"   >/dev/null 2>&1 && { DOG_OK=1;   ok "el watchdog está en el dominio system"; } || mal "el watchdog no aparece cargado"

if [ "$CLOCK_OK" -ne 1 ]; then
  echo
  mal "NO retiro el LaunchAgent viejo: es lo único que queda en pie."
  echo "     Mirá: sudo launchctl print system/${CLOCK}"
  exit 1
fi
echo

# ── 3. Energía: que vuelva sola ───────────────────────────────────────────────
echo "3· Energía"
pmset -a sleep 0            2>/dev/null && ok "no se duerme"            || info "sleep 0 no aplicó"
pmset -a disablesleep 1     2>/dev/null && ok "sueño deshabilitado"     || info "disablesleep no aplica en este modelo"
pmset -a autorestart 1      2>/dev/null && ok "reinicia tras corte de luz" || info "autorestart no aplicó"
pmset -a womp 1             2>/dev/null && ok "despierta por red"       || info "womp no aplicó"
echo

# ── 4. Retirar el reloj viejo (recién ahora) ─────────────────────────────────
echo "4· Reloj viejo"
for label in "${VIEJOS[@]}"; do
  if launchctl print "gui/${UID_USUARIO}/${label}" >/dev/null 2>&1; then
    launchctl bootout "gui/${UID_USUARIO}/${label}" 2>/dev/null && ok "$label retirado" || mal "no pude retirar $label"
  else
    info "$label no estaba cargado"
  fi
  # Sacar el plist también: si no, el próximo login lo vuelve a cargar y quedan dos relojes.
  viejo_plist="/Users/${USUARIO}/Library/LaunchAgents/${label}.plist"
  [ -f "$viejo_plist" ] && mv "$viejo_plist" "${viejo_plist}.retirado" && ok "$label.plist archivado"
done
echo

# ── 5. La puerta (opcional) ───────────────────────────────────────────────────
echo "5· Acceso remoto"
if [ "$CON_SSH" -ne 1 ] && [ -t 0 ]; then
  read -r -p "  ¿Prender Sesión remota (SSH) para poder diagnosticar sin viajar? [s/N]: " r
  [[ "$r" =~ ^[sSyY]$ ]] && CON_SSH=1
fi
if [ "$CON_SSH" -eq 1 ]; then
  systemsetup -setremotelogin on >/dev/null 2>&1 && ok "Sesión remota encendida" || mal "no pude encender Sesión remota (hacelo en Ajustes → General → Compartir)"
  # El firewall de aplicaciones descarta el 22 en silencio aunque sshd esté arriba:
  # ese fue el síntoma exacto (timeout, no "connection refused") visto desde afuera.
  FW=/usr/libexec/ApplicationFirewall/socketfilterfw
  if [ -x "$FW" ]; then
    "$FW" --add /usr/libexec/sshd-keygen-wrapper >/dev/null 2>&1
    "$FW" --unblockapp /usr/libexec/sshd-keygen-wrapper >/dev/null 2>&1 && ok "firewall: sshd permitido" \
      || info "revisá Ajustes → Red → Firewall → Opciones y permití sshd"
  fi
else
  info "sin SSH: el próximo diagnóstico va a necesitar alguien acá"
fi
echo

# ── 6. Cierre ─────────────────────────────────────────────────────────────────
echo "── Listo ──"
launchctl print "system/${CLOCK}" 2>/dev/null | grep -E "^\s+(state|last exit code)" | sed 's/^/  reloj:    /'
launchctl print "system/${DOG}"   2>/dev/null | grep -E "^\s+(state|last exit code)" | sed 's/^/  watchdog: /'
echo
echo "  El watchdog late al cerebro cada 10 min. Para verlo desde acá:"
echo "    tail -f /var/log/wonderland-watchdog.log"
echo "  Y el reloj:"
echo "    tail -f /Users/${USUARIO}/Library/Logs/wonderland.err.log"
echo
echo "  En el cerebro, el latido queda en /api/bestia/heartbeat y si se corta más de"
echo "  30 min aparece un hallazgo 'bestia-muda' que Dark Alice avisa por WhatsApp."
