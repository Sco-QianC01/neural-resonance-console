#Requires -Version 7
$ErrorActionPreference='Stop'
$OutputEncoding=[Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding=$OutputEncoding
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$out=Join-Path $root 'artifacts\portable-20261012'
$data=Join-Path $env:LOCALAPPDATA 'NeuralResonance'
$statePath=Join-Path $data 'runtime.json'
if(-not(Test-Path -LiteralPath $statePath)){throw 'Live runtime state missing'}
$state=Get-Content -LiteralPath $statePath -Raw|ConvertFrom-Json
$url=$state.url.TrimEnd('/')
$health=Invoke-RestMethod ($url+'/api/health') -TimeoutSec 3
if($health.build -ne 'score-evidence-20261015-v9' -or $health.upstream){throw 'Wrong deployed acquisition build or mode'}
$runtime=Invoke-RestMethod ($url+'/api/runtime') -TimeoutSec 3
$deviceList=Invoke-RestMethod ($url+'/api/gateway/devices') -TimeoutSec 3
$socket=[Net.WebSockets.ClientWebSocket]::new()
$token=[Threading.CancellationTokenSource]::new(5000)
$ws=$url.Replace('http://','ws://')+'/ws/live'
[void]$socket.ConnectAsync([uri]$ws,$token.Token).GetAwaiter().GetResult()
$buffer=[byte[]]::new(262144)
$segment=[ArraySegment[byte]]::new($buffer)
$packets=@()
try {
    for($i=0;$i -lt 2;$i++){
        $text=[IO.MemoryStream]::new()
        do {
            $received=$socket.ReceiveAsync($segment,$token.Token).GetAwaiter().GetResult()
            $text.Write($buffer,0,$received.Count)
        }while(-not $received.EndOfMessage)
        $value=[Text.Encoding]::UTF8.GetString($text.ToArray())|ConvertFrom-Json
        $packets+=[pscustomobject]@{source=$value.source;transport=$value.transport
            rawSamples=@($value.rawEegSamples).Count;rawSequence=$value.rawSequence
            attention=$value.eeg.attention;meditation=$value.eeg.meditation}
        $text.Dispose()
    }
}finally{$socket.Dispose();$token.Dispose()}
$shortcut=Join-Path $env:USERPROFILE 'Desktop\AI音疗\02_启动神经共振控制台.lnk'
$clicked=$false
if(Test-Path -LiteralPath $shortcut -PathType Leaf){
    $shell=New-Object -ComObject WScript.Shell
    $link=$shell.CreateShortcut($shortcut)
    $expected=Join-Path $root 'artifacts\release\v0.11.3\verified-windows\NeuralResonance\NeuralResonance.exe'
    if($link.TargetPath -ne $expected -or -not(Test-Path -LiteralPath $expected)){throw 'Unexpected console shortcut target'}
    Start-Process -FilePath $shortcut | Out-Null
    Start-Sleep -Milliseconds 800
    $after=Get-Content -LiteralPath $statePath -Raw|ConvertFrom-Json
    if($after.pid -ne $state.pid){throw 'Duplicate shortcut click changed the server PID'}
    $clicked=$true
}
$result=[ordered]@{pass=$true;checkedAt=(Get-Date -Format o);url=$url;build=$health.build
    standalone=$true;actualWebSocket=$packets;shortcutClickReusedSamePID=$clicked
    eegSamples=$runtime.core.streams.eeg.samples;spo2Samples=$runtime.core.streams.spo2.samples
    discoveredPorts=@($deviceList.devices|Select-Object port,vid,pid)
    deviceStates=$runtime.devices;physicalHardwareVerified=$false}
$result|ConvertTo-Json -Depth 6|Set-Content -LiteralPath (Join-Path $out 'live-audit.json') -Encoding utf8NoBOM
[pscustomobject]@{pass=$true;url=$url;shortcutSamePID=$clicked
    rawSamplesInTwoPackets=($packets.rawSamples|Measure-Object -Sum).Sum
    realEegSamples=$runtime.core.streams.eeg.samples}|ConvertTo-Json -Compress
