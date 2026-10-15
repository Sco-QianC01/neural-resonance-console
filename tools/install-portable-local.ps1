#Requires -Version 7
[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
$OutputEncoding=[Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding=$OutputEncoding
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$out=Join-Path $root 'artifacts\portable-20261012'
$candidate=Join-Path $out 'desktop\NeuralResonance'
$target=Join-Path $root 'artifacts\release\v0.11.3\verified-windows\NeuralResonance'
foreach($path in @($candidate,$target)){
    if(-not(Test-Path -LiteralPath $path -PathType Container)){throw 'Expected complete application directory missing'}
    if(-not $path.StartsWith($root+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Unexpected deployment target'}
}
foreach($proof in @('native-smoke.json','windows-browser\verification.json')){
    $path=Join-Path $out $proof
    if(-not(Test-Path -LiteralPath $path)){throw 'Required candidate acceptance missing'}
    $result=Get-Content -LiteralPath $path -Raw|ConvertFrom-Json
    if(-not $result.pass){throw 'Candidate acceptance failed'}
    if($result.nativeExecutableSha256 -ne
        (Get-FileHash -LiteralPath (Join-Path $candidate 'NeuralResonance.exe') -Algorithm SHA256).Hash){
        throw 'Native executable changed since acceptance'
    }
}
$exe=Join-Path $target 'NeuralResonance.exe'
if(@(Get-Process -Name NeuralResonance -ErrorAction SilentlyContinue | Where-Object Path -EQ $exe).Count){
    throw 'The existing application is running; deployment has not interrupted it.'
}
$data=Join-Path $env:LOCALAPPDATA 'NeuralResonance'
$config=Join-Path $data 'config.json'
$before=if(Test-Path -LiteralPath $config){(Get-FileHash -LiteralPath $config -Algorithm SHA256).Hash}else{$null}
$backup=Join-Path $out ('rollback-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
[void][IO.Directory]::CreateDirectory($backup)
Copy-Item -LiteralPath $target -Destination $backup -Recurse
try {
    Get-ChildItem -LiteralPath $candidate | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $target -Recurse -Force
    }
    $mismatches=@()
    $count=0
    Get-ChildItem -LiteralPath $candidate -Recurse -File | ForEach-Object {
        $relative=$_.FullName.Substring($candidate.Length+1)
        $deployed=Join-Path $target $relative
        if(-not(Test-Path -LiteralPath $deployed) -or
            (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash -ne
            (Get-FileHash -LiteralPath $deployed -Algorithm SHA256).Hash){$mismatches+=$relative}
        $count++
    }
    if($mismatches.Count){throw 'Source/application hashes differ'}
    $shortcut=Join-Path $env:USERPROFILE 'Desktop\AI音疗\02_启动神经共振控制台.lnk'
    $shortcutUpdated=$false
    if(Test-Path -LiteralPath $shortcut -PathType Leaf){
        Copy-Item -LiteralPath $shortcut -Destination (Join-Path $backup 'console-shortcut.lnk')
        $shell=New-Object -ComObject WScript.Shell
        $link=$shell.CreateShortcut($shortcut)
        $link.TargetPath=$exe;$link.Arguments='';$link.WorkingDirectory=$target
        $link.IconLocation=$exe+',0';$link.Save()
        $shortcutUpdated=$shell.CreateShortcut($shortcut).TargetPath -eq $exe
        if(-not $shortcutUpdated){throw 'Existing console shortcut did not save'}
    }
    Start-Process -FilePath $exe -WorkingDirectory $target | Out-Null
    $health=$null;$runtime=$null;$url=$null
    for($i=0;$i -lt 30;$i++){
        Start-Sleep -Milliseconds 500
        try {
            $statePath=Join-Path $data 'runtime.json'
            if(-not(Test-Path -LiteralPath $statePath)){continue}
            $state=Get-Content -LiteralPath $statePath -Raw|ConvertFrom-Json
            if($state.build -ne 'score-evidence-20261015-v9'){continue}
            $url=$state.url.TrimEnd('/')
            $health=Invoke-RestMethod ($url+'/api/health') -TimeoutSec 2
            if($health.build -eq 'score-evidence-20261015-v9'){
                $runtime=Invoke-RestMethod ($url+'/api/runtime') -TimeoutSec 2
                break
            }
        }catch{}
    }
    if(-not $runtime){throw 'New application failed its live startup check'}
    $after=if(Test-Path -LiteralPath $config){(Get-FileHash -LiteralPath $config -Algorithm SHA256).Hash}else{$null}
    if($before -ne $after){throw 'User configuration changed unexpectedly'}
    [ordered]@{pass=$true;url=$url;build=$health.build;standalone=(-not $health.upstream)
        filesMatched=$count;userConfigUnchanged=($before -eq $after)
        existingConsoleShortcutUpdated=$shortcutUpdated;rollback=$backup
        eegSamples=$runtime.core.streams.eeg.samples;spo2Samples=$runtime.core.streams.spo2.samples
        physicalHardwareVerified=$false;checkedAt=(Get-Date -Format o)} |
        ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $out 'local-deployment.json') -Encoding utf8NoBOM
    Write-Output "Installed verified local application: $url; $count hashes match. User configuration preserved."
} catch {
    Write-Output "Deployment or startup failed. Preserved complete rollback: $backup"
    throw
}
