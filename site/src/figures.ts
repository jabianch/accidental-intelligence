// The figures on the page: Shubby and Shoggy, drawn by the plugin's own code (hooks/figures.ts), so
// the site and the terminal cannot drift apart. Each <pre data-figure> gets one, awake, at stage four;
// a scheme swatch repaints it through window.Mascots, as it does Yoggy.
import { drawShoggy, drawShubby, shubbyState } from '../../plugins/apocalypse-mascots/hooks/figures'
import type { HalfCell, RGB } from '../../plugins/apocalypse-mascots/hooks/figures'
import type { Scheme } from '../../plugins/apocalypse-mascots/types'

const css = (c: RGB) => `rgb(${c[0]},${c[1]},${c[2]})`
function html(cells: HalfCell[][]): string {
  return cells.map(row => row.map(c => c.ch === ' ' ? ' ' : `<span style="color:${css(c.fg!)}${c.bg ? `;background:${css(c.bg)}` : ''}">${c.ch}</span>`).join('')).join('\n')
}

type Figure = { setScheme(id: string): void; setAwake(a: boolean): void; setStage(s: number): void; setHidden(h: boolean): void }
declare global { interface Window { Mascots?: { creatures: Figure[]; scheme?: string } } }

for (const el of document.querySelectorAll<HTMLElement>('pre[data-figure]')) {
  const form = el.dataset.figure, st = { scheme: (window.Mascots?.scheme ?? el.dataset.scheme) as Scheme, stage: 4, awake: true, hidden: false, beat: 0 }
  const shubby = shubbyState()
  const render = () => {
    const t = st.beat / 8
    el.innerHTML = st.hidden ? '' : `<span>${html(form === 'shubby' ? drawShubby(st.scheme, shubby, t, st.stage, st.awake) : drawShoggy(st.scheme, t, st.stage, st.awake))}</span>`
  }
  // eight drawings a second while it works, as in the terminal; it only draws while it is on screen
  let visible = false
  new IntersectionObserver(es => { visible = !!es[0]?.isIntersecting }).observe(el)
  setInterval(() => { if (!visible) return; st.beat += st.awake ? 1 : 0.25; render() }, 125)
  render()
  window.Mascots?.creatures.push({
    setScheme(id) { st.scheme = id as Scheme; render() },
    setAwake(a) { st.awake = a; render() },
    setStage(s) { st.stage = s; render() },
    setHidden(h) { st.hidden = h; render() },
  })
}
