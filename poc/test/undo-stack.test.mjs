import assert from 'node:assert/strict';
import test from 'node:test';

import { runReversible } from '../lib/undo-stack.mjs';

function step(log, name, { applyThrows, undoThrows } = {}) {
  return {
    apply() {
      log.push(`apply:${name}`);
      if (applyThrows) throw applyThrows;
    },
    undo() {
      log.push(`undo:${name}`);
      if (undoThrows) throw undoThrows;
    },
  };
}

test('runs apply in order and returns the completed count', () => {
  const log = [];
  const steps = [step(log, 'a'), step(log, 'b'), step(log, 'c')];

  const result = runReversible(steps);

  assert.deepEqual(result, { completed: 3 });
  assert.deepEqual(log, ['apply:a', 'apply:b', 'apply:c']);
});

test('an empty list completes zero steps', () => {
  assert.deepEqual(runReversible([]), { completed: 0 });
});

test('undoes applied steps in reverse when a later apply throws', () => {
  const log = [];
  const applyError = new Error('apply-c');
  const steps = [
    step(log, 'a'),
    step(log, 'b'),
    step(log, 'c', { applyThrows: applyError }),
  ];

  assert.throws(() => runReversible(steps), (error) => error === applyError);

  assert.deepEqual(log, ['apply:a', 'apply:b', 'apply:c', 'undo:b', 'undo:a']);
});

test('does not undo anything when the first apply throws', () => {
  const log = [];
  const applyError = new Error('apply-a');
  const steps = [
    step(log, 'a', { applyThrows: applyError }),
    step(log, 'b'),
  ];

  assert.throws(() => runReversible(steps), (error) => error === applyError);
  assert.deepEqual(log, ['apply:a']);
});

test('continues remaining undos when one undo throws', () => {
  const log = [];
  const applyError = new Error('apply-c');
  const undoError = new Error('undo-b');
  const steps = [
    step(log, 'a'),
    step(log, 'b', { undoThrows: undoError }),
    step(log, 'c', { applyThrows: applyError }),
  ];

  assert.throws(
    () => runReversible(steps),
    (error) => {
      assert.equal(error instanceof Error, true);
      assert.equal(error.message, 'rollback-failed');
      assert.equal(error.cause, undoError);
      assert.equal(error.applyError, applyError);
      return true;
    },
  );

  assert.deepEqual(log, ['apply:a', 'apply:b', 'apply:c', 'undo:b', 'undo:a']);
});

test('keeps the first undo error when several undos throw', () => {
  const log = [];
  const applyError = new Error('apply-d');
  const firstUndoError = new Error('undo-c');
  const laterUndoError = new Error('undo-a');
  const steps = [
    step(log, 'a', { undoThrows: laterUndoError }),
    step(log, 'b'),
    step(log, 'c', { undoThrows: firstUndoError }),
    step(log, 'd', { applyThrows: applyError }),
  ];

  assert.throws(
    () => runReversible(steps),
    (error) => {
      assert.equal(error.message, 'rollback-failed');
      assert.equal(error.cause, firstUndoError);
      assert.equal(error.applyError, applyError);
      return true;
    },
  );

  assert.deepEqual(log, [
    'apply:a',
    'apply:b',
    'apply:c',
    'apply:d',
    'undo:c',
    'undo:b',
    'undo:a',
  ]);
});

test('rejects a non-array before calling apply', () => {
  const log = [];
  const valid = step(log, 'a');

  for (const steps of [null, undefined, { length: 1, 0: valid }, 'nope', 1]) {
    assert.throws(() => runReversible(steps), TypeError);
  }
  assert.deepEqual(log, []);
});

test('rejects invalid steps before calling any apply', () => {
  const log = [];
  const valid = step(log, 'a');
  const cases = [
    [valid, null],
    [valid, undefined],
    [valid, 'step'],
    [valid, 0],
    [valid, {}],
    [valid, { apply() {}, undo: 'nope' }],
    [valid, { apply: 'nope', undo() {} }],
    [{ undo() {} }],
    [valid, []],
  ];

  for (const steps of cases) {
    assert.throws(() => runReversible(steps), TypeError);
  }
  assert.deepEqual(log, []);
});
