#!/bin/bash
# Imprime la ruta de node, o sale 1 si no hay ninguno.
#
# POR QUÉ EXISTE: el plist viejo hardcodeaba /Users/eduardobonilla/.volta/bin/node.
# Volta mueve sus shims cuando cambia la versión, y el día que eso pasó launchd
# empezó a fallar contra un log local que nadie podía leer — sin SSH, el reloj
# quedó muerto en silencio. Una ruta hardcodeada a un shim es una bomba de tiempo.
#
# El orden busca primero lo que el usuario usa a diario, después lo del sistema.
set -u

for candidato in \
  "${HOME:-/}/.volta/bin/node" \
  "/opt/homebrew/bin/node" \
  "/usr/local/bin/node" \
  "/usr/bin/node"
do
  [ -x "$candidato" ] && { echo "$candidato"; exit 0; }
done

# nvm: la versión "default" si existe, si no la más nueva que haya instalada.
if [ -d "${HOME:-/}/.nvm/versions/node" ]; then
  nvm_node=$(ls -1 "${HOME}/.nvm/versions/node" 2>/dev/null | sort -V | tail -1)
  [ -n "$nvm_node" ] && [ -x "${HOME}/.nvm/versions/node/${nvm_node}/bin/node" ] && {
    echo "${HOME}/.nvm/versions/node/${nvm_node}/bin/node"; exit 0; }
fi

# Último recurso: lo que diga el PATH (launchd da un PATH mínimo, así que rara vez sirve).
en_path=$(command -v node 2>/dev/null) && [ -n "$en_path" ] && { echo "$en_path"; exit 0; }

echo "node-resolve: no encontré node en ninguna ruta conocida" >&2
exit 1
