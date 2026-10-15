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

declare module 'claude-code' {
  interface PluginState {
    'apocalypse-mascots': {
      reach: Reach
      isHidden: boolean
      frame: number
      theme: Theme
    }
  }
}
