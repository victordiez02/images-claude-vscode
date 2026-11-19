import type { EngineInterface } from 'claude-code'

export function nombreDe(ruta: string): string {
  return ruta.split(/[\\/]/).pop() || ruta
}

export function escaparMarkdown(texto: string): string {
  return texto.replace(/[\\[\]()*_`]/g, '\\$&')
}

// Enlace file:// de la ruta, con barras normales también en Windows (file:///C:/…).
export async function enlaceDe($: EngineInterface, ruta: string): Promise<string> {
  const absoluta = /^([a-zA-Z]:)?[\\/]/.test(ruta) ? ruta : `${await $.session.cwd()}/${ruta}`
  const conBarras = absoluta.replace(/\\/g, '/')
  return `file://${conBarras.startsWith('/') ? '' : '/'}${encodeURI(conBarras).replace(/[()]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`
}

// Lleva la imagen original a una pestaña de VS Code: `code` en macOS, cmd.exe en Windows (allí `code` es un .cmd) y, si no, `open`.
export async function abrir($: EngineInterface, ruta: string) {
  const ordenes = [['code', ruta], ['cmd.exe', '/d', '/c', 'code', ruta], ['/usr/bin/open', '-a', 'Visual Studio Code', ruta]]
  for (const orden of ordenes) {
    const hecha = await $.process.run(orden).catch(() => null)
    if (hecha?.exitCode === 0) {
      return
    }
  }
  $.ui.toast(`No se pudo abrir ${ruta} en VS Code`)
}
