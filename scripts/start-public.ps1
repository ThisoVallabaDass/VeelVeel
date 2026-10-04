param([int]$Port = 8788)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$cacheRoot = Join-Path $projectRoot '.cache'
New-Item -ItemType Directory -Force -Path $cacheRoot | Out-Null
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'apps/veel-veel/dist/index.html'))) {
  throw 'Run pnpm build before starting the public playtest.'
}
$tunnelBinary = Join-Path $cacheRoot 'cloudflared.exe'
if (-not (Test-Path -LiteralPath $tunnelBinary)) {
  Invoke-WebRequest 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile $tunnelBinary
}
$oldNodeEnv = $env:NODE_ENV
$oldPort = $env:PORT
try {
  $env:NODE_ENV = 'production'
  $env:PORT = "$Port"
  $serverProcess = Start-Process -FilePath (Get-Command node).Source -ArgumentList 'apps/server/dist/index.js' -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $cacheRoot 'public-server.log') -RedirectStandardError (Join-Path $cacheRoot 'public-server.err.log')
} finally {
  $env:NODE_ENV = $oldNodeEnv
  $env:PORT = $oldPort
}
$healthy = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
  Start-Sleep -Milliseconds 300
  if ($serverProcess.HasExited) { throw 'The game server exited. Check .cache/public-server.err.log.' }
  try {
    $health = Invoke-RestMethod "http://127.0.0.1:$Port/health"
    if ($health.service -eq 'veel-veel') { $healthy = $true; break }
  } catch { }
}
if (-not $healthy) { throw 'The game server did not become ready.' }
$tunnelProcess = Start-Process -FilePath $tunnelBinary -ArgumentList @('tunnel', '--url', "http://127.0.0.1:$Port", '--protocol', 'http2', '--no-autoupdate') -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $cacheRoot 'public-tunnel.log') -RedirectStandardError (Join-Path $cacheRoot 'public-tunnel.err.log')
@{ serverPid = $serverProcess.Id; tunnelPid = $tunnelProcess.Id; port = $Port; startedAt = (Get-Date).ToString('o') } | ConvertTo-Json | Set-Content (Join-Path $cacheRoot 'public-processes.json')
for ($attempt = 0; $attempt -lt 60; $attempt++) {
  Start-Sleep -Milliseconds 500
  $log = Get-Content (Join-Path $cacheRoot 'public-tunnel.err.log') -Raw -ErrorAction SilentlyContinue
  if ($log -match 'https://[a-z0-9-]+\.trycloudflare\.com') {
    $publicUrl = $Matches[0]
    $publicUrl | Set-Content (Join-Path $cacheRoot 'public-url.txt')
    Write-Output "Public playtest: $publicUrl"
    Write-Output 'Keep this computer awake and online. This is a temporary URL, not permanent hosting.'
    exit 0
  }
  if ($tunnelProcess.HasExited) { throw 'The tunnel exited. Check .cache/public-tunnel.err.log.' }
}
throw 'The tunnel is still connecting. Check .cache/public-tunnel.err.log.'
