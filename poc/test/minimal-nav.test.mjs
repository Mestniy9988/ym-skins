import assert from 'node:assert/strict';
import test from 'node:test';

import { hidePlan } from '../lib/minimal-nav.mjs';

const sidebar = 'NAVBAR';
const wave = 'NAVBAR_NAVIGATION_ITEM_HOME';
const liked = 'NAVBAR_NAVIGATION_ITEM_COLLECTION';
const search = 'NAVBAR_NAVIGATION_ITEM_SEARCH';

function mapWith(hidden, extras = {}) {
  return {
    elements: {
      sidebar,
      'nav.wave': wave,
      'nav.liked': liked,
      'nav.search': search,
      'nav.hidden': hidden,
      ...extras,
    },
  };
}

test('safe mode hides nothing', () => {
  const map = mapWith(['NAVBAR_NAVIGATION_ITEM_KIDS', wave]);
  assert.deepEqual(hidePlan({ map, smoke: { status: 'safe-mode' } }), { hide: [] });
  assert.deepEqual(hidePlan({ map, smoke: { status: 'fail' } }), { hide: [] });
  assert.deepEqual(hidePlan({ map }), { hide: [] });
  assert.deepEqual(hidePlan(), { hide: [] });
});

test('no-map smoke hides nothing', () => {
  assert.deepEqual(
    hidePlan({
      map: mapWith(['NAVBAR_NAVIGATION_ITEM_KIDS']),
      smoke: { status: 'no-map' },
    }),
    { hide: [] },
  );
});

test('a missing map or a non-array hidden list hides nothing', () => {
  const smoke = { status: 'compatible' };
  assert.deepEqual(hidePlan({ smoke }), { hide: [] });
  assert.deepEqual(hidePlan({ map: null, smoke }), { hide: [] });
  assert.deepEqual(hidePlan({ map: {}, smoke }), { hide: [] });
  assert.deepEqual(hidePlan({ map: { elements: {} }, smoke }), { hide: [] });
  assert.deepEqual(
    hidePlan({
      map: { elements: { 'nav.hidden': 'NAVBAR_NAVIGATION_ITEM_KIDS' } },
      smoke,
    }),
    { hide: [] },
  );
});

test('compatible smoke keeps a clean hidden list in order', () => {
  const hide = [
    'NAVBAR_NAVIGATION_ITEM_NON_MUSIC',
    'NAVBAR_NAVIGATION_ITEM_KIDS',
    'NAVBAR_NAVIGATION_ITEM_CONCERTS',
  ];
  assert.deepEqual(hidePlan({ map: mapWith([...hide]), smoke: { status: 'compatible' } }), {
    hide,
  });
});

test('duplicates are dropped and the first occurrence stays in place', () => {
  assert.deepEqual(
    hidePlan({
      map: mapWith([
        'NAVBAR_NAVIGATION_ITEM_KIDS',
        'NAVBAR_NAVIGATION_ITEM_PLUS',
        'NAVBAR_NAVIGATION_ITEM_KIDS',
        'NAVBAR_NAVIGATION_ITEM_PLUS',
        'NAVBAR_NAVIGATION_ITEM_CONCERTS',
      ]),
      smoke: { status: 'compatible' },
    }),
    {
      hide: [
        'NAVBAR_NAVIGATION_ITEM_KIDS',
        'NAVBAR_NAVIGATION_ITEM_PLUS',
        'NAVBAR_NAVIGATION_ITEM_CONCERTS',
      ],
    },
  );
});

test('lowercase and other ids outside the test-id pattern are rejected', () => {
  assert.deepEqual(
    hidePlan({
      map: mapWith([
        'kids',
        'NAVBAR_NAVIGATION_ITEM_KIDS',
        'has-dash',
        'NOT VALID',
        '',
        'A'.repeat(81),
        'A'.repeat(80),
        4,
        null,
        'nav_ok_1',
      ]),
      smoke: { status: 'compatible' },
    }),
    { hide: ['NAVBAR_NAVIGATION_ITEM_KIDS', 'A'.repeat(80)] },
  );
});

test('protected navbar ids stay visible even when listed under nav.hidden', () => {
  const hidden = [
    sidebar,
    'NAVBAR_NAVIGATION_ITEM_KIDS',
    wave,
    liked,
    search,
    'PLAYERBAR_DESKTOP',
    'NAVBAR_NAVIGATION_ITEM_PLUS',
    wave,
    sidebar,
  ];
  assert.deepEqual(
    hidePlan({
      map: mapWith(hidden, { 'player.bar': 'PLAYERBAR_DESKTOP' }),
      smoke: { status: 'compatible' },
    }),
    {
      hide: [
        'NAVBAR_NAVIGATION_ITEM_KIDS',
        'PLAYERBAR_DESKTOP',
        'NAVBAR_NAVIGATION_ITEM_PLUS',
      ],
    },
  );

  assert.deepEqual(
    hidePlan({
      map: {
        elements: {
          sidebar: ['NAVBAR'],
          'nav.wave': null,
          'nav.liked': 1,
          'nav.search': { id: search },
          'nav.hidden': ['NAVBAR', search, 'NAVBAR_NAVIGATION_ITEM_KIDS'],
        },
      },
      smoke: { status: 'compatible' },
    }),
    { hide: ['NAVBAR', search, 'NAVBAR_NAVIGATION_ITEM_KIDS'] },
  );
});
