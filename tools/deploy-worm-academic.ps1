$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$root = 'Q:\音疗系统\工程归档文件\脑机接口\neural-resonance-console'
$target = Join-Path $root 'artifacts\release\v0.11.3\verified-windows\NeuralResonance\_internal'
foreach ($path in @('Q:\人工智能\Runtime\PowerShell\7.6.6\pwsh.exe', $root, $target)) {
    if (-not (Test-Path -LiteralPath $path)) { throw "Required path unavailable: $path" }
}
$files = @(
    'index.html', 'neural-worm\app.mjs', 'neural-worm\research.mjs', 'neural-worm\research.css',
    'neural-worm\tonal-workbench.mjs', 'neural-worm\tonal.css', 'src\tonal-model.mjs', 'src\tonal-scene.mjs',
    'src\performance-model.mjs', 'src\worm-scene.mjs', 'public\research\vmus-performance.json',
    'public\vendor\three\three.core.min.js', 'public\vendor\three\three.module.min.js',
    'public\vendor\three\OrbitControls.js', 'public\vendor\three\LICENSE',
    'public\vendor\NOTICE.md', 'public\vendor\lucide-LICENSE', 'docs\WORM-METHODS.md'
)
$localConfig = Join-Path $env:LOCALAPPDATA 'NeuralResonance\config.json'
$configBefore = if (Test-Path -LiteralPath $localConfig -PathType Leaf) {(Get-FileHash -LiteralPath $localConfig -Algorithm SHA256).Hash} else {$null}
foreach ($relative in $files) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relative) -PathType Leaf)) {throw "Missing deployable source: $relative"}
}
$backup = Join-Path $root ('artifacts\tonal-sphere-20261011\rollback-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
[IO.Directory]::CreateDirectory($backup) | Out-Null
$records = @()
foreach ($relative in $files) {
    $source = Join-Path $root $relative
    $destination = Join-Path $target $relative
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Missing source: $relative" }
    $exists = Test-Path -LiteralPath $destination -PathType Leaf
    $before = $null
    if ($exists) {
        $before = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash
        $copy = Join-Path $backup $relative
        [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($copy)) | Out-Null
        Copy-Item -LiteralPath $destination -Destination $copy
    }
    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($destination)) | Out-Null
    Copy-Item -LiteralPath $source -Destination $destination -Force
    $expected = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
    $actual = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash
    if ($expected -ne $actual) { throw "Deployment hash mismatch: $relative" }
    $records += [pscustomobject]@{relative=$relative;previouslyExisted=$exists;before=$before;after=$actual}
}
$configAfter = if (Test-Path -LiteralPath $localConfig -PathType Leaf) {(Get-FileHash -LiteralPath $localConfig -Algorithm SHA256).Hash} else {$null}
if ($configBefore -ne $configAfter) {throw 'Local acquisition configuration changed during deployment; inspect before continuing'}
$manifest = [pscustomobject]@{
    timestamp=(Get-Date).ToString('o');target=$target;backup=$backup;files=$records
    configChanged=$false;configDigestBefore=$configBefore;configDigestAfter=$configAfter;serviceRestarted=$false;ui='tonal-v1'
}
$json = $manifest | ConvertTo-Json -Depth 6
[IO.File]::WriteAllText((Join-Path $backup 'manifest.json'), $json, [Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText((Join-Path $root 'artifacts\tonal-sphere-20261011\deployment.json'), $json, [Text.UTF8Encoding]::new($false))
$health = Invoke-RestMethod -Uri 'http://127.0.0.1:8767/api/health' -TimeoutSec 5
$page = (Invoke-WebRequest -Uri 'http://127.0.0.1:8767/' -TimeoutSec 5).Content
if (-not $page.Contains('neural-worm/tonal.css')) { throw 'Live service did not return the new interface' }
[pscustomobject]@{files=$records.Count;application=$health.app;version=$health.version;backup=$backup;newInterface=$true;configUnchanged=$true} | ConvertTo-Json -Depth 4 -Compress
