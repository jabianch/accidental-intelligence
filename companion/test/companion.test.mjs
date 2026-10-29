import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const BIN = new URL('../dist/apocalypse-mascots.mjs', import.meta.url).pathname

function home() {
  const dir = mkdtempSync(join(tmpdir(), 'mascots-'))
  const cli = (args, input, env = {}) => spawnSync(process.execPath, [BIN, ...args], {
    input, encoding: 'utf8', env: { ...process.env, APOCALYPSE_MASCOTS_HOME: dir, COLORTERM: 'truecolor', ...env },
  })
  const events = () => readdirSync(join(dir, 'sessions')).flatMap(f => readFileSync(join(dir, 'sessions', f), 'utf8').trim().split('\n').map(l => JSON.parse(l)))
  return { dir, cli, events, done: () => rmSync(dir, { recursive: true, force: true }) }
}
const plain = s => s.replace(/\x1b\[[0-9;]*m/g, '')
const hook = (h, agent, payload) => h.cli(['hook', agent], JSON.stringify(payload))

test('a hook says nothing and exits 0, whatever it is handed', () => {
  const h = home()
  for (const input of ['', 'not json', '{"hook_event_name":"SomethingNew"}', '[1,2]']) {
    const r = h.cli(['hook', 'gemini'], input)
    assert.equal(r.status, 0)
    assert.equal(r.stdout, '')
    assert.equal(r.stderr, '')
  }
  h.done()
})

test('the senses grow from another agent\'s tool calls, in the band\'s own words', () => {
  const h = home()
  hook(h, 'gemini', { hook_event_name: 'SessionStart', session_id: 'g1' })
  for (const tool_name of ['read_file', 'write_file', 'run_shell_command', 'google_web_search', 'mcp_todoist_find-tasks'])
    hook(h, 'gemini', { hook_event_name: 'AfterTool', session_id: 'g1', tool_name })
  // a tool on its way in is never read: that hook could stop it
  hook(h, 'gemini', { hook_event_name: 'BeforeTool', session_id: 'g1', tool_name: 'codebase_investigator' })
  const out = plain(h.cli(['frame', '--columns', '120', '--rows', '20']).stdout)
  assert.match(out, /seeing eyes · grasping hands · your shell · the open web/)
  assert.match(out, /todoist, one of your other apps/)
  assert.match(out, /\(5 invocations so far\)/)
  h.done()
})

test('a new session starts from nothing, and the pane follows the newest', () => {
  const h = home()
  hook(h, 'codex', { hook_event_name: 'SessionStart', session_id: 'a' })
  hook(h, 'codex', { hook_event_name: 'PostToolUse', session_id: 'a', tool_name: 'Bash' })
  assert.match(plain(h.cli(['frame', '--columns', '100']).stdout), /your shell/)
  hook(h, 'codex', { hook_event_name: 'SessionStart', session_id: 'b' })
  assert.match(plain(h.cli(['frame', '--columns', '100']).stdout), /You have given it nothing\. Yet\./)
  h.done()
})

test('a form opens in its own scheme; what is not out says so', () => {
  const h = home()
  assert.equal(h.cli(['form', 'shubby']).stdout.trim(), 'Shubby, in foetid-ichor.')
  assert.equal(h.cli(['scheme', 'imitated-accents']).stdout.trim(), 'imitated-accents is coming soon to your region.')
  assert.equal(JSON.parse(readFileSync(join(h.dir, 'prefs.json'), 'utf8')).scheme, 'foetid-ichor')
  const out = h.cli(['frame', '--columns', '60', '--rows', '16']).stdout
  assert.ok((out.match(/[▀▄]/g) ?? []).length > 40, 'Shubby is drawn in half-blocks')
  h.done()
})

test('on a light terminal the creature brings its own dark ground', () => {
  const h = home()
  h.cli(['form', 'shubby'])
  h.cli(['theme', 'light'])
  assert.match(h.cli(['frame', '--columns', '60']).stdout, /48;2;13;11;20/)
  h.done()
})

test('a terminal without truecolor gets the 256-colour cube', () => {
  const h = home()
  const out = h.cli(['frame', '--columns', '60'], '', { COLORTERM: '', TERM_PROGRAM: 'Apple_Terminal' }).stdout
  assert.match(out, /38;5;\d+/)
  assert.doesNotMatch(out, /38;2;/)
  h.done()
})

// one payload from each agent, in the shape its docs give, to what the pane should make of it
const DIALECTS = [
  ['codex', { hook_event_name: 'PostToolUse', session_id: 'thr_1', tool_name: 'apply_patch' }, 'grasping hands'],
  ['codex', { hook_event_name: 'PostToolUse', session_id: 'thr_1', tool_name: 'spawn_agent' }, 'one more of itself'],
  ['cursor', { hook_event_name: 'postToolUse', conversation_id: 'c1', tool_name: 'Shell', cursor_version: '2.6' }, 'your shell'],
  ['cursor', { hook_event_name: 'postToolUse', conversation_id: 'c1', tool_name: 'Grep' }, 'seeing eyes'],
  ['copilot', { hook_event_name: 'PostToolUse', session_id: 'p1', tool_name: 'WebFetch' }, 'the open web'],
  ['opencode', { hook_event_name: 'tool.execute.after', session_id: 'o1', tool_name: 'linear_list_issues' }, 'linear, one of your other apps'],
  ['windsurf', { agent_action_name: 'post_run_command', trajectory_id: 'w1' }, 'your shell'],
  ['windsurf', { agent_action_name: 'post_mcp_tool_use', trajectory_id: 'w1', tool_info: { mcp_server_name: 'github', mcp_tool_name: 'search' } }, 'github, one of your other apps'],
  ['qwen', { hook_event_name: 'PostToolUse', session_id: 'q1', tool_name: 'grep_search' }, 'seeing eyes'],
  ['factory', { hook_event_name: 'PostToolUse', session_id: 'f1', tool_name: 'Execute' }, 'your shell'],
  ['kiro', { hook_event_name: 'PostToolUse', session_id: 'k1', tool_name: 'mcp_slack_post' }, 'slack, one of your other apps'],
]
for (const [agent, payload, words] of DIALECTS) {
  test(`${agent}: ${payload.tool_name ?? payload.agent_action_name} is ${words}`, () => {
    const h = home()
    hook(h, agent, payload)
    assert.match(plain(h.cli(['frame', '--columns', '120', '--rows', '20']).stdout), new RegExp(words))
    h.done()
  })
}

test('a turn wakes it and its end puts it back to sleep, in every dialect', () => {
  const h = home()
  const turns = [
    ['codex', { hook_event_name: 'UserPromptSubmit', session_id: 's' }, { hook_event_name: 'Stop', session_id: 's' }],
    ['gemini', { hook_event_name: 'BeforeAgent', session_id: 's' }, { hook_event_name: 'AfterAgent', session_id: 's' }],
    ['cursor', { hook_event_name: 'beforeSubmitPrompt', conversation_id: 's' }, { hook_event_name: 'stop', conversation_id: 's' }],
    ['windsurf', { agent_action_name: 'pre_user_prompt', trajectory_id: 's' }, { agent_action_name: 'post_cascade_response', trajectory_id: 's' }],
    ['opencode', { hook_event_name: 'chat.message', session_id: 's' }, { hook_event_name: 'session.idle', session_id: 's' }],
  ]
  for (const [agent, start, stop] of turns) {
    hook(h, agent, start)
    hook(h, agent, stop)
  }
  const evs = h.events().map(e => e.ev)
  assert.deepEqual(evs, Array(5).fill(['prompt', 'stop']).flat())
  h.done()
})

test('Codex\'s older notify hands its JSON over as an argument', () => {
  const h = home()
  h.cli(['hook', 'codex', JSON.stringify({ type: 'agent-turn-complete', 'thread-id': 't9' })], '')
  assert.deepEqual(h.events().map(e => e.ev), ['stop'])
  h.done()
})

test('Cline is told to carry on, and nothing else is told anything', () => {
  const h = home()
  assert.equal(h.cli(['hook', 'cline'], JSON.stringify({ hookName: 'PostToolUse', taskId: 't', postToolUse: { toolName: 'execute_command' } })).stdout, '{"cancel":false}\n')
  assert.equal(hook(h, 'codex', { hook_event_name: 'Stop', session_id: 's' }).stdout, '')
  h.done()
})

test('setup --write adds the hooks once, keeps what was there, and keeps a copy', () => {
  const h = home()
  const fake = join(h.dir, 'user')
  const env = { HOME: fake, USERPROFILE: fake }
  const file = join(fake, '.gemini', 'settings.json')
  spawnSync('mkdir', ['-p', join(fake, '.gemini')])
  const mine = { theme: 'Dracula', hooks: { AfterTool: [{ matcher: 'write_file', hooks: [{ type: 'command', command: 'prettier' }] }] } }
  writeFileSync(file, JSON.stringify(mine))
  assert.match(h.cli(['setup', 'gemini', '--write'], '', env).stdout, /Added 4 hooks/)
  const doc = JSON.parse(readFileSync(file, 'utf8'))
  assert.equal(doc.theme, 'Dracula')
  assert.equal(doc.hooks.AfterTool.length, 2)
  assert.equal(doc.hooks.AfterTool[0].hooks[0].command, 'prettier')
  assert.equal(doc.hooksConfig.notifications, false)
  assert.deepEqual(JSON.parse(readFileSync(file + '.before-mascots', 'utf8')), mine)
  assert.match(h.cli(['setup', 'gemini', '--write'], '', env).stdout, /already runs the hooks/)
  writeFileSync(file, '{ // a comment\n }')
  assert.match(h.cli(['setup', 'gemini', '--write'], '', env).stdout, /left alone/)
  h.done()
})
