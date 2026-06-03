# Server Deploy: Oracle Cloud Always Free

This guide deploys the Telegram loudness bot on an Ubuntu server.

## 1. Create the free VM

1. Create an Oracle Cloud account.
2. Create a Compute Instance.
3. Use an `Always Free eligible` shape.
4. Recommended MVP shape:

```text
VM.Standard.A1.Flex
1 OCPU
6 GB RAM
Ubuntu 24.04
```

Save the SSH private key and public IP.

## 2. SSH into the server

From your computer:

```bash
ssh ubuntu@YOUR_SERVER_IP
```

If Oracle gave you a private key file:

```bash
ssh -i path/to/private.key ubuntu@YOUR_SERVER_IP
```

## 3. Install dependencies

```bash
sudo apt update
sudo apt install -y git nodejs npm ffmpeg
sudo npm install -g pm2
```

Check:

```bash
node --version
ffmpeg -version
pm2 --version
```

## 4. Clone the project

```bash
git clone https://github.com/niatakishiev-max/streaming-loudness-adapter-bot.git
cd streaming-loudness-adapter-bot
```

## 5. Configure secrets

Create `.env`:

```bash
nano .env
```

Paste:

```text
TELEGRAM_BOT_TOKEN=YOUR_NEW_BOTFATHER_TOKEN
PUBLIC_BASE_URL=http://YOUR_SERVER_IP:8787
UPLOAD_PORT=8787
```

Save with `Ctrl+O`, Enter, `Ctrl+X`.

## 6. Start the bot

```bash
set -a
source .env
set +a
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

`pm2 startup` prints one extra command. Copy and run that command too.

Check logs:

```bash
pm2 logs loudness-bot
```

Expected:

```text
Telegram API token is valid: @your_bot
Upload server is running: http://YOUR_SERVER_IP:8787
Telegram bot is running. Press Ctrl+C to stop.
```

## 7. Open the upload port

In Oracle Cloud console, allow inbound TCP port `8787` for the VM.

You also may need Ubuntu firewall:

```bash
sudo ufw allow 8787/tcp
```

## 8. Test

In Telegram:

```text
/start
/upload
```

Open the upload link and send a file.

## 9. Update after code changes

On the server:

```bash
cd streaming-loudness-adapter-bot
git pull
pm2 restart loudness-bot --update-env
```

## Notes

- Do not commit `.env`.
- Do not run the same Telegram token on two machines at the same time.
- If you use Cloudflare Tunnel later, set `PUBLIC_BASE_URL` to the public HTTPS tunnel URL.

