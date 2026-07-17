#!/usr/bin/env bash
set -euo pipefail

app_dir="$(cd "$(dirname "$0")/.." && pwd)"
node_path="$(command -v node)"

cat > /etc/systemd/system/loudness-adapter.service <<EOF
[Unit]
Description=Loudness Adapter web service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${app_dir}
Environment=PORT=3000
ExecStart=${node_path} ${app_dir}/web_server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now loudness-adapter
systemctl status loudness-adapter --no-pager