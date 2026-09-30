const VERSION = /^\d+(?:\.\d+){0,3}$/;

function validVersion(value) {
  return typeof value === 'string' && VERSION.test(value);
}

export function decideSkinRollback({ failed, applied, previous } = {}) {
  if (failed !== true) {
    return { action: 'keep', version: null, reason: 'ok' };
  }
  if (!validVersion(previous)) {
    return { action: 'remove', version: null, reason: 'no-previous' };
  }
  if (applied === previous) {
    return { action: 'remove', version: null, reason: 'same' };
  }
  return { action: 'restore', version: previous, reason: 'previous' };
}
