# 隧道守护（开机自启调用）：
# 优先 ngrok 固定域名模式——platform/backend/data/ngrok.conf 里配 NGROK_DOMAIN=xxx.ngrok-free.app
# 且已执行过 tools\ngrok.exe config add-authtoken <token> 时启用，地址永久不变；
# 无配置则回落 cloudflared 免费快隧道（地址随机、可能被服务端回收，重启后自动同步 config.js）。
# 两种模式都带每分钟健康探测，连续 3 次失败自动重启。
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$cfg  = Join-Path $root 'miniprogram\config.js'
$log  = Join-Path $root 'platform\backend\data\tunnel.log'
$logOut = Join-Path $root 'platform\backend\data\tunnel.out.log'
$conf = Join-Path $root 'platform\backend\data\ngrok.conf'

Start-Sleep -Seconds 15   # 等后端先起来

# 读固定域名配置（ngrok.conf：NGROK_DOMAIN=xxx.ngrok-free.app）
$staticDomain = ''
if (Test-Path $conf) {
  foreach ($line in Get-Content $conf) {
    if ($line -match '^NGROK_DOMAIN\s*=\s*(\S+)') { $staticDomain = $Matches[1] }
  }
}
if ($staticDomain) {
  # 固定域名需要 authtoken 已配置，否则回落 cloudflared 模式
  & (Join-Path $PSScriptRoot 'ngrok.exe') config check *> $null
  if ($LASTEXITCODE -eq 0) {
    Add-Content $log "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] 使用 ngrok 固定域名模式: $staticDomain"
  } else {
    Add-Content $log "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] ngrok authtoken 未配置，回落 cloudflared 免费隧道模式"
    $staticDomain = ''
  }
}

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
  $url = ''
  if ($staticDomain) {
    # ngrok 固定域名：地址不变，先同步再拉起
    $url = "https://$staticDomain"
    Sync-Config $url
    $proc = Start-Process -FilePath (Join-Path $PSScriptRoot 'ngrok.exe') `
      -ArgumentList 'http', '8000', "--url=$staticDomain", '--log=stdout', '--log-format=json' `
      -RedirectStandardError $log -RedirectStandardOutput $logOut `
      -PassThru -WindowStyle Hidden
  } else {
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
  }
  # 健康看门狗：进程活着但隧道失效（断连/被服务端回收）时也能自愈
  $script:bad = 0
  while (-not $proc.HasExited) {
    Start-Sleep -Seconds 60
    if ($proc.HasExited) { break }
    if (-not $url) { $url = Get-TunnelUrl }
    if (-not $url) { continue }
    try {
      Invoke-WebRequest -Uri "$url/api/health" -TimeoutSec 15 -UseBasicParsing | Out-Null
      $script:bad = 0
    } catch {
      $script:bad++
      Add-Content $log "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] 健康探测失败（连续 $script:bad 次）"
      if ($script:bad -ge 3) {
        Add-Content $log "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] 隧道疑似失效，重启隧道"
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        break
      }
    }
  }
  Wait-Process -Id $proc.Id -ErrorAction SilentlyContinue
  Add-Content $log "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] 隧道进程退出，300 秒后自动重试"
  Start-Sleep -Seconds 300
}
