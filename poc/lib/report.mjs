const STATE_RU = {
  enable: 'включён',
  disable: 'выключен',
  removed: 'снят',
  inherit: 'наследуется',
  unknown: 'неизвестное значение',
};

const FUSE_NOTE = {
  EnableNodeCliInspectArguments:
    'По документации Electron это разрешение флагов --inspect главного процесса, а не отладочный порт страниц. По одному этому fuse нельзя решить, открывается ли CDP.',
  EnableEmbeddedAsarIntegrityValidation:
    'По документации Electron это проверка целостности app.asar. Принуждается ли она в этой установке, прогон не проверял. Скрипт архив не меняет.',
  OnlyLoadAppFromAsar:
    'По документации Electron при включении грузится только app.asar. Рядом с архивом скрипт ничего не подкладывает.',
};

export function buildReport(facts = {}) {
  const lines = [
    '# Отчёт этапа 1. Пункт 3.2',
    '',
    'Инструмент неофициальный. Этот прогон не читает токены, cookies и данные аккаунта. app.asar не патчится.',
    '',
    `- Платформа прогона: ${facts.platform || 'не проверено'}`,
    '- Ожидаемая база: Windows 11 25H2, клиент 5.121.2. Номер ниже — только если он прочитан с машины.',
    `- Клиент: ${clientLine(facts)}`,
    '',
    '## 1. Способ внедрения',
    '',
    injectionSection(facts),
    '',
    '## 2. Electron Fuses',
    '',
    fuseSection(facts.fuses),
    '',
    '## 3. AnalyserNode',
    '',
    analyserSection(facts.analyser),
    '',
    '## 4. Где версия и как ловится обновление',
    '',
    versionSection(facts),
    '',
    '## 5. Подпись macOS',
    '',
    'Подпись macOS и Gatekeeper: не проверено. Этот прототип их не проверяет.',
    '',
    '## 6. Меню и блок настроек',
    '',
    menuSection(facts.menu),
    '',
    '## Фон, кнопка и перезапуск',
    '',
    surfaceSection(facts.surface),
    '',
    '## Архив',
    '',
    archiveSection(facts.asar),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function clientLine(facts) {
  const client = facts.client;
  if (!client?.exe) return 'не проверено';
  const name = client.displayName ? `${client.displayName}, ` : '';
  return `${name}${client.exe} (источник: ${client.source || 'не проверено'})`;
}

function injectionSection(facts) {
  if (facts.decision === 'not-windows') {
    return 'Клиент не запускался: скрипт работает только на Windows и здесь процесс не стартовал. Способ внедрения не проверено. Этот прогон не является проверкой.';
  }
  if (facts.decision === 'client-not-found') {
    return 'Установленный клиент не найден. Способ внедрения не проверено.';
  }
  if (facts.decision === 'ambiguous') {
    return 'Найдено несколько установок, скрипт не выбрал одну из них. Способ внедрения не проверено.';
  }
  if (facts.decision === 'already-running') {
    return 'Клиент уже был запущен. Этот процесс не закрывался и отладочный порт для него не поднимался. Способ внедрения не проверено.';
  }
  if (facts.launch?.loopback === false) {
    return 'Клиент запускался с адресом 127.0.0.1, но слушающий порт не подтверждён как только localhost. Страница не внедрялась.';
  }
  if (facts.surface?.restoredAfterReinject && facts.launch?.loopback) {
    return `На этом запуске клиент стартовал с отладочным портом ${facts.launch.port} на 127.0.0.1. Фон и кнопка менялись через CDP. Патч app.asar не выполнялся. После перезапуска тот же эффект снова ставится только повторным внедрением.`;
  }
  if (facts.decision === 'launch') {
    return 'Запуск с отладочным портом на 127.0.0.1 начинался, но эффект фона и кнопки после перезапуска не подтверждён. Способ внедрения не проверено. Патч app.asar не выполнялся.';
  }
  return 'Способ внедрения не проверено.';
}

function fuseSection(fuses) {
  if (!fuses) return 'Electron Fuses: не проверено.';
  if (!fuses.found) return 'Sentinel Electron Fuses в файле не найден. Состояние не проверено.';
  const lines = [];
  for (const wire of fuses.wires || []) {
    if (!wire.decoded) {
      lines.push(
        `Провод fuse версии ${wire.version ?? 'не проверено'} не разобран именами V1. Сырые байты оставлены без подписей.`,
      );
      continue;
    }
    for (const fuse of wire.fuses) {
      const state = STATE_RU[fuse.state] || fuse.state;
      lines.push(`- ${fuse.name}: ${state} (0x${Number(fuse.raw).toString(16)})`);
      if (FUSE_NOTE[fuse.name]) lines.push(`  ${FUSE_NOTE[fuse.name]}`);
    }
  }
  return lines.length > 0 ? lines.join('\n') : 'Electron Fuses: не проверено.';
}

function analyserSection(analyser) {
  if (!analyser) return 'Web Audio AnalyserNode: не проверено. Системный loopback в этом прототипе не проверялся.';
  const ctor = analyser.hasAnalyserNode ? 'конструктор AnalyserNode в странице есть' : 'конструктора AnalyserNode в странице нет';
  const context = analyser.hasAudioContextCtor ? 'конструктор AudioContext есть' : 'конструктора AudioContext нет';
  const live = analyser.liveContexts == null
    ? 'живые AudioContext: не проверено'
    : `живых AudioContext: ${analyser.liveContexts}`;
  const spectrum = analyser.spectrumRead
    ? 'спектр читался'
    : 'спектр не снимался';
  return `${ctor}; ${context}; ${live}; ${spectrum}.`;
}

function versionSection(facts) {
  if (!facts.versions && !facts.update) {
    return 'Где лежит номер версии и как ловится обновление: не проверено.';
  }
  const lines = [];
  if (facts.versions?.asar) {
    lines.push(`Строка version прочитана из package.json в корне app.asar: ${facts.versions.asar}.`);
  } else {
    lines.push('Строка version в корневом package.json app.asar: не проверено.');
  }
  if (facts.versions?.exe) {
    lines.push(`Версия файла exe: ${facts.versions.exe}.`);
  } else {
    lines.push('Версия файла exe: не проверено.');
  }
  if (facts.versions?.updateFeed?.url) {
    lines.push(`Рядом с клиентом указан канал обновления: ${facts.versions.updateFeed.url}.`);
  }
  if (facts.update?.status === 'no-baseline') {
    lines.push('Факт обновления не проверено: предыдущего локального снимка нет. Снимок версии и sha256 app.asar записывается, чтобы следующий запуск увидел смену строки или хеша.');
  } else if (facts.update?.status === 'unchanged') {
    lines.push('С прошлым снимком совпали и версия, и хеш app.asar. Факт обновления в этом прогоне не наблюдался.');
  } else if (facts.update?.status === 'changed') {
    lines.push('Версия или хеш app.asar отличаются от прошлого снимка. Прогон не устанавливает, обновление это или другое изменение файла.');
  } else {
    lines.push('Факт обновления: не проверено.');
  }
  return lines.join('\n');
}

function menuSection(menu) {
  if (!menu) return 'Скрытие пунктов меню и блок в настройках: не проверено.';
  const lines = [];
  if (menu.hideTried) {
    lines.push(
      menu.hideApplied && menu.hideReverted
        ? `Обратимая проба спрятала один дочерний узел навигации (узлов навигации: ${menu.navCount}) и вернула его на место.`
        : 'Проба скрытия узла навигации не подтвердила обратимый эффект.',
    );
  } else {
    lines.push('Узел навигации для пробы не найден. Скрытие пунктов меню не проверено.');
  }
  lines.push(
    menu.settingsPageOpened
      ? 'Страница настроек открывалась.'
      : 'Проверено частично: страница настроек не открывалась, встраивание блока в неё не проверено.',
  );
  if (menu.bodyInsertRemoved) {
    lines.push('В document.body узел ставится и тут же снимается. Это не раздел настроек.');
  }
  return lines.join('\n');
}

function surfaceSection(surface) {
  if (!surface) return 'Смена фона и кнопки: не проверено.';
  const lines = [
    `Фон до внедрения: ${surface.originalBackground || 'не проверено'}.`,
    `Фон после внедрения: ${surface.styledBackground || 'не проверено'}.`,
    `Кнопка до внедрения: ${surface.buttonFound ? surface.originalButton || 'не проверено' : 'не найдена, не проверено'}.`,
    `Кнопка после внедрения: ${surface.buttonFound ? surface.styledButton || 'не проверено' : 'не найдена, не проверено'}.`,
  ];
  if (surface.absentAfterRestart && surface.restoredAfterReinject) {
    lines.push('После перезапуска, до повторного внедрения, стиль в странице отсутствовал. Повторное внедрение вернуло тот же фон и ту же кнопку.');
  } else if (surface.absentAfterRestart === false) {
    lines.push('После перезапуска стиль наблюдался ещё до повторного внедрения. Причину прогон не доказывает.');
  } else {
    lines.push('Эффект после перезапуска: не проверено.');
  }
  return lines.join('\n');
}

function archiveSection(asar) {
  if (!asar?.before || !asar?.after) return 'Хеш app.asar: не проверено.';
  if (asar.before === asar.after) {
    return 'Хеш app.asar до и после совпал, файл не переписывался.';
  }
  return 'Хеши app.asar различаются. Патч этим скриптом не выполнялся; причину расхождения прогон не устанавливает.';
}
