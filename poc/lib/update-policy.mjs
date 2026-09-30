/**
 * Pure decision for what the manager does after a Yandex Music version snapshot comparison.
 * No filesystem, no network.
 *
 * @param {object} [input]
 * @param {{ status?: string } | null} [input.snapshot]
 * @param {boolean} [input.hasCurrentMap]
 * @param {string | null} [input.previousSmoke]
 * @returns {{ action: 'keep' | 'apply-current-map' | 'apply-previous-map' | 'awaiting-map', reason: string }}
 */
export function decideUpdate({ snapshot, hasCurrentMap, previousSmoke } = {}) {
  if (snapshot == null) {
    return decideWithoutBaseline({ hasCurrentMap, previousSmoke });
  }

  const status = snapshot.status;
  if (status === 'unchanged') {
    return { action: 'keep', reason: 'unchanged' };
  }
  if (status === 'changed' || status === 'no-baseline') {
    return decideWithoutBaseline({ hasCurrentMap, previousSmoke });
  }
  return { action: 'awaiting-map', reason: 'unknown-snapshot' };
}

function decideWithoutBaseline({ hasCurrentMap, previousSmoke }) {
  if (hasCurrentMap === true) {
    return { action: 'apply-current-map', reason: 'current-map' };
  }
  if (previousSmoke === 'pass') {
    return { action: 'apply-previous-map', reason: 'previous-map' };
  }
  return { action: 'awaiting-map', reason: 'no-map' };
}
