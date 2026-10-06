param([ValidateRange(1024,65535)][int]$Port=8767,[switch]$NoBrowser)
$ErrorActionPreference='Stop'
if($PSVersionTable.PSVersion.Major -lt 7){throw 'PowerShell 7 is required'}
$root=Split-Path $PSScriptRoot -Parent
$candidate=(Get-Command node -ErrorAction SilentlyContinue).Source
if(!$candidate){$candidate='Q:\音疗系统\夜莺\01_工程\yeying\.runtime\node\node.exe'}
if(!(Test-Path -LiteralPath $candidate -PathType Leaf)){throw 'Install Node.js 20+ or provide node on PATH'}
$script=Join-Path $PSScriptRoot 'serve.mjs'
if(!(Test-Path -LiteralPath $script -PathType Leaf)){throw 'Console server missing'}
$listening=Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if($listening){throw "Port $Port is occupied; use -Port with another port"}
$env:PORT=[string]$Port
if(!$NoBrowser){Start-Process "http://127.0.0.1:$Port/"}
Push-Location -LiteralPath $root
try{ & $candidate $script }finally{Pop-Location}
