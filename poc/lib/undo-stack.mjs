function isStep(step) {
  return (
    step !== null &&
    typeof step === 'object' &&
    typeof step.apply === 'function' &&
    typeof step.undo === 'function'
  );
}

function rollback(applied, applyError) {
  let firstUndoError;

  for (let i = applied.length - 1; i >= 0; i -= 1) {
    try {
      applied[i].undo();
    } catch (undoError) {
      if (firstUndoError === undefined) firstUndoError = undoError;
    }
  }

  if (firstUndoError !== undefined) {
    const error = new Error('rollback-failed', { cause: firstUndoError });
    error.applyError = applyError;
    throw error;
  }
}

export function runReversible(steps) {
  if (!Array.isArray(steps)) {
    throw new TypeError('steps must be an array');
  }

  for (const step of steps) {
    if (!isStep(step)) {
      throw new TypeError('each step must be an object with apply and undo functions');
    }
  }

  const applied = [];
  for (const step of steps) {
    try {
      step.apply();
    } catch (applyError) {
      rollback(applied, applyError);
      throw applyError;
    }
    applied.push(step);
  }

  return { completed: steps.length };
}
