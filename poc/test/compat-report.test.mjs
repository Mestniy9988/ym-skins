import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCompatReport } from '../lib/compat-report.mjs';

const ok = (ymVersion, missing) => ({
  send: true,
  reason: 'ok',
  payload: { ymVersion, missing },
});

test('call without arguments is no-consent', () => {
  assert.deepEqual(buildCompatReport(), {
    send: false,
    reason: 'no-consent',
    payload: null,
  });
});

test('consent must be strictly true', () => {
  for (const consent of [false, 'true', 1, 0, null, undefined, '']) {
    assert.deepEqual(buildCompatReport({ consent, ymVersion: '1.2.3', missing: ['player.bar'] }), {
      send: false,
      reason: 'no-consent',
      payload: null,
    });
  }
  assert.deepEqual(buildCompatReport({ ymVersion: '9.9', missing: [] }), {
    send: false,
    reason: 'no-consent',
    payload: null,
  });
});

test('no-consent response has only send, reason, and payload', () => {
  const report = buildCompatReport({
    consent: false,
    ymVersion: 'not-a-version',
    missing: 'not-an-array',
    email: 'person@example.com',
    token: 'placeholder-token',
  });
  assert.deepEqual(report, { send: false, reason: 'no-consent', payload: null });
  assert.deepEqual(Object.keys(report), ['send', 'reason', 'payload']);
});

test('ymVersion must be a dotted numeric string', () => {
  assert.deepEqual(buildCompatReport({ consent: true, ymVersion: 1.2, missing: [] }), {
    send: false,
    reason: 'version',
    payload: null,
  });
  for (const ymVersion of ['1', '1.2.3.4.5', 'v1.2', '1.2 ', '', '1..2']) {
    assert.deepEqual(buildCompatReport({ consent: true, ymVersion, missing: ['a'] }), {
      send: false,
      reason: 'version',
      payload: null,
    });
  }
  assert.deepEqual(buildCompatReport({ consent: true, missing: [] }), {
    send: false,
    reason: 'version',
    payload: null,
  });
});

test('invalid version is reported before missing is checked', () => {
  assert.deepEqual(
    buildCompatReport({ consent: true, ymVersion: 'bad', missing: ['Bad Name'] }),
    { send: false, reason: 'version', payload: null },
  );
});

test('missing must be an array of logical names', () => {
  for (const missing of [null, undefined, 'player.bar', { length: 0 }, 12]) {
    assert.deepEqual(buildCompatReport({ consent: true, ymVersion: '1.2', missing }), {
      send: false,
      reason: 'missing',
      payload: null,
    });
  }
  assert.deepEqual(buildCompatReport({ consent: true, ymVersion: '1.2', missing: ['ok', 1] }), {
    send: false,
    reason: 'missing',
    payload: null,
  });
});

test('names with @, a space, or a capital letter are missing', () => {
  for (const name of ['player@bar', 'player bar', 'Player.bar', 'player.Bar']) {
    assert.deepEqual(buildCompatReport({ consent: true, ymVersion: '3.1.4', missing: [name] }), {
      send: false,
      reason: 'missing',
      payload: null,
    });
  }
});

test('thirteen names are missing', () => {
  const missing = Array.from({ length: 13 }, (_, index) => `item${index}`);
  assert.equal(missing.length, 13);
  assert.deepEqual(buildCompatReport({ consent: true, ymVersion: '1.0', missing }), {
    send: false,
    reason: 'missing',
    payload: null,
  });
});

test('twelve valid names are ok', () => {
  const missing = Array.from({ length: 12 }, (_, index) => `item${index}`);
  assert.equal(missing.length, 12);
  assert.deepEqual(buildCompatReport({ consent: true, ymVersion: '1.0.0', missing }), ok('1.0.0', missing));
});

test('empty missing is ok and duplicates keep the first occurrence', () => {
  assert.deepEqual(buildCompatReport({ consent: true, ymVersion: '10.2', missing: [] }), ok('10.2', []));

  const missing = ['nav.bar', 'player.play', 'nav.bar', 'queue.list', 'player.play'];
  const report = buildCompatReport({ consent: true, ymVersion: '1.2.3', missing });
  assert.deepEqual(report, ok('1.2.3', ['nav.bar', 'player.play', 'queue.list']));
  assert.notEqual(report.payload.missing, missing);
  assert.deepEqual(missing, ['nav.bar', 'player.play', 'nav.bar', 'queue.list', 'player.play']);
});

test('accepted versions have one to three dotted segments', () => {
  for (const ymVersion of ['1.2', '1.2.3', '1.2.3.4']) {
    assert.deepEqual(buildCompatReport({ consent: true, ymVersion, missing: ['a.b.c.d'] }), ok(ymVersion, ['a.b.c.d']));
  }
});

test('extra email and token fields are not in the payload', () => {
  const report = buildCompatReport({
    consent: true,
    ymVersion: '2.0.1',
    missing: ['player.bar'],
    email: 'person@example.com',
    token: 'placeholder-token',
  });
  assert.deepEqual(report, ok('2.0.1', ['player.bar']));
  assert.deepEqual(Object.keys(report.payload), ['ymVersion', 'missing']);
  assert.equal(Object.keys(report.payload).length, 2);
  const encoded = JSON.stringify(report);
  assert.equal(encoded.includes('person@example.com'), false);
  assert.equal(encoded.includes('placeholder-token'), false);
  assert.equal(encoded.includes('email'), false);
  assert.equal(encoded.includes('token'), false);
});
