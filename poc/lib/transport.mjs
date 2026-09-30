const SELECTOR = {
  play: '[data-yms="player.play"]',
  pause: '[data-yms="player.pause"]',
  like: '[data-yms="player.like"]',
};

export function pressTransport(document, action) {
  const selector = SELECTOR[action];
  if (!selector) return { pressed: false, reason: 'action' };
  const node = typeof document?.querySelector === 'function' ? document.querySelector(selector) : null;
  if (!node || typeof node.click !== 'function') {
    return { pressed: false, reason: 'missing', name: action };
  }
  node.click();
  return { pressed: true, name: action };
}
