import { useState, type ReactNode } from 'react'
import {
  Check,
  Heart,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Repeat,
  Search,
  Settings,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  X,
} from 'lucide-react'
import { fmtTime, SKINS, TRACKS, type Skin, type Track } from '@/data/skins'
import { Decor } from './Decor'
import { HeroArt } from './Hero'
import { MiniPlayer } from './MiniPlayer'
import { Visualizer } from './Visualizer'
import { coverStyle, LCD_FONT, skinStyle, type PlayerProps } from './player'

export const MOCK_W = 1120
export const MOCK_H = 700

export type Page = 'wave' | 'music' | 'search' | 'settings'

export type MockProps = PlayerProps & {
  page: Page
  onPage: (page: Page) => void
  likedIds: Record<number, boolean>
  onLikeId: (id: number) => void
  query: string
  onQuery: (q: string) => void
  original: boolean
  onOriginal: (on: boolean) => void
  chosenSkin: Skin
  chosenThemeIdx: number
  onApply: (skinId: string, themeIdx: number) => void
}

const NAV: { page: Page; icon: typeof Heart; label: string }[] = [
  { page: 'wave', icon: Radio, label: 'Моя волна' },
  { page: 'music', icon: Heart, label: 'Моя музыка' },
  { page: 'search', icon: Search, label: 'Поиск' },
]

const MOODS = ['Бодрое', 'Спокойное', 'Весёлое', 'Грустное']

export function Marquee({ text, className }: { text: string; className?: string }) {
  return (
    <div className={`mq ${className ?? ''}`}>
      <div className="mq-inner">
        <span>{text}</span>
        <span aria-hidden>{text}</span>
      </div>
    </div>
  )
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button className="ym-switch" role="switch" aria-checked={on} aria-label={label} data-on={on} onClick={() => onChange(!on)} />
}

function TrackRow({ t, index, p }: { t: Track; index: number; p: MockProps }) {
  const active = t.id === p.track.id
  const liked = !!p.likedIds[t.id]
  return (
    <div className="ym-row" data-active={active} onClick={() => p.onSelect(TRACKS.indexOf(t))}>
      <span className="ym-row-idx">
        {active && p.playing ? (
          <span className="eq-anim">
            <i />
            <i />
            <i />
          </span>
        ) : (
          index + 1
        )}
      </span>
      <span className="ym-row-cover" style={coverStyle(t)} />
      <span className="ym-row-title">
        <b>{t.title}</b>
        <small>{t.artist}</small>
      </span>
      <span className="ym-row-album">{t.album}</span>
      <span className="ym-row-actions">
        <button
          className="ym-icon-btn"
          data-liked={liked}
          aria-label="Нравится"
          onClick={(e) => {
            e.stopPropagation()
            p.onLikeId(t.id)
          }}
        >
          <Heart size={15} fill={liked ? 'currentColor' : 'none'} />
        </button>
        <span className="ym-row-dur">{fmtTime(t.dur)}</span>
      </span>
    </div>
  )
}

function Empty({ icon: Icon, title, text, action }: { icon: typeof Heart; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="ym-empty">
      <span className="ym-empty-icon">
        <Icon size={26} />
      </span>
      <b>{title}</b>
      <p>{text}</p>
      {action}
    </div>
  )
}

function WavePage(p: MockProps) {
  const [mood, setMood] = useState(0)
  const idx = TRACKS.findIndex((t) => t.id === p.track.id)
  const upNext = [1, 2, 3, 4, 5].map((k) => TRACKS[(idx + k) % TRACKS.length])
  return (
    <div className="ym-page">
      <section className="ym-hero">
        <HeroArt {...p} />
        <div className="ym-hero-info">
          <div className="ym-kicker">Моя волна · сейчас играет</div>
          <h1 className="ym-h1" key={p.track.id}>
            {p.track.title}
          </h1>
          <div className="ym-sub">
            {p.track.artist} · {p.track.album}
          </div>
          <div className="ym-hero-actions">
            <button className="ym-btn ym-btn-primary" onClick={p.onToggle}>
              {p.playing ? <Pause size={16} /> : <Play size={16} />}
              {p.playing ? 'Пауза' : 'Слушать'}
            </button>
            <button className="ym-btn ym-btn-ghost" onClick={p.onLike} data-liked={p.liked}>
              <Heart size={16} fill={p.liked ? 'currentColor' : 'none'} /> Нравится
              {p.liked && <span className="coin" key={`${p.track.id}-coin`} />}
            </button>
          </div>
          <div className="ym-tags">
            {MOODS.map((m, i) => (
              <button key={m} className="ym-tag" data-on={i === mood} onClick={() => setMood(i)}>
                {m}
              </button>
            ))}
          </div>
        </div>
      </section>
      <div className="ym-section-title">Дальше в волне</div>
      <div className="ym-list">
        {upNext.map((t, i) => (
          <TrackRow key={t.id} t={t} index={i} p={p} />
        ))}
      </div>
    </div>
  )
}

function MusicPage(p: MockProps) {
  const liked = TRACKS.filter((t) => p.likedIds[t.id])
  return (
    <div className="ym-page">
      <div className="ym-page-head">
        <div>
          <h2 className="ym-page-title">Моя музыка</h2>
          <div className="ym-muted">
            {liked.length ? `${liked.length} ${plural(liked.length, 'трек', 'трека', 'треков')}, которые вам понравились` : 'Понравившиеся треки'}
          </div>
        </div>
        {liked.length > 0 && (
          <button className="ym-btn ym-btn-primary" onClick={() => p.onSelect(TRACKS.indexOf(liked[0]))}>
            <Play size={16} /> Слушать все
          </button>
        )}
      </div>
      {liked.length ? (
        <div className="ym-list">
          {liked.map((t, i) => (
            <TrackRow key={t.id} t={t} index={i} p={p} />
          ))}
        </div>
      ) : (
        <Empty
          icon={Heart}
          title="Здесь пока пусто"
          text="Отмечайте треки сердечком — они соберутся в Моей музыке."
          action={
            <button className="ym-btn ym-btn-primary" onClick={() => p.onPage('wave')}>
              Открыть Мою волну
            </button>
          }
        />
      )}
    </div>
  )
}

function SearchPage(p: MockProps) {
  const q = p.query.trim().toLowerCase()
  const results = q ? TRACKS.filter((t) => `${t.title} ${t.artist} ${t.album}`.toLowerCase().includes(q)) : []
  return (
    <div className="ym-page">
      <h2 className="ym-page-title">Поиск</h2>
      <label className="ym-search">
        <Search size={18} />
        <input value={p.query} onChange={(e) => p.onQuery(e.target.value)} placeholder="Трек, исполнитель или альбом" spellCheck={false} />
        {p.query && (
          <button className="ym-icon-btn" onClick={() => p.onQuery('')} aria-label="Очистить">
            <X size={16} />
          </button>
        )}
      </label>
      {!q ? (
        <>
          <div className="ym-section-title">Недавние запросы</div>
          <div className="ym-tags ym-tags-free">
            {['Ретроград', 'ночь', 'Kosmos FM', 'Бульвар'].map((s) => (
              <button key={s} className="ym-tag" onClick={() => p.onQuery(s)}>
                {s}
              </button>
            ))}
          </div>
          <div className="ym-section-title">Популярное сейчас</div>
          <div className="ym-list">
            {TRACKS.slice(0, 4).map((t, i) => (
              <TrackRow key={t.id} t={t} index={i} p={p} />
            ))}
          </div>
        </>
      ) : results.length ? (
        <>
          <div className="ym-section-title">
            Треки <span className="ym-muted">· {results.length}</span>
          </div>
          <div className="ym-list">
            {results.map((t, i) => (
              <TrackRow key={t.id} t={t} index={i} p={p} />
            ))}
          </div>
        </>
      ) : (
        <Empty icon={Search} title="Ничего не нашлось" text={`По запросу «${p.query}» треков нет. Проверьте написание или попробуйте другой запрос.`} />
      )}
    </div>
  )
}

function Row({ title, text, children }: { title: string; text?: string; children: ReactNode }) {
  return (
    <div className="ym-set-row">
      <div>
        <b>{title}</b>
        {text && <small>{text}</small>}
      </div>
      {children}
    </div>
  )
}

function SettingsPage(p: MockProps) {
  const [pending, setPending] = useState({ skinId: p.chosenSkin.id, themeIdx: p.chosenThemeIdx })
  const [quality, setQuality] = useState(1)
  const [toggles, setToggles] = useState({ normalize: true, crossfade: false, autostart: false, tray: true, onTop: true })
  const [checked, setChecked] = useState(false)
  const pendingSkin = SKINS.find((s) => s.id === pending.skinId) ?? SKINS[0]
  const isApplied = pending.skinId === p.chosenSkin.id && pending.themeIdx === p.chosenThemeIdx
  const flip = (k: keyof typeof toggles) => (v: boolean) => setToggles((t) => ({ ...t, [k]: v }))

  return (
    <div className="ym-page ym-settings">
      <h2 className="ym-page-title">Настройки</h2>

      <section className="ym-set-section">
        <div className="ym-set-title">Оформление</div>
        <Row title="Оригинальная тема" text="Стандартный вид приложения. Выбранный скин сохранится и вернётся, когда вы выключите тему.">
          <Toggle on={p.original} onChange={p.onOriginal} label="Оригинальная тема" />
        </Row>
        <div className="ym-skin-picker" data-disabled={p.original}>
          <div className="ym-skin-grid">
            {SKINS.map((s) => {
              const theme = s.themes[s.id === pending.skinId ? pending.themeIdx : 0]
              return (
                <button
                  key={s.id}
                  className="ym-skin-tile"
                  data-selected={s.id === pending.skinId}
                  onClick={() => setPending({ skinId: s.id, themeIdx: s.id === p.chosenSkin.id ? p.chosenThemeIdx : 0 })}
                >
                  <span className="ym-skin-swatch" style={{ ...skinStyle(theme, p.track), background: 'var(--bg)' }}>
                    <span className="ym-skin-swatch-lcd">{String(s.num).padStart(2, '0')}</span>
                    <span className="ym-skin-swatch-bars">
                      {[5, 9, 12, 8, 11, 6, 4, 7].map((h, i) => (
                        <i key={i} style={{ height: h, background: i > 4 ? 'var(--vis-2)' : 'var(--vis-1)' }} />
                      ))}
                    </span>
                    {s.id === p.chosenSkin.id && !p.original && (
                      <span className="ym-skin-applied">
                        <Check size={10} strokeWidth={3} />
                      </span>
                    )}
                  </span>
                  <span className="ym-skin-name">{s.name}</span>
                </button>
              )
            })}
          </div>
          <div className="ym-skin-preview">
            <div className="ym-set-label">Окно примера</div>
            <div className="ym-skin-preview-stage">
              <div className="ym-skin-preview-scale">
                <MiniPlayer {...p} skin={pendingSkin} theme={pendingSkin.themes[pending.themeIdx]} compact />
              </div>
            </div>
            <div className="ym-skin-preview-meta">
              <b>{pendingSkin.name}</b>
              <small>{pendingSkin.concept}</small>
            </div>
            <div className="ym-seg">
              {pendingSkin.themes.map((t, i) => (
                <button key={t.id} data-on={i === pending.themeIdx} onClick={() => setPending((s) => ({ ...s, themeIdx: i }))}>
                  {t.name}
                </button>
              ))}
            </div>
            <button
              className="ym-btn ym-btn-primary ym-btn-block"
              disabled={isApplied || p.original}
              onClick={() => p.onApply(pending.skinId, pending.themeIdx)}
            >
              {isApplied ? (
                <>
                  <Check size={16} /> Скин применён
                </>
              ) : (
                'Применить скин'
              )}
            </button>
          </div>
        </div>
      </section>

      <section className="ym-set-section">
        <div className="ym-set-title">Качество звука</div>
        <Row title="Качество при прослушивании" text="Высокое качество расходует больше трафика.">
          <div className="ym-seg">
            {['Экономное', 'Оптимальное', 'Высокое'].map((q, i) => (
              <button key={q} data-on={i === quality} onClick={() => setQuality(i)}>
                {q}
              </button>
            ))}
          </div>
        </Row>
        <Row title="Нормализация громкости" text="Одинаковая громкость у всех треков.">
          <Toggle on={toggles.normalize} onChange={flip('normalize')} label="Нормализация громкости" />
        </Row>
        <Row title="Плавные переходы между треками">
          <Toggle on={toggles.crossfade} onChange={flip('crossfade')} label="Плавные переходы" />
        </Row>
      </section>

      <section className="ym-set-section">
        <div className="ym-set-title">Приложение</div>
        <Row title="Запускать вместе с системой">
          <Toggle on={toggles.autostart} onChange={flip('autostart')} label="Автозапуск" />
        </Row>
        <Row title="Сворачивать в трей при закрытии">
          <Toggle on={toggles.tray} onChange={flip('tray')} label="Сворачивать в трей" />
        </Row>
        <Row title="Мини-плеер поверх всех окон">
          <Toggle on={toggles.onTop} onChange={flip('onTop')} label="Мини-плеер поверх окон" />
        </Row>
        <Row title="Язык интерфейса">
          <span className="ym-select">Русский</span>
        </Row>
      </section>

      <section className="ym-set-section">
        <div className="ym-set-title">Скины</div>
        <Row title="Обновления скинов" text={checked ? 'Установлена последняя версия. Скины совместимы с текущей версией приложения.' : 'Версия каталога 1.0 · проверка выполняется автоматически'}>
          <button className="ym-btn ym-btn-ghost" onClick={() => setChecked(true)}>
            <RefreshCw size={15} /> Проверить
          </button>
        </Row>
      </section>
    </div>
  )
}

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few
  return many
}

export function AppMock(props: MockProps) {
  const { skin, theme, track, pos, playing, animate, liked, onToggle, onNext, onPrev, onLike, onSeek, page, onPage } = props
  const pct = (pos / track.dur) * 100
  const lcdText = `${TRACKS.findIndex((t) => t.id === track.id) + 1}. ${track.artist} — ${track.title} (${fmtTime(track.dur)}) *** `

  return (
    <div className="ym ym-min" data-skin={skin.id} data-page={page} data-playing={playing} data-anim={animate ? 'on' : 'off'} style={skinStyle(theme, track)}>
      <Decor skinId={skin.id} />
      <div className="ym-titlebar">
        <div className="ym-dots">
          <i />
          <i />
          <i />
        </div>
        <span className="ym-titlebar-name">Яндекс Музыка</span>
        <span className="ym-titlebar-skin">{skin.id === 'original' ? 'Оригинальная тема' : `Скин: ${skin.name} · ${theme.name}`}</span>
      </div>

      <div className="ym-body">
        <aside className="ym-side">
          <div className="ym-logo">
            <span className="ym-logo-mark">♪</span> Музыка
          </div>
          <nav className="ym-nav">
            {NAV.map(({ page: p, icon: Icon, label }) => (
              <button key={p} className="ym-nav-item" data-active={page === p} onClick={() => onPage(p)}>
                <Icon size={17} strokeWidth={2} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <button className="ym-nav-item ym-nav-settings" data-active={page === 'settings'} onClick={() => onPage('settings')}>
            <Settings size={17} strokeWidth={2} />
            <span>Настройки</span>
          </button>
        </aside>

        <main className="ym-main">
          {page === 'wave' && <WavePage {...props} />}
          {page === 'music' && <MusicPage {...props} />}
          {page === 'search' && <SearchPage {...props} />}
          {page === 'settings' && <SettingsPage key={`${props.chosenSkin.id}-${props.chosenThemeIdx}`} {...props} />}
        </main>
      </div>

      <footer className="ym-player">
        <div className="ym-p-track">
          <span className="ym-p-cover" style={coverStyle(track)} />
          <span className="ym-p-meta">
            <b>{track.title}</b>
            <small>{track.artist}</small>
          </span>
          <button className="ym-icon-btn" onClick={onLike} data-liked={liked} aria-label="Нравится">
            <Heart size={17} fill={liked ? 'currentColor' : 'none'} />
          </button>
        </div>

        <div className="ym-p-center">
          <div className="ym-transport">
            <button className="ym-icon-btn" aria-label="Перемешать">
              <Shuffle size={16} />
            </button>
            <button className="ym-tbtn" onClick={onPrev} aria-label="Предыдущий">
              <SkipBack size={18} fill="currentColor" />
            </button>
            <button className="ym-tbtn ym-tbtn-play" onClick={onToggle} aria-label={playing ? 'Пауза' : 'Играть'}>
              {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            </button>
            <button className="ym-tbtn" onClick={onNext} aria-label="Следующий">
              <SkipForward size={18} fill="currentColor" />
            </button>
            <button className="ym-icon-btn" aria-label="Повтор">
              <Repeat size={16} />
            </button>
          </div>
          <div className="ym-progress-row">
            <span>{fmtTime(pos)}</span>
            <div
              className="ym-progress"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect()
                onSeek(((e.clientX - r.left) / r.width) * track.dur)
              }}
            >
              <div className="ym-progress-fill" style={{ width: `${pct}%` }} />
              <div className="ym-progress-knob" style={{ left: `${pct}%` }} />
            </div>
            <span>{fmtTime(track.dur)}</span>
          </div>
        </div>

        <div className="ym-lcd">
          <div className="ym-lcd-time">{fmtTime(pos)}</div>
          <div className="ym-lcd-main">
            <Marquee text={lcdText} className="ym-lcd-marquee" key={track.id} />
          </div>
          <div className="ym-lcd-vis">
            <Visualizer mode={skin.vis === 'vu' ? 'spectrum' : skin.vis} playing={playing} animate={animate} bands={12} font={LCD_FONT[skin.id]} />
          </div>
        </div>

        <div className="ym-p-right">
          <Volume2 size={17} />
          <div className="ym-vol">
            <div className="ym-vol-fill" />
          </div>
        </div>
      </footer>
    </div>
  )
}
