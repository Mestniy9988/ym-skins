function isBlank(text) {
  return text == null || (typeof text === 'string' && text.trim() === '');
}

export function parseCodesign(text) {
  if (isBlank(text)) return { status: 'not-checked' };
  if (text.includes('code object is not signed at all')) return { status: 'unsigned' };
  if (text.includes('Signature=adhoc')) return { status: 'adhoc' };
  const authority = text.match(/^Authority=(.*)$/m);
  if (authority) return { status: 'signed', authority: authority[1].trim() };
  return { status: 'unrecognized' };
}

export function parseSpctl(text) {
  if (isBlank(text)) return { status: 'not-checked' };
  if (/rejected/i.test(text)) return { status: 'rejected' };
  if (/accepted/i.test(text)) return { status: 'accepted' };
  return { status: 'unrecognized' };
}

export function combineMacSign(codesignText, spctlText) {
  const codesign = parseCodesign(codesignText);
  const spctl = parseSpctl(spctlText);
  if (codesign.status === 'unsigned') return { status: 'unsigned' };
  if (spctl.status === 'rejected') return { status: 'rejected' };
  if (codesign.status === 'signed' && spctl.status === 'accepted') {
    return { status: 'accepted', authority: codesign.authority };
  }
  if (codesign.status === 'adhoc' && spctl.status === 'accepted') return { status: 'adhoc' };
  if (codesign.status === 'not-checked' && spctl.status === 'not-checked') {
    return { status: 'not-checked' };
  }
  return { status: 'unrecognized' };
}
