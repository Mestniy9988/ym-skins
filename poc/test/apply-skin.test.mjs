import assert from 'node:assert/strict';
import test from 'node:test';

import { installSkinStyle, probeTestSkin, TEST_SKIN_COLOR, TEST_SKIN_STYLE_ID } from '../lib/apply-skin.mjs';
import { auditExpression } from '../lib/plan.mjs';
import { selectorMapFor } from '../lib/selector-map.mjs';
import { testSkinCss } from '../lib/skin-css.mjs';

function element(tag) {
  return {
    tag,
    id: '',
    textContent: '',
    attrs: {},
    children: [],
    setAttribute(name, value) {
      this.attrs[name] = String(value);
    },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null;
    },
    removeAttribute(name) {
      delete this.attrs[name];
    },
    appendChild(child) {
      this.children.push(child);
      child.parent = this;
    },
    remove() {
      const index = this.parent?.children.indexOf(this) ?? -1;
      if (index >= 0) this.parent.children.splice(index, 1);
      this.removed = true;
    },
  };
}

function documentWith(nodes) {
  const head = element('head');
  const ids = new Map();
  const document = {
    head,
    createElement: (tag) => element(tag),
    getElementById(id) {
      const node = ids.get(id);
      return node && !node.removed ? node : null;
    },
    querySelector(selector) {
      const match = /^\[data-yms="([^"]+)"\]$/.exec(selector)
        || /^\[data-test-id="([A-Z0-9_]{1,80})"\]$/.exec(selector);
      if (!match) return null;
      return nodes.find((node) => node.getAttribute('data-yms') === match[1]
        || node.getAttribute('data-test-id') === match[1]) || null;
    },
    querySelectorAll(selector) {
      if (selector !== '[data-yms-stamp="1"]') return [];
      return nodes.filter((node) => node.getAttribute('data-yms-stamp') === '1');
    },
  };
  const original = head.appendChild.bind(head);
  head.appendChild = (child) => {
    original(child);
    if (child.id) ids.set(child.id, child);
  };
  return document;
}

test('install swaps the same style node and refuses a remote rule', () => {
  const document = documentWith([]);
  const first = installSkinStyle(document, testSkinCss());
  const secondCss = '[data-yms="player.bar"] { background-color: rgb(1, 2, 3) !important; }';
  const second = installSkinStyle(document, secondCss);
  assert.equal(first.applied, true);
  assert.equal(first.swapped, false);
  assert.equal(second.applied, true);
  assert.equal(second.swapped, true);
  assert.equal(document.head.children.length, 1);
  assert.equal(document.getElementById(TEST_SKIN_STYLE_ID).textContent, secondCss);
  assert.equal(installSkinStyle(document, '.x { background: url(https://example.test/a.png) }').applied, false);
  assert.equal(document.getElementById(TEST_SKIN_STYLE_ID).textContent, secondCss);
});

test('probe paints the play control and removes the style and stamps', () => {
  const play = element('button');
  play.setAttribute('data-test-id', 'PLAY_BUTTON');
  const document = documentWith([play]);
  const result = probeTestSkin(document, selectorMapFor('5.121.2'), (node) => {
    if (node.getAttribute('data-yms') === 'player.play') return { backgroundColor: TEST_SKIN_COLOR };
    return { backgroundColor: 'rgb(0, 0, 0)' };
  });
  assert.equal(result.stamped > 0, true);
  assert.equal(result.styleApplied, true);
  assert.equal(result.playColored, true);
  assert.equal(result.styleRemoved, true);
  assert.equal(result.stampsCleared, true);
  assert.equal(play.getAttribute('data-yms'), null);
  assert.equal(document.getElementById(TEST_SKIN_STYLE_ID), null);
  assert.equal(auditExpression(probeTestSkin.toString()), null);
  assert.equal(auditExpression(installSkinStyle.toString()), null);
});

test('probe does not insert a style when the map matches nothing', () => {
  const document = documentWith([]);
  const result = probeTestSkin(document, selectorMapFor('5.121.2'), () => ({ backgroundColor: TEST_SKIN_COLOR }));
  assert.deepEqual(result, {
    stamped: 0,
    styleApplied: false,
    playColored: false,
    styleRemoved: true,
    stampsCleared: true,
  });
  assert.equal(document.head.children.length, 0);
});
