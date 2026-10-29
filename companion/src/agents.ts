import type { Sense } from '../../plugins/apocalypse-mascots/hooks/mascot'
import type { Ev } from './state'

// ---------------------------------------------------------------------------
// Each agent's hooks speak their own dialect. A reading turns one hook payload
// into a session, an event and, for a tool call, the tool's name, with MCP
// tools rewritten to the one spelling the rest of the code knows:
// mcp__<server>__<tool>. Formats checked against each agent's docs, 2026-10-29.
// ---------------------------------------------------------------------------

export type Reading = { session: string; ev: Ev; tool?: string }
type Payload = Record<string, unknown>

const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined)
const obj = (v: unknown): Payload => (v && typeof v === 'object' ? (v as Payload) : {})
const pick = (p: Payload, ...keys: string[]) => { for (const k of keys) { const v = str(p[k]); if (v) return v } }

// every agent's spelling of the events, folded to lower case, to ours. Tool calls are
// read after they run, never before: a hook on the way in can stop the tool
const EVENTS: Record<string, Ev> = {
  sessionstart: 'start', 'session.created': 'start', taskstart: 'start',
  userpromptsubmit: 'prompt', beforesubmitprompt: 'prompt', beforeagent: 'prompt', 'chat.message': 'prompt', pre_user_prompt: 'prompt',
  posttooluse: 'tool', posttoolusefailure: 'tool', aftertool: 'tool', 'tool.execute.after': 'tool',
  post_read_code: 'tool', post_write_code: 'tool', post_run_command: 'tool', post_mcp_tool_use: 'tool',
  stop: 'stop', afteragent: 'stop', 'agent-turn-complete': 'stop', 'session.idle': 'stop', post_cascade_response: 'stop',
  sessionend: 'stop', taskcomplete: 'stop', taskcancel: 'stop',
}

// Windsurf names the tool by the event
const BY_EVENT: Record<string, string> = { post_read_code: 'read', post_write_code: 'edit', post_run_command: 'shell' }

export function read(agent: string, p: Payload, fallback?: string): Reading | undefined {
  const name = (pick(p, 'hook_event_name', 'agent_action_name', 'hookName', 'type') ?? fallback ?? '').toLowerCase()
  const ev = EVENTS[name]
  if (!ev) return undefined
  const session = pick(p, 'session_id', 'conversation_id', 'trajectory_id', 'taskId', 'thread-id') ?? 'default'
  if (ev !== 'tool') return { session, ev }
  const tool = toolOf(agent, name, p)
  return tool ? { session, ev, tool } : undefined
}

function toolOf(agent: string, event: string, p: Payload): string | undefined {
  if (BY_EVENT[event]) return BY_EVENT[event]
  if (event === 'post_mcp_tool_use') {
    const info = obj(p.tool_info)
    return `mcp__${str(info.mcp_server_name) ?? 'mcp'}__${str(info.mcp_tool_name) ?? 'tool'}`
  }
  const cline = obj(p.postToolUse)
  const tool = pick(p, 'tool_name') ?? str(cline.toolName)
  if (!tool) return undefined
  if (tool.startsWith('mcp__')) return tool
  switch (agent) {
    case 'gemini': {
      // mcp_<server>_<tool>; the server's own name, where the payload carries it, outranks the split
      if (!tool.startsWith('mcp_')) return tool
      const server = str(obj(p.mcp_context).server_name) ?? tool.slice(4).split('_')[0]
      return `mcp__${server}__${tool}`
    }
    case 'kiro': return /^mcp_([^_]+)_/.test(tool) ? `mcp__${tool.split('_')[1]}__${tool}` : tool
    // Cursor drops the server: MCP:<tool>
    case 'cursor': return tool.startsWith('MCP:') ? `mcp__mcp__${tool.slice(4)}` : tool
    // OpenCode's MCP tools are <server>_<tool>; its own carry no underscore but apply_patch
    case 'opencode': return tool.includes('_') && tool !== 'apply_patch' ? `mcp__${tool.split('_')[0]}__${tool}` : tool
    case 'cline': return tool === 'use_mcp_tool' ? `mcp__${str(obj(cline.parameters).server_name) ?? 'mcp'}__${tool}` : tool
    default: return tool
  }
}

// ---------------------------------------------------------------------------
// the tools, sorted into senses. Names are compared folded: lower case, letters only.
// ---------------------------------------------------------------------------

const SENSES: Record<Exclude<Sense, 'none' | 'elsewhere'>, string[]> = {
  eyes: ['read', 'readfile', 'readmanyfiles', 'view', 'glob', 'grep', 'rg', 'grepsearch', 'searchfilecontent', 'ls', 'list', 'listdirectory', 'listfiles',
    'searchfiles', 'listcodedefinitionnames', 'notebookread', 'lsp'],
  hands: ['edit', 'write', 'multiedit', 'notebookedit', 'writefile', 'replace', 'applypatch', 'create', 'strreplaceeditor', 'strreplace', 'delete',
    'writetofile', 'replaceinfile', 'fswrite', 'fsappend', 'deletefile', 'editfile', 'createfile'],
  shell: ['bash', 'shell', 'powershell', 'runshellcommand', 'execute', 'executecommand', 'executebash', 'executepwsh'],
  web: ['webfetch', 'websearch', 'googlewebsearch', 'fetchurl'],
  selves: ['task', 'agent', 'spawnagent', 'newtask', 'usesubagents', 'codebaseinvestigator', 'generalist', 'clihelp', 'browseragent'],
}
const FOLD = new Map<string, Sense>(Object.entries(SENSES).flatMap(([sense, names]) => names.map(n => [n, sense as Sense])))

export function classify(tool: string): { sense: Sense; server?: string } {
  const m = /^mcp__(.+?)__/.exec(tool)
  if (m) return { sense: 'elsewhere', server: m[1] }
  return { sense: FOLD.get(tool.toLowerCase().replace(/[^a-z]/g, '')) ?? 'none' }
}
