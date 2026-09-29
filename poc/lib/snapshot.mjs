export function compareSnapshots(previous, current) {
  if (!previous) return { status: 'no-baseline' };
  const versionChanged = previous.version !== current.version;
  const asarChanged = previous.asarSha256 !== current.asarSha256;
  if (!versionChanged && !asarChanged) {
    return { status: 'unchanged', versionChanged, asarChanged };
  }
  return { status: 'changed', versionChanged, asarChanged };
}
