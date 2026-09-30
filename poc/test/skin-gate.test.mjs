import assert from 'node:assert/strict';
import test from 'node:test';

import { skinGate } from '../lib/skin-gate.mjs';

test('a compatible smoke with a clear gate allows the full skin', () => {
  assert.deepEqual(
    skinGate({
      smoke: { status: 'compatible' },
      injection: { allowed: true, reason: 'clear' },
      original: false,
    }),
    { apply: true, reason: 'ok' },
  );
});

test('safe mode, a missing map, the kill switch and the original theme all refuse', () => {
  assert.equal(skinGate({ smoke: { status: 'safe-mode' }, injection: { allowed: true } }).reason, 'safe-mode');
  assert.equal(skinGate({ smoke: { status: 'no-map' } }).reason, 'no-map');
  assert.equal(skinGate({}).reason, 'unknown');
  assert.deepEqual(
    skinGate({
      smoke: { status: 'compatible' },
      injection: { allowed: false, reason: 'kill-switch' },
    }),
    { apply: false, reason: 'blocked' },
  );
  assert.equal(
    skinGate({ smoke: { status: 'compatible' }, injection: { allowed: true }, original: true }).reason,
    'original',
  );
});
