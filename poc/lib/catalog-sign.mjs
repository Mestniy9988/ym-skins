import crypto from 'node:crypto';

const MAX_PAYLOAD = 256 * 1024;

export function verifyCatalogSignature({ payload, signature, publicKey } = {}) {
  const bytes = payloadBytes(payload);
  if (!bytes) return { ok: false, reason: 'payload' };
  if (!Buffer.isBuffer(signature) || signature.length !== 64) return { ok: false, reason: 'signature' };
  if (!isKey(publicKey)) return { ok: false, reason: 'key' };
  try {
    const ok = crypto.verify(null, bytes, publicKey, signature);
    return ok ? { ok: true } : { ok: false, reason: 'mismatch' };
  } catch {
    return { ok: false, reason: 'key' };
  }
}

function payloadBytes(payload) {
  if (typeof payload === 'string') {
    if (payload.length === 0 || Buffer.byteLength(payload) > MAX_PAYLOAD) return null;
    return Buffer.from(payload);
  }
  if (Buffer.isBuffer(payload)) {
    if (payload.length === 0 || payload.length > MAX_PAYLOAD) return null;
    return payload;
  }
  return null;
}

function isKey(publicKey) {
  if (typeof publicKey === 'string') return publicKey.includes('PUBLIC KEY');
  return publicKey != null && typeof publicKey === 'object' && typeof publicKey.asymmetricKeyType === 'string';
}
