import assert from 'node:assert/strict';
import test from 'node:test';

import { frameVisualizer } from '../lib/visualizer-frame.mjs';

test('spectrum holds peaks and a silent buffer stays decorative', () => {
  const live = frameVisualizer({
    mode: 'spectrum',
    bins: [0, 255, 10],
    playing: true,
    peaks: [0.2, 0.1, 0.9],
  });
  assert.equal(live.draw, true);
  assert.equal(live.decorative, false);
  assert.equal(live.animate, true);
  assert.equal(live.bars[1], 1);
  assert.ok(live.peaks[1] >= live.bars[1]);
  assert.ok(live.peaks[2] > live.bars[2]);

  const silent = frameVisualizer({ mode: 'spectrum', bins: [0, 0, 0], playing: true });
  assert.equal(silent.decorative, true);
  assert.equal(silent.draw, true);
});

test('drawing stops while paused, hidden or switched off', () => {
  assert.equal(frameVisualizer({ mode: 'spectrum', bins: [10], playing: false }).reason, 'paused');
  assert.equal(frameVisualizer({ mode: 'vu', bins: [10], playing: true, hidden: true }).draw, false);
  assert.equal(frameVisualizer({ mode: 'off', bins: [10], playing: true }).draw, false);
  assert.equal(frameVisualizer({ mode: 'plasma', playing: true }).reason, 'bad-mode');
});

test('reduced motion keeps the frame but turns animation off', () => {
  const frame = frameVisualizer({
    mode: 'oscilloscope',
    timeDomain: [128, 200, 128],
    playing: true,
    reducedMotion: true,
  });
  assert.equal(frame.draw, true);
  assert.equal(frame.animate, false);
  assert.equal(frame.decorative, false);
  assert.equal(frame.samples[1] > 0, true);
});

test('vu splits the bins and bad samples do not throw', () => {
  const vu = frameVisualizer({ mode: 'vu', bins: [0, 255], playing: true });
  assert.equal(vu.left, 0);
  assert.equal(vu.right, 1);
  assert.equal(vu.decorative, false);
  const broken = frameVisualizer({ mode: 'oscilloscope', timeDomain: [-1, 4], playing: true });
  assert.equal(broken.draw, true);
  assert.equal(broken.decorative, true);
  assert.deepEqual(broken.samples, []);
});
