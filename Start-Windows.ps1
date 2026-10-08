#Requires -Version 7
[CmdletBinding()]
param([switch]$NoBrowser, [switch]$Standalone, [switch]$SetupOnly)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
function Invoke-LocalRuntime {
    param([string]$Executable,[string[]]$RuntimeArguments)
    if (-not (Test-Path -LiteralPath $Executable)) { throw 'Required runtime executable missing.' }
    $start = [Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $Executable
    $start.WorkingDirectory = $root
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.StandardOutputEncoding = [Text.UTF8Encoding]::new($false)
    $start.StandardErrorEncoding = $start.StandardOutputEncoding
    $start.Environment['PYTHONIOENCODING'] = 'utf-8'
    foreach ($item in $RuntimeArguments) { $start.ArgumentList.Add($item) }
    $process = [Diagnostics.Process]::Start($start)
    $stdout = $process.StandardOutput.ReadToEndAsync()
    $stderr = $process.StandardError.ReadToEndAsync()
    $process.WaitForExit()
    if ($stdout.Result) { Write-Host $stdout.Result.TrimEnd() }
    if ($stderr.Result) { Write-Host $stderr.Result.TrimEnd() }
    return $process.ExitCode
}
$package = Join-Path $root 'NeuralResonance\NeuralResonance.exe'
if (Test-Path -LiteralPath $package) {
    if ($SetupOnly) { Write-Output 'Portable application is ready.'; exit 0 }
    $arguments = @()
    if ($NoBrowser) { $arguments += '--no-browser' }
    if ($Standalone) { $arguments += '--standalone' }
    & $package @arguments
    exit $LASTEXITCODE
}
$runtime = Join-Path $root '.runtime'
[void][IO.Directory]::CreateDirectory($runtime)
$uv = Join-Path $runtime 'uv.exe'
if (-not (Test-Path -LiteralPath $uv)) {
    # Versioned official Astral release; verified release digest before extraction.
    $releaseUrl = 'https://api.github.com/repos/astral-sh/uv/releases/tags/0.12.23'
    $release = Invoke-RestMethod -Uri $releaseUrl -Headers @{ 'User-Agent'='NeuralResonance' }
    $assetName = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') {
        'uv-aarch64-pc-windows-msvc.zip'
    } else { 'uv-x86_64-pc-windows-msvc.zip' }
    $asset = @($release.assets | Where-Object name -EQ $assetName)[0]
    if (-not $asset -or $asset.digest -notmatch '^sha256:([0-9a-f]{64})$') {
        throw 'Official runtime asset or checksum unavailable.'
    }
    $expected = $Matches[1]
    $archive = Join-Path $runtime 'uv.zip'
    Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $archive
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ine $expected) {
        throw 'Runtime archive checksum mismatch.'
    }
    Expand-Archive -LiteralPath $archive -DestinationPath $runtime -Force
}
$env:UV_PROJECT_ENVIRONMENT = Join-Path $runtime 'gateway'
$env:UV_CACHE_DIR = Join-Path $runtime 'uv-cache'
$env:UV_PYTHON_INSTALL_DIR = Join-Path $runtime 'python'
$env:UV_LINK_MODE = 'copy'
Push-Location (Join-Path $root 'gateway')
try {
    $syncCode = Invoke-LocalRuntime $uv @('sync','--directory',(Join-Path $root 'gateway'),
        '--frozen','--no-dev','--python','3.13','--python-preference','only-managed')
    if ($syncCode -ne 0) { throw 'Isolated dependency installation failed.' }
    $python = Join-Path $env:UV_PROJECT_ENVIRONMENT 'Scripts\python.exe'
    if (-not (Test-Path -LiteralPath $python)) { throw 'Isolated Python missing.' }
    if ($SetupOnly) {
        $checkCode = Invoke-LocalRuntime $python @('-c',"import aiohttp, bleak, serial; print('Isolated acquisition environment is ready.')")
        exit $checkCode
    }
    $arguments = @((Join-Path $root 'gateway\device_gateway.py'))
    if ($NoBrowser) { $arguments += '--no-browser' }
    if ($Standalone) { $arguments += '--standalone' }
    & $python @arguments
    exit $LASTEXITCODE
} finally { Pop-Location }
