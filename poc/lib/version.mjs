import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { readRootPackage } from './asar-meta.mjs';

export async function readVersions(client) {
  let asar = null;
  try {
    asar = readRootPackage(client.asar).version;
  } catch {
    asar = null;
  }
  return {
    asar,
    exe: await readExeVersion(client.exe),
    updateFeed: readUpdateFeed(path.win32.join(path.win32.dirname(client.exe), 'resources', 'app-update.yml')),
  };
}

function readExeVersion(exe) {
  if (process.platform !== 'win32') return Promise.resolve(null);
  const script = `$v = (Get-Item -LiteralPath ${psQuote(exe)}).VersionInfo.ProductVersion; if ($v) { $v }`;
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { windowsHide: true, timeout: 15000 },
      (error, stdout) => {
        if (error) resolve(null);
        else resolve(String(stdout || '').trim() || null);
      },
    );
  });
}

function readUpdateFeed(file) {
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, 'utf8');
  if (text.length > 65536) return null;
  const picked = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^(provider|url|channel):\s*(.+?)\s*$/);
    if (!match) continue;
    picked[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
  if (picked.url && !/^https:\/\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+$/.test(picked.url)) {
    delete picked.url;
  }
  if (picked.url && picked.url.includes('@')) delete picked.url;
  if (!picked.provider && !picked.url) return null;
  return { provider: picked.provider || null, url: picked.url || null };
}

function psQuote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}
