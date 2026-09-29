# Прогон этапа 1 на официальном клиенте 5.121.2

Дата: 2026-09-29. Машина: Ubuntu 24.04, не Windows. Пакет скачан с `https://desktop.app.music.yandex.net/stable/Yandex_Music_amd64_5.121.2.deb` и распакован, в систему не устанавливался. В аккаунт скрипт не входил. `app.asar` не менялся.

Ниже первый ручной прогон тех же разборов Fuses, версии и функций страницы. `node probe.mjs` после этого научился сам запускать Linux-клиент из `/opt` или `~/.local/opt`. Результат этого скрипта дописывается отдельно и не подменяет проверку Windows.

Окно показало экран «Yandex Music is currently not available in your region». Это не плеер и не страница настроек.

## Что подтвердилось

- Имя и версия из корневого `package.json` в `app.asar`: `YandexMusic` `5.121.2`.
- Строка приложения: Electron 38.2.2, Chrome 140.0.7339.133.
- Канал обновления в `resources/app-update.yml`: `https://desktop.app.music.yandex.net/stable/`.
- Отладочный порт слушал только `127.0.0.1`. Фон страницы стал `rgb(58, 24, 72)`, кнопка входа — `rgb(232, 255, 71)`.
- Процесс был завершён и запущен снова. До повторного внедрения стиль в странице отсутствовал, фон был `rgb(245, 245, 245)`. Повторное внедрение вернуло те же цвета.
- SHA-256 `app.asar` до и после: `90546e261281d3d9ec32478a910f3876ade4f657a34e16ae28bcac807dfe9fc1`.

## Electron Fuses

Провод версии 1, длина 8. Имени `WasmTrapHandlers` в этом проводе нет.

| Fuse | Состояние |
|---|---|
| RunAsNode | включён |
| EnableCookieEncryption | выключен |
| EnableNodeOptionsEnvironmentVariable | включён |
| EnableNodeCliInspectArguments | включён |
| EnableEmbeddedAsarIntegrityValidation | выключен |
| OnlyLoadAppFromAsar | выключен |
| LoadBrowserProcessSpecificV8Snapshot | выключен |
| GrantFileProtocolExtraPrivileges | включён |

`EnableNodeCliInspectArguments` по документации Electron относится к флагу `--inspect` главного процесса. Сам по себе он не доказывает отладочный порт страниц. Порт страниц в этом прогоне открылся.

Проверка целостности архива в этом пакете выключена. Скрипт архив всё равно не патчил.

## Что не проверено

- Windows-сборка не запускалась. В `download.json` для той же версии указан `Yandex_Music_x64_5.121.2.exe`.
- Подпись macOS и Gatekeeper не проверялись.
- Боковое меню и страница настроек на этом экране не найдены. Встраивание блока «Оформление» не проверялось.
- Конструкторы `AudioContext` и `AnalyserNode` в странице есть, живых `AudioContext` было 3. Спектр не снимался. Системный loopback не проверялся.

В этом контейнере процесс стартовал с `--gtk-version=3` и `--no-sandbox`: файл `chrome-sandbox` в пакете без setuid, без этого флага окно здесь не открылось. `probe.mjs` добавляет `--no-sandbox` только когда у `chrome-sandbox` нет setuid, и добавляет `--gtk-version=3` на Linux. Для обычной установки с setuid `--no-sandbox` не ставится.
