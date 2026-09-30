import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

import { findAudioGraphMarkers } from '../lib/audio-graph.mjs';
import { classifyLoopback } from '../lib/loopback.mjs';
import { selectorMapFor } from '../lib/selector-map.mjs';
import { readRootPackage, writeFixtureAsar } from '../lib/asar-meta.mjs';
import { waitForPageTarget } from '../lib/cdp.mjs';
import { executeProbe } from '../lib/execute.mjs';
import { chromeSandboxMode, clientSpawnOptions, linuxDebugExtras, tasklistHasPid } from '../lib/launch.mjs';
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
  linuxClientCandidate,
  linuxInstallDirs,
} from '../lib/find-client.mjs';
import {
  POC_BACKGROUND,
  POC_BUTTON,
  analyserProbe,
  applySurface,
  menuProbe,
  readAnalyserPeaks,
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
  parseProcNet,
  pickPageTarget,
  sameColor,
} from '../lib/plan.mjs';
import { buildReport } from '../lib/report.mjs';
import { attachStage1Decisions } from '../lib/stage1-decisions.mjs';
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

test('launch is refused off Windows and Linux, without a client, and while the client is already open', () => {
  assert.deepEqual(
    decideRun({ platform: 'darwin', client: { exe: 'x' }, alreadyRunning: false }),
    { launch: false, code: 'not-windows' },
  );
  assert.deepEqual(
    decideRun({ platform: 'linux', client: null, alreadyRunning: false }),
    { launch: false, code: 'client-not-found' },
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
  assert.equal(
    decideRun({ platform: 'linux', client: { exe: 'x' }, alreadyRunning: false }).launch,
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
  assert.equal(doc.styleText.includes('background-image: none'), true);
  assert.equal(sameColor(after.background, 'rgba(58, 24, 72, 1)'), true);
  const removed = removeSurface(doc);
  assert.equal(removed.removedStyle, true);
  assert.equal(readSurface(doc, computed).stylePresent, false);
  assert.equal(button.attrs['data-yms-poc'], undefined);

  const sources = [
    ...[readSurface, applySurface, removeSurface, analyserProbe, menuProbe, pickButton]
      .map((fn) => pageExpression(fn)),
    readAnalyserPeaks.toString(),
  ].join('\n');
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

test('menu probe hides one known nav item and puts the page back', () => {
  const item = element('a');
  item.style.display = 'block';
  item.attrs['data-test-id'] = 'NAVBAR_NAVIGATION_ITEM_KIDS';
  const nav = element('nav');
  nav.children.push(item);
  const body = element('body');
  const doc = fakeDocument({ body, head: element('head'), navs: [nav] });
  const result = menuProbe(doc, computed);
  assert.equal(result.navCount, 1);
  assert.equal(result.hideTried, true);
  assert.equal(result.hiddenTestId, 'NAVBAR_NAVIGATION_ITEM_KIDS');
  assert.equal(result.hideApplied, true);
  assert.equal(result.hideReverted, true);
  assert.equal(result.settingsPageOpened, false);
  assert.equal(result.bodyInsertRemoved, true);
  assert.equal(result.navbarFound, false);
  assert.equal(result.settingsListFound, false);
  assert.equal(result.playerBarFound, false);
  assert.equal(result.playerPlayFound, false);
  assert.equal(result.regionScreen, false);
  assert.equal(item.style.display, 'block');
  assert.equal(item.attrs['data-yms-poc-hide'], undefined);
  assert.equal(doc.getElementById('ym-skins-poc-settings-probe'), null);
});

test('menu probe puts appearance first in the settings list and takes it back', () => {
  const sibling = element('div');
  sibling.attrs['data-test-id'] = 'SETTINGS_SOUND';
  const list = element('div');
  list.attrs['data-test-id'] = 'SETTINGS_LIST';
  list.children.push(sibling);
  sibling.parent = list;
  const doc = fakeDocument({ body: element('body'), head: element('head'), extras: [list] });
  const result = menuProbe(doc, computed);
  assert.equal(result.settingsListFound, true);
  assert.equal(result.settingsPageOpened, true);
  assert.equal(result.appearanceInserted, true);
  assert.equal(result.appearanceFirst, true);
  assert.equal(result.appearanceRemoved, true);
  assert.equal(doc.getElementById('ym-skins-appearance'), null);
  assert.equal(list.firstChild, sibling);
  assert.equal(list.children.some((child) => child.id === 'ym-skins-appearance'), false);
});

test('menu probe expression hides a mapped item without module scope', () => {
  const source = pageExpression(menuProbe);
  assert.equal(auditExpression(source), null);
  const item = element('a');
  item.style.display = 'block';
  item.attrs['data-test-id'] = 'NAVBAR_NAVIGATION_ITEM_PLUS';
  const list = element('div');
  list.attrs['data-test-id'] = 'SETTINGS_LIST';
  const doc = fakeDocument({ body: element('body'), head: element('head'), extras: [list, item] });
  const result = vm.runInNewContext(source, { document: doc, getComputedStyle: computed });
  assert.equal(result.hideTried, true);
  assert.equal(result.hiddenTestId, 'NAVBAR_NAVIGATION_ITEM_PLUS');
  assert.equal(result.hideApplied, true);
  assert.equal(result.hideReverted, true);
  assert.equal(result.appearanceInserted, true);
  assert.equal(result.appearanceRemoved, true);
  assert.equal(item.style.display, 'block');
  assert.equal(item.attrs['data-yms-poc-hide'], undefined);
  assert.equal(doc.getElementById('ym-skins-appearance'), null);
  const ids = selectorMapFor('5.121.2').elements['nav.hidden'];
  for (const id of ids) assert.equal(source.includes(`'${id}'`), true);
  assert.equal(source.includes('data-yms-stamp'), true);
  assert.equal(source.includes('ym-skins-runtime'), true);
  assert.equal(result.stampCleared, result.stampApplied);
  assert.equal(result.skinStamped > 0, true);
  assert.equal(result.skinStyleApplied, true);
  assert.equal(result.skinStyleRemoved, true);
  assert.equal(result.skinStampsCleared, true);
  assert.equal(item.attrs['data-yms'], undefined);
  assert.equal(list.attrs['data-yms'], undefined);
  assert.equal(doc.getElementById('ym-skins-runtime'), null);
});

test('menu probe does not hide an unnamed nav child', () => {
  const item = element('a');
  item.style.display = 'block';
  const nav = element('nav');
  nav.children.push(item);
  const doc = fakeDocument({ body: element('body'), head: element('head'), navs: [nav] });
  const result = menuProbe(doc, computed);
  assert.equal(result.hideTried, false);
  assert.equal(item.style.display, 'block');
});

test('region screen is recorded and a navbar test id is visible to the probe', () => {
  const body = element('body');
  body.innerText = 'Yandex Music is currently not available in your region';
  const navbar = element('div');
  navbar.attrs['data-test-id'] = 'NAVBAR';
  const doc = fakeDocument({ body, head: element('head'), extras: [navbar] });
  const result = menuProbe(doc, computed);
  assert.equal(result.regionScreen, true);
  assert.equal(result.navbarFound, true);
  assert.equal(result.playerBarFound, false);
  assert.equal(result.playerPlayFound, false);
  assert.equal(result.settingsListFound, false);
  assert.equal(result.settingsPageOpened, false);
  assert.equal(result.hideTried, false);
});

test('a page with the player, navbar and settings list passes smoke', () => {
  const bar = element('div');
  bar.attrs['data-test-id'] = 'PLAYERBAR_DESKTOP';
  const play = element('button');
  play.attrs['data-test-id'] = 'PLAY_BUTTON';
  const nav = element('div');
  nav.attrs['data-test-id'] = 'NAVBAR';
  const list = element('div');
  list.attrs['data-test-id'] = 'SETTINGS_LIST';
  const doc = fakeDocument({
    body: element('body'),
    head: element('head'),
    buttons: [play],
    extras: [bar, nav, list],
  });
  const menu = menuProbe(doc, computed, selectorMapFor('5.121.2'));
  assert.equal(menu.playerBarFound, true);
  assert.equal(menu.playerPlayFound, true);
  assert.equal(menu.navbarFound, true);
  assert.equal(menu.settingsListFound, true);
  assert.equal(menu.stampApplied, 4);
  assert.equal(menu.stampCleared, 4);
  assert.equal(bar.attrs['data-yms'], undefined);
  assert.equal(play.attrs['data-yms-stamp'], undefined);
  assert.equal(doc.getElementById('ym-skins-appearance'), null);
  const facts = attachStage1Decisions({
    selectorMap: selectorMapFor('5.121.2'),
    menu,
    analyser: { analyserCount: 1, spectrumPeak: 0, bins: [0, 0, 4] },
    loopback: { status: 'no-device' },
  });
  assert.equal(facts.smoke.status, 'compatible');
  assert.equal(facts.audioChoice.source, 'analyser');
  const text = buildReport({ menu, selectorMap: selectorMapFor('5.121.2'), ...facts });
  assert.match(text, /PLAYERBAR_DESKTOP на странице есть/);
  assert.match(text, /PLAY_BUTTON на странице есть/);
  assert.match(text, /полный режим допустим/);
});

test('analyser peaks come from existing nodes only', () => {
  const loud = [{
    frequencyBinCount: 4,
    fftSize: 32,
    context: { state: 'running' },
    getByteFrequencyData(bins) {
      bins.set([0, 12, 3, 0]);
    },
  }];
  assert.deepEqual(readAnalyserPeaks.call(loud), {
    count: 1,
    peak: 12,
    running: 1,
    fftSize: 32,
    bins: [0, 12, 3, 0],
  });
  const quiet = [{
    frequencyBinCount: 2,
    fftSize: 32,
    context: { state: 'suspended' },
    getByteFrequencyData(bins) {
      bins.fill(0);
    },
  }];
  assert.deepEqual(readAnalyserPeaks.call(quiet), {
    count: 1,
    peak: 0,
    running: 0,
    fftSize: 32,
    bins: [0, 0],
  });
  assert.deepEqual(readAnalyserPeaks.call([]), { count: 0, peak: 0, running: 0, fftSize: null, bins: [] });
  const wide = new Array(40).fill(0);
  wide[39] = 9;
  const far = [{
    frequencyBinCount: 40,
    fftSize: 64,
    context: { state: 'running' },
    getByteFrequencyData(bins) {
      bins.set(wide);
    },
  }];
  const farPeaks = readAnalyserPeaks.call(far);
  assert.equal(farPeaks.peak, 9);
  assert.equal(farPeaks.bins.length, 32);
  assert.equal(Math.max(...farPeaks.bins), 9);
});

test('selector map is only the 5.121.2 ids read from that client', () => {
  const map = selectorMapFor('5.121.2');
  assert.equal(map.elements.sidebar, 'NAVBAR');
  assert.equal(map.elements['nav.wave'], 'NAVBAR_NAVIGATION_ITEM_HOME');
  assert.equal(map.elements['nav.search'], 'NAVBAR_NAVIGATION_ITEM_SEARCH');
  assert.equal(map.elements['player.cover'], 'PLAYERBAR_DESKTOP_COVER_CONTAINER');
  assert.equal(map.elements['player.pause'], 'PAUSE_BUTTON');
  assert.equal(map.elements['settings.page'], 'SETTINGS_PAGE');
  assert.equal(map.elements['settings.list'], 'SETTINGS_LIST');
  assert.equal(map.elements['settings.equalizer'], 'SETTINGS_EQUALIZER_BUTTON');
  assert.equal(map.elements['nav.hidden'].includes('NAVBAR_NAVIGATION_ITEM_KIDS'), true);
  assert.equal(map.settingsPath, '/settings');
  assert.equal(selectorMapFor('5.0.0'), null);
  assert.equal(selectorMapFor(null), null);
});

test('linux loopback is unchecked only when a sound device exists', () => {
  assert.equal(classifyLoopback({ platform: 'linux', hasSoundDevice: false, hasPulseServer: false }), 'no-device');
  assert.equal(classifyLoopback({ platform: 'linux', hasSoundDevice: true, hasPulseServer: false }), 'present-untested');
  assert.equal(classifyLoopback({ platform: 'win32', hasSoundDevice: false, hasPulseServer: false }), 'not-checked');
});

test('audio graph markers are read from the archive without copying it', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ym-audio-'));
  const file = path.join(dir, 'app.asar');
  const gap = 'x'.repeat(80);
  fs.writeFileSync(file, `createMediaElementSource${gap}createAnalyser${gap}getByteFrequencyData`);
  assert.deepEqual(findAudioGraphMarkers(file), {
    mediaElement: true,
    analyser: true,
    frequency: true,
    complete: true,
  });
  fs.writeFileSync(file, 'createMediaElementSource only');
  const partial = findAudioGraphMarkers(file);
  assert.equal(partial.complete, false);
  assert.equal(partial.analyser, false);
  fs.rmSync(dir, { recursive: true });
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

test('darwin refusal report does not look like a successful client run', () => {
  const text = buildReport({
    platform: 'darwin',
    decision: 'not-windows',
  });
  assert.match(text, /не запускался/);
  assert.match(text, /не проверено/);
  assert.equal(text.includes('вариант А рабочий'), false);
  assert.equal(text.includes('app.asar не изменялся'), false);
});

test('a finished linux run is not described as a Windows check', () => {
  const text = buildReport({
    platform: 'linux',
    decision: 'launch',
    client: {
      exe: '/opt/Яндекс Музыка/yandexmusic',
      source: 'known-path',
      displayName: 'Яндекс Музыка',
    },
    launch: { port: 43123, loopback: true, gtk3: true, noSandbox: true },
    surface: {
      originalBackground: 'rgb(245, 245, 245)',
      styledBackground: POC_BACKGROUND,
      originalButton: 'rgb(1, 1, 1)',
      styledButton: POC_BUTTON,
      buttonFound: true,
      absentAfterRestart: true,
      restoredAfterReinject: true,
    },
    asar: { before: 'abc', after: 'abc' },
  });
  assert.match(text, /не проверка Windows 11/);
  assert.match(text, /Linux-клиент/);
  assert.match(text, /--no-sandbox/);
  assert.match(text, /--gtk-version=3/);
  assert.match(text, /выбран вариант А/);
  assert.match(text, /Windows-сборка этим прогоном не проверялась/);
  assert.equal(text.includes('Платформа прогона: win32'), false);
  assert.equal(text.includes('вариант А рабочий'), false);
});

test('report names the bundled audio graph and the region screen', () => {
  const text = buildReport({
    platform: 'linux',
    decision: 'launch',
    client: { exe: '/opt/yandexmusic/yandexmusic', source: 'known-path', displayName: 'Яндекс Музыка' },
    launch: { port: 9, loopback: true },
    surface: {
      originalBackground: 'rgb(1, 1, 1)',
      styledBackground: POC_BACKGROUND,
      originalButton: 'rgb(2, 2, 2)',
      styledButton: POC_BUTTON,
      buttonFound: true,
      absentAfterRestart: true,
      restoredAfterReinject: true,
    },
    analyser: {
      hasAudioContextCtor: true,
      hasAnalyserNode: true,
      liveContexts: 0,
      analyserCount: 0,
      spectrumPeak: 0,
      spectrumRead: false,
    },
    audioGraph: { mediaElement: true, analyser: true, frequency: true, complete: true },
    menu: {
      navCount: 0,
      hideTried: false,
      navbarFound: false,
      settingsListFound: false,
      settingsPageOpened: false,
      regionScreen: true,
      bodyInsertRemoved: true,
    },
    asar: { before: 'abc', after: 'abc' },
  });
  assert.match(text, /createMediaElementSource/);
  assert.match(text, /Готовых AnalyserNode в странице нет/);
  assert.match(text, /недоступен в этом регионе/);
  assert.match(text, /NAVBAR на странице не найдена/);
  assert.match(text, /SETTINGS_LIST не найден/);
  assert.match(text, /Системный loopback не проверялся/);
  assert.equal(text.includes('патч выполнен'), false);
});

test('report describes a silent running analyser and a missing loopback device', () => {
  const text = buildReport({
    platform: 'linux',
    decision: 'launch',
    versions: { asar: '5.121.2' },
    client: { exe: '/opt/yandexmusic/yandexmusic', source: 'known-path', displayName: 'Яндекс Музыка' },
    launch: { port: 9, loopback: true },
    surface: {
      originalBackground: 'rgb(1, 1, 1)',
      styledBackground: POC_BACKGROUND,
      originalButton: 'rgb(2, 2, 2)',
      styledButton: POC_BUTTON,
      buttonFound: true,
      absentAfterRestart: true,
      restoredAfterReinject: true,
    },
    analyser: {
      hasAudioContextCtor: true,
      hasAnalyserNode: true,
      liveContexts: 3,
      analyserCount: 3,
      spectrumPeak: 0,
      contextRunning: 3,
      fftSize: 32,
      spectrumRead: false,
    },
    loopback: { status: 'no-device' },
    selectorMap: selectorMapFor('5.121.2'),
    menu: {
      navCount: 0,
      hideTried: false,
      navbarFound: false,
      settingsListFound: false,
      settingsPageOpened: false,
      regionScreen: true,
      pageCount: 1,
      bodyInsertRemoved: true,
    },
  });
  assert.match(text, /контекст running: 3/);
  assert.match(text, /fftSize 32/);
  assert.match(text, /устройство вывода не найдено/);
  assert.match(text, /Карта селекторов 5\.121\.2/);
  assert.match(text, /Отладчик отдал одну страницу/);
  assert.equal(text.includes('Системный loopback не проверялся'), false);
});

test('report records a reversible appearance block and archive id scan', () => {
  const text = buildReport({
    platform: 'linux',
    decision: 'launch',
    versions: { asar: '5.121.2' },
    selectorMap: selectorMapFor('5.121.2'),
    selectorScan: { found: ['NAVBAR', 'SETTINGS_LIST'], missing: ['NAVBAR_NAVIGATION_ITEM_KIDS'] },
    menu: {
      navCount: 1,
      hideTried: true,
      hideApplied: true,
      hideReverted: true,
      hiddenTestId: 'NAVBAR_NAVIGATION_ITEM_KIDS',
      navbarFound: true,
      settingsListFound: true,
      settingsPageOpened: true,
      appearanceInserted: true,
      appearanceFirst: true,
      appearanceRemoved: true,
      regionScreen: false,
      bodyInsertRemoved: true,
    },
  });
  assert.match(text, /блок «Оформление» первым в SETTINGS_LIST/);
  assert.match(text, /NAVBAR_NAVIGATION_ITEM_KIDS/);
  assert.match(text, /Найдены: 2/);
  assert.equal(text.includes('не встраивался'), false);
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
  assert.match(text, /выбран вариант А/);
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
  assert.equal(options.env, undefined);
  const linux = clientSpawnOptions('/opt/Яндекс Музыка/yandexmusic');
  assert.equal(linux.cwd, '/opt/Яндекс Музыка');
  assert.equal(linux.detached, true);
  if (process.platform === 'linux') {
    assert.match(linux.env.HOME, /ym-skins-probe-home$/);
    assert.notEqual(linux.env.HOME, process.env.HOME);
  }
  assert.equal(tasklistHasPid('"YandexMusic.exe","4321","Console","1","100 K"', 4321), true);
  assert.equal(
    tasklistHasPid('INFO: No tasks are running which match the specified criteria.', 4321),
    false,
  );
});

test('proc net listeners decode loopback and a public bind', () => {
  const text = [
    '  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode',
    '   0: 0100007F:9935 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 12345 1 0000000000000000 100 0 0 10 0',
    '   1: 00000000:0050 00000000:0000 0A 00000000:00000000 00:00000000 00000000     0        0 999 1 0000000000000000 100 0 0 10 0',
    '   2: 00000000000000000000000001000000:1F90 00000000000000000000000000000000:0000 0A 00000000:00000000 00:00000000 00000000 0 0 42 1 0000000000000000 100 0 0 10 0',
  ].join('\n');
  const rows = parseProcNet(text);
  assert.deepEqual(rows, [
    { address: '127.0.0.1', port: 39221, inode: 12345 },
    { address: '0.0.0.0', port: 80, inode: 999 },
    { address: '::1', port: 8080, inode: 42 },
  ]);
  assert.equal(
    classifyListeners([{ address: '0.0.0.0', port: 80, pid: 4 }], new Set([4])).state,
    'exposed',
  );
});

test('a linux install is the music binary next to app.asar', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ym-linux-client-'));
  assert.equal(linuxClientCandidate(root), null);
  fs.mkdirSync(path.join(root, 'resources'));
  fs.writeFileSync(path.join(root, 'yandexmusic'), '');
  fs.writeFileSync(path.join(root, 'resources', 'app.asar'), '');
  const candidate = linuxClientCandidate(root);
  assert.equal(candidate.displayName, 'Яндекс Музыка');
  assert.equal(candidate.exe, path.join(root, 'yandexmusic'));
  assert.equal(candidate.asar, path.join(root, 'resources', 'app.asar'));
  const dirs = linuxInstallDirs({ HOME: '/home/a' });
  assert.ok(dirs.includes('/opt/Яндекс Музыка'));
  assert.ok(dirs.includes('/home/a/.local/opt/Яндекс Музыка'));
});

test('linux debug flags stay on loopback and skip no-sandbox when the helper is setuid', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ym-sandbox-'));
  const exe = path.join(dir, 'yandexmusic');
  fs.writeFileSync(exe, '');
  fs.writeFileSync(path.join(dir, 'chrome-sandbox'), '');
  fs.chmodSync(path.join(dir, 'chrome-sandbox'), 0o755);
  assert.equal(chromeSandboxMode(exe), 'no-setuid');
  fs.chmodSync(path.join(dir, 'chrome-sandbox'), 0o4755);
  assert.equal(chromeSandboxMode(exe), 'setuid');
  const plain = linuxDebugExtras(exe, { sandboxMode: () => 'setuid', userDataDir: '/tmp/ym-profile' });
  assert.deepEqual(plain, [
    '--gtk-version=3',
    '--user-data-dir=/tmp/ym-profile',
  ]);
  const open = linuxDebugExtras(exe, { sandboxMode: () => 'no-setuid', userDataDir: '/tmp/ym-profile' });
  assert.equal(open.includes('--no-sandbox'), true);
  assert.equal(open.some((arg) => arg.includes('0.0.0.0')), false);
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

test('darwin execution does not search, read or spawn the client', async () => {
  let called = false;
  const boom = () => {
    called = true;
    throw new Error('should not touch the client');
  };
  const result = await executeProbe(
    { platform: 'darwin' },
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

test('linux execution stops before spawn when no client is installed', async () => {
  let spawned = false;
  const result = await executeProbe(
    { platform: 'linux' },
    {
      findClient: async () => ({ ambiguous: false, client: null }),
      spawnDebugClient: async () => {
        spawned = true;
      },
      inspectPage: async () => {
        spawned = true;
      },
    },
  );
  assert.equal(spawned, false);
  assert.equal(result.exitCode, 2);
  assert.match(result.markdown, /не найден/);
  assert.match(result.markdown, /не проверка Windows 11/);
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

test('linux launch keeps the debug port on loopback and records container flags', async () => {
  const launches = [];
  const base = {
    findClient: async () => ({
      ambiguous: false,
      client: {
        exe: '/opt/Яндекс Музыка/yandexmusic',
        asar: '/opt/Яндекс Музыка/resources/app.asar',
        source: 'known-path',
        displayName: 'Яндекс Музыка',
        running: false,
      },
    }),
    readFuses: async () => ({ found: false, wires: [] }),
    hashFile: async () => 'same',
    readVersions: async () => ({ asar: '5.121.2', exe: null, updateFeed: null }),
    loadBaseline: async () => null,
    reservePort: async () => 43123,
    userDataDir: '/tmp/ym-skins-probe-profile',
    spawnDebugClient: async (spec) => {
      launches.push(spec);
      return {
        pid: 5,
        port: spec.port,
        close: async () => {},
      };
    },
    assertLoopback: async () => ({ ok: false, reason: 'timeout' }),
    inspectPage: async () => {
      throw new Error('page should stay untouched');
    },
  };
  const open = await executeProbe(
    { platform: 'linux' },
    { ...base, sandboxMode: () => 'no-setuid' },
  );
  assert.equal(open.exitCode, 1);
  assert.equal(launches.length, 1);
  assert.equal(launches[0].args.includes('--remote-debugging-address=127.0.0.1'), true);
  assert.equal(launches[0].args.includes('--gtk-version=3'), true);
  assert.equal(launches[0].args.includes('--no-sandbox'), true);
  assert.equal(launches[0].args.includes('--user-data-dir=/tmp/ym-skins-probe-profile'), true);
  assert.equal(launches[0].args.some((arg) => arg.includes('0.0.0.0')), false);
  assert.match(open.markdown, /отладочный порт не открылся/);
  const sealed = await executeProbe(
    { platform: 'linux' },
    { ...base, sandboxMode: () => 'setuid' },
  );
  assert.equal(sealed.exitCode, 1);
  assert.equal(launches[1].args.includes('--no-sandbox'), false);
  assert.equal(launches[1].args.includes('--gtk-version=3'), true);
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
    get firstChild() {
      return this.children[0] || null;
    },
    appendChild(child) {
      this.children.push(child);
      child.parent = this;
      if (this.owner?.note) this.owner.note(child);
    },
    insertBefore(child, before) {
      const index = before ? this.children.indexOf(before) : -1;
      if (index < 0) this.children.push(child);
      else this.children.splice(index, 0, child);
      child.parent = this;
      if (this.owner?.note) this.owner.note(child);
    },
    remove() {
      this.removed = true;
      const index = this.parent?.children?.indexOf(this) ?? -1;
      if (index >= 0) this.parent.children.splice(index, 1);
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

function fakeDocument({ body, head, buttons = [], navs = [], extras = [] }) {
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
      if (testId) {
        const navChildren = navs.flatMap((nav) => [nav, ...(nav.children || [])]);
        return [...buttons, ...extras, ...navChildren].find((node) => node.attrs['data-test-id'] === testId[1]) || null;
      }
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
      if (selector === '[data-yms-stamp="1"]') {
        const navChildren = navs.flatMap((nav) => [nav, ...(nav.children || [])]);
        return [...buttons, ...extras, ...navChildren].filter((node) => node.attrs['data-yms-stamp'] === '1');
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
  for (const extra of extras) extra.owner = doc;
  for (const nav of navs) {
    nav.owner = doc;
    for (const child of nav.children || []) child.owner = doc;
  }
  return doc;
}
