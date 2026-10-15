param([ValidateSet('initial','polish','unified','fusion','chopin')][string]$Phase='initial')
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$root = 'Q:\音疗系统\工程归档文件\脑机接口\neural-resonance-console'
$target = Join-Path $root 'artifacts\release\v0.11.3\verified-windows\NeuralResonance\_internal'
$artifactRoot=Join-Path $root (@{initial='artifacts\planar-worm-20261011';polish='artifacts\planar-polish-20261011';unified='artifacts\planar-unified-20261011';fusion='artifacts\music-fusion-20261011';chopin='artifacts\chopin-catalog-20261012'}[$Phase])
foreach ($path in @('Q:\人工智能\Runtime\PowerShell\7.6.6\pwsh.exe', $root, $target)) {
    if (-not (Test-Path -LiteralPath $path)) { throw "Required path unavailable: $path" }
}
$files = @(
    'index.html', 'neural-worm\app.mjs', 'neural-worm\style.css', 'neural-worm\planar-workbench.mjs', 'neural-worm\planar.css',
    'src\amplitude-model.mjs', 'src\planar-model.mjs', 'src\planar-scene.mjs',
    'src\worm-model.mjs', 'src\recording.mjs', 'src\eeg.mjs', 'src\music.mjs',
    'docs\PLANAR-METHODS.md', 'docs\WORM-METHODS.md'
)
if($Phase -in @('fusion','chopin')){
    $files+=@(
        'src\fusion-model.mjs','src\comparison-scene.mjs','src\tempo-profile.mjs','src\prompt.mjs','public\research\vmus-reference-cases.json',
        'docs\EVIDENCE.md','docs\MUSIC-PLANS.md','docs\MUSIC-FUSION.md',
        'docs\PLANAR-METHODS.html','docs\EVIDENCE.html','docs\MUSIC-PLANS.html',
        'docs\WORM-METHODS.html','docs\MUSIC-FUSION.html','docs\method-documents.css'
    )
}
$localConfig = Join-Path $env:LOCALAPPDATA 'NeuralResonance\config.json'
$configBefore = if (Test-Path -LiteralPath $localConfig -PathType Leaf) {(Get-FileHash -LiteralPath $localConfig -Algorithm SHA256).Hash} else {$null}
foreach ($relative in $files) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relative) -PathType Leaf)) {throw "Missing deployable source: $relative"}
}
$backup = Join-Path $artifactRoot ('rollback-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
[IO.Directory]::CreateDirectory($backup) | Out-Null
$records = @()
foreach ($relative in $files) {
    $source = Join-Path $root $relative
    $destination = Join-Path $target $relative
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
if ($configBefore -ne $configAfter) {throw 'Local acquisition configuration changed during deployment'}
$manifest = [pscustomobject]@{
    timestamp=(Get-Date).ToString('o');target=$target;backup=$backup;files=$records
    configChanged=$false;configDigestBefore=$configBefore;configDigestAfter=$configAfter;serviceRestarted=$false
    ui=$(if($Phase -eq 'chopin'){'chopin-catalog-profile-v1'}elseif($Phase -eq 'fusion'){'music-eeg-comparison-v1'}elseif($Phase -eq 'unified'){'planar-observations-v2-unified'}else{'planar-observations-v1'});phase=$Phase
}
$json = $manifest | ConvertTo-Json -Depth 6
[IO.File]::WriteAllText((Join-Path $backup 'manifest.json'), $json, [Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText((Join-Path $artifactRoot 'deployment.json'), $json, [Text.UTF8Encoding]::new($false))
$health = Invoke-RestMethod -Uri 'http://127.0.0.1:8767/api/health' -TimeoutSec 5
$page = (Invoke-WebRequest -Uri 'http://127.0.0.1:8767/' -TimeoutSec 5).Content
if (-not $page.Contains('neural-worm/planar.css')) { throw 'Live service did not return the planar interface' }
[pscustomobject]@{files=$records.Count;application=$health.app;version=$health.version;backup=$backup;newInterface=$true;configUnchanged=$true} | ConvertTo-Json -Depth 4 -Compress
