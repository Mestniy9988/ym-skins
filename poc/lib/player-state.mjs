const TEXT_LIMIT = 120;

function sanitizeText(value) {
  if (typeof value !== 'string') return '';
  let cleaned = '';
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) continue;
    cleaned += value[index];
  }
  cleaned = cleaned.trim();
  if (cleaned.length > TEXT_LIMIT) cleaned = cleaned.slice(0, TEXT_LIMIT);
  return cleaned;
}

function formatUnit(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    return '0';
  }
  return value.toFixed(4).replace(/\.?0+$/, '');
}

function flag(value) {
  return value === true ? '1' : '0';
}

export function playerVariables(state = {}) {
  const source = state != null && typeof state === 'object' ? state : {};
  return {
    '--yms-title': sanitizeText(source.title),
    '--yms-artist': sanitizeText(source.artist),
    '--yms-progress': formatUnit(source.progress),
    '--yms-volume': formatUnit(source.volume),
    '--yms-playing': flag(source.playing),
    '--yms-liked': flag(source.liked),
  };
}

export function applyPlayerVariables(element, state) {
  if (element == null || typeof element.style?.setProperty !== 'function') {
    return { applied: false };
  }
  const variables = playerVariables(state);
  for (const name of Object.keys(variables)) {
    element.style.setProperty(name, variables[name]);
  }
  return { applied: true, variables };
}
