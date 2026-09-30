import type { CSSProperties } from 'react'
import type { Skin, SkinTheme, Track } from '@/data/skins'

export type PlayerProps = {
  skin: Skin
  theme: SkinTheme
  track: Track
  pos: number
  playing: boolean
  animate: boolean
  liked: boolean
  onToggle: () => void
  onNext: () => void
  onPrev: () => void
  onLike: () => void
  onSeek: (pos: number) => void
  onSelect: (index: number) => void
}

export const LCD_FONT: Record<string, string> = {
  classic98: `VT323, 'Pixelify Sans', monospace`,
  chrome: `Orbitron, 'Russo One', sans-serif`,
  hifi: `'Share Tech Mono', 'JetBrains Mono', monospace`,
  vinyl: `'Share Tech Mono', 'JetBrains Mono', monospace`,
  synthwave: `Orbitron, 'Russo One', sans-serif`,
  neon: `'Share Tech Mono', 'JetBrains Mono', monospace`,
  terminal: `VT323, 'Pixelify Sans', monospace`,
  aqua: `'Share Tech Mono', 'JetBrains Mono', monospace`,
  aero: '"Inter Variable", sans-serif',
  arcade: '"Press Start 2P", monospace',
  winter: `VT323, 'Pixelify Sans', monospace`,
  adaptive: '"Inter Variable", sans-serif',
  tarkov: `'Share Tech Mono', 'Inter Variable', monospace`,
  tanks: `'Russo One', 'Inter Variable', sans-serif`,
  original: '"Inter Variable", sans-serif',
}

export function skinStyle(theme: SkinTheme, track: Track): CSSProperties {
  return { ...theme.vars, '--c1': track.c1, '--c2': track.c2 } as CSSProperties
}

export const coverStyle = (track: Track): CSSProperties => ({
  background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,.35), transparent 45%), linear-gradient(135deg, ${track.c1}, ${track.c2})`,
})
