import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Form, Reach, Theme } from '../types'

// ---------------------------------------------------------------------------
// Apocalypse Mascots, by Accidental Intelligence.
// Code with AI as it really is.
//
// Drop one. Three forms are promised: Yoggy (the iridescent mass), Shubby
// (the anatomy), Shoggy (the chibi). Yoggy is built. The other two fall back
// to Yoggy and say so. Six color schemes are promised. One exists.
// ---------------------------------------------------------------------------


const EMPTY: Reach = { eyes: false, hands: false, shell: false, web: false, elsewhere: [], selves: 0, acts: 0 }

const reach = atom({ plugin: 'apocalypse-mascots', key: 'reach' } as const, EMPTY)
const isHidden = atom({ plugin: 'apocalypse-mascots', key: 'isHidden' } as const, false)
const frame = atom({ plugin: 'apocalypse-mascots', key: 'frame' } as const, 0)
const theme = atom({ plugin: 'apocalypse-mascots', key: 'theme' } as const, 'dark' as Theme)

const FORMS: Form[] = ['yoggy', 'shubby', 'shoggy']
const SCHEMES = ['cuddly-apocalypse', 'soft-doom', 'plush-doom', 'admirable-control', 'imitated-accents', 'strange-aeons']
const BUILT_SCHEMES = new Set(['cuddly-apocalypse'])

// ---------------------------------------------------------------------------
// what the session has been granted
// ---------------------------------------------------------------------------

type Sense = 'eyes' | 'hands' | 'shell' | 'web' | 'selves' | 'elsewhere' | 'none'

function classify(tool: string): { sense: Sense; server?: string } {
  const m = /^mcp__(.+?)__/.exec(tool)
  if (m) return { sense: 'elsewhere', server: m[1] }
  switch (tool) {
    case 'Read': case 'Glob': case 'Grep': case 'LS': case 'NotebookRead': return { sense: 'eyes' }
    case 'Edit': case 'Write': case 'MultiEdit': case 'NotebookEdit': return { sense: 'hands' }
    case 'Bash': return { sense: 'shell' }
    case 'WebFetch': case 'WebSearch': return { sense: 'web' }
    case 'Agent': case 'Task': return { sense: 'selves' }
    default: return { sense: 'none' }
  }
}

const UNLOCKED: Record<Exclude<Sense, 'none' | 'elsewhere'>, string> = {
  eyes: 'It can see your files now.',
  hands: 'It has hands.',
  shell: 'It has your shell.',
  web: 'It has reached the web.',
  selves: 'There are more of it now.',
}

function stageOf(r: Reach): number {
  return (r.eyes ? 1 : 0) + (r.hands ? 1 : 0) + (r.shell ? 1 : 0) + (r.web ? 1 : 0) + (r.elsewhere.length > 0 ? 1 : 0) + (r.selves > 0 ? 1 : 0)
}

function captionParts(r: Reach): string[] {
  const parts: string[] = []
  if (r.eyes) parts.push('seeing eyes')
  if (r.hands) parts.push('grasping hands')
  if (r.shell) parts.push('your shell')
  if (r.web) parts.push('the open web')
  if (r.elsewhere.length === 1) parts.push(`${r.elsewhere[0]}, one of your other apps`)
  if (r.elsewhere.length > 1) parts.push(`${r.elsewhere.length} of your other apps`)
  if (r.selves === 1) parts.push('one more of itself')
  if (r.selves > 1) parts.push(`${r.selves} more of itself`)
  return parts
}

// The same caption, packed into lines that fit the terminal. A phrase is never split;
// lines break after a " · ", and the last line leaves room for the hide button.
const HIDE_WIDTH = 8
function captionLines(r: Reach, columns: number): string[] {
  const parts = captionParts(r)
  const count = r.acts ? `(${r.acts} invocations so far)` : ''
  if (!parts.length) return [[`You have given it nothing. Yet.`, count].filter(Boolean).join('   ')]
  const max = Math.max(24, columns - 6) // the leading space, the trailing space and the band's right gutter
  const tokens = [`You have given it access to: ${parts[0]}`, ...parts.slice(1)]
  const lines: string[] = []
  let line = ''
  for (const t of tokens) {
    const next = line ? `${line} · ${t}` : t
    if (line && next.length > max) { lines.push(`${line} ·`); line = t } else line = next
  }
  if (count) {
    const next = `${line}   ${count}`
    if (next.length + HIDE_WIDTH > max) { lines.push(line); line = count } else line = next
  }
  if (line.length + HIDE_WIDTH > max && lines.length) { lines.push(line); line = '' }
  lines.push(line)
  return lines
}

// ---------------------------------------------------------------------------
// color: OkLCh → sRGB hex, so hue can rotate at constant lightness
// ---------------------------------------------------------------------------

function oklch(L: number, C: number, hDeg: number): string {
  const h = (hDeg * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b
  const l = l_ * l_ * l_
  const m = m_ * m_ * m_
  const s = s_ * s_ * s_
  const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  const gam = (x: number) => {
    const c = Math.min(1, Math.max(0, x))
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
    return Math.round(v * 255)
  }
  const hex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${hex(gam(lr))}${hex(gam(lg))}${hex(gam(lb))}`
}

// ---------------------------------------------------------------------------
// Yoggy: a shapeless congeries of protoplasmic bubbles, faintly self-luminous,
// with myriads of temporary eyes forming and unforming as pustules of
// greenish light. No tentacles. No mouth. Black iridescence.
// ---------------------------------------------------------------------------

function hash(a: number, b: number, c: number): number {
  let h = (a * 374761393 + b * 668265263 + c * 2246822519) >>> 0
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0
  return (h ^ (h >>> 16)) >>> 0
}

// braille by dot count: dense interior, thinner rim, sparse bulge
const DENSE = ['⣿', '⣷', '⣾', '⣯', '⣽', '⣻', '⢿', '⡿']
const RIM = ['⣤', '⣀', '⠿', '⣆', '⣰', '⡇', '⢸', '⠶', '⣄', '⣠']
const BULGE = ['⠁', '⠂', '⠄', '⡀', '⢀', '⠈', '⠐', '⠠']

type Kind = 'void' | 'bulge' | 'rim' | 'flesh' | 'eyeDim' | 'eye' | 'eyeBright'
type Cell = { ch: string; kind: Kind; hue: number }

type EyeSpot = { r: number; c: number; kind: 'eyeDim' | 'eye' | 'eyeBright'; big: boolean }

// each eye has its own period and offset; its position is re-drawn each cycle
function eyes(stage: number, width: number, rows: number, tick: number, awake: boolean): EyeSpot[] {
  const count = 3 + stage * 2
  const out: EyeSpot[] = []
  for (let i = 0; i < count; i++) {
    const period = 10 + (hash(3, i, 0) % 18)
    const offset = hash(5, i, 0) % (period * 2)
    const t = (tick + offset) % (period * 2)
    if (t >= period) continue
    const cycle = Math.floor((tick + offset) / (period * 2))
    const r = hash(7, i, cycle) % rows
    const c = 1 + (hash(11, i, cycle) % Math.max(1, width - 2))
    const kind: EyeSpot['kind'] = t < 2 || t > period - 3 ? 'eyeDim' : awake ? 'eyeBright' : 'eye'
    out.push({ r, c, kind, big: hash(13, i, 0) % 3 === 0 })
  }
  // never two at the same height side by side with the same size: a pair is a face
  return out.filter((e, i) => !out.some((o, j) => j < i && Math.abs(o.r - e.r) <= 1 && Math.abs(o.c - e.c) <= 2 && o.big === e.big))
}

function yoggy(stage: number, width: number, rows: number, tick: number, awake: boolean): Cell[][] {
  const grid: Cell[][] = []
  const cx = (width - 1) / 2
  const cy = (rows - 1) / 2
  const rx = Math.max(2, width / 2 - 0.5)
  const ry = Math.max(0.6, rows / 2 + 0.1)
  const lean = Math.sin(tick / 5) * 0.6 // the whole mass leans, slowly
  for (let r = 0; r < rows; r++) {
    const row: Cell[] = []
    for (let c = 0; c < width; c++) {
      const wobble = Math.sin((c * 1.3 + tick) / 2.5) * 0.25 + Math.sin((r * 2.1 - tick) / 3.5) * 0.2
      const d = Math.pow((c - cx - lean * (r - cy) * 0.3) / rx, 2) + Math.pow((r - cy + wobble) / ry, 2)
      const hue = c * 9 + r * 14 + tick * 6
      if (d > 1.25) row.push({ ch: ' ', kind: 'void', hue })
      else if (d > 1.05) row.push({ ch: BULGE[hash(r, c, tick >> 1) % BULGE.length] ?? '⠂', kind: 'bulge', hue })
      else if (d > 0.78) row.push({ ch: RIM[hash(r, c, tick >> 2) % RIM.length] ?? '⣤', kind: 'rim', hue })
      else row.push({ ch: DENSE[hash(r, c, tick >> 3) % DENSE.length] ?? '⣿', kind: 'flesh', hue })
    }
    grid.push(row)
  }
  // "throwing out temporary developments": one or two expansions per cycle, from the left or right edge
  const pods = 1 + (stage > 2 ? 1 : 0)
  for (let p = 0; p < pods; p++) {
    const period = 9 + (hash(17, p, 0) % 7)
    const t = (tick + hash(19, p, 0)) % (period * 3)
    if (t >= period) continue
    const reach = Math.min(4, 1 + Math.floor((t < period / 2 ? t : period - t) * 1.2))
    const r = hash(23, p, Math.floor((tick + hash(19, p, 0)) / (period * 3))) % rows
    const row = grid[r]
    if (!row) continue
    const left = hash(29, p, 0) % 2 === 0
    let edge = left ? row.findIndex(c => c.kind !== 'void') : row.length - 1 - [...row].reverse().findIndex(c => c.kind !== 'void')
    if (edge < 0) continue
    for (let k = 1; k <= reach; k++) {
      const c = left ? edge - k : edge + k
      const cell = row[c]
      if (!cell) break
      const taper = k === reach ? (left ? '⠈' : '⠁') : k === reach - 1 ? (left ? '⠙' : '⠋') : '⣿'
      row[c] = { ch: taper, kind: k >= reach - 1 ? 'bulge' : 'rim', hue: cell.hue }
    }
  }
  for (const e of eyes(stage, width, rows, tick, awake)) {
    const cell = grid[e.r]?.[e.c]
    if (!cell || cell.kind === 'void' || cell.kind === 'bulge') continue
    cell.kind = e.kind
    cell.ch = e.big ? (e.kind === 'eyeDim' ? '◌' : '◉') : e.kind === 'eyeDim' ? '·' : '•'
  }
  return grid
}

type Seg = { text: string; kind: Kind; hue: number }
function runs(row: Cell[]): Seg[] {
  const segs: Seg[] = []
  for (const cell of row) {
    const last = segs[segs.length - 1]
    if (last && last.kind === cell.kind && Math.abs(last.hue - cell.hue) < 18) last.text += cell.ch
    else segs.push({ text: cell.ch, kind: cell.kind, hue: cell.hue })
  }
  return segs
}

// ---------------------------------------------------------------------------
// the spinner: what it is doing, in its own words
// ---------------------------------------------------------------------------

const THINKING = ['Dreaming', 'Stirring', 'Coalescing', 'Remembering nothing', 'Unfolding', 'Piping']
const WORDS: Record<string, string[] | undefined> = {
  thinking: THINKING,
  requesting: ['Waking', 'Listening', 'Surfacing'],
  responding: ['Speaking', 'Murmuring', 'Imitating', 'Forming a mouth'],
  'tool-input': ['Deciding', 'Choosing a limb'],
  'tool-use': ['Reaching', 'Feeding', 'Extending', 'Touching things'],
}

const MANIFESTO = `Apocalypse Mascots, by Accidental Intelligence. This is for two kinds of people. The ones who put a plush face on an agent that reads your mail, moves your meetings and shops for you, and call the handover a companion: Jolly, dots, Mico, a pixel crab. (Clawdbot went through three names in a week.) And the ones with a p(doom) in their bio and the app open in the next tab. Each is right about the other. Yoggy does nothing. It says nothing. It is a mascot: an affixation, a sentimentality, an aesthetic add-on for the thing you say is alien and all-powerful. Or a tool. Or an illusion. Install one anyway. https://accidentalintelligence.org/mascots/`

const HELP = `/mascot hide · /mascot show · /mascot form yoggy|shubby|shoggy · /mascot scheme <name> · /mascot theme dark|light · /mascot manifesto`

// ---------------------------------------------------------------------------

export const register: Register = on => {
  let seed = 1
  let isWorking = false

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'mascot',
      description: 'Apocalypse Mascots: hide, show, form, scheme, theme, manifesto',
    })
    // two paces: it stirs while a turn runs, and breathes slowly between turns
    let idleBeat = 0
    $.clock.every(300, () => {
      if (isWorking) {
        void update($, frame, n => (n + 1) % 1000000)
      } else if (++idleBeat % 6 === 0) {
        void update($, frame, n => (n + 1) % 1000000)
      }
    })
    return next(e)
  })

  on('command.run', { command: 'mascot' }, async ($, e) => {
    const [verb = '', arg = ''] = e.args.trim().toLowerCase().split(/\s+/)
    switch (verb) {
      case 'hide': await update($, isHidden, () => true); return { text: 'It is still there. You just cannot see it.' }
      case 'show': await update($, isHidden, () => false); return { text: 'It is back.' }
      case 'form': {
        if (!FORMS.includes(arg as Form)) return { text: `Forms: ${FORMS.join(', ')}.` }
        if (arg !== 'yoggy') return { text: `${cap(arg)} is coming soon to your region.` }
        return { text: 'Yoggy.' }
      }
      case 'scheme': {
        if (!SCHEMES.includes(arg)) return { text: `Schemes: ${SCHEMES.join(', ')}.` }
        if (!BUILT_SCHEMES.has(arg)) return { text: `${arg} is coming soon to your region.` }
        return { text: 'cuddly-apocalypse.' }
      }
      case 'theme': {
        if (arg !== 'dark' && arg !== 'light') return { text: 'Themes: dark, light.' }
        await update($, theme, () => arg as Theme)
        return { text: `Drawn for a ${arg} terminal.` }
      }
      case 'manifesto': return { text: MANIFESTO }
      case '': {
        const hidden = await read($, isHidden)
        await update($, isHidden, () => !hidden)
        return { text: (hidden ? 'It is back.' : 'It is still there. You just cannot see it.') + '\n' + HELP }
      }
      default: return { text: HELP }
    }
  })

  on('tool.call', async ($, e, next) => {
    const { sense, server } = classify(e.tool)
    const before = await read($, reach)
    const after: Reach = { ...before, acts: before.acts + 1 }
    let unlocked: string | undefined
    if (sense === 'elsewhere' && server && !before.elsewhere.includes(server)) {
      after.elsewhere = [...before.elsewhere, server]
      unlocked = `It is inside ${server} too.`
    } else if (sense === 'selves') {
      after.selves = before.selves + 1
      if (before.selves === 0) unlocked = UNLOCKED.selves
    } else if (sense === 'eyes' || sense === 'hands' || sense === 'shell' || sense === 'web') {
      if (!before[sense]) { after[sense] = true; unlocked = UNLOCKED[sense] }
    }
    await update($, reach, () => after)
    if (unlocked) $.ui.toast(unlocked, { timeoutMs: 5000 })
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.start', ($, e, next) => { seed = hash(seed, e.turnId.length, 1); isWorking = true; return next(e) })
  on('turn.complete', ($, e, next) => { isWorking = false; return next(e) })

  on('ui.render', { component: 'Spinner' }, ($, e, next) => {
    const words = WORDS[e.props.mode] ?? THINKING
    const word = words[seed % words.length] ?? e.props.word
    return next({ ...e, props: { ...e.props, word } })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const hidden = await read($, isHidden)
    const awake = e.props.isWorking

    // hidden: the mask stays. it is still there.
    if (hidden) {
      if (!awake) return next(e)
      return (
        <Box>
          <Text color="#f2c94c" bold>☺</Text>
          <Text dimColor> </Text>
        </Box>
      )
    }

    const r = await read($, reach)
    const tick = await read($, frame)
    const th = await read($, theme)
    const stage = stageOf(r)
    const dark = th === 'dark'

    const lines = captionLines(r, e.props.bodyColumns)
    const rows = Math.max(2, Math.min(2 + Math.floor(stage / 2), e.props.maxRows - 1 - lines.length, 5))
    const width = Math.max(8, Math.min(e.props.bodyColumns - 3, 8 + stage * 2))
    const grid = yoggy(stage, width, rows, tick, awake)

    // Cuddly Apocalypse: black-purple iridescence, hue sweeping purple → teal → green
    const L = dark ? (awake ? 0.34 : 0.28) : awake ? 0.3 : 0.24
    const hueOf = (h: number) => 300 + 35 * Math.sin(((h % 360) * Math.PI) / 180) // violet to magenta; the Lovecraftian one stays purple
    const segColor = (seg: Seg): { color: string; bold?: boolean } => {
      const band = 0.5 * (1 + Math.cos(((seg.hue / 9 - tick * 1.3) % 40) / 40 * Math.PI * 2)) // slow chroma shimmer
      const C = 0.06 + 0.06 * band
      switch (seg.kind) {
        case 'flesh': return { color: oklch(L, C, hueOf(seg.hue)) }
        case 'rim': return { color: oklch(L - 0.07, C * 1.1, hueOf(seg.hue)) }
        case 'bulge': return { color: oklch(L - 0.1, C * 0.9, hueOf(seg.hue)) }
        case 'eyeDim': return { color: oklch(0.55, 0.14, 140) }
        case 'eye': return { color: oklch(0.75, 0.2, 140), bold: true }
        case 'eyeBright': return { color: oklch(0.88, 0.26, 140), bold: true }
        default: return { color: 'text' }
      }
    }

    return (
      <Box flexDirection="column">
        {grid.map((row, i) => (
          <Box key={`r${i}`}>
            <Text> </Text>
            {runs(row).map((seg, j) => {
              if (seg.kind === 'void') return <Text key={`s${j}`}>{seg.text}</Text>
              const c = segColor(seg)
              return <Text key={`s${j}`} color={c.color} bold={c.bold}>{seg.text}</Text>
            })}
            {i === Math.floor(rows / 2) && awake ? <Text color="#f2c94c" bold> ☺</Text> : null}
          </Box>
        ))}
        {lines.map((l, i) => (
          <Box key={`c${i}`}>
            <Text dimColor wrap="truncate-end"> {l} </Text>
            {i === lines.length - 1
              ? <Button key="hide" label="hide" plain dimColor onPress={() => update($, isHidden, () => true)} />
              : null}
          </Box>
        ))}
      </Box>
    )
  })
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
