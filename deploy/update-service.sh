#!/usr/bin/env bash
set -euo pipefail

git pull --ff-only
systemctl restart loudness-adapter
systemctl status loudness-adapter --no-pager