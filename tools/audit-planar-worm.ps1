param([ValidateSet('initial','polish','unified','fusion','chopin')][string]$Phase='initial')
$ErrorActionPreference='Stop'
$root='Q:\音疗系统\工程归档文件\脑机接口\neural-resonance-console'
$artifactRoot=Join-Path $root (@{initial='artifacts\planar-worm-20261011';polish='artifacts\planar-polish-20261011';unified='artifacts\planar-unified-20261011';fusion='artifacts\music-fusion-20261011';chopin='artifacts\chopin-catalog-20261012'}[$Phase])
$manifestPath=Join-Path $artifactRoot 'deployment.json'
foreach($path in @('Q:\人工智能\Runtime\PowerShell\7.6.6\pwsh.exe',$root,$manifestPath)){
    if(-not(Test-Path -LiteralPath $path)){throw 'Deployment audit entry missing'}
}
$manifest=[IO.File]::ReadAllText($manifestPath,[Text.Encoding]::UTF8)|ConvertFrom-Json
foreach($record in $manifest.files){
    $source=Join-Path $root $record.relative
    $destination=Join-Path $manifest.target $record.relative
    foreach($path in @($source,$destination)){if(-not(Test-Path -LiteralPath $path -PathType Leaf)){throw 'Deployed resource missing'}}
    $sourceHash=(Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
    $targetHash=(Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash
    if($sourceHash -ne $targetHash -or $targetHash -ne $record.after){throw "Final resource hash mismatch: $($record.relative)"}
}
$config=Join-Path $env:LOCALAPPDATA 'NeuralResonance\config.json'
$configNow=if(Test-Path -LiteralPath $config -PathType Leaf){(Get-FileHash -LiteralPath $config -Algorithm SHA256).Hash}else{$null}
if($configNow -ne $manifest.configDigestBefore){throw 'Acquisition configuration changed'}
$health=Invoke-RestMethod 'http://127.0.0.1:8767/api/health' -TimeoutSec 5
$result=[pscustomobject]@{
    timestamp=(Get-Date).ToString('o');matchedFiles=$manifest.files.Count;acquisitionConfigUnchanged=$true
    httpResponsive=$true;application=$health.app;version=$health.version;ui=$manifest.ui
}
$json=$result|ConvertTo-Json -Depth 4
[IO.File]::WriteAllText((Join-Path $artifactRoot 'final-audit.json'),$json,[Text.UTF8Encoding]::new($false))
$json
