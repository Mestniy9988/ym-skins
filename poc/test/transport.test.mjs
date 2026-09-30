import assert from 'node:assert/strict';
import test from 'node:test';

import { pressTransport } from '../lib/transport.mjs';

function button(name) {
  return {
    clicks: 0,
    click() {
      this.clicks += 1;
    },
    name,
  };
}

function documentWith(nodes) {
  return {
    querySelector(selector) {
      const match = /^\[data-yms="(player\.[a-z]+)"\]$/.exec(selector);
      if (!match) return null;
      return nodes[match[1]] || null;
    },
  };
}

test('play and pause click only the matching stamped control', () => {
  const play = button('play');
  const pause = button('pause');
  const document = documentWith({ 'player.play': play, 'player.pause': pause });
  assert.deepEqual(pressTransport(document, 'play'), { pressed: true, name: 'play' });
  assert.equal(play.clicks, 1);
  assert.equal(pause.clicks, 0);
  assert.deepEqual(pressTransport(document, 'pause'), { pressed: true, name: 'pause' });
  assert.equal(pause.clicks, 1);
});

test('a missing control and an unknown action do not click anything', () => {
  const play = button('play');
  const document = documentWith({ 'player.play': play });
  assert.deepEqual(pressTransport(document, 'like'), { pressed: false, reason: 'missing', name: 'like' });
  assert.deepEqual(pressTransport(document, 'seek'), { pressed: false, reason: 'action' });
  assert.equal(play.clicks, 0);
  assert.equal(pressTransport.toString().includes('.src'), false);
});
