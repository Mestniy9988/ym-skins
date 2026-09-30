export function skinGate({ smoke, injection, original } = {}) {
  if (injection && injection.allowed === false) return { apply: false, reason: 'blocked' };
  if (original === true) return { apply: false, reason: 'original' };
  if (smoke == null) return { apply: false, reason: 'unknown' };
  if (smoke.status === 'no-map') return { apply: false, reason: 'no-map' };
  if (smoke.status === 'safe-mode') return { apply: false, reason: 'safe-mode' };
  if (smoke.status === 'compatible') return { apply: true, reason: 'ok' };
  return { apply: false, reason: 'unknown' };
}
