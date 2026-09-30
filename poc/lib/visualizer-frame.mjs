import { classifySpectrum, decayPeaks } from './spectrum.mjs';

const MODES = new Set(['spectrum', 'oscilloscope', 'vu', 'off']);

export function frameVisualizer({
  mode = 'off',
  bins = [],
  timeDomain = [],
  playing = false,
  hidden = false,
  reducedMotion = false,
  peaks = [],
} = {}) {
  if (!MODES.has(mode)) return { draw: false, reason: 'bad-mode', animate: false };
  if (mode === 'off') return { mode, draw: false, reason: 'off', animate: false };
  if (hidden === true) return { mode, draw: false, reason: 'hidden', animate: false };
  if (playing !== true) return { mode, draw: false, reason: 'paused', animate: false };

  const animate = reducedMotion !== true;
  const classified = classifySpectrum(Array.isArray(bins) ? bins : []);
  if (mode === 'spectrum') {
    const bars = normalizeBins(bins);
    const held = holdPeaks(peaks, bars);
    return {
      mode,
      draw: true,
      decorative: classified.state !== 'live',
      animate,
      bars,
      peaks: held,
    };
  }
  if (mode === 'oscilloscope') {
    const samples = normalizeTime(timeDomain);
    const flat = samples.length === 0 || samples.every((sample) => sample === 0);
    return { mode, draw: true, decorative: flat, animate, samples };
  }
  const bars = normalizeBins(bins);
  const mid = Math.ceil(bars.length / 2);
  return {
    mode,
    draw: true,
    decorative: classified.state !== 'live',
    animate,
    left: average(bars.slice(0, mid)),
    right: bars.length === 0 ? 0 : average(bars.slice(mid)),
  };
}

function normalizeBins(bins) {
  if (!Array.isArray(bins) || bins.length === 0 || bins.length > 64) return [];
  const bars = [];
  for (const bin of bins) {
    if (typeof bin !== 'number' || !Number.isFinite(bin) || bin < 0 || bin > 255) return [];
    bars.push(bin / 255);
  }
  return bars;
}

function normalizeTime(samples) {
  if (!Array.isArray(samples) || samples.length === 0 || samples.length > 128) return [];
  const out = [];
  for (const sample of samples) {
    if (typeof sample !== 'number' || !Number.isFinite(sample) || sample < 0 || sample > 255) return [];
    out.push((sample - 128) / 128);
  }
  return out;
}

function holdPeaks(previous, bars) {
  if (!Array.isArray(previous) || previous.length !== bars.length) return bars.slice();
  try {
    return decayPeaks(previous, bars, { decay: 0.05 });
  } catch {
    return bars.slice();
  }
}

function average(values) {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
}
