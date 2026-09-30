export function testSkinCss() {
  return [
    '[data-yms="player.play"] { background-color: rgb(12, 140, 70) !important; }',
    '@media (prefers-reduced-motion: reduce) { [data-yms] { animation: none !important; } }',
  ].join('\n');
}

export function auditSkinCss(css) {
  if (typeof css !== 'string' || css.length === 0 || css.length > 20000) {
    return { ok: false, reason: 'size' };
  }
  const forbidden = ['url(', '@import', 'expression(', 'javascript:', 'data-test-id', '-moz-binding', 'behavior:', '</', '@font-face'];
  const lower = css.toLowerCase();
  for (const word of forbidden) {
    if (lower.includes(word)) return { ok: false, reason: 'forbidden' };
  }
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const parts = stripped.split('{');
  if (parts.length < 2) return { ok: false, reason: 'selector' };
  for (let index = 0; index < parts.length - 1; index += 1) {
    const raw = index === 0 ? parts[0] : parts[index].slice(parts[index].lastIndexOf('}') + 1);
    const selector = raw.trim();
    if (!selector) return { ok: false, reason: 'selector' };
    if (/^@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)$/i.test(selector)) continue;
    const pieces = selector.split(',');
    for (const piece of pieces) {
      if (!piece.includes('[data-yms')) return { ok: false, reason: 'selector' };
    }
  }
  return { ok: true };
}
