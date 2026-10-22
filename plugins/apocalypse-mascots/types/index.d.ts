export type Reach = {
  eyes: boolean
  hands: boolean
  shell: boolean
  web: boolean
  elsewhere: string[]
  selves: number
  acts: number
}

export type Form = 'yoggy' | 'shubby' | 'shoggy'
export type Theme = 'dark' | 'light'
export type Scheme = 'cuddly-apocalypse' | 'foetid-ichor' | 'scarred-bones' | 'strange-aeons' | 'imitated-accents' | 'cosmic-pulsing'

declare module 'claude-code' {
  interface PluginState {
    'apocalypse-mascots': {
      reach: Reach
      isHidden: boolean
      frame: number
      theme: Theme
      scheme: Scheme
    }
  }
}

// The engine's runtime has it (its own Raster example uses it); TypeScript's lib does not yet.
declare global {
  interface Uint8Array {
    toBase64(): string
  }
}
