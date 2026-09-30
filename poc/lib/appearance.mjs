export function insertAppearance(document) {
  const list = document.querySelector('[data-test-id="SETTINGS_LIST"]');
  if (!list) {
    return { settingsFound: false, inserted: false, firstChild: false };
  }
  const previous = document.getElementById('ym-skins-appearance');
  if (previous) previous.remove();
  const block = document.createElement('section');
  block.id = 'ym-skins-appearance';
  block.setAttribute('data-yms', 'settings.appearance');
  const heading = document.createElement('h2');
  heading.textContent = 'Оформление';
  const control = document.createElement('button');
  control.type = 'button';
  control.textContent = 'Оригинальная тема';
  block.appendChild(heading);
  block.appendChild(control);
  if (list.firstChild) list.insertBefore(block, list.firstChild);
  else list.appendChild(block);
  return {
    settingsFound: true,
    inserted: document.getElementById('ym-skins-appearance') === block,
    firstChild: list.firstChild === block,
  };
}

export function removeAppearance(document) {
  const block = document.getElementById('ym-skins-appearance');
  if (block) block.remove();
  return { removed: document.getElementById('ym-skins-appearance') == null };
}

export function probeAppearance(document) {
  const placed = insertAppearance(document);
  const cleared = removeAppearance(document);
  return {
    settingsFound: placed.settingsFound,
    inserted: placed.inserted,
    firstChild: placed.firstChild,
    removed: cleared.removed,
  };
}
