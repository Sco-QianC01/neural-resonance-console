[CmdletBinding()]
param([string]$ManifestPath)
$ErrorActionPreference = 'Stop'
if ($PSVersionTable.PSVersion.Major -lt 7) { throw 'PowerShell 7 is required' }
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
if (-not $ManifestPath) {
    $systemRoot = Split-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) -Parent
    $ManifestPath = Join-Path $systemRoot '澳门科技大学\02_启动与检查\启动\launcher-manifest.json'
}
$common = Join-Path (Split-Path $ManifestPath -Parent) 'MusicTherapy.Common.ps1'
if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf) -or
    -not (Test-Path -LiteralPath $common -PathType Leaf)) {
    throw 'Local music therapy launcher manifest is unavailable'
}
$env:MUSIC_THERAPY_MANIFEST_PATH = $ManifestPath
. $common
$audit = Get-MusicTherapyAudit
# Do not expose command lines, device identifiers, credentials or local paths.
$programs = @($audit.items | ForEach-Object {
    [ordered]@{
        id = $_.id
        label = $_.label
        running = [bool]$_.running
        pathValid = [bool]$_.path_valid
        infrastructureReady = [bool]$_.infrastructure_ready
        ports = @($_.ports | ForEach-Object {
            [ordered]@{ port = $_.port; protocol = $_.protocol; bound = [bool]$_.bound }
        })
        applicationVerified = $null
    }
})
$manifest = @(Read-MusicTherapyManifest)
$core = @($manifest | Where-Object { $_.id -eq 'core' })[0]
$processes = @(Get-MusicTherapyProcessTable)
$pythonw = Join-Path (Split-Path $core.executable -Parent) 'pythonw.exe'
$auxiliary = @(
    @{ id = 'phone_bridge'; label = '手機／MuMu 資料橋接'; exe = $pythonw;
       script = (Join-Path $core.working_directory 'tools\phone_mumu_bridge.py') },
    @{ id = 'eeg_reconnect'; label = '設備重連守護'; exe = (Get-Process -Id $PID).Path;
       script = (Join-Path (Split-Path $ManifestPath -Parent) 'Watch-MusicTherapyEEG.ps1') }
)
foreach ($item in $auxiliary) {
    $running = @($processes | Where-Object {
        Test-MusicTherapyScriptProcess $_ $item.exe $item.script
    }).Count -gt 0
    $programs += [ordered]@{
        id = $item.id; label = $item.label; running = $running
        pathValid = (Test-Path -LiteralPath $item.exe -PathType Leaf) -and
            (Test-Path -LiteralPath $item.script -PathType Leaf)
        infrastructureReady = $running; ports = @(); applicationVerified = $null
    }
}
[ordered]@{
    checkedAt = (Get-Date).ToUniversalTime().ToString('o')
    scope = 'process_and_owned_ports'
    programs = $programs
} | ConvertTo-Json -Depth 7 -Compress
