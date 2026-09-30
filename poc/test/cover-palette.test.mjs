import assert from 'node:assert/strict';
import test from 'node:test';

import { coverPalette } from '../lib/cover-palette.mjs';

test('a light cover gets black text and a dark cover gets white text', () => {
  const light = coverPalette([{ r: 250, g: 250, b: 250 }]);
  assert.equal(light.ok, true);
  assert.equal(light.background, 'rgb(250, 250, 250)');
  assert.equal(light.text, 'rgb(0, 0, 0)');
  assert.equal(light.textReadable, true);

  const dark = coverPalette([{ r: 8, g: 8, b: 12 }]);
  assert.equal(dark.text, 'rgb(255, 255, 255)');
  assert.equal(dark.textReadable, true);
});

test('the accent is the sample farthest from the average', () => {
  const palette = coverPalette([
    { r: 20, g: 20, b: 20 },
    { r: 24, g: 24, b: 24 },
    { r: 220, g: 30, b: 40 },
  ]);
  assert.equal(palette.ok, true);
  assert.equal(palette.accent, 'rgb(220, 30, 40)');
});

test('bad samples are refused', () => {
  assert.equal(coverPalette([]).reason, 'samples');
  assert.equal(coverPalette([{ r: 1.5, g: 0, b: 0 }]).reason, 'samples');
  assert.equal(coverPalette([{ r: -1, g: 0, b: 0 }]).reason, 'samples');
  assert.equal(coverPalette(new Array(65).fill({ r: 0, g: 0, b: 0 })).reason, 'samples');
});
