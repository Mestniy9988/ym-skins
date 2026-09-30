const ID_PATTERN = /^[A-Z0-9_]{1,80}$/;
const STAY_VISIBLE = ['sidebar', 'nav.wave', 'nav.liked', 'nav.search'];

export function hidePlan({ map, smoke } = {}) {
  if (smoke?.status !== 'compatible') return { hide: [] };
  const hidden = map?.elements?.['nav.hidden'];
  if (!Array.isArray(hidden)) return { hide: [] };

  const stayVisible = new Set();
  for (const key of STAY_VISIBLE) {
    const value = map.elements[key];
    if (typeof value === 'string') stayVisible.add(value);
  }

  const hide = [];
  const seen = new Set();
  for (const id of hidden) {
    if (typeof id !== 'string' || ID_PATTERN.test(id) === false) continue;
    if (stayVisible.has(id) || seen.has(id)) continue;
    seen.add(id);
    hide.push(id);
  }
  return { hide };
}
