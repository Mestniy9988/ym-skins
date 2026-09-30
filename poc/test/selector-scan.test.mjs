import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { collectTestIds, scanTestIds } from '../lib/selector-scan.mjs';

const CHUNK = 1024 * 1024;

test('collectTestIds keeps matching ids in first-seen order', () => {
  const map = {
    elements: {
      a: 'NAVBAR',
      b: ['NAVBAR_NAVIGATION_ITEM_KIDS', 'nope'],
      c: 'player.bar',
      d: 1,
    },
  };
  assert.deepEqual(collectTestIds(map), ['NAVBAR', 'NAVBAR_NAVIGATION_ITEM_KIDS']);
});

test('collectTestIds returns an empty list for a null map', () => {
  assert.deepEqual(collectTestIds(null), []);
  assert.deepEqual(collectTestIds(undefined), []);
  assert.deepEqual(collectTestIds({}), []);
});

test('scanTestIds finds an id split across a 1 MiB chunk boundary', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ym-selector-scan-'));
  try {
    const file = path.join(dir, 'ids.bin');
    const splitId = 'NAVBAR_NAVIGATION_ITEM_KIDS';
    const shortId = 'PLAY_BUTTON';
    const missingId = 'SETTINGS_LIST';
    const start = CHUNK - 10;
    const buf = Buffer.alloc(start + splitId.length, 0x61);
    buf.write(shortId, 20, 'latin1');
    buf.write(splitId, start, 'latin1');
    assert.ok(start < CHUNK);
    assert.ok(start + splitId.length > CHUNK);
    fs.writeFileSync(file, buf);

    const result = scanTestIds(file, [missingId, shortId, splitId]);
    assert.deepEqual(result.found, [shortId, splitId]);
    assert.deepEqual(result.missing, [missingId]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('scanTestIds does not search lowercase or punctuation ids', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ym-selector-scan-'));
  try {
    const file = path.join(dir, 'ids.bin');
    fs.writeFileSync(file, 'PLAY_BUTTON player.bar nope');
    const result = scanTestIds(file, ['player.bar', 'PLAY_BUTTON', 'nope', 'ABSENT_ID']);
    assert.deepEqual(result.found, ['PLAY_BUTTON']);
    assert.deepEqual(result.missing, ['ABSENT_ID']);
    assert.equal(result.found.includes('player.bar'), false);
    assert.equal(result.missing.includes('player.bar'), false);
    assert.equal(result.found.includes('nope'), false);
    assert.equal(result.missing.includes('nope'), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('scanTestIds reports only the first 64 valid ids', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ym-selector-scan-'));
  try {
    const file = path.join(dir, 'ids.bin');
    fs.writeFileSync(file, 'zzA0zz');
    const ids = [];
    for (let i = 0; i < 65; i += 1) ids.push(`A${i}`);
    const result = scanTestIds(file, ids);
    const reported = [...result.found, ...result.missing];
    assert.equal(reported.length, 64);
    assert.deepEqual(result.found, ['A0']);
    assert.equal(result.missing.length, 63);
    assert.equal(result.missing[0], 'A1');
    assert.equal(result.missing[result.missing.length - 1], 'A63');
    assert.equal(reported.includes('A64'), false);
    assert.equal(result.found.includes('A64'), false);
    assert.equal(result.missing.includes('A64'), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
