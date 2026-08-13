#Requires -Version 5.1
<#
.SYNOPSIS
  Private ScamTrace Supabase backup into backups/scamtrace-supabase/<timestamp>/

.DESCRIPTION
  Never prints database passwords or full credential-bearing URLs.
  Prefers pg_dump when SCAMTRACE_DATABASE_URL (or DATABASE_URL / DIRECT_URL) is set.
  Falls back to supabase db dump --linked when CLI + Docker are available.
  Always attempts a JSON table export when SUPABASE_URL + service role are available.
  Does not modify the live Supabase project (read-only dumps/exports only).

.EXAMPLE
  .\scripts\backup-scamtrace-supabase.ps1
#>
param(
  [string]$BackupRoot = $(if ($env:SCAMTRACE_BACKUP_ROOT) { $env:SCAMTRACE_BACKUP_ROOT } else { "backups/scamtrace-supabase" })
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

function Write-Info([string]$msg) { Write-Host "[backup] $msg" }
function Write-Warn([string]$msg) { Write-Warning $msg }

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

function Get-DbUrl {
  foreach ($n in @("SCAMTRACE_DATABASE_URL", "DATABASE_URL", "DIRECT_URL")) {
    $v = [Environment]::GetEnvironmentVariable($n)
    if ($v -and $v.Trim().Length -gt 0) { return $v.Trim() }
  }
  return $null
}

function Redact-Url([string]$url) {
  if (-not $url) { return "(none)" }
  try {
    # postgresql://user:pass@host:port/db → postgresql://user:***@host:port/db
    return [regex]::Replace($url, '(?<=://[^:/?]+:)([^@]+)(?=@)', '***')
  } catch {
    return "(set, redacted)"
  }
}

function Test-Command([string]$name) {
  return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

Import-DotEnv

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outDir = Join-Path $BackupRoot $timestamp
$pgDir = Join-Path $outDir "postgres"
$jsonDir = Join-Path $outDir "json"
$metaDir = Join-Path $outDir "meta"
$typesDir = Join-Path $outDir "types"
$storageDir = Join-Path $outDir "storage"

New-Item -ItemType Directory -Force -Path $pgDir, $jsonDir, $metaDir, $typesDir, $storageDir | Out-Null

$manifest = [ordered]@{
  created_at     = (Get-Date).ToUniversalTime().ToString("o")
  project_ref    = "zomkqhaheyupvmcyednx"
  project_name   = "ScamTrace Engine"
  out_dir        = $outDir
  postgres_dump  = [ordered]@{ attempted = $false; ok = $false; method = $null; files = @(); error = $null }
  json_export    = [ordered]@{ attempted = $false; ok = $false; error = $null }
  storage        = [ordered]@{ attempted = $false; ok = $false; buckets = 0; error = $null }
  types          = [ordered]@{ attempted = $false; ok = $false; error = $null }
  tooling        = [ordered]@{
    pg_dump       = (Test-Command "pg_dump")
    supabase_cli  = (Test-Command "supabase")
    docker        = $false
    node          = (Test-Command "node")
    db_url_set    = $false
  }
}

# Docker daemon check (do not fail backup if down)
try {
  docker info 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { $manifest.tooling.docker = $true }
} catch {
  $manifest.tooling.docker = $false
}

$dbUrl = Get-DbUrl
$manifest.tooling.db_url_set = [bool]$dbUrl
Write-Info "Output: $outDir"
Write-Info ("DB URL: " + (Redact-Url $dbUrl))
Write-Info ("pg_dump=$(Test-Command 'pg_dump') supabase=$(Test-Command 'supabase') docker=$($manifest.tooling.docker)")

"zomkqhaheyupvmcyednx" | Set-Content -Encoding utf8 (Join-Path $metaDir "project-ref.txt")

# --- Postgres dumps ---
$manifest.postgres_dump.attempted = $true
$pgOk = $false

if ($dbUrl -and (Test-Command "pg_dump")) {
  $manifest.postgres_dump.method = "pg_dump+SCAMTRACE_DATABASE_URL"
  try {
    $schemaFile = Join-Path $pgDir "schema.sql"
    $dataSql = Join-Path $pgDir "data.sql"
    $dataDump = Join-Path $pgDir "data.dump"
    # Use env var for libpq so the password is not passed on argv in clear process lists when possible
    $env:PGPASSWORD = $null
    & pg_dump --dbname=$dbUrl --schema-only --no-owner --no-acl -f $schemaFile 2>$null
    if ($LASTEXITCODE -ne 0) { throw "pg_dump schema-only failed (exit $LASTEXITCODE)" }
    & pg_dump --dbname=$dbUrl --data-only --no-owner --no-acl -f $dataSql 2>$null
    if ($LASTEXITCODE -ne 0) { throw "pg_dump data-only SQL failed (exit $LASTEXITCODE)" }
    & pg_dump --dbname=$dbUrl --format=custom --no-owner --no-acl -f $dataDump 2>$null
    if ($LASTEXITCODE -ne 0) { throw "pg_dump custom format failed (exit $LASTEXITCODE)" }
    $manifest.postgres_dump.files = @("postgres/schema.sql", "postgres/data.sql", "postgres/data.dump")
    $pgOk = $true
  } catch {
    $manifest.postgres_dump.error = $_.Exception.Message
    Write-Warn $manifest.postgres_dump.error
  }
} elseif ((Test-Command "supabase") -and $manifest.tooling.docker) {
  $manifest.postgres_dump.method = "supabase db dump --linked"
  try {
    $schemaFile = Join-Path $pgDir "schema.sql"
    $dataSql = Join-Path $pgDir "data.sql"
    supabase db dump --linked --agent=no -f $schemaFile 2>$null
    if ($LASTEXITCODE -ne 0) { throw "supabase db dump schema failed (exit $LASTEXITCODE)" }
    supabase db dump --linked --agent=no --data-only -f $dataSql 2>$null
    if ($LASTEXITCODE -ne 0) { throw "supabase db dump data failed (exit $LASTEXITCODE)" }
    $manifest.postgres_dump.files = @("postgres/schema.sql", "postgres/data.sql")
    $pgOk = $true
  } catch {
    $manifest.postgres_dump.error = $_.Exception.Message
    Write-Warn $manifest.postgres_dump.error
  }
} else {
  $missing = @()
  if (-not $dbUrl) { $missing += "SCAMTRACE_DATABASE_URL (or DATABASE_URL / DIRECT_URL)" }
  if (-not (Test-Command "pg_dump")) { $missing += "pg_dump on PATH" }
  if (-not $manifest.tooling.docker) { $missing += "Docker Desktop running (for supabase db dump)" }
  $manifest.postgres_dump.error = "Postgres dump skipped. Required: " + ($missing -join "; ")
  Write-Warn $manifest.postgres_dump.error
}

$manifest.postgres_dump.ok = $pgOk

# --- JSON export (service role) ---
$hasUrl = [bool]$env:SUPABASE_URL
$hasKey = [bool]($env:SUPABASE_SERVICE_ROLE_KEY -or $env:SUPABASE_KEY)
if ($hasUrl -and $hasKey -and (Test-Command "node")) {
  $manifest.json_export.attempted = $true
  try {
    $exporter = Join-Path $RepoRoot "scripts/export-scamtrace-supabase-json.mjs"
    node $exporter --out $jsonDir
    if ($LASTEXITCODE -ne 0) { throw "JSON export exited $LASTEXITCODE" }
    $manifest.json_export.ok = $true
  } catch {
    $manifest.json_export.error = $_.Exception.Message
    Write-Warn $manifest.json_export.error
  }
} else {
  $manifest.json_export.error = "Skipped (need SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY/SUPABASE_KEY + node)"
  Write-Warn $manifest.json_export.error
}

# --- Types (optional, non-fatal) ---
if (Test-Command "supabase") {
  $manifest.types.attempted = $true
  try {
    $typesFile = Join-Path $typesDir "database.types.ts"
    $tmpErr = Join-Path $env:TEMP "scamtrace-types-err.txt"
    $output = & supabase gen types typescript --linked --schema public --agent=no 2>$tmpErr
    if ($LASTEXITCODE -eq 0 -and $output -and ($output -join "`n").Length -gt 50) {
      ($output -join "`n") | Set-Content -Encoding utf8 $typesFile
      $manifest.types.ok = $true
    } else {
      $errText = if (Test-Path $tmpErr) { (Get-Content $tmpErr -Raw) } else { "unknown" }
      $manifest.types.error = ("types generation failed: " + $errText).Substring(0, [Math]::Min(300, (("types generation failed: " + $errText).Length)))
    }
  } catch {
    $manifest.types.error = $_.Exception.Message
  }
}

# --- Storage ---
$storageScript = Join-Path $RepoRoot "scripts/backup-scamtrace-storage.ps1"
$manifest.storage.attempted = $true
try {
  & $storageScript -OutDir $storageDir
  $statusFile = Join-Path $storageDir "STATUS.txt"
  if (Test-Path $statusFile) {
    $manifest.storage.ok = $true
    $statusText = Get-Content $statusFile -Raw
    if ($statusText -match "buckets=(\d+)") {
      $manifest.storage.buckets = [int]$Matches[1]
    }
  }
} catch {
  $manifest.storage.error = $_.Exception.Message
  Write-Warn $manifest.storage.error
}

# --- Copy SQL sources for offline schema ---
$sqlCopy = Join-Path $outDir "sql-repo"
New-Item -ItemType Directory -Force -Path $sqlCopy | Out-Null
Copy-Item (Join-Path $RepoRoot "sql\*.sql") $sqlCopy -ErrorAction SilentlyContinue

$notes = @"
ScamTrace Engine backup $timestamp
Postgres dump ok: $pgOk
JSON export ok: $($manifest.json_export.ok)
Storage buckets: $($manifest.storage.buckets)
See docs/scamtrace-supabase-archive/RESTORE.md
"@
$notes | Set-Content -Encoding utf8 (Join-Path $metaDir "notes.txt")

$manifestPath = Join-Path $outDir "MANIFEST.json"
($manifest | ConvertTo-Json -Depth 6) | Set-Content -Encoding utf8 $manifestPath

Write-Info "MANIFEST written"
Write-Info ("Postgres dump: " + $(if ($pgOk) { "OK" } else { "NOT AVAILABLE - see MANIFEST" }))
Write-Info ("JSON export: " + $(if ($manifest.json_export.ok) { "OK" } else { "FAILED/SKIPPED" }))
Write-Info ("Storage: buckets=$($manifest.storage.buckets)")
Write-Host $outDir

if (-not $pgOk -and -not $manifest.json_export.ok) {
  exit 2
}
exit 0
