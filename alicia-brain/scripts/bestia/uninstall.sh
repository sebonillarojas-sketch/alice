#!/bin/bash
# Deshace lo que hizo install.sh. Existe porque el install se puede correr en la
# máquina equivocada —pasó— y desarmarlo a mano son seis comandos que hay que
# recordar bien.
#
#   sudo bash alicia-brain/scripts/bestia/uninstall.sh            # deja SSH como está
#   sudo bash alicia-brain/scripts/bestia/uninstall.sh --sin-ssh  # además apaga Sesión remota
#
# El repo, los logs y el estado del scheduler NO se tocan: son la evidencia de qué
# pasó, y borrarlos es justo lo que no hay que hacer.
set -u

CLOCK="com.hygge.wonderland.clock"
DOG="com.hygge.wonderland.watchdog"
LD="/Library/LaunchDaemons"
SIN_SSH=0
[ "${1:-}" = "--sin-ssh" ] && SIN_SSH=1

ok()   { echo "  ✅ $*"; }
info() { echo "  ·  $*"; }

[ "$(id -u)" -ne 0 ] && { echo "  ❌ Necesita sudo."; exit 1; }

echo "── Reloj de Wonderland · desinstalación ──"
echo

echo "1· Daemons"
for label in "$CLOCK" "$DOG"; do
  if launchctl print "system/${label}" >/dev/null 2>&1; then
    launchctl bootout "system/${label}" 2>/dev/null && ok "$label descargado" || info "no pude descargar $label"
  else
    info "$label no estaba cargado"
  fi
  [ -f "$LD/${label}.plist" ] && rm -f "$LD/${label}.plist" && ok "$label.plist borrado"
done
echo

# Energía: volver a los valores de fábrica. En una laptop esto importa de verdad —
# `sleep 0` + `disablesleep 1` significa que no se duerme NUNCA, ni con la tapa
# cerrada, y eso es batería y calor.
echo "2· Energía"
pmset -a disablesleep 0 2>/dev/null && ok "vuelve a poder dormir"
if pmset restoredefaults 2>/dev/null; then
  ok "valores de energía restaurados a los de fábrica"
  info "si tenías preferencias propias, revisá Ajustes → Batería"
else
  info "no pude restaurar defaults; revisá Ajustes → Batería"
fi
echo

echo "3· Acceso remoto"
if [ "$SIN_SSH" -eq 1 ]; then
  systemsetup -setremotelogin off >/dev/null 2>&1 && ok "Sesión remota apagada" || info "apagala en Ajustes → General → Compartir"
else
  estado=$(systemsetup -getremotelogin 2>/dev/null | tr -d '\n')
  info "${estado:-Sesión remota: ?} (se deja como está; --sin-ssh la apaga)"
fi
echo

echo "── Listo. El repo, los logs y el estado del scheduler quedaron intactos. ──"
