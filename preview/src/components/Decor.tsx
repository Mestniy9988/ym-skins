import { useMemo } from 'react'

function Snow({ count = 60 }: { count?: number }) {
  const flakes = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: (i * 37.7) % 100,
        size: 2 + ((i * 13) % 5),
        dur: 7 + ((i * 7) % 9),
        delay: -((i * 1.3) % 14),
        drift: ((i % 7) - 3) * 12,
      })),
    [count],
  )
  return (
    <div className="dc-snow" aria-hidden>
      {flakes.map((f, i) => (
        <i
          key={i}
          style={{
            left: `${f.left}%`,
            width: f.size,
            height: f.size,
            animationDuration: `${f.dur}s`,
            animationDelay: `${f.delay}s`,
            ['--drift' as string]: `${f.drift}px`,
          }}
        />
      ))}
    </div>
  )
}

function Garland({ count = 34 }: { count?: number }) {
  const colors = ['#ff5a5a', '#ffd34d', '#4dd2ff', '#7dff8a', '#ff8af2']
  return (
    <div className="dc-garland" aria-hidden>
      <svg className="dc-garland-wire" viewBox="0 0 100 10" preserveAspectRatio="none">
        <path d="M0 2 Q 5 9 10 2 T 20 2 T 30 2 T 40 2 T 50 2 T 60 2 T 70 2 T 80 2 T 90 2 T 100 2" />
      </svg>
      {Array.from({ length: count }, (_, i) => (
        <i
          key={i}
          style={{
            left: `${(i + 0.5) * (100 / count)}%`,
            top: i % 2 ? 11 : 5,
            background: colors[i % colors.length],
            color: colors[i % colors.length],
            animationDelay: `${(i % 4) * 0.25}s`,
          }}
        />
      ))}
    </div>
  )
}

export function Decor({ skinId }: { skinId: string }) {
  switch (skinId) {
    case 'winter':
      return (
        <>
          <Snow />
          <Garland />
        </>
      )
    case 'terminal':
      return <div className="dc-crt" aria-hidden />
    case 'aero':
      return (
        <div className="dc-blobs" aria-hidden>
          <i />
          <i />
          <i />
        </div>
      )
    case 'neon':
      return <div className="dc-cybergrid" aria-hidden />
    case 'chrome':
      return <div className="dc-sheen" aria-hidden />
    default:
      return null
  }
}

export { Snow }
