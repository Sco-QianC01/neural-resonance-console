#Requires -Version 7
[CmdletBinding()]
param([ValidateSet('SourceBrowser','Deploy','LiveBrowser')][string]$Stage='SourceBrowser')
$ErrorActionPreference='Stop'
$OutputEncoding=[Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding=$OutputEncoding
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$ps7='Q:\人工智能\Runtime\PowerShell\7.6.6\pwsh.exe'
if(-not(Test-Path -LiteralPath $ps7 -PathType Leaf)){throw 'Required PowerShell 7 is missing'}
$out=Join-Path $root 'artifacts\device-status-20261012'
[void][IO.Directory]::CreateDirectory($out)
$python=Join-Path $root 'artifacts\portable-20261012\qa-env\Scripts\python.exe'
if($Stage -eq 'Deploy'){
    $target=Join-Path $root 'artifacts\release\v0.11.3\verified-windows\NeuralResonance\_internal'
    $candidate=Join-Path $root 'artifacts\portable-20261012\desktop\NeuralResonance\_internal'
    foreach($folder in @($target,$candidate)){
        if(-not(Test-Path -LiteralPath $folder -PathType Container)){throw "Deployment folder missing: $folder"}
    }
    $runtime=Invoke-RestMethod -Uri 'http://127.0.0.1:8767/api/runtime' -TimeoutSec 3
    $listener=Get-NetTCPConnection -LocalPort 8767 -State Listen | Select-Object -First 1
    $pidBefore=$listener.OwningProcess
    $files=@('neural-worm\app.mjs','neural-worm\style.css','src\gateway-settings.mjs')
    $rows=@()
    foreach($file in $files){
        $source=Join-Path $root $file
        $deployed=Join-Path $target $file
        if(-not(Test-Path -LiteralPath $source -PathType Leaf)){throw "Source file missing: $file"}
        if(-not(Test-Path -LiteralPath $deployed -PathType Leaf)){throw "Deployed file missing: $file"}
        $backup=Join-Path (Join-Path $out 'deployed-before') $file
        [void][IO.Directory]::CreateDirectory((Split-Path $backup))
        if(-not(Test-Path -LiteralPath $backup)){Copy-Item -LiteralPath $deployed -Destination $backup}
        Copy-Item -LiteralPath $source -Destination $deployed -Force
        Copy-Item -LiteralPath $source -Destination (Join-Path $candidate $file) -Force
        $sha=(Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
        if((Get-FileHash -LiteralPath $deployed -Algorithm SHA256).Hash -ne $sha){throw "Deployment mismatch: $file"}
        $rows+=@{file=$file;sha256=$sha;verified=$true}
    }
    $pidAfter=(Get-NetTCPConnection -LocalPort 8767 -State Listen | Select-Object -First 1).OwningProcess
    if($pidBefore -ne $pidAfter){throw 'The running acquisition process changed'}
    $result=@{files=$rows;pidBefore=$pidBefore;pidAfter=$pidAfter;restarted=$false;before=$runtime.core}
    [IO.File]::WriteAllText((Join-Path $out 'deployment.json'),($result|ConvertTo-Json -Depth 8),$OutputEncoding)
    Write-Output "Deployed 3 static files; acquisition PID unchanged ($pidAfter)"
    return
}
if(-not(Test-Path -LiteralPath $python -PathType Leaf)){throw 'Existing QA runtime is missing'}
$info=[Diagnostics.ProcessStartInfo]::new()
$info.FileName=$python;$info.WorkingDirectory=$root;$info.UseShellExecute=$false;$info.CreateNoWindow=$true
$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true
$info.StandardOutputEncoding=$OutputEncoding;$info.StandardErrorEncoding=$OutputEncoding
$info.Environment['PYTHONIOENCODING']='utf-8';$info.Environment['PYTHONNOUSERSITE']='1'
[void]$info.Environment.Remove('PYTHONHOME');[void]$info.Environment.Remove('PYTHONPATH')
$info.ArgumentList.Add((Join-Path $PSScriptRoot 'verify-device-status.py'))
if($Stage -eq 'SourceBrowser'){$info.ArgumentList.Add('--source')}
$process=[Diagnostics.Process]::Start($info)
$stdout=$process.StandardOutput.ReadToEndAsync();$stderr=$process.StandardError.ReadToEndAsync()
$process.WaitForExit()
[IO.File]::WriteAllText((Join-Path $out "$Stage.log"),$stdout.Result+$stderr.Result,$OutputEncoding)
if($process.ExitCode -ne 0){Write-Output $stderr.Result;throw "Browser validation failed; see $Stage.log"}
Write-Output $stdout.Result
