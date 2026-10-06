param([ValidateSet('inspect','create','status')][string]$Mode='inspect')
$ErrorActionPreference='Stop'
if($PSVersionTable.PSVersion.Major -lt 7){throw 'PowerShell 7 is required'}
$root=Split-Path $PSScriptRoot -Parent
$git='C:\Program Files\Git\cmd\git.exe'
if(!(Test-Path -LiteralPath $git)){throw 'Git is missing'}
$account='Sco-QianC01'
$name='neural-resonance-console'
$start=[Diagnostics.ProcessStartInfo]::new()
$start.FileName=$git;$start.WorkingDirectory=$root
$start.UseShellExecute=$false;$start.CreateNoWindow=$true
$start.RedirectStandardInput=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
$start.Environment['GCM_INTERACTIVE']='never'
foreach($argument in @('credential-manager','get')){$start.ArgumentList.Add($argument)}
$process=[Diagnostics.Process]::Start($start)
$output=$process.StandardOutput.ReadToEndAsync();$errors=$process.StandardError.ReadToEndAsync()
$process.StandardInput.Write("protocol=https`nhost=github.com`nusername=$account`n`n")
$process.StandardInput.Close()
if(!$process.WaitForExit(30000)){$process.Kill();throw 'GitHub credential request timed out'}
if($process.ExitCode -ne 0){throw 'Existing GitHub authorization is unavailable'}
# Credentials stay in this process and are never written to output, files or Git.
$credential=@{}
foreach($line in ($output.Result -split "`n")){
    $pair=$line.TrimEnd("`r") -split '=',2
    if($pair.Count -eq 2){$credential[$pair[0]]=$pair[1]}
}
if(!$credential.password){throw 'Existing GitHub authorization is unavailable'}
$headers=@{
    Authorization="Bearer $($credential.password)"
    Accept='application/vnd.github+json'
    'X-GitHub-Api-Version'='2022-11-28'
    'User-Agent'='NeuralResonanceConsole'
}
function Request-GitHub([string]$Method,[string]$ApiPath,[object]$Body=$null){
    try{
        $arguments=@{Method=$Method;Uri="https://api.github.com$ApiPath";Headers=$headers;TimeoutSec=30}
        if($null -ne $Body){$arguments.Body=($Body|ConvertTo-Json -Depth 6);$arguments.ContentType='application/json'}
        return Invoke-RestMethod @arguments
    }catch{
        $status=[int]$_.Exception.Response.StatusCode
        if($status -eq 404){return $null}
        throw "GitHub API request failed (HTTP $status)"
    }
}
try{
    $user=Request-GitHub GET '/user'
    if($user.login -ne $account){throw 'GitHub authorization belongs to a different account'}
    $repository=Request-GitHub GET "/repos/$account/$name"
    if(!$repository -and $Mode -eq 'create'){
        $repository=Request-GitHub POST '/user/repos' @{
            name=$name;description='Independent EEG interaction console: attention, relaxation and experimental music controls'
            private=$true;auto_init=$false;has_projects=$false;has_wiki=$false
        }
    }
    if($repository -and (!$repository.permissions.push -or $repository.owner.login -ne $account)){
        throw 'Target repository ownership or write access differs'
    }
    $result=[ordered]@{account=$user.login;repository="$account/$name";exists=[bool]$repository}
    if($repository){$result.url=$repository.html_url;$result.private=$repository.private;$result.defaultBranch=$repository.default_branch}
    if($repository -and $Mode -eq 'status'){
        $runs=Request-GitHub GET "/repos/$account/$name/actions/runs?per_page=4"
        $result.runs=@($runs.workflow_runs | ForEach-Object {
            [ordered]@{id=$_.id;name=$_.name;head=$_.head_sha;status=$_.status;conclusion=$_.conclusion;url=$_.html_url}
        })
        $pages=Request-GitHub GET "/repos/$account/$name/pages"
        $result.pagesConfigured=[bool]$pages
        if($pages){$result.pagesUrl=$pages.html_url;$result.pagesStatus=$pages.status}
        $result.accountPlan=$user.plan.name
    }
    $directory=Join-Path $root 'artifacts'
    [IO.Directory]::CreateDirectory($directory)|Out-Null
    [IO.File]::WriteAllText((Join-Path $directory 'github-repository.json'),($result|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
    $result|ConvertTo-Json
}finally{
    $credential.Clear();$headers.Clear();$output=$null
}
