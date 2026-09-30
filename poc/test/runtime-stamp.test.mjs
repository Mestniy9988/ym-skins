import assert from 'node:assert/strict';
import test from 'node:test';

import { clearStamps, stampElements } from '../lib/runtime-stamp.mjs';

function element(testId, extra = {}) {
  const attrs = { 'data-test-id': testId, ...extra };
  return {
    attrs,
    setAttribute(name, value) {
      this.attrs[name] = String(value);
    },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null;
    },
    removeAttribute(name) {
      delete this.attrs[name];
    },
  };
}

function fakeDocument(nodes) {
  return {
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
}

test('stamps one test id onto the matching element', () => {
  const play = element('PLAY_BUTTON', { role: 'button' });
  const document = fakeDocument([play]);

  const result = stampElements(document, {
    elements: { 'player.play': 'PLAY_BUTTON' },
  });

  assert.deepEqual(result, { stamped: 1 });
  assert.equal(play.getAttribute('data-yms'), 'player.play');
  assert.equal(play.getAttribute('data-yms-stamp'), '1');
  assert.equal(play.getAttribute('data-test-id'), 'PLAY_BUTTON');
  assert.equal(play.getAttribute('role'), 'button');
});

test('stamps every found id in an array with the same logical name', () => {
  const wave = element('NAV_WAVE');
  const liked = element('NAV_LIKED');
  const missing = element('UNRELATED');
  const document = fakeDocument([wave, liked, missing]);

  const result = stampElements(document, {
    elements: { 'nav.hidden': ['NAV_WAVE', 'ABSENT_ONE', 'NAV_LIKED'] },
  });

  assert.deepEqual(result, { stamped: 2 });
  assert.equal(wave.getAttribute('data-yms'), 'nav.hidden');
  assert.equal(wave.getAttribute('data-yms-stamp'), '1');
  assert.equal(liked.getAttribute('data-yms'), 'nav.hidden');
  assert.equal(liked.getAttribute('data-yms-stamp'), '1');
  assert.equal(missing.getAttribute('data-yms'), null);
  assert.equal(missing.getAttribute('data-yms-stamp'), null);
});

test('ignores lowercase ids and values that are not a string or array', () => {
  const upper = element('PLAY_BUTTON');
  const lower = element('play_button');
  const document = fakeDocument([upper, lower]);

  const result = stampElements(document, {
    elements: {
      'player.play': 'play_button',
      'player.bar': 'PLAY_BUTTON',
      'player.skip': 4,
      'player.none': null,
      'player.obj': { id: 'PLAY_BUTTON' },
      'nav.hidden': ['side_item', 'NOT VALID', '', 'PLAY_BUTTON'],
    },
  });

  assert.deepEqual(result, { stamped: 2 });
  assert.equal(upper.getAttribute('data-yms'), 'nav.hidden');
  assert.equal(upper.getAttribute('data-yms-stamp'), '1');
  assert.equal(lower.getAttribute('data-yms'), null);
  assert.equal(lower.getAttribute('data-yms-stamp'), null);
});

test('a null map or missing elements stamps nothing', () => {
  const play = element('PLAY_BUTTON');
  const document = fakeDocument([play]);

  assert.deepEqual(stampElements(document, null), { stamped: 0 });
  assert.deepEqual(stampElements(document, {}), { stamped: 0 });
  assert.deepEqual(stampElements(document, { elements: null }), { stamped: 0 });
  assert.equal(play.getAttribute('data-yms'), null);
  assert.equal(play.getAttribute('data-yms-stamp'), null);
});

test('counts each stamp write, including a node already stamped', () => {
  const play = element('PLAY_BUTTON');
  const document = fakeDocument([play]);
  const map = { elements: { 'player.play': 'PLAY_BUTTON' } };

  assert.deepEqual(stampElements(document, map), { stamped: 1 });
  assert.deepEqual(stampElements(document, map), { stamped: 1 });
  assert.equal(play.getAttribute('data-yms'), 'player.play');
  assert.equal(play.getAttribute('data-yms-stamp'), '1');
});

test('clear removes only stamped nodes and leaves other attributes', () => {
  const play = element('PLAY_BUTTON', { role: 'button' });
  const idle = element('SIDE_ITEM', { role: 'link' });
  idle.setAttribute('data-yms', 'nav.item');
  const foreign = element('OTHER_ITEM', { role: 'list' });
  foreign.setAttribute('data-yms', 'keep.me');
  foreign.setAttribute('data-yms-stamp', '0');
  const document = fakeDocument([play, idle, foreign]);

  stampElements(document, { elements: { 'player.play': 'PLAY_BUTTON' } });
  const result = clearStamps(document);

  assert.deepEqual(result, { cleared: 1 });
  assert.equal(play.getAttribute('data-yms'), null);
  assert.equal(play.getAttribute('data-yms-stamp'), null);
  assert.equal(play.getAttribute('data-test-id'), 'PLAY_BUTTON');
  assert.equal(play.getAttribute('role'), 'button');
  assert.equal(idle.getAttribute('data-yms'), 'nav.item');
  assert.equal(idle.getAttribute('data-test-id'), 'SIDE_ITEM');
  assert.equal(idle.getAttribute('role'), 'link');
  assert.equal(foreign.getAttribute('data-yms'), 'keep.me');
  assert.equal(foreign.getAttribute('data-yms-stamp'), '0');
  assert.equal(foreign.getAttribute('role'), 'list');
});

test('missing lookup methods stamp and clear nothing', () => {
  assert.deepEqual(stampElements({}, { elements: { 'player.play': 'PLAY_BUTTON' } }), { stamped: 0 });
  assert.deepEqual(stampElements(null, { elements: { 'player.play': 'PLAY_BUTTON' } }), { stamped: 0 });
  assert.deepEqual(clearStamps({}), { cleared: 0 });
  assert.deepEqual(clearStamps(null), { cleared: 0 });
});
