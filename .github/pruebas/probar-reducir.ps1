# Prueba hooks/reducir.ps1 tal y como lo llama imagen.ts: valores delante, -EncodedCommand y la imagen por ruta o en base64 por la entrada.
# Solo ASCII: Windows PowerShell 5.1 lee como ANSI los scripts UTF-8 sin BOM.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$carpeta = Join-Path $env:RUNNER_TEMP 'imagenes'
New-Item -ItemType Directory -Force $carpeta | Out-Null
$script = Get-Content -Raw -Encoding UTF8 plugins\images-claude-vscode\hooks\reducir.ps1

# Muchas elipses de colores para que la imagen pese y obligue a bajar de resolucion.
function Crear-Imagen([string]$ruta, $formato, [int]$ancho, [int]$alto, [bool]$transparente, [int]$elipses) {
  $mapa = [Drawing.Bitmap]::new($ancho, $alto)
  $lienzo = [Drawing.Graphics]::FromImage($mapa)
  $lienzo.Clear($(if ($transparente) { [Drawing.Color]::Transparent } else { [Drawing.Color]::White }))
  $azar = [Random]::new(1)
  for ($i = 0; $i -lt $elipses; $i++) {
    $color = [Drawing.Color]::FromArgb(255, $azar.Next(256), $azar.Next(256), $azar.Next(256))
    $lienzo.FillEllipse([Drawing.SolidBrush]::new($color), $azar.Next($ancho), $azar.Next($alto), $azar.Next(4, 60), $azar.Next(4, 60))
  }
  $lienzo.Dispose()
  $mapa.Save($ruta, $formato)
  $mapa.Dispose()
}

function Reducir([string]$ruta, [string]$entrada) {
  $valores = "`$ruta = '$($ruta -replace "'", "''")'`n`$lados = 640, 480, 400, 320`n`$maximo = 60000`n"
  $codificado = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($valores + $script))
  $salida = $entrada | powershell.exe -NoProfile -NonInteractive -EncodedCommand $codificado
  if ($LASTEXITCODE -ne 0) { throw "reducir.ps1 termino con $LASTEXITCODE para '$ruta'" }
  $ancho, $alto, $base64 = "$salida".Trim() -split ' '
  [pscustomobject]@{ Ancho = [int]$ancho; Alto = [int]$alto; Base64 = $base64 }
}

function Comprobar([string]$nombre, $vista, [int]$anchoEsperado) {
  if (-not $vista.Base64.StartsWith('/9j/')) { throw "${nombre}: no es un JPEG" }
  if ($vista.Base64.Length -gt 60000) { throw "${nombre}: ocupa $($vista.Base64.Length) caracteres" }
  if ([Math]::Max($vista.Ancho, $vista.Alto) -gt 640) { throw "${nombre}: $($vista.Ancho)x$($vista.Alto) pasa de 640" }
  if ($anchoEsperado -and $vista.Ancho -ne $anchoEsperado) { throw "${nombre}: ancho $($vista.Ancho), se esperaba $anchoEsperado" }
  Write-Host "OK ${nombre}: $($vista.Ancho)x$($vista.Alto), $($vista.Base64.Length) caracteres"
}

$detallada = Join-Path $carpeta 'detallada.png'
$conNombreRaro = Join-Path $carpeta ("con espacios, " + [char]0xF1 + " y comilla's.jpg")
$pequena = Join-Path $carpeta 'pequena.gif'
$transparente = Join-Path $carpeta 'transparente.png'
Crear-Imagen $detallada ([Drawing.Imaging.ImageFormat]::Png) 1600 1200 $true 3000
Crear-Imagen $conNombreRaro ([Drawing.Imaging.ImageFormat]::Jpeg) 800 600 $false 500
Crear-Imagen $pequena ([Drawing.Imaging.ImageFormat]::Gif) 200 100 $false 20
Crear-Imagen $transparente ([Drawing.Imaging.ImageFormat]::Png) 100 100 $true 0

Comprobar 'PNG grande por ruta' (Reducir $detallada '') 0
Comprobar 'JPG con espacios, enie y comilla en el nombre' (Reducir $conNombreRaro '') 0
Comprobar 'GIF pequeno sin ampliar' (Reducir $pequena '') 200
Comprobar 'PNG grande en base64 por la entrada' (Reducir '' ([Convert]::ToBase64String([IO.File]::ReadAllBytes($detallada)))) 0

# Lo transparente tiene que quedar blanco, no negro.
$vista = Reducir $transparente ''
$pixel = [Drawing.Bitmap]::FromStream([IO.MemoryStream]::new([Convert]::FromBase64String($vista.Base64))).GetPixel(50, 50)
if ($pixel.R -lt 240 -or $pixel.G -lt 240 -or $pixel.B -lt 240) { throw "La transparencia queda como $pixel, no blanca" }
Write-Host "OK transparencia sobre blanco: $pixel"
