import assert from 'node:assert/strict';
import test from 'node:test';

import { planTargetUpdates } from '../lib/update-targets.mjs';

const TARGETS = ['manager', 'catalog', 'maps'];

test('call without arguments skips every target because remote is missing', () => {
  assert.deepEqual(planTargetUpdates(), {
    updates: [],
    skipped: TARGETS.map((target) => ({ target, reason: 'remote' })),
  });
});

test('non-objects, arrays, and null are treated as empty records', () => {
  const skipped = TARGETS.map((target) => ({ target, reason: 'remote' }));
  assert.deepEqual(planTargetUpdates({ installed: null, remote: null }), { updates: [], skipped });
  assert.deepEqual(planTargetUpdates({ installed: ['1.0'], remote: ['2.0'] }), { updates: [], skipped });
  assert.deepEqual(planTargetUpdates({ installed: '1.0', remote: 2 }), { updates: [], skipped });
  assert.deepEqual(planTargetUpdates({}), { updates: [], skipped });
});

test('missing, non-string, or invalid remote skips with reason remote', () => {
  assert.deepEqual(
    planTargetUpdates({
      installed: { manager: '1.0', catalog: '1.0', maps: '1.0' },
      remote: { manager: undefined, catalog: 2, maps: null },
    }),
    {
      updates: [],
      skipped: [
        { target: 'manager', reason: 'remote' },
        { target: 'catalog', reason: 'remote' },
        { target: 'maps', reason: 'remote' },
      ],
    },
  );
  assert.deepEqual(
    planTargetUpdates({
      installed: { manager: '1.0', catalog: '1.0', maps: '1.0' },
      remote: { manager: '', catalog: '1.2.3.4.5', maps: 'v1.2' },
    }),
    {
      updates: [],
      skipped: [
        { target: 'manager', reason: 'remote' },
        { target: 'catalog', reason: 'remote' },
        { target: 'maps', reason: 'remote' },
      ],
    },
  );
});

test('invalid remote wins over an invalid installed version', () => {
  assert.deepEqual(
    planTargetUpdates({
      installed: { manager: 'not-a-version' },
      remote: { manager: 'also-bad' },
    }),
    {
      updates: [],
      skipped: [
        { target: 'manager', reason: 'remote' },
        { target: 'catalog', reason: 'remote' },
        { target: 'maps', reason: 'remote' },
      ],
    },
  );
});

test('a present invalid installed version skips even when remote is valid', () => {
  assert.deepEqual(
    planTargetUpdates({
      installed: { manager: '1.2.3.4.5', catalog: 'v1', maps: '1.2 ' },
      remote: { manager: '2.0', catalog: '2.0', maps: '2.0' },
    }),
    {
      updates: [],
      skipped: [
        { target: 'manager', reason: 'installed' },
        { target: 'catalog', reason: 'installed' },
        { target: 'maps', reason: 'installed' },
      ],
    },
  );
});

test('missing, non-string, or empty installed with a valid remote is a first install', () => {
  assert.deepEqual(
    planTargetUpdates({
      installed: { catalog: null, maps: '' },
      remote: { manager: '1.4', catalog: '0.9', maps: '3' },
    }),
    {
      updates: [
        { target: 'manager', from: null, to: '1.4' },
        { target: 'catalog', from: null, to: '0.9' },
        { target: 'maps', from: null, to: '3' },
      ],
      skipped: [],
    },
  );
  assert.deepEqual(
    planTargetUpdates({
      installed: { manager: 1, catalog: false },
      remote: { manager: '2.0.0', catalog: '1.0.0', maps: '4.1' },
    }).updates,
    [
      { target: 'manager', from: null, to: '2.0.0' },
      { target: 'catalog', from: null, to: '1.0.0' },
      { target: 'maps', from: null, to: '4.1' },
    ],
  );
});

test('equal versions skip with reason same', () => {
  assert.deepEqual(
    planTargetUpdates({
      installed: { manager: '1.0.0', catalog: '2', maps: '3.1.4' },
      remote: { manager: '1.0.0', catalog: '2', maps: '3.1.4' },
    }),
    {
      updates: [],
      skipped: [
        { target: 'manager', reason: 'same' },
        { target: 'catalog', reason: 'same' },
        { target: 'maps', reason: 'same' },
      ],
    },
  );
});

test('1.2 and 1.2.0 are the same version', () => {
  assert.deepEqual(
    planTargetUpdates({
      installed: { manager: '1.2', catalog: '1.2.0', maps: '1.2.0.0' },
      remote: { manager: '1.2.0', catalog: '1.2', maps: '1.2' },
    }),
    {
      updates: [],
      skipped: [
        { target: 'manager', reason: 'same' },
        { target: 'catalog', reason: 'same' },
        { target: 'maps', reason: 'same' },
      ],
    },
  );
});

test('an older remote skips with reason older', () => {
  assert.deepEqual(
    planTargetUpdates({
      installed: { manager: '2.0', catalog: '1.3', maps: '1.0.1' },
      remote: { manager: '1.9', catalog: '1.2.9', maps: '1.0.0' },
    }),
    {
      updates: [],
      skipped: [
        { target: 'manager', reason: 'older' },
        { target: 'catalog', reason: 'older' },
        { target: 'maps', reason: 'older' },
      ],
    },
  );
});

test('a newer remote is an update and keeps the original version strings', () => {
  assert.deepEqual(
    planTargetUpdates({
      installed: { manager: '1.0.0', catalog: '1.2', maps: '0.9' },
      remote: { manager: '1.0.1', catalog: '1.2.1', maps: '1' },
    }),
    {
      updates: [
        { target: 'manager', from: '1.0.0', to: '1.0.1' },
        { target: 'catalog', from: '1.2', to: '1.2.1' },
        { target: 'maps', from: '0.9', to: '1' },
      ],
      skipped: [],
    },
  );
});

test('1.10 is newer than 1.9', () => {
  assert.deepEqual(
    planTargetUpdates({
      installed: { manager: '1.9', catalog: '1.10', maps: '1.9.0' },
      remote: { manager: '1.10', catalog: '1.9', maps: '1.10' },
    }),
    {
      updates: [
        { target: 'manager', from: '1.9', to: '1.10' },
        { target: 'maps', from: '1.9.0', to: '1.10' },
      ],
      skipped: [{ target: 'catalog', reason: 'older' }],
    },
  );
});

test('mixed targets stay ordered: newer, same, and older', () => {
  assert.deepEqual(
    planTargetUpdates({
      installed: { manager: '1.0.0', catalog: '2.1', maps: '5.0' },
      remote: { manager: '1.1.0', catalog: '2.1.0', maps: '4.9' },
    }),
    {
      updates: [{ target: 'manager', from: '1.0.0', to: '1.1.0' }],
      skipped: [
        { target: 'catalog', reason: 'same' },
        { target: 'maps', reason: 'older' },
      ],
    },
  );
});

test('each target lands in exactly one list, in manager, catalog, maps order', () => {
  assert.deepEqual(
    planTargetUpdates({
      installed: { manager: 'nope', catalog: '', maps: '1.0' },
      remote: { manager: '1.0.0', catalog: '3.0', maps: '2.0' },
    }),
    {
      updates: [
        { target: 'catalog', from: null, to: '3.0' },
        { target: 'maps', from: '1.0', to: '2.0' },
      ],
      skipped: [{ target: 'manager', reason: 'installed' }],
    },
  );
});
