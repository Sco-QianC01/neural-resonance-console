param([Parameter(Mandatory)][string[]]$NodeArguments)
$ErrorActionPreference='Stop'
if($PSVersionTable.PSVersion.Major -lt 7){throw 'PowerShell 7 is required'}
$root=Split-Path $PSScriptRoot -Parent
$node=(Get-Command node -ErrorAction SilentlyContinue).Source
if(!$node){$node='Q:\音疗系统\夜莺\01_工程\yeying\.runtime\node\node.exe'}
if(!(Test-Path -LiteralPath $node)){throw 'Node.js 20+ is missing'}
$start=[Diagnostics.ProcessStartInfo]::new()
$start.FileName=$node
$start.WorkingDirectory=$root
$start.UseShellExecute=$false
$start.CreateNoWindow=$true
$start.RedirectStandardOutput=$true
$start.RedirectStandardError=$true
$start.StandardOutputEncoding=[Text.UTF8Encoding]::new()
$start.StandardErrorEncoding=[Text.UTF8Encoding]::new()
foreach($argument in $NodeArguments){$start.ArgumentList.Add($argument)}
$process=[Diagnostics.Process]::Start($start)
$output=$process.StandardOutput.ReadToEndAsync()
$errors=$process.StandardError.ReadToEndAsync()
$process.WaitForExit()
Write-Output $output.Result
if($errors.Result){[Console]::Error.WriteLine($errors.Result)}
if($process.ExitCode -ne 0){throw "Node failed: $($process.ExitCode)"}
