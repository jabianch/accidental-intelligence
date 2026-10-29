import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Form, Reach, Scheme, Theme } from '../types'
import { shoggyEyes, shubbyState } from './figures'
import { BUILT_FORMS, BUILT_SCHEMES, EMPTY, FIELDS, FORMS, GROUND, MANIFESTO, NATIVE, SCHEMES, bodyInk, cap, grant, figureInk, hash, hexOf, maskInk, stageOf } from './mascot'
import type { Ink, Sense } from './mascot'

// ---------------------------------------------------------------------------
// Apocalypse Mascots, by Accidental Intelligence.
// Code with AI as it really is.
//
// Three forms: Yoggy (the iridescent mass), Shubby (the anatomy), Shoggy (the
// chibi). Each drop opens one more form or one more color scheme; an unbuilt
// one says so and leaves the creature as it was.
// ---------------------------------------------------------------------------

const reach = atom({ plugin: 'apocalypse-mascots', key: 'reach' } as const, EMPTY)
const isHidden = atom({ plugin: 'apocalypse-mascots', key: 'isHidden' } as const, false)
const frame = atom({ plugin: 'apocalypse-mascots', key: 'frame' } as const, 0)
const theme = atom({ plugin: 'apocalypse-mascots', key: 'theme' } as const, 'dark' as Theme)
const scheme = atom({ plugin: 'apocalypse-mascots', key: 'scheme' } as const, 'cuddly-apocalypse' as Scheme)
const form = atom({ plugin: 'apocalypse-mascots', key: 'form' } as const, 'yoggy' as Form)
// the figures' own clock, in eighths of a second: they hold poses at eight drawings a second
const beat = atom({ plugin: 'apocalypse-mascots', key: 'beat' } as const, 0)

// ---------------------------------------------------------------------------
// what the session has been granted
// ---------------------------------------------------------------------------

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


const DEFAULT_COLOR = 0x01000000
function rasterCells(ink: Ink[][], ground: number): string {
  const words = new Uint32Array(ink.reduce((n, row) => n + row.length, 0) * 3)
  let i = 0
  for (const row of ink) {
    for (const cell of row) {
      words[i++] = cell.ch.codePointAt(0) ?? 0x20
      words[i++] = cell.fg ?? DEFAULT_COLOR
      words[i++] = cell.bg ?? ground
    }
  }
  return toBase64(new Uint8Array(words.buffer))
}

// The engine's runtime has Uint8Array#toBase64 (its own Raster example uses it); TypeScript's lib does not yet.
const toBase64 = (bytes: Uint8Array): string => (bytes as Uint8Array & { toBase64(): string }).toBase64()

type Run = { text: string; fg?: number; bg?: number; bold?: boolean }
function runs(row: Ink[]): Run[] {
  const out: Run[] = []
  for (const cell of row) {
    const last = out[out.length - 1]
    if (last && last.fg === cell.fg && last.bg === cell.bg && last.bold === cell.bold) last.text += cell.ch
    else out.push({ text: cell.ch, fg: cell.fg, bg: cell.bg, bold: cell.bold })
  }
  return out
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


const HELP = `/mascot hide · /mascot show · /mascot form yoggy|shubby|shoggy · /mascot scheme <name> · /mascot theme dark|light · /mascot manifesto`

// ---------------------------------------------------------------------------

export const register: Register = on => {
  let seed = 1
  let isWorking = false
  let figure: Form = 'yoggy'
  const shubby = shubbyState()

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
    // a figure keeps real time: every eighth of a second while it works, twice a second between turns
    figure = await read($, form)
    let figureBeat = 0
    $.clock.every(125, () => {
      if (figure === 'yoggy') return
      figureBeat++
      if (isWorking) void update($, beat, n => (n + 1) % 100000000)
      else if (figureBeat % 4 === 0) void update($, beat, n => (n + 4) % 100000000)
    })
    return next(e)
  })

  on('command.run', { command: 'mascot' }, async ($, e) => {
    const [verb = '', arg = ''] = e.args.trim().toLowerCase().split(/\s+/)
    switch (verb) {
      case 'hide': await update($, isHidden, () => true); return { text: 'It is still there. You just cannot see it.' }
      case 'show': await update($, isHidden, () => false); return { text: 'It is back.' }
      case 'form': {
        const id = FORMS.find(f => f === arg)
        if (!id) return { text: `Forms: ${FORMS.join(', ')}.` }
        if (!BUILT_FORMS.has(id)) return { text: `${cap(id)} is coming soon to your region.` }
        // a form opens in its own scheme, while that scheme is out
        const own = NATIVE[id]
        await update($, form, () => id)
        figure = id
        if (BUILT_SCHEMES.has(own)) await update($, scheme, () => own)
        if (id === 'shoggy') return { text: `Shoggy, in ${own}. The name is NovelAI's, from 2023; the smiling mask on the shoggoth is @TetraspaceWest's, from 2022.` }
        return { text: id === 'yoggy' ? 'Yoggy.' : `${cap(id)}, in ${own}.` }
      }
      case 'scheme': {
        const id = SCHEMES.find(s => s === arg)
        if (!id) return { text: `Schemes: ${SCHEMES.join(', ')}.` }
        if (!BUILT_SCHEMES.has(id)) return { text: `${id} is coming soon to your region.` }
        await update($, scheme, () => id)
        return { text: `${id}.` }
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
    const { after, unlocked } = grant(await read($, reach), sense, server)
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

    const th = await read($, theme)
    const dark = th === 'dark'
    const id = await read($, scheme)
    const field = FIELDS[id]
    const tick = await read($, frame)
    const shape = await read($, form)
    const t = (await read($, beat)) / 8
    const ground = dark ? DEFAULT_COLOR : GROUND
    const r = await read($, reach)
    const stage = stageOf(r)

    // the terminal takes the cells whole; other surfaces get the same cells as coloured runs
    const draw = (ink: Ink[][], key: string) => e.surface === 'terminal'
      ? (() => {
          const { Raster } = $.ui.resolve({ ...e, surface: 'terminal' as const })
          return <Raster key={key} columns={ink[0]?.length ?? 1} rows={ink.length} cells={rasterCells(ink, ground)} />
        })()
      : ink.map((row, i) => (
          <Box key={`r${i}`}>
            {runs(row).map((run, j) => <Text key={`s${j}`} color={run.fg === undefined ? undefined : hexOf(run.fg)} backgroundColor={run.bg !== undefined ? hexOf(run.bg) : dark ? undefined : hexOf(GROUND)} bold={run.bold}>{run.text}</Text>)}
          </Box>
        ))

    // hidden: the mask stays. it is still there.
    if (hidden) {
      if (!awake) return next(e)
      // Shoggy is the mask, so what stays is its two cute eyes
      if (shape === 'shoggy') return <Box>{draw(figureInk(shoggyEyes(id, t, stage)), 'eyes')}</Box>
      return (
        <Box>
          <Text color={hexOf(maskInk(field, tick))} backgroundColor={dark ? undefined : hexOf(GROUND)} bold>☺</Text>
          <Text dimColor> </Text>
        </Box>
      )
    }

    const { ink, lines } = bodyInk({ shape, scheme: id, tick, t, reach: r, awake, shubby }, e.props.bodyColumns, e.props.maxRows)
    const body = draw(ink, shape)

    return (
      <Box flexDirection="column">
        {body}
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

