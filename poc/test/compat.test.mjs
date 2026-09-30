import assert from 'node:assert/strict';
import test from 'node:test';

import { criticalKeys, smokeSelectors } from '../lib/compat.mjs';

const elements = {
  'player.bar': 'PLAYERBAR_DESKTOP',
  'player.play': 'PLAY_BUTTON',
  sidebar: 'NAVBAR',
  'settings.list': 'SETTINGS_LIST',
  'player.cover': 'PLAYERBAR_DESKTOP_COVER_CONTAINER',
};

test('null map yields no critical keys and smoke status no-map', () => {
  assert.deepEqual(criticalKeys(null), []);
  assert.deepEqual(criticalKeys(undefined), []);
  assert.deepEqual(smokeSelectors(), { status: 'no-map', critical: [], missing: [] });
  assert.deepEqual(smokeSelectors({ map: null, found: ['player.bar'] }), {
    status: 'no-map',
    critical: [],
    missing: [],
  });
  assert.deepEqual(smokeSelectors({ map: undefined }), {
    status: 'no-map',
    critical: [],
    missing: [],
  });
});

test('explicit critical keeps own string keys and drops unknown, non-strings, and duplicates', () => {
  const map = {
    elements: {
      'player.bar': 'PLAYERBAR_DESKTOP',
      sidebar: 'NAVBAR',
      'nav.wave': 'NAVBAR_NAVIGATION_ITEM_HOME',
    },
    critical: ['sidebar', 'missing.one', 1, null, 'sidebar', 'player.bar', 'nav.wave', 'player.bar'],
  };
  assert.deepEqual(criticalKeys(map), ['sidebar', 'player.bar', 'nav.wave']);
});

test('default critical skips keys the map does not have', () => {
  const inherited = Object.create({
    'player.play': 'PLAY_BUTTON',
    'settings.list': 'SETTINGS_LIST',
  });
  inherited.sidebar = 'NAVBAR';
  inherited['player.bar'] = 'PLAYERBAR_DESKTOP';
  assert.deepEqual(criticalKeys({ elements: inherited }), ['player.bar', 'sidebar']);
  assert.deepEqual(criticalKeys({ elements: { 'player.cover': 'COVER' } }), []);
});

test('object, Set, and array found sets count as present', () => {
  const map = { elements };
  const names = ['player.bar', 'player.play', 'sidebar', 'settings.list'];
  const fromObject = smokeSelectors({
    map,
    found: {
      'player.bar': 'PLAYERBAR_DESKTOP',
      'player.play': true,
      sidebar: 1,
      'settings.list': 'SETTINGS_LIST',
    },
  });
  const fromSet = smokeSelectors({ map, found: new Set(names) });
  const fromArray = smokeSelectors({ map, found: names });
  for (const result of [fromObject, fromSet, fromArray]) {
    assert.deepEqual(result, { status: 'compatible', critical: names, missing: [] });
  }
});

test('compatible when every critical name is present', () => {
  const result = smokeSelectors({
    map: { elements, critical: ['player.bar', 'sidebar'] },
    found: new Set(['player.bar', 'sidebar', 'player.cover']),
  });
  assert.deepEqual(result, {
    status: 'compatible',
    critical: ['player.bar', 'sidebar'],
    missing: [],
  });
});

test('safe-mode lists absent critical names in critical order', () => {
  const result = smokeSelectors({
    map: {
      elements,
      critical: ['settings.list', 'player.bar', 'nope', 'player.play', 'sidebar'],
    },
    found: { 'player.play': true, 'player.cover': true, sidebar: '' },
  });
  assert.deepEqual(result, {
    status: 'safe-mode',
    critical: ['settings.list', 'player.bar', 'player.play', 'sidebar'],
    missing: ['settings.list', 'player.bar', 'sidebar'],
  });
});

test('empty critical is compatible', () => {
  const result = smokeSelectors({
    map: { elements, critical: [] },
    found: [],
  });
  assert.deepEqual(result, { status: 'compatible', critical: [], missing: [] });
});

test('a non-critical miss stays compatible', () => {
  const result = smokeSelectors({
    map: { elements, critical: ['player.bar', 'player.play'] },
    found: ['player.bar', 'player.play'],
  });
  assert.deepEqual(result, {
    status: 'compatible',
    critical: ['player.bar', 'player.play'],
    missing: [],
  });
});
