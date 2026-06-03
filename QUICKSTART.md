# Quickstart

## 1. Проверить окружение

```bash
npm run check
```

Если PowerShell ругается на `npm.ps1`, используй прямую команду:

```bash
node loudness_adapter.js --check
```

Сейчас для обработки нужен `ffmpeg`. Если команда покажет `ffmpeg: not found`, сначала установи ffmpeg и добавь его в `PATH`.

## 2. Запустить первый тест

Положи WAV или AIFF файл в папку проекта и выполни:

```bash
node loudness_adapter.js input.wav --preset spotify
```

Или:

```bash
npm run adapt -- input.wav --preset youtube
```

Если `npm` заблокирован политикой PowerShell, используй только вариант с `node`.

## 3. Что получится

Скрипт создаст файл:

```text
input_spotify.wav
```

И напечатает отчет:

```text
Integrated LUFS
True Peak dBTP
LRA
Target preset
Output file
```

## 4. Доступные пресеты

```text
spotify  -14 LUFS, -1.0 dBTP
youtube  -14 LUFS, -1.0 dBTP
apple    -16 LUFS, -1.0 dBTP
hiphop   -10 LUFS, -1.0 dBTP, gentle EQ cleanup
```

## Hip-Hop Master test

```bash
node loudness_adapter.js "Flight to Tokyo.wav" --preset hiphop
```

This preset adds a simple mastering chain before loudness normalization:

- sub cleanup below 28 Hz;
- small mud cut around 250-350 Hz;
- gentle high-frequency control around 8.5 kHz;
- low-pass safety around 19 kHz;
- louder -10 LUFS target with -1.0 dBTP ceiling.

## Следующая задача

После проверки на реальном файле нужно:

1. сохранить отчет в `.txt`;
2. добавить отдельную команду `--analyze-only`;
3. проверить результат на нескольких треках;
4. только потом оборачивать это в Telegram-бота.
