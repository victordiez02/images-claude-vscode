#!/bin/bash
# Prueba hooks/reducir.sh tal y como lo llama imagen.ts: la imagen por ruta o en base64 por la entrada, el máximo y los lados.
set -euo pipefail

reducir="$PWD/plugins/images-claude-vscode/hooks/reducir.sh"
carpeta="${RUNNER_TEMP:-$(mktemp -d)}/imagenes"
mkdir -p "$carpeta"

# PNG con mosaicos de colores (y transparencia, si se pide) para que pese y obligue a bajar de resolución.
crear_png() {
  python3 - "$@" <<'EOF'
import random, struct, sys, zlib
ruta, ancho, alto, tesela, transparente = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), sys.argv[5] == 'si'
random.seed(1)
colores = {}
def color(x, y):
    if tesela == 0:
        return b'\x00\x00\x00\x00'
    clave = (x // tesela, y // tesela)
    if clave not in colores:
        colores[clave] = bytes([random.randrange(256) for _ in range(3)]) + (b'\x80' if transparente else b'\xff')
    return colores[clave]
filas = b''.join(b'\x00' + b''.join(color(x, y) for x in range(ancho)) for y in range(alto))
bloque = lambda tipo, datos: struct.pack('>I', len(datos)) + tipo + datos + struct.pack('>I', zlib.crc32(tipo + datos) & 0xffffffff)
cabecera = struct.pack('>IIBBBBB', ancho, alto, 8, 6, 0, 0, 0)
open(ruta, 'wb').write(b'\x89PNG\r\n\x1a\n' + bloque(b'IHDR', cabecera) + bloque(b'IDAT', zlib.compress(filas)) + bloque(b'IEND', b''))
EOF
}

comprobar() {
  local nombre=$1 salida=$2 ancho_esperado=$3 ancho alto base64
  read -r ancho alto base64 <<< "$salida"
  [[ "$base64" == /9j/* ]] || { echo "✖ $nombre: no es un JPEG"; exit 1; }
  [ "${#base64}" -le 60000 ] || { echo "✖ $nombre: ocupa ${#base64} caracteres"; exit 1; }
  [ "$ancho" -le 640 ] && [ "$alto" -le 640 ] || { echo "✖ $nombre: ${ancho}x${alto} pasa de 640"; exit 1; }
  [ "$ancho_esperado" = 0 ] || [ "$ancho" = "$ancho_esperado" ] || { echo "✖ $nombre: ancho $ancho, se esperaba $ancho_esperado"; exit 1; }
  echo "✔ $nombre: ${ancho}x${alto}, ${#base64} caracteres"
}

detallada="$carpeta/detallada.png"
nombre_raro="$carpeta/con espacios, ñ y comilla's.jpg"
pequena="$carpeta/pequeña.gif"
transparente="$carpeta/transparente.png"
crear_png "$detallada" 1600 1200 24 si
crear_png "$carpeta/base.png" 800 600 20 no
crear_png "$carpeta/pequena.png" 200 100 20 no
crear_png "$transparente" 100 100 0 si
sips -s format jpeg "$carpeta/base.png" --out "$nombre_raro" >/dev/null
sips -s format gif "$carpeta/pequena.png" --out "$pequena" >/dev/null

comprobar 'PNG grande por ruta' "$(bash "$reducir" "$detallada" 60000 640 480 400 320)" 0
comprobar 'JPG con espacios, ñ y comilla en el nombre' "$(bash "$reducir" "$nombre_raro" 60000 640 480 400 320)" 0
comprobar 'GIF pequeño sin ampliar' "$(bash "$reducir" "$pequena" 60000 640 480 400 320)" 200
comprobar 'PNG grande en base64 por la entrada' "$(base64 -i "$detallada" | bash "$reducir" '' 60000 640 480 400 320)" 0

# Lo transparente tiene que quedar blanco, no negro.
read -r _ _ base64 <<< "$(bash "$reducir" "$transparente" 60000 640)"
echo "$base64" | base64 -D -o "$carpeta/vista.jpg"
sips -s format bmp "$carpeta/vista.jpg" --out "$carpeta/vista.bmp" >/dev/null
pixel=$(python3 -c "import sys; d = open(sys.argv[1], 'rb').read(); o = int.from_bytes(d[10:14], 'little'); print(min(d[o:o + 3]))" "$carpeta/vista.bmp")
[ "$pixel" -ge 240 ] || { echo "✖ La transparencia queda oscura ($pixel), no blanca"; exit 1; }
echo "✔ transparencia sobre blanco"

if bash "$reducir" "$carpeta/no-existe.png" 60000 640 >/dev/null; then
  echo "✖ Un archivo que no existe no da error"
  exit 1
fi
echo "✔ un archivo que no existe da error"
