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

export function decideRun({ platform, client, alreadyRunning }) {
  if (platform !== 'win32') return { launch: false, code: 'not-windows' };
  if (!client) return { launch: false, code: 'client-not-found' };
  if (alreadyRunning) return { launch: false, code: 'already-running' };
  return { launch: true, code: 'launch' };
}

export function buildLaunchArgs(port) {
  return [
    `--remote-debugging-port=${port}`,
    '--remote-debugging-address=127.0.0.1',
    `--remote-allow-origins=http://127.0.0.1:${port}`,
  ];
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

export function classifyListeners(rows, pids) {
  if (!rows?.length) return { state: 'absent' };
  if (rows.some((row) => row.address !== '127.0.0.1' && row.address !== '::1')) {
    return { state: 'exposed' };
  }
  const owned = pids instanceof Set ? pids : new Set(pids);
  if (rows.some((row) => !owned.has(row.pid))) return { state: 'foreign' };
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
    if (pageUrl.protocol === 'devtools:') continue;
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
