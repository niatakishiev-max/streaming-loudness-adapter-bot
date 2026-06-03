# Free Hosting Options

## Best Next Option: Google Cloud Always Free VM

Use this if you can register a Google Cloud account.

Google Cloud Free Tier includes one small `e2-micro` VM equivalent per month in eligible US regions. It is weaker than Oracle A1, but can run the Telegram bot MVP for light testing.

Recommended MVP settings:

```text
OS: Ubuntu 24.04
Machine type: e2-micro
Region: us-central1, us-east1, or us-west1
Boot disk: smallest practical Ubuntu disk
```

Server setup:

```bash
sudo apt update
sudo apt install -y git nodejs npm ffmpeg
sudo npm install -g pm2
git clone https://github.com/niatakishiev-max/streaming-loudness-adapter-bot.git
cd streaming-loudness-adapter-bot
nano .env
```

`.env`:

```text
TELEGRAM_BOT_TOKEN=YOUR_NEW_BOTFATHER_TOKEN
PUBLIC_BASE_URL=http://YOUR_SERVER_IP:8787
UPLOAD_PORT=8787
```

Start:

```bash
set -a
source .env
set +a
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Open port `8787` in Google Cloud firewall if you want browser uploads.

## Temporary Free Option: Local PC + Cloudflare Tunnel

Use this if you cannot register any cloud VM yet.

Pros:

- free;
- no server account needed;
- works for showing the bot to other users.

Cons:

- your computer must stay on;
- terminal must keep running;
- not production.

Run bot locally:

```powershell
cd C:\Users\djnizami\Documents\Codex\2026-05-28\daw-wav-aiff-mvp-loudness-10s
$env:TELEGRAM_BOT_TOKEN="YOUR_TOKEN"
node telegram_bot.js
```

Run Cloudflare Tunnel to expose upload port:

```powershell
cloudflared tunnel --url http://localhost:8787
```

Then restart bot with:

```powershell
$env:PUBLIC_BASE_URL="https://YOUR_TRYCLOUDFLARE_URL"
node telegram_bot.js
```

## Not Ideal For This Bot

### Render Free

Free web services spin down after idle time, so Telegram polling can stop responding.

### Koyeb Free

Free web services can scale down to zero after no inbound traffic. It may work only after converting the bot from polling to webhook mode, and resources are tight for audio processing.

### Fly.io

Good platform, but not a clear always-free option for new users. Treat as low-cost, not free.

## Practical Recommendation

1. Try Google Cloud Always Free.
2. If registration fails, use local PC + Cloudflare Tunnel for test users.
3. If people like the product, move to a cheap VPS instead of fighting free-tier limits.

