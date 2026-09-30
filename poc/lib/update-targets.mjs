const TARGETS = ['manager', 'catalog', 'maps'];
const VERSION = /^\d+(?:\.\d+){0,3}$/;

export function planTargetUpdates({ installed, remote } = {}) {
  const installedMap = asRecord(installed);
  const remoteMap = asRecord(remote);
  const updates = [];
  const skipped = [];

  for (const target of TARGETS) {
    const outcome = decideTarget(target, installedMap[target], remoteMap[target]);
    if (outcome.update) updates.push(outcome.update);
    else skipped.push(outcome.skip);
  }

  return { updates, skipped };
}

function asRecord(value) {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function decideTarget(target, installed, remote) {
  if (!isVersion(remote)) return { skip: { target, reason: 'remote' } };
  if (typeof installed === 'string' && installed !== '' && !isVersion(installed)) {
    return { skip: { target, reason: 'installed' } };
  }
  if (typeof installed !== 'string' || installed === '') {
    return { update: { target, from: null, to: remote } };
  }
  const order = compareVersions(installed, remote);
  if (order === 0) return { skip: { target, reason: 'same' } };
  if (order > 0) return { skip: { target, reason: 'older' } };
  return { update: { target, from: installed, to: remote } };
}

function isVersion(value) {
  return typeof value === 'string' && VERSION.test(value);
}

function compareVersions(left, right) {
  const a = left.split('.').map(Number);
  const b = right.split('.').map(Number);
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av !== bv) return av > bv ? 1 : -1;
  }
  return 0;
}
