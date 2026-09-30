export function stampElements(document, map) {
  const table = map?.elements;
  if (!table || typeof table !== 'object') return { stamped: 0 };
  const lookup = document?.querySelector;
  if (typeof lookup !== 'function') return { stamped: 0 };
  const idPattern = /^[A-Z0-9_]{1,80}$/;
  let stamped = 0;
  for (const name of Object.keys(table)) {
    const value = table[name];
    const ids = typeof value === 'string' ? [value] : Array.isArray(value) ? value : null;
    if (!ids) continue;
    for (let index = 0; index < ids.length; index += 1) {
      const id = ids[index];
      if (typeof id !== 'string' || idPattern.test(id) === false) continue;
      const node = lookup.call(document, `[data-test-id="${id}"]`);
      if (!node || typeof node.setAttribute !== 'function') continue;
      node.setAttribute('data-yms', name);
      node.setAttribute('data-yms-stamp', '1');
      stamped += 1;
    }
  }
  return { stamped };
}

export function clearStamps(document) {
  const lookup = document?.querySelectorAll;
  if (typeof lookup !== 'function') return { cleared: 0 };
  const nodes = lookup.call(document, '[data-yms-stamp="1"]');
  if (!nodes) return { cleared: 0 };
  let cleared = 0;
  for (const node of nodes) {
    if (!node || typeof node.removeAttribute !== 'function') continue;
    if (typeof node.getAttribute === 'function' && node.getAttribute('data-yms-stamp') !== '1') continue;
    node.removeAttribute('data-yms');
    node.removeAttribute('data-yms-stamp');
    cleared += 1;
  }
  return { cleared };
}
