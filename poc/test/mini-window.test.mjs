import assert from 'node:assert/strict';
import test from 'node:test';

import {
  closeMini,
  createMiniWindow,
  dragMini,
  openMini,
  setAlwaysOnTop,
  setScale,
  snapToEdge,
  toggleShade,
  windowSize,
} from '../lib/mini-window.mjs';

test('the window opens at 275 by 116 and doubles with the scale', () => {
  let state = openMini(createMiniWindow());
  assert.deepEqual(windowSize(state), { width: 275, height: 116 });
  state = setScale(state, 2).state;
  assert.deepEqual(windowSize(state), { width: 550, height: 232 });
  assert.equal(setScale(state, 3).refused, 'scale');
});

test('shade shortens the open window and dragging clears a snapped edge', () => {
  let state = openMini(createMiniWindow());
  assert.equal(toggleShade(createMiniWindow()).refused, 'closed');
  state = toggleShade(state).state;
  assert.equal(state.shade, true);
  assert.deepEqual(windowSize(state), { width: 275, height: 14 });
  state = snapToEdge(state, 'right').state;
  assert.equal(state.edge, 'right');
  state = dragMini(state, 4, -2).state;
  assert.equal(state.edge, null);
  assert.equal(state.x, 4);
  assert.equal(state.y, -2);
  state = setAlwaysOnTop(state, true);
  assert.equal(state.alwaysOnTop, true);
  state = closeMini(state);
  assert.equal(state.open, false);
  assert.equal(state.shade, false);
  assert.equal(snapToEdge(state, 'middle').refused, 'edge');
});
