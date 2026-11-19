#!/bin/bash
# Reduce una imagen a JPEG con sips (macOS), del lado más grande cuya base64 quepa en el máximo; la transparencia queda sobre blanco.
# Uso: reducir.sh <ruta, o vacía si la imagen llega en base64 por la entrada> <máximo> <lados…>
# Escribe «ancho alto base64» y trabaja en una carpeta temporal que se borra al acabar.

ruta=$1
maximo=$2
shift 2

carpeta=$(/usr/bin/mktemp -d -t images-claude-vscode) || exit 1
trap '/bin/rm -rf "$carpeta"' EXIT

medidas() {
  /usr/bin/sips -g pixelWidth -g pixelHeight "$1" 2>/dev/null | awk '/pixelWidth/ { a = $2 } /pixelHeight/ { h = $2 } END { if (a && h) print a, h }'
}

if [ -z "$ruta" ]; then
  ruta="$carpeta/original"
  /usr/bin/base64 -D -o "$ruta" || exit 1
fi
read -r ancho alto <<< "$(medidas "$ruta")"
[ -n "$ancho" ] || exit 1
mayor=$((ancho > alto ? ancho : alto))

for lado in "$@"; do
  tope=$((lado < mayor ? lado : mayor))
  /usr/bin/sips -Z "$tope" -s format jpeg -s formatOptions 70 "$ruta" --out "$carpeta/vista.jpg" >/dev/null 2>&1 || exit 1
  base64=$(/usr/bin/base64 -i "$carpeta/vista.jpg")
  if [ "${#base64}" -le "$maximo" ]; then
    echo "$(medidas "$carpeta/vista.jpg") $base64"
    exit 0
  fi
done
exit 1
