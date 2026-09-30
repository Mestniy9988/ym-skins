import assert from 'node:assert/strict';
import test from 'node:test';

import { chooseAudioSource } from '../lib/audio-source.mjs';

test('analyser wins over loopback live', () => {
  assert.deepEqual(chooseAudioSource({ analyserState: 'live', loopbackStatus: 'live' }), { source: 'analyser' });
});

test('silent falls through to loopback live', () => {
  assert.deepEqual(chooseAudioSource({ analyserState: 'silent', loopbackStatus: 'live' }), { source: 'loopback' });
});

test('silent and no-device is decorative', () => {
  assert.deepEqual(chooseAudioSource({ analyserState: 'silent', loopbackStatus: 'no-device' }), { source: 'decorative' });
});

test('present-untested is decorative', () => {
  assert.deepEqual(
    chooseAudioSource({ analyserState: 'silent', loopbackStatus: 'present-untested' }),
    { source: 'decorative' },
  );
  assert.deepEqual(chooseAudioSource({ loopbackStatus: 'present-untested' }), { source: 'decorative' });
});

test('missing args is decorative', () => {
  assert.deepEqual(chooseAudioSource(), { source: 'decorative' });
  assert.deepEqual(chooseAudioSource({}), { source: 'decorative' });
});

test('unavailable and not-checked is decorative', () => {
  assert.deepEqual(
    chooseAudioSource({ analyserState: 'unavailable', loopbackStatus: 'not-checked' }),
    { source: 'decorative' },
  );
});

test('only an exact live analyser or live loopback selects a real source', () => {
  for (const analyserState of ['silent', 'unavailable', null, undefined, 'running-zeros', 'LIVE', 'other']) {
    assert.deepEqual(
      chooseAudioSource({ analyserState, loopbackStatus: 'not-checked' }),
      { source: 'decorative' },
    );
  }
  for (const loopbackStatus of ['not-checked', 'no-device', 'present-untested', null, undefined, 'LIVE']) {
    assert.deepEqual(
      chooseAudioSource({ analyserState: 'running-zeros', loopbackStatus }),
      { source: 'decorative' },
    );
  }
  assert.deepEqual(chooseAudioSource({ analyserState: null, loopbackStatus: 'live' }), { source: 'loopback' });
  assert.deepEqual(chooseAudioSource({ analyserState: undefined, loopbackStatus: 'live' }), { source: 'loopback' });
});
