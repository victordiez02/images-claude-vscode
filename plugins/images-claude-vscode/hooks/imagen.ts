import type { EngineInterface } from 'claude-code'

const LADOS = [640, 480, 400, 320]
// La conversación descarta en silencio el _meta de un resultado de 64 KB o más.
const MAXIMO_BASE64 = 60000

// JPEG reducido en base64 y sus medidas en píxeles.
export type Vista = { base64: string; ancho: number; alto: number }
export type Origen = { ruta: string } | { base64: string }

export async function sistemaDe($: EngineInterface): Promise<string> {
  return (await $.session.info()).platform ?? 'unknown'
}

// Reduce la imagen con la herramienta que trae cada sistema: sips en macOS y PowerShell en Windows.
export async function reducir($: EngineInterface, origen: Origen): Promise<Vista | null> {
  const sistema = await sistemaDe($)
  return sistema === 'windows' ? reducirEnWindows($, origen) : sistema === 'macos' ? reducirEnMacos($, origen) : null
}

// Convierte la imagen a JPEG con sips, del lado más grande que quepa en MAXIMO_BASE64, en una carpeta temporal que se borra al acabar.
async function reducirEnMacos($: EngineInterface, origen: Origen): Promise<Vista | null> {
  const carpeta = (await $.process.run(['/usr/bin/mktemp', '-d', '-t', 'images-claude-vscode'])).stdout.trim()
  try {
    const entrada = 'ruta' in origen ? origen.ruta : `${carpeta}/original`
    if ('base64' in origen) {
      const escrita = await $.process.run(['/usr/bin/base64', '-D', '-o', entrada], { stdin: origen.base64 })
      if (escrita.exitCode !== 0) {
        return null
      }
    }
    const original = await medidas($, entrada)
    if (!original) {
      return null
    }
    const salida = `${carpeta}/vista.jpg`
    for (const lado of LADOS) {
      const tope = String(Math.min(lado, Math.max(original.ancho, original.alto)))
      const hecha = await $.process.run(['/usr/bin/sips', '-Z', tope, '-s', 'format', 'jpeg', '-s', 'formatOptions', '70', entrada, '--out', salida])
      const reducida = hecha.exitCode === 0 ? await medidas($, salida) : null
      if (!reducida) {
        return null
      }
      const { base64 } = await $.fs.read(salida, { as: 'bytes' })
      if (base64.length <= MAXIMO_BASE64) {
        return { base64, ...reducida }
      }
    }
    return null
  } finally {
    await $.process.run(['/bin/rm', '-rf', carpeta])
  }
}

async function medidas($: EngineInterface, ruta: string) {
  const { exitCode, stdout } = await $.process.run(['/usr/bin/sips', '-g', 'pixelWidth', '-g', 'pixelHeight', ruta])
  const ancho = Number(/pixelWidth: (\d+)/.exec(stdout)?.[1])
  const alto = Number(/pixelHeight: (\d+)/.exec(stdout)?.[1])
  return exitCode === 0 && ancho > 0 && alto > 0 ? { ancho, alto } : null
}

// Lo mismo en Windows con reducir.ps1, en memoria; los valores van por delante del script porque -EncodedCommand no admite parámetros.
async function reducirEnWindows($: EngineInterface, origen: Origen): Promise<Vista | null> {
  const ruta = 'ruta' in origen ? origen.ruta.replace(/'/g, "''") : ''
  const valores = `$ruta = '${ruta}'\n$lados = ${LADOS.join(', ')}\n$maximo = ${MAXIMO_BASE64}\n`
  const script = await $.fs.read(`${$.plugin.root}/hooks/reducir.ps1`)
  const hecha = await $.process
    .run(['powershell.exe', '-NoProfile', '-NonInteractive', '-EncodedCommand', utf16EnBase64(valores + script)], {
      stdin: 'base64' in origen ? origen.base64 : '',
      timeoutMs: 60000,
    })
    .catch(() => null)
  const [ancho, alto, base64] = (hecha?.stdout ?? '').trim().split(' ')
  return hecha?.exitCode === 0 && Number(ancho) > 0 && Number(alto) > 0 && base64 ? { base64, ancho: Number(ancho), alto: Number(alto) } : null
}

// -EncodedCommand espera el script en UTF-16LE y base64, sin problemas de comillas.
function utf16EnBase64(texto: string): string {
  let binario = ''
  for (let i = 0; i < texto.length; i++) {
    const codigo = texto.charCodeAt(i)
    binario += String.fromCharCode(codigo & 0xff, codigo >> 8)
  }
  return btoa(binario)
}
