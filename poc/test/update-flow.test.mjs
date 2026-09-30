import assert from 'node:assert/strict';
import test from 'node:test';

import { planUpdateCycle } from '../lib/update-flow.mjs';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

function snap(version, asarHash = HASH_A) {
  return { version, asarHash };
}

test('a newer client version plans maps, background catalog and a confirm for the manager', () => {
  const plan = planUpdateCycle({
    previous: snap('5.121.2'),
    current: snap('5.122.0', HASH_B),
    preference: 'stable',
    available: { stable: '1.4.0', beta: '1.5.0' },
    installed: { manager: '1.3.0', catalog: '2.0.0', maps: '3.0.0' },
    remote: { manager: '1.4.0', catalog: '2.1.0', maps: '3.0.0' },
    auto: false,
    confirmed: false,
    hasCurrentMap: true,
    previousSmoke: 'fail',
    mode: 'safe',
    smoke: { status: 'compatible' },
    injection: { allowed: true },
    consent: true,
    ymVersion: '5.122.0',
    missing: ['player.bar'],
    email: 'user@example.com',
  });

  assert.deepEqual(plan.watch, { changed: true, reason: 'version' });
  assert.deepEqual(plan.channel, { channel: 'stable', version: '1.4.0', reason: 'stable' });
  assert.equal(plan.due, null);
  assert.deepEqual(plan.steps, [
    { target: 'manager', from: '1.3.0', to: '1.4.0', apply: false, reason: 'needs-confirm' },
    { target: 'catalog', from: '2.0.0', to: '2.1.0', apply: true, reason: 'background' },
  ]);
  assert.deepEqual(plan.targets.skipped, [{ target: 'maps', reason: 'same' }]);
  assert.deepEqual(plan.ym, { action: 'apply-current-map', reason: 'current-map' });
  assert.deepEqual(plan.map, { action: 'full-skin', reason: 'map' });
  assert.deepEqual(plan.rollback, { action: 'keep', version: null, reason: 'ok' });
  assert.deepEqual(plan.report, { send: false, reason: 'compatible', payload: null });
  assert.equal('email' in plan, false);
});

test('a failed skin update restores the previous version', () => {
  const plan = planUpdateCycle({
    previous: snap('5.121.2'),
    current: snap('5.121.2'),
    preference: 'stable',
    available: { stable: '1.0.0' },
    installed: { catalog: '2.0.0' },
    remote: { catalog: '2.1.0' },
    skinFailed: true,
    skinApplied: '2.1.0',
    skinPrevious: '2.0.0',
    hasCurrentMap: true,
    mode: 'full',
    smoke: { status: 'safe-mode' },
    consent: true,
    ymVersion: '5.121.2',
    missing: ['player.play', 'player.play'],
    token: 'secret',
  });

  assert.deepEqual(plan.watch, { changed: false, reason: 'same' });
  assert.deepEqual(plan.ym, { action: 'keep', reason: 'unchanged' });
  assert.deepEqual(plan.rollback, { action: 'restore', version: '2.0.0', reason: 'previous' });
  assert.deepEqual(plan.steps, [
    { target: 'catalog', from: '2.0.0', to: '2.1.0', apply: true, reason: 'background' },
  ]);
  assert.deepEqual(plan.map, { action: 'stay-safe', reason: 'smoke' });
  assert.deepEqual(plan.report, {
    send: true,
    reason: 'ok',
    payload: { ymVersion: '5.121.2', missing: ['player.play'] },
  });
  assert.equal(JSON.stringify(plan).includes('secret'), false);
});

test('an asar change without a map waits, and a later compatible map restores the full skin', () => {
  const waiting = planUpdateCycle({
    previous: snap('5.121.2', HASH_A),
    current: snap('5.121.2', HASH_B),
    hasCurrentMap: false,
    previousSmoke: 'fail',
    mode: 'waiting',
    smoke: { status: 'no-map' },
  });
  assert.deepEqual(waiting.watch, { changed: true, reason: 'asar' });
  assert.deepEqual(waiting.ym, { action: 'awaiting-map', reason: 'no-map' });
  assert.deepEqual(waiting.map, { action: 'stay-safe', reason: 'smoke' });

  const restored = planUpdateCycle({
    previous: snap('5.121.2', HASH_A),
    current: snap('5.121.2', HASH_B),
    hasCurrentMap: true,
    mode: 'waiting',
    smoke: { status: 'compatible' },
  });
  assert.deepEqual(restored.ym, { action: 'apply-current-map', reason: 'current-map' });
  assert.deepEqual(restored.map, { action: 'full-skin', reason: 'map' });
});

test('a closed channel and a kill switch do not apply files or the skin', () => {
  const plan = planUpdateCycle({
    previous: snap('5.121.2'),
    current: snap('5.122.0'),
    preference: 'nightly',
    available: { stable: '1.4.0' },
    installed: { manager: '1.0.0' },
    remote: { manager: '1.4.0', catalog: '9.0.0' },
    auto: true,
    hasCurrentMap: true,
    mode: 'full',
    smoke: { status: 'compatible' },
    injection: { allowed: false, reason: 'kill-switch' },
  });

  assert.deepEqual(plan.channel, { channel: null, version: null, reason: 'channel' });
  assert.deepEqual(plan.targets.skipped, [
    { target: 'manager', reason: 'channel' },
    { target: 'catalog', reason: 'channel' },
    { target: 'maps', reason: 'channel' },
  ]);
  assert.deepEqual(plan.steps, []);
  assert.deepEqual(plan.map, { action: 'stay-off', reason: 'blocked' });
});

test('before the check interval file updates wait, the client snapshot still counts', () => {
  const plan = planUpdateCycle({
    previous: snap('5.121.2'),
    current: snap('5.122.0'),
    preference: 'beta',
    available: { beta: '2.0.0' },
    installed: { manager: '1.0.0' },
    remote: { manager: '2.0.0' },
    auto: true,
    hasCurrentMap: true,
    lastCheck: '2026-09-30T10:00:00.000Z',
    now: '2026-09-30T11:00:00.000Z',
    intervalHours: 6,
  });

  assert.deepEqual(plan.due, { due: false, reason: 'wait' });
  assert.deepEqual(plan.channel, { channel: 'beta', version: '2.0.0', reason: 'beta' });
  assert.deepEqual(plan.targets.skipped, [
    { target: 'manager', reason: 'wait' },
    { target: 'catalog', reason: 'wait' },
    { target: 'maps', reason: 'wait' },
  ]);
  assert.deepEqual(plan.steps, []);
  assert.deepEqual(plan.ym, { action: 'apply-current-map', reason: 'current-map' });
});

test('automatic mode applies the manager when the interval has elapsed', () => {
  const plan = planUpdateCycle({
    preference: 'stable',
    available: { stable: '1.4.0' },
    installed: { manager: '1.3.0', catalog: '1.0.0', maps: '1.0.0' },
    remote: { manager: '1.4.0', catalog: '1.0.0', maps: '0.9.0' },
    auto: true,
    lastCheck: '2026-09-29T10:00:00.000Z',
    now: '2026-09-30T10:00:00.000Z',
    intervalHours: 6,
  });

  assert.deepEqual(plan.due, { due: true, reason: 'elapsed' });
  assert.deepEqual(plan.steps, [
    { target: 'manager', from: '1.3.0', to: '1.4.0', apply: true, reason: 'auto' },
  ]);
  assert.deepEqual(plan.targets.skipped, [
    { target: 'catalog', reason: 'same' },
    { target: 'maps', reason: 'older' },
  ]);
});

test('the first snapshot is a baseline and a missing snapshot does not apply a map', () => {
  const first = planUpdateCycle({
    current: snap('5.121.2'),
    hasCurrentMap: true,
    previousSmoke: 'pass',
  });
  assert.deepEqual(first.watch, { changed: false, reason: 'first-seen' });
  assert.deepEqual(first.ym, { action: 'keep', reason: 'unchanged' });

  const missing = planUpdateCycle({
    previous: snap('5.121.2'),
    hasCurrentMap: true,
    previousSmoke: 'pass',
  });
  assert.deepEqual(missing.watch, { changed: false, reason: 'missing' });
  assert.deepEqual(missing.ym, { action: 'awaiting-map', reason: 'unknown-snapshot' });
});

test('no arguments produce an empty local plan', () => {
  const plan = planUpdateCycle();
  assert.deepEqual(plan.watch, { changed: false, reason: 'missing' });
  assert.deepEqual(plan.channel, { channel: null, version: null, reason: 'empty' });
  assert.equal(plan.due, null);
  assert.deepEqual(plan.steps, []);
  assert.deepEqual(plan.rollback, { action: 'keep', version: null, reason: 'ok' });
  assert.deepEqual(plan.map, { action: 'stay-safe', reason: 'mode' });
  assert.deepEqual(plan.report, { send: false, reason: 'no-consent', payload: null });
});
