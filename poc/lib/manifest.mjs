/**
 * Read an official skin manifest from an object or a JSON string.
 * No filesystem, no network, and no skin-code execution.
 *
 * @param {unknown} input
 * @returns {{ ok: true, manifest: { id: string, name: string, version: string, runtimeApi: string, themes: { id: string, name: string }[] } } | { ok: false, reason: string }}
 */
export function readManifest(input) {
  let value = input;
  if (typeof input === 'string') {
    if (input.length > 20000) {
      return { ok: false, reason: 'too-large' };
    }
    try {
      value = JSON.parse(input);
    } catch {
      return { ok: false, reason: 'invalid-json' };
    }
  }

  if (!isPlainObject(value)) {
    return { ok: false, reason: 'not-object' };
  }

  if (!isValidId(value.id)) {
    return { ok: false, reason: 'id' };
  }
  if (!isValidName(value.name)) {
    return { ok: false, reason: 'name' };
  }
  if (!isValidVersion(value.version)) {
    return { ok: false, reason: 'version' };
  }
  if (!isValidRuntimeApi(value.runtimeApi)) {
    return { ok: false, reason: 'runtime-api' };
  }

  const themes = readThemes(value.themes);
  if (themes == null) {
    return { ok: false, reason: 'themes' };
  }

  return {
    ok: true,
    manifest: {
      id: value.id,
      name: value.name,
      version: value.version,
      runtimeApi: value.runtimeApi,
      themes,
    },
  };
}

const ID_RE = /^[a-z0-9-]{1,40}$/;
const VERSION_RE = /^\d+\.\d+\.\d+$/;
const RUNTIME_API_RE = /^\^\d+\.\d+$/;
const NAME_RE = /^[A-Za-z0-9 '&+#]{1,80}$/;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isValidId(value) {
  return typeof value === 'string' && ID_RE.test(value);
}

function isValidName(value) {
  if (typeof value !== 'string') return false;
  if (value.length < 1 || value.length > 80) return false;
  if (value !== value.trim()) return false;
  if (/[\u0000-\u001F\u007F]/.test(value)) return false;
  return NAME_RE.test(value);
}

function isValidVersion(value) {
  return typeof value === 'string' && VERSION_RE.test(value);
}

function isValidRuntimeApi(value) {
  return typeof value === 'string' && RUNTIME_API_RE.test(value);
}

function readThemes(themes) {
  if (!Array.isArray(themes) || themes.length === 0) return null;
  const seen = new Set();
  const out = [];
  for (const theme of themes) {
    if (!isPlainObject(theme) || !isValidId(theme.id) || !isValidName(theme.name)) {
      return null;
    }
    if (seen.has(theme.id)) return null;
    seen.add(theme.id);
    out.push({ id: theme.id, name: theme.name });
  }
  return out;
}
