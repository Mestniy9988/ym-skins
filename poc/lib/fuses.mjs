import fs from 'node:fs';

export const FUSE_SENTINEL = 'dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX';

export const FUSE_V1_NAMES = [
  'RunAsNode',
  'EnableCookieEncryption',
  'EnableNodeOptionsEnvironmentVariable',
  'EnableNodeCliInspectArguments',
  'EnableEmbeddedAsarIntegrityValidation',
  'OnlyLoadAppFromAsar',
  'LoadBrowserProcessSpecificV8Snapshot',
  'GrantFileProtocolExtraPrivileges',
  'WasmTrapHandlers',
];

const SENTINEL_BYTES = Buffer.from(FUSE_SENTINEL);

function stateName(byte) {
  if (byte === 0x30) return 'disable';
  if (byte === 0x31) return 'enable';
  if (byte === 0x72) return 'removed';
  if (byte === 0x90) return 'inherit';
  return 'unknown';
}

function decodeWire(tail) {
  if (tail.length < 2) {
    return { decoded: false, version: null, length: 0, fuses: [], raw: Buffer.alloc(0) };
  }
  const version = tail[0];
  const length = tail[1];
  const available = Math.max(0, tail.length - 2);
  const raw = Buffer.from(tail.subarray(2, 2 + Math.min(length, available)));
  if (version !== 1 || raw.length !== length) {
    return { decoded: false, version, length, fuses: [], raw };
  }
  const fuses = [];
  for (let index = 0; index < raw.length; index += 1) {
    fuses.push({
      name: FUSE_V1_NAMES[index] || `unknown_${index}`,
      state: stateName(raw[index]),
      raw: raw[index],
    });
  }
  return { decoded: true, version, length, fuses, raw };
}

export function parseFuseWire(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const wires = [];
  let from = 0;
  while (from < buf.length) {
    const index = buf.indexOf(SENTINEL_BYTES, from);
    if (index === -1) break;
    wires.push(decodeWire(buf.subarray(index + SENTINEL_BYTES.length)));
    from = index + SENTINEL_BYTES.length;
  }
  return { found: wires.length > 0, wires };
}

export function readFuses(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const { size } = fs.fstatSync(fd);
    const chunkSize = 1024 * 1024;
    const overlap = SENTINEL_BYTES.length - 1;
    let position = 0;
    let previous = Buffer.alloc(0);
    const hits = [];
    while (position < size) {
      const toRead = Math.min(chunkSize, size - position);
      const chunk = Buffer.alloc(toRead);
      fs.readSync(fd, chunk, 0, toRead, position);
      const haystack = Buffer.concat([previous, chunk]);
      const base = position - previous.length;
      let index = haystack.indexOf(SENTINEL_BYTES);
      while (index !== -1) {
        hits.push(base + index);
        index = haystack.indexOf(SENTINEL_BYTES, index + 1);
      }
      previous = haystack.subarray(Math.max(0, haystack.length - overlap));
      position += toRead;
    }
    if (hits.length === 0) return { found: false, wires: [] };
    return {
      found: true,
      wires: hits.map((hit) => {
        const tail = Buffer.alloc(2 + 255);
        const read = fs.readSync(fd, tail, 0, tail.length, hit + SENTINEL_BYTES.length);
        return decodeWire(tail.subarray(0, read));
      }),
    };
  } finally {
    fs.closeSync(fd);
  }
}
