const ID = /^[a-z0-9-]{1,40}$/;

function normalizeId(value) {
  return typeof value === 'string' && ID.test(value) ? value : null;
}

function assertState(state) {
  if (state === null || typeof state !== 'object') {
    throw new TypeError('state must be an object');
  }
}

export function createThemeState({ skinId, themeId } = {}) {
  return {
    original: false,
    skinId: normalizeId(skinId),
    themeId: normalizeId(themeId),
    rememberedSkinId: null,
    rememberedThemeId: null,
  };
}

export function enableOriginal(state) {
  assertState(state);
  if (state.original === true) {
    return {
      original: true,
      skinId: null,
      themeId: null,
      rememberedSkinId: state.rememberedSkinId ?? null,
      rememberedThemeId: state.rememberedThemeId ?? null,
    };
  }
  return {
    original: true,
    skinId: null,
    themeId: null,
    rememberedSkinId: state.skinId ?? null,
    rememberedThemeId: state.themeId ?? null,
  };
}

export function disableOriginal(state) {
  assertState(state);
  if (state.original === true) {
    return {
      original: false,
      skinId: state.rememberedSkinId ?? null,
      themeId: state.rememberedThemeId ?? null,
      rememberedSkinId: null,
      rememberedThemeId: null,
    };
  }
  return {
    original: false,
    skinId: state.skinId ?? null,
    themeId: state.themeId ?? null,
    rememberedSkinId: null,
    rememberedThemeId: null,
  };
}
