param([string]$Root = (Split-Path -Parent $PSScriptRoot))
$ErrorActionPreference = 'Stop'
$OutputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = $OutputEncoding
if ($PSVersionTable.PSVersion.Major -lt 7) { throw 'PowerShell 7 required' }
if (-not (Test-Path -LiteralPath $Root)) { throw 'Repository missing' }
$destination = Join-Path $Root 'artifacts\research-20261008'
[IO.Directory]::CreateDirectory($destination) | Out-Null
$sources = @(
    @{Name='vmus-main.html'; Url='https://vmus.net/'},
    @{Name='vmus-help.html'; Url='https://v3.vmus.net/help.html?lang=zh'},
    @{Name='vmus-case.html'; Url='https://v3.vmus.net/studies/yang2007/'},
    @{Name='vmus-analyzer.html'; Url='https://v3.vmus.net/'},
    @{Name='vmus-study.js'; Url='https://v3.vmus.net/studies/_shared/study.js'},
    @{Name='vmus-study.json'; Url='https://v3.vmus.net/studies/yang2007/study.json'},
    @{Name='standard-distance.html'; Url='https://pro.arcgis.com/en/pro-app/latest/tool-reference/spatial-statistics/standard-distance.htm'},
    @{Name='nist-standard-deviation.html'; Url='https://www.itl.nist.gov/div898/handbook/eda/section3/eda356.htm'},
    @{Name='dixon-spie-2003.pdf'; Url='https://webspace.eecs.qmul.ac.uk/s.e.dixon/pub/2003/spie.pdf'},
    @{Name='air-worm-2005.pdf'; Url='https://www.cp.jku.at/research/papers/dixon_icmc_2005.pdf'},
    @{Name='thinkgear-protocol.html'; Url='https://developer.neurosky.com/docs/doku.php?id=thinkgear_communications_protocol'},
    @{Name='esense.html'; Url='https://developer.neurosky.com/docs/doku.php?id=esenses_tm'},
    @{Name='worm-crossref.json'; Url='https://api.crossref.org/works?query.title=Visualizing%20Expressive%20Performance%20in%20Tempo-Loudness%20Space&rows=3'}
)
$results = foreach ($source in $sources) {
    $file = Join-Path $destination $source.Name
    try {
        $response = Invoke-WebRequest -Uri $source.Url -TimeoutSec 25 -MaximumRedirection 5
        if ($source.Name.EndsWith('.pdf')) {
            [IO.File]::WriteAllBytes($file, $response.Content)
        } else {
            [IO.File]::WriteAllText($file, [string]$response.Content, [Text.UTF8Encoding]::new($false))
        }
        [pscustomobject]@{
            File=$source.Name; Url=$source.Url; Status=[int]$response.StatusCode
            Bytes=(Get-Item -LiteralPath $file).Length
            Sha256=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash
            RetrievedAt=[DateTimeOffset]::Now.ToString('o')
        }
    } catch {
        [pscustomobject]@{File=$source.Name; Url=$source.Url; Status='unavailable'; Error=$_.Exception.Message}
    }
}
$results | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $destination 'sources.json') -Encoding utf8NoBOM
$results | Select-Object File,Status,Bytes,Error | Format-Table -AutoSize
