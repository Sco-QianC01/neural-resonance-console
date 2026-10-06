param([Parameter(Mandatory)][string[]]$GitArguments)
$ErrorActionPreference='Stop'
if($PSVersionTable.PSVersion.Major -lt 7){throw 'PowerShell 7 is required'}
$root=Split-Path $PSScriptRoot -Parent
$git=(Get-Command git -ErrorAction SilentlyContinue).Source
if(!$git){$git='C:\Program Files\Git\cmd\git.exe'}
if(!(Test-Path -LiteralPath $git)){throw 'Git is missing'}
$start=[Diagnostics.ProcessStartInfo]::new()
$start.FileName=$git;$start.WorkingDirectory=$root
$start.UseShellExecute=$false;$start.CreateNoWindow=$true
$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
$start.StandardOutputEncoding=[Text.UTF8Encoding]::new()
$start.StandardErrorEncoding=[Text.UTF8Encoding]::new()
foreach($argument in $GitArguments){$start.ArgumentList.Add($argument)}
$process=[Diagnostics.Process]::Start($start)
$output=$process.StandardOutput.ReadToEndAsync();$errors=$process.StandardError.ReadToEndAsync()
if(!$process.WaitForExit(30000)){$process.Kill();throw 'Git timed out'}
Write-Output $output.Result
if($errors.Result){[Console]::Error.WriteLine($errors.Result)}
if($process.ExitCode -ne 0){throw "Git failed: $($process.ExitCode)"}
