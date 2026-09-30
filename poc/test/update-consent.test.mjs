import assert from 'node:assert/strict';
import test from 'node:test';

import { decideApplyMode } from '../lib/update-consent.mjs';

test('a call without arguments refuses because the target is missing', () => {
  assert.deepEqual(decideApplyMode(), { apply: false, reason: 'target' });
  assert.deepEqual(decideApplyMode({}), { apply: false, reason: 'target' });
});

test('an unknown target is refused even when auto and confirmed are set', () => {
  assert.deepEqual(decideApplyMode({ target: 'skin', auto: true, confirmed: true }), {
    apply: false,
    reason: 'target',
  });
  assert.deepEqual(decideApplyMode({ target: 'Manager' }), { apply: false, reason: 'target' });
  assert.deepEqual(decideApplyMode({ target: '' }), { apply: false, reason: 'target' });
  assert.deepEqual(decideApplyMode({ target: null, auto: true }), { apply: false, reason: 'target' });
});

test('auto true applies a manager update even when it is not confirmed', () => {
  assert.deepEqual(decideApplyMode({ target: 'manager', auto: true, confirmed: false }), {
    apply: true,
    reason: 'auto',
  });
  assert.deepEqual(decideApplyMode({ target: 'manager', auto: true }), {
    apply: true,
    reason: 'auto',
  });
  assert.deepEqual(decideApplyMode({ target: 'manager', auto: true, confirmed: true }), {
    apply: true,
    reason: 'auto',
  });
});

test('auto true applies a maps update', () => {
  assert.deepEqual(decideApplyMode({ target: 'maps', auto: true, confirmed: false }), {
    apply: true,
    reason: 'auto',
  });
  assert.deepEqual(decideApplyMode({ target: 'maps', auto: true }), {
    apply: true,
    reason: 'auto',
  });
});

test('auto true applies a catalog update', () => {
  assert.deepEqual(decideApplyMode({ target: 'catalog', auto: true, confirmed: false }), {
    apply: true,
    reason: 'auto',
  });
});

test('a string auto flag is not auto and a catalog update still runs in the background', () => {
  assert.deepEqual(decideApplyMode({ target: 'catalog', auto: 'true' }), {
    apply: true,
    reason: 'background',
  });
  assert.deepEqual(decideApplyMode({ target: 'catalog', auto: false }), {
    apply: true,
    reason: 'background',
  });
  assert.deepEqual(decideApplyMode({ target: 'catalog' }), {
    apply: true,
    reason: 'background',
  });
  assert.deepEqual(decideApplyMode({ target: 'catalog', confirmed: false }), {
    apply: true,
    reason: 'background',
  });
});

test('maps updates run in the background without confirmation when auto is not true', () => {
  assert.deepEqual(decideApplyMode({ target: 'maps' }), { apply: true, reason: 'background' });
  assert.deepEqual(decideApplyMode({ target: 'maps', auto: false, confirmed: false }), {
    apply: true,
    reason: 'background',
  });
  assert.deepEqual(decideApplyMode({ target: 'maps', auto: 'true', confirmed: true }), {
    apply: true,
    reason: 'background',
  });
});

test('a confirmed manager update applies when auto is not true', () => {
  assert.deepEqual(decideApplyMode({ target: 'manager', confirmed: true }), {
    apply: true,
    reason: 'confirmed',
  });
  assert.deepEqual(decideApplyMode({ target: 'manager', auto: false, confirmed: true }), {
    apply: true,
    reason: 'confirmed',
  });
  assert.deepEqual(decideApplyMode({ target: 'manager', auto: 'true', confirmed: true }), {
    apply: true,
    reason: 'confirmed',
  });
});

test('a manager update without confirmation waits', () => {
  assert.deepEqual(decideApplyMode({ target: 'manager' }), { apply: false, reason: 'needs-confirm' });
  assert.deepEqual(decideApplyMode({ target: 'manager', confirmed: false }), {
    apply: false,
    reason: 'needs-confirm',
  });
  assert.deepEqual(decideApplyMode({ target: 'manager', auto: false }), {
    apply: false,
    reason: 'needs-confirm',
  });
  assert.deepEqual(decideApplyMode({ target: 'manager', auto: 'true', confirmed: 'true' }), {
    apply: false,
    reason: 'needs-confirm',
  });
});
