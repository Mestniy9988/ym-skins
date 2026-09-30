import { useCallback, useEffect, useState } from 'react'
import { MousePointerClick, Pause, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { AppMock, MOCK_H, MOCK_W, type Page } from '@/components/AppMock'
import { Scaler } from '@/components/Scaler'
import { ORIGINAL, SKINS, TRACKS, themeAt } from '@/data/skins'

type Example = { skin: string; theme: number; page: Page; title: string; caption: string; query?: string }

const EXAMPLES: Example[] = [
  { skin: 'vinyl', theme: 0, page: 'wave', title: 'Vinyl Turntable', caption: 'Моя волна' },
  { skin: 'classic98', theme: 0, page: 'music', title: "Classic '98", caption: 'Моя музыка' },
  { skin: 'neon', theme: 0, page: 'search', title: 'Neon Cyber', caption: 'Поиск трека', query: 'ноч' },
  { skin: 'aqua', theme: 0, page: 'settings', title: 'Aqua Jelly', caption: 'Настройки и выбор скина' },
]
const PAGES: Page[] = ['wave', 'music', 'search', 'settings']

function readHash() {
  const p = new URLSearchParams(window.location.hash.slice(1))
  const ex = Math.min(EXAMPLES.length, Math.max(1, Number(p.get('ex')) || 1)) - 1
  const base = EXAMPLES[ex]
  const skinIdx = SKINS.findIndex((s) => s.id === (p.get('skin') ?? base.skin))
  const skin = skinIdx >= 0 ? skinIdx : SKINS.findIndex((s) => s.id === base.skin)
  const themeIdx = Math.max(0, SKINS[skin].themes.findIndex((t) => t.id === p.get('theme')))
  const page = (PAGES.includes(p.get('page') as Page) ? p.get('page') : base.page) as Page
  return { ex, skin, themeIdx: p.get('theme') ? themeIdx : base.theme, page, original: p.get('original') === '1', query: p.get('q') ?? base.query ?? '', embed: p.get('embed') === '1' }
}

export default function App() {
  const [initial] = useState(readHash)
  const [example, setExample] = useState(initial.ex)
  const [skinIdx, setSkinIdx] = useState(initial.skin)
  const [themeIdx, setThemeIdx] = useState(initial.themeIdx)
  const [original, setOriginal] = useState(initial.original)
  const [page, setPage] = useState<Page>(initial.page)
  const [query, setQuery] = useState(initial.query)
  const [trackIdx, setTrackIdx] = useState(0)
  const [pos, setPos] = useState(37)
  const [playing, setPlaying] = useState(true)
  const [animate, setAnimate] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [likedIds, setLikedIds] = useState<Record<number, boolean>>({ 1: true, 3: true, 4: true, 6: true })

  const chosenSkin = SKINS[skinIdx]
  const skin = original ? ORIGINAL : chosenSkin
  const theme = themeAt(skin, original ? 0 : themeIdx)
  const track = TRACKS[trackIdx]

  useEffect(() => {
    const h = `ex=${example + 1}&skin=${chosenSkin.id}&theme=${themeAt(chosenSkin, themeIdx).id}&page=${page}${original ? '&original=1' : ''}`
    if (window.location.hash.slice(1) !== h) window.history.replaceState(null, '', `#${h}`)
  }, [example, chosenSkin, themeIdx, page, original])

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

  const openExample = (i: number) => {
    const ex = EXAMPLES[i]
    setExample(i)
    setSkinIdx(SKINS.findIndex((s) => s.id === ex.skin))
    setThemeIdx(ex.theme)
    setPage(ex.page)
    setQuery(ex.query ?? '')
    setOriginal(false)
  }

  const toggleLike = (id: number) => setLikedIds((l) => ({ ...l, [id]: !l[id] }))

  const mock = (
    <AppMock
      skin={skin}
      theme={theme}
      track={track}
      pos={pos}
      playing={playing}
      animate={animate}
      liked={!!likedIds[track.id]}
      onToggle={() => setPlaying((p) => !p)}
      onNext={next}
      onPrev={prev}
      onLike={() => toggleLike(track.id)}
      onSeek={(p) => setPos(Math.max(0, Math.min(track.dur - 1, p)))}
      onSelect={(i) => {
        setTrackIdx(i)
        setPos(0)
        setPlaying(true)
      }}
      page={page}
      onPage={setPage}
      likedIds={likedIds}
      onLikeId={toggleLike}
      query={query}
      onQuery={setQuery}
      original={original}
      onOriginal={setOriginal}
      chosenSkin={chosenSkin}
      chosenThemeIdx={themeIdx}
      onApply={(id, t) => {
        setSkinIdx(SKINS.findIndex((s) => s.id === id))
        setThemeIdx(t)
      }}
    />
  )

  if (initial.embed)
    return (
      <div className="bg-[#0b0b0f]" style={{ width: MOCK_W, height: MOCK_H }}>
        {mock}
      </div>
    )

  return (
    <div className="min-h-screen bg-[#0b0b0f] text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(60%_40%_at_20%_0%,rgba(255,196,0,.08),transparent),radial-gradient(40%_30%_at_90%_10%,rgba(120,80,255,.08),transparent)]" />
      <div className="relative mx-auto max-w-[1240px] px-4 pb-10 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-4 pt-6 pb-5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-amber-300 to-orange-500 text-lg font-black text-black shadow-lg shadow-orange-500/20">
              ♪
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight sm:text-xl">YM Skins — минималистичный интерфейс</h1>
              <p className="text-sm text-zinc-400">Моя волна, Моя музыка, Поиск и Настройки с выбором скина и оригинальной темой</p>
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

        <div className="mb-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {EXAMPLES.map((ex, i) => {
            const s = SKINS.find((k) => k.id === ex.skin)!
            const v = s.themes[ex.theme].vars
            return (
              <button
                key={ex.skin}
                onClick={() => openExample(i)}
                data-active={i === example}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.03] p-3 text-left transition hover:border-white/20 hover:bg-white/[.06] data-[active=true]:border-amber-300/60 data-[active=true]:bg-amber-300/[.07]"
              >
                <span
                  className="grid size-10 shrink-0 place-items-center rounded-lg border border-black/40 text-xs font-bold"
                  style={{ background: v['--bg'], color: v['--lcd-fg'] }}
                >
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">Пример {i + 1} · {ex.title}</span>
                  <span className="block truncate text-xs text-zinc-400">{ex.caption}</span>
                </span>
              </button>
            )
          })}
        </div>

        <div className="rounded-2xl border border-white/10 bg-[repeating-conic-gradient(#15151b_0_25%,#101015_0_50%)] bg-[length:24px_24px] p-3 shadow-2xl shadow-black/50 sm:p-6">
          <Scaler width={MOCK_W} height={MOCK_H}>
            {mock}
          </Scaler>
        </div>

        <p className="mt-4 flex items-start gap-2 text-sm leading-relaxed text-zinc-400">
          <MousePointerClick className="mt-0.5 size-4 shrink-0 text-amber-300/80" />
          Окно интерактивное: разделы в боковом меню переключаются, поиск ищет по трекам, сердечко добавляет трек в «Мою музыку». В «Настройках → Оформление»
          можно выбрать любой из 14 скинов, посмотреть его в окне примера и применить, либо включить оригинальную тему. У Escape from Tarkov и «Мира танков» по три варианта. Это неофициальные стилизации, без логотипов и графики игр.
        </p>
      </div>
    </div>
  )
}
