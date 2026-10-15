import type { RenderElement } from 'claude-code'
import { expect, test } from 'claude-code/testing'

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 80, scroll: { offset: 0, bodyRows: 10 }, view: {} },
} as const
const WORKING = { ...BAND, props: { ...BAND.props, isWorking: true } } as const

test('before anything is granted, it is already a small cloud, not two dots', async $ => {
  const ui = await $.ui.mount({ plugin: 'apocalypse-mascots', surface: 'terminal', ...BAND })
  expect(await ui.find({ type: 'Text', text: /You have given it nothing\. Yet\./ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /[⣿⣷⣾⣯⣽⣻⢿⡿]/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /something is here/ })).toBeUndefined()
  await ui.unmount()
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
  expect(await ui.find({ type: 'Text', text: /☺/ })).toBeDefined()
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
  expect((await run('scheme soft-doom')).text).toMatch(/coming soon to your region/)
  expect((await run('manifesto')).text).toMatch(/Accidental Intelligence/)
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
