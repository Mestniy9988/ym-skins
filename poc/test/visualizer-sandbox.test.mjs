import assert from 'node:assert/strict';
import test from 'node:test';

import { runVisualizer } from '../lib/visualizer-sandbox.mjs';

test('a visualizer hears the track and the spectrum through the runtime api', () => {
  const result = runVisualizer(`
    if (typeof process !== 'undefined') throw new Error('saw process');
    api.onTrackChange((track) => { api.getSpectrum(); });
    api.onPlayStateChange((playing) => { playing; });
  `, {
    bins: [0, 12, 3],
    track: { title: 'Ночь', artist: 'А', note: 'drop-me' },
    playing: true,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.tracks, [{ title: 'Ночь', artist: 'А' }]);
  assert.deepEqual(result.playing, [true]);
  assert.deepEqual(result.spectrum, [0, 12, 3]);
});

test('network and eval are refused before the script runs', () => {
  assert.equal(runVisualizer('fetch("https://example.test/bins")').reason, 'fetch');
  assert.equal(runVisualizer('eval("1")').reason, 'eval');
  assert.equal(runVisualizer('throw new Error("boom")').reason, 'run');
});
