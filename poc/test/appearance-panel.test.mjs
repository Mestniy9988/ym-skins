import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CATALOG_SKINS,
  panelSnapshot,
  panelView,
  renderAppearancePanel,
} from '../lib/appearance-panel.mjs';

function makeElement(tag) {
  const element = {
    tag,
    id: '',
    type: '',
    textContent: '',
    disabled: false,
    childNodes: [],
    attributes: {},
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
    },
    appendChild(child) {
      this.childNodes.push(child);
      return child;
    },
  };
  return element;
}

test('catalog view marks the preview and keeps apply off the live skin', () => {
  assert.equal(CATALOG_SKINS.length, 12);
  const view = panelView({
    skins: CATALOG_SKINS,
    appliedSkinId: 'classic-98',
    previewSkinId: 'neon-cyber',
    applyLabel: 'apply',
  });
  assert.equal(view.skins.find((skin) => skin.id === 'classic-98').applied, true);
  assert.equal(view.skins.find((skin) => skin.id === 'neon-cyber').selected, true);
  assert.equal(view.previewTitle, 'Neon Cyber');
  assert.equal(view.applyLabel, 'apply');
  assert.equal(view.inactive, false);
});

test('original theme clears the preview and disables the grid', () => {
  const document = { createElement: (tag) => makeElement(tag) };
  const view = panelView({
    original: true,
    skins: CATALOG_SKINS,
    appliedSkinId: 'classic-98',
    previewSkinId: 'neon-cyber',
    applyLabel: 'apply',
  });
  const section = renderAppearancePanel(document, view);
  const snap = panelSnapshot(section);
  assert.equal(renderAppearancePanel.toString().includes('innerHTML'), false);
  assert.equal(snap.original, true);
  assert.equal(snap.originalPressed, true);
  assert.equal(snap.previewTitle, '');
  assert.equal(snap.applyText, 'Применить скин');
  assert.equal(snap.applyDisabled, true);
  assert.equal(snap.skins.length, 12);
  assert.equal(snap.skins.every((skin) => skin.disabled && !skin.selected && !skin.applied), true);
  assert.equal(snap.skins[0].name, "Classic '98");
});

test('an applied skin button reads Скин применён', () => {
  const document = { createElement: (tag) => makeElement(tag) };
  const view = panelView({
    skins: [{ id: 'aqua-jelly', name: 'Aqua Jelly' }],
    appliedSkinId: 'aqua-jelly',
    applyLabel: 'applied',
  });
  const snap = panelSnapshot(renderAppearancePanel(document, view));
  assert.equal(snap.applyText, 'Скин применён');
  assert.equal(snap.applyDisabled, false);
  assert.equal(snap.skins[0].applied, true);
  assert.equal(snap.skins[0].selected, true);
  assert.equal(snap.previewTitle, 'Aqua Jelly');
});
