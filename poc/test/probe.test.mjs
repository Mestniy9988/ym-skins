import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

import { readRootPackage, writeFixtureAsar } from '../lib/asar-meta.mjs';
import { waitForPageTarget } from '../lib/cdp.mjs';
import { executeProbe } from '../lib/execute.mjs';
import { clientSpawnOptions, tasklistHasPid } from '../lib/launch.mjs';
import {
  FUSE_SENTINEL,
  FUSE_V1_NAMES,
  parseFuseWire,
  readFuses,
} from '../lib/fuses.mjs';
import {
  MUSIC_EXE_NAMES,
  chooseClient,
  exeFromDisplayIcon,
  installFolders,
  isMusicDisplayName,
  knownInstallDirs,
} from '../lib/find-client.mjs';
import {
  POC_BACKGROUND,
  POC_BUTTON,
  analyserProbe,
  applySurface,
  menuProbe,
  pageExpression,
  pickButton,
  readSurface,
  removeSurface,
} from '../lib/page.mjs';
import {
  auditExpression,
  bindIsLoopback,
  buildLaunchArgs,
  classifyListeners,
  decideRun,
  parseNetstat,
  pickPageTarget,
  sameColor,
} from '../lib/plan.mjs';
import { buildReport } from '../lib/report.mjs';
import { compareSnapshots } from '../lib/snapshot.mjs';
import { decodeFrames, encodeControlFrame, encodeTextFrame } from '../lib/ws.mjs';

test('fuse wire names integrity and inspect flags without guessing past the wire', () => {
  const states = [0x30, 0x31, 0x30, 0x31, 0x31, 0x30, 0x31, 0x30, 0x72];
  const wire = Buffer.from([0x01, states.length, ...states]);
  const buf = Buffer.concat([
    Buffer.from('prefix'),
    Buffer.from(FUSE_SENTINEL),
    wire,
    Buffer.from('tail'),
  ]);
  const parsed = parseFuseWire(buf);
  assert.equal(parsed.found, true);
  assert.equal(parsed.wires.length, 1);
  const byName = Object.fromEntries(parsed.wires[0].fuses.map((fuse) => [fuse.name, fuse.state]));
  assert.equal(byName.RunAsNode, 'disable');
  assert.equal(byName.EnableCookieEncryption, 'enable');
  assert.equal(byName.EnableNodeCliInspectArguments, 'enable');
  assert.equal(byName.EnableEmbeddedAsarIntegrityValidation, 'enable');
  assert.equal(byName.OnlyLoadAppFromAsar, 'disable');
  assert.equal(byName.WasmTrapHandlers, 'removed');
  assert.equal(parsed.wires[0].fuses.length, FUSE_V1_NAMES.length);
});

test('unknown fuse byte and a longer wire are not given a made-up name or state', () => {
  const states = [0x31, 0x31, 0x31, 0x31, 0x30, 0x30, 0x30, 0x30, 0x30, 0x99];
  const buf = Buffer.concat([
    Buffer.from(FUSE_SENTINEL),
    Buffer.from([0x01, states.length, ...states]),
  ]);
  const parsed = parseFuseWire(buf);
  const last = parsed.wires[0].fuses.at(-1);
  assert.equal(last.name, 'unknown_9');
  assert.equal(last.state, 'unknown');
  assert.equal(last.raw, 0x99);
});

test('a fuse version other than 1 is not decoded with V1 names', () => {
  const buf = Buffer.concat([
    Buffer.from(FUSE_SENTINEL),
    Buffer.from([0x02, 0x02, 0x31, 0x30]),
  ]);
  const parsed = parseFuseWire(buf);
  assert.equal(parsed.wires[0].decoded, false);
  assert.equal(parsed.wires[0].fuses.length, 0);
  assert.deepEqual([...parsed.wires[0].raw], [0x31, 0x30]);
});

test('missing fuse sentinel is an explicit miss', () => {
  const parsed = parseFuseWire(Buffer.from('no sentinel here'));
  assert.equal(parsed.found, false);
  assert.deepEqual(parsed.wires, []);
});

test('reading fuses does not modify the file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ym-fuses-'));
  const file = path.join(dir, 'YandexMusic.exe');
  const body = Buffer.concat([
    Buffer.alloc(32, 1),
    Buffer.from(FUSE_SENTINEL),
    Buffer.from([0x01, 0x01, 0x30]),
    Buffer.alloc(16, 2),
  ]);
  fs.writeFileSync(file, body);
  const before = crypto.createHash('sha256').update(body).digest('hex');
  const parsed = readFuses(file);
  const after = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  assert.equal(after, before);
  assert.equal(parsed.found, true);
  assert.equal(parsed.wires[0].fuses[0].state, 'disable');
});

test('asar header yields only the root package version and name', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ym-asar-'));
  const file = path.join(dir, 'app.asar');
  writeFixtureAsar(file, {
    name: 'desktop-music',
    version: '5.121.2',
    token: 'should-not-surface',
  });
  const before = fs.readFileSync(file);
  const meta = readRootPackage(file);
  assert.deepEqual(meta, { name: 'desktop-music', version: '5.121.2' });
  assert.deepEqual(fs.readFileSync(file), before);
  assert.equal(JSON.stringify(meta).includes('should-not-surface'), false);
});

test('client discovery prefers a registry music install and ignores the browser', () => {
  assert.equal(isMusicDisplayName('Яндекс Музыка'), true);
  assert.equal(isMusicDisplayName('Yandex Music'), true);
  assert.equal(isMusicDisplayName('Yandex.Music'), true);
  assert.equal(isMusicDisplayName('Yandex Browser'), false);
  assert.equal(
    exeFromDisplayIcon('"C:\\Users\\a\\AppData\\Local\\Programs\\YandexMusic\\YandexMusic.exe",0'),
    'C:\\Users\\a\\AppData\\Local\\Programs\\YandexMusic\\YandexMusic.exe',
  );
  const dirs = knownInstallDirs({
    LOCALAPPDATA: 'C:\\Users\\a\\AppData\\Local',
    ProgramFiles: 'C:\\Program Files',
  });
  assert.ok(dirs.some((dir) => dir.endsWith('\\Programs\\YandexMusic')));
  assert.ok(dirs.some((dir) => dir.endsWith('\\Programs\\Yandex.Music')));
  assert.deepEqual(
    installFolders('C:\\YM', ['locales', 'app-5.1.0', 'app-5.121.2', 'app-cache']),
    ['C:\\YM', 'C:\\YM\\app-5.121.2', 'C:\\YM\\app-5.1.0'],
  );
  const chosen = chooseClient([
    {
      exe: 'C:\\Program Files\\Yandex\\YandexBrowser\\Application\\browser.exe',
      asar: null,
      source: 'known-path',
      displayName: 'Yandex Browser',
    },
    {
      exe: 'C:\\Users\\a\\AppData\\Local\\Programs\\YandexMusic\\YandexMusic.exe',
      asar: 'C:\\Users\\a\\AppData\\Local\\Programs\\YandexMusic\\resources\\app.asar',
      source: 'registry',
      displayName: 'Яндекс Музыка',
    },
  ]);
  assert.equal(chosen.ambiguous, false);
  assert.equal(chosen.client.displayName, 'Яндекс Музыка');
});

test('two registry installs are not silently collapsed into one', () => {
  const chosen = chooseClient([
    {
      exe: 'C:\\A\\YandexMusic.exe',
      asar: 'C:\\A\\resources\\app.asar',
      source: 'registry',
      displayName: 'Яндекс Музыка',
    },
    {
      exe: 'C:\\B\\YandexMusic.exe',
      asar: 'C:\\B\\resources\\app.asar',
      source: 'registry',
      displayName: 'Yandex Music',
    },
  ]);
  assert.equal(chosen.ambiguous, true);
  assert.equal(chosen.client, null);
});

test('launch is refused off Windows, without a client, and while the client is already open', () => {
  assert.deepEqual(
    decideRun({ platform: 'linux', client: { exe: 'x' }, alreadyRunning: false }),
    { launch: false, code: 'not-windows' },
  );
  assert.deepEqual(
    decideRun({ platform: 'win32', client: null, alreadyRunning: false }),
    { launch: false, code: 'client-not-found' },
  );
  assert.deepEqual(
    decideRun({ platform: 'win32', client: { exe: 'x' }, alreadyRunning: true }),
    { launch: false, code: 'already-running' },
  );
  assert.equal(
    decideRun({ platform: 'win32', client: { exe: 'x' }, alreadyRunning: false }).launch,
    true,
  );
});

test('debug arguments bind a random port to loopback only', () => {
  const args = buildLaunchArgs(43123);
  assert.deepEqual(args, [
    '--remote-debugging-port=43123',
    '--remote-debugging-address=127.0.0.1',
    '--remote-allow-origins=http://127.0.0.1:43123',
  ]);
  assert.equal(args.some((arg) => arg.includes('0.0.0.0') || arg.includes('inspect')), false);
});

test('netstat accepts a loopback listener and rejects a public one', () => {
  const text = [
    '  TCP    127.0.0.1:43123        0.0.0.0:0              LISTENING       4000',
    '  TCP    0.0.0.0:80             0.0.0.0:0              LISTENING       4',
    '  TCP    [::1]:43123            [::]:0                 LISTENING       4000',
  ].join('\n');
  assert.equal(bindIsLoopback(parseNetstat(text), 43123, 4000), true);
  const exposed = `${text}\n  TCP    0.0.0.0:43123          0.0.0.0:0              LISTENING       4000`;
  assert.equal(bindIsLoopback(parseNetstat(exposed), 43123, 4000), false);
});

test('a missing debug port is not described as a public listener', () => {
  assert.deepEqual(classifyListeners([], new Set([4])), { state: 'absent' });
  assert.equal(
    classifyListeners([{ address: '127.0.0.1', port: 1, pid: 4 }], new Set([4])).state,
    'loopback',
  );
  assert.equal(
    classifyListeners([{ address: '0.0.0.0', port: 1, pid: 4 }], new Set([4])).state,
    'exposed',
  );
  assert.equal(
    classifyListeners([{ address: '127.0.0.1', port: 1, pid: 9 }], new Set([4])).state,
    'foreign',
  );
  assert.equal(
    classifyListeners(
      [{ address: '127.0.0.1', port: 1, pid: 9 }],
      new Set([4]),
      new Map([[9, 'C:\\YM\\YandexMusic.exe']]),
      'C:\\YM\\YandexMusic.exe',
    ).state,
    'loopback',
  );
  assert.equal(
    classifyListeners(
      [{ address: '127.0.0.1', port: 1, pid: 9 }],
      new Set([4]),
      new Map([[9, 'C:\\Windows\\System32\\svchost.exe']]),
      'C:\\YM\\YandexMusic.exe',
    ).state,
    'foreign',
  );
  assert.equal(
    classifyListeners(
      [{ address: '127.0.0.1', port: 1, pid: 9 }],
      new Set([4]),
      new Map(),
      'C:\\YM\\YandexMusic.exe',
    ).state,
    'unknown',
  );
  assert.ok(MUSIC_EXE_NAMES.includes('Яндекс Музыка.exe'));
});

test('a port that never opens is reported as unopened, not as a public bind', async () => {
  const result = await executeProbe(
    { platform: 'win32' },
    {
      findClient: async () => ({
        ambiguous: false,
        client: {
          exe: 'C:\\YM\\YandexMusic.exe',
          asar: 'C:\\YM\\resources\\app.asar',
          source: 'registry',
          displayName: 'Яндекс Музыка',
          running: false,
        },
      }),
      readFuses: async () => ({ found: false, wires: [] }),
      hashFile: async () => 'same',
      readVersions: async () => ({ asar: null, exe: null, updateFeed: null }),
      loadBaseline: async () => null,
      saveBaseline: async () => {},
      reservePort: async () => 43123,
      spawnDebugClient: async () => ({ pid: 77, port: 43123, close: async () => {} }),
      assertLoopback: async () => ({ ok: false, reason: 'timeout' }),
      inspectPage: async () => {
        throw new Error('should not inspect');
      },
    },
  );
  assert.equal(result.exitCode, 1);
  assert.match(result.markdown, /не открылся/);
  assert.match(result.markdown, /не внедр/);
  assert.equal(result.markdown.includes('только localhost'), false);
});

test('page target drops titles, query strings and non-loopback sockets', () => {
  const picked = pickPageTarget([
    {
      type: 'page',
      url: 'devtools://devtools/bundled/inspector.html',
      title: 'DevTools',
      webSocketDebuggerUrl: 'ws://127.0.0.1:9/devtools/page/DEV',
    },
    {
      type: 'page',
      url: 'https://music.example/home?token=secret',
      title: 'Account Name',
      webSocketDebuggerUrl: 'ws://127.0.0.1:9/devtools/page/APP',
    },
    {
      type: 'page',
      url: 'https://music.example/away',
      title: 'Other',
      webSocketDebuggerUrl: 'ws://10.0.0.8:9/devtools/page/NO',
    },
  ]);
  assert.equal(picked.webSocketDebuggerUrl, 'ws://127.0.0.1:9/devtools/page/APP');
  assert.equal(picked.pageCount, 1);
  const dumped = JSON.stringify(picked);
  assert.equal(dumped.includes('secret'), false);
  assert.equal(dumped.includes('Account Name'), false);
  assert.equal(dumped.includes('music.example/home'), false);
  const blank = pickPageTarget([
    {
      type: 'page',
      url: 'about:blank',
      webSocketDebuggerUrl: 'ws://127.0.0.1:9/devtools/page/BLANK',
    },
    {
      type: 'page',
      url: 'file:///app/index.html',
      webSocketDebuggerUrl: 'ws://127.0.0.1:9/devtools/page/APP',
    },
  ]);
  assert.equal(blank.webSocketDebuggerUrl, 'ws://127.0.0.1:9/devtools/page/APP');
  const errorPage = pickPageTarget([
    {
      type: 'page',
      url: 'chrome-error://chromewebdata/',
      webSocketDebuggerUrl: 'ws://127.0.0.1:9/devtools/page/ERR',
    },
    {
      type: 'page',
      url: 'file:///app/index.html',
      webSocketDebuggerUrl: 'ws://127.0.0.1:9/devtools/page/APP',
    },
  ]);
  assert.equal(errorPage.webSocketDebuggerUrl, 'ws://127.0.0.1:9/devtools/page/APP');
  assert.equal(errorPage.pageCount, 1);
});

test('page scripts change one button and the background and do not touch storage', () => {
  const button = element('button');
  button.attrs['data-test-id'] = 'PLAY';
  const body = element('body');
  const head = element('head');
  const doc = fakeDocument({ body, head, buttons: [button] });
  const before = readSurface(doc, computed);
  applySurface(doc, computed);
  const after = readSurface(doc, computed);
  assert.equal(before.background, 'rgb(0, 0, 0)');
  assert.equal(after.background, POC_BACKGROUND);
  assert.equal(after.buttonBackground, POC_BUTTON);
  assert.equal(after.buttonTestId, 'PLAY');
  assert.equal(after.stylePresent, true);
  assert.equal(sameColor(after.background, 'rgba(58, 24, 72, 1)'), true);
  const removed = removeSurface(doc);
  assert.equal(removed.removedStyle, true);
  assert.equal(readSurface(doc, computed).stylePresent, false);
  assert.equal(button.attrs['data-yms-poc'], undefined);

  const sources = [readSurface, applySurface, removeSurface, analyserProbe, menuProbe, pickButton]
    .map((fn) => pageExpression(fn))
    .join('\n');
  assert.equal(auditExpression(sources), null);
  const audio = analyserProbe({
    AudioContext: class AudioContext {},
    AnalyserNode: class AnalyserNode {},
  });
  assert.equal(audio.hasAnalyserNode, true);
  assert.equal(audio.spectrumRead, false);
});

test('page expression carries its colors and runs without module scope', () => {
  const source = pageExpression(applySurface);
  assert.equal(source.includes(`const POC_BACKGROUND = ${JSON.stringify(POC_BACKGROUND)}`), true);
  assert.equal(source.includes(`const POC_BUTTON = ${JSON.stringify(POC_BUTTON)}`), true);
  const button = element('button');
  const body = element('body');
  const doc = fakeDocument({ body, head: element('head'), buttons: [button] });
  const result = vm.runInNewContext(source, { document: doc, getComputedStyle: computed });
  assert.equal(result.background, POC_BACKGROUND);
  assert.equal(result.buttonBackground, POC_BUTTON);
  assert.equal(result.stylePresent, true);
});

test('the play control is styled by its test id, not by a marker attribute', () => {
  const plain = element('button');
  const play = element('button');
  play.attrs['data-test-id'] = 'PLAY_BUTTON';
  const body = element('body');
  const doc = fakeDocument({ body, head: element('head'), buttons: [plain, play] });
  applySurface(doc, computed);
  const after = readSurface(doc, computed);
  assert.equal(after.buttonTestId, 'PLAY_BUTTON');
  assert.equal(after.buttonBackground, POC_BUTTON);
  assert.equal(after.background, POC_BACKGROUND);
  assert.equal(plain.attrs['data-yms-poc'], undefined);
  assert.equal(play.attrs['data-yms-poc'], undefined);
  assert.equal(doc.styleText.includes('[data-test-id="PLAY_BUTTON"]'), true);
  removeSurface(doc);
  assert.equal(readSurface(doc, computed).stylePresent, false);
});

test('menu probe hides one node and puts the page back', () => {
  const item = element('a');
  item.style.display = 'block';
  const nav = element('nav');
  nav.children.push(item);
  const body = element('body');
  const doc = fakeDocument({ body, head: element('head'), navs: [nav] });
  const result = menuProbe(doc, computed);
  assert.equal(result.navCount, 1);
  assert.equal(result.hideApplied, true);
  assert.equal(result.hideReverted, true);
  assert.equal(result.settingsPageOpened, false);
  assert.equal(result.bodyInsertRemoved, true);
  assert.equal(item.style.display, 'block');
  assert.equal(doc.getElementById('ym-skins-poc-settings-probe'), null);
});

test('empty report marks every stage-1 item unchecked and does not claim a patch', () => {
  const text = buildReport({});
  for (const title of [
    'Способ внедрения',
    'Electron Fuses',
    'AnalyserNode',
    'Где версия',
    'Подпись macOS',
    'Меню и блок настроек',
  ]) {
    assert.equal(text.includes(title), true, title);
  }
  assert.equal(text.includes('не проверено'), true);
  assert.equal(/вариант А рабочий|патч выполнен|успешно внедр/i.test(text), false);
  assert.equal(text.includes('app.asar не изменялся'), false);
});

test('linux refusal report does not look like a successful client run', () => {
  const text = buildReport({
    platform: 'linux',
    decision: 'not-windows',
  });
  assert.match(text, /не запускался/);
  assert.match(text, /не проверено/);
  assert.equal(text.includes('вариант А рабочий'), false);
  assert.equal(text.includes('app.asar не изменялся'), false);
});

test('a finished windows run reports fuses, re-injection and an untouched archive', () => {
  const text = buildReport({
    platform: 'win32',
    decision: 'launch',
    client: {
      exe: 'C:\\Users\\a\\AppData\\Local\\Programs\\YandexMusic\\YandexMusic.exe',
      asar: 'C:\\Users\\a\\AppData\\Local\\Programs\\YandexMusic\\resources\\app.asar',
      source: 'registry',
      displayName: 'Яндекс Музыка',
    },
    versions: { asar: '5.121.2', exe: '5.121.2' },
    update: { status: 'no-baseline' },
    fuses: {
      found: true,
      wires: [
        {
          decoded: true,
          fuses: [
            { name: 'EnableEmbeddedAsarIntegrityValidation', state: 'enable', raw: 0x31 },
            { name: 'OnlyLoadAppFromAsar', state: 'disable', raw: 0x30 },
            { name: 'EnableNodeCliInspectArguments', state: 'disable', raw: 0x30 },
          ],
        },
      ],
    },
    launch: { port: 43123, loopback: true },
    surface: {
      originalBackground: 'rgb(10, 10, 10)',
      styledBackground: POC_BACKGROUND,
      originalButton: 'rgb(1, 1, 1)',
      styledButton: POC_BUTTON,
      buttonFound: true,
      heldInSession: true,
      absentAfterRestart: true,
      restoredAfterReinject: true,
    },
    analyser: {
      hasAudioContextCtor: true,
      hasAnalyserNode: true,
      liveContexts: 0,
      spectrumRead: false,
    },
    menu: {
      navCount: 2,
      hideTried: true,
      hideApplied: true,
      hideReverted: true,
      settingsPageOpened: false,
      bodyInsertRemoved: true,
    },
    asar: { before: 'abc', after: 'abc' },
  });
  assert.match(text, /127\.0\.0\.1/);
  assert.match(text, /EnableEmbeddedAsarIntegrityValidation/);
  assert.match(text, /повторн/i);
  assert.match(text, /app\.asar не изменялся|файл не переписывался/);
  assert.match(text, /спектр не снимался|не проверено/);
  assert.match(text, /страница настроек не открывалась/);
  assert.match(text, /Подпись macOS[\s\S]*не проверено/);
  assert.equal(text.includes('патч выполнен'), false);
});

test('snapshot comparison does not invent an update', () => {
  assert.equal(compareSnapshots(null, { version: '5.121.2', asarSha256: 'a' }).status, 'no-baseline');
  assert.equal(
    compareSnapshots(
      { version: '5.121.2', asarSha256: 'a' },
      { version: '5.121.2', asarSha256: 'a' },
    ).status,
    'unchanged',
  );
  const changed = compareSnapshots(
    { version: '5.120.0', asarSha256: 'a' },
    { version: '5.121.2', asarSha256: 'b' },
  );
  assert.equal(changed.status, 'changed');
  assert.equal(changed.versionChanged, true);
  assert.equal(changed.asarChanged, true);
});

test('websocket text frames round-trip', () => {
  const payload = JSON.stringify({ id: 1, method: 'Runtime.evaluate' });
  const frame = encodeTextFrame(payload);
  const { messages, pings, rest } = decodeFrames(frame);
  assert.deepEqual(messages, [payload]);
  assert.deepEqual(pings, []);
  assert.equal(rest.length, 0);
});

test('a split text frame is joined and a ping is answered with a masked pong', () => {
  const state = { fragments: [] };
  const head = Buffer.from([0x01, 5, ...Buffer.from('{"id"')]);
  const tail = Buffer.from([0x80, 3, ...Buffer.from(':1}')]);
  const first = decodeFrames(head, state);
  assert.deepEqual(first.messages, []);
  const second = decodeFrames(tail, state);
  assert.deepEqual(second.messages, ['{"id":1}']);
  const ping = Buffer.from([0x89, 1, 0x7a]);
  const decoded = decodeFrames(ping);
  assert.equal(decoded.pings[0].toString(), 'z');
  const pong = encodeControlFrame(0xA, decoded.pings[0]);
  assert.equal(pong[0], 0x8A);
  assert.equal(pong[1] & 0x80, 0x80);
  const back = decodeFrames(pong);
  assert.equal(back.messages.length, 0);
  assert.equal(back.pings.length, 0);
});

test('the client process is detached and a tasklist row identifies its pid', () => {
  const options = clientSpawnOptions('C:\\YM\\YandexMusic.exe');
  assert.equal(options.detached, true);
  assert.equal(options.stdio, 'ignore');
  assert.equal(options.cwd, 'C:\\YM');
  assert.equal(tasklistHasPid('"YandexMusic.exe","4321","Console","1","100 K"', 4321), true);
  assert.equal(
    tasklistHasPid('INFO: No tasks are running which match the specified criteria.', 4321),
    false,
  );
});

test('page discovery retries when the debug list is not ready yet', async () => {
  let clock = 0;
  let calls = 0;
  const picked = await waitForPageTarget({
    now: () => clock,
    sleep: async () => {
      clock += 500;
    },
    timeoutMs: 2000,
    fetchJson: async () => {
      calls += 1;
      if (calls === 1) throw new Error('connection reset');
      return [{
        type: 'page',
        url: 'file:///app/index.html',
        webSocketDebuggerUrl: 'ws://127.0.0.1:9/devtools/page/APP',
      }];
    },
  });
  assert.equal(calls, 2);
  assert.equal(picked.webSocketDebuggerUrl, 'ws://127.0.0.1:9/devtools/page/APP');
});

test('an unidentified listener is not described as a foreign process', () => {
  const text = buildReport({
    platform: 'win32',
    decision: 'launch',
    launch: { port: 43123, loopback: false, reason: 'unconfirmed' },
  });
  assert.match(text, /не сопоставлен/);
  assert.match(text, /не внедр/);
  assert.equal(text.includes('не из этого запуска'), false);
});

test('linux execution does not search, read or spawn the client', async () => {
  let called = false;
  const boom = () => {
    called = true;
    throw new Error('should not touch the client');
  };
  const result = await executeProbe(
    { platform: 'linux' },
    {
      findClient: boom,
      readFuses: boom,
      hashFile: boom,
      spawnDebugClient: boom,
      inspectPage: boom,
    },
  );
  assert.equal(called, false);
  assert.equal(result.exitCode, 2);
  assert.match(result.markdown, /не запускался/);
  assert.match(result.markdown, /не проверено/);
});

test('an already running client is not killed or relaunched', async () => {
  let spawned = false;
  const result = await executeProbe(
    { platform: 'win32' },
    {
      findClient: async () => ({
        ambiguous: false,
        client: {
          exe: 'C:\\YM\\YandexMusic.exe',
          asar: 'C:\\YM\\resources\\app.asar',
          source: 'registry',
          displayName: 'Яндекс Музыка',
          running: true,
        },
      }),
      readFuses: async () => ({
        found: true,
        wires: [
          {
            decoded: true,
            fuses: [{ name: 'OnlyLoadAppFromAsar', state: 'enable', raw: 0x31 }],
          },
        ],
      }),
      hashFile: async () => 'hash',
      readVersions: async () => ({ asar: '5.121.2', exe: null, updateFeed: null }),
      loadBaseline: async () => null,
      saveBaseline: async () => {},
      spawnDebugClient: async () => {
        spawned = true;
        throw new Error('spawned');
      },
    },
  );
  assert.equal(spawned, false);
  assert.equal(result.exitCode, 2);
  assert.match(result.markdown, /OnlyLoadAppFromAsar/);
  assert.match(result.markdown, /не проверено/);
});

test('a public debug port is closed and the page is not touched', async () => {
  let inspected = false;
  let closed = 0;
  const result = await executeProbe(
    { platform: 'win32' },
    {
      findClient: async () => ({
        ambiguous: false,
        client: {
          exe: 'C:\\YM\\YandexMusic.exe',
          asar: 'C:\\YM\\resources\\app.asar',
          source: 'registry',
          displayName: 'Яндекс Музыка',
          running: false,
        },
      }),
      readFuses: async () => ({ found: false, wires: [] }),
      hashFile: async () => 'same',
      readVersions: async () => ({ asar: null, exe: null, updateFeed: null }),
      loadBaseline: async () => null,
      saveBaseline: async () => {},
      reservePort: async () => 43123,
      spawnDebugClient: async () => ({
        pid: 77,
        port: 43123,
        close: async () => {
          closed += 1;
        },
      }),
      assertLoopback: async () => false,
      inspectPage: async () => {
        inspected = true;
        return {};
      },
    },
  );
  assert.equal(inspected, false);
  assert.equal(closed, 1);
  assert.equal(result.exitCode, 1);
  assert.match(result.markdown, /127\.0\.0\.1/);
  assert.match(result.markdown, /не внедр/);
});

test('restart reapplies the style and leaves the archive hash alone', async () => {
  const launches = [];
  let generation = 0;
  let styled = false;
  const saved = [];
  const result = await executeProbe(
    { platform: 'win32' },
    {
      findClient: async () => ({
        ambiguous: false,
        client: {
          exe: 'C:\\YM\\YandexMusic.exe',
          asar: 'C:\\YM\\resources\\app.asar',
          source: 'registry',
          displayName: 'Яндекс Музыка',
          running: false,
        },
      }),
      readFuses: async () => ({
        found: true,
        wires: [
          {
            decoded: true,
            fuses: [{ name: 'EnableEmbeddedAsarIntegrityValidation', state: 'disable', raw: 0x30 }],
          },
        ],
      }),
      hashFile: async () => 'stable-hash',
      readVersions: async () => ({
        asar: '5.121.2',
        exe: '5.121.2',
        updateFeed: { provider: 'generic', url: 'https://desktop.app.music.yandex.net/stable' },
      }),
      loadBaseline: async () => null,
      saveBaseline: async (snap) => {
        saved.push(snap);
      },
      reservePort: async () => 25000 + generation,
      spawnDebugClient: async (spec) => {
        generation += 1;
        styled = false;
        launches.push(spec);
        return {
          pid: 100 + generation,
          port: spec.port,
          close: async () => {},
        };
      },
      assertLoopback: async () => true,
      inspectPage: async ({ apply }) => {
        if (apply) styled = true;
        return {
          pageFound: true,
          background: styled ? POC_BACKGROUND : 'rgb(10, 10, 10)',
          buttonBackground: styled ? POC_BUTTON : 'rgb(1, 1, 1)',
          buttonFound: true,
          buttonTestId: 'PLAY',
          stylePresent: styled,
          heldInSession: true,
          analyser: {
            hasAudioContextCtor: true,
            hasAnalyserNode: true,
            liveContexts: null,
            spectrumRead: false,
          },
          menu: {
            navCount: 1,
            hideTried: true,
            hideApplied: true,
            hideReverted: true,
            settingsPageOpened: false,
            bodyInsertRemoved: true,
          },
        };
      },
    },
  );
  assert.equal(launches.length, 2);
  assert.equal(launches[0].args.includes('--remote-debugging-address=127.0.0.1'), true);
  assert.equal(result.exitCode, 0);
  assert.match(result.markdown, /повторн/i);
  assert.match(result.markdown, /файл не переписывался|app\.asar не изменялся/);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].version, '5.121.2');
  assert.equal(saved[0].asarSha256, 'stable-hash');
});

function element(tag) {
  return {
    tag,
    id: '',
    textContent: '',
    style: {},
    attrs: {},
    children: [],
    setAttribute(key, value) {
      this.attrs[key] = String(value);
    },
    getAttribute(key) {
      return Object.prototype.hasOwnProperty.call(this.attrs, key) ? this.attrs[key] : null;
    },
    removeAttribute(key) {
      delete this.attrs[key];
    },
    appendChild(child) {
      this.children.push(child);
    },
    remove() {
      this.removed = true;
    },
  };
}

function computed(el) {
  if (el.id === 'ym-skins-poc') return { backgroundColor: '', display: '' };
  if (el.tag === 'body' && el.owner && el.owner.styleText.includes(POC_BACKGROUND)) {
    return { backgroundColor: POC_BACKGROUND, display: 'block' };
  }
  const testId = el.attrs['data-test-id'];
  const styledByTestId = Boolean(
    testId
    && el.owner?.styleText.includes(`[data-test-id="${testId}"]`)
    && el.owner.styleText.includes(POC_BUTTON),
  );
  const styledByMarker = el.attrs['data-yms-poc'] === 'button' && el.owner?.styleText.includes(POC_BUTTON);
  if (styledByTestId || styledByMarker) {
    return { backgroundColor: POC_BUTTON, display: el.style.display || 'inline-block' };
  }
  if (el.style.display) return { backgroundColor: 'rgb(1, 1, 1)', display: el.style.display };
  if (el.tag === 'button') return { backgroundColor: 'rgb(1, 1, 1)', display: 'inline-block' };
  return { backgroundColor: 'rgb(0, 0, 0)', display: 'block' };
}

function fakeDocument({ body, head, buttons = [], navs = [] }) {
  const nodes = new Map();
  const doc = {
    body,
    head,
    styleText: '',
    createElement(tag) {
      const el = element(tag);
      el.owner = doc;
      return el;
    },
    getElementById(id) {
      return nodes.get(id) && nodes.get(id).removed ? null : nodes.get(id) || null;
    },
    querySelector(selector) {
      if (selector === 'button') return buttons[0] || null;
      const testId = selector.match(/^\[data-test-id="([A-Za-z0-9_.:-]{1,80})"\]$/);
      if (testId) return buttons.find((button) => button.attrs['data-test-id'] === testId[1]) || null;
      if (selector === '[data-yms-poc="button"]') {
        return buttons.find((button) => button.attrs['data-yms-poc'] === 'button') || null;
      }
      return null;
    },
    querySelectorAll(selector) {
      if (selector === 'nav, [role="navigation"], aside') return navs;
      if (selector === 'button') return buttons;
      if (selector === '[data-yms-poc]' || selector === '[data-yms-poc="button"]') {
        return buttons.filter((button) => button.attrs['data-yms-poc']);
      }
      return [];
    },
    note(el) {
      if (el.id) nodes.set(el.id, el);
    },
  };
  body.owner = doc;
  head.owner = doc;
  const originalAppend = head.appendChild.bind(head);
  head.appendChild = (child) => {
    originalAppend(child);
    if (child.tag === 'style') {
      Object.defineProperty(child, 'textContent', {
        set(value) {
          doc.styleText = String(value);
        },
        get() {
          return doc.styleText;
        },
      });
    }
    doc.note(child);
  };
  const originalBodyAppend = body.appendChild.bind(body);
  body.appendChild = (child) => {
    originalBodyAppend(child);
    doc.note(child);
  };
  for (const button of buttons) button.owner = doc;
  return doc;
}
