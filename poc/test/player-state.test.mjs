import assert from 'node:assert/strict';
import test from 'node:test';

import { applyPlayerVariables, playerVariables } from '../lib/player-state.mjs';

const KEYS = [
  '--yms-title',
  '--yms-artist',
  '--yms-progress',
  '--yms-volume',
  '--yms-playing',
  '--yms-liked',
];

test('returns every variable as a string when the snapshot is empty', () => {
  const variables = playerVariables();
  assert.deepEqual(Object.keys(variables), KEYS);
  for (const key of KEYS) assert.equal(typeof variables[key], 'string');
  assert.equal(variables['--yms-title'], '');
  assert.equal(variables['--yms-artist'], '');
  assert.equal(variables['--yms-progress'], '0');
  assert.equal(variables['--yms-volume'], '0');
  assert.equal(variables['--yms-playing'], '0');
  assert.equal(variables['--yms-liked'], '0');
});

test('trims title and artist and caps each at 120 characters', () => {
  const title = `  ${'й'.repeat(130)}  `;
  const artist = `\t${'a'.repeat(120)}\n`;
  const variables = playerVariables({ title, artist });
  assert.equal(variables['--yms-title'], 'й'.repeat(120));
  assert.equal(variables['--yms-artist'], 'a'.repeat(120));
});

test('drops missing or non-string title and artist', () => {
  const variables = playerVariables({
    title: 12,
    artist: { name: 'Ada' },
  });
  assert.equal(variables['--yms-title'], '');
  assert.equal(variables['--yms-artist'], '');
  assert.equal(playerVariables({ title: null, artist: undefined })['--yms-title'], '');
});

test('strips controls below U+0020 and DEL without interpreting HTML', () => {
  const variables = playerVariables({
    title: 'a\u0000b\u001Fc\u007Fd <b>Hi</b>',
    artist: ' \nRock\t&amp;\u007F Roll ',
  });
  assert.equal(variables['--yms-title'], 'abcd <b>Hi</b>');
  assert.equal(variables['--yms-artist'], 'Rock&amp; Roll');
  assert.equal(playerVariables({ title: 'a\u00A0b' })['--yms-title'], 'a\u00A0b');
});

test('formats progress and volume with at most four decimals', () => {
  const variables = playerVariables({ progress: 0.5, volume: 1 / 3 });
  assert.equal(variables['--yms-progress'], '0.5');
  assert.equal(variables['--yms-volume'], '0.3333');
  assert.equal(playerVariables({ progress: 0, volume: 1 })['--yms-volume'], '1');
  assert.equal(playerVariables({ progress: 0.1, volume: 0.123 })['--yms-progress'], '0.1');
  assert.equal(playerVariables({ volume: 0.123 })['--yms-volume'], '0.123');
});

test('rejects non-finite and out-of-range progress and volume', () => {
  const samples = [Number.NaN, Infinity, -Infinity, -0.01, 1.0001, '0.4', null, undefined];
  for (const progress of samples) {
    const variables = playerVariables({ progress, volume: progress });
    assert.equal(variables['--yms-progress'], '0', String(progress));
    assert.equal(variables['--yms-volume'], '0', String(progress));
  }
});

test('sets playing and liked only for strict true', () => {
  assert.equal(playerVariables({ playing: true, liked: true })['--yms-playing'], '1');
  assert.equal(playerVariables({ playing: true, liked: true })['--yms-liked'], '1');
  for (const value of [false, 1, 'true', null, undefined, 0]) {
    const variables = playerVariables({ playing: value, liked: value });
    assert.equal(variables['--yms-playing'], '0');
    assert.equal(variables['--yms-liked'], '0');
  }
});

test('does not mutate the input snapshot', () => {
  const state = {
    title: '  Song\u0000 ',
    artist: 'Artist',
    progress: 0.25,
    volume: 0.5,
    playing: true,
    liked: false,
    extra: { keep: true },
  };
  const before = structuredClone(state);
  const variables = playerVariables(state);
  assert.deepEqual(state, before);
  const element = {
    style: {
      setProperty() {},
    },
  };
  applyPlayerVariables(element, state);
  assert.deepEqual(state, before);
  assert.equal(variables['--yms-title'], 'Song');
});

test('skips elements that cannot receive custom properties', () => {
  assert.deepEqual(applyPlayerVariables(null, { title: 'A' }), { applied: false });
  assert.deepEqual(applyPlayerVariables(undefined, {}), { applied: false });
  assert.deepEqual(applyPlayerVariables({}, {}), { applied: false });
  assert.deepEqual(applyPlayerVariables({ style: null }, {}), { applied: false });
  assert.deepEqual(applyPlayerVariables({ style: {} }, {}), { applied: false });
});

test('writes each variable through setProperty on a fake element', () => {
  const calls = [];
  const element = {
    style: {
      setProperty(name, value) {
        calls.push([name, value]);
      },
    },
  };
  const state = {
    title: ' Night ',
    artist: 'Drive',
    progress: 0.25,
    volume: 0.5,
    playing: true,
    liked: false,
  };
  const result = applyPlayerVariables(element, state);
  assert.equal(result.applied, true);
  assert.deepEqual(result.variables, playerVariables(state));
  assert.deepEqual(calls, KEYS.map((name) => [name, result.variables[name]]));
  assert.equal(result.variables['--yms-title'], 'Night');
  assert.equal(result.variables['--yms-playing'], '1');
  assert.equal(result.variables['--yms-liked'], '0');
});
