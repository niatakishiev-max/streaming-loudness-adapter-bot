# Loudness Adapter

Free web tool for creating streaming-ready WAV delivery versions. Upload an audio file, select a destination platform, and download a normalized 24-bit WAV plus a short TXT report.

Created by [DJ Nizami](https://djnizami.ru) for producers and independent artists who already have a mix or master and need a safer delivery version for streaming.

## What it does

- Accepts WAV, AIFF, FLAC, and MP3 files up to 100 MB.
- Measures integrated loudness (LUFS), true peak (dBTP), and loudness range (LRA).
- Renders a 48 kHz, 24-bit WAV using FFmpeg's `loudnorm` filter.
- Provides presets for YouTube, Spotify, Apple Music, TIDAL, Amazon Music, Deezer, SoundCloud, Podcast / Speech, and Safe Delivery.
- Produces a downloadable TXT report with input and output loudness measurements.

This is a delivery adapter, not creative mastering software. It does not add genre EQ, compression, stereo widening, or AI mastering decisions.

## Workflow

1. Upload audio.
2. Review the input loudness analysis.
3. Choose a platform target.
4. Download the processed WAV and report.

## Platform presets

| Platform | Target | True peak ceiling |
| --- | ---: | ---: |
| YouTube | -14 LUFS | -1.0 dBTP |
| Spotify | -14 LUFS | -1.0 dBTP |
| Apple Music | -16 LUFS | -1.0 dBTP |
| TIDAL | -14 LUFS | -1.0 dBTP |
| Amazon Music | -14 LUFS | -1.0 dBTP |
| Deezer | -15 LUFS | -1.0 dBTP |
| SoundCloud | -14 LUFS | -1.0 dBTP |
| Podcast / Speech | -16 LUFS | -1.0 dBTP |
| Safe Delivery | -14 LUFS | -2.0 dBTP |

Platform behavior can change, and loudness normalization is not a replacement for listening and quality control before release.

## Privacy and retention

The service has no user accounts and no audio library. Files are stored only in a temporary job folder while they are being processed:

- the original upload is deleted immediately after a successful render;
- the generated WAV and report are deleted after 20 minutes of inactivity;
- unfinished uploads are deleted after 30 minutes.

No database is used.

## Stack

- **Backend:** Node.js using the built-in `http` module
- **Audio engine:** FFmpeg `loudnorm`
- **Frontend:** semantic HTML, vanilla JavaScript, CSS
- **Deployment:** Ubuntu, `systemd`, Nginx and Let's Encrypt recommended for the production domain
- **Source control:** Git and GitHub

## Project structure

```text
public/                 Browser interface
web_server.js           HTTP API, uploads, downloads, cleanup
loudness_adapter.js     FFmpeg analysis and rendering engine
deploy/                 systemd install and update scripts
telegram_bot.js         Early Telegram MVP, not the primary product
```

## Run locally

### Requirements

- Node.js 18 or newer
- FFmpeg available in `PATH`

Check FFmpeg:

```bash
ffmpeg -version
```

Start the service:

```bash
git clone https://github.com/niatakishiev-max/streaming-loudness-adapter-bot.git
cd streaming-loudness-adapter-bot
npm run web
```

Open [http://localhost:3000](http://localhost:3000).

## Command-line mode

The processing engine can also be used without the browser interface:

```bash
node loudness_adapter.js "track.wav" --analyze-only
node loudness_adapter.js "track.wav" --preset spotify
node loudness_adapter.js "track.wav" --preset apple --out "track_apple.wav"
```

## Deploy to Ubuntu

Install the prerequisites and clone the project:

```bash
apt update
apt install -y nodejs npm ffmpeg git
git clone https://github.com/niatakishiev-max/streaming-loudness-adapter-bot.git
cd streaming-loudness-adapter-bot
```

Install it as a persistent service:

```bash
bash deploy/install-service.sh
```

The web service listens on port `3000`. Put Nginx in front of it and issue a Let's Encrypt certificate after a domain points to the server.

To update an existing deployment:

```bash
cd /path/to/streaming-loudness-adapter-bot
git pull
systemctl restart loudness-adapter
```

## Status

The web MVP is functional and deployed for testing. The next product stage is a custom domain with HTTPS, then feedback from real producers before expanding the audio workflow.

## License

Private project. All rights reserved by DJ Nizami.
