import assert from 'node:assert/strict';
import test from 'node:test';

import { injectionAllowed } from '../lib/kill-switch.mjs';

test('clear when the version is absent from killSwitch', () => {
  assert.deepEqual(injectionAllowed({ version: '5.121.2', flags: { killSwitch: [] } }), {
    allowed: true,
    reason: 'clear',
  });
  assert.deepEqual(injectionAllowed({ version: '5.121.2', flags: {} }), {
    allowed: true,
    reason: 'clear',
  });
});

test('exact version match disables injection', () => {
  assert.deepEqual(
    injectionAllowed({ version: '5.121.2', flags: { killSwitch: ['5.121', '5.121.2', '5.122.0'] } }),
    { allowed: false, reason: 'kill-switch' },
  );
});

test('a kill switch entry for a different version does not block', () => {
  assert.deepEqual(injectionAllowed({ version: '5.121.2', flags: { killSwitch: ['5.121.20', '5.122.0'] } }), {
    allowed: true,
    reason: 'clear',
  });
  assert.deepEqual(injectionAllowed({ version: '5.121.2', flags: { killSwitch: ['5.121.2 '] } }), {
    allowed: true,
    reason: 'clear',
  });
});

test('killSwitch present but not an array is bad flags', () => {
  assert.deepEqual(injectionAllowed({ version: '5.121.2', flags: { killSwitch: '5.121.2' } }), {
    allowed: false,
    reason: 'bad-flags',
  });
  assert.deepEqual(injectionAllowed({ version: '5.121.2', flags: { killSwitch: null } }), {
    allowed: false,
    reason: 'bad-flags',
  });
  assert.deepEqual(injectionAllowed({ version: '5.121.2', flags: { killSwitch: { 0: '5.121.2' } } }), {
    allowed: false,
    reason: 'bad-flags',
  });
});

test('empty version is unknown', () => {
  assert.deepEqual(injectionAllowed({ version: '', flags: { killSwitch: [] } }), {
    allowed: false,
    reason: 'unknown-version',
  });
  assert.deepEqual(injectionAllowed({ flags: { killSwitch: [''] } }), {
    allowed: false,
    reason: 'unknown-version',
  });
});

test('null or undefined flags allow a valid version', () => {
  assert.deepEqual(injectionAllowed({ version: '5.121.2', flags: null }), {
    allowed: true,
    reason: 'clear',
  });
  assert.deepEqual(injectionAllowed({ version: '5.121.2' }), {
    allowed: true,
    reason: 'clear',
  });
  assert.deepEqual(injectionAllowed({ version: '5.121.2', flags: undefined }), {
    allowed: true,
    reason: 'clear',
  });
});

test('five-part version is rejected', () => {
  assert.deepEqual(injectionAllowed({ version: '1.2.3.4.5', flags: { killSwitch: [] } }), {
    allowed: false,
    reason: 'unknown-version',
  });
});

test('two-part version is allowed', () => {
  assert.deepEqual(injectionAllowed({ version: '5.121', flags: { killSwitch: ['5.121.2'] } }), {
    allowed: true,
    reason: 'clear',
  });
  assert.deepEqual(injectionAllowed({ version: '5.121', flags: { killSwitch: ['5.121'] } }), {
    allowed: false,
    reason: 'kill-switch',
  });
});

test('version is not trimmed and must be digits and dots', () => {
  assert.deepEqual(injectionAllowed({ version: '5.121.2 ', flags: null }), {
    allowed: false,
    reason: 'unknown-version',
  });
  assert.deepEqual(injectionAllowed({ version: ' 5.121.2', flags: null }), {
    allowed: false,
    reason: 'unknown-version',
  });
  assert.deepEqual(injectionAllowed({ version: '5', flags: null }), {
    allowed: false,
    reason: 'unknown-version',
  });
  assert.deepEqual(injectionAllowed({ version: '5.121.2.3', flags: { killSwitch: [] } }), {
    allowed: true,
    reason: 'clear',
  });
});
