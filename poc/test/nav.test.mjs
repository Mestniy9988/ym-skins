import assert from 'node:assert/strict';
import test from 'node:test';

import { probeHideNav } from '../lib/nav.mjs';

test('unknown or lowercase ids are ignored and a non-matching node is not touched', () => {
  const lowercase = element('kids', 'flex');
  const other = element('SIDE_ITEM', 'block');
  const queries = [];
  const document = documentWith([lowercase, other], queries);
  const result = probeHideNav(
    document,
    followsInline,
    ['kids', 'side_item', 'NOT VALID', 'HAS-DASH', 'SIDE_ITEM_MISSING', 4, null, ''],
  );
  assert.deepEqual(result, { hideTried: false, hideApplied: false, hideReverted: false });
  assert.deepEqual(queries, ['[data-test-id="SIDE_ITEM_MISSING"]']);
  assert.deepEqual(lowercase.writes, []);
  assert.deepEqual(other.writes, []);
  assert.equal(lowercase.style.display, 'flex');
  assert.equal(other.style.display, 'block');
  assert.equal(lowercase.getAttribute('data-yms-poc-hide'), null);
  assert.equal(other.getAttribute('data-yms-poc-hide'), null);
});

test('uses the first present id when an earlier id is absent', () => {
  const second = element('PRESENT_TWO', 'flex');
  const third = element('PRESENT_THREE', 'grid');
  const queries = [];
  const document = documentWith([second, third], queries);
  const seen = [];
  const result = probeHideNav(document, (node) => {
    seen.push(node);
    return followsInline(node);
  }, ['ABSENT_ONE', 'PRESENT_TWO', 'PRESENT_THREE']);
  assert.equal(result.hiddenTestId, 'PRESENT_TWO');
  assert.deepEqual(queries, [
    '[data-test-id="ABSENT_ONE"]',
    '[data-test-id="PRESENT_TWO"]',
  ]);
  assert.deepEqual(seen, [second, second]);
  assert.deepEqual(third.writes, []);
  assert.equal(third.style.display, 'grid');
  assert.equal(third.getAttribute('data-yms-poc-hide'), null);
});

test('restores inline display and drops the hide marker when computed style follows inline display', () => {
  const node = element('NAVBAR_NAVIGATION_ITEM_KIDS', 'flex');
  const snapshots = [];
  const result = probeHideNav(documentWith([node]), (target) => {
    snapshots.push({
      display: target.style.display,
      marker: target.getAttribute('data-yms-poc-hide'),
    });
    return followsInline(target);
  }, ['NAVBAR_NAVIGATION_ITEM_KIDS']);
  assert.equal(result.hideTried, true);
  assert.equal(result.hideApplied, true);
  assert.equal(result.hideReverted, true);
  assert.equal(result.hiddenTestId, 'NAVBAR_NAVIGATION_ITEM_KIDS');
  assert.deepEqual(snapshots, [
    { display: 'none', marker: '1' },
    { display: 'flex', marker: null },
  ]);
  assert.equal(node.style.display, 'flex');
  assert.equal(node.getAttribute('data-yms-poc-hide'), null);
});

test('empty list or a missing node does not try to hide', () => {
  const idle = element('NAVBAR_NAVIGATION_ITEM_KIDS', 'block');
  const empty = probeHideNav(documentWith([idle]), followsInline, []);
  assert.deepEqual(empty, { hideTried: false, hideApplied: false, hideReverted: false });
  assert.deepEqual(idle.writes, []);

  const missing = probeHideNav(documentWith([idle]), followsInline, ['ABSENT_ITEM']);
  assert.deepEqual(missing, { hideTried: false, hideApplied: false, hideReverted: false });
  assert.deepEqual(idle.writes, []);
  assert.equal(idle.style.display, 'block');
  assert.equal(idle.getAttribute('data-yms-poc-hide'), null);
});

test('hideReverted is false when computed display stays none after inline restore', () => {
  const node = element('NAVBAR_NAVIGATION_ITEM_PLUS', 'block');
  const snapshots = [];
  const result = probeHideNav(documentWith([node]), (target) => {
    snapshots.push({
      display: target.style.display,
      marker: target.getAttribute('data-yms-poc-hide'),
    });
    return { display: 'none' };
  }, ['NAVBAR_NAVIGATION_ITEM_PLUS']);
  assert.equal(result.hideTried, true);
  assert.equal(result.hideApplied, true);
  assert.equal(result.hideReverted, false);
  assert.equal(result.hiddenTestId, 'NAVBAR_NAVIGATION_ITEM_PLUS');
  assert.deepEqual(snapshots, [
    { display: 'none', marker: '1' },
    { display: 'block', marker: null },
  ]);
  assert.equal(node.style.display, 'block');
  assert.equal(node.getAttribute('data-yms-poc-hide'), null);
});

test('restores inline style and the hide marker when getComputedStyle throws', () => {
  const node = element('NAVBAR_NAVIGATION_ITEM_KIDS', 'grid');
  const snapshots = [];
  const result = probeHideNav(documentWith([node]), (target) => {
    snapshots.push({
      display: target.style.display,
      marker: target.getAttribute('data-yms-poc-hide'),
    });
    throw new Error('computed failed');
  }, ['NAVBAR_NAVIGATION_ITEM_KIDS']);
  assert.deepEqual(result, {
    hideTried: true,
    hideApplied: false,
    hideReverted: false,
    hiddenTestId: 'NAVBAR_NAVIGATION_ITEM_KIDS',
  });
  assert.deepEqual(snapshots, [
    { display: 'none', marker: '1' },
    { display: 'grid', marker: null },
  ]);
  assert.equal(node.style.display, 'grid');
  assert.equal(node.getAttribute('data-yms-poc-hide'), null);
});

function element(testId, display) {
  const writes = [];
  let current = display;
  const node = {
    writes,
    attrs: { 'data-test-id': testId },
    setAttribute(key, value) {
      writes.push(['set', key, String(value)]);
      this.attrs[key] = String(value);
    },
    getAttribute(key) {
      return Object.prototype.hasOwnProperty.call(this.attrs, key) ? this.attrs[key] : null;
    },
    removeAttribute(key) {
      writes.push(['remove', key]);
      delete this.attrs[key];
    },
  };
  Object.defineProperty(node, 'style', {
    value: {
      get display() {
        return current;
      },
      set display(value) {
        writes.push(['display', value]);
        current = value;
      },
    },
  });
  return node;
}

function documentWith(nodes, queries = []) {
  return {
    querySelector(selector) {
      queries.push(selector);
      const match = /^\[data-test-id="([A-Z0-9_]{1,80})"\]$/.exec(selector);
      if (!match) return null;
      return nodes.find((node) => node.attrs['data-test-id'] === match[1]) || null;
    },
  };
}

function followsInline(node) {
  return { display: node.style.display || 'block' };
}
