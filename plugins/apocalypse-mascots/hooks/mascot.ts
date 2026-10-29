import type { Form, Reach, Scheme } from '../types'
import { COLS, ROWS, drawShoggy, drawShubby } from './figures'
import type { HalfCell, RGB, ShubbyState } from './figures'

// ---------------------------------------------------------------------------
// What every surface draws: the forms, the schemes, Yoggy, the caption. The
// Claude Code band, the site and the companion pane all draw from here.
// ---------------------------------------------------------------------------

export const EMPTY: Reach = { eyes: false, hands: false, shell: false, web: false, elsewhere: [], selves: 0, acts: 0 }

export const FORMS: Form[] = ['yoggy', 'shubby', 'shoggy']
export const BUILT_FORMS = new Set<Form>(['yoggy', 'shubby'])
// each form's own scheme, which it opens in
export const NATIVE: Record<Form, Scheme> = { yoggy: 'cuddly-apocalypse', shubby: 'foetid-ichor', shoggy: 'strange-aeons' }
// in release order: each drop opens the next one's gate
export const SCHEMES: Scheme[] = ['cuddly-apocalypse', 'foetid-ichor', 'scarred-bones', 'strange-aeons', 'imitated-accents', 'cosmic-pulsing']
export const BUILT_SCHEMES = new Set<Scheme>(['cuddly-apocalypse', 'foetid-ichor'])

// ---------------------------------------------------------------------------
// what the session has been granted: each agent names its tools its own way,
// and each surface sorts them into these senses
// ---------------------------------------------------------------------------

export type Sense = 'eyes' | 'hands' | 'shell' | 'web' | 'selves' | 'elsewhere' | 'none'

const UNLOCKED: Record<Exclude<Sense, 'none' | 'elsewhere'>, string> = {
  eyes: 'It can see your files now.',
  hands: 'It has hands.',
  shell: 'It has your shell.',
  web: 'It has reached the web.',
  selves: 'There are more of it now.',
}


// one tool call: what it adds to the reach, and the line that says so the first time
export function grant(before: Reach, sense: Sense, server?: string): { after: Reach; unlocked?: string } {
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
  return { after, unlocked }
}

export function stageOf(r: Reach): number {
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
export function captionLines(r: Reach, columns: number): string[] {
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

export function oklchRGB(L: number, C: number, hDeg: number): number {
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
  return (gam(lr) << 16) | (gam(lg) << 8) | gam(lb)
}

export const hexOf = (rgb: number) => `#${rgb.toString(16).padStart(6, '0')}`
const oklch = (L: number, C: number, hDeg: number) => hexOf(oklchRGB(L, C, hDeg))

// ---------------------------------------------------------------------------
// Yoggy: a shapeless congeries of protoplasmic bubbles, faintly self-luminous,
// with myriads of temporary eyes forming and unforming as pustules of
// greenish light. No tentacles. No mouth. Black iridescence.
// ---------------------------------------------------------------------------

export function hash(a: number, b: number, c: number): number {
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

export function yoggy(stage: number, width: number, rows: number, tick: number, awake: boolean): Cell[][] {
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

// ---------------------------------------------------------------------------
// the six schemes. On Yoggy each is a field over the body: f(x, y, k, hue, c, r)
// → [ΔL, C, hue], x and y running -1..1 across it, k its tick. Each also names
// its eyes, and its mask: the scheme's brightest colour, so the face reads as
// part of the creature, not a sticker.
// ---------------------------------------------------------------------------

type LCh = [number, number, number]
export type Field = {
  eye: LCh
  mask: (tick: number) => LCh
  f: (x: number, y: number, k: number, hue: number, c: number, r: number) => LCh
}

const TAU = Math.PI * 2
const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v)
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const ease = (t: number) => { const u = clamp(t); return u * u * (3 - 2 * u) }
const rnd = (a: number, b: number, c: number) => hash(a, b, c) / 4294967296

function vnoise(x: number, y: number, s: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
  const a = rnd(xi, yi, s), b = rnd(xi + 1, yi, s), c = rnd(xi, yi + 1, s), d = rnd(xi + 1, yi + 1, s)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

// stops are [u, ΔL, C, hue]
function ramp(stops: [number, number, number, number][], u: number): LCh {
  const t = clamp(u)
  let i = 0
  while (i < stops.length - 2 && t > (stops[i + 1]?.[0] ?? 1)) i++
  const a = stops[i] ?? stops[0]!, b = stops[i + 1] ?? a
  const k = ease((t - a[0]) / (b[0] - a[0] || 1))
  return [mix(a[1], b[1], k), mix(a[2], b[2], k), mix(a[3], b[3], k) % 360]
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
// palette cycling in beats: every fourth step the palette jumps, so it pulses
const cycleU = (k: number, c: number, r: number) => {
  const P = 12, off = k + 3 * Math.floor(k / 4), idx = (((c * 2 + r * 3 - off) % P) + P) % P
  return 1 - Math.abs((idx / P) * 2 - 1)
}
// imitated-accents owns no colour: its mask borrows the other five's in turn, a dozen ticks each
const HUES = [305, 128, 205, 22, 85]
const hueTo = (a: number, b: number, k: number) => a + (((((b - a) % 360) + 540) % 360) - 180) * k
const borrowedHue = (tick: number) => {
  const i = Math.floor(tick / 12)
  return hueTo(HUES[i % 5] ?? 305, HUES[(i + 1) % 5] ?? 305, ease(((tick % 12) - 9) / 3))
}

export const FIELDS: Record<Scheme, Field> = {
  // dark purple → purple → rose → orange, travelling diagonally; it stops at orange
  'cuddly-apocalypse': {
    eye: [0.88, 0.26, 140],
    mask: () => [0.84, 0.13, 50],
    f: (x, y, k, hue) => {
      const u = 0.5 * (1 + Math.sin((hue * Math.PI) / 180))
      const band = 0.5 * (1 + Math.cos((((hue / 9 - k * 1.3) % 40) / 40) * TAU))
      const [dL, C, h] = ramp([[0, -0.1, 0.085, 298], [0.38, 0, 0.13, 305], [0.68, 0.05, 0.14, 350], [1, 0.09, 0.15, 405]], u)
      return [dL, C * (0.85 + 0.25 * band), h]
    },
  },
  // lit from above: tar in the shadow, foetid greenish-yellow ichor in the light. Red eyes.
  'foetid-ichor': {
    eye: [0.74, 0.2, 25],
    mask: () => [0.9, 0.16, 116],
    f: (x, y) => {
      const nz = Math.sqrt(Math.max(0, 1 - x * x - y * y))
      const lam = clamp(-0.45 * x - 0.65 * y + 0.6 * nz)
      return [-0.09 + 0.22 * lam, 0.06 + 0.08 * lam, 128 - 10 * lam]
    },
  },
  // bone ochre over sepia-black in a Bayer dither, the light sliding slowly across. Green eyes.
  'scarred-bones': {
    eye: [0.88, 0.26, 140],
    mask: () => [0.96, 0.02, 95],
    f: (x, y, k, hue, c, r) => {
      const v = clamp((1 - (y + 1) / 2) * 0.8 + 0.2 * (0.5 + 0.5 * Math.sin(k / 4 + x * 2)))
      return v * 16 > (BAYER[(r % 4) * 4 + (c % 4)] ?? 0) ? [0.25, 0.03, 85] : [-0.065, 0.03, 60]
    },
  },
  // lit cyan at the top, abyssal blue-black at the base, flecks of deep-sea light
  'strange-aeons': {
    eye: [0.88, 0.15, 192],
    mask: () => [0.88, 0.13, 192],
    f: (x, y, k, hue, c, r) => {
      const u = (y + 1) / 2
      let dL = mix(0.09, -0.11, u), C = mix(0.1, 0.06, u), h = mix(192, 265, u)
      const n = vnoise(c * 0.6 + k * 0.35, r * 1.4 - k * 0.1, 11)
      if (n > 0.64) { dL += (0.22 * (n - 0.64)) / 0.36; C = 0.14; h = 182 }
      return [dL, C, h]
    },
  },
  // hue is the angle around the centre, and the wheel turns: every accent in turn, owning none
  'imitated-accents': {
    eye: [0.88, 0.26, 140],
    mask: tick => [0.94, 0.03, borrowedHue(tick)],
    f: (x, y, k) => [0, 0.11, (Math.atan2(y, x) * 180) / Math.PI + k * 9],
  },
  // venous dark red → arterial red → raw pink, cycling through the still body. Amber eyes.
  'cosmic-pulsing': {
    eye: [0.88, 0.17, 92],
    mask: () => [0.85, 0.11, 10],
    f: (x, y, k, hue, c, r) => ramp([[0, -0.11, 0.09, 14], [0.6, 0.02, 0.17, 26], [1, 0.12, 0.11, 14]], cycleU(k, c, r)),
  },
}

// ---------------------------------------------------------------------------
// painting: each cell a glyph and a colour, then drawn as a Raster on the
// terminal and as runs of Text everywhere else
// ---------------------------------------------------------------------------

export type Ink = { ch: string; fg?: number; bg?: number; bold?: boolean } // colours are 0xRRGGBB; absent, the terminal's own (bg: the ground)

// The schemes are drawn for a dark ground. On a light terminal the creature
// brings its own: every cell it paints sits on the terminal dark of the site.
export const GROUND = 0x0d0b14
export const maskInk = (field: Field, tick: number): number => oklchRGB(...field.mask(tick))

// one blank column on the left, the body, then two more where the mask is held up
export function paintYoggy(grid: Cell[][], field: Field, tick: number, awake: boolean): Ink[][] {
  const rows = grid.length
  const width = grid[0]?.length ?? 0
  const L0 = awake ? 0.42 : 0.36
  const [eL, eC, eh] = field.eye
  const ink = grid.map((row, r) => {
    const out: Ink[] = [{ ch: ' ' }]
    row.forEach((cell, c) => {
      switch (cell.kind) {
        case 'void': out.push({ ch: ' ' }); return
        case 'eyeDim': out.push({ ch: cell.ch, fg: oklchRGB(0.55, eC * 0.55, eh) }); return
        case 'eye': out.push({ ch: cell.ch, fg: oklchRGB(0.75, eC * 0.8, eh), bold: true }); return
        case 'eyeBright': out.push({ ch: cell.ch, fg: oklchRGB(eL, eC, eh), bold: true }); return
      }
      const x = (c - (width - 1) / 2) / (width / 2)
      const y = rows > 1 ? (r - (rows - 1) / 2) / (rows / 2) : 0
      const [dL, C, h] = field.f(x, y, tick, cell.hue, c, r)
      const L = L0 + dL * 1.6 - (cell.kind === 'rim' ? 0.07 : cell.kind === 'bulge' ? 0.1 : 0)
      const chroma = C * 1.25 * (cell.kind === 'rim' ? 1.1 : cell.kind === 'bulge' ? 0.9 : 1)
      out.push({ ch: cell.ch, fg: oklchRGB(L, chroma, h) })
    })
    out.push({ ch: ' ' }, { ch: ' ' })
    return out
  })
  const mid = ink[Math.floor(rows / 2)]
  if (awake && mid) mid[width + 2] = { ch: '☺', fg: maskInk(field, tick), bold: true }
  return ink
}

// a figure's half-block cells as ink: one blank column on the left, as Yoggy has
export const rgbInt = (c: RGB | undefined) => (c ? (c[0] << 16) | (c[1] << 8) | c[2] : undefined)
export function figureInk(cells: HalfCell[][]): Ink[][] {
  return cells.map(row => [{ ch: ' ' }, ...row.map(c => ({ ch: c.ch, fg: rgbInt(c.fg), bg: rgbInt(c.bg) }))])
}

export const MANIFESTO = `Apocalypse Mascots, by Accidental Intelligence. This is for two kinds of people. The ones who put a plush face on an agent that reads your mail, moves your meetings and shops for you, and call the handover a companion: Jolly, dots, Mico, a pixel crab. (Clawdbot went through three names in a week.) And the ones with a p(doom) in their bio and the app open in the next tab. Each is right about the other. Yoggy does nothing. It says nothing. It is a mascot: an affixation, a sentimentality, an aesthetic add-on for the thing you say is alien and all-powerful. Or a tool. Or an illusion. Install one anyway. https://accidentalintelligence.org/mascots/`

export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// The creature and its caption, for a box `columns` wide and `maxRows` high, the caption
// and one row for whatever sits below included. `tick` is Yoggy's clock, `t` the figures' seconds.
export type Pose = { shape: Form; scheme: Scheme; tick: number; t: number; reach: Reach; awake: boolean; shubby: ShubbyState }
export function bodyInk(p: Pose, columns: number, maxRows: number): { ink: Ink[][]; lines: string[] } {
  const stage = stageOf(p.reach)
  const lines = captionLines(p.reach, columns)
  if (p.shape === 'yoggy') {
    const rows = Math.max(2, Math.min(2 + Math.floor(stage / 2), maxRows - 1 - lines.length, 5))
    const width = Math.max(8, Math.min(columns - 3, 8 + stage * 2))
    return { ink: paintYoggy(yoggy(stage, width, rows, p.tick, p.awake), FIELDS[p.scheme], p.tick, p.awake), lines }
  }
  // a figure is drawn whole in its 32 × 8 field; a short band keeps its feet and loses its top
  const cells = p.shape === 'shubby' ? drawShubby(p.scheme, p.shubby, p.t, stage, p.awake) : drawShoggy(p.scheme, p.t, stage, p.awake)
  const rows = Math.max(2, Math.min(ROWS, maxRows - 1 - lines.length))
  return { ink: figureInk(cells.slice(ROWS - rows)).map(row => row.slice(0, Math.max(8, Math.min(COLS + 1, columns - 1)))), lines }
}
