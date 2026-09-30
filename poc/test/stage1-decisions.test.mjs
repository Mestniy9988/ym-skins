import assert from 'node:assert/strict';
import test from 'node:test';

import { buildReport } from '../lib/report.mjs';
import { selectorMapFor } from '../lib/selector-map.mjs';
import { attachStage1Decisions } from '../lib/stage1-decisions.mjs';

test('region page with a map stays in safe mode and does not claim a live spectrum', () => {
  const facts = attachStage1Decisions({
    versions: { asar: '5.121.2' },
    selectorMap: selectorMapFor('5.121.2'),
    update: { status: 'no-baseline' },
    menu: { navbarFound: false, settingsListFound: false },
    analyser: { analyserCount: 3, spectrumPeak: 0, bins: [0, 0, 0] },
    loopback: { status: 'no-device' },
  });
  assert.equal(facts.smoke.status, 'safe-mode');
  assert.deepEqual(facts.smoke.missing, ['player.bar', 'player.play', 'sidebar', 'settings.list']);
  assert.equal(facts.updateDecision.action, 'apply-current-map');
  assert.equal(facts.audioChoice.source, 'decorative');
  assert.equal(facts.spectrum.state, 'silent');
  assert.deepEqual(facts.injection, { allowed: true, reason: 'clear' });
  assert.equal(facts.compatStatus.code, 'safe');
  assert.equal(facts.skinGate.reason, 'safe-mode');
  assert.equal(facts.skinGate.apply, false);
  const text = buildReport(facts);
  assert.match(text, /безопасный режим/);
  assert.match(text, /Полный скин не применяется: безопасный режим/);
  assert.match(text, /декоративная анимация/);
  assert.match(text, /карта этой версии/);
  assert.match(text, /не блокирует/);
  assert.match(text, /Подпись macOS и Gatekeeper: не проверено/);
});

test('kill switch blocks the read version and a live analyser wins over loopback', () => {
  const facts = attachStage1Decisions({
    versions: { asar: '5.121.2' },
    catalogFlags: { killSwitch: ['5.121.2'] },
    selectorMap: selectorMapFor('5.121.2'),
    update: { status: 'unchanged' },
    menu: {
      navbarFound: true,
      settingsListFound: true,
      playerBarFound: true,
      playerPlayFound: true,
    },
    analyser: { analyserCount: 1, spectrumPeak: 40, bins: [0, 40] },
    loopback: { status: 'live' },
    macCodesign: 'Authority=Developer ID Application: Example',
    macSpctl: 'source=Notarized Developer ID\naccepted',
  });
  assert.equal(facts.smoke.status, 'compatible');
  assert.equal(facts.updateDecision.action, 'keep');
  assert.equal(facts.audioChoice.source, 'analyser');
  assert.equal(facts.injection.allowed, false);
  assert.equal(facts.compatStatus.code, 'blocked');
  assert.equal(facts.skinGate.reason, 'blocked');
  const text = buildReport(facts);
  assert.match(text, /полный режим допустим/);
  assert.match(text, /снимок не изменился/);
  assert.match(text, /с живым спектром/);
  assert.match(text, /запрещает внедрение/);
  assert.match(text, /Полный скин не применяется: внедрение выключено/);
  assert.match(text, /разбор текста codesign/);
  assert.equal(text.includes('Этот прототип их не проверяет.'), false);
});

test('changed version without a map waits instead of reusing a failed previous smoke', () => {
  const facts = attachStage1Decisions({
    versions: { asar: '5.999.0' },
    update: { status: 'changed' },
    previousSmoke: 'fail',
    menu: { navbarFound: false },
  });
  assert.equal(facts.smoke.status, 'no-map');
  assert.equal(facts.updateDecision.action, 'awaiting-map');
  assert.equal(facts.compatStatus.code, 'waiting');
});

test('a passing previous smoke is the fallback when the current map is missing', () => {
  const facts = attachStage1Decisions({
    update: { status: 'changed' },
    previousSmoke: 'pass',
  });
  assert.equal(facts.smoke, undefined);
  assert.equal(facts.updateDecision.action, 'apply-previous-map');
});
