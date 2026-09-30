import assert from 'node:assert/strict';
import test from 'node:test';

import { selectChannel } from '../lib/release-channel.mjs';

test('missing null or undefined preference defaults to stable', () => {
  const available = { stable: '5.121.2', beta: '5.122.0-beta' };
  assert.deepEqual(selectChannel({ available }), {
    channel: 'stable',
    version: '5.121.2',
    reason: 'stable',
  });
  assert.deepEqual(selectChannel({ preference: null, available }), {
    channel: 'stable',
    version: '5.121.2',
    reason: 'stable',
  });
  assert.deepEqual(selectChannel({ preference: undefined, available }), {
    channel: 'stable',
    version: '5.121.2',
    reason: 'stable',
  });
});

test('preference other than stable or beta is rejected', () => {
  const available = { stable: '1.2.3', beta: '1.2.4' };
  for (const preference of ['', 'Stable', 'nightly', 'BETA', 'alpha']) {
    assert.deepEqual(selectChannel({ preference, available }), {
      channel: null,
      version: null,
      reason: 'channel',
    });
  }
  assert.deepEqual(selectChannel({ preference: 'nightly', available: null }), {
    channel: null,
    version: null,
    reason: 'channel',
  });
});

test('non-object array or null available is empty for a valid preference', () => {
  assert.deepEqual(selectChannel({ preference: 'stable', available: null }), {
    channel: null,
    version: null,
    reason: 'empty',
  });
  assert.deepEqual(selectChannel({ preference: 'beta', available: ['1.2.3'] }), {
    channel: null,
    version: null,
    reason: 'empty',
  });
  assert.deepEqual(selectChannel({ preference: 'stable', available: '1.2.3' }), {
    channel: null,
    version: null,
    reason: 'empty',
  });
  assert.deepEqual(selectChannel({ preference: 'beta', available: 1 }), {
    channel: null,
    version: null,
    reason: 'empty',
  });
});

test('stable preference returns only a usable stable version', () => {
  assert.deepEqual(
    selectChannel({
      preference: 'stable',
      available: { stable: '1.2.3.4', beta: '9.9.9', nightly: '0.1.0' },
    }),
    { channel: 'stable', version: '1.2.3.4', reason: 'stable' },
  );
  assert.deepEqual(selectChannel({ preference: 'stable', available: { stable: '5' } }), {
    channel: 'stable',
    version: '5',
    reason: 'stable',
  });
  assert.deepEqual(
    selectChannel({ preference: 'stable', available: { beta: '2.0.0', nightly: '3.0.0' } }),
    { channel: null, version: null, reason: 'empty' },
  );
  assert.deepEqual(selectChannel({ preference: 'stable', available: { stable: '' } }), {
    channel: null,
    version: null,
    reason: 'empty',
  });
  assert.deepEqual(selectChannel({ preference: 'stable', available: { stable: '1.2.3.4.5' } }), {
    channel: null,
    version: null,
    reason: 'empty',
  });
  assert.deepEqual(selectChannel({ preference: 'stable', available: { stable: 121 } }), {
    channel: null,
    version: null,
    reason: 'empty',
  });
});

test('beta preference returns a usable beta version', () => {
  assert.deepEqual(
    selectChannel({
      preference: 'beta',
      available: { stable: '1.0.0', beta: '1.1.0', canary: '9.0.0' },
    }),
    { channel: 'beta', version: '1.1.0', reason: 'beta' },
  );
});

test('beta preference falls back to stable when beta is missing or unusable', () => {
  assert.deepEqual(selectChannel({ preference: 'beta', available: { stable: '1.2.3' } }), {
    channel: 'stable',
    version: '1.2.3',
    reason: 'beta-missing',
  });
  assert.deepEqual(
    selectChannel({ preference: 'beta', available: { stable: '4.0', beta: '1.2.3.4.5' } }),
    { channel: 'stable', version: '4.0', reason: 'beta-missing' },
  );
  assert.deepEqual(selectChannel({ preference: 'beta', available: { stable: '8', beta: '' } }), {
    channel: 'stable',
    version: '8',
    reason: 'beta-missing',
  });
  assert.deepEqual(
    selectChannel({ preference: 'beta', available: { stable: '2.1', beta: null, extra: '1' } }),
    { channel: 'stable', version: '2.1', reason: 'beta-missing' },
  );
});

test('beta preference is empty when neither beta nor stable is usable', () => {
  assert.deepEqual(selectChannel({ preference: 'beta', available: {} }), {
    channel: null,
    version: null,
    reason: 'empty',
  });
  assert.deepEqual(
    selectChannel({ preference: 'beta', available: { stable: '1.2.3.4.5', beta: 'nope', other: '1.0' } }),
    { channel: null, version: null, reason: 'empty' },
  );
  assert.deepEqual(selectChannel({ preference: 'beta', available: { stable: '', beta: '' } }), {
    channel: null,
    version: null,
    reason: 'empty',
  });
});

test('call without arguments is empty', () => {
  assert.deepEqual(selectChannel(), {
    channel: null,
    version: null,
    reason: 'empty',
  });
});
