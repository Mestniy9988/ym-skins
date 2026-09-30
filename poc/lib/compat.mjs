const DEFAULT_CRITICAL = ['player.bar', 'player.play', 'sidebar', 'settings.list'];

export function criticalKeys(map) {
  if (map == null) return [];
  const listed = Array.isArray(map.critical)
    ? map.critical
    : map.critical == null
      ? DEFAULT_CRITICAL
      : [];
  const seen = new Set();
  const keys = [];
  for (const name of listed) {
    if (typeof name !== 'string' || seen.has(name) || !hasOwn(map.elements, name)) continue;
    seen.add(name);
    keys.push(name);
  }
  return keys;
}

export function smokeSelectors({ map, found } = {}) {
  if (map == null) return { status: 'no-map', critical: [], missing: [] };
  const critical = criticalKeys(map);
  const missing = [];
  for (const name of critical) {
    if (!isFound(found, name)) missing.push(name);
  }
  return {
    status: missing.length === 0 ? 'compatible' : 'safe-mode',
    critical,
    missing,
  };
}

function hasOwn(object, key) {
  return object != null
    && typeof object === 'object'
    && Object.prototype.hasOwnProperty.call(object, key);
}

function isFound(found, name) {
  if (found instanceof Set) return found.has(name);
  if (Array.isArray(found)) return found.includes(name);
  if (found != null && typeof found === 'object') return Boolean(found[name]);
  return false;
}
