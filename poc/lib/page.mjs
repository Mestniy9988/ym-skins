export const POC_BACKGROUND = 'rgb(58, 24, 72)';
export const POC_BUTTON = 'rgb(232, 255, 71)';

export function pickButton(document) {
  const named = document.querySelector('[data-test-id="PLAY_BUTTON"]');
  if (named) return named;
  const marked = document.querySelector('[data-yms-poc="button"]');
  if (marked) return marked;
  const buttons = [...(document.querySelectorAll?.('button') || [])];
  const visible = buttons
    .filter((button) => (button.offsetWidth || 0) > 40 && (button.offsetHeight || 0) > 16)
    .sort((left, right) => (right.offsetWidth * right.offsetHeight) - (left.offsetWidth * left.offsetHeight));
  return visible[0] || buttons[0] || document.querySelector('button');
}

export function pageExpression(fn) {
  return `(() => {\nconst POC_BACKGROUND = ${JSON.stringify(POC_BACKGROUND)};\nconst POC_BUTTON = ${JSON.stringify(POC_BUTTON)};\n${pickButton.toString()}\n${readSurface.toString()}\nreturn (${fn.toString()})(document, getComputedStyle);\n})()`;
}

export function readSurface(document, getComputedStyle) {
  const body = document.body;
  const button = pickButton(document);
  return {
    background: body ? getComputedStyle(body).backgroundColor : null,
    buttonFound: Boolean(button),
    buttonTestId: button ? button.getAttribute('data-test-id') : null,
    buttonBackground: button ? getComputedStyle(button).backgroundColor : null,
    stylePresent: Boolean(document.getElementById('ym-skins-poc')),
  };
}

export function applySurface(document, getComputedStyle) {
  for (const node of [...(document.querySelectorAll?.('[data-yms-poc]') || [])]) {
    node.removeAttribute('data-yms-poc');
  }
  let style = document.getElementById('ym-skins-poc');
  if (!style) {
    style = document.createElement('style');
    style.id = 'ym-skins-poc';
    (document.head || document.documentElement).appendChild(style);
  }
  const root = document.documentElement;
  const width = (root && root.clientWidth) || (typeof globalThis.innerWidth === 'number' ? globalThis.innerWidth : 0);
  const height = (root && root.clientHeight) || (typeof globalThis.innerHeight === 'number' ? globalThis.innerHeight : 0);
  const markBackdrop = (node) => {
    if (!node || node === document.body || node === root || !node.setAttribute) return;
    const boxW = node.offsetWidth || 0;
    const boxH = node.offsetHeight || 0;
    const covers = width > 0 && height > 0 && boxW >= width * 0.9 && boxH >= height * 0.7;
    if (covers) node.setAttribute('data-yms-poc', 'backdrop');
  };
  if (width && height && document.elementFromPoint) {
    const points = [[0.5, 0.5], [0.2, 0.45], [0.5, 0.8]];
    for (const [px, py] of points) {
      let cover = document.elementFromPoint(Math.floor(width * px), Math.floor(height * py));
      let hops = 0;
      while (cover && cover !== document.body && cover !== root && hops < 12) {
        markBackdrop(cover);
        cover = cover.parentElement;
        hops += 1;
      }
    }
  }
  const blocks = document.querySelectorAll ? document.querySelectorAll('div, main, section') : [];
  for (const block of blocks) markBackdrop(block);
  const button = pickButton(document);
  const testId = button ? button.getAttribute('data-test-id') : null;
  let buttonRule = '';
  if (testId && /^[A-Za-z0-9_.:-]{1,80}$/.test(testId)) {
    buttonRule = `[data-test-id="${testId}"] { background-color: ${POC_BUTTON} !important; }`;
  } else if (button) {
    button.setAttribute('data-yms-poc', 'button');
    buttonRule = `[data-yms-poc="button"] { background-color: ${POC_BUTTON} !important; }`;
  }
  style.textContent = [
    `html, body, [data-yms-poc="backdrop"] { background-color: ${POC_BACKGROUND} !important; background-image: none !important; }`,
    buttonRule,
  ].join('\n');
  return readSurface(document, getComputedStyle);
}

export function removeSurface(document) {
  const style = document.getElementById('ym-skins-poc');
  if (style) style.remove();
  const marked = [...document.querySelectorAll('[data-yms-poc]')];
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
