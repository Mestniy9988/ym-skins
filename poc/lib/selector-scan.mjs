import fs from 'node:fs';

const ID_RE = /^[A-Z0-9_]{1,80}$/;
const CHUNK = 1024 * 1024;
const OVERLAP = 64;
const MAX_IDS = 64;

function isTestId(value) {
  return typeof value === 'string' && ID_RE.test(value);
}

export function collectTestIds(selectorMap) {
  const elements = selectorMap?.elements;
  if (elements == null || typeof elements !== 'object') return [];
  const seen = new Set();
  const out = [];
  for (const value of Object.values(elements)) {
    const items = Array.isArray(value) ? value : [value];
    for (const item of items) {
      if (!isTestId(item) || seen.has(item)) continue;
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

function acceptedIds(ids) {
  const accepted = [];
  if (!Array.isArray(ids)) return accepted;
  for (const id of ids) {
    if (!isTestId(id)) continue;
    accepted.push(id);
    if (accepted.length === MAX_IDS) break;
  }
  return accepted;
}

export function scanTestIds(file, ids) {
  const accepted = acceptedIds(ids);
  const hit = new Array(accepted.length).fill(false);
  const fd = fs.openSync(file, 'r');
  try {
    if (accepted.length > 0) {
      const size = fs.fstatSync(fd).size;
      let carry = Buffer.alloc(0);
      let remaining = accepted.length;
      for (let pos = 0; pos < size && remaining > 0; pos += CHUNK) {
        const buf = Buffer.alloc(Math.min(CHUNK, size - pos));
        if (fs.readSync(fd, buf, 0, buf.length, pos) !== buf.length) break;
        const text = Buffer.concat([carry, buf]).toString('latin1');
        for (let i = 0; i < accepted.length; i += 1) {
          if (hit[i] || !text.includes(accepted[i])) continue;
          hit[i] = true;
          remaining -= 1;
        }
        carry = buf.subarray(Math.max(0, buf.length - OVERLAP));
      }
    }
  } finally {
    fs.closeSync(fd);
  }
  const found = [];
  const missing = [];
  for (let i = 0; i < accepted.length; i += 1) {
    if (hit[i]) found.push(accepted[i]);
    else missing.push(accepted[i]);
  }
  return { found, missing };
}
