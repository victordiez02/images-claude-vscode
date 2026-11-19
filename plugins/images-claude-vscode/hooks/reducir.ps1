# Reduce una imagen a JPEG con los códecs de Windows (WIC), del lado más grande cuya base64 quepa en $maximo.
# Antes de este script, imagen.ts define $ruta (vacía si la imagen llega en base64 por la entrada), $lados y $maximo.
# Escribe «ancho alto base64»; la transparencia queda sobre blanco.

Add-Type -AssemblyName PresentationCore, WindowsBase
$ErrorActionPreference = 'Stop'

$bytes = if ($ruta) { [IO.File]::ReadAllBytes($ruta) } else { [Convert]::FromBase64String([Console]::In.ReadToEnd().Trim()) }
$imagen = [Windows.Media.Imaging.BitmapDecoder]::Create([IO.MemoryStream]::new($bytes), 'PreservePixelFormat', 'OnLoad').Frames[0]
$mayor = [Math]::Max($imagen.PixelWidth, $imagen.PixelHeight)

foreach ($lado in $lados) {
  $escala = [Math]::Min($lado, $mayor) / $mayor
  $reducida = [Windows.Media.Imaging.TransformedBitmap]::new($imagen, [Windows.Media.ScaleTransform]::new($escala, $escala))
  $ancho = $reducida.PixelWidth
  $alto = $reducida.PixelHeight

  $marco = [Windows.Rect]::new(0, 0, $ancho, $alto)
  $dibujo = [Windows.Media.DrawingVisual]::new()
  $lienzo = $dibujo.RenderOpen()
  $lienzo.DrawRectangle([Windows.Media.Brushes]::White, $null, $marco)
  $lienzo.DrawImage($reducida, $marco)
  $lienzo.Close()
  $plano = [Windows.Media.Imaging.RenderTargetBitmap]::new($ancho, $alto, 96, 96, [Windows.Media.PixelFormats]::Pbgra32)
  $plano.Render($dibujo)

  $jpeg = [Windows.Media.Imaging.JpegBitmapEncoder]::new()
  $jpeg.QualityLevel = 70
  $jpeg.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($plano))
  $salida = [IO.MemoryStream]::new()
  $jpeg.Save($salida)
  $base64 = [Convert]::ToBase64String($salida.ToArray())
  if ($base64.Length -le $maximo) {
    "$ancho $alto $base64"
    exit 0
  }
}
exit 1
