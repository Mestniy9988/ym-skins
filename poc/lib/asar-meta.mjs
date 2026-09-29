import fs from 'node:fs';

const MAX_HEADER = 32 * 1024 * 1024;
const MAX_PACKAGE = 1024 * 1024;

function pickleOf(payload) {
  const header = Buffer.alloc(4);
  header.writeUInt32LE(payload.length, 0);
  return Buffer.concat([header, payload]);
}

function pickleU32(value) {
  const payload = Buffer.alloc(4);
  payload.writeUInt32LE(value, 0);
  return pickleOf(payload);
}

function pickleString(value) {
  const bytes = Buffer.from(value, 'utf8');
  const length = Buffer.alloc(4);
  length.writeInt32LE(bytes.length, 0);
  const pad = (4 - (bytes.length % 4)) % 4;
  return pickleOf(Buffer.concat([length, bytes, Buffer.alloc(pad)]));
}

export function writeFixtureAsar(file, pkg) {
  const packageJson = Buffer.from(JSON.stringify(pkg));
  const headerJson = JSON.stringify({
    files: {
      'package.json': { size: packageJson.length, offset: '0' },
      nested: { files: { 'package.json': { size: 2, offset: '999999' } } },
    },
  });
  const headerPickle = pickleString(headerJson);
  const sizePickle = pickleU32(headerPickle.length);
  fs.writeFileSync(file, Buffer.concat([sizePickle, headerPickle, packageJson]));
}

export function readRootPackage(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const sizeBuf = Buffer.alloc(8);
    if (fs.readSync(fd, sizeBuf, 0, 8, 0) !== 8) {
      throw new Error('asar header is too short');
    }
    const headerSize = sizeBuf.readUInt32LE(4);
    if (headerSize < 8 || headerSize > MAX_HEADER) {
      throw new Error('asar header size is not usable');
    }
    const headerBuf = Buffer.alloc(headerSize);
    if (fs.readSync(fd, headerBuf, 0, headerSize, 8) !== headerSize) {
      throw new Error('asar header was truncated');
    }
    const jsonLength = headerBuf.readInt32LE(4);
    if (jsonLength < 2 || 8 + jsonLength > headerBuf.length) {
      throw new Error('asar header json is truncated');
    }
    const header = JSON.parse(headerBuf.subarray(8, 8 + jsonLength).toString('utf8'));
    const info = header.files?.['package.json'];
    if (!info || info.unpacked || typeof info.size !== 'number' || info.offset == null) {
      return { name: null, version: null };
    }
    if (info.size < 2 || info.size > MAX_PACKAGE) {
      throw new Error('root package.json has an unexpected size');
    }
    const offset = 8 + headerSize + Number.parseInt(info.offset, 10);
    if (!Number.isFinite(offset) || offset < 0) {
      throw new Error('root package.json offset is not usable');
    }
    const body = Buffer.alloc(info.size);
    if (fs.readSync(fd, body, 0, info.size, offset) !== info.size) {
      throw new Error('root package.json was truncated');
    }
    const pkg = JSON.parse(body.toString('utf8'));
    return {
      name: typeof pkg.name === 'string' ? pkg.name : null,
      version: typeof pkg.version === 'string' ? pkg.version : null,
    };
  } finally {
    fs.closeSync(fd);
  }
}
