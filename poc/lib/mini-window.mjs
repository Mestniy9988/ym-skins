const WIDTH = 275;
const HEIGHT = 116;
const SHADE = 14;

export function createMiniWindow() {
  return { open: false, scale: 1, shade: false, alwaysOnTop: false, edge: null, x: 0, y: 0 };
}

export function openMini(state) {
  return { ...state, open: true };
}

export function closeMini(state) {
  return { ...state, open: false, shade: false };
}

export function setScale(state, scale) {
  if (scale !== 1 && scale !== 2) return { state, refused: 'scale' };
  return { state: { ...state, scale }, refused: null };
}

export function toggleShade(state) {
  if (state?.open !== true) return { state, refused: 'closed' };
  return { state: { ...state, shade: state.shade !== true }, refused: null };
}

export function setAlwaysOnTop(state, on) {
  return { ...state, alwaysOnTop: on === true };
}

export function snapToEdge(state, edge) {
  if (edge !== null && edge !== 'left' && edge !== 'right' && edge !== 'top' && edge !== 'bottom') {
    return { state, refused: 'edge' };
  }
  return { state: { ...state, edge }, refused: null };
}

export function dragMini(state, dx, dy) {
  if (typeof dx !== 'number' || typeof dy !== 'number' || !Number.isFinite(dx) || !Number.isFinite(dy)) {
    return { state, refused: 'delta' };
  }
  return { state: { ...state, edge: null, x: state.x + dx, y: state.y + dy }, refused: null };
}

export function windowSize(state) {
  const scale = state?.scale === 2 ? 2 : 1;
  return {
    width: WIDTH * scale,
    height: (state?.shade === true ? SHADE : HEIGHT) * scale,
  };
}
