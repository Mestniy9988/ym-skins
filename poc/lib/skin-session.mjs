import { createThemeState, disableOriginal, enableOriginal } from './original-theme.mjs';

const ID = /^[a-z0-9-]{1,40}$/;

function normalizeId(value) {
  return typeof value === 'string' && ID.test(value) ? value : null;
}

function themeOf(state) {
  return {
    original: state.original === true,
    skinId: state.appliedSkinId ?? null,
    themeId: state.appliedThemeId ?? null,
    rememberedSkinId: state.rememberedSkinId ?? null,
    rememberedThemeId: state.rememberedThemeId ?? null,
  };
}

function sessionFrom(theme, preview = {}) {
  return {
    original: theme.original === true,
    appliedSkinId: theme.skinId ?? null,
    appliedThemeId: theme.themeId ?? null,
    rememberedSkinId: theme.rememberedSkinId ?? null,
    rememberedThemeId: theme.rememberedThemeId ?? null,
    previewSkinId: preview.previewSkinId ?? null,
    previewThemeId: preview.previewThemeId ?? null,
  };
}

export function createSkinSession({ skinId, themeId } = {}) {
  return sessionFrom(createThemeState({ skinId, themeId }));
}

export function previewSkin(state, choice = {}) {
  if (state?.original === true) return { state, refused: 'original' };
  const skinId = normalizeId(choice.skinId);
  const themeId = normalizeId(choice.themeId);
  if (!skinId || !themeId) return { state, refused: 'id' };
  return {
    state: { ...state, previewSkinId: skinId, previewThemeId: themeId },
    refused: null,
  };
}

export function applyPreview(state) {
  if (state?.original === true) return { state, refused: 'original', restartRequired: false };
  if (!state?.previewSkinId || !state?.previewThemeId) {
    return { state, refused: 'no-preview', restartRequired: false };
  }
  const alreadyApplied = state.appliedSkinId === state.previewSkinId
    && state.appliedThemeId === state.previewThemeId;
  return {
    state: {
      ...state,
      appliedSkinId: state.previewSkinId,
      appliedThemeId: state.previewThemeId,
      previewSkinId: null,
      previewThemeId: null,
    },
    refused: null,
    alreadyApplied,
    restartRequired: false,
  };
}

export function applyButton(state) {
  if (state?.original === true) return 'disabled';
  const previewing = Boolean(state?.previewSkinId);
  const same = previewing
    && state.previewSkinId === state.appliedSkinId
    && state.previewThemeId === state.appliedThemeId;
  if (previewing && !same) return 'apply';
  if (state?.appliedSkinId) return 'applied';
  return 'apply';
}

export function setOriginal(state, enabled) {
  const theme = enabled === true ? enableOriginal(themeOf(state)) : disableOriginal(themeOf(state));
  return { state: sessionFrom(theme) };
}

export function restoreSession() {
  return createSkinSession();
}
