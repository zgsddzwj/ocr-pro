#!/bin/bash
# 隧道守护包装：运行 cloudflared；退出后等待 5 分钟再重试，避免触发 Cloudflare 限流(429)
DIR="$(cd "$(dirname "$0")" && pwd)"
LOG="$DIR/../platform/backend/data/tunnel.log"
while true; do
  "$DIR/cloudflared" tunnel --url http://127.0.0.1:8000 --protocol http2 >> "$LOG" 2>&1
  echo "[$(date '+%F %T')] 隧道进程退出，300 秒后自动重试" >> "$LOG"
  sleep 300
done
