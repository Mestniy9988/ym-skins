import { findAudioGraphMarkers } from './audio-graph.mjs';
import { linuxDebugExtras } from './launch.mjs';
import { readLoopback } from './loopback.mjs';
import { collectTestIds, scanTestIds } from './selector-scan.mjs';
import { selectorMapFor } from './selector-map.mjs';
import { POC_BACKGROUND, POC_BUTTON } from './page.mjs';
import { buildLaunchArgs, sameColor } from './plan.mjs';
import { buildReport } from './report.mjs';
import { compareSnapshots } from './snapshot.mjs';

const LAUNCH_PLATFORMS = new Set(['win32', 'linux']);

export async function executeProbe(env, deps) {
  const platform = env.platform;
  if (!LAUNCH_PLATFORMS.has(platform)) {
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
  const audioGraph = client.asar ? await safeCall(() => findAudioGraphMarkers(client.asar)) : null;
  const finish = (exitCode, facts) => {
    const full = { ...facts };
    if (audioGraph) full.audioGraph = audioGraph;
    const selectorMap = selectorMapFor(facts.versions?.asar);
    if (selectorMap) full.selectorMap = selectorMap;
    if (selectorMap && client.asar) {
      full.selectorScan = safeScan(client.asar, collectTestIds(selectorMap));
    }
    if (facts.platform === 'linux') full.loopback = readLoopback();
    return { exitCode, markdown: buildReport(full), facts: full };
  };
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
    return finish(2, facts);
  }

  if (!deps.assertLoopback || !deps.spawnDebugClient || !deps.inspectPage) {
    const facts = { platform, decision: 'launch', client, fuses, versions, update };
    return finish(1, facts);
  }

  const first = await launchChecked(client, deps, platform);
  if (!first.ok) {
    const facts = {
      platform,
      decision: 'launch',
      client,
      fuses,
      versions,
      update,
      launch: first.launch,
      asar: await archiveHashes(deps, client, asarBefore),
    };
    return finish(1, facts);
  }

  let original;
  let styled;
  try {
    original = await deps.inspectPage({ port: first.handle.port, apply: false });
    styled = await deps.inspectPage({ port: first.handle.port, apply: true });
  } catch (error) {
    await first.handle.close();
    const facts = await failureFacts({ platform, client, fuses, versions, update, asarBefore, deps, port: first.handle.port, error });
    return finish(1, facts);
  }
  await first.handle.close();
  if (deps.pause) await deps.pause(1500);

  const second = await launchChecked(client, deps, platform);
  if (!second.ok) {
    const facts = {
      platform,
      decision: 'launch',
      client,
      fuses,
      versions,
      update,
      launch: second.launch,
      asar: await archiveHashes(deps, client, asarBefore),
    };
    return finish(1, facts);
  }

  let afterRestart;
  let reapplied;
  try {
    afterRestart = await deps.inspectPage({ port: second.handle.port, apply: false });
    reapplied = await deps.inspectPage({ port: second.handle.port, apply: true });
  } catch (error) {
    await second.handle.close();
    const facts = await failureFacts({ platform, client, fuses, versions, update, asarBefore, deps, port: second.handle.port, error });
    return finish(1, facts);
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
    buttonTestId: styled?.buttonTestId || null,
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
    await deps.saveSession({
      pid: second.handle.pid,
      port: second.handle.port,
      exe: client.exe,
      userDataDir: second.launch.userDataDir || null,
    });
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
    launch: second.launch,
    surface,
    analyser: reapplied?.analyser || styled?.analyser || null,
    menu: withPageCount(reapplied?.menu || styled?.menu || null, reapplied?.pageCount ?? styled?.pageCount),
    asar: { before: asarBefore, after: asarAfter },
  };
  return finish(accepted ? 0 : 1, facts);
}

function withPageCount(menu, pageCount) {
  if (!menu) return null;
  if (!Number.isInteger(pageCount)) return menu;
  return { ...menu, pageCount };
}

async function launchChecked(client, deps, platform) {
  const port = deps.reservePort ? await deps.reservePort() : 0;
  const extras = platform === 'linux'
    ? linuxDebugExtras(client.exe, { sandboxMode: deps.sandboxMode, userDataDir: deps.userDataDir })
    : [];
  const args = buildLaunchArgs(port, extras);
  const handle = await deps.spawnDebugClient({ exe: client.exe, args, port });
  const loopback = await deps.assertLoopback(handle.pid, handle.port ?? port, client.exe);
  const opened = loopback === true || loopback?.ok === true;
  const launch = launchFacts(handle.port ?? port, opened, extras, loopback?.reason);
  if (!opened) {
    await handle.close();
    return {
      ok: false,
      port: launch.port,
      reason: launch.reason,
      launch,
      handle,
    };
  }
  return { ok: true, port: launch.port, launch, handle };
}

function launchFacts(port, opened, extras, reason) {
  const dataDir = extras.find((arg) => arg.startsWith('--user-data-dir='));
  return {
    port,
    loopback: opened,
    reason: opened ? undefined : (reason || 'unconfirmed'),
    gtk3: extras.includes('--gtk-version=3'),
    noSandbox: extras.includes('--no-sandbox'),
    userDataDir: dataDir ? dataDir.slice('--user-data-dir='.length) : null,
  };
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

function safeScan(file, ids) {
  try {
    return scanTestIds(file, ids);
  } catch {
    return null;
  }
}

async function safeCall(fn) {
  if (!fn) return null;
  try {
    return await fn();
  } catch {
    return null;
  }
}
