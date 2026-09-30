import assert from 'node:assert/strict';
import test from 'node:test';

import { createRuntime } from '../lib/runtime-events.mjs';

test('onTrackChange notifies listeners synchronously with a plain copy', () => {
  const runtime = createRuntime();
  const seen = [];
  const track = { title: 'Song', artist: 'Band', album: 'LP' };

  runtime.onTrackChange((copy) => {
    seen.push(copy);
  });
  runtime.notifyTrack(track);
  track.title = 'Changed';
  track.artist = 'Other';

  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0], { title: 'Song', artist: 'Band' });
  assert.equal(Object.keys(seen[0]).length, 2);
  assert.notEqual(seen[0], track);
});

test('notifyTrack replaces non-strings and missing tracks with empty strings', () => {
  const runtime = createRuntime();
  const seen = [];
  runtime.onTrackChange((copy) => {
    seen.push(copy);
  });

  runtime.notifyTrack({ title: 12, artist: null });
  runtime.notifyTrack(null);
  runtime.notifyTrack(undefined);
  runtime.notifyTrack('Song');
  runtime.notifyTrack({ title: 'Only' });

  assert.deepEqual(seen, [
    { title: '', artist: '' },
    { title: '', artist: '' },
    { title: '', artist: '' },
    { title: '', artist: '' },
    { title: 'Only', artist: '' },
  ]);
});

test('onPlayStateChange stores playing === true and notifies synchronously', () => {
  const runtime = createRuntime();
  const seen = [];
  runtime.onPlayStateChange((playing) => {
    seen.push(playing);
  });

  runtime.notifyPlay(true);
  runtime.notifyPlay(false);
  runtime.notifyPlay(1);
  runtime.notifyPlay('true');
  runtime.notifyPlay(undefined);

  assert.deepEqual(seen, [true, false, false, false, false]);
});

test('unsubscribe removes only that listener', () => {
  const runtime = createRuntime();
  const seen = [];
  const unsubscribeA = runtime.onTrackChange(() => {
    seen.push('a');
  });
  runtime.onTrackChange(() => {
    seen.push('b');
  });
  const unsubscribeC = runtime.onPlayStateChange(() => {
    seen.push('c');
  });
  runtime.onPlayStateChange(() => {
    seen.push('d');
  });

  unsubscribeA();
  unsubscribeA();
  unsubscribeC();
  runtime.notifyTrack({ title: 'Song', artist: 'Band' });
  runtime.notifyPlay(true);

  assert.deepEqual(seen, ['b', 'd']);
});

test('the same function can be subscribed twice and unsubscribed once', () => {
  const runtime = createRuntime();
  const seen = [];
  const listener = () => {
    seen.push('hit');
  };
  const unsubscribeFirst = runtime.onTrackChange(listener);
  runtime.onTrackChange(listener);

  unsubscribeFirst();
  runtime.notifyTrack({ title: 'Song', artist: 'Band' });

  assert.deepEqual(seen, ['hit']);
});

test('a throwing listener does not stop later listeners', () => {
  const runtime = createRuntime();
  const seen = [];

  runtime.onTrackChange(() => {
    throw new Error('track boom');
  });
  runtime.onTrackChange((copy) => {
    seen.push(copy.title);
  });
  runtime.onPlayStateChange(() => {
    throw new Error('play boom');
  });
  runtime.onPlayStateChange((playing) => {
    seen.push(playing);
  });

  runtime.notifyTrack({ title: 'Song', artist: 'Band' });
  runtime.notifyPlay(true);

  assert.deepEqual(seen, ['Song', true]);
});

test('rejects listeners that are not functions', () => {
  const runtime = createRuntime();

  assert.throws(() => runtime.onTrackChange(null), TypeError);
  assert.throws(() => runtime.onTrackChange(undefined), TypeError);
  assert.throws(() => runtime.onTrackChange('listener'), TypeError);
  assert.throws(() => runtime.onPlayStateChange({}), TypeError);
  assert.throws(() => runtime.onPlayStateChange(1), TypeError);
});

test('getSpectrum returns [] until a valid spectrum is stored', () => {
  const runtime = createRuntime();
  assert.deepEqual(runtime.getSpectrum(), []);
});

test('notifySpectrum stores a copy of finite bins from 0 through 255 up to length 64', () => {
  const runtime = createRuntime();
  const bins = [0, 1.5, 255];

  runtime.notifySpectrum(bins);
  bins[0] = 99;

  assert.deepEqual(runtime.getSpectrum(), [0, 1.5, 255]);
  runtime.notifySpectrum(Array.from({ length: 64 }, (_, index) => index));
  assert.equal(runtime.getSpectrum().length, 64);
  runtime.notifySpectrum([]);
  assert.deepEqual(runtime.getSpectrum(), []);
});

test('notifySpectrum ignores invalid bins and keeps the previous spectrum', () => {
  const runtime = createRuntime();
  runtime.notifySpectrum([10, 20, 30]);

  runtime.notifySpectrum(null);
  runtime.notifySpectrum({ 0: 1, length: 1 });
  runtime.notifySpectrum('bins');
  runtime.notifySpectrum([1, Number.NaN]);
  runtime.notifySpectrum([1, Number.POSITIVE_INFINITY]);
  runtime.notifySpectrum([1, -0.1]);
  runtime.notifySpectrum([1, 255.1]);
  runtime.notifySpectrum([1, '2']);
  runtime.notifySpectrum([1, undefined]);
  runtime.notifySpectrum(Array.from({ length: 65 }, () => 1));
  runtime.notifySpectrum(new Uint8Array([1, 2, 3]));

  assert.deepEqual(runtime.getSpectrum(), [10, 20, 30]);
});

test('getSpectrum never returns the internal array', () => {
  const runtime = createRuntime();
  runtime.notifySpectrum([4, 5, 6]);

  const first = runtime.getSpectrum();
  const second = runtime.getSpectrum();
  first[0] = 0;
  first.push(7);
  second.pop();

  assert.notEqual(first, second);
  assert.deepEqual(runtime.getSpectrum(), [4, 5, 6]);

  const fresh = createRuntime();
  const empty = fresh.getSpectrum();
  empty.push(1);
  assert.deepEqual(fresh.getSpectrum(), []);
});
