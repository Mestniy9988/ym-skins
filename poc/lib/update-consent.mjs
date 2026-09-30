/**
 * Pure decision for whether an update may be applied now.
 * No filesystem, no network.
 *
 * @param {object} [input]
 * @param {string} [input.target]
 * @param {boolean} [input.auto]
 * @param {boolean} [input.confirmed]
 * @returns {{ apply: boolean, reason: 'target' | 'auto' | 'confirmed' | 'needs-confirm' | 'background' }}
 */
export function decideApplyMode({ target, auto, confirmed } = {}) {
  if (target !== 'manager' && target !== 'catalog' && target !== 'maps') {
    return { apply: false, reason: 'target' };
  }
  if (auto === true) {
    return { apply: true, reason: 'auto' };
  }
  if (target === 'manager') {
    return confirmed === true
      ? { apply: true, reason: 'confirmed' }
      : { apply: false, reason: 'needs-confirm' };
  }
  return { apply: true, reason: 'background' };
}
