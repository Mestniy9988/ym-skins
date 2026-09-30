export function compatibilityStatus({ smoke, updateDecision, injection } = {}) {
  if (injection && injection.allowed === false) {
    return { code: 'blocked', label: 'Внедрение выключено' };
  }
  if (updateDecision?.action === 'awaiting-map') {
    return { code: 'waiting', label: 'Ожидается обновление' };
  }
  if (smoke?.status === 'safe-mode' || smoke?.status === 'no-map') {
    return { code: 'safe', label: 'Безопасный режим' };
  }
  if (smoke?.status === 'compatible') {
    return { code: 'compatible', label: 'Совместимо' };
  }
  return { code: 'unknown', label: 'Не проверено' };
}
