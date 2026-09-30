import { clearStamps, stampElements } from './runtime-stamp.mjs';
import { auditSkinCss, testSkinCss } from './skin-css.mjs';

export const TEST_SKIN_STYLE_ID = 'ym-skins-runtime';
export const TEST_SKIN_COLOR = 'rgb(12, 140, 70)';

export function installSkinStyle(document, css) {
  const audit = auditSkinCss(css);
  if (!audit.ok) return { applied: false, reason: audit.reason };
  const existing = document.getElementById('ym-skins-runtime');
  let style = existing;
  if (!style) {
    style = document.createElement('style');
    style.id = 'ym-skins-runtime';
    const parent = document.head || document.documentElement;
    if (!parent || typeof parent.appendChild !== 'function') return { applied: false, reason: 'dom' };
    parent.appendChild(style);
  }
  style.textContent = css;
  return { applied: true, swapped: Boolean(existing) };
}

export function probeTestSkin(document, map, getComputedStyle) {
  const stamped = stampElements(document, map);
  const count = stamped?.stamped || 0;
  if (count === 0) {
    const cleared = clearStamps(document);
    return {
      stamped: 0,
      styleApplied: false,
      playColored: false,
      styleRemoved: document.getElementById('ym-skins-runtime') == null,
      stampsCleared: (cleared?.cleared || 0) === 0,
    };
  }
  const installed = installSkinStyle(document, testSkinCss());
  let playColored = false;
  if (installed.applied === true && typeof getComputedStyle === 'function') {
    const play = typeof document.querySelector === 'function'
      ? document.querySelector('[data-yms="player.play"]')
      : null;
    if (play) {
      const color = String(getComputedStyle(play).backgroundColor || '').replace(/\s+/g, '');
      playColored = color === 'rgb(12,140,70)';
    }
  }
  const style = document.getElementById('ym-skins-runtime');
  if (style && typeof style.remove === 'function') style.remove();
  const cleared = clearStamps(document);
  return {
    stamped: count,
    styleApplied: installed.applied === true,
    playColored,
    styleRemoved: document.getElementById('ym-skins-runtime') == null,
    stampsCleared: cleared.cleared === count,
  };
}
