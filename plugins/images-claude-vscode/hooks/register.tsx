import type { Register } from 'claude-code'
import { vistaDe } from './conversacion'
import { abrir, enlaceDe, escaparMarkdown, nombreDe } from './enlace'
import { reducir, sistemaDe } from './imagen'

const ES_IMAGEN = /\.(png|jpe?g|gif|webp|heic|tiff?|bmp)$/i
const MOSTRAR = 'ShowImage'
const ANCHO_VISTA = 320
const ALTO_VISTA = 240
const RADIO = 8

const DESCRIPCION = `Enseña a la persona una imagen del disco, pintada en el chat de VS Code. No te devuelve la imagen: para verla tú, usa Read.
Úsala siempre que la persona te pida enseñarle una imagen. Si no te lo ha pedido:
- Cuando enseñarla sea claramente útil (el resultado visual de lo que acabas de hacer, una captura sobre la que hablas), enséñala directamente.
- Cuando solo crees que puede ayudar, ofrece enseñar las imágenes; si acepta, enséñalas a partir de entonces sin volver a preguntar.
Formatos: png, jpg, gif, webp, heic, tiff y bmp.`

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.tool.register({
      name: MOSTRAR,
      description: DESCRIPCION,
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Ruta de la imagen, absoluta o relativa al directorio de trabajo' } },
        required: ['path'],
      },
      isDeferred: false,
    })
    return next(e)
  })

  // La vista viaja en el _meta del resultado: se guarda en la conversación y el modelo no la lee.
  on('tool.run', { tool: /^mcp__images-claude-vscode__ShowImage$/ }, async ($, e) => {
    const ruta = campo(e, 'path')
    if (!ES_IMAGEN.test(ruta)) {
      return { deny: `${ruta || 'Sin ruta'}: no es una imagen que se pueda enseñar (png, jpg, gif, webp, heic, tiff o bmp).` }
    }
    if (!['macos', 'windows'].includes(await sistemaDe($))) {
      return { deny: 'ShowImage solo funciona en macOS y Windows.' }
    }
    const vista = await reducir($, { ruta })
    return vista
      ? { result: [{ type: 'text', text: `Imagen enseñada en el chat: ${ruta}`, _meta: { vista } }] }
      : { deny: `No se pudo abrir o reducir la imagen ${ruta}.` }
  }).catch(() => ({ deny: 'ShowImage falló al preparar la imagen.' }))

  // Despliega los grupos «Read N files» que contienen imágenes para que cada lectura pinte la suya.
  on('ui.render', { component: 'ToolGroup' }, (_, e, next) => {
    const tieneImagen = e.props.calls.some(c => c.tool === 'Read' && ES_IMAGEN.test(campo(c.input, 'file_path')))
    return e.surface === 'vscode' && tieneImagen && !e.props.isExpanded ? next({ ...e, props: { ...e.props, isExpanded: true } }) : next(e)
  })

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const { tool, input, isRunning, isErrored } = e.props
    const esRead = tool === 'Read'
    const esImagen = esRead ? ES_IMAGEN.test(campo(input, 'file_path')) : tool.endsWith(`__${MOSTRAR}`)
    if (e.surface !== 'vscode' || isRunning || isErrored || !esImagen) {
      return next(e)
    }
    const vista = await vistaDe($, e.requestId)
    if (!vista) {
      return next(e)
    }
    const ruta = campo(input, esRead ? 'file_path' : 'path')
    const escala = Math.min(1, ANCHO_VISTA / vista.ancho, ALTO_VISTA / vista.alto)
    const radio = Math.round(RADIO / escala)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vista.ancho} ${vista.alto}" width="${vista.ancho}" height="${vista.alto}"><clipPath id="r"><rect width="${vista.ancho}" height="${vista.alto}" rx="${radio}"/></clipPath><image width="${vista.ancho}" height="${vista.alto}" clip-path="url(#r)" href="data:image/jpeg;base64,${vista.base64}"/></svg>`
    const { Box, Svg, Markdown } = $.ui.resolve(e)
    const imagen = (
      <Box flexDirection="row" justifyContent="center">
        <Svg source={svg} alt="Imagen" width={Math.round(vista.ancho * escala)} height={Math.round(vista.alto * escala)} />
      </Box>
    )
    // Read conserva su fila; ShowImage cambia la suya por una cabecera como la de Read, con el archivo como enlace.
    const cabecera = esRead ? (
      await next(e)
    ) : (
      <Markdown key={`cabecera-${e.requestId}`} text={`**Show** [${escaparMarkdown(nombreDe(ruta))}](${await enlaceDe($, ruta)})`} onLinkPress={() => abrir($, ruta)} />
    )
    return (
      <Box flexDirection="column" gap="sm">
        {cabecera}
        {imagen}
      </Box>
    )
  })
}

function campo(entrada: unknown, nombre: string): string {
  const valor = (entrada as Record<string, unknown> | undefined)?.[nombre]
  return typeof valor === 'string' ? valor : ''
}
