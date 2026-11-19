import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'

const MOD = 'images-claude-vscode'
const SHOW_IMAGE = 'mcp__images-claude-vscode__ShowImage'
const JPEG = '/9j/4AAQSkZJRg'

// Simula el sistema operativo y sus herramientas (mktemp, base64 y sips en macOS; PowerShell en Windows), que en el test no existen.
function simularSistema(on: On, plataforma: 'macos' | 'windows' = 'macos') {
  const ordenes: { argv: readonly string[]; stdin?: string }[] = []
  on('session.info', () => ({ value: { platform: plataforma } }) as never)
  on('process.run', (_, e) => {
    ordenes.push({ argv: e.argv, stdin: e.init?.stdin })
    const stdout = e.argv[0] === 'powershell.exe' ? `480 360 ${JPEG}` : e.argv[0] === '/usr/bin/mktemp' ? '/tmp/prueba' : 'pixelWidth: 640\npixelHeight: 480'
    return { value: { exitCode: 0, stdout, stderr: '' } } as never
  })
  on('fs.read', (_, e) => ({ value: e.as === 'bytes' ? { base64: JPEG } : '# reducir.ps1' }) as never)
  return ordenes
}

// Una conversación con un Read de imagen (en el tool_result) y una ShowImage (en el _meta de su registro).
function simularConversacion(on: On) {
  on('session.messages', (_, e) => {
    const api = [
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'leer', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0KGgo' } }] }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'leer-windows', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0KGgo' } }] }] },
    ]
    const registros = [
      {
        role: 'assistant',
        text: '',
        toolUses: [
          { tool_use_id: 'leer', tool: 'Read', input: { file_path: '/fotos/captura.png' }, result: { type: 'image', file: { base64: '' } } },
          {
            tool_use_id: 'mostrar',
            tool: SHOW_IMAGE,
            input: { path: '/fotos/grafico.png' },
            result: [{ type: 'text', text: 'Imagen enseñada', _meta: { vista: { base64: JPEG, ancho: 480, alto: 360 } } }],
          },
          {
            tool_use_id: 'mostrar-windows',
            tool: SHOW_IMAGE,
            input: { path: 'C:\\fotos\\gráfico (1).png' },
            result: [{ type: 'text', text: 'Imagen enseñada', _meta: { vista: { base64: JPEG, ancho: 480, alto: 360 } } }],
          },
        ],
      },
    ]
    return { value: (e as { as?: string }).as === 'api' ? api : registros } as never
  })
}

function fila(tool: string, input: Record<string, unknown>) {
  return { tool_use_id: 'x', tool, input, isRunning: false, isErrored: false, isInterrupted: false }
}

test('Read de una imagen pinta su fila y la imagen guardada en la conversación', async ($, on) => {
  simularSistema(on)
  simularConversacion(on)
  const ui = await $.ui.mount({ plugin: MOD, surface: 'vscode', component: 'ToolUse', requestId: 'leer', props: fila('Read', { file_path: '/fotos/captura.png' }) })
  const svg = await ui.find({ type: 'Svg' })
  expect(svg).toBeDefined()
  expect(JSON.stringify(svg)).toContain(JPEG)
  await ui.unmount()
})

test('ShowImage pinta su cabecera con enlace y la vista de su _meta', async ($, on) => {
  simularConversacion(on)
  const ui = await $.ui.mount({ plugin: MOD, surface: 'vscode', component: 'ToolUse', requestId: 'mostrar', props: fila(SHOW_IMAGE, { path: '/fotos/grafico.png' }) })
  expect(JSON.stringify(await ui.find({ type: 'Markdown' }))).toContain('[grafico.png](file:///fotos/grafico.png)')
  expect(JSON.stringify(await ui.find({ type: 'Svg' }))).toContain(JPEG)
  await ui.unmount()
})

test('Read de un archivo que no es imagen deja la fila como está', async ($, on) => {
  simularConversacion(on)
  const ui = await $.ui.mount({ plugin: MOD, surface: 'vscode', component: 'ToolUse', requestId: 'leer', props: fila('Read', { file_path: '/codigo/app.ts' }) })
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  await ui.unmount()
})

test('Una llamada que la conversación no guarda deja la fila como está', async ($, on) => {
  simularConversacion(on)
  const ui = await $.ui.mount({ plugin: MOD, surface: 'vscode', component: 'ToolUse', requestId: 'otra', props: fila(SHOW_IMAGE, { path: '/fotos/otra.png' }) })
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  await ui.unmount()
})

test('Fuera de VS Code no pinta nada', async ($, on) => {
  simularConversacion(on)
  const ui = await $.ui.mount({ plugin: MOD, surface: 'desktop', component: 'ToolUse', requestId: 'mostrar', props: fila(SHOW_IMAGE, { path: '/fotos/grafico.png' }) })
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  await ui.unmount()
})

test('En Windows, Read reduce la imagen de la conversación con PowerShell', async ($, on) => {
  const ordenes = simularSistema(on, 'windows')
  simularConversacion(on)
  const ui = await $.ui.mount({ plugin: MOD, surface: 'vscode', component: 'ToolUse', requestId: 'leer-windows', props: fila('Read', { file_path: 'C:\\fotos\\captura.png' }) })
  expect(JSON.stringify(await ui.find({ type: 'Svg' }))).toContain(JPEG)
  expect(ordenes.map(o => o.argv[0])).toEqual(['powershell.exe'])
  expect(ordenes[0]?.stdin).toBe('iVBORw0KGgo')
  const argv = ordenes[0]?.argv ?? []
  const script = String.fromCharCode(...Array.from(atob(argv[argv.indexOf('-EncodedCommand') + 1] ?? ''), c => c.charCodeAt(0)).filter((_, i) => i % 2 === 0))
  expect(script).toBe("$ruta = ''\n$lados = 640, 480, 400, 320\n$maximo = 60000\n# reducir.ps1")
  await ui.unmount()
})

test('En Windows, ShowImage enlaza la ruta como file:///C:/…', async ($, on) => {
  simularSistema(on, 'windows')
  simularConversacion(on)
  const ui = await $.ui.mount({ plugin: MOD, surface: 'vscode', component: 'ToolUse', requestId: 'mostrar-windows', props: fila(SHOW_IMAGE, { path: 'C:\\fotos\\gráfico (1).png' }) })
  expect(JSON.stringify(await ui.find({ type: 'Markdown' }))).toContain('[gráfico \\\\(1\\\\).png](file:///C:/fotos/gr%C3%A1fico%20%281%29.png)')
  await ui.unmount()
})
