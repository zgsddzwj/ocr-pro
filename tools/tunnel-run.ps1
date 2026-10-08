# 隧道守护（开机自启调用）：隧道断开后等 5 分钟重试，避免触发 Cloudflare 429 限流；
# 每分钟探测一次公网健康检查——免费隧道可能被 Cloudflare 服务端回收
# （进程不死但日志持续报 Unauthorized: Tunnel not found，DNS 注销），连续失败即重启换新地址；
# 每次拿到新地址后自动同步进 miniprogram/config.js，重启电脑也无需手动改地址。
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$cfg  = Join-Path $root 'miniprogram\config.js'
$log  = Join-Path $root 'platform\backend\data\tunnel.log'
$logOut = Join-Path $root 'platform\backend\data\tunnel.out.log'

Start-Sleep -Seconds 15   # 等后端先起来

function Get-TunnelUrl {
  Select-String -Path $log -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -AllMatches |
    ForEach-Object { $_.Matches } | ForEach-Object { $_.Value } |
    Where-Object { $_ -notmatch '://api\.' } | Select-Object -Last 1
}

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
    $url = Get-TunnelUrl
    if ($url) { Sync-Config $url; break }
  }
  # 健康看门狗：进程活着但隧道失效（被服务端回收/断连）时也能自愈
  $script:bad = 0
  while (-not $proc.HasExited) {
    Start-Sleep -Seconds 60
    if ($proc.HasExited) { break }
    $url = Get-TunnelUrl
    if (-not $url) { continue }
    try {
      Invoke-WebRequest -Uri "$url/api/health" -TimeoutSec 15 -UseBasicParsing | Out-Null
      $script:bad = 0
    } catch {
      $script:bad++
      Add-Content $log "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] 健康探测失败（连续 $script:bad 次）"
      if ($script:bad -ge 3) {
        Add-Content $log "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] 隧道疑似失效，重启换新地址"
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        break
      }
    }
  }
  Wait-Process -Id $proc.Id -ErrorAction SilentlyContinue
  Add-Content $log "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] 隧道进程退出，300 秒后自动重试"
  Start-Sleep -Seconds 300
}
