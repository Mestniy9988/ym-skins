import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { inspectPage, restoreSurface } from './lib/cdp.mjs';
import { executeProbe } from './lib/execute.mjs';
import { findInstalledClient } from './lib/find-client.mjs';
import { readFuses } from './lib/fuses.mjs';
import { hashFile } from './lib/hash.mjs';
import { assertLoopback, reservePort, spawnDebugClient } from './lib/launch.mjs';
import { readVersions } from './lib/version.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(root, 'out');
const reportPath = path.join(outDir, 'stage1-report.md');
const sessionPath = path.join(outDir, 'session.json');
const baselinePath = path.join(outDir, 'baseline.json');

if (process.argv.includes('--restore')) {
  if (process.platform !== 'win32' && process.platform !== 'linux') {
    console.error('Снятие стиля здесь не выполняется: клиент запускается на Windows и Linux.');
    process.exit(2);
  }
  const session = readJson(sessionPath);
  if (!session?.port) {
    console.error('Нет poc/out/session.json от предыдущего запуска. Стиль не снимался.');
    process.exit(2);
  }
  const removed = await restoreSurface(session.port);
  console.log(removed ? 'Стиль прототипа снят.' : 'Страница клиента не найдена. Снятие стиля не проверено.');
  process.exit(removed ? 0 : 1);
}

const result = await executeProbe(
  { platform: process.platform },
  {
    findClient: findInstalledClient,
    readFuses,
    hashFile,
    readVersions,
    loadBaseline: async () => readJson(baselinePath),
    saveBaseline: async (snapshot) => writeJson(baselinePath, snapshot),
    saveSession: async (session) => writeJson(sessionPath, session),
    reservePort,
    pause: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    spawnDebugClient,
    assertLoopback,
    inspectPage,
  },
);

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(reportPath, result.markdown);
process.stdout.write(result.markdown);
process.stdout.write(`\nОтчёт: ${reportPath}\n`);
process.exit(result.exitCode);

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}
