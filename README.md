# Streaming Loudness Adapter Bot

Telegram bot and local CLI for preparing audio files for streaming loudness targets.

## Features

- Analyze WAV, AIFF, FLAC, and MP3 with ffmpeg loudnorm.
- Export Spotify, YouTube, Apple Music, TIDAL, Amazon Music, Deezer, SoundCloud, podcast, and safe-delivery versions.
- Generate TXT loudness reports.
- Telegram bot flow with preset buttons.
- Browser upload mode for files larger than Telegram's direct download limit.

## Requirements

- Node.js
- ffmpeg
- Telegram bot token from `@BotFather`

## Local CLI

```bash
node loudness_adapter.js "track.wav" --preset spotify
node loudness_adapter.js "track.wav" --analyze-only
```

## Web Service

```bash
node web_server.js
```

Open:

```text
http://localhost:3000
```

## Telegram Bot

PowerShell:

```powershell
$env:TELEGRAM_BOT_TOKEN="PASTE_TOKEN_HERE"
node telegram_bot.js
```

For large-file upload links:

```powershell
$env:PUBLIC_BASE_URL="https://your-public-url"
node telegram_bot.js
```

## Presets

- `spotify`: -14 LUFS, -1.0 dBTP
- `youtube`: -14 LUFS, -1.0 dBTP
- `apple`: -16 LUFS, -1.0 dBTP
- `tidal`: -14 LUFS, -1.0 dBTP
- `amazon`: -14 LUFS, -1.0 dBTP
- `deezer`: -15 LUFS, -1.0 dBTP
- `soundcloud`: -14 LUFS, -1.0 dBTP
- `podcast`: -16 LUFS, -1.0 dBTP
- `custom_safe`: -14 LUFS, -2.0 dBTP

