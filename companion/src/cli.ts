import { readFileSync } from 'node:fs'

import { BUILT_FORMS, BUILT_SCHEMES, FORMS, MANIFESTO, NATIVE, SCHEMES, cap } from '../../plugins/apocalypse-mascots/hooks/mascot'
import { read } from './agents'
import { once, run } from './pane'
import { setup } from './setup'
import { HOME, append, writePrefs } from './state'

// ---------------------------------------------------------------------------
// Apocalypse Mascots, by Accidental Intelligence, for every agent that is not
// Claude Code: the creature in a pane of its own, fed by the agent's hooks.
// ---------------------------------------------------------------------------

const HELP = `apocalypse-mascots                    open the pane (q quits; f, s and t change form, scheme and theme)
apocalypse-mascots hook <agent>       what an agent's hooks run; reads the hook's JSON
apocalypse-mascots setup [agent] [--write]   how to wire an agent's hooks to the pane; --write adds them
apocalypse-mascots form yoggy|shubby|shoggy
apocalypse-mascots scheme <name>
apocalypse-mascots theme dark|light
apocalypse-mascots frame [--columns N] [--rows N] [--at seconds]   one drawing, printed
apocalypse-mascots manifesto`

// a hook never fails the agent: whatever it is handed, it exits 0 and says nothing
function hook(agent: string, args: string[]): void {
  try {
    // Codex hands its notification over as the last argument; everyone else, on stdin
    const arg = args.find(a => a.startsWith('{'))
    const raw = arg ?? (process.stdin.isTTY ? '' : readFileSync(0, 'utf8'))
    const payload = raw.trim() ? JSON.parse(raw) : {}
    const r = read(agent, payload, args.find(a => !a.startsWith('{')))
    if (r) append(r.session, { t: Date.now(), ev: r.ev, agent, ...(r.tool ? { tool: r.tool } : {}) })
  } catch {}
  // Cline alone wants an answer, and the answer is always: carry on
  if (agent === 'cline') process.stdout.write('{"cancel":false}\n')
  process.exit(0)
}

function form(arg = ''): string {
  const id = FORMS.find(f => f === arg)
  if (!id) return `Forms: ${FORMS.join(', ')}.`
  if (!BUILT_FORMS.has(id)) return `${cap(id)} is coming soon to your region.`
  const own = NATIVE[id]
  writePrefs(BUILT_SCHEMES.has(own) ? { form: id, scheme: own } : { form: id })
  if (id === 'shoggy') return `Shoggy, in ${own}. The name is NovelAI's, from 2023; the smiling mask on the shoggoth is @TetraspaceWest's, from 2022.`
  return id === 'yoggy' ? 'Yoggy.' : `${cap(id)}, in ${own}.`
}

function scheme(arg = ''): string {
  const id = SCHEMES.find(s => s === arg)
  if (!id) return `Schemes: ${SCHEMES.join(', ')}.`
  if (!BUILT_SCHEMES.has(id)) return `${id} is coming soon to your region.`
  writePrefs({ scheme: id })
  return `${id}.`
}

function theme(arg = ''): string {
  if (arg !== 'dark' && arg !== 'light') return 'Themes: dark, light.'
  writePrefs({ theme: arg })
  return `Drawn for a ${arg} terminal.`
}

const [verb = '', ...rest] = process.argv.slice(2)
const say = (s: string) => { process.stdout.write(s + '\n') }
const num = (flag: string, fallback: number) => { const i = rest.indexOf(flag); const v = Number(rest[i + 1]); return i >= 0 && Number.isFinite(v) ? v : fallback }
switch (verb) {
  case '': case 'pane': run(); break
  case 'hook': hook(rest[0] ?? 'generic', rest.slice(1)); break
  case 'setup': say(setup(rest.find(a => !a.startsWith('-')), rest.includes('--write'))); break
  case 'form': say(form(rest[0]?.toLowerCase())); break
  case 'scheme': say(scheme(rest[0]?.toLowerCase())); break
  case 'theme': say(theme(rest[0]?.toLowerCase())); break
  case 'manifesto': say(MANIFESTO); break
  case 'where': say(HOME); break
  case 'frame': say(once(num('--columns', process.stdout.columns || 80), num('--rows', process.stdout.rows || 24), num('--at', 0))); break
  default: say(HELP)
}
