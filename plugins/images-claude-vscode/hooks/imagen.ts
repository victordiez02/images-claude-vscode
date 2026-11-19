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

// Reduce la imagen con el script de cada sistema (reducir.sh con sips en macOS, reducir.ps1 con PowerShell en Windows), que escribe «ancho alto base64».
export async function reducir($: EngineInterface, origen: Origen): Promise<Vista | null> {
  const orden = await ordenDe($, 'ruta' in origen ? origen.ruta : '')
  if (!orden) {
    return null
  }
  const hecha = await $.process.run(orden, { stdin: 'base64' in origen ? origen.base64 : '', timeoutMs: 60000 }).catch(() => null)
  const [ancho, alto, base64] = (hecha?.stdout ?? '').trim().split(' ')
  return hecha?.exitCode === 0 && Number(ancho) > 0 && Number(alto) > 0 && base64 ? { base64, ancho: Number(ancho), alto: Number(alto) } : null
}

// En Windows los valores van por delante del script porque -EncodedCommand no admite parámetros.
async function ordenDe($: EngineInterface, ruta: string): Promise<string[] | null> {
  const sistema = await sistemaDe($)
  if (sistema === 'macos') {
    return ['/bin/bash', `${$.plugin.root}/hooks/reducir.sh`, ruta, String(MAXIMO_BASE64), ...LADOS.map(String)]
  }
  if (sistema === 'windows') {
    const valores = `$ruta = '${ruta.replace(/'/g, "''")}'\n$lados = ${LADOS.join(', ')}\n$maximo = ${MAXIMO_BASE64}\n`
    const script = await $.fs.read(`${$.plugin.root}/hooks/reducir.ps1`)
    return ['powershell.exe', '-NoProfile', '-NonInteractive', '-EncodedCommand', utf16EnBase64(valores + script)]
  }
  return null
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
