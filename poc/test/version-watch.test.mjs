import test from 'node:test';
import assert from 'node:assert/strict';
import { watchVersion } from '../lib/version-watch.mjs';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

function snap(version, asarHash, extra) {
  return { version, asarHash, ...extra };
}

test('call without arguments is missing', () => {
  assert.deepEqual(watchVersion(), { changed: false, reason: 'missing' });
});

test('empty argument object is missing', () => {
  assert.deepEqual(watchVersion({}), { changed: false, reason: 'missing' });
});

test('current null is missing', () => {
  assert.deepEqual(watchVersion({ current: null }), { changed: false, reason: 'missing' });
});

test('current non-object is missing', () => {
  assert.deepEqual(watchVersion({ current: '5.121.2' }), { changed: false, reason: 'missing' });
  assert.deepEqual(watchVersion({ current: 5 }), { changed: false, reason: 'missing' });
  assert.deepEqual(watchVersion({ current: true }), { changed: false, reason: 'missing' });
});

test('current without a valid version is missing', () => {
  assert.deepEqual(
    watchVersion({ current: { asarHash: HASH_A } }),
    { changed: false, reason: 'missing' },
  );
  assert.deepEqual(
    watchVersion({ current: snap('5', HASH_A) }),
    { changed: false, reason: 'missing' },
  );
  assert.deepEqual(
    watchVersion({ current: snap('', HASH_A) }),
    { changed: false, reason: 'missing' },
  );
  assert.deepEqual(
    watchVersion({ current: snap('5.', HASH_A) }),
    { changed: false, reason: 'missing' },
  );
  assert.deepEqual(
    watchVersion({ current: snap('5.1.2.3.4', HASH_A) }),
    { changed: false, reason: 'missing' },
  );
  assert.deepEqual(
    watchVersion({ current: snap('v5.1.2', HASH_A) }),
    { changed: false, reason: 'missing' },
  );
  assert.deepEqual(
    watchVersion({ current: snap('5.121.2-beta', HASH_A) }),
    { changed: false, reason: 'missing' },
  );
});

test('current without a valid asarHash is missing', () => {
  assert.deepEqual(
    watchVersion({ current: { version: '5.121.2' } }),
    { changed: false, reason: 'missing' },
  );
  assert.deepEqual(
    watchVersion({ current: snap('5.121.2', '') }),
    { changed: false, reason: 'missing' },
  );
  assert.deepEqual(
    watchVersion({ current: snap('5.121.2', 'a'.repeat(63)) }),
    { changed: false, reason: 'missing' },
  );
  assert.deepEqual(
    watchVersion({ current: snap('5.121.2', 'a'.repeat(65)) }),
    { changed: false, reason: 'missing' },
  );
  assert.deepEqual(
    watchVersion({ current: snap('5.121.2', `${'a'.repeat(32)} ${'a'.repeat(31)}`) }),
    { changed: false, reason: 'missing' },
  );
  assert.deepEqual(
    watchVersion({ current: snap('5.121.2', 'g'.repeat(64)) }),
    { changed: false, reason: 'missing' },
  );
});

test('uppercase current hash is missing', () => {
  assert.deepEqual(
    watchVersion({ current: snap('5.121.2', HASH_A.toUpperCase()) }),
    { changed: false, reason: 'missing' },
  );
  assert.deepEqual(
    watchVersion({ current: snap('5.121.2', `A${'a'.repeat(63)}`) }),
    { changed: false, reason: 'missing' },
  );
});

test('invalid current wins over a valid previous', () => {
  assert.deepEqual(
    watchVersion({
      previous: snap('5.121.2', HASH_A),
      current: snap('5', HASH_A),
    }),
    { changed: false, reason: 'missing' },
  );
});

test('valid current with no previous is first-seen', () => {
  const current = snap('5.121.2', HASH_A);
  assert.deepEqual(watchVersion({ current }), { changed: false, reason: 'first-seen' });
  assert.deepEqual(
    watchVersion({ previous: undefined, current }),
    { changed: false, reason: 'first-seen' },
  );
  assert.deepEqual(
    watchVersion({ previous: null, current }),
    { changed: false, reason: 'first-seen' },
  );
});

test('valid current with a non-object previous is first-seen', () => {
  const current = snap('5.1', HASH_A);
  assert.deepEqual(
    watchVersion({ previous: '5.1', current }),
    { changed: false, reason: 'first-seen' },
  );
  assert.deepEqual(
    watchVersion({ previous: 0, current }),
    { changed: false, reason: 'first-seen' },
  );
  assert.deepEqual(
    watchVersion({ previous: false, current }),
    { changed: false, reason: 'first-seen' },
  );
});

test('object previous with an invalid version is baseline', () => {
  assert.deepEqual(
    watchVersion({
      previous: snap('5', HASH_A),
      current: snap('5.121.2', HASH_A),
    }),
    { changed: false, reason: 'baseline' },
  );
  assert.deepEqual(
    watchVersion({
      previous: { asarHash: HASH_A },
      current: snap('5.121.2', HASH_A),
    }),
    { changed: false, reason: 'baseline' },
  );
  assert.deepEqual(
    watchVersion({
      previous: {},
      current: snap('5.121.2', HASH_B),
    }),
    { changed: false, reason: 'baseline' },
  );
});

test('object previous with an invalid hash is baseline', () => {
  assert.deepEqual(
    watchVersion({
      previous: snap('5.121.2', HASH_A.toUpperCase()),
      current: snap('5.121.2', HASH_A),
    }),
    { changed: false, reason: 'baseline' },
  );
  assert.deepEqual(
    watchVersion({
      previous: { version: '5.121.2' },
      current: snap('5.121.2', HASH_A),
    }),
    { changed: false, reason: 'baseline' },
  );
  assert.deepEqual(
    watchVersion({
      previous: snap('5.121.2', 'a'.repeat(63)),
      current: snap('5.121.2', HASH_A),
    }),
    { changed: false, reason: 'baseline' },
  );
});

test('different versions are a version change even when the hash matches', () => {
  assert.deepEqual(
    watchVersion({
      previous: snap('5.121.2', HASH_A),
      current: snap('5.122.0', HASH_A),
    }),
    { changed: true, reason: 'version' },
  );
});

test('different versions are a version change when the hash also differs', () => {
  assert.deepEqual(
    watchVersion({
      previous: snap('5.121.2', HASH_A),
      current: snap('6.0.0', HASH_B),
    }),
    { changed: true, reason: 'version' },
  );
});

test('same version and different hash is an asar change', () => {
  assert.deepEqual(
    watchVersion({
      previous: snap('5.121.2', HASH_A),
      current: snap('5.121.2', HASH_B),
    }),
    { changed: true, reason: 'asar' },
  );
});

test('same version and same hash is same', () => {
  assert.deepEqual(
    watchVersion({
      previous: snap('5.121.2', HASH_A),
      current: snap('5.121.2', HASH_A),
    }),
    { changed: false, reason: 'same' },
  );
});

test('extra fields are ignored', () => {
  assert.deepEqual(
    watchVersion({
      previous: snap('1.2.3', HASH_A, { channel: 'stable', build: 1 }),
      current: snap('1.2.3', HASH_A, { channel: 'beta', note: 'x' }),
    }),
    { changed: false, reason: 'same' },
  );
  assert.deepEqual(
    watchVersion({
      previous: snap('1.2.3', HASH_A, { channel: 'stable' }),
      current: snap('1.2.4', HASH_A, { channel: 'stable' }),
    }),
    { changed: true, reason: 'version' },
  );
});

test('versions with two, three, and four numeric parts are valid', () => {
  for (const version of ['5.1', '5.121.2', '10.0.0.1']) {
    assert.deepEqual(
      watchVersion({
        previous: snap(version, HASH_A),
        current: snap(version, HASH_A),
      }),
      { changed: false, reason: 'same' },
    );
  }
});
