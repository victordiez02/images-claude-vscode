import type { EngineInterface } from 'claude-code'
import { reducir, type Vista } from './imagen'

// Lo que la conversación guarda de cada llamada: la imagen que leyó Read o la vista que guardó ShowImage.
type Fuente = { imagen: string } | { vista: Vista }

let lectura: Promise<Map<string, Fuente>> | undefined
const vistas = new Map<string, Promise<Vista | null>>()

// Prepara una vez por llamada la vista a partir de lo que guarda la conversación.
export function vistaDe($: EngineInterface, id: string): Promise<Vista | null> {
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
