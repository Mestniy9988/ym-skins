export const POC_BACKGROUND = 'rgb(58, 24, 72)';
export const POC_BUTTON = 'rgb(232, 255, 71)';

export function readSurface(document, getComputedStyle) {
  const body = document.body;
  const button = document.querySelector('button');
  return {
    background: body ? getComputedStyle(body).backgroundColor : null,
    buttonFound: Boolean(button),
    buttonTestId: button ? button.getAttribute('data-test-id') : null,
    buttonBackground: button ? getComputedStyle(button).backgroundColor : null,
    stylePresent: Boolean(document.getElementById('ym-skins-poc')),
  };
}

export function applySurface(document, getComputedStyle) {
  let style = document.getElementById('ym-skins-poc');
  if (!style) {
    style = document.createElement('style');
    style.id = 'ym-skins-poc';
    (document.head || document.documentElement).appendChild(style);
  }
  const button = document.querySelector('button');
  if (button) button.setAttribute('data-yms-poc', 'button');
  style.textContent = [
    `html, body { background-color: ${POC_BACKGROUND} !important; }`,
    `[data-yms-poc="button"] { background-color: ${POC_BUTTON} !important; }`,
  ].join('\n');
  return readSurface(document, getComputedStyle);
}

export function removeSurface(document) {
  const style = document.getElementById('ym-skins-poc');
  if (style) style.remove();
  const marked = [...document.querySelectorAll('[data-yms-poc="button"]')];
  for (const node of marked) node.removeAttribute('data-yms-poc');
  return { removedStyle: Boolean(style), clearedButtons: marked.length };
}

export function analyserProbe(window) {
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  return {
    hasAudioContextCtor: typeof AudioCtor === 'function',
    hasAnalyserNode: typeof window.AnalyserNode === 'function',
    spectrumRead: false,
  };
}

export function menuProbe(document, getComputedStyle) {
  const navs = [...document.querySelectorAll('nav, [role="navigation"], aside')];
  const result = {
    navCount: navs.length,
    hideTried: false,
    hideApplied: false,
    hideReverted: false,
    settingsPageOpened: false,
    bodyInsertRemoved: false,
  };
  const probe = document.createElement('div');
  probe.id = 'ym-skins-poc-settings-probe';
  document.body.appendChild(probe);
  try {
    result.bodyInsertRemoved = Boolean(document.getElementById(probe.id));
  } finally {
    probe.remove();
    result.bodyInsertRemoved = result.bodyInsertRemoved && !document.getElementById(probe.id);
  }

  const child = navs[0]?.children?.[navs[0].children.length - 1];
  if (child) {
    result.hideTried = true;
    const previous = child.style.display;
    try {
      child.setAttribute('data-yms-poc-hide', '1');
      child.style.display = 'none';
      result.hideApplied = getComputedStyle(child).display === 'none';
    } finally {
      child.style.display = previous;
      child.removeAttribute('data-yms-poc-hide');
      result.hideReverted = getComputedStyle(child).display !== 'none';
    }
  }
  return result;
}
