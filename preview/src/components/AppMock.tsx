import {
  Compass,
  Heart,
  Home,
  Library,
  ListMusic,
  Mic2,
  Pause,
  Play,
  Radio,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
} from 'lucide-react'
import { fmtTime, TRACKS } from '@/data/skins'
import { Decor } from './Decor'
import { HeroArt } from './Hero'
import { Visualizer } from './Visualizer'
import { coverStyle, LCD_FONT, skinStyle, type PlayerProps } from './player'

export const MOCK_W = 1120
export const MOCK_H = 700

const NAV = [
  { icon: Home, label: 'Главная' },
  { icon: Radio, label: 'Моя волна', active: true },
  { icon: Library, label: 'Коллекция' },
  { icon: Mic2, label: 'Подкасты и книги' },
  { icon: Compass, label: 'Новинки' },
]
const PLAYLISTS = ['Мне нравится', 'Плейлист дня', 'Дежавю', 'Кассеты 80-х']

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

export function AppMock(props: PlayerProps) {
  const { skin, theme, track, pos, playing, animate, liked, onToggle, onNext, onPrev, onLike, onSeek, onSelect } = props
  const pct = (pos / track.dur) * 100
  const lcdText = `${TRACKS.findIndex((t) => t.id === track.id) + 1}. ${track.artist} — ${track.title} (${fmtTime(track.dur)}) *** `

  return (
    <div
      className="ym"
      data-skin={skin.id}
      data-playing={playing}
      data-anim={animate ? 'on' : 'off'}
      style={skinStyle(theme, track)}
    >
      <Decor skinId={skin.id} />
      <div className="ym-titlebar">
        <div className="ym-dots">
          <i />
          <i />
          <i />
        </div>
        <span className="ym-titlebar-name">Яндекс Музыка</span>
        <span className="ym-titlebar-skin">
          YM Skins · {skin.name} · {theme.name}
        </span>
      </div>

      <div className="ym-body">
        <aside className="ym-side">
          <div className="ym-logo">
            <span className="ym-logo-mark">♪</span> Музыка
          </div>
          <nav className="ym-nav">
            {NAV.map(({ icon: Icon, label, active }) => (
              <div key={label} className="ym-nav-item" data-active={active}>
                <Icon size={17} strokeWidth={2} />
                <span>{label}</span>
              </div>
            ))}
          </nav>
          <div className="ym-side-title">Плейлисты</div>
          <div className="ym-nav">
            {PLAYLISTS.map((p) => (
              <div key={p} className="ym-nav-item ym-nav-item-sm">
                <ListMusic size={15} />
                <span>{p}</span>
              </div>
            ))}
          </div>
        </aside>

        <main className="ym-main">
          <section className="ym-hero">
            <HeroArt {...props} />
            <div className="ym-hero-info">
              <div className="ym-kicker">Моя волна · сейчас играет</div>
              <h1 className="ym-h1" key={track.id} data-text={track.title}>
                {track.title}
              </h1>
              <div className="ym-sub">
                {track.artist} · {track.album}
              </div>
              <div className="ym-hero-actions">
                <button className="ym-btn ym-btn-primary" onClick={onToggle}>
                  {playing ? <Pause size={16} /> : <Play size={16} />}
                  {playing ? 'Пауза' : 'Слушать'}
                </button>
                <button className="ym-btn ym-btn-ghost" onClick={onLike} data-liked={liked}>
                  <Heart size={16} fill={liked ? 'currentColor' : 'none'} /> Нравится
                  {liked && <span className="coin" key={`${track.id}-coin`} />}
                </button>
              </div>
              <div className="ym-tags">
                {['Бодрое', 'Ретро', 'Для работы', 'Незнакомое'].map((t) => (
                  <span key={t} className="ym-tag">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className="ym-list">
            <div className="ym-list-head">
              <span>Очередь</span>
              <span className="ym-muted">{TRACKS.length} треков · 21 мин</span>
            </div>
            {TRACKS.map((t, i) => {
              const active = t.id === track.id
              return (
                <div key={t.id} className="ym-row" data-active={active} onClick={() => onSelect(i)}>
                  <span className="ym-row-idx">
                    {active && playing ? (
                      <span className="eq-anim">
                        <i />
                        <i />
                        <i />
                      </span>
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span className="ym-row-cover" style={coverStyle(t)} />
                  <span className="ym-row-title">
                    <b>{t.title}</b>
                    <small>{t.artist}</small>
                  </span>
                  <span className="ym-row-album">{t.album}</span>
                  <span className="ym-row-dur">{fmtTime(t.dur)}</span>
                </div>
              )
            })}
          </section>
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

        <div className="ym-lcd">
          <div className="ym-lcd-time">{fmtTime(pos)}</div>
          <div className="ym-lcd-main">
            <Marquee text={lcdText} className="ym-lcd-marquee" key={track.id} />
            <div className="ym-lcd-info">320 kbps · 44 kHz · stereo</div>
          </div>
          <div className="ym-lcd-vis">
            <Visualizer mode={skin.vis === 'vu' ? 'spectrum' : skin.vis} playing={playing} animate={animate} bands={14} font={LCD_FONT[skin.id]} />
          </div>
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
