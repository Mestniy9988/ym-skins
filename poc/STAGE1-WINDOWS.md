# Разбор Windows-установщика 5.121.2 без запуска

Дата: 2026-09-30. Файл скачан с `https://desktop.app.music.yandex.net/stable/Yandex_Music_x64_5.121.2.exe` и не запускался. Процесс клиента на Windows не стартовал, отладочный порт не открывался.

Установщик — NSIS. Внутри `$PLUGINSDIR/app-64.7z` лежат `Яндекс Музыка.exe` и `resources/app.asar`. Архив распакован только для чтения. Файлы установщика не переписывались.

## Что совпало с Linux-пакетом

- Имя и версия из корневого `package.json` в `app.asar`: `YandexMusic` `5.121.2`.
- SHA-256 `app.asar`: `90546e261281d3d9ec32478a910f3876ade4f657a34e16ae28bcac807dfe9fc1`. Это тот же хеш, что у Linux-пакета той же версии.

## Electron Fuses в `Яндекс Музыка.exe`

Провод версии 1. Имени `WasmTrapHandlers` в этом проводе нет.

| Fuse | Windows exe | Linux-бинарник той же версии |
|---|---|---|
| RunAsNode | включён | включён |
| EnableCookieEncryption | выключен | выключен |
| EnableNodeOptionsEnvironmentVariable | включён | включён |
| EnableNodeCliInspectArguments | включён | включён |
| EnableEmbeddedAsarIntegrityValidation | включён | выключен |
| OnlyLoadAppFromAsar | включён | выключен |
| LoadBrowserProcessSpecificV8Snapshot | выключен | выключен |
| GrantFileProtocolExtraPrivileges | включён | включён |

`EnableNodeCliInspectArguments` относится к флагу `--inspect` главного процесса. По нему нельзя решить, откроется ли отладочный порт страниц. На Windows этот порт не проверялся.

На этой Windows-сборке включена проверка целостности `app.asar` и загрузка только из архива. Патч архива для неё не выбирался и не выполнялся. Вариант А (отладочный порт на `127.0.0.1`) на Windows по-прежнему не прогонялся.

## Что не проверено

- Окно Windows-клиента не открывалось. Фон, кнопка, меню и настройки на этой сборке не смотрелись.
- Подпись установщика Authenticode не проверялась.
