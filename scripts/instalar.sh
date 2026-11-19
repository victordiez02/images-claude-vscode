#!/bin/bash
# Instala el mod images-claude-vscode en la carpeta actual o para todos tus proyectos, con un menú en la terminal (macOS).

MOD=images-claude-vscode
ID="$MOD@claude-vscode-images"
FUENTE="${MARKETPLACE:-victordiez02/images-claude-vscode}"
VERSION_MINIMA=2.1.327

NEGRITA=$'\033[1m'
TENUE=$'\033[2m'
VERDE=$'\033[32m'
AMARILLO=$'\033[33m'
ROJO=$'\033[31m'
CIAN=$'\033[36m'
NORMAL=$'\033[0m'

trap 'tput cnorm 2>/dev/null; printf "\n"; exit 130' INT

detalle() {
  [ -n "$1" ] && printf '    %s%s%s\n' "$TENUE" "$1" "$NORMAL"
}

hecho() {
  printf '\n  %s✔%s %s\n' "$VERDE" "$NORMAL" "$1"
  detalle "${2:-}"
  printf '\n'
}

aviso() {
  printf '\n  %s●%s %s\n' "$AMARILLO" "$NORMAL" "$1"
  detalle "${2:-}"
  printf '\n'
  exit 0
}

fallo() {
  printf '\n  %s✖ %s%s\n' "$ROJO" "$1" "$NORMAL"
  detalle "${2:-}"
  printf '\n'
  exit 1
}

# El primer Claude Code que entiende mods: el del PATH o, si es antiguo, el de la extensión de VS Code.
buscar_claude() {
  local candidato version
  for candidato in "$(command -v claude)" $(ls -d "$HOME"/.vscode/extensions/anthropic.claude-code-*/resources/native-binary/claude 2>/dev/null | sort -rV); do
    [ -x "$candidato" ] || continue
    version=$("$candidato" --version 2>/dev/null | awk '{print $1}')
    if [ "$(printf '%s\n%s\n' "$VERSION_MINIMA" "$version" | sort -V | head -1)" = "$VERSION_MINIMA" ]; then
      printf '%s' "$candidato"
      return
    fi
  done
}

# Menú de flechas: cada opción es «título|descripción»; deja el índice elegido en ELEGIDA.
elegir() {
  local opciones=("$@") actual=0 tecla i
  tput civis
  while true; do
    for i in "${!opciones[@]}"; do
      if [ "$i" -eq "$actual" ]; then
        printf '  %s❯ %s%s\n' "$CIAN$NEGRITA" "${opciones[$i]%%|*}" "$NORMAL"
      else
        printf '    %s\n' "${opciones[$i]%%|*}"
      fi
      printf '    %s%s%s\n' "$TENUE" "${opciones[$i]#*|}" "$NORMAL"
    done
    IFS= read -rsn1 tecla
    case "$tecla" in
      $'\033')
        read -rsn2 tecla
        [ "$tecla" = '[A' ] && [ "$actual" -gt 0 ] && actual=$((actual - 1))
        [ "$tecla" = '[B' ] && [ "$actual" -lt $((${#opciones[@]} - 1)) ] && actual=$((actual + 1))
        ;;
      '') break ;;
    esac
    printf '\033[%dA' $((${#opciones[@]} * 2))
  done
  tput cnorm
  ELEGIDA=$actual
}

# Cada instalación del mod como «alcance<TAB>carpeta del proyecto».
instalaciones() {
  local json i id
  json=$("$CLAUDE" plugin list --json 2>/dev/null) || return
  i=0
  while id=$(printf '%s' "$json" | plutil -extract "$i.id" raw -o - - 2>/dev/null); do
    if [ "$id" = "$ID" ]; then
      printf '%s\t%s\n' \
        "$(printf '%s' "$json" | plutil -extract "$i.scope" raw -o - - 2>/dev/null)" \
        "$(printf '%s' "$json" | plutil -extract "$i.projectPath" raw -o - - 2>/dev/null)"
    fi
    i=$((i + 1))
  done
}

instalar() {
  local alcance=$1 carpeta=$2 salida
  printf '\n  %sInstalando…%s\n' "$TENUE" "$NORMAL"
  if ! salida=$(cd "$carpeta" && "$CLAUDE" plugin install "$MOD" --marketplace "$FUENTE" --scope "$alcance" </dev/null 2>&1); then
    printf '%s\n' "$salida" | sed "s/^/    $TENUE/;s/$/$NORMAL/"
    fallo "No se pudo instalar."
  fi
}

printf '\n  %simages-claude-vscode%s %s· instalador%s\n' "$NEGRITA" "$NORMAL" "$TENUE" "$NORMAL"

[ "$(uname)" = Darwin ] || fallo "Este instalador es para macOS." \
  "En Windows, en PowerShell: irm https://raw.githubusercontent.com/victordiez02/images-claude-vscode/main/scripts/instalar.ps1 | iex"

PROYECTO=$(pwd -P)
NOMBRE=$(basename "$PROYECTO")

CLAUDE=$(buscar_claude)
[ -n "$CLAUDE" ] || fallo "No encuentro Claude Code $VERSION_MINIMA o posterior." "Actualízalo con «claude update» o instala la extensión de Claude Code para VS Code."

case "${ALCANCE:-}" in
  local) ELEGIDA=0 ;;
  global) ELEGIDA=1 ;;
  '')
    [ -t 0 ] || fallo "Sin terminal para el menú." "Elige con ALCANCE=global o ALCANCE=local delante del comando."
    printf '\n  ¿Dónde quieres usarlo?\n\n'
    elegir "Solo en $NOMBRE|Local: solo en esta carpeta, y solo para ti" \
      "Todos mis proyectos|Global: se activa en cualquier proyecto que abras"
    ;;
  *) fallo "ALCANCE debe ser «global» o «local»." ;;
esac

if [ "$ELEGIDA" -eq 1 ]; then
  instalaciones | grep -q '^user' && aviso "Ya lo tienes instalado para todos tus proyectos." \
    "Para traer la última versión: claude plugin update $ID"
  instalar user "$HOME"
  hecho "Instalado para todos tus proyectos." "Abre una conversación nueva en el chat de Claude de VS Code para que cargue."
  exit 0
fi

instalaciones | grep -q '^user' && aviso "Ya lo tienes instalado para todos tus proyectos, así que en $NOMBRE ya funciona." \
  "No hace falta instalarlo también aquí."
instalaciones | grep -qxE "(local|project)	$PROYECTO" && aviso "Ya lo tienes instalado en $NOMBRE." "$PROYECTO"
instalar local "$PROYECTO"
hecho "Instalado solo en $NOMBRE." "Abre en VS Code una conversación nueva de ese proyecto para que cargue."
