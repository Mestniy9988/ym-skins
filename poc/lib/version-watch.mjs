const VERSION_RE = /^\d+(?:\.\d+){1,3}$/;
const HASH_RE = /^[a-f0-9]{64}$/;

function isPlainObject(value) {
  return value !== null && typeof value === 'object';
}

function isValidSnapshot(value) {
  return (
    isPlainObject(value) &&
    typeof value.version === 'string' &&
    typeof value.asarHash === 'string' &&
    VERSION_RE.test(value.version) &&
    HASH_RE.test(value.asarHash)
  );
}

export function watchVersion({ previous, current } = {}) {
  if (!isValidSnapshot(current)) {
    return { changed: false, reason: 'missing' };
  }

  if (!isPlainObject(previous)) {
    return { changed: false, reason: 'first-seen' };
  }

  if (!isValidSnapshot(previous)) {
    return { changed: false, reason: 'baseline' };
  }

  if (previous.version !== current.version) {
    return { changed: true, reason: 'version' };
  }

  if (previous.asarHash !== current.asarHash) {
    return { changed: true, reason: 'asar' };
  }

  return { changed: false, reason: 'same' };
}
