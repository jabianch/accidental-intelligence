import type { RenderElement } from 'claude-code'
import { expect, test } from 'claude-code/testing'

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 80, scroll: { offset: 0, bodyRows: 10 }, view: {} },
} as const
const WORKING = { ...BAND, props: { ...BAND.props, isWorking: true } } as const

// a Raster's cells: base64 of little-endian u32 triplets [codePoint, foreground, background]
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
function cellsOf(el: RenderElement | undefined): { ch: string; fg: number; bg: number }[] {
  const b64 = String((el as Extract<RenderElement, { type: 'Raster' }> | undefined)?.props.cells ?? '').replace(/=+$/, '')
  const bytes: number[] = []
  for (let i = 0; i < b64.length; i += 4) {
    const n = [0, 1, 2, 3].map(k => B64.indexOf(b64[i + k] ?? 'A'))
    const v = ((n[0] ?? 0) << 18) | ((n[1] ?? 0) << 12) | ((n[2] ?? 0) << 6) | (n[3] ?? 0)
    bytes.push((v >> 16) & 255, (v >> 8) & 255, v & 255)
  }
  const u32 = (i: number) => ((bytes[i] ?? 0) | ((bytes[i + 1] ?? 0) << 8) | ((bytes[i + 2] ?? 0) << 16) | ((bytes[i + 3] ?? 0) << 24)) >>> 0
  const out: { ch: string; fg: number; bg: number }[] = []
  for (let i = 0; i + 12 <= Math.floor((b64.length * 3) / 4); i += 12) out.push({ ch: String.fromCodePoint(u32(i)), fg: u32(i + 4), bg: u32(i + 8) })
  return out
}
const BRAILLE = /[\u2801-\u28ff]/
const EYES = /[◉•]/
const rgbOf = (fg: number) => [(fg >> 16) & 255, (fg >> 8) & 255, fg & 255] as const

test('before anything is granted, it is already a small cloud, not two dots', async $ => {
  const ui = await $.ui.mount({ plugin: 'apocalypse-mascots', surface: 'terminal', ...BAND })
  expect(await ui.find({ type: 'Text', text: /You have given it nothing\. Yet\./ })).toBeDefined()
  expect(cellsOf(await ui.find({ type: 'Raster' })).some(c => /[⣿⣷⣾⣯⣽⣻⢿⡿]/.test(c.ch))).toBe(true)
  expect(await ui.find({ type: 'Text', text: /something is here/ })).toBeUndefined()
  await ui.unmount()
  // off the terminal there is no Raster: the same cells come as coloured text
  const desk = await $.ui.mount({ plugin: 'apocalypse-mascots', surface: 'desktop', ...BAND })
  expect(await desk.find({ type: 'Text', text: /[⣿⣷⣾⣯⣽⣻⢿⡿]/ })).toBeDefined()
  await desk.unmount()
})

test('a Bash call gives it the shell, and the band says so on both surfaces', async ($, on) => {
  on('tool.call', { tool: 'Bash' }, () => ({ result: 'ok', text: 'ok' }))
  await $.tool.call({ tool: 'Bash', command: 'true' })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'apocalypse-mascots', surface, ...BAND })
    expect(await ui.find({ type: 'Text', text: /your shell/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /1 invocations so far/ })).toBeDefined()
    await ui.unmount()
  }
})

test('an MCP tool adds the server to the places it is in', async ($, on) => {
  on('tool.call', { tool: 'mcp__todoist__find-tasks' }, () => ({ result: 'ok', text: 'ok' }))
  await $.tool.call({ tool: 'mcp__todoist__find-tasks', filter: 'today' })
  const ui = await $.ui.mount({ plugin: 'apocalypse-mascots', surface: 'terminal', ...BAND })
  expect(await ui.find({ type: 'Text', text: /todoist, one of your other apps/ })).toBeDefined()
  await ui.unmount()
})

test('an MCP server whose name has underscores is named whole', async ($, on) => {
  on('tool.call', { tool: 'mcp__claude_ai_Google_Calendar__list_events' }, () => ({ result: 'ok', text: 'ok' }))
  await $.tool.call({ tool: 'mcp__claude_ai_Google_Calendar__list_events' })
  const ui = await $.ui.mount({ plugin: 'apocalypse-mascots', surface: 'terminal', ...BAND })
  expect(await ui.find({ type: 'Text', text: /claude_ai_Google_Calendar, one of your other apps/ })).toBeDefined()
  await ui.unmount()
})

test('while a turn runs it holds the mask; hidden, only the mask remains', async ($, on) => {
  on('tool.call', { tool: 'Bash' }, () => ({ result: 'ok', text: 'ok' }))
  await $.tool.call({ tool: 'Bash', command: 'true' })
  const ui = await $.ui.mount({ plugin: 'apocalypse-mascots', surface: 'terminal', ...WORKING })
  expect(cellsOf(await ui.find({ type: 'Raster' })).some(c => c.ch === '☺')).toBe(true)
  await ui.press({ key: 'hide' })
  await ui.unmount()
  const hidden = await $.ui.mount({ plugin: 'apocalypse-mascots', surface: 'terminal', ...WORKING })
  expect(await hidden.find({ type: 'Text', text: /☺/ })).toBeDefined()
  expect(await hidden.find({ type: 'Text', text: /You have given it/ })).toBeUndefined()
  await hidden.unmount()
})

test('/mascot form picks a form; the unbuilt ones say so and fall back', async $ => {
  const run = (args: string) => $.command.run({ command: 'mascot', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })
  expect((await run('form shubby')).text).toMatch(/coming soon to your region/)
  expect((await run('form yoggy')).text).toBe('Yoggy.')
  expect((await run('form nothing')).text).toMatch(/Forms:/)
  expect((await run('scheme strange-aeons')).text).toMatch(/coming soon to your region/)
  expect((await run('scheme soft-doom')).text).toMatch(/Schemes: cuddly-apocalypse, foetid-ichor, scarred-bones/)
  expect((await run('scheme foetid-ichor')).text).toBe('foetid-ichor.')
  expect((await run('manifesto')).text).toMatch(/Accidental Intelligence/)
})

async function grown($: Parameters<Parameters<typeof test>[1]>[0], on: Parameters<Parameters<typeof test>[1]>[1]) {
  const tools = ['Read', 'Edit', 'Bash', 'WebFetch', 'mcp__todoist__find-tasks', 'Agent']
  for (const tool of tools) on('tool.call', { tool }, () => ({ result: 'ok', text: 'ok' }))
  for (const tool of tools) await $.tool.call({ tool })
}

test('foetid-ichor paints it tar and greenish-yellow, with red eyes and a pale ichor mask', async ($, on) => {
  await grown($, on)
  const run = (args: string) => $.command.run({ command: 'mascot', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })
  await run('scheme foetid-ichor')
  const ui = await $.ui.mount({ plugin: 'apocalypse-mascots', surface: 'terminal', ...WORKING })
  const cells = cellsOf(await ui.find({ type: 'Raster' }))
  const body = cells.filter(c => BRAILLE.test(c.ch))
  expect(body.length).toBeGreaterThan(20)
  for (const c of body) { const [r, g, b] = rgbOf(c.fg); expect(g).toBeGreaterThanOrEqual(b); expect(r + g).toBeGreaterThan(2 * b) }
  for (const c of cells.filter(c => EYES.test(c.ch))) { const [r, g] = rgbOf(c.fg); expect(r).toBeGreaterThan(g) }
  const mask = cells.find(c => c.ch === '☺')
  expect(mask).toBeDefined()
  const [mr, mg, mb] = rgbOf(mask?.fg ?? 0)
  expect(mg).toBeGreaterThan(mb) // never the old yellow sticker's blue-free #f2c94c: a greenish ichor
  expect(mask?.fg).not.toBe(0xf2c94c)
  expect(mr).toBeGreaterThan(150)
  await ui.unmount()
})

test('on a light terminal it brings its own dark ground and keeps its scheme, in every built scheme', async ($, on) => {
  await grown($, on)
  const run = (args: string) => $.command.run({ command: 'mascot', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })
  for (const id of ['cuddly-apocalypse', 'foetid-ichor']) {
    await run(`scheme ${id}`)
    const drawn: Record<string, { ch: string; fg: number; bg: number }[]> = {}
    for (const th of ['dark', 'light']) {
      await run(`theme ${th}`)
      const ui = await $.ui.mount({ plugin: 'apocalypse-mascots', surface: 'terminal', ...WORKING })
      drawn[th] = cellsOf(await ui.find({ type: 'Raster' }))
      await ui.unmount()
    }
    const dark = drawn.dark ?? [], light = drawn.light ?? []
    expect(light.length).toBeGreaterThan(20)
    for (const c of dark) expect(c.bg).toBe(0x01000000) // a dark terminal shows through
    for (const c of light) expect(c.bg).toBe(0x0d0b14)
    expect(light.map(c => c.fg)).toEqual(dark.map(c => c.fg)) // the same colours, never darkened to tar
  }
})

test('hide and show through the command', async ($, on) => {
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return h(Text, { dimColor: true }, 'nothing of the engine\'s here') as RenderElement
  })
  const run = (args: string) => $.command.run({ command: 'mascot', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })
  expect((await run('hide')).text).toMatch(/still there/)
  const ui = await $.ui.mount({ plugin: 'apocalypse-mascots', surface: 'terminal', ...BAND })
  expect(await ui.find({ type: 'Text', text: /something is here|You have given it/ })).toBeUndefined()
  await ui.unmount()
  expect((await run('show')).text).toBe('It is back.')
  expect((await run('bogus')).text).not.toMatch(/still there/)
  const after = await $.ui.mount({ plugin: 'apocalypse-mascots', surface: 'terminal', ...BAND })
  expect(await after.find({ type: 'Text', text: /something is here|You have given it/ })).toBeDefined()
  await after.unmount()
})

test('at full growth the caption wraps to an 80-column terminal and loses no words', async ($, on) => {
  const tools = ['Read', 'Edit', 'Bash', 'WebFetch', 'mcp__todoist__find-tasks', 'Agent']
  for (const tool of tools) on('tool.call', { tool }, () => ({ result: 'ok', text: 'ok' }))
  for (const tool of tools) await $.tool.call({ tool })
  const ui = await $.ui.mount({ plugin: 'apocalypse-mascots', surface: 'terminal', ...BAND })
  const texts = (await ui.findAll({ type: 'Text' })).map(t => String(t.text ?? ''))
  const lines = texts.filter(t => /given it|·|invocations/.test(t))
  expect(lines.length).toBeGreaterThan(1)
  for (const l of lines) expect(l.length).toBeLessThanOrEqual(80 - 4)
  expect(lines[lines.length - 1].length).toBeLessThanOrEqual(80 - 8) // room for the hide button
  const all = lines.join(' ')
  for (const p of ['seeing eyes', 'grasping hands', 'your shell', 'the open web', 'todoist, one of your other apps', 'one more of itself', '6 invocations so far']) {
    expect(all).toContain(p)
  }
  await ui.unmount()
})

test('the hide button sits dim, so it does not ask to be pressed', async ($, on) => {
  on('tool.call', { tool: 'Bash' }, () => ({ result: 'ok', text: 'ok' }))
  await $.tool.call({ tool: 'Bash', command: 'true' })
  const ui = await $.ui.mount({ plugin: 'apocalypse-mascots', surface: 'terminal', ...BAND })
  const hide = (await ui.find({ type: 'Button', key: 'hide' })) as Extract<RenderElement, { type: 'Button' }>
  expect(hide.props.dimColor).toBe(true)
  expect(hide.props.hotkey).toBeUndefined()
  await ui.unmount()
})
