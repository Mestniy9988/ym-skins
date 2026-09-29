import { POC_BACKGROUND, POC_BUTTON } from './page.mjs';
import { buildLaunchArgs, sameColor } from './plan.mjs';
import { buildReport } from './report.mjs';
import { compareSnapshots } from './snapshot.mjs';

export async function executeProbe(env, deps) {
  const platform = env.platform;
  if (platform !== 'win32') {
    const facts = { platform, decision: 'not-windows' };
    return { exitCode: 2, markdown: buildReport(facts), facts };
  }

  const found = await deps.findClient();
  if (!found || found.ambiguous || !found.client) {
    const facts = {
      platform,
      decision: found?.ambiguous ? 'ambiguous' : 'client-not-found',
    };
    return { exitCode: 2, markdown: buildReport(facts), facts };
  }

  const client = found.client;
  const fuses = await safeCall(() => deps.readFuses(client.exe));
  const versions = await safeCall(() => deps.readVersions?.(client));
  const asarBefore = client.asar ? await safeCall(() => deps.hashFile(client.asar)) : null;
  const exeBefore = await safeCall(() => deps.hashFile(client.exe));
  const baseline = await safeCall(() => deps.loadBaseline?.());
  const update = compareSnapshots(
    baseline || null,
    { version: versions?.asar || versions?.exe || null, asarSha256: asarBefore },
  );

  if (client.running) {
    const facts = {
      platform,
      decision: 'already-running',
      client,
      fuses,
      versions,
      update,
      asar: asarBefore ? { before: asarBefore, after: null } : null,
    };
    return { exitCode: 2, markdown: buildReport(facts), facts };
  }

  if (!deps.assertLoopback || !deps.spawnDebugClient || !deps.inspectPage) {
    const facts = { platform, decision: 'launch', client, fuses, versions, update };
    return { exitCode: 1, markdown: buildReport(facts), facts };
  }

  const first = await launchChecked(client, deps);
  if (!first.ok) {
    const facts = {
      platform,
      decision: 'launch',
      client,
      fuses,
      versions,
      update,
      launch: { port: first.port, loopback: false },
      asar: await archiveHashes(deps, client, asarBefore),
    };
    return { exitCode: 1, markdown: buildReport(facts), facts };
  }

  let original;
  let styled;
  try {
    original = await deps.inspectPage({ port: first.handle.port, apply: false });
    styled = await deps.inspectPage({ port: first.handle.port, apply: true });
  } catch (error) {
    await first.handle.close();
    const facts = failureFacts({ platform, client, fuses, versions, update, asarBefore, deps, port: first.handle.port, error });
    return { exitCode: 1, markdown: buildReport(await facts), facts: await facts };
  }
  await first.handle.close();

  const second = await launchChecked(client, deps);
  if (!second.ok) {
    const facts = {
      platform,
      decision: 'launch',
      client,
      fuses,
      versions,
      update,
      launch: { port: second.port, loopback: false },
      asar: await archiveHashes(deps, client, asarBefore),
    };
    return { exitCode: 1, markdown: buildReport(facts), facts };
  }

  let afterRestart;
  let reapplied;
  try {
    afterRestart = await deps.inspectPage({ port: second.handle.port, apply: false });
    reapplied = await deps.inspectPage({ port: second.handle.port, apply: true });
  } catch (error) {
    await second.handle.close();
    const facts = failureFacts({ platform, client, fuses, versions, update, asarBefore, deps, port: second.handle.port, error });
    return { exitCode: 1, markdown: buildReport(await facts), facts: await facts };
  }

  const asarAfter = await safeCall(() => deps.hashFile(client.asar));
  const exeAfter = await safeCall(() => deps.hashFile(client.exe));
  const hashesStable = asarBefore && asarAfter && asarBefore === asarAfter
    && exeBefore && exeAfter && exeBefore === exeAfter;
  const surface = {
    originalBackground: original?.background || null,
    styledBackground: styled?.background || null,
    originalButton: original?.buttonBackground || null,
    styledButton: styled?.buttonBackground || null,
    buttonFound: Boolean(styled?.buttonFound),
    heldInSession: Boolean(styled?.heldInSession && styled?.stylePresent),
    absentAfterRestart: Boolean(afterRestart)
      && afterRestart.stylePresent === false
      && sameColor(afterRestart.background, original?.background),
    restoredAfterReinject: Boolean(reapplied?.stylePresent)
      && sameColor(reapplied?.background, styled?.background)
      && sameColor(reapplied?.buttonBackground, styled?.buttonBackground)
      && sameColor(styled?.background, POC_BACKGROUND)
      && sameColor(styled?.buttonBackground, POC_BUTTON)
      && !sameColor(original?.background, styled?.background),
  };
  const accepted = hashesStable && surface.restoredAfterReinject && surface.absentAfterRestart && surface.buttonFound;
  if (!accepted) await second.handle.close();
  else if (deps.saveSession) {
    await deps.saveSession({ pid: second.handle.pid, port: second.handle.port, exe: client.exe });
  }
  if (accepted && deps.saveBaseline) {
    await deps.saveBaseline({
      version: versions?.asar || versions?.exe || null,
      asarSha256: asarAfter,
      capturedAt: new Date().toISOString(),
    });
  }
  const facts = {
    platform,
    decision: 'launch',
    client,
    fuses,
    versions,
    update,
    launch: { port: second.handle.port, loopback: true },
    surface,
    analyser: reapplied?.analyser || styled?.analyser || null,
    menu: reapplied?.menu || styled?.menu || null,
    asar: { before: asarBefore, after: asarAfter },
  };
  return { exitCode: accepted ? 0 : 1, markdown: buildReport(facts), facts };
}

async function launchChecked(client, deps) {
  const port = deps.reservePort ? await deps.reservePort() : 0;
  const args = buildLaunchArgs(port);
  const handle = await deps.spawnDebugClient({ exe: client.exe, args, port });
  const loopback = await deps.assertLoopback(handle.pid, handle.port ?? port);
  if (!loopback) {
    await handle.close();
    return { ok: false, port: handle.port ?? port, handle };
  }
  return { ok: true, port: handle.port ?? port, handle };
}

async function archiveHashes(deps, client, asarBefore) {
  const after = client.asar ? await safeCall(() => deps.hashFile(client.asar)) : null;
  return { before: asarBefore, after };
}

async function failureFacts({ platform, client, fuses, versions, update, asarBefore, deps, port, error }) {
  return {
    platform,
    decision: 'launch',
    client,
    fuses,
    versions,
    update,
    launch: { port, loopback: true, error: error?.message || 'inspect failed' },
    asar: await archiveHashes(deps, client, asarBefore),
  };
}

async function safeCall(fn) {
  if (!fn) return null;
  try {
    return await fn();
  } catch {
    return null;
  }
}
