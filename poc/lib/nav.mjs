export function probeHideNav(document, getComputedStyle, testIds) {
  const ids = Array.isArray(testIds) ? testIds : [];
  let node = null;
  let hiddenTestId = null;
  for (let index = 0; index < ids.length; index += 1) {
    const id = ids[index];
    if (typeof id !== 'string' || /^[A-Z0-9_]{1,80}$/.test(id) === false) continue;
    const found = document.querySelector(`[data-test-id="${id}"]`);
    if (!found) continue;
    node = found;
    hiddenTestId = id;
    break;
  }
  if (!node) {
    return { hideTried: false, hideApplied: false, hideReverted: false };
  }
  const previous = node.style.display;
  let hideApplied = false;
  let hideReverted = false;
  try {
    node.setAttribute('data-yms-poc-hide', '1');
    node.style.display = 'none';
    try {
      hideApplied = getComputedStyle(node).display === 'none';
    } catch {
      hideApplied = false;
    }
  } finally {
    node.style.display = previous;
    node.removeAttribute('data-yms-poc-hide');
    try {
      hideReverted = getComputedStyle(node).display !== 'none';
    } catch {
      hideReverted = false;
    }
  }
  return { hideTried: true, hideApplied, hideReverted, hiddenTestId };
}
