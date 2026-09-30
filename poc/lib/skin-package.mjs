import { readManifest } from './manifest.mjs';
import { auditSkinCss } from './skin-css.mjs';

const THEME_FILE = /^themes\/[a-z0-9-]{1,40}\.css$/;

export function readSkinPackage(files) {
  if (files === null || typeof files !== 'object' || Array.isArray(files)) {
    return { ok: false, reason: 'files' };
  }
  const names = Object.keys(files);
  if (names.length === 0 || names.length > 16) return { ok: false, reason: 'files' };
  for (const name of names) {
    if (name !== 'manifest.json' && name !== 'skin.css' && THEME_FILE.test(name) === false) {
      return { ok: false, reason: 'path' };
    }
    if (typeof files[name] !== 'string') return { ok: false, reason: 'path' };
  }
  if (typeof files['manifest.json'] !== 'string' || typeof files['skin.css'] !== 'string') {
    return { ok: false, reason: 'missing' };
  }
  const manifest = readManifest(files['manifest.json']);
  if (!manifest.ok) return { ok: false, reason: manifest.reason };
  const css = auditSkinCss(files['skin.css']);
  if (!css.ok) return { ok: false, reason: css.reason };
  const themes = {};
  for (const name of names) {
    if (!name.startsWith('themes/')) continue;
    const id = name.slice('themes/'.length, -'.css'.length);
    if (!manifest.manifest.themes.some((theme) => theme.id === id)) {
      return { ok: false, reason: 'theme' };
    }
    const themeCss = auditSkinCss(files[name]);
    if (!themeCss.ok) return { ok: false, reason: themeCss.reason };
    themes[id] = files[name];
  }
  return { ok: true, manifest: manifest.manifest, css: files['skin.css'], themes };
}
