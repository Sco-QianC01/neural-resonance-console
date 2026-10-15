#Requires -Version 7
[CmdletBinding()]
param([ValidateSet('Setup','Tests','Build','Browser','FullBrowser','LiveFullBrowser','Chopin','Documents','Repair','Syntax','Teacher','Revision','ScoreSource','Score')][string]$Stage='Tests')
$ErrorActionPreference='Stop'
$OutputEncoding=[Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding=$OutputEncoding
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$out=Join-Path $root 'artifacts\system-audit-20261012'
[void][IO.Directory]::CreateDirectory($out)
$uv=Join-Path $root '.runtime\uv.exe'
$managed=Join-Path $root '.runtime\python\cpython-3.13.16-windows-x86_64-none\python.exe'
$ps7='Q:\人工智能\Runtime\PowerShell\7.6.6\pwsh.exe'
foreach($file in @($uv,$managed,$ps7)){
    if(-not(Test-Path -LiteralPath $file -PathType Leaf)){throw "Required local entrance missing: $file"}
}
$env:UV_PROJECT_ENVIRONMENT=Join-Path $out 'qa-env'
$env:UV_CACHE_DIR=Join-Path $root '.runtime\uv-cache'
$env:UV_PYTHON_INSTALL_DIR=Join-Path $root '.runtime\python'
$env:UV_LINK_MODE='copy'
$python=Join-Path $env:UV_PROJECT_ENVIRONMENT 'Scripts\python.exe'
function Run([string]$exe,[string[]]$items,[string]$log,[string]$working=$root){
    if(-not(Test-Path -LiteralPath $exe -PathType Leaf)){throw "Executable missing: $exe"}
    $info=[Diagnostics.ProcessStartInfo]::new()
    $info.FileName=$exe;$info.WorkingDirectory=$working;$info.UseShellExecute=$false;$info.CreateNoWindow=$true
    $info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true
    $info.StandardOutputEncoding=$OutputEncoding;$info.StandardErrorEncoding=$OutputEncoding
    $info.Environment['PYTHONIOENCODING']='utf-8';$info.Environment['PYTHONUTF8']='1';$info.Environment['PYTHONNOUSERSITE']='1'
    [void]$info.Environment.Remove('PYTHONHOME');[void]$info.Environment.Remove('PYTHONPATH')
    foreach($item in $items){$info.ArgumentList.Add($item)}
    $process=[Diagnostics.Process]::Start($info)
    $stdout=$process.StandardOutput.ReadToEndAsync();$stderr=$process.StandardError.ReadToEndAsync()
    $process.WaitForExit()
    [IO.File]::WriteAllText((Join-Path $out $log),$stdout.Result+$stderr.Result,$OutputEncoding)
    if($process.ExitCode -ne 0){Write-Output ($stdout.Result+$stderr.Result);throw "Verification failed: $log"}
    Write-Output "Passed $Stage; evidence: $log"
}
switch($Stage){
    'Setup' {
        Run $uv @('sync','--directory',(Join-Path $root 'gateway'),'--frozen','--no-dev','--group','audit','--group','build','--python',$managed) 'windows-setup.log'
        Run $uv @('pip','install','--python',$python,'pillow') 'qa-image-dependency.log'
    }
    'Tests' {Run $python @('-W','error','-m','unittest','discover','-s','gateway/tests','-v') 'windows-gateway.log'}
    'Build' {Run $python @('-m','PyInstaller','package.spec','--noconfirm','--distpath',(Join-Path $root 'artifacts\portable-20261012\desktop'),'--workpath',(Join-Path $out 'build')) 'native-build.log' (Join-Path $root 'gateway')}
    'Browser' {Run $python @('tools/browser-audit.py','--engine','chromium','--channel','msedge','--output',(Join-Path $out 'edge-functional.json')) 'edge-functional.log'}
    'Teacher' {Run $python @('tools/verify-teacher-workflow.py','--url','http://127.0.0.1:8767','--channel','msedge') 'teacher-live-browser.log'}
    'Revision' {Run $python @('tools/verify-teacher-revision.py','--url','http://127.0.0.1:8767','--channel','msedge') 'revision-live-browser.log'}
    'ScoreSource' {Run $python @('tools/verify-score-evidence.py','--source','--channel','msedge') 'score-source-browser.log'}
    'Score' {Run $python @('tools/verify-score-evidence.py','--channel','msedge') 'score-live-browser.log'}
    'FullBrowser' {Run $python @('tools/system-full-browser.py','--source') 'source-full-browser.log'}
    'LiveFullBrowser' {Run $python @('tools/system-full-browser.py') 'live-full-browser.log'}
    'Chopin' {Run $python @('tools/verify-planar-windows.py','--phase','chopin','--chopin-probe','--source') 'chopin-source.log'}
    'Documents' {Run $python @('tools/verify-planar-windows.py','--phase','reader','--doc-probe','--source') 'documents-source.log'}
    'Repair' {
        $env:NEURAL_RESONANCE_RUNTIME=Join-Path $root 'artifacts\portable-20261012\source-runtime'
        Run $python @('tools/verify-missing-dependency.py','--pwsh',$ps7,'--output',(Join-Path $out 'missing-dependency-repair.json')) 'missing-dependency-repair.log'
    }
    'Syntax' {
        $rows=@()
        foreach($script in @(Join-Path $root 'Start-Windows.ps1')+@(Get-ChildItem -LiteralPath (Join-Path $root 'tools') -Filter '*.ps1' -File | ForEach-Object FullName)){
            if(-not(Test-Path -LiteralPath $script -PathType Leaf)){throw 'Script disappeared'}
            $tokens=$null;$errors=$null
            [void][Management.Automation.Language.Parser]::ParseFile($script,[ref]$tokens,[ref]$errors)
            $rows+=@{file=$script.Substring($root.Length+1);errors=@($errors|ForEach-Object Message)}
            if($errors.Count){throw "PowerShell syntax failure: $script"}
        }
        [IO.File]::WriteAllText((Join-Path $out 'powershell-syntax.json'),($rows|ConvertTo-Json -Depth 4),$OutputEncoding)
        Write-Output "PowerShell 7: $($rows.Count) scripts parsed"
    }
}
