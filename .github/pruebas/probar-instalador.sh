#!/bin/bash
# Prueba scripts/instalar.sh contra el marketplace de esta copia del repositorio: en local, repetido, en global y con lo global ya puesto.
set -euo pipefail

repo=$PWD
export MARKETPLACE=$repo
temporal="${RUNNER_TEMP:-$(mktemp -d)}"
proyecto="$temporal/mi-proyecto"
otro="$temporal/otro-proyecto"
mkdir -p "$proyecto" "$otro"
proyecto=$(cd "$proyecto" && pwd -P)

# Lanza el instalador desde una carpeta y comprueba que su salida dice lo esperado.
esperar() {
  local alcance=$1 carpeta=$2 texto=$3 salida
  salida=$(cd "$carpeta" && ALCANCE=$alcance bash "$repo/scripts/instalar.sh" 2>&1) || true
  echo "$salida"
  [[ "$salida" == *"$texto"* ]] || { echo "✖ Se esperaba: $texto"; exit 1; }
  echo "✔ $texto"
}

esperar local "$proyecto" 'Instalado solo en mi-proyecto'
guardada=$(claude plugin list --json | python3 -c "import json, sys; print(next(p['projectPath'] for p in json.load(sys.stdin) if p['id'] == 'images-claude-vscode@claude-vscode-images' and p['scope'] == 'local'))")
[ "$guardada" = "$proyecto" ] || { echo "✖ Claude Code guarda la carpeta como '$guardada', no '$proyecto'"; exit 1; }
esperar local "$proyecto" 'Ya lo tienes instalado en mi-proyecto'

esperar global "$proyecto" 'Instalado para todos tus proyectos'
esperar global "$proyecto" 'Ya lo tienes instalado para todos tus proyectos'
esperar local "$otro" 'otro-proyecto ya funciona'
