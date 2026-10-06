param([ValidateRange(1024,65535)][int]$Port=8767,[switch]$NoBrowser,[switch]$Background)
$ErrorActionPreference='Stop'
if($PSVersionTable.PSVersion.Major -lt 7){throw 'PowerShell 7 is required'}
$root=Split-Path $PSScriptRoot -Parent
$candidate=(Get-Command node -ErrorAction SilentlyContinue).Source
if(!$candidate){$candidate='Q:\音疗系统\夜莺\01_工程\yeying\.runtime\node\node.exe'}
if(!(Test-Path -LiteralPath $candidate -PathType Leaf)){throw 'Install Node.js 20+ or provide node on PATH'}
$script=Join-Path $PSScriptRoot 'serve.mjs'
if(!(Test-Path -LiteralPath $script -PathType Leaf)){throw 'Console server missing'}
$listening=Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if($listening){
  $owned=@(Get-CimInstance Win32_Process | Where-Object {
    $_.ProcessId -in $listening.OwningProcess -and $_.ExecutablePath -ieq $candidate -and
    $_.CommandLine -match ('^("[^"]+"|\S+)\s+"?' + [regex]::Escape($script) + '"?\s*$')
  })
  $health=$null
  try{$health=Invoke-RestMethod "http://127.0.0.1:$Port/api/health" -TimeoutSec 2}catch{}
  if(!$owned.Count -or $health.app -ne 'neural-resonance-console'){throw "Port $Port is occupied by an unverified service"}
  if(!$NoBrowser){Start-Process "http://127.0.0.1:$Port/"}
  Write-Output "Console already running on port $Port"
  return
}
$env:PORT=[string]$Port
$env:MUSIC_THERAPY_PWSH=(Get-Process -Id $PID).Path
if($Background){
  $start=[Diagnostics.ProcessStartInfo]::new()
  $start.FileName=$candidate
  $start.WorkingDirectory=$root
  $start.UseShellExecute=$false
  $start.CreateNoWindow=$true
  $start.ArgumentList.Add($script)
  $process=[Diagnostics.Process]::Start($start)
  $health=$null
  for($attempt=0;$attempt -lt 20;$attempt++){
    try{$health=Invoke-RestMethod "http://127.0.0.1:$Port/api/health" -TimeoutSec 1}catch{}
    if($health.app -eq 'neural-resonance-console'){break}
    if($process.HasExited){throw 'Console exited during startup'}
    Start-Sleep -Milliseconds 250
  }
  if($health.app -ne 'neural-resonance-console'){throw 'Console did not become ready'}
  if(!$NoBrowser){Start-Process "http://127.0.0.1:$Port/"}
  Write-Output "Console started: PID=$($process.Id), port=$Port"
  return
}
if(!$NoBrowser){Start-Process "http://127.0.0.1:$Port/"}
Push-Location -LiteralPath $root
try{ & $candidate $script }finally{Pop-Location}
