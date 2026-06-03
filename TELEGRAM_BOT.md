# Telegram Bot MVP

## 1. Создать бота

1. Открой Telegram.
2. Найди `@BotFather`.
3. Отправь:

```text
/newbot
```

4. Задай имя и username.
5. BotFather выдаст token вида:

```text
1234567890:ABCDEF...
```

## 2. Запустить локально

В PowerShell:

```powershell
cd C:\Users\djnizami\Documents\Codex\2026-05-28\daw-wav-aiff-mvp-loudness-10s
$env:TELEGRAM_BOT_TOKEN="PASTE_TOKEN_HERE"
node telegram_bot.js
```

Если все нормально, увидишь:

```text
Telegram bot is running. Press Ctrl+C to stop.
```

## 3. Как тестировать

1. Открой своего бота в Telegram.
2. Нажми Start.
3. Отправь WAV, AIFF или MP3 как файл.
4. Бот покажет анализ:
   - LUFS
   - True Peak
   - LRA
5. Выбери пресет:
   - Spotify
   - YouTube
   - Apple Music
6. Бот отправит:
   - обработанный WAV
   - TXT-отчет

## 4. Большие файлы

Telegram Bot API не дает обычному боту скачать файл больше примерно 20 MB через `getFile`. Поэтому в MVP есть отдельный web upload.

В чате с ботом отправь:

```text
/upload
```

Бот даст ссылку вида:

```text
http://localhost:8787/upload/...
```

Открой ее в браузере на этом же компьютере, загрузи большой WAV/AIFF/FLAC/MP3 и вернись в Telegram. Бот пришлет анализ и кнопки пресетов.

## 5. Дать upload другим людям

`localhost` работает только на твоем компьютере. Чтобы другие люди могли открыть upload-ссылку, нужен публичный tunnel URL.

Схема:

```text
интернет -> tunnel URL -> твой localhost:8787 -> бот
```

После запуска tunnel укажи публичный адрес при запуске бота:

```powershell
$env:TELEGRAM_BOT_TOKEN="PASTE_TOKEN_HERE"
$env:PUBLIC_BASE_URL="https://your-public-tunnel-url"
node telegram_bot.js
```

Теперь команда `/upload` будет выдавать публичную ссылку.

## Важно для MVP

Обычная отправка файла в Telegram подходит для файлов до 20 MB. Для больших файлов используй `/upload`.
