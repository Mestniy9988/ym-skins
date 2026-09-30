/**
 * Pure decision for restoring a full skin after a map smoke check.
 * No filesystem, no network.
 *
 * @param {object} [input]
 * @param {'full' | 'safe' | 'waiting' | string} [input.mode]
 * @param {{ status?: string } | null} [input.smoke]
 * @param {{ allowed?: boolean } | null} [input.injection]
 * @returns {{ action: 'stay-off' | 'stay-safe' | 'keep-full' | 'full-skin', reason: 'blocked' | 'mode' | 'smoke' | 'already' | 'map' }}
 */
export function decideMapRestore({ mode, smoke, injection } = {}) {
  if (isObject(injection) && injection.allowed === false) {
    return { action: 'stay-off', reason: 'blocked' };
  }
  if (mode !== 'full' && mode !== 'safe' && mode !== 'waiting') {
    return { action: 'stay-safe', reason: 'mode' };
  }
  if (
    !isObject(smoke) ||
    (smoke.status !== 'compatible' && smoke.status !== 'safe-mode' && smoke.status !== 'no-map')
  ) {
    return { action: 'stay-safe', reason: 'smoke' };
  }
  if (mode === 'full' && smoke.status === 'compatible') {
    return { action: 'keep-full', reason: 'already' };
  }
  if (mode === 'full') {
    return { action: 'stay-safe', reason: 'smoke' };
  }
  if (smoke.status === 'compatible') {
    return { action: 'full-skin', reason: 'map' };
  }
  return { action: 'stay-safe', reason: 'smoke' };
}

function isObject(value) {
  return value !== null && typeof value === 'object';
}
