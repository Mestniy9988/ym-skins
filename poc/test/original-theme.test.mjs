import assert from 'node:assert/strict';
import test from 'node:test';

import { createThemeState, disableOriginal, enableOriginal } from '../lib/original-theme.mjs';

test('createThemeState starts with the skin off-switch clear and nothing remembered', () => {
  assert.deepEqual(createThemeState(), {
    original: false,
    skinId: null,
    themeId: null,
    rememberedSkinId: null,
    rememberedThemeId: null,
  });
});

test('invalid skin and theme ids become null', () => {
  const cases = [
    ['', 'night'],
    ['Glass', 'night'],
    ['glass_skin', 'night'],
    ['glass skin', 'night'],
    ['glass.skin', 'night'],
    ['a'.repeat(41), 'night'],
    [null, 'night'],
    [undefined, 'night'],
    [1, 'night'],
    [{ id: 'glass' }, 'night'],
    ['glass', ''],
    ['glass', 'Night'],
    ['glass', 'night_mode'],
    ['glass', 'a'.repeat(41)],
    ['glass', null],
    ['glass', 2],
  ];

  for (const [skinId, themeId] of cases) {
    const state = createThemeState({ skinId, themeId });
    const skinOk = typeof skinId === 'string' && /^[a-z0-9-]{1,40}$/.test(skinId);
    const themeOk = typeof themeId === 'string' && /^[a-z0-9-]{1,40}$/.test(themeId);
    assert.equal(state.skinId, skinOk ? skinId : null);
    assert.equal(state.themeId, themeOk ? themeId : null);
    assert.equal(state.original, false);
    assert.equal(state.rememberedSkinId, null);
    assert.equal(state.rememberedThemeId, null);
  }
});

test('valid ids are kept, including the length boundaries', () => {
  const skinId = `a${'b'.repeat(38)}-`;
  const themeId = '-';
  assert.equal(skinId.length, 40);
  assert.deepEqual(createThemeState({ skinId, themeId: 'dark-1' }), {
    original: false,
    skinId,
    themeId: 'dark-1',
    rememberedSkinId: null,
    rememberedThemeId: null,
  });
  assert.deepEqual(createThemeState({ skinId: 'g', themeId }), {
    original: false,
    skinId: 'g',
    themeId,
    rememberedSkinId: null,
    rememberedThemeId: null,
  });
});

test('enableOriginal turns the skin off and remembers the previous ids', () => {
  const state = createThemeState({ skinId: 'glass', themeId: 'night' });

  const enabled = enableOriginal(state);

  assert.notEqual(enabled, state);
  assert.deepEqual(enabled, {
    original: true,
    skinId: null,
    themeId: null,
    rememberedSkinId: 'glass',
    rememberedThemeId: 'night',
  });
});

test('enableOriginal remembers null when no skin was selected', () => {
  const enabled = enableOriginal(createThemeState({ skinId: 'NOT-VALID', themeId: 'also bad' }));

  assert.deepEqual(enabled, {
    original: true,
    skinId: null,
    themeId: null,
    rememberedSkinId: null,
    rememberedThemeId: null,
  });
});

test('disableOriginal restores the remembered skin and clears the memory', () => {
  const enabled = enableOriginal(createThemeState({ skinId: 'glass', themeId: 'night' }));

  const restored = disableOriginal(enabled);

  assert.notEqual(restored, enabled);
  assert.deepEqual(restored, {
    original: false,
    skinId: 'glass',
    themeId: 'night',
    rememberedSkinId: null,
    rememberedThemeId: null,
  });
});

test('double enable does not lose the remembered skin', () => {
  const once = enableOriginal(createThemeState({ skinId: 'glass', themeId: 'night' }));
  const twice = enableOriginal(once);

  assert.notEqual(twice, once);
  assert.deepEqual(twice, {
    original: true,
    skinId: null,
    themeId: null,
    rememberedSkinId: 'glass',
    rememberedThemeId: 'night',
  });
  assert.deepEqual(disableOriginal(twice), {
    original: false,
    skinId: 'glass',
    themeId: 'night',
    rememberedSkinId: null,
    rememberedThemeId: null,
  });
});

test('double disable keeps the current skin and remembered null', () => {
  const state = createThemeState({ skinId: 'glass', themeId: 'night' });
  const once = disableOriginal(state);
  const twice = disableOriginal(once);

  assert.notEqual(once, state);
  assert.notEqual(twice, once);
  assert.deepEqual(once, {
    original: false,
    skinId: 'glass',
    themeId: 'night',
    rememberedSkinId: null,
    rememberedThemeId: null,
  });
  assert.deepEqual(twice, once);
});

test('disable after a restore does not wipe the skin', () => {
  const restored = disableOriginal(enableOriginal(createThemeState({ skinId: 'glass', themeId: 'night' })));
  const again = disableOriginal(restored);

  assert.deepEqual(again, {
    original: false,
    skinId: 'glass',
    themeId: 'night',
    rememberedSkinId: null,
    rememberedThemeId: null,
  });
});

test('enable and disable do not mutate the input', () => {
  const state = createThemeState({ skinId: 'glass', themeId: 'night' });
  const beforeEnable = { ...state };
  const enabled = enableOriginal(state);
  assert.deepEqual(state, beforeEnable);

  const beforeDisable = { ...enabled };
  const restored = disableOriginal(enabled);
  assert.deepEqual(enabled, beforeDisable);
  assert.notEqual(restored, enabled);

  const again = enableOriginal(enabled);
  assert.deepEqual(enabled, beforeDisable);
  assert.equal(again.rememberedSkinId, 'glass');
});

test('enableOriginal throws TypeError when state is not an object', () => {
  for (const value of [null, undefined, 'glass', 1, true]) {
    assert.throws(() => enableOriginal(value), TypeError);
  }
});
