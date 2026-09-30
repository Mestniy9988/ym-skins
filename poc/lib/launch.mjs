import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

import { fetchLoopbackJson } from './cdp.mjs';
import { classifyListeners, isWindowsExePath, parseNetstat, parseProcNet } from './plan.mjs';

export function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

export function clientSpawnOptions(exe) {
  const windowsPath = isWindowsExePath(exe);
  const options = {
    cwd: windowsPath ? path.win32.dirname(exe) : path.dirname(exe),
    stdio: 'ignore',
    windowsHide: false,
    detached: true,
  };
  if (!windowsPath && process.platform === 'linux') options.env = linuxChildEnv();
  return options;
}

export function chromeSandboxMode(exe) {
  try {
    const mode = fs.statSync(path.join(path.dirname(exe), 'chrome-sandbox')).mode;
    return (mode & 0o4000) !== 0 ? 'setuid' : 'no-setuid';
  } catch {
    return 'missing';
  }
}

export function defaultUserDataDir() {
  return path.join(os.tmpdir(), 'ym-skins-probe-home', 'profile');
}

export function linuxDebugExtras(exe, options = {}) {
  const extras = ['--gtk-version=3'];
  const mode = typeof options.sandboxMode === 'function' ? options.sandboxMode(exe) : chromeSandboxMode(exe);
  if (mode !== 'setuid') extras.push('--no-sandbox');
  extras.push(`--user-data-dir=${options.userDataDir || defaultUserDataDir()}`);
  return extras;
}

export function tasklistHasPid(text, pid) {
  const target = String(pid);
  return String(text).split(/\r?\n/).some((line) => {
    const cells = line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''));
    return cells.includes(target);
  });
}

export async function spawnDebugClient({ exe, args, port }) {
  if (process.platform !== 'win32' && process.platform !== 'linux') {
    throw new Error('refusing to launch off Windows and Linux');
  }
  if (!args.includes('--remote-debugging-address=127.0.0.1')) {
    throw new Error('refusing to launch without a loopback debug address');
  }
  for (const arg of args) {
    if (arg.startsWith('--user-data-dir=')) fs.mkdirSync(arg.slice('--user-data-dir='.length), { recursive: true });
  }
  const child = spawn(exe, args, clientSpawnOptions(exe));
  child.on('exit', () => {});
  child.unref();
  return {
    pid: child.pid,
    port,
    async close() {
      await killTree(child.pid, args);
    },
  };
}

export async function assertLoopback(pid, port, exe) {
  const deadline = Date.now() + 45000;
  let reason = 'timeout';
  while (Date.now() < deadline) {
    const snapshot = process.platform === 'linux'
      ? linuxListeners(pid, port, exe)
      : await windowsListeners(port, pid, exe);
    const seen = classifyListeners(snapshot.rows, snapshot.owned, snapshot.images, snapshot.exe || exe);
    if (seen.state === 'exposed') return { ok: false, reason: 'exposed' };
    if (seen.state === 'absent') {
      reason = 'timeout';
      await delay(300);
      continue;
    }
    if (seen.state === 'foreign' || seen.state === 'unknown') {
      reason = seen.state === 'foreign' ? 'foreign' : 'unconfirmed';
      await delay(300);
      continue;
    }
    try {
      await fetchLoopbackJson(port, '/json/version');
      return { ok: true };
    } catch {
      reason = 'no-http';
      await delay(300);
    }
  }
  return { ok: false, reason };
}

async function imagePaths(pids) {
  const unique = [...new Set(pids.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0))];
  const map = new Map();
  if (unique.length === 0) return map;
  const filter = unique.map((item) => `ProcessId=${item}`).join(' OR ');
  const text = await execText('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    `Get-CimInstance Win32_Process -Filter ${psQuote(filter)} | Select-Object ProcessId, ExecutablePath | ConvertTo-Json -Compress`,
  ]);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return map;
  }
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  for (const row of rows) {
    const rowPid = Number(row?.ProcessId);
    if (!rowPid) continue;
    map.set(rowPid, typeof row?.ExecutablePath === 'string' ? row.ExecutablePath : '');
  }
  return map;
}

function psQuote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function windowsListeners(port, pid, exe) {
  const rows = parseNetstat(await execText('netstat', ['-ano', '-p', 'TCP'])).filter((row) => row.port === port);
  return {
    rows,
    images: await imagePaths(rows.map((row) => row.pid)),
    owned: new Set([pid]),
    exe,
  };
}

function linuxListeners(pid, port, exe) {
  const sockets = [];
  for (const name of ['tcp', 'tcp6']) {
    try {
      sockets.push(...parseProcNet(fs.readFileSync(`/proc/net/${name}`, 'utf8')));
    } catch {
      // /proc/net is unreadable in this environment.
    }
  }
  const mine = sockets.filter((row) => row.port === port);
  const owners = socketOwners(mine.map((row) => row.inode));
  const rows = [];
  for (const row of mine) {
    const pids = owners.get(row.inode) || [];
    if (pids.length === 0) rows.push({ address: row.address, port: row.port, pid: -1 });
    for (const owner of pids) rows.push({ address: row.address, port: row.port, pid: owner });
  }
  const images = new Map();
  let exeReal = exe;
  try {
    exeReal = fs.realpathSync(exe);
  } catch {
    exeReal = exe;
  }
  for (const row of rows) {
    if (row.pid > 0 && !images.has(row.pid)) images.set(row.pid, procExe(row.pid));
  }
  const owned = descendantPids(pid);
  owned.add(pid);
  return { rows, images, owned, exe: exeReal };
}

function procExe(pid) {
  try {
    return fs.realpathSync(`/proc/${pid}/exe`);
  } catch {
    return '';
  }
}

function socketOwners(inodes) {
  const wanted = new Set(inodes.filter((inode) => Number.isInteger(inode) && inode > 0));
  const map = new Map();
  if (wanted.size === 0) return map;
  let entries = [];
  try {
    entries = fs.readdirSync('/proc');
  } catch {
    return map;
  }
  for (const entry of entries) {
    if (!/^\d+$/.test(entry)) continue;
    let fds = [];
    try {
      fds = fs.readdirSync(`/proc/${entry}/fd`);
    } catch {
      continue;
    }
    for (const fd of fds) {
      let link = '';
      try {
        link = fs.readlinkSync(`/proc/${entry}/fd/${fd}`);
      } catch {
        continue;
      }
      const match = link.match(/^socket:\[(\d+)\]$/);
      if (!match || !wanted.has(Number(match[1]))) continue;
      const inode = Number(match[1]);
      if (!map.has(inode)) map.set(inode, []);
      map.get(inode).push(Number(entry));
    }
  }
  return map;
}

function descendantPids(root) {
  const children = new Map();
  let entries = [];
  try {
    entries = fs.readdirSync('/proc');
  } catch {
    return new Set();
  }
  for (const entry of entries) {
    if (!/^\d+$/.test(entry)) continue;
    const ppid = readPpid(Number(entry));
    if (!ppid) continue;
    if (!children.has(ppid)) children.set(ppid, []);
    children.get(ppid).push(Number(entry));
  }
  const owned = new Set();
  const stack = [...(children.get(root) || [])];
  while (stack.length > 0) {
    const current = stack.pop();
    if (owned.has(current)) continue;
    owned.add(current);
    for (const child of children.get(current) || []) stack.push(child);
  }
  return owned;
}

function readPpid(pid) {
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    const end = stat.lastIndexOf(')');
    if (end < 0) return 0;
    const fields = stat.slice(end + 2).trim().split(/\s+/);
    return Number(fields[1]) || 0;
  } catch {
    return 0;
  }
}

function linuxChildEnv() {
  const home = path.join(os.tmpdir(), 'ym-skins-probe-home');
  fs.mkdirSync(home, { recursive: true });
  const env = { ...process.env, HOME: home };
  const cookie = process.env.XAUTHORITY || path.join(os.homedir(), '.Xauthority');
  if (fs.existsSync(cookie)) env.XAUTHORITY = cookie;
  return env;
}

async function killTree(pid, args = []) {
  if (!pid) return;
  if (process.platform === 'linux') {
    await killLinux(pid, args);
    return;
  }
  await new Promise((resolve) => {
    execFile('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }, () => resolve());
  });
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const text = await execText('tasklist', ['/FI', `PID eq ${Number(pid)}`, '/FO', 'CSV', '/NH']);
    if (!tasklistHasPid(text, pid)) return;
    await delay(200);
  }
}

async function killLinux(pid, args) {
  const dataDir = userDataDirFromArgs(args);
  const stop = (signal) => {
    const targets = descendantPids(pid);
    targets.add(pid);
    for (const owner of pidsWithArg(dataDir ? `--user-data-dir=${dataDir}` : '')) targets.add(owner);
    for (const target of targets) {
      try {
        process.kill(target, signal);
      } catch {
        // The process has already exited.
      }
    }
    try {
      process.kill(-pid, signal);
    } catch {
      // The process group is already gone.
    }
  };
  stop('SIGTERM');
  if (await waitUntilGone(pid, dataDir, 8000)) return;
  stop('SIGKILL');
  await waitUntilGone(pid, dataDir, 8000);
}

function userDataDirFromArgs(args) {
  const match = (args || []).find((arg) => arg.startsWith('--user-data-dir='));
  return match ? match.slice('--user-data-dir='.length) : '';
}

function pidsWithArg(needle) {
  if (!needle) return [];
  const found = [];
  let entries = [];
  try {
    entries = fs.readdirSync('/proc');
  } catch {
    return found;
  }
  for (const entry of entries) {
    if (!/^\d+$/.test(entry)) continue;
    let raw;
    try {
      raw = fs.readFileSync(`/proc/${entry}/cmdline`);
    } catch {
      continue;
    }
    if (raw.toString('utf8').split('\0').includes(needle)) found.push(Number(entry));
  }
  return found;
}

async function waitUntilGone(pid, dataDir, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const alive = fs.existsSync(`/proc/${pid}`) || (dataDir && pidsWithArg(`--user-data-dir=${dataDir}`).length > 0);
    if (!alive) return true;
    await delay(200);
  }
  return false;
}

function execText(command, args) {
  return new Promise((resolve) => {
    execFile(command, args, { windowsHide: true, timeout: 20000, maxBuffer: 4_000_000 }, (error, stdout) => {
      resolve(error ? '' : String(stdout || ''));
    });
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
