import assert from 'node:assert/strict';
import test from 'node:test';

import { applySkinRuntime, clearSkinRuntime } from '../lib/skin-runtime.mjs';
import { testSkinCss } from '../lib/skin-css.mjs';

function element(tag) {
  const styleProps = new Map();
  return {
    tag,
    id: '',
    attrs: {},
    children: [],
    style: {
      setProperty(name, value) {
        styleProps.set(name, value);
      },
      removeProperty(name) {
        styleProps.delete(name);
      },
      get(name) {
        return styleProps.get(name);
      },
    },
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

function makeDocument(nodes) {
  const head = element('head');
  const root = element('html');
  const ids = new Map();
  let created = 0;
  const document = {
    head,
    documentElement: root,
    createElement(tag) {
      created += 1;
      return element(tag);
    },
    createdCount() {
      return created;
    },
    getElementById(id) {
      const node = ids.get(id);
      return node && !node.removed ? node : null;
    },
    querySelector(selector) {
      const match = /^\[data-test-id="([A-Z0-9_]{1,80})"\]$/.exec(selector);
      if (!match) return null;
      return nodes.find((node) => node.getAttribute('data-test-id') === match[1]) || null;
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

const map = { elements: { 'player.play': 'PLAY_BUTTON' } };
const openGate = { apply: true, reason: 'ok' };

test('a closed gate does not stamp or create a style', () => {
  const play = element('button');
  play.setAttribute('data-test-id', 'PLAY_BUTTON');
  const document = makeDocument([play]);
  const result = applySkinRuntime({
    document,
    map,
    css: testSkinCss(),
    gate: { apply: false, reason: 'safe-mode' },
  });
  assert.deepEqual(result, { applied: false, reason: 'safe-mode', stamped: 0 });
  assert.equal(document.createdCount(), 0);
  assert.equal(play.getAttribute('data-yms'), null);
});

test('an open gate installs css and player variables, then clear removes them', () => {
  const play = element('button');
  play.setAttribute('data-test-id', 'PLAY_BUTTON');
  const document = makeDocument([play]);
  const result = applySkinRuntime({
    document,
    map,
    css: testSkinCss(),
    playerState: { title: 'Ночь', artist: 'А', progress: 0.5, playing: true },
    gate: openGate,
  });
  assert.equal(result.applied, true);
  assert.equal(result.stamped, 1);
  assert.equal(result.variables, true);
  assert.equal(play.getAttribute('data-yms'), 'player.play');
  assert.equal(document.documentElement.style.get('--yms-title'), 'Ночь');
  assert.equal(document.documentElement.style.get('--yms-playing'), '1');
  assert.equal(document.getElementById('ym-skins-runtime').textContent.includes('[data-yms="player.play"]'), true);

  const cleared = clearSkinRuntime(document);
  assert.equal(cleared.cleared, 1);
  assert.equal(cleared.styleRemoved, true);
  assert.equal(play.getAttribute('data-yms'), null);
  assert.equal(document.documentElement.style.get('--yms-title'), undefined);
  assert.equal(document.getElementById('ym-skins-runtime'), null);
});

test('a remote rule is refused and the stamps do not stay', () => {
  const play = element('button');
  play.setAttribute('data-test-id', 'PLAY_BUTTON');
  const document = makeDocument([play]);
  const result = applySkinRuntime({
    document,
    map,
    css: '[data-yms="player.play"] { background: url(https://example.test/a.png) }',
    gate: openGate,
  });
  assert.equal(result.applied, false);
  assert.equal(result.reason, 'forbidden');
  assert.equal(play.getAttribute('data-yms'), null);
  assert.equal(document.getElementById('ym-skins-runtime'), null);
});
