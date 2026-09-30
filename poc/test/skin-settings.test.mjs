import assert from 'node:assert/strict';
import test from 'node:test';

import { readSkinSettings } from '../lib/skin-settings.mjs';

test('boolean and enum settings are kept and unknown manifest fields are ignored', () => {
  const result = readSkinSettings({
    id: 'classic-98',
    settings: [
      { id: 'animations', type: 'boolean', default: true },
      {
        id: 'visualizer',
        type: 'enum',
        values: ['spectrum', 'oscilloscope', 'vu', 'off'],
        default: 'spectrum',
      },
    ],
  });
  assert.equal(result.ok, true);
  assert.equal(result.settings.length, 2);
  assert.equal(result.settings[0].default, true);
  assert.deepEqual(result.settings[1].values, ['spectrum', 'oscilloscope', 'vu', 'off']);
});

test('a missing settings list is empty, and a broken list is refused', () => {
  assert.deepEqual(readSkinSettings({ id: 'classic-98' }), { ok: true, settings: [] });
  assert.equal(readSkinSettings({ settings: [{ id: 'animations', type: 'boolean', default: 'yes' }] }).reason, 'settings');
  assert.equal(
    readSkinSettings({
      settings: [{ id: 'visualizer', type: 'enum', values: ['spectrum'], default: 'off' }],
    }).reason,
    'settings',
  );
  assert.equal(
    readSkinSettings({
      settings: [
        { id: 'animations', type: 'boolean', default: false },
        { id: 'animations', type: 'boolean', default: true },
      ],
    }).reason,
    'settings',
  );
});
