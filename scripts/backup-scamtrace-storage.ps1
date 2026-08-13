#Requires -Version 5.1
<#
.SYNOPSIS
  List/download Supabase Storage buckets for ScamTrace (read-only).

.PARAMETER OutDir
  Target directory (usually backups/scamtrace-supabase/<ts>/storage)
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$OutDir
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

function Import-DotEnv {
  $envFile = Join-Path $RepoRoot ".env"
  if (-not (Test-Path $envFile)) { return }
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
    $k, $v = $_.Split('=', 2)
    $name = $k.Trim()
    $val = $v.Trim().Trim('"').Trim("'")
    if (-not [string]::IsNullOrEmpty($name) -and -not (Test-Path "Env:$name")) {
      Set-Item -Path "Env:$name" -Value $val
    }
  }
}

Import-DotEnv
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$url = ($env:SUPABASE_URL -replace '/$', '')
$key = $env:SUPABASE_SERVICE_ROLE_KEY
if (-not $key) { $key = $env:SUPABASE_KEY }

if (-not $url -or -not $key) {
  @"
status=skipped
buckets=0
reason=Missing SUPABASE_URL or service role key
"@ | Set-Content -Encoding utf8 (Join-Path $OutDir "STATUS.txt")
  exit 0
}

# List buckets via Storage API
$headers = @{
  apikey         = $key
  Authorization  = "Bearer $key"
}
try {
  $resp = Invoke-RestMethod -Method GET -Uri "$url/storage/v1/bucket" -Headers $headers
} catch {
  @"
status=error
buckets=0
reason=Storage list failed (see script stderr). Live inventory previously found zero buckets.
"@ | Set-Content -Encoding utf8 (Join-Path $OutDir "STATUS.txt")
  Write-Warning $_.Exception.Message
  exit 0
}

$buckets = @($resp)
$count = $buckets.Count
$bucketNames = @($buckets | ForEach-Object { $_.name })

if ($count -eq 0) {
  @"
status=ok
buckets=0
note=No Supabase Storage buckets on this project. Nothing to download.
"@ | Set-Content -Encoding utf8 (Join-Path $OutDir "STATUS.txt")
  ($bucketNames | ConvertTo-Json) | Set-Content -Encoding utf8 (Join-Path $OutDir "buckets.json")
  exit 0
}

($buckets | ConvertTo-Json -Depth 6) | Set-Content -Encoding utf8 (Join-Path $OutDir "buckets.json")

foreach ($b in $buckets) {
  $name = $b.name
  $dest = Join-Path $OutDir $name
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  # List objects (paginate simply)
  $list = Invoke-RestMethod -Method POST -Uri "$url/storage/v1/object/list/$name" -Headers ($headers + @{ "Content-Type" = "application/json" }) -Body '{"prefix":"","limit":1000}'
  ($list | ConvertTo-Json -Depth 6) | Set-Content -Encoding utf8 (Join-Path $dest "_listing.json")
  foreach ($obj in @($list)) {
    if (-not $obj.name) { continue }
    # Skip "folder" placeholders
    if ($obj.id -eq $null -and $obj.name.EndsWith("/")) { continue }
    $objectPath = $obj.name
    $outFile = Join-Path $dest ($objectPath -replace '/', [IO.Path]::DirectorySeparatorChar)
    $parent = Split-Path $outFile -Parent
    if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
    try {
      Invoke-WebRequest -Method GET -Uri "$url/storage/v1/object/$name/$objectPath" -Headers $headers -OutFile $outFile | Out-Null
    } catch {
      Write-Warning "Failed to download $name/$objectPath"
    }
  }
}

@"
status=ok
buckets=$count
names=$($bucketNames -join ',')
note=Objects downloaded when list API returned files. Remote Storage was not modified.
"@ | Set-Content -Encoding utf8 (Join-Path $OutDir "STATUS.txt")
exit 0
