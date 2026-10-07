#!/bin/bash
# 查看当前公网隧道地址，并自动复制到剪贴板
LOG="$(dirname "$0")/../platform/backend/data/tunnel.log"
  URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOG" 2>/dev/null | grep -v '://api\.' | tail -1)
if [ -z "$URL" ]; then
  echo "未找到隧道地址：请确认 com.ocr-pro.tunnel 服务在运行（launchctl list | grep ocr-pro）"
  exit 1
fi
echo "$URL"
echo "$URL" | pbcopy 2>/dev/null && echo "（已复制到剪贴板）"
curl -sS -m 8 -o /dev/null -w "连通性: HTTP %{http_code}\n" "$URL/api/health" 2>/dev/null
