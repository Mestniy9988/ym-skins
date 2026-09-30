const BANNED = [
  'cookie',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'document.title',
  'currentSrc',
  '.src',
  'password',
  'getCookies',
  'Authorization',
  'webRequest',
  'token',
];

const LAUNCH_PLATFORMS = new Set(['win32', 'linux']);

export function decideRun({ platform, client, alreadyRunning }) {
  if (!LAUNCH_PLATFORMS.has(platform)) return { launch: false, code: 'not-windows' };
  if (!client) return { launch: false, code: 'client-not-found' };
  if (alreadyRunning) return { launch: false, code: 'already-running' };
  return { launch: true, code: 'launch' };
}

export function isWindowsExePath(exe) {
  return /^[A-Za-z]:[\\/]/.test(String(exe || '')) || String(exe || '').includes('\\');
}

export function buildLaunchArgs(port, extras = []) {
  return [
    `--remote-debugging-port=${port}`,
    '--remote-debugging-address=127.0.0.1',
    `--remote-allow-origins=http://127.0.0.1:${port}`,
    ...extras,
  ];
}

export function parseProcNet(text) {
  const rows = [];
  for (const line of String(text).split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 10) continue;
    if (!/^[0-9A-Fa-f]+:[0-9A-Fa-f]+$/.test(parts[1])) continue;
    if (parts[3].toUpperCase() !== '0A') continue;
    const [hexAddress, hexPort] = parts[1].split(':');
    const address = decodeProcAddress(hexAddress);
    const port = Number.parseInt(hexPort, 16);
    const inode = Number(parts[9]);
    if (!address || !Number.isInteger(port) || !Number.isInteger(inode)) continue;
    rows.push({ address, port, inode });
  }
  return rows;
}

function decodeProcAddress(hex) {
  if (hex.length === 8) {
    const value = Number.parseInt(hex, 16);
    if (!Number.isInteger(value)) return '';
    return `${value & 0xff}.${(value >> 8) & 0xff}.${(value >> 16) & 0xff}.${(value >> 24) & 0xff}`;
  }
  if (hex.length !== 32) return '';
  const bytes = [];
  for (let index = 0; index < 4; index += 1) {
    const value = Number.parseInt(hex.slice(index * 8, index * 8 + 8), 16);
    if (!Number.isInteger(value)) return '';
    bytes.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
  }
  if (bytes.every((byte) => byte === 0)) return '::';
  if (bytes[15] === 1 && bytes.slice(0, 15).every((byte) => byte === 0)) return '::1';
  return 'ipv6';
}

export function parseNetstat(text) {
  const rows = [];
  for (const line of String(text).split(/\r?\n/)) {
    const match = line.match(/^\s*TCP\s+(\S+)\s+\S+\s+(?:LISTENING|ПРОСЛУШИВАНИЕ)\s+(\d+)\s*$/i);
    if (!match) continue;
    const local = match[1];
    const pid = Number(match[2]);
    let address = '';
    let port = NaN;
    if (local.startsWith('[')) {
      const ipv6 = local.match(/^\[([^\]]+)\]:(\d+)$/);
      if (!ipv6) continue;
      address = ipv6[1];
      port = Number(ipv6[2]);
    } else {
      const index = local.lastIndexOf(':');
      if (index < 0) continue;
      address = local.slice(0, index);
      port = Number(local.slice(index + 1));
    }
    rows.push({ address, port, pid });
  }
  return rows;
}

export function bindIsLoopback(rows, port, pid) {
  const mine = rows.filter((row) => row.port === port && row.pid === pid);
  if (mine.length === 0) return false;
  return mine.every((row) => row.address === '127.0.0.1' || row.address === '::1');
}

export function sameExePath(left, right) {
  const norm = (value) => String(value || '')
    .replace(/^\\\\\?\\/, '')
    .replace(/\//g, '\\')
    .replace(/\\+$/, '')
    .toLowerCase();
  if (!norm(left) || !norm(right)) return false;
  return norm(left) === norm(right);
}

export function classifyListeners(rows, pids, imageByPid = null, exe = '') {
  if (!rows?.length) return { state: 'absent' };
  if (rows.some((row) => row.address !== '127.0.0.1' && row.address !== '::1')) {
    return { state: 'exposed' };
  }
  const owned = pids instanceof Set ? pids : new Set(pids || []);
  for (const row of rows) {
    if (owned.has(row.pid)) continue;
    if (!imageByPid) return { state: 'foreign' };
    const image = imageByPid.get(row.pid);
    if (image && sameExePath(image, exe)) continue;
    if (image) return { state: 'foreign' };
    return { state: 'unknown' };
  }
  return { state: 'loopback' };
}

export function pickPageTarget(targets) {
  const pages = [];
  for (const target of targets || []) {
    if (target?.type !== 'page' || !target.webSocketDebuggerUrl) continue;
    let socketUrl;
    let pageUrl;
    try {
      socketUrl = new URL(target.webSocketDebuggerUrl);
      pageUrl = new URL(target.url);
    } catch {
      continue;
    }
    if (socketUrl.protocol !== 'ws:' && socketUrl.protocol !== 'wss:') continue;
    if (socketUrl.hostname !== '127.0.0.1' && socketUrl.hostname !== 'localhost') continue;
    if (pageUrl.protocol === 'devtools:' || pageUrl.protocol === 'chrome:' || pageUrl.protocol === 'chrome-error:') continue;
    if (pageUrl.href === 'about:blank' || pageUrl.href.startsWith('about:blank')) continue;
    pages.push({
      webSocketDebuggerUrl: target.webSocketDebuggerUrl,
      protocol: pageUrl.protocol,
    });
  }
  if (pages.length === 0) return { webSocketDebuggerUrl: null, pageCount: 0 };
  return { webSocketDebuggerUrl: pages[0].webSocketDebuggerUrl, pageCount: pages.length };
}

export function auditExpression(source) {
  const lower = String(source).toLowerCase();
  for (const word of BANNED) {
    if (lower.includes(word.toLowerCase())) return word;
  }
  return null;
}

export function sameColor(left, right) {
  const a = parseColor(left);
  const b = parseColor(right);
  if (!a || !b) return false;
  return a.r === b.r && a.g === b.g && a.b === b.b;
}

function parseColor(value) {
  const match = String(value ?? '').match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!match) return null;
  return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) };
}
