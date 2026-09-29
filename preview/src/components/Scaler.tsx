import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

export function Scaler({ width, height, children, max = 1 }: { width: number; height: number; children: ReactNode; max?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setScale(Math.min(max, entry.contentRect.width / width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [width, max])

  return (
    <div ref={ref} className="w-full">
      <div style={{ width: width * scale, height: height * scale, margin: '0 auto' }}>
        <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>{children}</div>
      </div>
    </div>
  )
}
