import assert from 'node:assert/strict';
import test from 'node:test';

import { decideUpdate } from '../lib/update-policy.mjs';

test('unchanged snapshot keeps the current install and ignores maps', () => {
  assert.deepEqual(
    decideUpdate({ snapshot: { status: 'unchanged' }, hasCurrentMap: true, previousSmoke: 'pass' }),
    { action: 'keep', reason: 'unchanged' },
  );
  assert.deepEqual(
    decideUpdate({ snapshot: { status: 'unchanged' }, hasCurrentMap: false, previousSmoke: 'fail' }),
    { action: 'keep', reason: 'unchanged' },
  );
  assert.deepEqual(decideUpdate({ snapshot: { status: 'unchanged' } }), {
    action: 'keep',
    reason: 'unchanged',
  });
});

test('changed version applies the current map when one exists', () => {
  assert.deepEqual(
    decideUpdate({ snapshot: { status: 'changed' }, hasCurrentMap: true, previousSmoke: 'fail' }),
    { action: 'apply-current-map', reason: 'current-map' },
  );
});

test('no-baseline applies the current map when one exists', () => {
  assert.deepEqual(
    decideUpdate({ snapshot: { status: 'no-baseline' }, hasCurrentMap: true, previousSmoke: null }),
    { action: 'apply-current-map', reason: 'current-map' },
  );
});

test('current map wins over a passing previous smoke', () => {
  assert.deepEqual(
    decideUpdate({ snapshot: { status: 'changed' }, hasCurrentMap: true, previousSmoke: 'pass' }),
    { action: 'apply-current-map', reason: 'current-map' },
  );
  assert.deepEqual(
    decideUpdate({ snapshot: { status: 'no-baseline' }, hasCurrentMap: true, previousSmoke: 'pass' }),
    { action: 'apply-current-map', reason: 'current-map' },
  );
});

test('changed version falls back to the previous map only when its smoke passed', () => {
  assert.deepEqual(
    decideUpdate({ snapshot: { status: 'changed' }, hasCurrentMap: false, previousSmoke: 'pass' }),
    { action: 'apply-previous-map', reason: 'previous-map' },
  );
});

test('no-baseline falls back to the previous map only when its smoke passed', () => {
  assert.deepEqual(
    decideUpdate({ snapshot: { status: 'no-baseline' }, hasCurrentMap: false, previousSmoke: 'pass' }),
    { action: 'apply-previous-map', reason: 'previous-map' },
  );
  assert.deepEqual(decideUpdate({ snapshot: { status: 'no-baseline' }, previousSmoke: 'pass' }), {
    action: 'apply-previous-map',
    reason: 'previous-map',
  });
});

test('changed version awaits a map when previous smoke failed', () => {
  assert.deepEqual(
    decideUpdate({ snapshot: { status: 'changed' }, hasCurrentMap: false, previousSmoke: 'fail' }),
    { action: 'awaiting-map', reason: 'no-map' },
  );
});

test('changed version awaits a map when previous smoke is null', () => {
  assert.deepEqual(
    decideUpdate({ snapshot: { status: 'changed' }, hasCurrentMap: false, previousSmoke: null }),
    { action: 'awaiting-map', reason: 'no-map' },
  );
});

test('no-baseline awaits a map when previous smoke is not pass', () => {
  assert.deepEqual(
    decideUpdate({ snapshot: { status: 'no-baseline' }, hasCurrentMap: false, previousSmoke: 'fail' }),
    { action: 'awaiting-map', reason: 'no-map' },
  );
  assert.deepEqual(
    decideUpdate({ snapshot: { status: 'no-baseline' }, hasCurrentMap: false, previousSmoke: null }),
    { action: 'awaiting-map', reason: 'no-map' },
  );
  assert.deepEqual(decideUpdate({ snapshot: { status: 'no-baseline' }, previousSmoke: 'skip' }), {
    action: 'awaiting-map',
    reason: 'no-map',
  });
});

test('unknown snapshot status awaits a map', () => {
  assert.deepEqual(decideUpdate({ snapshot: { status: 'partial' }, hasCurrentMap: true, previousSmoke: 'pass' }), {
    action: 'awaiting-map',
    reason: 'unknown-snapshot',
  });
  assert.deepEqual(decideUpdate({ snapshot: { status: '' } }), {
    action: 'awaiting-map',
    reason: 'unknown-snapshot',
  });
  assert.deepEqual(decideUpdate({ snapshot: {} }), {
    action: 'awaiting-map',
    reason: 'unknown-snapshot',
  });
});

test('missing arguments are treated as no baseline without a usable map', () => {
  assert.deepEqual(decideUpdate(), { action: 'awaiting-map', reason: 'no-map' });
  assert.deepEqual(decideUpdate({}), { action: 'awaiting-map', reason: 'no-map' });
  assert.deepEqual(decideUpdate({ snapshot: null }), { action: 'awaiting-map', reason: 'no-map' });
  assert.deepEqual(decideUpdate({ snapshot: undefined, hasCurrentMap: false, previousSmoke: null }), {
    action: 'awaiting-map',
    reason: 'no-map',
  });
});

test('missing snapshot still applies a current map or a passing previous map', () => {
  assert.deepEqual(decideUpdate({ hasCurrentMap: true, previousSmoke: 'fail' }), {
    action: 'apply-current-map',
    reason: 'current-map',
  });
  assert.deepEqual(decideUpdate({ hasCurrentMap: false, previousSmoke: 'pass' }), {
    action: 'apply-previous-map',
    reason: 'previous-map',
  });
  assert.deepEqual(decideUpdate({ previousSmoke: 'pass' }), {
    action: 'apply-previous-map',
    reason: 'previous-map',
  });
});
