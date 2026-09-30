function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function classifySpectrum(bins) {
  if (!Array.isArray(bins) || bins.length === 0 || bins.some((bin) => !isFiniteNumber(bin) || bin < 0)) {
    return { state: 'unavailable', peak: null };
  }
  if (bins.every((bin) => bin === 0)) {
    return { state: 'silent', peak: 0 };
  }
  return { state: 'live', peak: Math.max(...bins) };
}

export function decayPeaks(peaks, bins, options = {}) {
  const decay = options.decay === undefined ? 1 : options.decay;
  if (!isFiniteNumber(decay) || decay < 0) {
    throw new TypeError('decay must be a finite number >= 0');
  }
  if (!Array.isArray(peaks) || !Array.isArray(bins) || peaks.length !== bins.length) {
    throw new TypeError('peaks and bins must be arrays of the same length');
  }
  if (peaks.some((value) => !isFiniteNumber(value)) || bins.some((value) => !isFiniteNumber(value))) {
    throw new TypeError('peaks and bins must contain finite numbers');
  }
  return peaks.map((peak, index) => Math.max(bins[index], peak - decay));
}
