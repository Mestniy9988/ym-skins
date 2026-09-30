import assert from 'node:assert/strict';
import test from 'node:test';

import { combineMacSign, parseCodesign, parseSpctl } from '../lib/macos-sign.mjs';

const SIGNED = [
  'Identifier=com.example.app',
  'Signature size=1234',
  'Authority=Developer ID Application: Example (TEAMID)',
  'Authority=Developer ID Certification Authority',
  'TeamIdentifier=TEAMID',
].join('\n');

test('parseCodesign treats empty input as not checked', () => {
  assert.deepEqual(parseCodesign(null), { status: 'not-checked' });
  assert.deepEqual(parseCodesign(undefined), { status: 'not-checked' });
  assert.deepEqual(parseCodesign(''), { status: 'not-checked' });
  assert.deepEqual(parseCodesign(' \n\t '), { status: 'not-checked' });
});

test('parseCodesign reads unsigned, adhoc, and the first authority', () => {
  assert.deepEqual(parseCodesign('code object is not signed at all'), { status: 'unsigned' });
  assert.deepEqual(
    parseCodesign('Executable=/tmp/App\ncode object is not signed at all\n'),
    { status: 'unsigned' },
  );
  assert.deepEqual(parseCodesign('Signature=adhoc'), { status: 'adhoc' });
  assert.deepEqual(parseCodesign('Format=Mach-O\nSignature=adhoc\n'), { status: 'adhoc' });
  assert.deepEqual(parseCodesign(SIGNED), {
    status: 'signed',
    authority: 'Developer ID Application: Example (TEAMID)',
  });
  assert.deepEqual(parseCodesign('Authority=  Example Team  \nAuthority=Other'), {
    status: 'signed',
    authority: 'Example Team',
  });
});

test('parseCodesign prefers unsigned over adhoc and adhoc over authority', () => {
  assert.deepEqual(
    parseCodesign('code object is not signed at all\nSignature=adhoc'),
    { status: 'unsigned' },
  );
  assert.deepEqual(parseCodesign('Signature=adhoc\nAuthority=Example'), { status: 'adhoc' });
  assert.deepEqual(parseCodesign('no signature markers here'), { status: 'unrecognized' });
  assert.deepEqual(parseCodesign('  Authority=indented'), { status: 'unrecognized' });
});

test('parseSpctl treats empty input as not checked and prefers rejected', () => {
  assert.deepEqual(parseSpctl(null), { status: 'not-checked' });
  assert.deepEqual(parseSpctl(undefined), { status: 'not-checked' });
  assert.deepEqual(parseSpctl(''), { status: 'not-checked' });
  assert.deepEqual(parseSpctl('  \n'), { status: 'not-checked' });
  assert.deepEqual(parseSpctl('rejected'), { status: 'rejected' });
  assert.deepEqual(parseSpctl('REJECTED'), { status: 'rejected' });
  assert.deepEqual(parseSpctl('accepted'), { status: 'accepted' });
  assert.deepEqual(parseSpctl('source=Notarized\naccepted'), { status: 'accepted' });
  assert.deepEqual(parseSpctl('accepted\nrejected'), { status: 'rejected' });
  assert.deepEqual(parseSpctl('source=no verdict'), { status: 'unrecognized' });
});

test('combineMacSign folds codesign and spctl statuses', () => {
  assert.deepEqual(
    combineMacSign('code object is not signed at all', 'rejected'),
    { status: 'unsigned' },
  );
  assert.deepEqual(combineMacSign(SIGNED, 'rejected'), { status: 'rejected' });
  assert.deepEqual(combineMacSign('Signature=adhoc', 'rejected'), { status: 'rejected' });
  assert.deepEqual(combineMacSign('', 'rejected'), { status: 'rejected' });
  assert.deepEqual(combineMacSign(SIGNED, 'accepted'), {
    status: 'accepted',
    authority: 'Developer ID Application: Example (TEAMID)',
  });
  assert.deepEqual(combineMacSign('Signature=adhoc', 'accepted'), { status: 'adhoc' });
  assert.deepEqual(combineMacSign(null, '  '), { status: 'not-checked' });
  assert.deepEqual(combineMacSign(SIGNED, ''), { status: 'unrecognized' });
  assert.deepEqual(combineMacSign('', 'accepted'), { status: 'unrecognized' });
  assert.deepEqual(combineMacSign('Signature=adhoc', ''), { status: 'unrecognized' });
  assert.deepEqual(combineMacSign('no markers', 'accepted'), { status: 'unrecognized' });
});
