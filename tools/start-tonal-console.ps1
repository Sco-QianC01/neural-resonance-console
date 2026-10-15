$ErrorActionPreference='Stop'
$ps7='Q:\人工智能\Runtime\PowerShell\7.6.6\pwsh.exe'
$exe='Q:\音疗系统\工程归档文件\脑机接口\neural-resonance-console\artifacts\release\v0.11.3\verified-windows\NeuralResonance\NeuralResonance.exe'
foreach($path in @($ps7,$exe)){if(-not(Test-Path -LiteralPath $path -PathType Leaf)){throw 'Existing local application entry missing'}}
$started=$false
try {$health=Invoke-RestMethod 'http://127.0.0.1:8767/api/health' -TimeoutSec 2} catch {
    if(Get-Process -Name NeuralResonance -ErrorAction SilentlyContinue){throw 'Application process exists but HTTP is unavailable; do not duplicate-start'}
    Start-Process -FilePath $exe -WorkingDirectory ([IO.Path]::GetDirectoryName($exe)) | Out-Null
    $started=$true
    for($i=0;$i -lt 20;$i++){
        Start-Sleep -Milliseconds 500
        try {$health=Invoke-RestMethod 'http://127.0.0.1:8767/api/health' -TimeoutSec 2;break} catch {}
    }
}
if(-not $health){throw 'Existing local application failed to respond'}
[pscustomobject]@{httpResponsive=$true;startedExistingApplication=$started;application=$health.app;version=$health.version}|ConvertTo-Json -Compress
