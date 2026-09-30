import { buildCompatReport } from './compat-report.mjs';
import { decideMapRestore } from './map-restore.mjs';
import { selectChannel } from './release-channel.mjs';
import { decideSkinRollback } from './skin-rollback.mjs';
import { decideApplyMode } from './update-consent.mjs';
import { dueForCheck } from './update-clock.mjs';
import { decideUpdate } from './update-policy.mjs';
import { planTargetUpdates } from './update-targets.mjs';
import { watchVersion } from './version-watch.mjs';

const TARGETS = ['manager', 'catalog', 'maps'];

/**
 * One local update cycle. No network and no writes.
 * `remote` is the feed of the already resolved channel.
 */
export function planUpdateCycle(input = {}) {
  const source = isRecord(input) ? input : {};
  const watch = watchVersion({ previous: source.previous, current: source.current });
  const channel = selectChannel({ preference: source.preference, available: source.available });
  const due = readDue(source);
  const targets = fileTargets(source, channel, due);
  const steps = targets.updates.map((update) => {
    const mode = decideApplyMode({
      target: update.target,
      auto: source.auto,
      confirmed: source.confirmed,
    });
    return {
      target: update.target,
      from: update.from,
      to: update.to,
      apply: mode.apply,
      reason: mode.reason,
    };
  });
  const rollback = decideSkinRollback({
    failed: source.skinFailed,
    applied: source.skinApplied,
    previous: source.skinPrevious,
  });
  const ym = decideUpdate({
    snapshot: snapshotFromWatch(watch),
    hasCurrentMap: source.hasCurrentMap === true,
    previousSmoke: source.previousSmoke ?? null,
  });
  const map = decideMapRestore({
    mode: source.mode,
    smoke: source.smoke,
    injection: source.injection,
  });
  const report = source.smoke?.status === 'compatible'
    ? { send: false, reason: 'compatible', payload: null }
    : buildCompatReport({
      consent: source.consent,
      ymVersion: source.ymVersion,
      missing: source.missing,
    });

  return { watch, channel, due, targets, steps, rollback, ym, map, report };
}

function fileTargets(source, channel, due) {
  if (channel.version == null) return skipAll('channel');
  if (due && due.due !== true) return skipAll('wait');
  return planTargetUpdates({ installed: source.installed, remote: source.remote });
}

function skipAll(reason) {
  return {
    updates: [],
    skipped: TARGETS.map((target) => ({ target, reason })),
  };
}

function readDue(source) {
  if (source.intervalHours == null && source.now == null && source.lastCheck == null) return null;
  return dueForCheck(source.lastCheck ?? null, source.now, source.intervalHours);
}

function snapshotFromWatch(watch) {
  if (watch.reason === 'version' || watch.reason === 'asar') return { status: 'changed' };
  if (watch.reason === 'baseline') return { status: 'no-baseline' };
  if (watch.reason === 'same' || watch.reason === 'first-seen') return { status: 'unchanged' };
  return { status: 'partial' };
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
