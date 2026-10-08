# 隧道守护（Windows 计划任务调用）：隧道断开后等 5 分钟重试，避免触发 Cloudflare 429 限流；
# 每次隧道拿到新地址后自动同步进 miniprogram/config.js，重启电脑也无需手动改地址。
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$cfg  = Join-Path $root 'miniprogram\config.js'
$log  = Join-Path $root 'platform\backend\data\tunnel.log'
$logOut = Join-Path $root 'platform\backend\data\tunnel.out.log'

Start-Sleep -Seconds 15   # 等后端先起来

function Sync-Config($url) {
  if (-not $url) { return }
  $content = Get-Content $cfg -Raw -Encoding UTF8
  if ($content -match "serverBase:\s*'([^']+)'") {
    if ($Matches[1] -ne $url) {
      $content = $content -replace "serverBase:\s*'[^']+'", "serverBase: '$url'"
      Set-Content -Path $cfg -Value $content -Encoding UTF8 -NoNewline
      Add-Content $log "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] 已同步新地址到 config.js: $url"
    }
  }
}

while ($true) {
  $proc = Start-Process -FilePath (Join-Path $PSScriptRoot 'cloudflared.exe') `
    -ArgumentList 'tunnel', '--url', 'http://127.0.0.1:8000', '--protocol', 'http2' `
    -RedirectStandardError $log -RedirectStandardOutput $logOut `
    -PassThru -WindowStyle Hidden
  # 隧道就绪后读取日志里的地址并同步 config.js（多试几次，等地址出现在日志里）
  for ($i = 0; $i -lt 10; $i++) {
    Start-Sleep -Seconds 3
    if ($proc.HasExited) { break }
    $url = Select-String -Path $log -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -AllMatches |
      ForEach-Object { $_.Matches } | ForEach-Object { $_.Value } |
      Where-Object { $_ -notmatch '://api\.' } | Select-Object -Last 1
    if ($url) { Sync-Config $url; break }
  }
  Wait-Process -Id $proc.Id
  Add-Content $log "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] 隧道进程退出，300 秒后自动重试"
  Start-Sleep -Seconds 300
}
