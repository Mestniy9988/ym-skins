import assert from 'node:assert/strict';
import test from 'node:test';

import { auditSkinCss, testSkinCss } from '../lib/skin-css.mjs';

test('the probe stylesheet only targets data-yms and passes the audit', () => {
  const css = testSkinCss();
  assert.equal(auditSkinCss(css).ok, true);
  assert.equal(css.includes('[data-yms="player.play"]'), true);
  assert.equal(css.includes('prefers-reduced-motion'), true);
  assert.equal(css.includes('data-test-id'), false);
  assert.equal(css.includes('url('), false);
});

test('a class selector, a remote url and an import are rejected', () => {
  assert.equal(auditSkinCss('.play { color: red }').reason, 'selector');
  assert.equal(
    auditSkinCss('[data-yms="player.play"], .secret { color: red }').reason,
    'selector',
  );
  assert.equal(
    auditSkinCss('[data-yms="player.play"] { background: url(https://example.test/a.png) }').reason,
    'forbidden',
  );
  assert.equal(auditSkinCss('@import "skin.css";').reason, 'forbidden');
  assert.equal(auditSkinCss('').reason, 'size');
});
