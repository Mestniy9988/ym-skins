const VERSION = /^\d+(?:\.\d+){0,3}$/;

function usableVersion(value) {
  return typeof value === 'string' && VERSION.test(value) ? value : null;
}

export function selectChannel({ preference, available } = {}) {
  const channel = preference == null ? 'stable' : preference;
  if (channel !== 'stable' && channel !== 'beta') {
    return { channel: null, version: null, reason: 'channel' };
  }
  if (available == null || typeof available !== 'object' || Array.isArray(available)) {
    return { channel: null, version: null, reason: 'empty' };
  }
  const stable = usableVersion(available.stable);
  const beta = usableVersion(available.beta);
  if (channel === 'stable') {
    if (stable) return { channel: 'stable', version: stable, reason: 'stable' };
    return { channel: null, version: null, reason: 'empty' };
  }
  if (beta) return { channel: 'beta', version: beta, reason: 'beta' };
  if (stable) return { channel: 'stable', version: stable, reason: 'beta-missing' };
  return { channel: null, version: null, reason: 'empty' };
}
