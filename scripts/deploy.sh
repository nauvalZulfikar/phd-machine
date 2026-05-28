#!/usr/bin/env bash
set -euo pipefail

VPS="root@72.60.196.21"
REMOTE="/root/projects/career-ops"

echo "▶ rsync to ${VPS}:${REMOTE}"
rsync -avz --delete \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='tmp/' \
  --exclude='data/' \
  --exclude='logs/' \
  --exclude='reports/' \
  --exclude='output/' \
  --exclude='.env' \
  -e ssh ./ "${VPS}:${REMOTE}/"

echo "▶ npm install --omit=dev on VPS"
ssh "${VPS}" "cd ${REMOTE} && npm install --omit=dev"

echo "▶ pm2 startOrReload career-ops-cron"
ssh "${VPS}" "cd ${REMOTE} && pm2 startOrReload ecosystem.config.cjs --update-env"
ssh "${VPS}" "pm2 save"

echo "▶ status"
ssh "${VPS}" "pm2 describe career-ops-cron | grep -E 'status|pid|uptime' | head -5"

echo "✓ deploy done"
