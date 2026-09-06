#!/bin/bash
# Configura las credenciales de Cheshire en la máquina donde corren los agentes.
#
# Se corre A MANO, allá, una sola vez:  bash alicia-brain/scripts/cheshire-setup.sh
#
# La contraseña se pide acá, oculta, y va directo al .env. NUNCA se commitea: este
# repo es público, y un secreto en el historial de git queda para siempre — borrarlo
# después exige reescribir la historia Y rotar la clave igual. Por eso el script viaja
# por git y la credencial no.
set -e

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$HERE/../.env"

echo "── Cheshire · credenciales del tester E2E ──"
echo

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ No encuentro $ENV_FILE"
  echo "   ¿Estás en la máquina donde corren los agentes?"
  exit 1
fi

# Backup antes de tocar nada: un .env roto deja al brain sin NINGUNA credencial,
# no solo sin las de Cheshire.
BACKUP="$ENV_FILE.bak.$(date +%Y%m%d-%H%M%S)"
cp "$ENV_FILE" "$BACKUP"
echo "✅ Backup: $BACKUP"
echo

# El space de QA ya existe en el ERP; su id se precarga para que acá sea un Enter.
# Si algún día se recrea el space, el id cambia (es "custom_" + timestamp de creación)
# y hay que pasarlo a mano — por eso se puede sobrescribir.
SPACE_DEFAULT="custom_1788675158094"   # "Cheshire" · creado el 6 sep 2026
read -r -p "CHESHIRE_SPACE [$SPACE_DEFAULT]: " SPACE
SPACE="${SPACE:-$SPACE_DEFAULT}"
read -r -s -p "CHESHIRE_PASSWORD (no se muestra): " PASS; echo
if [ -z "$PASS" ]; then echo "❌ Sin contraseña no hay nada que configurar."; exit 1; fi

# Quita las CHESHIRE_* previas: dos valores de la misma variable en un .env es
# ambiguo y depende del orden de lectura. Mejor una sola, la nueva.
grep -v -E '^CHESHIRE_(EMAIL|PASSWORD|SPACE)=' "$ENV_FILE" > "$ENV_FILE.tmp" || true
{
  echo "CHESHIRE_EMAIL=cheshire@hygge.pe"
  echo "CHESHIRE_PASSWORD=$PASS"
  [ -n "$SPACE" ] && echo "CHESHIRE_SPACE=$SPACE"
} >> "$ENV_FILE.tmp"
mv "$ENV_FILE.tmp" "$ENV_FILE"
chmod 600 "$ENV_FILE"

echo
echo "✅ Quedó así (contraseña tapada):"
grep -E '^CHESHIRE_' "$ENV_FILE" | sed 's/^CHESHIRE_PASSWORD=.*/CHESHIRE_PASSWORD=••••••••/'
echo
echo "Cheshire lo toma en su próxima corrida (launchd, cada 30 min)."
[ -z "$SPACE" ] && echo "⚠️  Sin CHESHIRE_SPACE no ejercita el flujo de crear tarea. Volvé a correr esto cuando tengas el id."
