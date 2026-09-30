const ID = /^[a-z0-9-]{1,40}$/;

export const CATALOG_SKINS = [
  { id: 'classic-98', name: "Classic '98" },
  { id: 'chrome-modern', name: 'Chrome Modern' },
  { id: 'hifi-deck', name: 'Hi-Fi Deck' },
  { id: 'vinyl-turntable', name: 'Vinyl Turntable' },
  { id: 'synthwave-84', name: 'Synthwave 84' },
  { id: 'neon-cyber', name: 'Neon Cyber' },
  { id: 'terminal-crt', name: 'Terminal CRT' },
  { id: 'aqua-jelly', name: 'Aqua Jelly' },
  { id: 'aero-glass', name: 'Aero Glass' },
  { id: 'arcade-8bit', name: '8-Bit Arcade' },
  { id: 'winter-lodge', name: 'Winter Lodge' },
  { id: 'cover-adaptive', name: 'Cover Adaptive' },
];

const APPLY_TEXT = {
  apply: 'Применить скин',
  applied: 'Скин применён',
  disabled: 'Применить скин',
};

export function panelView({
  original = false,
  skins = [],
  appliedSkinId = null,
  previewSkinId = null,
  applyLabel = 'apply',
} = {}) {
  const inactive = original === true;
  const focusId = inactive ? null : (previewSkinId || appliedSkinId);
  const clean = [];
  for (const skin of skins) {
    if (!skin || typeof skin.name !== 'string' || !ID.test(skin.id)) continue;
    if (skin.name.length < 1 || skin.name.length > 80) continue;
    clean.push({
      id: skin.id,
      name: skin.name,
      applied: !inactive && skin.id === appliedSkinId,
      selected: !inactive && skin.id === focusId,
    });
  }
  const selected = clean.find((skin) => skin.selected);
  const label = APPLY_TEXT[applyLabel] ? applyLabel : 'apply';
  return {
    original: inactive,
    skins: clean,
    previewTitle: inactive ? '' : (selected?.name || ''),
    applyLabel: inactive ? 'disabled' : label,
    inactive,
  };
}

export function renderAppearancePanel(document, view) {
  const section = document.createElement('section');
  section.id = 'ym-skins-panel';
  section.setAttribute('data-yms', 'settings.appearance');
  section.setAttribute('data-original', view.original ? '1' : '0');

  const heading = document.createElement('h2');
  heading.textContent = 'Оформление';
  section.appendChild(heading);

  const original = document.createElement('button');
  original.type = 'button';
  original.textContent = 'Оригинальная тема';
  original.setAttribute('data-action', 'original');
  original.setAttribute('aria-pressed', view.original ? 'true' : 'false');
  section.appendChild(original);

  const grid = document.createElement('div');
  grid.setAttribute('data-role', 'grid');
  for (const skin of view.skins) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = skin.name;
    button.disabled = view.inactive;
    button.setAttribute('data-skin-id', skin.id);
    button.setAttribute('aria-pressed', skin.selected ? 'true' : 'false');
    if (skin.applied) button.setAttribute('data-applied', '1');
    grid.appendChild(button);
  }
  section.appendChild(grid);

  const preview = document.createElement('p');
  preview.setAttribute('data-role', 'preview');
  preview.textContent = view.previewTitle;
  section.appendChild(preview);

  const apply = document.createElement('button');
  apply.type = 'button';
  apply.textContent = APPLY_TEXT[view.applyLabel] || APPLY_TEXT.apply;
  apply.disabled = view.applyLabel === 'disabled';
  apply.setAttribute('data-action', 'apply');
  section.appendChild(apply);
  return section;
}

export function panelSnapshot(section) {
  const grid = section.childNodes.find((node) => node.getAttribute?.('data-role') === 'grid');
  const preview = section.childNodes.find((node) => node.getAttribute?.('data-role') === 'preview');
  const apply = section.childNodes.find((node) => node.getAttribute?.('data-action') === 'apply');
  const original = section.childNodes.find((node) => node.getAttribute?.('data-action') === 'original');
  return {
    original: section.getAttribute('data-original') === '1',
    previewTitle: preview?.textContent || '',
    applyText: apply?.textContent || '',
    applyDisabled: apply?.disabled === true,
    originalPressed: original?.getAttribute('aria-pressed') === 'true',
    skins: (grid?.childNodes || []).map((node) => ({
      id: node.getAttribute('data-skin-id'),
      name: node.textContent,
      disabled: node.disabled === true,
      selected: node.getAttribute('aria-pressed') === 'true',
      applied: node.getAttribute('data-applied') === '1',
    })),
  };
}
