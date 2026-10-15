#Requires -Version 7
[CmdletBinding()]
param([ValidateSet('Lock','Setup','Tests','Build','Smoke','SourceSetup','SourceSmoke','SourceRepair','Browser','LiveBrowser')][string]$Stage='Tests')
$ErrorActionPreference='Stop'
$OutputEncoding=[Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding=$OutputEncoding
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$ps7='Q:\人工智能\Runtime\PowerShell\7.6.6\pwsh.exe'
if(-not(Test-Path -LiteralPath $ps7 -PathType Leaf)){throw 'Required local PowerShell 7 missing'}
$out=Join-Path $root 'artifacts\portable-20261012'
[void][IO.Directory]::CreateDirectory($out)
function Run-Native([string]$exe,[string[]]$items,[string]$log,[string]$directory=$root){
    if(-not(Test-Path -LiteralPath $exe -PathType Leaf)){throw "Required local executable missing: $exe"}
    $info=[Diagnostics.ProcessStartInfo]::new()
    $info.FileName=$exe;$info.WorkingDirectory=$directory;$info.UseShellExecute=$false
    $info.CreateNoWindow=$true;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true
    $info.StandardOutputEncoding=[Text.UTF8Encoding]::new($false)
    $info.StandardErrorEncoding=$info.StandardOutputEncoding
    $info.Environment['PYTHONIOENCODING']='utf-8';$info.Environment['PYTHONNOUSERSITE']='1'
    [void]$info.Environment.Remove('PYTHONHOME');[void]$info.Environment.Remove('PYTHONPATH')
    foreach($item in $items){$info.ArgumentList.Add($item)}
    $p=[Diagnostics.Process]::Start($info)
    $stdout=$p.StandardOutput.ReadToEndAsync();$stderr=$p.StandardError.ReadToEndAsync()
    $p.WaitForExit()
    [IO.File]::WriteAllText((Join-Path $out $log),$stdout.Result+$stderr.Result,[Text.UTF8Encoding]::new($false))
    if($p.ExitCode -ne 0){Write-Output $stderr.Result;throw "Native validation failed; see $log (exit $($p.ExitCode))"}
    Write-Output "Passed $Stage; evidence: $log"
}
$uv=Join-Path $root '.runtime\uv.exe'
$managed=Join-Path $root '.runtime\python\cpython-3.13.16-windows-x86_64-none\python.exe'
$env:UV_CACHE_DIR=Join-Path $root '.runtime\uv-cache'
$env:UV_PYTHON_INSTALL_DIR=Join-Path $root '.runtime\python'
$env:UV_PROJECT_ENVIRONMENT=Join-Path $out 'qa-env'
$env:UV_LINK_MODE='copy'
$python=Join-Path $env:UV_PROJECT_ENVIRONMENT 'Scripts\python.exe'
switch($Stage){
    'Lock' {Run-Native $uv @('lock','--directory',(Join-Path $root 'gateway'),'--python',$managed) 'lock.log'}
    'Setup' {Run-Native $uv @('sync','--directory',(Join-Path $root 'gateway'),'--frozen','--no-dev','--group','build','--python',$managed) 'setup.log'}
    'Tests' {Run-Native $python @('-W','error','-m','unittest','discover','-s','gateway/tests','-v') 'gateway-tests.log'}
    'Build' {Run-Native $python @('-m','PyInstaller','package.spec','--noconfirm','--distpath',(Join-Path $out 'desktop'),'--workpath',(Join-Path $out 'build')) 'build.log' (Join-Path $root 'gateway')}
    'Smoke' {Run-Native $python @('tools/portable-smoke.py','--native',(Join-Path $out 'desktop\NeuralResonance\NeuralResonance.exe'),'--output',(Join-Path $out 'native-smoke.json')) 'native-smoke.log'}
    'SourceSetup' {
        $env:NEURAL_RESONANCE_RUNTIME=Join-Path $out 'source-runtime'
        Run-Native $ps7 @('-NoLogo','-NoProfile','-NonInteractive','-File',(Join-Path $root 'Start-Windows.ps1'),'-SetupOnly') 'source-setup.log'
    }
    'SourceSmoke' {
        $env:NEURAL_RESONANCE_RUNTIME=Join-Path $out 'source-runtime'
        Run-Native $python @('tools/portable-smoke.py','--source','--pwsh',$ps7,'--output',(Join-Path $out 'source-smoke.json')) 'source-smoke.log'
    }
    'SourceRepair' {
        $env:NEURAL_RESONANCE_RUNTIME=Join-Path $out 'source-runtime'
        Run-Native $python @('tools/verify-runtime-repair.py','--pwsh',$ps7,'--output',(Join-Path $out 'source-repair.json')) 'source-repair.log'
    }
    'Browser' {
        Run-Native $python @('tools/verify-portable-browser.py','--native',(Join-Path $out 'desktop\NeuralResonance\NeuralResonance.exe')) 'browser.log'
    }
    'LiveBrowser' {
        Run-Native $python @('tools/verify-portable-browser.py','--url','http://127.0.0.1:8767') 'live-browser.log'
    }
}
