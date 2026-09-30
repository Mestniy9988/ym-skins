const HOUR = 60 * 60 * 1000;
const MAX_HOURS = 24 * 30;

export function dueForCheck(lastIso, nowIso, intervalHours) {
  if (typeof intervalHours !== 'number' || !Number.isFinite(intervalHours) || intervalHours <= 0 || intervalHours > MAX_HOURS) {
    return { due: false, reason: 'interval' };
  }
  const now = Date.parse(nowIso);
  if (!Number.isFinite(now)) return { due: false, reason: 'now' };
  if (lastIso == null) return { due: true, reason: 'never' };
  const last = Date.parse(lastIso);
  if (!Number.isFinite(last)) return { due: false, reason: 'last' };
  if (now < last) return { due: false, reason: 'clock' };
  return now - last >= intervalHours * HOUR
    ? { due: true, reason: 'elapsed' }
    : { due: false, reason: 'wait' };
}
