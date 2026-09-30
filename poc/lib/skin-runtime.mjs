import { installSkinStyle } from './apply-skin.mjs';
import { applyPlayerVariables } from './player-state.mjs';
import { clearStamps, stampElements } from './runtime-stamp.mjs';

const VARIABLE_NAMES = [
  '--yms-title',
  '--yms-artist',
  '--yms-progress',
  '--yms-volume',
  '--yms-playing',
  '--yms-liked',
];

export function applySkinRuntime({ document, map, css, playerState, gate } = {}) {
  if (!gate || gate.apply !== true) {
    return { applied: false, reason: gate?.reason || 'unknown', stamped: 0 };
  }
  const stamped = stampElements(document, map);
  const count = stamped?.stamped || 0;
  if (count === 0) {
    clearStamps(document);
    return { applied: false, reason: 'no-nodes', stamped: 0 };
  }
  const installed = installSkinStyle(document, css);
  if (installed.applied !== true) {
    clearStamps(document);
    const style = document.getElementById?.('ym-skins-runtime');
    if (style && typeof style.remove === 'function') style.remove();
    return { applied: false, reason: installed.reason || 'css', stamped: 0 };
  }
  const root = document.documentElement;
  const variables = applyPlayerVariables(root, playerState);
  return {
    applied: true,
    reason: 'ok',
    stamped: count,
    variables: variables.applied === true,
  };
}

export function clearSkinRuntime(document) {
  const style = document.getElementById?.('ym-skins-runtime');
  if (style && typeof style.remove === 'function') style.remove();
  const cleared = clearStamps(document);
  const root = document.documentElement;
  if (root && typeof root.style?.removeProperty === 'function') {
    for (const name of VARIABLE_NAMES) root.style.removeProperty(name);
  }
  return {
    cleared: cleared?.cleared || 0,
    styleRemoved: document.getElementById?.('ym-skins-runtime') == null,
  };
}
