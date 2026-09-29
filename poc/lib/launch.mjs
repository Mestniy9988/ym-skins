import { execFile, spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';

import { fetchLoopbackJson } from './cdp.mjs';
import { parseNetstat } from './plan.mjs';

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

export async function spawnDebugClient({ exe, args, port }) {
  if (process.platform !== 'win32') {
    throw new Error('refusing to launch off Windows');
  }
  if (!args.includes('--remote-debugging-address=127.0.0.1')) {
    throw new Error('refusing to launch without a loopback debug address');
  }
  const child = spawn(exe, args, {
    cwd: path.win32.dirname(exe),
    stdio: 'ignore',
    windowsHide: false,
  });
  return {
    pid: child.pid,
    port,
    async close() {
      await killTree(child.pid);
    },
  };
}

export async function assertLoopback(pid, port) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    const rows = parseNetstat(await execText('netstat', ['-ano', '-p', 'TCP'])).filter((row) => row.port === port);
    if (rows.length > 0) {
      const tree = await processTree(pid);
      if (rows.some((row) => !tree.has(row.pid))) return false;
      if (rows.some((row) => row.address !== '127.0.0.1' && row.address !== '::1')) return false;
      try {
        await fetchLoopbackJson(port, '/json/version');
        return true;
      } catch {
        return false;
      }
    }
    await delay(300);
  }
  return false;
}

async function processTree(root) {
  const set = new Set([root]);
  const text = await execText('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    'Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId | ConvertTo-Json -Compress',
  ]);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return set;
  }
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  let grew = true;
  while (grew) {
    grew = false;
    for (const row of rows) {
      const pid = Number(row.ProcessId);
      const parent = Number(row.ParentProcessId);
      if (set.has(parent) && !set.has(pid)) {
        set.add(pid);
        grew = true;
      }
    }
  }
  return set;
}

function killTree(pid) {
  if (!pid) return Promise.resolve();
  return new Promise((resolve) => {
    execFile('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }, () => resolve());
  });
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
