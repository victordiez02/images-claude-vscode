import type { EngineInterface, Register } from 'claude-code'

const ES_IMAGEN = /\.(png|jpe?g|gif|webp|heic|tiff?|bmp)$/i
const MOSTRAR = 'ShowImage'
const LADOS = [640, 480, 400, 320]
const ANCHO_VISTA = 320
const ALTO_VISTA = 240
const RADIO = 8
// La conversación descarta en silencio el _meta de un resultado de 64 KB o más.
const MAXIMO_BASE64 = 60000

const DESCRIPCION = `Enseña a la persona una imagen del disco, pintada en el chat de VS Code. No te devuelve la imagen: para verla tú, usa Read.
Úsala siempre que la persona te pida enseñarle una imagen. Si no te lo ha pedido:
- Cuando enseñarla sea claramente útil (el resultado visual de lo que acabas de hacer, una captura sobre la que hablas), enséñala directamente.
- Cuando solo crees que puede ayudar, ofrece enseñar las imágenes; si acepta, enséñalas a partir de entonces sin volver a preguntar.
Formatos: png, jpg, gif, webp, heic, tiff y bmp.`

// JPEG reducido en base64 y sus medidas en píxeles.
type Vista = { base64: string; ancho: number; alto: number }
// Lo que la conversación guarda de cada llamada: la imagen que leyó Read o la vista que guardó ShowImage.
type Fuente = { imagen: string } | { vista: Vista }

let lectura: Promise<Map<string, Fuente>> | undefined
const vistas = new Map<string, Promise<Vista | null>>()

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
    const { Box, Svg, Button } = $.ui.resolve(e)
    const imagen = (
      <Box flexDirection="row" justifyContent="center">
        <Box key={`vista-${e.requestId}`} position="relative">
          <Svg source={svg} alt="Imagen" width={Math.round(vista.ancho * escala)} height={Math.round(vista.alto * escala)} />
          <Box position="absolute" top={0} right={0}>
            <Button key={`ampliar-${e.requestId}`} label="⤢" variant="secondary" dimColor onPress={() => abrir($, ruta)} />
          </Box>
        </Box>
      </Box>
    )
    // ShowImage se pinta sin su fila: la imagen es todo lo que la herramienta tiene que enseñar.
    return esRead ? (
      <Box flexDirection="column" gap="sm">
        {await next(e)}
        {imagen}
      </Box>
    ) : (
      imagen
    )
  })
}

// Prepara una vez por llamada la vista a partir de lo que guarda la conversación.
function vistaDe($: EngineInterface, id: string): Promise<Vista | null> {
  if (!vistas.has(id)) {
    vistas.set(id, fuenteDe($, id).then(fuente => (!fuente ? null : 'vista' in fuente ? fuente.vista : reducir($, { base64: fuente.imagen }))))
  }
  return vistas.get(id)!
}

// Busca la llamada en la última lectura de la conversación y la vuelve a leer solo si la llamada es más nueva.
async function fuenteDe($: EngineInterface, id: string): Promise<Fuente | undefined> {
  const usada = (lectura ??= leerConversacion($))
  const fuentes = await usada
  if (fuentes.has(id)) {
    return fuentes.get(id)
  }
  if (lectura === usada) {
    lectura = leerConversacion($)
  }
  return (await lectura).get(id)
}

// La imagen de Read va en el tool_result que se manda al modelo; la vista de ShowImage, en el registro de la llamada.
async function leerConversacion($: EngineInterface): Promise<Map<string, Fuente>> {
  const [registros, api] = await Promise.all([$.session.messages(), $.session.messages({ as: 'api' })])
  const fuentes = new Map<string, Fuente>()
  for (const uso of registros.flatMap(m => m.toolUses)) {
    const vista = vistaDeMeta(uso.result)
    if (vista) {
      fuentes.set(uso.tool_use_id, { vista })
    }
  }
  for (const bloque of api.flatMap(m => m.content)) {
    const contenido = bloque.type === 'tool_result' && Array.isArray(bloque.content) ? (bloque.content as { type?: string; source?: { type?: string; data?: unknown } }[]) : []
    const imagen = contenido.find(c => c.type === 'image' && c.source?.type === 'base64')?.source?.data
    if (typeof imagen === 'string' && typeof bloque.tool_use_id === 'string') {
      fuentes.set(bloque.tool_use_id, { imagen })
    }
  }
  return fuentes
}

function vistaDeMeta(resultado: unknown): Vista | null {
  const bloques = Array.isArray(resultado) ? (resultado as { _meta?: { vista?: Partial<Vista> } }[]) : []
  const vista = bloques.find(b => b._meta?.vista)?._meta?.vista
  return typeof vista?.base64 === 'string' && Number(vista.ancho) > 0 && Number(vista.alto) > 0
    ? { base64: vista.base64, ancho: Number(vista.ancho), alto: Number(vista.alto) }
    : null
}

function campo(entrada: unknown, nombre: string): string {
  const valor = (entrada as Record<string, unknown> | undefined)?.[nombre]
  return typeof valor === 'string' ? valor : ''
}

// Lleva la imagen original a una pestaña de VS Code.
async function abrir($: EngineInterface, ruta: string) {
  const conCode = await $.process.run(['code', ruta]).catch(() => null)
  if (conCode?.exitCode === 0) {
    return
  }
  const conOpen = await $.process.run(['/usr/bin/open', '-a', 'Visual Studio Code', ruta]).catch(() => null)
  if (conOpen?.exitCode !== 0) {
    $.ui.toast(`No se pudo abrir ${ruta} en VS Code`)
  }
}

// Convierte la imagen a JPEG con sips, del lado más grande que quepa en MAXIMO_BASE64, en una carpeta temporal que se borra al acabar.
async function reducir($: EngineInterface, origen: { ruta: string } | { base64: string }): Promise<Vista | null> {
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
