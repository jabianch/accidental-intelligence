import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

// ---------------------------------------------------------------------------
// Wiring an agent's hooks to the pane. `setup <agent>` prints what to add and
// where; `setup <agent> --write` adds it to the user-level config itself,
// leaving a copy of the file as it was beside it. Every hook it adds watches;
// none can stop the agent. Formats checked against each agent's docs, 2026-10-29.
// ---------------------------------------------------------------------------

const H = homedir()

// the command the hooks run: this very file under this very node, so an editor
// started from the desktop finds it without the shell's PATH; from an npx cache,
// which does not last, the installed command instead
function command(agent: string): string {
  const script = process.argv[1] ?? ''
  if (!script || /[\\/]_npx[\\/]/.test(script)) return `apocalypse-mascots hook ${agent}`
  const q = (s: string) => (/[\s"]/.test(s) ? JSON.stringify(s) : s)
  return `${q(process.execPath)} ${q(script)} hook ${agent}`
}

type Json = Record<string, any>
type Agent = {
  name: string
  file: string
  // the hooks to merge in, keyed by event
  hooks: (cmd: string) => Record<string, Json[]>
  // where the events live in the file
  at?: (doc: Json) => Json
  extra?: (doc: Json) => void
  after?: string
  tested: boolean
}

// Claude Code's shape, which Codex, Gemini, Kiro, Qwen and Factory share
const nested = (events: string[], timeout: number, matcher = '*') => (cmd: string) =>
  Object.fromEntries(events.map(e => [e, [{ ...(/Tool/.test(e) ? { matcher } : {}), hooks: [{ type: 'command', command: cmd, timeout }] }]]))
const hooksKey = (doc: Json) => (doc.hooks ??= {})

const AGENTS: Record<string, Agent> = {
  codex: {
    name: 'Codex CLI', file: join(H, '.codex', 'hooks.json'),
    hooks: nested(['SessionStart', 'UserPromptSubmit', 'PostToolUse', 'Stop'], 5), at: hooksKey,
    after: 'Codex runs a hook only once you trust it: start Codex, open /hooks, and trust the four apocalypse-mascots hooks.',
    tested: false,
  },
  gemini: {
    name: 'Gemini CLI', file: join(H, '.gemini', 'settings.json'),
    hooks: nested(['SessionStart', 'BeforeAgent', 'AfterTool', 'AfterAgent'], 5000), at: hooksKey,
    extra: doc => { (doc.hooksConfig ??= {}).notifications ??= false },
    tested: false,
  },
  cursor: {
    name: 'Cursor (the editor and cursor-agent)', file: join(H, '.cursor', 'hooks.json'),
    hooks: cmd => Object.fromEntries(['sessionStart', 'beforeSubmitPrompt', 'postToolUse', 'stop'].map(e => [e, [{ command: cmd, timeout: 5 }]])),
    at: hooksKey, extra: doc => { doc.version ??= 1 },
    tested: false,
  },
  copilot: {
    // PascalCase events get the snake_case payload, with Claude Code's tool names
    name: 'GitHub Copilot CLI', file: join(process.env.COPILOT_HOME ?? join(H, '.copilot'), 'hooks', 'apocalypse-mascots.json'),
    hooks: cmd => Object.fromEntries(['SessionStart', 'UserPromptSubmit', 'PostToolUse', 'Stop'].map(e => [e, [{ type: 'command', bash: cmd, powershell: cmd, timeoutSec: 5 }]])),
    at: hooksKey, extra: doc => { doc.version ??= 1 },
    tested: false,
  },
  windsurf: {
    name: 'Windsurf (Devin Desktop)', file: join(H, '.codeium', 'windsurf', 'hooks.json'),
    hooks: cmd => Object.fromEntries(['pre_user_prompt', 'post_read_code', 'post_write_code', 'post_run_command', 'post_mcp_tool_use', 'post_cascade_response']
      .map(e => [e, [{ command: cmd, show_output: false }]])),
    at: hooksKey,
    tested: false,
  },
  qwen: {
    name: 'Qwen Code', file: join(H, '.qwen', 'settings.json'),
    hooks: nested(['SessionStart', 'UserPromptSubmit', 'PostToolUse', 'Stop'], 5), at: hooksKey,
    tested: false,
  },
  factory: {
    name: 'Factory Droid', file: join(H, '.factory', 'hooks.json'),
    hooks: nested(['SessionStart', 'UserPromptSubmit', 'PostToolUse', 'Stop'], 5), at: hooksKey,
    tested: false,
  },
}

// OpenCode takes a plugin, not a hook file: a few lines that hand each event to the command
const OPENCODE_FILE = join(process.env.XDG_CONFIG_HOME ?? join(H, '.config'), 'opencode', 'plugins', 'apocalypse-mascots.js')
function opencodePlugin(cmd: string): string {
  return `// Apocalypse Mascots, for OpenCode: each event, handed to the pane. It only watches.
import { spawn } from 'node:child_process'

const COMMAND = ${JSON.stringify(cmd)}
const send = o => {
  try {
    const p = spawn(COMMAND, { shell: true, stdio: ['pipe', 'ignore', 'ignore'] })
    p.on('error', () => {})
    p.stdin.on('error', () => {})
    p.stdin.end(JSON.stringify(o))
  } catch {}
}

export const ApocalypseMascots = async () => ({
  event: async ({ event }) => {
    if (event.type === 'session.created') send({ hook_event_name: event.type, session_id: event.properties?.info?.id })
    if (event.type === 'session.idle') send({ hook_event_name: event.type, session_id: event.properties?.sessionID })
  },
  'chat.message': async input => send({ hook_event_name: 'chat.message', session_id: input?.sessionID }),
  'tool.execute.after': async input => send({ hook_event_name: 'tool.execute.after', session_id: input?.sessionID, tool_name: input?.tool }),
})
`
}

const OTHERS = `Cline: its hooks are executable files named for their event, in ~/Documents/Cline/Hooks/ (tick Enable Hooks in its settings).
  Make TaskStart, UserPromptSubmit, PostToolUse and TaskComplete each a script that runs:  apocalypse-mascots hook cline
Kiro: add .kiro/hooks/apocalypse-mascots.json with one entry per trigger (SessionStart, UserPromptSubmit, PostToolUse, Stop):
  {"version":"v1","hooks":[{"name":"mascot","trigger":"PostToolUse","action":{"type":"command","command":"apocalypse-mascots hook kiro"},"timeout":5}]}
Aider and the rest: no hooks yet that say what the agent is doing. The pane still draws; it just never wakes.`

export function setup(agent?: string, write = false): string {
  const list = `Agents: ${[...Object.keys(AGENTS), 'opencode'].join(', ')}. Then:  apocalypse-mascots setup <agent> [--write]\n\n${OTHERS}`
  if (!agent) return list
  if (agent === 'opencode') {
    const src = opencodePlugin(command('opencode'))
    if (!write) return `OpenCode (untested): save this as ${OPENCODE_FILE}\n\n${src}`
    if (existsSync(OPENCODE_FILE)) return `${OPENCODE_FILE} is already there; left as it is.`
    mkdirSync(dirname(OPENCODE_FILE), { recursive: true })
    writeFileSync(OPENCODE_FILE, src)
    return `Wrote ${OPENCODE_FILE}. Restart OpenCode, then open the pane:  apocalypse-mascots`
  }
  const a = AGENTS[agent]
  if (!a) return list
  const cmd = command(agent)
  const add = a.hooks(cmd)
  const untested = a.tested ? '' : ' (untested)'
  if (!write) {
    const doc: Json = {}
    a.extra?.(doc)
    Object.assign((a.at ?? hooksKey)(doc), add)
    return `${a.name}${untested}: add to ${a.file}\n\n${JSON.stringify(doc, null, 2)}${a.after ? `\n\n${a.after}` : ''}`
  }
  let doc: Json = {}
  let before = ''
  if (existsSync(a.file)) {
    before = readFileSync(a.file, 'utf8')
    try { doc = before.trim() ? JSON.parse(before) : {} } catch {
      return `${a.file} is not plain JSON (comments?), so it was left alone. Add this by hand:\n\n${setup(agent)}`
    }
  }
  const at = (a.at ?? hooksKey)(doc)
  let added = 0
  for (const [event, entries] of Object.entries(add)) {
    const list = (at[event] ??= [])
    if (!Array.isArray(list)) return `${a.file} has a "${event}" that is not a list, so it was left alone.`
    if (JSON.stringify(list).includes('hook ' + agent) && JSON.stringify(list).includes('apocalypse-mascots')) continue
    list.push(...entries)
    added++
  }
  a.extra?.(doc)
  if (!added) return `${a.name} already runs the hooks; ${a.file} left as it is.`
  mkdirSync(dirname(a.file), { recursive: true })
  if (before) copyFileSync(a.file, `${a.file}.before-mascots`)
  writeFileSync(a.file, JSON.stringify(doc, null, 2) + '\n')
  return `Added ${added} hooks to ${a.file}${before ? ` (the file as it was: ${a.file}.before-mascots)` : ''}.` +
    `${a.after ? `\n${a.after}` : ''}\nThen open the pane in a terminal beside it:  apocalypse-mascots`
}
