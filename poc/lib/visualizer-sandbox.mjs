import vm from 'node:vm';

import { createRuntime } from './runtime-events.mjs';
import { auditSkinSource } from './skin-sandbox.mjs';

export function runVisualizer(source, hooks = {}) {
  const audit = auditSkinSource(source);
  if (!audit.ok) return { ok: false, reason: audit.rule };
  if (source.length > 8000) return { ok: false, reason: 'size' };
  const runtime = createRuntime();
  if (Array.isArray(hooks.bins)) runtime.notifySpectrum(hooks.bins);
  const seen = { tracks: [], playing: [] };
  const api = {
    onTrackChange(listener) {
      if (typeof listener !== 'function') throw new TypeError('listener');
      return runtime.onTrackChange((track) => {
        seen.tracks.push(track);
        listener(track);
      });
    },
    onPlayStateChange(listener) {
      if (typeof listener !== 'function') throw new TypeError('listener');
      return runtime.onPlayStateChange((flag) => {
        seen.playing.push(flag);
        listener(flag);
      });
    },
    getSpectrum() {
      return runtime.getSpectrum();
    },
  };
  const sandbox = { api };
  vm.createContext(sandbox);
  try {
    vm.runInContext('"use strict";\n' + source, sandbox, { timeout: 50 });
  } catch {
    return { ok: false, reason: 'run' };
  }
  if (hooks.track) runtime.notifyTrack(hooks.track);
  if (typeof hooks.playing === 'boolean') runtime.notifyPlay(hooks.playing);
  return {
    ok: true,
    tracks: seen.tracks,
    playing: seen.playing,
    spectrum: runtime.getSpectrum(),
  };
}
