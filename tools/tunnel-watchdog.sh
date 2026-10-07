#!/bin/bash
# 隧道看门狗：探测公网地址失效时自动重启隧道（由 launchd 每 5 分钟调用一次）
LOG="$(dirname "$0")/../platform/backend/data/tunnel.log"
WATCHDOG_LOG="$(dirname "$0")/../platform/backend/data/watchdog.log"
  URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOG" 2>/dev/null | grep -v '://api\.' | tail -1)
[ -z "$URL" ] && exit 0
CODE=$(curl -sS -m 10 -o /dev/null -w '%{http_code}' "$URL/api/health" 2>/dev/null)
if [ "$CODE" != "200" ]; then
  echo "[$(date '+%F %T')] 探测失败(HTTP $CODE)，自动重启隧道" >> "$WATCHDOG_LOG"
  launchctl kickstart -k "gui/$(id -u)/com.ocr-pro.tunnel" 2>/dev/null
fi
