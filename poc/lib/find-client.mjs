import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export function isMusicDisplayName(name) {
  if (!name) return false;
  return /яндекс[\s.]*музыка|yandex[\s.]*music|yandexmusic/i.test(name);
}

export function exeFromDisplayIcon(icon) {
  if (!icon || typeof icon !== 'string') return null;
  let trimmed = icon.trim();
  if (trimmed.startsWith('"')) {
    const end = trimmed.indexOf('"', 1);
    if (end > 1) trimmed = trimmed.slice(1, end);
  }
  const comma = trimmed.match(/^(.*\.exe)\s*,\s*\d+\s*$/i);
  if (comma) return comma[1];
  if (/\.exe$/i.test(trimmed)) return trimmed;
  return null;
}

export function knownInstallDirs(env) {
  const dirs = [];
  const local = env.LOCALAPPDATA;
  const programFiles = env.ProgramFiles;
  const programFilesX86 = env['ProgramFiles(x86)'];
  if (local) {
    dirs.push(path.win32.join(local, 'Programs', 'YandexMusic'));
    dirs.push(path.win32.join(local, 'Programs', 'Yandex.Music'));
    dirs.push(path.win32.join(local, 'YandexMusic'));
    dirs.push(path.win32.join(local, 'Programs', 'Yandex Music'));
  }
  if (programFiles) {
    dirs.push(path.win32.join(programFiles, 'YandexMusic'));
    dirs.push(path.win32.join(programFiles, 'Yandex.Music'));
  }
  if (programFilesX86) dirs.push(path.win32.join(programFilesX86, 'YandexMusic'));
  return dirs;
}

export function installFolders(root, childNames) {
  const versions = (childNames || [])
    .filter((name) => /^app-\d[\w.-]*$/.test(name))
    .sort((left, right) => right.localeCompare(left, 'en', { numeric: true }));
  return [root, ...versions.map((name) => path.win32.join(root, name))];
}

export function chooseClient(candidates) {
  const seen = new Set();
  const music = [];
  for (const candidate of candidates || []) {
    if (!candidate?.exe || !candidate.asar) continue;
    if (!isMusicDisplayName(candidate.displayName)) continue;
    const key = candidate.exe.replace(/\//g, '\\').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    music.push(candidate);
  }
  const registry = music.filter((candidate) => candidate.source === 'registry');
  const pool = registry.length > 0 ? registry : music;
  if (pool.length === 0) return { ambiguous: false, client: null };
  if (pool.length > 1) return { ambiguous: true, client: null, clients: pool };
  return { ambiguous: false, client: pool[0] };
}

function powershell(script) {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { windowsHide: true, timeout: 20000, maxBuffer: 2_000_000 },
      (error, stdout) => {
        resolve(error ? '' : String(stdout || ''));
      },
    );
  });
}

function asJsonList(text) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

function candidateFromExe(exe, source, displayName, displayVersion) {
  if (!exe || !fs.existsSync(exe)) return null;
  const asar = path.win32.join(path.win32.dirname(exe), 'resources', 'app.asar');
  if (!fs.existsSync(asar)) return null;
  return {
    exe,
    asar,
    installDir: path.win32.dirname(exe),
    source,
    displayName,
    displayVersion: displayVersion || null,
    running: false,
  };
}

export async function findInstalledClient() {
  if (process.platform !== 'win32') return { ambiguous: false, client: null };
  const found = [];
  const registryText = await powershell(`
    $ErrorActionPreference = 'SilentlyContinue'
    $roots = @(
      'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
      'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
      'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
    )
    $items = foreach ($root in $roots) {
      Get-ItemProperty $root | Where-Object {
        $_.DisplayName -and ($_.DisplayName -match 'Yandex\\s*Music|YandexMusic|Яндекс\\s*Музыка')
      }
    }
    $items | Select-Object DisplayName, DisplayVersion, InstallLocation, DisplayIcon | ConvertTo-Json -Compress
  `);
  for (const row of asJsonList(registryText)) {
    const exe = exeFromDisplayIcon(row.DisplayIcon) || exeInDir(row.InstallLocation);
    const candidate = candidateFromExe(exe, 'registry', row.DisplayName, row.DisplayVersion);
    if (candidate) found.push(candidate);
  }
  for (const dir of knownInstallDirs(process.env)) {
    const candidate = candidateFromExe(
      exeInDir(dir),
      'known-path',
      path.win32.basename(dir).replace(/\s+/g, ''),
      null,
    );
    if (candidate) found.push(candidate);
  }
  const localPrograms = process.env.LOCALAPPDATA
    ? path.win32.join(process.env.LOCALAPPDATA, 'Programs')
    : '';
  if (localPrograms && fs.existsSync(localPrograms)) {
    for (const entry of fs.readdirSync(localPrograms, { withFileTypes: true })) {
      if (!entry.isDirectory() || !isMusicDisplayName(entry.name)) continue;
      const candidate = candidateFromExe(
        exeInDir(path.win32.join(localPrograms, entry.name)),
        'known-path',
        entry.name,
        null,
      );
      if (candidate) found.push(candidate);
    }
  }
  const chosen = chooseClient(found);
  if (!chosen.client) return chosen;
  const processes = asJsonList(await powershell(`
    $ErrorActionPreference = 'SilentlyContinue'
    Get-CimInstance Win32_Process |
      Where-Object { $_.ExecutablePath } |
      Select-Object ProcessId, ExecutablePath |
      ConvertTo-Json -Compress
  `));
  const exeKey = chosen.client.exe.replace(/\//g, '\\').toLowerCase();
  chosen.client.running = processes.some((row) => {
    const running = String(row.ExecutablePath || '').replace(/\//g, '\\').toLowerCase();
    return running === exeKey;
  });
  return chosen;
}

export const MUSIC_EXE_NAMES = ['YandexMusic.exe', 'Yandex Music.exe', 'Яндекс Музыка.exe'];

function exeInDir(dir) {
  if (!dir || typeof dir !== 'string' || !fs.existsSync(dir)) return null;
  let children = [];
  try {
    children = fs.readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    children = [];
  }
  for (const folder of installFolders(dir, children)) {
    for (const name of MUSIC_EXE_NAMES) {
      const exe = path.win32.join(folder, name);
      const asar = path.win32.join(folder, 'resources', 'app.asar');
      if (fs.existsSync(exe) && fs.existsSync(asar)) return exe;
    }
  }
  return null;
}
