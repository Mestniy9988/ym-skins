import assert from 'node:assert/strict';
import test from 'node:test';

import { compatibilityStatus } from '../lib/compat-status.mjs';
import { buildReport } from '../lib/report.mjs';

test('kill switch outranks a compatible smoke result', () => {
  assert.deepEqual(
    compatibilityStatus({
      smoke: { status: 'compatible' },
      updateDecision: { action: 'keep' },
      injection: { allowed: false, reason: 'kill-switch' },
    }),
    { code: 'blocked', label: 'Внедрение выключено' },
  );
});

test('a missing map waits, and a failed smoke stays in safe mode', () => {
  assert.equal(
    compatibilityStatus({
      smoke: { status: 'no-map' },
      updateDecision: { action: 'awaiting-map' },
    }).code,
    'waiting',
  );
  assert.deepEqual(
    compatibilityStatus({
      smoke: { status: 'safe-mode', missing: ['player.bar'] },
      updateDecision: { action: 'apply-current-map' },
      injection: { allowed: true, reason: 'clear' },
    }),
    { code: 'safe', label: 'Безопасный режим' },
  );
  assert.equal(compatibilityStatus({ smoke: { status: 'compatible' } }).label, 'Совместимо');
  assert.equal(compatibilityStatus({}).code, 'unknown');
});

test('the report names the compatibility status when it is known', () => {
  const text = buildReport({
    compatStatus: { code: 'safe', label: 'Безопасный режим' },
    menu: { navbarFound: false, settingsListFound: false, playerBarFound: false, playerPlayFound: false },
  });
  assert.match(text, /Статус совместимости: Безопасный режим/);
  const blocked = buildReport({
    compatStatus: { code: 'blocked', label: 'Внедрение выключено' },
    menu: { navbarFound: true },
  });
  assert.match(blocked, /Статус совместимости: Внедрение выключено/);
});
