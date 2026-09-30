import assert from 'node:assert/strict';
import test from 'node:test';

import { readManifest } from '../lib/manifest.mjs';

const classic = {
  id: 'classic-98',
  name: "Classic '98",
  version: '1.2.0',
  runtimeApi: '^1.0',
  themes: [
    { id: 'green', name: 'Green LCD' },
    { id: 'amber', name: 'Amber LCD' },
  ],
};

test('accepts the Classic \'98 manifest object and drops extra fields', () => {
  const input = {
    ...classic,
    author: 'YM Skins Team',
    settings: [{ id: 'animations', type: 'boolean', default: true }],
    themes: [
      { id: 'green', name: 'Green LCD', accent: '#00ff00' },
      { id: 'amber', name: 'Amber LCD', preview: 'amber.png' },
    ],
  };

  assert.deepEqual(readManifest(input), { ok: true, manifest: classic });
  assert.equal(input.author, 'YM Skins Team');
});

test('accepts the Classic \'98 manifest as a JSON string', () => {
  assert.deepEqual(readManifest(JSON.stringify(classic)), { ok: true, manifest: classic });
});

test('rejects invalid JSON', () => {
  assert.deepEqual(readManifest('{'), { ok: false, reason: 'invalid-json' });
  assert.deepEqual(readManifest('not-json'), { ok: false, reason: 'invalid-json' });
  assert.deepEqual(readManifest(''), { ok: false, reason: 'invalid-json' });
});

test('rejects strings longer than 20000 characters before parsing', () => {
  assert.deepEqual(readManifest('x'.repeat(20001)), { ok: false, reason: 'too-large' });
  assert.deepEqual(readManifest(`{${'x'.repeat(20000)}`), { ok: false, reason: 'too-large' });
  assert.deepEqual(readManifest('{'.repeat(20000)), { ok: false, reason: 'invalid-json' });
});

test('rejects non-objects', () => {
  assert.deepEqual(readManifest(null), { ok: false, reason: 'not-object' });
  assert.deepEqual(readManifest([]), { ok: false, reason: 'not-object' });
  assert.deepEqual(readManifest(1), { ok: false, reason: 'not-object' });
  assert.deepEqual(readManifest(true), { ok: false, reason: 'not-object' });
  assert.deepEqual(readManifest('null'), { ok: false, reason: 'not-object' });
  assert.deepEqual(readManifest('[]'), { ok: false, reason: 'not-object' });
  assert.deepEqual(readManifest('1'), { ok: false, reason: 'not-object' });
});

test('rejects a bad id before later fields', () => {
  assert.deepEqual(
    readManifest({ ...classic, id: 'Classic_98', version: 'nope', themes: [] }),
    { ok: false, reason: 'id' },
  );
  assert.deepEqual(readManifest({ ...classic, id: '' }), { ok: false, reason: 'id' });
  assert.deepEqual(readManifest({ ...classic, id: 'a'.repeat(41) }), { ok: false, reason: 'id' });
  assert.deepEqual(readManifest({ ...classic, id: 12 }), { ok: false, reason: 'id' });
});

test('accepts skin names with letters, digits, space, apostrophe, ampersand, plus, and hash', () => {
  const name = "Rock & Roll + Bass #1 'Live'";
  assert.deepEqual(readManifest({ ...classic, name }), {
    ok: true,
    manifest: { ...classic, name },
  });
  assert.deepEqual(readManifest({ ...classic, name: 'A'.repeat(80) }), {
    ok: true,
    manifest: { ...classic, name: 'A'.repeat(80) },
  });
});

test('rejects names that are empty, untrimmed, too long, controlled, or contain < or >', () => {
  for (const name of ['', '   ', ` ${classic.name}`, `${classic.name} `, 'A'.repeat(81), 'Green\nLCD', 'Green\u0000LCD', 'a<b', 'a>b', '<script>', 'Café']) {
    assert.deepEqual(readManifest({ ...classic, name }), { ok: false, reason: 'name' }, name);
  }
  assert.deepEqual(
    readManifest({ ...classic, name: '', version: 'bad', runtimeApi: 'bad', themes: [] }),
    { ok: false, reason: 'name' },
  );
});

test('rejects a bad version before runtime and themes', () => {
  assert.deepEqual(readManifest({ ...classic, version: '1.2' }), { ok: false, reason: 'version' });
  assert.deepEqual(readManifest({ ...classic, version: 'v1.2.0' }), { ok: false, reason: 'version' });
  assert.deepEqual(
    readManifest({ ...classic, version: '1.2', runtimeApi: '1.0', themes: [] }),
    { ok: false, reason: 'version' },
  );
});

test('rejects a bad runtimeApi before themes', () => {
  assert.deepEqual(readManifest({ ...classic, runtimeApi: '1.0' }), { ok: false, reason: 'runtime-api' });
  assert.deepEqual(readManifest({ ...classic, runtimeApi: '^1' }), { ok: false, reason: 'runtime-api' });
  assert.deepEqual(readManifest({ ...classic, runtimeApi: '^1.0.0', themes: [] }), {
    ok: false,
    reason: 'runtime-api',
  });
});

test('rejects missing, empty, and malformed themes', () => {
  const { themes: _themes, ...withoutThemes } = classic;
  assert.deepEqual(readManifest(withoutThemes), { ok: false, reason: 'themes' });
  assert.deepEqual(readManifest({ ...classic, themes: [] }), { ok: false, reason: 'themes' });
  assert.deepEqual(readManifest({ ...classic, themes: 'green' }), { ok: false, reason: 'themes' });
  assert.deepEqual(readManifest({ ...classic, themes: [null] }), { ok: false, reason: 'themes' });
  assert.deepEqual(readManifest({ ...classic, themes: [{ id: 'Green', name: 'Green LCD' }] }), {
    ok: false,
    reason: 'themes',
  });
  assert.deepEqual(readManifest({ ...classic, themes: [{ id: 'green', name: 'Green <LCD>' }] }), {
    ok: false,
    reason: 'themes',
  });
});

test('rejects duplicate theme ids', () => {
  assert.deepEqual(
    readManifest({
      ...classic,
      themes: [
        { id: 'green', name: 'Green LCD' },
        { id: 'green', name: 'Other Green' },
      ],
    }),
    { ok: false, reason: 'themes' },
  );
});

test('accepts a single theme and punctuation in a theme name', () => {
  const themes = [{ id: 'neon-1', name: "Night & Day + #2's" }];
  assert.deepEqual(readManifest({ ...classic, themes }), {
    ok: true,
    manifest: { ...classic, themes },
  });
});
