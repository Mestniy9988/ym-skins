const ID = /^[a-z0-9-]{1,40}$/;
const ENUM_VALUE = /^[a-z0-9-]{1,20}$/;

export function readSkinSettings(input) {
  const list = Array.isArray(input) ? input : input?.settings;
  if (list == null) return { ok: true, settings: [] };
  if (!Array.isArray(list) || list.length > 16) return { ok: false, reason: 'settings' };
  const seen = new Set();
  const settings = [];
  for (const item of list) {
    const setting = readOne(item);
    if (!setting) return { ok: false, reason: 'settings' };
    if (seen.has(setting.id)) return { ok: false, reason: 'settings' };
    seen.add(setting.id);
    settings.push(setting);
  }
  return { ok: true, settings };
}

function readOne(item) {
  if (item == null || typeof item !== 'object' || Array.isArray(item)) return null;
  if (typeof item.id !== 'string' || !ID.test(item.id)) return null;
  if (item.type === 'boolean') {
    if (typeof item.default !== 'boolean') return null;
    return { id: item.id, type: 'boolean', default: item.default };
  }
  if (item.type === 'enum') {
    if (!Array.isArray(item.values) || item.values.length === 0 || item.values.length > 8) return null;
    const values = [];
    const seen = new Set();
    for (const value of item.values) {
      if (typeof value !== 'string' || !ENUM_VALUE.test(value) || seen.has(value)) return null;
      seen.add(value);
      values.push(value);
    }
    if (!seen.has(item.default)) return null;
    return { id: item.id, type: 'enum', values, default: item.default };
  }
  return null;
}
