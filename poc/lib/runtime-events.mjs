function copyTrack(track) {
  const source = track !== null && typeof track === 'object' ? track : {};
  return {
    title: typeof source.title === 'string' ? source.title : '',
    artist: typeof source.artist === 'string' ? source.artist : '',
  };
}

function isValidSpectrum(bins) {
  if (!Array.isArray(bins) || bins.length > 64) return false;
  for (let index = 0; index < bins.length; index += 1) {
    const bin = bins[index];
    if (typeof bin !== 'number' || !Number.isFinite(bin) || bin < 0 || bin > 255) {
      return false;
    }
  }
  return true;
}

function subscribe(listeners, listener) {
  if (typeof listener !== 'function') {
    throw new TypeError('listener must be a function');
  }
  const entry = { listener };
  listeners.push(entry);
  return () => {
    const index = listeners.indexOf(entry);
    if (index !== -1) listeners.splice(index, 1);
  };
}

function emit(listeners, payload) {
  for (const entry of listeners.slice()) {
    try {
      entry.listener(payload);
    } catch {
      // A throwing listener must not stop the later ones.
    }
  }
}

export function createRuntime() {
  const trackListeners = [];
  const playListeners = [];
  let spectrum = null;

  return {
    onTrackChange(listener) {
      return subscribe(trackListeners, listener);
    },
    onPlayStateChange(listener) {
      return subscribe(playListeners, listener);
    },
    getSpectrum() {
      return spectrum === null ? [] : spectrum.slice();
    },
    notifyTrack(track) {
      const copy = copyTrack(track);
      emit(trackListeners, copy);
    },
    notifyPlay(playing) {
      emit(playListeners, playing === true);
    },
    notifySpectrum(bins) {
      if (!isValidSpectrum(bins)) return;
      spectrum = bins.slice();
    },
  };
}
