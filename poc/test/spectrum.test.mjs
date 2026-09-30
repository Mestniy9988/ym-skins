import assert from 'node:assert/strict';
import test from 'node:test';

import { classifySpectrum, decayPeaks } from '../lib/spectrum.mjs';

test('classifySpectrum returns unavailable for null', () => {
  assert.deepEqual(classifySpectrum(null), { state: 'unavailable', peak: null });
});

test('classifySpectrum returns unavailable for a non-array', () => {
  assert.deepEqual(classifySpectrum('bins'), { state: 'unavailable', peak: null });
  assert.deepEqual(classifySpectrum({ 0: 1, length: 1 }), { state: 'unavailable', peak: null });
});

test('classifySpectrum returns unavailable for an empty array', () => {
  assert.deepEqual(classifySpectrum([]), { state: 'unavailable', peak: null });
});

test('classifySpectrum returns unavailable when any bin is NaN', () => {
  assert.deepEqual(classifySpectrum([0, Number.NaN, 4]), { state: 'unavailable', peak: null });
});

test('classifySpectrum returns unavailable when any bin is not finite', () => {
  assert.deepEqual(classifySpectrum([1, Number.POSITIVE_INFINITY]), { state: 'unavailable', peak: null });
  assert.deepEqual(classifySpectrum([undefined, 2]), { state: 'unavailable', peak: null });
});

test('classifySpectrum returns unavailable for a negative bin', () => {
  assert.deepEqual(classifySpectrum([-0.1, 4, 1]), { state: 'unavailable', peak: null });
});

test('classifySpectrum returns silent when every bin is 0', () => {
  assert.deepEqual(classifySpectrum([0, 0, 0]), { state: 'silent', peak: 0 });
});

test('classifySpectrum returns live with the maximum bin', () => {
  assert.deepEqual(classifySpectrum([0, 0.25, 0.9, 0.4]), { state: 'live', peak: 0.9 });
});

test('decayPeaks holds a higher peak while it decays', () => {
  assert.deepEqual(decayPeaks([8, 3], [1, 3]), [7, 3]);
});

test('decayPeaks does not fall below the new bin', () => {
  assert.deepEqual(decayPeaks([1.2, 4], [2, 0.5], { decay: 1 }), [2, 3]);
});

test('decayPeaks defaults decay to 1 and keeps fractional results', () => {
  assert.deepEqual(decayPeaks([1.25], [0.1]), [0.25]);
});

test('decayPeaks does not mutate its inputs', () => {
  const peaks = [5, 4];
  const bins = [1, 2];
  const result = decayPeaks(peaks, bins, { decay: 0.5 });

  assert.deepEqual(result, [4.5, 3.5]);
  assert.notEqual(result, peaks);
  assert.notEqual(result, bins);
  assert.deepEqual(peaks, [5, 4]);
  assert.deepEqual(bins, [1, 2]);
});

test('decayPeaks throws TypeError when lengths differ', () => {
  assert.throws(() => decayPeaks([1, 2], [1]), TypeError);
});

test('decayPeaks throws TypeError when inputs are not equal-length finite arrays', () => {
  assert.throws(() => decayPeaks(null, [1]), TypeError);
  assert.throws(() => decayPeaks([1], 'nope'), TypeError);
  assert.throws(() => decayPeaks([Number.NaN], [1]), TypeError);
  assert.throws(() => decayPeaks([1], [Number.POSITIVE_INFINITY]), TypeError);
});

test('decayPeaks throws TypeError for an invalid decay', () => {
  assert.throws(() => decayPeaks([1], [1], { decay: -1 }), TypeError);
  assert.throws(() => decayPeaks([1], [1], { decay: Number.NaN }), TypeError);
  assert.throws(() => decayPeaks([1], [1], { decay: Number.POSITIVE_INFINITY }), TypeError);
  assert.throws(() => decayPeaks([1], [1], { decay: '1' }), TypeError);
});
