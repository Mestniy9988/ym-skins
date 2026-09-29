import { useEffect, useRef } from 'react'
import type { VisMode } from '@/data/skins'

type Props = {
  mode: VisMode
  playing: boolean
  animate: boolean
  bands?: number
  className?: string
  font?: string
}

const clamp = (v: number) => Math.max(0, Math.min(1, v))

function synth(t: number, n: number, out: Float32Array) {
  const beat = Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * 1.05)), 8)
  for (let i = 0; i < n; i++) {
    const x = i / Math.max(1, n - 1)
    const env = 0.9 * Math.exp(-x * 1.5) + 0.14
    const wobble = 0.5 + 0.5 * Math.sin(t * (1.9 + i * 0.41) + i * 1.7) * Math.sin(t * (0.8 + i * 0.13) + i * 0.6)
    const kick = x < 0.3 ? beat * 0.45 * (1 - x / 0.3) : beat * 0.12
    out[i] = clamp(env * (0.3 + 0.7 * wobble) + kick)
  }
}

function readColors(el: HTMLElement) {
  const cs = getComputedStyle(el)
  const g = (k: string, d: string) => cs.getPropertyValue(k).trim() || d
  return {
    c1: g('--vis-1', '#0f0'),
    c2: g('--vis-2', '#ff0'),
    c3: g('--vis-3', '#f00'),
    peak: g('--peak', '#fff'),
    text: g('--text', '#fff'),
  }
}

export function Visualizer({ mode, playing, animate, bands = 24, className, font }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const state = useRef({ playing, animate })
  useEffect(() => {
    state.current = { playing, animate }
  }, [playing, animate])

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const levels = new Float32Array(bands)
    const peaks = new Float32Array(bands)
    const target = new Float32Array(bands)
    let colors = readColors(canvas)
    let lastColorRead = 0
    let raf = 0
    let t = Math.random() * 10
    let prev = performance.now()
    let vuL = 0
    let vuR = 0

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      const dt = Math.min(0.05, (now - prev) / 1000)
      prev = now
      const { playing, animate } = state.current
      if (now - lastColorRead > 150) {
        colors = readColors(canvas)
        lastColorRead = now
      }
      const dpr = window.devicePixelRatio || 1
      const W = canvas.clientWidth
      const H = canvas.clientHeight
      if (!W || !H) return
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
        canvas.width = Math.round(W * dpr)
        canvas.height = Math.round(H * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)

      if (animate) t += dt
      if (playing) synth(animate ? t : 3.3, bands, target)
      else target.fill(0)
      for (let i = 0; i < bands; i++) {
        const k = target[i] > levels[i] ? 0.5 : 0.12
        levels[i] += (target[i] - levels[i]) * (animate ? k : 1)
        if (levels[i] >= peaks[i]) peaks[i] = levels[i]
        else peaks[i] = Math.max(0, peaks[i] - (animate ? dt * 0.45 : 0))
      }
      const { c1, c2, c3, peak } = colors

      if (mode === 'spectrum') {
        const bw = W / bands
        const seg = 3
        const segs = Math.floor(H / seg)
        for (let i = 0; i < bands; i++) {
          const h = Math.round(levels[i] * segs)
          for (let s = 0; s < h; s++) {
            const f = s / segs
            ctx.fillStyle = f < 0.55 ? c1 : f < 0.8 ? c2 : c3
            ctx.fillRect(i * bw + 1, H - (s + 1) * seg, bw - 2, seg - 1)
          }
          ctx.fillStyle = peak
          ctx.fillRect(i * bw + 1, H - Math.round(peaks[i] * segs) * seg - 2, bw - 2, 1.5)
        }
      } else if (mode === 'bars') {
        const bw = W / bands
        const grad = ctx.createLinearGradient(0, H, 0, 0)
        grad.addColorStop(0, c1)
        grad.addColorStop(0.65, c2)
        grad.addColorStop(1, c3)
        ctx.shadowColor = c2
        ctx.shadowBlur = 8
        for (let i = 0; i < bands; i++) {
          const h = Math.max(2, levels[i] * (H - 4))
          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.roundRect(i * bw + bw * 0.18, H - h, bw * 0.64, h, Math.min(4, bw * 0.3))
          ctx.fill()
          ctx.fillStyle = peak
          ctx.fillRect(i * bw + bw * 0.18, H - peaks[i] * (H - 4) - 3, bw * 0.64, 2)
        }
        ctx.shadowBlur = 0
      } else if (mode === 'scope') {
        const amp = levels.reduce((a, b) => a + b, 0) / bands
        ctx.lineWidth = 2
        ctx.shadowBlur = 12
        for (const [color, phase, scale] of [
          [c2, 1.3, 0.6],
          [c1, 0, 1],
        ] as const) {
          ctx.strokeStyle = color
          ctx.shadowColor = color
          ctx.beginPath()
          for (let x = 0; x <= W; x += 2) {
            const p = x / W
            const y =
              H / 2 +
              (Math.sin(p * 18 + t * 9 + phase) * 0.55 + Math.sin(p * 47 - t * 13) * 0.3 + Math.sin(p * 7 + t * 3) * 0.25) *
                amp *
                (H * 0.42) *
                scale
            if (x === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
          }
          ctx.stroke()
        }
        ctx.shadowBlur = 0
      } else if (mode === 'vu') {
        const half = Math.floor(bands / 2)
        const lTarget = levels.slice(0, half).reduce((a, b) => a + b, 0) / half
        const rTarget = levels.slice(half).reduce((a, b) => a + b, 0) / (bands - half)
        vuL += (Math.min(1, lTarget * 1.5) - vuL) * 0.25
        vuR += (Math.min(1, rTarget * 1.9) - vuR) * 0.25
        const gap = 10
        const mw = (W - gap) / 2
        ;[vuL, vuR].forEach((v, idx) => {
          const x0 = idx * (mw + gap)
          ctx.fillStyle = c1
          ctx.beginPath()
          ctx.roundRect(x0, 0, mw, H, 6)
          ctx.fill()
          const cx = x0 + mw / 2
          const cy = H * 1.05
          const r = H * 0.82
          const a0 = -Math.PI * 0.78
          const a1 = -Math.PI * 0.22
          ctx.lineWidth = 2
          for (let s = 0; s <= 10; s++) {
            const a = a0 + ((a1 - a0) * s) / 10
            ctx.strokeStyle = s >= 8 ? c3 : c2
            ctx.beginPath()
            ctx.moveTo(cx + Math.cos(a) * r * 0.86, cy + Math.sin(a) * r * 0.86)
            ctx.lineTo(cx + Math.cos(a) * r * (s % 2 ? 0.93 : 0.97), cy + Math.sin(a) * r * (s % 2 ? 0.93 : 0.97))
            ctx.stroke()
          }
          ctx.strokeStyle = c3
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.arc(cx, cy, r * 0.9, a0 + (a1 - a0) * 0.8, a1)
          ctx.stroke()
          ctx.fillStyle = c2
          ctx.font = `600 ${Math.max(8, H * 0.13)}px ${font ?? 'sans-serif'}`
          ctx.textAlign = 'center'
          ctx.fillText(idx ? 'R' : 'L', cx, H * 0.62)
          ctx.fillText('VU', cx, H * 0.8)
          const a = a0 + (a1 - a0) * v
          ctx.strokeStyle = c2
          ctx.lineWidth = 1.6
          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.lineTo(cx + Math.cos(a) * r * 0.98, cy + Math.sin(a) * r * 0.98)
          ctx.stroke()
        })
      } else if (mode === 'ascii') {
        const fs = Math.max(8, Math.min(16, H / 8))
        ctx.font = `${fs}px ${font ?? 'monospace'}`
        ctx.textBaseline = 'bottom'
        const cw = ctx.measureText('█').width || fs * 0.6
        const cols = Math.floor(W / cw)
        const rows = Math.floor(H / fs)
        for (let c = 0; c < cols; c++) {
          const bi = Math.floor((c / cols) * bands)
          const h = levels[bi] * rows
          for (let r = 0; r < rows; r++) {
            const fill = h - r
            if (fill <= 0) break
            ctx.fillStyle = r > rows * 0.75 ? c3 : r > rows * 0.5 ? c2 : c1
            ctx.fillText(fill > 0.66 ? '█' : fill > 0.33 ? '▓' : '░', c * cw, H - r * fs)
          }
          const pr = Math.round(peaks[bi] * rows)
          ctx.fillStyle = peak
          ctx.fillText('▀', c * cw, H - pr * fs)
        }
      } else if (mode === 'blocks') {
        const bw = W / bands
        const size = Math.max(4, Math.floor(bw - 2))
        const rows = Math.floor(H / (size + 2))
        for (let i = 0; i < bands; i++) {
          const h = Math.round(levels[i] * rows)
          for (let r = 0; r < h; r++) {
            ctx.fillStyle = r > rows * 0.75 ? c3 : r > rows * 0.45 ? c2 : c1
            ctx.fillRect(Math.round(i * bw + 1), H - (r + 1) * (size + 2), size, size)
          }
          const pr = Math.round(peaks[i] * rows)
          ctx.fillStyle = peak
          ctx.fillRect(Math.round(i * bw + 1), H - (pr + 1) * (size + 2), size, size)
        }
      }
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [mode, bands, font])

  return <canvas ref={ref} className={className} style={{ display: 'block', width: '100%', height: '100%' }} />
}
