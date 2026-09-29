import { useCallback, useEffect, useState } from 'react'
import { Pause, Play, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AppMock, MOCK_H, MOCK_W } from '@/components/AppMock'
import { MINI_H, MINI_W, MiniPlayer } from '@/components/MiniPlayer'
import { Scaler } from '@/components/Scaler'
import { skinStyle, type PlayerProps } from '@/components/player'
import { SKINS, TRACKS, type Skin } from '@/data/skins'

type View = 'window' | 'mini' | 'all'

function readHash() {
  const p = new URLSearchParams(window.location.hash.slice(1))
  const skin = Math.max(0, SKINS.findIndex((s) => s.id === p.get('skin')))
  const themeIdx = Math.max(0, SKINS[skin].themes.findIndex((t) => t.id === p.get('theme')))
  const view = (['window', 'mini', 'all'].includes(p.get('view') ?? '') ? p.get('view') : 'window') as View
  return { skin, themeIdx, view }
}

function SkinCard({ skin, active, themeIdx, onClick }: { skin: Skin; active: boolean; themeIdx: number; onClick: () => void }) {
  const theme = skin.themes[themeIdx]
  return (
    <button
      onClick={onClick}
      data-active={active}
      className="group flex w-56 shrink-0 items-center gap-3 rounded-xl border border-white/5 bg-white/[.03] p-2.5 text-left transition hover:border-white/15 hover:bg-white/[.06] data-[active=true]:border-amber-300/60 data-[active=true]:bg-amber-300/[.07] lg:w-full"
    >
      <span
        className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg border border-black/40 text-[11px] font-bold shadow-inner"
        style={{ ...skinStyle(theme, TRACKS[0]), background: 'var(--bg)', color: 'var(--lcd-fg)' }}
      >
        <span className="absolute inset-x-1 bottom-1 flex h-3 items-end gap-[2px]">
          {[5, 9, 12, 8, 11, 6, 4].map((h, i) => (
            <i key={i} className="flex-1 rounded-[1px]" style={{ height: h, background: i > 3 ? 'var(--vis-2)' : 'var(--vis-1)' }} />
          ))}
        </span>
        <span className="relative -mt-3 drop-shadow">{String(skin.num).padStart(2, '0')}</span>
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-zinc-100">{skin.name}</span>
        <span className="block truncate text-xs text-zinc-400">{skin.era}</span>
      </span>
    </button>
  )
}

export default function App() {
  const [initial] = useState(readHash)
  const [skinIdx, setSkinIdx] = useState(initial.skin)
  const [themes, setThemes] = useState<Record<string, number>>({ [SKINS[initial.skin].id]: initial.themeIdx })
  const [view, setView] = useState<View>(initial.view)
  const [trackIdx, setTrackIdx] = useState(0)
  const [pos, setPos] = useState(37)
  const [playing, setPlaying] = useState(true)
  const [animate, setAnimate] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [liked, setLiked] = useState<Record<number, boolean>>({})

  const skin = SKINS[skinIdx]
  const themeIdx = themes[skin.id] ?? 0
  const track = TRACKS[trackIdx]

  useEffect(() => {
    const h = `skin=${skin.id}&theme=${skin.themes[themeIdx].id}&view=${view}`
    if (window.location.hash.slice(1) !== h) window.history.replaceState(null, '', `#${h}`)
  }, [skin, themeIdx, view])

  const next = useCallback(() => {
    setTrackIdx((i) => (i + 1) % TRACKS.length)
    setPos(0)
  }, [])
  const prev = useCallback(() => {
    setTrackIdx((i) => (i - 1 + TRACKS.length) % TRACKS.length)
    setPos(0)
  }, [])

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => {
      setPos((p) => {
        if (p + 0.25 >= TRACKS[trackIdx].dur) {
          setTimeout(next)
          return 0
        }
        return p + 0.25
      })
    }, 250)
    return () => clearInterval(id)
  }, [playing, trackIdx, next])

  const playerFor = (s: Skin): PlayerProps => ({
    skin: s,
    theme: s.themes[themes[s.id] ?? 0],
    track,
    pos,
    playing,
    animate,
    liked: !!liked[track.id],
    onToggle: () => setPlaying((p) => !p),
    onNext: next,
    onPrev: prev,
    onLike: () => setLiked((l) => ({ ...l, [track.id]: !l[track.id] })),
    onSeek: (p) => setPos(Math.max(0, Math.min(track.dur - 1, p))),
    onSelect: (i) => {
      setTrackIdx(i)
      setPos(0)
      setPlaying(true)
    },
  })

  const selectSkin = (i: number) => {
    setSkinIdx(i)
    if (view === 'all') setView('window')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const player = playerFor(skin)

  return (
    <div className="min-h-screen bg-[#0b0b0f] text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(60%_40%_at_20%_0%,rgba(255,196,0,.08),transparent),radial-gradient(40%_30%_at_90%_10%,rgba(120,80,255,.08),transparent)]" />
      <header className="relative mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-4 pt-6 pb-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-amber-300 to-orange-500 text-lg font-black text-black shadow-lg shadow-orange-500/20">
            ♪
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight sm:text-xl">YM Skins — визуализация скинов</h1>
            <p className="text-sm text-zinc-400">12 концептов в стиле Winamp для desktop-приложения «Яндекс Музыка»</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
            <Switch checked={animate} onCheckedChange={setAnimate} />
            Анимации
          </label>
          <Button variant="outline" size="sm" onClick={() => setPlaying((p) => !p)} className="gap-2">
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            {playing ? 'Пауза' : 'Играть'}
          </Button>
        </div>
      </header>

      <div className="relative mx-auto grid max-w-[1500px] gap-6 px-4 pb-10 sm:px-6 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          <div className="mb-2 hidden text-xs font-medium tracking-wider text-zinc-500 uppercase lg:block">Скины · {SKINS.length}</div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
            {SKINS.map((s, i) => (
              <SkinCard key={s.id} skin={s} active={i === skinIdx && view !== 'all'} themeIdx={themes[s.id] ?? 0} onClick={() => selectSkin(i)} />
            ))}
          </div>
        </aside>

        <main className="min-w-0 space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-1 flex items-center gap-2">
                {view === 'all' ? (
                  <Badge variant="secondary">Мини-плееры в стиле Winamp</Badge>
                ) : (
                  <>
                    <Badge variant="secondary">№ {String(skin.num).padStart(2, '0')}</Badge>
                    <Badge variant="outline">{skin.era}</Badge>
                  </>
                )}
              </div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{view === 'all' ? 'Все 12 скинов' : skin.name}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {view !== 'all' && (
                <div className="flex rounded-lg border border-white/10 bg-white/[.03] p-1">
                  {skin.themes.map((t, i) => (
                    <button
                      key={t.id}
                      onClick={() => setThemes((m) => ({ ...m, [skin.id]: i }))}
                      data-active={i === themeIdx}
                      className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-zinc-400 transition hover:text-zinc-100 data-[active=true]:bg-white/10 data-[active=true]:text-zinc-50"
                    >
                      <span
                        className="size-3 rounded-full ring-1 ring-white/20"
                        style={{ ...skinStyle(t, track), background: 'var(--accent)' }}
                      />
                      {t.name}
                    </button>
                  ))}
                </div>
              )}
              <Tabs value={view} onValueChange={(v) => setView(v as View)}>
                <TabsList>
                  <TabsTrigger value="window">Главное окно</TabsTrigger>
                  <TabsTrigger value="mini">Мини-плеер</TabsTrigger>
                  <TabsTrigger value="all">Все 12</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[repeating-conic-gradient(#15151b_0_25%,#101015_0_50%)] bg-[length:24px_24px] p-3 shadow-2xl shadow-black/50 sm:p-6">
            {view === 'window' && (
              <Scaler width={MOCK_W} height={MOCK_H}>
                <AppMock {...player} />
              </Scaler>
            )}
            {view === 'mini' && (
              <Scaler width={MINI_W} height={MINI_H}>
                <MiniPlayer {...player} />
              </Scaler>
            )}
            {view === 'all' && (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {SKINS.map((s, i) => (
                  <button key={s.id} onClick={() => selectSkin(i)} className="group text-left">
                    <div className="transition group-hover:-translate-y-0.5">
                      <Scaler width={MINI_W} height={232}>
                        <MiniPlayer {...playerFor(s)} compact />
                      </Scaler>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between px-1">
                      <span className="text-sm font-semibold">
                        {String(s.num).padStart(2, '0')}. {s.name}
                      </span>
                      <span className="text-xs text-zinc-500">{s.era}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {view !== 'all' && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ['Концепция', skin.concept],
                ['Визуальные элементы', skin.elements],
                ['Анимация', skin.animation],
                ['Визуализатор', skin.visLabel],
              ].map(([title, text]) => (
                <div key={title} className="rounded-xl border border-white/10 bg-white/[.03] p-4">
                  <div className="mb-1.5 text-xs font-medium tracking-wider text-amber-300/80 uppercase">{title}</div>
                  <p className="text-sm leading-relaxed text-zinc-300">{text}</p>
                </div>
              ))}
            </div>
          )}

          <p className="flex items-start gap-2 text-xs leading-relaxed text-zinc-500">
            <Sparkles className="mt-0.5 size-3.5 shrink-0" />
            Интерактивные концепты для согласования дизайна: кнопки плеера, выбор трека в очереди, перемотка и «Нравится» работают. Звук не
            воспроизводится, визуализатор работает на синтезированном сигнале. Интерфейс «Яндекс Музыки» воспроизведён схематично.
          </p>
        </main>
      </div>
    </div>
  )
}
