import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import { verifyCatalogSignature } from '../lib/catalog-sign.mjs';

test('a matching ed25519 signature is accepted', () => {
  const payload = '{"catalog":"5.121.2"}';
  const keys = crypto.generateKeyPairSync('ed25519');
  const signature = crypto.sign(null, Buffer.from(payload), keys.privateKey);
  assert.deepEqual(
    verifyCatalogSignature({ payload, signature, publicKey: keys.publicKey }),
    { ok: true },
  );
});

test('a changed payload, a short signature and a foreign key are rejected', () => {
  const payload = '{"catalog":"5.121.2"}';
  const keys = crypto.generateKeyPairSync('ed25519');
  const other = crypto.generateKeyPairSync('ed25519');
  const signature = crypto.sign(null, Buffer.from(payload), keys.privateKey);
  assert.equal(
    verifyCatalogSignature({ payload: '{"catalog":"9.9.9"}', signature, publicKey: keys.publicKey }).reason,
    'mismatch',
  );
  assert.equal(
    verifyCatalogSignature({ payload, signature, publicKey: other.publicKey }).reason,
    'mismatch',
  );
  assert.equal(
    verifyCatalogSignature({ payload, signature: signature.subarray(0, 8), publicKey: keys.publicKey }).reason,
    'signature',
  );
  assert.equal(verifyCatalogSignature({ payload: '', signature, publicKey: keys.publicKey }).reason, 'payload');
  assert.equal(verifyCatalogSignature({ payload, signature, publicKey: 'not-a-key' }).reason, 'key');
});
