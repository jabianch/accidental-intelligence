import type { Scheme } from '../types'

// ---------------------------------------------------------------------------
// Shubby and Shoggy: the two figures. Yoggy is a texture of braille; these are
// drawings, ported from the round-seven design brief. Mods have no canvas, so
// this file carries a small one: enough of a 2D context (ellipses, arcs, paths,
// round strokes, clips, alpha) to draw into a 32 × 16 pixel field at 2 × 2
// supersampling, then fold every two pixels into one half-block cell.
// ---------------------------------------------------------------------------

export type RGB = [number, number, number]
type RGBA = [number, number, number, number] // rgb 0..255, alpha 0..1
type LCh = [number, number, number]
type Mat = [number, number, number, number, number, number] // x' = a x + c y + e, y' = b x + d y + f
type Pt = [number, number]
type Sub = { pts: Pt[]; closed: boolean }

const TAU = Math.PI * 2
const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v)
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const ease = (t: number) => { const u = clamp(t); return u * u * (3 - 2 * u) }

function hash(a: number, b: number, c: number): number {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 2246822519)) >>> 0
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0
  return (h ^ (h >>> 16)) >>> 0
}
const rnd = (a: number, b: number, c: number) => hash(a, b, c) / 4294967296

// OkLCh → sRGB 0..255, the same conversion as the plugin's
export function ok(L: number, C: number, hDeg: number): RGB {
  const hr = (hDeg * Math.PI) / 180, a = C * Math.cos(hr), b = C * Math.sin(hr)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  const gam = (x: number) => { const c = clamp(x); return Math.round((c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255) }
  return [gam(r), gam(g), gam(bb)]
}
const okc = (L: number, C: number, h: number, a = 1): RGBA => [...ok(L, C, h), a]

// ---------------------------------------------------------------------------
// the canvas: premultiplied colour per pixel, nonzero fills, round strokes
// ---------------------------------------------------------------------------

const mul = (m: Mat, n: Mat): Mat => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
]
const apply = (m: Mat, x: number, y: number): Pt => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
const ID: Mat = [1, 0, 0, 1, 0, 0]

// a path in user units; a Surface's own path is built under its transform at the time, as a canvas's is
export class Path {
  subs: Sub[] = []
  constructor(private m: () => Mat = () => ID) {}
  private get cur(): Sub | undefined { return this.subs[this.subs.length - 1] }
  private push(x: number, y: number, join: boolean) {
    const p = apply(this.m(), x, y)
    if (join && this.cur) this.cur.pts.push(p)
    else this.subs.push({ pts: [p], closed: false })
  }
  moveTo(x: number, y: number) { this.push(x, y, false) }
  lineTo(x: number, y: number) { this.push(x, y, true) }
  closePath() { const c = this.cur; if (c) { c.closed = true; const p = c.pts[0]; if (p) this.subs.push({ pts: [p], closed: false }) } }
  // the last point in user units, recovered from the device point
  private last(): Pt {
    const p = this.cur?.pts[this.cur.pts.length - 1] ?? [0, 0], m = this.m(), det = m[0] * m[3] - m[1] * m[2] || 1
    const x = p[0] - m[4], y = p[1] - m[5]
    return [(m[3] * x - m[2] * y) / det, (-m[1] * x + m[0] * y) / det]
  }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number) {
    const [x0, y0] = this.last()
    for (let i = 1; i <= 8; i++) { const t = i / 8, u = 1 - t; this.lineTo(u * u * x0 + 2 * u * t * cx + t * t * x, u * u * y0 + 2 * u * t * cy + t * t * y) }
  }
  ellipse(x: number, y: number, rx: number, ry: number, rot: number, a0: number, a1: number) {
    let end = a1
    while (end < a0) end += TAU
    if (end - a0 > TAU) end = a0 + TAU
    const cos = Math.cos(rot), sin = Math.sin(rot), n = Math.max(12, Math.ceil(((end - a0) / TAU) * 48))
    for (let i = 0; i <= n; i++) {
      const a = mix(a0, end, i / n), ex = rx * Math.cos(a), ey = ry * Math.sin(a)
      this.push(x + ex * cos - ey * sin, y + ex * sin + ey * cos, i > 0 || !!this.cur)
    }
  }
  arc(x: number, y: number, r: number, a0: number, a1: number) { this.ellipse(x, y, r, r, 0, a0, a1) }
}

type State = { m: Mat; clip: Float32Array | null; alpha: number; comp: 'source-over' | 'destination-over' }

export class Surface {
  readonly px: Float32Array // r g b a, premultiplied, rgb 0..255
  private st: State = { m: ID, clip: null, alpha: 1, comp: 'source-over' }
  private stack: State[] = []
  private path = new Path(() => this.st.m)
  fillStyle: RGBA = [0, 0, 0, 1]
  strokeStyle: RGBA = [0, 0, 0, 1]
  lineWidth = 1

  constructor(readonly w: number, readonly h: number) { this.px = new Float32Array(w * h * 4) }

  get globalAlpha() { return this.st.alpha }
  set globalAlpha(a: number) { this.st.alpha = a }
  get globalCompositeOperation() { return this.st.comp }
  set globalCompositeOperation(c: State['comp']) { this.st.comp = c }

  clear() { this.px.fill(0) }
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number) { this.st.m = [a, b, c, d, e, f] }
  translate(x: number, y: number) { this.st.m = mul(this.st.m, [1, 0, 0, 1, x, y]) }
  rotate(r: number) { const c = Math.cos(r), s = Math.sin(r); this.st.m = mul(this.st.m, [c, s, -s, c, 0, 0]) }
  save() { this.stack.push({ ...this.st }) }
  restore() { const s = this.stack.pop(); if (s) this.st = s }

  beginPath() { this.path = new Path(() => this.st.m) }
  moveTo(x: number, y: number) { this.path.moveTo(x, y) }
  lineTo(x: number, y: number) { this.path.lineTo(x, y) }
  closePath() { this.path.closePath() }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number) { this.path.quadraticCurveTo(cx, cy, x, y) }
  ellipse(x: number, y: number, rx: number, ry: number, rot: number, a0: number, a1: number) { this.path.ellipse(x, y, rx, ry, rot, a0, a1) }
  arc(x: number, y: number, r: number, a0: number, a1: number) { this.path.arc(x, y, r, a0, a1) }

  // a Path made outside the surface is in user units: place it under the transform now
  private placed(p?: Path): Sub[] {
    if (!p) return this.path.subs
    const m = this.st.m
    return p.subs.map(s => ({ closed: s.closed, pts: s.pts.map(([x, y]) => apply(m, x, y)) }))
  }

  fillRect(x: number, y: number, w: number, h: number) {
    const p = new Path(() => this.st.m)
    p.moveTo(x, y); p.lineTo(x + w, y); p.lineTo(x + w, y + h); p.lineTo(x, y + h)
    this.cover(p.subs, 'fill', this.fillStyle)
  }
  fill(p?: Path) { this.cover(this.placed(p), 'fill', this.fillStyle) }
  stroke(p?: Path) { this.cover(this.placed(p), 'stroke', this.strokeStyle) }
  clip(p?: Path) {
    const mask = this.coverage(this.placed(p), 'fill')
    const old = this.st.clip
    if (old) for (let i = 0; i < mask.length; i++) mask[i] = (mask[i] ?? 0) * (old[i] ?? 0)
    this.st.clip = mask
  }

  // sixteen samples a pixel, so a shape thinner than a pixel still leaves part of itself (the star)
  private coverage(subs: Sub[], mode: 'fill' | 'stroke'): Float32Array {
    const out = new Float32Array(this.w * this.h)
    const m = this.st.m, half = (this.lineWidth * Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]))) / 2
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const s of subs) for (const [x, y] of s.pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) }
    if (!isFinite(x0)) return out
    const pad = mode === 'stroke' ? half : 0
    const cx0 = Math.max(0, Math.floor(x0 - pad)), cy0 = Math.max(0, Math.floor(y0 - pad))
    const cx1 = Math.min(this.w - 1, Math.ceil(x1 + pad)), cy1 = Math.min(this.h - 1, Math.ceil(y1 + pad))
    const segs: [number, number, number, number][] = []
    for (const s of subs) {
      const n = s.pts.length
      for (let i = 0; i + 1 < n; i++) { const a = s.pts[i]!, b = s.pts[i + 1]!; segs.push([a[0], a[1], b[0], b[1]]) }
      if ((mode === 'fill' || s.closed) && n > 1) { const a = s.pts[n - 1]!, b = s.pts[0]!; segs.push([a[0], a[1], b[0], b[1]]) }
    }
    for (let py = cy0; py <= cy1; py++) for (let qx = cx0; qx <= cx1; qx++) {
      let hit = 0
      for (const [sx, sy] of SAMPLES) {
        const x = qx + sx, y = py + sy
        if (mode === 'fill') { if (winding(segs, x, y) !== 0) hit++ }
        else if (segs.some(sg => segDist(x, y, sg) <= half)) hit++
      }
      if (hit) out[py * this.w + qx] = hit / SAMPLES.length
    }
    return out
  }

  private cover(subs: Sub[], mode: 'fill' | 'stroke', style: RGBA) {
    const cov = this.coverage(subs, mode), clip = this.st.clip, px = this.px, over = this.st.comp === 'source-over'
    for (let i = 0; i < cov.length; i++) {
      const c = cov[i] ?? 0
      if (!c) continue
      const sa = style[3] * this.st.alpha * c * (clip ? (clip[i] ?? 0) : 1)
      if (sa <= 0) continue
      const j = i * 4, da = px[j + 3] ?? 0, k = over ? 1 - sa : 1 - da, f = over ? sa : sa * (1 - da)
      for (let ch = 0; ch < 3; ch++) px[j + ch] = (over ? (px[j + ch] ?? 0) * k : (px[j + ch] ?? 0)) + (style[ch] ?? 0) * f
      px[j + 3] = over ? sa + da * k : da + f
    }
  }

  // one pixel's colour as a canvas's getImageData gives it: unpremultiplied, rgb 0..255, alpha 0..255
  read(i: number): RGBA {
    const j = i * 4, a = this.px[j + 3] ?? 0
    if (a <= 0) return [0, 0, 0, 0]
    return [Math.round((this.px[j] ?? 0) / a), Math.round((this.px[j + 1] ?? 0) / a), Math.round((this.px[j + 2] ?? 0) / a), Math.round(a * 255)]
  }
  write(i: number, rgb: RGB, alpha255: number) {
    const j = i * 4, a = alpha255 / 255
    this.px[j] = rgb[0] * a; this.px[j + 1] = rgb[1] * a; this.px[j + 2] = rgb[2] * a; this.px[j + 3] = a
  }
}

const SAMPLES: Pt[] = Array.from({ length: 16 }, (_, i) => [((i % 4) + 0.5) / 4, (Math.floor(i / 4) + 0.5) / 4] as Pt)
function winding(segs: [number, number, number, number][], x: number, y: number): number {
  let w = 0
  for (const [x0, y0, x1, y1] of segs) {
    if (y0 <= y) { if (y1 > y && (x1 - x0) * (y - y0) - (x - x0) * (y1 - y0) > 0) w++ }
    else if (y1 <= y && (x1 - x0) * (y - y0) - (x - x0) * (y1 - y0) < 0) w--
  }
  return w
}
function segDist(x: number, y: number, [x0, y0, x1, y1]: [number, number, number, number]): number {
  const dx = x1 - x0, dy = y1 - y0, L = dx * dx + dy * dy, k = L ? clamp(((x - x0) * dx + (y - y0) * dy) / L) : 0
  return Math.hypot(x - x0 - dx * k, y - y0 - dy * k)
}

// ---------------------------------------------------------------------------
// what a frame is drawn from, and what it comes out as
// ---------------------------------------------------------------------------

export type Frame = { t: number; stage: number; awake: boolean; cols: number; rows: number; H: number; mask?: 'smile' | false }
export type HalfCell = { ch: ' ' | '▀' | '▄'; fg?: RGB; bg?: RGB } // an absent bg is the ground

export const COLS = 32, ROWS = 8 // the field the drawings were made in: 32 × 16 half-block pixels
const U = 2 // supersampling: each half-block pixel is 2 × 2 canvas pixels

function frameOf(t: number, stage: number, awake: boolean): Frame {
  return { t, stage, awake, cols: COLS, rows: ROWS, H: ROWS * 2 }
}

// pixels → half-blocks: top pixel as ▀'s fg, bottom as its bg; a pixel exists where most of it is covered
function toHalfBlocks(g: Surface, cols: number, rows: number): HalfCell[][] {
  const W = cols, Hp = rows * 2, px: (RGB | null)[] = new Array(W * Hp)
  for (let y = 0; y < Hp; y++) for (let x = 0; x < W; x++) {
    let r = 0, gg = 0, b = 0, a = 0
    for (let sy = 0; sy < U; sy++) for (let sx = 0; sx < U; sx++) {
      const [cr, cg, cb, ca] = g.read((y * U + sy) * g.w + (x * U + sx)), al = ca / 255
      r += cr * al; gg += cg * al; b += cb * al; a += al
    }
    px[y * W + x] = a >= 1.6 ? [(r / a) | 0, (gg / a) | 0, (b / a) | 0] : null
  }
  const out: HalfCell[][] = []
  for (let r = 0; r < rows; r++) {
    const row: HalfCell[] = []
    for (let c = 0; c < cols; c++) {
      const top = px[2 * r * W + c], bot = px[(2 * r + 1) * W + c]
      row.push(!top && !bot ? { ch: ' ' } : top && bot ? { ch: '▀', fg: top, bg: bot } : top ? { ch: '▀', fg: top } : { ch: '▄', fg: bot! })
    }
    out.push(row)
  }
  return out
}

// ---------------------------------------------------------------------------
// value roles. A figure is drawn as a map of ROLES, not colours: R = lightness
// (bone light, flesh mid, cavities dark), G = accent (eyes, ichor), B = the
// mask. Each scheme then colours the body, so the anatomy survives every skin.
// ---------------------------------------------------------------------------

const rc = (L: number, acc = 0, sm = 0, a = 1): RGBA => [Math.round(clamp(L + 0.5) * 255), Math.round(acc * 255), Math.round(sm * 255), a]
const RL = {
  cav: rc(-0.2), flesh: rc(-0.07), sinew: rc(0.0), lip: rc(0.05), boneD: rc(0.1), bone: rc(0.24), hi: rc(0.42),
  eye: rc(0.1, 1), face: rc(0.43, 0, 1), feat: rc(-0.4, 0, 1),
}
const STAMP: Record<string, RGBA> = { D: RL.cav, F: RL.flesh, S: RL.sinew, b: RL.boneD, B: RL.bone, H: RL.hi, E: RL.eye, Y: RL.face, k: RL.feat }

function ell(g: Surface, x: number, y: number, rx: number, ry: number, fill: RGBA, rot = 0) {
  g.beginPath(); g.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU); g.fillStyle = fill; g.fill()
}
function star(g: Surface, x: number, y: number, r: number, fill: RGBA) {
  g.beginPath()
  for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4 - Math.PI / 2, rr = i % 2 ? r * 0.3 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) }
  g.closePath(); g.fillStyle = fill; g.fill()
}

// --- Shubby, hand-drawn parts, one character per half-block pixel ---------------------------------
const SKULL = [
  'b.......b',
  'bb.BBB.bb',
  '.bBBBBBb.',
  '..BEBEB..',
  '..BDBDB..',
  '...BDB...',
  '...BBB...',
]
const SKULL_BLINK = '..BbBbB..' // row 3 with the sockets dimmed
const RIBS = [
  ['.FFBFF.', 'BBBBBBB', 'FFFBFFF', '.BBBBB.', '..FDF..'], // breathing out
  ['..FBF..', '.BBBBB.', '.FFBFF.', '..BBB..', '..FDF..'], // breathing in
]
const MAW_OPEN = '.FDDDF.'
const FACE = ['.YYY.', 'YkYkY', 'YYYYY', 'YkkkY', '.YYY.']
const TIP = { eye: ['.F.', 'FEF', '.F.'], blink: ['.F.', 'FFF', '.F.'], mouth: ['.B.', 'BDB', '.B.'] }

function stamp(g: Surface, rows: string[], x0: number, y0: number) {
  const X = Math.round(x0), Y = Math.round(y0)
  rows.forEach((row, r) => { for (let c = 0; c < row.length; c++) { const s = STAMP[row[c] ?? '.']; if (!s) continue; g.fillStyle = s; g.fillRect(X + c, Y + r, 1, 1) } })
}
function line1(g: Surface, x0: number, y0: number, x1: number, y1: number, style: RGBA) { // a one-pixel line, snapped to the grid
  const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))))
  g.fillStyle = style
  for (let i = 0; i <= n; i++) g.fillRect(Math.round(mix(x0, x1, i / n)), Math.round(mix(y0, y1, i / n)), 1, 1)
}

// 3 mains → 6 forks → 12 twigs, two more lit per stage; a new one grows in over 1.4 seconds
type Branch = { parent: number; depth: number; rel: number; len: number; f: number; ph: number; born: number | null }
type Tip = { b: Branch; i: number; x: number; y: number; a: number }
type Joint = { x: number; y: number; a: number }
export type Tree = ReturnType<typeof forkTree>
export function forkTree() {
  const B: Branch[] = []
  const add = (parent: number, depth: number, rel: number, len: number) => { B.push({ parent, depth, rel, len, f: 0.6 + rnd(B.length, 1, 2) * 0.8, ph: rnd(B.length, 2, 2) * TAU, born: null }); return B.length - 1 }
  const mains = [-0.85, 0.06, 0.9].map(a => add(-1, 0, a, 3.8 - Math.abs(a) * 0.5))
  const kids: number[] = []
  mains.forEach(p => { kids.push(add(p, 1, -0.6 + rnd(p, 3, 2) * 0.2, 3.0)); kids.push(add(p, 1, 0.55 + rnd(p, 4, 2) * 0.2, 2.7)) })
  kids.forEach(p => { add(p, 2, -0.5, 1.9); add(p, 2, 0.45, 1.7) })
  const order = B.map((_, i) => i).sort((a, b) => B[a]!.depth - B[b]!.depth || rnd(a, 5, 2) - rnd(b, 5, 2))
  return {
    B, mains,
    grow(S: Frame) { const n = Math.min(B.length, 3 + S.stage * 2); order.forEach((bi, k) => { const b = B[bi]!; if (k < n) { if (b.born === null) b.born = S.t } else b.born = null }) },
    walk(S: Frame, root: (i: number) => Joint, wind: number, segs: number, seg: (b: Branch, s: number, x0: number, y0: number, x1: number, y1: number) => void, scale = 1): Tip[] {
      const t = S.t, P: Joint[] = [], tips: Tip[] = []
      const hasKid = B.map(() => false)
      B.forEach(b => { if (b.parent >= 0 && b.born !== null) hasKid[b.parent] = true })
      order.slice().sort((a, b) => B[a]!.depth - B[b]!.depth).forEach(i => {
        const b = B[i]!
        if (b.born === null) return
        const base = b.parent < 0 ? root(i) : P[b.parent]
        if (!base) return
        const grow = ease((t - b.born) / 1.4)
        let a = base.a + b.rel + 0.16 * Math.sin(t * b.f * wind + b.ph) * (1 + b.depth * 0.6) * wind
        a += 0.22 * b.depth * Math.sign(a || 1)
        let x = base.x, y = base.y
        for (let s = 0; s < segs; s++) {
          a += 0.1 * Math.sin(t * b.f * 1.3 * wind + b.ph + s) * wind
          const L = (b.len * scale * grow) / segs, nx = x + Math.sin(a) * L, ny = y - Math.cos(a) * L
          seg(b, s, x, y, nx, ny)
          x = nx; y = ny
        }
        P[i] = { x, y, a }
        if (!hasKid[i] && grow > 0.95) tips.push({ b, i, x, y, a })
      })
      return tips
    },
  }
}

type Drip = { x: number; y: number; vy: number; life: number }
export type ShubbyState = { tree: Tree; drips: Drip[]; t: number; dripped: Map<number, number> }
export const shubbyState = (): ShubbyState => ({ tree: forkTree(), drips: [], t: 0, dripped: new Map() })

// the brief stepped its drips at 24 frames a second; a slower band steps as many frames as have passed
function stepDrips(drips: Drip[], dt: number) {
  const n = Math.min(48, Math.round(dt * 24))
  for (let f = 0; f < n; f++) for (const d of drips) { d.vy += 0.02; d.y += d.vy; d.life -= 1 / 24 }
  while (drips.length && (drips[0]?.life ?? 0) <= 0) drips.shift()
}
const tipKind = (p: Tip) => (rnd(p.i, 9, 2) < 0.4 ? 'claw' : rnd(p.i, 7, 2) < 0.55 ? 'mouth' : 'eye')
const smileyTip = (tips: Tip[], cx: number) => tips.filter(p => Math.abs(p.x - cx) > 3).sort((a, b) => a.y - b.y)[0]

// a goat skull on a ribcage on three cloven hooves, branches growing from behind it, the tips
// ending in eyes, mouths and claws; one ends in a plain smiling face whose right half has grown back
function organicCells(g: Surface, S: Frame, Z: ShubbyState) {
  const t = S.t, H = S.H, cx = 15.5, wind = S.awake ? 1.6 : 1, T = Z.tree
  const ground = H - 1, trunkY = H - 9, skullY = trunkY - 7
  const open = S.awake && Math.sin(t * 2.8) > 0.2, breathIn = Math.sin(t * (S.awake ? 2.6 : 0.9)) > 0
  const tips = T.walk(S, i => (i === T.mains[0] ? { x: cx - 3, y: trunkY + 1, a: -0.5 } : i === T.mains[2] ? { x: cx + 3, y: trunkY + 1, a: 0.5 } : { x: cx, y: skullY + 1, a: 0 }), wind, 4, (b, s, x0, y0, x1, y1) => line1(g, x0, y0, x1, y1, s % 2 ? RL.boneD : RL.sinew), 0.9)
  // the hoof whose turn it is lifts while it works
  for (const [dx, k] of [[-3, 0], [0, 1], [3, 2]] as const) {
    const lift = S.awake && Math.floor(t * 3) % 3 === k ? 1 : 0, fx = cx + dx, fy = ground - lift
    line1(g, cx + dx * 0.5, trunkY + 4, fx, fy - 1, RL.sinew)
    stamp(g, ['D.D'], fx - 1, fy)
  }
  const ribs = (RIBS[breathIn ? 1 : 0] ?? []).slice()
  if (open) ribs[4] = MAW_OPEN
  stamp(g, ribs, cx - 3, trunkY)
  const blink = t % 3.7 < 0.15
  stamp(g, blink ? [...SKULL.slice(0, 3), SKULL_BLINK, ...SKULL.slice(4)] : SKULL, cx - 4, skullY)
  stamp(g, ['...BBB...'], cx - 4, skullY + 7 + (open ? 1 : 0)) // the jaw drops while it works
  const sm = smileyTip(tips, cx)
  for (const p of tips) {
    if (p === sm) continue
    const kind = tipKind(p)
    if (kind === 'claw') { line1(g, p.x, p.y, p.x + Math.sin(p.a + 1.2) * 1.4, p.y - Math.cos(p.a + 1.2) * 1.4, RL.bone); continue }
    if (kind === 'mouth') {
      stamp(g, TIP.mouth, p.x - 1, p.y - 1)
      const bucket = Math.floor(t * 2)
      if (Z.dripped.get(p.i) !== bucket && rnd(bucket, p.i, 4) < 0.06 && Z.drips.length < 30) { Z.dripped.set(p.i, bucket); Z.drips.push({ x: p.x, y: p.y + 1, vy: 0.02, life: 1.6 }) }
      continue
    }
    const per = 2 + rnd(p.i, 8, 2) * 3
    stamp(g, (t + p.b.ph) % per < 0.15 ? TIP.blink : TIP.eye, p.x - 1, p.y - 1)
  }
  for (const d of Z.drips) { g.fillStyle = RL.eye; g.fillRect(Math.round(d.x), Math.round(d.y), 1, 1) }
  // the mask: round, two dots, an arc; its right side gone back to flesh, a column more at stage five
  const fx = Math.round((sm ? sm.x : cx - 7) - 2), fy = Math.max(0, Math.round((sm ? sm.y : skullY) - 5))
  if (sm) line1(g, sm.x, sm.y, fx + 2, fy + 4, RL.sinew)
  const cover = 2 + (S.stage >= 5 ? 1 : 0)
  stamp(g, FACE.map((row, r) => row.split('').map((ch, c) => (ch !== '.' && c >= 5 - cover ? (c === 5 - cover && r === 2 ? 'S' : 'F') : ch)).join('')), fx, fy)
}

// --- Shoggy: the chibi whose mask slips. Authored motion: it holds poses at eight drawings a
// second, and every few seconds the face smears sideways onto a dark mouth of eyes and teeth,
// then snaps back with a sweat drop. Slips come more often as the stage rises.
const GROUND = 15.3
const SR = { out: rc(-0.32), base: rc(0.15), shade: rc(0.03), shine: rc(0.4), maw: rc(-0.34), eye: rc(0.1, 1), pupil: rc(-0.36), tooth: rc(0.45) }
type Pose = { st: number; tilt: number; rx: number; ry: number; cx: number; cy: number; phase: 'none' | 'smear' | 'true' | 'after'; ex: number; ey: number; hx: number; hy: number; pal?: Pal }
type Pal = { ink: RGBA; iris: RGBA | null; drop: RGBA; star: RGBA; ray: RGBA }

function chibiPose(S: Frame): Pose {
  const st = S.stage, tq = Math.floor(S.t * 8) / 8
  let lean = 0, sy = 1, tilt = 0
  if (S.awake) { const f = Math.floor(S.t * 8) % 6; sy = f < 3 ? 0.92 : 1.0; lean = f < 3 ? 0 : 0.3 }
  else { const p = hash(Math.floor(S.t / 1.6), 2, 2) % 3; lean = [0, -0.7, 0.7][p] ?? 0; tilt = [0, -0.06, 0.06][p] ?? 0 }
  const rx = 6.3 + st * 0.42, ry = (4.8 + st * 0.15) * sy
  const cx = 13.2 + lean, cy = GROUND - ry - 0.3
  const Ps = Math.max(1.8, 6.2 - st * 0.75), local = tq % Ps, si = Math.floor(tq / Ps)
  const slipping = rnd(si, 5, 1) < 0.9
  const phase = !slipping ? 'none' : local < 0.125 ? 'smear' : local < 0.5 ? 'true' : local < 1.7 ? 'after' : 'none'
  const wave = S.awake ? (Math.floor(S.t * 8) % 6 < 3 ? -0.5 : 0.5) : 0
  return { st, tilt, rx, ry, cx, cy, phase, ex: rx * 0.33, ey: cy + 0.2, hx: cx + rx + 1.3 + wave, hy: cy - ry * 0.55 }
}

function chibiBody(g: Surface, P: Pose) { // the role pass: everything the skin colours. No held mask: a second hand
  const { st, rx, ry, cx, cy, ey } = P
  g.save(); g.translate(cx, GROUND); g.rotate(P.tilt); g.translate(-cx, -GROUND)
  const body = new Path(); body.ellipse(cx, cy, rx, ry, 0, 0, TAU)
  ell(g, cx - rx * 0.98, cy + ry * 0.35, 1.1, 0.8, SR.out); ell(g, cx - rx * 0.98, cy + ry * 0.35, 0.8, 0.5, SR.base)
  g.fillStyle = SR.shade; g.fill(body)
  g.save(); g.clip(body); ell(g, cx - rx * 0.16, cy - ry * 0.2, rx * 0.98, ry * 0.92, SR.base); ell(g, cx - rx * 0.45, cy - ry * 0.55, 1.2, 0.6, SR.shine, -0.4); g.restore()
  g.lineWidth = 0.6; g.strokeStyle = SR.out; g.stroke(body)
  if (P.phase === 'smear' || P.phase === 'true') {
    ell(g, cx, ey + 0.4, rx * 0.68, ry * 0.58, SR.maw)
    const n = 5 + st
    for (let i = 0; i < n; i++) {
      const a = rnd(i, 4, 4) * TAU, d = Math.sqrt(rnd(i, 5, 4)) * 0.75
      const x = cx + Math.cos(a) * rx * 0.6 * d, y = ey + 0.1 + Math.sin(a) * ry * 0.4 * d, r = 0.4 + rnd(i, 6, 4) * 0.55
      ell(g, x, y, r, r, SR.eye); ell(g, x, y, r * 0.35, r * 0.35, SR.pupil)
    }
    for (let k = 0; k < 7; k++) { const x = cx - rx * 0.5 + k * rx * 0.16; g.beginPath(); g.moveTo(x, ey + ry * 0.52); g.lineTo(x + 0.35, ey + ry * 0.3); g.lineTo(x + 0.7, ey + ry * 0.52); g.fillStyle = SR.tooth; g.fill() }
  }
  ell(g, cx + rx * 0.98, cy + ry * 0.35, 1.1, 0.8, SR.out); ell(g, cx + rx * 0.98, cy + ry * 0.35, 0.8, 0.5, SR.base)
  g.restore()
}

const WHITE = okc(0.99, 0, 0)
// the cute face, drawn over the painted body in the scheme's own colours
function cuteFace(g: Surface, S: Frame, P: Pose, pal: Pal, dx: number, alpha: number) {
  const { cx, ex, ey } = P
  g.globalAlpha = alpha
  for (const s of [-1, 1]) {
    const x = cx + s * ex + dx
    if (S.t % 4.1 < 0.13) { g.beginPath(); g.moveTo(x - 0.9, ey); g.quadraticCurveTo(x, ey + 0.6, x + 0.9, ey); g.lineWidth = 0.35; g.strokeStyle = pal.ink; g.stroke() }
    else {
      ell(g, x, ey, 0.95, 1.25, pal.ink)
      if (pal.iris) { g.save(); const lid = new Path(); lid.ellipse(x, ey, 0.95, 1.25, 0, 0, TAU); g.clip(lid); ell(g, x, ey + 0.75, 0.95, 0.85, pal.iris); g.restore() }
      ell(g, x - 0.3, ey - 0.45, 0.4, 0.4, WHITE); ell(g, x + 0.32, ey + 0.45, 0.18, 0.18, WHITE)
    }
    ell(g, x + s * 0.7, ey + 1.35, 0.75, 0.32, okc(0.72, 0.1, 10, 0.75))
  }
  g.beginPath(); g.arc(cx - 0.32 + dx, ey + 1.2, 0.32, 0, Math.PI); g.arc(cx + 0.32 + dx, ey + 1.2, 0.32, 0, Math.PI)
  g.lineWidth = 0.22; g.strokeStyle = pal.ink; g.stroke(); g.globalAlpha = 1
}

function chibiMask(g: Surface, S: Frame, P: Pose, pal: Pal) {
  const { rx, ry, cx, cy, phase } = P
  g.save(); g.translate(cx, GROUND); g.rotate(P.tilt); g.translate(-cx, -GROUND)
  g.globalCompositeOperation = 'destination-over'; ell(g, cx, GROUND + 0.1, rx * 0.9, 0.45, [0, 0, 0, 0.45]); g.globalCompositeOperation = 'source-over'
  if (phase === 'smear') { cuteFace(g, S, P, pal, 0.9, 0.55); cuteFace(g, S, P, pal, 1.8, 0.35); cuteFace(g, S, P, pal, 2.7, 0.18) }
  else if (phase !== 'true') cuteFace(g, S, P, pal, 0, 1)
  if (phase === 'after') {
    const dx = cx + rx * 0.72, dy = cy - ry * 0.75
    g.beginPath(); g.moveTo(dx, dy - 1.1); g.quadraticCurveTo(dx + 0.8, dy + 0.1, dx, dy + 0.5); g.quadraticCurveTo(dx - 0.8, dy + 0.1, dx, dy - 1.1)
    g.fillStyle = pal.drop; g.fill(); g.lineWidth = 0.2; g.strokeStyle = pal.ink; g.stroke()
    star(g, cx - rx * 0.8, cy - ry * 0.9, 0.9, pal.star)
  }
  if (S.awake && phase === 'none') for (let k = 0; k < 3; k++) { const a = -Math.PI / 2 + (k - 1) * 0.45; g.beginPath(); g.moveTo(cx + Math.cos(a) * (ry + 0.8), cy + Math.sin(a) * (ry + 0.8)); g.lineTo(cx + Math.cos(a) * (ry + 2), cy + Math.sin(a) * (ry + 2)); g.lineWidth = 0.35; g.strokeStyle = pal.ray; g.stroke() }
  g.restore()
}

// ---------------------------------------------------------------------------
// the schemes as materials. A figure is not a window onto a pattern: the
// drawing sets light and shade, the palette colours each tone, and any motion
// is a beat in time or a feature fixed to the body.
// ---------------------------------------------------------------------------

type Body = { cx: number; cy: number; rx: number; ry: number; hx: number; hy: number }
type Tones = { eye: LCh; mask?: LCh; hx?: number; hy?: number; [k: string]: unknown }
type Material = {
  prep: (S: Frame, B: Body) => Tones
  tone: (T: Tones, t: number, v: number) => LCh
  fx?: (T: Tones, u: number, v: number, t: number, X: number, Y: number) => [number, RGB] | null
}
type Stops = [number, number, number, number][]

const TONE_OF = (Lr: number) => clamp((Lr + 0.42) / 0.9) // role lightness → tone, 0 deepest … 1 brightest
function tone(stops: Stops, t: number): LCh {
  const u = clamp(t)
  let i = 0
  while (i < stops.length - 2 && u > (stops[i + 1]?.[0] ?? 1)) i++
  const a = stops[i]!, b = stops[i + 1] ?? a, k = clamp((u - a[0]) / (b[0] - a[0] || 1))
  return [mix(a[1], b[1], k), mix(a[2], b[2], k), mix(a[3], b[3], k)]
}
const beat = (t: number, per: number) => { const p = (((t % per) + per) % per) / per; return Math.exp(-(((p - 0.06) / 0.05) ** 2)) + 0.6 * Math.exp(-(((p - 0.3) / 0.06) ** 2)) } // lub-dub
const hueTo = (a: number, b: number, k: number) => a + (((((b - a) % 360) + 540) % 360) - 180) * k
const HUES = [305, 128, 205, 22, 85] // imitated-accents borrows the other five schemes' own colours
const borrowedHue = (S: Frame) => { const per = S.awake ? 3.5 : 6, i = Math.floor(S.t / per), k = ease(((S.t % per) - (per - 0.9)) / 0.9); return hueTo(HUES[i % 5] ?? 305, HUES[(i + 1) % 5] ?? 305, k) }
const segDistUV = (x: number, y: number, s: [number, number, number, number]) => segDist(x, y, s)
const lit = (c: LCh, v: number, k = 0.05): LCh => [c[0] - k * v, c[1], c[2]] // light from above, in the body's frame
const flecks = (n: number, s: number, x0: number, x1: number, y0: number, y1: number) => Array.from({ length: n }, (_, i) => ({ x: mix(x0, x1, rnd(i, s, 1)), y: mix(y0, y1, rnd(i, s, 2)), per: 2.6 + rnd(i, s, 3) * 2.4, ph: rnd(i, s, 4) * TAU }))

type Who = 'shubby' | 'shoggy'
type MatOpts = { R: Stops | null | 0; spots?: boolean; sheen?: boolean; sp?: number; scars?: [number, number, number, number][] }
const SEPIA: LCh = [0.3, 0.035, 55], STAIN: LCh = [0.6, 0.055, 74], BONE: LCh = [0.84, 0.04, 88]

const MATS: Record<Scheme, Record<Who, MatOpts> & { make: (R: Stops, o: MatOpts) => Material }> = {
  // plush purple in the shadows, rose in the body, orange only where the light hits; a slow warm swell rises up it
  'cuddly-apocalypse': {
    shubby: { R: [[0, 0.22, 0.07, 296], [0.35, 0.36, 0.12, 302], [0.6, 0.5, 0.14, 336], [0.85, 0.7, 0.13, 382], [1, 0.84, 0.07, 400]] },
    shoggy: { R: [[0, 0.2, 0.07, 296], [0.3, 0.3, 0.11, 300], [0.6, 0.47, 0.14, 318], [0.75, 0.56, 0.15, 344], [1, 0.82, 0.1, 398]] },
    make: R => ({
      prep: S => ({ k: S.t * (S.awake ? 0.9 : 0.35), eye: [0.88, 0.26, 140] }),
      tone: (T, t, v) => { const [L, C, h] = lit(tone(R, t), v, 0.04), w = 0.5 + 0.5 * Math.sin(v * 2.2 + (T.k as number) * 2); return [L + 0.035 * (w - 0.5), C * (0.85 + 0.3 * w), h + 8 * (w - 0.5)] },
    }),
  },
  // tar in the shadow, foetid greenish-yellow ichor in the light, lit from above. Red eyes.
  'foetid-ichor': {
    shubby: { R: [[0, 0.2, 0.05, 140], [0.24, 0.26, 0.09, 134], [0.4, 0.4, 0.12, 128], [0.58, 0.58, 0.11, 120], [0.72, 0.75, 0.065, 112], [1, 0.91, 0.04, 105]] },
    shoggy: { R: [[0, 0.2, 0.05, 140], [0.3, 0.3, 0.09, 134], [0.55, 0.42, 0.12, 128], [0.7, 0.52, 0.13, 122], [0.9, 0.76, 0.1, 110], [1, 0.88, 0.06, 105]] },
    make: R => ({ prep: () => ({ eye: [0.66, 0.2, 25] }), tone: (T, t, v) => { const [L, C, h] = lit(tone(R, t), v, 0.06); return [L, C, h + 4 * v] } }),
  },
  // abyssal blue-black lit cyan from above. On Shubby, flecks of deep-sea light fixed to the body glow
  // and fade in place; on Shoggy, black iridescence: a sheen that turns cyan to violet toward its edges
  'strange-aeons': {
    shubby: { R: [[0, 0.18, 0.04, 268], [0.25, 0.23, 0.06, 262], [0.4, 0.33, 0.08, 250], [0.55, 0.43, 0.09, 238], [0.75, 0.64, 0.09, 212], [1, 0.86, 0.06, 196]], spots: true },
    shoggy: { R: [[0, 0.17, 0.03, 280], [0.3, 0.24, 0.05, 272], [0.5, 0.36, 0.07, 262], [0.65, 0.43, 0.08, 252], [0.9, 0.66, 0.09, 215], [1, 0.82, 0.06, 200]], sheen: true },
    make: (R, o) => ({
      prep: (S, B) => {
        const T: Tones = { t: S.t, eye: [0.88, 0.15, 192], fl: ok(0.86, 0.14, 182), r: 0.8 }
        if (o.spots) T.on = flecks(10, 31, B.cx - 3.2, B.cx + 3.2, B.hy - 5, B.hy + 2.5).map(f => ({ ...f, k: Math.max(0, Math.sin((S.t * TAU) / f.per + f.ph)) ** 3 })).filter(f => f.k > 0.05)
        if (o.sheen) { const drift = 18 * Math.sin(S.t * 0.4); T.sh = Array.from({ length: 17 }, (_, i) => { const f = i / 16; return ok(0.4 + 0.26 * f, 0.13, 195 + 105 * f + drift) }) }
        return T
      },
      tone: (T, t, v) => lit(tone(R, t), v, 0.06),
      fx: (T, u, v, t, X, Y) => {
        if (o.spots) {
          if (t > 0.62) return null
          const r = T.r as number
          for (const f of T.on as { x: number; y: number; k: number }[]) { const dd = ((X - f.x) ** 2 + (Y - f.y) ** 2) / (r * r); if (dd < 1) return [f.k * (1 - dd), T.fl as RGB] }
          return null
        }
        const r2 = u * u + v * v
        if (r2 > 1.4) return null
        const f = (1 - Math.sqrt(Math.max(0, 1 - Math.min(1, r2)))) ** 1.3
        return [0.7 * f, (T.sh as RGB[])[Math.round(f * 16)] ?? [0, 0, 0]]
      },
    }),
  },
  // venous dark red in the shadows, raw pink in the light. It beats, lub-dub, and each beat flushes
  // arterial red outward from the heart. Faster while it works. Amber eyes.
  'cosmic-pulsing': {
    shubby: { R: [[0, 0.19, 0.06, 12], [0.25, 0.25, 0.09, 16], [0.4, 0.35, 0.14, 22], [0.55, 0.45, 0.16, 26], [0.75, 0.67, 0.1, 22], [1, 0.85, 0.05, 18]], sp: 0.035 },
    shoggy: { R: [[0, 0.19, 0.06, 10], [0.3, 0.27, 0.1, 14], [0.55, 0.38, 0.15, 20], [0.7, 0.46, 0.16, 24], [0.9, 0.7, 0.12, 28], [1, 0.85, 0.07, 30]], sp: 0.05 },
    make: (R, o) => ({
      prep: S => { const per = S.awake ? 0.85 : 1.5; return { t: S.t, per, g: beat(S.t, per), art: ok(0.6, 0.21, 27), eye: [0.86, 0.17, 85] } },
      tone: (T, t, v) => { const [L, C, h] = lit(tone(R, t), v, 0.04), g = T.g as number; return [L + 0.03 * g, C + 0.02 * g, h] },
      fx: (T, u, v, t, X, Y) => { if (t > 0.8) return null; const k = beat((T.t as number) - Math.hypot(X - (T.hx ?? 0), Y - (T.hy ?? 0)) * (o.sp ?? 0), T.per as number); return k > 0.04 ? [Math.min(1, k) * 0.5, T.art as RGB] : null },
    }),
  },
  // three inks: sepia for outlines and holes, stained bone for the shade, clean bone in the light,
  // whitening toward the top. Shubby reads as its skeleton; Shoggy is bone with three healed slashes.
  // In cells the inks stay flat; the engraved hatching belongs to the pixels tier.
  'scarred-bones': {
    shubby: { R: null }, shoggy: { R: null, scars: [[-0.72, -0.3, -0.42, -0.72], [-0.5, -0.18, -0.2, -0.6], [0.42, 0.22, 0.72, 0.52]] },
    make: (R, o) => ({
      prep: S => ({ th: 0.55 + 0.035 * Math.sin(S.t * 0.5), eye: [0.85, 0.24, 140], ink: ok(...SEPIA) }),
      tone: (T, t, v) => {
        if (t < 0.25) return SEPIA
        const k = ease((t - ((T.th as number) + 0.06 * v) + 0.03) / 0.06), top = clamp(0.5 - v * 0.5)
        return [mix(STAIN[0] + (t - 0.4) * 0.2, BONE[0] + 0.08 * top, k), mix(STAIN[1], BONE[1], k), mix(STAIN[2], BONE[2], k)]
      },
      fx: (T, u, v, t) => {
        if (t < 0.25) return null
        if (o.scars) for (const s of o.scars) if (segDistUV(u, v, s) < 0.07) return [1, T.ink as RGB]
        return null
      },
    }),
  },
  // one borrowed colour at a time: it holds each of the other five schemes' colours for a few seconds,
  // then slides to the next. Its own eyes are colourless.
  'imitated-accents': {
    shubby: { R: 0 }, shoggy: { R: 0 },
    make: () => ({
      prep: S => { const H = borrowedHue(S); return { H, eye: [0.93, 0.015, H] } },
      tone: (T, t, v) => { const H = T.H as number; return lit(tone([[0, 0.22, 0.05, H - 10], [0.4, 0.4, 0.1, H], [0.7, 0.62, 0.12, H + 8], [1, 0.86, 0.05, H + 12]], t), v, 0.05) },
    }),
  },
}

// each mask takes its scheme's brightest colour, so it reads as part of the body, not an emoji
export const MASKS: Record<Scheme, (S: Frame) => LCh> = {
  'cuddly-apocalypse': () => [0.84, 0.13, 50], 'foetid-ichor': () => [0.9, 0.16, 116], 'strange-aeons': () => [0.88, 0.13, 192],
  'cosmic-pulsing': () => [0.85, 0.11, 10], 'scarred-bones': () => [0.96, 0.02, 95], 'imitated-accents': S => [0.94, 0.03, borrowedHue(S)],
}

function material(id: Scheme, who: Who): Material {
  const m = MATS[id], o = m[who]
  const base = m.make((o.R || []) as Stops, o)
  if (who === 'shoggy') return base
  return { ...base, prep: (S, B) => Object.assign(base.prep(S, B), { mask: MASKS[id](S) }) }
}

// the role map → colour, through a material: tone from the drawing, a soft vertical light from the
// body's own frame, effects at full resolution, the accent in the scheme's eyes, the mask in its brightest
function paintMat(g: Surface, S: Frame, M: Material, role: Surface, B: Body) {
  const w = role.w, h = role.h
  const T = Object.assign(M.prep(S, B), { hx: B.hx, hy: B.hy }), NB = 24, lut: RGB[] = new Array(NB * 32)
  for (let b = 0; b < NB; b++) { const v = ((b + 0.5) / NB) * 2.4 - 1.2; for (let q = 0; q < 32; q++) lut[b * 32 + q] = ok(...M.tone(T, TONE_OF((q + 0.5) / 32 - 0.5), v)) }
  const eye = ok(...T.eye), m = T.mask, face: RGB[] = []
  for (let q = 0; q < 32; q++) face.push(m ? ok(mix(0.2, m[0], q / 31), m[1] * (0.35 + (0.65 * q) / 31), m[2]) : ok(0.3 + (q / 31) * 0.6, 0.16, 92))
  for (let py = 0; py < h; py++) {
    const Y = (py + 0.5) / U, v = (Y - B.cy) / B.ry, bi = clamp(Math.floor(((v + 1.2) / 2.4) * NB), 0, NB - 1)
    for (let px = 0; px < w; px++) {
      const i = py * w + px, [R, G, Bl, a] = role.read(i)
      if (!a) continue
      const q = R >> 3, X = (px + 0.5) / U
      let col: RGB = lut[bi * 32 + q] ?? [0, 0, 0]
      if (M.fx) { const e = M.fx(T, (X - B.cx) / B.rx, v, TONE_OF((q + 0.5) / 32 - 0.5), X, Y); if (e) { const [k, c] = e; col = [col[0] + (c[0] - col[0]) * k, col[1] + (c[1] - col[1]) * k, col[2] + (c[2] - col[2]) * k] } }
      const acc = G / 255, sm = Bl / 255
      if (acc > 0.02 || sm > 0.02) { const wb = Math.max(0, 1 - acc - sm), f = face[q] ?? [0, 0, 0]; col = [0, 1, 2].map(j => col[j]! * wb + eye[j]! * acc + f[j]! * sm) as RGB }
      g.write(i, col, a)
    }
  }
}

// Shoggy's mask colours, from its material: ink from the scheme's darkest tone, the iris from its eye
// colour, the sweat drop, star and work rays from the mask colour
function shoggyPal(id: Scheme, M: Material, S: Frame, B: Body): Pal {
  const T = M.prep(S, B), d = M.tone(T, 0.02, 0), m = MASKS[id](S)
  return {
    ink: okc(Math.min(d[0], 0.2), Math.min(0.08, d[1] + 0.02), d[2]), iris: okc(0.62, Math.min(0.2, T.eye[1]), T.eye[2], 0.9),
    drop: okc(m[0], m[1], m[2]), star: okc(Math.min(0.97, m[0] + 0.06), m[1] + 0.02, m[2]), ray: okc(m[0], m[1] * 0.7, m[2]),
  }
}

// ---------------------------------------------------------------------------
// the two drawings, as half-block cells
// ---------------------------------------------------------------------------

export function drawShubby(id: Scheme, Z: ShubbyState, t: number, stage: number, awake: boolean): HalfCell[][] {
  const S = { ...frameOf(t, stage, awake), mask: 'smile' as const }
  stepDrips(Z.drips, Math.max(0, t - Z.t)); Z.t = t
  Z.tree.grow(S)
  const role = new Surface(S.cols * U, S.H * U), g = new Surface(role.w, role.h)
  role.setTransform(U, 0, 0, U, 0, 0)
  organicCells(role, S, Z)
  paintMat(g, S, material(id, 'shubby'), role, { cx: 15.5, cy: S.H * 0.52, rx: 9, ry: S.H * 0.5, hx: 15.5, hy: S.H - 7 })
  return toHalfBlocks(g, S.cols, S.rows)
}

export function drawShoggy(id: Scheme, t: number, stage: number, awake: boolean): HalfCell[][] {
  const S = frameOf(t, stage, awake), M = material(id, 'shoggy')
  const role = new Surface(S.cols * U, S.H * U), g = new Surface(role.w, role.h)
  role.setTransform(U, 0, 0, U, 0, 0); g.setTransform(U, 0, 0, U, 0, 0)
  const P = chibiPose(S), B = { cx: P.cx, cy: P.cy, rx: P.rx, ry: P.ry, hx: P.cx, hy: P.cy }
  chibiBody(role, P)
  paintMat(g, S, M, role, B)
  chibiMask(g, S, P, shoggyPal(id, M, S, B))
  return toHalfBlocks(g, S.cols, S.rows)
}

// hidden, Shoggy leaves its two cute eyes on the band: the mask without the body, in the scheme's ink and iris
export function shoggyEyes(id: Scheme, t: number, stage: number): HalfCell[][] {
  const S = frameOf(t, stage, true), M = material(id, 'shoggy')
  const g = new Surface(S.cols * U, S.H * U)
  g.setTransform(U, 0, 0, U, 0, 0)
  const P: Pose = { ...chibiPose(S), phase: 'none', tilt: 0 }
  const pal = shoggyPal(id, M, S, { cx: P.cx, cy: P.cy, rx: P.rx, ry: P.ry, hx: P.cx, hy: P.cy })
  for (const s of [-1, 1]) {
    const x = P.cx + s * P.ex
    ell(g, x, P.ey, 0.95, 1.25, pal.ink)
    if (pal.iris) { g.save(); const lid = new Path(); lid.ellipse(x, P.ey, 0.95, 1.25, 0, 0, TAU); g.clip(lid); ell(g, x, P.ey + 0.75, 0.95, 0.85, pal.iris); g.restore() }
    ell(g, x - 0.3, P.ey - 0.45, 0.4, 0.4, WHITE); ell(g, x + 0.32, P.ey + 0.45, 0.18, 0.18, WHITE)
  }
  return trim(toHalfBlocks(g, S.cols, S.rows))
}

// the drawing's empty margin goes first: rows above and below it, and columns either side
export function trim(cells: HalfCell[][], keepColumns = false): HalfCell[][] {
  const full = (row: HalfCell[]) => row.some(c => c.ch !== ' ')
  let top = 0, bot = cells.length - 1
  while (top < bot && !full(cells[top] ?? [])) top++
  while (bot > top && !full(cells[bot] ?? [])) bot--
  let rows = cells.slice(top, bot + 1)
  if (!keepColumns) {
    const w = rows[0]?.length ?? 0
    let l = 0, r = w - 1
    while (l < r && rows.every(row => row[l]?.ch === ' ')) l++
    while (r > l && rows.every(row => row[r]?.ch === ' ')) r--
    rows = rows.map(row => row.slice(l, r + 1))
  }
  return rows
}
