import { execFile, spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';

import { fetchLoopbackJson } from './cdp.mjs';
import { classifyListeners, parseNetstat } from './plan.mjs';

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
  return {
    cwd: path.win32.dirname(exe),
    stdio: 'ignore',
    windowsHide: false,
    detached: true,
  };
}

export function tasklistHasPid(text, pid) {
  const target = String(pid);
  return String(text).split(/\r?\n/).some((line) => {
    const cells = line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''));
    return cells.includes(target);
  });
}

export async function spawnDebugClient({ exe, args, port }) {
  if (process.platform !== 'win32') {
    throw new Error('refusing to launch off Windows');
  }
  if (!args.includes('--remote-debugging-address=127.0.0.1')) {
    throw new Error('refusing to launch without a loopback debug address');
  }
  const child = spawn(exe, args, clientSpawnOptions(exe));
  child.unref();
  return {
    pid: child.pid,
    port,
    async close() {
      await killTree(child.pid);
    },
  };
}

export async function assertLoopback(pid, port, exe) {
  const deadline = Date.now() + 45000;
  let reason = 'timeout';
  while (Date.now() < deadline) {
    const rows = parseNetstat(await execText('netstat', ['-ano', '-p', 'TCP'])).filter((row) => row.port === port);
    const images = await imagePaths(rows.map((row) => row.pid));
    const seen = classifyListeners(rows, new Set([pid]), images, exe);
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

async function killTree(pid) {
  if (!pid) return;
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
