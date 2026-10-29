import { closeSync, openSync, readSync } from 'node:fs'

import { shubbyState } from '../../plugins/apocalypse-mascots/hooks/figures'
import type { ShubbyState } from '../../plugins/apocalypse-mascots/hooks/figures'
import { BUILT_FORMS, BUILT_SCHEMES, EMPTY, FORMS, GROUND, SCHEMES, bodyInk, grant } from '../../plugins/apocalypse-mascots/hooks/mascot'
import type { Ink } from '../../plugins/apocalypse-mascots/hooks/mascot'
import type { Reach } from '../../plugins/apocalypse-mascots/types'
import { classify } from './agents'
import { latestSession, readPrefs, writePrefs } from './state'
import type { Event, Prefs } from './state'

// ---------------------------------------------------------------------------
// The pane: the creature in a terminal of its own, beside whatever agent you
// run. It follows the session whose hooks wrote last.
// ---------------------------------------------------------------------------

// a turn with no word for ten minutes, or a tool with none for one, has ended, whether or not the agent said so
const TURN_SILENCE = 10 * 60 * 1000
const TOOL_SILENCE = 60 * 1000

export type Follow = { path?: string; offset: number; reach: Reach; last?: Event; toast?: { text: string; until: number } }

export function follow(): Follow { return { offset: 0, reach: EMPTY } }

// read whatever the session log has gained since the last look; a newer session replaces the old
export function poll(f: Follow, now = Date.now()): Follow {
  const s = latestSession()
  if (!s) return f
  if (s.path !== f.path) f = { path: s.path, offset: 0, reach: EMPTY }
  if (s.size <= f.offset) return f
  const fd = openSync(s.path, 'r')
  const buf = Buffer.alloc(s.size - f.offset)
  readSync(fd, buf, 0, buf.length, f.offset)
  closeSync(fd)
  const text = buf.toString('utf8')
  const end = text.lastIndexOf('\n') + 1 // a half-written line waits for the next look
  let { reach, last, toast } = f
  for (const line of text.slice(0, end).split('\n')) {
    if (!line) continue
    let e: Event
    try { e = JSON.parse(line) } catch { continue }
    last = e
    if (e.ev === 'start') reach = EMPTY
    if (e.ev !== 'tool' || !e.tool) continue
    const { sense, server } = classify(e.tool)
    const g = grant(reach, sense, server)
    reach = g.after
    if (g.unlocked && now - e.t < 5000) toast = { text: g.unlocked, until: e.t + 5000 }
  }
  return { path: f.path, offset: f.offset + Buffer.byteLength(text.slice(0, end)), reach, last, toast }
}

export function working(f: Follow, now = Date.now()): boolean {
  const e = f.last
  if (!e) return false
  if (e.ev === 'prompt') return now - e.t < TURN_SILENCE
  if (e.ev === 'tool') return now - e.t < TOOL_SILENCE
  return false
}

// ---------------------------------------------------------------------------
// ink to the terminal: truecolor where the terminal says it has it, the 256-colour cube where it does not
// ---------------------------------------------------------------------------

export function truecolor(env = process.env): boolean {
  if (env.APOCALYPSE_MASCOTS_COLOR) return env.APOCALYPSE_MASCOTS_COLOR !== '256'
  if (/truecolor|24bit/i.test(env.COLORTERM ?? '')) return true
  return env.TERM_PROGRAM !== 'Apple_Terminal'
}

const cube = (v: number) => (v < 48 ? 0 : v < 115 ? 1 : Math.floor((v - 35) / 40))
function xterm256(rgb: number): number {
  const r = (rgb >> 16) & 255, g = (rgb >> 8) & 255, b = rgb & 255
  const grey = Math.round((r + g + b) / 3)
  if (Math.max(r, g, b) - Math.min(r, g, b) < 12) return grey < 8 ? 16 : grey > 238 ? 231 : 232 + Math.round((grey - 8) / 10)
  return 16 + 36 * cube(r) + 6 * cube(g) + cube(b)
}
const sgr = (rgb: number, layer: 38 | 48, tc: boolean) =>
  tc ? `${layer};2;${(rgb >> 16) & 255};${(rgb >> 8) & 255};${rgb & 255}` : `${layer};5;${xterm256(rgb)}`

export function ansiRow(row: Ink[], ground: number | undefined, tc: boolean): string {
  let out = ''
  let state = ''
  for (const cell of row) {
    const bg = cell.bg ?? ground
    const codes = ['0', cell.bold ? '1' : '', cell.fg === undefined ? '' : sgr(cell.fg, 38, tc), bg === undefined ? '' : sgr(bg, 48, tc)].filter(Boolean).join(';')
    if (codes !== state) { out += `\x1b[${codes}m`; state = codes }
    out += cell.ch
  }
  return out + '\x1b[0m'
}

const width = (s: string) => [...s].length

// one whole screen, centred: the creature, its caption, and a passing toast
export function screen(o: { ink: Ink[][]; lines: string[]; toast?: string; columns: number; rows: number; light: boolean; tc: boolean }): string {
  const ground = o.light ? GROUND : undefined
  const inkWidth = o.ink[0]?.length ?? 0
  const text = [...o.lines, o.toast ?? '']
  const height = o.ink.length + 1 + text.length
  const top = Math.max(0, Math.floor((o.rows - height) / 2))
  const pad = (w: number) => ' '.repeat(Math.max(0, Math.floor((o.columns - w) / 2)))
  const out: string[] = []
  for (let i = 0; i < top; i++) out.push('')
  for (const row of o.ink) out.push(pad(inkWidth) + ansiRow(row, ground, o.tc))
  out.push('')
  for (const l of o.lines) out.push(`${pad(width(l))}\x1b[2m${l}\x1b[0m`)
  out.push(o.toast ? `${pad(width(o.toast))}${o.toast}` : '')
  return out.slice(0, o.rows).map(l => `${l}\x1b[K`).join('\r\n') + '\x1b[J'
}

// ---------------------------------------------------------------------------
// the loop
// ---------------------------------------------------------------------------

type Clocks = { frame: number; beat: number; shubby: ShubbyState }

function render(f: Follow, prefs: Prefs, c: Clocks, columns: number, rows: number, tc: boolean, now = Date.now()): string {
  const shape = BUILT_FORMS.has(prefs.form) ? prefs.form : 'yoggy'
  const scheme = BUILT_SCHEMES.has(prefs.scheme) ? prefs.scheme : 'cuddly-apocalypse'
  const { ink, lines } = bodyInk({ shape, scheme, tick: c.frame, t: c.beat / 8, reach: f.reach, awake: working(f, now), shubby: c.shubby }, columns, rows)
  const toast = f.toast && now < f.toast.until ? f.toast.text : undefined
  return screen({ ink, lines, toast, columns, rows, light: prefs.theme === 'light', tc })
}

// one drawing of the pane as it stands, for a script, a test or a screenshot
export function once(columns: number, rows: number, seconds: number): string {
  const s = render(poll(follow()), readPrefs(), { frame: Math.round(seconds / 0.3), beat: Math.round(seconds * 8), shubby: shubbyState() }, columns, rows, truecolor())
  return s.replace(/\x1b\[K/g, '').replace(/\x1b\[J$/, '').replace(/\r\n/g, '\n')
}

export function run(): void {
  const out = process.stdout
  const tc = truecolor()
  const shubby = shubbyState()
  let f = follow()
  let prefs = readPrefs()
  let frame = 0, beat = 0, ticks = 0, idleBeat = 0
  let last = ''

  const draw = () => {
    const columns = out.columns || 80, rows = out.rows || 24
    const s = render(f, prefs, { frame, beat, shubby }, columns, rows, tc)
    if (s !== last) { out.write('\x1b[H' + s); last = s }
  }

  // the same two paces as in the band: Yoggy stirs every 300 ms while it works and every
  // 1.8 s between turns; a figure keeps real time, an eighth of a second at a time
  const yoggyClock = setInterval(() => {
    if (working(f)) frame++
    else if (++idleBeat % 6 === 0) frame++
  }, 300)
  const clock = setInterval(() => {
    ticks++
    if (ticks % 4 === 0) { f = poll(f); prefs = readPrefs() }
    if (working(f)) beat++
    else if (ticks % 4 === 0) beat += 4
    draw()
  }, 125)

  const quit = () => {
    clearInterval(clock); clearInterval(yoggyClock)
    out.write('\x1b[0m\x1b[?25h\x1b[?1049l')
    if (process.stdin.isTTY) process.stdin.setRawMode(false)
    process.exit(0)
  }

  out.write('\x1b[?1049h\x1b[?25l\x1b[2J')
  f = poll(f)
  // a session already running when the pane opens: start from where it is, not from its first line's toast
  f.toast = undefined
  out.on('resize', () => { last = ''; out.write('\x1b[2J'); draw() })
  process.on('SIGINT', quit)
  process.on('SIGTERM', quit)
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true)
    process.stdin.on('data', (d: Buffer) => {
      const k = d.toString()
      if (k === 'q' || k === '\x03') quit()
      // f, s and t walk the forms, the schemes and the theme that are out
      if (k === 'f') prefs = writePrefs({ form: next(FORMS.filter(x => BUILT_FORMS.has(x)), prefs.form) })
      if (k === 's') prefs = writePrefs({ scheme: next(SCHEMES.filter(x => BUILT_SCHEMES.has(x)), prefs.scheme) })
      if (k === 't') prefs = writePrefs({ theme: prefs.theme === 'dark' ? 'light' : 'dark' })
      draw()
    })
  }
  draw()
}

const next = <T>(list: T[], cur: T): T => list[(list.indexOf(cur) + 1) % list.length] ?? cur
