import { Pause, Play, Repeat, Shuffle, SkipBack, SkipForward, Square, Triangle } from 'lucide-react'
import { fmtTime, TRACKS } from '@/data/skins'
import { Marquee } from './AppMock'
import { Snow } from './Decor'
import { Visualizer } from './Visualizer'
import { LCD_FONT, skinStyle, type PlayerProps } from './player'

export const MINI_W = 550
export const MINI_H = 472

const BANDS = ['60', '170', '310', '600', '1K', '3K', '6K', '12K', '14K', '16K']
const PRESET = [0.72, 0.64, 0.55, 0.46, 0.5, 0.58, 0.66, 0.7, 0.62, 0.56]

function TitleBar({ label }: { label: string }) {
  return (
    <div className="wa-title">
      <span className="wa-title-lines" />
      <span className="wa-title-text">{label}</span>
      <span className="wa-title-lines" />
      <span className="wa-title-btns">
        <i />
        <i />
        <i />
      </span>
    </div>
  )
}

export function MiniPlayer(props: PlayerProps & { compact?: boolean }) {
  const { skin, theme, track, pos, playing, animate, onToggle, onNext, onPrev, onSeek, compact } = props
  const idx = TRACKS.findIndex((t) => t.id === track.id) + 1
  const pct = pos / track.dur
  const curve = PRESET.map((v, i) => `${i === 0 ? 'M' : 'L'} ${8 + i * 17.5} ${40 - v * 32}`).join(' ')

  return (
    <div
      className="wa-stack"
      data-skin={skin.id}
      data-theme={theme.id}
      data-playing={playing}
      data-anim={animate ? 'on' : 'off'}
      style={skinStyle(theme, track)}
    >
      <div className="wa">
        <TitleBar label={`YM SKINS · ${skin.name.toUpperCase()}`} />
        <div className="wa-top">
          <div className="wa-display">
            <div className="wa-state">{playing ? '▶' : '❚❚'}</div>
            <div className="wa-time">{fmtTime(pos).padStart(5, '0')}</div>
            <div className="wa-vis">
              <Visualizer
                mode={skin.vis === 'vu' ? 'spectrum' : skin.vis}
                playing={playing}
                animate={animate}
                bands={skin.vis === 'blocks' ? 12 : 19}
                font={LCD_FONT[skin.id]}
              />
            </div>
          </div>
          <div className="wa-right">
            <div className="wa-marquee">
              <Marquee key={track.id} text={`${idx}. ${track.artist} — ${track.title} (${fmtTime(track.dur)}) *** `} />
            </div>
            <div className="wa-info">
              <span className="wa-box">320</span>
              <span>kbps</span>
              <span className="wa-box">44</span>
              <span>kHz</span>
              <span className="wa-ms">mono</span>
              <span className="wa-ms" data-on>
                stereo
              </span>
            </div>
            <div className="wa-sliders">
              <div className="wa-slider wa-slider-vol">
                <i style={{ left: '72%' }} />
              </div>
              <div className="wa-slider wa-slider-bal">
                <i style={{ left: '50%' }} />
              </div>
              <span className="wa-toggle" data-on>
                EQ
              </span>
              <span className="wa-toggle">PL</span>
            </div>
          </div>
        </div>
        <div
          className="wa-seek"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            onSeek(((e.clientX - r.left) / r.width) * track.dur)
          }}
        >
          <i style={{ left: `calc(${pct * 100}% - ${pct * 58}px)` }} />
        </div>
        <div className="wa-controls">
          <div className="wa-transport">
            <button onClick={onPrev} aria-label="Предыдущий">
              <SkipBack size={16} fill="currentColor" />
            </button>
            <button onClick={onToggle} data-on={playing} aria-label="Играть">
              <Play size={16} fill="currentColor" />
            </button>
            <button onClick={onToggle} data-on={!playing && pos > 0} aria-label="Пауза">
              <Pause size={16} fill="currentColor" />
            </button>
            <button onClick={() => onSeek(0)} aria-label="Стоп">
              <Square size={14} fill="currentColor" />
            </button>
            <button onClick={onNext} aria-label="Следующий">
              <SkipForward size={16} fill="currentColor" />
            </button>
          </div>
          <button className="wa-eject" aria-label="Открыть">
            <Triangle size={12} fill="currentColor" />
          </button>
          <span className="wa-toggle wa-toggle-icon">
            <Shuffle size={13} />
          </span>
          <span className="wa-toggle wa-toggle-icon" data-on>
            <Repeat size={13} />
          </span>
          <span className="wa-logo">♪</span>
        </div>
        {skin.id === 'winter' && <Snow count={24} />}
      </div>

      {!compact && (
        <div className="wa wa-eq">
          <TitleBar label="ЭКВАЛАЙЗЕР" />
          <div className="wa-eq-top">
            <span className="wa-toggle" data-on>
              ON
            </span>
            <span className="wa-toggle">AUTO</span>
            <svg className="wa-eq-graph" viewBox="0 0 180 44" preserveAspectRatio="none">
              <line x1="0" y1="24" x2="180" y2="24" />
              <path d={curve} />
            </svg>
            <span className="wa-toggle">ПРЕСЕТЫ</span>
          </div>
          <div className="wa-eq-bands">
            <div className="wa-eq-band">
              <div className="wa-eq-slot">
                <i style={{ bottom: '58%' }} />
              </div>
              <small>PRE</small>
            </div>
            <div className="wa-eq-scale">
              <small>+12</small>
              <small>0</small>
              <small>−12</small>
            </div>
            {BANDS.map((b, i) => (
              <div className="wa-eq-band" key={b}>
                <div className="wa-eq-slot">
                  <div className="wa-eq-fill" style={{ height: `${PRESET[i] * 100}%` }} />
                  <i style={{ bottom: `${PRESET[i] * 100}%`, animationDelay: `${i * -0.17}s` }} />
                </div>
                <small>{b}</small>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
