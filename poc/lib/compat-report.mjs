export function buildCompatReport({ consent, ymVersion, missing } = {}) {
  if (consent !== true) {
    return { send: false, reason: 'no-consent', payload: null };
  }

  if (typeof ymVersion !== 'string' || !/^\d+(?:\.\d+){1,3}$/.test(ymVersion)) {
    return { send: false, reason: 'version', payload: null };
  }

  if (!Array.isArray(missing) || missing.length > 12) {
    return { send: false, reason: 'missing', payload: null };
  }

  const namePattern = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*){0,3}$/;
  for (const name of missing) {
    if (typeof name !== 'string' || !namePattern.test(name)) {
      return { send: false, reason: 'missing', payload: null };
    }
  }

  const seen = new Set();
  const unique = [];
  for (const name of missing) {
    if (!seen.has(name)) {
      seen.add(name);
      unique.push(name);
    }
  }

  return {
    send: true,
    reason: 'ok',
    payload: { ymVersion, missing: unique },
  };
}
