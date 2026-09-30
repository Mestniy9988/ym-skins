import assert from 'node:assert/strict';
import test from 'node:test';

import { createSkinSession } from '../lib/skin-session.mjs';
import { applyTrayAction, trayMenu } from '../lib/tray-menu.mjs';

test('tray lists original theme, restore and the compatibility label', () => {
  const session = createSkinSession({ skinId: 'classic-98', themeId: 'green' });
  const items = trayMenu({ session, statusLabel: 'Совместимо' });
  assert.deepEqual(items.map((item) => item.id), ['original', 'skin', 'updates', 'restore', 'status', 'quit']);
  assert.equal(items.find((item) => item.id === 'original').checked, false);
  assert.equal(items.find((item) => item.id === 'skin').skinId, 'classic-98');
  assert.equal(items.find((item) => item.id === 'status').label, 'Совместимо');
});

test('original theme disables the tray skin and restore clears the session', () => {
  let session = createSkinSession({ skinId: 'classic-98', themeId: 'green' });
  session = applyTrayAction(session, 'original').session;
  const items = trayMenu({ session, statusLabel: 'Безопасный режим' });
  assert.equal(items.find((item) => item.id === 'original').checked, true);
  assert.equal(items.find((item) => item.id === 'skin').enabled, false);
  assert.equal(applyTrayAction(session, 'skin', { skinId: 'neon-cyber', themeId: 'pink' }).refused, 'original');
  session = applyTrayAction(session, 'restore').session;
  assert.equal(session.original, false);
  assert.equal(session.appliedSkinId, null);
});

test('tray skin choice applies without a restart and does not touch the network', () => {
  const session = createSkinSession();
  const result = applyTrayAction(session, 'skin', { skinId: 'vinyl-turntable', themeId: 'oak' });
  assert.equal(result.restartRequired, false);
  assert.equal(result.session.appliedSkinId, 'vinyl-turntable');
  assert.equal(result.session.appliedThemeId, 'oak');
  assert.equal(applyTrayAction(result.session, 'updates').checkUpdates, true);
  assert.equal(applyTrayAction(result.session, 'quit').quit, true);
  assert.equal(applyTrayAction.toString().includes('fetch('), false);
});
