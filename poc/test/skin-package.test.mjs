import assert from 'node:assert/strict';
import test from 'node:test';

import { readSkinPackage } from '../lib/skin-package.mjs';
import { testSkinCss } from '../lib/skin-css.mjs';

const manifest = JSON.stringify({
  id: 'classic-98',
  name: "Classic '98",
  version: '1.0.0',
  runtimeApi: '^1.0',
  themes: [
    { id: 'green', name: 'Green LCD' },
    { id: 'amber', name: 'Amber LCD' },
  ],
});

test('a package keeps the manifest and css that only targets data-yms', () => {
  const theme = '[data-yms="player.bar"] { background-color: rgb(20, 40, 10) !important; }';
  const result = readSkinPackage({
    'manifest.json': manifest,
    'skin.css': testSkinCss(),
    'themes/green.css': theme,
  });
  assert.equal(result.ok, true);
  assert.equal(result.manifest.id, 'classic-98');
  assert.equal(result.css, testSkinCss());
  assert.equal(result.themes.green, theme);
});

test('path escape, a remote rule and an unknown theme file are rejected', () => {
  assert.equal(readSkinPackage({ 'manifest.json': manifest, '../skin.css': testSkinCss() }).reason, 'path');
  assert.equal(
    readSkinPackage({
      'manifest.json': manifest,
      'skin.css': '[data-yms="player.play"] { background: url(https://example.test/a.png) }',
    }).reason,
    'forbidden',
  );
  assert.equal(
    readSkinPackage({
      'manifest.json': manifest,
      'skin.css': testSkinCss(),
      'themes/pink.css': '[data-yms="player.play"] { color: red }',
    }).reason,
    'theme',
  );
  assert.equal(readSkinPackage(['manifest.json']).reason, 'files');
});
