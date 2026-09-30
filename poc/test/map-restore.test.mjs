import assert from 'node:assert/strict';
import test from 'node:test';

import { decideMapRestore } from '../lib/map-restore.mjs';

test('blocked injection stays off and ignores mode and smoke', () => {
  assert.deepEqual(
    decideMapRestore({
      mode: 'full',
      smoke: { status: 'compatible' },
      injection: { allowed: false },
    }),
    { action: 'stay-off', reason: 'blocked' },
  );
  assert.deepEqual(
    decideMapRestore({
      mode: 'safe',
      smoke: { status: 'compatible' },
      injection: { allowed: false },
    }),
    { action: 'stay-off', reason: 'blocked' },
  );
  assert.deepEqual(decideMapRestore({ injection: { allowed: false } }), {
    action: 'stay-off',
    reason: 'blocked',
  });
});

test('missing or unknown mode stays safe', () => {
  assert.deepEqual(decideMapRestore(), { action: 'stay-safe', reason: 'mode' });
  assert.deepEqual(decideMapRestore({}), { action: 'stay-safe', reason: 'mode' });
  assert.deepEqual(decideMapRestore({ mode: 'off', smoke: { status: 'compatible' } }), {
    action: 'stay-safe',
    reason: 'mode',
  });
  assert.deepEqual(decideMapRestore({ mode: '', smoke: { status: 'compatible' } }), {
    action: 'stay-safe',
    reason: 'mode',
  });
  assert.deepEqual(decideMapRestore({ mode: null, smoke: { status: 'compatible' } }), {
    action: 'stay-safe',
    reason: 'mode',
  });
});

test('smoke that is not an object or has an unknown status stays safe', () => {
  assert.deepEqual(decideMapRestore({ mode: 'safe', smoke: null }), {
    action: 'stay-safe',
    reason: 'smoke',
  });
  assert.deepEqual(decideMapRestore({ mode: 'waiting', smoke: 'compatible' }), {
    action: 'stay-safe',
    reason: 'smoke',
  });
  assert.deepEqual(decideMapRestore({ mode: 'full' }), {
    action: 'stay-safe',
    reason: 'smoke',
  });
  assert.deepEqual(decideMapRestore({ mode: 'safe', smoke: {} }), {
    action: 'stay-safe',
    reason: 'smoke',
  });
  assert.deepEqual(decideMapRestore({ mode: 'waiting', smoke: { status: 'fail' } }), {
    action: 'stay-safe',
    reason: 'smoke',
  });
});

test('full mode with a compatible smoke keeps the full skin', () => {
  assert.deepEqual(decideMapRestore({ mode: 'full', smoke: { status: 'compatible' } }), {
    action: 'keep-full',
    reason: 'already',
  });
  assert.deepEqual(
    decideMapRestore({
      mode: 'full',
      smoke: { status: 'compatible' },
      injection: { allowed: true },
    }),
    { action: 'keep-full', reason: 'already' },
  );
});

test('full mode with a non-compatible smoke stays safe', () => {
  assert.deepEqual(decideMapRestore({ mode: 'full', smoke: { status: 'safe-mode' } }), {
    action: 'stay-safe',
    reason: 'smoke',
  });
  assert.deepEqual(decideMapRestore({ mode: 'full', smoke: { status: 'no-map' } }), {
    action: 'stay-safe',
    reason: 'smoke',
  });
});

test('safe or waiting mode with a compatible smoke restores the full skin', () => {
  assert.deepEqual(decideMapRestore({ mode: 'safe', smoke: { status: 'compatible' } }), {
    action: 'full-skin',
    reason: 'map',
  });
  assert.deepEqual(decideMapRestore({ mode: 'waiting', smoke: { status: 'compatible' } }), {
    action: 'full-skin',
    reason: 'map',
  });
  assert.deepEqual(
    decideMapRestore({
      mode: 'safe',
      smoke: { status: 'compatible' },
      injection: { allowed: true },
    }),
    { action: 'full-skin', reason: 'map' },
  );
  assert.deepEqual(
    decideMapRestore({
      mode: 'waiting',
      smoke: { status: 'compatible' },
      injection: null,
    }),
    { action: 'full-skin', reason: 'map' },
  );
});

test('safe or waiting mode with safe-mode or no-map smoke stays safe', () => {
  assert.deepEqual(decideMapRestore({ mode: 'safe', smoke: { status: 'safe-mode' } }), {
    action: 'stay-safe',
    reason: 'smoke',
  });
  assert.deepEqual(decideMapRestore({ mode: 'safe', smoke: { status: 'no-map' } }), {
    action: 'stay-safe',
    reason: 'smoke',
  });
  assert.deepEqual(decideMapRestore({ mode: 'waiting', smoke: { status: 'safe-mode' } }), {
    action: 'stay-safe',
    reason: 'smoke',
  });
  assert.deepEqual(
    decideMapRestore({
      mode: 'waiting',
      smoke: { status: 'no-map' },
      injection: { allowed: true },
    }),
    { action: 'stay-safe', reason: 'smoke' },
  );
});
