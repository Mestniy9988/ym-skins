const VERSION = /^\d+(?:\.\d+){1,3}$/;

export function injectionAllowed({ version, flags } = {}) {
  if (typeof version !== 'string' || !VERSION.test(version)) {
    return { allowed: false, reason: 'unknown-version' };
  }
  if (flags == null) {
    return { allowed: true, reason: 'clear' };
  }
  if (typeof flags !== 'object') {
    return { allowed: false, reason: 'bad-flags' };
  }
  if (!('killSwitch' in flags)) {
    return { allowed: true, reason: 'clear' };
  }
  const list = flags.killSwitch;
  if (!Array.isArray(list)) {
    return { allowed: false, reason: 'bad-flags' };
  }
  if (list.includes(version)) {
    return { allowed: false, reason: 'kill-switch' };
  }
  return { allowed: true, reason: 'clear' };
}
