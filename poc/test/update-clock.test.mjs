import assert from 'node:assert/strict';
import test from 'node:test';

import { dueForCheck } from '../lib/update-clock.mjs';

test('the first check is due, and a later check waits for the interval', () => {
  assert.deepEqual(dueForCheck(null, '2026-09-30T12:00:00.000Z', 6), { due: true, reason: 'never' });
  assert.deepEqual(
    dueForCheck('2026-09-30T11:00:00.000Z', '2026-09-30T12:00:00.000Z', 6),
    { due: false, reason: 'wait' },
  );
  assert.deepEqual(
    dueForCheck('2026-09-30T00:00:00.000Z', '2026-09-30T06:00:00.000Z', 6),
    { due: true, reason: 'elapsed' },
  );
});

test('a backwards clock and a bad interval are not due', () => {
  assert.equal(dueForCheck('2026-09-30T13:00:00.000Z', '2026-09-30T12:00:00.000Z', 6).reason, 'clock');
  assert.equal(dueForCheck(null, '2026-09-30T12:00:00.000Z', 0).reason, 'interval');
  assert.equal(dueForCheck(null, 'not-a-date', 6).reason, 'now');
  assert.equal(dueForCheck('yesterday', '2026-09-30T12:00:00.000Z', 6).reason, 'last');
});
