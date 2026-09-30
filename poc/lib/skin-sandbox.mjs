const RULES = [
  ['eval', /\beval\s*\(/i],
  ['function', /\bnew\s+function\b/i],
  // Identifier Function followed by '('. A declaration such as `function draw(`
  // has a name between the keyword and '(', so it does not match. A dotted
  // member (`obj.Function(`) is not this form either.
  ['function', /(?:^|[^\w.])function\s*\(/i],
  ['import', /\bimport\s*\(/i],
  ['require', /\brequire\s*\(/i],
  ['fetch', /\bfetch\s*\(/i],
  ['xhr', /\bxmlhttprequest\b/i],
  ['websocket', /\bwebsocket\b/i],
  ['cookie', /\bdocument\s*\.\s*cookie\b/i],
  ['storage', /\blocalstorage\b/i],
  ['storage', /\bsessionstorage\b/i],
  ['storage', /\bindexeddb\b/i],
];

export function auditSkinSource(source) {
  if (typeof source !== 'string') return { ok: false, rule: 'not-text' };
  for (const [rule, pattern] of RULES) {
    if (pattern.test(source)) return { ok: false, rule };
  }
  return { ok: true };
}
