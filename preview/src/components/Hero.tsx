import { Visualizer } from './Visualizer'
import { coverStyle, LCD_FONT, type PlayerProps } from './player'

function Turntable({ track, pos, playing, animate }: PlayerProps) {
  const progress = pos / track.dur
  return (
    <div className="tt">
      <div className="tt-vis">
        <Visualizer mode="bars" playing={playing} animate={animate} bands={10} />
      </div>
      <div className="tt-rpm">33⅓ RPM</div>
      <div className="tt-platter">
        <div className="tt-record spin" data-on={playing}>
          <div className="tt-label" style={coverStyle(track)}>
            <span>{track.artist}</span>
          </div>
        </div>
      </div>
      <div className="tt-arm" style={{ transform: `rotate(${playing || pos > 0 ? 16 + progress * 22 : 0}deg)` }}>
        <div className="tt-arm-rod" />
        <div className="tt-arm-head" />
      </div>
      <div className="tt-knob" />
    </div>
  )
}

function Cassette({ track, playing, animate }: PlayerProps) {
  return (
    <div className="cs-wrap">
      <div className="cs">
        <div className="cs-label">
          <span className="cs-side">A</span>
          <span className="cs-title">{track.title}</span>
          <span className="cs-type">CrO₂ · 90</span>
        </div>
        <div className="cs-window">
          <div className="cs-reel spin" data-on={playing} />
          <div className="cs-tape" />
          <div className="cs-reel spin" data-on={playing} />
        </div>
      </div>
      <div className="cs-vu">
        <Visualizer mode="vu" playing={playing} animate={animate} bands={16} font={LCD_FONT.hifi} />
      </div>
    </div>
  )
}

function Synth(props: PlayerProps) {
  const { playing, animate } = props
  return (
    <div className="sw">
      <div className="sw-sun" />
      <div className="sw-hills" />
      <div className="sw-grid" data-on={playing} />
      <div className="sw-vis">
        <Visualizer mode="bars" playing={playing} animate={animate} bands={32} />
      </div>
    </div>
  )
}

function CoverArt(props: PlayerProps) {
  const { skin, track, playing, animate } = props
  return (
    <div className="hero-cover-wrap">
      <div className="hero-cover" style={coverStyle(track)} key={track.id}>
        <span className="hero-cover-title">{track.album}</span>
      </div>
      <div className="hero-vis">
        <Visualizer mode={skin.vis} playing={playing} animate={animate} bands={skin.vis === 'blocks' ? 18 : 28} font={LCD_FONT[skin.id]} />
      </div>
    </div>
  )
}

export function HeroArt(props: PlayerProps) {
  switch (props.skin.hero) {
    case 'turntable':
      return <Turntable {...props} />
    case 'cassette':
      return <Cassette {...props} />
    case 'synth':
      return <Synth {...props} />
    default:
      return <CoverArt {...props} />
  }
}
