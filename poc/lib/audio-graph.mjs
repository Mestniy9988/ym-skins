import fs from 'node:fs';

const NEEDLES = {
  mediaElement: 'createMediaElementSource',
  analyser: 'createAnalyser',
  frequency: 'getByteFrequencyData',
};

export function findAudioGraphMarkers(file) {
  const found = {
    mediaElement: false,
    analyser: false,
    frequency: false,
  };
  const fd = fs.openSync(file, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    const chunk = 1024 * 1024;
    const overlap = 64;
    let carry = Buffer.alloc(0);
    for (let pos = 0; pos < size; pos += chunk) {
      const buf = Buffer.alloc(Math.min(chunk, size - pos));
      if (fs.readSync(fd, buf, 0, buf.length, pos) !== buf.length) break;
      const text = Buffer.concat([carry, buf]).toString('latin1');
      for (const [key, needle] of Object.entries(NEEDLES)) {
        if (!found[key] && text.includes(needle)) found[key] = true;
      }
      if (found.mediaElement && found.analyser && found.frequency) break;
      carry = buf.subarray(Math.max(0, buf.length - overlap));
    }
  } finally {
    fs.closeSync(fd);
  }
  return {
    ...found,
    complete: found.mediaElement && found.analyser && found.frequency,
  };
}
