import { chooseAudioSource } from './audio-source.mjs';
import { compatibilityStatus } from './compat-status.mjs';
import { smokeSelectors } from './compat.mjs';
import { injectionAllowed } from './kill-switch.mjs';
import { combineMacSign } from './macos-sign.mjs';
import { skinGate } from './skin-gate.mjs';
import { classifySpectrum } from './spectrum.mjs';
import { decideUpdate } from './update-policy.mjs';

export function attachStage1Decisions(facts = {}) {
  const next = { ...facts };
  if (facts.menu) {
    next.smoke = smokeSelectors({
      map: facts.selectorMap || null,
      found: foundFromMenu(facts.menu),
    });
  }
  if (facts.update) {
    next.updateDecision = decideUpdate({
      snapshot: facts.update,
      hasCurrentMap: Boolean(facts.selectorMap),
      previousSmoke: facts.previousSmoke ?? null,
    });
  }
  const analyserState = analyserStateFrom(facts.analyser);
  if (analyserState || facts.loopback?.status === 'live') {
    next.audioChoice = chooseAudioSource({
      analyserState: analyserState || 'unavailable',
      loopbackStatus: facts.loopback?.status,
    });
  }
  if (analyserState && Array.isArray(facts.analyser?.bins)) {
    next.spectrum = classifySpectrum(facts.analyser.bins);
  }
  const version = facts.versions?.asar;
  if (typeof version === 'string') {
    const gate = injectionAllowed({ version, flags: facts.catalogFlags ?? null });
    if (gate.reason !== 'unknown-version') next.injection = gate;
  }
  if (facts.macCodesign != null || facts.macSpctl != null) {
    next.macSign = combineMacSign(facts.macCodesign ?? '', facts.macSpctl ?? '');
  }
  next.compatStatus = compatibilityStatus({
    smoke: next.smoke,
    updateDecision: next.updateDecision,
    injection: next.injection,
  });
  next.skinGate = skinGate({
    smoke: next.smoke,
    injection: next.injection,
    original: facts.originalTheme === true,
  });
  return next;
}

function foundFromMenu(menu) {
  const found = {};
  if (menu.navbarFound) found.sidebar = true;
  if (menu.settingsListFound) found['settings.list'] = true;
  if (menu.playerBarFound) found['player.bar'] = true;
  if (menu.playerPlayFound) found['player.play'] = true;
  return found;
}

function analyserStateFrom(analyser) {
  if (!analyser) return null;
  if (Array.isArray(analyser.bins)) return classifySpectrum(analyser.bins).state;
  if (Number.isFinite(analyser.spectrumPeak) && analyser.spectrumPeak > 0) return 'live';
  if (analyser.analyserCount > 0 || analyser.spectrumRead) return 'silent';
  return 'unavailable';
}
