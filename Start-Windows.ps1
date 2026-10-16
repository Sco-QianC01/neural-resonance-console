#Requires -Version 7
[CmdletBinding()]
param([switch]$NoBrowser, [switch]$Standalone, [switch]$SetupOnly, [switch]$ReuseLocalCore)
$ErrorActionPreference = 'Stop'
$OutputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = $OutputEncoding
$root = $PSScriptRoot
function Invoke-LocalRuntime {
    param([string]$Executable,[string[]]$RuntimeArguments,[switch]$InheritConsole)
    if (-not (Test-Path -LiteralPath $Executable)) { throw 'Required runtime executable missing.' }
    $start = [Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $Executable
    $start.WorkingDirectory = $root
    $start.UseShellExecute = $false
    $start.CreateNoWindow = -not $InheritConsole
    if (-not $InheritConsole) {
        $start.RedirectStandardOutput = $true
        $start.RedirectStandardError = $true
        $start.StandardOutputEncoding = [Text.UTF8Encoding]::new($false)
        $start.StandardErrorEncoding = $start.StandardOutputEncoding
    }
    $start.Environment['PYTHONIOENCODING'] = 'utf-8'
    $start.Environment['PYTHONNOUSERSITE'] = '1'
    $start.Environment['PYTHONUTF8'] = '1'
    [void]$start.Environment.Remove('PYTHONPATH')
    [void]$start.Environment.Remove('PYTHONHOME')
    foreach ($item in $RuntimeArguments) { $start.ArgumentList.Add($item) }
    $process = [Diagnostics.Process]::Start($start)
    if ($InheritConsole) {
        $process.WaitForExit()
        return $process.ExitCode
    }
    $stdout = $process.StandardOutput.ReadToEndAsync()
    $stderr = $process.StandardError.ReadToEndAsync()
    $process.WaitForExit()
    if ($stdout.Result) { Write-Host $stdout.Result.TrimEnd() }
    if ($stderr.Result) { Write-Host $stderr.Result.TrimEnd() }
    return $process.ExitCode
}
$package = Join-Path $root 'NeuralResonance\NeuralResonance.exe'
$manifest = Join-Path $root 'NeuralResonance\_internal\gateway\build-manifest.json'
$currentPackage = $false
if ((Test-Path -LiteralPath $package) -and (Test-Path -LiteralPath $manifest)) {
    try { $currentPackage = (Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json).build -eq 'portable-20261016-v1' } catch {}
}
if ($currentPackage) {
    if ($SetupOnly) { Write-Output 'Portable application is ready.'; exit 0 }
    $arguments = @()
    if ($NoBrowser) { $arguments += '--no-browser' }
    if ($Standalone) { $arguments += '--standalone' }
    if ($ReuseLocalCore) { $arguments += '--reuse-local-core' }
    $code = Invoke-LocalRuntime $package $arguments -InheritConsole
    exit $code
}
$architecture = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
$runtime = if ($env:NEURAL_RESONANCE_RUNTIME) { $env:NEURAL_RESONANCE_RUNTIME } else {
    Join-Path $env:LOCALAPPDATA "NeuralResonance\runtime\win32-$architecture"
}
[void][IO.Directory]::CreateDirectory($runtime)
$python = Join-Path $runtime 'gateway\Scripts\python.exe'
$check = Join-Path $root 'tools\runtime-check.py'
$stamp = Join-Path $runtime 'ready.json'
$project = Join-Path $root 'gateway'
$checkArguments = @($check,'--project',$project,'--stamp',$stamp)
$ready = (Test-Path -LiteralPath $python) -and
    ((Invoke-LocalRuntime $python $checkArguments) -eq 0)
if ($ready) {
    if ($SetupOnly) { exit 0 }
    $arguments = @((Join-Path $root 'gateway\device_gateway.py'))
    if ($NoBrowser) { $arguments += '--no-browser' }
    if ($Standalone) { $arguments += '--standalone' }
    if ($ReuseLocalCore) { $arguments += '--reuse-local-core' }
    exit (Invoke-LocalRuntime $python $arguments -InheritConsole)
}
$venvConfig = Join-Path $runtime 'gateway\pyvenv.cfg'
if (Test-Path -LiteralPath $venvConfig -PathType Leaf) {
    $content = Get-Content -LiteralPath $venvConfig -Raw
    $validHome = $false
    if ($content -match '(?m)^home\s*=\s*(.+)$') {
        $validHome = Test-Path -LiteralPath $Matches[1].Trim() -PathType Container
    }
    if (-not $validHome -or $content -notmatch '(?mi)^include-system-site-packages\s*=\s*false\s*$') {
        if ($content -notmatch '(?m)^prompt\s*=\s*neural-resonance-gateway\s*$') {
            throw 'The runtime directory contains another project. Choose a private runtime directory.'
        }
        $oldEnvironment = Join-Path $runtime 'gateway'
        $savedEnvironment = Join-Path $runtime ('gateway-invalid-' + [guid]::NewGuid().ToString('N'))
        Move-Item -LiteralPath $oldEnvironment -Destination $savedEnvironment
        Write-Host 'Preserved the incompatible private environment; creating a new one.'
    }
}
$uv = Join-Path $runtime 'uv.exe'
$uvReady = $false
if (Test-Path -LiteralPath $uv -PathType Leaf) {
    try { $uvReady = (Invoke-LocalRuntime $uv @('--version')) -eq 0 } catch {}
    if (-not $uvReady) {
        Move-Item -LiteralPath $uv -Destination ($uv+'.invalid-'+[guid]::NewGuid().ToString('N'))
        Write-Host 'Preserved the damaged private installer; downloading a verified replacement.'
    }
}
if (-not $uvReady) {
    # Versioned official Astral release; verified release digest before extraction.
    $releaseUrl = 'https://api.github.com/repos/astral-sh/uv/releases/tags/0.12.23'
    $release = Invoke-RestMethod -Uri $releaseUrl -Headers @{ 'User-Agent'='NeuralResonance' } -TimeoutSec 30
    $assetName = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') {
        'uv-aarch64-pc-windows-msvc.zip'
    } else { 'uv-x86_64-pc-windows-msvc.zip' }
    $asset = @($release.assets | Where-Object name -EQ $assetName)[0]
    if (-not $asset -or $asset.digest -notmatch '^sha256:([0-9a-f]{64})$') {
        throw 'Official runtime asset or checksum unavailable.'
    }
    $expected = $Matches[1]
    $archive = Join-Path $runtime 'uv.zip'
    Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $archive -TimeoutSec 180
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
        '--frozen','--no-dev','--reinstall','--python','3.13','--python-preference','only-managed')
    if ($syncCode -ne 0) { throw 'Isolated dependency installation failed.' }
    $python = Join-Path $env:UV_PROJECT_ENVIRONMENT 'Scripts\python.exe'
    if (-not (Test-Path -LiteralPath $python)) { throw 'Isolated Python missing.' }
    $checkCode = Invoke-LocalRuntime $python ($checkArguments + '--write-stamp')
    if ($checkCode -ne 0) { throw 'Locked environment verification failed.' }
    if ($SetupOnly) { exit 0 }
    $arguments = @((Join-Path $root 'gateway\device_gateway.py'))
    if ($NoBrowser) { $arguments += '--no-browser' }
    if ($Standalone) { $arguments += '--standalone' }
    if ($ReuseLocalCore) { $arguments += '--reuse-local-core' }
    $code = Invoke-LocalRuntime $python $arguments -InheritConsole
    exit $code
} finally { Pop-Location }
