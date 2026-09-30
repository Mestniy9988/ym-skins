import { applyPreview, previewSkin, restoreSession, setOriginal } from './skin-session.mjs';

export function trayMenu({ session, statusLabel } = {}) {
  const original = session?.original === true;
  const label = typeof statusLabel === 'string' && statusLabel.length > 0 && statusLabel.length <= 80
    ? statusLabel
    : 'Не проверено';
  return [
    { id: 'original', label: 'Оригинальная тема', checked: original },
    {
      id: 'skin',
      label: 'Скин',
      enabled: !original,
      skinId: original ? null : (session?.appliedSkinId || null),
    },
    { id: 'updates', label: 'Проверить обновления', enabled: true },
    { id: 'restore', label: 'Восстановить оригинал', enabled: true },
    { id: 'status', label },
    { id: 'quit', label: 'Выход', enabled: true },
  ];
}

export function applyTrayAction(session, id, choice) {
  if (id === 'original') return { session: setOriginal(session, session?.original !== true).state };
  if (id === 'restore') return { session: restoreSession() };
  if (id === 'quit') return { session, quit: true };
  if (id === 'updates') return { session, checkUpdates: true };
  if (id === 'skin') {
    if (session?.original === true) return { session, refused: 'original' };
    const previewed = previewSkin(session, choice);
    if (previewed.refused) return { session, refused: previewed.refused };
    const applied = applyPreview(previewed.state);
    return { session: applied.state, restartRequired: false };
  }
  return { session, refused: 'unknown' };
}
