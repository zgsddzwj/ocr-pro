# 开机自启入口（由启动文件夹的 ocr-pro-autostart.vbs 隐藏调用）：
# 后端已在跑则跳过、隧道守护已在跑则跳过，避免重复拉起。
$ErrorActionPreference = 'Continue'
$root  = Split-Path -Parent $PSScriptRoot
$py    = Join-Path $root 'platform\backend\.venv\Scripts\python.exe'
$bk    = Join-Path $root 'platform\backend'

# 后端：8000 端口已被占用说明已在跑
$portBusy = $false
try {
  $c = New-Object Net.Sockets.TcpClient
  $c.Connect('127.0.0.1', 8000)
  $portBusy = $true
  $c.Close()
} catch {}
if (-not $portBusy) {
  Start-Process -FilePath $py `
    -ArgumentList '-m', 'uvicorn', '--app-dir', $bk, 'app.main:app', '--host', '0.0.0.0', '--port', '8000' `
    -WorkingDirectory $bk -WindowStyle Hidden
}

# 隧道守护：已有 cloudflared 在跑、或守护脚本实例已存在（可能正处于 300 秒重试睡眠）就不再拉起
$guardRunning = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
  Where-Object { $_.CommandLine -like '*tunnel-run.ps1*' }
if (-not $guardRunning -and -not (Get-Process cloudflared -ErrorAction SilentlyContinue)) {
  Start-Process powershell.exe `
    -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', (Join-Path $PSScriptRoot 'tunnel-run.ps1') `
    -WindowStyle Hidden
}
