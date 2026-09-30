import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyButton,
  applyPreview,
  createSkinSession,
  previewSkin,
  restoreSession,
  setOriginal,
} from '../lib/skin-session.mjs';

test('preview does not change the applied skin until apply', () => {
  const initial = createSkinSession({ skinId: 'classic-98', themeId: 'green' });
  const previewed = previewSkin(initial, { skinId: 'neon-cyber', themeId: 'pink' });
  assert.equal(previewed.refused, null);
  assert.equal(previewed.state.appliedSkinId, 'classic-98');
  assert.equal(previewed.state.previewSkinId, 'neon-cyber');
  assert.equal(applyButton(previewed.state), 'apply');

  const applied = applyPreview(previewed.state);
  assert.equal(applied.restartRequired, false);
  assert.equal(applied.alreadyApplied, false);
  assert.equal(applied.state.appliedSkinId, 'neon-cyber');
  assert.equal(applied.state.appliedThemeId, 'pink');
  assert.equal(applied.state.previewSkinId, null);
  assert.equal(applyButton(applied.state), 'applied');
});

test('choosing the applied skin again marks the button as already applied', () => {
  const initial = createSkinSession({ skinId: 'classic-98', themeId: 'green' });
  const previewed = previewSkin(initial, { skinId: 'classic-98', themeId: 'green' });
  assert.equal(applyButton(previewed.state), 'applied');
  const applied = applyPreview(previewed.state);
  assert.equal(applied.alreadyApplied, true);
  assert.equal(applied.state.appliedSkinId, 'classic-98');
});

test('original theme blocks preview and apply, then restores the remembered skin', () => {
  let state = createSkinSession({ skinId: 'aqua-jelly', themeId: 'blue' });
  state = setOriginal(state, true).state;
  assert.equal(state.original, true);
  assert.equal(state.appliedSkinId, null);
  assert.equal(applyButton(state), 'disabled');
  const blocked = previewSkin(state, { skinId: 'neon-cyber', themeId: 'pink' });
  assert.equal(blocked.refused, 'original');
  assert.equal(blocked.state.previewSkinId, null);
  assert.equal(applyPreview(state).refused, 'original');

  state = setOriginal(state, false).state;
  assert.equal(state.original, false);
  assert.equal(state.appliedSkinId, 'aqua-jelly');
  assert.equal(state.appliedThemeId, 'blue');
  assert.equal(applyButton(state), 'applied');
});

test('a second apply replaces the skin without asking for a restart', () => {
  let state = createSkinSession();
  state = applyPreview(previewSkin(state, { skinId: 'vinyl-turntable', themeId: 'oak' }).state).state;
  const next = applyPreview(previewSkin(state, { skinId: 'terminal-crt', themeId: 'amber' }).state);
  assert.equal(next.restartRequired, false);
  assert.equal(next.state.appliedSkinId, 'terminal-crt');
  assert.equal(next.state.appliedThemeId, 'amber');
});

test('restore drops the applied skin and a bad id is refused', () => {
  const state = createSkinSession({ skinId: 'classic-98', themeId: 'green' });
  assert.equal(previewSkin(state, { skinId: 'Bad Skin', themeId: 'green' }).refused, 'id');
  const restored = restoreSession();
  assert.equal(restored.appliedSkinId, null);
  assert.equal(restored.original, false);
  assert.equal(applyPreview(restored).refused, 'no-preview');
});
