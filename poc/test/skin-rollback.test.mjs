import assert from 'node:assert/strict';
import test from 'node:test';

import { decideSkinRollback } from '../lib/skin-rollback.mjs';

test('no arguments keeps the skin', () => {
  assert.deepEqual(decideSkinRollback(), { action: 'keep', version: null, reason: 'ok' });
});

test('failed false keeps the skin and ignores applied and previous', () => {
  assert.deepEqual(
    decideSkinRollback({ failed: false, applied: '1.0.0', previous: '0.9.0' }),
    { action: 'keep', version: null, reason: 'ok' },
  );
});

test('failed string true keeps the skin', () => {
  assert.deepEqual(
    decideSkinRollback({ failed: 'true', applied: '2.0', previous: '1.0' }),
    { action: 'keep', version: null, reason: 'ok' },
  );
});

test('failed true restores a valid previous when nothing is applied', () => {
  assert.deepEqual(decideSkinRollback({ failed: true, previous: '1' }), {
    action: 'restore',
    version: '1',
    reason: 'previous',
  });
  assert.deepEqual(decideSkinRollback({ failed: true, applied: null, previous: '1.2' }), {
    action: 'restore',
    version: '1.2',
    reason: 'previous',
  });
});

test('failed true restores a valid previous when applied is not a string', () => {
  assert.deepEqual(decideSkinRollback({ failed: true, applied: 3, previous: '1.2.3' }), {
    action: 'restore',
    version: '1.2.3',
    reason: 'previous',
  });
});

test('failed true restores a valid previous when applied is a different valid version', () => {
  assert.deepEqual(decideSkinRollback({ failed: true, applied: '1.2.3.4', previous: '9.8.7.6' }), {
    action: 'restore',
    version: '9.8.7.6',
    reason: 'previous',
  });
});

test('failed true removes the skin when previous equals applied', () => {
  assert.deepEqual(decideSkinRollback({ failed: true, applied: '4.5.6', previous: '4.5.6' }), {
    action: 'remove',
    version: null,
    reason: 'same',
  });
});

test('failed true restores a valid previous when applied is not a version', () => {
  assert.deepEqual(
    decideSkinRollback({ failed: true, applied: '1.2.3.4.5', previous: '1.0' }),
    { action: 'restore', version: '1.0', reason: 'previous' },
  );
});

test('failed true removes the skin when previous has five parts', () => {
  assert.deepEqual(
    decideSkinRollback({ failed: true, applied: '1.0', previous: '1.2.3.4.5' }),
    { action: 'remove', version: null, reason: 'no-previous' },
  );
});

test('failed true removes the skin when previous is missing or invalid', () => {
  assert.deepEqual(decideSkinRollback({ failed: true, applied: '1.0.0' }), {
    action: 'remove',
    version: null,
    reason: 'no-previous',
  });
  assert.deepEqual(decideSkinRollback({ failed: true, previous: '' }), {
    action: 'remove',
    version: null,
    reason: 'no-previous',
  });
  assert.deepEqual(decideSkinRollback({ failed: true, previous: 'v1.2' }), {
    action: 'remove',
    version: null,
    reason: 'no-previous',
  });
});
