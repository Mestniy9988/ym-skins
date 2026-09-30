export function chooseAudioSource({ analyserState, loopbackStatus } = {}) {
  if (analyserState === 'live') return { source: 'analyser' };
  if (loopbackStatus === 'live') return { source: 'loopback' };
  return { source: 'decorative' };
}
