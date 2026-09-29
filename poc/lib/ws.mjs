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

export function encodeControlFrame(opcode, payload) {
  const body = Buffer.from(payload);
  if (body.length > 125) throw new Error('control frame is too large');
  const mask = crypto.randomBytes(4);
  const masked = Buffer.alloc(body.length);
  for (let index = 0; index < body.length; index += 1) masked[index] = body[index] ^ mask[index % 4];
  return Buffer.concat([Buffer.from([0x80 | opcode, 0x80 | body.length]), mask, masked]);
}

export function decodeFrames(buffer, state = { fragments: [] }) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const messages = [];
  const pings = [];
  let offset = 0;
  while (offset + 2 <= buf.length) {
    const opcode = buf[offset] & 0x0f;
    const fin = (buf[offset] & 0x80) !== 0;
    const masked = (buf[offset + 1] & 0x80) !== 0;
    let length = buf[offset + 1] & 0x7f;
    let header = 2;
    if (length === 126) {
      if (offset + 4 > buf.length) break;
      length = buf.readUInt16BE(offset + 2);
      header = 4;
    } else if (length === 127) {
      if (offset + 10 > buf.length) break;
      const wide = buf.readBigUInt64BE(offset + 2);
      if (wide > BigInt(Number.MAX_SAFE_INTEGER)) break;
      length = Number(wide);
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
    } else {
      payload = Buffer.from(payload);
    }
    if (opcode === 0x1) {
      if (fin) {
        state.fragments = [];
        messages.push(payload.toString('utf8'));
      } else {
        state.fragments = [payload];
      }
    } else if (opcode === 0x0 && state.fragments.length > 0) {
      state.fragments.push(payload);
      if (fin) {
        messages.push(Buffer.concat(state.fragments).toString('utf8'));
        state.fragments = [];
      }
    } else if (opcode === 0x9 && payload.length <= 125) {
      pings.push(payload);
    }
    offset += header + maskLength + length;
  }
  return { messages, pings, rest: buf.subarray(offset) };
}
