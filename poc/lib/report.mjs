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
    ...platformLines(facts),
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
    analyserSection(facts.analyser, facts.audioGraph, facts.loopback, facts.audioChoice),
    '',
    '## 4. Где версия и как ловится обновление',
    '',
    versionSection(facts),
    '',
    '## 5. Подпись macOS',
    '',
    macSection(facts.macSign),
    '',
    '## 6. Меню и блок настроек',
    '',
    menuSection(facts.menu, facts.selectorMap, facts.selectorScan, facts.smoke),
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

function platformLines(facts) {
  if (facts.platform === 'linux') {
    return [
      '- Платформа прогона: linux. Это запуск Linux-пакета, не проверка Windows 11.',
      '- Ожидаемая база Windows 11 25H2 этим запуском не проверялась. Номер клиента ниже — только если он прочитан с этой машины.',
    ];
  }
  return [
    `- Платформа прогона: ${facts.platform || 'не проверено'}`,
    '- Ожидаемая база: Windows 11 25H2, клиент 5.121.2. Номер ниже — только если он прочитан с машины.',
  ];
}

function clientLine(facts) {
  const client = facts.client;
  if (!client?.exe) return 'не проверено';
  const name = client.displayName ? `${client.displayName}, ` : '';
  return `${name}${client.exe} (источник: ${client.source || 'не проверено'})`;
}

function injectionSection(facts) {
  if (facts.decision === 'not-windows') {
    return 'Клиент не запускался: этот скрипт стартует процесс на Windows и Linux, а здесь платформа другая. Способ внедрения не проверено. Этот прогон не является проверкой.';
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
    if (facts.launch.reason === 'timeout') {
      return 'Клиент запускался с адресом 127.0.0.1, но отладочный порт не открылся. Страница не внедрялась. Способ внедрения не проверено.';
    }
    if (facts.launch.reason === 'foreign') {
      return 'Порт на 127.0.0.1 открыл процесс не из этого запуска. Страница не внедрялась.';
    }
    if (facts.launch.reason === 'unconfirmed') {
      return 'На 127.0.0.1 открыт порт, но его процесс не сопоставлен с запущенным клиентом. Страница не внедрялась. Способ внедрения не проверено.';
    }
    if (facts.launch.reason === 'no-http') {
      return 'Порт на 127.0.0.1 слушает запущенный процесс, но отладчик не ответил. Страница не внедрялась. Способ внедрения не проверено.';
    }
    return 'Клиент запускался с адресом 127.0.0.1, но слушающий порт не подтверждён как только localhost. Страница не внедрялась.';
  }
  if (facts.surface?.restoredAfterReinject && facts.launch?.loopback) {
    const host = facts.platform === 'linux' ? 'Linux-клиент' : 'клиент';
    const lines = [
      `На этом запуске ${host} стартовал с отладочным портом ${facts.launch.port} на 127.0.0.1. Фон и кнопка менялись через CDP. Патч app.asar не выполнялся. После перезапуска тот же эффект снова ставится только повторным внедрением.`,
      'Для этого прогона выбран вариант А: протокол отладки на 127.0.0.1. Патч архива не выбран.',
    ];
    if (facts.platform === 'linux') {
      lines.push('Этот выбор сделан по Linux-пакету. Windows-сборка этим прогоном не проверялась.');
    }
    if (facts.launch.noSandbox) {
      lines.push('Флаг --no-sandbox добавлен, потому что chrome-sandbox в этом запуске без setuid. Для обычной установки он не является настройкой по умолчанию.');
    }
    if (facts.launch.gtk3) lines.push('Для окна в этом запуске добавлен --gtk-version=3.');
    return lines.join(' ');
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

function analyserSection(analyser, audioGraph, loopback, audioChoice) {
  if (!analyser && !audioGraph) {
    const base = `Web Audio AnalyserNode: не проверено. ${loopbackLine(loopback)}`;
    const choice = audioChoiceLine(audioChoice);
    return choice ? `${base} ${choice}` : base;
  }
  const lines = [];
  if (analyser) {
    const ctor = analyser.hasAnalyserNode ? 'конструктор AnalyserNode в странице есть' : 'конструктора AnalyserNode в странице нет';
    const context = analyser.hasAudioContextCtor ? 'конструктор AudioContext есть' : 'конструктора AudioContext нет';
    const live = analyser.liveContexts == null
      ? 'живые AudioContext: не проверено'
      : `живых AudioContext: ${analyser.liveContexts}`;
    lines.push(`${ctor}; ${context}; ${live}.`);
    lines.push(spectrumLine(analyser));
  } else {
    lines.push('Страница клиента не проверялась.');
  }
  const graph = graphLine(audioGraph);
  if (graph) lines.push(graph);
  lines.push(loopbackLine(loopback));
  const choice = audioChoiceLine(audioChoice);
  if (choice) lines.push(choice);
  return lines.join(' ');
}

function audioChoiceLine(audioChoice) {
  if (audioChoice?.source === 'analyser') return 'Источник визуализатора: AnalyserNode с живым спектром.';
  if (audioChoice?.source === 'loopback') return 'Источник визуализатора: системный loopback.';
  if (audioChoice?.source === 'decorative') {
    return 'Источник визуализатора: декоративная анимация. Живого спектра и проверенного loopback нет.';
  }
  return '';
}

function loopbackLine(loopback) {
  if (loopback?.status === 'no-device') return 'Системный loopback: устройство вывода не найдено.';
  if (loopback?.status === 'present-untested') return 'Устройство вывода есть. Захват loopback не выполнялся.';
  return 'Системный loopback не проверялся.';
}

function spectrumLine(analyser) {
  if (analyser.spectrumRead) {
    const peak = Number.isInteger(analyser.spectrumPeak) && analyser.spectrumPeak > 0 && analyser.spectrumPeak <= 255
      ? ` Пик отсчёта ${analyser.spectrumPeak}.`
      : '';
    return `Спектр читался у существующего AnalyserNode.${peak}`;
  }
  if (analyser.analyserCount === 0) {
    return 'Готовых AnalyserNode в странице нет. Спектр воспроизведения не снят.';
  }
  if (Number.isInteger(analyser.analyserCount) && analyser.analyserCount > 0) {
    const running = Number.isInteger(analyser.contextRunning) ? `, контекст running: ${analyser.contextRunning}` : '';
    const fft = Number.isInteger(analyser.fftSize) && analyser.fftSize > 0 && analyser.fftSize <= 32768
      ? `, fftSize ${analyser.fftSize}`
      : '';
    return `AnalyserNode в странице: ${analyser.analyserCount}${running}${fft}. Отсчёты нулевые, спектр воспроизведения не снят.`;
  }
  return 'спектр не снимался.';
}

function graphLine(audioGraph) {
  if (!audioGraph) return '';
  if (audioGraph.complete) {
    return 'В app.asar есть вызовы createMediaElementSource, createAnalyser и getByteFrequencyData. Это граф страницы вокруг элемента воспроизведения, не системный loopback.';
  }
  const missing = [];
  if (!audioGraph.mediaElement) missing.push('createMediaElementSource');
  if (!audioGraph.analyser) missing.push('createAnalyser');
  if (!audioGraph.frequency) missing.push('getByteFrequencyData');
  return `В app.asar не найдены вызовы: ${missing.join(', ')}.`;
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
  const policy = updateDecisionLine(facts.updateDecision);
  if (policy) lines.push(policy);
  const gate = injectionLine(facts.injection);
  if (gate) lines.push(gate);
  return lines.join('\n');
}

function updateDecisionLine(decision) {
  if (decision?.action === 'keep') return 'Политика обновления: снимок не изменился, карта не переключается.';
  if (decision?.action === 'apply-current-map') {
    return 'Политика обновления: есть карта этой версии, её нужно проверить smoke-тестом.';
  }
  if (decision?.action === 'apply-previous-map') {
    return 'Политика обновления: карты этой версии нет, пробуется карта предыдущей версии, её smoke уже проходил.';
  }
  if (decision?.action === 'awaiting-map') return 'Политика обновления: карты нет, полный скин ждёт карту.';
  return '';
}

function injectionLine(injection) {
  if (injection?.reason === 'clear') return 'Аварийный выключатель эту версию не блокирует.';
  if (injection?.reason === 'kill-switch') return 'Аварийный выключатель запрещает внедрение для этой версии.';
  if (injection?.reason === 'bad-flags') return 'Флаг каталога повреждён, внедрение запрещено.';
  return '';
}

function macSection(macSign) {
  const unread = 'Подпись macOS и Gatekeeper: не проверено. Этот прототип их не проверяет.';
  if (!macSign || macSign.status === 'not-checked') return unread;
  if (macSign.status === 'unsigned') {
    return 'Подпись macOS: объект не подписан. Это разбор текста codesign, не прогон на macOS.';
  }
  if (macSign.status === 'rejected') {
    return 'Gatekeeper по тексту spctl отклонил объект. Это не прогон на macOS.';
  }
  if (macSign.status === 'accepted') {
    const authority = safeAuthority(macSign.authority);
    const named = authority ? ` Подпись: ${authority}.` : '';
    return `Подпись и Gatekeeper по тексту приняты.${named} Это разбор текста codesign, не прогон на macOS.`;
  }
  if (macSign.status === 'adhoc') {
    return 'Подпись ad hoc, Gatekeeper по тексту принял. Это разбор текста codesign, не прогон на macOS.';
  }
  return 'Текст подписи macOS не разобран. Прогон на macOS не выполнялся.';
}

function safeAuthority(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/[^\w .+-]/g, '').slice(0, 80).trim();
}

function menuSection(menu, selectorMap, selectorScan, smoke) {
  const mapVersion = safeMapVersion(selectorMap);
  if (!menu) {
    const scanLine = formatSelectorScan(selectorScan);
    const base = mapVersion
      ? `Карта селекторов ${mapVersion} есть. Страница меню не проверялась.`
      : 'Скрытие пунктов меню и блок в настройках: не проверено.';
    return scanLine ? `${base}\n${scanLine}` : base;
  }
  const lines = [];
  if (menu.regionScreen) {
    lines.push('Страница показала, что сервис недоступен в этом регионе. Это не плеер и не настройки.');
  }
  if (menu.navbarFound === true) {
    lines.push('Боковая навигация с data-test-id NAVBAR на странице есть.');
  } else if (menu.navbarFound === false) {
    lines.push('Боковая навигация NAVBAR на странице не найдена.');
  }
  if (menu.playerBarFound === true) {
    lines.push('Панель плеера PLAYERBAR_DESKTOP на странице есть.');
  } else if (menu.playerBarFound === false) {
    lines.push('Панель плеера PLAYERBAR_DESKTOP на странице не найдена.');
  }
  if (menu.playerPlayFound === true) {
    lines.push('Кнопка PLAY_BUTTON на странице есть.');
  } else if (menu.playerPlayFound === false) {
    lines.push('Кнопка PLAY_BUTTON на странице не найдена.');
  }
  if (menu.hideTried) {
    const named = typeof menu.hiddenTestId === 'string' && /^[A-Z0-9_]{1,80}$/.test(menu.hiddenTestId)
      ? menu.hiddenTestId
      : '';
    if (menu.hideApplied && menu.hideReverted && named) {
      lines.push(`Обратимая проба спрятала пункт ${named} и вернула его на место.`);
    } else if (menu.hideApplied && menu.hideReverted) {
      lines.push(`Обратимая проба спрятала один дочерний узел навигации (узлов навигации: ${menu.navCount}) и вернула его на место.`);
    } else {
      lines.push('Проба скрытия узла навигации не подтвердила обратимый эффект.');
    }
  } else {
    lines.push('Узел навигации для пробы не найден. Скрытие пунктов меню не проверено.');
  }
  if (mapVersion && menu.navbarFound === false) {
    lines.push(`Карта селекторов ${mapVersion} задаёт NAVBAR и скрываемые пункты. На этой странице их нет.`);
  }
  if (Number.isInteger(menu.pageCount)) {
    lines.push(menu.pageCount === 1 ? 'Отладчик отдал одну страницу.' : `Отладчик отдал страниц: ${menu.pageCount}.`);
  }
  if (menu.settingsListFound) {
    if (menu.appearanceInserted === true && menu.appearanceFirst === true && menu.appearanceRemoved === true) {
      lines.push('Обратимая проба поставила блок «Оформление» первым в SETTINGS_LIST и сразу сняла его.');
    } else if (menu.appearanceInserted === true && menu.appearanceRemoved === false) {
      lines.push('Проба поставила блок «Оформление» в SETTINGS_LIST и не сняла его.');
    } else if (menu.appearanceInserted === false) {
      lines.push('На странице есть список настроек SETTINGS_LIST. Блок «Оформление» в начало списка не встал.');
    } else {
      lines.push('На странице есть список настроек SETTINGS_LIST. Блок «Оформление» этим прогоном не встраивался.');
    }
  } else if (menu.settingsPageOpened) {
    lines.push('Страница настроек открывалась. Блок «Оформление» этим прогоном не встраивался.');
  } else if (menu.settingsListFound === false) {
    lines.push('Список настроек SETTINGS_LIST не найден. Встраивание блока «Оформление» не проверено.');
  } else {
    lines.push('Проверено частично: страница настроек не открывалась, встраивание блока в неё не проверено.');
  }
  if (menu.bodyInsertRemoved) {
    lines.push('В document.body узел ставится и тут же снимается. Это не раздел настроек.');
  }
  const scanLine = formatSelectorScan(selectorScan);
  if (scanLine) lines.push(scanLine);
  const smokeLine = formatSmoke(smoke);
  if (smokeLine) lines.push(smokeLine);
  const stampLine = formatStamp(menu);
  if (stampLine) lines.push(stampLine);
  return lines.join('\n');
}

function formatStamp(menu) {
  if (!Number.isInteger(menu?.stampApplied) || !Number.isInteger(menu?.stampCleared)) return '';
  if (menu.stampApplied > 0 && menu.stampCleared === menu.stampApplied) {
    return `Обратимая проба поставила метки data-yms на узлах: ${menu.stampApplied}, и сразу сняла их.`;
  }
  if (menu.stampApplied === 0 && menu.stampCleared === 0) {
    return 'Узлы для меток data-yms на странице не найдены. Метки не ставились.';
  }
  return 'Проба меток data-yms не подтвердила, что все поставленные метки сняты.';
}

function formatSmoke(smoke) {
  if (smoke?.status === 'compatible') return 'Smoke критичных элементов прошёл: полный режим допустим.';
  if (smoke?.status === 'no-map') return 'Карты селекторов для открытой страницы нет. Полный скин не применяется.';
  if (smoke?.status !== 'safe-mode') return '';
  const missing = (smoke.missing || []).filter((name) => typeof name === 'string' && /^[a-z0-9.-]+$/i.test(name));
  const listed = missing.length > 0 ? ` Нет: ${missing.join(', ')}.` : '';
  return `Smoke критичных элементов не прошёл.${listed} Минималистичное меню не применяется, остаётся безопасный режим.`;
}

function formatSelectorScan(scan) {
  if (!scan || !Array.isArray(scan.found) || !Array.isArray(scan.missing)) return '';
  const ok = (id) => typeof id === 'string' && /^[A-Z0-9_]{1,80}$/.test(id);
  const found = scan.found.filter(ok);
  const missing = scan.missing.filter(ok);
  if (found.length + missing.length === 0) return '';
  if (missing.length === 0) return `В app.asar есть отдельные строки всех ${found.length} id карты селекторов.`;
  return `В app.asar нет id карты: ${missing.join(', ')}. Найдены: ${found.length}.`;
}

function safeMapVersion(selectorMap) {
  const version = selectorMap?.ymVersion;
  return typeof version === 'string' && /^\d+\.\d+\.\d+$/.test(version) ? version : '';
}

function surfaceSection(surface) {
  if (!surface) return 'Смена фона и кнопки: не проверено.';
  const lines = [
    `Фон до внедрения: ${surface.originalBackground || 'не проверено'}.`,
    `Фон после внедрения: ${surface.styledBackground || 'не проверено'}.`,
    `Кнопка до внедрения: ${surface.buttonFound ? surface.originalButton || 'не проверено' : 'не найдена, не проверено'}.`,
    `Кнопка после внедрения: ${surface.buttonFound ? surface.styledButton || 'не проверено' : 'не найдена, не проверено'}.`,
  ];
  if (typeof surface.buttonTestId === 'string' && /^[A-Za-z0-9_.:-]{1,80}$/.test(surface.buttonTestId)) {
    lines.push(`Кнопка выбрана по data-test-id: ${surface.buttonTestId}.`);
  }
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
