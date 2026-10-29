import { appendFileSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import type { Form, Scheme, Theme } from '../../plugins/apocalypse-mascots/types'

// ---------------------------------------------------------------------------
// Where the pane and the hooks meet: one folder in the home directory. A hook
// appends one line per event to its session's log; the pane follows the log
// written most recently. Nothing else is shared, and nothing leaves the machine.
// ---------------------------------------------------------------------------

export const HOME = process.env.APOCALYPSE_MASCOTS_HOME ?? join(homedir(), '.apocalypse-mascots')
const SESSIONS = join(HOME, 'sessions')
const PREFS = join(HOME, 'prefs.json')

export type Prefs = { form: Form; scheme: Scheme; theme: Theme }
const DEFAULTS: Prefs = { form: 'yoggy', scheme: 'cuddly-apocalypse', theme: 'dark' }

export function readPrefs(): Prefs {
  try { return { ...DEFAULTS, ...JSON.parse(readFileSync(PREFS, 'utf8')) } } catch { return { ...DEFAULTS } }
}

export function writePrefs(p: Partial<Prefs>): Prefs {
  const next = { ...readPrefs(), ...p }
  mkdirSync(HOME, { recursive: true })
  const tmp = `${PREFS}.${process.pid}`
  writeFileSync(tmp, JSON.stringify(next) + '\n')
  renameSync(tmp, PREFS)
  return next
}

// start: a session opened · prompt: a turn began · tool: it reached for something · stop: the turn ended
export type Ev = 'start' | 'prompt' | 'tool' | 'stop'
export type Event = { t: number; ev: Ev; agent: string; tool?: string }

const safe = (s: string) => s.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 120) || 'session'
const WEEK = 7 * 24 * 3600 * 1000

export function append(session: string, e: Event): void {
  mkdirSync(SESSIONS, { recursive: true })
  // one short line per write, opened for append: concurrent hooks never interleave
  appendFileSync(join(SESSIONS, `${safe(e.agent)}-${safe(session)}.jsonl`), JSON.stringify(e) + '\n')
  if (e.ev === 'start') sweep()
}

// logs a week old are forgotten
function sweep(): void {
  const now = Date.now()
  for (const f of listSessions()) if (now - f.mtime > WEEK) try { unlinkSync(f.path) } catch {}
}

export function listSessions(): { path: string; mtime: number; size: number }[] {
  try {
    return readdirSync(SESSIONS).filter(f => f.endsWith('.jsonl')).map(f => {
      const path = join(SESSIONS, f)
      const s = statSync(path)
      return { path, mtime: s.mtimeMs, size: s.size }
    })
  } catch { return [] }
}

export function latestSession(): { path: string; mtime: number; size: number } | undefined {
  return listSessions().sort((a, b) => b.mtime - a.mtime)[0]
}
