import crypto from 'node:crypto';

export function encodeTextFrame(text) {
  const payload = Buffer.from(text);
  const mask = crypto.randomBytes(4);
  const length = payload.length;
  let header;
  if (length < 126) {
    header = Buffer.from([0x81, 0x80 | length]);
  } else if (length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }
  const masked = Buffer.alloc(length);
  for (let index = 0; index < length; index += 1) {
    masked[index] = payload[index] ^ mask[index % 4];
  }
  return Buffer.concat([header, mask, masked]);
}

export function decodeFrames(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const messages = [];
  let offset = 0;
  while (offset + 2 <= buf.length) {
    const opcode = buf[offset] & 0x0f;
    const masked = (buf[offset + 1] & 0x80) !== 0;
    let length = buf[offset + 1] & 0x7f;
    let header = 2;
    if (length === 126) {
      if (offset + 4 > buf.length) break;
      length = buf.readUInt16BE(offset + 2);
      header = 4;
    } else if (length === 127) {
      if (offset + 10 > buf.length) break;
      length = Number(buf.readBigUInt64BE(offset + 2));
      header = 10;
    }
    const maskLength = masked ? 4 : 0;
    if (offset + header + maskLength + length > buf.length) break;
    let payload = buf.subarray(offset + header + maskLength, offset + header + maskLength + length);
    if (masked) {
      const mask = buf.subarray(offset + header, offset + header + 4);
      const out = Buffer.alloc(length);
      for (let index = 0; index < length; index += 1) out[index] = payload[index] ^ mask[index % 4];
      payload = out;
    }
    if (opcode === 0x1) messages.push(payload.toString('utf8'));
    offset += header + maskLength + length;
  }
  return { messages, rest: buf.subarray(offset) };
}
