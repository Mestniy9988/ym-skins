import assert from 'node:assert/strict';
import test from 'node:test';

import { auditSkinSource } from '../lib/skin-sandbox.mjs';

const benign = `
function draw() {
  runtime.onTrackChange(() => draw());
  const bars = getSpectrum();
  return bars.length;
}
`;

test('allows ordinary skin code that uses the runtime API', () => {
  assert.deepEqual(auditSkinSource(benign), { ok: true });
  assert.deepEqual(auditSkinSource('runtime.onTrackChange(() => draw())'), { ok: true });
  assert.deepEqual(auditSkinSource('getSpectrum()'), { ok: true });
  assert.deepEqual(auditSkinSource('function draw() { return 1; }'), { ok: true });
  assert.deepEqual(auditSkinSource('async function draw() {}'), { ok: true });
  assert.deepEqual(auditSkinSource(''), { ok: true });
});

test('rejects non-text input', () => {
  for (const value of [undefined, null, 0, 1, true, false, {}, [], Symbol('x')]) {
    assert.deepEqual(auditSkinSource(value), { ok: false, rule: 'not-text' });
  }
});

test('rejects eval', () => {
  assert.deepEqual(auditSkinSource('eval(code)'), { ok: false, rule: 'eval' });
  assert.deepEqual(auditSkinSource('EVAL (code)'), { ok: false, rule: 'eval' });
  assert.deepEqual(auditSkinSource('function draw() { /* eval( */ }'), { ok: false, rule: 'eval' });
});

test('rejects the Function constructor', () => {
  assert.deepEqual(auditSkinSource('new Function("return 1")'), { ok: false, rule: 'function' });
  assert.deepEqual(auditSkinSource('const Ctor = new Function'), { ok: false, rule: 'function' });
  assert.deepEqual(auditSkinSource('NEW   FUNCTION'), { ok: false, rule: 'function' });
  assert.deepEqual(auditSkinSource('Function("return 1")'), { ok: false, rule: 'function' });
  assert.deepEqual(auditSkinSource('function("return 1")'), { ok: false, rule: 'function' });
  assert.deepEqual(auditSkinSource('Function ("x")'), { ok: false, rule: 'function' });
  assert.deepEqual(auditSkinSource('return Function('), { ok: false, rule: 'function' });
});

test('rejects dynamic import and require', () => {
  assert.deepEqual(auditSkinSource('import(url)'), { ok: false, rule: 'import' });
  assert.deepEqual(auditSkinSource('IMPORT ("./x.js")'), { ok: false, rule: 'import' });
  assert.deepEqual(auditSkinSource('require("fs")'), { ok: false, rule: 'require' });
  assert.deepEqual(auditSkinSource('Require (id)'), { ok: false, rule: 'require' });
});

test('rejects network access', () => {
  assert.deepEqual(auditSkinSource('fetch(url)'), { ok: false, rule: 'fetch' });
  assert.deepEqual(auditSkinSource('FETCH (url)'), { ok: false, rule: 'fetch' });
  assert.deepEqual(auditSkinSource('new XMLHttpRequest()'), { ok: false, rule: 'xhr' });
  assert.deepEqual(auditSkinSource('xmlhttprequest'), { ok: false, rule: 'xhr' });
  assert.deepEqual(auditSkinSource('new WebSocket(url)'), { ok: false, rule: 'websocket' });
  assert.deepEqual(auditSkinSource('WEBSOCKET'), { ok: false, rule: 'websocket' });
});

test('rejects cookies and storage', () => {
  assert.deepEqual(auditSkinSource('document.cookie'), { ok: false, rule: 'cookie' });
  assert.deepEqual(auditSkinSource('Document . Cookie'), { ok: false, rule: 'cookie' });
  assert.deepEqual(auditSkinSource('localStorage'), { ok: false, rule: 'storage' });
  assert.deepEqual(auditSkinSource('LOCALSTORAGE'), { ok: false, rule: 'storage' });
  assert.deepEqual(auditSkinSource('sessionStorage'), { ok: false, rule: 'storage' });
  assert.deepEqual(auditSkinSource('SessionStorage.getItem("a")'), { ok: false, rule: 'storage' });
  assert.deepEqual(auditSkinSource('indexedDB'), { ok: false, rule: 'storage' });
  assert.deepEqual(auditSkinSource('IndexedDB'), { ok: false, rule: 'storage' });
});

test('a comment that names a banned API still counts', () => {
  assert.deepEqual(
    auditSkinSource('function draw() {\n  // do not fetch(\n}\n'),
    { ok: false, rule: 'fetch' },
  );
  assert.deepEqual(
    auditSkinSource('/* localStorage is forbidden */\nfunction draw() {}'),
    { ok: false, rule: 'storage' },
  );
});

test('the earliest rule in scan order wins', () => {
  assert.deepEqual(auditSkinSource('fetch(url); eval(code)'), { ok: false, rule: 'eval' });
  assert.deepEqual(auditSkinSource('localStorage; new Function'), { ok: false, rule: 'function' });
  assert.deepEqual(auditSkinSource('WebSocket; indexedDB'), { ok: false, rule: 'websocket' });
  assert.deepEqual(
    auditSkinSource('function draw() { fetch(1) }'),
    { ok: false, rule: 'fetch' },
  );
});

test('does not treat nearby identifiers as banned calls', () => {
  assert.deepEqual(auditSkinSource('myFunction(1)'), { ok: true });
  assert.deepEqual(auditSkinSource('evaluate(1)'), { ok: true });
  assert.deepEqual(auditSkinSource('document.cookieStore'), { ok: true });
  assert.deepEqual(auditSkinSource('mylocalStorage'), { ok: true });
  assert.deepEqual(auditSkinSource('obj.function(1)'), { ok: true });
});
